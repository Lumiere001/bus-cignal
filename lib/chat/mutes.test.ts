import { describe, expect, it, vi } from "vitest";

// server-only는 클라이언트 번들에서만 throw — 테스트(node)에서는 빈 모듈로 대체
vi.mock("server-only", () => ({}));

import { getMutedSubjects, getMuteState, setMuteState } from "./mutes";

type QueryResult = { data: unknown };

/**
 * Supabase PostgrestFilterBuilder 흉내 — chainable(`select/eq/...`) + awaitable(thenable).
 *  - `await ...eq().eq()` → `listResult` (getMutedSubjects)
 *  - `...maybeSingle()`   → `singleResult` (getMuteState/setMuteState 조회)
 *  - `insert`/`update`    → sink에 payload 기록
 */
function makeDb(opts: {
  listResult?: QueryResult;
  singleResult?: QueryResult;
}) {
  const sink = {
    inserted: [] as Record<string, unknown>[],
    updated: [] as Record<string, unknown>[],
  };
  const list = opts.listResult ?? { data: [] };
  const single = opts.singleResult ?? { data: null };

  const builder = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    // awaitable: getMutedSubjects 가 .eq().eq() 결과를 await
    b.then = (resolve: (v: QueryResult) => unknown) => resolve(list);
    b.maybeSingle = () => Promise.resolve(single);
    b.update = (payload: Record<string, unknown>) => {
      sink.updated.push(payload);
      return { eq: () => Promise.resolve({ data: null }) };
    };
    b.insert = (payload: Record<string, unknown>) => {
      sink.inserted.push(payload);
      return Promise.resolve({ data: null });
    };
    return b;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = { from: () => builder() } as any;
  return { db, sink };
}

describe("getMutedSubjects", () => {
  it("muted row를 operator/passenger 집합으로 분리", async () => {
    const { db } = makeDb({
      listResult: {
        data: [
          { operator_id: "op-1", passenger_id: null },
          { operator_id: null, passenger_id: "mp-9" },
          { operator_id: "op-2", passenger_id: null },
        ],
      },
    });
    const { operatorIds, passengerIds } = await getMutedSubjects(db, "trip-1");
    expect([...operatorIds].sort()).toEqual(["op-1", "op-2"]);
    expect([...passengerIds]).toEqual(["mp-9"]);
  });

  it("음소거 없음 → 빈 집합", async () => {
    const { db } = makeDb({ listResult: { data: [] } });
    const { operatorIds, passengerIds } = await getMutedSubjects(db, "trip-1");
    expect(operatorIds.size).toBe(0);
    expect(passengerIds.size).toBe(0);
  });

  it("data null(쿼리 오류)이어도 빈 집합 (best-effort)", async () => {
    const { db } = makeDb({ listResult: { data: null } });
    const { operatorIds, passengerIds } = await getMutedSubjects(db, "trip-1");
    expect(operatorIds.size).toBe(0);
    expect(passengerIds.size).toBe(0);
  });
});

describe("getMuteState", () => {
  it("row 있고 muted=true → true", async () => {
    const { db } = makeDb({ singleResult: { data: { muted: true } } });
    expect(
      await getMuteState(db, "trip-1", { role: "operator", subjectId: "op-1" }),
    ).toBe(true);
  });

  it("row 없음 → false (푸시 받음)", async () => {
    const { db } = makeDb({ singleResult: { data: null } });
    expect(
      await getMuteState(db, "trip-1", { role: "passenger", subjectId: "mp-9" }),
    ).toBe(false);
  });

  it("row 있고 muted=false → false", async () => {
    const { db } = makeDb({ singleResult: { data: { muted: false } } });
    expect(
      await getMuteState(db, "trip-1", { role: "operator", subjectId: "op-1" }),
    ).toBe(false);
  });
});

describe("setMuteState", () => {
  it("기존 row 없음 → operator insert (passenger_id null)", async () => {
    const { db, sink } = makeDb({ singleResult: { data: null } });
    await setMuteState(db, "trip-1", { role: "operator", subjectId: "op-1" }, true);
    expect(sink.inserted).toHaveLength(1);
    expect(sink.inserted[0]).toMatchObject({
      trip_id: "trip-1",
      operator_id: "op-1",
      passenger_id: null,
      muted: true,
    });
    expect(sink.updated).toHaveLength(0);
  });

  it("기존 row 없음 → passenger insert (operator_id null)", async () => {
    const { db, sink } = makeDb({ singleResult: { data: null } });
    await setMuteState(db, "trip-1", { role: "passenger", subjectId: "mp-9" }, true);
    expect(sink.inserted[0]).toMatchObject({
      trip_id: "trip-1",
      operator_id: null,
      passenger_id: "mp-9",
      muted: true,
    });
  });

  it("기존 row 있음 → update(muted) (insert 안 함)", async () => {
    const { db, sink } = makeDb({ singleResult: { data: { id: "row-1" } } });
    await setMuteState(db, "trip-1", { role: "operator", subjectId: "op-1" }, false);
    expect(sink.updated).toHaveLength(1);
    expect(sink.updated[0]).toMatchObject({ muted: false });
    expect(sink.inserted).toHaveLength(0);
  });
});
