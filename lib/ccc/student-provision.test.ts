import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
// is_staff 가드는 DB 접근 전에 반환 → admin 클라이언트는 호출되지 않음(스텁만).
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { provisionStudentFromCcc } from "./student-provision";

describe("provisionStudentFromCcc — is_staff 가드", () => {
  it("is_staff=true → 거부(간사는 학생 로그인 불가)", async () => {
    const r = await provisionStudentFromCcc("sub-1", {
      is_staff: true,
      name: "김간사",
      branch_no: 2601,
    });
    expect(r).toEqual({ ok: false, error: "is_staff" });
  });
});
