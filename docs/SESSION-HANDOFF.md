# Bus Cignal — Session Handoff

> **AI 자동 생성 파일.** 사람이 직접 편집 X.
> 도구 전환·세션 전환 시 AI가 자동 작성.

---

## 🔄 현재 인계 (Active Handoff)

```
From: Cowork 세션 (2026-05-28, 외부 셋업 1/5·2/5·3/5 부분 진행)
To: CC 세션
목적: 임시 랜딩 페이지 코드 작성 + Vercel 배포 + 카카오 비즈니스 정보 심사 재신청
```

### 사용자 가이드 (CC 세션 시작)

```bash
cd /Users/east_star/LIFE   # 또는 본인 cwd
claude                     # CC 시작
```

**CC에게 줄 첫 메시지 (한 줄):**

```
Cowork 세션에서 카카오 비즈 앱 전환까지 완료했어. 비즈니스 정보 심사에 운영 중 웹사이트 URL이 필요한데 Bus Cignal이 출시 전이라 막혔어. Vercel 셋업 + 임시 랜딩 페이지 배포해서 그 URL을 카카오에 넣는 흐름으로 가자. WORKLOG.md 읽어보고 시작해줘.
```

(CC가 자동으로 WORKLOG·SESSION-HANDOFF·CHANGELOG·`.team-role` 읽음)

### 이번 인계 핵심 (CC가 받아서 할 일)

**상황 요약**
- Cowork 세션에서 외부 도구 셋업 진행 중: Supabase ✅, Firebase ✅, 카카오 부분 진행
- 카카오는 **비즈 앱 전환 + 신청 자격 확인까지 완료**. 다음 단계 "비즈니스 정보 심사 신청"에서 막힘
- 막힌 이유: 카카오가 **실제 운영 중인 웹사이트 URL** + **서비스 화면/기획안 파일** 필수 요구
- Bus Cignal은 아직 코드 한 줄 없는 출시 전 단계 → URL 없음

**해법 (CC가 진행할 작업 순서)**
1. **Vercel 계정 확인** (사용자에게 Vercel 가입 여부 물어보기, 없으면 가입 안내 Cowork 프롬프트 발행)
2. **GitHub repo `Lumiere001/bus-cignal`에 임시 랜딩 페이지 추가**
   - 옵션 A: 단순 정적 `index.html` (`public/index.html`) — 가장 빠름
   - 옵션 B: Next.js 스캐폴드 시작 + 임시 `app/page.tsx` — Foundation Phase 1 진입과 동시에
   - 추천: **옵션 A** (카카오 심사용 임시, Foundation Phase 1은 별도 진행)
   - 페이지 내용: 서비스명·운영 주체·서비스 설명·예정 출시 일정·연락처
3. **Vercel 프로젝트 생성 + GitHub 연결** (Cowork 프롬프트로 사용자에게 전달)
4. **배포 URL 확보** → 사용자가 Cowork으로 카카오 비즈니스 정보 심사 재신청
   - 카카오 비즈니스 정보 심사 모달 (URL + 기획안 파일)
   - 기획안 파일 = `docs/OVERVIEW.md`를 PDF로 export 권장 (CC가 만들어서 제공)
5. 카카오 측 승인 대기 (1~2 영업일)
6. 승인 후 → 카카오맵 추가 기능 신청 (Cowork)

**랜딩 페이지 콘텐츠 (CC가 작성)**

서비스 소개·운영 일정·CCC IT 사역부 정보 명시. 다음 요소 포함:
- Bus Cignal 서비스명 + 짧은 한 줄 소개 ("CCC 전국 여름 수련회 차량 매칭 시스템")
- 운영 주체: CCC IT 사역부 (한국대학생선교회)
- 예정 출시: 2026년 7~8월 (여름 수련회 기간)
- 비영리·CCC 내부 운영 명시
- 연락처 (운영자 이메일 또는 CCC 공식)
- 디자인: 미니멀, 카카오맵 사용 의도 짐작 가능 (지도 이미지·버스 일러스트 등)

**작업 영역**
- 팀장 권한 (외부 인프라 셋업 + 운영 repo 수정)
- 임시 랜딩 = Foundation 진입 아님, 그냥 카카오 심사용 임시
- 정식 코드 시작은 외부 셋업 5/5 완료 후

**시크릿 정보 (참고용, 사용자가 1Password에 있음)**
- Kakao App ID: `1470045`
- JavaScript Key: `2970db3b1e9c5732e2449cf19e3660f4`
- REST API Key: `5f64a39e01a58f9f36b5c3c0a10a125e`
- Firebase Project: `bus-cignal` (Number: `745247736840`)
- Supabase Ref: `zovrgrbrzxpzmgpkxmns` (URL: `https://zovrgrbrzxpzmgpkxmns.supabase.co`)

### 자동 절차 (CC 시작 시 자동 수행)

1. `git fetch origin main` + log 비교
2. `cat WORKLOG.md` (위 핵심 컨텍스트 확인)
3. `cat docs/SESSION-HANDOFF.md` (이 파일)
4. `cat .team-role` → team-lead 확인
5. `ls ~/LIFE/projects/bus-cignal/team-lead-prompts/` → vault 존재 확인 (팀장 머신)
6. 사용자에게 "Vercel 계정 있어요? 없으면 가입 프롬프트 드릴게요" 첫 질문

---

## 📚 인계 이력 (Recent Handoffs)

(완료된 인계 시간 역순)

- 없음 (이번이 첫 도구 전환 인계)

---

## 🛠 자동화 규칙

(`CLAUDE.md`·`AGENTS.md`에 강제 절차 명시되어 있음)

### Trigger (이 파일 자동 작성 의도)
- "Cowork으로 넘기자"
- "디자인 mock 만들자 (Chat에서)"
- "Supabase 가서 직접 확인"
- "끝내자", "다음에 이어서"
- 세션 포화 임박 알림

### 자동 작성 절차
1. 현재 작업 컨텍스트 요약
2. `docs/AI-PROMPTS/` 적절한 템플릿 로드
3. 변수 채워서 복사용 코드 블록 제공
4. 이 파일 `🔄 현재 인계` 섹션 갱신

### 완료 처리
사용자 인계 완료 알림 시:
- `🔄 현재 인계` → `📚 인계 이력`로 이동
- WORKLOG 갱신 (다음 작업)
