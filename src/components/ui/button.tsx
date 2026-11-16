import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

/**
 * Tombol mengikuti design token klinik.
 * - default: primary-700 (hover primary-800), teks putih, kontras AA.
 * - tinggi default 44px (target sentuh), sm 36px untuk tabel/aksi padat.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-800",
        outline:
          "border-input bg-surface text-ink hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 aria-expanded:bg-primary-50",
        secondary: "bg-primary-50 text-primary-800 hover:bg-primary-100",
        ghost:
          "text-ink-soft hover:bg-primary-50 hover:text-primary-800 aria-expanded:bg-primary-50",
        destructive: "bg-danger text-surface shadow-sm hover:bg-danger-ink",
        "destructive-outline":
          "border-input bg-surface text-danger-ink hover:border-danger hover:bg-danger-soft",
        link: "h-auto px-0 text-primary-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
