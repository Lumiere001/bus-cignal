import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  devLoginAsMaster,
  devLoginAsOperator,
  devLoginAsStudent,
} from "@/lib/auth/dev-login";
import { devLoginEnabled } from "@/lib/auth/dev-login-guard";
import { Button } from "@/components/ui/button";

// 매 요청 시 DB(seed) 조회 — 빌드 시 정적 캐시 방지
export const dynamic = "force-dynamic";

export default async function DevLoginPage() {
  // 프로덕션 노출 X (Vercel production은 강제 비활성 — dev-login-guard)
  if (!devLoginEnabled()) notFound();

  const db = createAdminClient();

  const [{ data: operators }, { data: regions }, { data: codes }, { data: students }] =
    await Promise.all([
      db
        .from("operators")
        .select("id, name, region_id")
        .eq("approval_status", "approved")
        .order("created_at"),
      db.from("regions").select("id, name"),
      db
        .from("matches")
        .select("id, reservation_code")
        .not("reservation_code", "is", null)
        .limit(10),
      db.from("students").select("id, name, region_id").order("created_at"),
    ]);

  const regionName = new Map((regions ?? []).map((r) => [r.id, r.name]));

  const matchIds = (codes ?? []).map((c) => c.id);
  const { data: mps } = matchIds.length
    ? await db
        .from("match_passengers")
        .select("match_id, name, phone")
        .in("match_id", matchIds)
    : { data: [] };
  const mpByMatch = new Map((mps ?? []).map((mp) => [mp.match_id, mp]));

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-bold">🛠 Dev 로그인 (개발 전용)</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          CCC 로그인 연동 전, seed 데이터로 화면을 테스트하기 위한 임시 진입점입니다.
          프로덕션에서는 자동 비활성화됩니다.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">마스터</h2>
        <form action={devLoginAsMaster}>
          <Button type="submit" className="w-full">
            마스터로 로그인 → /admin
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">차량 간사 (승인됨)</h2>
        {operators && operators.length > 0 ? (
          operators.map((op) => (
            <form key={op.id} action={devLoginAsOperator.bind(null, op.id)}>
              <Button
                type="submit"
                variant="outline"
                className="w-full justify-start"
              >
                {op.name ?? "(이름 없음)"} ·{" "}
                {op.region_id ? (regionName.get(op.region_id) ?? "?") : "?"}
              </Button>
            </form>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">
            승인된 간사 없음 — <code>supabase db reset</code> (또는{" "}
            <code>pnpm seed:dev</code>) 먼저 실행하세요.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">CCC 학생 (직접 신청)</h2>
        {students && students.length > 0 ? (
          students.map((st) => (
            <form key={st.id} action={devLoginAsStudent.bind(null, st.id)}>
              <Button
                type="submit"
                variant="outline"
                className="w-full justify-start"
              >
                {st.name ?? "(이름 없음)"} ·{" "}
                {st.region_id ? (regionName.get(st.region_id) ?? "?") : "?"} → /s
              </Button>
            </form>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">
            seed 학생 없음 — <code>supabase db reset</code> 먼저 실행하세요.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">학생 테스트 (예약번호)</h2>
        {codes && codes.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {codes.map((m) => {
              const p = mpByMatch.get(m.id);
              return (
                <li key={m.id}>
                  <a
                    className="text-primary underline"
                    href={`/r/${m.reservation_code}`}
                  >
                    {m.reservation_code}
                  </a>{" "}
                  — {p?.name ?? "?"} / 끝4자리 {p?.phone?.slice(-4) ?? "????"}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">예약번호 seed 없음.</p>
        )}
      </section>
    </main>
  );
}
