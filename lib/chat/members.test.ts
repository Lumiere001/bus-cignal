import { describe, expect, it } from "vitest";

// countUnread는 순수 함수 — Firestore/SDK 의존 없음. server-only도 불필요.
// (members.ts는 firebase/firestore를 import하지만 countUnread 자체는 그 심볼을 쓰지 않는다.)
import { countUnread, type ChatMember } from "./members";

// 테스트용 멤버 빌더 — uid/lastReadAtMs만 의미 있고 나머지는 고정값.
function member(uid: string, lastReadAtMs: number | null): ChatMember {
  return {
    uid,
    displayName: uid,
    role: "passenger",
    lastReadAtMs,
  };
}

describe("countUnread()", () => {
  it("빈 members → 0", () => {
    expect(
      countUnread([], { senderId: "op-supply", createdAtMs: 1_000 }),
    ).toBe(0);
  });

  it("message.createdAtMs === null(pending write) → 0 (아직 셀 수 없음)", () => {
    const members = [member("a", null), member("b", 0), member("c", 500)];
    expect(
      countUnread(members, { senderId: "z", createdAtMs: null }),
    ).toBe(0);
  });

  it("발신자 본인은 제외 (lastReadAt이 없어도 안 셈)", () => {
    const members = [
      member("sender", null), // 발신자 — 제외 대상
      member("other", null), // 안 읽음
    ];
    expect(
      countUnread(members, { senderId: "sender", createdAtMs: 1_000 }),
    ).toBe(1);
  });

  it("lastReadAtMs === null인 멤버는 안 읽음으로 카운트", () => {
    const members = [member("a", null), member("b", null)];
    expect(
      countUnread(members, { senderId: "z", createdAtMs: 1_000 }),
    ).toBe(2);
  });

  it("lastReadAtMs < createdAtMs → 안 읽음", () => {
    const members = [member("a", 999)];
    expect(
      countUnread(members, { senderId: "z", createdAtMs: 1_000 }),
    ).toBe(1);
  });

  it("lastReadAtMs === createdAtMs → 읽음(경계: 같으면 읽은 것으로 본다)", () => {
    const members = [member("a", 1_000)];
    expect(
      countUnread(members, { senderId: "z", createdAtMs: 1_000 }),
    ).toBe(0);
  });

  it("lastReadAtMs > createdAtMs → 읽음", () => {
    const members = [member("a", 2_000)];
    expect(
      countUnread(members, { senderId: "z", createdAtMs: 1_000 }),
    ).toBe(0);
  });

  it("혼합: 발신자 제외 + null/과거=안읽음, 같음/미래=읽음", () => {
    const members = [
      member("sender", null), // 제외(발신자)
      member("pending", null), // 안 읽음
      member("stale", 500), // 안 읽음 (과거)
      member("exact", 1_000), // 읽음 (경계 동일)
      member("fresh", 1_500), // 읽음 (미래)
    ];
    expect(
      countUnread(members, { senderId: "sender", createdAtMs: 1_000 }),
    ).toBe(2);
  });

  it("발신자가 members에 없어도 동작(외부인이 보낸 셈 — 모두 후보)", () => {
    const members = [member("a", null), member("b", 2_000)];
    // a=안읽음, b=읽음 → 1
    expect(
      countUnread(members, { senderId: "outsider", createdAtMs: 1_000 }),
    ).toBe(1);
  });

  it("createdAtMs === 0(에폭) 도 유효한 시각 — null과 구분", () => {
    const members = [member("a", null)]; // null < 0 취급(안 읽음)
    expect(
      countUnread(members, { senderId: "z", createdAtMs: 0 }),
    ).toBe(1);
  });
});
