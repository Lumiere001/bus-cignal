"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reportPayment } from "./actions";

type Props = {
  matchId: string;
  status: string;
  reservationCode: string | null;
  studentName: string;
  route: string;
  departure: string;
};

export function MatchPaymentCell({
  matchId,
  status,
  reservationCode,
  studentName,
  route,
  departure,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function report() {
    setError(null);
    startTransition(async () => {
      const result = await reportPayment(matchId);
      if ("error" in result) setError(result.error);
    });
  }

  function copyShare() {
    // 학생별 카톡 공유 문구 (SPEC §S4 step4). 링크는 현재 출처 기준 절대경로.
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text =
      `[${route}] ${departure} 차량 예약이 확정됐어요.\n` +
      `${studentName}님 예약번호: ${reservationCode}\n` +
      `${origin}/r/${reservationCode} 접속 후 본인 이름 + 전화 끝 4자리로 확인하세요.`;
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setError("복사에 실패했습니다. 길게 눌러 직접 복사해주세요."),
    );
  }

  if (status === "awaiting_payment") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" onClick={report} disabled={isPending}>
          {isPending ? "처리중..." : "송금 완료"}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  if (status === "payment_reported") {
    return <span className="text-xs text-amber-600">입금 확인 대기중</span>;
  }

  if (status === "paid") {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
          {reservationCode}
        </span>
        <Button variant="outline" size="sm" onClick={copyShare}>
          {copied ? "복사됨 ✓" : "공유 문구 복사"}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return null; // expired/cancelled
}
