import { MATCH_STATUS_LABEL } from "@/lib/labels";
import { MatchActions } from "./MatchActions";
import { ReservationLink } from "@/components/operator/ReservationLink";

export type MatchRow = {
  id: string;
  name: string;
  schoolOrRole: string | null;
  phone: string | null;
  status: string;
  reservationCode: string | null;
};

/**
 * 매칭 현황 표 — 이 trip에 최종 매칭된 학생들.
 * 컬럼: 이름 · 대학 · 전화 · 상태 · 예약번호 · (액션).
 * 전화번호는 풀 노출(간사 운영 연락용, 팀장 승인). 액션은 기존 MatchActions 그대로 보존.
 */
export function MatchTable({ rows }: { rows: MatchRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs font-medium whitespace-nowrap text-gray-500">
            <th className="px-4 py-2.5">이름</th>
            <th className="px-4 py-2.5">대학</th>
            <th className="px-4 py-2.5">전화</th>
            <th className="px-4 py-2.5">상태</th>
            <th className="px-4 py-2.5">예약번호</th>
            <th className="px-4 py-2.5 text-right">관리</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium whitespace-nowrap text-gray-900">{m.name}</td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-500">{m.schoolOrRole ?? "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {m.phone ? (
                  <a
                    href={`tel:${m.phone}`}
                    className="text-blue-600 tabular-nums hover:underline"
                  >
                    {m.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-gray-600">
                  {MATCH_STATUS_LABEL[m.status] ?? m.status}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                {m.reservationCode ? (
                  <ReservationLink code={m.reservationCode} />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex justify-end">
                  {/* paid/expired/cancelled은 추가 액션 없음 — 예약번호는 전용 컬럼으로 분리됨.
                      입금 확인/자리 풀기/매칭 취소 등 기존 액션은 MatchActions가 그대로 처리. */}
                  {m.status === "paid" ? (
                    <span className="text-xs text-gray-300">—</span>
                  ) : (
                    <MatchActions
                      matchId={m.id}
                      status={m.status}
                      reservationCode={m.reservationCode}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
