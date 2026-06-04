import { createAdminClient } from "@/lib/supabase/admin";
import { PendingActions } from "./PendingActions";

export const dynamic = "force-dynamic";

// SPEC §2.2·§4.4 — 가입 승인 대기 간사 목록 + 승인/거절.
// "차량 간사 여부"는 CCC가 주지 않으므로 마스터 승인이 권한 최종 결정.

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  campus: string | null;
  created_at: string;
  requested: { name: string } | null;
};

async function loadPending(): Promise<Row[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("operators")
    // requested_region_id FK 명시(operators→regions FK 2개라 모호성 제거).
    .select(
      "id, name, email, phone, campus, created_at, requested:regions!operators_requested_region_id_fkey ( name )",
    )
    .eq("approval_status", "pending")
    .order("created_at", { ascending: true });
  return (data as Row[] | null) ?? [];
}

export default async function AdminOperatorsPendingPage() {
  const pending = await loadPending();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">간사 가입 승인</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          승인 대기 {pending.length}명 · 승인 시 신청 지구로 권한 활성화
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="text-muted-foreground text-sm">대기 중인 가입 신청이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((op) => (
            <li
              key={op.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div className="space-y-0.5 text-sm">
                <div className="font-medium">
                  {op.name ?? "(이름 미상)"}
                  <span className="text-muted-foreground ml-2 font-normal">
                    {op.requested?.name ?? "지구 미지정"} 신청
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {[op.campus, op.phone, op.email].filter(Boolean).join(" · ") || "추가 정보 없음"}
                </div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  신청일 {op.created_at.slice(0, 10)}
                </div>
              </div>
              <PendingActions operatorId={op.id} hasRegion={!!op.requested} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
