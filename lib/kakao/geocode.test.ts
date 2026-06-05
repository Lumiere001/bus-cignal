import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { geocodeAddress } from "./geocode";

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
});

function mockFetch(value: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({ ok, json: async () => value });
}

describe("geocodeAddress", () => {
  it("REST 키 없으면 호출 없이 null", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    const spy = vi.fn();
    global.fetch = spy;
    expect(await geocodeAddress("광주 충장로 1가")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("빈 주소 → null", async () => {
    expect(await geocodeAddress("   ")).toBeNull();
  });

  it("정상 응답 → 첫 문서의 lat/lng (x=경도, y=위도)", async () => {
    mockFetch({ documents: [{ x: "126.9988", y: "35.1480" }] });
    expect(await geocodeAddress("광주 충장로 1가")).toEqual({
      lat: 35.148,
      lng: 126.9988,
    });
  });

  it("문서 없음(주소 못 찾음) → null", async () => {
    mockFetch({ documents: [] });
    expect(await geocodeAddress("없는 주소 zzz")).toBeNull();
  });

  it("HTTP 오류(키 무효 등) → null", async () => {
    mockFetch({}, false);
    expect(await geocodeAddress("광주")).toBeNull();
  });

  it("좌표가 숫자 아님 → null", async () => {
    mockFetch({ documents: [{ x: "abc", y: "def" }] });
    expect(await geocodeAddress("광주")).toBeNull();
  });

  it("Authorization 헤더에 KakaoAK 키 사용", async () => {
    mockFetch({ documents: [{ x: "127", y: "37" }] });
    await geocodeAddress("서울");
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers.Authorization).toBe("KakaoAK test-key");
  });
});
