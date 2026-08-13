import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listHelloAssoLinks } from "@/server/actions/helloasso-links";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrganizationProfileForm } from "./organization-profile-form";
import { OrganizationLogoUpload } from "./organization-logo-upload";
import { OrganizationEmailSettingsForm } from "./organization-email-settings-form";
import { OrganizationHelloAssoLinksForm } from "./organization-helloasso-links-form";
import { OrganizationEmailTemplatesForm } from "./organization-email-templates-form";
import { OrganizationCertificatesUpload } from "./organization-certificates-upload";

export default async function ParametresPage(
  props: {
    params: Promise<{ org: string }>;
  }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/parametres`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const roles = await getMemberRoles(session.user.id, organization.id);
  if (!roles.includes("admin")) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seul·e·s les administrateur·rice·s peuvent modifier les paramètres.
          </p>
        </CardContent>
      </Card>
    );
  }

  const helloAssoLinks = await listHelloAssoLinks({ organizationId: organization.id });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/organisations/${params.org}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {organization.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Paramètres de l&apos;association</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adresse email d&apos;envoi</CardTitle>
          <CardDescription>
            Les invitations, certificats et contrats sont envoyés depuis cette adresse — jamais depuis une
            adresse partagée. Nécessite un compte Gmail dédié à l&apos;association avec la validation en 2 étapes
            activée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationEmailSettingsForm
            organizationId={organization.id}
            smtpUser={organization.smtpUser}
            hasAppPassword={Boolean(organization.smtpAppPassword)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo de l&apos;association</CardTitle>
          <CardDescription>
            Affiché dans le menu et sur le formulaire public d&apos;adoption.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationLogoUpload organizationId={organization.id} logoUrl={organization.logoUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profil de l&apos;association</CardTitle>
          <CardDescription>
            Ces informations (SIREN, coordonnées, numéro de déclaration en préfecture) apparaissent sur les
            contrats d&apos;adoption générés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationProfileForm organization={organization} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certificat d&apos;engagement</CardTitle>
          <CardDescription>
            Envoyé tel quel (sans remplissage) depuis une fiche candidature — l&apos;adoptant·e le complète et
            le signe de son côté. Le certificat chien est optionnel : sans lui, le certificat par défaut est
            utilisé pour tous les animaux.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationCertificatesUpload
            organizationId={organization.id}
            certificateFileUrl={organization.certificateFileUrl}
            certificateFileUrlChien={organization.certificateFileUrlChien}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contrat d&apos;adoption</CardTitle>
          <CardDescription>
            Votre propre modèle de contrat, rempli automatiquement avec les informations de l&apos;animal et
            de l&apos;adoptant·e — à configurer une fois dans un outil dédié.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href={`/organisations/${params.org}/parametres/contrat`}>
              {organization.contractTemplateUrl ? "Modifier le modèle de contrat" : "Configurer le modèle de contrat"}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liens HelloAsso</CardTitle>
          <CardDescription>
            Liens de paiement HelloAsso, nommés librement (ex. par espèce, par âge, tarif réduit...).
            Choisis manuellement dans le mail de contrat d&apos;adoption au moment de l&apos;envoi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationHelloAssoLinksForm organizationId={organization.id} links={helloAssoLinks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modèles d&apos;emails</CardTitle>
          <CardDescription>
            Textes envoyés avec le certificat d&apos;engagement et le contrat d&apos;adoption. Modifiables ici, et
            encore une dernière fois avant chaque envoi depuis une fiche candidature.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationEmailTemplatesForm
            organizationId={organization.id}
            certificateEmailSubject={organization.certificateEmailSubject}
            certificateEmailBody={organization.certificateEmailBody}
            contractEmailSubject={organization.contractEmailSubject}
            contractEmailBody={organization.contractEmailBody}
          />
        </CardContent>
      </Card>
    </div>
  );
}
