"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * PWA 설치 권장 배너 — 첫 방문자에게 "홈 화면에 추가(앱 설치)"를 권한다. SPEC §4.5·§13.
 *
 * 플랫폼별 한계 때문에 한 가지 방식으로 통일 불가:
 *  - Android/Chromium: `beforeinstallprompt`를 가로채 두었다가 버튼 클릭 시 네이티브 설치창(prompt()).
 *  - iOS Safari: 프로그램적 설치 불가 → "공유 → 홈 화면에 추가" 안내만 표시.
 *  - 이미 설치(standalone)·설치 직후·"닫기" 누른 경우엔 표시하지 않음.
 *
 * 상태(localStorage `bc_install_prompt`): "dismissed" | "installed" → 영구 숨김.
 * 루트 레이아웃에 1회 마운트(앱 전역). 서버 렌더 영향 없음(클라이언트에서만 표시 판단).
 */

const STORAGE_KEY = "bc_install_prompt";

// Chrome의 beforeinstallprompt 이벤트 — 표준 타입에 아직 없어 직접 좁혀 쓴다.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "hidden" | "android" | "ios";

function alreadyHandled(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "dismissed" || v === "installed";
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua);
  // iOS의 다른 브라우저(Chrome=CriOS 등)도 결국 WebKit이고 추가 동선은 같다.
  return iOS;
}

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    // 이미 설치(standalone)했거나 한 번 처리("닫기"/설치)했으면 아무것도 안 한다.
    if (isStandalone() || alreadyHandled()) return;

    let cancelled = false;

    // Android/Chromium: 설치 가능해지면 이벤트가 뜬다 → 기본 미니바 막고 우리 배너로.
    //   "나중에"로 닫은 뒤 같은 세션에 이벤트가 재발생해도 다시 띄우지 않는다.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (alreadyHandled()) return;
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    // 설치되면 배너 숨기고 다시 안 뜨게.
    const onInstalled = () => {
      try {
        localStorage.setItem(STORAGE_KEY, "installed");
      } catch {
        /* noop */
      }
      setMode("hidden");
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS는 beforeinstallprompt가 없으므로 안내 배너를 직접 띄운다.
    // (effect 동기 본문 밖에서 setState — 마운트 직후 1회.)
    void Promise.resolve().then(() => {
      if (!cancelled && isIosSafari()) setMode("ios");
    });

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      /* noop */
    }
    setMode("hidden");
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        try {
          localStorage.setItem(STORAGE_KEY, "installed");
        } catch {
          /* noop */
        }
      }
    } catch {
      /* 사용자가 닫았거나 브라우저가 거부 — 배너만 닫는다 */
    } finally {
      setMode("hidden");
      setDeferred(null);
    }
  }, [deferred]);

  if (mode === "hidden") return null;

  return (
    // 상단 고정 — 하단에 있는 기본 액션 버튼(예: '본인 확인')을 가리지 않도록.
    <div
      className="fixed inset-x-0 top-0 z-50 flex justify-center p-3"
      role="dialog"
      aria-label="앱 설치 안내"
    >
      <div className="bg-background w-full max-w-md rounded-2xl border p-4 shadow-lg">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">
              Bus Cignal 앱으로 설치하기
            </p>
            {mode === "android" ? (
              <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                홈 화면에 추가하면 앱처럼 빠르게 열고 알림도 받을 수 있어요.
              </p>
            ) : (
              <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                홈 화면에 추가하면 앱처럼 쓸 수 있어요. Safari 하단의{" "}
                <b>공유 버튼</b> → <b>‘홈 화면에 추가’</b>를 눌러주세요.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={dismiss}>
            나중에
          </Button>
          {mode === "android" && (
            <Button type="button" size="sm" onClick={install}>
              설치하기
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
