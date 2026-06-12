import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { mapOperatorBooked, normalizePhone } from "./operator-booked";

const trip = {
  direction: "down",
  departure_at: "2026-07-11T02:00:00+00:00",
  status: "published",
  bank_name: "카카오뱅크",
  account_number: "3333-1",
  account_holder: "김광주",
  refund_policy: "출발 3일 전 환불",
  origin: { label: "평창", address: "강원" },
  destination: { label: "광주 충장로", address: "광주" },
  region: { name: "광주지구" },
};

function row(overrides: {
  id?: string;
  requesterKind?: string;
  requestStatus?: string;
  tripStatus?: string;
  matches?: { status: string | null; reservation_code: string | null }[];
}) {
  return {
    id: overrides.id ?? "p1",
    request: {
      status: overrides.requestStatus ?? "queued",
      requester_kind: overrides.requesterKind ?? "operator",
      trip: { ...trip, status: overrides.tripStatus ?? "published" },
    },
    matches: overrides.matches ?? [],
  };
}

describe("normalizePhone", () => {
  it("숫자만 남긴다", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(normalizePhone(" 010 1234 5678 ")).toBe("01012345678");
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
  });
});

describe("mapOperatorBooked", () => {
  it("간사 등록 + 대기(매칭 없음) → queued", () => {
    const out = mapOperatorBooked([row({})] as never);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      passengerId: "p1",
      status: "queued",
      reservationCode: null,
      direction: "down",
      regionName: "광주지구",
      originLabel: "평창",
      destLabel: "광주 충장로",
    });
  });

  it("송금 대기 매칭 → awaiting_payment, 계좌 정보 포함", () => {
    const out = mapOperatorBooked([
      row({ requestStatus: "matched", matches: [{ status: "awaiting_payment", reservation_code: null }] }),
    ] as never);
    expect(out[0]?.status).toBe("awaiting_payment");
    expect(out[0]?.bankName).toBe("카카오뱅크");
    expect(out[0]?.reservationCode).toBeNull();
  });

  it("입금 확정(paid) → 예약번호 노출", () => {
    const out = mapOperatorBooked([
      row({ requestStatus: "matched", matches: [{ status: "paid", reservation_code: "BUS-7K9M" }] }),
    ] as never);
    expect(out[0]?.status).toBe("paid");
    expect(out[0]?.reservationCode).toBe("BUS-7K9M");
  });

  it("학생 본인 신청(requester_kind='student')은 제외", () => {
    const out = mapOperatorBooked([row({ requesterKind: "student" })] as never);
    expect(out).toHaveLength(0);
  });

  it("거절·취소된 신청은 제외", () => {
    expect(mapOperatorBooked([row({ requestStatus: "rejected" })] as never)).toHaveLength(0);
    expect(mapOperatorBooked([row({ requestStatus: "cancelled" })] as never)).toHaveLength(0);
  });

  it("취소된 차량은 제외", () => {
    expect(mapOperatorBooked([row({ tripStatus: "cancelled" })] as never)).toHaveLength(0);
  });

  it("간사 대기큐 등록(trip=null·queued) → 배정 대기(waiting) 카드", () => {
    const out = mapOperatorBooked([
      {
        id: "p1",
        request: {
          status: "queued",
          requester_kind: "operator",
          trip: null,
          wait_region: { name: "광주지구" },
          wait_direction: "down",
        },
        matches: [],
      },
    ] as never);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      passengerId: "p1",
      status: "queued",
      waiting: true,
      direction: "down",
      regionName: "광주지구",
      departureAt: "",
      originLabel: null,
      destLabel: null,
    });
  });

  it("trip=null이라도 queued가 아니면 제외 (rejected 대기 신청 등)", () => {
    const out = mapOperatorBooked([
      {
        id: "p1",
        request: {
          status: "rejected",
          requester_kind: "operator",
          trip: null,
          wait_region: { name: "광주지구" },
          wait_direction: "up",
        },
        matches: [],
      },
    ] as never);
    expect(out).toHaveLength(0);
  });

  it("trip-bound 등록은 waiting=false", () => {
    const out = mapOperatorBooked([row({})] as never);
    expect(out[0]?.waiting).toBe(false);
  });
});
