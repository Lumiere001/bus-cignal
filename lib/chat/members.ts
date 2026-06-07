"use client";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import type { ChatRole } from "@/lib/chat/access";

/**
 * 채팅 멤버십 / 읽음 커서 helper (client). SPEC "Firestore (채팅)" · 설계 §3.3·§6.
 *
 * Firestore 경로: channels/{tripId}/members/{uid}
 *   uid = 토큰의 subjectId (== request.auth.token.subjectId, firestore.rules가 강제).
 *   문서 shape = { displayName, role, lastReadAt(serverTimestamp) }.
 *
 * 읽음(unread) 모델: per-user "마지막 읽은 시각" 커서 한 개.
 *   메시지별 read receipt가 아니라, "여기까지 읽음" 커서로 다운스코프(설계 §6.2).
 *   특정 메시지의 "안 읽은 사람 수" = (발신자 제외) members 중 lastReadAt < message.createdAt 인 수.
 *   카카오톡처럼 "아직 안 읽은 사람 수"를 표시한다.
 */

/** members 서브컬렉션의 한 멤버(입장한 사용자). */
export type ChatMember = {
  /** 문서 id = 토큰 subjectId. */
  uid: string;
  displayName: string;
  role: ChatRole;
  /** serverTimestamp 반영 전(pending write)에는 null일 수 있다. */
  lastReadAtMs: number | null;
};

/**
 * 본인 member 문서 upsert(입장 표시 + 읽음 커서 갱신).
 *   lastReadAt은 항상 서버 시각(serverTimestamp) — 룰이 == request.time 강제.
 *   best-effort: 호출 측에서 await하되 실패가 메시지 송수신을 막지 않도록 catch한다.
 */
export async function markRead(
  db: Firestore,
  tripId: string,
  member: { uid: string; displayName: string; role: ChatRole },
): Promise<void> {
  const ref = doc(db, "channels", tripId, "members", member.uid);
  await setDoc(
    ref,
    {
      displayName: member.displayName,
      role: member.role,
      lastReadAt: serverTimestamp(),
    },
    { merge: false },
  );
}

/**
 * 본인 member 문서가 이미 존재하는지(= 과거에 입장한 적 있는지) 확인.
 *   카톡식 "입장" 시스템 메시지를 **최초 입장에만** 1회 게시하기 위한 판정.
 *   반드시 markRead(입장 시 member 문서 생성) **전에** 호출해야 한다.
 *   조회 실패(권한·네트워크)는 false 취급 → 중복 입장 메시지보다 누락을 택함(best-effort).
 */
export async function memberExists(
  db: Firestore,
  tripId: string,
  uid: string,
): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "channels", tripId, "members", uid));
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * members 서브컬렉션 실시간 구독.
 * @returns unsubscribe 함수
 */
export function subscribeToMembers(
  db: Firestore,
  tripId: string,
  onMembers: (members: ChatMember[]) => void,
  onError: (error: Error) => void,
): () => void {
  const col = collection(db, "channels", tripId, "members");
  return onSnapshot(
    col,
    (snap) => {
      const members: ChatMember[] = snap.docs.map((d) => {
        const data = d.data();
        const lastRead = data.lastReadAt;
        return {
          uid: d.id,
          displayName:
            typeof data.displayName === "string" ? data.displayName : "",
          role: data.role === "operator" ? "operator" : "passenger",
          lastReadAtMs:
            lastRead instanceof Timestamp ? lastRead.toMillis() : null,
        };
      });
      onMembers(members);
    },
    (err) => onError(err),
  );
}

/**
 * 한 메시지를 "아직 읽지 않은" 멤버 수(카카오톡 읽음 수).
 *   - 발신자 본인은 제외.
 *   - lastReadAt이 없거나(아직 한 번도 읽음 처리 안 함) message.createdAt보다 과거면 "안 읽음".
 *   - message.createdAtMs가 null(pending write, 서버시각 미반영)이면 0 반환(아직 셀 수 없음).
 */
export function countUnread(
  members: ChatMember[],
  message: { senderId: string; createdAtMs: number | null },
): number {
  if (message.createdAtMs === null) return 0;
  let unread = 0;
  for (const m of members) {
    if (m.uid === message.senderId) continue; // 발신자 제외
    if (m.lastReadAtMs === null || m.lastReadAtMs < message.createdAtMs) {
      unread += 1;
    }
  }
  return unread;
}
