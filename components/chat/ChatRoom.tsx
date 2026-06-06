"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChatRole } from "@/lib/chat/access";
import {
  MAX_MESSAGE_LENGTH,
  validateMessageText,
} from "@/lib/chat/message";
import {
  sendChatMessage,
  signInToChat,
  subscribeToMessages,
  type ChatMessage,
} from "@/lib/firebase/chat-client";

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

function formatTime(ms: number | null): string {
  if (ms === null) return "전송 중…";
  const d = new Date(ms);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function ChatRoom({ tripId }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 토큰 발급 → Firebase 로그인 → 메시지 구독
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

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

        unsubscribe = subscribeToMessages(
          tripId,
          (msgs) => {
            if (!cancelled) {
              setMessages(msgs);
              setPhase("ready");
            }
          },
          () => {
            // Firestore 구독 실패(예: Rules 차단) — 입장은 됐으나 read 불가
            if (!cancelled) setPhase("unconfigured");
          },
        );
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [tripId]);

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
    } catch {
      setSendError("메시지 전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <span className="text-muted-foreground text-sm">채팅을 불러오는 중…</span>
      </div>
    );
  }

  if (phase === "forbidden") {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <span className="text-muted-foreground text-sm">
          이 채팅방에 입장할 수 없어요.
        </span>
      </div>
    );
  }

  if (phase === "unconfigured") {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <span className="text-muted-foreground text-sm">
          채팅이 아직 준비 중이에요. 잠시 후 다시 시도해 주세요.
        </span>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <span className="text-muted-foreground text-sm">
          채팅 연결에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* 메시지 목록 */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-muted-foreground text-sm">
              아직 메시지가 없어요. 먼저 인사를 건네보세요.
            </span>
          </div>
        ) : (
          messages.map((m) => {
            const mine = identity
              ? m.senderRole === identity.role &&
                m.senderId === identity.subjectId
              : false;
            return (
              <div
                key={m.id}
                className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}
              >
                {!mine && (
                  <span className="text-muted-foreground px-1 text-xs">
                    {m.displayName}
                    {m.senderRole === "operator" && " · 간사"}
                  </span>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-muted-foreground px-1 text-[0.65rem]">
                  {formatTime(m.createdAtMs)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <div className="border-t p-3">
        {sendError && (
          <p className="text-destructive mb-2 px-1 text-xs">{sendError}</p>
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
            className="border-input bg-background focus-visible:ring-ring/50 max-h-28 min-h-9 flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          />
          <Button
            type="button"
            size="default"
            onClick={() => void handleSend()}
            disabled={sending || draft.trim().length === 0}
          >
            {sending ? "전송 중" : "전송"}
          </Button>
        </div>
      </div>
    </div>
  );
}
