import { cn } from "@/lib/cn";

const field =
  "w-full rounded-[14px] border border-border-strong bg-card text-[15px] text-fg placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150 focus:border-fg focus:outline-none focus:ring-4 focus:ring-accent/35 disabled:opacity-60";

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-2 block text-sm font-medium", className)}>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-12 px-4", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "p-4 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, "h-12 px-4", className)} {...props} />;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "success" | "error" | "warning"; children: React.ReactNode; className?: string }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-[16px] border px-4 py-3 text-sm leading-relaxed",
        tone === "info" && "border-border bg-card",
        tone === "success" && "border-success/25 bg-success/10 text-success",
        tone === "error" && "border-danger/25 bg-danger/10 text-danger",
        tone === "warning" && "border-warning/25 bg-warning/10 text-warning",
        className,
      )}
    >
      <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", tone === "info" ? "bg-accent" : "bg-current")} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
