// CCC 자기치유(self-heal) 프로비저닝 — 순수 후보 선택 규칙.
//
// 배경: CCC Summer exchange의 subject_id(=ccc_id)가 같은 사람에게 세션마다
// 달라지는 사례가 prod에서 확인됨. ccc_id 미스 시 보조 키(staff_no, phone+name)로
// 기존 신원 후보를 찾고, 여기 규칙으로 "본인" 행을 채택한다.

/** created_at을 가진 후보 행. */
export type DatedRow = { created_at: string };

/**
 * 후보들 중 본인으로 채택할 행 — **created_at이 가장 이른 행**(최초 신원).
 *
 * 가장 이른 행을 고르는 이유:
 *  - 최초 행이 마스터 승인·revoke 이력의 원본 — 최신 행을 고르면 revoke된
 *    신원을 버리고 새 행으로 갈아타는 우회가 가능해진다.
 *  - FK(trips.created_by, seat_requests.operator_id 등)도 대부분 최초 행에 누적.
 * 동률(같은 created_at)이면 앞선 후보 유지(쿼리 순서 안정).
 */
export function pickEarliest<T extends DatedRow>(
  rows: readonly T[] | null | undefined,
): T | null {
  if (!rows || rows.length === 0) return null;
  let earliest = rows[0];
  for (const row of rows.slice(1)) {
    if (Date.parse(row.created_at) < Date.parse(earliest.created_at)) {
      earliest = row;
    }
  }
  return earliest;
}

/** 빈 문자열·undefined를 null로 — 보조 키 매칭은 non-empty 값만 사용. */
export function nonEmpty(value: string | null | undefined): string | null {
  return value != null && value.length > 0 ? value : null;
}
