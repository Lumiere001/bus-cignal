// 사전 수합분(구글폼 CSV) 파싱·검증 — 사전 신청 가져오기(/operator/import) 전용.
// 클라이언트 미리보기와 서버 액션이 같은 규칙을 쓰도록 순수 함수로 분리 (규칙 drift 방지).
//
// 기준 구글폼: "OO지구 버스 수합 (타지구)" — 지구 / 이름 / 성별 / 연락처 / 버스 이용 / 송금 여부.
// 이 중 시스템에 반영하는 것은 지구·이름·연락처·버스 이용 4개뿐 (사용자 결정 2026-06-11).
// 성별·송금 여부·타임스탬프 등 나머지 컬럼은 파싱 단계에서 무시한다.

/** 버스 이용 형태 — 왕복은 가는편·오는편 양쪽에 신청 생성. */
export type ImportUsage = "round" | "go" | "return";

export const USAGE_LABEL: Record<ImportUsage, string> = {
  round: "왕복",
  go: "편도(갈 때)",
  return: "편도(올 때)",
};

/** 검증·정규화 완료된 1행 — phone은 숫자만, appliedAt은 KST ISO(타임스탬프 컬럼 있을 때). */
export type ImportRow = {
  region: string;
  name: string;
  phone: string;
  usage: ImportUsage;
  appliedAt: string | null;
};

export type RowError = { line: number; message: string };

/**
 * 간사 배포용 템플릿 (BOM은 다운로드 시점에 붙임 — Excel 한글 호환).
 * 타임스탬프는 선택 — 구글폼 응답 시트의 자동 기록 형식 그대로 두면 대기 순서에 반영된다.
 */
export const TEMPLATE_CSV = [
  "타임스탬프,지구,이름,연락처,버스 이용",
  "2026. 6. 1 오전 10:00:00,서울,홍길동,010-1234-5678,왕복",
  "2026. 6. 1 오전 10:05:30,대전,김믿음,010-9876-5432,편도(갈 때)",
  ",광주,이소망,010-5555-4444,편도(올 때)",
].join("\n");

export const MAX_IMPORT_ROWS = 500;

/**
 * 최소 CSV 파서 — 따옴표 필드(콤마·줄바꿈·"" 이스케이프)·CRLF·BOM 처리.
 * 구글폼 응답 내보내기(쉼표 구분)와 Excel 저장본을 모두 수용한다.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 지구명 정규화 — 공백 제거 + 끝의 "지구" 제거 ("인천지구"·"인천 지구"·"인천" 동일 취급). */
export function normalizeRegionName(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/지구$/, "");
}

/** 버스 이용 파싱 — "왕복" / "편도(갈 때)"·"갈때" / "편도(올 때)"·"올때" 변형 수용. */
export function parseUsage(raw: string): ImportUsage | null {
  const v = raw.replace(/\s+/g, "");
  if (v.length === 0) return null;
  if (v.includes("왕복")) return "round";
  if (v.includes("갈")) return "go";
  if (v.includes("올")) return "return";
  return null;
}

/**
 * 신청 시각 파싱 — 구글폼 응답 시트의 타임스탬프 형식들을 KST ISO로.
 * 인식 불가하면 null (대기 순서는 등록 시각으로 폴백).
 *  · "2026. 6. 1 오전 10:00:00"  (구글 시트 한국어 로캘)
 *  · "2026-06-01 10:00:00" / "2026-06-01T10:00"
 *  · "2026/6/1 10:00:00"
 *  · "6/1/2026 10:00:00 AM"     (구글 시트 영어 로캘)
 */
export function parseTimestamp(raw: string): string | null {
  const v = raw.trim();
  if (v.length === 0) return null;

  const build = (y: number, mo: number, d: number, h: number, mi: number, s: number): string | null => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}+09:00`;
  };
  const meridiem = (h: number, ampm: string | undefined): number => {
    if (!ampm) return h;
    const pm = ampm === "오후" || ampm.toUpperCase() === "PM";
    if (pm) return h === 12 ? 12 : h + 12;
    return h === 12 ? 0 : h; // 오전 12시 = 0시
  };

  // 2026. 6. 1 오전 10:00:00
  let m = v.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s+(오전|오후)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    return build(+m[1], +m[2], +m[3], meridiem(+m[5], m[4]), +m[6], +(m[7] ?? 0));
  }
  // 2026-06-01 10:00(:00) / 2026-06-01T10:00(:00) / 2026/6/1 10:00:00
  m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    return build(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0));
  }
  // 6/1/2026 10:00:00 AM (월/일/연 — 구글 시트 영어 로캘)
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/);
  if (m) {
    return build(+m[3], +m[1], +m[2], meridiem(+m[4], m[7]), +m[5], +(m[6] ?? 0));
  }
  return null;
}

type ColumnMap = { region: number; name: number; phone: number; usage: number; timestamp: number | null };

/**
 * 헤더 행에서 필요한 4컬럼 위치를 찾는다 — 구글폼 헤더("OO지구"·"버스 이용")와
 * 템플릿 헤더를 모두 수용하고, 그 외 컬럼(타임스탬프·성별·송금 여부)은 무시.
 */
export function findColumns(header: string[]): { ok: true; cols: ColumnMap } | { ok: false; error: string } {
  let region = -1;
  let name = -1;
  let phone = -1;
  let usage = -1;
  let timestamp = -1;

  header.forEach((rawCell, i) => {
    const cell = rawCell.trim();
    if (region === -1 && cell.includes("지구")) region = i;
    if (name === -1 && cell.includes("이름")) name = i;
    if (phone === -1 && (cell.includes("연락처") || cell.includes("전화"))) phone = i;
    // "버스비 정보를 확인하고…(송금)" 컬럼과 구분 — '이용'을 포함해야 버스 이용 컬럼.
    if (usage === -1 && cell.includes("버스") && cell.includes("이용")) usage = i;
    // 선택 컬럼 — 구글폼 응답 시트의 자동 기록("타임스탬프") 또는 "신청 시각" 류
    if (timestamp === -1 && (cell.toLowerCase().includes("timestamp") || cell.includes("타임") || cell.includes("시각")))
      timestamp = i;
  });

  const missing: string[] = [];
  if (region === -1) missing.push("지구");
  if (name === -1) missing.push("이름");
  if (phone === -1) missing.push("연락처");
  if (usage === -1) missing.push("버스 이용");
  if (missing.length > 0) {
    return { ok: false, error: `필요한 컬럼을 찾을 수 없습니다: ${missing.join(", ")} (템플릿 CSV를 참고해주세요)` };
  }
  return { ok: true, cols: { region, name, phone, usage, timestamp: timestamp === -1 ? null : timestamp } };
}

/**
 * 1행 검증·정규화 — 수기 입력·CSV 공용. 규칙은 간사 신청(validatePassengers)과 동일선:
 * 이름 1~50자, 전화 숫자 10~11자리.
 */
export function validateImportRow(raw: {
  region: string;
  name: string;
  phone: string;
  usage: string;
  timestamp?: string;
}): { ok: true; row: ImportRow } | { ok: false; message: string } {
  const region = raw.region.trim();
  const name = raw.name.trim();
  const phone = raw.phone.replace(/[^0-9]/g, "");
  const usage = parseUsage(raw.usage);
  // 신청 시각은 보조 정보 — 인식 불가해도 행을 막지 않는다(등록 시각 폴백).
  const appliedAt = parseTimestamp(raw.timestamp ?? "");

  if (region.length === 0) return { ok: false, message: "지구를 입력해주세요." };
  if (name.length < 1 || name.length > 50) return { ok: false, message: "이름을 1~50자로 입력해주세요." };
  if (phone.length < 10 || phone.length > 11) return { ok: false, message: "연락처를 올바르게 입력해주세요. (010-1234-5678)" };
  if (!usage) return { ok: false, message: "버스 이용은 왕복 / 편도(갈 때) / 편도(올 때) 중 하나여야 합니다." };

  return { ok: true, row: { region, name, phone, usage, appliedAt } };
}

/**
 * CSV 전체 파싱 — 헤더 매핑 후 행별 검증. 빈 행은 건너뛴다.
 * line은 파일 기준 1-base 행 번호(헤더=1행) — 간사가 원본에서 바로 찾도록.
 */
export function parseImportCsv(text: string): { rows: ImportRow[]; errors: RowError[] } {
  const grid = parseCsv(text);
  const nonEmpty = grid
    .map((cells, idx) => ({ cells, line: idx + 1 }))
    .filter(({ cells }) => cells.some((c) => c.trim() !== ""));

  if (nonEmpty.length === 0) {
    return { rows: [], errors: [{ line: 0, message: "CSV 내용이 비어 있습니다." }] };
  }

  const headerRow = nonEmpty[0];
  const found = findColumns(headerRow.cells);
  if (!found.ok) {
    return { rows: [], errors: [{ line: headerRow.line, message: found.error }] };
  }
  const { cols } = found;

  const rows: ImportRow[] = [];
  const errors: RowError[] = [];
  for (const { cells, line } of nonEmpty.slice(1)) {
    const result = validateImportRow({
      region: cells[cols.region] ?? "",
      name: cells[cols.name] ?? "",
      phone: cells[cols.phone] ?? "",
      usage: cells[cols.usage] ?? "",
      timestamp: cols.timestamp === null ? "" : (cells[cols.timestamp] ?? ""),
    });
    if (result.ok) rows.push(result.row);
    else errors.push({ line, message: result.message });
  }

  if (rows.length === 0 && errors.length === 0) {
    return { rows: [], errors: [{ line: headerRow.line, message: "데이터 행이 없습니다." }] };
  }
  return { rows, errors };
}
