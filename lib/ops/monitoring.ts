import type { Json } from "@/lib/supabase/database.types";

/**
 * 마스터 운영 모니터링 — 순수 로직(임계값·신호 판정·포맷·DB 통계 파싱).
 *
 * IO(서버 집계)는 `app/admin/system/page.tsx`의 loadMonitoring()에 있다(server-only).
 * 여기엔 부수효과 없는 함수만 둬서 단위 테스트가 가능하게 한다
 * (lib/notifications가 events·targets·retry를 server-only index와 분리한 것과 동일 패턴).
 *
 * 플랫폼 쿼터(연결풀·대역폭·함수 호출)는 앱이 직접 못 읽으므로,
 * **DB측에서 읽을 수 있는 신호**(용량 비율·활동량·알림 실패)로 Pro 승급 시점을 추정한다.
 */

// ── 임계값 (한 곳에서 관리) ───────────────────────────────────────────────
/** Supabase Free 플랜 DB 한도(500MB). */
export const FREE_DB_LIMIT_BYTES = 500 * 1024 * 1024;
/** DB 용량 경고/위험 비율. */
export const DB_WARN_RATIO = 0.8;
export const DB_CRIT_RATIO = 0.9;
/** 오늘 알림 실패 누적 경고 임계(FCM·네트워크 점검 신호). */
export const NOTIF_FAIL_WARN = 10;
/** 오늘 신규 신청 경고 임계(예약 오픈 동시 접속 스파이크 신호). */
export const REQUEST_SPIKE_WARN = 500;

export type SignalLevel = "ok" | "warn" | "crit";

export type Signal = { level: "warn" | "crit"; title: string; detail: string };

export type ProRecommendation = { level: SignalLevel; signals: Signal[] };

export type Monitoring = {
  db: {
    sizeBytes: number;
    limitBytes: number;
    ratio: number; // sizeBytes / limitBytes (0..1+)
    topTables: { name: string; bytes: number }[];
  };
  rows: {
    operators: number;
    trips: number;
    seatRequests: number;
    passengers: number; // request_passengers
    matches: number;
    notifications: number;
  };
  today: {
    requests: number;
    matches: number;
    notifSent: number;
    notifPending: number;
    notifFailed: number;
  };
  pro: ProRecommendation;
  generatedAt: string; // ISO (UTC)
};

/** bytes → 사람이 읽는 단위. 예) 13_167_763 → "12.6 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** DB 용량 비율·활동량·알림 실패로 Supabase Pro 권장 신호를 산출. */
export function evaluateSignals(input: {
  dbRatio: number;
  todayRequests: number;
  todayNotifFailed: number;
}): ProRecommendation {
  const signals: Signal[] = [];

  if (input.dbRatio >= DB_CRIT_RATIO) {
    signals.push({
      level: "crit",
      title: "DB 용량 90% 초과",
      detail: `무료 한도(${formatBytes(FREE_DB_LIMIT_BYTES)})에 임박했습니다. Pro 승급 또는 데이터 정리가 필요합니다.`,
    });
  } else if (input.dbRatio >= DB_WARN_RATIO) {
    signals.push({
      level: "warn",
      title: "DB 용량 80% 초과",
      detail: `무료 한도(${formatBytes(FREE_DB_LIMIT_BYTES)}) 대비 여유가 줄고 있습니다. 추세를 지켜보세요.`,
    });
  }

  if (input.todayNotifFailed >= NOTIF_FAIL_WARN) {
    signals.push({
      level: "warn",
      title: "알림 실패 누적",
      detail: `오늘 알림 실패가 ${input.todayNotifFailed}건입니다. FCM 크리덴셜·네트워크를 점검하세요.`,
    });
  }

  if (input.todayRequests >= REQUEST_SPIKE_WARN) {
    signals.push({
      level: "warn",
      title: "신청 폭주",
      detail: `오늘 신규 신청이 ${input.todayRequests}건입니다. 예약 오픈 동시 접속 스파이크 시 Pro 또는 오픈 시차 분산을 고려하세요.`,
    });
  }

  const level: SignalLevel = signals.some((s) => s.level === "crit")
    ? "crit"
    : signals.some((s) => s.level === "warn")
      ? "warn"
      : "ok";

  return { level, signals };
}

export type DbStats = { sizeBytes: number; tables: { name: string; bytes: number }[] };

/** admin_db_stats RPC의 Json 반환을 안전하게 파싱(타입 보장 없는 Json → 좁히기, bytes 내림차순). */
export function parseDbStats(json: Json | null): DbStats {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { sizeBytes: 0, tables: [] };
  }
  const size = json.db_size_bytes;
  const rawTables = json.tables;
  const tables: { name: string; bytes: number }[] = [];
  if (rawTables && typeof rawTables === "object" && !Array.isArray(rawTables)) {
    for (const [name, bytes] of Object.entries(rawTables)) {
      if (typeof bytes === "number") tables.push({ name, bytes });
    }
  }
  tables.sort((a, b) => b.bytes - a.bytes);
  return { sizeBytes: typeof size === "number" ? size : 0, tables };
}
