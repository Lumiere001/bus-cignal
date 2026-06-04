import { describe, expect, it } from "vitest";
import { loadKakaoMapSdk } from "./load-sdk";

// vitest environment: "node" → typeof window === "undefined"

describe("loadKakaoMapSdk", () => {
  it("서버(Node) 환경 → 즉시 reject('server')", async () => {
    await expect(loadKakaoMapSdk()).rejects.toThrow("server");
  });
});
