// 정산(ledger) 도메인 타입 — core (SPEC §S7).
// 시스템은 "받을 돈·보낼 돈" 집계 표만 제공, 사후 처리는 캠퍼스 자율(N5).

export type SettlementMatchStatus =
  | "awaiting_payment"
  | "payment_reported"
  | "paid"
  | "expired"
  | "cancelled";

/** 정산 계산 입력 — 매칭 1건 = 학생 1명 = 좌석 1개 = price_per_seat */
export interface SettlementMatch {
  matchId: string;
  status: SettlementMatchStatus;
  pricePerSeat: number;
  /** 공급 지구(버스 낸 쪽 = 받을 쪽) */
  supplyRegionId: string;
  supplyRegionName: string;
  /** 신청 지구(학생 태운 쪽 = 보낼 쪽) */
  requestRegionId: string;
  requestRegionName: string;
}

/** 상대 지구 1곳에 대한 집계 (확정=paid, 진행중=awaiting_payment·payment_reported) */
export interface LedgerEntry {
  counterpartRegionId: string;
  counterpartRegionName: string;
  confirmedCount: number;
  confirmedAmount: number;
  pendingCount: number;
  pendingAmount: number;
}

export interface SettlementTotals {
  receivableConfirmed: number;
  receivablePending: number;
  payableConfirmed: number;
  payablePending: number;
}

export interface SettlementLedger {
  /** 받을 돈 — 본인 지구가 공급한 매칭, 신청 지구별 */
  receivable: LedgerEntry[];
  /** 보낼 돈 — 본인 지구가 신청한 매칭, 공급 지구별 */
  payable: LedgerEntry[];
  totals: SettlementTotals;
}
