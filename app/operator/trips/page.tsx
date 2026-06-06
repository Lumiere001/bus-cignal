import { requireOperator } from "@/lib/auth/operator";
import { getOperatorRegionName } from "@/lib/auth/operator-region";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DIRECTION_SHORT,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_COLOR,
} from "@/lib/labels";
import { formatKstDateTime } from "@/lib/datetime";
import { PublishTripButton } from "./PublishTripButton";

const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

export default async function Page() {
  const session = await requireOperator();
  const regionName = await getOperatorRegionName(session.regionId);
  const supabase = createAdminClient();

  const { data: trips } = await supabase
    .from("trips")
    .select(
      `
      id, direction, departure_at, capacity, price_per_seat, status, note,
      origin:region_locations!origin_location_id(label, address),
      destination:region_locations!destination_location_id(label, address),
      seat_offers(seat_count, status),
      matches(id, status)
    `,
    )
    .eq("operator_region_id", session.regionId!)
    .order("departure_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{regionName} 공급 차량</h1>
        <Link href="/operator/trips/new" className={cn(buttonVariants())}>
          + 차량 등록
        </Link>
      </div>

      {!trips || trips.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
          {regionName} 공급 차량이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => {
            const origin = Array.isArray(trip.origin) ? trip.origin[0] : trip.origin;
            const dest = Array.isArray(trip.destination) ? trip.destination[0] : trip.destination;
            const openSeats = (trip.seat_offers ?? [])
              .filter((o) => o.status === "open")
              .reduce((sum, o) => sum + o.seat_count, 0);
            const activeMatches = (trip.matches ?? [])
              .filter((m) => (ACTIVE_MATCH_STATUSES as readonly string[]).includes(m.status ?? ""))
              .length;
            const availableSeats = Math.max(0, openSeats - activeMatches);
            const status = trip.status as "draft" | "published" | "closed";
            const direction = trip.direction as "up" | "down";

            return (
              <li
                key={trip.id}
                className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {DIRECTION_SHORT[direction]}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${TRIP_STATUS_COLOR[status]}`}
                    >
                      {TRIP_STATUS_LABEL[status]}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatKstDateTime(trip.departure_at, { year: true })}
                  </span>
                </div>

                <div className="text-sm font-medium text-gray-800">
                  {origin?.label ?? origin?.address ?? "출발지 미상"} →{" "}
                  {dest?.label ?? dest?.address ?? "도착지 미상"}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>정원 {trip.capacity}석</span>
                  {status === "published" && (
                    <span>잔여 {availableSeats}석</span>
                  )}
                  <span>{trip.price_per_seat.toLocaleString()}원/인</span>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {status === "draft" && (
                    <PublishTripButton tripId={trip.id} />
                  )}
                  <Link
                    href={`/operator/trips/${trip.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    상세 →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
