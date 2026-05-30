import nodemailer from "nodemailer";
import { loadAlertConfig } from "../config";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const config = loadAlertConfig();
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: config.gmail.user,
      pass: config.gmail.appPassword,
    },
  });

  return transporter;
}

export async function sendEmail(
  subject: string,
  htmlBody: string,
  recipients?: string[]
): Promise<void> {
  const config = loadAlertConfig();
  const to = recipients ?? config.recipients;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
${htmlBody}
<hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
<p style="font-size: 12px; color: #999;">Sent by Monarch Tools</p>
</body>
</html>`;

  await getTransporter().sendMail({
    from: `"Monarch Tools" <${config.gmail.user}>`,
    to: to.join(", "),
    subject,
    html,
  });
}

export function closeTransport(): void {
  if (transporter) {
    transporter.close();
    transporter = null;
  }
}
