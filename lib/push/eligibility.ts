/**
 * 푸시 옵트인 가능 여부 판별 — SPEC §9.3 · §13.
 *
 * 환경별 분기(카톡 내장 브라우저·iOS 홈화면·미지원)를 순수 함수로 빼서 테스트 가능하게 한다.
 * UI(push-optin-banner)는 이 결과로 안내 문구·버튼을 정한다.
 */

export type PushEnvInput = {
  userAgent: string;
  /** PWA 홈화면(standalone)으로 실행 중인지 — iOS 푸시 전제 */
  isStandalone: boolean;
  hasNotification: boolean; // 'Notification' in window
  hasServiceWorker: boolean; // 'serviceWorker' in navigator
  hasPushManager: boolean; // 'PushManager' in window
};

export type PushEligibility =
  | { status: "ready" } // 바로 권한 요청 가능
  | { status: "needs_home_screen" } // iOS: 홈 화면 추가 후 가능 (16.4+)
  | { status: "kakao_in_app" } // 카톡 내장 브라우저 → 외부 브라우저로 열기
  | { status: "unsupported" }; // 푸시 미지원 환경 (인앱 알림만)

/** 카카오톡 내장 브라우저(홈화면 추가·푸시 불가). */
export function isKakaoInApp(ua: string): boolean {
  return /KAKAOTALK/i.test(ua);
}

/** iOS(iPhone/iPad/iPod). iPadOS가 Mac UA로 위장하는 경우(Macintosh+Mobile)도 포함. */
export function isIos(ua: string): boolean {
  return (
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))
  );
}

export function evaluatePushEnv(i: PushEnvInput): PushEligibility {
  // 1) 카톡 내장: 푸시·홈화면 추가 불가 → 외부 브라우저 안내가 먼저
  if (isKakaoInApp(i.userAgent)) return { status: "kakao_in_app" };

  const hasPushApis =
    i.hasNotification && i.hasServiceWorker && i.hasPushManager;

  // 2) iOS는 홈 화면(standalone)에서만 푸시 API가 열림 → 추가 안내
  if (isIos(i.userAgent) && !i.isStandalone) {
    return { status: "needs_home_screen" };
  }

  // 3) 푸시 API 미존재(구형 브라우저 등) → 미지원
  if (!hasPushApis) return { status: "unsupported" };

  return { status: "ready" };
}
