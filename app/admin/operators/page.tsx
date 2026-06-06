import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { operatorLoginPath } from "@/lib/auth/operator-magic";
import { createOperator, regenerateLoginToken } from "./actions";
import { MagicLinkCell } from "./MagicLinkCell";
import { RevokeButton } from "./RevokeButton";

export const dynamic = "force-dynamic";

// SPEC §5.10 — 활성 간사 권한 관리(비활성화). 가입 대기는 /admin/operators/pending.
// 매직링크 입장(임시): 마스터가 간사 추가 → 토큰 발급 → 링크를 카톡으로 간사에 전달.

type Row = {
  id: string;
  name: string | null;
  created_at: string;
  login_token: string | null;
  regions: { name: string } | null;
};

async function loadOperators(): Promise<Row[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("operators")
    // operators→regions FK 2개(region_id·requested_region_id)라 제약명 명시 필수.
    // 전화·이메일은 비활성화에 불필요 → 개인정보 최소 노출(SPEC §5.10 목업·§2.4) 위해 미조회.
    .select(
      "id, name, created_at, login_token, regions!operators_region_id_fkey ( name )",
    )
    .eq("approval_status", "approved")
    .order("created_at", { ascending: true });
  return (data as Row[] | null) ?? [];
}

async function loadRegions(): Promise<{ id: string; name: string }[]> {
  const db = createAdminClient();
  const { data } = await db.from("regions").select("id, name").order("name");
  return data ?? [];
}

/** 현재 요청 호스트로 절대 URL 베이스 구성 (입장 링크 전달용). */
async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

const inputCls =
  "rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function AdminOperatorsPage() {
  const [operators, regions, base] = await Promise.all([
    loadOperators(),
    loadRegions(),
    baseUrl(),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">간사 권한 관리</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          활성 간사 {operators.length}명 · 비활성화 시 권한 즉시 회수·세션 종료
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          ⓘ 간사 로그인 = <b>입장 링크</b>(임시·CCC 연동 전). 간사를 추가하면 링크가
          발급됩니다. 링크를 복사해 해당 간사에게 카톡으로 전달하세요. 유출 시 [재발급]으로
          무효화·재생성합니다.
        </p>
      </div>

      {/* 간사 추가 (마스터 직접 온보딩) */}
      <form
        action={createOperator}
        className="flex flex-wrap items-end gap-3 rounded-xl border p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="op-name" className="text-xs font-medium">
            이름
          </label>
          <input
            id="op-name"
            name="name"
            required
            placeholder="간사 이름"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="op-phone" className="text-xs font-medium">
            전화 <span className="text-muted-foreground">(선택)</span>
          </label>
          <input
            id="op-phone"
            name="phone"
            placeholder="010-0000-0000"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="op-region" className="text-xs font-medium">
            지구
          </label>
          <select id="op-region" name="regionId" required className={inputCls}>
            <option value="">선택</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          간사 추가
        </Button>
      </form>

      {operators.length === 0 ? (
        <p className="text-muted-foreground text-sm">활성 간사가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium whitespace-nowrap">이름</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">지구</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">가입일</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">입장 링크</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">액션</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op) => (
                <tr key={op.id} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{op.name ?? "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{op.regions?.name ?? "미배정"}</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">
                    {op.created_at.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <MagicLinkCell
                        url={
                          op.login_token
                            ? `${base}${operatorLoginPath(op.login_token)}`
                            : null
                        }
                      />
                      <form
                        action={async () => {
                          "use server";
                          await regenerateLoginToken(op.id);
                        }}
                      >
                        <Button type="submit" size="sm" variant="ghost">
                          재발급
                        </Button>
                      </form>
                    </div>
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
