import Link from "next/link";
import { requireStudent } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { Logo } from "@/components/brand/logo";
import { DIRECTION_SHORT, MATCH_STATUS_LABEL } from "@/lib/labels";
import { formatKstDateTime } from "@/lib/datetime";
import { ReservationLink } from "@/components/operator/ReservationLink";
import { CancelRequestButton } from "./CancelRequestButton";
import { studentLogout } from "./actions";

export const dynamic = "force-dynamic";

type TripEmbed = {
  id: string;
  direction: string;
  departure_at: string;
  status: string;
  origin: { label: string | null; address: string } | { label: string | null; address: string }[] | null;
  destination: { label: string | null; address: string } | { label: string | null; address: string }[] | null;
  region: { name: string } | { name: string }[] | null;
};
type MatchEmbed = { id: string; status: string | null; reservation_code: string | null };

// 학생 홈 — CCC 로그인 학생. 본인 신청/예약 요약 + 차량 신청 CTA + 채팅 진입. (Phase 2·3)
export default async function StudentHomePage() {
  const session = await requireStudent();
  const db = createAdminClient();

  const { data: student } = await db
    .from("students")
    .select("name, region_id, regions:regions!region_id(name)")
    .eq("id", session.studentId)
    .maybeSingle();

  const name = student?.name ?? "학생";
  const region = one(student?.regions)?.name ?? null;

  // 내 신청/예약 — 최신순. 각 신청의 trip + (있으면) 매칭 상태·예약번호 임베드.
  const { data: requests } = await db
    .from("seat_requests")
    .select(
      `
      id, status, requested_at, reject_reason,
      trip:trips!trip_id(
        id, direction, departure_at, status,
        origin:region_locations!origin_location_id(label, address),
        destination:region_locations!destination_location_id(label, address),
        region:regions!operator_region_id(name)
      ),
      matches:matches!request_id(id, status, reservation_code)
    `,
    )
    .eq("student_id", session.studentId)
    .order("requested_at", { ascending: false });

  const items = (requests ?? []).map((r) => {
    const trip = one(r.trip as TripEmbed | TripEmbed[] | null);
    const matches = (r.matches ?? []) as MatchEmbed[];
    const paid = matches.find((m) => m.status === "paid") ?? null;
    const active =
      matches.find(
        (m) => m.status === "awaiting_payment" || m.status === "payment_reported",
      ) ?? null;
    // 매칭이 풀린(취소·해제) 흔적 — status가 'matched'로 남았는데 활성·paid 매칭이 없으면 이걸로 표시.
    const hadTerminal = matches.some(
      (m) => m.status === "expired" || m.status === "cancelled",
    );
    return {
      id: r.id,
      status: r.status,
      rejectReason: r.reject_reason,
      trip,
      paid,
      active,
      hadTerminal,
    };
  });

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <Logo size="sm" />
        <form action={studentLogout}>
          <button
            type="submit"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            로그아웃
          </button>
        </form>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold text-gray-900">안녕하세요, {name}님 👋</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {region ? `${region} · ` : ""}CCC 계정으로 로그인되었어요.
        </p>
        <Link
          href="/s/apply"
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
        >
          🚌 차량 신청하기
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">내 신청 · 예약</h2>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-gray-400">
            아직 신청한 차량이 없어요.
            <br />
            위의 <span className="font-medium">차량 신청하기</span>로 시작해 보세요.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <RequestCard key={it.id} item={it} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

type CardItem = {
  id: string;
  status: string;
  rejectReason: string | null;
  trip: TripEmbed | null;
  paid: MatchEmbed | null;
  active: MatchEmbed | null;
  hadTerminal: boolean;
};

function RequestCard({ item }: { item: CardItem }) {
  const { trip, paid, active, status, rejectReason, hadTerminal } = item;
  const origin = one(trip?.origin);
  const dest = one(trip?.destination);
  const regionName = one(trip?.region)?.name ?? "타지구";
  const direction = trip?.direction === "down" ? "down" : "up";

  // 표시 상태 — paid > 활성 매칭 > 신청 상태(queued/rejected/cancelled) 순으로 결정.
  const badge = paid
    ? { label: "예약 확정", cls: "bg-green-100 text-green-700" }
    : active
      ? { label: "매칭됨", cls: "bg-blue-100 text-blue-700" }
      : status === "queued"
        ? { label: "대기중", cls: "bg-amber-100 text-amber-700" }
        : status === "rejected"
          ? { label: "거절됨", cls: "bg-rose-100 text-rose-700" }
          : status === "cancelled"
            ? { label: "취소됨", cls: "bg-gray-100 text-gray-500" }
            : hadTerminal
              ? { label: "매칭 취소됨", cls: "bg-gray-100 text-gray-500" }
              : { label: "매칭됨", cls: "bg-blue-100 text-blue-700" };

  return (
    <li className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge.cls}`}
        >
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

      {/* 매칭됨(미입금) — 송금 안내 */}
      {active && !paid && (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {MATCH_STATUS_LABEL[active.status ?? ""] ?? "매칭됨"} · 입금 안내는 담당 간사 안내를
          따라 주세요.
        </p>
      )}

      {/* 예약 확정 — 예약번호 + /r 링크 + 채팅 */}
      {paid && (
        <div className="mt-3 space-y-2">
          {paid.reservation_code && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">예약번호</span>
              <ReservationLink code={paid.reservation_code} />
            </div>
          )}
          {trip && (
            <Link
              href={`/chat/${trip.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              💬 버스 채팅 ({DIRECTION_SHORT[direction]})
            </Link>
          )}
        </div>
      )}

      {/* 거절 사유 */}
      {status === "rejected" && rejectReason && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          거절 사유: {rejectReason}
        </p>
      )}

      {/* 대기중 — 본인 취소 */}
      {status === "queued" && !active && !paid && (
        <div className="mt-3 flex justify-end">
          <CancelRequestButton requestId={item.id} />
        </div>
      )}
    </li>
  );
}
