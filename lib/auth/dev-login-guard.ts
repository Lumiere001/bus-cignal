/**
 * dev-login(seed 기반 임시 진입점) 활성 여부 — 단일 출처.
 *
 * ⚠️ Vercel **production** 배포에서는 `ENABLE_DEV_LOGIN` 값과 무관하게 **항상 비활성**한다
 *    (운영 env가 실수로 dev-login과 함께 켜져도 prod URL이 무비번 admin 백도어가 되는 것 방지).
 *    그 외(로컬·preview)에서는 비-production이거나 ENABLE_DEV_LOGIN=true일 때만 활성.
 */
export function devLoginEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEV_LOGIN === "true"
  );
}
