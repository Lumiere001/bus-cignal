"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 화면을 켜둔 채로도 현황이 따라오도록 주기적으로 서버 데이터를 다시 가져온다.
 * - 탭이 보일 때만 동작(숨김 탭은 정지) — 배터리·트래픽 절약.
 * - 숨김 → 복귀 시 즉시 1회 갱신 후 주기 재개.
 * - router.refresh()는 서버 컴포넌트만 다시 그리므로 검색어 등 클라이언트 상태는 유지된다.
 */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer === null) {
        timer = setInterval(() => router.refresh(), intervalMs);
      }
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
