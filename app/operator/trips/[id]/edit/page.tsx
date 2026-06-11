import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { updateTrip } from "../../actions";
import { TripForm, type TripFormDefaults } from "../../new/TripNewForm";

export const dynamic = "force-dynamic";

const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

/** 출발 시각(ISO +09:00) → datetime-local "YYYY-MM-DDTHH:mm" (KST). */
function toLocalInput(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString().slice(0, 16);
}

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireOperator();
  const db = createAdminClient();

  const { data: trip } = await db
    .from("trips")
    .select(
      `id, operator_region_id, status, direction, departure_at, capacity, price_per_seat,
       note, treasurer_name, treasurer_phone, bank_name, account_holder, account_number,
       refund_policy, origin_location_id, destination_location_id,
       origin:region_locations!origin_location_id(address, label)`,
    )
    .eq("id", id)
    .eq("operator_region_id", session.regionId!)
    .maybeSingle();

  const back = (
    <Link
      href={trip ? `/operator/trips/${trip.id}` : "/operator/trips"}
      className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
    >
      ← 차량 상세
    </Link>
  );

  if (!trip) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-gray-900">차량을 찾을 수 없어요</p>
        <p className="text-muted-foreground mt-2 text-sm">
          이미 취소·삭제되었거나 다른 지구 차량일 수 있어요.
        </p>
        <Link href="/operator/trips" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
          ← 지구 차량 목록
        </Link>
      </div>
    );
  }

  // 마감·취소 차량은 수정 불가
  if (trip.status !== "draft" && trip.status !== "published") {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        {back}
        <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
          마감·취소된 차량은 수정할 수 없어요.
        </p>
      </div>
    );
  }

  // 인원을 한 명이라도 받았으면(활성 매칭) 수정 잠금 — 학생 안내와 어긋나지 않도록.
  const { count } = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .in("status", [...ACTIVE_MATCH_STATUSES]);

  if ((count ?? 0) > 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        {back}
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">🔒 이미 매칭된 학생이 있어 수정할 수 없어요</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            한 명이라도 매칭(좌석 배정)된 뒤에는 학생에게 안내된 정보(시각·위치·계좌 등)와 어긋날 수
            있어 차량 정보를 수정할 수 없습니다. 먼저 매칭을 취소한 뒤 수정해주세요. 좌석 수만
            바꾸려면 차량 상세의 ‘잔여 좌석 변경’을 이용하세요.
          </p>
          <Link
            href={`/operator/trips/${trip.id}`}
            className="mt-4 inline-block rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            차량 상세로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const { data: locations } = await db
    .from("region_locations")
    .select("id, direction, location_type, address, label, lat, lng")
    .eq("region_id", session.regionId!)
    .order("is_default", { ascending: false });

  const originLoc = one(trip.origin);
  const defaults: TripFormDefaults = {
    direction: trip.direction as "up" | "down",
    // 오는편 출발지는 텍스트 — 현재 위치의 라벨/주소를 기본값으로.
    originText: originLoc?.label ?? originLoc?.address ?? "",
    departureLocal: toLocalInput(trip.departure_at),
    capacity: trip.capacity,
    price: trip.price_per_seat,
    treasurerName: trip.treasurer_name ?? "",
    treasurerPhone: trip.treasurer_phone ?? "",
    bankName: trip.bank_name ?? "",
    accountHolder: trip.account_holder ?? "",
    accountNumber: trip.account_number ?? "",
    refundPolicy: trip.refund_policy ?? "",
    note: trip.note ?? "",
    originLocationId: trip.origin_location_id,
    destLocationId: trip.destination_location_id,
  };

  const boundUpdate = updateTrip.bind(null, trip.id);

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {back}
      <h1 className="mb-1 text-xl font-semibold">차량 수정</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        아직 매칭된 학생이 없어 자유롭게 수정할 수 있어요. 매칭이 시작되면 수정이 잠깁니다.
      </p>
      <TripForm
        locations={locations ?? []}
        action={boundUpdate}
        defaults={defaults}
        submitLabel="수정 저장"
      />
    </div>
  );
}
