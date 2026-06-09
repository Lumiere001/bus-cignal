import { describe, it, expect, beforeAll } from "vitest";
import {
  signStudentToken,
  verifyStudentToken,
} from "./student-session";

beforeAll(() => {
  process.env.STUDENT_SESSION_SECRET =
    "test-student-session-secret-not-a-real-secret-0";
});

describe("student-session JWT", () => {
  it("round-trip: sign → verify claims 보존", async () => {
    const token = await signStudentToken({
      studentId: "s1",
      cccId: "ccc-1",
      regionId: "r1",
    });
    expect(await verifyStudentToken(token)).toEqual({
      studentId: "s1",
      cccId: "ccc-1",
      regionId: "r1",
    });
  });

  it("regionId null 유지(출신 지구 미매핑)", async () => {
    const token = await signStudentToken({
      studentId: "s1",
      cccId: "ccc-1",
      regionId: null,
    });
    expect((await verifyStudentToken(token))?.regionId).toBeNull();
  });

  it("잘못된/없는 토큰 → null", async () => {
    expect(await verifyStudentToken("garbage")).toBeNull();
    expect(await verifyStudentToken(undefined)).toBeNull();
  });
});
