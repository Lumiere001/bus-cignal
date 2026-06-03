import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const matchSingle = vi.fn();
const mpSingle = vi.fn();
const mpUpdate = vi.fn();
const mpUpdateEq = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "matches") {
        return { select: () => ({ eq: () => ({ maybeSingle: matchSingle }) }) };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: mpSingle }) }),
        update: (data: unknown) => {
          mpUpdate(data);
          return { eq: mpUpdateEq };
        },
      };
    },
  }),
}));

import { verifyReservationEntry } from "./verify";

const VALID_MATCH = { id: "match-1" };
const VALID_MP = { id: "mp-1", name: "이지은", phone: "010-3333-4444" };

describe("verifyReservationEntry", () => {
  beforeEach(() => {
    matchSingle.mockResolvedValue({ data: VALID_MATCH });
    mpSingle.mockResolvedValue({ data: VALID_MP });
    mpUpdate.mockClear();
    mpUpdateEq.mockResolvedValue({ error: null });
  });

  it("유효한 예약번호·이름·전화 끝 4자리 → claims 반환 + access_token_hash 저장", async () => {
    const claims = await verifyReservationEntry("BUS-7K9M", "이지은", "4444");

    expect(claims).not.toBeNull();
    expect(claims!.matchPassengerId).toBe("mp-1");
    expect(typeof claims!.sessionToken).toBe("string");
    expect(claims!.sessionToken.length).toBeGreaterThan(0);

    // update()에 access_token_hash가 64자리 hex로 전달됐는지 확인
    expect(mpUpdate).toHaveBeenCalledOnce();
    const stored = (mpUpdate.mock.calls[0][0] as Record<string, string>)
      .access_token_hash;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);

    // sessionToken → SHA-256 = 저장된 hash (P1 access_token_hash 검증 흐름)
    const expected = createHash("sha256")
      .update(claims!.sessionToken)
      .digest("hex");
    expect(stored).toBe(expected);
  });

  it("이름 불일치 → null, 세션 미발급", async () => {
    const result = await verifyReservationEntry("BUS-7K9M", "홍길동", "4444");
    expect(result).toBeNull();
    expect(mpUpdate).not.toHaveBeenCalled();
  });

  it("전화 끝 4자리 불일치 → null, 세션 미발급", async () => {
    const result = await verifyReservationEntry("BUS-7K9M", "이지은", "1234");
    expect(result).toBeNull();
    expect(mpUpdate).not.toHaveBeenCalled();
  });

  it("존재하지 않는 예약번호 → null", async () => {
    matchSingle.mockResolvedValue({ data: null });
    const result = await verifyReservationEntry("BUS-XXXX", "이지은", "4444");
    expect(result).toBeNull();
  });

  it("DB update 실패 → fail-closed (null 반환, 세션 미발급)", async () => {
    mpUpdateEq.mockResolvedValue({ error: new Error("DB write error") });
    const result = await verifyReservationEntry("BUS-7K9M", "이지은", "4444");
    expect(result).toBeNull();
  });
});
