import { listOrganizationSignupRequests } from "@/server/actions/platform";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SignupRequestRow } from "./signup-request-row";

export default async function PlateformeRequestsPage() {
  const requests = await listOrganizationSignupRequests({});

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Demandes d&apos;inscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Valider une demande crée l&apos;association et envoie une invitation à la personne contact, qui en
          devient la première administratrice.
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <CardTitle>{request.organizationName}</CardTitle>
                <CardDescription>
                  {request.contactName} — {request.contactEmail}
                  {request.phone ? ` — ${request.phone}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SignupRequestRow request={request} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
