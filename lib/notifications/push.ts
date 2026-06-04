import "server-only";
import { pushMessaging } from "@/lib/firebase/admin";
import type { NotificationEvent } from "./events";

/**
 * 푸시 발송 어댑터 — 알림 엔진(index.ts deliverPushBatch)이 사용.
 *  - formatPush: 이벤트+페이로드 → 알림 카드 문구 (순수, 테스트 대상)
 *  - sendPush: FCM multicast 발송 + 무효 토큰 식별 (Firebase Admin)
 *
 * 카피 톤(SPEC §5.2): 시스템 = 객관·짧게.
 */

export type PushCopy = { title: string; body: string };

/** 이벤트별 푸시 문구. payload는 notifications.payload(jsonb) 그대로. */
export function formatPush(type: string, payload: unknown): PushCopy {
  const p = (payload ?? {}) as Record<string, unknown>;
  const reason = typeof p.reason === "string" ? p.reason : "";
  const code = typeof p.reservationCode === "string" ? p.reservationCode : "";

  switch (type as NotificationEvent) {
    case "request_new":
      return { title: "새 차량 신청", body: "타지구에서 자리 신청이 들어왔어요. 매칭 큐를 확인해 주세요." };
    case "match_confirmed":
      return { title: "매칭 확정", body: "신청이 매칭됐어요. 송금 후 [송금 완료]를 눌러주세요." };
    case "match_rejected":
      return { title: "매칭 거절", body: reason ? `사유: ${reason}` : "신청이 거절됐어요." };
    case "partial_match":
      return { title: "부분 매칭", body: "일부 인원만 매칭됐어요. 나머지는 큐에 남아 있어요." };
    case "seat_freed":
      return { title: "자리 생김", body: "자리가 다시 났어요. 큐에서 확인해 주세요." };
    case "payment_delay_pre":
      return { title: "송금 안내", body: "아직 송금이 확인되지 않았어요." };
    case "payment_delay":
      return { title: "송금 지연", body: "송금이 지연되고 있어요. 필요 시 [자리 풀기]를 검토해 주세요." };
    case "payment_reported":
      return { title: "송금 완료 보고", body: "신청 지구가 송금을 완료했어요. 입금을 확인해 주세요." };
    case "paid_code_issued":
      return { title: "입금 확인 완료", body: code ? `예약번호 ${code} 발급됐어요.` : "예약번호가 발급됐어요." };
    case "match_cancelled_p2":
      return { title: "매칭 취소", body: reason ? `사유: ${reason}` : "매칭이 취소됐어요." };
    case "passenger_cancelled":
      return { title: "학생 취소", body: "학생이 매칭을 취소했어요. 자리가 풀렸어요." };
    case "reapply_recommended":
      return { title: "재신청 추천", body: "자리가 났어요. 다시 신청해 보세요." };
    case "depart_d1":
      return { title: "출발 하루 전", body: "내일 출발이에요. 시간·장소를 확인해 주세요." };
    case "depart_d1h":
      return { title: "출발 1시간 전", body: "곧 출발이에요. 탑승 장소로 이동해 주세요." };
    case "trip_changed":
      return { title: "운행 정보 변경", body: "시간·장소·요금이 변경됐어요. 확인해 주세요." };
    case "chat_message":
      return { title: "새 메시지", body: typeof p.preview === "string" && p.preview ? p.preview : "채팅에 새 메시지가 있어요." };
    case "operator_revoked":
      return { title: "권한 변경", body: "간사 권한이 해제됐어요." };
    // master 전용(rejection_occurred·system_error)은 푸시 row가 생성되지 않으므로 여기 도달 X.
    default:
      return { title: "Bus Cignal", body: "새 알림이 있어요." };
  }
}

export type SendResult = {
  successCount: number;
  failureCount: number;
  /** 등록 해제·무효 토큰 — push_subscriptions에서 정리(삭제) 대상. */
  invalidTokens: string[];
};

/** FCM이 "이 토큰은 죽었다"고 알려주는 에러 코드 — 구독에서 제거. */
const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/**
 * 토큰 목록으로 웹푸시 발송. 부분 실패 허용(토큰별 결과).
 * @returns 성공/실패 수 + 정리할 무효 토큰
 */
export async function sendPush(
  tokens: string[],
  copy: PushCopy,
  data: Record<string, string> = {},
): Promise<SendResult> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const res = await pushMessaging().sendEachForMulticast({
    tokens,
    notification: { title: copy.title, body: copy.body },
    data,
    webpush: { fcmOptions: { link: "/" } }, // Phase C에서 이벤트별 딥링크 세분화
  });

  const invalidTokens: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = (r.error as { code?: string } | undefined)?.code;
      if (code && INVALID_TOKEN_CODES.has(code)) invalidTokens.push(tokens[i]);
    }
  });

  return {
    successCount: res.successCount,
    failureCount: res.failureCount,
    invalidTokens,
  };
}
