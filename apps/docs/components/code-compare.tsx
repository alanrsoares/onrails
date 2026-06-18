"use client";

import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { ChevronsLeftRight } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface CodeCompareProps {
  /** Code shown on the left of the divider (the "ours" side). */
  left: string;
  /** Code shown on the right of the divider. */
  right: string;
  leftLabel?: string;
  rightLabel?: string;
  lang?: string;
}

/**
 * Before/after slider for two superimposed code blocks. Drag the handle (or use
 * the arrow keys when focused) to wipe between `left` and `right`.
 */
export function CodeCompare({
  left,
  right,
  leftLabel = "onrails",
  rightLabel = "other",
  lang = "ts",
}: CodeCompareProps) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  return (
    <div
      ref={ref}
      className="not-prose relative my-4 select-none overflow-hidden rounded-lg border border-fd-border [&_figure]:!m-0 [&_pre]:!my-0 [&_pre]:!rounded-none"
      onPointerMove={(e) => {
        if (dragging.current) updateFromX(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerLeave={() => {
        dragging.current = false;
      }}
    >
      {/* base layer — left / "ours" defines the height */}
      <DynamicCodeBlock lang={lang} code={left} />

      {/* overlay layer — revealed from the divider rightward */}
      <div
        className="absolute inset-0 [&_figure]:!m-0 [&_pre]:!my-0 [&_pre]:!rounded-none"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        <DynamicCodeBlock lang={lang} code={right} />
      </div>

      <span className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-fd-secondary/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-fd-foreground backdrop-blur">
        {leftLabel}
      </span>
      <span className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-fd-secondary/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-fd-foreground backdrop-blur">
        {rightLabel}
      </span>

      {/* draggable divider */}
      <div
        role="slider"
        aria-label={`Reveal ${leftLabel} versus ${rightLabel}`}
        aria-valuenow={Math.round(pos)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        className="absolute inset-y-0 z-20 -ml-3 flex w-6 cursor-ew-resize touch-none items-center justify-center"
        style={{ left: `${pos}%` }}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 4));
          if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 4));
        }}
      >
        <div className="h-full w-0.5 bg-fd-primary/70" />
        <div className="absolute flex size-6 items-center justify-center rounded-full border border-fd-border bg-fd-background text-fd-muted-foreground shadow-md">
          <ChevronsLeftRight className="size-3.5" />
        </div>
      </div>
    </div>
  );
}
