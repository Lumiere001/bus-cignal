import { createAdminClient } from "@/lib/supabase/admin";
import { RevokeButton } from "./RevokeButton";

export const dynamic = "force-dynamic";

// SPEC §5.10 — 활성 간사 권한 관리(비활성화). 가입 대기는 /admin/operators/pending.

type Row = {
  id: string;
  name: string | null;
  phone: string | null;
  created_at: string;
  regions: { name: string } | null;
};

async function loadOperators(): Promise<Row[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("operators")
    // operators→regions FK 2개(region_id·requested_region_id)라 제약명 명시 필수.
    .select("id, name, phone, created_at, regions!operators_region_id_fkey ( name )")
    .eq("approval_status", "approved")
    .order("created_at", { ascending: true });
  return (data as Row[] | null) ?? [];
}

export default async function AdminOperatorsPage() {
  const operators = await loadOperators();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">간사 권한 관리</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          활성 간사 {operators.length}명 · 비활성화 시 권한 즉시 회수·세션 종료
        </p>
      </div>

      {operators.length === 0 ? (
        <p className="text-muted-foreground text-sm">활성 간사가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium">이름</th>
                <th className="px-4 py-2 font-medium">지구</th>
                <th className="px-4 py-2 font-medium">연락처</th>
                <th className="px-4 py-2 font-medium">가입일</th>
                <th className="px-4 py-2 font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op) => (
                <tr key={op.id} className="border-t">
                  <td className="px-4 py-2">{op.name ?? "—"}</td>
                  <td className="px-4 py-2">{op.regions?.name ?? "미배정"}</td>
                  <td className="px-4 py-2 tabular-nums">{op.phone ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{op.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-2">
                    <RevokeButton operatorId={op.id} name={op.name ?? "이 간사"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
