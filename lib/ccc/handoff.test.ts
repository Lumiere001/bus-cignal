import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildConsentUrl,
  parseExchangeResponse,
  branchCode,
  isEligibleStaff,
  cccBase,
  cccBases,
  exchangeCode,
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

describe("cccBases / cccBase — 허용 베이스 목록", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("env 없음 → 기본 2개(테스트·실수련회) 모두 허용", () => {
    vi.stubEnv("CCC_SUMMER_BASE", "");
    expect(cccBases()).toEqual([
      "https://ccc-summer.vercel.app",
      "https://sc2026.kccc.org",
    ]);
  });

  it("env 단일 값 = primary로 맨 앞, 기본 2개는 항상 허용(중복 제거)", () => {
    vi.stubEnv("CCC_SUMMER_BASE", "https://sc2026.kccc.org/");
    expect(cccBases()).toEqual([
      "https://sc2026.kccc.org",
      "https://ccc-summer.vercel.app",
    ]);
    expect(cccBase()).toBe("https://sc2026.kccc.org");
  });

  it("쉼표 구분 복수 값 — 공백·끝 슬래시 정리, 순서 보존", () => {
    vi.stubEnv(
      "CCC_SUMMER_BASE",
      " https://sc2026.kccc.org/ , https://ccc-summer.vercel.app ",
    );
    expect(cccBases()).toEqual([
      "https://sc2026.kccc.org",
      "https://ccc-summer.vercel.app",
    ]);
  });
});

describe("exchangeCode — 멀티 베이스 순차 시도", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const OK_JSON = {
    subject_id: "uuid-1",
    payload: { name: "홍길동", is_staff: false },
  };
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    });

  it("primary가 코드를 모르면 다음 베이스에서 성공", async () => {
    vi.stubEnv("CCC_SUMMER_BASE", "");
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return String(url).startsWith("https://ccc-summer.vercel.app")
          ? json({ error: "invalid_or_expired_code" })
          : json(OK_JSON);
      }),
    );

    const r = await exchangeCode("c1", "https://app.test/api/ccc/callback");
    expect(r).toEqual({ ok: true, subjectId: "uuid-1", payload: OK_JSON.payload });
    expect(calls.map((c) => c.url)).toEqual([
      "https://ccc-summer.vercel.app/api/handoff/exchange",
      "https://sc2026.kccc.org/api/handoff/exchange",
    ]);
    // 두 시도 모두 동일한 code·client_id·redirect_uri를 보낸다.
    for (const c of calls) {
      expect(c.body).toEqual({
        code: "c1",
        client_id: "bus-cignal",
        redirect_uri: "https://app.test/api/ccc/callback",
      });
    }
  });

  it("primary 성공 시 다른 베이스는 호출하지 않는다", async () => {
    vi.stubEnv("CCC_SUMMER_BASE", "");
    const fetchMock = vi.fn(async () => json(OK_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const r = await exchangeCode("c1", "https://app.test/api/ccc/callback");
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("한 베이스가 다운(네트워크 오류)이어도 다음 베이스로 진행", async () => {
    vi.stubEnv("CCC_SUMMER_BASE", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        if (String(url).startsWith("https://ccc-summer.vercel.app")) {
          throw new Error("ECONNREFUSED");
        }
        return json(OK_JSON);
      }),
    );

    const r = await exchangeCode("c1", "https://app.test/api/ccc/callback");
    expect(r.ok).toBe(true);
  });

  it("전부 실패 → primary의 에러를 돌려준다", async () => {
    vi.stubEnv("CCC_SUMMER_BASE", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) =>
        String(url).startsWith("https://ccc-summer.vercel.app")
          ? json({ error: "invalid_or_expired_code" })
          : json({ error: "unknown_client" }),
      ),
    );

    expect(await exchangeCode("c1", "https://app.test/api/ccc/callback")).toEqual({
      ok: false,
      error: "invalid_or_expired_code",
    });
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
