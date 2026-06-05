"use client";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

type Props = {
  code: string;
  error?: string;
  action: (formData: FormData) => Promise<void>;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "입력 형식이 올바르지 않습니다. 다시 확인해 주세요.",
  notfound: "이름 또는 전화번호 끝 4자리가 일치하지 않습니다.",
  locked:
    "여러 번 일치하지 않아 잠시 잠겼어요. 30분 후 다시 시도하거나 담당 간사에게 문의해 주세요.",
};

const inputCls =
  "rounded-xl border border-input bg-card px-3.5 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export function ReservationForm({ code, error, action }: Props) {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div className="flex justify-center">
        <Logo size="sm" />
      </div>

      <div className="bg-card flex flex-col gap-6 rounded-2xl border p-6 shadow-sm">
        <div className="text-center">
          <p className="text-muted-foreground text-xs font-medium">예약번호</p>
          <h1 className="mt-0.5 font-mono text-2xl font-extrabold tracking-wider text-blue-700">
            {code}
          </h1>
        </div>

        <p className="text-muted-foreground text-center text-sm leading-relaxed">
          이름과 전화번호 끝 4자리로 본인 확인 후<br />예약 내역을 조회하세요.
        </p>

        {error && (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-xl px-3 py-2.5 text-sm"
          >
            {ERROR_MESSAGES[error] ?? "오류가 발생했습니다. 다시 시도해 주세요."}
          </p>
        )}

        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-semibold">
              이름
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className={inputCls}
              placeholder="이름을 입력해 주세요"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="phoneLast4" className="text-sm font-semibold">
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
              className={inputCls}
              placeholder="예: 4444"
            />
          </div>

          <Button type="submit" className="h-12 w-full text-[15px]">
            본인 확인
          </Button>
        </form>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        🚌 Bus Cignal · 안전한 길 되세요 🙏
      </p>
    </main>
  );
}
