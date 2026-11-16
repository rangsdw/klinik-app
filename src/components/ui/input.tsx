import * as React from "react";
import { cn } from "@/lib/utils";

/** Input 44px, border konstan, focus ring berupa outline (bukan perubahan border). */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-surface text-ink placeholder:text-ink-muted/80 focus-visible:border-primary-600 focus-visible:outline-ring disabled:bg-muted aria-invalid:border-danger aria-invalid:focus-visible:outline-danger h-11 w-full min-w-0 rounded-xl border px-3.5 text-base transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 disabled:cursor-not-allowed disabled:opacity-55 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
