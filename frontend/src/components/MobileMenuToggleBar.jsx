import { useLayoutEffect, useRef, useState } from "react";

/** Pixels of scroll inside main for full grey → blue transition */
const SCROLL_RANGE = 88;

function lerpChannel(c1, c2, t) {
  return Math.round(c1 + (c2 - c1) * t);
}

/** Cool grey → same dark blue as `.sidebar` (#1a365d) */
const SIDEBAR_BG = { r: 26, g: 54, b: 93 };
const BAR_IDLE = { r: 226, g: 232, b: 241 };

function barBackground(progress) {
  const t = Math.min(1, Math.max(0, progress));
  const r = lerpChannel(BAR_IDLE.r, SIDEBAR_BG.r, t);
  const g = lerpChannel(BAR_IDLE.g, SIDEBAR_BG.g, t);
  const b = lerpChannel(BAR_IDLE.b, SIDEBAR_BG.b, t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function MobileMenuToggleBar({
  isHidden,
  onClick,
  ariaLabel = "Open menu",
}) {
  const wrapRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useLayoutEffect(() => {
    const bar = wrapRef.current;
    if (!bar) return;
    const main = bar.closest("main");
    if (!main) return;

    const onScroll = () => {
      setScrollProgress(main.scrollTop / SCROLL_RANGE);
    };

    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const p = Math.min(1, Math.max(0, scrollProgress));
  const bg = barBackground(p);
  const shadow =
    p > 0.12
      ? `0 2px 10px rgba(0, 0, 0, ${0.14 + p * 0.12})`
      : "0 1px 0 rgba(15, 23, 42, 0.06)";

  return (
    <div
      ref={wrapRef}
      className={`mobile-menu-toggle-bar${isHidden ? " is-hidden" : ""}${
        p > 0.45 ? " mobile-menu-toggle-bar--filled" : ""
      }`}
      style={{ backgroundColor: bg, boxShadow: shadow }}
    >
      <button
        type="button"
        className="menu-toggle"
        onClick={onClick}
        aria-label={ariaLabel}
      >
        ☰
      </button>
    </div>
  );
}
