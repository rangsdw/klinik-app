import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Stethoscope, Clock, Users, ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { jakartaTodayStr, parseDateOnlyUtc } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pemeriksaan Pasien · Dokter" };

export default async function DoctorExaminationIndexPage() {
  const user = await requireRole("DOCTOR");

  const today = parseDateOnlyUtc(jakartaTodayStr());

  // Cari janji temu hari ini yang sedang berlangsung (IN_PROGRESS)
  const inProgressApp = await db.appointment.findFirst({
    where: {
      doctorId: user.id,
      appointmentDate: today,
      status: "IN_PROGRESS",
    },
    select: { id: true },
    orderBy: { queueNumber: "asc" },
  });

  if (inProgressApp) {
    redirect(`/dokter/periksa/${inProgressApp.id}`);
  }

  // Jika tidak ada yang IN_PROGRESS, cari antrean yang siap diperiksa (CONFIRMED)
  const waitingAppointments = await db.appointment.findMany({
    where: {
      doctorId: user.id,
      appointmentDate: today,
      status: "CONFIRMED",
    },
    include: {
      patient: {
        select: {
          name: true,
          medicalRecordNumber: true,
          gender: true,
          allergies: true,
        },
      },
    },
    orderBy: [{ queueNumber: "asc" }, { startTime: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-strong flex items-center gap-2">
          <Stethoscope className="size-6 text-primary-700" />
          Pemeriksaan Pasien
        </h1>
        <p className="text-sm text-ink-soft">
          Pilih antrean pasien hari ini untuk memulai pengisian rekam medis SOAP dan penerbitan e-resep.
        </p>
      </div>

      {waitingAppointments.length === 0 ? (
        <Card className="border-line border-dashed bg-paper/40 py-16 text-center">
          <CardContent>
            <Users className="mx-auto size-12 text-ink-muted mb-3" />
            <h3 className="text-base font-semibold text-ink-strong">Tidak ada antrean menunggu</h3>
            <p className="text-sm text-ink-soft max-w-sm mx-auto mt-1 mb-4">
              Semua pasien hari ini telah selesai diperiksa atau belum ada antrean baru.
            </p>
            <Button asChild variant="outline">
              <Link href="/dokter">Kembali ke Dashboard &amp; Janji</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-strong">
            Pilih Pasien untuk Diperiksa ({waitingAppointments.length})
          </h2>

          <div className="grid gap-3">
            {waitingAppointments.map((app) => (
              <Card key={app.id} className="border-line bg-surface hover:border-line-strong transition-all">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-50 font-bold text-primary-800 border border-primary-200">
                      <span className="text-[10px] font-medium leading-none text-primary-600">No</span>
                      <span className="text-base leading-tight">{app.queueNumber ?? "-"}</span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink-strong">{app.patient.name}</span>
                        <span className="font-mono text-xs text-ink-muted bg-paper px-1.5 py-0.5 rounded border border-line">
                          {app.patient.medicalRecordNumber}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          Terkonfirmasi
                        </Badge>
                        {app.checkedInAt && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]">
                            Hadir
                          </Badge>
                        )}
                        {app.source === "WALK_IN" && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                            Walk-in
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <Clock className="size-3" />
                        <span>{app.startTime} - {app.endTime} WIB</span>
                        <span>·</span>
                        <span>{app.patient.gender === "MALE" ? "Laki-laki" : "Perempuan"}</span>
                        {app.patient.allergies && (
                          <>
                            <span>·</span>
                            <span className="text-danger font-medium">Alergi: {app.patient.allergies}</span>
                          </>
                        )}
                      </div>

                      {app.chiefComplaint && (
                        <p className="text-xs text-ink-soft pt-1">
                          <span className="font-medium">Keluhan:</span> {app.chiefComplaint}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button asChild size="sm" className="gap-1.5 bg-primary-700 hover:bg-primary-800 text-surface self-end sm:self-auto text-xs">
                    <Link href={`/dokter/periksa/${app.id}`}>
                      <span>Mulai Periksa</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
