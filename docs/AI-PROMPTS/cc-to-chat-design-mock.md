# CC → Claude Chat: UI 디자인 Mock 생성

## When
- 새 페이지·컴포넌트 디자인 결정 필요
- 여러 후보 시안 비교 필요

## Variables
- `{{page_name}}`: 디자인할 페이지 (예: `/me 학생 대시보드`)
- `{{key_elements}}`: 핵심 요소 (예: 매칭 카드·지도·간사 카드·채팅 진입)
- `{{copy_tone}}`: 톤 (예: 학생 친근·존댓말·간결)
- `{{constraints}}`: 제약 (예: 모바일 우선 375px·shadcn/ui·Tailwind)

## Prompt Template

```
Bus Cignal {{page_name}} 디자인 mock 만들어줘.

## 컨텍스트
- 프로젝트: Bus Cignal — CCC 전국 여름 수련회 타지구 차량 매칭 시스템
- 페이지: {{page_name}}
- 대상 사용자: {{user_type}}

## 핵심 요소
{{key_elements}}

## 디자인 시스템
- shadcn/ui 컴포넌트 (Radix 기반)
- Tailwind CSS
- 폰트: Pretendard (한글 최적)
- 아이콘: Lucide React
- 색상: Primary Blue (신뢰) / Accent Green (성공) / Warning Yellow / Danger Red
- 모바일 우선 (iPhone 13 baseline, 375px)
- {{constraints}}

## Copy 톤
{{copy_tone}}

## 요청
디자인 후보 3개 만들어줘. 각각:
- 레이아웃 wireframe (ASCII 또는 React JSX)
- 핵심 컴포넌트 구조
- Tailwind class 명시
- 모바일 vs 데스크탑 차이
- 장단점

## 출력 형식
3개 후보를 각각 별도 섹션으로:
### 후보 A
### 후보 B  
### 후보 C

마지막에 비교표 + 추천.
```

## After Completion

1. 팀이 후보 선정
2. CC에 선정 결과 + 디자인 명세 전달
3. CC가 실제 코드(.tsx)로 구현
4. PR 생성
