"use client";

import { useState } from "react";

/**
 * 예약번호 + 학생 개별 접근 링크.
 * 코드는 /r/<code> 로 가는 클릭 가능한 링크(열기·테스트용),
 * "링크 복사" 버튼은 절대 URL(${origin}/r/<code>)을 클립보드에 복사.
 * 서버 컴포넌트인 MatchTable에서 사용하기 위해 분리한 client 조각.
 */
export function ReservationLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/r/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한 거부 등 — 조용히 무시(링크는 코드 클릭으로 열 수 있음)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/r/${code}`}
        className="font-mono text-blue-600 hover:underline"
      >
        {code}
      </a>
      <button
        type="button"
        onClick={copyLink}
        aria-label={`${code} 학생 접근 링크 복사`}
        className="rounded-md border px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        {copied ? "복사됨" : "링크 복사"}
      </button>
    </div>
  );
}
