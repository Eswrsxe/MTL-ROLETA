"use client";

import { parseEmoji } from "../../../lib/emoji";

export default function PrizeEmoji({ emoji, size = 28, className = "" }) {
  const parsed = parseEmoji(emoji);

  if (parsed.kind === "custom") {
    return (
      <img
        src={parsed.url}
        alt={parsed.alt}
        width={size}
        height={size}
        className={`mtl-emoji-img ${className}`}
        draggable={false}
      />
    );
  }

  if (parsed.kind === "unicode") {
    return (
      <span className={`mtl-emoji-unicode ${className}`} style={{ fontSize: size }}>
        {parsed.char}
      </span>
    );
  }

  return (
    <span className={`mtl-emoji-unicode ${className}`} style={{ fontSize: size }}>
      🎁
    </span>
  );
}