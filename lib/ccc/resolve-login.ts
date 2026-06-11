// QR·IdP-initiated 진입에서는 코드가 간사용/학생용 어느 client로 발급됐는지
// 콜백이 알 수 없다(간사 보고 2026-06-11: 학생 QR로 들어오면 로그인 실패).
// → 진입 콜백의 client로 먼저 교환하고, 실패하면 반대 client로 재시도해
//   "어느 client의 코드였는지"(intent)를 알아낸다. 라우팅은 intent 기준:
//   staff 코드 → 간사 흐름(간사 아니면 학생 fallback) / student 코드 → 학생 흐름.
//
// exchange의 redirect_uri는 발급 때 값(=그 client의 등록 콜백 경로)과 같아야 하므로
// 재시도는 반대 client의 등록 경로를 보낸다. 잘못된 client로의 시도는 CCC가
// 거부만 할 뿐 1회용 코드를 소모하지 않는다.

import {
  exchangeCode,
  CCC_CLIENT_ID,
  CCC_STUDENT_CLIENT_ID,
  type HandoffPayload,
} from "./handoff";

/** client별 등록 콜백 경로 — CCC 게시판 등록값과 일치해야 함. */
export const STAFF_CALLBACK_PATH = "/api/ccc/callback";
export const STUDENT_CALLBACK_PATH = "/api/ccc/student-callback";

/** 코드가 발급된 client의 의도 — staff=간사 로그인, student=학생 로그인. */
export type LoginIntent = "staff" | "student";

export type ResolvedLogin =
  | {
      ok: true;
      intent: LoginIntent;
      subjectId: string;
      payload: HandoffPayload;
    }
  | { ok: false; error: string };

function clientOf(intent: LoginIntent): { clientId: string; path: string } {
  return intent === "staff"
    ? { clientId: CCC_CLIENT_ID, path: STAFF_CALLBACK_PATH }
    : { clientId: CCC_STUDENT_CLIENT_ID, path: STUDENT_CALLBACK_PATH };
}

/**
 * 진입 client → 반대 client 순으로 exchange를 시도해 신원·intent를 정한다.
 * 전부 실패하면 진입 client의 에러를 돌려준다(기존 안내 문구 기준점 유지).
 */
export async function resolveLoginExchange(
  code: string,
  origin: string,
  entry: LoginIntent,
): Promise<ResolvedLogin> {
  const order: LoginIntent[] =
    entry === "staff" ? ["staff", "student"] : ["student", "staff"];

  let entryError: string | null = null;
  for (const intent of order) {
    const { clientId, path } = clientOf(intent);
    const r = await exchangeCode(code, `${origin}${path}`, clientId);
    if (r.ok) {
      return { ok: true, intent, subjectId: r.subjectId, payload: r.payload };
    }
    entryError ??= r.error;
  }
  return { ok: false, error: entryError ?? "network_error" };
}
