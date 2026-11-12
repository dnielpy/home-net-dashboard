"use client";

import { useEffect, useRef, useState } from "react";

import { CometTrail } from "@/components/comet-trail";

// Matches rounded-xl on the tile
const RADIUS = 12;
const INSET = 1;

/** The outline of a rounded rectangle, clockwise from the top left corner. */
function outline(width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2, height / 2);
  const left = INSET;
  const top = INSET;
  const right = width - INSET;
  const bottom = height - INSET;
  return [
    `M${left + r},${top}`,
    `H${right - r}`,
    `A${r},${r} 0 0 1 ${right},${top + r}`,
    `V${bottom - r}`,
    `A${r},${r} 0 0 1 ${right - r},${bottom}`,
    `H${left + r}`,
    `A${r},${r} 0 0 1 ${left},${bottom - r}`,
    `V${top + r}`,
    `A${r},${r} 0 0 1 ${left + r},${top}`,
    "Z",
  ].join("");
}

/** A comet running around the tile's border, like the one on the battery chart. Fills its positioned parent. */
export function TileComet({ color, glow }: { color: string; glow: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      {size && (
        <svg width={size.width} height={size.height} className="overflow-visible">
          <CometTrail path={outline(size.width, size.height)} color={color} glow={glow} size={0.6} durationSeconds={6} tailLength={0.25} />
        </svg>
      )}
    </div>
  );
}
