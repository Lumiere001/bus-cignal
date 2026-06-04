"use client";
import { deleteToken, getToken } from "firebase/messaging";
import { getClientMessaging } from "@/lib/firebase/client";

/**
 * 푸시 옵트인/해제 (브라우저). SPEC §9.3 · §S5.
 *  - enablePush: 권한 요청 → SW 등록 → FCM 토큰 발급 → POST /api/push/subscribe
 *  - disablePush: 토큰 삭제 → DELETE /api/push/subscribe
 * 소유자(간사/학생)는 서버가 세션으로 판단 — 클라이언트는 토큰만 보냄.
 */

const SW_URL = "/firebase-messaging-sw.js";

function vapidKey(): string | undefined {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
}

export type EnableResult = {
  ok: boolean;
  reason?: "unsupported" | "denied" | "no_token" | "server";
};

export async function enablePush(): Promise<EnableResult> {
  const messaging = await getClientMessaging();
  if (!messaging) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const registration = await navigator.serviceWorker.register(SW_URL, {
    scope: "/",
  });
  const token = await getToken(messaging, {
    vapidKey: vapidKey(),
    serviceWorkerRegistration: registration,
  });
  if (!token) return { ok: false, reason: "no_token" };

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, userAgent: navigator.userAgent }),
  });
  return res.ok ? { ok: true } : { ok: false, reason: "server" };
}

export async function disablePush(): Promise<void> {
  const messaging = await getClientMessaging();
  if (!messaging) return;
  try {
    const registration =
      await navigator.serviceWorker.getRegistration(SW_URL);
    const token = await getToken(messaging, {
      vapidKey: vapidKey(),
      serviceWorkerRegistration: registration ?? undefined,
    });
    if (token) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      await deleteToken(messaging);
    }
  } catch {
    // best-effort — 해제 실패해도 서버 토큰은 무효 발송 시 자동 정리됨
  }
}
