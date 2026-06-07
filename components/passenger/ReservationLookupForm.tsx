"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * 예약번호 조회 입력 — "BUS-"는 고정 접두어로 보여주고 뒤 4자리만 입력받는다.
 * 전체 코드(BUS-XXXX)를 붙여넣어도 접두어·하이픈·공백을 제거하고 4자리만 남긴다.
 * 서버 액션(lookupReservation)이 4자리에 BUS-를 다시 붙여 검증한다.
 */
export function ReservationLookupForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [code, setCode] = useState("");

  function normalize(raw: string): string {
    return raw
      .toUpperCase()
      .replace(/^BUS-?/, "") // 전체 코드 붙여넣기 시 접두어 제거
      .replace(/[^A-Z0-9]/g, "") // 영숫자만
      .slice(0, 4);
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-semibold">
          예약번호{" "}
          <span className="text-muted-foreground font-normal">
            (BUS- 뒤 4자리)
          </span>
        </label>
        <div className="border-input bg-card focus-within:border-ring focus-within:ring-ring/40 flex items-stretch rounded-xl border focus-within:ring-3">
          <span className="text-muted-foreground flex items-center pr-1 pl-3.5 font-mono text-lg font-semibold tracking-wider select-none">
            BUS-
          </span>
          <input
            id="code"
            name="code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            required
            value={code}
            onChange={(e) => setCode(normalize(e.target.value))}
            maxLength={4}
            placeholder="XXXX"
            aria-describedby="code-help"
            className="w-full rounded-r-xl bg-transparent py-3 pr-3.5 font-mono text-lg font-semibold tracking-widest uppercase outline-none"
          />
        </div>
        <p id="code-help" className="text-muted-foreground text-xs">
          예약번호가 <span className="font-mono">BUS-AB2C</span> 라면{" "}
          <span className="font-mono">AB2C</span> 만 입력하세요.
        </p>
      </div>

      <Button
        type="submit"
        disabled={code.length !== 4}
        className="h-12 w-full text-[15px]"
      >
        조회하기
      </Button>
    </form>
  );
}
