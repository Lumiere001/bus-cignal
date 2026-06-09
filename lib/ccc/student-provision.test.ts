import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// DB 모킹: regions(코드→id) + students(ccc_id 조회→없음→insert).
const regionMaybe = vi.fn();
const studentMaybe = vi.fn();
const studentInsertSingle = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      if (t === "regions") {
        return { select: () => ({ eq: () => ({ maybeSingle: regionMaybe }) }) };
      }
      if (t === "students") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: studentMaybe }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: () => ({ select: () => ({ single: studentInsertSingle }) }),
        };
      }
      throw new Error(`unexpected table ${t}`);
    },
  }),
}));

import { provisionStudentFromCcc } from "./student-provision";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("provisionStudentFromCcc", () => {
  // 핵심 회귀: 간사(is_staff=true)도 학생으로 프로비저닝되어야 한다(학생 화면 접근 허용).
  it("간사(is_staff=true)도 차단하지 않고 학생으로 프로비저닝", async () => {
    regionMaybe.mockResolvedValue({ data: { id: "region-1" } });
    studentMaybe.mockResolvedValue({ data: null }); // 신규
    studentInsertSingle.mockResolvedValue({ data: { id: "stu-1" }, error: null });

    const r = await provisionStudentFromCcc("sub-staff", {
      is_staff: true,
      name: "김간사",
      branch_no: 2601,
      phone: "01000000000",
    });
    expect(r).toEqual({
      ok: true,
      studentId: "stu-1",
      regionId: "region-1",
      cccId: "sub-staff",
    });
  });

  it("일반 학생도 정상 프로비저닝(지구 미매핑이면 region_id=null)", async () => {
    regionMaybe.mockResolvedValue({ data: null }); // 미등록 지구
    studentMaybe.mockResolvedValue({ data: null });
    studentInsertSingle.mockResolvedValue({ data: { id: "stu-2" }, error: null });

    const r = await provisionStudentFromCcc("sub-stu", {
      is_staff: false,
      name: "최학생",
      branch_no: 9999,
    });
    expect(r).toEqual({
      ok: true,
      studentId: "stu-2",
      regionId: null,
      cccId: "sub-stu",
    });
  });
});
