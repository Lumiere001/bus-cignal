# 팀원 초대 — 카톡 멘트 + 받을 자료 (팀장용)

> 팀장이 팀원에게 카톡으로 보낼 안내문. `○○` 자리만 이름으로 바꿔 발송.
> 협업 규칙 상세는 `ONBOARDING.md`·`docs/TEAM-TASKS.md`·`docs/GIT-WORKFLOW.md`·`ROLES.md`가 커버.

---

## 📱 팀원 1 — 운영자·마스터 화면

```
[Bus Cignal 합류 환영 🚌]

안녕하세요! CCC 여름 수련회 '타지구 차량 매칭' 서비스 Bus Cignal 같이 만들 ○○님 환영해요 🙏

▪️ 맡으실 영역: 운영자·마스터 화면 (Trip 등록 · 매칭 큐 · 정산 · 관리자)

1) 먼저 GitHub 사용자명 보내주세요 → 저장소 collaborator로 추가해드릴게요

2) 셋업 (추가되면 알려드려요)
  · 저장소: github.com/Lumiere001/bus-cignal
  · ONBOARDING.md 그대로:
      gh repo clone Lumiere001/bus-cignal
      echo "team-member-1-operator" > .team-role
      pnpm install
      supabase start && supabase db reset   (Docker 필요 — 테스트 데이터 자동 로드)
      pnpm dev
  · dev 키(.env.local)는 팀 노션 'dev 키'에서 복사 (Firebase 웹config 등)

3) 화면 바로 테스트 (CCC 로그인 연동 전이라 dev 로그인 사용)
  · localhost:3000/dev/login → seed 간사(김광주/박부산)·마스터 선택 → 진입
  · 자세히: docs/TEAM-TASKS.md §0b

4) 첫 작업 (작은 PR로!)
  · docs/TEAM-TASKS.md 의 '팀원 1' 표 순서대로
  · 추천 시작: ② Trip 생성 폼  또는  ③ lib/matching 순수함수 (인증 무관, 바로 가능)

5) ⚠️ 꼭 알고 시작 (기획 v1.1)
  · 매칭 = 시각순 정렬 + 간사가 직접 선택 (FIFO 강제·자동 매칭 없음, priority는 힌트)
  · 간사 로그인 = CCC 로그인 (Google 아님, 아직 연동 대기 — 화면부터 만들면 돼요)
  · 자세히: docs/SPEC.md §7 · §5.5

6) 🌳 git 규칙 (쓰시는 AI한테도 꼭 알려주세요)
  · 항상 새 브랜치(feat/<영역>-<요약>), main 직접 push X, 한 작업=한 PR, 머지는 팀장
  · 전문: docs/GIT-WORKFLOW.md

막히면 카톡 / GitHub Issue 주세요. 같이 만들어요 🙏
```

---

## 📱 팀원 2 — 학생·채팅 화면

```
[Bus Cignal 합류 환영 🚌]

안녕하세요! Bus Cignal 같이 만들 ○○님 환영해요 🙏

▪️ 맡으실 영역: 학생 화면·채팅 (예약번호 진입 · 내 매칭 · 카카오맵 · Firestore 채팅)

1) 먼저 보내주실 것
  · GitHub 사용자명 → collaborator 추가해드릴게요
  · ⭐ 카카오 개발자 앱: ○○님 계정으로 'Bus Cignal' 앱을 등록해서 JS키·REST키 주세요
    (팀장 계정은 비즈 주체 충돌로 카카오 키를 못 받아서, 지도 담당이신 ○○님이 등록해주셔야 해요)

2) 셋업 (추가 후)
  · 저장소: github.com/Lumiere001/bus-cignal
  · ONBOARDING.md 따라:
      gh repo clone Lumiere001/bus-cignal
      echo "team-member-2-passenger" > .team-role
      pnpm install
      supabase start && supabase db reset
      pnpm dev
  · dev 키(.env.local)는 팀 노션. 카카오 키는 본인이 등록한 값 사용

3) 화면 바로 테스트
  · 학생: localhost:3000/r/BUS-7K9M → 이름 '이지은' + 전화 끝4자리 '4444'
  · 자세히: docs/TEAM-TASKS.md §0b

4) 첫 작업
  · docs/TEAM-TASKS.md 의 '팀원 2' 표 순서대로
  · 추천 시작: ① /r/:code 학생 진입  또는  ② /me 매칭 카드 (Supabase만으로 바로 가능)

5) ⚠️ 알고 시작 (기획 v1.1)
  · 학생은 로그인 없이 예약번호 + 전화 끝4자리 (CCC 가입 안 한 학생도 OK)
  · PWA 푸시 = 옵트인 (조회는 항상, 알림은 원하는 학생만 / iOS는 홈화면 추가)
  · Firebase 채팅·카카오 고급기능은 키/심사 대기 → 그 전엔 mock·기본지도로 선개발
  · 자세히: docs/SPEC.md §3(S5) · §5.7 · §9.3

6) 🌳 git 규칙 (쓰시는 AI한테도)
  · 항상 새 브랜치, main 직접 push X, 한 작업=한 PR, 머지는 팀장. 전문: docs/GIT-WORKFLOW.md

막히면 카톡/Issue 주세요. 같이 만들어요 🙏
```

---

## ✅ 팀장이 받아야 할 것 (체크리스트)

| 누구 | 받을 것 | 용도 |
|---|---|---|
| 팀원 1 | GitHub 사용자명 | collaborator 추가 |
| 팀원 2 | GitHub 사용자명 | collaborator 추가 |
| 팀원 2 | **카카오 앱 JS 키 · REST 키** (본인 등록) | 지도·지오코딩 |

## 팀장이 줄 것

| 줄 것 | 어떻게 |
|---|---|
| GitHub collaborator(Write) 초대 | Cowork/gh |
| dev 키 (Firebase 웹config 등) | 팀 노션 'dev 키'에 붙여넣기 |
| (선택) 마스터 dev 비번 안내 | 각자 본인 dev용 생성 가능 — 공유 불필요 |
