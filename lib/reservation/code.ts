// 예약번호(티켓) 생성 — SPEC §6 티켓 번호 규칙.
// 혼동 글자(0·1·I·O·L·Z) 제외 30자 셋, BUS-XXXX 4자 = 810,000 조합.
// paid 시점 발급, DB unique constraint, 충돌 시 재생성(호출자 책임).

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXY"; // 30자
const CODE_LENGTH = 4;
export const RESERVATION_PREFIX = "BUS-";

/**
 * `BUS-XXXX` 예약번호 1개 생성.
 * @param rng [0,1) 난수 함수 (테스트 주입용, 기본 Math.random).
 * 충돌(unique 위반) 재생성은 호출자(DB)에서 처리.
 */
export function generateReservationCode(rng: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  }
  return RESERVATION_PREFIX + code;
}

/** 예약번호 형식 검증 (BUS- + 허용 글자 4자). */
export function isValidReservationCode(code: string): boolean {
  const pattern = new RegExp(`^${RESERVATION_PREFIX}[${ALPHABET}]{${CODE_LENGTH}}$`);
  return pattern.test(code);
}
