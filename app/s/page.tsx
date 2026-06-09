import { requireStudent } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

// 학생 홈 — CCC 로그인 학생. (Phase 1: 로그인·신원 확인까지. Phase 2에서 신청·예약·채팅.)
export default async function StudentHomePage() {
  const session = await requireStudent();
  const db = createAdminClient();

  const { data: student } = await db
    .from("students")
    .select("name, region_id, regions:regions!region_id(name)")
    .eq("id", session.studentId)
    .maybeSingle();

  const name = student?.name ?? "학생";
  const region = Array.isArray(student?.regions)
    ? student?.regions[0]?.name
    : (student?.regions as { name: string } | null)?.name;

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-8">
      <div className="flex justify-center">
        <Logo size="sm" />
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold text-gray-900">
          안녕하세요, {name}님 👋
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {region ? `${region} · ` : ""}CCC 계정으로 로그인되었어요.
        </p>
      </div>

      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm font-medium text-gray-700">
          차량 신청 · 내 예약 · 채팅
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          곧 이 화면에서 차량을 직접 신청하고 예약을 확인할 수 있어요. (준비 중)
        </p>
      </div>
    </main>
  );
}
