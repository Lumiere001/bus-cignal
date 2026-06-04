import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * FCM 백그라운드 메시지 서비스 워커 — `/firebase-messaging-sw.js` 로 서빙. SPEC §9.3.
 *
 * 정적 public 파일이 아니라 라우트로 서빙하는 이유: 공개 Firebase 설정(NEXT_PUBLIC_*)을
 * 빌드 시점이 아닌 서버 런타임에 주입해 인라인하기 위함(값 하드코딩 회피).
 * SW 내부는 npm 모듈을 못 쓰므로 gstatic compat SDK를 importScripts.
 *
 * compat 버전은 package.json의 `firebase`와 맞춘다(현재 12.14.0).
 */
const FIREBASE_SDK_VERSION = "12.14.0";

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  const body = `// 자동 생성 — app/firebase-messaging-sw.js/route.ts
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var n = payload.notification || {};
  var data = payload.data || {};
  self.registration.showNotification(n.title || 'Bus Cignal', {
    body: n.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: data,
  });
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(link) !== -1 && 'focus' in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-store",
    },
  });
}
