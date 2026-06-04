import type { LedgerEntry, SettlementLedger, SettlementMatch } from "./types";

export type {
  SettlementMatch,
  SettlementMatchStatus,
  LedgerEntry,
  SettlementTotals,
  SettlementLedger,
} from "./types";

// 정산 집계 대상 상태: paid=확정 입금, awaiting_payment·payment_reported=진행중.
// expired(자리 풀림)·cancelled = 금전 의무 없음 → 집계 제외.
const PENDING_STATUSES = new Set(["awaiting_payment", "payment_reported"]);

function emptyEntry(id: string, name: string): LedgerEntry {
  return {
    counterpartRegionId: id,
    counterpartRegionName: name,
    confirmedCount: 0,
    confirmedAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
  };
}

function accumulate(
  map: Map<string, LedgerEntry>,
  counterpartId: string,
  counterpartName: string,
  amount: number,
  confirmed: boolean,
): void {
  let entry = map.get(counterpartId);
  if (!entry) {
    entry = emptyEntry(counterpartId, counterpartName);
    map.set(counterpartId, entry);
  }
  if (confirmed) {
    entry.confirmedCount += 1;
    entry.confirmedAmount += amount;
  } else {
    entry.pendingCount += 1;
    entry.pendingAmount += amount;
  }
}

function sortByName(a: LedgerEntry, b: LedgerEntry): number {
  return a.counterpartRegionName.localeCompare(b.counterpartRegionName, "ko");
}

function sum(entries: LedgerEntry[], key: "confirmedAmount" | "pendingAmount"): number {
  return entries.reduce((total, e) => total + e[key], 0);
}

/**
 * 본인 지구(regionId) 기준 정산 ledger 계산 (SPEC §S7).
 * - 받을 돈: 본인이 공급(supply)한 매칭 → 신청 지구별 집계
 * - 보낼 돈: 본인이 신청(request)한 매칭 → 공급 지구별 집계
 * 본인 지구와 무관한 매칭은 무시(방어적). 순수 함수 — DB·시각 의존 없음.
 */
export function buildSettlement(
  regionId: string,
  matches: SettlementMatch[],
): SettlementLedger {
  const receivableMap = new Map<string, LedgerEntry>();
  const payableMap = new Map<string, LedgerEntry>();

  for (const m of matches) {
    const confirmed = m.status === "paid";
    if (!confirmed && !PENDING_STATUSES.has(m.status)) continue; // expired/cancelled 제외

    if (m.supplyRegionId === regionId) {
      accumulate(
        receivableMap,
        m.requestRegionId,
        m.requestRegionName,
        m.pricePerSeat,
        confirmed,
      );
    } else if (m.requestRegionId === regionId) {
      accumulate(
        payableMap,
        m.supplyRegionId,
        m.supplyRegionName,
        m.pricePerSeat,
        confirmed,
      );
    }
  }

  const receivable = [...receivableMap.values()].sort(sortByName);
  const payable = [...payableMap.values()].sort(sortByName);

  return {
    receivable,
    payable,
    totals: {
      receivableConfirmed: sum(receivable, "confirmedAmount"),
      receivablePending: sum(receivable, "pendingAmount"),
      payableConfirmed: sum(payable, "confirmedAmount"),
      payablePending: sum(payable, "pendingAmount"),
    },
  };
}
