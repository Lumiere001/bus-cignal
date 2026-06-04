/**
 * passenger flow 연결 테스트
 * verifyReservationEntry → passengerId → getMatchesForPassenger 전체 흐름을
 * mock Supabase client로 검증. Docker / 로컬 DB 의존 없음.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      // ── matches 테이블 ──────────────────────────────────────────────────
      if (table === "matches") {
        return {
          select: (cols: string) => {
            if (cols === "id") {
              // verify.ts: reservation_code 단건 조회
              return {
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: "m-1" } }),
                }),
              };
            }
            // queries.ts: match 목록 조회 (.in)
            return {
              in: async () => ({
                data: [
                  {
                    id: "m-1",
                    reservation_code: "BUS-7K9M",
                    status: "paid",
                    trip_id: "t-1",
                  },
                ],
              }),
            };
          },
        };
      }

      // ── match_passengers 테이블 ────────────────────────────────────────
      if (table === "match_passengers") {
        return {
          select: (cols: string) => {
            if (cols === "name, phone") {
              // queries.ts: passengerId → name+phone 단건 조회
              return {
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { name: "이지은", phone: "010-3333-4444" },
                  }),
                }),
              };
            }
            if (cols === "match_id") {
              // queries.ts: name+phone 기반 다중 조회
              return {
                eq: () => ({
                  eq: async () => ({ data: [{ match_id: "m-1" }] }),
                }),
              };
            }
            // verify.ts: "id, name, phone" 단건 조회
            return {
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "mp-1", name: "이지은", phone: "010-3333-4444" },
                }),
              }),
            };
          },
        };
      }

      // ── trips 테이블 ───────────────────────────────────────────────────
      if (table === "trips") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  id: "t-1",
                  departure_at: "2026-08-01T07:00:00Z",
                  price_per_seat: 35000,
                  direction: "to",
                  origin_location_id: "loc-1",
                  destination_location_id: "loc-2",
                },
              ],
            }),
          }),
        };
      }

      // ── region_locations 테이블 ────────────────────────────────────────
      if (table === "region_locations") {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: "loc-1", address: "서울역", label: "서울역" },
                { id: "loc-2", address: "광주역", label: "광주역" },
              ],
            }),
          }),
        };
      }

      return { select: () => ({ in: async () => ({ data: [] }) }) };
    },
  }),
}));

import { verifyReservationEntry } from "./verify";
import { getMatchesForPassenger } from "./queries";

describe("passenger flow: 인증 → passengerId → 매칭 조회 연결", () => {
  it("성공 인증 후 passengerId로 getMatchesForPassenger가 매칭을 반환", async () => {
    // 인증: passengerId 반환
    const claims = await verifyReservationEntry("BUS-7K9M", "이지은", "4444");
    expect(claims).not.toBeNull();
    expect(typeof claims!.passengerId).toBe("string");

    // 연결: 인증에서 받은 passengerId를 그대로 전달
    const matches = await getMatchesForPassenger(claims!.passengerId);

    expect(matches).toHaveLength(1);
    expect(matches[0].reservationCode).toBe("BUS-7K9M");
    expect(matches[0].status).toBe("paid");
    expect(matches[0].pricePerSeat).toBe(35000);
    expect(matches[0].originLabel).toBe("서울역");
    expect(matches[0].destinationLabel).toBe("광주역");
  });

  it("인증 실패(이름 불일치) → null 반환", async () => {
    const claims = await verifyReservationEntry("BUS-7K9M", "홍길동", "4444");
    expect(claims).toBeNull();
  });
});
