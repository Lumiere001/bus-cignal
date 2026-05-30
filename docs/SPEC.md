---
agent: claude-code
status: finalized
created: 2026-05-26T15:00:00+09:00
last_modified: 2026-05-30T11:00:00+09:00
awaiting_approval: false
priority: high
tags: [bus-cignal, planning, project, finalized, v1-1]
---

# Bus Cignal — 서비스 기획안 v1.1 (간사 피드백 반영)

> CCC 전국 여름 수련회 **타지구 차량 매칭·정산·소통 통합 시스템**
> 운영 주체: **CCC IT 사역부** / 운영 목표: 2026 여름 수련회
> **v1.1 (2026-05-30)** — 간사 피드백 반영: ① 간사 = **CCC 로그인** ② 매칭 = **시각순 정렬 + 간사 수동 선택**(FIFO 강제 해제) ③ 부분 매칭 = **수동** ④ 송금 = **자동 만료 폐지, 소프트 리마인더** ⑤ 학생·간사 PWA = **옵트인**. (v1.0 Confirmed Final 2026-05-27)

---

## 0. 30초 요약

- **현행 문제**: 카톡 오픈채팅 선착순 손들기 → 순서 분쟁·메시지 묻힘·명단 누락·정산 불투명·학생↔담당자 단절
- **해결**:
  - 신청 슬라이스 **시각순 큐** + 공급 간사 **수동 승인 (강제 잠금 없음, 자유 선택)**
  - **부분 매칭 = 간사 수동 선택** (우선순위는 참고 힌트, 자동 아님)
  - 송금 = 수동 2단계("송금 완료" → "입금 확인"). **자동 만료 없음** — 송금 지연 리마인더 + 간사 수동 [자리 풀기]
  - **매칭 후 공급 측 자의 취소 = 불가능** (승인 전 신중 안내)
  - **학생 자의적 취소 가능** — 양쪽 간사 자동 알림 + "환불은 각 지구로 문의" 안내
  - 자리 풀리면 **큐 재노출 + 알림** (자동 재매칭 X, 간사가 다시 수동 선택)
  - **재신청 추천 알림** — 자리 풀릴 때마다 (거절·취소된 신청 지구)
  - 예약번호 `BUS-XXXX` (이름 + 전화 끝 4자리 검증) + Trip 단위 채팅
  - 지구별 정산 매트릭스
  - **간사 가입 시 출발/도착지 등록** → 출발지 미지정 패널티 불필요
  - **간사 = CCC 로그인** (CCC 신원 전달 → 검증 → 자체 세션) / **마스터 = 비밀번호 only**
  - **PWA + FCM 푸시 = 옵트인** (간사·학생 모두, 카톡 내장 브라우저는 인앱만)
- **사용자**: 마스터 (CCC IT 사역부) · 차량 간사 N명 · 학생 수련회당 수백~수천
- **기술**: Next.js 15 + Supabase + Firebase Firestore + 카카오맵 + PWA (FCM) + Vercel (기본 도메인)

---

## 1. 배경

### 1.1 도메인
CCC 전국 여름 수련회는 평창에서 진행. 학생은:
- **상행**: 본인이 머무는 지역(보통 학교) → 평창
- **하행**: 평창 → 본가 지역

본인 소속 지구 ≠ 본가 지역이면 **타지구 차량** 이용. 지구마다 평창까지 거리가 달라 **요금 변동** → 고정가 X, 매칭 후 지구간 직접 송금.

### 1.2 현행 비효율
| 문제 | 영향 |
|---|---|
| 채팅 순서 = 선착순 | 분쟁·누락 |
| 메시지 묻힘 | 자리 놓침 |
| 송금 확인 1:1 분산 | 중복·누락 |
| 명단 자투리 톡 | 미탑승 사고 |
| 정산 사람 머릿속 | 회계 불투명 |
| 본인 지구 차 떠난 후 학생이 타지구 차 | 본인 지구 간사 관리 불가 |

### 1.3 carbus-web과의 관계
**별개 프로젝트.** carbus-web = 광주지구 내부(단일), Bus Cignal = 전국 지구 간(N:N). 코드 별도. 패턴·UI 컴포넌트만 학습 source.
- v1.1 참고: 간사가 요청한 "지구 내 차량 인벤토리(버스/스타렉스/자차)·지구 내 학생 신청"은 본질적으로 carbus-web 영역. Bus Cignal에는 **V1.5 stretch**로만 검토 (시간 남으면).

### 1.4 목표
1. **공정성**: timestamp + FIFO + 우선순위
2. **투명성**: ledger·매트릭스
3. **학생 직접 접근**: 예약번호 + 매칭·지도·간사·채팅·취소
4. **현장 소통**: 채팅 + PWA 푸시
5. **확장**: 전국 52개 지구

---

## 2. 사용자 페르소나

### 2.1 마스터 (Master) — CCC IT 사역부
- **인증**: **마스터 비밀번호 only** (OAuth X). `/admin/login` 페이지 + bcrypt 환경변수 + 세션 쿠키 24h + 5회 실패 1h 잠금. 16자+ 권장, 1Password 보관, 90일 rotation 권장. **분실 시 복구**: 새 비번 bcrypt hash → `.env` + Vercel env 갱신 + 재배포 (5~10분).
- **DB 모델**: master는 `operators` 테이블에 없음. 환경변수만으로 인증.
- 역할: 시스템 전체 관리·간사 가입 승인·지구 부여·이상상황 개입·신청 마감일/점검 모드 settings·전국 정산 매트릭스·거절 발생 모니터링 (단순 알림, V2 임계값)

### 2.2 차량 간사 (Operator)
- **인증**: **CCC 로그인** — ccc-summer 진입점에서 CCC가 신원(`ccc_id`·이름·전화·소속 지구·캠퍼스, +직분 확인 예정)을 전달 → 우리가 **검증** → **자체 세션 발급**(마스터와 동일 JWT 쿠키 패턴). + 마스터 승인 대기 → 승인 후 권한 활성.
  - ※ 신원 전달 방식(서명 토큰 JWT / 일회용 코드 + 검증 API / OIDC 중)은 **CCC IT 확인 후 확정** → 그때까지 인증 구현 보류.
  - ※ "차량 간사 여부"는 CCC가 제공하지 않음 → **마스터 승인이 권한 결정권자**.
- **가입 시 등록 필수**:
  - 본인 정보 (CCC에서 이름·전화 수신)
  - 본인 지구 (CCC가 제공하면 자동배정, 아니면 선택)
  - **상행 출발지 N개** (지구 내 출발 가능 장소들)
  - **하행 출발지 N개** (평창의 어느 지점)
  - **하행 도착지 N개** (지구 내 도착 가능 장소들)
- **본인 정보 수정**: 이름·전화는 CCC 동기화. 소속 지구 변경 = 마스터 재승인 필요.
- 역할: Trip CRUD (등록된 location에서 선택, 자유 입력 X), Offer 공개, 다른 지구 신청 (학생 명단 + 우선순위 힌트), 매칭 **수동** 승인·거절, 송금 알림 / 입금 확인, 본인 지구 정산

### 2.3 학생 (Passenger)
- **별도 가입 없음**
- **인증**: 예약번호(`BUS-XXXX`) + 본인 이름 + 전화 끝 4자리 (둘 다 검증) → 세션 30일
- 역할: 매칭 조회 (지도·간사·채팅), **자의적 취소** ("환불은 각 지구로 문의" 안내), PWA 푸시 알림 (옵션, 첫 매칭 paid 시점에 권유)

---

## 3. 핵심 시나리오

### S1. Trip 등록 + 자리 공개

**행위자**: 광주지구 간사 A (가입 시 등록한 location들 보유)

1. `/operator/trips/new`
2. Trip 정보:
   - 방향: 하행
   - **출발지**: 본인이 가입 시 등록한 하행 출발지 중 선택 (예: "평창 봉평면 ○○로 123")
   - **도착지**: 본인이 가입 시 등록한 하행 도착지 중 선택 (예: "광주 충장로 1가")
   - 출발 시각: 2026-07-30 14:00
   - 정원·요금
   - 메모 500자
3. 저장 → status=draft → "타지구 공개" 토글 ON → SeatOffer 생성 → published

**Trip 수정 시점 제한**:
- 매칭 발생 전 (매칭 0): 전 필드 자유 수정 + Trip 삭제 가능
- 매칭 발생 후: 정원 ↑ OK / 정원 ↓ = 매칭된 좌석 이상만 / 요금·시간·location 변경 = 자동 알림 / 방향 = 변경 X
- 출발 D-1 이후: 변경 가능하지만 학생들에게 자동 알림 + 강한 안내 ("출발 임박, 신중히")
- 출발 후: 수정 X

### S2. 신청 (우선순위 부여)

**행위자**: 부산지구 간사 B

1. `/operator/requests/new` → 검색 (출발지·도착지·날짜)
2. Trip 선택 → 학생 명단 입력
3. **각 학생에 우선순위 부여** (입력 순 default, 수정 가능) — 공급 간사가 누구를 태울지 고를 때 **참고 힌트** (자동 매칭 아님)
4. 개인정보 동의 confirm 체크박스 필수
5. SeatRequest 생성 (requested_at=NOW)
6. 큐 진입 → 공급 지구 알림 (인앱 + 푸시)

### S3. 매칭 승인 (간사 수동 선택)

**자유 선택**: 큐는 시각순 정렬로 **보여주기만** 함. 공급 간사가 어느 신청·어느 학생이든 직접 선택 (강제 잠금 없음).

1. A `/operator/trips/:id` → 큐(시각순) 확인 → 승인할 신청 + 태울 학생 선택
2. **승인 전 안내 모달**:
   > "입금 확정 후 공급 지구 본인 사정으로 취소가 불가능합니다. 학생 자의 취소 또는 송금 미완료 시에만 자리가 풀립니다. 신중히 진행해 주세요."
3. [승인 확정]:
   - 선택한 학생만 Match 생성 (학생 1명당 Match 1개)
   - 자리보다 많이 신청됐으면 **간사가 일부만 선택** (자동 분할·우선순위 재정렬 없음)
   - 매칭 안 된 학생은 큐 잔류 (간사가 나중에 다시 선택)
   - **자동 거절 없음** — 안 태우면 큐에 그대로 남음
4. B에 알림 (송금 안내, 마감 시한 없음)

**거절**: 신청 선택 → [거절] + 사유 10자+ 필수 → status=rejected, B 알림 + 마스터 알림 (V1 단순 로그)

### S3b. 잔여 자리 변동 시 (수동 재매칭)

**Trigger**: 송금 지연 [자리 풀기], Phase 2 취소, 학생 자의 취소 → 잔여 자리 +N

→ 시스템: **자동 재매칭 없음**. 대신
- 큐에 남아있던 SeatRequest를 그대로 다시 노출 (시각순 정렬)
- 공급 간사에게 "자리 N석 생김" 알림
- 거절·취소된 신청 지구에 "자리 났어요" 재신청 추천 알림
→ 공급 간사가 큐에서 다시 수동 승인 (S3 동일)

### S4. 송금 + Confirm (자동 만료 없음)

**Happy path**:
1. B 매칭 화면 → 송금 정보 + 송금 실행
2. B "송금 완료" 클릭 → status=payment_reported
3. A 통장 확인 → [입금 확인] → status=paid + 예약번호 발급
4. B 화면에 학생별 카톡 공유 문구 [복사]

**Sad path 1 — 송금 지연 (자동 만료 없음)**:
- 매칭 후 일정 시간(예: 24h) 경과 + payment_reported_at NULL → B·A에 "송금 지연" 리마인더 (자동 expire X)
- 자리는 그대로 잡혀 있음 — 공급 간사가 [자리 풀기]를 눌러야 풀림
- [자리 풀기] → S3b (수동 재매칭) + 신청 지구 "자리 났어요" 알림 (학생 prefill 재신청 버튼)

**Sad path 2 — Phase 2 취소 (송금 보고 후 미입금)**:
- B 송금 완료 클릭했지만 실제 입금 X
- A [매칭 취소] 클릭 (status=payment_reported에서만 활성, 사유 필수)
- 자리 풀림

**★ K1 매칭 후 공급 측 자의 취소 = 불가능**:
- status=paid 매칭은 공급 지구가 임의 취소 X
- 자리 회수는 학생 자의 취소 or 시스템 외 협의로만

### S5. 학생 접속

1. B로부터 카톡으로 예약번호 + 링크
2. 링크 탭 → `/r/BUS-7K9M`
3. 인증: 본인 이름 + 전화 끝 4자리 둘 다 → 검증
4. 세션 30일
5. `/me` 학생 대시보드:
   - 매칭 카드들 (**여러 매칭 다중 표시** — 상행+하행 등, 출발 시각 가까운 순)
   - 출발지 카드 (카카오맵 임베드)
   - 담당 간사 카드
   - [Trip 채팅 입장]
   - [매칭 취소]

**PWA 진입 흐름 (옵션 C)**:
- 카톡 링크 → 바로 웹 진입 (마찰 ↓)
- "홈 화면 추가" 안내 = 부드러운 배너
- **첫 매칭 paid 시점에** "출발 안내·변경 알림 받으시겠어요? 홈 화면 추가 후 알림 허용" 권유
- 학생 옵트인

### S5a. 학생 자의적 매칭 취소

1. 학생 `/me/cancel/:matchId`
2. 확인 모달:
   > "정말 취소하시겠어요?
   > 자리는 다른 분께 돌아갑니다.
   > **환불은 각 지구로 문의해주세요.**
   > 양쪽 지구 간사에게 자동 알림이 갑니다."
3. 사유 입력 (선택)
4. **D-1 이내 취소 시 추가 안내**: "운행이 임박했습니다. 환불이 어려울 수 있어요."
5. Match.status = cancelled, cancellation_source = passenger
6. 양쪽 간사 자동 알림 (인앱 + 푸시)
7. 자리 풀림 → S3b (큐 재노출·수동 재매칭)

### S6. 채팅 (Trip 생성 시점부터 활성)

- Trip published 시 채널 자동 생성
- 공급 지구 간사: 즉시 입장 (관리자)
- 신청 지구 간사: 본인 지구 학생 매칭된 시점부터
- 학생: 매칭 paid 시점부터 (시간 제한 X)
- 메시지: Firestore document, offline 캐시, sent/delivered/read
- PWA 푸시 알림 옵션 (학생이 채팅별 ON/OFF, V1.5)

### S7. 정산 (시스템 = ledger 표만, 사후 처리는 캠퍼스 자율)

**일반 간사 `/operator/settlement`**:
- 받을 돈·보낼 돈 표 + 합계 + CSV
- 본인 지구 관련만

**마스터 `/admin/settlement`**:
- 전국 N×N 매트릭스 + 셀 클릭 ledger + CSV

**N5 사후 정산** = **시스템 책임 없음**. 운행 후 환불·노쇼·추가 탑승은 캠퍼스 간 사적 합의. 시스템은 ledger로 양쪽 간사가 체크·관리만 가능하게.

### S8. 시스템 알림 (인앱 + PWA 푸시, 이메일 X)

이메일 발송 안 함. 채널 = 인앱 + 푸시(홈화면 추가 시).

| 이벤트 | 대상 | 인앱 | 푸시 |
|---|---|---|---|
| 매칭 큐 신규 신청 | 공급 지구 | ⭕ | ⭕ |
| 매칭 확정 | 신청 지구 | ⭕ | ⭕ |
| 매칭 거절 + 사유 | 신청 지구 | ⭕ | ⭕ |
| 부분 매칭 처리 (간사 수동) | 양쪽 | ⭕ | ⭕ |
| 자리 풀림 — 큐 재노출/재신청 추천 (S3b) | 신청 지구 + 학생 | ⭕ | ⭕ |
| 송금 지연 사전 알림 | 신청 지구 | ⭕ | ⭕ |
| 송금 장기 지연 — [자리 풀기] 권유 | 양쪽 | ⭕ | ⭕ |
| 송금 완료 보고 | 공급 지구 | ⭕ | ⭕ |
| 입금 확인 + 예약번호 발급 | 신청 지구 + 학생 | ⭕ | ⭕ |
| 매칭 취소 (Phase 2) | 신청 지구 | ⭕ | ⭕ |
| 학생 자의적 취소 | 양쪽 간사 | ⭕ | ⭕ |
| **K2 자리 풀림 (재신청 추천)** | 거절·만료된 신청 지구 | ⭕ | ⭕ |
| 출발 D-1 | 양쪽 + 학생 | ⭕ | ⭕ |
| 출발 D-1h | 양쪽 + 학생 | ⭕ | ⭕ |
| Trip 정보 변경 (시간·location·요금) | 양쪽 + 학생 | ⭕ | ⭕ |
| 거절 발생 | 마스터 | ⭕ | ⭕ |
| 시스템 장애 | 마스터 | ⭕ | ⭕ |
| 채팅 새 메시지 | 양쪽 + 학생 | ⭕ | 🟡 (사용자 ON/OFF) |
| 간사 권한 해제 | 해당 간사 + 같은 지구 다른 간사 | ⭕ | ⭕ |

**발송 실패 처리**: FCM 푸시 실패 시 3회 재시도 (1m → 5m → 30m). 모두 실패 → 마스터 알림. 사용자에게 실패 표시 X. `notifications.delivery_status·retry_count·last_attempt_at` 기록.

---

## 4. 화면 구성 (Sitemap)

### 4.1 공통
- `/` 랜딩 (간사 vs 학생 분기)
- `/login` CCC 로그인 진입 (간사 only, ccc-summer에서 넘어옴)
- `/admin/login` 마스터 비번
- `/signup` 간사 가입 (이름·전화·지구·**출발/도착지 N개 등록**)
- `/pending` 마스터 승인 대기
- `/r/:code` 학생 진입 (이름 + 전화 끝 4자리)
- `/chat/:tripId` Trip 채팅
- `/privacy`, `/terms`, `/offline` (PWA), `/404`, `/500`

### 4.2 간사
- `/operator` 대시보드
- `/operator/trips`, `/operator/trips/new` (location 선택), `/operator/trips/:id`
- `/operator/requests`, `/operator/requests/new` (학생 + 우선순위), `/operator/requests/:id`
- `/operator/matches` 매칭 ledger
- `/operator/settlement`
- `/operator/profile` (본인 정보 수정·**등록한 location 관리**)

### 4.3 학생
- `/me` 다중 매칭 카드
- `/me/trip/:id`
- `/me/cancel/:matchId`

### 4.4 마스터
- `/admin` 전국 대시보드 (익명화 D-day 카운트다운 포함)
- `/admin/regions`
- `/admin/operators` 간사 권한 관리 (활성·[비활성화] 버튼)
- `/admin/operators/pending` 가입 승인 대기
- `/admin/trips`
- `/admin/matches`
- `/admin/settlement`
- `/admin/rejections` 거절 단순 알림 목록
- `/admin/system` 신청 마감일·점검 모드·로그

**총 31개 페이지** (risk-trips 제거, signup·login·admin/login 추가 정리).

### 4.5 PWA
- `app/manifest.ts`
- `app/sw.ts` (service worker)
- `public/icons/`
- FCM 통합

---

## 5. 주요 화면 상세

### 5.1 디자인 시스템 (Claude chat 선정 + 입히기)

| 영역 | 결정 |
|---|---|
| 라이브러리 | shadcn/ui (Radix 기반, 복사형) + Tailwind |
| **디자인 선정** | **Claude chat에서 주요 페이지별 mock 만들어 후보 선정 → 팀 합의 → 코드 반영** |
| 색상 (기본) | Primary Blue · Accent Green · Warning Yellow · Danger Red |
| 폰트 | Pretendard |
| 아이콘 | Lucide React |
| 모바일 우선 | iPhone 13 (375~390px) |
| 다크 모드 | V2 |

### 5.2 Copy 톤
- 학생: 친근·존댓말·간결·"○○님"
- 간사: 명확·정보·액션
- 시스템: 객관·짧음
- 에러: 친절·다음 단계

### 5.3 가입 화면 (`/signup`) — Location 등록 핵심

```
[기본 정보 — CCC 로그인에서 수신]
이름: (CCC 수신, 읽기 전용)
전화: (CCC 수신)
소속 지구: (CCC 제공 시 자동배정 / 미제공 시 드롭다운 52개)
캠퍼스: (CCC 수신)

[상행 출발지]
+ 추가 버튼으로 N개
  - 주소: [카카오맵 검색]
  - 라벨: [예: 광주 충장로 1가]
  - [지도 미리보기]

[하행 출발지 — 평창 어디서?]
+ 추가
  - 주소·라벨

[하행 도착지 — 우리 지구 어디로?]
+ 추가
  - 주소·라벨

[가입 신청]
※ 마스터 승인 대기 후 활성됩니다
```

### 5.4 `/operator/trips/new` (location 선택)

- 방향: 상행/하행
- **출발지**: 본인 등록 location 드롭다운 (자유 입력 X)
- **도착지**: 본인 등록 location 드롭다운 (방향에 따라 한쪽 평창 고정)
- 출발 시각·정원·요금·메모 (500자)

### 5.5 매칭 큐 (시각순 정렬 + 간사 자유 선택)

```
[시각순 정렬 — 강제 잠금 없음. 어느 신청이든 선택 가능]
부산 5명  7/15 10:30  [학생 선택▾] [승인] [거절]
대구 5명  7/15 11:05  [학생 선택▾] [승인] [거절]
… 연락 두절·긴급 등은 순서와 무관하게 처리

[학생 선택] 자리보다 많으면 태울 학생만 체크 (우선순위는 정렬 힌트)

[승인 안내 모달]
⚠️ 입금 확정 후에는 공급 지구 본인 사정으로 매칭 취소가 불가능합니다.
   신중히 진행해 주세요.
[취소] [승인 확정]
```

### 5.6 `/operator/requests/new` (우선순위 부여)

```
1️⃣ 김○○ · 010-XXXX-1234 · 부산대  [↑↓]
2️⃣ 박○○ · 010-XXXX-5678 · 부경대  [↑↓]
…
※ 우선순위 = 공급 간사 참고 힌트 (자동 매칭 아님 — 공급 간사가 직접 선택)

☐ 개인정보 처리 본인 동의 받았음 확인

[신청]
```

### 5.7 `/me` 학생 대시보드 (다중 매칭)

```
안녕하세요, 김○○님!

┌─ 매칭 1: 광주 → 평창 ───────────────┐
│ 7/26(월) 09:00 · 35,000원           │
│ 예약번호: BUS-7K9M                  │
│ [지도] [채팅] [취소]                 │
└─────────────────────────────────────┘

┌─ 매칭 2: 평창 → 부산 ───────────────┐
│ 7/30(수) 14:00 · 35,000원           │
│ 예약번호: BUS-X2P4                  │
│ [지도] [채팅] [취소]                 │
└─────────────────────────────────────┘

[PWA 알림 받기 — 홈 화면 추가]  ← 부드러운 배너 (옵션)
```

### 5.8 `/me/cancel/:matchId` 학생 취소

```
정말 매칭을 취소하시겠어요?

⚠️ 취소 시:
  - 자리는 다른 분께 돌아갑니다
  - 💰 환불은 각 지구로 문의해주세요
  - 양쪽 지구 간사에게 자동 알림이 갑니다

[D-1 이내 시 추가 표시]
🔴 운행이 임박했습니다. 환불이 어려울 수 있어요.

취소 사유 (선택):
[                                    ]

[돌아가기] [취소 확정]
```

### 5.9 `/admin` 마스터 대시보드 (익명화 D-day)

```
[전국 통계]
- 활성 Trip: 47
- 활성 매칭: 312
- 거절 발생 (오늘): 3 [/admin/rejections]
- 가입 대기 간사: 2 [/admin/operators/pending]

[데이터 익명화]
수련회 종료 (2026-08-10) + 90일 = 2026-11-08 자동 익명화
→ D-105
```

### 5.10 `/admin/operators` (간사 권한 관리)

```
[활성 간사]
이름 | 지구 | 가입일 | 액션
김광주 | 광주 | 7/1   | [비활성화]
박부산 | 부산 | 7/2   | [비활성화]

비활성화 시:
- 권한 즉시 회수, 세션 종료
- 해당 간사 알림 (인앱+푸시): "권한이 해제되었습니다"
- 같은 지구 다른 간사 알림: "○○ 간사 권한 해제 — 인수인계 확인"
```

### 5.11 `/admin/rejections` 거절 알림 (V1 단순)

```
| 시각 | 공급 지구 | 신청 지구 | 인원 | 사유 |
| 7/15 10:35 | 광주 | 대구 | 5 | "이미 자리 다 찼습니다" |
```

V1은 단순 목록. 임계값·통계는 V2.

---

## 6. 도메인 모델

```sql
regions (
  id uuid pk, code text unique, name text, area text,
  category text check (category in ('regular','special_ministry','overseas')),
  bank_account text, bank_name text, account_holder text,
  created_at timestamptz
)

region_locations (                       -- ★ 신규 (가입 시 등록)
  id uuid pk,
  region_id uuid fk → regions,
  direction text check (direction in ('up','down')),
  location_type text check (location_type in ('origin','destination')),
  address text not null,
  lat numeric, lng numeric,
  label text,                            -- "광주 충장로 1가"
  is_default boolean default false,
  created_by uuid fk → operators,
  created_at timestamptz
)

operators (
  id uuid pk,
  region_id uuid fk → regions null,      -- 승인 후 채워짐 (CCC가 지구 제공 시 자동)
  ccc_id text unique,                    -- ★ CCC 고유·불변 식별자 (구 google_uid)
  email text null,                       -- 미수집 (CCC 미제공) — nullable
  name text, phone text,
  campus text null,                      -- ★ CCC 캠퍼스 (있으면)
  ccc_role text null,                    -- ★ CCC 직분 간사/순장/순원 (확인 예정, 권한 보조용)
  requested_region_id uuid fk → regions null,
  approval_status text check (approval_status in ('pending','approved','rejected','revoked')),
  approved_at timestamptz null, approved_by uuid fk → operators null,
  revoked_at timestamptz null, revoke_reason text null,
  role text check (role in ('operator')) default 'operator',  -- master는 별도 없음
  created_at timestamptz
)
-- ※ 간사 인증 = CCC 로그인 (신원 검증 → 자체 세션). Supabase Auth(Google OAuth) 미사용.
-- ※ "차량 간사 여부"는 CCC 미제공 → approval_status(마스터 승인)가 권한 최종 결정.
-- ※ master role 제거. master는 환경변수 MASTER_PASSWORD_HASH로만 인증

trips (
  id uuid pk,
  operator_region_id uuid fk → regions,
  direction text check (direction in ('up','down')),
  origin_location_id uuid fk → region_locations not null,    -- ★ 등록 location 참조
  destination_location_id uuid fk → region_locations not null,
  departure_at timestamptz,
  capacity int, price_per_seat int,
  note text,                             -- 500자
  status text check (status in ('draft','published','closed')),
  created_at timestamptz, created_by uuid fk → operators
)

seat_offers (
  id uuid pk, trip_id uuid fk → trips,
  seat_count int, posted_at timestamptz,
  status text check (status in ('open','closed')),
  created_at timestamptz
)

seat_requests (
  id uuid pk, trip_id uuid fk → trips,
  region_id uuid fk → regions, operator_id uuid fk → operators,
  parent_request_id uuid fk → seat_requests NULL,
  seat_count int,
  requested_at timestamptz,
  status text check (status in ('queued','matched','rejected','cancelled')),
  reject_reason text NULL,
  consent_confirmed_at timestamptz, consent_confirmed_by uuid fk → operators,
  created_at timestamptz
)

request_passengers (
  id uuid pk, request_id uuid fk → seat_requests,
  name text, phone text, school_or_role text, note text,
  priority int not null,                 -- request 내 unique
  UNIQUE (request_id, priority),
  created_at timestamptz
)
-- ※ priority = 공급 간사 참고 힌트 (수동 선택). 자동 분할·재정렬 없음 (v1.1)

matches (
  id uuid pk,
  trip_id uuid fk → trips, request_id uuid fk → seat_requests,
  passenger_id uuid fk → request_passengers,      -- 학생 1명당 Match 1개
  matched_at timestamptz,
  payment_due_at timestamptz,
  payment_reported_at timestamptz NULL,
  paid_at timestamptz NULL,
  status text check (status in ('awaiting_payment','payment_reported','paid','expired','cancelled')),
  -- ※ expired = 자동 만료 아님 → 간사가 [자리 풀기]로 수동 해제한 상태 (v1.1)
  reservation_code text unique NULL,
  cancellation_source text NULL check (cancellation_source in ('operator','passenger','system')),
  cancellation_reason text NULL,
  created_at timestamptz
)

match_passengers (
  id uuid pk, match_id uuid fk → matches,
  name text, phone text, school_or_role text,
  access_token_hash text,                -- 예약번호 검증 (이름+전화끝4자리)
  last_seen_at timestamptz NULL,
  created_at timestamptz
)

notifications (
  id uuid pk,
  operator_id uuid fk → operators NULL, passenger_id uuid fk → match_passengers NULL,
  type text, payload jsonb,
  channel text check (channel in ('in_app','push')),
  delivery_status text check (delivery_status in ('pending','sent','failed')) default 'pending',
  retry_count int default 0,
  last_attempt_at timestamptz null,
  read_at timestamptz NULL, sent_at timestamptz NULL,
  created_at timestamptz
)

rejection_log (
  id uuid pk, seat_request_id uuid fk → seat_requests,
  rejected_by uuid fk → operators, reason text,
  created_at timestamptz
)

system_config (
  key text pk, value text,
  updated_at timestamptz, updated_by text  -- 마스터(시스템)는 별도 식별
)
```

### Firestore (채팅)
```
channels/{tripId}/messages/{messageId}
channels/{tripId}/members/{memberId}
```

### 티켓 번호 규칙

- 형식: `BUS-XXXX` (4자 uppercase)
- 알파벳셋 30자: `23456789ABCDEFGHJKMNPQRSTUVWXY` (혼동 글자 `0·1·I·O·L·Z` 제외)
- 4자 = 810,000개 조합
- Match.paid_at 시점 발급, DB unique constraint, 충돌 시 재생성
- 학생 1명당 1개 (상행·하행 별도 매칭 → 별도 코드)

---

## 7. 매칭 방식 (시각순 정렬 + 간사 수동 선택)

> v1.1: FIFO 강제·자동 부분매칭·자동 후속매칭·자동 만료 **전부 제거**. 간사 수동 선택으로 단순화.

```
fn queue(trip):
  return SeatRequest WHERE trip_id = trip.id AND status = 'queued'
    ORDER BY requested_at ASC          -- 정렬은 유지 (보여주기용, 강제 아님)

fn available(trip):
  return sum(offers.open) - sum(matches in (awaiting_payment, payment_reported, paid))

fn approve(request, selected_passenger_ids):   -- ★ 간사가 신청·학생을 직접 선택
  -- 강제 큐 1번째 assert 없음 (어느 신청이든 가능)
  avail = available(request.trip)
  selected = [p for p in request.passengers if p.id in selected_passenger_ids]
  assert len(selected) <= avail            -- 자리 한도만 검사
  for p in selected:
    Match.create(trip, request, p, status='awaiting_payment')   -- payment_due_at 없음 (소프트)
  -- 선택 안 된 학생은 request에 그대로 잔류 (자동 분할 X)
  if all passengers matched: request.status = 'matched'
  log_action(operator, 'approve', request, selected)            -- 투명성 로그

fn reject(request, reason):              -- 간사 수동 거절 (사유 10자+)
  request.status = 'rejected'
  request.reject_reason = reason
  notify_request_region(request); notify_master(request, 'rejection')
  log_action(operator, 'reject', request, reason)

fn release_seat(match, operator, reason):   -- ★ 송금 지연 등 간사 수동 [자리 풀기]
  assert match.status in ('awaiting_payment','payment_reported')
  match.status = 'expired'                 -- 수동 해제 (자동 cron 아님)
  notify_both(match)
  on_seat_freed(match.trip)

fn cancel_match(match, source, reason):
  if source == 'operator': assert match.status == 'payment_reported'  -- Phase 2만
  if source == 'passenger': assert match.status in ('awaiting_payment','payment_reported','paid')
  match.status = 'cancelled'
  match.cancellation_source = source
  match.cancellation_reason = reason
  notify_both(match)
  on_seat_freed(match.trip)

fn on_seat_freed(trip):                  -- ★ 자동 재매칭 없음 — 노출 + 알림만
  -- 큐는 queue(trip)로 그대로 다시 보임 (잔류 신청)
  notify_supply_operator(trip, 'seats_available')
  for stale in SeatRequest WHERE status in ('expired','rejected','cancelled') AND trip_id=trip.id:
    notify_request_region(stale, 'reapply_recommended')   -- 재신청 추천
  -- 이후 매칭은 간사가 approve()로 수동 진행

fn payment_delay_reminder():             -- cron (만료 아님, 알림만)
  for match in matches WHERE status='awaiting_payment'
      AND matched_at < NOW - reminder_threshold:
    notify_both(match, 'payment_delayed')   -- 자리 회수 X, 간사 판단에 맡김

fn anonymize_expired_data():            -- cron 매일 새벽 3시 KST (#15)
  cutoff = retreat_end_date + 90 days
  if NOW < cutoff: return
  for row in operators, request_passengers, match_passengers, ...:
    if row.created_at < cutoff and not row.anonymized:
      row.name = '○○○'; row.phone = sha256(phone); row.email = sha256(email)
      row.anonymized = true
```

---

## 8. 권한 모델 (RLS)

| Role | Trips | Requests | Matches | Settlement | Chat |
|---|---|---|---|---|---|
| master | 전체 R/W + 간사 승인 | 전체 R/W | 전체 R/W | 전국 매트릭스 | 모든 Trip |
| operator | 본인 지구 W, 전체 R | 본인이 만든 것 W, 본인 지구 R | 양쪽 지구 R/W (Phase 2 cancel만) | 본인 지구 | 본인 지구 + 신청 지구 Trip |
| passenger | — | — | **본인 매칭 R + cancel W** | — | 본인 매칭 Trip (paid 이후) |

### 마스터 인증 (#1 결정)
- 환경변수 `MASTER_PASSWORD_HASH` (bcrypt) only
- `/admin/login` → 비번 입력 → 세션 쿠키 24h
- 5회 실패 1h 잠금
- 16자+ 권장, 1Password 보관, 90일 rotation 권장
- **분실 복구**: 새 비번 bcrypt → `.env` + Vercel env 갱신 → 재배포

### 간사 인증 (v1.1 — CCC 로그인)
- ccc-summer 진입점 → CCC가 신원 전달 → **검증** → 자체 세션 쿠키 발급 (jose JWT, 마스터와 동일 패턴, `bc_operator_session`)
- 신원 전달 방식(서명 토큰 / 일회용 코드 / OIDC)은 CCC IT 확인 후 확정 → **그때까지 구현 보류**
- **RLS 주의**: 간사는 Supabase Auth(`auth.uid()`)를 쓰지 않으므로, 간사 영역 접근통제는 **앱 서버 레이어(자체 세션 검증) + service_role 경유**로 강제. 테이블 RLS는 기본 deny + 서버 경유 (또는 세션 기반 커스텀 클레임 — 구현 시 확정).

---

## 9. 기술 스택

### 9.1 본체
- Next.js 15 App Router + TypeScript strict
- Tailwind + shadcn/ui (Claude chat 디자인 선정)
- Supabase (PostgreSQL + RLS) — Seoul. 간사 인증은 **CCC 로그인 + 자체 세션** (Supabase Auth/Google OAuth 미사용)
- Vercel (기본 도메인, custom 도메인 X)

### 9.2 채팅 — Firebase Firestore (asia-northeast3)
- onSnapshot 실시간, offline 캐시, 무료 plan
- 간사 세션(또는 학생 예약번호) 인증 후 Firebase Custom Token (Admin SDK)

### 9.3 PWA + 푸시
- `next-pwa` + manifest + service worker
- **FCM** (Firebase Cloud Messaging) 무료
- **학생 진입 = 옵션 C** (바로 웹, "홈 화면 추가"는 부드러운 배너, 첫 매칭 paid 시 권유)
- iOS 16.4+ + 홈 화면 추가 시 푸시 가능
- 카톡 내장 브라우저 → "Safari로 열기" 안내
- **간사·학생 모두 푸시 = 옵트인** (CCC 전용 앱 없음 — 카톡 내장이면 인앱만, 크롬·사파리 + 홈화면 추가 시 푸시)
- **iOS PWA QA 체크리스트 필수** (Playwright + 실기기)

### 9.4 지도 — 카카오맵 SDK + 지오코딩

### 9.5 알림 (이메일 X, 카카오 알림톡·SMS X)
- 인앱: `notifications` + Supabase Realtime
- 푸시: FCM (홈화면 추가 시)
- **발송 실패 3회 재시도** (1m → 5m → 30m) → 마스터 알림

### 9.6 모니터링
- Sentry 무료 plan
- 핵심 이벤트 트래킹

### 9.7 테스트
- 단위: Vitest (`lib/matching/*` 90%+, `lib/settlement/*` 90%+)
- 통합: Vitest + Supabase 로컬
- **E2E: Playwright (V1 필수) — S1·S4·S5 + iOS PWA 푸시 검증 포함**
- 정적: TypeScript strict + ESLint

### 9.8 CI/CD
- GitHub Actions: PR → typecheck + lint + test + build → Vercel Preview
- main 머지 → prod 자동
- gitleaks 시크릿 스캔

### 9.9 백업
- Supabase 무료 plan 자동 백업만 (추가 비용 X)

### 9.10 자동 작업 (cron)
- **익명화** (#15): 매일 새벽 3시 KST. 수련회 종료 + 90일 지난 row 처리
- 송금 지연 리마인더: 주기적 (자동 만료 아님 — 자리 회수 X, 알림만)
- 알림 재시도: 위 정책

### 9.11 보안
- RLS + Firestore Rules
- 시크릿 1Password + `.env.local`
- 마스터 비번 16자+ · 90일 rotation 권장

---

## 10. 개인정보 처리방침 (PIPA)

### 10.1 수집
| 대상 | 항목 |
|---|---|
| 간사 | CCC 식별자(ccc_id)·이름·전화·소속지구·캠퍼스 (이메일·성별 미수집) |
| 학생 | 이름·전화·학교/소속·메모 |
| 정산 | 매칭 금액·계좌 |
| 위치 정보 | 출발지·도착지 주소·좌표 (간사가 가입 시 등록) |

### 10.2 목적
차량 매칭·정산 ledger·운행 안내·현장 소통

### 10.3 보관·익명화 (#15)
- 수련회 종료 + **90일** 보관
- 이후 **매일 새벽 3시 자동 익명화** (이름→"○○○", 전화·이메일 해시)
- 익명화 후 통계 보관 (집계만)
- 회계 의무 5년 (개인 식별 마스킹)
- 마스터 화면에 익명화 D-day 카운트다운

**왜 익명화?**
- PIPA 원칙: 수집 목적 달성 후 지체 없이 파기
- 익명화 = 개인정보 X로 변환 → PIPA 대상 외 (자유 보관)
- 안 하면 위법 (과태료·신뢰 ↓)

### 10.4 제3자 제공
매칭 양측 지구 간사만. 외부 X.

### 10.5 처리위탁
| 위탁 | 용도 | 위치 |
|---|---|---|
| Supabase | DB·인증 | Seoul |
| Firebase | 채팅·FCM | asia-northeast3 |
| Vercel | 호스팅 | 글로벌 CDN (정적) |
| 카카오 | 지도 SDK | 한국 |

### 10.6 사용자 권리
열람·정정·삭제·처리정지 → [출시 직전 — CCC IT 사역부 공식 이메일] → 10일 내

### 10.7 동의
- 간사: 가입 시 필수
- 학생: 신청 지구 간사 confirm 체크박스

### 10.8 보안
HTTPS · RLS · Firestore Rules · 1Password · 마스터 비번 · 접근 로그

### 10.9 책임자
- 부서: **CCC IT 사역부**
- 이메일: [출시 직전 확정]

### 10.10 국외 이전
주요 데이터 Seoul. 정적 자산만 Vercel CDN.

### 10.11 민감정보·미성년자
처리 X.

### 10.12 로그 보관
| 종류 | 기간 |
|---|---|
| 접근 (auth) | 1년 |
| 운영 (master) | 5년 |
| 거절 | 5년 |
| 알림 발송 | 1년 |
| Sentry 에러 | 90일 |
| 매칭 이력 | 영구 (익명화 후) |

---

## 11. 확정 결정 (v1.0 Confirmed Final)

| # | 안건 | 결정 |
|---|---|---|
| K1 | 매칭 후 공급 측 자의 취소 | **불가능** + 승인 전 안내 |
| K2 | 재신청 추천 UI | 자리 풀릴 때마다 알림 (B) |
| K3 | 학생 검증 | 이름 + 전화 끝 4자리 |
| K5 | public 전환 | 완성 후 |
| M1 | 알림 채널 | 인앱 + PWA 푸시 (이메일 X) |
| M2 | 간사 가입 | CCC 로그인 → 가입 → 마스터 승인 → 지구(자동/할당) + location 등록 (v1.1) |
| M3 | 학생 자의 취소 | 가능 + 양쪽 간사 알림 + **"환불은 각 지구로 문의" 문구** |
| M4 | 90일 후 자동 익명화 | 매일 새벽 3시 KST, 마스터 화면 D-day |
| M5 | 운영 시나리오 | 장애 시 마스터 알림 |
| M6 | 단일 출발지 | 확정 |
| M7 | 백업 | 무료 plan만 |
| M8 | 로그 보관 | §10.12 |
| N1 | 일정 | 팀장 관리 |
| N2 | 도메인 | Vercel 기본 |
| N3 | 베타 | 없음, 더미 → 실전 |
| N4 | 결제 | 직접 송금만 |
| N5 | 사후 정산 | 캠퍼스 자율 (시스템 = ledger만) |
| N7 | 마스터 비번 | 16자+ · 1Password · 90일 rotation |
| N8 | 우선순위 서버 검증 | DB unique + API Zod |
| N9 | 동기화 파이프라인 | AI 자동 (CLAUDE.md 강제 절차) |
| N13 | 거절 모니터링 | V1 단순, V2 임계값 |
| 부분 매칭 | **간사 수동 선택** (우선순위 = 힌트, v1.1) |
| 잔여 row priority | **재정렬 없음** — 큐 잔류 (v1.1) |
| 카카오톡 알림 | V2 |
| PWA | V1 도입 (FCM, iOS QA 강화, 학생 진입 = C) |
| E2E | V1 필수 (iOS PWA 푸시 포함) |
| carbus-web | 별개 |
| "팀장" 표기 | 개인 별명 비공개 |
| **마스터 인증** | **비번 only** (OAuth X) |
| **간사 인증 (v1.1)** | **CCC 로그인** + 자체 세션 + 마스터 승인 (Google OAuth 폐기) |
| **매칭 승인 (v1.1)** | 시각순 정렬 + **간사 수동 선택** (FIFO 강제 해제) |
| **송금 만료 (v1.1)** | **자동 만료 폐지** — 소프트 리마인더 + 수동 [자리 풀기] |
| **PWA 푸시 (v1.1)** | 간사·학생 모두 **옵트인** (조회 항상, 푸시 선택) |
| **계좌 추적 (v1.1)** | **안 함** — 수동 송금완료/입금확인 (간사 확인 재확인) |
| **간사 가입 시 location 등록** | 상행 출발·하행 출발·하행 도착 N개 |
| **출발지 미지정 패널티** | **제거** (location 등록으로 해결) |
| **티켓 번호** | `BUS-XXXX` 30자 셋 (혼동 글자 제외) |
| 디자인 선정 | **Claude chat에서 mock 후보 → 팀 선정 → 코드 반영** |
| 간사 정보 수정 | 이름·전화 자유 / 지구 변경 마스터 재승인 |
| Trip 수정 시점 | 매칭 전 자유 / 매칭 후 정원↑·시간·location 알림 / D-1 이후 강한 안내 |
| 학생 여러 매칭 | `/me` 다중 카드 |
| 간사 권한 해제 | `/admin/operators` 비활성화 + 알림 |
| 학생 취소 시점 제한 | 없음 (D-1 이후 강한 안내) |
| 알림 발송 실패 | 3회 재시도 → 마스터 알림 |
| iOS PWA QA | Playwright + 실기기 (16.4+ / 16.4 미만 분기) |
| 마스터 비번 분실 | 1Password 의무, 새 hash → env 갱신 |

---

## 12. 비기능 요구사항

| 항목 | 요구 |
|---|---|
| 반응성 | 모바일 우선 iPhone 13 (375~390px) |
| 언어 | 한국어 |
| PWA | manifest + sw + FCM, 학생 진입 C |
| 오프라인 | Firestore 캐시 + PWA `/offline` |
| 접근성 | 시맨틱 · alt · label · 키보드 |
| 보안 | RLS · Firestore Rules · 시크릿 1Password · 마스터 비번 |
| 확장 | 52개 지구 + 수련회당 수천 |
| 개인정보 | 최소 수집 · 90일 후 매일 새벽 익명화 |
| 테스트 | 단위 90%+ (코어) · 통합 핵심 · **E2E 필수 (iOS PWA 푸시)** |

---

## 13. 일정·운영

- 일정 = 팀장 관리 (AI 페이스)
- 운영 목표: 2026 여름 수련회
- 베타 없음, 더미 → 실전

---

## 14. V2 / 장기 안건 (구현 X, 명시만)

| 안건 | 정책 |
|---|---|
| 카카오톡 알림톡 | 사업자 등록 가능 시 |
| SMS 백업 | 마스터 수동 발송용 |
| 자동 배차 추천 | 김도영 기획 참조 |
| 카풀 | 안전·책임 이슈 |
| 통계·분석 | 다음 해 계획 |
| **지구 내 차량 관리** (차량 인벤토리 버스44/스타렉스11/자차4 + 지구 내 학생 신청) | **V1.5 stretch** (시간 남으면 — 간사 요청) |
| `/help` 운영자 가이드 | V1.5 |
| 학생 푸시 ON/OFF 설정 | V1.5 |
| 다크 모드 | V2 |
| 다국어 (외국인사역부) | V2 |
| 거절 임계값 모니터링 | V2 |

---

## 15. 도구 분담 + 세션 손실 방지 (개발 워크플로)

자세한 워크플로는 저장소 `CLAUDE.md`·`COWORK.md`·`ONBOARDING.md` 참조.

### 도구 분담
| 도구 | 잘하는 것 |
|---|---|
| Claude Code (CC) | 코드·터미널·git·DB SQL·테스트 |
| Cowork | Supabase·Vercel·Firebase·GitHub UI·브라우저 실시간 |
| Claude Chat | UI 디자인 mock·copy·기획 논의·와이어프레임 |

### 세션 손실 방지
- `WORKLOG.md` — 작업 진행 (AI 자동 갱신)
- `docs/SESSION-HANDOFF.md` — 도구 전환 인계 (AI 자동 작성)
- `docs/AI-PROMPTS/*.md` — 도구별 자주 쓰는 프롬프트 템플릿
- CLAUDE.md·AGENTS.md에 자동 절차 강제

---

## 16. 관련 문서

- `docs/SPEC.md` — 이 문서 (코드 저장소 사본)
- `docs/OVERVIEW.md` — 외부 공유
- `docs/REGIONS.md` — 52개 지구
- `data/regions.csv` — seed
- `CLAUDE.md` / `AGENTS.md` — AI 컨텍스트
- `ONBOARDING.md`, `CONTRIBUTING.md`, `COWORK.md`
- `WORKLOG.md`, `docs/SESSION-HANDOFF.md`, `docs/AI-PROMPTS/`
- `CHANGELOG.md`

---

## 17. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-26 | v0.1 초안 |
| 2026-05-26 | v0.2 — 부분 매칭 학생 선택·FIFO 강제·24h Phase 1/2·자동 promotion 제거·Trip published 채팅·송금 스크린샷 제거·D-12h 잠금·CCC IT 사역부 책임자·PWA 미도입·PIPA 신설 |
| 2026-05-26 | v0.3 — 부분 매칭 응답 중 잔여 변동 실시간·partial_offers 슬라이스·정책 1B/2/3 |
| 2026-05-27 | **v1.0 Confirmed** — 17개 미해결 안건 결정 + 우선순위 기반 자동 부분 매칭 (partial_offers 제거) + PWA V1 도입 + E2E 필수 |
| 2026-05-27 | **v1.0 Confirmed Final** — 추가 결정 11개 + 핵심 단순화: ① **마스터 인증 = 비번 only** (OAuth 제거) ② **간사 가입 시 출발/도착지 등록** (region_locations 신설) → **출발지 미지정 패널티 전부 제거** ③ 디자인 = Claude chat 선정 ④ PWA 학생 진입 = C (시점별 권유) ⑤ 티켓 번호 `BUS-XXXX` 30자 셋 ⑥ 잔여 row priority 재정렬 ⑦ K2 자리 풀릴 때마다 알림 ⑧ 학생 자의 취소 시 "환불은 각 지구로 문의" 문구 ⑨ Trip 수정 단계화 ⑩ 익명화 매일 새벽 3시 ⑪ 알림 발송 3회 재시도 ⑫ 도구 분담 + 세션 손실 방지 (§15) |
| 2026-05-30 | **v1.1 — 간사 피드백 반영**: ① 간사 = **CCC 로그인** (Google OAuth 폐기, `operators.google_uid`→`ccc_id`, +campus·ccc_role) ② 매칭 = **시각순 정렬 + 간사 수동 선택** (FIFO 강제·자동 부분매칭·자동 후속매칭·자동 거절 제거, priority=힌트) ③ 송금 = **자동 만료 폐지** → 소프트 리마인더 + 수동 [자리 풀기] ④ 학생·간사 PWA = **옵트인** ⑤ 이메일·성별 **미수집** ⑥ 지구 내 차량 관리 = **V1.5 stretch** |
