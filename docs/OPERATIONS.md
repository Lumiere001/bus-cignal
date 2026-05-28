# Bus Cignal — 운영 체크리스트

> 수련회 운영 주기에 맞춰 quota·장애·익명화 등을 점검하는 매뉴얼.
> AI가 수련회 D-day 접근 시 자동 알림하는 게 가장 안전. 현재는 수동.

---

## 0. 누가·언제 보나

- **주체**: 팀장 (CCC IT 사역부 운영 책임자)
- **시점**:
  - 수련회 D-14: 사전 점검 시작
  - 수련회 D-7: quota·결제 대비 마지막 체크
  - 수련회 활성기 (D-3 ~ D+1): 매일 quota 모니터
  - 수련회 종료 + 90일: 익명화 동작 확인
- **AI 자동화 가능 시점**: cron + Sentry alert 통합 후 (V1.5)

---

## 1. ⚠️ Firestore reads quota — **가장 위험**

### 한도
- **Spark plan (무료)**: **50,000 reads/일**, 20K writes/일, 10GB bw/월
- 초과 시 = 다음 자정(PST)까지 read 실패 → **채팅 멈춤 = 운영 위기**

### 위험 구간
| 시점 | risk | 예상 reads/일 |
|---|---|---|
| 평시 | 🟢 낮음 | ~수백 |
| D-7 ~ D-3 | 🟡 중간 — 매칭 활성기 | ~5K~15K |
| **D-1 ~ D+1 출발일 폭주** | 🔴 **높음** — 채팅·매칭 동시 폭주 | **30K~80K** (한도 임박~초과 가능) |
| 수련회 종료 후 | 🟢 낮음 | ~수십 |

### D-7 체크리스트
- [ ] Firebase Console → Firestore → Usage 탭 진입
- [ ] 최근 7일 평균 reads/일 확인
- [ ] 추세선 (출발일 가까울수록 ↑)
- [ ] 80% (40K/일) 도달 시 → 다음 항목 진행

### 한도 80% 도달 시 — Blaze plan 전환
1. Firebase Console → 좌측 하단 "업그레이드" → Blaze (종량제)
2. Google Cloud Billing 계정 연결 (카드 등록 — Google One 카드 재사용 가능)
3. 예산 알림 설정: $5/월·$10/월·$20/월 → 메일
4. 전환 후에도 free tier는 그대로 (free 한도 초과분만 과금)
5. **예상 추가 비용**: 수련회 1회당 $5~$30 (안전 마진 큼)
6. 수련회 종료 + 1주 후 → 사용량 0 확인 → Spark plan 회귀 (선택)

### 채팅 read 최적화 (코드 차원, V1.5 검토)
- onSnapshot listener는 변경 push만 — 신규 read 1회 후 무거움 없음
- 페이지 새로고침 시 listener 재구독 = 다시 1회 read → **재구독 빈도 낮추기** (offline cache 활용)
- 학생 진입 시 채널 자동 join 회수 제한
- 메시지 페이지네이션 (최근 50개만 로드, 스크롤 시 추가)

---

## 2. Supabase bandwidth — 잔잔하지만 모니터

### 한도
- **Free plan**: 5GB egress/월, DB 500MB, 50K MAU
- 초과 시 = API 응답 지연·실패 → 운영 위기

### D-7 체크리스트
- [ ] Supabase Dashboard → Settings → Usage
- [ ] 이번 달 egress / DB size / Auth users 확인
- [ ] egress 4GB 도달 시 → Pro plan 전환 검토 ($25/월)

### 7일 비활성 일시정지
- Supabase Free는 7일간 query 0이면 프로젝트 일시정지
- **운영 중에는 자연스레 활성** — 무관
- **수련회 끝나고 6일째**에 한 번 대시보드 열어주면 sleep 회피

---

## 3. Vercel bandwidth & build minutes

### 한도 (Hobby)
- 100GB bandwidth/월
- 6,000 build minutes/월
- 100GB-hours serverless function

### 위험도
- 🟢 낮음 — 수련회 1회 ≪ 100GB
- 단, **Hobby ToS = personal/non-commercial** → 조직 운영 시 회색
- 안전책: Pro plan $20/월 (≈26,000원/월)

### 체크
- [ ] D-7: Vercel Dashboard → Usage 확인
- [ ] Vercel이 ToS 이유로 메일·차단 통지 보낸 적 있는지 확인

---

## 4. 카카오맵 quota

### 한도 (무료)
- 지도 표시: 300,000건/일
- REST API (지오코딩): 100,000건/월

### 위험도
- 🟢 매우 낮음 — 학생 수천 × 다중 조회로도 안 넘김
- 체크: D-1에 카카오 개발자센터 → 통계 한 번만 확인

---

## 5. FCM (푸시 알림)

- **무제한 무료** — 한도 없음
- 다만 푸시 발송 실패율 모니터
- [ ] D-3: Firebase Console → Cloud Messaging → 최근 발송 통계 → 실패율 5% 이하 확인
- README §S8 발송 실패 3회 재시도 정책 작동 확인

---

## 6. 익명화 cron (수련회 종료 + 90일)

- README §9.10·§10.3 결정: **매일 새벽 3시 KST 자동 익명화**
- **확인 시점**: 수련회 종료 + 91일 후 (= 익명화 첫 실행 다음 날)
- [ ] DB에서 sample row의 name/phone/email이 마스킹되었는지 확인
  ```sql
  SELECT name, phone, anonymized
  FROM request_passengers
  WHERE created_at < NOW() - INTERVAL '90 days'
  LIMIT 10;
  ```
- [ ] `anonymized = true` + `name = '○○○'` + phone = sha256 해시 확인
- [ ] 마스터 대시보드 D-day 카운트다운이 0으로 표시되는지

---

## 7. 운영 직전 통합 점검 (D-7)

한 번에 다 체크하는 매크로 리스트:

- [ ] Firestore reads/일 < 30K (안 그럼 Blaze 전환 준비)
- [ ] Supabase egress < 4GB/월
- [ ] Vercel build minutes < 5,000
- [ ] 카카오맵 일일 사용량 < 100K
- [ ] FCM 푸시 실패율 < 5%
- [ ] Sentry 에러 추세 — 최근 7일 신규 에러 0
- [ ] 모든 cron 작업 정상 (Phase 1 만료 1분 cron, 익명화 새벽 3시)
- [ ] 마스터 비번 rotation 90일 경과 시 갱신
- [ ] 백업 복원 테스트 (Supabase 자동 백업 - dump 받아서 로컬 import 가능 확인)

---

## 8. 장애 발생 시 — 마스터 알림 채널

README §S8: 시스템 장애 → 마스터 알림 (인앱 + 푸시)
- Sentry alert → 마스터 메일·푸시 (V1.5에 통합)
- 한도 초과 시 → API 5XX → Sentry 캡처 → 마스터에게

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-28 | 초안 — Firestore reads quota 위험 명시 + 수련회 D-7 통합 점검 |
