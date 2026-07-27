import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { OrgSidebar } from "./org-sidebar";

/**
 * Shared shell for every /organisations/[org]/* page: authenticates,
 * resolves the org, and gates on membership once here instead of in each
 * page. Pages still re-check role for their own admin-only sections, but no
 * longer need to redirect/notFound/access-denied themselves.
 */
export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const roles = await getMemberRoles(session.user.id, organization.id);
  if (roles.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Accès refusé</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vous n&apos;êtes pas membre de cette organisation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background md:flex">
      <OrgSidebar orgSlug={params.org} orgName={organization.name} logoUrl={organization.logoUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
