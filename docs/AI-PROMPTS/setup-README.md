# 외부 도구 셋업 가이드 — 5단계

> Foundation 시작 전 팀장이 진행하는 외부 도구 셋업.
> Cowork으로 진행 (setup-5는 CC + 1Password).
> CC가 다음 세션 시작 시 이 디렉토리 읽고 순차 안내.

---

## 진행 순서

| # | 작업 | 도구 | 시간 |
|---|---|---|---|
| 1 | Supabase 프로젝트 생성 (Seoul) | Cowork | ~10분 |
| 2 | Firebase 프로젝트 + Firestore + FCM | Cowork | ~15분 |
| 3 | 카카오 개발자센터 앱 등록 | Cowork | ~5분 |
| 4 | Vercel 프로젝트 + GitHub 연동 + env vars | Cowork | ~10분 |
| 5 | 마스터 비번 + bcrypt hash | CC + 1Password | ~5분 |

**총 소요**: ~45분 + 키 복사·1Password 정리 시간

---

## 사용 방법

각 단계마다:
1. CC가 `setup-N-<name>.md` 파일 읽음
2. "Cowork으로 진행할까요?"
3. 사용자가 OK → CC가 프롬프트 코드 블록 제공
4. 사용자 Cowork에 paste → 진행 → 키·정보 받아옴
5. 사용자 CC에 결과 보고 → 1Password 저장 + WORKLOG 갱신
6. 다음 단계로

---

## 키 분배 정리

| 키 | 저장 위치 | 사용 환경 |
|---|---|---|
| Supabase URL·anon | 1Password + Vercel env + 팀원 dev `.env.local` | 클라이언트 |
| Supabase service_role | 1Password + Vercel env (server only) | 서버 only, ★ 팀원 X |
| Firebase config 6개 | 1Password + Vercel env + 팀원 `.env.local` | 클라이언트 |
| Firebase Admin (JSON) | 1Password + Vercel env (server only) | 서버 only, ★ 팀원 X |
| 카카오맵 JS 키 | 1Password + Vercel env + 팀원 `.env.local` | 클라이언트 |
| 카카오 REST 키 | 1Password + Vercel env (server only) | 서버 only |
| MASTER_PASSWORD (원본) | 1Password ★★ 팀장만 | — |
| MASTER_PASSWORD_HASH | 1Password + Vercel env (server only) | 서버 only |

### 팀원에게 줄 키 (dev용)
- Supabase: 본인 로컬 (`supabase start`로 자체 생성)
- Firebase: 팀장이 dev project 추가로 만들어 dev 키 공유 OR 운영 키 공유 (RLS·Rules로 보호)
- 카카오: JS 키만 (도메인 localhost 등록되어 있음)
- 마스터 비번: 본인 dev용으로 자기가 정함

---

## 완료 후

- 모든 키 1Password 정리 ✓
- Vercel env vars 입력 ✓
- WORKLOG 갱신: "외부 도구 셋업 5/5 완료"
- → **Foundation Phase 2 진입** (외부 의존 작업 시작 가능)
