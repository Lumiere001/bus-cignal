/**
 * 채팅 메시지 본문 검증 — 순수 함수(서버·클라이언트 공용, 브라우저 의존 없음).
 * Firestore Rules가 최종 방어선이지만, 클라이언트에서 1차로 거른다.
 */

export const MAX_MESSAGE_LENGTH = 500;
export const MIN_MESSAGE_LENGTH = 1;

export type MessageValidation =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "too_long" };

/** 줄바꿈(0x0A) 외 C0(0x00–0x1F)·C1(0x7F–0x9F) 제어문자인지. */
function isControlChar(code: number): boolean {
  if (code === 0x0a) return false; // 줄바꿈 허용
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

/**
 * 입력 본문을 정규화·검증한다.
 *  - 줄바꿈 외 제어문자 제거
 *  - 양끝 공백 trim
 *  - 빈 값 → empty, 500자 초과 → too_long
 */
export function validateMessageText(raw: string): MessageValidation {
  let cleaned = "";
  for (const ch of raw) {
    // 서로게이트 페어(이모지 등)는 codePointAt로 안전하게 통과
    const code = ch.codePointAt(0) ?? 0;
    if (!isControlChar(code)) cleaned += ch;
  }
  const text = cleaned.trim();

  if (text.length < MIN_MESSAGE_LENGTH) return { ok: false, reason: "empty" };
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, reason: "too_long" };

  return { ok: true, text };
}

/** 시스템 입장/퇴장 이벤트. */
export type SystemEvent = "join" | "leave";

/**
 * 카톡식 입장/퇴장 시스템 메시지 본문 — 예) "이지은님이 들어왔어요".
 *
 * ⚠️ firestore.rules (B) 분기가 `displayName + '님이 들어왔어요'|'님이 나갔어요'` 와의
 *    **정확 일치**를 강제한다(임의 시스템 문구 위조 차단). 이 함수의 출력이 그 형식과
 *    한 글자라도 달라지면 Rules가 거부하므로 양쪽을 함께 바꿔야 한다.
 */
export function systemMessageText(
  displayName: string,
  event: SystemEvent,
): string {
  return `${displayName}님이 ${event === "join" ? "들어왔어요" : "나갔어요"}`;
}
