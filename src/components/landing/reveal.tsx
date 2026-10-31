"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay (ms) before the transition starts once the block is visible. */
  delay?: number;
}

/**
 * Scroll-reveal wrapper built on IntersectionObserver (no dependencies).
 *
 * The hidden state lives in CSS (`.reveal` in globals.css), so first paint
 * never flashes visible → hidden. Graceful fallbacks keep content readable:
 *  - no JavaScript: `<noscript>` override on the landing page;
 *  - no IntersectionObserver: everything is marked visible immediately;
 *  - prefers-reduced-motion: the global media query reveals instantly.
 *
 * Motion only touches opacity/transform (GPU-composited) per the
 * modern-web-design performance guidance.
 */
export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (!("IntersectionObserver" in window)) {
      element.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -60px 0px", threshold: 0.1 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
