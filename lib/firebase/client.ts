import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

/**
 * Firebase 클라이언트 (브라우저) — FCM 웹푸시 옵트인용. SPEC §9.3.
 * 공개 설정(NEXT_PUBLIC_*)만 사용. 서버 발송은 lib/firebase/admin.ts(별개).
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseClientApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

/** 브라우저 + FCM 지원될 때만 Messaging 반환. SSR·미지원 환경은 null. */
export async function getClientMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  try {
    if (!(await isSupported())) return null;
    return getMessaging(firebaseClientApp());
  } catch {
    return null;
  }
}
