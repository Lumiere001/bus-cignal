import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// DB 모킹: regions(코드→id) + operators(ccc_id 조회 → 자기치유 staff_no/phone+name 조회 → insert/update).
// student-provision.test.ts 와 동일 패턴 — 조회 종류는 .eq 첫 컬럼으로 분기.
const regionMaybe = vi.fn();
const opByCccId = vi.fn(); // .eq("ccc_id").maybeSingle()
const opByStaffNo = vi.fn(); // .eq("staff_no") await
const opByPhoneName = vi.fn(); // .eq("phone").eq("name") await
const opUpdateEq = vi.fn(); // .update(patch).eq("id", id)
const opUpdate = vi.fn(() => ({ eq: opUpdateEq }));
const opInsertSingle = vi.fn();
const opInsert = vi.fn(() => ({ select: () => ({ single: opInsertSingle }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      if (t === "regions") {
        return { select: () => ({ eq: () => ({ maybeSingle: regionMaybe }) }) };
      }
      if (t === "operators") {
        return {
          select: () => ({
            eq: (col: string) => {
              if (col === "ccc_id") return { maybeSingle: opByCccId };
              if (col === "staff_no") return opByStaffNo();
              if (col === "phone") return { eq: () => opByPhoneName() };
              throw new Error(`unexpected eq column ${col}`);
            },
          }),
          update: opUpdate,
          insert: opInsert,
        };
      }
      throw new Error(`unexpected table ${t}`);
    },
  }),
}));

import { provisionOperatorFromCcc } from "./provision";

const basePayload = {
  is_staff: true,
  name: "김간사",
  phone: "01044007299",
  branch_no: 2601,
  staff_no: "S-1234",
};

beforeEach(() => {
  vi.clearAllMocks();
  regionMaybe.mockResolvedValue({ data: { id: "region-1" } });
  opUpdateEq.mockResolvedValue({ error: null });
});

describe("provisionOperatorFromCcc — 자기치유(self-heal)", () => {
  // 핵심 회귀: subject_id가 세션마다 바뀌어도(prod 확인 사례) 같은 사람이면 행이 늘지 않는다.
  it("ccc_id 미스 + staff_no 매치 → 기존 행 재사용·ccc_id 교체(새 행 생성 X)", async () => {
    opByCccId.mockResolvedValue({ data: null }); // 새 subject_id라 미스
    opByStaffNo.mockResolvedValue({
      data: [{ id: "op-first", approval_status: "approved", created_at: "2026-06-09T01:00:00+09:00" }],
    });

    const r = await provisionOperatorFromCcc("sub-new", basePayload);
    expect(r).toEqual({
      ok: true,
      operatorId: "op-first",
      regionId: "region-1",
      cccId: "sub-new",
    });
    expect(opUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ ccc_id: "sub-new", staff_no: "S-1234" }),
    );
    expect(opUpdateEq).toHaveBeenCalledWith("id", "op-first");
    expect(opInsert).not.toHaveBeenCalled();
    expect(opByPhoneName).not.toHaveBeenCalled(); // staff_no에서 끝나면 phone+name 안 감
  });

  it("staff_no 후보 여럿 → created_at 최초 행 채택", async () => {
    opByCccId.mockResolvedValue({ data: null });
    opByStaffNo.mockResolvedValue({
      data: [
        { id: "op-3rd", approval_status: "approved", created_at: "2026-06-11T12:57:00+09:00" },
        { id: "op-1st", approval_status: "approved", created_at: "2026-06-09T01:00:00+09:00" },
        { id: "op-2nd", approval_status: "approved", created_at: "2026-06-11T01:31:00+09:00" },
      ],
    });

    const r = await provisionOperatorFromCcc("sub-new", basePayload);
    expect(r).toMatchObject({ ok: true, operatorId: "op-1st" });
    expect(opUpdateEq).toHaveBeenCalledWith("id", "op-1st");
  });

  it("staff_no 미스 → phone+name 매치로 기존 행 재사용", async () => {
    opByCccId.mockResolvedValue({ data: null });
    opByStaffNo.mockResolvedValue({ data: [] });
    opByPhoneName.mockResolvedValue({
      data: [{ id: "op-old", approval_status: "approved", created_at: "2026-06-09T01:00:00+09:00" }],
    });

    const r = await provisionOperatorFromCcc("sub-new", basePayload);
    expect(r).toMatchObject({ ok: true, operatorId: "op-old", cccId: "sub-new" });
    expect(opUpdate).toHaveBeenCalledWith(expect.objectContaining({ ccc_id: "sub-new" }));
    expect(opInsert).not.toHaveBeenCalled();
  });

  it("staff_no 없는 payload → 곧장 phone+name 매치", async () => {
    opByCccId.mockResolvedValue({ data: null });
    opByPhoneName.mockResolvedValue({
      data: [{ id: "op-old", approval_status: "approved", created_at: "2026-06-09T01:00:00+09:00" }],
    });

    const r = await provisionOperatorFromCcc("sub-new", {
      is_staff: true,
      name: "김간사",
      phone: "01044007299",
      branch_no: 2601,
    });
    expect(r).toMatchObject({ ok: true, operatorId: "op-old" });
    expect(opByStaffNo).not.toHaveBeenCalled();
    // staff_no 미제공 시 기존 staff_no를 null로 덮지 않는다.
    expect(opUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ staff_no: expect.anything() }),
    );
  });

  // revoke 우회 금지: 새 subject_id로 재로그인해도 revoked 신원에 매칭되면 차단.
  it("자기치유 매치가 revoked → 차단(새 행 생성도 X)", async () => {
    opByCccId.mockResolvedValue({ data: null });
    opByStaffNo.mockResolvedValue({
      data: [{ id: "op-revoked", approval_status: "revoked", created_at: "2026-06-09T01:00:00+09:00" }],
    });

    const r = await provisionOperatorFromCcc("sub-new", basePayload);
    expect(r).toEqual({ ok: false, error: "revoked" });
    expect(opUpdate).not.toHaveBeenCalled();
    expect(opInsert).not.toHaveBeenCalled();
  });

  it("아무 매치 없음 → 신규 insert(staff_no 저장)", async () => {
    opByCccId.mockResolvedValue({ data: null });
    opByStaffNo.mockResolvedValue({ data: [] });
    opByPhoneName.mockResolvedValue({ data: [] });
    opInsertSingle.mockResolvedValue({ data: { id: "op-new" }, error: null });

    const r = await provisionOperatorFromCcc("sub-new", basePayload);
    expect(r).toEqual({
      ok: true,
      operatorId: "op-new",
      regionId: "region-1",
      cccId: "sub-new",
    });
    expect(opInsert).toHaveBeenCalledWith(
      expect.objectContaining({ ccc_id: "sub-new", staff_no: "S-1234" }),
    );
    expect(opUpdate).not.toHaveBeenCalled();
  });

  it("ccc_id 히트(기존 경로) → 자기치유 조회 없이 갱신 + staff_no 저장", async () => {
    opByCccId.mockResolvedValue({ data: { id: "op-1", approval_status: "approved" } });

    const r = await provisionOperatorFromCcc("sub-same", basePayload);
    expect(r).toMatchObject({ ok: true, operatorId: "op-1" });
    expect(opUpdate).toHaveBeenCalledWith(expect.objectContaining({ staff_no: "S-1234" }));
    expect(opByStaffNo).not.toHaveBeenCalled();
    expect(opByPhoneName).not.toHaveBeenCalled();
  });

  it("ccc_id 히트가 revoked → 기존대로 차단", async () => {
    opByCccId.mockResolvedValue({ data: { id: "op-1", approval_status: "revoked" } });

    const r = await provisionOperatorFromCcc("sub-same", basePayload);
    expect(r).toEqual({ ok: false, error: "revoked" });
  });

  it("is_staff=false → not_staff (자기치유와 무관하게 기존 거름 유지)", async () => {
    const r = await provisionOperatorFromCcc("sub-x", { ...basePayload, is_staff: false });
    expect(r).toEqual({ ok: false, error: "not_staff" });
  });
});
