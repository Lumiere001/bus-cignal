import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  cookiesGet,
  cookiesSet,
  cookiesDelete,
  redirectFn,
  verifyTokenFn,
  maybeSingleFn,
} = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  cookiesSet: vi.fn(),
  cookiesDelete: vi.fn(),
  redirectFn: vi.fn(),
  verifyTokenFn: vi.fn(),
  maybeSingleFn: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({ get: cookiesGet, set: cookiesSet, delete: cookiesDelete }),
}));

// 실제 next/navigation redirect는 NEXT_REDIRECT 예외를 던져 실행을 중단시킨다.
// 테스트도 동일하게 throw 시켜야 redirect 이후 코드가 (실서버처럼) 실행되지 않는다.
vi.mock("next/navigation", () => ({
  redirect: redirectFn,
}));

vi.mock("./operator-session", () => ({
  OPERATOR_COOKIE: "bc_operator_session",
  verifyOperatorToken: verifyTokenFn,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: maybeSingleFn }),
      }),
    }),
  }),
}));

import {
  getOperatorSession,
  requireOperator,
  clearOperatorSession,
} from "./operator";

const VALID_CLAIMS = {
  operatorId: "op-1",
  cccId: "ccc-1",
  regionId: "region-1",
};

beforeEach(() => {
  cookiesGet.mockReset();
  cookiesSet.mockReset();
  cookiesDelete.mockReset();
  verifyTokenFn.mockReset();
  maybeSingleFn.mockReset();
  redirectFn.mockReset();
  // 실서버의 redirect()처럼 호출 즉시 throw → 이후 라인 미실행.
  redirectFn.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
});

describe("getOperatorSession", () => {
  it("쿠키가 없으면 null 반환", async () => {
    cookiesGet.mockReturnValue(undefined);
    verifyTokenFn.mockResolvedValue(null);

    expect(await getOperatorSession()).toBeNull();
  });

  it("유효한 쿠키 → claims 반환", async () => {
    cookiesGet.mockReturnValue({ value: "valid-jwt" });
    verifyTokenFn.mockResolvedValue(VALID_CLAIMS);

    expect(await getOperatorSession()).toEqual(VALID_CLAIMS);
    expect(verifyTokenFn).toHaveBeenCalledWith("valid-jwt");
  });
});

describe("requireOperator", () => {
  it("세션 없음 → redirect('/login'), DB 조회 안 함", async () => {
    cookiesGet.mockReturnValue(undefined);
    verifyTokenFn.mockResolvedValue(null);

    await expect(requireOperator()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(maybeSingleFn).not.toHaveBeenCalled();
  });

  it("승인된 간사 → claims 반환, redirect·쿠키삭제 미호출", async () => {
    cookiesGet.mockReturnValue({ value: "valid-jwt" });
    verifyTokenFn.mockResolvedValue(VALID_CLAIMS);
    maybeSingleFn.mockResolvedValue({ data: { approval_status: "approved" } });

    expect(await requireOperator()).toEqual(VALID_CLAIMS);
    expect(redirectFn).not.toHaveBeenCalled();
    expect(cookiesDelete).not.toHaveBeenCalled();
  });

  // 회귀 방지: 미승인/revoke 간사가 보호 페이지(서버 컴포넌트 렌더)에 진입할 때
  // requireOperator가 쿠키를 삭제(cookies().delete())하면 Next.js 16이
  // "Cookies can only be modified in a Server Action or Route Handler" 예외를 던진다.
  // → 차단은 redirect로만 하고, 렌더 컨텍스트에서 쿠키를 만지지 않아야 한다.
  it("미승인 간사 → redirect('/login'), 쿠키 삭제 안 함 (렌더 컨텍스트 쿠키 변경 금지)", async () => {
    cookiesGet.mockReturnValue({ value: "valid-jwt" });
    verifyTokenFn.mockResolvedValue(VALID_CLAIMS);
    maybeSingleFn.mockResolvedValue({ data: { approval_status: "pending" } });

    await expect(requireOperator()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(cookiesDelete).not.toHaveBeenCalled();
  });

  it("operators row 삭제됨(data null) → redirect('/login'), 쿠키 삭제 안 함", async () => {
    cookiesGet.mockReturnValue({ value: "valid-jwt" });
    verifyTokenFn.mockResolvedValue(VALID_CLAIMS);
    maybeSingleFn.mockResolvedValue({ data: null });

    await expect(requireOperator()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(cookiesDelete).not.toHaveBeenCalled();
  });
});

describe("clearOperatorSession", () => {
  it("쿠키 삭제 (로그아웃 server action 전용 경로)", async () => {
    await clearOperatorSession();
    expect(cookiesDelete).toHaveBeenCalledWith("bc_operator_session");
  });
});
