import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const matchSingle = vi.fn();
const mpSingle = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "matches") {
        return { select: () => ({ eq: () => ({ maybeSingle: matchSingle }) }) };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: mpSingle }) }),
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
  });

  it("유효한 예약번호·이름·전화 끝 4자리 → passengerId 반환", async () => {
    const claims = await verifyReservationEntry("BUS-7K9M", "이지은", "4444");

    expect(claims).not.toBeNull();
    expect(claims!.passengerId).toBe("mp-1");
  });

  it("이름 불일치 → null, 세션 미발급", async () => {
    const result = await verifyReservationEntry("BUS-7K9M", "홍길동", "4444");
    expect(result).toBeNull();
  });

  it("전화 끝 4자리 불일치 → null, 세션 미발급", async () => {
    const result = await verifyReservationEntry("BUS-7K9M", "이지은", "1234");
    expect(result).toBeNull();
  });

  it("존재하지 않는 예약번호 → null", async () => {
    matchSingle.mockResolvedValue({ data: null });
    const result = await verifyReservationEntry("BUS-XXXX", "이지은", "4444");
    expect(result).toBeNull();
  });
});
