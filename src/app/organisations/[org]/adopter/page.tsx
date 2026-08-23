import { notFound } from "next/navigation";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { listPubliclyAdoptableAnimals } from "@/server/actions/animals";
import { AdoptionApplicationForm } from "./adoption-application-form";

/** Fully public page — no authentication required to submit an adoption application. */
export default async function AdopterPage(
  props: {
    params: Promise<{ org: string }>;
  }
) {
  const params = await props.params;
  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const adoptableAnimals = await listPubliclyAdoptableAnimals({ organizationId: organization.id });

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center">
          {organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="size-16 rounded-lg object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/pattepilot-logo.svg" alt="" className="h-40 w-auto" />
          )}
          <h1 className="text-2xl font-semibold">Adopter chez {organization.name}</h1>
          <p className="text-sm text-muted-foreground">
            Merci de votre intérêt pour l&apos;adoption ! Remplissez ce formulaire, notre équipe reviendra vers
            vous rapidement.
          </p>
        </div>
        <AdoptionApplicationForm organizationId={organization.id} adoptableAnimals={adoptableAnimals} />
      </main>
    </div>
  );
}
