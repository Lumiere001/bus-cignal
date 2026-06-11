import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveLoginExchange,
  STAFF_CALLBACK_PATH,
  STUDENT_CALLBACK_PATH,
} from "./resolve-login";

// exchange는 fetch로 CCC에 POST — client_id별 응답을 흉내내 cross-client 재시도를 검증.
// (베이스 URL·시도 횟수에 의존하지 않게 client_id 기준으로만 분기 — 멀티 베이스와 호환)

const ORIGIN = "https://app.test";

type Call = { url: string; body: Record<string, unknown> };

function stubFetchByClient(responses: Record<string, unknown>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ url: String(url), body });
      return new Response(JSON.stringify(responses[String(body.client_id)]), {
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

const STAFF_OK = {
  subject_id: "staff-1",
  payload: { name: "김간사", is_staff: true, branch_no: 2404 },
};
const STUDENT_OK = {
  subject_id: "stu-1",
  payload: { name: "박학생", is_staff: false, branch_no: 2404 },
};
const REJECT = { error: "invalid_or_expired_code" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveLoginExchange — 간사 콜백 진입(entry=staff)", () => {
  it("간사 client 성공 → intent=staff, 간사 등록 콜백 경로로 교환", async () => {
    const calls = stubFetchByClient({ "bus-cignal": STAFF_OK });

    const r = await resolveLoginExchange("c1", ORIGIN, "staff");
    expect(r).toEqual({
      ok: true,
      intent: "staff",
      subjectId: "staff-1",
      payload: STAFF_OK.payload,
    });
    expect(calls[0].body.client_id).toBe("bus-cignal");
    expect(calls[0].body.redirect_uri).toBe(`${ORIGIN}${STAFF_CALLBACK_PATH}`);
    // 성공했으니 학생 client로 재시도하지 않는다.
    expect(calls.every((c) => c.body.client_id === "bus-cignal")).toBe(true);
  });

  it("간사 client 실패 + 학생 client 성공 → intent=student (학생 QR 코드 복구)", async () => {
    const calls = stubFetchByClient({
      "bus-cignal": REJECT,
      "bus-cignal-student": STUDENT_OK,
    });

    const r = await resolveLoginExchange("c1", ORIGIN, "staff");
    expect(r).toEqual({
      ok: true,
      intent: "student",
      subjectId: "stu-1",
      payload: STUDENT_OK.payload,
    });
    // 재시도는 학생 client의 등록 콜백 경로(redirect_uri)로 보내야 한다.
    const retry = calls.find((c) => c.body.client_id === "bus-cignal-student");
    expect(retry?.body.redirect_uri).toBe(`${ORIGIN}${STUDENT_CALLBACK_PATH}`);
  });

  it("둘 다 실패 → 진입(간사) client의 에러 반환", async () => {
    stubFetchByClient({
      "bus-cignal": REJECT,
      "bus-cignal-student": { error: "unknown_client" },
    });

    expect(await resolveLoginExchange("c1", ORIGIN, "staff")).toEqual({
      ok: false,
      error: "invalid_or_expired_code",
    });
  });
});

describe("resolveLoginExchange — 학생 콜백 진입(entry=student)", () => {
  it("학생 client 성공 → intent=student (간사 신원이어도 그대로)", async () => {
    const staffAsStudent = {
      subject_id: "staff-1",
      payload: { name: "김간사", is_staff: true, branch_no: 2404 },
    };
    const calls = stubFetchByClient({ "bus-cignal-student": staffAsStudent });

    const r = await resolveLoginExchange("c1", ORIGIN, "student");
    expect(r.ok && r.intent).toBe("student");
    expect(calls[0].body.client_id).toBe("bus-cignal-student");
    expect(calls[0].body.redirect_uri).toBe(`${ORIGIN}${STUDENT_CALLBACK_PATH}`);
  });

  it("학생 client 실패 + 간사 client 성공 → intent=staff (간사 코드 복구)", async () => {
    stubFetchByClient({
      "bus-cignal-student": REJECT,
      "bus-cignal": STAFF_OK,
    });

    const r = await resolveLoginExchange("c1", ORIGIN, "student");
    expect(r).toEqual({
      ok: true,
      intent: "staff",
      subjectId: "staff-1",
      payload: STAFF_OK.payload,
    });
  });
});
