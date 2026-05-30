import type { MetadataRoute } from "next";

// PWA manifest (SPEC §4.5·§13). 옵트인 설치 — 학생·간사.
// TODO: maskable PNG 아이콘(192·512) 디자인 에셋 추가 (현재 SVG placeholder).
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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
