# 디자인 시스템 — warm-trust

"신뢰감 있는 핀테크 + 따뜻한 공동체" 방향. 돈/공정성/투명성(핀테크적 신뢰)과 CCC 사역/공동체의
온기를, 모바일 우선으로. (방향 합의: 2026-06-06)

## 토큰 (`app/globals.css`)

기존 shadcn 시맨틱 토큰 위에 온기를 더함:
- **배경**: 순백 대신 따뜻한 오프화이트(`--background: oklch(0.991 0.004 95)`), 카드는 흰색으로 띄움
- **회선**: 따뜻한 톤(`--border: oklch(0.912 0.006 80)`)
- **radius**: 0.75rem (앱 같은 부드러움)
- **시맨틱 색**: primary 파랑(정보) · success 초록(입금/예약완료) · warning 호박(대기) · destructive 빨강(주의)

## 공용 컴포넌트

| 컴포넌트 | 용도 |
|---|---|
| `components/brand/logo.tsx` | 🚌 Bus Cignal 워드마크 (엠블럼+텍스트) |
| `components/ui/status-pill.tsx` | 시맨틱 상태 칩 (info/success/warning/danger/neutral) |
| `components/ui/stat-card.tsx` | 대시보드 통계 카드 (시맨틱 색·아이콘·큰 숫자) |
| `components/nav/bottom-tab-nav.tsx` | 모바일 하단 고정 탭바 (간사) — 줄바꿈 nav(P3) 대체 |
| `components/nav/scroll-nav.tsx` | 가로 스크롤 알약 탭 (마스터 — 섹션 8개) |

## 적용 화면

- **랜딩** (`app/page.tsx`): 브랜드 바·엠블럼·노선 모티프·**"First, No matter what"**·값 칩·CTA
- **간사** (`app/operator/{layout,page}.tsx`): 상단 앱바 + 하단 탭바, 시맨틱 스탯 카드
- **학생** (`components/me/MatchCard.tsx`, `components/passenger/ReservationForm.tsx`): 예약 카드·코드칩, 본인확인 폼
- **마스터** (`app/admin/{layout,page}.tsx`): 브랜드 바 + 스크롤 네비, 시맨틱 스탯 카드

## 모티프·톤

- 🚌 + 점선 **노선(route)** 모티프 = "이어주는 길"
- 큰 숫자 + 시맨틱 색으로 위계 (돈·긴급이 도드라지게)
- "안전한 길 되세요 🙏" 등 사역 공동체 온기

## 참고

- 목업(합의본): [`mockup/warm-trust.html`](mockup/warm-trust.html)
- 적용 전/후 스크린샷: `docs/design/current/`(전) · `docs/design/applied/`(후) — 로컬 산출물(미커밋)
