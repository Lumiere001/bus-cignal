import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
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

/**
 * operator 대상을 그 지구의 모든 간사로 확장 — 같은 지구 간사 전원에게 알림 (사용자 요청 2026-06-10).
 * 순수 함수: caller(emit)가 DB로 '대상 간사들이 속한 지구의 승인 간사 id 전체'를 조회해 넘긴다.
 *  - 학생(passengerId)·마스터 대상은 그대로 유지, operator 대상만 합집합으로 확장.
 *  - push 플래그는 기존 operator 대상과 동일(같은 emit 내 operator 대상은 모두 같은 allowPush).
 *  - operator 대상이 없으면 원본 그대로.
 */
export function expandOperatorTargets(
  baseTargets: ResolvedTarget[],
  regionOperatorIds: string[],
): ResolvedTarget[] {
  const operatorTargets = baseTargets.filter((t) => t.operatorId);
  if (operatorTargets.length === 0) return baseTargets;

  const push = operatorTargets.some((t) => t.push);
  const ids = new Set<string>();
  for (const t of operatorTargets) ids.add(t.operatorId as string); // 원본 대상 보존
  for (const id of regionOperatorIds) ids.add(id);

  const nonOperator = baseTargets.filter((t) => !t.operatorId);
  const expanded: ResolvedTarget[] = [...ids].map((id) => ({
    operatorId: id,
    passengerId: null,
    push,
  }));
  return [...expanded, ...nonOperator];
}

/**
 * 지구 id → 그 지구의 **승인(approved) 간사 전원** id 목록.
 * emit()의 지구 fan-out 쿼리를 일반화한 것 — 간사 row가 특정되지 않는 지구 단위 이벤트
 * (wait_request_new 등)의 호출자가 이 결과를 operatorIds 슬롯으로 넘긴다.
 * DB 클라이언트는 주입받음(이 모듈은 클라이언트를 만들지 않음 — 테스트 용이성 유지).
 */
export async function approvedOperatorIdsForRegions(
  db: SupabaseClient<Database>,
  regionIds: string[],
): Promise<string[]> {
  const unique = [...new Set(regionIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const { data } = await db
    .from("operators")
    .select("id")
    .in("region_id", unique)
    .eq("approval_status", "approved");
  return (data ?? []).map((o) => o.id);
}
