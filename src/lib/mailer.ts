import nodemailer from "nodemailer";
import { isTestMailSinkEnabled, recordTestEmail } from "./test-inbox";

const DEFAULT_SMTP_HOST = "smtp.gmail.com";
const DEFAULT_SMTP_PORT = 465;

/**
 * Every organization sends through its own mailbox (an app password on its
 * own Gmail account) — never a shared/platform mailbox — so recipients only
 * ever see that organization's own address. There is deliberately no
 * fallback to a shared account: if this isn't configured, sending fails
 * with a clear error rather than silently using someone else's identity.
 */
export interface OrganizationSmtpConfig {
  user: string;
  appPassword: string;
}

/** Builds the SMTP config for `sendEmail` from an organization row, or `null` if unset. */
export function organizationSmtpConfig(organization: {
  smtpUser: string | null;
  smtpAppPassword: string | null;
}): OrganizationSmtpConfig | null {
  if (!organization.smtpUser || !organization.smtpAppPassword) return null;
  return { user: organization.smtpUser, appPassword: organization.smtpAppPassword };
}

/**
 * The platform's own mailbox — used only for the handful of emails sent
 * before an organization has configured its own (e.g. inviting the first
 * admin of a newly approved association). Never used for anything
 * candidate/member-facing on an organization's behalf.
 */
export function platformSmtpConfig(): OrganizationSmtpConfig | null {
  if (!process.env.PLATFORM_SMTP_USER || !process.env.PLATFORM_SMTP_APP_PASSWORD) return null;
  return { user: process.env.PLATFORM_SMTP_USER, appPassword: process.env.PLATFORM_SMTP_APP_PASSWORD };
}

function createTransporterFor({ user, appPassword }: OrganizationSmtpConfig) {
  const host = process.env.SMTP_HOST ?? DEFAULT_SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? DEFAULT_SMTP_PORT);

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: appPassword },
  });
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
  /** Display name shown to the recipient — the organization's own name. */
  fromName: string;
  /** Where replies should land — typically the organization's own contact email. */
  replyTo?: string;
  /** The sending organization's own mailbox credentials; `null` if not configured yet. */
  organizationSmtp: OrganizationSmtpConfig | null;
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
  fromName,
  replyTo,
  organizationSmtp,
}: SendEmailOptions) {
  if (isTestMailSinkEnabled()) {
    recordTestEmail({ to, subject, html, sentAt: new Date() });
    return;
  }

  if (!organizationSmtp) {
    throw new Error("Configurez une adresse email d'envoi avant d'envoyer des emails.");
  }

  const displayName = fromName.replace(/["<>]/g, "");

  await createTransporterFor(organizationSmtp).sendMail({
    from: `"${displayName}" <${organizationSmtp.user}>`,
    to,
    replyTo,
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

/** Sent when a platform manager creates/approves a brand-new organization — the recipient becomes its first admin by accepting. */
export function platformAdminInvitationEmailHtml(params: {
  organizationName: string;
  acceptUrl: string;
}) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
      <h2>Votre association a été validée sur PattePilot 🐾</h2>
      <p><strong>${params.organizationName}</strong> est prête — acceptez l'invitation ci-dessous pour créer votre compte et devenir administrateur·rice de votre association.</p>
      <p>
        <a href="${params.acceptUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
          Accepter l'invitation
        </a>
      </p>
      <p style="color:#666;font-size:12px;">Ce lien expire dans 7 jours. Si vous ne vous attendiez pas à cet email, ignorez-le simplement.</p>
    </div>
  `;
}
