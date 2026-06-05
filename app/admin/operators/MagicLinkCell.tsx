"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** 간사 입장 링크 — 복사 버튼. 마스터가 카톡으로 간사에게 전달. */
export function MagicLinkCell({ url }: { url: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!url) {
    return <span className="text-muted-foreground text-xs">미발급</span>;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 차단 환경 — 사용자가 직접 선택 복사
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="max-w-[160px] truncate rounded bg-muted px-1.5 py-0.5 text-xs">
        {url}
      </code>
      <Button type="button" size="sm" variant="outline" onClick={copy}>
        {copied ? "복사됨" : "링크 복사"}
      </Button>
    </div>
  );
}
