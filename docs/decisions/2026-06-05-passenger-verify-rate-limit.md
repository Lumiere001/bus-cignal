# 학생 본인확인 rate-limit 도입 (2026-06-03 결정 갱신)

- **일자**: 2026-06-05
- **결정자**: 팀장(East_Star) — 출시 준비도 감사 반영
- **요약**: 학생 본인확인(예약번호+이름+전화끝4)에 **예약번호별 시도 제한(7회 → 30분 잠금)**을 도입한다. 2026-06-03 "rate-limit 미도입" 판단을 갱신한다.

> `2026-06-03-student-access-and-ccc-integration.md`의 "무차별 대입 잠금은 두지 않기로 판단"을 본 결정이 갱신(supersede).

---

## 배경 — 왜 갱신하나

- **2026-06-03 판단**: 입구가 CCC·QR·고유링크라 "전화 끝 4자리 추측"으로 들어올 *문 자체가 없다* → rate-limit 불필요.
- **감사 반례(2026-06-05)**: 고유링크/예약번호가 **단톡·스크린샷으로 유출**되면, 코드를 아는 사람이 **이름 + 전화 끝 4자리(~1만 조합)**를 무제한 대입해 타인 PII(매칭·탑승지·연락처)를 열람·취소할 수 있다. 마스터·간사 로그인엔 잠금이 있는데 학생 입구만 무제한이었다.

## 결정

예약번호별 시도 제한: **7회 실패 → 30분 잠금**. 성공/만료 시 리셋.

## 구현

- 마이그 `20260605000006`: `reservation_verify_attempts(code pk, attempts, locked_until, updated_at)` + RLS enable + GRANT revoke(하드닝 일관, app은 service_role).
- `lib/passenger/rate-limit.ts`: `isVerifyLocked` / `recordVerifyFailure`(만료 후 첫 실패는 리셋부터) / `clearVerifyAttempts`.
- `app/r/[code]/actions.ts`: 검증 전 잠금 확인(→`?error=locked`), 실패 시 누적 기록, 성공 시 리셋. `verifyReservationEntry`(순수·테스트됨)는 시그니처 유지.
- `ReservationForm`: `locked` 안내 문구.

## 트레이드오프

- **코드 단위 잠금의 DoS 가능성**: 공격자가 특정 코드에 일부러 7회 실패시켜 정상 학생을 30분 잠글 수 있음. 단 (a) 정상 학생은 본인 정보라 보통 1회에 성공(잠기기 전), (b) CCC 내부 도구라 표적 괴롭힘 가능성 낮음, (c) 30분이라 회복 가능. → 수용. IP 기반 병행은 NAT·스푸핑 한계로 보류.
- 임계 7회 = 오타로 인한 정상 학생 잠금을 줄이면서 대입은 충분히 느리게.

## 재검토

표적 DoS가 실제 문제화되면 IP 병행·캡차·임계 조정 검토.

## Confidence

high (마스터 잠금 패턴 재사용, 앱 무영향·service_role)
