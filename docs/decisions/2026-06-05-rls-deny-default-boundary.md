# RLS 보안 경계 = deny-default + service_role 단일 신뢰 경로 (확정)

- **일자**: 2026-06-05
- **결정자**: 팀장(East_Star) — CC 분석 후 옵션 A 선택
- **요약**: 출시 전 "RLS 정책 실적용"을 검토한 결과, 이 앱의 접근 모델상 DB RLS의 실효 역할은 "anon 키 직격 차단"뿐이며 그것은 이미 deny-default로 성립. 이를 **의도된 보안 경계로 확정**하고, 코드 점검 + GRANT revoke 하드닝으로 강화한다. 지구별 DB레벨 RLS(옵션 B)와 Supabase Auth 전환(옵션 C)은 채택하지 않는다.

---

## 배경 — 접근 모델 (코드 검증 2026-06-05)

| 항목 | 사실 |
|---|---|
| 세션(인증) | 간사·학생·마스터 전부 커스텀 JWT (jose `HS256`, `lib/auth/*-session.ts`). 우리 시크릿으로 서명. **Supabase Auth 미사용.** |
| `auth.uid()`/`auth.jwt()` | PostgREST는 Supabase JWT secret 서명 토큰만 해석 → 우리 토큰은 무시 → DB 안에서 **항상 null**. |
| DB 접근 | `createAdminClient()` = **service_role 46곳** (앱 전량). service_role은 RLS **원천 우회**. anon 클라이언트는 **1곳**(`app/operator/trips/new` → `region_locations` 공개읽기)뿐. |
| RLS 현황(prod 적용됨) | 13테이블 enable. 정책 = `regions`·`region_locations` 공개 SELECT 2개뿐. 나머지 11개(PII 포함) = 정책 0 = 비-service_role 롤에 **deny-all**. |

**핵심 함의**:
1. 앱이 100% service_role → RLS 정책을 뭘 쓰든 **앱 동작엔 0 영향**.
2. `auth.uid()`가 null → "본인 지구만" 류 정책은 우리 세션을 DB가 못 읽어 그냥 전부 deny로 떨어짐.
3. 따라서 DB RLS가 **실제로 막는 유일한 대상 = 브라우저에 노출된 anon 키로 PostgREST `/rest/v1` 직격하는 외부 접근.** 그건 **이미 deny-default로 막혀 있음.**

즉 지금은 "RLS 안 짜서 위험"이 아니라 **"RLS = deny-all backstop + 앱은 service_role 우회"** 라는, 의도대로 동작하는 상태.

## 위협 모델

- **지킬 자산**: 학생·간사 PII(이름·전화, 간사 이메일), 예약·매칭 데이터.
- **현실적 공격자**: JS 번들에서 공개 anon 키 + Supabase URL을 주워 민감 테이블을 직접 curl. → deny-default가 막음(이미 성립). **이게 90% 위협.**
- **치명적이나 비현실적**: service_role 키가 서버 밖으로 누출 → 전량 노출. 대응 = 키를 서버 밖으로 안 내보내기(아래 점검).

## 고려한 옵션

1. **A. 방어선 명문화·강화 (선택)** — deny-default를 의도된 경계로 확정 + 코드 점검 + PII 테이블 GRANT revoke 하드닝.
2. **B. 커스텀 JWT를 Supabase JWT secret로 (재)서명 → 스코프 클라이언트 → `auth.jwt()` 지구별 RLS** — DB레벨 진짜 최소권한(service_role 누출·앱버그에도 버팀). 비용 1~2일, 전환된 쿼리 fail-closed 새 버그 클래스 → **출시 후 defense-in-depth 트랙**으로 보류.
3. **C. Supabase Auth 도입** — `auth.uid()` 네이티브. 그러나 학생 무계정·간사 CCC 등 [[2026-06-03-student-access-and-ccc-integration]]에서 의도적으로 정한 아키텍처를 폐기하는 대공사 + CCC 브리지는 여전히 필요 → B 대비 이득 거의 없음. **비채택.**

## 근거 (왜 A)

- 현실 위협(anon 직격)은 A로 이미·확실히 차단. B/C가 추가로 막는 것(service_role 누출·앱 과대조회)은 단일 수련회 내부 도구의 위협 우선순위에서 후순위이며, 출시 직전 큰 리팩터의 fail-closed 리스크가 이득보다 큼.
- A는 앱의 service_role 경로(46곳)를 **전혀 건드리지 않음** → 출시 안정성 유지.

## 실행 (2026-06-05)

1. **코드 점검 (통과)**:
   - service_role을 import하는 `'use client'` 파일 **0건** (클라이언트 번들 누출 없음).
   - service_role의 `NEXT_PUBLIC` 노출 **0건**.
   - `SUPABASE_SERVICE_ROLE_KEY` 참조 = `lib/supabase/admin.ts` **단일 지점**.
   - anon 클라이언트 사용처 = `app/operator/trips/new` 1곳, `region_locations`(비-PII) 만 읽음.
2. **하드닝 마이그**: `supabase/migrations/20260605000002_rls_hardening_revoke.sql` — PII/민감 11테이블의 `anon`·`authenticated` GRANT revoke (RLS 실수 비활성화 사고 대비 다층 방어). 공개읽기 2테이블은 제외.
3. **결정 기록**: 본 문서 + `20260528000002_enable_rls.sql`의 "P2-4 후 정의" 주석이 미완성처럼 보여 매 핸드오프 오해를 낳던 것을 본 결정으로 종결.

## 후속 / 재검토

- **B 트랙**은 출시 후, service_role 의존을 줄이고 싶을 때 별도 결정으로 착수.
- 향후 **민감 테이블 추가 시** Supabase default privileges가 GRANT를 재부여하므로, 동일한 revoke를 마이그에 함께 작성할 것.
- 하드닝 마이그 **prod 적용은 core 마이그 게이트(팀장/Cowork)** 로 별도 진행 — 이번 세션은 파일·로컬검증·PR까지.

## Confidence

high (접근 모델은 코드로 검증, A는 앱 무영향·가산적)
