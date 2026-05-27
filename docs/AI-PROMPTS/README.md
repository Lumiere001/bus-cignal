# AI-PROMPTS — 도구 전환 프롬프트 템플릿

> CC ↔ Cowork ↔ Claude Chat 전환 시 자동 생성될 프롬프트의 템플릿.
> AI가 `SESSION-HANDOFF.md` 작성 시 이 디렉토리 템플릿을 참조해서 변수 채워 사용.
>
> **이 디렉토리는 공통 프롬프트만** — 팀장·팀원 누구나 사용 가능.

---

## ⚠️ 팀장 전용 프롬프트는 별도 보관

다음 작업은 **팀장만** 가능 → repo에 없음:
- 외부 도구 초기 셋업 (Supabase·Firebase·카카오·Vercel 프로젝트 생성)
- 운영 DB 마이그레이션 적용 (단, 작성·로컬 테스트는 팀원도 가능)
- Vercel 환경 변수 변경
- 마스터 비밀번호 생성·rotation
- 시크릿 관리

→ 팀장 vault (`~/LIFE/projects/bus-cignal/team-lead-prompts/`)에 보관.
팀원 머신에는 없음 (vault 미공유).

---

## 공통 프롬프트 목록

| 파일 | From → To | 목적 | 누가 |
|---|---|---|---|
| `cc-to-cowork-supabase-migration.md` | CC → Cowork | DB 마이그 실행 | **로컬 dev**: 팀원·팀장 / **운영**: 팀장만 |
| `cc-to-chat-design-mock.md` | CC → Claude Chat | UI 디자인 mock | 누구나 (본인 담당 화면) |
| `cc-to-chat-copy-writing.md` | CC → Claude Chat | copy 작성·검토 | 누구나 |
| `cowork-to-cc-bug-report.md` | Cowork → CC | 버그 보고 | 누구나 |
| `chat-to-cc-design-impl.md` | Claude Chat → CC | 디자인 mock 코드 반영 | 누구나 (본인 담당 화면) |

---

## 사용 패턴

### CC가 도구 전환 의도 감지 시
1. 적절한 템플릿 선택 (도구 + 목적 매핑)
2. 템플릿 안 `{{변수}}` 자동 치환
3. `SESSION-HANDOFF.md`의 `🔄 현재 인계` 섹션에 결과 작성
4. 사용자에게 복사용 코드 블록 제공

### 새 시나리오 발견 시
- 자주 반복되는 인계 패턴은 새 템플릿 추가 (`<from>-to-<to>-<purpose>.md`)
- **팀장 전용 작업이면 vault `team-lead-prompts/`에 작성**
- 공통이면 이 디렉토리에

---

## 작성 규칙

각 템플릿은 다음 구조:

```markdown
# {{ 시나리오 이름 }}

## When
(언제 이 인계가 발생하는지)

## Who
(누가 사용 가능 — 누구나 / 팀장만 / 팀원만)

## Variables
- `{{var_name}}`: 설명

## Prompt Template
(사용자가 다음 도구에 복사할 프롬프트 — 변수 자리표시자 포함)

## After Completion
(완료 후 CC가 할 일)
```

---

## 권한 모델 요약

자세한 역할 분담: `../../CLAUDE.md` §도구 분담 · `../../ONBOARDING.md` §AI 도구 사용법.

| 역할 | 가능한 작업 |
|---|---|
| **팀장** | 모든 작업 (외부 셋업·인프라·마스터·운영 DB·시크릿) |
| **팀원 1·2** | 본인 담당 feature (UI·로컬 dev·PR·테스트) |
| **AI (CC/Cowork/Chat)** | 사용자 권한 따라 작업. 팀장 전용 프롬프트는 vault에서만 접근 |
