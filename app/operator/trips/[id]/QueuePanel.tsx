"use client";

import { useState } from "react";
import { MatchingQueue, type QueueRequest } from "./MatchingQueue";
import { TimeSortedQueue, type FlatPassenger } from "./TimeSortedQueue";

type View = "time" | "region";

/**
 * 대기 큐 뷰 전환 — 시간순(메인) ↔ 지구별.
 *  · 시간순: 지구를 가로질러 학생 개개인을 신청 시각으로 정렬 (기본).
 *  · 지구별: 같은 지구 학생을 한 신청 카드로 묶어 표시 (기존 동작).
 * 승인·거절은 두 뷰 모두 같은 서버 액션을 쓴다(시간순은 선택분을 신청별로 재묶음).
 */
export function QueuePanel({
  tripId,
  availableSeats,
  queue,
  flatQueue,
}: {
  tripId: string;
  availableSeats: number;
  queue: QueueRequest[];
  flatQueue: FlatPassenger[];
}) {
  const [view, setView] = useState<View>("time");

  const tabCls = (active: boolean) =>
    `rounded-md px-3 py-1 text-xs font-medium transition ${
      active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg bg-gray-100 p-0.5">
        <button type="button" onClick={() => setView("time")} className={tabCls(view === "time")}>
          🕐 시간순
        </button>
        <button type="button" onClick={() => setView("region")} className={tabCls(view === "region")}>
          🗂️ 지구별
        </button>
      </div>

      {view === "time" ? (
        <TimeSortedQueue tripId={tripId} availableSeats={availableSeats} flatQueue={flatQueue} />
      ) : (
        <MatchingQueue tripId={tripId} availableSeats={availableSeats} queue={queue} />
      )}
    </div>
  );
}
