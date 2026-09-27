import { useId } from "react";

/** ロゴ（SOUP of JEV） */
export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <div
      className={`whitespace-nowrap font-label font-bold text-gold ${
        size === "lg"
          ? "text-[28px] tracking-[0.22em] sm:text-[40px] sm:tracking-[0.26em]"
          : "text-lg tracking-[0.24em] sm:text-[22px]"
      }`}
    >
      SOUP{" "}
      <span
        className={`font-medium tracking-[0.1em] text-gold-muted ${size === "lg" ? "text-lg sm:text-[26px]" : "text-[13px] sm:text-[15px]"}`}
      >
        of
      </span>{" "}
      JEV
    </div>
  );
}

/** 区切りの飾り：左右に消えていく金の線の中央に、ひし形を置く */
export function GoldDivider({ width = 360 }: { width?: number }) {
  // useId の値には url(#...) で参照できない記号が入るので取り除く
  const id = `rule${useId().replace(/[^\w-]/g, "")}`;
  const mid = width / 2;
  return (
    <svg
      aria-hidden="true"
      width={width}
      height="18"
      viewBox={`0 0 ${width} 18`}
      className="max-w-full"
    >
      {/* 高さ 0 の線には objectBoundingBox のグラデーションが塗られないので、座標で指定する */}
      <defs>
        <linearGradient
          id={`${id}l`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          x2={mid - 16}
          y1="0"
          y2="0"
        >
          <stop offset="0" stopColor="#8a6a2e" stopOpacity="0" />
          <stop offset="1" stopColor="#e3c47f" />
        </linearGradient>
        <linearGradient
          id={`${id}r`}
          gradientUnits="userSpaceOnUse"
          x1={mid + 16}
          x2={width}
          y1="0"
          y2="0"
        >
          <stop offset="0" stopColor="#e3c47f" />
          <stop offset="1" stopColor="#8a6a2e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="0"
        y1="9"
        x2={mid - 16}
        y2="9"
        stroke={`url(#${id}l)`}
        strokeWidth="1"
      />
      <line
        x1={mid + 16}
        y1="9"
        x2={width}
        y2="9"
        stroke={`url(#${id}r)`}
        strokeWidth="1"
      />
      <rect
        x={mid - 6}
        y="3"
        width="12"
        height="12"
        transform={`rotate(45 ${mid} 9)`}
        fill="none"
        stroke="#d4b26a"
        strokeWidth="1"
      />
      <rect
        x={mid - 3}
        y="6"
        width="6"
        height="6"
        transform={`rotate(45 ${mid} 9)`}
        fill="#d4b26a"
      />
    </svg>
  );
}

export function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function Check({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}

/** いいねのハート。filled で塗る */
export function Heart({
  className,
  filled = false,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.6 4.5 7.1 4.5c2 0 3.4 1.1 4.9 3 1.5-1.9 2.9-3 4.9-3 3.5 0 5.4 3.5 4.3 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" />
    </svg>
  );
}

/** GitHub のマーク（Octicons の mark-github） */
export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** 注意書き（設計書 §6.1、§7.4） */
export function PrivacyNote({ className = "" }: { className?: string }) {
  return (
    <p className={`m-0 text-[12.5px] leading-relaxed text-dim ${className}`}>
      質問は判定のため外部の AI
      サービスに送られます。個人情報は入力しないでください。
    </p>
  );
}

/** アクセス解析の利用の明記（設計書 D10。Google アナリティクスの利用規約の要件） */
export function AnalyticsNote({ className = "" }: { className?: string }) {
  return (
    <p className={`m-0 text-[12.5px] leading-relaxed text-dim ${className}`}>
      アクセス解析に Google アナリティクスを使っています（Cookie
      を使用。質問や回答の文章は送りません）。
      <a
        href="https://policies.google.com/technologies/partner-sites?hl=ja"
        target="_blank"
        rel="noopener noreferrer"
      >
        Google によるデータの使用
      </a>
    </p>
  );
}
