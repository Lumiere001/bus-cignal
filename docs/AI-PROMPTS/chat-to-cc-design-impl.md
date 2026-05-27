# Claude Chat → CC: 디자인 mock 코드 반영

## When
- Claude Chat에서 디자인 mock 후보 선정 완료
- 실제 React 컴포넌트로 구현 필요

## Variables
- `{{design_spec}}`: 선정된 디자인 명세 (Chat 출력)
- `{{target_path}}`: 코드 위치 (예: `app/(passenger)/me/page.tsx`)
- `{{related_files}}`: 영향 받는 파일

## Prompt Template (CC에 paste)

```
Bus Cignal {{page_name}} 디자인 구현 요청.

## 컨텍스트
- 페이지: {{page_name}}
- 위치: {{target_path}}
- 관련 파일: {{related_files}}

## 선정된 디자인 명세 (Claude Chat 출력)
{{design_spec}}

## CC가 할 일
1. shadcn/ui 컴포넌트 사용해서 구현
   - 필요 시 `npx shadcn add <component>` 추가
2. Tailwind utility class 위주
3. 모바일 우선 (375px baseline)
4. TypeScript strict
5. Zod 스키마 검증 (폼 있으면)
6. 단위 테스트 작성 (논리 있으면)
7. 한국어 copy (위 명세 그대로)
8. 접근성 (aria-label·키보드)

## 제약
- `'use client'` 명시 (인터랙티브 컴포넌트만)
- 서버 컴포넌트 기본
- 시크릿 X
- `lib/matching/*` 같은 코어 영역 변경 X

## 출력
- PR 생성 (Conventional Commits)
- 변경 파일 요약
- 테스트 결과
```

## After Completion

1. CC 구현 → PR
2. Cowork에서 시각적 검증 (필요 시)
3. 머지
