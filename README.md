# 🚌 Bus Cignal

> **CCC 전국 여름 수련회 타지구 차량 매칭·정산·소통 통합 서비스**
> v1.0 기획 확정 (2026-05-26) · 개발 진입 단계

---

## 한 줄 소개

카톡 오픈채팅으로 처리하던 **타지구 차량 자리 나눔**을 시스템으로 — 공정·투명·편리하게.

---

## 빠른 시작

```bash
# Clone
gh repo clone Lumiere001/bus-cignal
cd bus-cignal

# 설치 (Node 20+ · pnpm)
pnpm install

# 환경 변수 (.env.local — East_Star에게 받기)
cp .env.example .env.local  # 그리고 값 채우기

# 개발 서버
pnpm dev          # http://localhost:3000

# 검증
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

---

## 기술 스택

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- **DB·Auth**: Supabase (Seoul)
- **Chat**: Firebase Firestore (asia-northeast3)
- **Maps**: 카카오맵 SDK
- **Deploy**: Vercel
- **Pkg**: pnpm

---

## 문서

| 파일 | 용도 |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | **v1.0 정본 기획안** (필독) |
| [`docs/OVERVIEW.md`](docs/OVERVIEW.md) | 외부 공유용 친근 톤 |
| [`docs/REGIONS.md`](docs/REGIONS.md) | 전국 지구 마스터 (52개) |
| [`CLAUDE.md`](CLAUDE.md) | AI 컨텍스트 (Claude Code 우선) |
| [`AGENTS.md`](AGENTS.md) | AI 컨텍스트 (Codex 등, CLAUDE.md 미러) |
| [`ONBOARDING.md`](ONBOARDING.md) | **팀원 시작 가이드** (먼저 읽기) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | commit·PR·branch 규칙 |
| [`COWORK.md`](COWORK.md) | Cowork 활용 가이드 |

---

## 폴더 구조 (예정)

```
bus-cignal/
├── app/             # Next.js App Router
├── components/      # UI 컴포넌트
├── lib/             # 도메인 로직·클라이언트
│   ├── matching/    # ★ 매칭 엔진 (코어)
│   ├── settlement/  # ★ 정산 (코어)
│   ├── supabase/
│   ├── firebase/
│   └── kakao/
├── supabase/        # 마이그레이션·시드
├── docs/            # 기획·결정 로그
├── data/            # 지구 seed CSV
└── tests/
```

---

## 권한 모델

| Role | 역할 |
|---|---|
| **master** | CCC IT 사역부 — 전국 모니터링·이상상황 개입 |
| **operator** | 차량 간사 — 본인 지구 Trip CRUD·승인·정산 |
| **passenger** | 학생 — 예약번호로 본인 매칭 조회·Trip 채팅 |

---

## 개발 흐름

1. `main` 직접 push X — **PR만 머지**
2. East_Star 승인 1명 필수
3. CI (typecheck + lint + test) 통과 필수
4. 매칭 엔진·RLS·정산 변경은 추가 검토

자세한 규칙: [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## 라이선스

(TBD — 출시 직전 결정)

---

## 운영 주체

**CCC IT 사역부**

문의·이슈는 GitHub Issues 또는 East_Star (팀장).
