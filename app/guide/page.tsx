import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BackButton } from "@/components/ui/back-button";

export const metadata = {
  title: "사용 가이드 — Bus Cignal",
  description: "간사·학생 사용 방법 안내",
};

// 공개 사용 가이드 — 로그인 없이 누구나(간사가 학생에게 공유 가능). 간사/학생 시나리오 2종.
export default function GuidePage() {
  return (
    <main className="mx-auto max-w-md space-y-8 px-4 py-8">
      <BackButton />

      <div className="space-y-3 text-center">
        <div className="flex justify-center">
          <Logo size="sm" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">사용 가이드</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          지구 간 차량을 등록·신청·매칭하고 예약까지 확인하는 방법이에요.
          <br />
          본인 역할에 맞는 안내를 따라가 보세요.
        </p>
      </div>

      {/* 빠른 이동 */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href="#operator"
          className="rounded-xl border bg-white px-3 py-3 text-center text-sm font-semibold shadow-sm hover:bg-gray-50"
        >
          🧑‍🏫 간사용
        </a>
        <a
          href="#student"
          className="rounded-xl border bg-white px-3 py-3 text-center text-sm font-semibold shadow-sm hover:bg-gray-50"
        >
          🎒 학생용
        </a>
      </div>

      {/* ───────── 간사 ───────── */}
      <section id="operator" className="scroll-mt-4 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">🧑‍🏫 간사 — 차량 등록 · 승인</h2>
        <p className="text-muted-foreground text-sm">
          우리 지구 차량의 남는 자리를 다른 지구 학생에게 열어주고, 신청을 승인·정산해요.
        </p>
        <Steps
          steps={[
            ["로그인", "메인에서 ‘간사 로그인’ → ‘CCC 계정으로 로그인’. 승인된 간사는 본인 지구로 바로 입장돼요."],
            ["차량 등록", "‘지구 차량’ → 차량 등록. 노선(가는편/오는편)·출발·도착·정원·1인 요금을 입력해요. 여기서 ‘정원’은 다른 지구에 공개하는 좌석 수예요(우리 지구 학생용 좌석은 제외)."],
            ["신청 받기", "다른 지구 학생/간사가 신청하면 그 차량 상세의 ‘대기 신청’ 큐에 떠요. (학생 본인 직접 신청은 ‘학생 직접 신청’ 배지로 구분돼요.)"],
            ["승인", "큐에서 태울 학생을 선택해 ‘승인’ → 매칭 생성(송금 대기). 남은 좌석(정원 − 매칭) 안에서 부분 승인도 가능해요."],
            ["입금 확인", "학생이 송금하면 매칭 현황에서 ‘입금 확인’ → 예약번호가 발급되고 학생 예약이 확정돼요. (확정 후엔 공급 측 취소 불가)"],
            ["소통", "차량 상세의 ‘버스 채팅’으로 그 차량에 탄 전 지구 학생과 한 방에서 안내해요."],
          ]}
        />
        <div className="rounded-lg bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-800">
          <p className="mb-1 font-semibold">💡 처음 사용하실 때 꼭!</p>
          본인 지구 인원이 <b>아직 확정되지 않았어도 괜찮아요.</b> ‘정원’은 다른 지구에 여는 좌석
          수라서, 여유 있게 잡아 열어두고 신청 상황을 보면서 차량 상세에서 <b>정원을 조정</b>하면
          돼요. (우리 지구 인원이 늘면 줄이고, 남으면 더 열고.) 자리가 확정될 때까지 기다리기보다
          <b>먼저 여유 있게 열어두는 편</b>이 매칭이 잘 돼요.
        </div>
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          💡 우리 지구가 <b>다른 지구 차량을 신청</b>할 수도 있어요 — ‘신청’ 메뉴에서 타지구 공개
          차량을 조회해 학생 명단으로 신청하면 돼요. 입금 확인된 학생은 <b>신청 상세에 예약번호 +
          ‘링크 복사’</b>가 떠서, 그 예약 링크를 학생에게 바로 공유할 수 있어요.
        </p>
      </section>

      {/* ───────── 학생 ───────── */}
      <section id="student" className="scroll-mt-4 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">🎒 학생 — 차량 신청 · 예약 확인</h2>
        <p className="text-muted-foreground text-sm">
          CCC 계정으로 로그인하면 본인 정보로 바로 차량을 신청하고 예약을 확인할 수 있어요.
        </p>
        <Steps
          steps={[
            ["로그인", "메인에서 ‘학생 로그인’ → ‘CCC 계정으로 로그인’. 이름·전화·소속 지구가 자동으로 채워져요."],
            ["예약하기", "홈에서 ‘예약하기’ → 방향(가는편/오는편)·날짜로 조회 → 지도·목록에서 차량 선택 → 본인 정보 확인·개인정보 동의 → 신청."],
            ["대기 → 매칭", "신청하면 ‘대기중’. 공급 지구 간사가 승인하면 ‘매칭됨’이 돼요. 송금 안내는 담당 간사 안내를 따라 주세요."],
            ["예약 확인", "입금이 확인되면 홈의 ‘예약 확인’에서 예약번호·지도·채팅·예약취소를 볼 수 있어요."],
          ]}
        />
        <div className="rounded-lg bg-gray-50 px-3 py-3 text-xs leading-relaxed text-gray-600">
          <p className="mb-1 font-medium text-gray-800">
            간사님이 대신 신청해 준 경우(예약번호를 받았다면)
          </p>
          메인의 <b>‘예약번호로 조회’</b> → 예약번호 + 이름 + 전화 끝 4자리로 본인확인 → ‘내 예약’에서
          동일하게 확인할 수 있어요.
        </div>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠️ 학생 로그인은 <b>학생 CCC 계정</b>으로만 돼요. 간사 계정으로는 ‘학생 로그인’이 안 돼요(이
          가이드로 신청 방법을 학생에게 안내해 주세요).
        </p>
      </section>

      <div className="flex flex-col gap-2 border-t pt-6">
        <Link
          href="/login"
          className="rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
        >
          간사 로그인 →
        </Link>
        <Link
          href="/s/login"
          className="rounded-lg border px-4 py-3 text-center text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          학생 로그인 →
        </Link>
        <Link href="/" className="py-1 text-center text-xs text-gray-400 hover:text-gray-600">
          처음으로
        </Link>
      </div>
    </main>
  );
}

function Steps({ steps }: { steps: [string, string][] }) {
  return (
    <ol className="space-y-3">
      {steps.map(([title, body], i) => (
        <li key={i} className="flex gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
