# Setup 3/5 — 카카오 개발자센터 앱 등록 (Cowork)

## When
- Firebase setup 완료 후
- 카카오맵 JavaScript SDK 키 발급

## Cowork에 paste

```
Bus Cignal 카카오맵 앱 등록해줘.

1. https://developers.kakao.com 접속, 본인 카카오 계정 로그인
2. "내 애플리케이션" → "애플리케이션 추가하기"
3. 입력:
   - 앱 아이콘: 생략 OK
   - 앱 이름: Bus Cignal
   - 회사명: CCC IT 사역부 (또는 본인)
4. "저장"

생성된 앱 클릭 → 다음 작업:

[앱 키]
5. 좌측 "앱 설정" → "앱 키" 메뉴
   - JavaScript 키 복사 ★
   - REST API 키 복사 ★

[플랫폼 등록]
6. 좌측 "앱 설정" → "플랫폼"
7. "Web 플랫폼 등록" 클릭
8. 사이트 도메인 입력 (한 줄에 하나씩):
   - http://localhost:3000
   - https://bus-cignal.vercel.app
   (Vercel 도메인 확정 후 추가 등록)
9. 저장

[카카오맵 API 활성화 확인]
10. 좌측 "제품 설정" → "카카오맵"
11. 활성화 확인 (무료 30만 호출/일)

알려줘 (1Password 저장):
- JavaScript 키 → NEXT_PUBLIC_KAKAO_MAP_API_KEY
- REST API 키 → KAKAO_REST_API_KEY
- 등록한 도메인 목록

완료 후 CC에 알려줘.
```

## After Completion (CC)
1. setup-4-vercel.md 안내
