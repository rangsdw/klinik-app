import { cn } from "@/lib/utils";

/** Pasangan latar/teks dari token (kontras AA). Dipilih dari hash nama agar stabil. */
const PALETTE = [
  "bg-primary-100 text-primary-900",
  "bg-accent-50 text-info-ink",
  "bg-success-soft text-success-ink",
  "bg-warning-soft text-warning-ink",
  "bg-danger-soft text-danger-ink",
  "bg-muted text-ink",
] as const;

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
} as const;

type UserAvatarProps = {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/** Avatar inisial nama dengan warna dari hash nama. */
export function UserAvatar({ name, size = "md", className }: UserAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold select-none",
        SIZES[size],
        colorFor(name),
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
