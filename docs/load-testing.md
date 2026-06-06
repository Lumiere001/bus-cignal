# 부하 테스트 · 더미데이터 (로컬) — 런북

> 다음 세션 그대로 따라 실행. 1000~2000명 규모로 **코드가 버티는지** 로컬에서 측정 +
> **prod 무료 티어가 버티는지**는 아래 용량 계산으로 보완(둘은 분리해 결론).

## 0. 전제
- `supabase start` (로컬 supabase 떠 있어야 함). 최초 1회 `pnpm exec playwright install chromium`.
- 스크립트는 `.env.development.local`의 로컬 service_role로 동작(운영 보호 가드 내장).

## 1. 더미데이터 생성
```bash
node scripts/load/seed-dummy.mjs --students 2000 --regions 15   # 또는 pnpm load:seed
```
- 지구 15 × (공급·수요 간사) + 차량 30 + 신청/학생 ~2000 + paid 예약 ~40%.
- 끝에 **QA용 샘플 예약번호** 출력(학생 `/r` 확인용). seed의 `BUS-7K9M`(이지은/4444)도 그대로 존재.
- 마커(`ccc_id LIKE 'load-%'`, `note LIKE '[LOAD]%'`)로만 생성 → seed/실데이터와 안 섞임.

## 2. 부하 측정 — ⚠️ **prod 빌드로** (dev는 느려서 수치 왜곡)
```bash
# 정확한 수치: 최적화 빌드로 띄우고 측정
pnpm build
ENABLE_DEV_LOGIN=true PORT=3100 pnpm start &      # 프로덕션 서버(:3100)
# (서버 뜨면)
node scripts/load/load-test.mjs --vus 200 --duration 30   # 또는 pnpm load:test
```
- 학생/간사/마스터 세션을 1회 확보 후, 읽기 혼합(`/me` 40% · `/` 20% · `/r` 15% · `/operator` 15% · `/admin` 10%)을 동시 VU로 폭격.
- 출력: 엔드포인트별 **p50/p95/p99**·에러율·총 **req/s**.
- 동시성↑: `--vus 500 --duration 30` 등으로 올려가며 p95·에러율이 꺾이는 지점 관찰.

### 해석 기준(가이드)
- **에러율 > 1%** 또는 **p95 > 1s**(prod 빌드 기준) 나오면 병목 → 아래 점검.
- 느린 쿼리: `EXPLAIN ANALYZE`로 인덱스 누락 확인 (특히 `/operator`·`/admin` 집계, `/me` 매칭 조회).
- 매칭 동시성(over-booking)은 E2E + `approve_request_atomic` 락으로 이미 검증됨.

## 3. 정리 (출시 전 / 측정 후)
```bash
node scripts/load/seed-dummy.mjs --wipe            # 또는 pnpm load:wipe — 더미만 삭제(seed 보존)
```

---

## 로컬 측정 ≠ prod 한계 (꼭 분리)
로컬 부하는 **코드/쿼리/연결풀 병목**을 정확히 잡지만(이건 인프라 무관 동일), prod **무료 인스턴스의 자원 천장**은 로컬(고성능 맥)이 과소평가한다. prod 버팀은 아래 계산으로.

### prod 무료 티어 용량 — 2000명 가정
| 자원 | 예상 부하 | 여유? |
|---|---|---|
| Supabase Free (DB 500MB) | 학생·매칭·알림 = 수만 row, **수 MB** | ✅ 데이터량 여유. 리스크 = **예약 오픈 동시 스파이크**(공유 인스턴스·연결풀) |
| Vercel Hobby (대역폭 100GB·함수/월) | 2000명 브라우징 ≈ 수~10GB·수만 호출 | ✅ 여유(한 행사 기준) |
| Firebase Firestore Spark | 읽기 5만·쓰기 2만 **/일** | ⚠️ **채팅 폭주 시 일일 쿼터 근접** (읽기 경로는 supabase라 무관) |
| FCM 푸시 | 무제한 | ✅ |

### 한도 초과 시 회복(= prod 테스트 비권장 이유)
| 자원 | 회복 |
|---|---|
| Supabase 성능 | **즉시**(부하 멈추면) — 락아웃 아님 |
| Supabase/Vercel 대역폭·함수 | **월 리셋** (최악 시 수 주 정지) |
| Firestore 일일 쿼터 | **매일 자정 PT ≈ 17:00 KST** (~24h) |

### 권고
- **부하 = 로컬에서만**(무료 티어 안 건드림). prod 버팀은 위 계산 + 필요 시:
  - 예약 오픈 대량 동시 접속 예상 → **Supabase Pro($25/mo)** 또는 오픈 시간 분산.
  - 채팅 활성 예상 → Firestore 사용량 모니터(초과 시 Blaze 전환, 소액 종량).
- **눈으로 QA = Preview + dev-login**(prod는 dev-login 끈 채 유지). 더미는 위 생성기로 소량.
