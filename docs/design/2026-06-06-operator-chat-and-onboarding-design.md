# 간사 채팅 + "탑승 학생 모아보기" 설계

- **일자**: 2026-06-06
- **작성자**: CC (설계 초안 — 팀장 East_Star 리뷰 대기)
- **유형**: design (구현 전 설계, 코드 변경 없음)
- **요약**: WORKLOG Phase 2 신규 항목 "우리 버스 탄 타지구 학생 모아보기 + 간사 채팅"의 채팅 부분을 정식화한다. 기존 Trip 채팅(`/chat/:tripId`, 학생 포함) 위에 **공급↔신청 간사 간 조율 채널**을 어떻게 얹을지, 커스텀 토큰 브리지·Firestore 룰·읽음 수·푸시까지 production gap을 정리하고 단계 계획을 제시한다.
- **선행 결정**: `2026-06-05-chat-firebase-custom-token-bridge.md` (커스텀 토큰 브리지 채택), `2026-06-05-ccc-operator-auth-confirmed.md` (간사 내부 id 사용), `2026-06-05-rls-deny-default-boundary.md` (deny-default 경계)
- **관련 SPEC**: §S6(채팅), §9.2(Firestore), "Firestore (채팅)" 스키마(`channels/{tripId}/messages`·`channels/{tripId}/members`), §S8/§9.5(알림)

---

## 0. 현재 코드 한 줄 요약 (audit 결과)

채팅의 **핵심 골격은 이미 구현돼 있다**: 서버 권한 판단(`lib/chat/access.ts`, 테스트 통과), 토큰 라우트(`app/api/chat/token/route.ts`), 클라이언트 로그인·구독·전송(`lib/firebase/chat-client.ts`, `components/chat/ChatRoom.tsx`), Admin 토큰 발급(`lib/firebase/chat-admin.ts`), 그리고 **claims 기반 Firestore 룰 초안**(`firestore.rules`)까지 있다. 빠진 것은 (1) 룰 prod 배포·dev/prod 분리, (2) **읽음/unread 일체 미구현**, (3) **`chat_message` 푸시가 한 번도 emit되지 않음**, (4) 본 문서의 주제인 **간사 전용 조율 채널**이다.

---

## 1. 범위 정리 — "간사 채팅"이란 무엇인가

### 1.1 두 종류의 채팅을 구분한다

| | **Trip 채팅 (기존)** | **간사 채팅 (본 문서 신규)** |
|---|---|---|
| 경로 | `/chat/:tripId` | (제안) `/operator/chat/:tripId` |
| 참여자 | 양쪽 간사 + **학생** | **간사만** (공급 ↔ 신청) |
| 목적 | 탑승 안내·학생 문의 | 좌석·정산·노쇼·픽업 조율 (학생에게 안 보여야 할 내용) |
| Firestore | `channels/{tripId}/messages` | (제안) `channels/{tripId}/ops/messages` |
| 데이터 | 이미 구현 (`chat-client.ts`) | 신규 |

핵심 동기: WORKLOG Phase 2의 "우리 버스 탄 타지구 학생 모아보기" 화면(공급 간사가 자기 버스에 탄 **모든 지구**의 학생을 한 화면에서 보는 뷰)에서, 간사들끼리 "○○ 학생 픽업 어디서?", "정산 ○만원 보냈다" 같은 **학생이 보면 안 되는 운영 대화**가 필요하다. 이걸 기존 Trip 채팅(학생 포함)에 섞으면 안 된다.

### 1.2 방 모델 — 권장안: **Trip별 간사 전용 서브룸 재사용**

세 가지를 검토했다.

1. **(A) 기존 Trip 방 재사용 + 메시지 `audience: 'all'|'operators'` 플래그**
   - 장점: 방 하나. 단점: **룰만으로 학생의 operators 메시지 읽기를 막아야 하는데, 같은 컬렉션이라 룰이 복잡해지고 실수 시 PII 유출**. 학생이 콘솔에서 `channels/{tripId}/messages` 전체를 구독하면 operators 메시지까지 내려갈 위험. 비추천.
2. **(B) Trip별 간사 전용 서브룸** ✅ **권장**
   - 경로: `channels/{tripId}/ops/messages/{messageId}` (학생 메시지와 **물리적으로 다른 컬렉션 경로**).
   - 룰: 이 경로는 `request.auth.token.role == 'operator'` **만** 읽기·쓰기 허용 → 학생은 토큰 role이 `passenger`라 deny-default에 걸려 **경로 자체 접근 불가**. PII 격리가 룰 한 줄로 끝난다.
   - "탑승 학생 모아보기"는 Trip 단위 화면이므로 방도 Trip 단위가 가장 자연스럽다.
3. **(C) `seat_request`별(또는 지구 쌍별) 스레드**
   - 장점: 신청 지구가 여럿일 때 대화 격리. 단점: 방 수 폭증, 공급 간사가 N개 스레드를 오감, MVP 과설계. **V2 후보로 보류**.

**결정 제안: (B)**. 같은 Trip이면 공급 간사 1명 + 신청 지구 간사 N명이 **하나의 운영 채널**에 모인다(다대다 그룹). 이는 SPEC "Firestore (채팅)" 스키마(`channels/{tripId}/...`)와도 정합하고, 이미 있는 `getOperatorChatAccess`(공급/신청 지구 판정)를 **그대로 재사용**한다.

---

## 2. Audit 표 — EXISTS vs MISSING (production 기준)

| 영역 | 현재 상태 | 근거 (파일) | production gap |
|---|---|---|---|
| **토큰 브리지 (간사)** | ✅ EXISTS. `/api/chat/token`이 `resolveChatAccess`로 operator도 판정 → uid `operator:{operatorId}`, claim `{role:'operator', tripId, subjectId}` 발급 | `app/api/chat/token/route.ts:49-56`, `lib/chat/access.ts:87-141` | 토큰이 **단일 tripId scope**. 간사는 여러 Trip을 가짐 → 방 전환마다 재발급(현재 ChatRoom이 mount마다 호출하므로 OK). 간사 채널용 별도 claim은 불필요(같은 토큰 재사용). |
| **Firestore 데이터 경로 (학생 채팅)** | ✅ EXISTS. `channels/{tripId}/messages`, 문서 6필드 | `lib/firebase/chat-client.ts:55,95-102` | 간사 채널 경로(`channels/{tripId}/ops/messages`) 신규 필요 |
| **Firestore 룰 (커스텀 토큰)** | ✅ EXISTS (초안). claims 기반, `request.auth.token.tripId/subjectId/role` 검증, deny-default, 메시지 immutable, 필드 화이트리스트 | `firestore.rules` 전체 | (a) prod 미배포(현재 prod는 `if false`), (b) **간사 서브룸 룰 블록 없음**, (c) `members` 룰 없음 — §4 참조 |
| **request.auth 한계** | ✅ **해결됨**. 우리는 Firebase Auth 메인 로그인을 안 쓰지만, 커스텀 토큰으로 `signInWithCustomToken` 하면 `request.auth`와 `request.auth.token.{claims}`가 **정상으로 채워진다**. 룰은 claim을 본다 | `firestore.rules:19-20`, `chat-client.ts:42-44` | 한계 아님 — **claim은 mint 시점 권한이라 실시간 회수 불가** (TTL로 보완, §5·§7) |
| **dev/prod 프로젝트 분리** | ❌ MISSING. dev·prod가 동일 Firebase 프로젝트 → 채팅 데이터·푸시 토큰 공유. 그래서 prod 룰을 못 열고 있음 | `firebase.json`(emulator만), 선행 결정 점검포인트 5, WORKLOG L56 | **prod 출시 전 별도 프로젝트(또는 최소 컬렉션 prefix) 분리** 필수. 분리 안 하면 룰 여는 순간 dev 메시지와 실서비스가 섞임 |
| **unread / 읽음 수** | ❌ MISSING (완전 미구현). `members` 서브컬렉션 SPEC에만 존재, 코드에서 읽지도 쓰지도 않음. ChatRoom은 메시지 목록만 렌더 | SPEC "Firestore (채팅)" L604, WORKLOG L33/L35("읽음 수") | §6 신규 설계 필요 |
| **FCM 푸시 (chat_message)** | ⚠️ PARTIAL. 이벤트·대상·푸시 문구는 **완비**(`events.ts`·`targets.ts`·`push.ts:52`), `EmitOptions.push`로 ON/OFF도 지원. 그러나 **`emit('chat_message', …)`를 호출하는 곳이 코드 전체에 0건** | `lib/notifications/events.ts:25,72,101`, `push.ts:52`, `index.ts:38-44` | **메시지 전송 시 푸시 트리거가 없음 = 채팅 푸시가 실제로 안 감.** 본 문서 최대 gap (§6.3) |

---

## 3. 제안 Firestore 데이터 모델

### 3.1 컬렉션 / 경로

```
channels/{tripId}/messages/{messageId}        # 학생 포함 Trip 채팅 (기존, 변경 없음)
channels/{tripId}/ops/messages/{messageId}    # 간사 전용 조율 채널 (신규)
channels/{tripId}/members/{uid}               # 읽음 커서 (신규, 두 채널 공용)
```

> `ops`를 중간 문서로 두면 `channels/{tripId}/ops/messages/...`처럼 컬렉션 깊이가 1단 더 들어가, 룰에서 `match /channels/{tripId}/ops/messages/{messageId}`로 **독립 블록**을 깔끔히 쓸 수 있다. `ops` 문서 자체는 비워둔다(메타데이터만 필요 시).

### 3.2 메시지 문서 (학생 채널·간사 채널 동일 shape)

기존 학생 메시지와 **동일 6필드**를 유지한다(룰·클라이언트 코드 재사용).

```ts
{
  text: string,           // 1~500자 (lib/chat/message.ts MAX_MESSAGE_LENGTH와 일치)
  senderRole: "operator", // 간사 채널은 항상 operator (룰이 강제)
  senderId: string,       // operators.id (= claim.subjectId)
  displayName: string,    // 간사 이름 (1~100자)
  createdAt: serverTimestamp,  // 룰: == request.time (클라 위조 차단)
}
```

학생 채널은 `senderRole`이 `"passenger" | "operator"`. 간사 채널은 룰이 `operator`만 허용.

### 3.3 멤버십 / 읽음 커서 문서 (`members/{uid}`)

uid = 토큰 uid = `"operator:{operatorId}"` 또는 `"passenger:{passengerId}"` (토큰 라우트의 `uid` 규칙과 일치, `route.ts:49`).

```ts
{
  role: "operator" | "passenger",
  subjectId: string,
  lastReadTripAt: Timestamp | null,   // Trip(학생 포함) 채널 마지막 읽은 시각
  lastReadOpsAt: Timestamp | null,    // 간사 채널 마지막 읽은 시각 (간사만)
  updatedAt: serverTimestamp,
}
```

읽음은 **per-user "마지막 읽은 시각" 커서** 한 개로 충분(메시지별 read receipt 아님). unread 개수 = `messages where createdAt > lastReadXxxAt`의 count. 채널별 커서를 한 문서에 둬 쓰기를 줄인다.

### 3.4 간사 identity → Firebase uid → custom claims

이미 구현된 매핑을 그대로 쓴다(신규 claim 불필요):

| 항목 | 값 | 출처 |
|---|---|---|
| uid | `operator:{operators.id}` | `route.ts:49` |
| claim.role | `"operator"` | `access.ts:138` |
| claim.tripId | 해당 Trip id | `route.ts:54` |
| claim.subjectId | `operators.id` (CCC 외부 번호 아님 — 로그인 방식 바뀌어도 채팅 유지) | 선행 결정, `access.ts:138` |

간사 채널은 별도 claim이 필요 없다 — 같은 토큰의 `role/tripId/subjectId`로 룰이 판정한다.

---

## 4. 보안 룰 접근 (커스텀 토큰에서 실제로 동작하는 방식)

### 4.1 `request.auth` 한계의 정확한 정리

선행 결정·WORKLOG가 경고한 "`request.auth`가 안 잡힌다"는 **우리 자체 JWT 세션으로는 그렇다**는 의미다. 그러나 브리지의 핵심은: 서버가 권한을 판정한 뒤 **Firebase 커스텀 토큰**을 발급하고 브라우저가 `signInWithCustomToken`으로 체크인하면 → 그 순간부터 **`request.auth != null`이고 `request.auth.token.<claim>`이 채워진다.** 즉 룰은 우리 세션이 아니라 **Firebase가 검증한 토큰의 claim**을 본다. 이게 이미 `firestore.rules:19-27`에 구현돼 있고 옳다.

남는 **유일한 의미적 한계**는: claim은 토큰 mint 시점에 박혀 권한이 사라져도(매칭 취소·간사 revoke) 토큰 유효기간 동안 살아 있다 → **실시간 권한 회수가 안 됨**. 룰로는 못 막고 TTL/`revokeRefreshTokens`로 보완(§5·§7).

### 4.2 룰 스케치 (간사 서브룸 + members 추가)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // (기존) 학생 포함 Trip 채팅 — 변경 없음
    match /channels/{tripId}/messages/{messageId} {
      allow read: if request.auth != null
        && request.auth.token.tripId == tripId;
      allow create: if request.auth != null
        && request.auth.token.tripId == tripId
        && request.resource.data.senderId == request.auth.token.subjectId
        && request.resource.data.senderRole == request.auth.token.role
        && (request.resource.data.senderRole in ['passenger', 'operator'])
        && request.resource.data.text is string
        && request.resource.data.text.size() >= 1
        && request.resource.data.text.size() <= 500
        && request.resource.data.displayName is string
        && request.resource.data.displayName.size() >= 1
        && request.resource.data.displayName.size() <= 100
        && request.resource.data.createdAt == request.time
        && request.resource.data.keys().hasOnly(
            ['text','senderRole','senderId','displayName','createdAt']);
      allow update, delete: if false;
    }

    // (신규) 간사 전용 조율 채널 — role == 'operator' 만
    match /channels/{tripId}/ops/messages/{messageId} {
      allow read: if request.auth != null
        && request.auth.token.tripId == tripId
        && request.auth.token.role == 'operator';   // ★ 학생(passenger)은 여기서 deny
      allow create: if request.auth != null
        && request.auth.token.tripId == tripId
        && request.auth.token.role == 'operator'
        && request.resource.data.senderId == request.auth.token.subjectId
        && request.resource.data.senderRole == 'operator'
        && request.resource.data.text is string
        && request.resource.data.text.size() >= 1
        && request.resource.data.text.size() <= 500
        && request.resource.data.displayName is string
        && request.resource.data.displayName.size() >= 1
        && request.resource.data.displayName.size() <= 100
        && request.resource.data.createdAt == request.time
        && request.resource.data.keys().hasOnly(
            ['text','senderRole','senderId','displayName','createdAt']);
      allow update, delete: if false;
    }

    // (신규) 읽음 커서 — 본인 문서만 (uid == 'role:subjectId')
    match /channels/{tripId}/members/{memberUid} {
      allow read: if request.auth != null
        && request.auth.token.tripId == tripId;
      // 본인 커서만 쓰기. uid 규칙 = 'operator:{id}' / 'passenger:{id}'
      allow write: if request.auth != null
        && request.auth.token.tripId == tripId
        && memberUid == (request.auth.token.role + ':' + request.auth.token.subjectId)
        && request.resource.data.keys().hasOnly(
            ['role','subjectId','lastReadTripAt','lastReadOpsAt','updatedAt']);
    }

    match /{document=**} { allow read, write: if false; }  // deny-default
  }
}
```

룰 하드닝 포인트(선행 결정 점검 3): 메시지 immutable(update/delete=false), 본문/표시명 길이 상한, 필드 화이트리스트, 서버 시각 강제 — 학생 채널 룰에서 이미 적용된 패턴을 간사 채널에 그대로 복제. rate-limit은 룰로 강제 어려움(메시지 빈도 카운트 불가) → 클라 throttle + 사후 모니터링으로 보완.

---

## 5. 토큰 브리지 계약 (`/api/chat/token`)

현재 구현을 기준으로, 간사 채널은 **추가 변경 거의 없이** 동작한다.

| 항목 | 현재 | 간사 채널 영향 |
|---|---|---|
| 입력 | body `{ tripId }` (`.strict()` — 그 외 필드 400) | 변경 없음. 채널 구분은 클라가 경로로 선택, 토큰은 공용 |
| 권한 판정 | `resolveChatAccess`(세션 + Supabase) | 변경 없음. operator면 `getOperatorChatAccess` 통과 시 토큰 발급 |
| mint되는 claim | `{ role, tripId, subjectId }` | 변경 없음 — 룰이 `role=='operator'`로 간사 채널 게이트 |
| uid | `${role}:${subjectId}` | 변경 없음 (members 문서 id와 일치) |
| 미설정 처리 | `isChatAdminConfigured()` false → 503 | 변경 없음 |
| **TTL** | ❌ **현재 명시 안 함**. `createCustomToken`은 1h 토큰, 이후 ID 토큰 자동 갱신으로 사실상 무기한 | **gap.** 권한 회수(매칭 취소·revoke)가 반영 안 됨 |

**TTL 권장**: 토큰 자체 만료보다 **재진입 시 서버 재검증**에 의존한다. ChatRoom이 mount마다 `/api/chat/token`을 호출(현재 동작)하므로, 매 입장 시 최신 DB 권한으로 재판정된다. 추가로 **장시간 세션 회수**가 필요한 케이스(예: 간사 revoke)는 Admin `revokeRefreshTokens(uid)`로 끊는다(operator_revoked 흐름에 hook 추가 — V2). MVP는 "짧은 체류 + 재진입 재검증"으로 충분.

---

## 6. unread-count 전략 + PWA 푸시 배선

### 6.1 unread 계산 (읽음 수)

- **쓰기(읽음 처리)**: 채팅방 진입·포커스·스크롤 바닥 도달 시 클라가 `channels/{tripId}/members/{uid}`에 `lastReadTripAt`(또는 간사 채널이면 `lastReadOpsAt`) = `serverTimestamp()` upsert.
- **읽기(배지)**: "탑승 학생 모아보기" / `/operator` 목록에서 Trip별 unread = `messages where createdAt > lastReadXxxAt` 의 count. Firestore `getCountFromServer(query)`로 문서 안 받고 카운트만 가져온다(읽기 비용↓).
- **본인 메시지 제외**: 카운트 쿼리에 `senderId != myId` 추가하거나, 보낼 때 커서를 같이 갱신.
- **MVP 단순화**: 정확한 숫자 대신 "● 안 읽음" 점만 표시해도 됨(커서 비교 1회). WORKLOG는 "읽음 **수**"를 명시하므로 count 권장.

### 6.2 SPEC의 sent/delivered/read

SPEC §S6은 메시지별 `sent/delivered/read`를 적었으나, 그룹 채널에서 메시지별 read receipt는 비용·복잡도가 크다. **per-user 읽음 커서로 다운스코프**하고(개별 메시지 read 상태 대신 "여기까지 읽음"), 메시지별 receipt는 V2로 명시 보류 권장.

### 6.3 PWA 푸시 — `chat_message` 이벤트 재사용 (최대 gap)

알림 엔진은 이미 준비돼 있다. 빠진 건 **트리거 한 곳**이다.

- **현재**: `events.ts`에 `chat_message` 정의(`recipients: supplyOperatorId·requestOperatorId·passengerId`), `targets.ts`가 대상 전개, `push.ts:52`가 "새 메시지" 문구, `emit`이 `EmitOptions.push`로 ON/OFF 지원 — 전부 있음. **그러나 `emit('chat_message', …)` 호출이 0건** → 채팅 푸시가 실제로 안 감.
- **배선 방법**: 클라가 Firestore에 직접 쓰므로(서버 미경유) 두 경로 중 택1:
  1. **(권장) 메시지 전송 직후 클라가 서버 알림 라우트 호출** — 예: `POST /api/chat/notify { tripId }`. 서버가 (a) 세션으로 발신자 확인, (b) 이 Trip의 양쪽 간사·학생 id 조회, (c) **발신자 본인 제외**, (d) `emit('chat_message', recipients, { tripId, preview }, { push: <수신자별 ON/OFF> })`. 본문(PII) 대신 `preview`는 생략하거나 "새 메시지"로 고정 권장.
  2. **(대안) Firestore 트리거(Cloud Functions)** — onCreate `messages` → emit. 그러나 우리 알림은 Supabase 기반이라 함수에서 Supabase·env 다시 물려야 함. 무료 plan·운영 단순성에서 (1)이 우월.
- **간사 채널 푸시**: `chat_message`는 학생도 대상에 포함됨. 간사 채널 메시지는 **학생 제외**가 필수 → notify 라우트에서 채널 종류(`ops` 여부)를 받아 학생 슬롯을 빼고 `emit`. (이벤트는 재사용하되 recipients에서 `passengerId` 생략.)
- **ON/OFF**: SPEC §S6 "학생이 채팅별 ON/OFF (V1.5)" → `emit`의 `opts.push`로 이미 표현 가능. MVP는 전역 푸시 옵트인만, 채팅별 토글은 V1.5.

---

## 7. 단계별 롤아웃 (emulator → prod)

| Phase | 내용 | gate |
|---|---|---|
| **P0 (현재)** | 학생 채팅 골격 + 룰 초안 존재. prod 룰 `if false`. 에뮬레이터 개발 | — |
| **P1 dev/prod 분리** | 별도 Firebase 프로젝트(예: `bus-cignal-prod` / `-dev`) 또는 최소 컬렉션 prefix 분리. env 분기 | **팀장 승인 (코어)** |
| **P2 룰 정식화** | `firestore.rules`에 간사 서브룸 + members 블록 추가, 에뮬레이터 룰 테스트(@firebase/rules-unit-testing): 학생이 `ops` 경로 read 시도 → deny, 타 trip read → deny, 본인 아닌 members write → deny | 룰 유닛테스트 green |
| **P3 간사 채널 UI** | `/operator/chat/:tripId` + "탑승 학생 모아보기" 화면에서 진입. `chat-client.ts`에 `ops` 경로 helper 추가 | — |
| **P4 푸시 배선** | `/api/chat/notify` 라우트 + ChatRoom 전송 후 호출. 발신자 제외·간사 채널 학생 제외 검증 | E2E: 메시지→푸시 1건 |
| **P5 읽음 수** | `members` 커서 쓰기/읽기, unread 배지(getCountFromServer) | — |
| **P6 prod 배포** | 룰 prod 배포 + 권한 회수 전략(revokeRefreshTokens hook) | **팀장 승인 + iOS PWA QA(§9.3)** |

---

## 8. Open questions

1. **dev/prod 분리 방식**: 별도 프로젝트(깨끗하지만 env·콘솔 2벌) vs 동일 프로젝트 + 컬렉션 prefix(간단하지만 룰이 prefix 검사 필요). → 팀장 판단 필요. **별도 프로젝트 권장**(asia-northeast3, 무료 plan 2개 가능).
2. **간사 채널 진입점**: "탑승 학생 모아보기" 화면 내 탭 vs 별도 `/operator/chat`. 모아보기가 Trip 단위면 그 안 탭이 자연스러움.
3. **익명화 연계**(선행 결정 점검 6): 채팅 메시지 PII를 anonymize 보관정책(수련회+90일)에 포함할지. 현재 cron은 Postgres만. Firestore TTL 정책 or 별도 정리 필요 → V1.5 결정.
4. **읽음 수 정밀도**: count vs 점(dot). WORKLOG는 "수" 명시 → count 권장하나 비용 확인.
5. **간사 revoke 시 즉시 회수**: MVP는 재진입 재검증으로 충분한가, 아니면 P6에서 `revokeRefreshTokens` 필수인가.

## 9. 리스크

- 🔴 **dev/prod 미분리 상태로 룰 열기** = 개발 메시지가 실서비스와 섞임 / 전체 공개 위험. P1을 P2보다 먼저.
- 🔴 **간사 채널 PII 격리 실패** = 학생이 운영 대화 열람. 룰의 `role=='operator'` 게이트 + 별도 경로(B안)로 이중 방어. 룰 유닛테스트로 검증(P2 gate).
- 🟠 **푸시 미배선이 "구현됨"으로 오인** = `chat_message`가 정의만 되고 emit 0건. P4 전까지 채팅 푸시는 0건임을 명확히.
- 🟠 **claim 실시간 회수 불가** = 매칭 취소/간사 revoke 후 토큰 유효기간 동안 잔존. TTL 짧게 + 재진입 재검증, V2에서 revokeRefreshTokens.
- 🟠 **dev/prod 푸시 토큰 공유**(같은 Firebase면 `push_subscriptions`도 섞일 수 있음) — P1에서 같이 분리 검토.

---

## 10. 권장 (요약)

1. **방 모델 = Trip별 간사 전용 서브룸 재사용** — `channels/{tripId}/ops/messages`. 학생 채팅(`channels/{tripId}/messages`)과 **경로를 물리적으로 분리**해, 룰의 `role=='operator'` 한 줄로 PII를 격리한다. 기존 `getOperatorChatAccess`·토큰 브리지를 그대로 재사용(claim 변경 0).
2. **룰 = claims 기반이 정답이고 이미 옳다** — `request.auth`는 우리 세션으로 안 잡히지만 `signInWithCustomToken` 후 `request.auth.token.{tripId,role,subjectId}`가 채워진다(`firestore.rules`가 이미 이렇게 함). 간사 서브룸 블록 + members 블록만 추가. 남는 한계(claim 실시간 회수 불가)는 TTL/재진입 재검증으로 보완.
3. **최대 production gap = `chat_message` 푸시가 한 번도 emit되지 않음** — 이벤트·대상·문구·ON/OFF는 완비됐으나 `emit('chat_message', …)` 호출이 코드 전체에 0건. `/api/chat/notify` 라우트로 메시지 전송 직후 배선(발신자 제외, 간사 채널은 학생 제외)하는 것이 채팅 정식화의 첫 실작업. (그 다음이 dev/prod 분리 → 읽음 커서.)
