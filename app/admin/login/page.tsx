import { redirect } from "next/navigation";
import { attemptMasterLogin, verifyMasterSession } from "@/lib/auth/master";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; remaining?: string }>;
}) {
  // 이미 로그인 상태면 대시보드로
  if (await verifyMasterSession()) redirect("/admin");
  const sp = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    if (!password) redirect("/admin/login?error=empty");

    const result = await attemptMasterLogin(password);
    if (result.ok) redirect("/admin");
    if (result.reason === "locked") redirect("/admin/login?error=locked");
    redirect(`/admin/login?error=invalid&remaining=${result.remaining}`);
  }

  const errorMsg =
    sp.error === "invalid"
      ? `비밀번호가 올바르지 않습니다. (${sp.remaining ?? "?"}회 남음)`
      : sp.error === "locked"
        ? "5회 실패로 1시간 잠금되었습니다. 잠시 후 다시 시도하세요."
        : sp.error === "empty"
          ? "비밀번호를 입력하세요."
          : null;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <form action={login} className="w-full max-w-sm space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">마스터 로그인</h1>
          <p className="text-muted-foreground text-sm">CCC IT 사역부 운영자 전용</p>
        </div>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="마스터 비밀번호"
          required
          className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
        />
        {errorMsg && <p className="text-destructive text-sm">{errorMsg}</p>}
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          로그인
        </button>
      </form>
    </main>
  );
}
