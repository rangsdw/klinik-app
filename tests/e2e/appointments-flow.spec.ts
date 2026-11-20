import { expect, test } from "@playwright/test";
import { addDaysToDateStr, dayOfWeekFromDateStr, jakartaTodayStr } from "@/lib/date";
import { db, login, logout, uniqueSuffix } from "./helpers";

function nextDateForDayOfWeek(fromDateStr: string, targetDay: number, minDaysAhead = 1): string {
  for (let i = minDaysAhead; i <= 21; i++) {
    const candidate = addDaysToDateStr(fromDateStr, i);
    if (dayOfWeekFromDateStr(candidate) === targetDay) return candidate;
  }
  throw new Error(`Tanggal untuk hari ${targetDay} tidak ditemukan`);
}

test.describe("alur janji temu: booking, approve, reschedule, dan reject", () => {
  const createdComplaints: string[] = [];

  test.afterAll(async () => {
    if (createdComplaints.length > 0) {
      await db.appointment.deleteMany({
        where: { chiefComplaint: { in: createdComplaints } },
      });
    }
    await db.$disconnect();
  });

  test("pasien booking -> staf setujui -> staf reschedule -> pasien lihat jadwal baru", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const complaint = `[E2E-APPT-RESCHED-${suffix}] Demam dan pusing`;
    const rescheduleReason = `Dokter berhalangan pada sesi awal (${suffix})`;
    createdComplaints.push(complaint);

    const todayStr = jakartaTodayStr();
    const doctor1 = await db.user.findUniqueOrThrow({
      where: { email: "dokter1@klinik.test" },
      include: { doctorSchedules: { where: { isActive: true }, orderBy: { dayOfWeek: "asc" } } },
    });
    expect(doctor1.doctorSchedules.length).toBeGreaterThanOrEqual(2);

    const firstSchedule = doctor1.doctorSchedules[0]!;
    const secondSchedule = doctor1.doctorSchedules[1]!;
    const initialDate = nextDateForDayOfWeek(todayStr, firstSchedule.dayOfWeek, 1);
    const targetDate = nextDateForDayOfWeek(todayStr, secondSchedule.dayOfWeek, 1);

    // 1. Pasien membuat janji temu
    await login(page, "pasien@klinik.test");
    await page.goto("/pasien/janji");
    await page.getByLabel("Dokter").selectOption(doctor1.id);
    await page.getByLabel("Tanggal periksa").fill(initialDate);

    const slotRadio = page.getByRole("radio", {
      name: new RegExp(`${firstSchedule.startTime} – ${firstSchedule.endTime}`),
    });
    await expect(slotRadio).toBeVisible();
    await slotRadio.click();

    await page.getByLabel(/Keluhan singkat/).fill(complaint);
    await page.getByRole("button", { name: "Ajukan Janji Temu" }).click();

    await expect(page.getByText(complaint)).toBeVisible();
    await expect(page.getByText("Menunggu Persetujuan").first()).toBeVisible();

    await logout(page);

    // 2. Staf pendaftaran menyetujui janji temu
    await login(page, "pendaftaran@klinik.test");
    await page.goto("/staf/pendaftaran");
    await page.getByRole("tab", { name: /Permintaan Janji/ }).click();

    const pendingRow = page.locator("tr", { hasText: complaint }).first();
    await expect(pendingRow).toBeVisible();
    await pendingRow.getByRole("button", { name: "Setujui" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ya, Setujui" }).click();
    await expect(page.getByText(/Janji disetujui\. Nomor antrean: A-\d+/)).toBeVisible();

    // 3. Staf menjadwalkan ulang janji yang sudah disetujui
    await page.getByLabel("Status").selectOption("CONFIRMED");
    const confirmedRow = page.locator("tr", { hasText: complaint }).first();
    await expect(confirmedRow).toBeVisible();
    await confirmedRow.getByRole("button", { name: "Jadwalkan Ulang" }).click();

    const rescheduleDialog = page.getByRole("dialog", { name: "Jadwalkan Ulang Janji Temu" });
    await expect(rescheduleDialog).toBeVisible();
    await rescheduleDialog.getByLabel("Tanggal tujuan").fill(targetDate);

    const newSlotRadio = rescheduleDialog.getByRole("radio", {
      name: new RegExp(`${secondSchedule.startTime} – ${secondSchedule.endTime}`),
    });
    await expect(newSlotRadio).toBeVisible();
    await newSlotRadio.click();

    await rescheduleDialog.getByLabel("Alasan penjadwalan ulang").fill(rescheduleReason);
    await rescheduleDialog.getByRole("button", { name: "Simpan Jadwal Baru" }).click();

    await expect(rescheduleDialog).toBeHidden();
    await expect(page.getByText(/Janji temu berhasil dijadwalkan ulang/)).toBeVisible();

    await logout(page);

    // 4. Pasien melihat jadwal baru, lencana "Dijadwalkan Ulang", nomor antrean, dan alasan
    await login(page, "pasien@klinik.test");
    await page.goto("/pasien/janji");

    const updatedAppointment = await db.appointment.findFirstOrThrow({
      where: { chiefComplaint: complaint },
    });
    expect(updatedAppointment.queueNumber).not.toBeNull();
    const formattedQueue = `A-${String(updatedAppointment.queueNumber).padStart(2, "0")}`;

    const patientCard = page.locator("div", { hasText: complaint }).filter({
      hasText: rescheduleReason,
    }).first();
    await expect(patientCard).toBeVisible();
    await expect(page.getByText("Dijadwalkan Ulang").first()).toBeVisible();
    await expect(page.getByText(`Antrean ${formattedQueue}`).first()).toBeVisible();
    await expect(page.getByText(`Dijadwalkan ulang oleh klinik: ${rescheduleReason}`)).toBeVisible();
  });

  test("pasien booking -> staf menolak dengan alasan -> pasien melihat status Ditolak dan alasan", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const complaint = `[E2E-APPT-REJECT-${suffix}] Kontrol ulang`;
    const rejectReason = `Dokter sedang cuti tahunan (${suffix})`;
    createdComplaints.push(complaint);

    const todayStr = jakartaTodayStr();
    const doctor2 = await db.user.findUniqueOrThrow({
      where: { email: "dokter2@klinik.test" },
      include: { doctorSchedules: { where: { isActive: true }, orderBy: { dayOfWeek: "asc" } } },
    });
    const schedule = doctor2.doctorSchedules[0]!;
    const bookingDate = nextDateForDayOfWeek(todayStr, schedule.dayOfWeek, 2);

    await login(page, "pasien@klinik.test");
    await page.goto("/pasien/janji");
    await page.getByLabel("Dokter").selectOption(doctor2.id);
    await page.getByLabel("Tanggal periksa").fill(bookingDate);

    const slotRadio = page.getByRole("radio", {
      name: new RegExp(`${schedule.startTime} – ${schedule.endTime}`),
    });
    await expect(slotRadio).toBeVisible();
    await slotRadio.click();

    await page.getByLabel(/Keluhan singkat/).fill(complaint);
    await page.getByRole("button", { name: "Ajukan Janji Temu" }).click();
    await expect(page.getByText(complaint)).toBeVisible();

    await logout(page);

    await login(page, "pendaftaran@klinik.test");
    await page.goto("/staf/pendaftaran");
    await page.getByRole("tab", { name: /Permintaan Janji/ }).click();

    const pendingRow = page.locator("tr", { hasText: complaint }).first();
    await expect(pendingRow).toBeVisible();
    await pendingRow.getByRole("button", { name: "Tolak" }).click();

    const rejectDialog = page.getByRole("dialog", { name: "Tolak Permintaan Janji" });
    await expect(rejectDialog).toBeVisible();
    await rejectDialog.getByLabel("Alasan penolakan").fill(rejectReason);
    await rejectDialog.getByRole("button", { name: "Tolak Janji" }).click();
    await expect(rejectDialog).toBeHidden();

    await logout(page);

    await login(page, "pasien@klinik.test");
    await page.goto("/pasien/janji");
    await expect(page.getByText(complaint)).toBeVisible();
    await expect(page.getByText(`Alasan penolakan: ${rejectReason}`)).toBeVisible();
    await expect(page.getByText("Ditolak").first()).toBeVisible();
  });
});
