import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { clinicConfig } from "@/config/clinic";

type Mail = { to: string; subject: string; html: string; text: string };

/** Kirim email via SMTP. Tanpa SMTP_HOST, email dicetak ke console agar lokal tetap jalan. */
export async function sendMail(mail: Mail): Promise<void> {
  if (!env.SMTP_HOST) {
    console.info(
      `\n[mail] (SMTP tidak dikonfigurasi, email dicetak ke console)\nKepada : ${mail.to}\nSubjek : ${mail.subject}\n\n${mail.text}\n`,
    );
    return;
  }
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  await transporter.sendMail({ from: env.MAIL_FROM, ...mail });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Template HTML sederhana berwarna primary (inline style karena klien email). */
export function emailLayout(opts: {
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  outro: string;
}): string {
  const name = escapeHtml(clinicConfig.name);
  return `<!doctype html><html lang="id"><body style="margin:0;background:#F8FAFC;font-family:Arial,sans-serif;color:#1E293B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px">
<tr><td style="padding:24px 28px;border-bottom:1px solid #E2E8F0;font-weight:700;font-size:18px;color:#0F766E">${name}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:20px;color:#1E293B">${escapeHtml(opts.title)}</h1>
<p style="margin:0 0 24px;line-height:1.6;color:#334155">${escapeHtml(opts.intro)}</p>
<p style="margin:0 0 24px"><a href="${opts.actionUrl}" style="display:inline-block;background:#0D9488;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${escapeHtml(opts.actionLabel)}</a></p>
<p style="margin:0;line-height:1.6;color:#64748B;font-size:14px">${escapeHtml(opts.outro)}</p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#64748B">${name}${clinicConfig.address ? " | " + escapeHtml(clinicConfig.address) : ""}</p>
</td></tr></table></body></html>`;
}
