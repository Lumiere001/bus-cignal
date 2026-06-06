import Link from "next/link";
import {
  getChatTripHeader,
  resolveChatAccess,
} from "@/lib/chat/access";
import { DIRECTION_SHORT } from "@/lib/labels";
import { ChatRoom } from "@/components/chat/ChatRoom";

/** trips.direction('up'|'down') → '상행'|'하행'. 알 수 없는 값은 빈 문자열. */
function directionShort(direction: string): string {
  return direction === "up" || direction === "down"
    ? DIRECTION_SHORT[direction]
    : "";
}

type Props = {
  params: Promise<{ tripId: string }>;
};

function formatDeparture(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${month}월 ${date}일 ${h}:${m}`;
}

export default async function ChatPage({ params }: Props) {
  const { tripId } = await params;

  // ★ 서버에서 권한 검증 — 권한 없으면 Trip 상세/메시지를 절대 노출하지 않음
  const access = await resolveChatAccess(tripId);
  if (!access) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted-foreground text-sm">
          이 채팅방에 접근할 수 없어요.
        </p>
        <Link
          href="/"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          처음으로 돌아가기
        </Link>
      </main>
    );
  }

  const header = await getChatTripHeader(tripId);

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-1 flex-col">
      {/* 헤더 — 노선·출발 시각 (Trip 식별 정보) */}
      <header className="flex items-center gap-3 border-b p-3">
        <Link
          href={access.role === "operator" ? "/operator" : "/me"}
          aria-label="뒤로"
          className="text-muted-foreground hover:text-foreground shrink-0 text-sm"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {header
              ? `${header.originLabel} → ${header.destinationLabel}${
                  directionShort(header.direction)
                    ? ` ${directionShort(header.direction)} 버스 채팅`
                    : " 버스 채팅"
                }`
              : "버스 채팅"}
          </p>
          {header && (
            <p className="text-muted-foreground truncate text-xs">
              출발 시각: {formatDeparture(header.departureAt)}
            </p>
          )}
        </div>
      </header>

      {/* 채팅 본체 (client) */}
      <ChatRoom tripId={tripId} />
    </main>
  );
}
