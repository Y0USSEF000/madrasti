// Sends emails with Gmail (or any SMTP). If SMTP is not configured in .env, emails are
// printed in the server window instead, so the site still works while testing.
const nodemailer = require('nodemailer');

const user = (process.env.SMTP_USER || '').trim();
const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
const configured = Boolean(user && pass);

const transporter = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: (Number(process.env.SMTP_PORT) || 465) === 465,
      auth: { user, pass },
    })
  : null;

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendVerificationEmail(to, name, code) {
  const subject = `${code} is your Madrasti code`;
  const text = `Salam ${name},\n\nYour Madrasti verification code is: ${code}\n\nIt is valid for 15 minutes. If you did not create an account, ignore this email.\n\nMadrasti · مدرستي`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e6e0d3;border-radius:14px;overflow:hidden">
    <div style="background:#0f6b5c;color:#fff;padding:18px 24px;font-size:20px;font-weight:700">Madrasti · مدرستي</div>
    <div style="padding:24px;color:#1d2a2a">
      <p>Salam ${escHtml(name)},</p>
      <p>Use this code to confirm your email address:</p>
      <p style="font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;background:#f6f3ec;border-radius:10px;padding:14px;margin:18px 0">${code}</p>
      <p style="color:#7c8a88;font-size:13px">The code is valid for 15 minutes. If you did not create a Madrasti account, you can ignore this email.</p>
    </div></div>`;
  if (!configured) {
    console.log(`[mail] SMTP is not configured (.env). Verification code for ${to}: ${code}`);
    return { sent: false };
  }
  await transporter.sendMail({ from: `"${process.env.MAIL_FROM_NAME || 'Madrasti'}" <${user}>`, to, subject, text, html });
  return { sent: true };
}

module.exports = { sendVerificationEmail, mailConfigured: configured };
