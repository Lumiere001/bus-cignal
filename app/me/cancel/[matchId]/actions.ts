"use server";

import { redirect } from "next/navigation";
import { getPassengerSession } from "@/lib/auth/passenger";
import { cancelMatch } from "@/lib/passenger/cancel";
import { CancelReasonSchema } from "@/lib/validators/passenger";

/** 학생 매칭 취소 Server Action. matchId는 page에서 bind()로 고정. */
export async function cancelMatchAction(
  matchId: string,
  formData: FormData,
): Promise<void> {
  const session = await getPassengerSession();
  if (!session) redirect("/");

  if (formData.get("confirmed") !== "on") {
    redirect(`/me/cancel/${matchId}?error=confirm_required`);
  }

  const raw = { reason: formData.get("reason") ?? "" };
  const parsed = CancelReasonSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/me/cancel/${matchId}?error=invalid_reason`);
  }
  const reason = parsed.data.reason?.trim() || null;

  const result = await cancelMatch(session.passengerId, matchId, reason);

  if (!result.ok) {
    if (result.reason === "unauthorized") {
      redirect("/me");
    }
    redirect(`/me/cancel/${matchId}?error=${result.reason}`);
  }

  redirect("/me?cancelled=1");
}
