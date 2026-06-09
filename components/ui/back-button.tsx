"use client";

import { useRouter } from "next/navigation";

/**
 * '← 돌아가기' — History API(router.back) 기반이라 **iOS 설치형 PWA(주소창·뒤로가기 chrome 없음)
 * 에서도 동작**한다. 직접 링크로 들어와 히스토리가 없으면 fallback 경로로.
 * (브라우저·Android는 시스템 뒤로가기도 되지만, iOS standalone을 위해 UI 버튼 제공.)
 */
export function BackButton({
  fallback = "/",
  label = "← 돌아가기",
  className,
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className={
        className ??
        "text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
      }
    >
      {label}
    </button>
  );
}
