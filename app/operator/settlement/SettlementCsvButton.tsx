"use client";

import { Button } from "@/components/ui/button";
import type { SettlementLedger, LedgerEntry } from "@/lib/settlement";

function rows(ledger: SettlementLedger): string[][] {
  const line = (kind: string, e: LedgerEntry) => [
    kind,
    e.counterpartRegionName,
    String(e.confirmedAmount),
    String(e.confirmedCount),
    String(e.pendingAmount),
    String(e.pendingCount),
  ];
  return [
    ...ledger.receivable.map((e) => line("받을돈", e)),
    ...ledger.payable.map((e) => line("보낼돈", e)),
  ];
}

// 간단 CSV 직렬화 (쉼표·따옴표·줄바꿈 escape)
function toCsv(header: string[], body: string[][]): string {
  const esc = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  return [header, ...body].map((r) => r.map(esc).join(",")).join("\r\n");
}

export function SettlementCsvButton({ ledger }: { ledger: SettlementLedger }) {
  const body = rows(ledger);

  function download() {
    const header = ["구분", "상대지구", "확정금액", "확정건수", "진행금액", "진행건수"];
    const csv = toCsv(header, body);
    // Excel 한글 깨짐 방지 위해 UTF-8 BOM 부착
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "settlement.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={download} disabled={body.length === 0}>
      CSV 내보내기
    </Button>
  );
}
