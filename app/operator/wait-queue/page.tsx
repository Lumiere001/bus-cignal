import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { buttonVariants } from "@/components/ui/button";
import { DIRECTION_SHORT } from "@/lib/labels";
import { one } from "@/lib/supabase/relation";
import { formatDateOnly, formatKstDateTime, formatKstShort } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { assignWaitToTrip, rejectWaitRequest } from "./actions";

export const dynamic = "force-dynamic";

// 버스 미배정 대기큐 (공급측) — 우리 지구 버스를 기다리는 타지구·학생 신청을 시간순으로.
// 버스가 생기면 여기서 본인 지구 published trip으로 이동(배정)하거나 거절한다.
// 이동 후엔 그 trip 상세 대기 큐(시간순 applied_at??requested_at)에 자동 합류 → 기존 승인 체인.

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireOperator();
  const sp = await searchParams;

  if (!session.regionId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold">버스 미배정 대기큐</h1>
        <p className="text-destructive mt-4 rounded-lg border px-3 py-2 text-sm">
          소속 지구가 아직 배정되지 않았습니다.
        </p>
      </main>
    );
  }

  const supabase = createAdminClient();

  // 우리 지구 대기큐(wait_region_id=내 지구, trip 미배정, queued) + 이동 대상 후보(내 지구 published).
  const [{ data: waitRequests }, { data: trips }] = await Promise.all([
    supabase
      .from("seat_requests")
      .select(
        `
        id, requested_at, seat_count, operator_id, requester_kind,
        wait_direction, wait_desired_date,
        region:regions!region_id(name),
        request_passengers(id, name, phone, school_or_role, priority, declined_at, applied_at)
      `,
      )
      .eq("wait_region_id", session.regionId)
      .is("trip_id", null)
      .eq("status", "queued")
      .order("requested_at", { ascending: true }),
    supabase
      .from("trips")
      .select(
        `
        id, direction, departure_at,
        origin:region_locations!origin_location_id(label, address),
        destination:region_locations!destination_location_id(label, address)
      `,
      )
      .eq("operator_region_id", session.regionId)
      .eq("status", "published")
      .order("departure_at", { ascending: true }),
  ]);

  // 신청 지구 담당 간사 연락처 — trips/[id] 큐 헤더와 동일 패턴(운영 연락 목적, 팀장 승인).
  // 학생 직접 신청은 operator_id null → 간사 신청만 추려서 조회.
  const requestOperatorIds = [
    ...new Set(
      (waitRequests ?? [])
        .map((r) => r.operator_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const operatorContacts = new Map<string, { name: string | null; phone: string | null }>();
  if (requestOperatorIds.length > 0) {
    const { data: operators } = await supabase
      .from("operators")
      .select("id, name, phone")
      .in("id", requestOperatorIds);
    for (const op of operators ?? []) {
      operatorContacts.set(op.id, { name: op.name, phone: op.phone });
    }
  }

  // 대기큐 → 표시용 변환 — trips/[id]/page.tsx의 큐 변환과 일관되게(개인 시각 applied_at ?? requested_at).
  const queue = (waitRequests ?? [])
    .map((r) => {
      const contact = r.operator_id ? operatorContacts.get(r.operator_id) : undefined;
      return {
        id: r.id,
        requestedAt: r.requested_at,
        direction: (r.wait_direction === "down" ? "down" : "up") as "up" | "down",
        desiredDate: r.wait_desired_date,
        regionName: one(r.region)?.name ?? "타지구",
        operatorName: contact?.name ?? null,
        operatorPhone: contact?.phone ?? null,
        requesterKind: (r.requester_kind === "student" ? "student" : "operator") as
          | "student"
          | "operator",
        passengers: (r.request_passengers ?? [])
          // 개별 거절된(declined_at) 학생은 표시에서 제외 (trips/[id]와 동일 기준).
          .filter((p) => p.declined_at == null)
          .sort((a, b) => a.priority - b.priority)
          .map((p) => ({
            id: p.id,
            name: p.name,
            phone: p.phone,
            schoolOrRole: p.school_or_role,
            // 개인 신청 시각 — 사전 수합분은 개별 시각, 일반 신청은 신청 시각으로 폴백.
            appliedAt: p.applied_at ?? r.requested_at,
          })),
      };
    })
    .filter((r) => r.passengers.length > 0); // 남은 학생 없는 신청 카드는 숨김

  // 이동 대상 드롭다운 후보 — 본인 지구 published. 방향 일치는 카드별로 필터.
  const tripOptions = (trips ?? []).map((t) => {
    const origin = one(t.origin);
    const dest = one(t.destination);
    return {
      id: t.id,
      direction: t.direction as "up" | "down",
      label: `${formatKstDateTime(t.departure_at)} · ${origin?.label ?? origin?.address ?? "출발지"} → ${dest?.label ?? dest?.address ?? "도착지"}`,
    };
  });

  // 폼 액션 — 성공 시 ?error 없이 본 페이지로(서버 액션이 revalidate), 실패 시 에러를 쿼리로 전달.
  async function assignAction(formData: FormData) {
    "use server";
    const requestId = String(formData.get("requestId") ?? "");
    const tripId = String(formData.get("tripId") ?? "");
    if (!tripId) {
      redirect(`/operator/wait-queue?error=${encodeURIComponent("이동할 차량을 선택해주세요.")}`);
    }
    const result = await assignWaitToTrip(requestId, tripId);
    if ("error" in result) {
      redirect(`/operator/wait-queue?error=${encodeURIComponent(result.error)}`);
    }
    redirect(`/operator/trips/${tripId}`);
  }

  async function rejectAction(formData: FormData) {
    "use server";
    const requestId = String(formData.get("requestId") ?? "");
    const reason = String(formData.get("reason") ?? "");
    const result = await rejectWaitRequest(requestId, reason);
    if ("error" in result) {
      redirect(`/operator/wait-queue?error=${encodeURIComponent(result.error)}`);
    }
    redirect("/operator/wait-queue");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/operator"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
      >
        ← 대시보드
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">버스 미배정 대기큐</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          우리 지구 버스를 기다리는 신청이에요. 버스를 올린 뒤 여기서 배정하면 그 차량의 대기
          큐(시간순)에 합류해 기존 승인 절차로 이어집니다.
        </p>
      </div>

      {sp.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{sp.error}</p>
      )}

      {queue.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-gray-400">
          대기 중인 신청이 없습니다.
        </p>
      ) : (
        <ul className="space-y-4">
          {queue.map((req) => {
            // 이동 대상 = 본인 지구 published & 대기 방향 일치만.
            const candidates = tripOptions.filter((t) => t.direction === req.direction);
            return (
              <li key={req.id} className="rounded-xl border bg-white p-4 shadow-sm">
                {/* 헤더 — 방향·신청 지구·학생 직접 신청 배지 + 신청 시각 */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      req.direction === "up"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {DIRECTION_SHORT[req.direction]}
                  </span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {req.regionName}
                  </span>
                  {req.requesterKind === "student" && (
                    <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                      학생 직접 신청
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">
                    {formatKstDateTime(req.requestedAt)} 신청
                  </span>
                </div>

                {/* 희망일·인원·담당 간사 연락처 */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                  <span>
                    희망일{" "}
                    {req.desiredDate ? (
                      <b className="font-medium text-gray-900">
                        {formatDateOnly(req.desiredDate)}
                      </b>
                    ) : (
                      <span className="text-gray-400">미지정</span>
                    )}
                  </span>
                  <span>
                    인원 <b className="font-medium text-gray-900">{req.passengers.length}명</b>
                  </span>
                  {req.operatorName && (
                    <span className="text-gray-500">
                      담당 간사 {req.operatorName}
                      {req.operatorPhone && (
                        <a
                          href={`tel:${req.operatorPhone}`}
                          className="ml-1 text-blue-600 hover:underline"
                        >
                          {req.operatorPhone}
                        </a>
                      )}
                    </span>
                  )}
                </div>

                {/* 학생 명단 — 개인 신청 시각순 표기는 trips/[id] 시간순 뷰와 동일 포맷 */}
                <ol className="mt-3 space-y-1.5">
                  {req.passengers.map((p, idx) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <span className="inline-flex h-5 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] text-gray-500 tabular-nums">
                        {idx + 1}
                      </span>
                      <span className="text-[11px] tabular-nums text-gray-500">
                        {formatKstShort(p.appliedAt)}
                      </span>
                      <span className="font-medium text-gray-900">{p.name}</span>
                      {p.schoolOrRole && <span className="text-gray-400">{p.schoolOrRole}</span>}
                      <a href={`tel:${p.phone}`} className="ml-auto text-xs text-blue-600 hover:underline">
                        {p.phone}
                      </a>
                    </li>
                  ))}
                </ol>

                {/* 액션 — 버스로 이동(방향 일치 published만) / 거절(사유 선택) */}
                <div className="mt-3 space-y-2 border-t pt-3">
                  {candidates.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      {DIRECTION_SHORT[req.direction]} 공개 차량이 없어요.{" "}
                      <Link href="/operator/trips/new" className="text-blue-600 hover:underline">
                        차량을 등록·공개
                      </Link>
                      하면 여기서 배정할 수 있어요.
                    </p>
                  ) : (
                    <form action={assignAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="requestId" value={req.id} />
                      <select
                        name="tripId"
                        required
                        defaultValue=""
                        className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="" disabled>
                          이동할 차량 선택 ({DIRECTION_SHORT[req.direction]})
                        </option>
                        {candidates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={cn(buttonVariants({ size: "sm" }))}>
                        버스로 이동
                      </button>
                    </form>
                  )}

                  <form action={rejectAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="requestId" value={req.id} />
                    <input
                      type="text"
                      name="reason"
                      maxLength={500}
                      placeholder="거절 사유 (선택, 신청 지구에 전달됩니다)"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      거절
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
