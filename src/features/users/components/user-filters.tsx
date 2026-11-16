"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui-kit/native-select";

/** Filter role + pencarian. State disimpan di URL (bisa di-bookmark & dibagikan). */
export function UserFilters({ q, role }: { q: string; role: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const sp = new URLSearchParams();
    const nq = String(data.get("q") ?? "").trim();
    const nr = String(data.get("role") ?? "");
    if (nq) sp.set("q", nq);
    if (nr) sp.set("role", nr);
    startTransition(() => router.push(`/admin/pengguna${sp.size ? `?${sp}` : ""}`));
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <div className="relative flex-1">
        <label htmlFor="q" className="sr-only">
          Cari nama atau email
        </label>
        <Search
          aria-hidden="true"
          className="text-ink-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
        />
        <Input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Cari nama atau email"
          className="pl-10"
          type="search"
        />
      </div>
      <div className="sm:w-48">
        <label htmlFor="role" className="sr-only">
          Filter role
        </label>
        <NativeSelect
          id="role"
          name="role"
          defaultValue={role}
          onChange={(e) => e.currentTarget.form && submit(e.currentTarget.form)}
        >
          <option value="">Semua role</option>
          <option value="ADMIN">Admin</option>
          <option value="DOCTOR">Dokter</option>
          <option value="STAFF">Staf</option>
          <option value="PATIENT">Pasien</option>
        </NativeSelect>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Cari
      </Button>
    </form>
  );
}
