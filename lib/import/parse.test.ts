import { describe, expect, it } from "vitest";
import {
  findColumns,
  normalizeRegionName,
  parseCsv,
  parseImportCsv,
  parseTimestamp,
  parseUsage,
  validateImportRow,
  TEMPLATE_CSV,
} from "./parse";

describe("parseCsv", () => {
  it("기본 콤마 구분 + CRLF", () => {
    expect(parseCsv("a,b\r\nc,d\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("따옴표 필드 — 콤마·이중따옴표·줄바꿈 포함", () => {
    expect(parseCsv('"a,1",b\n"say ""hi""","x\ny"')).toEqual([
      ["a,1", "b"],
      ['say "hi"', "x\ny"],
    ]);
  });

  it("BOM 제거", () => {
    expect(parseCsv("﻿지구,이름\n서울,홍길동")).toEqual([
      ["지구", "이름"],
      ["서울", "홍길동"],
    ]);
  });
});

describe("normalizeRegionName", () => {
  it("공백·'지구' 접미사 제거", () => {
    expect(normalizeRegionName("인천지구")).toBe("인천");
    expect(normalizeRegionName(" 인천 지구 ")).toBe("인천");
    expect(normalizeRegionName("인천")).toBe("인천");
  });
});

describe("parseUsage", () => {
  it("왕복·편도 변형 수용", () => {
    expect(parseUsage("왕복")).toBe("round");
    expect(parseUsage("편도(갈 때)")).toBe("go");
    expect(parseUsage("편도(갈때)")).toBe("go");
    expect(parseUsage("갈 때")).toBe("go");
    expect(parseUsage("편도(올 때)")).toBe("return");
    expect(parseUsage("올때")).toBe("return");
  });

  it("인식 불가·빈 값은 null", () => {
    expect(parseUsage("")).toBeNull();
    expect(parseUsage("몰라요")).toBeNull();
  });
});

describe("parseTimestamp", () => {
  it("구글 시트 한국어 로캘 — 오전/오후", () => {
    expect(parseTimestamp("2026. 6. 1 오전 10:00:00")).toBe("2026-06-01T10:00:00+09:00");
    expect(parseTimestamp("2026. 6. 1 오후 3:05:12")).toBe("2026-06-01T15:05:12+09:00");
    expect(parseTimestamp("2026. 12. 25 오후 12:00:00")).toBe("2026-12-25T12:00:00+09:00");
    expect(parseTimestamp("2026. 1. 2 오전 12:30:00")).toBe("2026-01-02T00:30:00+09:00");
  });

  it("ISO·슬래시 형식", () => {
    expect(parseTimestamp("2026-06-01 10:00:00")).toBe("2026-06-01T10:00:00+09:00");
    expect(parseTimestamp("2026-06-01T10:00")).toBe("2026-06-01T10:00:00+09:00");
    expect(parseTimestamp("2026/6/1 10:00:00")).toBe("2026-06-01T10:00:00+09:00");
  });

  it("영어 로캘 월/일/연 + AM/PM", () => {
    expect(parseTimestamp("6/1/2026 10:00:00 AM")).toBe("2026-06-01T10:00:00+09:00");
    expect(parseTimestamp("6/1/2026 1:30:00 PM")).toBe("2026-06-01T13:30:00+09:00");
  });

  it("빈 값·인식 불가는 null", () => {
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("어제쯤")).toBeNull();
    expect(parseTimestamp("2026. 13. 1 오전 10:00:00")).toBeNull();
  });
});

describe("findColumns", () => {
  it("구글폼 헤더 — 타임스탬프 인식, 성별·송금 컬럼은 무시하고 매핑", () => {
    const header = [
      "타임스탬프",
      "OO지구",
      "이름",
      "성별",
      "연락처",
      "버스 이용",
      "버스비 정보를 확인하고, 버스비를 송금하셨습니까?",
    ];
    const found = findColumns(header);
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.cols).toEqual({ region: 1, name: 2, phone: 4, usage: 5, timestamp: 0 });
    }
  });

  it("타임스탬프 없는 템플릿도 정상 (timestamp: null)", () => {
    const found = findColumns(["지구", "이름", "연락처", "버스 이용"]);
    expect(found.ok).toBe(true);
    if (found.ok) expect(found.cols.timestamp).toBeNull();
  });

  it("필요 컬럼 누락 시 에러 메시지에 누락 컬럼 명시", () => {
    const found = findColumns(["이름", "연락처"]);
    expect(found.ok).toBe(false);
    if (!found.ok) {
      expect(found.error).toContain("지구");
      expect(found.error).toContain("버스 이용");
    }
  });
});

describe("validateImportRow", () => {
  it("정상 행 — 전화 하이픈 제거·이름 trim·시각 파싱", () => {
    const r = validateImportRow({
      region: " 서울 ",
      name: " 홍길동 ",
      phone: "010-1234-5678",
      usage: "왕복",
      timestamp: "2026. 6. 1 오전 10:00:00",
    });
    expect(r).toEqual({
      ok: true,
      row: {
        region: "서울",
        name: "홍길동",
        phone: "01012345678",
        usage: "round",
        appliedAt: "2026-06-01T10:00:00+09:00",
      },
    });
  });

  it("시각 인식 불가는 행을 막지 않고 null", () => {
    const r = validateImportRow({
      region: "서울",
      name: "홍길동",
      phone: "01012345678",
      usage: "왕복",
      timestamp: "몰라요",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.row.appliedAt).toBeNull();
  });

  it("전화 자릿수 오류", () => {
    const r = validateImportRow({ region: "서울", name: "홍길동", phone: "1234", usage: "왕복" });
    expect(r.ok).toBe(false);
  });

  it("지구 누락", () => {
    const r = validateImportRow({ region: " ", name: "홍길동", phone: "01012345678", usage: "왕복" });
    expect(r.ok).toBe(false);
  });
});

describe("parseImportCsv", () => {
  it("템플릿 CSV가 그대로 파싱된다 — 타임스탬프 포함·빈 시각 허용", () => {
    const { rows, errors } = parseImportCsv(TEMPLATE_CSV);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      region: "서울",
      name: "홍길동",
      phone: "01012345678",
      usage: "round",
      appliedAt: "2026-06-01T10:00:00+09:00",
    });
    expect(rows[1]?.usage).toBe("go");
    expect(rows[2]?.usage).toBe("return");
    expect(rows[2]?.appliedAt).toBeNull();
  });

  it("구글폼 내보내기 형식 — 추가 컬럼 무시·타임스탬프 반영·빈 행 건너뜀", () => {
    const csv = [
      "타임스탬프,OO지구,이름,성별,연락처,버스 이용,버스비 정보를 확인하고?",
      "2026. 6. 1 오전 10:00:00,인천지구,김믿음,남,010-1111-2222,왕복,예",
      "",
      "2026. 6. 1 오전 10:05:00,광주,이소망,여,010-3333-4444,편도(올 때),예",
    ].join("\n");
    const { rows, errors } = parseImportCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        region: "인천지구",
        name: "김믿음",
        phone: "01011112222",
        usage: "round",
        appliedAt: "2026-06-01T10:00:00+09:00",
      },
      {
        region: "광주",
        name: "이소망",
        phone: "01033334444",
        usage: "return",
        appliedAt: "2026-06-01T10:05:00+09:00",
      },
    ]);
  });

  it("오류 행은 파일 기준 행 번호로 보고하고 정상 행은 통과", () => {
    const csv = ["지구,이름,연락처,버스 이용", "서울,홍길동,잘못된번호,왕복", "대전,김철수,010-9876-5432,왕복"].join(
      "\n",
    );
    const { rows, errors } = parseImportCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.line).toBe(2);
  });

  it("헤더만 있고 데이터 없음 → 에러", () => {
    const { rows, errors } = parseImportCsv("지구,이름,연락처,버스 이용");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it("빈 입력 → 에러", () => {
    const { errors } = parseImportCsv("");
    expect(errors[0]?.message).toContain("비어");
  });
});
