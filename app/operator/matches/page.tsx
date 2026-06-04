import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTION_SHORT, MATCH_STATUS_LABEL } from "@/lib/labels";
import { MatchPaymentCell } from "./MatchPaymentCell";

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function formatKST(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

export default async function Page() {
  const session = await requireOperator();

  if (!session.regionId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          소속 지구 정보가 없습니다. 관리자에게 문의해주세요.
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();

  // 본인 지구가 신청한 매칭 (송금 주체). build/필터는 JS에서 region 스코핑.
  // (출시 전 RLS로 DB 레벨 스코핑 필요 — PRE-LAUNCH-CHECKLIST)
  const { data: rows } = await supabase
    .from("matches")
    .select(
      `
      id, status, reservation_code, matched_at,
      passenger:request_passengers!passenger_id(name, school_or_role),
      request:seat_requests!request_id(region_id),
      trip:trips!trip_id(
        direction, departure_at, price_per_seat,
        origin:region_locations!origin_location_id(label, address),
        destination:region_locations!destination_location_id(label, address),
        supply:regions!operator_region_id(name, bank_name, bank_account, account_holder)
      )
    `,
    )
    .order("matched_at", { ascending: false });

  const matches = (rows ?? []).filter(
    (r) => one(r.request)?.region_id === session.regionId,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-xl font-semibold">내 매칭 (송금·예약)</h1>
      <p className="mb-6 text-xs text-gray-400">
        우리 지구 학생이 타지구 차량에 매칭된 건 · 송금 완료 보고 후 공급 지구의 입금 확인을
        기다립니다.
      </p>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
          매칭된 건이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {matches.map((m) => {
            const trip = one(m.trip);
            const origin = one(trip?.origin);
            const dest = one(trip?.destination);
            const supply = one(trip?.supply);
            const pax = one(m.passenger);
            const direction = (trip?.direction ?? "down") as "up" | "down";
            const route = `${origin?.label ?? origin?.address ?? "출발지"} → ${
              dest?.label ?? dest?.address ?? "도착지"
            }`;
            const departure = trip ? formatKST(trip.departure_at) : "";

            return (
              <li key={m.id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {DIRECTION_SHORT[direction]}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {pax?.name ?? "학생"}
                      </span>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {MATCH_STATUS_LABEL[m.status ?? ""] ?? m.status}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-700">{route}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                      <span>{departure} 출발</span>
                      {trip && <span>{trip.price_per_seat.toLocaleString()}원/인</span>}
                      {supply?.name && <span>{supply.name} 차량</span>}
                    </div>
                    {/* 송금 정보 (공급 지구 계좌) — awaiting_payment일 때 안내 */}
                    {m.status === "awaiting_payment" && supply?.bank_account && (
                      <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        송금 계좌: {supply.bank_name} {supply.bank_account}
                        {supply.account_holder ? ` (${supply.account_holder})` : ""}
                      </div>
                    )}
                  </div>

                  <MatchPaymentCell
                    matchId={m.id}
                    status={m.status ?? ""}
                    reservationCode={m.reservation_code ?? null}
                    studentName={pax?.name ?? "학생"}
                    route={route}
                    departure={departure}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
