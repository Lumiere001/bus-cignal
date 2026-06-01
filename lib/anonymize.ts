import { createHash } from "node:crypto";

/**
 * 개인정보 익명화 필드 매핑 — SPEC §10.3 (수련회 종료 + 90일 후 매일 새벽 익명화).
 *
 * 순수 함수 (DB·server-only 무관) — cron(app/api/cron/anonymize)이 row마다 적용.
 * SPEC 명시(이름→○○○, 전화·이메일 해시)에 더해, 재식별 위험이 큰 **자유텍스트 note는 제거**.
 *
 * ※ school_or_role(학교/직분)은 **보존** — 익명화 후 학교별 통계 용도(운영 결정).
 *   단 이는 준식별자라, 남기면 엄밀한 '익명화'라기보단 '가명처리'에 가깝다. 더 강한
 *   익명화가 필요해지면 school을 광역화하거나 익명화 전 집계로 옮길 것.
 */

const REDACTED_NAME = "○○○";

/** PII → sha256 해시. null/빈 문자열은 null. */
export function sha(v: string | null | undefined): string | null {
  return v ? createHash("sha256").update(v).digest("hex") : null;
}

/** 신청 명단(request_passengers): 이름·전화·자유노트 제거 (school_or_role 보존=통계). */
export function anonymizeRequestPassengerFields(row: { phone: string }) {
  return {
    name: REDACTED_NAME,
    phone: sha(row.phone) ?? "",
    note: null,
    anonymized: true,
  };
}

/** 매칭 명단(match_passengers): 이름·전화 제거 (school_or_role 보존=통계). */
export function anonymizeMatchPassengerFields(row: { phone: string }) {
  return {
    name: REDACTED_NAME,
    phone: sha(row.phone) ?? "",
    anonymized: true,
  };
}

/** 간사(operators): 이름·전화·이메일 제거. */
export function anonymizeOperatorFields(row: {
  phone: string | null;
  email: string | null;
}) {
  return {
    name: REDACTED_NAME,
    phone: sha(row.phone),
    email: sha(row.email),
    anonymized: true,
  };
}
