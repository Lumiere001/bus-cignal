# CC → Claude Chat: Copy 작성·검토

## When
- 학생·간사·마스터 화면 텍스트 작성·검토
- 안내 문구·에러 메시지·알림 본문 톤 다듬기

## Variables
- `{{scenario}}`: 어떤 상황의 copy인지
- `{{audience}}`: 학생 / 간사 / 마스터
- `{{current_text}}`: 현재 텍스트 (있으면)

## Prompt Template

```
Bus Cignal 안내 문구 검토·작성 부탁.

## 컨텍스트
- 프로젝트: Bus Cignal — CCC 전국 여름 수련회 타지구 차량 매칭
- 시나리오: {{scenario}}
- 대상: {{audience}}

## Copy 톤 가이드
- 학생: 친근·존댓말·간결·"○○님" 호칭
- 간사: 명확·정보 위주·액션 명시
- 시스템 메시지: 객관·짧음
- 에러: 친절·다음 단계 안내

## 현재 텍스트 (있으면)
{{current_text}}

## 요청
- 위 시나리오에 맞는 한국어 안내 문구 3안 작성
- 각 안의 장점·단점
- 추천안 명시

## 제약
- 문장 짧게 (모바일 한 줄에 들어가도록)
- 영어 X (불가피한 기술용어 외)
- 이모지 최소 (필요한 곳에만)
```

## After Completion

1. 팀 합의 후 선정
2. CC가 코드에 반영
3. i18n 도입 시 `lib/copy/` 또는 `messages/ko.json` 같은 곳에 저장
