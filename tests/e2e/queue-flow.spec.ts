import { expect, test } from "@playwright/test";
import {
  dayOfWeekFromDateStr,
  jakartaCurrentTimeStr,
  jakartaTodayStr,
  parseDateOnlyUtc,
} from "@/lib/date";
import { db, login, logout, uniqueSuffix } from "./helpers";

test.describe("alur lengkap: QR, check-in, walk-in, panggilan staf, dan live queue pasien", () => {
  const createdComplaints: string[] = [];
  const createdPatientNames: string[] = [];
  const createdScheduleIds: string[] = [];

  async function ensureTodayDoctor1Schedule() {
    const todayStr = jakartaTodayStr();
    const todayDow = dayOfWeekFromDateStr(todayStr);
    const nowTime = jakartaCurrentTimeStr();

    const doctor1 = await db.user.findUniqueOrThrow({
      where: { email: "dokter1@klinik.test" },
    });

    const existingActive = await db.doctorSchedule.findFirst({
      where: {
        doctorId: doctor1.id,
        dayOfWeek: todayDow,
        isActive: true,
        endTime: { gt: nowTime },
      },
      orderBy: { startTime: "asc" },
    });

    if (existingActive) {
      return { doctor: doctor1, schedule: existingActive, todayStr };
    }

    const tempSchedule = await db.doctorSchedule.create({
      data: {
        doctorId: doctor1.id,
        dayOfWeek: todayDow,
        startTime: "00:01",
        endTime: "23:59",
        quota: 50,
        isActive: true,
      },
    });
    createdScheduleIds.push(tempSchedule.id);
    return { doctor: doctor1, schedule: tempSchedule, todayStr };
  }

  test.afterAll(async () => {
    if (createdComplaints.length > 0) {
      await db.appointment.deleteMany({
        where: { chiefComplaint: { in: createdComplaints } },
      });
    }
    if (createdPatientNames.length > 0) {
      await db.patient.deleteMany({
        where: { name: { in: createdPatientNames } },
      });
    }
    if (createdScheduleIds.length > 0) {
      await db.doctorSchedule.deleteMany({
        where: { id: { in: createdScheduleIds } },
      });
    }
    await db.$disconnect();
  });

  test("pasien booking -> staf setujui -> pasien buka QR -> staf check-in -> staf panggil -> pasien pantau /pasien/antrean", async ({
    page,
  }) => {
    test.slow();
    const suffix = uniqueSuffix();
    const complaint = `[E2E-LIVE-QUEUE-${suffix}] Kontrol gejala demam`;
    createdComplaints.push(complaint);

    const { doctor, schedule, todayStr } = await ensureTodayDoctor1Schedule();
    const todayDate = parseDateOnlyUtc(todayStr);

    const patientUser = await db.user.findUniqueOrThrow({
      where: { email: "pasien@klinik.test" },
      include: {
        patients: {
          where: { deletedAt: null },
          orderBy: [{ isSelf: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    // Pilih anggota keluarga yang belum punya janji aktif dengan doctor1 hari ini
    let targetPatient = patientUser.patients[0]!;
    for (const candidate of patientUser.patients) {
      const busy = await db.appointment.findFirst({
        where: {
          patientId: candidate.id,
          doctorId: doctor.id,
          appointmentDate: todayDate,
          status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
        },
        select: { id: true },
      });
      if (!busy) {
        targetPatient = candidate;
        break;
      }
    }

    // 1. Pasien membuat janji temu hari ini
    await login(page, "pasien@klinik.test");
    await page.goto("/pasien/janji");

    // Pastikan pasien aktif di switcher sesuai targetPatient
    const switcherBtn = page.getByRole("button", { name: /Pasien aktif:/ });
    if (!(await switcherBtn.textContent())?.includes(targetPatient.name)) {
      await switcherBtn.click();
      await page.getByRole("menuitem", { name: new RegExp(targetPatient.name) }).click();
    }

    await page.getByLabel("Dokter").selectOption(doctor.id);
    await page.getByLabel("Tanggal periksa").fill(todayStr);

    const slotRadio = page.getByRole("radio", {
      name: new RegExp(`${schedule.startTime} – ${schedule.endTime}`),
    });
    await expect(slotRadio).toBeVisible();
    await slotRadio.click();

    await page.getByLabel(/Keluhan singkat/).fill(complaint);
    await page.getByRole("button", { name: "Ajukan Janji Temu" }).click();
    await expect(page.getByText(complaint)).toBeVisible();

    await logout(page);

    // 2. Staf menyetujui janji temu & dapatkan nomor antrean
    await login(page, "pendaftaran@klinik.test");
    await page.goto("/staf/pendaftaran");
    await page.getByRole("tab", { name: /Permintaan Janji/ }).click();

    const pendingRow = page.locator("tr", { hasText: complaint }).first();
    await expect(pendingRow).toBeVisible();
    await pendingRow.getByRole("button", { name: "Setujui" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ya, Setujui" }).click();
    await expect(page.getByText(/Janji disetujui\. Nomor antrean: A-\d+/)).toBeVisible();

    const confirmedAppt = await db.appointment.findFirstOrThrow({
      where: { chiefComplaint: complaint },
    });
    expect(confirmedAppt.queueNumber).not.toBeNull();
    const formattedQueue = `A-${String(confirmedAppt.queueNumber).padStart(2, "0")}`;

    await logout(page);

    // 3. Pasien membuka QR Code di beranda
    await login(page, "pasien@klinik.test");
    const homeSwitcher = page.getByRole("button", { name: /Pasien aktif:/ });
    if (!(await homeSwitcher.textContent())?.includes(targetPatient.name)) {
      await homeSwitcher.click();
      await page.getByRole("menuitem", { name: new RegExp(targetPatient.name) }).click();
    }

    await page.getByRole("button", { name: "Tampilkan QR" }).click();
    const qrDialog = page.getByRole("dialog", { name: "QR Code Pasien" });
    await expect(qrDialog).toBeVisible();
    await expect(
      qrDialog.getByLabel(`QR Code berobat ${targetPatient.name}`).locator("svg"),
    ).toBeVisible();
    await expect(qrDialog.getByText(targetPatient.medicalRecordNumber)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(qrDialog).toBeHidden();

    await logout(page);

    // 4. Staf melakukan check-in menggunakan token QR pasien
    await login(page, "pendaftaran@klinik.test");
    await page.goto("/staf/pendaftaran/check-in");
    await page
      .getByLabel("Token QR / No. Rekam Medis / Nama Pasien")
      .fill(`KLINIK:${targetPatient.qrToken}`);
    await page.getByRole("button", { name: "Cari" }).click();

    await expect(page.getByText(targetPatient.medicalRecordNumber).first()).toBeVisible();
    const checkInRadio = page.getByRole("radio", {
      name: new RegExp(`${doctor.name}.*${formattedQueue}`),
    });
    if ((await checkInRadio.count()) > 0) {
      await checkInRadio.first().click();
    }
    await page.getByRole("button", { name: "Check-in", exact: true }).click();
    await expect(page.getByText(/Check-in berhasil/)).toBeVisible();

    // 5. Staf membuka papan antrean hari ini & memanggil antrean pasien
    await page.goto("/staf/pendaftaran/antrean");
    const doctorSection = page.getByRole("region", { name: new RegExp(`Antrean ${doctor.name}`) });
    await expect(doctorSection).toBeVisible();
    const currentQueueBlock = doctorSection.getByText("Antrean Sekarang").locator("..");

    for (let attempt = 0; attempt < 10; attempt++) {
      const text = (await currentQueueBlock.textContent()) ?? "";
      if (text.includes(formattedQueue)) break;

      const callNextBtn = doctorSection.getByRole("button", { name: "Panggil Berikutnya" });
      await expect(callNextBtn).toBeEnabled();
      await Promise.all([
        page.waitForResponse(
          (res) => res.url().includes("/api/staf/antrean") && res.status() === 200,
        ),
        callNextBtn.click(),
      ]);
      await expect(callNextBtn).toHaveAttribute("aria-busy", "false");
    }

    await expect(currentQueueBlock.getByText(formattedQueue)).toBeVisible();

    await logout(page);

    // 6. Pasien membuka /pasien/antrean dan melihat "Antrean Sekarang" sesuai + banner panggilan
    await login(page, "pasien@klinik.test");
    await page.goto("/pasien/antrean");

    const queueArticle = page.locator("article", { hasText: targetPatient.name }).first();
    await expect(queueArticle).toBeVisible();
    await expect(
      queueArticle.getByText("Giliran Anda, silakan menuju ruang periksa"),
    ).toBeVisible();
    await expect(queueArticle.getByText(formattedQueue)).toHaveCount(2);

    // Verifikasi respons polling JSON hanya milik akun yang login
    const apiRes = await page.request.get("/api/antrean");
    expect(apiRes.status()).toBe(200);
    const bodyText = await apiRes.text();
    expect(bodyText).toContain(formattedQueue);
    expect(bodyText).not.toContain("dr. Citra Dewi");
  });

  test("staf mendaftarkan walk-in baru -> nomor antrean tampil di papan /staf/pendaftaran/antrean", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const walkInName = `Pasien Walkin E2e ${suffix}`;
    const titleWalkInName = walkInName;
    const complaint = `[E2E-WALKIN-BOARD-${suffix}] Nyeri tenggorokan`;
    createdPatientNames.push(titleWalkInName);
    createdComplaints.push(complaint);

    const { doctor, schedule } = await ensureTodayDoctor1Schedule();

    await login(page, "pendaftaran@klinik.test");
    await page.goto("/staf/pendaftaran/walk-in");

    await page.getByRole("button", { name: "Pasien Baru" }).click();
    await page.getByLabel("Nama lengkap").fill(walkInName);
    await page.getByLabel("Tanggal lahir").fill("1994-04-20");
    await page.getByLabel("Jenis kelamin").selectOption("MALE");

    const sessionRadio = page.getByRole("radio", {
      name: new RegExp(`${doctor.name}.*${schedule.startTime}–${schedule.endTime}`),
    });
    await expect(sessionRadio).toBeVisible();
    await sessionRadio.click();

    await page.getByLabel("Keluhan singkat").fill(complaint);
    await page.getByRole("button", { name: "Terbitkan Nomor Antrean Walk-in" }).click();

    await expect(page.getByText("Nomor Antrean Walk-in", { exact: true })).toBeVisible();

    const walkInAppt = await db.appointment.findFirstOrThrow({
      where: { chiefComplaint: complaint },
    });
    expect(walkInAppt.queueNumber).not.toBeNull();
    const formattedQueue = `A-${String(walkInAppt.queueNumber).padStart(2, "0")}`;

    await page.goto("/staf/pendaftaran/antrean");
    const doctorSection = page.getByRole("region", { name: new RegExp(`Antrean ${doctor.name}`) });
    await expect(doctorSection).toBeVisible();

    const walkInRow = doctorSection.locator("li", { hasText: titleWalkInName }).first();
    await expect(walkInRow).toBeVisible();
    await expect(walkInRow.getByText(formattedQueue)).toBeVisible();
    await expect(walkInRow.getByText("Walk-in", { exact: true })).toBeVisible();
  });
});
