import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// DB 모킹: regions(코드→id) + students(ccc_id 조회 → 자기치유 phone+name 조회 → insert/update).
const regionMaybe = vi.fn();
const studentMaybe = vi.fn(); // ccc_id 조회 (.maybeSingle)
const studentByPhoneName = vi.fn(); // 자기치유 후보 조회 (.eq("phone").eq("name") await)
const studentUpdateEq = vi.fn(); // .update(patch).eq("id", id)
const studentUpdate = vi.fn(() => ({ eq: studentUpdateEq }));
const studentInsertSingle = vi.fn();
const studentInsert = vi.fn(() => ({
  select: () => ({ single: studentInsertSingle }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      if (t === "regions") {
        return { select: () => ({ eq: () => ({ maybeSingle: regionMaybe }) }) };
      }
      if (t === "students") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: studentMaybe,
              eq: () => studentByPhoneName(),
            }),
          }),
          update: studentUpdate,
          insert: studentInsert,
        };
      }
      throw new Error(`unexpected table ${t}`);
    },
  }),
}));

import { provisionStudentFromCcc } from "./student-provision";

beforeEach(() => {
  vi.clearAllMocks();
  studentUpdateEq.mockResolvedValue({ error: null });
});

describe("provisionStudentFromCcc", () => {
  // 핵심 회귀: 간사(is_staff=true)도 학생으로 프로비저닝되어야 한다(학생 화면 접근 허용).
  it("간사(is_staff=true)도 차단하지 않고 학생으로 프로비저닝", async () => {
    regionMaybe.mockResolvedValue({ data: { id: "region-1" } });
    studentMaybe.mockResolvedValue({ data: null }); // 신규
    studentByPhoneName.mockResolvedValue({ data: [] }); // 자기치유 후보 없음
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
    // phone 없음 → 자기치유 조회 자체를 하지 않는다(phone+name 둘 다 필요).
    expect(studentByPhoneName).not.toHaveBeenCalled();
  });

  // 자기치유: subject_id가 바뀌어 ccc_id 미스 → phone+name으로 기존 신원 재사용.
  it("ccc_id 미스 + phone·name 매치 → 기존 행 재사용·ccc_id 교체(새 행 생성 X)", async () => {
    regionMaybe.mockResolvedValue({ data: { id: "region-1" } });
    studentMaybe.mockResolvedValue({ data: null }); // 새 subject_id라 미스
    studentByPhoneName.mockResolvedValue({
      data: [
        { id: "stu-newer", created_at: "2026-06-11T12:57:00+09:00" },
        { id: "stu-first", created_at: "2026-06-09T10:00:00+09:00" },
      ],
    });

    const r = await provisionStudentFromCcc("sub-new", {
      is_staff: false,
      name: "최학생",
      phone: "01011112222",
      branch_no: 2601,
    });
    expect(r).toEqual({
      ok: true,
      studentId: "stu-first", // created_at 최초 행 채택
      regionId: "region-1",
      cccId: "sub-new",
    });
    expect(studentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ ccc_id: "sub-new", name: "최학생", phone: "01011112222" }),
    );
    expect(studentUpdateEq).toHaveBeenCalledWith("id", "stu-first");
    expect(studentInsert).not.toHaveBeenCalled();
  });

  it("ccc_id 미스 + 매치 없음 → 신규 insert", async () => {
    regionMaybe.mockResolvedValue({ data: { id: "region-1" } });
    studentMaybe.mockResolvedValue({ data: null });
    studentByPhoneName.mockResolvedValue({ data: [] });
    studentInsertSingle.mockResolvedValue({ data: { id: "stu-3" }, error: null });

    const r = await provisionStudentFromCcc("sub-3", {
      is_staff: false,
      name: "박학생",
      phone: "01033334444",
      branch_no: 2601,
    });
    expect(r).toEqual({
      ok: true,
      studentId: "stu-3",
      regionId: "region-1",
      cccId: "sub-3",
    });
    expect(studentUpdate).not.toHaveBeenCalled();
  });
});
