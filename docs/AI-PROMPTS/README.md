# AI-PROMPTS — 도구 전환 프롬프트 템플릿

> CC ↔ Cowork ↔ Claude Chat 전환 시 자동 생성될 프롬프트의 템플릿.
> AI가 `SESSION-HANDOFF.md` 작성 시 이 디렉토리 템플릿을 참조해서 변수 채워 사용.

---

## 템플릿 목록

| 파일 | From → To | 목적 |
|---|---|---|
| `cc-to-cowork-supabase-migration.md` | CC → Cowork | DB 마이그레이션 실행 |
| `cc-to-cowork-vercel-env.md` | CC → Cowork | Vercel env vars 설정 |
| `cc-to-cowork-firebase-rules.md` | CC → Cowork | Firestore Security Rules 배포 |
| `cc-to-chat-design-mock.md` | CC → Claude Chat | UI 디자인 mock 생성 |
| `cc-to-chat-copy-writing.md` | CC → Claude Chat | 학생·간사용 copy 작성·검토 |
| `cowork-to-cc-bug-report.md` | Cowork → CC | GUI에서 발견한 버그 보고 |
| `chat-to-cc-design-impl.md` | Claude Chat → CC | 선정된 디자인 mock 실제 코드 반영 |

---

## 사용 패턴

### CC가 도구 전환 의도 감지 시
1. 적절한 템플릿 선택 (도구 + 목적 매핑)
2. 템플릿 안 `{{변수}}` 자동 치환
3. `SESSION-HANDOFF.md`의 `🔄 현재 인계` 섹션에 결과 작성
4. 사용자에게 복사용 코드 블록 제공

### 새 시나리오 발견 시
- 자주 반복되는 인계 패턴은 새 템플릿 추가 (`<from>-to-<to>-<purpose>.md`)
- 팀장 또는 AI가 작성

---

## 작성 규칙

각 템플릿은 다음 구조:

```markdown
# {{ 시나리오 이름 }}

## When
(언제 이 인계가 발생하는지)

## Variables
- `{{var_name}}`: 설명

## Prompt Template
(사용자가 다음 도구에 복사할 프롬프트 — 변수 자리표시자 포함)

## After Completion
(완료 후 CC가 할 일)
```
