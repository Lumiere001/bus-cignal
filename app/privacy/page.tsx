// 개인정보 처리방침 (PIPA). 초안 — CC 작성. 조직 특정 정보(운영주체 법적 명칭·
// 개인정보 보호책임자·연락처·시행일)는 「확정 필요」 표기. 팀장 검토 후 확정.

export const metadata = {
  title: "개인정보 처리방침 · Bus Cignal",
};

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">
        {n}. {title}
      </h2>
      <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">개인정보 처리방침</h1>
        <p className="text-muted-foreground text-sm">
          Bus Cignal(이하 “서비스”)은 「개인정보 보호법」을 준수하며, 이용자의 개인정보를
          다음과 같이 처리합니다.
        </p>
        <p className="text-muted-foreground text-xs">
          시행일: 「확정 필요」 · 운영주체: CCC IT 사역부 「법적 명칭·연락처 확정 필요」
        </p>
      </header>

      <Section n="1" title="수집하는 개인정보 항목">
        <p>서비스는 차량 매칭·정산·연락에 필요한 최소한의 정보만 수집합니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>학생(탑승자)</b>: 이름, 휴대전화번호, 탑승 지구·노선, 신청·매칭·예약 내역
          </li>
          <li>
            <b>간사(운영자)</b>: 이름, 휴대전화번호, 소속 지구, CCC 식별자(연동 시)
          </li>
          <li>
            <b>자동 수집</b>: 서비스 이용 기록, 푸시 알림 동의 시 푸시 토큰
          </li>
        </ul>
        <p>
          ※ 이메일·성별·주민등록번호 등은 <b>수집하지 않습니다</b>.
        </p>
      </Section>

      <Section n="2" title="개인정보의 수집·이용 목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>타지구 차량 좌석 신청·매칭·배차</li>
          <li>차량비 정산 및 양쪽 지구 간 연락</li>
          <li>예약 확인·취소, 출발 안내 등 서비스 운영 알림</li>
        </ul>
      </Section>

      <Section n="3" title="보유 및 이용 기간">
        <p>
          개인정보는 수련회 운영 목적 달성 후 <b>수련회 종료일로부터 90일</b>까지 보유하며,
          그 이후에는 자동으로 익명화(이름은 마스킹, 전화번호·식별자는 복원 불가능한 형태로
          변환)하여 더 이상 개인을 식별할 수 없도록 처리합니다. 관계 법령에 따라 별도 보존이
          필요한 경우 해당 기간 동안 보관합니다.
        </p>
      </Section>

      <Section n="4" title="개인정보의 제3자 제공">
        <p>
          서비스는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만 차량 매칭의
          성격상 <b>매칭이 성사된 경우에 한해</b> 차량 운영·연락 목적으로 다음 정보가
          제공됩니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>탑승자 → 배차 지구·담당 간사: 이름, 전화번호(탑승자 확인·연락용)</li>
          <li>담당 간사·총무 연락처 → 탑승자: 출발 안내·문의용</li>
        </ul>
      </Section>

      <Section n="5" title="개인정보 처리의 위탁">
        <p>서비스는 안정적 운영을 위해 아래 업무를 위탁하고 있습니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase (데이터베이스 호스팅, 리전: 서울)</li>
          <li>Vercel (애플리케이션 호스팅)</li>
          <li>Google Firebase (푸시 알림 발송)</li>
          <li>Kakao (지도 표시)</li>
        </ul>
        <p>
          위탁계약 시 개인정보 보호 관련 사항을 규정하고 안전하게 관리하도록 하고 있습니다.
        </p>
      </Section>

      <Section n="6" title="정보주체의 권리·행사 방법">
        <p>
          이용자는 언제든지 본인의 개인정보에 대한 <b>열람·정정·삭제·처리정지</b>를 요청할 수
          있습니다. 예약 취소는 서비스 내에서 직접 가능하며, 그 밖의 요청은 아래 보호책임자에게
          연락하시면 지체 없이 조치합니다.
        </p>
      </Section>

      <Section n="7" title="개인정보의 안전성 확보 조치">
        <ul className="list-disc space-y-1 pl-5">
          <li>전송·세션 암호화 및 접근 권한 통제(권한자 외 접근 차단)</li>
          <li>보유기간 경과 시 자동 익명화</li>
          <li>최소 수집 원칙 적용(이메일·성별 등 미수집)</li>
        </ul>
      </Section>

      <Section n="8" title="개인정보 보호책임자">
        <p>
          개인정보 처리에 관한 문의·불만은 아래로 연락해 주시기 바랍니다.
          <br />
          보호책임자: 「성명·직책 확정 필요」 · 연락처: 「이메일/전화 확정 필요」
        </p>
      </Section>

      <Section n="9" title="고지의 의무">
        <p>본 방침의 변경이 있을 경우 시행 전 서비스 공지를 통해 고지합니다.</p>
      </Section>
    </main>
  );
}
