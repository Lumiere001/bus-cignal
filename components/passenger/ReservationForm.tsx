"use client";

import { Button } from "@/components/ui/button";

type Props = {
  code: string;
  error?: string;
  action: (formData: FormData) => Promise<void>;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "입력 형식이 올바르지 않습니다. 다시 확인해 주세요.",
  notfound: "이름 또는 전화번호 끝 4자리가 일치하지 않습니다.",
};

export function ReservationForm({ code, error, action }: Props) {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-muted-foreground text-xs">예약번호</p>
        <h1 className="text-xl font-bold tracking-tight">{code}</h1>
      </div>

      <p className="text-sm">
        이름과 전화번호 끝 4자리로 본인 확인 후 예약 내역을 조회하세요.
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {ERROR_MESSAGES[error] ?? "오류가 발생했습니다. 다시 시도해 주세요."}
        </p>
      )}

      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            이름
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="이름을 입력해 주세요"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phoneLast4" className="text-sm font-medium">
            전화번호 끝 4자리
          </label>
          <input
            id="phoneLast4"
            name="phoneLast4"
            type="tel"
            required
            maxLength={4}
            pattern="[0-9]{4}"
            inputMode="numeric"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="예: 4444"
          />
        </div>

        <Button type="submit" className="w-full">
          본인 확인
        </Button>
      </form>
    </main>
  );
}
