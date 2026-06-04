import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ── Firebase Admin: 구성됨(true) 토글 가능 ─────────────────────────
const pushConfigured = vi.fn(() => true);
vi.mock("@/lib/firebase/admin", () => ({
  isPushConfigured: () => pushConfigured(),
  pushMessaging: () => ({ sendEachForMulticast: vi.fn() }),
}));

// ── push.ts: sendPush만 mock, formatPush는 실제(순수) 유지 ──────────
const sendPushMock = vi.fn();
vi.mock("./push", async (importActual) => {
  const actual = await importActual<typeof import("./push")>();
  return { ...actual, sendPush: (...a: unknown[]) => sendPushMock(...a) };
});

// ── Supabase admin: 체이너블 쿼리 빌더 mock ────────────────────────
let PENDING: Array<Record<string, unknown>> = [];
let TOKENS: string[] = [];
const captures = {
  updates: [] as Array<{ table: string; vals: Record<string, unknown>; filters: Record<string, unknown> }>,
  deletes: [] as Array<{ table: string; inVals: { col: string; vals: unknown[] } | null }>,
  inserts: [] as Array<{ table: string; rows: unknown }>,
};

function resolve(state: {
  table: string;
  op: string;
  vals: Record<string, unknown> | null;
  filters: Record<string, unknown>;
  inVals: { col: string; vals: unknown[] } | null;
}) {
  if (state.op === "select") {
    if (state.table === "notifications") return { data: PENDING, error: null };
    if (state.table === "push_subscriptions")
      return { data: TOKENS.map((token) => ({ token })), error: null };
  }
  if (state.op === "update")
    captures.updates.push({ table: state.table, vals: state.vals ?? {}, filters: state.filters });
  if (state.op === "delete")
    captures.deletes.push({ table: state.table, inVals: state.inVals });
  return { data: null, error: null };
}

function makeBuilder(table: string) {
  const state = {
    table,
    op: "select",
    vals: null as Record<string, unknown> | null,
    filters: {} as Record<string, unknown>,
    inVals: null as { col: string; vals: unknown[] } | null,
  };
  const builder: Record<string, unknown> = {
    select: () => builder,
    update: (vals: Record<string, unknown>) => {
      state.op = "update";
      state.vals = vals;
      return builder;
    },
    delete: () => {
      state.op = "delete";
      return builder;
    },
    insert: (rows: unknown) => {
      captures.inserts.push({ table, rows });
      return Promise.resolve({ error: null });
    },
    eq: (col: string, val: unknown) => {
      state.filters[col] = val;
      return builder;
    },
    in: (col: string, vals: unknown[]) => {
      state.inVals = { col, vals };
      return builder;
    },
    limit: () => builder,
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(resolve(state)).then(onF, onR),
  };
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (t: string) => makeBuilder(t) }),
}));

import { deliverPushBatch } from "./index";

const row = (over: Record<string, unknown> = {}) => ({
  id: "n1",
  operator_id: "op1",
  passenger_id: null,
  type: "match_confirmed",
  payload: { matchId: "m1" },
  retry_count: 0,
  last_attempt_at: null,
  ...over,
});

describe("deliverPushBatch (푸시 발송/재시도 오케스트레이션)", () => {
  beforeEach(() => {
    PENDING = [];
    TOKENS = [];
    captures.updates = [];
    captures.deletes = [];
    captures.inserts = [];
    sendPushMock.mockReset();
    pushConfigured.mockReturnValue(true);
  });

  it("env 미구성 → no-op (attempted 0)", async () => {
    pushConfigured.mockReturnValue(false);
    PENDING = [row()];
    const s = await deliverPushBatch();
    expect(s.attempted).toBe(0);
    expect(captures.updates).toHaveLength(0);
  });

  it("pending 없음 → attempted 0", async () => {
    const s = await deliverPushBatch();
    expect(s).toMatchObject({ attempted: 0, sent: 0 });
  });

  it("구독 토큰 없음(옵트아웃) → sent 처리(발송 시도 안 함)", async () => {
    PENDING = [row()];
    TOKENS = [];
    const s = await deliverPushBatch();
    expect(sendPushMock).not.toHaveBeenCalled();
    expect(s.sent).toBe(1);
    expect(captures.updates[0].vals.delivery_status).toBe("sent");
  });

  it("발송 성공 → delivery_status=sent", async () => {
    PENDING = [row()];
    TOKENS = ["tok"];
    sendPushMock.mockResolvedValue({ successCount: 1, failureCount: 0, invalidTokens: [] });
    const s = await deliverPushBatch();
    expect(s.sent).toBe(1);
    expect(captures.updates[0].vals.delivery_status).toBe("sent");
  });

  it("발송 실패(재시도 여유) → pending, retry_count++ (status는 그대로 pending)", async () => {
    PENDING = [row({ retry_count: 0 })];
    TOKENS = ["tok"];
    sendPushMock.mockResolvedValue({ successCount: 0, failureCount: 1, invalidTokens: [] });
    const s = await deliverPushBatch();
    expect(s.pending).toBe(1);
    expect(captures.updates[0].vals.retry_count).toBe(1);
    expect(captures.updates[0].vals.delivery_status).toBeUndefined();
  });

  it("소진(retry_count=3 + 실패) → failed + 마스터 system_error", async () => {
    PENDING = [
      row({ retry_count: 3, last_attempt_at: new Date(1).toISOString() }),
    ];
    TOKENS = ["tok"];
    sendPushMock.mockResolvedValue({ successCount: 0, failureCount: 1, invalidTokens: [] });
    const s = await deliverPushBatch();
    expect(s.failed).toBe(1);
    expect(captures.updates[0].vals.delivery_status).toBe("failed");
    // 마스터 알림(system_error) 인앱 insert 발생
    const masterInsert = captures.inserts.find((i) =>
      JSON.stringify(i.rows).includes("system_error"),
    );
    expect(masterInsert).toBeTruthy();
  });

  it("무효 토큰 → push_subscriptions에서 제거", async () => {
    PENDING = [row()];
    TOKENS = ["dead"];
    sendPushMock.mockResolvedValue({ successCount: 0, failureCount: 1, invalidTokens: ["dead"] });
    await deliverPushBatch();
    const del = captures.deletes.find((d) => d.table === "push_subscriptions");
    expect(del?.inVals).toEqual({ col: "token", vals: ["dead"] });
  });

  it("백오프 전(due 아님) row는 건너뜀", async () => {
    // retry_count=1 → 1m 대기 필요. last_attempt_at = 방금 → due 아님
    PENDING = [row({ retry_count: 1, last_attempt_at: new Date().toISOString() })];
    TOKENS = ["tok"];
    const s = await deliverPushBatch();
    expect(s.attempted).toBe(0);
    expect(sendPushMock).not.toHaveBeenCalled();
  });
});
