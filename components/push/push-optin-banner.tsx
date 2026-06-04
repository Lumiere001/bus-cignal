"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { enablePush } from "@/lib/push/client";
import {
  evaluatePushEnv,
  type PushEligibility,
} from "@/lib/push/eligibility";

/**
 * 푸시 옵트인 부드러운 배너 — SPEC §S5(학생 옵션 C)·§9.3·§13.
 *
 * 재사용 컴포넌트: 학생(`/me` 첫 매칭 paid 시점)·간사 모두 사용. 마운트 위치/시점은 호출 측 결정.
 *  - 미지원/이미 옵트인/닫음 → 렌더 안 함(마찰 0)
 *  - iOS 홈화면 추가 전 → "홈 화면에 추가" 안내
 *  - 카톡 내장 브라우저 → "다른 브라우저로 열기" 안내
 *  - 가능 → [알림 받기] 버튼 → 권한 요청 + 토큰 등록
 */

type Audience = "passenger" | "operator";
type State = "idle" | "working" | "enabled" | "error";

const COPY: Record<Audience, { ready: string }> = {
  passenger: { ready: "출발·변경 안내를 푸시 알림으로 받아보세요." },
  operator: { ready: "신청·매칭·송금 알림을 푸시로 받아보세요." },
};

function detectEligibility(): PushEligibility {
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;
  return evaluatePushEnv({
    userAgent: window.navigator.userAgent,
    isStandalone,
    hasNotification: "Notification" in window,
    hasServiceWorker: "serviceWorker" in window.navigator,
    hasPushManager: "PushManager" in window,
  });
}

export function PushOptInBanner({
  audience = "passenger",
  className,
}: {
  audience?: Audience;
  className?: string;
}) {
  const storageKey = `bc_push_optin:${audience}`;
  const [mounted, setMounted] = useState(false);
  const [elig, setElig] = useState<PushEligibility | null>(null);
  const [state, setState] = useState<State>("idle");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // 클라이언트 전용(window) 환경 감지 → 하이드레이션 이후 1회.
    // async 래핑: react-hooks/set-state-in-effect(동기 setState 직접 호출) 회피.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const saved =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(storageKey)
          : null;
      if (saved === "enabled" || saved === "dismissed") {
        setHidden(true);
        setMounted(true);
        return;
      }
      setElig(detectEligibility());
      setMounted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  if (!mounted || hidden || !elig) return null;
  if (elig.status === "unsupported") return null;

  function dismiss() {
    localStorage.setItem(storageKey, "dismissed");
    setHidden(true);
  }

  async function onEnable() {
    setState("working");
    const r = await enablePush();
    if (r.ok) {
      localStorage.setItem(storageKey, "enabled");
      setState("enabled");
      setHidden(true);
    } else {
      setState("error");
    }
  }

  const base =
    "flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm";
  const wrap = className ? `${base} ${className}` : base;

  return (
    <div className={wrap} role="region" aria-label="알림 받기 안내">
      <span aria-hidden className="text-lg leading-none">
        🔔
      </span>
      <div className="flex-1">
        {elig.status === "ready" && (
          <>
            <p className="text-foreground">{COPY[audience].ready}</p>
            {state === "error" && (
              <p className="mt-1 text-destructive">
                알림을 켜지 못했어요. 브라우저 알림 권한을 확인해 주세요.
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={onEnable}
                disabled={state === "working"}
              >
                {state === "working" ? "설정 중…" : "알림 받기"}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                나중에
              </Button>
            </div>
          </>
        )}

        {elig.status === "needs_home_screen" && (
          <p className="text-foreground">
            iPhone은 <b>공유 → 홈 화면에 추가</b> 후 알림을 받을 수 있어요.
            <button
              onClick={dismiss}
              className="ml-2 text-muted-foreground underline"
            >
              닫기
            </button>
          </p>
        )}

        {elig.status === "kakao_in_app" && (
          <p className="text-foreground">
            카카오톡 내장 브라우저에선 알림이 안 돼요. 오른쪽 위{" "}
            <b>⋯ → 다른 브라우저로 열기</b>(Safari·Chrome)로 접속해 주세요.
            <button
              onClick={dismiss}
              className="ml-2 text-muted-foreground underline"
            >
              닫기
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
