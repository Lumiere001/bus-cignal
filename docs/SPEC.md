---
agent: claude-code
status: finalized
created: 2026-05-26T15:00:00+09:00
last_modified: 2026-05-27T18:00:00+09:00
awaiting_approval: false
priority: high
tags: [bus-cignal, planning, project, finalized, v1]
---

# Bus Cignal — 서비스 기획안 v1.0 (Confirmed)

> CCC 전국 여름 수련회 **타지구 차량 매칭·정산·소통 통합 시스템**
> 운영 주체: **CCC IT 사역부** / 운영 목표: 2026 여름 수련회
> **v1.0 Confirmed (2026-05-27)** — 팀 회의·미해결 안건 전부 결정 완료. 본격 개발 진입.

---

## 0. 30초 요약

- **현행 문제**: 카톡 오픈채팅 선착순 손들기 → 순서 분쟁·메시지 묻힘·명단 누락·정산 불투명·학생↔담당자 단절
- **해결**:
  - 신청 슬라이스 **FIFO 큐** + 공급 지구 **수동 승인 (큐 1번째만 활성)**
  - **부분 매칭은 우선순위 기반 자동** — 간사가 학생 등록 시 우선순위 부여, 잔여 자리만큼 자동 매칭
  - 송금 데드라인 = 매칭 → 요청 지구 "송금 완료" 클릭까지 **24h** (자동 만료)
  - 송금 완료 후 공급 지구는 시간 제한 없음 (단 미입금 시 매칭 취소 권한)
  - **매칭 후 공급 측 취소 = 불가능** (승인 전 신중 안내)
  - **학생 자의적 취소 가능** — 양쪽 지구 간사에게 자동 알림
  - 만료/취소 시 **자동 promotion 없음** — 자리 풀리면 큐 1번에 노출, 공급 지구가 재승인
  - **K2 재신청 추천 UI** — 거절·만료된 신청에 "자리 났어요" 알림
  - 예약번호 학생 진입 (**이름 + 전화 끝 4자리** 검증) + Trip 단위 채팅
  - 지구별 정산 매트릭스
- **사용자**: 마스터 (CCC IT 사역부) · 차량 간사 N명(전국 지구) · 학생 수련회당 수백~수천
- **기술**: Next.js 15 + Supabase + **Firebase Firestore (채팅)** + 카카오맵 SDK + **PWA (푸시 알림)** + Vercel
- **공급 형태**: **PWA (반응형 웹 + 홈 화면 추가 + 푸시 알림)**

---

## 1. 배경

### 1.1 도메인 — 무엇이 일어나는가
CCC 전국 여름 수련회는 평창에서 진행. 학생은 두 단계로 차량 필요:
- **상행**: 본인이 현재 머무는 지역(보통 학교) → 평창
- **하행**: 평창 → 본가가 있는 지역

본인 소속 지구(학교 지역)와 본가 지역이 다르면 **타지구 차량**을 타야 함.

지구마다 평창까지의 거리가 달라 **요금이 다름** → 고정가 불가, 매칭 후 지구간 직접 송금.

### 1.2 현행 비효율
| 문제 | 영향 |
|---|---|
| 선착순 판정이 채팅 순서 기반 | 분쟁·누락 가능 |
| 메시지 묻힘 (활동량 많은 톡방) | 자리 놓침 |
| 송금 확인이 1:1로 분산 | 중복 송금·누락 발생 |
| 학생 명단이 자투리 톡으로 확정 | 누락 발생, 당일 미탑승 사고 |
| 정산이 사람 머릿속에만 | 회계 불투명, 사후 추적 어려움 |
| 본인 지구 차가 먼저 떠난 후 학생이 타지구 차 타는 경우 | 본인 지구 간사 관리 불가능 |

### 1.3 carbus-web과의 관계
**별개 프로젝트.** carbus-web은 광주지구 내부 운영(단일 지구), Bus Cignal은 전국 지구 간 매칭(N:N). 코드 자체는 별도, 다만 **패턴·UI 컴포넌트는 학습 source**로 참고 가능.

### 1.4 목표
1. **공정성**: timestamp + FIFO 강제 + 우선순위
2. **투명성**: ledger·매트릭스
3. **학생 직접 접근**: 예약번호 + 본인 매칭·지도·간사·채팅·취소
4. **현장 소통**: 운행 전·당일 채팅 (PWA 푸시)
5. **확장**: 전국 52개 지구

---

## 2. 사용자 페르소나

### 2.1 마스터 (Master) — CCC IT 사역부
- 시스템 전체 관리·이상상황 개입
- 간사 가입 승인·지구 부여
- 마감일·점검 모드 settings
- 거절 발생 모니터링 (V1 단순 알림, V2 임계값)
- 전국 정산 매트릭스 열람
- 출발지 미지정 위험 Trip 직접 카톡·전화 개입
- **인증**: Google OAuth + 마스터 비밀번호 (24h 세션, 5회 실패 1h 잠금, 16자+ 권장)

### 2.2 차량 간사 (Bus Operator)
- 지구마다 1~2명
- 본인 지구 Trip CRUD (운행·정원·요금·출발지)
- 본인 Trip의 타지구 자리 공개 (Offer)
- 다른 지구 Trip 검색 + 신청 (학생 명단 + **우선순위 부여**)
- 매칭 큐 승인·거절 (큐 1번째만)
- 송금 완료 알림 / 입금 확인
- 본인 지구 정산 조회
- **인증 흐름**: Google OAuth 가입 → 본인 지구 선택 → **마스터 승인 대기** → 승인 후 지구 페이지 관리

### 2.3 학생 (Passenger)
- 별도 가입 없음
- **인증**: 예약번호(BUS-XXXX) + 본인 이름 + 전화 끝 4자리 (둘 다 검증)
- 본인 매칭 조회 (어느 차·어디서·언제·얼마)
- 출발지 지도 (카카오맵 임베드)
- 담당 간사 연락처
- Trip 그룹 채팅 (사전 질문·당일 소통)
- **자의적 매칭 취소** — 양쪽 지구 간사에게 자동 알림
- PWA 푸시 알림 (옵션, 홈 화면 추가 시)

---

## 3. 핵심 시나리오

### S1. 공급 지구 — 차량 등록 + 자리 공개

**행위자**: 광주지구 차량 간사 A

1. A가 Google 계정 로그인 → 지구 선택 후 가입 → 마스터 승인 받음
2. `/operator/trips/new` 진입
3. Trip 정보:
   - 방향: 하행
   - 출발지: 평창 (자동), 도착지: 광주
   - 출발 시각: 2026-07-30 14:00
   - 정원: 44석, 요금: 35,000원
   - 출발 주소: 입력 가능 (D-12h 마지노선)
   - 메모: "13:50까지 모이세요" (500자 이내)
4. 본인 지구 배차 후 남는 자리 10개 → "타지구 공개" 토글 ON → SeatOffer 생성

### S2. 수요 지구 — 신청

**행위자**: 부산지구 차량 간사 B

1. `/operator/requests/new` → 검색 (출발지·도착지·날짜)
2. Trip 카드 선택 → 학생 명단 입력 폼
3. **각 학생에 우선순위 부여** (입력 순 default 1·2·3·4·5, 명시 수정 가능)
   - 학생 1 (우선순위 1): 김○○, 010-XXXX-1234, 부산대
   - 학생 2 (우선순위 2): 박○○, 010-XXXX-5678, 부경대
   - …
4. **개인정보 동의 confirm 체크박스** 필수
5. SeatRequest 생성 (requested_at=NOW, status=queued)
6. 큐 진입 → 공급 지구 간사에게 인앱 + PWA 푸시 알림

### S3. 매칭 승인 (FIFO 강제 + 우선순위 자동 부분 매칭)

**FIFO 강제**: 매칭 큐 테이블에서 **1번째 요청에만 [승인]·[거절] 버튼 활성화**. 친한 지구 선별 차단.

**행위자**: 광주지구 A

1. A 알림 받음 → `/operator/trips/:id`
2. 매칭 큐 1번째: 부산 5명 (B의 신청)
3. A가 [승인] 클릭 — **승인 전 안내**:
   > "승인 후 매칭이 확정되면 공급 지구 본인 사정으로 취소가 불가능합니다. 신중하게 진행해 주세요."
4. [승인 확정]:
   - **잔여 ≥ 5**: 5명 전체 자동 매칭 (Match 5개, 각 24h Phase 1 시작)
   - **잔여 = 3**: 우선순위 1·2·3 자동 매칭 (Match 3개), 4·5는 큐 잔류 (parent_request_id, requested_at 원본 유지)
   - **잔여 = 0**: 자동 거절 + 마스터 알림 (정책 3)
5. B에게 알림: "매칭 확정, 24h 내 송금 완료 클릭"
6. 큐 다음 항목이 자동으로 1번째가 됨

**거절 케이스**: [거절] + 사유 10자 이상 입력 필수 → SeatRequest.status = rejected, B 알림 + 마스터 알림 (단순 로그, 임계값 X)

**잔여 자리 변동 (다른 매칭 만료·취소·학생 취소)**:
- 잔여 자리 증가 → 큐 잔류 row의 우선순위 다음 학생 즉시 자동 매칭
- 별도 응답 데드라인 없음 (간사 개입 X)

### S4. 송금 + Confirm + 만료

**Happy path**:
1. B 매칭 화면 → 송금 정보 (광주지구 계좌, 175,000 = 5 × 35,000)
2. B 실제 송금
3. B "송금 완료" 클릭 → Match.payment_reported_at = NOW, status = payment_reported
4. A 통장 확인 후 [입금 확인] → Match.paid_at = NOW, status = paid
5. **예약번호 발급** (각 학생 1개씩, 예: `BUS-7K9M`)
6. B 화면에 학생별 안내 문구 + [복사] 버튼:
   ```
   [수련회 차량] 평창→부산 7/30(수) 14:00 출발
   김○○님 예약번호: BUS-7K9M
   링크: https://buscignal.app/r/BUS-7K9M
   본인 이름 + 전화 끝 4자리로 접속
   ```

**Sad path 1 — Phase 1 만료**:
- matched_at + 23h: B에게 "1시간 후 만료" 알림
- matched_at + 24h, payment_reported_at = NULL → 자동 expire
- Match.status = expired, 자리 풀림, 큐 다음으로 (수동 promotion)
- **K2 재신청 추천**: B 화면에 "자리 다시 났어요" 알림 + [재신청] 버튼 (학생 prefill)

**Sad path 2 — Phase 2 취소 (송금 보고 후 미입금)**:
- B가 "송금 완료" 눌렀지만 실제 입금 없음
- A [매칭 취소] 클릭 (시간 제한 없음, 권장 24h 후) + 사유 입력
- Match.status = cancelled, 자리 풀림

**★ K1 매칭 후 공급 측 자의적 취소 = 불가능**
- 입금 받은 (status=paid) 매칭은 공급 지구가 임의로 취소 불가
- A 화면 매칭 ledger에 [매칭 취소] 버튼 = `payment_reported` 상태에서만 활성
- `paid` 상태는 학생 취소 또는 시스템 외 협의로만

### S5. 학생 접속

**행위자**: 부산지구 학생 김○○

1. B로부터 카톡으로 예약번호 + 링크 받음
2. 링크 탭 → `/r/BUS-7K9M`
3. 인증: "본인 이름과 전화 끝 4자리" 입력 → 검증
4. 세션 쿠키 30일
5. `/me` 학생 대시보드:
   - 매칭 카드 (노선·시간·요금·예약번호)
   - 출발지 카드 (카카오맵 임베드 + "앱으로 열기")
   - 담당 간사 카드 (이름·전화·카톡 ID)
   - [Trip 채팅 입장]
   - [매칭 취소] 버튼 ← S5a

### S5a. 학생 자의적 매칭 취소 (M3 신규)

1. 학생이 `/me/cancel/:matchId` 진입 또는 매칭 카드에서 [취소] 클릭
2. 확인 모달: "정말 취소하시겠어요? 환불은 양 지구 간사를 통해 진행됩니다."
3. 선택 시 사유 입력 (선택 필드, 짧은 메모)
4. Match.status = cancelled, cancellation_source = passenger
5. **양쪽 지구 간사에게 자동 알림** (인앱 + PWA 푸시):
   - "학생 김○○이 매칭을 취소했습니다 (사유: ...)"
6. 자리 풀림 → 큐 다음으로 (수동 promotion)
7. **환불 처리는 시스템 외** — 캠퍼스 간 사적 합의

### S6. 채팅 (Trip 생성 시점부터 활성)

- Trip published 시점부터 채널 자동 생성
- 공급 지구 간사: 즉시 입장 가능 (관리자)
- 신청 지구 간사: 본인 지구 학생 매칭된 시점부터
- 학생: 매칭 paid 시점부터 (시간 제한 X)
- 메시지: Firestore document, offline 캐시, sent/delivered/read
- **PWA 푸시 알림** (옵션, 학생이 채팅별 ON/OFF 가능)

### S7. 정산 (시스템 = ledger 표만 제공, 사후 처리는 캠퍼스 자율)

**일반 간사 (B, 부산지구)**:
- `/operator/settlement` — 받을 돈·보낼 돈 표 + 합계 + CSV 내보내기
- 본인 지구 관련 데이터만 노출

**마스터**:
- `/admin/settlement` — 전국 N×N 매트릭스 + 셀 클릭 ledger + CSV

**N5 사후 정산** = **시스템 책임 없음**. 운행 후 환불·노쇼·추가 탑승은 캠퍼스 간 사적 합의. 시스템은 ledger 표로 양쪽 간사가 체크·관리 가능하게만 함.

### S8. 출발지 미지정 패널티

**알림 단계** (인앱 + PWA 푸시, 외부 SMS X):
| 시점 | 동작 |
|---|---|
| D-72h | 인앱 알림 + 노란 배너 |
| D-48h | 빨간 배너 |
| D-24h | 마스터 인앱 알림 (위험 Trip) |
| **D-12h** | **공급 지구 간사 화면 풀스크린 잠금 모달** |
| D-1h | 마스터에게 강한 경고 → 직접 카톡·전화 개입 |

**풀스크린 잠금 모달** (D-12h): 출발지 입력 전엔 다른 작업 불가.

**마스터 뷰** (`/admin/risk-trips`): 미지정 Trip 모아보기, 책임 간사 [전화] [카톡 ID 복사].

### S9. 시스템 알림 (인앱 + PWA 푸시, 이메일 X)

이메일 발송 X (사람 많아 발송 한계). 채널: **인앱 알림** + **PWA 푸시 알림**(홈 화면 추가 시).

| 이벤트 | 대상 | 인앱 | 푸시 |
|---|---|---|---|
| 매칭 큐 신규 신청 | 공급 지구 | ⭕ | ⭕ |
| 매칭 확정 | 신청 지구 | ⭕ | ⭕ |
| 매칭 거절 + 사유 | 신청 지구 | ⭕ | ⭕ |
| 부분 매칭 자동 처리 | 양쪽 | ⭕ | ⭕ |
| 송금 데드라인 D-1h | 신청 지구 | ⭕ | ⭕ |
| Phase 1 만료 (자동) | 양쪽 | ⭕ | ⭕ |
| 송금 완료 보고 | 공급 지구 | ⭕ | ⭕ |
| 입금 확인 + 예약번호 발급 | 신청 지구 + 학생 | ⭕ | ⭕ |
| 매칭 취소 (Phase 2) | 신청 지구 | ⭕ | ⭕ |
| 학생 자의적 취소 | 양쪽 간사 | ⭕ | ⭕ |
| 자리 다시 풀림 (큐 잔류) | 신청 지구 | ⭕ | ⭕ |
| 출발 D-1 | 양쪽 + 학생 | ⭕ | ⭕ |
| 출발 D-1h | 양쪽 + 학생 | ⭕ | ⭕ |
| 출발지 미지정 단계별 | 공급 지구 + 마스터 | ⭕ | ⭕ |
| 출발지 변경 | 양쪽 + 학생 | ⭕ | ⭕ |
| 거절 발생 | 마스터 | ⭕ | ⭕ |
| 시스템 장애 | 마스터 | ⭕ | ⭕ |
| 채팅 새 메시지 | 양쪽 + 학생 | ⭕ | 🟡 (사용자 ON/OFF) |

총 18개 이벤트. PWA 푸시 도구: **Firebase Cloud Messaging (FCM)** 무료.

---

## 4. 화면 구성 (Sitemap)

### 4.1 공통
- `/` 랜딩 — 간사 로그인 vs 학생 예약번호 분기
- `/login` Google OAuth + 마스터 2단계 비번
- `/signup` 간사 신규 가입 (이름·전화·소속 지구 선택)
- `/pending` 마스터 승인 대기 화면
- `/r/:code` 학생 예약번호 진입 → 이름 + 전화 끝 4자리
- `/chat/:tripId` Trip 채팅 (간사·학생 권한 분기)
- `/privacy` 개인정보 처리방침
- `/terms` 이용약관
- `/offline` PWA 오프라인 fallback
- `/404`, `/500` 에러

### 4.2 간사
- `/operator` 대시보드
- `/operator/trips` 본인 지구 Trip 목록
- `/operator/trips/new` Trip 생성
- `/operator/trips/:id` Trip 상세 (Offer·매칭 큐·승인·송금 confirm)
- `/operator/requests` 내가 한 신청 목록 (상태별 탭)
- `/operator/requests/new` Trip 검색 + 학생 명단 + **우선순위**
- `/operator/requests/:id` 신청 상세
- `/operator/matches` 매칭 ledger (수신·발신, 별도 페이지)
- `/operator/settlement` 본인 지구 정산
- `/operator/profile` 프로필·지구 계좌

### 4.3 학생
- `/me` 매칭 대시보드
- `/me/trip/:id` Trip 상세
- `/me/cancel/:matchId` 자의적 취소 ← 신규

### 4.4 마스터
- `/admin` 전국 대시보드 (익명화 시점 카운트다운 포함)
- `/admin/regions` 지구 CRUD
- `/admin/operators` 간사 권한 관리
- `/admin/operators/pending` 승인 대기 간사 목록 ← 신규
- `/admin/trips` 전체 Trip 모니터링
- `/admin/risk-trips` 출발지 미지정 위험
- `/admin/matches` 전체 매칭 ledger
- `/admin/settlement` 전국 매트릭스
- `/admin/rejections` 거절 발생 단순 알림 목록 ← 신규
- `/admin/system` 신청 마감일·점검 모드·로그

**총 33개 페이지.**

### 4.5 PWA 인프라
- `app/manifest.ts`
- `app/sw.ts` (service worker)
- `public/icons/` (다양한 크기 아이콘)
- FCM 통합

---

## 5. 주요 화면 상세

### 5.1 디자인 시스템
| 영역 | 결정 |
|---|---|
| UI | shadcn/ui (Radix 기반) |
| CSS | Tailwind |
| 색상 | Primary Blue (신뢰) / Accent Green (성공) / Warning Yellow / Danger Red |
| 폰트 | Pretendard (한글 최적) |
| 아이콘 | Lucide React |
| 모바일 우선 | iPhone 13 baseline (375~390px) |
| 다크 모드 | V2 |

### 5.2 Copy 톤
| 사용자 | 톤 |
|---|---|
| 학생 | 친근·존댓말·"○○님" 호칭·간결 |
| 간사 | 명확·정보 위주·액션 명시 |
| 시스템 메시지 | 객관·짧음 |
| 에러 | 친절·다음 단계 안내 |

### 5.3 `/operator` 대시보드
```
┌─ 오늘 알림 ─────────────────────────┐
│ • [긴급] 부산→광주 매칭 만료 1h 전 │
│ • [신규] 대구지구 5명 신청           │
│ • [재신청 추천] 자리 1자리 풀림      │
└─────────────────────────────────────┘

┌─ 내 Trip ───────────────────────────┐
│ 광주→평창 7/26(월) 09:00 — 잔여 5  │
└─────────────────────────────────────┘

┌─ 정산 요약 ─────────────────────────┐
│ 받을: 245,000 · 보낼: 105,000      │
└─────────────────────────────────────┘
```

### 5.4 `/operator/requests/new` (우선순위 부여)
```
[학생 명단 + 우선순위]
1️⃣ 김○○ · 010-XXXX-1234 · 부산대  [↑↓]
2️⃣ 박○○ · 010-XXXX-5678 · 부경대  [↑↓]
3️⃣ 이○○ · 010-XXXX-9012 · 부산대  [↑↓]
4️⃣ 최○○ · 010-XXXX-3456 · 부산대  [↑↓]
5️⃣ 정○○ · 010-XXXX-7890 · 부경대  [↑↓]

※ 잔여 자리 부족 시 우선순위 1번부터 매칭됩니다.

☐ 위 학생들의 개인정보 처리에 대해 본인 동의를 받았음을 확인합니다.

[신청]
```

### 5.5 `/operator/trips/:id` 매칭 큐 (FIFO 강제 + 승인 안내)
```
[매칭 큐]
1번  부산지구 5명  7/15 10:30  queued  [승인] [거절]
2번  대구지구 5명  7/15 11:05  queued  🔒 1번 처리 후

[승인 안내 모달]
⚠️ 승인 후 공급 지구 본인 사정으로 매칭 취소가 불가능합니다.
   학생이 자의 취소하거나 송금 미완료 시에만 자리가 풀립니다.
   신중하게 진행해 주세요.
   
[취소] [승인 확정]
```

### 5.6 `/me` 학생 대시보드
```
안녕하세요, 김○○님!

┌─ 평창 → 부산 ──────────────────────┐
│ 2026-07-30 (수) 14:00              │
│ 부산지구 차량 / 35,000원            │
│ 예약번호: BUS-7K9M                  │
└─────────────────────────────────────┘

┌─ 어디서 타나요? ────────────────────┐
│ 강원특별자치도 평창군 봉평면 ○○로 123│
│ [지도]                              │
│ [카카오맵 앱으로 열기]              │
└─────────────────────────────────────┘

┌─ 담당 간사 ─────────────────────────┐
│ 김광주 (광주지구) 📞 [전화] 💬 카톡 │
└─────────────────────────────────────┘

[Trip 채팅 입장]   [매칭 취소]
```

### 5.7 `/me/cancel/:matchId` 학생 자의적 취소
```
정말 매칭을 취소하시겠어요?

⚠️ 취소 시:
  - 자리는 다른 분에게 돌아갑니다
  - 환불은 양 지구 간사를 통해 진행됩니다
  - 양쪽 지구 간사에게 자동 알림이 갑니다

취소 사유 (선택):
[                                    ]

[돌아가기] [취소 확정]
```

### 5.8 `/admin` 대시보드 (익명화 카운트다운 포함)
```
[전국 통계]
- 활성 Trip: 47
- 활성 매칭: 312
- 출발지 미지정 위험: 3 [/risk-trips]

[데이터 익명화]
수련회 종료 (2026-08-10) + 90일 후 자동 익명화 예정
→ 2026-11-08 (D-105)
```

### 5.9 `/admin/operators/pending` 가입 승인 대기
```
| 이름 | 전화 | 지원 지구 | 신청일 | 액션 |
| 박부산 | 010-XXXX | 부산지구 | 7/10 | [승인][거절] |
```

### 5.10 `/admin/rejections` 거절 발생 (V1 단순 알림)
```
| 시각 | 공급 지구 | 신청 지구 | 인원 | 사유 |
| 7/15 10:35 | 광주 | 대구 | 5 | "이미 자리 다 찼습니다" |
```

→ V1은 단순 목록만. 임계값·통계 분석은 V2.

---

## 6. 도메인 모델

```sql
regions (
  id uuid pk, code text unique, name text, area text,
  category text check (category in ('regular','special_ministry','overseas')),
  contact_phone text, bank_account text, bank_name text, account_holder text,
  created_at timestamptz
)

operators (
  id uuid pk,
  region_id uuid fk → regions null,    -- 가입 시점에는 null 가능
  google_uid text unique, email text, name text, phone text,
  requested_region_id uuid fk → regions null,  -- 가입 신청 시 본인 선택
  approval_status text check (approval_status in ('pending','approved','rejected')),
  approved_at timestamptz null,
  approved_by uuid fk → operators null,
  role text check (role in ('operator','master')),
  created_at timestamptz
)

trips (
  id uuid pk,
  operator_region_id uuid fk → regions,
  direction text check (direction in ('up','down')),
  origin_region_id uuid fk → regions null,
  destination_region_id uuid fk → regions null,
  departure_at timestamptz,
  origin_address text NULL,
  origin_lat numeric NULL, origin_lng numeric NULL,
  origin_finalized_at timestamptz NULL,
  capacity int, price_per_seat int,
  note text,  -- 500자 이내
  status text check (status in ('draft','published','closed')),
  created_at timestamptz,
  created_by uuid fk → operators
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
  requested_at timestamptz,        -- FIFO 키
  status text check (status in ('queued','matched','rejected','cancelled')),
  reject_reason text NULL,
  consent_confirmed_at timestamptz,
  consent_confirmed_by uuid fk → operators,
  created_at timestamptz
)

request_passengers (
  id uuid pk, request_id uuid fk → seat_requests,
  name text, phone text, school_or_role text, note text,
  priority int,                    -- 우선순위 (1~N, request 내 unique)
  UNIQUE (request_id, priority),
  created_at timestamptz
)

matches (
  id uuid pk,
  trip_id uuid fk → trips, request_id uuid fk → seat_requests,
  passenger_id uuid fk → request_passengers,  -- 학생 1명당 Match 1개
  matched_at timestamptz,
  payment_due_at timestamptz,           -- matched_at + 24h
  payment_reported_at timestamptz NULL,
  paid_at timestamptz NULL,
  status text check (status in ('awaiting_payment','payment_reported','paid','expired','cancelled')),
  reservation_code text unique NULL,
  cancellation_source text NULL check (cancellation_source in ('operator','passenger','system')),
  cancellation_reason text NULL,
  created_at timestamptz
)

match_passengers (
  id uuid pk, match_id uuid fk → matches,
  name text, phone text, school_or_role text,
  access_token_hash text,
  last_seen_at timestamptz NULL,
  created_at timestamptz
)

notifications (
  id uuid pk, operator_id uuid fk → operators NULL,
  passenger_id uuid fk → match_passengers NULL,
  type text, payload jsonb,
  channel text check (channel in ('in_app','push')),
  read_at timestamptz NULL, sent_at timestamptz NULL,
  created_at timestamptz
)

rejection_log (
  id uuid pk, seat_request_id uuid fk → seat_requests,
  rejected_by uuid fk → operators, reason text,
  created_at timestamptz
)

system_config (
  key text pk, value text, updated_at timestamptz, updated_by uuid fk → operators
)
```

**핵심 변경 (v0.3 → v1.0 confirmed)**:
- `partial_offers` 테이블 **제거** (우선순위 기반 자동 처리)
- `request_passengers.priority` **추가** (unique constraint)
- `matches`에 `passenger_id` 추가 (학생 1명당 Match 1개로 분리)
- `cancellation_source` 추가 (operator·passenger·system 구분)
- `notifications.channel` 추가 (in_app·push)

### Firestore (채팅)
```
channels/{tripId}/messages/{messageId}
channels/{tripId}/members/{memberId}
```
Supabase ↔ Firestore: Firebase Custom Token (Admin SDK).

---

## 7. 매칭 알고리즘 (FIFO + 우선순위 기반 자동 부분 매칭)

```
fn queue(trip):
  return SeatRequest WHERE trip_id = trip.id AND status = 'queued'
    ORDER BY requested_at ASC

fn available(trip):
  return sum(offers.seat_count where status='open')
       - sum(matches.seat_count where status IN ('awaiting_payment','payment_reported','paid'))

fn approve(request):  -- 공급 지구 [승인] 클릭
  assert request == queue(request.trip)[0]      -- 큐 1번째 강제
  avail = available(request.trip)
  passengers = request.passengers ORDER BY priority ASC
  
  if avail >= request.seat_count:
    -- 전체 매칭
    for p in passengers: Match.create(trip, request, p, payment_due_at=NOW+24h)
    request.status = 'matched'
  
  elif avail > 0:
    -- 우선순위 N명만 매칭 + 잔여 큐 잔류
    matched_passengers = passengers[:avail]
    unmatched_passengers = passengers[avail:]
    for p in matched_passengers: Match.create(trip, request, p, payment_due_at=NOW+24h)
    
    new_request = SeatRequest.create(
      parent_request_id=request.id,
      seat_count=len(unmatched_passengers),
      requested_at=request.requested_at,  -- ★ 원본 시각 유지
      status='queued'
    )
    for p in unmatched_passengers:
      RequestPassenger.move(p, new_request)  -- priority 재정렬
    
    request.status = 'matched'  -- 원본은 부분 매칭 완료
  
  else:
    -- 잔여 0: 자동 거절 + 마스터 알림 (정책 3)
    request.status = 'rejected'
    request.reject_reason = 'no_available_seat (auto)'
    notify_master(request, 'risk_event')

fn on_available_seat_increase(trip, delta):
  -- 다른 매칭이 만료·취소되어 자리 풀림
  for request in queue(trip):
    avail = available(trip)
    if avail == 0: break
    passengers = request.unmatched_passengers ORDER BY priority ASC
    take = min(len(passengers), avail)
    for p in passengers[:take]: Match.create(trip, request, p, payment_due_at=NOW+24h)
    if take == len(passengers): request.status = 'matched'

fn check_payment_phase1_timeout():  -- cron 1분
  for match in matches WHERE status='awaiting_payment' AND payment_due_at < NOW:
    match.status = 'expired'
    notify_both(match)
  -- 자동 promotion 없음. 큐 1번에 자연 노출 → A 재승인

fn cancel_match(match, source, reason):
  -- source = 'operator' (Phase 2 미입금) | 'passenger' (학생 자의)
  if source == 'operator': assert match.status == 'payment_reported'
  match.status = 'cancelled'
  match.cancellation_source = source
  match.cancellation_reason = reason
  notify_request_region(match)
  if source == 'passenger': notify_supply_region(match)
  on_available_seat_increase(match.trip, 1)
```

### Fairness 검증 — t=1 B(5), t=2 C(4), t=3 B 추가(3)
A 7자리 공급:
- B(5, priorities 1·2·3·4·5) → A 승인 → avail=7 ≥ 5 → 전체 매칭
- C(4, priorities 1·2·3·4) → A 승인 → avail=2 → C의 우선순위 1·2 매칭, 3·4 잔류 (requested_at=t=2)
- B 추가(3) → 큐 잔류 (requested_at=t=3)
→ ✅ B 우선·C 다음·B 추가 후순위 충족

---

## 8. 권한 모델 (RLS)

| Role | Trips | SeatRequests | Matches | Settlement | Chat |
|---|---|---|---|---|---|
| master | 전체 R/W | 전체 R/W | 전체 R/W | 전국 매트릭스 | 모든 Trip 입장 |
| operator | 본인 지구 W, 전체 R | 본인이 만든 것 W, 본인 지구 R | 양쪽 지구 R/W (Phase 2 cancel 권한) | 본인 지구만 | 본인 지구 + 신청 지구 Trip |
| passenger | — | — | **본인 매칭 R + cancel W** | — | 본인 매칭 Trip 입장 (paid 시점부터) |

**마스터 인증**: Google OAuth + 마스터 비밀번호 (24h 세션, 5회 실패 1h 잠금, 16자+ 권장, bcrypt)

---

## 9. 기술 스택

### 9.1 본체
- Next.js 15 App Router + TypeScript (strict)
- Tailwind + shadcn/ui
- Supabase (PostgreSQL + Auth Google OAuth + RLS) — Seoul
- Vercel 배포 (기본 도메인, custom 도메인 미사용)

### 9.2 채팅 — Firebase Firestore (asia-northeast3, 무료 plan)

### 9.3 PWA + 푸시 알림
- `next-pwa` (Next.js PWA 플러그인)
- `manifest.ts` + service worker
- **Firebase Cloud Messaging (FCM)** — 무료, Android·iOS 16.4+ 지원
- iOS는 **"홈 화면 추가" 안내 필수** (Safari·Chrome)
- 카톡 내장 브라우저 → "Safari로 열기" 안내
- QA에 **iOS 푸시 검증 필수** 포함

### 9.4 지도 — 카카오맵 JavaScript SDK

### 9.5 알림 (이메일 X)
- 인앱: `notifications` 테이블 + Supabase Realtime subscribe
- 푸시: FCM (홈 화면 추가 시)
- 이메일·SMS·카카오 알림톡: V1.0 미사용
  - 카카오 알림톡: V2 (사업자 등록 검토)
  - SMS: V2 (마스터 수동 발송 채널)

### 9.6 모니터링·에러
- **Sentry** (에러 트래킹, 무료 plan)
- 친절 한국어 에러 메시지, 일시 오류 자동 retry
- 핵심 이벤트 트래킹: matching_created, payment_reported, partial_processed, trip_chat_inactive 등

### 9.7 테스트
- **단위**: Vitest (`lib/matching/*` 90%+, `lib/settlement/*` 90%+)
- **통합**: Vitest + Supabase 로컬
- **E2E**: Playwright (S1·S4·S5 + iOS PWA 푸시 검증) — **V1 필수**
- 정적: TypeScript strict + ESLint

### 9.8 CI/CD
- GitHub Actions: PR → typecheck + lint + test + build → Vercel Preview
- main 머지 → prod 자동 배포
- 시크릿 스캔 자동 (`gitleaks`)

### 9.9 백업
- **무료 plan만** (Supabase 자동 일일 백업 무료 plan 한도 내)
- 추가 백업 인프라 비용 X

### 9.10 보안
- RLS (Supabase) + Firestore Security Rules
- 시크릿 1Password 공유 vault
- `.env.local` only, `.env.example` placeholder
- 마스터 = OAuth + 비밀번호 (16자+, 90일 rotation 권장)

---

## 10. 개인정보 처리방침 (PIPA)

### 10.1 수집 항목
| 대상 | 항목 |
|---|---|
| 간사 | 이름·이메일(Google)·전화·소속지구·역할 |
| 학생 | 이름·전화·학교/소속·메모(선택) |
| 정산 | 매칭별 금액·계좌번호 |

### 10.2 수집 목적
차량 매칭·정산 ledger·운행 안내·현장 소통

### 10.3 보관 기간
- 수련회 종료 + **90일** 보관 → 자동 익명화
- 익명화 후 통계 보관 (집계)
- 정산 데이터 회계 의무 5년 (개인 식별 마스킹)
- 마스터 화면에 **익명화 D-day 카운트다운** 표시

### 10.4 제3자 제공
매칭 양측 지구 간사 (서비스 본질). 외부 X.

### 10.5 처리위탁
| 위탁 | 용도 | 위치 |
|---|---|---|
| Supabase | DB·인증 | Seoul |
| Firebase | 채팅·FCM | asia-northeast3 |
| Vercel | 호스팅 | 글로벌 |
| 카카오 | 지도 SDK | 한국 |

### 10.6 사용자 권리
열람·정정·삭제·처리정지 요청 → **[출시 직전 — CCC IT 사역부 공식 이메일]** → 10일 내 응답

### 10.7 동의
- 간사: 가입 시 필수
- 학생: 신청 지구 간사 confirm 체크박스로 본인 동의 보증

### 10.8 보안
HTTPS · RLS · Firestore Rules · 1Password · 마스터 2단계 인증 · 접근 로그 · Supabase 자동 백업(무료)

### 10.9 책임
- 부서: **CCC IT 사역부**
- 이메일: [출시 직전 확정]

### 10.10 국외 이전
주요 데이터 Seoul. 정적 자산만 Vercel CDN.

### 10.11 민감정보·미성년자
처리 X (대학생 사역, 차량 매칭만)

### 10.12 로그 보관
| 종류 | 기간 |
|---|---|
| 접근 로그 (auth) | 1년 |
| 운영 로그 (master) | 5년 |
| 거절 로그 | 5년 |
| 알림 발송 로그 | 1년 |
| 에러 로그 (Sentry) | 90일 |
| 매칭 이력 | 영구 (익명화 후) |

---

## 11. 확정 결정 (v1.0 Confirmed)

| # | 안건 | 결정 |
|---|---|---|
| K1 | 매칭 후 공급 측 취소 | **불가능** + 승인 전 안내문 |
| K2 | 재신청 추천 UI | **도입** |
| K3 | 학생 검증 | 이름 + 전화 끝 4자리 (둘 다) |
| K5 | public 전환 시점 | 완성 후 |
| M1 | 시스템 알림 채널 | 인앱 + PWA 푸시 (이메일 X) |
| M2 | 간사 권한 부여 | 가입 → 마스터 승인 → 지구 페이지 |
| M3 | 학생 이탈 | 학생 자의적 취소 + 양쪽 간사 알림 |
| M4 | 90일 후 자동 익명화 | 마스터 화면에 D-day |
| M5 | 운영 시나리오 | 장애 시 마스터 인앱·푸시 알림 |
| M6 | 단일 출발지만 | 확정 |
| M7 | 백업 | 무료 plan만, 추가 비용 X |
| M8 | 로그 보관 | 위 §10.12 표 |
| N1 | 일정 | 팀장 관리 |
| N2 | 도메인 | Vercel 기본 |
| N3 | 베타 | 없음, 더미 → 실전 |
| N4 | 결제 | 직접 송금만 (사업자 X) |
| N5 | 사후 정산 | 시스템 외 (캠퍼스 자율) + ledger 표 제공 |
| N7 | 마스터 비번 | 16자+ · 1Password · 90일 rotation 권장 |
| N8 | 우선순위 서버 검증 | DB unique + API Zod |
| N9 | 동기화 파이프라인 | CLAUDE.md AI 자동 절차 |
| N13 | 거절 모니터링 | V1 단순 알림, V2 임계값 |
| 부분 매칭 | 우선순위 기반 자동 (2h 룰 제거) |
| 카카오톡 알림 | V2 (사업자 등록 검토) |
| PWA | **V1 도입** (iOS QA 강화) |
| E2E 테스트 | **V1 필수** (iOS PWA 푸시 포함) |
| carbus-web | 별개 프로젝트 (패턴만 학습) |
| 팀장 표기 | "팀장"·"Lead" (개인 별명 비공개) |

---

## 12. 비기능 요구사항

| 항목 | 요구 |
|---|---|
| 반응성 | 모바일 우선 iPhone 13 baseline |
| 언어 | 한국어 |
| PWA | manifest + service worker + FCM 푸시 |
| 오프라인 | Firestore 캐시 + PWA fallback (`/offline`) |
| 접근성 | 시맨틱 HTML · alt · label · 키보드 |
| 보안 | RLS · Firestore Rules · 시크릿 관리 · 마스터 2단계 |
| 확장성 | 52개 지구 + 수련회당 수천 학생 |
| 개인정보 | 최소 수집 · 90일 익명화 · 동의 confirm |
| 테스트 | 단위 90%+ (코어) · 통합 핵심 · E2E (S1·S4·S5 + iOS 푸시) |

---

## 13. 일정·운영

- 일정 = 팀장 관리 (AI 페이스 감안)
- 운영 목표: 2026 여름 수련회
- 베타 없음, 더미 → 실전
- 마일스톤은 별도 관리

---

## 14. V2 / 장기 안건 (실제 구현 X, 정책 명시)

| 안건 | 정책 |
|---|---|
| 카카오톡 알림톡 | CCC IT 사역부 명의 사업자 등록 가능 시 |
| SMS 백업 | 마스터 수동 발송용 critical 알림 |
| 자동 배차 추천 | 김도영 기획안 참조 |
| 카풀 (운전자 정보·승객 매칭) | 안전·책임 이슈, 미도입 가능 |
| 통계·분석 (수련회 후) | 다음 해 계획 자료 |
| 운영자 가이드 페이지 (`/help`) | V1.5 |
| 학생 푸시 ON/OFF 설정 | V1.5 |
| 다크 모드 | V2 |
| 다국어 (외국인사역부) | V2 |
| 거절 임계값 모니터링 | V2 |
| 매칭 거절 패턴 분석 | V2 |

---

## 15. 관련 문서

- `docs/SPEC.md` (이 문서의 코드 저장소 사본)
- `docs/OVERVIEW.md` — 외부 공유 친근 톤
- `docs/REGIONS.md` — 52개 지구
- `data/regions.csv` — seed
- `CLAUDE.md` / `AGENTS.md` — AI 컨텍스트
- `ONBOARDING.md` — 팀원 시작
- `CONTRIBUTING.md` — commit·PR·branch
- `COWORK.md` — Cowork 활용
- `CHANGELOG.md` — 변경 기록 (사람·AI용)
- `data/regions.csv` — 시드 데이터
- carbus-web: 별개 프로젝트 (패턴 학습용)

---

## 16. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-26 | v0.1 초안 (팀장 + Claude Code 협의) |
| 2026-05-26 | v0.2 — 부분 매칭 학생 선택·FIFO 강제·24h Phase 1/2·자동 promotion 제거·Trip published 채팅 활성·송금 스크린샷 제거·D-12h 풀스크린 잠금·CCC IT 사역부 책임자·PWA 미도입·PIPA 신설 |
| 2026-05-26 | v0.3 — 부분 매칭 응답 중 잔여 변동 실시간 갱신·partial_offers 슬라이스별 데드라인·정책 1B/2/3 |
| 2026-05-27 | **v1.0 Confirmed** — 팀원 기획안(이유성·김도영) 검토 후 본 안 채택. 미해결 안건 전부 결정: ① **우선순위 기반 부분 매칭** (2h 룰·partial_offers 제거) ② 학생 검증 = 이름+전화끝4자리 ③ 매칭 후 공급 측 취소 불가 + 안내문 ④ 학생 자의적 취소 + 양쪽 간사 알림 ⑤ 재신청 추천 UI 도입 ⑥ 간사 가입 → 마스터 승인 흐름 ⑦ 사후 정산 = 캠퍼스 자율 (시스템은 ledger만) ⑧ 거절 모니터링 = V1 단순 알림 ⑨ 시스템 알림 = 인앱 + PWA 푸시 (이메일 X) ⑩ **PWA V1 도입** (FCM, iOS QA 강화) ⑪ E2E 테스트 V1 필수 ⑫ 백업 무료만 ⑬ Vercel 기본 도메인 ⑭ 베타 없음 더미→실전 ⑮ public 완성 후 ⑯ "팀장"·"Lead" 표기 ⑰ carbus-web과 별개 |
