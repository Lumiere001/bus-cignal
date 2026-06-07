import { describe, it, expect } from "vitest";
import {
  buildConsentUrl,
  parseExchangeResponse,
  branchCode,
  isEligibleStaff,
  type HandoffPayload,
} from "./handoff";

describe("buildConsentUrl", () => {
  it("client_id + state를 쿼리로 붙인다", () => {
    const url = buildConsentUrl("https://ccc-summer.vercel.app", "bus-cignal", "abc123");
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://ccc-summer.vercel.app/handoff/consent");
    expect(u.searchParams.get("client_id")).toBe("bus-cignal");
    expect(u.searchParams.get("state")).toBe("abc123");
  });

  it("state가 비면 생략한다", () => {
    const u = new URL(buildConsentUrl("https://x.test", "bus-cignal", ""));
    expect(u.searchParams.has("state")).toBe(false);
  });
});

describe("parseExchangeResponse", () => {
  it("정상 응답 → subjectId + payload", () => {
    const r = parseExchangeResponse({
      subject_id: "uuid-1",
      fields: ["name", "is_staff", "branch_no"],
      payload: { name: "홍길동", is_staff: true, branch_no: 2404 },
    });
    expect(r).toEqual({
      ok: true,
      subjectId: "uuid-1",
      payload: { name: "홍길동", is_staff: true, branch_no: 2404 },
    });
  });

  it("error 응답 → ok:false + error 전달", () => {
    expect(parseExchangeResponse({ error: "invalid_or_expired_code" })).toEqual({
      ok: false,
      error: "invalid_or_expired_code",
    });
  });

  it("subject_id 누락 → invalid_response", () => {
    expect(parseExchangeResponse({ payload: {} })).toEqual({
      ok: false,
      error: "invalid_response",
    });
  });

  it("객체 아님(null/문자열) → invalid_response", () => {
    expect(parseExchangeResponse(null).ok).toBe(false);
    expect(parseExchangeResponse("nope").ok).toBe(false);
  });
});

describe("provision 순수 헬퍼", () => {
  it("branchCode: branch_no(숫자) → 문자열 code", () => {
    expect(branchCode({ branch_no: 2404 } as HandoffPayload)).toBe("2404");
  });

  it("branchCode: branch_no 없으면 null", () => {
    expect(branchCode({} as HandoffPayload)).toBeNull();
  });

  it("isEligibleStaff: is_staff===true 만 통과", () => {
    expect(isEligibleStaff({ is_staff: true } as HandoffPayload)).toBe(true);
    expect(isEligibleStaff({ is_staff: false } as HandoffPayload)).toBe(false);
    expect(isEligibleStaff({} as HandoffPayload)).toBe(false);
  });
});
