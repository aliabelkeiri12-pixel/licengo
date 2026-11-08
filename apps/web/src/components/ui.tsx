import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { REGISTRATION_STATUS_LABELS, PAYMENT_STATUS_LABELS, ORDER_STATUS_LABELS } from "@licengo/core";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const variants = {
  primary: "bg-pitch-800 text-white hover:bg-pitch-700 shadow-sm",
  volt: "bg-volt-500 text-pitch-950 hover:bg-volt-400 shadow-sm",
  outline: "border border-line bg-white text-ink hover:bg-pitch-50",
  ghost: "text-pitch-800 hover:bg-pitch-50",
  danger: "bg-danger text-white hover:opacity-90",
};
export type ButtonVariant = keyof typeof variants;
export const buttonClass = (v: ButtonVariant = "primary", size: "sm" | "md" | "lg" = "md") =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:pointer-events-none",
    size === "sm" ? "h-9 px-3 text-sm" : size === "lg" ? "h-13 px-6 text-base" : "h-11 px-4 text-sm",
    variants[v],
  );

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return <button {...p} className={cx(buttonClass(variant, size), className)} />;
}
export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return <Link {...p} className={cx(buttonClass(variant, size), className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cx("rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]", className)} />;
}

export function PageHeader({ title, subtitle, action, eyebrow }: { title: string; subtitle?: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-pitch-600">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, name, hint, error, children }: { label: string; name?: string; hint?: string; error?: string; children?: ReactNode }) {
  return (
    <label className="block" htmlFor={name}>
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export const inputClass = "block w-full h-11 rounded-xl border border-line bg-white px-3.5 text-ink placeholder:text-muted/70 focus:border-pitch-600 focus:outline-none focus:ring-4 focus:ring-pitch-100";
export function Input(p: ComponentProps<"input">) { return <input id={p.name} {...p} className={cx(inputClass, p.className)} />; }
export function Select(p: ComponentProps<"select">) { return <select id={p.name} {...p} className={cx(inputClass, "appearance-none bg-[length:16px] pr-9", p.className)} />; }
export function Textarea(p: ComponentProps<"textarea">) { return <textarea id={p.name} {...p} className={cx(inputClass, "h-auto min-h-24 py-2.5", p.className)} />; }

const tones = {
  green: "bg-pitch-50 text-pitch-700 ring-pitch-100",
  volt: "bg-volt-400/30 text-pitch-900 ring-volt-500/40",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  gray: "bg-gray-100 text-gray-700 ring-gray-200",
};
export type Tone = keyof typeof tones;
export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone])}>{children}</span>;
}

const regTone: Record<string, Tone> = { DRAFT: "gray", SUBMITTED: "blue", INCOMPLETE: "amber", TO_FIX: "red", VALIDATED: "green", REJECTED: "red", CANCELLED: "gray" };
export const RegistrationBadge = ({ status }: { status: string }) => <Badge tone={regTone[status]}>{REGISTRATION_STATUS_LABELS[status as keyof typeof REGISTRATION_STATUS_LABELS]}</Badge>;
const payTone: Record<string, Tone> = { UNPAID: "gray", PARTIAL: "blue", PAID: "green", LATE: "red", REFUNDED: "amber" };
export const PaymentBadge = ({ status }: { status: string }) => <Badge tone={payTone[status]}>{PAYMENT_STATUS_LABELS[status as keyof typeof PAYMENT_STATUS_LABELS]}</Badge>;
const orderTone: Record<string, Tone> = { PENDING_PAYMENT: "amber", PAID: "blue", PREPARING: "blue", SHIPPED: "blue", READY_FOR_PICKUP: "volt", DELIVERED: "green", CANCELLED: "gray", REFUNDED: "amber" };
export const OrderBadge = ({ status }: { status: string }) => <Badge tone={orderTone[status]}>{ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS]}</Badge>;

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "dark" }) {
  return (
    <div className={cx("rounded-2xl p-5", tone === "dark" ? "bg-pitch-900 text-white" : "border border-line bg-white shadow-[var(--shadow-card)]")}>
      <p className={cx("text-xs font-bold uppercase tracking-wider", tone === "dark" ? "text-volt-400" : "text-muted")}>{label}</p>
      <p className="font-display mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className={cx("mt-1 text-xs", tone === "dark" ? "text-white/70" : "text-muted")}>{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-pitch-50" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-all", value === 100 ? "bg-pitch-600" : "bg-volt-500")} style={{ width: `${value}%` }} />
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "error"; children: ReactNode }) {
  const c = { info: "bg-blue-50 text-blue-900 border-blue-200", success: "bg-pitch-50 text-pitch-800 border-pitch-100", warning: "bg-amber-50 text-amber-900 border-amber-200", error: "bg-red-50 text-red-800 border-red-200" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", c)}>{children}</div>;
}

export const formatDate = (d: Date | string | null | undefined) => (d ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)) : "—");
export const formatDateTime = (d: Date | string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));
