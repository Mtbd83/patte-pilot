import nodemailer from "nodemailer";
import { isTestMailSinkEnabled, recordTestEmail } from "./test-inbox";

const DEFAULT_SMTP_HOST = "smtp.gmail.com";
const DEFAULT_SMTP_PORT = 465;

/**
 * Every organization sends through its own mailbox (an app password on its
 * own Gmail account, or any other SMTP provider — see host/port below) —
 * never a shared/platform mailbox — so recipients only ever see that
 * organization's own address. There is deliberately no fallback to a shared
 * account: if this isn't configured, sending fails with a clear error
 * rather than silently using someone else's identity.
 */
export interface OrganizationSmtpConfig {
  user: string;
  appPassword: string;
  /**
   * Address shown in the From header, if different from `user` (e.g. a
   * Gmail "+alias" of the same mailbox, registered under Gmail's own
   * "Send mail as" settings — otherwise Gmail rewrites it back to `user`).
   * Note this does not hide the base address, only adds a suffix to it.
   */
  fromAddress?: string;
  /** Overrides DEFAULT_SMTP_HOST/PORT — set for any provider other than Gmail. */
  host?: string;
  port?: number;
}

/** Builds the SMTP config for `sendEmail` from an organization row, or `null` if unset. */
export function organizationSmtpConfig(organization: {
  smtpUser: string | null;
  smtpAppPassword: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
}): OrganizationSmtpConfig | null {
  if (!organization.smtpUser || !organization.smtpAppPassword) return null;
  return {
    user: organization.smtpUser,
    appPassword: organization.smtpAppPassword,
    host: organization.smtpHost ?? undefined,
    port: organization.smtpPort ?? undefined,
  };
}

/**
 * The platform's own mailbox — used only for (a) the handful of emails sent
 * before an organization even exists yet (inviting the first admin of a
 * newly approved association), and (b) as a manual fallback in the platform
 * admin tool's own "relancer" action on a pending invitation (see
 * resendInvitation in src/server/actions/platform.ts). Deliberately NOT a
 * general fallback for every organization email: an organization without
 * its own SMTP configured is meant to hit a clear error and go set one up
 * in Paramètres, not silently ride on the platform's personal mailbox for
 * its regular traffic (invitations it sends itself, certificates,
 * contracts...) — keeping volume through that mailbox to genuine,
 * deliberate platform-manager actions only.
 */
export function platformSmtpConfig(): OrganizationSmtpConfig | null {
  if (!process.env.PLATFORM_SMTP_USER || !process.env.PLATFORM_SMTP_APP_PASSWORD) return null;
  return {
    user: process.env.PLATFORM_SMTP_USER,
    appPassword: process.env.PLATFORM_SMTP_APP_PASSWORD,
    fromAddress: process.env.PLATFORM_SMTP_FROM || undefined,
  };
}

function createTransporterFor({ user, appPassword, host: orgHost, port: orgPort }: OrganizationSmtpConfig) {
  const host = orgHost ?? process.env.SMTP_HOST ?? DEFAULT_SMTP_HOST;
  const port = orgPort ?? Number(process.env.SMTP_PORT ?? DEFAULT_SMTP_PORT);

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
    from: `"${displayName}" <${organizationSmtp.fromAddress ?? organizationSmtp.user}>`,
    to,
    replyTo,
    subject,
    html,
    attachments,
  });
}

/** PattePilot's own green (the paw mark in public/pattepilot-logo.svg) — used for every PattePilot-authored email, not an organization's own branding. */
const BRAND_GREEN = "#009966";

/** Common header (logo) + button + footer shell shared by every PattePilot-authored email — organizations' own certificate/contract emails (free text, see email-templates.ts) are untouched by this. */
function brandedEmailHtml({
  logoUrl,
  heading,
  bodyHtml,
  buttonLabel,
  buttonUrl,
}: {
  logoUrl: string;
  heading: string;
  bodyHtml: string;
  buttonLabel: string;
  buttonUrl: string;
}) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: auto; padding: 32px 24px; background:#ffffff;">
      <div style="text-align:center; margin-bottom: 24px;">
        <img src="${logoUrl}" alt="PattePilot" width="56" height="56" style="display:inline-block;" />
      </div>
      <h2 style="color:#0f172a; font-size:20px; margin:0 0 16px; text-align:center;">${heading}</h2>
      <div style="color:#334155; font-size:15px; line-height:1.6;">${bodyHtml}</div>
      <p style="margin: 28px 0; text-align:center;">
        <a href="${buttonUrl}" style="background:${BRAND_GREEN};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
          ${buttonLabel}
        </a>
      </p>
      <p style="color:#94a3b8;font-size:12px;text-align:center;">Ce lien expire dans 7 jours. Si vous ne vous attendiez pas à cet email, ignorez-le simplement.</p>
    </div>
  `;
}

export function invitationEmailHtml(params: {
  organizationName: string;
  inviterName: string;
  acceptUrl: string;
  roles: string[];
  logoUrl: string;
}) {
  const roleLabels: Record<string, string> = {
    admin: "Administrateur·rice",
    benevole: "Bénévole",
    famille_accueil: "Famille d'accueil",
  };
  const rolesText = params.roles.map((r) => roleLabels[r] ?? r).join(", ");

  return brandedEmailHtml({
    logoUrl: params.logoUrl,
    heading: `Vous êtes invité·e à rejoindre ${params.organizationName} 🐾`,
    bodyHtml: `<p>${params.inviterName} vous invite à rejoindre l'association <strong>${params.organizationName}</strong> avec le rôle : <strong>${rolesText}</strong>.</p>`,
    buttonLabel: "Accepter l'invitation",
    buttonUrl: params.acceptUrl,
  });
}

/** Sent when a platform manager creates/approves a brand-new organization — the recipient becomes its first admin by accepting. */
export function platformAdminInvitationEmailHtml(params: {
  organizationName: string;
  acceptUrl: string;
  logoUrl: string;
}) {
  return brandedEmailHtml({
    logoUrl: params.logoUrl,
    heading: "Votre association a été validée sur PattePilot 🐾",
    bodyHtml: `<p><strong>${params.organizationName}</strong> est prête — acceptez l'invitation ci-dessous pour créer votre compte et devenir administrateur·rice de votre association.</p>`,
    buttonLabel: "Accepter l'invitation",
    buttonUrl: params.acceptUrl,
  });
}
