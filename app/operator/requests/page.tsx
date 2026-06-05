import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DIRECTION_SHORT,
  REQUEST_STATUS_LABEL,
} from "@/lib/labels";
import { one } from "@/lib/supabase/relation";
import { formatKstDateTime } from "@/lib/datetime";

const REQUEST_STATUS_COLOR: Record<string, string> = {
  queued: "bg-blue-100 text-blue-700",
  matched: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
};

export default async function Page() {
  const session = await requireOperator();
  const supabase = createAdminClient();

  // 본인 지구가 신청 주체인 건만
  const { data: requests } = await supabase
    .from("seat_requests")
    .select(
      `
      id, requested_at, seat_count, status,
      trip:trips!trip_id(
        direction,
        origin:region_locations!origin_location_id(label, address),
        destination:region_locations!destination_location_id(label, address),
        region:regions!operator_region_id(name)
      ),
      request_passengers(id, name)
    `,
    )
    .eq("region_id", session.regionId!)
    .order("requested_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">내 신청 목록</h1>
        <Link href="/operator/requests/new" className={cn(buttonVariants())}>
          + 타지구 차량 신청
        </Link>
      </div>

      {!requests || requests.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
          아직 신청한 차량이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const trip = one(r.trip);
            const origin = one(trip?.origin);
            const dest = one(trip?.destination);
            const region = one(trip?.region);
            const status = (r.status ?? "queued") as string;
            const direction = (trip?.direction ?? "down") as "up" | "down";
            const passengers = r.request_passengers ?? [];
            const paxCount = passengers.length;
            const paxPreview =
              passengers
                .slice(0, 3)
                .map((p) => p.name)
                .join(", ") + (paxCount > 3 ? ` 외 ${paxCount - 3}명` : "");

            return (
              <li key={r.id}>
                <Link
                  href={`/operator/requests/${r.id}`}
                  className="flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {DIRECTION_SHORT[direction]}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          REQUEST_STATUS_COLOR[status] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {REQUEST_STATUS_LABEL[status] ?? status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatKstDateTime(r.requested_at)} 신청
                    </span>
                  </div>

                  <div className="text-sm font-medium text-gray-800">
                    {origin?.label ?? origin?.address ?? "출발지"} →{" "}
                    {dest?.label ?? dest?.address ?? "도착지"}
                  </div>

                  {/* 신청한 학생 이름 미리보기 (모바일에선 hover가 없으니 인라인으로 표시) */}
                  {paxCount > 0 && (
                    <div className="text-xs text-gray-600">
                      신청 학생: <span className="text-gray-800">{paxPreview}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {region?.name && <span>{region.name} 차량</span>}
                    <span>학생 {paxCount}명</span>
                    <span className="ml-auto text-blue-600">상세 보기 →</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
