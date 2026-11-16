"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, UsersRound } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui-kit/user-avatar";
import { setActivePatientAction } from "@/features/patients/actions";
import { RELATIONSHIP_LABEL } from "@/features/patients/schemas";

type Option = {
  id: string;
  name: string;
  relationship: keyof typeof RELATIONSHIP_LABEL;
  isSelf: boolean;
};

/** Pemilih pasien aktif. Pilihan disimpan di cookie httpOnly (divalidasi di server). */
export function PatientSwitcher({ patients, activeId }: { patients: Option[]; activeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = patients.find((p) => p.id === activeId) ?? patients[0];
  if (!active) return null;

  function choose(id: string) {
    if (id === activeId) return;
    startTransition(async () => {
      const r = await setActivePatientAction(id);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.message ?? "Gagal mengganti pasien.");
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="border-line bg-surface hover:border-primary-300 aria-expanded:border-primary-300 flex h-12 w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors sm:w-auto sm:min-w-72"
        aria-label={`Pasien aktif: ${active.name}. Ganti pasien`}
        disabled={pending}
      >
        <UserAvatar name={active.name} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="text-ink-muted block text-xs">Berobat untuk</span>
          <span className="text-ink-strong block truncate text-sm font-semibold">
            {active.name}
            {active.isSelf ? " (Anda)" : ""}
          </span>
        </span>
        {pending ? (
          <Loader2 aria-hidden="true" className="text-ink-muted size-4 animate-spin" />
        ) : (
          <ChevronDown aria-hidden="true" className="text-ink-muted size-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-72"
      >
        <DropdownMenuLabel className="text-ink-muted text-xs font-normal">
          Pilih anggota keluarga
        </DropdownMenuLabel>
        {patients.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => choose(p.id)} className="h-12 gap-3">
            <UserAvatar name={p.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="text-ink-strong block truncate font-medium">{p.name}</span>
              <span className="text-ink-muted block text-xs">
                {p.isSelf ? "Anda" : RELATIONSHIP_LABEL[p.relationship]}
              </span>
            </span>
            {p.id === activeId ? <Check aria-hidden="true" className="text-primary-700" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/pasien/keluarga">
            <UsersRound aria-hidden="true" />
            Kelola anggota keluarga
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
