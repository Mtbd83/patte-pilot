import nodemailer from "nodemailer";
import { isTestMailSinkEnabled, recordTestEmail } from "./test-inbox";

/**
 * Shared SMTP transporter. Configure via env vars so we can point at Gmail
 * (recommended: an App Password on a dedicated Gmail account for the
 * association) or any other SMTP provider without code changes.
 *
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
 */
function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error("SMTP configuration is incomplete (SMTP_HOST/PORT/USER/PASSWORD).");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });
}

let transporter: ReturnType<typeof createTransporter> | null = null;

function getTransporter() {
  if (!transporter) transporter = createTransporter();
  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}

export async function sendEmail({ to, subject, html, attachments }: SendEmailOptions) {
  if (isTestMailSinkEnabled()) {
    recordTestEmail({ to, subject, html, sentAt: new Date() });
    return;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

  await getTransporter().sendMail({
    from,
    to,
    subject,
    html,
    attachments,
  });
}

export function invitationEmailHtml(params: {
  organizationName: string;
  inviterName: string;
  acceptUrl: string;
  roles: string[];
}) {
  const roleLabels: Record<string, string> = {
    admin: "Administrateur·rice",
    benevole: "Bénévole",
    famille_accueil: "Famille d'accueil",
  };
  const rolesText = params.roles.map((r) => roleLabels[r] ?? r).join(", ");

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2>Vous êtes invité·e à rejoindre ${params.organizationName} 🐾</h2>
      <p>${params.inviterName} vous invite à rejoindre l'association <strong>${params.organizationName}</strong> avec le rôle : <strong>${rolesText}</strong>.</p>
      <p>
        <a href="${params.acceptUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
          Accepter l'invitation
        </a>
      </p>
      <p style="color:#666;font-size:12px;">Ce lien expire dans 7 jours. Si vous ne vous attendiez pas à cet email, ignorez-le simplement.</p>
    </div>
  `;
}
