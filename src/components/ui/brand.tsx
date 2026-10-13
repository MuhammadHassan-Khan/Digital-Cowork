import { type ReactNode } from "react";

/** App mark: two overlapping "focus" squares suggesting side-by-side work. */
export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="6" width="17" height="17" rx="4" fill="var(--primary)" />
      <rect
        x="13"
        y="11"
        width="17"
        height="17"
        rx="4"
        fill="var(--card)"
        stroke="var(--primary)"
        strokeWidth="2.5"
      />
    </svg>
  );
}

export function Brand({
  className = "",
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark className={markClassName ?? "size-7"} />
      <span className="text-lg font-semibold tracking-tight">Cowork</span>
    </span>
  );
}

/** Initials avatar (no image uploads in the MVP scope). */
export function InitialsAvatar({
  name,
  className = "size-11 text-sm",
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ${className}`}
    >
      {initials || "?"}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
