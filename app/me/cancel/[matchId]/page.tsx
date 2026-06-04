import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePassenger } from "@/lib/auth/passenger";
import { getMatchForCancel } from "@/lib/passenger/cancel";
import { CancelConfirmForm } from "@/components/me/CancelConfirmForm";
import { cancelMatchAction } from "./actions";

type Props = {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function CancelPage({ params, searchParams }: Props) {
  const { matchId } = await params;
  const { error } = await searchParams;

  const session = await requirePassenger();

  const match = await getMatchForCancel(session.passengerId, matchId);

  // 소유권 불일치 → 정보 누출 없이 /me로 이동
  if (!match) redirect("/me");

  // 이미 취소/만료 → 안전한 안내 표시
  if (match.status === "cancelled" || match.status === "expired") {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col gap-4 p-4">
        <h1 className="text-xl font-bold">이미 취소된 예약이에요</h1>
        <p className="text-muted-foreground text-sm">
          이 예약은 이미 취소 또는 만료되어 더 이상 변경할 수 없어요.
        </p>
        <Link
          href="/me"
          className="text-sm font-medium underline underline-offset-4"
        >
          내 예약으로 돌아가기
        </Link>
      </main>
    );
  }

  const action = cancelMatchAction.bind(null, matchId);

  return <CancelConfirmForm match={match} action={action} error={error} />;
}
