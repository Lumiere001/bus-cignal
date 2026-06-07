"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ChatRole } from "@/lib/chat/access";
import {
  MAX_MESSAGE_LENGTH,
  validateMessageText,
} from "@/lib/chat/message";
import {
  chatDb,
  sendChatMessage,
  signInToChat,
  subscribeToMessages,
  type ChatMessage,
} from "@/lib/firebase/chat-client";
import {
  countUnread,
  markRead,
  subscribeToMembers,
  type ChatMember,
} from "@/lib/chat/members";

type Props = {
  tripId: string;
};

type Phase =
  | "loading" // 토큰 발급 + 로그인 중
  | "ready" // 메시지 구독 정상
  | "forbidden" // 권한 없음(403)
  | "unconfigured" // Firebase Admin 미설정(503) — Rules 미배포 등
  | "error"; // 기타 실패

type Identity = {
  role: ChatRole;
  subjectId: string;
  displayName: string;
};

/** 토큰 재검증 주기(ms). 설계 §5 — claim 실시간 회수 불가 보완(Finding 1). */
const TOKEN_REVALIDATE_MS = 4 * 60 * 1000; // 4분

// ── KCCC 다크 테마 토큰 (이 채팅 화면에만 적용. globals.css 미변경) ──────────
const SURFACE = "#101013"; // 화면 배경(near-black)
const PANEL = "#16161a"; // 헤더/입력/타인 버블 패널
const PANEL_RAISED = "#1f1f25"; // 타인 메시지 버블
const TEXT = "#ECECEE"; // 본문
const MUTED = "#9a9aa2"; // 보조 텍스트
const VIOLET = "#7c3aed"; // 액센트(내 버블·읽음 수·액티브)
const BORDER = "#26262c";
const FONT_STACK = "Pretendard, -apple-system, system-ui, sans-serif";

/** 상태 화면(loading/forbidden/unconfigured/error) — 다크 테마. 모듈 스코프(렌더 중 컴포넌트 생성 금지). */
function StatusScreen({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-1 items-center justify-center p-6 text-center"
      style={{ backgroundColor: SURFACE, color: MUTED, fontFamily: FONT_STACK }}
    >
      <span className="text-sm">{children}</span>
    </div>
  );
}

/** Pretendard CDN — 이 화면에서만 로드(프로젝트 전역 폰트 미변경). */
const PRETENDARD_CDN =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.min.css";

// 아바타 색 팔레트 — displayName에서 결정적으로 선택(KCCC 톤 + 가독성).
const AVATAR_PALETTE = [
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#db2777",
  "#6d28d9",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx] ?? VIOLET;
}

function avatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // 첫 글자(한글/영문/이모지 안전). codePoint 단위로 첫 글자만.
  return Array.from(trimmed)[0] ?? "?";
}

function formatTime(ms: number | null): string {
  if (ms === null) return "전송 중…";
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const isPM = h >= 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${isPM ? "오후" : "오전"} ${h12}:${m}`;
}

/** 날짜 구분선 라벨 ("2026년 6월 7일"). createdAt 없으면 빈 문자열. */
function formatDateDivider(ms: number | null): string {
  if (ms === null) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 같은 날(로컬)인지 — 날짜 구분선 판단용. */
function isSameDay(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      className="flex size-9 shrink-0 select-none items-center justify-center rounded-2xl text-sm font-semibold text-white"
      style={{ backgroundColor: avatarColor(name) }}
    >
      {avatarInitial(name)}
    </div>
  );
}

function RoleBadge() {
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium"
      style={{
        backgroundColor: "rgba(124,58,237,0.18)",
        color: "#c4b5fd",
      }}
    >
      간사
    </span>
  );
}

export function ChatRoom({ tripId }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [membersOpen, setMembersOpen] = useState(false);
  // 방 푸시 음소거 상태. null = 미확정(로딩/권한없음) → 토글 숨김. (보안점검 Finding 3)
  const [muted, setMuted] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // identity/phase를 effect·비동기 콜백에서 최신값으로 읽기 위한 ref.
  // 렌더 중 ref 직접 대입 금지(react-hooks/refs) → effect에서 동기화.
  const identityRef = useRef<Identity | null>(null);
  const phaseRef = useRef<Phase>(phase);
  useEffect(() => {
    identityRef.current = identity;
    phaseRef.current = phase;
  }, [identity, phase]);

  // 활성 구독 unsubscribe 핸들 — 권한 상실(forbidden) 시 즉시 구독 중단용(Finding 1).
  const unsubscribersRef = useRef<{
    messages: (() => void) | null;
    members: (() => void) | null;
  }>({ messages: null, members: null });

  const stopSubscriptions = useCallback(() => {
    unsubscribersRef.current.messages?.();
    unsubscribersRef.current.members?.();
    unsubscribersRef.current = { messages: null, members: null };
  }, []);

  /** 본인 읽음 커서 upsert — best-effort(실패해도 채팅 흐름 안 막음). */
  const upsertRead = useCallback(() => {
    const id = identityRef.current;
    if (!id) return;
    void markRead(chatDb(), tripId, {
      uid: id.subjectId,
      displayName: id.displayName,
      role: id.role,
    }).catch(() => {
      // best-effort presence — 무시
    });
  }, [tripId]);

  // 방 푸시 음소거 상태 로드 — 세션만으로 서버가 권한·신원 판단(/api/chat/mute GET).
  //   Firebase와 독립 — 권한 없으면(403) muted=null 유지 → 토글 숨김.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/chat/mute?tripId=${encodeURIComponent(tripId)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { muted?: boolean };
        if (!cancelled) setMuted(Boolean(data.muted));
      } catch {
        // best-effort — 음소거 상태 조회 실패는 채팅에 영향 없음.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  // 음소거 토글 — 낙관적 갱신 후 POST(best-effort). 푸시만 끈다(인앱은 유지).
  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      if (prev === null) return prev; // 미확정이면 무시
      const next = !prev;
      void fetch("/api/chat/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, muted: next }),
      }).catch(() => {});
      return next;
    });
  }, [tripId]);

  // 토큰 발급 → Firebase 로그인 → 메시지·멤버 구독
  useEffect(() => {
    let cancelled = false;
    let unsubMessages: (() => void) | null = null;
    let unsubMembers: (() => void) | null = null;

    (async () => {
      try {
        const res = await fetch("/api/chat/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId }),
        });

        if (res.status === 403) {
          if (!cancelled) setPhase("forbidden");
          return;
        }
        if (res.status === 503) {
          if (!cancelled) setPhase("unconfigured");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setPhase("error");
          return;
        }

        const data = (await res.json()) as {
          token: string;
          role: ChatRole;
          subjectId: string;
          displayName: string;
        };
        if (cancelled) return;

        await signInToChat(data.token);
        if (cancelled) return;

        setIdentity({
          role: data.role,
          subjectId: data.subjectId,
          displayName: data.displayName,
        });

        // 입장 즉시 읽음 커서 upsert(입장 표시 + lastReadAt).
        upsertRead();

        // 권한 재검증으로 이미 forbidden이 됐으면 구독을 시작하지 않음.
        if (phaseRef.current === "forbidden") return;

        unsubMessages = subscribeToMessages(
          tripId,
          (msgs) => {
            if (cancelled) return;
            setMessages(msgs);
            setPhase("ready");
            // 탭이 포커스 상태면 새 메시지 도착 시 읽음 갱신.
            if (
              typeof document === "undefined" ||
              document.visibilityState === "visible"
            ) {
              upsertRead();
            }
          },
          () => {
            // Firestore 구독 실패(예: Rules 차단) — 입장은 됐으나 read 불가
            if (!cancelled) setPhase("unconfigured");
          },
        );

        // members(읽음 커서/입장자) 구독 — best-effort. 실패해도 채팅은 유지.
        unsubMembers = subscribeToMembers(
          chatDb(),
          tripId,
          (mem) => {
            if (!cancelled) setMembers(mem);
          },
          () => {
            // members read 실패는 채팅 phase에 영향 주지 않음(읽음 수만 비표시).
          },
        );

        // 외부(권한 재검증)에서 즉시 끊을 수 있도록 핸들 보관.
        unsubscribersRef.current = {
          messages: unsubMessages,
          members: unsubMembers,
        };
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      if (unsubMessages) unsubMessages();
      if (unsubMembers) unsubMembers();
      unsubscribersRef.current = { messages: null, members: null };
    };
  }, [tripId, upsertRead]);

  // Finding 1 — 토큰(권한) 재검증: 주기적 + 창 포커스 시 /api/chat/token 재호출.
  //   403이면 접근 권한 상실로 간주 → phase=forbidden (구독은 위 cleanup이 정리).
  //   토큰 라우트는 변경하지 않고 서버 resolveChatAccess를 SoT로 재사용.
  useEffect(() => {
    if (phase === "forbidden" || phase === "error") return;
    let cancelled = false;

    const revalidate = async () => {
      try {
        const res = await fetch("/api/chat/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId }),
        });
        if (cancelled) return;
        if (res.status === 403) {
          // 권한 상실 — 방에서 내보내고 실시간 구독을 즉시 중단.
          stopSubscriptions();
          setPhase("forbidden");
        }
        // 200/503/기타는 현 상태 유지(일시 오류로 강제 퇴장하지 않음).
      } catch {
        // 네트워크 일시 오류 — 다음 주기에 재시도.
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void revalidate();
    }, TOKEN_REVALIDATE_MS);

    const onFocus = () => {
      void revalidate();
      upsertRead(); // 포커스 복귀 시 읽음도 갱신.
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [tripId, phase, upsertRead, stopSubscriptions]);

  // 새 메시지 도착 시 맨 아래로 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (sending || !identity) return;
    const result = validateMessageText(draft);
    if (!result.ok) {
      setSendError(
        result.reason === "empty"
          ? "메시지를 입력해 주세요."
          : `메시지는 ${MAX_MESSAGE_LENGTH}자까지 보낼 수 있어요.`,
      );
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      await sendChatMessage(tripId, {
        text: result.text,
        senderRole: identity.role,
        senderId: identity.subjectId,
        displayName: identity.displayName,
      });
      setDraft("");
      // 보낸 사람은 방금 다 읽은 상태 → 읽음 커서 갱신(best-effort).
      upsertRead();
      // 알림 발송은 secondary — fire-and-forget. UI를 막지도, 오류를 노출하지도 않는다.
      // 메시지 자체는 위에서 이미 Firestore에 전송됨. 실패해도 채팅에 영향 없음.
      void fetch("/api/chat/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      }).catch(() => {});
    } catch {
      setSendError("메시지 전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  }

  if (phase === "loading") {
    return <StatusScreen>채팅을 불러오는 중…</StatusScreen>;
  }
  if (phase === "forbidden") {
    return <StatusScreen>이 채팅방에 입장할 수 없어요.</StatusScreen>;
  }
  if (phase === "unconfigured") {
    return (
      <StatusScreen>
        채팅이 아직 준비 중이에요. 잠시 후 다시 시도해 주세요.
      </StatusScreen>
    );
  }
  if (phase === "error") {
    return (
      <StatusScreen>
        채팅 연결에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.
      </StatusScreen>
    );
  }

  // ── ready — KakaoTalk 스타일 렌더 ────────────────────────────────────────
  const mineOf = (m: ChatMessage): boolean =>
    identity
      ? m.senderRole === identity.role && m.senderId === identity.subjectId
      : false;

  return (
    <>
      {/* Pretendard 폰트 — 이 화면에서만 로드(전역 폰트 미변경) */}
      <link rel="stylesheet" href={PRETENDARD_CDN} />

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ backgroundColor: SURFACE, color: TEXT, fontFamily: FONT_STACK }}
      >
        {/* 멤버 바 — N명 + 입장자 목록 토글 (입장 프로필 표시) */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderBottom: `1px solid ${BORDER}` }}
        >
          <button
            type="button"
            onClick={() => setMembersOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: MUTED }}
            aria-expanded={membersOpen}
          >
            <span aria-hidden>👥</span>
            <span>{members.length}명</span>
            <span aria-hidden style={{ color: MUTED }}>
              {membersOpen ? "▲" : "▼"}
            </span>
          </button>

          {/* 푸시 음소거 토글 — 이 방 알림만 끔(인앱은 유지). 미확정 시 숨김. */}
          {muted !== null && (
            <button
              type="button"
              onClick={toggleMute}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-xs"
              style={{ color: muted ? MUTED : VIOLET }}
              aria-pressed={muted}
              aria-label={
                muted ? "이 채팅방 푸시 알림 켜기" : "이 채팅방 푸시 알림 끄기"
              }
            >
              <span aria-hidden>{muted ? "🔕" : "🔔"}</span>
              <span>{muted ? "알림 꺼짐" : "알림 켜짐"}</span>
            </button>
          )}
        </div>

        {/* 입장자(멤버) 패널 — 펼침 시 */}
        {membersOpen && (
          <div
            className="max-h-48 overflow-y-auto px-3 py-2"
            style={{ backgroundColor: PANEL, borderBottom: `1px solid ${BORDER}` }}
          >
            {members.length === 0 ? (
              <p className="px-1 py-2 text-xs" style={{ color: MUTED }}>
                아직 입장한 사람이 없어요.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {members.map((mem) => (
                  <li key={mem.uid} className="flex items-center gap-2 px-1 py-1">
                    <Avatar name={mem.displayName} />
                    <span className="text-sm" style={{ color: TEXT }}>
                      {mem.displayName || "이름 없음"}
                    </span>
                    {mem.role === "operator" && <RoleBadge />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 메시지 목록 */}
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <span className="text-sm" style={{ color: MUTED }}>
                아직 메시지가 없어요. 먼저 인사를 건네보세요.
              </span>
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = mineOf(m);
              const prev = i > 0 ? messages[i - 1] : null;
              const next = i < messages.length - 1 ? messages[i + 1] : null;

              // 날짜 구분선 — 이전 메시지와 날짜가 다르면 위에 삽입.
              const showDateDivider =
                i === 0 || !isSameDay(prev?.createdAtMs ?? null, m.createdAtMs);

              // 연속 그룹핑 — 같은 발신자가 연속이면 묶음.
              const sameSenderAsPrev =
                prev !== null &&
                prev.senderId === m.senderId &&
                prev.senderRole === m.senderRole &&
                !showDateDivider;
              const sameSenderAsNext =
                next !== null &&
                next.senderId === m.senderId &&
                next.senderRole === m.senderRole &&
                isSameDay(next.createdAtMs, m.createdAtMs);

              const isGroupStart = !sameSenderAsPrev;
              const isGroupEnd = !sameSenderAsNext;

              // 읽음 수(안 읽은 사람 수) — 0이면 숨김.
              const unread = countUnread(members, {
                senderId: m.senderId,
                createdAtMs: m.createdAtMs,
              });

              return (
                <div key={m.id}>
                  {showDateDivider && (
                    <div className="my-3 flex items-center justify-center">
                      <span
                        className="rounded-full px-3 py-1 text-[0.7rem]"
                        style={{ backgroundColor: PANEL, color: MUTED }}
                      >
                        {formatDateDivider(m.createdAtMs)}
                      </span>
                    </div>
                  )}

                  <div
                    className={`flex gap-2 ${
                      mine ? "flex-row-reverse" : "flex-row"
                    } ${isGroupStart ? "mt-2" : "mt-0.5"}`}
                  >
                    {/* 타인: 그룹 시작에만 아바타, 이어지는 버블은 공간만 */}
                    {!mine &&
                      (isGroupStart ? (
                        <Avatar name={m.displayName} />
                      ) : (
                        <div className="size-9 shrink-0" aria-hidden />
                      ))}

                    <div
                      className={`flex max-w-[75%] flex-col ${
                        mine ? "items-end" : "items-start"
                      }`}
                    >
                      {/* 타인 그룹 시작: 이름 + 간사 배지 */}
                      {!mine && isGroupStart && (
                        <div className="mb-1 flex items-center gap-1.5 px-1">
                          <span className="text-xs" style={{ color: MUTED }}>
                            {m.displayName || "이름 없음"}
                          </span>
                          {m.senderRole === "operator" && <RoleBadge />}
                        </div>
                      )}

                      <div
                        className={`flex items-end gap-1.5 ${
                          mine ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        <div
                          className="px-3.5 py-2 text-sm break-words whitespace-pre-wrap"
                          style={{
                            backgroundColor: mine ? VIOLET : PANEL_RAISED,
                            color: mine ? "#ffffff" : TEXT,
                            // 카카오톡 톤: 말풍선 모서리, 그룹 위치에 따라 살짝 변형
                            borderRadius: mine
                              ? isGroupStart
                                ? "16px 16px 4px 16px"
                                : "16px 4px 4px 16px"
                              : isGroupStart
                                ? "16px 16px 16px 4px"
                                : "4px 16px 16px 4px",
                          }}
                        >
                          {m.text}
                        </div>

                        {/* 읽음 수 + 시각 (그룹 마지막 버블에만 시각) */}
                        <div
                          className={`flex shrink-0 flex-col text-[0.62rem] leading-tight ${
                            mine ? "items-end" : "items-start"
                          }`}
                        >
                          {unread > 0 && (
                            <span
                              className="font-semibold"
                              style={{ color: VIOLET }}
                            >
                              {unread}
                            </span>
                          )}
                          {isGroupEnd && (
                            <span style={{ color: MUTED }}>
                              {formatTime(m.createdAtMs)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력 영역 */}
        <div
          className="px-3 py-3"
          style={{ backgroundColor: PANEL, borderTop: `1px solid ${BORDER}` }}
        >
          {sendError && (
            <p className="mb-2 px-1 text-xs" style={{ color: "#f87171" }}>
              {sendError}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH * 2}
              placeholder="메시지를 입력하세요"
              className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: SURFACE,
                color: TEXT,
                border: `1px solid ${BORDER}`,
                fontFamily: FONT_STACK,
              }}
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || draft.trim().length === 0}
              className="shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: VIOLET }}
            >
              {sending ? "전송 중" : "전송"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
