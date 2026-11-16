import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

type StatusBadgeProps = {
  variant?: StatusVariant;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
};

/** Badge status dengan latar lembut. Warna selalu disertai teks (tidak mengandalkan warna saja). */
export function StatusBadge({
  variant = "neutral",
  icon: Icon,
  children,
  className,
}: StatusBadgeProps) {
  return (
    <Badge variant={variant} className={className}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </Badge>
  );
}
