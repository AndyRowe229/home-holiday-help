import nodemailer from "nodemailer";
import { bookingRows, formatDate, SERVICE_LABELS } from "./booking.js";

const INBOX = process.env.BOOKINGS_INBOX || "home.holiday.help123@gmail.com";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Sends the booking table to the business inbox from the business Gmail account.
export async function sendBookingEmail(booking, customerEmail) {
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  const rows = [...bookingRows(booking), ["Customer email", customerEmail]];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:8px 14px;background:#FCF3D9;border:1px solid #E6D9B8">${escapeHtml(label)}</th>` +
        `<td style="padding:8px 14px;border:1px solid #E6D9B8;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Verdana,Geneva,sans-serif;color:#4A3F35">
      <h2 style="margin:0 0 6px">New booking for ${escapeHtml(booking.sitter)}</h2>
      <p style="margin:0 0 16px">${escapeHtml(SERVICE_LABELS[booking.service])} on ${escapeHtml(formatDate(booking.booking_date))}</p>
      <table style="border-collapse:collapse;font-size:14px">${tableRows}</table>
    </div>`;

  const plain = rows.map(([label, value]) => `${label}: ${value ?? ""}`).join("\n");

  await transport.sendMail({
    from: `"Home Holiday Help Bookings" <${process.env.GMAIL_USER}>`,
    to: INBOX,
    replyTo: customerEmail,
    subject: `New booking for ${booking.sitter}: ${SERVICE_LABELS[booking.service]} on ${formatDate(booking.booking_date)}`,
    text: plain,
    html,
  });
}
