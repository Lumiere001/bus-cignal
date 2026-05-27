# Cowork → CC: 버그 보고

## When
- Cowork으로 브라우저·앱에서 동작 확인 중 이상 발견
- 화면에서만 보이는 UI/UX 버그
- 콘솔 에러·네트워크 에러

## Variables
- `{{environment}}`: 발견 환경 (예: localhost·Vercel Preview·운영)
- `{{steps}}`: 재현 단계
- `{{expected}}`: 기대 동작
- `{{actual}}`: 실제 동작
- `{{screenshots}}`: 스크린샷·콘솔 로그

## Prompt Template (CC에 paste)

```
Bus Cignal 버그 보고:

## 환경
{{environment}}
브라우저: (Cowork이 사용한 브라우저 명시)
디바이스: (모바일/데스크탑)

## 재현 단계
1. {{steps}}

## 기대 동작
{{expected}}

## 실제 동작
{{actual}}

## 스크린샷·로그
{{screenshots}}

## 추정 영향
- 영향 파일: (Cowork이 추측한 코드 영역)
- 심각도: low / medium / high / critical

## CC가 할 일
1. 코드에서 원인 파악
2. 수정 PR 생성
3. 단위 테스트 추가 (재현)
4. Cowork에 재검증 요청 (필요 시)
```

## After Completion

1. CC 수정 → PR
2. (필요 시) Cowork에서 재검증
3. 머지 후 운영 확인
