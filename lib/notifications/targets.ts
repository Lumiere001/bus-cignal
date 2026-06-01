import {
  EVENT_SLOTS,
  type NotificationEvent,
  type RecipientsFor,
} from "./events";

/** 인앱 알림 1건의 대상. */
export type ResolvedTarget = {
  /** 간사 대상이면 operators.id, 아니면 null */
  operatorId: string | null;
  /** 학생 대상이면 match_passengers.id, 아니면 null */
  passengerId: string | null;
  /** 푸시 채널 row도 만들지 — 마스터는 기기 구독 없음 → 항상 false */
  push: boolean;
};

/**
 * 이벤트 + 수신자 → 인앱 알림 대상 목록. 순수 함수 (DB 접근 X).
 * - 빈/null 슬롯은 제외 (예: 공급 간사 미지정)
 * - 간사 id 중복 제거
 * - master = operator_id·passenger_id 둘 다 null, push=false
 * - allowPush: 푸시 채널 생성 여부 (chat_message ON/OFF는 caller가 이 값으로 제어)
 */
export function resolveTargets<E extends NotificationEvent>(
  event: E,
  recipients: RecipientsFor<E>,
  allowPush = true,
): ResolvedTarget[] {
  const slots = EVENT_SLOTS[event] as readonly (keyof RecipientsFor<E>)[];
  const r = recipients as Record<string, unknown>;

  const operatorIds: string[] = [];
  let passengerId: string | null = null;
  let master = false;

  for (const slot of slots) {
    switch (slot) {
      case "supplyOperatorId":
      case "requestOperatorId": {
        const v = r[slot] as string | null | undefined;
        if (v) operatorIds.push(v);
        break;
      }
      case "requestOperatorIds":
      case "operatorIds": {
        for (const v of (r[slot] as string[] | undefined) ?? []) {
          if (v) operatorIds.push(v);
        }
        break;
      }
      case "passengerId": {
        const v = r[slot] as string | null | undefined;
        if (v) passengerId = v;
        break;
      }
      case "master":
        master = true;
        break;
    }
  }

  const targets: ResolvedTarget[] = [];
  const seen = new Set<string>();
  for (const id of operatorIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    targets.push({ operatorId: id, passengerId: null, push: allowPush });
  }
  if (passengerId) {
    targets.push({ operatorId: null, passengerId, push: allowPush });
  }
  if (master) {
    targets.push({ operatorId: null, passengerId: null, push: false });
  }
  return targets;
}
