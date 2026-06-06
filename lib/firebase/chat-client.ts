"use client";
import {
  connectAuthEmulator,
  getAuth,
  signInWithCustomToken,
  type Auth,
} from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { firebaseClientApp } from "./client";
import type { ChatRole } from "@/lib/chat/access";

/**
 * 채팅 클라이언트 helper — 기존 Firebase client app(lib/firebase/client.ts)을 재사용.
 * 푸시(messaging)와 같은 app을 공유하며 새 service worker를 추가하지 않는다.
 * Firestore 경로: channels/{tripId}/messages/{messageId} (SPEC §6).
 */

export type ChatMessage = {
  id: string;
  text: string;
  senderRole: ChatRole;
  senderId: string;
  displayName: string;
  /** serverTimestamp 반영 전(pending write)에는 null일 수 있다. */
  createdAtMs: number | null;
};

/**
 * 로컬 에뮬레이터 사용 여부. 빌드/런타임 env로 게이트.
 * 미설정 → 실제 Firebase(프로덕션) 동작 그대로 유지.
 */
function shouldUseEmulator(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR);
}

// 에뮬레이터 연결은 app/SDK 핸들당 한 번만 (HMR·재마운트 시 재연결 예외 방지).
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

function chatAuth(): Auth {
  const auth = getAuth(firebaseClientApp());
  // 브라우저 + 플래그 ON일 때만, 그리고 한 번만 연결.
  if (
    typeof window !== "undefined" &&
    shouldUseEmulator() &&
    !authEmulatorConnected
  ) {
    authEmulatorConnected = true;
    connectAuthEmulator(auth, "http://localhost:9099", {
      disableWarnings: true,
    });
  }
  return auth;
}

function chatDb(): Firestore {
  const db = getFirestore(firebaseClientApp());
  if (
    typeof window !== "undefined" &&
    shouldUseEmulator() &&
    !firestoreEmulatorConnected
  ) {
    firestoreEmulatorConnected = true;
    connectFirestoreEmulator(db, "localhost", 8080);
  }
  return db;
}

/** Custom Token으로 채팅 세션 로그인. 이미 로그인돼 있으면 토큰으로 재인증. */
export async function signInToChat(token: string): Promise<void> {
  await signInWithCustomToken(chatAuth(), token);
}

/**
 * 메시지 실시간 구독. createdAt(serverTimestamp) 오름차순.
 * @returns unsubscribe 함수
 */
export function subscribeToMessages(
  tripId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
): () => void {
  const col = collection(chatDb(), "channels", tripId, "messages");
  const q = query(col, orderBy("createdAt", "asc"));

  return onSnapshot(
    q,
    (snap) => {
      const messages: ChatMessage[] = snap.docs.map((doc) => {
        const data = doc.data();
        const created = data.createdAt;
        return {
          id: doc.id,
          text: typeof data.text === "string" ? data.text : "",
          senderRole: data.senderRole === "operator" ? "operator" : "passenger",
          senderId: typeof data.senderId === "string" ? data.senderId : "",
          displayName:
            typeof data.displayName === "string" ? data.displayName : "",
          createdAtMs:
            created instanceof Timestamp ? created.toMillis() : null,
        };
      });
      onMessages(messages);
    },
    (err) => onError(err),
  );
}

/**
 * 메시지 전송. createdAt은 항상 서버 시간(serverTimestamp).
 * senderRole/senderId는 토큰 발급 응답(서버 권한)에서 받은 값을 그대로 사용.
 * 본문 검증은 호출 측(validateMessageText)에서 끝낸 text를 받는다.
 */
export async function sendChatMessage(
  tripId: string,
  payload: {
    text: string;
    senderRole: ChatRole;
    senderId: string;
    displayName: string;
  },
): Promise<void> {
  const col = collection(chatDb(), "channels", tripId, "messages");
  await addDoc(col, {
    text: payload.text,
    senderRole: payload.senderRole,
    senderId: payload.senderId,
    displayName: payload.displayName,
    createdAt: serverTimestamp(),
  });
}
