import type { MetadataRoute } from "next";

// PWA manifest (SPEC §4.5·§13). 옵트인 설치 — 학생·간사.
// 아이콘: 192·512 PNG(installability·iOS 홈화면) + SVG(스케일러블). 모두 불투명 배경.
// 후속(선택): 디자인팀 maskable 안전영역 PNG로 교체 시 purpose:"maskable" 추가.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bus Cignal",
    short_name: "Bus Cignal",
    description: "CCC 전국 여름 수련회 타지구 차량 매칭",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
