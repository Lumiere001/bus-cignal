import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { getOperatorRegionName } from "@/lib/auth/operator-region";
import { createAdminClient } from "@/lib/supabase/admin";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { one } from "@/lib/supabase/relation";
import { RequestsList, type RequestRow } from "./RequestsList";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireOperator();
  const regionName = await getOperatorRegionName(session.regionId);
  const supabase = createAdminClient();

  // 본인 지구가 신청 주체인 건만
  const { data: requests } = await supabase
    .from("seat_requests")
    .select(
      `
      id, requested_at, seat_count, status, requester_kind,
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

  const rows: RequestRow[] = (requests ?? []).map((r) => {
    const trip = one(r.trip);
    const origin = one(trip?.origin);
    const dest = one(trip?.destination);
    const region = one(trip?.region);
    const passengers = r.request_passengers ?? [];

    return {
      id: r.id,
      status: (r.status ?? "queued") as string,
      direction: (trip?.direction ?? "down") as "up" | "down",
      requestedAt: r.requested_at ?? "",
      originLabel: origin?.label ?? origin?.address ?? "출발지",
      destLabel: dest?.label ?? dest?.address ?? "도착지",
      regionName: region?.name ?? null,
      passengerNames: passengers.map((p) => p.name),
      requesterKind: (r.requester_kind === "student" ? "student" : "operator") as
        | "student"
        | "operator",
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{regionName} 신청목록</h1>
        <Link href="/operator/requests/new" className={cn(buttonVariants())}>
          + 타지구 차량 신청
        </Link>
      </div>

      <RequestsList requests={rows} />
    </div>
  );
}
