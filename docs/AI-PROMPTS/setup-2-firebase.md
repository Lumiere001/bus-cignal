# Setup 2/5 — Firebase 프로젝트 생성 (Cowork)

## When
- Supabase setup 완료 후
- Firestore (채팅) + FCM (푸시) 활성화

## Cowork에 paste

```
Bus Cignal Firebase 프로젝트 만들어줘.

1. https://console.firebase.google.com 접속, Google 로그인
2. "프로젝트 추가" 클릭
3. 프로젝트 이름: bus-cignal
4. Google Analytics: 사용 안 함 (체크 해제)
5. "프로젝트 만들기" → 1~2분 대기

[Firestore 설정]
6. 좌측 "구축" → "Firestore Database" → "데이터베이스 만들기"
7. 모드: ★ "프로덕션 모드" (보안 규칙 나중에 설정)
8. 위치: ★★ asia-northeast3 (Seoul) — 변경 불가, 꼭 확인!
9. "사용 설정"

[Cloud Messaging (FCM) 활성화]
10. 좌측 "구축" → "Cloud Messaging" → 이미 활성화돼 있음 확인

[Web 앱 등록]
11. 프로젝트 개요 → 톱니바퀴 → "프로젝트 설정"
12. "내 앱" → 웹 아이콘 </> 클릭
13. 앱 닉네임: bus-cignal-web
14. "Firebase Hosting 설정" 체크 X
15. "앱 등록"
16. firebaseConfig 객체 복사 (apiKey·authDomain·projectId·storageBucket·messagingSenderId·appId)

[Admin SDK 서비스 계정]
17. "프로젝트 설정" → "서비스 계정" 탭
18. "새 비공개 키 생성" → JSON 다운로드 ★★ (1Password 저장)

[FCM VAPID Key (Web 푸시용)]
19. "프로젝트 설정" → "클라우드 메시징" 탭
20. "Web 푸시 인증서" → 키 쌍 생성 → VAPID public key 복사

알려줘 (전부 1Password):
- firebaseConfig 6개 키
- 서비스 계정 JSON의 private_key + client_email
- VAPID public key

완료 후 CC에 알려줘.
```

## After Completion (CC)
1. setup-3-kakao.md 안내
