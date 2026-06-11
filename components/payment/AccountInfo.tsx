// 입금 계좌 안내 박스 — 매칭(송금 대기) 후 신청 지구 간사·학생에게 보여줄 공급 차량 계좌.
// 계좌번호가 없으면(구 차량 등 미입력) null 반환 → 호출부에서 fallback 안내.
// 환불 정책(선택 입력)이 있으면 계좌 아래에 함께 안내.
export function AccountInfo({
  bankName,
  accountNumber,
  accountHolder,
  refundPolicy,
}: {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  refundPolicy?: string | null;
}) {
  if (!accountNumber) return null;
  const line = [bankName, accountNumber].filter(Boolean).join(" ");
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
      <p className="text-xs font-medium text-blue-700">💳 입금 계좌</p>
      <p className="mt-0.5 font-medium break-all tabular-nums text-gray-900">{line}</p>
      {accountHolder && (
        <p className="text-xs text-gray-500">예금주 {accountHolder}</p>
      )}
      {refundPolicy && (
        <div className="mt-2 border-t border-blue-200 pt-2">
          <p className="text-xs font-medium text-blue-700">↩️ 환불 정책</p>
          <p className="mt-0.5 text-xs whitespace-pre-wrap text-gray-700">{refundPolicy}</p>
        </div>
      )}
    </div>
  );
}
