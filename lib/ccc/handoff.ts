// CCC Summer 신원 핸드오프 클라이언트 — 간사 로그인. (docs handoff-api 규격)
//
// 흐름: /login/ccc → consent(브라우저) → /api/ccc/callback?code → exchange(서버↔서버) → payload.
// 시크릿 없음 — 보안은 등록된 redirect_uri + 1회용 5분 code + state(CSRF)로 성립.
// Base URL은 env로 분리(현재 ccc-summer.vercel.app → 추후 sc2026.kccc.org는 키만 교체).

const DEFAULT_BASE = "https://ccc-summer.vercel.app";

/** 등록된 client_id (CCC 게시판 등록값과 일치해야 함). 간사용. */
export const CCC_CLIENT_ID = process.env.CCC_HANDOFF_CLIENT_ID ?? "bus-cignal";

/** 학생용 client_id (target_role=student로 별도 등록). */
export const CCC_STUDENT_CLIENT_ID =
  process.env.CCC_HANDOFF_STUDENT_CLIENT_ID ?? "bus-cignal-student";

/** ccc-summer Base URL (끝 슬래시 제거). */
export function cccBase(): string {
  return (process.env.CCC_SUMMER_BASE ?? DEFAULT_BASE).replace(/\/+$/, "");
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

/**
 * code → payload 교환 (서버↔서버). redirect_uri는 발급 때와 동일해야 한다.
 * 브라우저에서 호출 금지(payload 누출). 네트워크/JSON 실패는 error로 평탄화.
 */
export async function exchangeCode(
  code: string,
  redirectUri: string,
  clientId: string = CCC_CLIENT_ID,
): Promise<ExchangeResult> {
  let res: Response;
  try {
    res = await fetch(`${cccBase()}/api/handoff/exchange`, {
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
