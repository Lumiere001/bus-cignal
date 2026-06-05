-- 간사(operator) 매직링크 로그인 — CCC 본구현 전 임시 진입 수단.
-- 결정: docs/decisions/2026-06-05-operator-magic-link-interim-login.md
--
-- 배경: 간사 인증 본구현(verifyCccToken)이 CCC IT 신원전달 방식 확정 대기(외부 블로커).
--   그 전까지 prod에서 간사가 로그인할 경로가 0(dev-login은 prod 차단) → 앱 실사용 불가.
--   임시로, 마스터가 간사 승인 시 무작위 토큰을 발급하고, 마스터가 그 입장 링크
--   (/login/o/<token>)를 카톡으로 전달 → 간사가 링크로 입장(세션 발급).
--   CCC 방식 확정 시 이 경로를 CCC 로그인으로 교체(컬럼은 잔존 무해 또는 제거).
--
-- 보안 메모: login_token = bearer 자격증명. 마스터만 링크를 보유·배포하고, revoke 시
--   null로 무효화한다. 누출 대비 마스터가 재발급(regenerate) 가능.

alter table operators add column login_token text;

-- 다중 null 허용(미발급 간사) + 발급된 토큰은 유일.
create unique index idx_operators_login_token
  on operators (login_token)
  where login_token is not null;
