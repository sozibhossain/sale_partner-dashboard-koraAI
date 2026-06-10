"use client";

interface KoraOrbProps {
  size?: number;
  className?: string;
}

/**
 * The glowing Kora assistant face used across the partner dashboard.
 * Pure CSS/SVG — no images or external deps.
 */
export function KoraOrb({ size = 64, className = "" }: KoraOrbProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="absolute inset-0 animate-pulse rounded-full bg-blue-500/30 blur-xl" />
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: "radial-gradient(circle at 50% 38%, #0c2a52 0%, #061224 70%)",
          border: "2px solid rgba(59,130,246,0.75)",
          boxShadow:
            "0 0 24px 4px rgba(59,130,246,0.55), inset 0 0 16px rgba(59,130,246,0.45)",
        }}
      >
        <svg
          width={size * 0.5}
          height={size * 0.5}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="8.5" cy="10" r="1.5" fill="#7dd3fc" />
          <circle cx="15.5" cy="10" r="1.5" fill="#7dd3fc" />
          <path
            d="M8 14.5c1.3 1.4 6.7 1.4 8 0"
            stroke="#7dd3fc"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}
