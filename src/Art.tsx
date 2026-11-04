import type { CSSProperties } from "react";

const paths = {
  vault: "M4 4h16v16H4z M8 4v16 M11 9h5v6h-5z M16 12h3",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3z M9 8h6 M9 12h6",
  swap: "M4 8h15m-4-4 4 4-4 4 M20 16H5m4-4-4 4 4 4",
  activity: "M3 12h4l3-7 4 14 3-7h4",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  down: "M12 4v16m-5-5 5 5 5-5",
  plus: "M12 5v14M5 12h14",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  help: "M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  reset: "M4 10a8 8 0 1 1 1 7 M4 4v6h6",
  external: "M14 4h6v6 M20 4 10 14 M10 4H4v16h16v-6",
  merge: "M5 4v4c0 3 7 3 7 6v6 M19 4v4c0 3-7 3-7 6 M8 16l4 4 4-4",
  bolt: "m13 2-9 12h7l-1 8 10-13h-7z",
  wallet: "M20 7H4V4h14v3 M4 7h17v13H4V7z M21 11h-6v5h6 M17 13.5h.01",
  clock: "M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  pause: "M8 5v14M16 5v14",
  play: "m8 4 12 8-12 8V4z",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3z M8 12l3 3 5-6",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function Hamster({
  variant = 0,
  className = "",
}: {
  variant?: number;
  className?: string;
}) {
  const palettes = [
    ["#e8b273", "#f5dcad"],
    ["#aebda2", "#e5e8ca"],
    ["#d8a18d", "#f3d2bb"],
    ["#a7b4bd", "#d9e2e0"],
    ["#b9acd0", "#e9dcf2"],
    ["#d4c67d", "#f3e8ac"],
  ];
  const [fur, face] = palettes[variant % palettes.length];
  return (
    <svg
      className={`hamster-art ${className}`}
      viewBox="0 0 160 130"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M24 109h112M32 115h96"
        stroke="currentColor"
        strokeOpacity=".12"
      />
      <ellipse cx="80" cy="103" rx="40" ry="6" fill="#171911" opacity=".12" />
      <path
        d="M43 52C26 34 33 17 48 22c10 3 13 14 15 21M98 43c2-15 12-26 24-20 12 7 5 24-7 31"
        fill={fur}
        stroke="#35352b"
        strokeWidth="2.5"
      />
      <path
        d="M46 42c-9-10-9-14-4-14s9 7 10 13M110 42c0-9 8-16 12-12s0 10-6 15"
        fill="#dc9587"
      />
      <path
        d="M37 75c0-26 18-40 43-40 27 0 44 19 44 43 0 20-15 30-44 30-29 0-43-11-43-33Z"
        fill={fur}
        stroke="#35352b"
        strokeWidth="2.5"
      />
      <path
        d="M80 55c-10 0-9 21-20 21-18-7-19 17-9 23 15 10 44 10 59 0 10-7 6-28-10-23-11 0-11-21-20-21Z"
        fill={face}
      />
      <ellipse cx="58" cy="65" rx="4" ry="5" fill="#25271e" />
      <ellipse cx="102" cy="65" rx="4" ry="5" fill="#25271e" />
      <circle cx="59" cy="63" r="1.3" fill="#fff7dc" />
      <circle cx="103" cy="63" r="1.3" fill="#fff7dc" />
      <path d="m75 77 5 4 5-4c-2-4-8-4-10 0Z" fill="#664a3b" />
      <path
        d="M80 81v5m0 0c-5 4-8 1-8-1m8 1c5 4 8 1 8-1"
        stroke="#664a3b"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M36 77l14 3M33 85h17M112 80l14-3M112 85h16"
        stroke="#35352b"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {variant % 3 === 1 && (
        <g stroke="#35352b" strokeWidth="2.5">
          <circle cx="58" cy="65" r="11" />
          <circle cx="102" cy="65" r="11" />
          <path d="M69 65h22M37 61l10 2M113 63l10-2" />
        </g>
      )}
      {variant % 3 === 2 && (
        <g>
          <path
            d="M43 48c9-22 53-27 70 0Z"
            fill="#39473d"
            stroke="#35352b"
            strokeWidth="2"
          />
          <path
            d="M37 48h81"
            stroke="#35352b"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path d="m78 34-4 7h8l-4 7" stroke="#efc677" strokeWidth="2" />
        </g>
      )}
      <path
        d="M65 100c-6-8-13-9-16-4M95 100c6-8 13-9 16-4"
        stroke="#35352b"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandMark() {
  return (
    <svg
      viewBox="0 0 40 40"
      width="36"
      height="36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 16C-1 2 12 1 16 10c3-1 5-1 8 0C28 1 41 2 32 16c7 14-1 20-12 20S1 30 8 16Z"
        fill="currentColor"
      />
      <path
        d="M12 21h3m10 0h3m-11 7 3 2 3-2"
        stroke="#10120f"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wheel({
  spinning,
  paused,
  rpm,
}: {
  spinning: boolean;
  paused: boolean;
  rpm: number;
}) {
  return (
    <div
      className={`wheel-art ${spinning && !paused ? "is-spinning" : ""}`}
      style={
        {
          "--wheel-duration": `${Math.max(2, 80 / Math.max(1, rpm))}s`,
        } as CSSProperties
      }
    >
      <svg viewBox="0 0 240 230" fill="none" aria-hidden="true">
        <path
          d="M70 209h100M88 202l15-40h34l15 40"
          stroke="#666c57"
          strokeWidth="2"
        />
        <circle cx="120" cy="107" r="87" stroke="#30372b" strokeWidth="14" />
        <circle cx="120" cy="107" r="87" stroke="#a5b08d" strokeWidth="1" />
        <g className="wheel-rotor">
          <circle
            cx="120"
            cy="107"
            r="78"
            stroke="#a5b08d"
            strokeWidth="1.5"
            strokeDasharray="1 9"
          />
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d="M120 24v17"
              stroke="#616e4c"
              strokeWidth="3"
              transform={`rotate(${i * 30} 120 107)`}
            />
          ))}
          <path
            d="M120 21a86 86 0 0 1 74 43"
            stroke="#eac483"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
        <path d="M70 167h100" stroke="#616e4c" />
      </svg>
      <Hamster variant={0} className="wheel-hamster" />
    </div>
  );
}
