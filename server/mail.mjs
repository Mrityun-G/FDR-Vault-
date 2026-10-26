// Account emails (confirmation, sign-in code, password reset). Without SMTP settings they are written to the server log.
import nodemailer from 'nodemailer';
import { config } from './config.mjs';

const transport = config.smtp
  ? nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure, auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined })
  : null;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const html = (title, body) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0f172a">
  <div style="background:#0B3A70;color:#fff;padding:14px 18px;border-bottom:3px solid #D97706"><b>AICTE · Institution &amp; Staff Portal</b></div>
  <div style="padding:18px;border:1px solid #e2e8f0;border-top:0"><h2 style="font-size:17px;margin:0 0 12px">${esc(title)}</h2>${body}
  <p style="font-size:12px;color:#64748b;margin-top:20px">If you did not request this, you can ignore this email.</p></div></div>`;
const button = (url, label) => `<p><a href="${esc(url)}" style="display:inline-block;background:#0B3A70;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${esc(label)}</a></p><p style="font-size:12px;color:#64748b;word-break:break-all">${esc(url)}</p>`;

export const outbox = [];   // last few messages, for the test suite only (never exposed over HTTP)

async function send(to, subject, text, htmlBody) {
  outbox.push({ to, subject, text, at: Date.now() });
  if (outbox.length > 50) outbox.shift();
  if (!transport) { console.log(`[mail] (SMTP not configured) to ${to}: ${subject}\n${text}\n`); return; }
  await transport.sendMail({ from: config.mailFrom, to, subject, text, html: htmlBody });
}

export const mail = {
  confirmation: (to, url) => send(to, 'Confirm your email', `Confirm your email address to activate your account:\n${url}\n\nThe link is valid for 24 hours.`,
    html('Confirm your email', `<p>Confirm your email address to activate your account.</p>${button(url, 'Confirm email')}<p style="font-size:12px">The link is valid for 24 hours.</p>`)),
  otp: (to, code) => send(to, `Your sign-in code: ${code}`, `Your one-time sign-in code is ${code}. It expires in 10 minutes.`,
    html('Your sign-in code', `<p>Your one-time sign-in code is</p><p style="font-size:26px;letter-spacing:6px;font-weight:bold">${esc(code)}</p><p style="font-size:12px">It expires in 10 minutes.</p>`)),
  recovery: (to, url) => send(to, 'Reset your password', `Open this link to set a new password:\n${url}\n\nThe link is valid for 1 hour.`,
    html('Reset your password', `<p>Open the link below to set a new password.</p>${button(url, 'Set a new password')}<p style="font-size:12px">The link is valid for 1 hour.</p>`)),
};
