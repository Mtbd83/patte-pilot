import { OrganizationSignupRequestForm } from "./organization-signup-request-form";

/** Fully public page — no authentication required to request that an association join the platform. */
export default function RejoindrePage() {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pattepilot-logo.svg" alt="PattePilot" className="h-40 w-auto" />
          <h1 className="text-2xl font-semibold">Rejoindre PattePilot</h1>
          <p className="text-sm text-muted-foreground">
            Votre association souhaite utiliser PattePilot pour gérer ses animaux, ses familles d&apos;accueil
            et ses candidatures d&apos;adoption ? Décrivez-la ci-dessous, nous revenons vers vous rapidement.
          </p>
        </div>
        <OrganizationSignupRequestForm />
      </main>
    </div>
  );
}
