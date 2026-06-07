import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { lookupReservation } from "./actions";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

const inputCls =
  "rounded-xl border border-input bg-card px-3.5 py-3 text-center font-mono text-lg font-semibold tracking-wider uppercase outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

/**
 * 예약 조회 입구 — 예약번호(BUS-XXXX)를 입력하면 본인확인 페이지(/r/<code>)로 보낸다.
 * 보통은 간사가 준 전체 링크(/r/<code>)로 바로 들어오지만, 링크가 없을 때 여기서 번호로 조회.
 */
export default async function ReservationLookupPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div className="flex justify-center">
        <Logo size="sm" />
      </div>

      <div className="bg-card flex flex-col gap-6 rounded-2xl border p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-lg font-bold">예약 조회</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            간사님께 받은 <b>예약번호</b>를 입력해 주세요.
            <br />
            (보통은 받으신 링크로 바로 들어오시면 됩니다.)
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-xl px-3 py-2.5 text-center text-sm"
          >
            예약번호 형식이 올바르지 않아요. <span className="font-mono">BUS-XXXX</span>{" "}
            형태로 입력해 주세요.
          </p>
        )}

        <form action={lookupReservation} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-sm font-semibold">
              예약번호
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={8}
              className={inputCls}
              placeholder="BUS-XXXX"
            />
          </div>

          <Button type="submit" className="h-12 w-full text-[15px]">
            조회하기
          </Button>
        </form>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        🚌 Bus Cignal · 안전한 길 되세요 🙏
      </p>
    </main>
  );
}
