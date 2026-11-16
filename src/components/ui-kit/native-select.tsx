import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Select native bergaya token. Dipakai di form (pemilih native lebih nyaman di HP
 * dan langsung kompatibel dengan register() React Hook Form).
 */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "border-input bg-surface text-ink focus-visible:border-primary-600 focus-visible:outline-ring aria-invalid:border-danger h-11 w-full appearance-none rounded-xl border pr-10 pl-3.5 text-base transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 disabled:cursor-not-allowed disabled:opacity-55 md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-ink-muted pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2"
      />
    </div>
  );
}
