import { cn } from "@/lib/cn";

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-2 block text-sm font-medium", className)}>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-13 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-fg placeholder:text-muted focus:border-fg focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-2xl border border-border bg-card p-4 text-[15px] text-fg placeholder:text-muted focus:border-fg focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn("h-13 w-full rounded-2xl border border-border bg-card px-4 text-[15px] text-fg focus:border-fg focus:outline-none", className)}
      {...props}
    />
  );
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
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "info" && "border-border bg-subtle",
        tone === "success" && "border-success/30 bg-success/10 text-success",
        tone === "error" && "border-danger/30 bg-danger/10 text-danger",
        tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
        className,
      )}
    >
      {children}
    </div>
  );
}
