import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui-kit/user-avatar";
import { logoutAction } from "@/features/auth/actions";

type Props = { name: string; email: string; roleLabel: string; profileHref?: string };

/** Avatar + dropdown profil/keluar di topbar. */
export function UserMenu({ name, email, roleLabel, profileHref }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-paper aria-expanded:bg-paper flex h-11 items-center gap-2.5 rounded-lg px-1.5 transition-colors">
        <UserAvatar name={name} size="sm" />
        <span className="hidden text-left sm:block">
          <span className="text-ink-strong block max-w-40 truncate text-sm font-semibold">
            {name}
          </span>
          <span className="text-ink-muted block text-xs">{roleLabel}</span>
        </span>
        <ChevronDown aria-hidden="true" className="text-ink-muted hidden size-4 sm:block" />
        <span className="sr-only">Menu akun</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="text-ink-strong block truncate font-semibold">{name}</span>
          <span className="text-ink-muted block truncate text-xs">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileHref ? (
          <DropdownMenuItem asChild>
            <Link href={profileHref}>
              <UserRound aria-hidden="true" />
              Profil saya
            </Link>
          </DropdownMenuItem>
        ) : null}
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden="true" />
              Keluar
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
