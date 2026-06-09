"use client";

import { useLinkStatus } from "next/link";

/**
 * 부모 <Link> 의 네비게이션 대기 상태를 읽어 즉시 스피너 오버레이를 띄운다.
 * 특히 '예약 확인'은 라우트 핸들러(/s/reservations)로 이동 후 /me로 redirect 되는데,
 * 라우트 핸들러 구간은 loading.tsx가 못 덮으므로 클릭 즉시 피드백을 이걸로 준다.
 * (Link 의 자식으로 렌더되어야 useLinkStatus 가 동작.)
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/55"
      role="status"
      aria-label="이동 중"
    >
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
    </span>
  );
}
