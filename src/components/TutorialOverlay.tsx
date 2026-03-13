import { useEffect, useRef, useState, RefObject } from "react";

export type TutorialStepDef = {
  refKey: string;
  title: string;
  body: string;
  arrowSide: "top" | "bottom" | "left" | "right";
  pad?: number;
};

type Props = {
  steps: TutorialStepDef[];
  refs: Record<string, RefObject<HTMLElement | null>>;
  onDone: () => void;
};

const LABEL_W = 260;
const ARROW_SIZE = 12; // px of the triangle

export default function TutorialOverlay({ steps, refs, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);

  const step = steps[idx];
  const pad = step.pad ?? 10;

  // Measure target element, update on resize/scroll
  useEffect(() => {
    //setVisible(false);
    const measure = () => {
      const el = refs[step.refKey]?.current;
      if (!el) return;
      setRect(el.getBoundingClientRect());
      setVisible(true);
    };
    // Small delay so element is painted
    const t = setTimeout(measure, 60);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [idx, step.refKey, refs]);

  const advance = () => {
    if (idx < steps.length - 1) {
      setIdx((i) => i + 1);
    } else {
      onDone();
    }
  };

  if (!rect || !visible) return null;

  const hl = {
    left: rect.left - pad,
    top: rect.top - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    right: rect.left - pad + rect.width + pad * 2,
    bottom: rect.top - pad + rect.height + pad * 2,
  };

  // Label box center X/Y relative to highlight
  let labelLeft = 0;
  let labelTop = 0;
  const GAP = ARROW_SIZE + 10;

  if (step.arrowSide === "bottom") {
    // label above the highlight
    labelLeft = hl.left + hl.width / 2 - LABEL_W / 2;
    labelTop = hl.top - GAP - 120; // approx label height
  } else if (step.arrowSide === "top") {
    // label below the highlight
    labelLeft = hl.left + hl.width / 2 - LABEL_W / 2;
    labelTop = hl.bottom + GAP;
  } else if (step.arrowSide === "right") {
    // label to the left of the highlight
    labelLeft = hl.left - LABEL_W - GAP;
    labelTop = hl.top + hl.height / 2 - 60;
  } else {
    // label to the right of the highlight
    labelLeft = hl.right + GAP;
    labelTop = hl.top + hl.height / 2 - 60;
  }

  // Clamp label to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  labelLeft = Math.max(10, Math.min(labelLeft, vw - LABEL_W - 10));
  labelTop = Math.max(10, Math.min(labelTop, vh - 160));

  const overlayColor = "rgba(0,0,0,0.68)";

  const stripStyle = (extra: React.CSSProperties): React.CSSProperties => ({
    position: "fixed",
    background: overlayColor,
    zIndex: 8000,
    cursor: "pointer",
    ...extra,
  });

  // Arrow triangle CSS for each side
  const arrowStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      width: 0,
      height: 0,
    };
    const s = ARROW_SIZE;
    switch (step.arrowSide) {
      case "bottom": // label above → triangle points down at bottom of label
        return { ...base, bottom: -s, left: "50%", transform: "translateX(-50%)", borderLeft: `${s}px solid transparent`, borderRight: `${s}px solid transparent`, borderTop: `${s}px solid #fff` };
      case "top": // label below → triangle points up at top of label
        return { ...base, top: -s, left: "50%", transform: "translateX(-50%)", borderLeft: `${s}px solid transparent`, borderRight: `${s}px solid transparent`, borderBottom: `${s}px solid #fff` };
      case "right": // label on left → triangle points right at right edge of label
        return { ...base, right: -s, top: "50%", transform: "translateY(-50%)", borderTop: `${s}px solid transparent`, borderBottom: `${s}px solid transparent`, borderLeft: `${s}px solid #fff` };
      case "left": // label on right → triangle points left at left edge of label
        return { ...base, left: -s, top: "50%", transform: "translateY(-50%)", borderTop: `${s}px solid transparent`, borderBottom: `${s}px solid transparent`, borderRight: `${s}px solid #fff` };
    }
  };

  return (
    <>
      {/* Four overlay strips around the hole */}
      {/* Top */}
      <div style={stripStyle({ top: 0, left: 0, right: 0, height: Math.max(0, hl.top) })} onClick={advance} />
      {/* Bottom */}
      <div style={stripStyle({ top: hl.bottom, left: 0, right: 0, bottom: 0 })} onClick={advance} />
      {/* Left */}
      <div style={stripStyle({ top: hl.top, left: 0, width: Math.max(0, hl.left), height: hl.height })} onClick={advance} />
      {/* Right */}
      <div style={stripStyle({ top: hl.top, left: hl.right, right: 0, height: hl.height })} onClick={advance} />

      {/* Highlight ring */}
      <div
        onClick={advance}
        style={{
          position: "fixed",
          left: hl.left,
          top: hl.top,
          width: hl.width,
          height: hl.height,
          zIndex: 8001,
          borderRadius: 10,
          boxShadow: "0 0 0 3px rgba(255,255,255,0.85), 0 0 0 6px rgba(14,165,233,0.5)",
          pointerEvents: "none",
          animation: "tutorialPulse 1.8s ease-in-out infinite",
        }}
      />

      {/* Label box */}
      <div
        onClick={advance}
        style={{
          position: "fixed",
          left: labelLeft,
          top: labelTop,
          width: LABEL_W,
          zIndex: 8010,
          background: "#fff",
          borderRadius: 12,
          padding: "16px 18px 14px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.15)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Arrow triangle */}
        <div style={arrowStyles()} />

        {/* Step counter */}
        <div style={{ fontSize: 10, fontWeight: 700, color: "#0ea5e9", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
          Step {idx + 1} of {steps.length}
        </div>

        {/* Title */}
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 6, lineHeight: 1.3 }}>
          {step.title}
        </div>

        {/* Body */}
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 14 }}>
          {step.body}
        </div>

        {/* Progress dots + hint */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {steps.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === idx ? 18 : 7,
                  height: 7,
                  borderRadius: 4,
                  background: i === idx ? "#0ea5e9" : i < idx ? "#bae6fd" : "#e2e8f0",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>
            {idx < steps.length - 1 ? "click anywhere →" : "click to start →"}
          </div>
        </div>
      </div>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes tutorialPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(255,255,255,0.85), 0 0 0 6px rgba(14,165,233,0.45); }
          50%       { box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 0 0 10px rgba(14,165,233,0.2); }
        }
      `}</style>
    </>
  );
}
