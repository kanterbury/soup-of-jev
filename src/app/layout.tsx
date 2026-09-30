import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { gaMeasurementId } from "@/lib/analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Soup of Jev", template: "%s | Soup of Jev" },
  description: "AI が YES / NO で答える、ひとりで遊べる水平思考クイズ",
};

export const viewport: Viewport = {
  themeColor: "#33081a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const gaId = gaMeasurementId();
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        {/* 日本語の書体はファイルが大きいので、next/font で自前配信せず、Google Fonts の分割配信を使う */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Shippori+Mincho+B1:wght@600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap"
        />
      </head>
      <body className="min-h-svh antialiased sm:min-h-dvh">
        <Backdrop />
        <div className="relative">{children}</div>
      </body>
      {/* アクセス解析（設計書 D10）。測定 ID があるとき（本番）だけ読み込む */}
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}

/**
 * 背景（設計書 §6.4）：地の色に四隅だけ暗く沈む陰影と、ベルベットのざらつきを重ねる。
 * 画面に固定し、内容だけをスクロールさせる（質問が増えても陰影が引き伸ばされないように）。
 */
function Backdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 bg-velvet bg-[radial-gradient(120%_120%_at_50%_50%,rgb(18_2_7/0)_45%,rgb(18_2_7/0.9)_100%)]"
    >
      <svg className="absolute inset-0 size-full opacity-[0.16] mix-blend-overlay">
        <filter id="velvet">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#velvet)" />
      </svg>
    </div>
  );
}
