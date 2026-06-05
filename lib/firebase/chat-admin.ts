import "server-only";
import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Firebase Admin (server-only) — 채팅용 Custom Token 발급 전용.
 *
 * 푸시(lib/firebase/admin.ts, named app "bus-cignal-push")와 자격증명은 같지만,
 * named app을 분리("bus-cignal-chat")해 서로의 초기화를 덮어쓰지 않는다.
 * 두 파일은 같은 FIREBASE_ADMIN_* env를 공유하며, 각자 자기 named app만 관리한다.
 *
 * Admin private key는 코드·로그·응답·보고서 어디에도 출력하지 않는다.
 */
const APP_NAME = "bus-cignal-chat";

/** 채팅 Admin(Custom Token) 사용 가능 여부. 미설정 시 토큰 발급을 건너뛴다. */
export function isChatAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
}

function chatAdminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // 한 줄로 저장된 private key의 리터럴 `\n`을 실제 개행으로 복원.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin env 누락 — NEXT_PUBLIC_FIREBASE_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY 확인",
    );
  }

  return initializeApp(
    { credential: cert({ projectId, clientEmail, privateKey }) },
    APP_NAME,
  );
}

/** 채팅 Auth 핸들. 반드시 isChatAdminConfigured() 통과 후 호출. */
export function chatAuth(): Auth {
  return getAuth(chatAdminApp());
}
