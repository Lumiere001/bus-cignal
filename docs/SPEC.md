---
agent: claude-code
status: finalized
created: 2026-05-26T15:00:00+09:00
last_modified: 2026-05-26T21:00:00+09:00
awaiting_approval: false
priority: high
tags: [bus-cignal, planning, project, finalized]
---

# Bus Cignal — 서비스 기획안 v1.0 (확정)

> CCC 전국 여름 수련회 **타지구 차량 매칭·정산·소통 통합 시스템**
> 운영 주체: **CCC IT 사역부** / 운영 목표: 2026 여름 수련회
> **v1.0 확정 (2026-05-26)**: 팀원(이유성·김도영) 기획안 검토 후 v0.3 본 안을 최종으로 채택.
> 사유: 김도영안은 단일 지구 내부 운영에 적합, 이유성안은 추상적. 본 안의 **지구 간 매칭** 도메인이 본 프로젝트 핵심에 부합.

---

## 0. 30초 요약

- **현행 문제**: 카톡 오픈채팅 선착순 손들기 → 순서 분쟁·메시지 묻힘·명단 누락·정산 불투명·학생↔담당자 단절
- **해결**:
  - 신청 슬라이스 **FIFO 큐** + 공급 지구 **수동 승인 (큐 1번째만 활성)**
  - **부분 매칭은 요청 지구가 학생 선택** (2시간 응답 데드라인)
  - 송금 데드라인 = 매칭 → 요청 지구 "송금 완료" 클릭까지 **24h** (자동 만료)
  - 송금 완료 후 공급 지구는 시간 제한 없음 (단 미입금 시 매칭 취소 권한)
  - 만료/취소 시 **자동 promotion 없음** — 자리 풀리면 큐 1번에 노출, 공급 지구가 재승인
  - 예약번호 학생 진입 + Trip 단위 채팅 (Trip 생성 시점부터 활성)
  - 지구별 정산 매트릭스
- **사용자**: 마스터 (CCC IT 사역부) · 차량 간사 N명(전국 지구) · 학생 수련회당 수백~수천
- **기술**: Next.js 15 + Supabase + **Firebase Firestore (채팅 전용)** + 카카오맵 SDK + Vercel
- **공급 형태**: **일반 반응형 웹사이트** (PWA·네이티브 X)

---

## 1. 배경

### 1.1 도메인 — 무엇이 일어나는가
CCC 전국 여름 수련회는 평창에서 진행. 학생은 두 단계로 차량 필요:
- **상행**: 본인이 현재 머무는 지역(보통 학교) → 평창
- **하행**: 평창 → 본가가 있는 지역

본인 소속 지구(학교 지역)와 본가 지역이 다르면 **타지구 차량**을 타야 함.
- 예: 광주지구 소속 학생(광주 거주), 본가 부산 → 상행은 광주지구 차량, 하행은 부산지구 차량
- 예: 광주지구 소속이지만 서울 거주 → 상행에서 서울지구 차량

지구마다 평창까지의 거리가 달라 **요금이 다름** → 고정가 불가, 매칭 후 지구간 직접 송금.

### 1.2 현행 워크플로 (카톡 오픈채팅)
1. 각 지구 차량 담당 간사가 본인 지구 배차 완료
2. 남는 자리를 전국 차량 간사 톡방에 공지
3. 다른 지구 간사들이 채팅으로 선착순 손들기 ("저희 3명 가능할까요?")
4. 매칭 후 1:1 톡으로 송금 정보 교환·확인
5. 운행 당일 학생·간사 픽업 안내도 1:1 톡

### 1.3 현행의 비효율
| 문제 | 영향 |
|---|---|
| 선착순 판정이 채팅 순서 기반 | 분쟁·누락 가능 |
| 메시지 묻힘 (활동량 많은 톡방) | 자리 놓침 |
| 송금 확인이 1:1로 분산 | 중복 송금·누락 발생 |
| 학생 명단이 자투리 톡으로 확정 | 누락 발생, 당일 미탑승 사고 |
| 정산이 사람 머릿속에만 | 회계 불투명, 사후 추적 어려움 |
| 본인 지구 차가 먼저 떠난 후 학생이 타지구 차 타는 경우 | 본인 지구 간사 관리 불가능 → 학생이 직접 공급 지구 간사와 소통 필요했음 |

### 1.4 목표
1. **공정성**: 누가 먼저 신청했는지 시스템이 timestamp로 명확히 판정 + FIFO 강제
2. **투명성**: 모든 매칭·송금·정산이 ledger로 남고 양측이 봄
3. **학생 직접 접근**: 학생이 본인 매칭·출발지·담당자·채팅에 직접 접근
4. **현장 소통**: 운행 전·당일 안정적 채팅 (유일한 소통수단이 될 수 있음)
5. **확장**: 전국 모든 지구 간사가 사용

---

## 2. 사용자 페르소나

### 2.1 마스터 (Master)
- **누구**: CCC IT 사역부 운영팀. 초기 1명, 향후 부서 내 권한 위임 가능
- **역할**: 시스템 전체 관리, 지구·간사 권한 부여, 신청 마감일·점검 모드 settings, 이상 상황 개입, 전국 정산 매트릭스 열람, 출발지 미지정 지구 수동 연락 (D-12h 이후), 거절 패턴 모니터링
- **인증**: **Google OAuth + 마스터 비밀번호 추가 인증** (24h 세션, 5회 실패 1h 잠금)

### 2.2 차량 간사 (Bus Operator)
- **누구**: 지구마다 1~2명 (전국 N×1~2)
- **역할**:
  - 본인 지구 Trip CRUD (운행 등록·정원·요금·출발지 주소·지도)
  - 본인 Trip의 타지구 자리 공개 (Offer)
  - 다른 지구 Trip 검색 + 신청 (학생 명단 포함)
  - 매칭 큐 승인·거절 (큐 1번째만)
  - 부분 매칭 시 요청 지구 학생 선택 응답
  - 송금 완료 알림 / 입금 확인 / 매칭 취소
  - 본인 지구 정산 조회
- **인증**: Google OAuth + role=operator + 지구 부여
- **숙련도 가정**: 카톡 잘 씀, 엑셀 일부 씀. 복잡한 UI 부담 → 모바일 우선·플로우 단순화 필수

### 2.3 학생 (Passenger)
- **누구**: 수련회 참가 학생 (수백~수천, 대학생 사역 대상, 미성년자 없음)
- **역할**:
  - 본인 매칭 조회 (어느 차·어디서·언제·얼마)
  - 출발지 지도 확인
  - 담당 간사 연락처 확인
  - Trip 그룹 채팅 참여 (사전 질문·운행 당일 현장 소통)
- **인증**:
  - **별도 가입 없음**
  - 신청 지구 간사가 학생 명단 입력 → 매칭 paid 시 시스템이 **예약번호(BUS-XXXX) 발급**
  - 신청 지구 간사가 예약번호 + 링크를 카톡으로 학생에게 직접 공유
  - 학생: 링크 클릭 → 예약번호 + 본인 이름 또는 전화 끝 4자리 검증 → 세션 쿠키 30일

---

## 3. 핵심 시나리오 (User Journey)

### S1. 공급 지구 — 차량 등록 + 자리 공개

**행위자**: 광주지구 차량 간사 A

1. A가 Google 계정으로 Bus Cignal 로그인 → 광주지구 operator 권한 확인
2. `/operator/trips/new` 진입
3. Trip 정보 입력:
   - 방향: 하행
   - 출발지: 평창 (자동 고정 — 하행이라)
   - 도착지: 광주 (드롭다운에서 선택)
   - 출발 시각: 2026-07-30 14:00
   - 정원: 44석
   - 좌석당 요금: 35,000원
   - **출발 정확한 주소**: 입력 가능 (입력 안 해도 등록은 됨 — 단 D-12h 마지노선)
     - 입력 시 카카오 지오코딩 → 지도 미리보기 자동 표시
   - 메모: "13:50까지 모이세요. 화장실은 출발 전에" (500자 이내)
4. 저장 → Trip 상태 = draft
5. 본인 지구 학생 신청 다 받고 본인 지구 학생만으로는 44석 다 안 채워짐 → 남는 자리 10개
6. `/operator/trips/:id` 진입 → "타지구 공개" 토글 ON → 공개 좌석 수 10 입력
7. SeatOffer 생성 (seat_count=10, posted_at=NOW), Trip 상태 = published
8. 전국 다른 간사들의 검색 결과에 노출됨

### S2. 수요 지구 — 신청

**행위자**: 부산지구 차량 간사 B

1. B 로그인 → 부산지구 operator
2. `/operator/requests/new` 진입 → 검색
   - 출발지: 평창 / 도착지: 부산 / 날짜: 2026-07-30
3. 결과: 매칭 가능한 Trip 카드 노출 (잔여, 가격, 출발 시각, 출발지 등)
4. "신청" 클릭 → 학생 명단 입력 폼
   - 학생당: 이름·전화·소속·메모(선택)
   - **학생 본인 동의 confirm 체크박스 필수**:
     > "위 학생들의 개인정보 처리에 대해 본인 동의를 받았음을 확인합니다."
5. 신청 인원 = 학생 행 수 → SeatRequest 생성 (requested_at=NOW, status=queued)
6. 큐 진입 → 공급 지구 간사에게 인앱 알림 (시스템 알림 이메일은 출시 직전 결정)

### S3. 매칭 승인 (공급 지구) — FIFO 강제

**행위자**: 광주지구 A

**FIFO 강제 규칙**:
- 매칭 큐 테이블에서 **1번째 요청에만 \[승인]·\[거절] 버튼 활성화**
- 2번째 이하는 비활성 ("1번 처리 후 가능" 라벨)
- 친한 지구 선별 승인 차단

1. A 알림 받음 → `/operator/trips/:id` 진입
2. 매칭 큐 1번째: 부산 3명 (B의 신청)
3. 학생 명단 미리보기 (이름·소속 — 전화번호는 매칭 paid까지 마스킹)
4. A가 \[승인] 클릭 (잔여 자리 충분 시) → Match 생성:
   - seat_count=3, matched_at=NOW, payment_due_at=NOW+24h, status=awaiting_payment
   - 잔여 좌석 10 → 7
5. B에게 알림: "매칭 확정, 24h 내 송금 완료 클릭 필요"
6. 큐 다음 항목이 자동으로 1번째가 됨

**거절 케이스**:
- A가 \[거절] 클릭 → 사유 입력 모달 (10자 이상 필수)
- SeatRequest.status = rejected
- B에게 알림 + 사유 표시
- **마스터에게도 거절 발생 알림** (패턴 모니터링)

### S3a. 부분 매칭 (신규)

**상황**: 큐 1번째인 B(5명)인데 잔여 3자리만 가능.

1. A 화면 모달:
   ```
   B 신청 5명, 잔여 3자리만 가능합니다.
   [부분 매칭 진행 (B에게 학생 선택 요청)] [전체 거절]
   ```

2. A "부분 매칭 진행" 클릭:
   - SeatRequest.status = partial_match_offered
   - `partial_offers` row #1 생성 (offer_count=3, offered_at=NOW, due_at=NOW+2h, status=open)
   - B에게 인앱 알림
   - A 화면에 **안내 모달 (닫기 가능, 강제 X)**:
     ```
     ✅ 부분 매칭 제안 발송 완료
     📞 B지구 박부산 간사님께 카톡으로도 직접 연락 부탁드립니다.
        010-XXXX-XXXX / 카톡 ID: busan_park
     ⏰ B 응답 데드라인: 2시간 (16:30까지)
     [전화걸기] [카톡 ID 복사]
     ☐ 카톡으로 연락 완료했습니다  [닫기]
     ```

3. B 접속 → 부분 매칭 응답 카드 (`/operator/requests/:id`):
   ```
   광주지구로부터 부분 매칭 제안 (3/5명)
   어떤 학생을 먼저 매칭하시겠습니까?
   ☐ 김○○  ☐ 박○○  ☐ 이○○  ☐ 최○○  ☐ 정○○
   (3명 선택)
   ⏰ 1h 47m 남음
   [3명 확정] [전체 거절]
   ```

4. B가 3명 체크 → [확정]
5. 시스템:
   - 선택된 3명 → Match 생성 (matched_at=NOW, 24h Phase 1 시작)
   - 나머지 2명 → 새 SeatRequest 생성:
     - `parent_request_id` = 원본 ID
     - `requested_at` = **원본 시각 유지** (fairness)
     - `seat_count` = 2
     - `status` = queued
   - 원본 SeatRequest.status = matched (seat_count=3)

6. B 무응답 (offer #1의 2h 경과, cron 검사):
   - `partial_offers` #1.status = expired
   - 다른 open offer가 없으면 SeatRequest.status = rejected
   - A·B에게 알림
   - 큐 다음 요청이 1번째로

**자리가 풀려 잔여 row가 큐 1번에 다시 노출**: A가 재승인 클릭하면 매칭. 자동 매칭 X.

### S3b. 부분 매칭 응답 중 잔여 자리 변동 (신규)

B가 부분 매칭 응답 중인데 다른 매칭이 만료/취소되어 잔여 자리가 변동되는 케이스.

**케이스 1 — 잔여 자리 증가 (Z가 2명 신청, 첫 제안은 1자리)**

1. t=0: A가 Z(2명)에게 부분 매칭 제안 → `partial_offers #1` (count=1, due_at=t=2h)
2. t=30m: X 매칭이 cancelled → 잔여 +1
3. 시스템 자동 처리:
   - Z 신청에 대해 `partial_offers #2` 자동 생성 (count=1, offered_at=t=30m, due_at=t=2h 30m)
   - Supabase Realtime으로 Z 화면 실시간 갱신
4. Z 화면 (단일 카드 UI, 학생별 데드라인 표시):
   ```
   🔔 부분 매칭 제안 — 광주지구 차량 (평창→광주 7/30 14:00)
   현재 매칭 가능: 2자리 (slice별 마감 다름)

   ☐ 김○○ (부산대)    ⏰ 16:30까지 (offer #1)
   ☐ 박○○ (부경대)    ⏰ 17:00까지 (offer #2, 추가)
   ※ 원하시는 만큼 선택 (최대 2명)

   [선택 확정] [전체 거절]
   ```
5. Z가 학생 선택 후 [확정]:
   - 시스템이 가까운 데드라인 offer부터 소진 (먼저 선택한 학생 = offer #1)
   - 각 offer 별로 Match 생성 (matched_at=NOW, 24h Phase 1 독립 시작)

**케이스 2 — 잔여 ≥ 신청 인원 (정책 1B, B 의사 존중)**

- Z(2명) 신청, 잔여가 2자리 이상 됨
- 시스템은 **자동 매칭 X** — Z 화면에 "이제 N명 다 매칭 가능" 표시 + [전체 확정] 버튼
- Z가 직접 [전체 확정] 클릭 시 전체 매칭 진행
- Z가 일부만 선택해도 OK (의사 존중)

**케이스 3 — 잔여 0 됨 (정책 3, 안전 처리)**

- 공급 측 자리 회수 또는 다른 매칭 paid 등으로 잔여 0
- 모든 open `partial_offers` → status = expired (auto)
- SeatRequest.status = cancelled (auto)
- Z 화면 토스트: "자리가 사라졌습니다, 신청이 자동 거절됩니다"
- **마스터에게 알림** (모니터링)

**데드라인 정책 (정책 2)**: 각 `partial_offers`별 독립 2h. 잔여 변동으로 추가된 offer는 본인 offered_at + 2h. **데드라인 reset 없음** — 큐 정체 방지.

### S4. 송금 + Confirm + 만료 + 취소

**Happy path**:
1. B 매칭 화면 → 송금 정보 확인 (광주지구 계좌, 금액 = 3 × 35,000 = 105,000)
2. B가 실제 송금
3. B "송금 완료" 클릭 → Match.payment_reported_at = NOW, status = payment_reported
4. A에게 알림 "부산지구 송금 완료 보고"
5. A 통장 확인 후 [입금 확인] 클릭 → Match.paid_at = NOW, status = paid
6. 시스템이 **예약번호 발급** (Match.reservation_code = `BUS-7K9M` 등)
7. B 화면에 학생별 예약번호 + 카톡 공유용 안내 문구 표시:
   ```
   [수련회 차량] 평창→부산 7/30(수) 14:00 출발
   김○○님 예약번호: BUS-7K9M
   링크: https://buscignal.app/r/BUS-7K9M
   위 링크에서 본인 이름 입력 후 출발지·시간·담당자 확인 가능합니다.
   ```
8. B가 [복사] 버튼으로 학생 1·2·3에게 각각 카톡 공유

**Sad path 1 — Phase 1 만료 (요청 지구 미응답)**:
- matched_at + 23h: B에게 "1시간 후 만료" 알림
- matched_at + 24h, payment_reported_at = NULL → 시스템 자동 expire (cron)
- Match.status = expired, 자리 풀림
- 큐 다음 요청이 1번째로 이동 (자동 매칭 X, A 재승인 필요)

**Sad path 2 — Phase 2 취소 (송금 완료는 눌렀지만 실제 입금 없음)**:
- B가 "송금 완료" 클릭했지만 실제 송금 안 함 또는 다른 계좌로 잘못 송금
- A 통장 확인 → 입금 없음
- A가 [매칭 취소] 클릭 (시간 제한 없음, 단 24h 지나면 권장)
- Match.status = cancelled, 자리 풀림
- 큐 다음 요청이 1번째로

**예시 — 시차 있는 만료**:
- t=0: B(2명) 매칭, Phase 1 만료 = t=24h
- t=3h: C(5명) 매칭, Phase 1 만료 = t=27h
- 각 Match의 payment_due_at은 본인의 matched_at + 24h → **시차 3시간 자동 발생** ✓

### S5. 학생 접속

**행위자**: 부산지구 학생 김○○

1. B(부산지구 간사)로부터 카톡으로 예약번호 + 링크 받음
2. 카톡에서 링크 탭 → `https://buscignal.app/r/BUS-7K9M`
3. 인증 페이지: "본인 확인을 위해 이름을 입력해주세요" → "김○○" 입력 (또는 전화 끝 4자리)
4. 검증 통과 → 세션 쿠키 발급 (30일)
5. `/me` 학생 대시보드 진입:
   - 매칭 카드: 평창 → 부산, 7/30(수) 14:00, 35,000원, 예약번호 BUS-7K9M
   - 출발지 카드: 카카오맵 임베드 (사이트 내), 풀스크린 확장 가능
   - "카카오맵 앱으로 열기" 버튼 (모바일 길찾기 이동)
   - 담당 간사 카드: 김광주 / 010-XXXX-XXXX / `tel:` 링크 + 카톡 ID
   - [Trip 채팅 입장] 버튼

### S6. 채팅 (Trip 생성 시점부터 활성)

**채팅 활성화 시점**:
- Trip이 published 된 시점부터 그 Trip의 채팅 채널 자동 생성
- 공급 지구 간사: 즉시 입장 가능 (관리자)
- 신청 지구 간사: 본인 지구 학생 매칭된 시점부터 입장 가능 (사전 질문·확인)
- 학생: 매칭 paid 시점부터 입장 (시간 제한 X — 사전/당일/사후 모두)

**활용 예시**:
- D-3일: 학생 사전 질문 "트렁크에 큰 짐 실어도 되나요?"
- D-1: A "출발 12시간 전입니다. 13:50까지 ○○로 123 정문 앞으로"
- 당일: 픽업·지연 안내, "지금 어디세요?", "5분만 기다려주세요"
- 메시지 영속 (Firestore document), offline 캐시, sent/delivered/read 상태

**참여 권한**:
- 공급 지구 간사: 관리자 (메시지·삭제·공지 핀)
- 신청 지구 간사: 본인 지구 학생 매칭된 Trip에 입장 가능 (사전 질문·확인)
- 학생: 본인 매칭 paid 된 Trip 입장 (시간 제한 X)

### S7. 정산

**일반 간사 (B, 부산지구)**:
1. `/operator/settlement` 진입
2. **받을 돈** 표 (본인 지구가 공급 측인 매칭들)
3. **보낼 돈** 표 (본인 지구가 신청 측인 매칭들)
4. 합계 + CSV 내보내기
5. 본인 지구 관련 데이터만 노출 (다른 지구 매출 노출 X)

**마스터 (CCC IT 사역부)**:
1. `/admin/settlement` 전국 N×N 매트릭스
2. 행 = 지급 지구, 열 = 수령 지구, 셀 = 합계 금액
3. 셀 클릭 → 해당 ledger
4. CSV 내보내기 (전국 ledger)

> 전국 단일 phase 전환 없음 — 각 지구·각 Trip이 자기 lifecycle (Trip status·Match status)로 진행. 마스터는 settings로 신청 마감일·점검 모드만 통제.

### S8. 출발지 미지정 패널티 (신규)

**상황**: 공급 지구 A가 Trip 등록 시 origin_address를 미입력한 채로 시간 경과.

**알림 단계** (인앱만, 외부 SMS·자동 카톡 없음):
| 시점 | 동작 |
|---|---|
| D-72h | 인앱 알림 + 노란 배너 (대시보드 상단) |
| D-48h | 빨간 배너 (모든 화면 상단) |
| D-24h | 마스터에게도 인앱 알림 (위험 Trip 발생) |
| **D-12h** | **공급 지구 간사 화면에 풀스크린 잠금 모달** — 출발지 입력 전엔 다른 작업 불가 |
| D-1h | 마스터에게 강한 인앱 경고 → 마스터가 직접 카톡·전화 개입 |

**풀스크린 잠금 모달** (D-12h):
```
⚠️ 출발지 입력이 필요합니다
운행: 평창→광주 7/30(수) 14:00
출발 11시간 30분 전
매칭된 학생 8명이 출발지를 모르는 상태입니다.

[ 주소 검색... ]
[카카오맵에서 찾기] [지도 미리보기]

[확정하고 알림 발송]
※ 닫기 버튼 없음, 다른 화면 진입 차단
```

- 입력 완료 시: 자동으로 매칭된 학생·신청 지구 간사 전원에게 알림 발송
- 출발지 변경 시도 동일 알림 자동 발송

**마스터 뷰 (`/admin/risk-trips`)**: 미지정 Trip 모아보기
| 지구 | 노선 | 출발까지 | 매칭 인원 | 책임 간사 | 액션 |
|---|---|---|---|---|---|
| 광주 | 평창→광주 7/30 14:00 | 11h 27m 🔴 | 8명 | 김광주 010-... | [전화] [카톡 ID 복사] |

마스터가 D-12h 이후 직접 카톡·전화 개입.

---

## 4. 화면 구성 (Sitemap)

### 4.1 공통
- `/` 랜딩 — 간사 로그인 vs 학생 예약번호 입구 분기
- `/login` Google OAuth (간사용)
- `/r/:code` 학생 예약번호 진입 → 본인 이름(또는 전화 끝 4자리) 검증
- `/chat/:tripId` Trip 채팅 (간사·학생 권한 분기)
- `/privacy` 개인정보 처리방침
- `/terms` 이용약관

### 4.2 간사
- `/operator` 대시보드 (오늘 알림·내 Trip·내 신청·정산 요약)
- `/operator/trips` 본인 지구 Trip 목록
- `/operator/trips/new` Trip 생성
- `/operator/trips/:id` Trip 상세 (Offer·매칭 큐·승인·부분 매칭·송금 confirm·취소)
- `/operator/requests` 내가 한 신청 목록 (상태별 탭, 부분 매칭 응답 대기 포함)
- `/operator/requests/new` Trip 검색 + 신청 + 학생 명단·동의 confirm
- `/operator/requests/:id` 신청 상세 (부분 매칭 응답 화면 포함)
- `/operator/matches` 매칭 ledger (수신·발신)
- `/operator/settlement` 본인 지구 정산
- `/operator/profile` 프로필·지구 계좌 등

### 4.3 학생
- `/me` 내 매칭 대시보드 (예약번호 인증 후)
- `/me/trip/:id` Trip 상세 (지도·시간·담당자·채팅 진입)

### 4.4 마스터
- `/admin` 전국 대시보드
- `/admin/regions` 지구 CRUD
- `/admin/operators` 간사 권한 부여·해제
- `/admin/trips` 전체 Trip 모니터링
- `/admin/risk-trips` 출발지 미지정 위험 Trip ← 신규
- `/admin/matches` 전체 매칭 ledger
- `/admin/settlement` 전국 매트릭스
- `/admin/system` 신청 마감일·점검 모드·알림 설정·로그·거절 모니터링

---

## 5. 주요 화면 상세

### 5.1 `/operator` 대시보드
```
┌─ 오늘 알림 ─────────────────────────┐
│ • [긴급] 부산→광주 매칭 만료 1h 전 │
│ • [신규] 대구지구 5명 신청           │
│ • [응답 요청] 광주 부분매칭 (45m 남음) │
└─────────────────────────────────────┘

┌─ 내 Trip ───────────────────────────┐
│ 광주→평창 7/26(월) 09:00            │
│   잔여 5/44 · 대기큐 2건             │
│ 평창→광주 7/30(수) 14:00            │
│   잔여 7/44 · 대기큐 1건             │
└─────────────────────────────────────┘

┌─ 내 신청 ───────────────────────────┐
│ 평창→부산 7/30 (서울지구) 매칭완료   │
│   송금완료 클릭 데드라인 D-12h       │
└─────────────────────────────────────┘

┌─ 정산 요약 ─────────────────────────┐
│ 받을 돈: 245,000원 (3건 미수)        │
│ 보낼 돈: 105,000원 (1건 미지급)      │
└─────────────────────────────────────┘
```

### 5.2 `/operator/trips/new` Trip 생성
- 방향: ○ 상행  ○ 하행
- 출발지 / 도착지: 드롭다운 (방향에 따라 한쪽 평창 자동 고정)
- 출발 일시: datepicker + timepicker
- 정원: number
- 좌석당 요금: number (원)
- **출발 정확한 주소**: 텍스트 입력 + "카카오맵에서 검색" → 지오코딩 → 지도 미리보기 + 좌표 저장
  - 빈 값 허용 (출시 가능). **단 D-12h 마지노선** — 패널티 §8 참조
- 메모: textarea (500자 이내)
- [임시저장] [공개로 게시]

### 5.3 `/operator/trips/:id` Trip 상세 (공급 지구) — FIFO 강제

상단: Trip 정보 + 통계 (정원·매칭됨·잔여·대기큐 길이)

**타지구 공개 카드**:
- 토글: ON/OFF
- 공개 좌석 수: number (편집 가능, 단 매칭된 좌석 이하로 못 줄임)
- 추가 공급: [+ 자리 추가] → 새 SeatOffer (posted_at = NOW)

**매칭 큐 테이블** (FIFO 강제):
| 순번 | 신청 지구 | 인원 | 학생 명단 | 신청 시각 | 상태 | 액션 |
|---|---|---|---|---|---|---|
| **1** | 부산 | 3 | 3명 | 7/15 10:30 | queued | **[승인] [거절(사유)]** |
| 2 | 대구 | 5 | 5명 | 7/15 11:05 | queued | 🔒 1번 처리 후 가능 |
| 3 | 인천 | 2 | 2명 | 7/15 11:30 | queued | 🔒 |

부분 매칭 케이스 (잔여 < 신청 인원):
```
모달: "B 신청 5명, 잔여 3자리만 가능"
[부분 매칭 진행 (B에게 선택 요청)] [전체 거절]
```

**매칭된 ledger** (매칭 취소 권한 Phase 2):
| 지구 | 인원 | 매칭일 | Phase 1 데드라인 | 상태 | 액션 |
|---|---|---|---|---|---|
| 서울 | 4 | 7/14 | 만료 | paid | — |
| 인천 | 2 | 7/15 | D-12h | awaiting_payment | — |
| 대구 | 5 | 7/16 | 송금완료됨 | payment_reported | [입금 확인] [매칭 취소] |

### 5.4 `/operator/requests/new` 신청
- 검색 폼: 출발지·도착지·날짜
- 결과 카드:
  ```
  광주지구 · 평창→광주 · 7/30(수) 14:00
  35,000원 · 잔여 7석 · 대기큐 2건 (내 신청 시 3번째)
  출발지: 강원특별자치도 평창군 봉평면 ○○로 123 [지도]
  [신청하기]
  ```
- [신청하기] → 학생 명단 입력 모달:
  - 학생 행 추가 [+]
  - 학생당: 이름·전화·소속·메모(선택)
  - 신청 인원 N명 = 학생 행 수 자동 검증
  - **학생 본인 동의 confirm 체크박스 필수**:
    > "위 학생들의 개인정보(이름·전화·소속)를 Bus Cignal에 등록·처리하는 것에 대해 본인 동의를 받았음을 확인합니다."

### 5.5 `/operator/requests/:id` 신청 상세 — 부분 매칭 응답 화면 (신규)

`status = partial_match_offered` 시 단일 카드 UI:
```
🔔 부분 매칭 제안 — 광주지구 차량
평창→광주 7/30(수) 14:00
신청 5명 / 현재 매칭 가능: 3자리

어떤 학생을 먼저 매칭하시겠습니까?
☐ 김○○ (부산대)    ⏰ 16:30까지 (offer #1)
☐ 박○○ (부경대)    ⏰ 16:30까지 (offer #1)
☐ 이○○ (부산대)    ⏰ 16:30까지 (offer #1)
☐ 최○○ (부산대)    🔒 추가 자리 없음
☐ 정○○ (부경대)    🔒 추가 자리 없음
※ 최대 3명 선택

응답 없으면 자동 거절됩니다.

[선택 확정] [전체 거절]
```

**실시간 갱신 (Supabase Realtime)**:
- 다른 매칭이 만료/취소되어 잔여 자리 증가 시:
  - 새 offer 자동 추가, "🔔 1자리 추가 매칭 가능 (마감 17:00)" 토스트
  - 🔒 학생 행이 ☐로 변경 + 추가 offer 데드라인 표시
- 잔여가 신청 인원 이상으로 늘어남:
  - 상단 메시지 "이제 N명 다 매칭 가능합니다" + [전체 확정] 버튼 추가
  - **자동 매칭 X — B가 직접 [전체 확정] 또는 [선택 확정]** (정책 1B)
- 잔여 0 됨:
  - 토스트 "자리가 사라졌습니다, 신청이 자동 거절됩니다"
  - 페이지 자동 새로고침 → 상태 cancelled로 표시 (정책 3)

**서버 검증**: B가 [선택 확정] 클릭 시 backend가 현재 잔여 재계산. 자리 부족 시 에러 "자리가 줄어들었어요, 다시 선택해주세요"

**데드라인 정책 (정책 2)**: 각 offer 독립 2h, 변동 시 reset 안 함. 추가 offer는 본인 offered_at + 2h.

- 강제 잠금 X (다른 화면 진입 가능)
- 데드라인 카운트다운 실시간 (offer별)

### 5.6 `/me` 학생 대시보드
```
안녕하세요, 김○○님!

┌─ 평창 → 부산 ──────────────────────┐
│ 2026-07-30 (수) 14:00              │
│ 부산지구 차량 / 35,000원            │
│ 예약번호: BUS-7K9M                  │
└─────────────────────────────────────┘

┌─ 어디서 타나요? ────────────────────┐
│ 강원특별자치도 평창군 봉평면        │
│ ○○로 123                            │
│ [지도 임베드 (카카오맵)]            │
│ [카카오맵 앱으로 열기] [주소 복사]  │
│ 메모: 13:50까지 정문 앞             │
└─────────────────────────────────────┘

┌─ 담당 간사 ─────────────────────────┐
│ 김광주 (광주지구)                   │
│ 📞 010-XXXX-XXXX [전화하기]         │
│ 💬 카톡 ID: kwangju_kim            │
└─────────────────────────────────────┘

[Trip 채팅 입장]
```

### 5.7 `/chat/:tripId` 채팅
- 상단 고정: Trip 한 줄 요약 (출발지·시간) + [지도] 버튼
- 메시지 영역:
  - 시스템 메시지 (회색·중앙): "13:50 김광주 간사가 채팅을 시작했습니다"
  - 사용자 메시지: 좌(상대) / 우(나) 풍선
  - 발신자 이름·역할 배지 (간사·학생) + 시각 + 읽음 상태
- 하단 입력:
  - 텍스트 + 이모지
  - V2: 위치 공유, 이미지

### 5.8 `/operator/settlement`
```
[받을 돈]
| 노선 | 수요 지구 | 인원 | 금액 | 매칭일 | 송금 상태 |
| 평창→부산(우리) | 서울 | 4 | 140,000 | 7/14 | ✅ paid |
| 평창→부산(우리) | 대구 | 2 | 70,000 | 7/15 | ⏳ payment_reported |

[보낼 돈]
| 노선 | 공급 지구 | 인원 | 금액 | 매칭일 | 송금 상태 |
| 부산→평창 | 광주 | 3 | 105,000 | 7/16 | ✅ paid |

[합계]
받을: 210,000원 (paid 140,000 · 진행중 70,000)
보낼: 105,000원 (paid 105,000 · 진행중 0)
순수: +105,000원

[CSV 내보내기]
```

### 5.9 `/admin/settlement` 마스터 매트릭스
- 매트릭스 (예: 5개 지구)
  |   | 광주 | 서울 | 부산 | 대구 | 인천 | 합계 |
  | 광주 | — | 0 | 105K | 0 | 0 | 105K |
  | 서울 | 280K | — | 0 | 0 | 0 | 280K |
  | 부산 | 0 | 0 | — | 0 | 0 | 0 |
- 셀 클릭 → 해당 ledger
- CSV 내보내기

### 5.10 `/admin/risk-trips` 출발지 미지정 위험 (신규)
```
출발지 미지정 위험 Trip (출발 임박 순)
─────────────────────────────────────
| 지구 | 노선 | 출발까지 | 매칭 인원 | 책임 간사 | 액션 |
| 광주 | 평창→광주 7/30 14:00 | 11h 27m 🔴 | 8명 | 김광주 010-... | [전화] [카톡 복사] |
| 서울 | 평창→서울 7/30 18:00 | 36h 12m 🟡 | 5명 | 박서울 010-... | [전화] [카톡 복사] |
```

---

## 6. 도메인 모델 (PostgreSQL on Supabase)

```sql
-- 지구
regions (
  id uuid pk, code text unique, name text,
  contact_phone text, bank_account text, bank_name text, account_holder text,
  created_at timestamptz
)

-- 간사
operators (
  id uuid pk,
  region_id uuid fk → regions,
  google_uid text unique, email text, name text, phone text,
  role text check (role in ('operator','master')),
  created_at timestamptz
)

-- 운행
trips (
  id uuid pk,
  operator_region_id uuid fk → regions,
  direction text check (direction in ('up','down')),
  origin_region_id uuid fk → regions null,
  destination_region_id uuid fk → regions null,
  departure_at timestamptz,
  origin_address text NULL,             -- nullable (D-12h 마지노선)
  origin_lat numeric NULL,
  origin_lng numeric NULL,
  origin_finalized_at timestamptz NULL, -- 확정·변경 추적
  capacity int,
  price_per_seat int,
  note text,                            -- 500자 이내
  status text check (status in ('draft','published','closed')),
  created_at timestamptz,
  created_by uuid fk → operators
)

-- 공급 슬라이스
seat_offers (
  id uuid pk,
  trip_id uuid fk → trips,
  seat_count int,
  posted_at timestamptz,
  status text check (status in ('open','closed')),
  created_at timestamptz
)

-- 신청 슬라이스 (분할 신청 지원, fairness 핵심)
seat_requests (
  id uuid pk,
  trip_id uuid fk → trips,
  region_id uuid fk → regions,
  operator_id uuid fk → operators,
  parent_request_id uuid fk → seat_requests NULL,  -- 부분 매칭 분할 시 원본 참조
  seat_count int,
  requested_at timestamptz,        -- FIFO 키, 분할 시 원본 시각 유지
  status text check (status in (
    'queued',
    'partial_match_offered',
    'matched',
    'rejected',
    'cancelled'
  )),
  reject_reason text NULL,
  consent_confirmed_at timestamptz,       -- 학생 동의 confirm 체크 시각
  consent_confirmed_by uuid fk → operators,
  created_at timestamptz
)

-- 신청에 묶인 학생
request_passengers (
  id uuid pk,
  request_id uuid fk → seat_requests,
  name text, phone text, school_or_role text, note text,
  created_at timestamptz
)

-- 부분 매칭 제안 슬라이스 (각 offer별 독립 데드라인, 정책 2)
partial_offers (
  id uuid pk,
  seat_request_id uuid fk → seat_requests,
  offer_count int,                       -- 이 슬라이스로 가능한 자리 수
  offered_at timestamptz,                -- 제안 발송 시각
  due_at timestamptz,                    -- offered_at + 2h (독립 데드라인, reset 없음)
  status text check (status in ('open','accepted','expired','cancelled')),
  selected_passenger_ids jsonb NULL,     -- B가 이 슬라이스에 매핑한 학생들
  decided_at timestamptz NULL,
  created_at timestamptz
)
-- 잔여 자리 변동 시 자동으로 추가 row 생성 (S3b 케이스 1)
-- 잔여 ≥ 신청 인원 되면 자동 매칭 X (정책 1B)
-- 잔여 0 시 모든 open offer expire + SeatRequest cancelled (정책 3)

-- 매칭
matches (
  id uuid pk,
  trip_id uuid fk → trips,
  request_id uuid fk → seat_requests,
  seat_count int,
  matched_at timestamptz,
  payment_due_at timestamptz,           -- matched_at + 24h (Phase 1 마감)
  payment_reported_at timestamptz NULL, -- B 송금완료 클릭 시각
  paid_at timestamptz NULL,             -- A 입금 확인 시각
  status text check (status in (
    'awaiting_payment',  -- 매칭 후, 송금완료 클릭 전
    'payment_reported',  -- 송금완료 클릭 후, 입금 확인 전
    'paid',              -- 입금 확인 완료, 예약번호 발급됨
    'expired',           -- Phase 1 데드라인 만료 (자동)
    'cancelled'          -- 공급 지구가 매칭 취소 (Phase 2)
  )),
  reservation_code text unique NULL,    -- paid 시점에 발급
  cancellation_reason text NULL,
  created_at timestamptz
  -- ※ payment_proof_url 필드 제거됨
)

-- 매칭 확정 후 탑승자
match_passengers (
  id uuid pk,
  match_id uuid fk → matches,
  name text, phone text, school_or_role text,
  access_token_hash text,        -- 예약번호 검증용
  last_seen_at timestamptz NULL,
  created_at timestamptz
)

-- 인앱 알림
notifications (
  id uuid pk,
  operator_id uuid fk → operators,
  type text,
  payload jsonb,
  read_at timestamptz NULL,
  created_at timestamptz
)

-- 거절 로그 (마스터 모니터링용)
rejection_log (
  id uuid pk,
  seat_request_id uuid fk → seat_requests,
  rejected_by uuid fk → operators,
  reason text,
  created_at timestamptz
)

-- 시스템 settings (전국 단일 phase 개념 제거)
system_config (
  key text pk,         -- 'global_application_deadline' | 'maintenance_mode' | 'alert_settings' 등
  value text,
  updated_at timestamptz,
  updated_by uuid fk → operators
)
```

### 채팅 (Firestore)
```
channels/{tripId}
  metadata: tripId, operatorRegionId, openedAt (=Trip published 시각)

channels/{tripId}/messages/{messageId}
  senderUid (operator) | senderToken (passenger)
  senderType: 'operator' | 'passenger'
  senderName (snapshot)
  body
  sentAt (server timestamp)
  readBy: [uid/token, ...]

channels/{tripId}/members/{memberId}
  type: 'operator' | 'passenger'
  refId: operatorId | matchPassengerId
  joinedAt
  lastReadAt
```

**Supabase ↔ Firestore 매핑**: 시스템이 Firebase Admin SDK로 Custom Token 발급 (operator는 Supabase 인증 후, passenger는 예약번호 검증 후). Firestore Security Rules가 토큰 claims 검증.

---

## 7. 매칭 알고리즘 (FIFO + 부분 매칭 + 수동 promotion)

### 7.1 큐 정렬
```
fn queue(trip):
  return SeatRequest
    WHERE trip_id = trip.id
      AND status IN ('queued', 'partial_match_offered')
    ORDER BY requested_at ASC
```

### 7.2 잔여 좌석 계산
```
fn available(trip):
  return sum(offers.seat_count where status='open')
       - sum(matches.seat_count where status IN ('awaiting_payment','payment_reported','paid'))
```

### 7.3 승인 (FIFO 강제)
```
fn approve(request):
  -- 큐 1번째인지 서버에서도 검증 (UI 우회 방지)
  assert request == queue(request.trip)[0]
  avail = available(request.trip)
  if request.seat_count <= avail:
    Match(trip, request, request.seat_count, payment_due_at=NOW+24h, status='awaiting_payment')
    request.status = 'matched'
  else:
    propose_partial(request, avail)
```

### 7.4 부분 매칭 제안 (다중 offer 슬라이스 + 실시간 갱신)

```
fn propose_partial(request, partial_count):
  request.status = 'partial_match_offered'
  PartialOffer.create(
    seat_request_id=request.id,
    offer_count=partial_count,
    offered_at=NOW, due_at=NOW+2h, status='open'
  )
  notify(request.region, 'partial_match_offer')
  display(request.trip.operator_region, 'contact_b_kakao_modal')

-- S3b: 응답 중 잔여 자리 증가 시 자동 추가 (Supabase trigger 또는 cron 1분)
fn on_trip_available_increase(trip, delta):
  for request in queue(trip) where status='partial_match_offered':
    -- B가 응답 중인 요청에 대해 추가 offer
    existing_offers = sum(po.offer_count for po in request.partial_offers where status='open')
    needed = request.seat_count - len(request.matches)  -- 아직 매칭 안 된 인원
    additional = min(delta, needed - existing_offers)
    if additional > 0:
      PartialOffer.create(
        seat_request_id=request.id,
        offer_count=additional,
        offered_at=NOW, due_at=NOW+2h, status='open'
      )
      realtime_push(request.region, 'partial_offer_added')
      delta -= additional
    if delta == 0: break

-- B 화면에서 [선택 확정] 호출
fn accept_partial(request, selected_passenger_ids):
  -- 서버 재검증: 현재 open offer 합계 ≥ selected 수
  open_offers = PartialOffer where seat_request_id=request.id and status='open'
                                 and due_at > NOW
                            order by due_at ASC  -- 데드라인 빠른 순부터 소진
  total_capacity = sum(o.offer_count for o in open_offers)
  if len(selected_passenger_ids) > total_capacity:
    error '자리가 줄어들었어요, 다시 선택해주세요'

  -- 학생을 offer에 매핑 (먼저 가까운 데드라인부터)
  remaining = list(selected_passenger_ids)
  for offer in open_offers:
    take = min(len(remaining), offer.offer_count)
    if take == 0: break
    assigned = remaining[:take]
    remaining = remaining[take:]
    Match.create(trip, request, take, payment_due_at=NOW+24h, ...)  -- 각 offer당 매칭 분리
    offer.selected_passenger_ids = assigned
    offer.status = 'accepted'
    offer.decided_at = NOW

  unselected = request.passengers - selected_passenger_ids
  if unselected:
    SeatRequest.create(
      parent_request_id=request.id,
      seat_count=len(unselected),
      requested_at=request.requested_at,  -- ★ 원본 시각 유지
      status='queued',
      passengers=unselected
    )
  request.status = 'matched'

fn check_partial_timeout():  -- cron, 1분 간격
  -- offer별 만료
  for offer in PartialOffer WHERE status='open' AND due_at < NOW:
    offer.status = 'expired'
  -- 모든 offer 만료된 SeatRequest 처리
  for request in SeatRequest WHERE status='partial_match_offered':
    if no open offers remain:
      request.status = 'rejected'
      request.reject_reason = 'partial_match_timeout (auto)'
      notify_both(request)

-- 정책 3: 잔여 0 시 안전 처리
fn on_trip_available_zero(trip):
  for request in queue(trip) where status='partial_match_offered':
    for offer in request.partial_offers where status='open':
      offer.status = 'cancelled'
    request.status = 'cancelled'
    notify_request_region(request, 'auto_cancelled_no_seats')
    notify_master(request, 'risk_event')
```

### 7.5 Phase 1 만료 (24h, cron)
```
fn check_payment_phase1_timeout():
  for match in matches WHERE status='awaiting_payment'
                        AND payment_due_at < NOW:
    match.status = 'expired'
    notify_both(match)
  -- 자동 promotion 없음. 큐 1번째에 자연 노출됨 (다음 cycle에서 A가 재승인)
```

### 7.6 Phase 2 취소 (공급 지구 수동)
```
fn cancel_match(match, reason):
  -- 공급 지구 간사만 호출 가능
  assert match.status IN ('payment_reported',)  -- awaiting_payment는 expire에 맡김
  match.status = 'cancelled'
  match.cancellation_reason = reason
  notify_request_region(match)
```

### 7.7 Fairness 사례 검증

| 시각 | 이벤트 | 큐 상태 |
|---|---|---|
| t=1 | B 5명 신청 | [B(5, t=1)] |
| t=2 | C 4명 신청 | [B(5, t=1), C(4, t=2)] |
| t=3 | B 3명 추가 신청 | [B(5, t=1), C(4, t=2), B(3, t=3)] |

A가 7자리 공급, B가 부분 매칭 응답에서 3명 선택, C 승인:
- B(5) → 부분매칭 제안 → B가 3명 선택 → 3명 매칭, 잔여 2명은 새 row (requested_at=t=1)
- C(4) → 잔여 4자리 매칭, 4명 전원
- 잔여 0, B의 2명 row (t=1)는 큐에 잔류
- B(3, t=3) 큐에 잔류

→ ✅ "B 처음 5명 우선, C 다음, B 추가 3명은 후순위" 충족

만료 시차 사례:
- t=0: B(2) 매칭, Phase 1 만료 = t=24h
- t=3h: C(5) 매칭, Phase 1 만료 = t=27h
- → 각 Match별 본인의 matched_at + 24h이므로 시차 3시간 자동 발생 ✓

---

## 8. 권한 모델 (RLS)

| Role          | Trips                          | SeatRequests                       | Matches                                                  | Settlement       | Chat                                    |
| ------------- | ------------------------------ | ---------------------------------- | -------------------------------------------------------- | ---------------- | --------------------------------------- |
| **master**    | 전체 R/W + risk-trips 뷰        | 전체 R/W                            | 전체 R/W                                                  | 전국 매트릭스    | 모든 Trip 입장 가능 (관리·이상상황)         |
| **operator**  | 본인 지구만 W, 전체 R          | 본인이 만든 것만 W, 본인 지구 관련 R | 양쪽 지구 R · 공급 측만 입금확인·취소 W · 요청 측만 송금완료 W | 본인 지구만      | 본인 지구 Trip 관리 + 신청 지구 Trip 참여 |
| **passenger** | —                              | —                                  | 본인 매칭만 R                                              | —                | 본인 매칭 Trip 입장 (paid 시점부터)       |

**마스터 인증**:
- Google OAuth (1단계)
- 마스터 비밀번호 추가 인증 (2단계, bcrypt 환경변수)
- 24h 세션 (외출·노트북 분실 대비 재인증)
- 5회 실패 시 1h 잠금

Supabase RLS 정책 + Firestore Security Rules에 동일 모델 반영.

---

## 9. 기술 스택

### 9.1 본체
- **Next.js 15** App Router + TypeScript
- **Tailwind CSS** + shadcn/ui (carbus-web 디자인 시스템 재사용)
- **Supabase** PostgreSQL + Auth (Google OAuth) + RLS — **Seoul 리전**
- **Vercel** 자동 배포

### 9.2 채팅 — Firebase Firestore
- **선택 근거**:
  - "신의 악단" = Socket.io 자체 호스팅 + Render Free → cold start 30초, 일부 클라이언트 재연결 실패
  - Firebase Firestore = Google 글로벌 다중리전, SDK 자체 IndexedDB 캐시·재연결, onSnapshot 실시간 동기화 검증
  - 채팅이 "유일한 소통수단"이 될 수 있으므로 자체 호스팅 회피
- **무료 plan (Spark)**: 1GB 저장 + 10GB/월 다운로드 → 전국 운영 충분
- **리전**: asia-northeast3 (Seoul)
- Supabase 인증 후 Firebase Custom Token 발급 (Admin SDK 서버 사이드)
- Firestore Security Rules로 채팅 권한 검증

### 9.3 지도 — 카카오맵 JavaScript SDK
- 무료 30만 호출/일
- 지오코딩 (주소 → 좌표)
- 사이트 내 임베드 + "앱으로 열기" 버튼

### 9.4 공급 형태 — 일반 반응형 웹사이트
- PWA·네이티브 앱 미도입
- 카톡 링크 → 브라우저 진입 → 사용
- 모바일 우선 디자인 (iPhone 13 baseline 375~390px)
- 푸시 알림 X (인앱·이메일 알림으로 대체)

### 9.5 알림
- **인앱**: `notifications` 테이블 + Supabase Realtime subscribe
- **시스템 알림 이메일**: [출시 직전 결정 — placeholder] (Resend 또는 Supabase Auth Mail 후보)
  - 발송 도메인: [출시 직전 확정]
  - 사용 시점: 매칭 확정·송금 알림·만료 임박·출발지 미지정 단계별 알림 등
- **카카오 알림톡·SMS**: V1.0 미사용 (사업자 등록 필요), V2 검토

### 9.6 모니터링
- Sentry (에러 트래킹)
- Vercel Analytics

### 9.7 보안
- RLS 양 레이어 (Supabase + Firestore)
- 마스터 = OAuth + 비밀번호 (bcrypt)
- 개인정보 최소화 (이름·전화 + 학교만)
- 수련회 종료 후 90일 자동 익명화
- 시크릿: 1Password / `.env.local`

---

## 10. 개인정보 처리방침 (PIPA)

> 정식 공개용 문서 `PRIVACY.md`는 출시 직전 별도 작성 (이메일·도메인 확정 시점).
> 본 섹션은 기획 단계 정책 정리.

### 10.1 수집 항목
| 대상 | 항목 |
|---|---|
| 간사 | 이름·이메일(Google OAuth)·전화·소속지구·역할 |
| 학생 | 이름·전화·학교/소속·메모(선택) |
| 정산 | 매칭별 금액·계좌번호 (공급 지구 운영자가 등록) |

### 10.2 수집 목적
- 차량 매칭 진행
- 정산 (지구 간 송금)
- 운행 안내 (출발지·시간·담당자)
- 현장 소통 (Trip 채팅)

### 10.3 보관 기간
- 수련회 종료 + **90일** 보관 → 자동 익명화 (이름 마스킹, 전화·이메일 해시화)
- 익명화 후 통계 목적 보관 (집계 데이터만)
- 정산 데이터는 회계 의무 5년 보관 (개인 식별 부분은 마스킹)

### 10.4 제3자 제공
- 매칭 양측 지구 간사에게 학생 정보 공유 (서비스 본질, 동의 범위 내)
- 외부 제공 X

### 10.5 처리위탁
| 위탁 대상 | 용도 | 위치 |
|---|---|---|
| Supabase | DB · 인증 | Seoul |
| Firebase Firestore | 채팅 | asia-northeast3 (Seoul) |
| Vercel | 호스팅 | 글로벌 CDN (정적 자산만) |
| 카카오 | 지도 SDK | 한국 |
| [시스템 알림 이메일 사업자] | 알림 발송 | [출시 직전 확정] |

### 10.6 사용자 권리
- 열람·정정·삭제·처리정지 요청 권리
- 요청 채널: **[출시 직전 확정 — CCC IT 사역부 공식 이메일]**
- 응답 기한: 10일 이내

### 10.7 동의 절차
- **간사**: 가입 시 필수 동의 (서비스 이용·개인정보 처리)
- **학생**: 본인 동의는 신청 지구 간사가 책임지고 수령 (카톡·구두 등). 신청 폼에 confirm 체크박스:
  > "위 학생들의 개인정보(이름·전화·소속)를 Bus Cignal에 등록·처리하는 것에 대해 본인 동의를 받았음을 확인합니다."
  시스템에 동의 시각·간사 ID 기록 (`consent_confirmed_at`, `consent_confirmed_by`)

### 10.8 보안 조치
- 전송 구간 암호화 (HTTPS)
- 저장 데이터 접근 통제: Supabase RLS + Firestore Security Rules
- 시크릿 1Password 관리, `.env.local` (gitignored)
- 마스터 인증 = OAuth + 비밀번호 + 24h 세션 + 5회 실패 잠금
- 접근 로그 (Supabase Auth Log, Vercel Log)
- 백업: Supabase 자동 일일 백업

### 10.9 책임자
- 책임 부서: **CCC IT 사역부**
- 연락 이메일: **[출시 직전 확정 — placeholder]**
- 부서 공식 이메일이 없으면 출시 직전 신규 생성

### 10.10 국외 이전
- 주요 데이터(Supabase·Firebase)는 Seoul 리전
- 정적 자산만 Vercel 글로벌 CDN
- 추가 국외 이전 발생 시 처리방침 업데이트 + 사용자 재동의

### 10.11 민감정보 처리
- **처리 X** — 수련회는 종교활동이지만 시스템은 차량 매칭만 다룸, 종교·신앙 정보 수집 안 함

### 10.12 미성년자
- **처리 X** — 대학생 사역 대상, 미성년자 없음 (보호자 동의 절차 불필요)

---

## 11. 결정 보류 / 추가 논의 안건

### 확정 (v0.3 시점)
| # | 안건 | 결정 |
|---|---|---|
| 1 | 부분 매칭 시 잔여 처리 | ✅ 요청 지구가 학생 선택 + 잔여는 분할 row로 큐 잔류, requested_at 원본 유지 |
| 2 | 매칭 만료 후 promotion | ✅ 수동 — 자리 풀림 + 큐 1번에 노출, 공급 지구가 재승인 |
| 3 | 매칭 거절 후 학생 정보 | ✅ 익명화 정책에 합류 (90일 후 자동) |
| 4 | 신청 지구 간사의 채팅 참여 | ✅ 가능 (본인 지구 학생 매칭된 Trip 한정) |
| 5 | 송금 스크린샷 첨부 | ✅ 제거 |
| 7 | Trip 메모 길이 제한 | ✅ 500자 |
| 8 | B 부분 매칭 응답 데드라인 | ✅ 각 `partial_offers` 슬라이스별 독립 2h, 무응답 시 슬라이스만 expire (정책 2) |
| 9 | 출발지 미지정 패널티 | ✅ 인앱 알림 단계화 + D-12h 풀스크린 잠금 모달, 외부 SMS 없음 |
| 10 | 24h 데드라인 기준 | ✅ 매칭 → 송금완료 클릭 (Phase 1, 자동). 송금완료 후 공급 지구는 시간 제한 없음, 단 미입금 시 매칭 취소 권한 (Phase 2) |
| 11 | 채팅 활성화 시점 | ✅ Trip published 시점부터 (사전 질문 가능) |
| 12 | FIFO 강제 | ✅ 큐 1번째만 [승인] 활성, 친한 지구 선별 차단 |
| 13 | 거절 사유 | ✅ 10자 이상 필수, 마스터 알림 |
| 14 | 마스터 인증 | ✅ Google OAuth + 비밀번호 (A옵션) |
| 15 | 공급 형태 | ✅ 일반 웹사이트 (PWA·네이티브 X) |
| 16 | 학생 동의 | ✅ 신청 지구 간사 confirm 체크 |
| 17 | 책임자 표기 | ✅ CCC IT 사역부 (개인 이름 비공개) |
| 18 | 부분 매칭 응답 중 잔여 변동 | ✅ 옵션 B (실시간 갱신, 사용자 상식 우선) — `partial_offers` 자동 추가 |
| 19 | 잔여 ≥ 신청 인원 시 자동 매칭 | ✅ 1B — 자동 매칭 X, B가 직접 [전체 확정] 선택 (의사 존중) |
| 20 | 부분 매칭 데드라인 reset | ✅ 없음 — 변동 있어도 원래 due_at 유지, 추가 슬라이스만 본인 due_at |
| 21 | 잔여 0 시 안전 처리 | ✅ 자동 거절 + 마스터 알림 (정책 3) |
| 22 | 전국 단일 phase 전환 | ✅ 제거 — Trip status·Match status로 자동 도출. 마스터는 settings만 (신청 마감일·점검 모드) |

### 미해결 (출시 직전 확정)
| # | 안건 | 비고 |
|---|---|---|
| 6 | 학생 예약번호 검증 | 이름 only / 전화 끝 4자리 only — 사용성·보안 trade-off 추후 결정 |
| P1 | 책임자 이메일 (PIPA) | CCC IT 사역부 공식 이메일 — 부서 협의 |
| P2 | 시스템 알림 이메일 발송 도메인·도구 | Resend / Supabase Auth Mail 등 |
| D1 | 개발 모델 | 1 dev + AI vs branch 분담 + rotation — 팀 협의 후 |
| D2 | GitHub repo 시점·공개 여부 | private 시작 → 출시 시 public 검토 |

---

## 12. 비기능 요구사항

| 항목 | 요구 |
|---|---|
| **반응성** | 모바일 우선 (iPhone 13 baseline, 375~390px) |
| **언어** | 한국어 (V1) |
| **오프라인** | 학생 채팅 — Firestore SDK 자체 IndexedDB 캐시 |
| **접근성** | 시맨틱 HTML, alt·label·키보드 탐색 |
| **보안** | RLS · Firestore Rules · 시크릿 관리 · PIPA 준수 · 마스터 비번 |
| **확장성** | 전국 N개 지구 + 수련회당 수천 학생 동시 사용 |
| **개인정보** | 최소 수집 · 90일 후 자동 익명화 · 동의 confirm 강제 |

---

## 13. 일정·운영 (사용자가 정함)
- 일정 산정은 AI 개발 페이스 감안하여 별도 결정
- 마일스톤은 팀원 기획안 수렴 후 v1.0에서 확정
- 운영 목표: 2026 여름 수련회

---

## 14. 관련 문서
- [[../carbus-web/HANDOFF]] — 광주지구 carbus 자산 (재사용 source)
- [[../../CLAUDE]] — vault 운영 지침 (§14 git push, §15 자율 진행)
- [[../../ARCHITECTURE]] — vault 구조
- (출시 직전 작성) `PRIVACY.md` — 사용자 노출용 정식 처리방침
- (작성 예정) `decisions/2026-05-26-chat-stack-firebase.md`
- (작성 예정) `decisions/2026-05-26-partial-match-policy.md`
- (작성 예정) `decisions/2026-05-26-master-auth.md`
- (작성 예정) `decisions/2026-05-26-no-pwa.md`

---

## 15. 변경 이력

| 일자 | 변경 | 비고 |
|---|---|---|
| 2026-05-26 | v0.1 초안 | 팀원 기획안 수렴 전 1차 종합본 |
| 2026-05-26 | **v0.2 — 주요 변경**: ① 부분 매칭 = 요청 지구가 학생 선택 (2h 데드라인) ② FIFO 강제 (큐 1번만 [승인] 활성) ③ 24h 데드라인 = 매칭→송금완료 클릭 (Phase 1) + 송금완료 후 공급 지구 취소 권한 (Phase 2) ④ 자동 promotion 제거, 수동 재승인 ⑤ 채팅 = Trip published 시점부터 활성 ⑥ 송금 스크린샷 제거 ⑦ 출발지 미지정 패널티 = 인앱 단계 알림 + D-12h 풀스크린 잠금 + 마스터 risk-trips 뷰 ⑧ 마스터 = CCC IT 사역부 + OAuth+비번 2단계 ⑨ PWA 미도입, 일반 웹사이트로 확정 ⑩ PIPA 정식 섹션 신설 ⑪ 거절 사유 10자 이상 필수 + 마스터 알림 ⑫ 학생 동의 = 간사 confirm 체크 ⑬ 팀 역할 분배 섹션 제거 (협의 보류) | 사용자 확정 |
| 2026-05-26 | **v0.3 — 주요 변경**: ① 부분 매칭 응답 중 잔여 자리 변동 = 실시간 갱신 (옵션 B, 사용자 상식 우선) ② `partial_offers` 테이블 신설 — 슬라이스별 독립 2h 데드라인 (정책 2), reset 없음 ③ 단일 카드 UI에 학생별 데드라인 표시 ④ 잔여 ≥ 신청 인원 시 자동 매칭 X, B가 [전체 확정] 직접 (정책 1B) ⑤ 잔여 0 시 자동 거절 + 마스터 알림 (정책 3) ⑥ 전국 단일 phase 전환 제거 — Trip/Match status로 자동 도출, 마스터는 settings (신청 마감일·점검 모드) ⑦ S3b 시나리오 신규 (응답 중 잔여 변동 케이스 3개) ⑧ `seat_requests.partial_match_due_at` 제거 (partial_offers로 이동) | 사용자 확정 |
| 2026-05-26 | **v1.0 확정 (Finalized)** — 팀원(이유성·김도영) 기획안 검토 결과 본 안(v0.3)을 최종으로 채택. 사유: 김도영안은 단일 지구 내부 운영에 더 적합, 이유성안은 추상적. 본 프로젝트의 핵심 도메인(지구 간 차량 매칭)과 부합하는 본 안 유지. 보류 안건(매칭 후 공급 측 취소 정책, 재신청 추천 UI)은 별도 결정 필요 시점에 논의. status: in_progress → finalized | East_Star 확정 |
