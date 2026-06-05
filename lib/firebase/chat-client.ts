"use client";
import { getAuth, signInWithCustomToken, type Auth } from "firebase/auth";
import {
  addDoc,
  collection,
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

function chatAuth(): Auth {
  return getAuth(firebaseClientApp());
}

function chatDb(): Firestore {
  return getFirestore(firebaseClientApp());
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
