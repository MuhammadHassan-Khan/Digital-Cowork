import { type HTMLAttributes, type ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  info: "border-border bg-muted text-foreground",
  success: "border-transparent bg-success text-success-foreground",
  warning: "border-warning-border bg-warning-bg text-warning-foreground",
  danger: "border-danger-border bg-danger-bg text-danger-text",
};

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
}

/** Inline message block for errors, warnings and configuration states. */
export function Notice({
  tone = "info",
  title,
  children,
  className = "",
  ...props
}: NoticeProps) {
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone]} ${className}`}
      {...props}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

const BADGE_TONES: Record<Tone, string> = {
  info: "bg-muted text-muted-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning-bg text-warning-foreground border border-warning-border",
  danger: "bg-danger/15 text-danger",
};

export function Badge({
  tone = "info",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
