import { Clock, MapPin, Phone } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { clinicConfig } from "@/config/clinic";

/**
 * Layout login/registrasi: dua kolom di desktop (panel klinik + form), satu kolom di mobile.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const facts = [
    { icon: Clock, label: "Jam buka", value: clinicConfig.hours },
    { icon: MapPin, label: "Alamat", value: clinicConfig.address },
    { icon: Phone, label: "Telepon", value: clinicConfig.phone },
  ].filter((f) => f.value);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="from-primary-50 to-primary-100 relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br p-10 lg:flex xl:p-14">
        <Brand name={clinicConfig.name} />
        <div className="max-w-md space-y-5">
          <p className="text-primary-900 text-[2.5rem] leading-[1.1] font-bold tracking-tight">
            {clinicConfig.tagline}
          </p>
          <p className="text-primary-800 text-lg leading-relaxed">
            Satu akun untuk Anda dan keluarga: daftar, buat janji, dan pantau antrean dari HP.
          </p>
        </div>
        {facts.length > 0 ? (
          <dl className="border-primary-200 grid gap-4 border-t pt-6 text-sm">
            {facts.map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <f.icon aria-hidden="true" className="text-primary-700 mt-0.5 size-4 shrink-0" />
                <div>
                  <dt className="text-primary-900 font-semibold">{f.label}</dt>
                  <dd className="text-primary-800">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        ) : null}
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-8 lg:px-12">
        <div className="lg:hidden">
          <Brand name={clinicConfig.name} />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
