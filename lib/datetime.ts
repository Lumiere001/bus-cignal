/**
 * KST(Asia/Seoul) 기준 날짜·시각 표시 헬퍼.
 *
 * DB는 timestamptz(UTC)로 저장하므로 화면 표시는 전부 KST로 변환한다.
 * operator·admin 여러 페이지에 같은 포맷 함수가 중복돼 있어 여기로 단일화.
 */

/**
 * KST(UTC+9) 시각 구성요소 — 결정적(deterministic) 파싱.
 *
 * ⚠️ `toLocaleString`/`getHours()`는 실행 환경(Node ICU vs 브라우저 ICU/로컬 TZ)에 따라
 *    문자열이 미세하게 달라져 **client 컴포넌트에서 hydration 불일치 경고**를 유발했다.
 *    UTC instant에 +9h를 더한 뒤 ISO 필드를 잘라 쓰면 서버·브라우저가 항상 동일 결과를 낸다.
 */
function kstParts(iso: string): {
  year: number;
  month: number;
  day: number;
  hour24: number;
  minute: string;
} {
  const k = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString();
  return {
    year: Number(k.slice(0, 4)),
    month: Number(k.slice(5, 7)),
    day: Number(k.slice(8, 10)),
    hour24: Number(k.slice(11, 13)),
    minute: k.slice(14, 16),
  };
}

/**
 * 사람이 읽는 긴 형식 — 예) "6월 5일 오후 02:30", year 옵션 시 "2026년 6월 5일 오후 02:30".
 * operator 화면(운행·신청·매칭)에서 사용.
 *
 * 출력은 기존 `toLocaleString("ko-KR", …)` 결과와 동일(12시간 + 오전/오후 + 2자리 시·분,
 * KST 자정=오전 12:00·정오=오후 12:00). 차이는 **결정적 계산**이라는 점뿐 — hydration 안전.
 */
export function formatKstDateTime(
  iso: string,
  opts?: { year?: boolean },
): string {
  const { year, month, day, hour24, minute } = kstParts(iso);
  const ampm = hour24 < 12 ? "오전" : "오후";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const hh = String(hour12).padStart(2, "0");
  const prefix = opts?.year ? `${year}년 ` : "";
  return `${prefix}${month}월 ${day}일 ${ampm} ${hh}:${minute}`;
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
 *    Vercel(UTC)에선 9시간 어긋난 시각을 표시하는 버그가 있었음 → KST 결정적 계산으로 교정.
 *    (toLocaleString 제거 — server·client 동일 결과로 hydration 경고도 제거.)
 */
export function formatKstDateShort(iso: string): string {
  const { month, day, hour24, minute } = kstParts(iso);
  const hh = String(hour24).padStart(2, "0");
  return `${month}월 ${day}일 ${hh}:${minute}`;
}

/**
 * 날짜만 있는 값(date 컬럼, "YYYY-MM-DD") — 예) "2026-08-03" → "8월 3일".
 * 대기큐 희망 출발일 등 시각 없는 날짜용 — TZ 변환 없이 문자열을 그대로 자른다.
 */
export function formatDateOnly(date: string): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
}

/** 금액 표시 — 예) 35000 → "35,000원". (여러 화면 중복 단일화) */
export function formatWon(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

/**
 * 오늘(KST) 0시의 UTC ISO — "오늘 발생" 집계 필터의 하한 경계.
 * 예) KST 6/6 새벽이면 6/5 15:00Z 반환. admin 대시보드·운영 모니터링 공용.
 */
export function startOfTodayKstUtc(now: number = Date.now()): string {
  const kstDate = new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
  return new Date(`${kstDate}T00:00:00+09:00`).toISOString();
}
