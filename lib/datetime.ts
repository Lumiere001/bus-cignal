/**
 * KST(Asia/Seoul) 기준 날짜·시각 표시 헬퍼.
 *
 * DB는 timestamptz(UTC)로 저장하므로 화면 표시는 전부 KST로 변환한다.
 * operator·admin 여러 페이지에 같은 포맷 함수가 중복돼 있어 여기로 단일화.
 */

/**
 * 사람이 읽는 긴 형식 — 예) "6월 5일 오후 2:30", year 옵션 시 "2026년 6월 5일 오후 2:30".
 * operator 화면(운행·신청·매칭)에서 사용.
 */
export function formatKstDateTime(
  iso: string,
  opts?: { year?: boolean },
): string {
  return new Date(iso).toLocaleString("ko-KR", {
    ...(opts?.year ? { year: "numeric" } : {}),
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

/**
 * 모니터링용 짧은 형식 — 예) "06/05 14:30" (MM/DD HH:MM, KST).
 * admin 목록 테이블에서 사용. UTC에 +9h를 더한 뒤 ISO 필드를 잘라 쓴다.
 */
export function formatKstShort(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString();
  return `${k.slice(5, 7)}/${k.slice(8, 10)} ${k.slice(11, 16)}`;
}

/**
 * 학생 화면용 — 예) "7월 5일 14:30" (M월 D일 HH:MM, 24시간, KST 명시).
 * ⚠️ 기존 passenger 화면(MatchCard·me/trip)은 `new Date().getHours()`(서버 로컬 TZ)를 써서
 *    Vercel(UTC)에선 9시간 어긋난 시각을 표시하는 버그가 있었음 → 여기로 단일화하며 KST로 교정.
 */
export function formatKstDateShort(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

/** 금액 표시 — 예) 35000 → "35,000원". (여러 화면 중복 단일화) */
export function formatWon(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}
