import type { Metadata } from "next";
import "./globals.css";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export const metadata: Metadata = {
  title: "Bus Cignal — CCC 여름 수련회 차량 매칭",
  description:
    "CCC 전국 여름 수련회 타지구 차량 매칭·정산·소통 통합 시스템. 지구 간 차량 자리를 공정하고 투명하게.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
