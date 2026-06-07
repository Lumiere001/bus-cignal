# Bus Cignal — 프로덕션 활성화 런북 (PROD-ACTIVATION)

> 코드는 거의 완성(main 반영). 이 문서는 **사용자/Cowork가 직접 해야 하는 prod 활성화 단계**를 한 곳에 모은 체크리스트다.
> CC(자동화)는 prod 시크릿·Firebase 로그인·비밀번호 입력을 하지 않으므로, 아래는 사람이 수행한다.
> 최종 갱신: 2026-06-07 (#89~#101 머지 시점).

---

## 0. 현재 상태

- ✅ **코드 완료·main 머지**: Phase 2(간사)·Phase 3(마스터)·Phase 5(공개)·지도 방식B·동적 매칭 그래프·신청 취소/수정·매칭 정렬·채팅(카톡식+KCCC·읽음 수·멤버 프로필)·보안 점검(GO-with-fixes, 수정 완료).
- ✅ **검증**: E2E 35 passed + 채팅 로컬 에뮬레이터 E2E(간사↔학생 실시간).
- ✅ **prod 활성 완료(2026-06-07)**: prod 마이그 db push(regions·chat_mutes·trips_cancellable 등 Local==Remote) · **firestore.rules 최신본 배포** · 카카오 지도 도메인 등록.
- ⏳ **남은 출시 전 작업**: 약관 org 4항목(값 대기) · 카카오 프리뷰 핀 배포 후 확인 · **🏁 최종 시퀀스(보안 테스트→데이터 삭제→배포)**.
- ⛔ **외부 대기(출시 차단 아님)**: CCC consumer/지구코드, CCC 연결 예외·해지 큐 (CCC IT API 도착 후 — 그 전엔 매직링크로 운영).

배포: https://bus-cignal.vercel.app (main 머지 시 Vercel 자동 배포). prod Supabase = `bus-cignal-prod`.

---

## ① prod regions 시드 (가장 먼저 — "지구 선택 안됨" 해소)

prod `regions` 테이블이 비어 있어 간사 추가·차량 등록의 지구 드롭다운이 빈다. 둘 중 하나로 해소:

**방법 A (즉시, GUI)** — Supabase 대시보드 → `bus-cignal-prod` → SQL Editor 에 아래를 붙여넣고 Run:
```bash
# 터미널에서 regions SQL을 클립보드로 복사
cat ~/Projects/bus-cignal/supabase/seed.sql | pbcopy
```
→ 붙여넣기 → Run. (53개 지구, `on conflict (code) do nothing` 이라 재실행 안전. regions만 들어감 — dev 계정 X.)

**방법 B (파이프라인)** — 마이그레이션으로 자동:
```bash
supabase db push   # 20260607000000_seed_regions.sql 적용 → prod regions 채움
```
(prod DB 비밀번호 프롬프트는 사용자가 입력. 멱등이라 안전.)

> regions는 **실데이터(참조)** → 최종 배포 후에도 유지. 삭제 대상 아님.

---

## ② 카카오 지도 — 배포 환경 검증 (Cowork)

지도는 도메인 등록된 곳에서만 렌더(localhost 미표시). 사용자 말로는 prod 도메인은 이미 등록됨 → **검증만** 필요. 새 Cowork 세션에 아래 붙여넣기:

```
Bus Cignal 지도(방식 B) 실배포 검증.
[배경] 배포: https://bus-cignal.vercel.app . 간사 "차량 등록"과 "내 정보 > 출발지/도착지 관리"에 방식 B(지도에서 주소 검색→결과 선택→핀 확정)가 들어감. 카카오 지도는 도메인 등록된 환경에서만 렌더.
[순서]
1. (필요 시) developers.kakao.com → NEXT_PUBLIC_KAKAO_MAP_API_KEY 쓰는 앱 → 앱설정>플랫폼>Web "사이트 도메인"에 https://bus-cignal.vercel.app 등록 확인.
2. 마스터 로그인 → /admin/operators 에서 간사 입장 링크 발급 → /login/o/<token> 로 간사 입장.
3. 내 정보>출발지/도착지 관리: 주소 검색("평창 대관령")→결과 선택→핀 표시→저장 반영 확인.
4. 차량 등록: 지도(검색/핀)로 출발·도착 선택 동작 확인.
5. 학생 차편 지도(/me/trip)·간사 매칭 결과 지도 렌더 확인.
[보고] 지도 렌더 여부·검색→핀→저장 동작·브라우저 콘솔 에러·스크린샷. 안 되면 카카오 도메인 설정/콘솔 에러 캡처.
```

---

## ③ 채팅 prod 활성화 (Firebase) — ⚠️ 가장 손이 많음

현재 채팅은 **로컬 에뮬레이터에서만 검증**됨. prod에서 켜려면:

1. **dev/prod Firebase 분리** — 지금은 한 프로젝트 공유라 규칙을 열면 dev까지 전체공개 위험. **prod 전용 Firebase 프로젝트 생성** → prod용 웹 config + Admin 서비스계정 발급.
2. **Vercel env(Production)** 설정: `NEXT_PUBLIC_FIREBASE_*`(prod 웹 config), `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`(prod 서비스계정), `NEXT_PUBLIC_FIREBASE_VAPID_KEY`. (`NEXT_PUBLIC_FIREBASE_USE_EMULATOR`는 prod에 **설정하지 말 것**.)
3. **Firestore 보안 규칙 배포** — ⚠️ **CLAUDE.md §2.1: Firebase 규칙=코어, 팀장 명시 승인 게이트**. `firestore.rules`는 main에 있음(messages + members + deny-default, claim 검증). **2026-06-07 갱신: messages create에 `senderRole='system'` 입장/퇴장 분기 추가**(본인 것만·텍스트=displayName 파생 고정으로 위조 차단). 로컬 `pnpm test:rules`(firebase-tools@14, Java11) **22 pass**로 검증됨. 검토 후:
   ```bash
   firebase login              # 사용자 본인 구글 OAuth
   firebase use <prod-project>
   firebase deploy --only firestore:rules
   ```
4. **실배포 채팅 스모크**: 간사1·학생2로 버스(상/하행)방 입장 → 메시지·읽음 수·멤버·**입장/퇴장 안내·음소거 토글** 표시 확인.

> **DB 마이그**: 채팅 푸시 음소거(#104)는 `chat_mutes` 테이블이 필요 → prod에 마이그 `20260607000001_chat_mutes.sql` 적용해야 한다(regions 마이그와 함께 `supabase db push` 한 번으로 처리되거나, 이미 db push했다면 포함됨). 미적용 시 음소거 토글이 500(테이블 없음) — 단 채팅 메시지 자체는 영향 없음.
> 참고: 보안 점검 Finding 1(토큰 비회수)은 클라 주기적 재검증으로 보완됨. 더 강한 회수는 cancel/revoke 시 `revokeRefreshTokens` 추가가 향후 옵션. Finding 3(푸시 옵트인)은 #104 음소거로 **해소**.

---

## ④ 약관 「확정 필요」 4항목

`/terms`·`/privacy`의 placeholder 4개를 사용자 제공값으로 교체:
- 운영 주체(법적 명칭) · 개인정보 보호책임자 · 연락처 · 시행일.
→ 값 주시면 CC가 페이지에 반영(텍스트 교체).

---

## 🏁 최종 마무리 시퀀스 (사용자 확정 — 순서대로)

> **모든 기능/문구 작업 완료 → ① 보안 테스트 → ② 실배포 데이터 전체 삭제(채팅 포함) → ③ 최종 배포.**
> 데이터 삭제는 되돌릴 수 없으니 반드시 이 순서(테스트 통과 후 삭제).

### ① 보안 테스트 (기능 훼손 없이)
- **회귀(기능 보존)**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` 전부 green 확인(읽기 전용, 기능 안 건드림).
- **보안 리뷰**: `/security-review`(현재 diff) 또는 코드베이스 보안 점검 1회 — IDOR·RLS·세션·인젝션·시크릿 노출·채팅 규칙 재확인. (이전 점검 = GO-with-fixes, Finding 전부 반영됨.)
- **채팅 규칙**: `pnpm test:rules`(firebase-tools@14 에뮬레이터) 22 pass 재확인.

### ② 실배포 데이터 전체 삭제 — '클린 슬레이트'
실험용으로 쌓인 간사·차량·신청·매칭·학생·장소·알림·음소거 전부 삭제. **보존: regions(53지구) · system_config.**
```bash
# (a) Supabase 운영 데이터 — 로컬에서 검증된 스크립트(scripts/load/wipe-prod.mjs)
#     1) DRY RUN(행 수만 확인, 안 지움):
SUPABASE_URL=<prod-url> SUPABASE_SERVICE_ROLE_KEY=<prod-service-role> node scripts/load/wipe-prod.mjs
#     2) 실제 삭제:
SUPABASE_URL=<prod-url> SUPABASE_SERVICE_ROLE_KEY=<prod-service-role> node scripts/load/wipe-prod.mjs --confirm
```
> ⚠️ `--confirm` 없으면 안 지움. URL/키는 **prod 값**을 명시해야 함(Supabase 대시보드 > Settings > API/Database, 1Password). FK 순서·regions 보존은 로컬에서 검증 완료.

```
# (b) 채팅(Firestore) 메시지/멤버 — Firebase 콘솔
#     console.firebase.google.com > bus-cignal > Firestore Database > 'channels' 컬렉션 삭제
#     (chat_mutes는 위 (a) Supabase 삭제에 포함됨)
```

### ③ 최종 배포
- main이 최신·CI green이면 Vercel이 이미 Production에 자동 반영(추가 배포 불필요).
- 라이브 스모크: 마스터 로그인 · 간사 매직링크 입장 · 학생 `/r`(입금확인된 코드) · 정산 · 공개 `/status` · 채팅 입퇴장.

---

## ⑥ 출시 전 체크리스트

- [x] ① prod regions 시드 (db push 적용 완료, 53지구)
- [ ] ② 카카오 지도 배포 검증 (Cowork) — 프리뷰 핀 버그 #118 수정됨, 배포 후 1회 확인
- [x] ③ 채팅 firestore.rules 배포 완료 + chat_mutes/trips_cancellable 마이그 push 완료
- [ ] ④ 약관 org 4항목 반영 (값 대기)
- [ ] ⑤ 보안 테스트 → 데이터 삭제 → 최종 배포 (위 🏁 시퀀스)
- [ ] main 최신 + CI green + Vercel Production 정상
- [ ] 라이브 스모크 (마스터·간사·학생·정산·/status·채팅)

---

## 외부 대기 (출시 차단 아님 — 매직링크로 운영 가능)

- **CCC consumer + 지구코드 매핑** (Phase 6): CCC IT API 도착 후 `?code=` 콜백→검증→operator upsert→세션 구현.
- **CCC 연결 예외/해지 큐** (Phase 3 잔여): CCC 자동입장 의존 → consumer 이후.
- **채팅 고급**(입장 system 메시지·푸시 옵트인 컬럼[보안점검 Finding 3, Info]): 채팅 prod 안정화 후 트랙.
