# E2E (Playwright) — Bus Cignal

핵심 사슬을 **실제 DB(로컬 supabase) + dev 서버**로 끝까지 검증한다. 단위(Vitest, `*.test.ts`)와
분리된 통합 레이어 — 매칭·정산·세션처럼 "여러 조각이 맞물려야 동작하는" 흐름의 회귀를 잡는다.

> 철학(참고 영상: "Playwright MCP를 쓰면 직접 클릭할 필요 없습니다"):
> **사람이 매번 클릭해 확인하는 대신, 한 번 시나리오를 코드로 박아두고 CI가 클릭한다.**
> 새 시나리오는 Playwright MCP/codegen으로 "AI가 클릭하며" 골격을 만들고 다듬는다(아래 §작성법).

---

## 빠른 시작

```bash
# 0) 최초 1회
pnpm exec playwright install chromium

# 1) 로컬 supabase 띄우고 시드 로드 (마이그 + seed.sql + seed-dev.sql)
supabase start
supabase db reset

# 2) 실행 (dev 서버는 Playwright가 :3100에 자동 기동)
pnpm test:e2e            # 헤드리스 전체
pnpm test:e2e:ui         # UI 모드(디버깅·watch)
pnpm test:e2e:reset      # supabase db reset 후 실행(완전 결정적)
pnpm test:e2e:report     # 마지막 HTML 리포트 열기
```

대부분의 스펙은 **격리 픽스처**(랜덤 UUID 생성→정리)라 `db reset` 없이 반복 실행해도 안전하다.
시드 자체를 갈아엎고 싶을 때만 `test:e2e:reset`.

---

## 아키텍처 (왜 이렇게)

| 요소 | 파일 | 이유 |
|---|---|---|
| **전용 포트 3100** | `playwright.config.ts` | 사용자의 평소 dev 서버(:3000)와 충돌 X. |
| **마스터 해시 주입** | `global-setup.ts` | `E2E_MASTER_PASSWORD`의 bcrypt 해시를 `.env.development.local`에 **append**(기존 로컬 supabase 오버라이드 보존). `.env.development.local`이 `.env.local`보다 우선이라 dev 서버가 이 해시로만 로그인됨(운영 무관). `$`는 `\$`로 이스케이프. teardown이 블록만 제거. |
| **시드 사전 점검** | `global-setup.ts` | supabase 미기동·시드 누락 시 "무엇을 하라"는 메시지로 **빠르게 실패**(원인 추적 대신). |
| **로컬 supabase 가드** | `support/env.ts` | 픽스처가 service_role로 데이터를 생성·삭제 → URL이 `127.0.0.1/localhost`가 아니면 **거부**(운영 DB 보호). |
| **storageState 인증** | `auth.setup.ts` | dev-login(seed)으로 master·operator 세션을 한 번 받아 저장 → 스펙은 `test.use({ storageState })`로 재사용(매 테스트 로그인 반복 제거). 경로는 `support/auth-paths.ts`(테스트 파일 간 import 금지 회피). |
| **격리 픽스처** | `support/db.ts` | `createApproveScenario`(공급 trip+큐 신청), `createPaidMatchScenario`(paid 매칭+예약번호)를 랜덤 UUID로 생성하고 `cleanup()`으로 정리 → 병렬·반복 안전. |
| **실패 아티팩트** | `playwright.config.ts` | `trace/screenshot/video = on-failure` + HTML 리포트. CI는 업로드(§CI). |

---

## 커버리지

| 스펙 | 시나리오 |
|---|---|
| `smoke.spec.ts` | 공개 라우팅(`/`·`/privacy`·`/login`) 렌더 |
| `master-auth.spec.ts` | 마스터 로그인 가드·오류·세션 발급(잠금 카운트) |
| `master-operator-onboard.spec.ts` | **①** 마스터가 간사 추가 → 입장 링크(매직링크) 발급 |
| `operator-approve-chain.spec.ts` | **②** 대기 큐 → 모두 선택 → **원자 승인(B3)** → 입금 확인 → 예약번호 발급 |
| `passenger-reservation.spec.ts` | **③** `/r` 본인확인 → `/me` 조회 + **푸시 옵트인 배너 분기** / 취소(취소됨) / **rate-limit 잠금** |

(미커버·후속 후보: 정산 매트릭스 금액 검증, 부분 매칭 통지, operator `자리 풀기`/`매칭 취소`, 출발 리마인더 cron.)

---

## 새 시나리오 작성법 (Playwright MCP / codegen)

1. **탐색은 AI가 클릭하게**: 로컬 dev(`pnpm dev` 또는 :3100)에 Playwright MCP를 붙여 화면을 열고
   클릭·입력하며 셀렉터를 찾는다. 또는 `pnpm exec playwright codegen http://localhost:3100/<경로>`로
   상호작용을 녹화해 골격 코드를 얻는다.
2. **셀렉터는 역할/텍스트 우선**: `getByRole("button", { name: "..." })`, `getByText(/.../)`.
   - ⚠️ Next 데브툴이 `role="alert"`를 가지므로 에러 확인은 `getByRole("alert")` 대신 **메시지 텍스트**로.
   - ⚠️ `/admin/login` 등 admin 레이아웃 하위 페이지엔 상단 nav의 `로그아웃` submit 버튼이 함께 있다 →
     `button[type=submit]` 같은 모호한 셀렉터 금지, **버튼명**으로 좁힐 것.
3. **상태는 픽스처로 만든다**: 시드 행을 직접 소비하지 말고 `support/db.ts`에 시나리오 헬퍼를 추가해
   랜덤 UUID로 생성하고 `finally`에서 `cleanup()`. → 반복·병렬 안전.
4. **세션이 필요하면** `test.use({ storageState: MASTER_STATE | OPERATOR_GWANGJU_STATE })`.
5. **서버 액션 결과를 기다려라**: 폼 제출 후 `expect(특정 텍스트/URL)`로 **렌더 완료**를 기다린 뒤 단언.
   (성급한 `goto`가 in-flight POST를 끊어 부수효과가 누락될 수 있음.)

---

## CI

`.github/workflows/e2e.yml` — main PR/push·수동 실행에서 구동:
supabase 기동 → `db reset` → `.env.development.local`에 로컬 키 주입 → Playwright 설치 → `pnpm test:e2e`
→ HTML 리포트(항상)·trace/video(실패 시) 아티팩트 업로드. 단위 CI(`ci.yml`)와 분리.

세션 서명 시크릿은 워크플로 `env`의 **더미값**(운영 무관). 마스터 해시는 globalSetup이 주입.

---

## 트러블슈팅

- **`regions/seed 없음`으로 globalSetup 실패** → `supabase start && supabase db reset`.
- **`로컬 supabase에서만 실행…` 거부** → `.env.development.local`의 URL이 로컬(127.0.0.1)인지 확인.
- **마스터 로그인 단언 실패** → `.env.development.local`에 남은 `# >>> E2E_AUTOGEN` 블록을 teardown이
  못 지웠을 수 있음(수동 제거). dev 서버 잔존 시 `lsof -ti:3100 | xargs kill -9`.
- **첫 실행이 느림** → supabase 이미지 pull. 이후 캐시됨.
