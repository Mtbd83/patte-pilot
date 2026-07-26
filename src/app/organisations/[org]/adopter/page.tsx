import { notFound } from "next/navigation";
import { PawPrint } from "lucide-react";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { AdoptionApplicationForm } from "./adoption-application-form";

/** Fully public page — no authentication required to submit an adoption application. */
export default async function AdopterPage({
  params,
}: {
  params: { org: string };
}) {
  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <PawPrint className="size-8 text-primary" />
          <h1 className="text-2xl font-semibold">Adopter chez {organization.name}</h1>
          <p className="text-sm text-muted-foreground">
            Merci de votre intérêt pour l&apos;adoption ! Remplissez ce formulaire, notre équipe reviendra vers
            vous rapidement.
          </p>
        </div>
        <AdoptionApplicationForm organizationId={organization.id} />
      </main>
    </div>
  );
}
