# 운영 이상 → GitHub Issue 자동화

운영 중 이상이 생기면 사람이 로그를 뒤지기 전에 **GitHub Issue로 자동 등록**된다. 세 층이 상보:

| 층 | 잡는 것 | 구현 | 시크릿 |
|---|---|---|---|
| **① 런타임 도메인 훅** | 앱이 감지한 운영 이상(`system_error`) — 예: 푸시 재시도 소진 | `lib/ops/report-issue.ts` + `lib/notifications/index.ts`의 `emit()` 훅 | `OPS_GITHUB_TOKEN`·`OPS_GITHUB_REPO` (Vercel env) |
| **② Actions 실패 훅** | cron/인프라 실패 — 예: 출발 리마인더 워크플로 실패 | `.github/workflows/depart-reminder.yml`의 `notify-failure` 잡 | 없음(내장 `GITHUB_TOKEN`) |
| **③ Sentry → GitHub** | 처리 안 된 런타임 예외(스택트레이스·중복 그룹화) | Sentry Integration (GUI) | Sentry↔GitHub 연동 |

## ① 런타임 도메인 훅

`emit("system_error", …)`가 호출되면(현재: 푸시 발송 재시도 소진) `reportOpsIssue()`가 동작:
- **게이트**: `OPS_GITHUB_TOKEN`(repo `issues:write` PAT) + `OPS_GITHUB_REPO`("Lumiere001/bus-cignal")가 있을 때만. 없으면 **no-op**(로컬·테스트 무영향).
- **중복 방지**: 본문에 숨긴 `ops-fingerprint` 마커로 열린 이슈를 찾아, 같은 이상이면 새 이슈 대신 "재발생" 댓글.
- **확장**: 새 도메인 이상은 해당 지점에서 `emit("system_error", {master:true}, {context, detail})` 만 호출하면 자동으로 이슈화된다(엔진이 훅).

### Cowork 셋업 프롬프트 (OPS 토큰 등록)

```text
[Cowork — Bus Cignal 운영 이슈 자동화 토큰 등록]
목표: Vercel 프로젝트 bus-cignal 에 운영 이상→GitHub 이슈용 env 2개 등록.

1) GitHub PAT 발급: github.com/settings/tokens (fine-grained)
   - Repository access: Lumiere001/bus-cignal 만
   - Permissions: Issues = Read and write
   - 발급된 토큰 복사(평문 채팅 금지 — 클립보드만)
2) vercel.com → bus-cignal → Settings → Environment Variables
   - OPS_GITHUB_TOKEN = (위 PAT)  [Production, Sensitive]
   - OPS_GITHUB_REPO  = Lumiere001/bus-cignal  [Production]
3) Redeploy. (미설정 시 기능은 그냥 비활성 — 안전)
주의: PAT는 1Password·Vercel에만. git/문서에 평문 금지.
```

## ② Actions 실패 훅 (이미 동작)

`depart-reminder` 워크플로의 `ping` 잡이 실패하면(엔드포인트 5xx·`CRON_SECRET` 누락·타임아웃)
`notify-failure` 잡이 같은 제목의 열린 이슈를 찾아 댓글, 없으면 `ops-auto` 라벨로 새 이슈 생성.
추가 시크릿 불필요(내장 `GITHUB_TOKEN` + `permissions: issues: write`).

> 다른 워크플로(e2e·ci)는 dev 단계라 기본 제외(노이즈 방지). 필요 시 같은 `notify-failure` 패턴 복사.

## ③ Sentry → GitHub (선택, GUI)

런타임 예외 자동 캡처는 Sentry가 가장 강함(스택트레이스·중복 그룹화). Cowork 프롬프트:

```text
[Cowork — Sentry ↔ GitHub Issue 연동]
1) sentry.io → 조직 Settings → Integrations → GitHub → Install → Lumiere001/bus-cignal 권한.
2) 프로젝트(bus-cignal) → Alerts → Create Alert Rule:
   - 조건: "A new issue is created" (또는 issue가 N분에 M회)
   - 액션: "Create a GitHub issue in Lumiere001/bus-cignal"
3) 저장. 테스트로 한 번 예외를 던져 이슈 생성 확인.
```
