import { test, expect } from "@playwright/test";

// CCC 콜백 간사/학생 분기(간사 요청 2026-06-11) — 외부(CCC) 의존 없이 검증 가능한 경계.
// exchange가 필요한 경로(cross-client 재교환)는 단위(lib/ccc/resolve-login.test.ts)에서 검증.
test.describe("CCC 콜백 간사/학생 분기", () => {
  test("간사 콜백 error=not_staff → 학생 CCC 로그인으로 자동 재시작", async ({
    request,
  }) => {
    const res = await request.get("/api/ccc/callback?error=not_staff", {
      maxRedirects: 0,
    });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/s/login/ccc");
  });

  test("간사 콜백 error=not-staff(하이픈 변형)도 학생으로 재시작", async ({
    request,
  }) => {
    const res = await request.get("/api/ccc/callback?error=not-staff", {
      maxRedirects: 0,
    });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/s/login/ccc");
  });

  test("간사 콜백 error=access_denied → 기존 오류 안내 유지(회귀)", async ({
    request,
  }) => {
    const res = await request.get("/api/ccc/callback?error=access_denied", {
      maxRedirects: 0,
    });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain(
      "/login?error=ccc_access_denied",
    );
  });

  test("학생 콜백 error=access_denied → /s/login 오류 안내(회귀)", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/ccc/student-callback?error=access_denied",
      { maxRedirects: 0 },
    );
    expect([302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain(
      "/s/login?error=ccc_access_denied",
    );
  });
});
