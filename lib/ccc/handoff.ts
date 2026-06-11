// CCC Summer 신원 핸드오프 클라이언트 — 간사 로그인. (docs handoff-api 규격)
//
// 흐름: /login/ccc → consent(브라우저) → /api/ccc/callback?code → exchange(서버↔서버) → payload.
// 시크릿 없음 — 보안은 등록된 redirect_uri + 1회용 5분 code + state(CSRF)로 성립.
//
// Base URL은 복수 허용(CCC 간사 요청 2026-06-11): 테스트(ccc-summer.vercel.app)와
// 실수련회(sc2026.kccc.org) 양쪽에서 발급된 코드를 모두 받는다.
//  - consent(로그인 버튼)는 primary(목록 첫 항목) 한 곳으로 보낸다.
//  - exchange는 코드 발급처를 알 수 없으므로 허용 목록을 순서대로 시도한다.
//    (다른 베이스 코드는 그 베이스가 모르는 값이라 거부될 뿐 소모되지 않음.)

const DEFAULT_BASES = [
  "https://ccc-summer.vercel.app", // 테스트용
  "https://sc2026.kccc.org", // 실제 수련회
];

/** 등록된 client_id (CCC 게시판 등록값과 일치해야 함). 간사용. */
export const CCC_CLIENT_ID = process.env.CCC_HANDOFF_CLIENT_ID ?? "bus-cignal";

/** 학생용 client_id (target_role=student로 별도 등록). */
export const CCC_STUDENT_CLIENT_ID =
  process.env.CCC_HANDOFF_STUDENT_CLIENT_ID ?? "bus-cignal-student";

function normalizeBase(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/**
 * 허용 베이스 목록 — env `CCC_SUMMER_BASE`(쉼표 구분, 첫 항목=primary) ∪ 기본 2개.
 * env가 한 곳만 가리켜도 기본 2개는 항상 허용되어 테스트·실수련회 코드가 같이 동작한다.
 */
export function cccBases(): string[] {
  const fromEnv = (process.env.CCC_SUMMER_BASE ?? "")
    .split(",")
    .map(normalizeBase)
    .filter(Boolean);
  return [...new Set([...fromEnv, ...DEFAULT_BASES])];
}

/** primary Base URL — consent(로그인 버튼) 목적지. 허용 목록의 첫 항목. */
export function cccBase(): string {
  return cccBases()[0];
}

/** 동의 화면 URL — 사용자를 여기로 리다이렉트. state는 CSRF 방지용. */
export function buildConsentUrl(
  base: string,
  clientId: string,
  state: string,
): string {
  const u = new URL("/handoff/consent", base);
  u.searchParams.set("client_id", clientId);
  if (state) u.searchParams.set("state", state);
  return u.toString();
}

/** exchange 응답 payload — 등록 field_whitelist에 따라 일부만 채워짐. */
export type HandoffPayload = {
  name?: string;
  is_staff?: boolean;
  staff_no?: string;
  phone?: string;
  univ_no?: number;
  univ_name?: string;
  branch_no?: number;
  branch_name?: string;
};

export type ExchangeResult =
  | { ok: true; subjectId: string; payload: HandoffPayload }
  | { ok: false; error: string };

/** exchange JSON 응답을 안전하게 파싱. */
export function parseExchangeResponse(json: unknown): ExchangeResult {
  if (!json || typeof json !== "object") {
    return { ok: false, error: "invalid_response" };
  }
  const o = json as Record<string, unknown>;
  if (typeof o.error === "string") return { ok: false, error: o.error };
  if (typeof o.subject_id !== "string" || o.subject_id.length === 0) {
    return { ok: false, error: "invalid_response" };
  }
  if (typeof o.payload !== "object" || o.payload === null) {
    return { ok: false, error: "invalid_response" };
  }
  return {
    ok: true,
    subjectId: o.subject_id,
    payload: o.payload as HandoffPayload,
  };
}

/** branch_no → regions.code 문자열(4자리 CCC 지구번호). 없으면 null. */
export function branchCode(payload: HandoffPayload): string | null {
  if (payload.branch_no == null) return null;
  return String(payload.branch_no);
}

/** 차량 간사 자격(간사 여부). target_role=staff 거름의 서버측 재확인. */
export function isEligibleStaff(payload: HandoffPayload): boolean {
  return payload.is_staff === true;
}

/** 한 베이스에 대한 단일 exchange 시도. 네트워크/JSON 실패는 error로 평탄화. */
async function exchangeCodeAt(
  base: string,
  code: string,
  redirectUri: string,
  clientId: string,
): Promise<ExchangeResult> {
  let res: Response;
  try {
    res = await fetch(`${base}/api/handoff/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "network_error" };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  return parseExchangeResponse(json);
}

/**
 * code → payload 교환 (서버↔서버). redirect_uri는 발급 때와 동일해야 한다.
 * 브라우저에서 호출 금지(payload 누출).
 * 코드가 어느 베이스에서 발급됐는지 모르므로 허용 베이스를 순서대로 시도하고,
 * 전부 실패하면 primary의 에러를 돌려준다(사용자 안내 기준점).
 */
export async function exchangeCode(
  code: string,
  redirectUri: string,
  clientId: string = CCC_CLIENT_ID,
): Promise<ExchangeResult> {
  let primaryError: ExchangeResult | null = null;
  for (const base of cccBases()) {
    const result = await exchangeCodeAt(base, code, redirectUri, clientId);
    if (result.ok) return result;
    primaryError ??= result;
  }
  return primaryError ?? { ok: false, error: "network_error" };
}
