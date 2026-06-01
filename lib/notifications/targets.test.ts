import { describe, expect, it } from "vitest";
import { resolveTargets } from "./targets";

describe("resolveTargets (SPEC §8 대상 매핑)", () => {
  it("request_new → 공급 간사만", () => {
    expect(resolveTargets("request_new", { supplyOperatorId: "s" })).toEqual([
      { operatorId: "s", passengerId: null, push: true },
    ]);
  });

  it("partial_match → 양쪽 간사", () => {
    const t = resolveTargets("partial_match", {
      supplyOperatorId: "s",
      requestOperatorId: "r",
    });
    expect(t.map((x) => x.operatorId)).toEqual(["s", "r"]);
  });

  it("depart_d1 → 양쪽 간사 + 학생", () => {
    const t = resolveTargets("depart_d1", {
      supplyOperatorId: "s",
      requestOperatorId: "r",
      passengerId: "p",
    });
    expect(t).toHaveLength(3);
    expect(t.at(-1)).toEqual({ operatorId: null, passengerId: "p", push: true });
  });

  it("master(system_error) → 둘 다 null, push=false", () => {
    expect(resolveTargets("system_error", { master: true })).toEqual([
      { operatorId: null, passengerId: null, push: false },
    ]);
  });

  it("null 슬롯은 제외 (공급 간사 미지정)", () => {
    const t = resolveTargets("payment_delay", {
      supplyOperatorId: null,
      requestOperatorId: "r",
    });
    expect(t.map((x) => x.operatorId)).toEqual(["r"]);
  });

  it("둘 다 null이면 대상 없음", () => {
    expect(
      resolveTargets("payment_delay", {
        supplyOperatorId: null,
        requestOperatorId: null,
      }),
    ).toEqual([]);
  });

  it("operator_revoked → 목록 fanout + 중복 제거", () => {
    const t = resolveTargets("operator_revoked", {
      operatorIds: ["a", "a", "b"],
    });
    expect(t.map((x) => x.operatorId)).toEqual(["a", "b"]);
  });

  it("reapply_recommended → 신청 지구 여럿", () => {
    const t = resolveTargets("reapply_recommended", {
      requestOperatorIds: ["x", "y"],
    });
    expect(t.map((x) => x.operatorId)).toEqual(["x", "y"]);
  });

  it("allowPush=false → push 플래그 끔 (chat_message OFF)", () => {
    const t = resolveTargets("chat_message", {
      supplyOperatorId: "s",
      requestOperatorId: "r",
      passengerId: "p",
    }, false);
    expect(t.every((x) => x.push === false)).toBe(true);
  });
});
