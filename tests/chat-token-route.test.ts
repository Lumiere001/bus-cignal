import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// resolveChatAccess / chat-admin 모킹 — 본문 스키마 검증만 격리해서 테스트
const resolveChatAccess = vi.fn();
vi.mock("@/lib/chat/access", () => ({
  resolveChatAccess: (tripId: string) => resolveChatAccess(tripId),
}));

const isChatAdminConfigured = vi.fn();
const createCustomToken = vi.fn();
vi.mock("@/lib/firebase/chat-admin", () => ({
  isChatAdminConfigured: () => isChatAdminConfigured(),
  chatAuth: () => ({ createCustomToken }),
}));

import { POST } from "@/app/api/chat/token/route";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function post(body: unknown): Request {
  return new Request("http://localhost/api/chat/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/chat/token — strict body", () => {
  it("tripId만 → 스키마 통과 (권한 없음이면 403, resolveChatAccess 호출됨)", async () => {
    resolveChatAccess.mockResolvedValue(null);
    const res = await POST(post({ tripId: VALID_UUID }));
    expect(res.status).toBe(403);
    expect(resolveChatAccess).toHaveBeenCalledWith(VALID_UUID);
  });

  it("seed/dev id(version nibble 0) → 400 아님, resolveChatAccess까지 진행 (회귀)", async () => {
    // Zod .uuid()는 RFC version/variant 검증으로 이 id를 거부했었음 → UUID-shaped regex로 통과해야 함
    const SEED_ID = "c0000000-0000-0000-0000-000000000012";
    resolveChatAccess.mockResolvedValue(null);
    const res = await POST(post({ tripId: SEED_ID }));
    expect(res.status).not.toBe(400);
    expect(res.status).toBe(403);
    expect(resolveChatAccess).toHaveBeenCalledWith(SEED_ID);
  });

  it("role 추가 필드 → 400 invalid_body (무시하지 않고 거부)", async () => {
    const res = await POST(post({ tripId: VALID_UUID, role: "operator" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_body" });
    // 본문 거부 단계에서 권한 조회까지 가지 않음
    expect(resolveChatAccess).not.toHaveBeenCalled();
  });

  it("passengerId·displayName 위조 시도 → 400 invalid_body", async () => {
    const res = await POST(
      post({ tripId: VALID_UUID, passengerId: "fake", displayName: "admin" }),
    );
    expect(res.status).toBe(400);
    expect(resolveChatAccess).not.toHaveBeenCalled();
  });

  it("subjectId·operatorId·regionId 추가 → 400 invalid_body", async () => {
    const res = await POST(
      post({
        tripId: VALID_UUID,
        subjectId: "x",
        operatorId: "y",
        regionId: "z",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("tripId가 uuid 아님 → 400 invalid_body", async () => {
    const res = await POST(post({ tripId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("권한 있으나 Admin 미설정 → 503 chat_unconfigured", async () => {
    resolveChatAccess.mockResolvedValue({
      role: "passenger",
      tripId: VALID_UUID,
      subjectId: "p1",
      displayName: "홍길동",
    });
    isChatAdminConfigured.mockReturnValue(false);
    const res = await POST(post({ tripId: VALID_UUID }));
    expect(res.status).toBe(503);
  });

  it("권한+설정 정상 → 200 + token (claim은 서버 access에서만)", async () => {
    resolveChatAccess.mockResolvedValue({
      role: "passenger",
      tripId: VALID_UUID,
      subjectId: "p1",
      displayName: "홍길동",
    });
    isChatAdminConfigured.mockReturnValue(true);
    createCustomToken.mockResolvedValue("token-abc");

    const res = await POST(post({ tripId: VALID_UUID }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      token: "token-abc",
      role: "passenger",
      subjectId: "p1",
      displayName: "홍길동",
      tripId: VALID_UUID,
    });
    expect(createCustomToken).toHaveBeenCalledWith("passenger:p1", {
      role: "passenger",
      tripId: VALID_UUID,
      subjectId: "p1",
    });
  });
});
