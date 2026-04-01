const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function formatAppointmentDate(dateVal) {
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatAppointmentTime(timeVal) {
  const parts = String(timeVal || '').split(':');
  if (parts.length < 2) return timeVal;
  const h = Number(parts[0]);
  const m = parts[1];
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m} ${period}`;
}

function sendCancellationEmail({ p_first_name, p_last_name, p_email, appointment_date, appointment_time, doctor_name }) {
  if (!isEmailConfigured()) {
    console.log(`[EMAIL SKIPPED — SMTP not configured] Would send cancellation email to ${p_email} (${p_first_name} ${p_last_name}) for appointment on ${appointment_date} at ${appointment_time}`);
    return Promise.resolve();
  }

  const portalUrl = process.env.PORTAL_URL || 'http://localhost:5173';
  const formattedDate = formatAppointmentDate(appointment_date);
  const formattedTime = formatAppointmentTime(appointment_time);
  const patientName = `${p_first_name} ${p_last_name}`;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: p_email,
    subject: 'Your Appointment Has Been Cancelled — Please Reschedule',
    text: [
      `Dear ${patientName},`,
      '',
      `We regret to inform you that your appointment has been cancelled due to doctor unavailability:`,
      `  Date:   ${formattedDate}`,
      `  Time:   ${formattedTime}`,
      `  Doctor: ${doctor_name}`,
      '',
      `Please log in to your patient portal to reschedule at your earliest convenience:`,
      `${portalUrl}/patient-login`,
      '',
      `We sincerely apologize for the inconvenience.`,
      '',
      `Bright Dental Clinic`
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;">
        <h2 style="color:#1c2a28;margin-top:0;">Appointment Cancellation Notice</h2>
        <p>Dear <strong>${patientName}</strong>,</p>
        <p>We regret to inform you that the following appointment has been cancelled due to <strong>doctor unavailability</strong>:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:bold;border-radius:4px 0 0 4px;">Date</td><td style="padding:6px 12px;background:#fafafa;">${formattedDate}</td></tr>
          <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:bold;">Time</td><td style="padding:6px 12px;background:#fafafa;">${formattedTime}</td></tr>
          <tr><td style="padding:6px 12px;background:#f5f5f5;font-weight:bold;border-radius:0 0 0 4px;">Doctor</td><td style="padding:6px 12px;background:#fafafa;">${doctor_name}</td></tr>
        </table>
        <p>Please reschedule your appointment at your earliest convenience:</p>
        <a href="${portalUrl}/patient-login" style="display:inline-block;background:#1c6f5c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Reschedule Now</a>
        <p style="margin-top:24px;color:#666;font-size:0.875rem;">We sincerely apologize for the inconvenience.<br>Bright Dental Clinic</p>
      </div>
    `
  });
}

module.exports = { sendCancellationEmail };
