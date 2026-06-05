"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatKstDateShort } from "@/lib/datetime";
import type { MatchForCancel } from "@/lib/passenger/cancel";

type Props = {
  match: MatchForCancel;
  action: (formData: FormData) => Promise<void>;
  error?: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  wrong_state: "이 매칭은 현재 취소할 수 없는 상태예요.",
  db_error: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
  invalid_reason: "취소 사유가 너무 길어요. 200자 이내로 입력해 주세요.",
  confirm_required: "취소 확인 체크박스를 선택해 주세요.",
};

export function CancelConfirmForm({ match, action, error }: Props) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col gap-5 p-4">
      {/* 노선 요약 */}
      <div>
        <p className="text-muted-foreground text-xs">취소할 예약</p>
        <h1 className="text-xl font-bold">
          {match.originLabel} → {match.destinationLabel}
        </h1>
        <p className="text-muted-foreground text-sm">
          {formatKstDateShort(match.departureAt)}
          {match.reservationCode ? ` · ${match.reservationCode}` : ""}
        </p>
      </div>

      {/* D-1 이내 경고 */}
      {match.isWithin24h && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          운행이 임박했습니다. 환불이 어려울 수 있어요.
        </div>
      )}

      {/* 취소 안내 */}
      <div className="rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed">
        <p className="mb-2 font-medium">취소 시 유의사항</p>
        <ul className="flex flex-col gap-1 text-muted-foreground">
          <li>· 자리는 다른 분께 돌아갑니다.</li>
          <li>· 환불은 각 지구로 문의해 주세요.</li>
          <li>· 양쪽 지구 간사에게 자동 알림이 갑니다.</li>
        </ul>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {ERROR_MESSAGES[error] ?? "오류가 발생했습니다. 다시 시도해 주세요."}
        </p>
      )}

      <form action={action} className="flex flex-col gap-4">
        {/* 취소 사유 (선택) */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-sm font-medium">
            취소 사유{" "}
            <span className="text-muted-foreground font-normal">(선택)</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            maxLength={200}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
            placeholder="취소 사유를 입력해 주세요 (최대 200자)"
          />
        </div>

        {/* 최종 확인 체크박스 (오클릭 방지) */}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="confirmed"
            value="on"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          위 내용을 확인했으며, 예약을 취소합니다.
        </label>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <Link href="/me" className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              돌아가기
            </Button>
          </Link>
          <Button
            type="submit"
            variant="destructive"
            className="flex-1"
            disabled={!confirmed}
          >
            취소 확정
          </Button>
        </div>
      </form>
    </main>
  );
}
