// 이용약관 초안 — CC 작성. 운영주체 명칭·시행일·문의처는 「확정 필요」. 팀장 검토 후 확정.

export const metadata = {
  title: "이용약관 · Bus Cignal",
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
        제{n}조 ({title})
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
        <h1 className="text-2xl font-bold tracking-tight">이용약관</h1>
        <p className="text-muted-foreground text-sm">
          본 약관은 Bus Cignal(이하 “서비스”) 이용에 관한 조건과 절차를 규정합니다.
        </p>
        <p className="text-muted-foreground text-xs">
          시행일: 「확정 필요」 · 운영주체: CCC IT 사역부 「법적 명칭 확정 필요」
        </p>
      </header>

      <Section n="1" title="목적">
        <p>
          본 약관은 CCC 전국 여름 수련회의 타지구 차량 좌석 매칭·정산·소통을 위한 서비스의
          이용 조건, 운영주체와 이용자의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
        </p>
      </Section>

      <Section n="2" title="정의">
        <ul className="list-disc space-y-1 pl-5">
          <li>“학생(탑승자)”: 타지구 차량 좌석을 신청·이용하는 이용자</li>
          <li>“간사(운영자)”: 지구의 차량 등록·배차·정산을 담당하는 이용자</li>
          <li>“마스터”: 전체 운영을 관리하는 서비스 운영자</li>
          <li>“매칭”: 좌석 신청이 차량에 배정되어 예약이 성립되는 것</li>
        </ul>
      </Section>

      <Section n="3" title="서비스의 내용">
        <p>서비스는 다음 기능을 제공합니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>차량 좌석 등록·공개 및 타지구 신청</li>
          <li>간사의 수동 매칭·배차 및 예약번호 발급</li>
          <li>차량비 정산 보조 및 양쪽 지구 간 연락 정보 제공</li>
          <li>예약 확인·취소, 운영 알림</li>
        </ul>
      </Section>

      <Section n="4" title="이용자의 의무">
        <ul className="list-disc space-y-1 pl-5">
          <li>본인의 정확한 정보(이름·전화번호 등)를 제공하여야 합니다.</li>
          <li>타인의 정보를 도용하거나 예약을 부정하게 이용해서는 안 됩니다.</li>
          <li>발급받은 입장 링크·예약 정보를 권한 없는 제3자에게 공유해서는 안 됩니다.</li>
        </ul>
      </Section>

      <Section n="5" title="매칭·정산·취소">
        <p>
          매칭은 간사의 확인을 거쳐 성립하며, 차량비의 결제·환불·정산은 각 지구의 운영 방침에
          따릅니다. 서비스는 매칭과 연락을 <b>중개·보조</b>하며, 실제 차량 운행·금전 거래의
          당사자가 아닙니다. 예약 취소 시 환불 여부는 해당 지구에 문의해야 합니다.
        </p>
      </Section>

      <Section n="6" title="책임의 제한">
        <p>
          서비스는 차량 운행 과정에서 발생하는 사고·지연·분쟁, 이용자 간 금전 거래, 이용자가
          제공한 정보의 부정확으로 인한 손해에 대하여 책임을 지지 않습니다. 다만 운영주체의
          고의·중과실로 인한 경우에는 그러하지 아니합니다. 천재지변, 외부 서비스(호스팅·지도·
          알림) 장애 등 불가항력으로 인한 서비스 중단에 대해서도 책임이 제한됩니다.
        </p>
      </Section>

      <Section n="7" title="개인정보 보호">
        <p>
          서비스는 이용자의 개인정보를 「개인정보 처리방침」에 따라 보호하며, 수련회 종료 후
          90일이 경과하면 자동으로 익명화합니다.
        </p>
      </Section>

      <Section n="8" title="약관의 변경">
        <p>
          운영주체는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 시행
          전 서비스 공지를 통해 고지합니다.
        </p>
      </Section>

      <Section n="9" title="문의">
        <p>서비스 이용 관련 문의: 「운영주체 연락처 확정 필요」</p>
      </Section>
    </main>
  );
}
