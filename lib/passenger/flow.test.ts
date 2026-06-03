/**
 * passenger flow 연결 테스트
 * verifyReservationEntry → sessionToken → getMatchesForPassenger 전체 흐름을
 * mock Supabase client로 검증. Docker / 로컬 DB 의존 없음.
 *
 * 핵심 보안 속성:
 *   1. verifyReservationEntry가 저장한 hash(= SHA-256(sessionToken))를
 *      getMatchesForPassenger가 재검증하므로 세션 토큰 없이는 매칭 열람 불가.
 *   2. 재로그인 시 DB hash가 교체되어 구 sessionToken은 즉시 무효화됨.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * vi.hoisted: vi.mock factory 클로저에서도 접근 가능한 공유 상태.
 * verifyReservationEntry가 update()로 저장한 hash를
 * getMatchesForPassenger의 select() mock이 읽어 "DB 저장" 흐름을 재현.
 */
const mockState = vi.hoisted(() => ({
  capturedHash: null as string | null,
}));

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
            if (cols === "name, phone, access_token_hash") {
              // queries.ts: hash 검증용 단건 조회 — mockState에서 최신 hash 반환
              return {
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      name: "이지은",
                      phone: "010-3333-4444",
                      access_token_hash: mockState.capturedHash,
                    },
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
            // verify.ts: id, name, phone 단건 조회
            return {
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "mp-1", name: "이지은", phone: "010-3333-4444" },
                }),
              }),
            };
          },
          // verify.ts: access_token_hash 저장 — hash 캡처 핵심
          update: (data: Record<string, string>) => {
            mockState.capturedHash = data.access_token_hash;
            return { eq: async () => ({ error: null }) };
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

describe("passenger flow: 인증 → sessionToken → 매칭 조회 연결", () => {
  beforeEach(() => {
    mockState.capturedHash = null;
  });

  it("성공 인증 후 받은 sessionToken으로 getMatchesForPassenger가 매칭을 반환", async () => {
    // 인증: hash 생성 + DB 저장
    const claims = await verifyReservationEntry("BUS-7K9M", "이지은", "4444");
    expect(claims).not.toBeNull();
    expect(typeof claims!.sessionToken).toBe("string");

    // 연결: 인증에서 받은 sessionToken을 그대로 전달
    const matches = await getMatchesForPassenger(
      claims!.matchPassengerId,
      claims!.sessionToken,
    );

    // 매칭 반환: SHA-256(sessionToken) === capturedHash → 검증 통과
    expect(matches).toHaveLength(1);
    expect(matches[0].reservationCode).toBe("BUS-7K9M");
    expect(matches[0].status).toBe("paid");
    expect(matches[0].pricePerSeat).toBe(35000);
    expect(matches[0].originLabel).toBe("서울역");
    expect(matches[0].destinationLabel).toBe("광주역");
  });

  it("인증 실패(이름 불일치) 후에는 getMatchesForPassenger에 전달할 sessionToken이 없음", async () => {
    const claims = await verifyReservationEntry("BUS-7K9M", "홍길동", "4444");

    // 인증 실패 → null 반환, hash 미저장
    expect(claims).toBeNull();
    expect(mockState.capturedHash).toBeNull();
  });

  it("재로그인 시 새 sessionToken만 유효 — 구 token으로는 매칭 미노출", async () => {
    // 첫 번째 로그인
    const firstClaims = await verifyReservationEntry("BUS-7K9M", "이지은", "4444");
    expect(firstClaims).not.toBeNull();
    const firstToken = firstClaims!.sessionToken;
    const firstHash = mockState.capturedHash;

    // 두 번째 로그인 → capturedHash 교체
    const secondClaims = await verifyReservationEntry("BUS-7K9M", "이지은", "4444");
    expect(secondClaims).not.toBeNull();

    // 두 번의 로그인은 서로 다른 sessionToken을 생성
    expect(secondClaims!.sessionToken).not.toBe(firstToken);
    // DB hash도 교체됨
    expect(mockState.capturedHash).not.toBe(firstHash);

    // 구 token → [] (DB hash가 두 번째 것으로 교체됨)
    const withOldToken = await getMatchesForPassenger(
      firstClaims!.matchPassengerId,
      firstToken,
    );
    expect(withOldToken).toEqual([]);

    // 새 token → 매칭 반환
    const withNewToken = await getMatchesForPassenger(
      secondClaims!.matchPassengerId,
      secondClaims!.sessionToken,
    );
    expect(withNewToken).toHaveLength(1);
  });
});
