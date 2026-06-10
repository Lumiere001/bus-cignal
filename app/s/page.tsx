import Link from "next/link";
import { requireStudent } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { Logo } from "@/components/brand/logo";
import { DIRECTION_SHORT, MATCH_STATUS_LABEL } from "@/lib/labels";
import { formatKstDateTime } from "@/lib/datetime";
import { CancelRequestButton } from "./CancelRequestButton";
import { LinkPending } from "./LinkPending";
import { studentLogout } from "./actions";
import { AccountInfo } from "@/components/payment/AccountInfo";

export const dynamic = "force-dynamic";

type TripEmbed = {
  id: string;
  direction: string;
  departure_at: string;
  status: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  origin: { label: string | null; address: string } | { label: string | null; address: string }[] | null;
  destination: { label: string | null; address: string } | { label: string | null; address: string }[] | null;
  region: { name: string } | { name: string }[] | null;
};
type MatchEmbed = { id: string; status: string | null };

// 학생 허브 — CCC 로그인 후. 두 갈래: [예약하기](직접 신청) · [예약 확인](내 예약=/me).
// 진행 중(대기/매칭·미입금/거절) 신청은 이 화면에서 바로 보여주고, 확정(paid) 예약은 '예약 확인'으로.
export default async function StudentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ reservations?: string }>;
}) {
  const { reservations } = await searchParams;
  const session = await requireStudent();
  const db = createAdminClient();

  const { data: student } = await db
    .from("students")
    .select("name, regions:regions!region_id(name)")
    .eq("id", session.studentId)
    .maybeSingle();

  const name = student?.name ?? "학생";
  const region = one(student?.regions)?.name ?? null;

  // 진행 중 신청 — 최신순. paid(확정)·cancelled는 허브에서 숨김(확정은 '예약 확인'에서).
  const { data: requests } = await db
    .from("seat_requests")
    .select(
      `
      id, status, requested_at, reject_reason,
      trip:trips!trip_id(
        id, direction, departure_at, status, bank_name, account_number, account_holder,
        origin:region_locations!origin_location_id(label, address),
        destination:region_locations!destination_location_id(label, address),
        region:regions!operator_region_id(name)
      ),
      matches:matches!request_id(id, status)
    `,
    )
    .eq("student_id", session.studentId)
    .order("requested_at", { ascending: false });

  const pending = (requests ?? [])
    .map((r) => {
      const trip = one(r.trip as TripEmbed | TripEmbed[] | null);
      const matches = (r.matches ?? []) as MatchEmbed[];
      const paid = matches.some((m) => m.status === "paid");
      const active = matches.find(
        (m) => m.status === "awaiting_payment" || m.status === "payment_reported",
      );
      return { id: r.id, status: r.status, rejectReason: r.reject_reason, trip, paid, active };
    })
    // 확정(paid)·취소는 허브에서 제외 — 대기/매칭미입금/거절만 노출.
    .filter((r) => !r.paid && r.status !== "cancelled");

  return (
    <main className="mx-auto max-w-md space-y-7 px-5 py-8">
      <div className="flex items-center justify-between">
        <Logo size="sm" />
        <div className="flex items-center gap-3">
          <Link href="/status" className="text-xs text-gray-400 hover:text-gray-600">
            🗺️ 잔여석
          </Link>
          <Link href="/guide" className="text-xs text-gray-400 hover:text-gray-600">
            📖 사용 방법
          </Link>
          <form action={studentLogout}>
            <button type="submit" className="text-xs text-gray-400 hover:text-gray-600">
              로그아웃
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold text-gray-900">안녕하세요, {name}님 👋</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {region ? `${region} · ` : ""}무엇을 도와드릴까요?
        </p>
      </div>

      {/* 두 갈래: 예약하기 / 예약 확인 */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/s/apply"
          className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-8 text-white shadow-sm hover:bg-blue-700"
        >
          <span className="text-3xl">🚌</span>
          <span className="text-base font-semibold">예약하기</span>
          <span className="text-xs text-blue-100">차량 직접 신청</span>
          <LinkPending />
        </Link>
        <Link
          href="/s/reservations"
          className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-4 py-8 text-gray-900 shadow-sm hover:bg-gray-50"
        >
          <span className="text-3xl">🎫</span>
          <span className="text-base font-semibold">예약 확인</span>
          <span className="text-xs text-gray-400">확정된 내 예약</span>
          <LinkPending />
        </Link>
      </div>

      {reservations === "empty" && (
        <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-700">
          확정된 예약이 아직 없어요. 신청이 매칭·입금 확인되면 <b>예약 확인</b>에서 볼 수 있어요.
          진행 상황은 아래에서 확인하세요.
        </p>
      )}

      {/* 진행 중 신청 */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">진행 중 신청</h2>
          <ul className="space-y-3">
            {pending.map((it) => (
              <PendingCard key={it.id} item={it} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

type PendingItem = {
  id: string;
  status: string;
  rejectReason: string | null;
  trip: TripEmbed | null;
  paid: boolean;
  active: MatchEmbed | undefined;
};

function PendingCard({ item }: { item: PendingItem }) {
  const { trip, active, status, rejectReason } = item;
  const origin = one(trip?.origin);
  const dest = one(trip?.destination);
  const regionName = one(trip?.region)?.name ?? "타지구";
  const direction = trip?.direction === "down" ? "down" : "up";

  const badge = active
    ? { label: "매칭됨", cls: "bg-blue-100 text-blue-700" }
    : status === "queued"
      ? { label: "대기중", cls: "bg-amber-100 text-amber-700" }
      : status === "rejected"
        ? { label: "거절됨", cls: "bg-rose-100 text-rose-700" }
        : { label: "진행 중", cls: "bg-gray-100 text-gray-500" };

  return (
    <li className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
          {badge.label}
        </span>
        {trip && (
          <span className="text-xs text-gray-400">
            {formatKstDateTime(trip.departure_at)} 출발
          </span>
        )}
      </div>

      <div className="text-sm font-semibold text-gray-900">
        [{DIRECTION_SHORT[direction]}] {origin?.label ?? origin?.address ?? "출발지"} →{" "}
        {dest?.label ?? dest?.address ?? "도착지"}
      </div>
      <div className="mt-0.5 text-xs text-gray-500">{regionName} 공급 차량</div>

      {active && (
        <div className="mt-3 space-y-2">
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {MATCH_STATUS_LABEL[active.status ?? ""] ?? "매칭됨"} · 아래 계좌로 입금 후 담당 간사
            안내를 따라 주세요. 입금 확인되면 <b>예약 확인</b>에 표시돼요.
          </p>
          {trip && (
            <AccountInfo
              bankName={trip.bank_name}
              accountNumber={trip.account_number}
              accountHolder={trip.account_holder}
            />
          )}
        </div>
      )}

      {status === "rejected" && rejectReason && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          거절 사유: {rejectReason}
        </p>
      )}

      {status === "queued" && !active && (
        <div className="mt-3 flex justify-end">
          <CancelRequestButton requestId={item.id} />
        </div>
      )}
    </li>
  );
}
