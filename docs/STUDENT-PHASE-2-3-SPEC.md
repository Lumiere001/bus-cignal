# 학생 직접 신청 — Phase 2·3 빌드 스펙 (자율 워크플로우용)

> **대상**: 다음 세션이 이 문서를 읽고 **자율 워크플로우(multi-agent)** 로 Phase 2·3을 구현한다.
> **빌드 base 브랜치**: `feat/ccc-student-login` (Phase 1이 들어있음. 최신 main 반영됨).
> **목표**: 학생이 CCC 로그인 → **본인 직접 신청** → 예약 확인 → **채팅** 까지.

---

## 0. 전제 — Phase 1에서 이미 완료된 것 (PR #132, 브랜치 feat/ccc-student-login)

- **스키마**(마이그 `20260609000000_student_self_apply.sql`):
  - `students` 테이블: `id, ccc_id(unique), name, phone, region_id, campus, last_login_at`.
  - `seat_requests`: `operator_id` **nullable** + `requester_kind('operator'|'student')` + `student_id` + 무결성 체크(주체=간사 xor 학생).
- **인증**: `lib/auth/student-session.ts`(JWT 30일, claims `{studentId, cccId, regionId}`) + `lib/auth/student.ts`(`getStudentSession`/`requireStudent`/`issueStudentSession`/`clearStudentSession`).
- **CCC 학생 로그인**: `/s/login`(안내) · `/s/login/ccc`(consent 진입) · `/api/ccc/student-callback`(교환→provision→세션→`/s`). `lib/ccc/student-provision.ts`.
- **`/s`**: 홈 스텁(이름·지구 표시) — Phase 2에서 채움.
- env: `CCC_HANDOFF_STUDENT_CLIENT_ID`, `STUDENT_SESSION_SECRET`.

> 기존 예약번호(`/r`) 경로는 **절대 건드리지 않는다**(별개 신원·흐름 유지).

---

## Phase 2 — 학생 화면 (직접 신청 + 내 예약)

간사가 타지구에 신청하는 흐름(`app/operator/requests/new/RequestWizard.tsx`)을 **참고**하되, 학생은 **본인 1명**만, 정보는 CCC에서 와서 **미리 채워짐**.

### 2-1. `/s` 홈 (스텁 교체)
- `requireStudent()` → 학생 본인의 신청/예약 요약 + **"차량 신청하기"** CTA + 로그아웃.
- 내 신청/예약 목록(상태 배지: queued/매칭/입금확인) + paid면 예약번호·`/r` 링크(`components/operator/ReservationLink` 재사용 가능).

### 2-2. 차량 둘러보기 + 신청
- 신청 가능한 공급 차량 목록(published + 잔여 좌석>0). 학생의 출신 지구(region) 기준 노선 필터는 간사 신청 마법사 로직(`app/operator/requests/new/page.tsx`) 참고.
- 차량 선택 → 신청 확인(본인 정보 미리채움 + 개인정보 수집·이용 동의 체크) → 제출.

### 2-3. 서버 액션 (`app/s/.../actions.ts`)
- `createStudentRequest(tripId)`:
  - `requireStudent()` → 학생 `region_id` 필수(없으면 "출신 지구 미확인" 안내).
  - `students`에서 본인 name/phone 조회.
  - `seat_requests` insert: `requester_kind='student'`, `student_id`, `region_id`(학생 출신지구), `trip_id`, `seat_count=1`, `status='queued'`, `consent_confirmed_at=now()`(operator_id·consent_confirmed_by는 null).
  - `request_passengers` insert: 본인 1명(name, phone, priority=1).
  - 가드: trip published + 잔여>0, 동일 trip 중복 신청 방지.
- `cancelStudentRequest(requestId)`: 본인(student_id 일치) + queued 만 취소.

### 2-4. 승인 측 영향 (간사 화면)
- `approve_request_atomic` RPC는 operator_id 불요 → 학생 신청도 **그대로 승인 가능**.
- ⚠️ `app/operator/trips/[id]/actions.ts` approveRequest/rejectRequest의 알림 `emit(..., {requestOperatorId: request.operator_id})`: 학생 신청이면 operator_id=null → 알림 대상이 학생이 되도록 보완(또는 best-effort 스킵). 학생 알림은 students 기반.

### Phase 2 수용 기준
- 학생 로그인 → 차량 둘러보기 → 신청 → `/s`에 "대기중" 표시.
- 간사가 그 신청을 큐에서 승인 → 학생 `/s`에 매칭/입금확인 → paid면 예약번호·링크 노출.
- e2e: 학생 세션으로 신청 생성→조회 (createApproveScenario 패턴 + 학생 세션 픽스처 추가).

---

## Phase 3 — 채팅 연동 + 승인 큐 학생 표시

### 3-1. 학생 채팅 접근 (CCC 학생)
- 현재 `lib/chat/access.ts`의 `getPassengerChatAccess`는 `match_passengers` name+phone 기반(/r 세션).
- CCC 학생용 경로 추가: `getStudentChatAccess(studentId, tripId)` — student_id → seat_requests → matches(paid) on trip → access.
- `resolveChatAccess`에 학생 세션 분기 추가(`getStudentSession()` → getStudentChatAccess). 채팅 토큰 라우트(`app/api/chat/token`)는 resolveChatAccess만 쓰므로 자동 적용.
- `/s`에서 paid 매칭 차량의 "채팅" 진입(`/chat/<tripId>`) 링크.

### 3-2. 승인 큐에 학생 직접 신청 표시
- `app/operator/trips/[id]/page.tsx` 대기 큐: operator_id=null(학생 직접)이면 "학생 직접 신청" 배지 + 학생 본인 정보 표시(담당 간사 연락처 대신).
- (이미 operator_id null 처리됨 — 표시 라벨만 추가.)

### Phase 3 수용 기준
- CCC 학생이 paid 차량 채팅 입장 가능(토큰 발급 → Firestore 입장).
- 간사 큐에서 학생 직접 신청이 구분 표시됨.
- rules 테스트 22 유지, e2e green.

---

## 빌드 규칙 (모든 Phase 공통)

- **base**: `feat/ccc-student-login` 에서 작업(Phase 1 위에 쌓기). 작은 PR로 나눠도 됨.
- **검증 게이트**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` + E2E(`supabase db reset` 후 `pnpm test:e2e`, 세션 시크릿 env 3개+STUDENT_SESSION_SECRET) + 채팅 변경 시 `test:rules`(firebase-tools@14).
- **로컬**: Docker→`supabase start`→`supabase db reset`→`pnpm gen types`(스키마 바뀌면).
- **머지**: CCC 학생 등록(client_id=bus-cignal-student) + Vercel env 후 라이브. 그 전엔 라우트 dormant.
- 기존 흐름(간사·/r·마스터) 회귀 0 유지.

## 자율 워크플로우 제안 (다음 세션)
- Phase 2(화면·액션) → 검증 → Phase 3(채팅·큐) → 검증, 단계별 워크플로우.
- 각 단계: 구현 에이전트 + 검증(typecheck/build/e2e) 에이전트. 완료 시 PR.
