# 채팅 인증 = Firebase 커스텀 토큰 브리지 (결정)

- **일자**: 2026-06-05
- **결정자**: 팀장(East_Star) — 채팅 담당 팀원 설계 제안 채택
- **요약**: 우리 앱은 커스텀 JWT 세션(Firebase Auth 미사용)이라 Firestore Rules의 `request.auth`가 안 잡힌다. 채팅(Firestore 실시간)은 **우리 서버가 권한을 판단한 뒤 Firebase 커스텀 토큰("출입증")을 발급**하고, 브라우저가 그 토큰으로 Firebase Auth에 로그인해 **Firestore Rules가 토큰 claim으로 최종 방어**하는 구조로 간다.

> 배경 전제: 채팅은 CCC 이후 우선순위. 현재 Firestore Rules는 `if false`(전체 차단) 유지, 로컬 개발은 **Firebase 에뮬레이터**로 진행(프로덕션 룰 열지 않음 — dev/prod 동일 프로젝트라 전체 공개 위험).

---

## 흐름 (확정)

1. 사용자가 `/chat/:tripId` 진입
2. **Next.js 서버가 우리 앱 세션 확인**(operator/passenger)
3. **Supabase DB로 이 trip 채팅 입장 권한 확인**:
   - **학생**: 해당 trip에 **paid 매칭**이 있어야 함
   - **간사**: 해당 trip의 **공급 지구** 또는 **매칭된 신청 지구**여야 함
4. 권한 있으면 **서버가 Firebase 커스텀 토큰 발급**(Admin SDK)
5. 브라우저가 그 토큰으로 **`signInWithCustomToken`**
6. **Firestore Rules가 토큰 claim으로 판단** → `onSnapshot` 실시간 구독

## 토큰 claim

```ts
{
  role: "passenger" | "operator",
  tripId: "해당 trip id",
  subjectId: "학생/간사 식별 id"   // 우리 내부 id: passenger=match_passengers.id, operator=operators.id
}
```

> subjectId는 **우리 내부 id**를 쓴다(CCC 외부 간사번호 아님) — 로그인 방식(매직링크/CCC)이 바뀌어도 채팅이 안 깨지게(`2026-06-05-ccc-operator-auth-confirmed.md` 일관).

## Firestore Rules 판단

- 로그인했는가? (`request.auth != null`)
- 토큰 `tripId` == 접근하려는 채팅방 id ?
- 메시지 쓸 때 `senderId` == 토큰 `subjectId` ?
- `senderRole` == 토큰 `role` ?

→ 브라우저가 "나는 operator다 / 다른 trip 사람이다"라고 **위조해도 Rules가 토큰 기준으로 차단**.

## 왜 이 방식 (고려한 대안 대비)

- **vs Firebase Auth를 메인 로그인으로 전환**: 우리 자체 로그인(학생 예약번호·간사 세션)을 유지하면서 Firebase에만 임시 출입증 — 전면 재작성 불필요.
- **vs 서버 프록시(브라우저가 Firestore 직접 접근 X)**: 그러면 실시간성이 약해지고 서버가 모든 메시지를 중계. 커스텀 토큰 방식은 `onSnapshot` 실시간 + 서버는 **입장 토큰만** 발급 → 서버 부하↓·확장성↑.

## 장점 (요약)

- 실시간 채팅(onSnapshot) 그대로 사용, WebSocket 서버 불필요
- 자체 로그인 구조 유지(Firebase는 출입증만)
- **권한 판단을 서버가 함** — 클라가 role/id를 주장 못함(서버가 세션+DB로 판정)
- **Firestore Rules가 최종 방어선** — 토큰 있어도 tripId 다르면 차단, senderId/role 위조 차단, 콘솔에서 SDK 직접 조작도 Rules가 막음
- 확장 용이(푸시·unread·채팅별 알림 on/off 등 Firestore 구조와 정합)

## 구현 시 만들 것 (채팅 정식화 때)

- 서버 라우트: 세션+DB 권한 판단 → Admin SDK `createCustomToken(uid, claims)` 발급
- Firestore Rules: 위 claim 검증(읽기=tripId 일치, 쓰기=senderId/role 일치)
- 데이터 모델: `chats/{tripId}/messages/{msgId}` (senderId·senderRole·text·createdAt 등)
- 클라: `signInWithCustomToken` → `/chat/:tripId` onSnapshot 구독
- 토큰 만료/갱신 정책(짧은 수명 + 재발급)

## 상태 / 재검토

**설계 확정, 빌드 보류**(CCC·핵심 출시 정리 후). 그때 Firestore Rules 작성 + 서버 토큰 라우트 구현. 그 전까지 Rules는 `if false`, 개발은 에뮬레이터.

## Confidence

high (표준 패턴, 우리 세션 모델과 정합, 최종 방어선 명확)
