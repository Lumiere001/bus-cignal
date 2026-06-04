# Git 워크플로 (AI·사람 공용 · 필독)

> 팀원이 쓰는 AI(CC·Codex·Cursor 등)도 이 규칙을 따릅니다. **브랜치를 마음대로 만들지 말 것.**

## 🚦 절대 규칙 (요약)

1. **`main`에 직접 commit·push 절대 금지.** 항상 새 브랜치.
2. **한 작업 = 한 브랜치 = 한 PR.** 여러 기능을 한 브랜치에 섞지 않음.
3. **분기는 항상 최신 `main`에서. ❌ 다른 PR 브랜치 위에 쌓지 말 것(스택 PR 금지).** 의존 코드가 아직 머지 안 됐어도 `main`에서 분기. (스택 PR은 squash 머지 시 일부가 main에 안 들어가 유실 — 2026-06-04 #16/#17/#19 사고)
4. **머지는 팀장만** (PR approve). 팀원은 PR까지.
5. 본인 브랜치만 push. 남의 브랜치·`main` force-push 금지.
6. `.env.local`·시크릿·`.team-role` commit 금지 (gitignored).

---

## 1. 작업 시작 (브랜치 생성)

```bash
git checkout main
git pull origin main           # 항상 최신 main에서 시작 (⚠️ 다른 작업/PR 브랜치에서 분기 금지 = 스택)
git checkout -b <type>/<영역>-<요약>
```

### 브랜치 네이밍 (`<type>/<영역>-<요약>`)
| type | 용도 | 예시 |
|---|---|---|
| `feat/` | 기능 | `feat/matching-queue-ui` |
| `fix/` | 버그 | `fix/r-code-verify` |
| `refactor/` | 리팩터 | `refactor/settlement-query` |
| `docs/` | 문서 | `docs/spec-clarify-s3b` |
| `test/` | 테스트 | `test/matching-approve` |
| `chore/` | 설정·의존성 | `chore/add-playwright` |

- 소문자 + 케밥케이스. 한글 X.
- **영역**은 본인 분담 기준: 팀원1 = `matching`·`operator`·`admin`·`settlement` / 팀원2 = `passenger`·`me`·`chat`·`kakao`.

---

## 2. 커밋

```bash
git add <바꾼 파일들>          # git add -A 보다 명시적으로
git commit -m "feat(matching): 큐 시각순 정렬 + 수동 승인 UI"
```

- **Conventional Commits**: `type(scope): 한 줄 요약` (자세히 `CONTRIBUTING.md`)
- scope: `matching`·`settlement`·`chat`·`auth`·`db`·`ui`·`operator`·`passenger`·`admin`·`notifications`
- 작은 커밋 자주. WIP·의미 없는 메시지 X.

---

## 3. Push & PR

```bash
git push -u origin <본인-브랜치>      # ⚠️ origin main 아님!
gh pr create --base main --title "..." --body "..."   # 또는 GitHub UI
```

- PR 본문: 변경 요약 + 관련 SPEC 섹션 + 테스트 결과 체크
- CI(typecheck·lint·test·build) 통과해야 머지 가능
- 팀장 리뷰 → approve → **팀장이 머지**

---

## 4. 매일 / 충돌

```bash
# main이 앞서갔으면 rebase
git checkout main && git pull
git checkout <본인-브랜치>
git rebase main
# 충돌 해결 후
git rebase --continue
git push --force-with-lease           # --force 아님 (안전)
```

---

## 5. ❌ 하지 말 것

- `git checkout main` 후 거기에 직접 commit
- `git push origin main` (보호됨, 막힘)
- `git push --force` (공유 브랜치 파괴) — `--force-with-lease`만
- `.env.local`·service_role·카카오 REST 키 등 시크릿 commit
- 매칭 엔진·RLS·정산·마이그 = `core` 라벨 + 팀장 사전 합의 없이 변경
- **다른 PR 브랜치 위에 새 브랜치 쌓기(스택 PR)** — squash 머지 때 일부 코드가 main에 안 들어가 유실. 항상 `main`에서 분기.

---

## 🤖 AI 도구에게 (CC·Codex·Cursor)

- 작업 시작 시 **반드시 최신 `main`에서 새 브랜치 생성 후** 코드 수정. main 작업 금지. **다른 PR/작업 브랜치 위에 쌓지 말 것(스택 금지)** — 의존 코드가 미머지여도 `main`에서 분기.
- 브랜치 이름은 위 규칙(`<type>/<영역>-<요약>`)을 따를 것.
- push는 **본인 브랜치만**. PR 생성까지. 머지는 사람(팀장)이 함.
- 불확실하면 멈추고 사용자에게 확인.

> 자세한 commit/PR 규칙: `CONTRIBUTING.md` · 역할/권한: `ROLES.md` · 세팅: `ONBOARDING.md`
