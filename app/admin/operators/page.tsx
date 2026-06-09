import { createAdminClient } from "@/lib/supabase/admin";
import { RevokeButton } from "./RevokeButton";

export const dynamic = "force-dynamic";

// SPEC §5.10 — 활성 간사 권한 관리(비활성화). 가입 대기는 /admin/operators/pending.
// 간사 로그인 = CCC 핸드오프(자동 프로비저닝)로만. (구 매직링크 온보딩 제거됨 — CCC-only.)

type Row = {
  id: string;
  name: string | null;
  created_at: string;
  regions: { name: string } | null;
};

async function loadOperators(): Promise<Row[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("operators")
    // operators→regions FK 2개(region_id·requested_region_id)라 제약명 명시 필수.
    // 전화·이메일은 비활성화에 불필요 → 개인정보 최소 노출(SPEC §5.10 목업·§2.4) 위해 미조회.
    .select("id, name, created_at, regions!operators_region_id_fkey ( name )")
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
        <p className="text-muted-foreground mt-1 text-xs">
          ⓘ 간사는 <b>CCC 계정으로 로그인</b>하면 본인 지구로 자동 입장됩니다(자동 승인). 여기서는
          활성 간사 확인·권한 회수만 합니다. 가입 대기는 <b>승인 대기</b> 메뉴에서 처리하세요.
        </p>
      </div>

      {operators.length === 0 ? (
        <p className="text-muted-foreground text-sm">활성 간사가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium whitespace-nowrap">이름</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">지구</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">가입일</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">액션</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op) => (
                <tr key={op.id} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{op.name ?? "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {op.regions?.name ?? "미배정"}
                  </td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">
                    {op.created_at.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
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
