import { notFound } from "next/navigation";
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
    <main style={{ maxWidth: 720, margin: "60px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1>Adopter chez {organization.name}</h1>
      <p>
        Merci de votre intérêt pour l&apos;adoption ! Remplissez ce formulaire, notre équipe
        reviendra vers vous rapidement.
      </p>
      <AdoptionApplicationForm organizationId={organization.id} />
    </main>
  );
}
