"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { enablePush } from "@/lib/push/client";
import { evaluatePushEnv, type PushEligibility } from "@/lib/push/eligibility";

/**
 * 채팅방 알림 옵트인 프롬프트 — 채팅방 상단 nudge.
 *
 * push-optin-banner의 적격성 흐름(detectEligibility / hasVapidKey / runEnable)을
 * 재사용하되, 채팅(다크 테마)에 맞춘 컴팩트한 카드로 렌더한다. props 없음(self-contained).
 *
 * 상태(localStorage):
 *  - `bc_chat_notify:dismissed` === "1"  → 영구 숨김
 *  - `bc_chat_notify:enabled`   === "1"  → 옵트인 완료, 숨김
 *
 * 숨김 조건:
 *  - eligibility unsupported
 *  - Notification.permission === "granted" (이미 켜짐)
 *  - dismissed 플래그
 */

const DISMISS_KEY = "bc_chat_notify:dismissed";
const ENABLED_KEY = "bc_chat_notify:enabled";

type State = "idle" | "working" | "denied" | "error";

// ── 다크 채팅 테마 토큰 ──────────────────────────────────────────────────────
const FONT =
  "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif";
const COLORS = {
  panel: "#16161a",
  raised: "#1f1f25",
  border: "#26262c",
  text: "#ECECEE",
  muted: "#9a9aa2",
  accent: "#7c3aed",
} as const;

function hasVapidKey(): boolean {
  return !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
}

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

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage 차단 환경 — noop */
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** enablePush를 try/catch로 감싸 절대 throw하지 않게 + denied 선판별. 성공 시 "idle"(→ 호출부가 숨김). */
async function runEnable(): Promise<"idle" | "denied" | "error"> {
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "denied"
    ) {
      // 이미 거절 → 브라우저가 권한창을 다시 안 띄움 → 설정 안내로 유도.
      return "denied";
    }
    if (!hasVapidKey()) return "error";
    const r = await enablePush();
    if (r.ok) return "idle";
    if (r.reason === "denied") return "denied";
    return "error";
  } catch {
    return "error";
  }
}

// ── styles ───────────────────────────────────────────────────────────────────
const card: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px 12px",
  padding: "8px 12px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.panel,
  color: COLORS.text,
  fontFamily: FONT,
  fontSize: 13,
  lineHeight: 1.45,
};

const msg: CSSProperties = {
  flex: "1 1 220px",
  minWidth: 0,
  margin: 0,
  fontSize: 12.5,
  color: COLORS.text,
};

const actions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
};

const enableBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  borderRadius: 8,
  padding: "6px 12px",
  background: COLORS.accent,
  color: "#fff",
  fontFamily: FONT,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const enableBtnDisabled: CSSProperties = {
  ...enableBtn,
  opacity: 0.6,
  cursor: "default",
};

const tinyBtn: CSSProperties = {
  appearance: "none",
  border: "none",
  background: "transparent",
  color: COLORS.muted,
  fontFamily: FONT,
  fontSize: 12,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
  whiteSpace: "nowrap",
};

const noteText: CSSProperties = {
  flex: "1 1 220px",
  minWidth: 0,
  margin: 0,
  fontSize: 12.5,
  color: COLORS.muted,
};

const errText: CSSProperties = {
  flexBasis: "100%",
  margin: 0,
  fontSize: 12,
  color: "#f0a0a0",
};

export function ChatNotifyPrompt() {
  const [mounted, setMounted] = useState(false);
  const [elig, setElig] = useState<PushEligibility | null>(null);
  const [state, setState] = useState<State>("idle");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      // 이미 옵트인 완료 / 권한 granted / 명시 dismiss → 숨김
      if (readFlag(ENABLED_KEY) || readFlag(DISMISS_KEY)) {
        setHidden(true);
        setMounted(true);
        return;
      }
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
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
  }, []);

  if (!mounted || hidden || !elig) return null;
  if (elig.status === "unsupported") return null;

  function dismiss() {
    write(DISMISS_KEY, "1");
    setHidden(true);
  }

  async function onEnable() {
    setState("working");
    const next = await runEnable();
    if (next === "idle") {
      write(ENABLED_KEY, "1");
      setHidden(true);
      return;
    }
    setState(next);
  }

  // ── ready: 알림 켜기 버튼 (VAPID 있을 때) ─────────────────────────────────
  if (elig.status === "ready") {
    if (!hasVapidKey()) {
      return (
        <div style={card} role="region" aria-label="채팅 알림 안내">
          <p style={noteText}>
            <span aria-hidden>🔔</span> 알림 설정은 준비 중이에요.
          </p>
          <div style={actions}>
            <button type="button" style={tinyBtn} onClick={dismiss}>
              닫기
            </button>
          </div>
        </div>
      );
    }

    const working = state === "working";
    return (
      <div style={card} role="region" aria-label="채팅 알림 안내">
        <p style={msg}>
          <span aria-hidden>🔔</span> 채팅 알림을 켜면 새 메시지를 바로 확인할 수
          있어요. <span style={{ color: COLORS.muted }}>(꺼두면 메시지를 놓칠 수
          있어요)</span>
        </p>
        <div style={actions}>
          <button
            type="button"
            style={working ? enableBtnDisabled : enableBtn}
            onClick={onEnable}
            disabled={working}
            aria-label="채팅 푸시 알림 켜기"
          >
            {working ? "켜는 중…" : "알림 켜기"}
          </button>
          <button type="button" style={tinyBtn} onClick={dismiss}>
            나중에
          </button>
        </div>
        {state === "denied" && (
          <p style={errText}>
            브라우저 설정에서 이 사이트의 알림을 허용해 주세요.
          </p>
        )}
        {state === "error" && (
          <p style={errText}>알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.</p>
        )}
      </div>
    );
  }

  // ── needs_home_screen: iPhone 홈 화면 추가 안내 ──────────────────────────
  if (elig.status === "needs_home_screen") {
    return (
      <div style={card} role="region" aria-label="채팅 알림 안내">
        <p style={msg}>
          <span aria-hidden>📱</span> iPhone은 공유 → ‘홈 화면에 추가’ 후 알림을
          받을 수 있어요.
        </p>
        <div style={actions}>
          <button type="button" style={tinyBtn} onClick={dismiss}>
            나중에
          </button>
        </div>
      </div>
    );
  }

  // ── kakao_in_app: 외부 브라우저로 열기 안내 ──────────────────────────────
  if (elig.status === "kakao_in_app") {
    return (
      <div style={card} role="region" aria-label="채팅 알림 안내">
        <p style={msg}>
          <span aria-hidden>🔔</span> 카카오톡 안에서는 알림이 안 와요. 오른쪽 위
          ⋯ → ‘다른 브라우저로 열기’(Safari·Chrome)로 접속하면 채팅 알림을 받을 수
          있어요.
        </p>
        <div style={actions}>
          <button type="button" style={tinyBtn} onClick={dismiss}>
            나중에
          </button>
        </div>
      </div>
    );
  }

  return null;
}
