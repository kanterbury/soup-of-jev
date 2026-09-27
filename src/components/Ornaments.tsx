import { useId } from "react";

/** ロゴ（SOUP of JEV） */
export function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <div
      className={`whitespace-nowrap font-label font-bold text-gold ${
        size === "lg" ? "text-[28px] tracking-[0.22em] sm:text-[40px] sm:tracking-[0.26em]" : "text-lg tracking-[0.24em] sm:text-[22px]"
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
    <svg aria-hidden="true" width={width} height="18" viewBox={`0 0 ${width} 18`} className="max-w-full">
      {/* 高さ 0 の線には objectBoundingBox のグラデーションが塗られないので、座標で指定する */}
      <defs>
        <linearGradient id={`${id}l`} gradientUnits="userSpaceOnUse" x1="0" x2={mid - 16} y1="0" y2="0">
          <stop offset="0" stopColor="#8a6a2e" stopOpacity="0" />
          <stop offset="1" stopColor="#e3c47f" />
        </linearGradient>
        <linearGradient id={`${id}r`} gradientUnits="userSpaceOnUse" x1={mid + 16} x2={width} y1="0" y2="0">
          <stop offset="0" stopColor="#e3c47f" />
          <stop offset="1" stopColor="#8a6a2e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="9" x2={mid - 16} y2="9" stroke={`url(#${id}l)`} strokeWidth="1" />
      <line x1={mid + 16} y1="9" x2={width} y2="9" stroke={`url(#${id}r)`} strokeWidth="1" />
      <rect x={mid - 6} y="3" width="12" height="12" transform={`rotate(45 ${mid} 9)`} fill="none" stroke="#d4b26a" strokeWidth="1" />
      <rect x={mid - 3} y="6" width="6" height="6" transform={`rotate(45 ${mid} 9)`} fill="#d4b26a" />
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
export function Heart({ className, filled = false }: { className?: string; filled?: boolean }) {
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

/** 注意書き（設計書 §6.1、§7.4） */
export function PrivacyNote({ className = "" }: { className?: string }) {
  return (
    <p className={`m-0 text-[12.5px] leading-relaxed text-dim ${className}`}>
      質問は判定のため外部の AI サービスに送られます。個人情報は入力しないでください。
    </p>
  );
}
