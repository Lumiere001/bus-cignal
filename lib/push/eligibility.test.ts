import { describe, expect, it } from "vitest";
import { evaluatePushEnv, isIos, isKakaoInApp } from "./eligibility";

const FULL = { hasNotification: true, hasServiceWorker: true, hasPushManager: true };
const NONE = { hasNotification: false, hasServiceWorker: false, hasPushManager: false };

const UA = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iosKakao:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 KAKAOTALK 10.5.0",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};

describe("isKakaoInApp / isIos", () => {
  it("카톡 UA 감지", () => {
    expect(isKakaoInApp(UA.iosKakao)).toBe(true);
    expect(isKakaoInApp(UA.iosSafari)).toBe(false);
  });
  it("iOS 감지", () => {
    expect(isIos(UA.iosSafari)).toBe(true);
    expect(isIos(UA.androidChrome)).toBe(false);
  });
});

describe("evaluatePushEnv", () => {
  it("카톡 내장 브라우저 → kakao_in_app (최우선)", () => {
    // 카톡이면 standalone/푸시API 무관하게 외부 브라우저 안내
    expect(
      evaluatePushEnv({ userAgent: UA.iosKakao, isStandalone: false, ...NONE }),
    ).toEqual({ status: "kakao_in_app" });
  });

  it("iOS Safari 탭(홈화면 추가 전) → needs_home_screen", () => {
    expect(
      evaluatePushEnv({ userAgent: UA.iosSafari, isStandalone: false, ...NONE }),
    ).toEqual({ status: "needs_home_screen" });
  });

  it("iOS 홈화면(standalone) + 푸시 API → ready", () => {
    expect(
      evaluatePushEnv({ userAgent: UA.iosSafari, isStandalone: true, ...FULL }),
    ).toEqual({ status: "ready" });
  });

  it("Android Chrome → ready", () => {
    expect(
      evaluatePushEnv({ userAgent: UA.androidChrome, isStandalone: false, ...FULL }),
    ).toEqual({ status: "ready" });
  });

  it("데스크톱이지만 푸시 API 없음 → unsupported", () => {
    expect(
      evaluatePushEnv({ userAgent: UA.desktopChrome, isStandalone: false, ...NONE }),
    ).toEqual({ status: "unsupported" });
  });
});
