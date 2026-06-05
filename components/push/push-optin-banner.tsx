"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { enablePush } from "@/lib/push/client";
import { evaluatePushEnv, type PushEligibility } from "@/lib/push/eligibility";

/**
 * 푸시 옵트인 배너 v2 — SPEC §S5(학생 옵션 C)·§9.3·§13.
 *
 * 설치(홈 화면 추가) + 알림을 함께 안내. 학생(`/me` paid)·간사 공용.
 * 상태(localStorage `bc_push_optin:<audience>`):
 *  - "enabled"            → 옵트인 완료, 영구 숨김
 *  - "dismissed"          → "다시 보지 않기", 영구 숨김
 *  - "snooze:<ms>"        → "나중에", 24h 숨김 (출발 24h 이내면 재표시)
 * 방어: VAPID 키 없음 → "준비 중" 안내 / 권한 denied → 브라우저 설정 안내 / 실행 중 예외 → UI 보존.
 */

type Audience = "passenger" | "operator";
type State = "idle" | "working" | "enabled" | "error" | "denied";

const COPY: Record<Audience, string> = {
  passenger:
    "출발·장소·시간 변경 안내를 알림으로 받아보세요. 홈 화면에 추가하면 앱처럼 편하게 쓸 수 있어요.",
  operator:
    "신청·매칭·송금 알림을 받아보세요. 홈 화면에 추가하면 앱처럼 편하게 쓸 수 있어요.",
};

const STORAGE_PREFIX = "bc_push_optin:";
const SNOOZE_MS = 24 * 60 * 60 * 1000; // "나중에" = 24시간 숨김
const DEPART_OVERRIDE_MS = 24 * 60 * 60 * 1000; // 출발 24h 이내면 스누즈여도 재표시

function hasVapidKey(): boolean {
  return !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
}

function detectEligibility(): PushEligibility {
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return evaluatePushEnv({
    userAgent: window.navigator.userAgent,
    isStandalone,
    hasNotification: "Notification" in window,
    hasServiceWorker: "serviceWorker" in window.navigator,
    hasPushManager: "PushManager" in window,
  });
}

type Saved =
  | { kind: "enabled" | "dismissed" | "none" }
  | { kind: "snoozed"; until: number };

function readSaved(key: string): Saved {
  try {
    const v = localStorage.getItem(key);
    if (v === "enabled" || v === "dismissed") return { kind: v };
    if (v && v.startsWith("snooze:")) {
      const until = Number(v.slice("snooze:".length));
      if (Number.isFinite(until)) return { kind: "snoozed", until };
    }
  } catch {
    /* localStorage 차단 환경 — 기본 표시 */
  }
  return { kind: "none" };
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

/** enablePush를 try/catch로 감싸 절대 throw하지 않게 + denied 선판별. */
async function runEnable(): Promise<Exclude<State, "idle" | "working">> {
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "denied"
    ) {
      // 이미 거절된 경우 브라우저가 권한창을 다시 안 띄움 → 설정 안내로 유도.
      return "denied";
    }
    if (!hasVapidKey()) return "error";
    const r = await enablePush();
    if (r.ok) return "enabled";
    if (r.reason === "denied") return "denied";
    return "error";
  } catch {
    return "error";
  }
}

function DeniedOrError({ state }: { state: State }) {
  if (state === "denied") {
    return (
      <p className="mt-1 text-destructive">
        알림이 차단돼 있어요. 브라우저 설정에서 이 사이트의 알림을 다시 허용해 주세요.
      </p>
    );
  }
  if (state === "error") {
    return (
      <p className="mt-1 text-destructive">
        알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 큰 배너 — proactive. 나중에(24h)/다시 보지 않기(영구). 출발 24h 이내 재표시.
// ─────────────────────────────────────────────────────────────────────────────
export function PushOptInBanner({
  audience = "passenger",
  departureAt,
  className,
}: {
  audience?: Audience;
  /** 가장 임박한 예약 출발 시각(ISO). 24h 이내면 스누즈여도 재표시. */
  departureAt?: string | null;
  className?: string;
}) {
  const storageKey = STORAGE_PREFIX + audience;
  const [mounted, setMounted] = useState(false);
  const [elig, setElig] = useState<PushEligibility | null>(null);
  const [state, setState] = useState<State>("idle");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const saved = readSaved(storageKey);
      const now = Date.now();
      const departMs = departureAt ? new Date(departureAt).getTime() : NaN;
      const departSoon =
        Number.isFinite(departMs) &&
        departMs > now &&
        departMs - now <= DEPART_OVERRIDE_MS;

      // 옵트인 완료·명시 거절 → 영구 숨김 (출발 임박해도 존중)
      if (saved.kind === "enabled" || saved.kind === "dismissed") {
        setHidden(true);
        setMounted(true);
        return;
      }
      // 스누즈 중 → 숨김. 단 출발 24h 이내면 재표시
      if (saved.kind === "snoozed" && now < saved.until && !departSoon) {
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
  }, [storageKey, departureAt]);

  if (!mounted || hidden || !elig) return null;
  if (elig.status === "unsupported") return null;

  function snooze() {
    write(storageKey, "snooze:" + (Date.now() + SNOOZE_MS));
    setHidden(true);
  }
  function dismiss() {
    write(storageKey, "dismissed");
    setHidden(true);
  }
  async function onEnable() {
    setState("working");
    const next = await runEnable();
    if (next === "enabled") {
      write(storageKey, "enabled");
      setHidden(true);
    }
    setState(next);
  }

  const base =
    "flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm";
  const wrap = className ? `${base} ${className}` : base;

  return (
    <div className={wrap} role="region" aria-label="알림 설정 안내">
      <span aria-hidden className="text-lg leading-none">
        🔔
      </span>
      <div className="flex-1">
        {elig.status === "ready" &&
          (hasVapidKey() ? (
            <>
              <p className="text-foreground">{COPY[audience]}</p>
              <DeniedOrError state={state} />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={onEnable} disabled={state === "working"}>
                  {state === "working" ? "설정 중…" : "알림 설정"}
                </Button>
                <Button size="sm" variant="ghost" onClick={snooze}>
                  나중에
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  다시 보지 않기
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              알림 설정은 준비 중이에요.
              <button onClick={dismiss} className="ml-2 underline">
                닫기
              </button>
            </p>
          ))}

        {elig.status === "needs_home_screen" && (
          <p className="text-foreground">
            iPhone은 <b>공유 → 홈 화면에 추가</b> 후 알림을 받을 수 있어요.
            <button onClick={snooze} className="ml-2 text-muted-foreground underline">
              나중에
            </button>
          </p>
        )}

        {elig.status === "kakao_in_app" && (
          <p className="text-foreground">
            카카오톡 내장 브라우저에선 알림이 안 돼요. 오른쪽 위{" "}
            <b>⋯ → 다른 브라우저로 열기</b>(Safari·Chrome)로 접속해 주세요.
            <button onClick={snooze} className="ml-2 text-muted-foreground underline">
              나중에
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 작은 재진입 링크 — 배너를 숨긴(나중에/다시 보지 않기) 뒤에도 켤 수 있게.
// ─────────────────────────────────────────────────────────────────────────────
export function PushSettingsLink({
  audience = "passenger",
  className,
}: {
  audience?: Audience;
  className?: string;
}) {
  const storageKey = STORAGE_PREFIX + audience;
  const [mounted, setMounted] = useState(false);
  const [elig, setElig] = useState<PushEligibility | null>(null);
  const [savedKind, setSavedKind] = useState<Saved["kind"]>("none");
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setSavedKind(readSaved(storageKey).kind);
      setElig(detectEligibility());
      setMounted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  if (!mounted || !elig) return null;
  // 이미 옵트인 완료 → 링크 숨김. 배너가 아직 떠 있는 상태(none)에서도 중복 방지로 숨김.
  if (state === "enabled" || savedKind === "enabled" || savedKind === "none")
    return null;
  // 켤 수 있는 환경(ready + VAPID)에서만 재진입 제공.
  if (elig.status !== "ready" || !hasVapidKey()) return null;

  async function onEnable() {
    setState("working");
    const next = await runEnable();
    if (next === "enabled") write(storageKey, "enabled");
    setState(next);
  }

  return (
    <div className={className}>
      <button
        onClick={onEnable}
        disabled={state === "working"}
        className="text-sm text-blue-600 underline disabled:text-muted-foreground"
      >
        🔔 {state === "working" ? "설정 중…" : "알림 설정 켜기"}
      </button>
      <DeniedOrError state={state} />
    </div>
  );
}
