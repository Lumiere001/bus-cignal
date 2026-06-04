import "server-only";
import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

/**
 * Firebase Admin (server-only) — FCM 웹푸시 발송 전용.
 *
 * 채팅(Firestore)도 같은 Firebase 프로젝트지만, 푸시 경로는 여기 messaging만 쓴다.
 * 향후 Firestore Admin이 별도 default app을 쓸 수 있으므로 named app으로 격리한다.
 *
 * env (FIREBASE_ADMIN_*) 미설정 환경(로컬·미구성 프리뷰)에서는 init을 시도하지 않는다.
 * 발송 호출자(deliverPushBatch)는 isPushConfigured()로 먼저 분기 → 미구성이면 no-op.
 */
const APP_NAME = "bus-cignal-push";

/** Firebase Admin env가 모두 설정됐는지. 미설정 시 푸시 발송을 건너뛴다(인앱은 무관). */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
}

function adminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Vercel/.env 에 한 줄로 저장된 private key의 `\n`(리터럴)을 실제 개행으로 복원.
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

/** FCM 메시징 핸들. 반드시 isPushConfigured() 통과 후 호출. */
export function pushMessaging(): Messaging {
  return getMessaging(adminApp());
}
