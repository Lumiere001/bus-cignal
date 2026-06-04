import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// SPEC §4.4 — 마스터 지구 목록(읽기). 지구·계좌 모니터링용. 편집은 V1.5.

const CATEGORY_LABEL: Record<string, string> = {
  regular: "일반",
  special_ministry: "특수사역",
  overseas: "해외",
};

type Row = {
  id: string;
  code: string;
  name: string;
  area: string | null;
  category: string;
  bank_name: string | null;
  bank_account: string | null;
  account_holder: string | null;
};

async function loadRegions(): Promise<Row[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("regions")
    .select("id, code, name, area, category, bank_name, bank_account, account_holder")
    .order("code", { ascending: true });
  return (data as Row[] | null) ?? [];
}

export default async function AdminRegionsPage() {
  const regions = await loadRegions();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">지구 관리</h1>
        <p className="text-muted-foreground mt-1 text-sm">전국 {regions.length}개 지구 · 계좌 정보 (읽기)</p>
      </div>

      {regions.length === 0 ? (
        <p className="text-muted-foreground text-sm">등록된 지구가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium">코드</th>
                <th className="px-4 py-2 font-medium">지구</th>
                <th className="px-4 py-2 font-medium">권역</th>
                <th className="px-4 py-2 font-medium">분류</th>
                <th className="px-4 py-2 font-medium">계좌</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 tabular-nums">{r.code}</td>
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2">{r.area ?? "—"}</td>
                  <td className="px-4 py-2">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                  <td className="text-muted-foreground px-4 py-2">
                    {r.bank_name && r.bank_account
                      ? `${r.bank_name} ${r.bank_account}${r.account_holder ? ` (${r.account_holder})` : ""}`
                      : "미등록"}
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
