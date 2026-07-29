import {
  SUPPLY_REQUEST_CATEGORY_LABELS,
  SUPPLY_REQUEST_STATUS_LABELS,
} from "@/lib/supply-request-labels";
import type { SupplyRequest, SupplyRequestCategory, FosterFamily } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SupplyRequestRow } from "./supply-request-row";

type SupplyRequestWithFamily = SupplyRequest & { fosterFamily: FosterFamily };

export function SupplyRequestsSection({
  organizationId,
  requests,
}: {
  organizationId: string;
  requests: SupplyRequestWithFamily[];
}) {
  if (requests.length === 0) return null;

  const totals = new Map<SupplyRequestCategory, number>();
  for (const request of requests) {
    totals.set(request.category, (totals.get(request.category) ?? 0) + request.quantity);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demandes des familles d&apos;accueil</CardTitle>
        <CardDescription>
          Total demandé :{" "}
          {[...totals.entries()]
            .map(([category, total]) => `${total}x ${SUPPLY_REQUEST_CATEGORY_LABELS[category]}`)
            .join(" · ")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Famille</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Quantité</TableHead>
              <TableHead>Précision</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">
                  {request.fosterFamily.firstName} {request.fosterFamily.lastName}
                </TableCell>
                <TableCell>{SUPPLY_REQUEST_CATEGORY_LABELS[request.category]}</TableCell>
                <TableCell>{request.quantity}</TableCell>
                <TableCell className="text-muted-foreground">{request.comment || "—"}</TableCell>
                <TableCell>
                  <Badge variant={request.status === "pris_en_compte" ? "success" : "warning"}>
                    {SUPPLY_REQUEST_STATUS_LABELS[request.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <SupplyRequestRow organizationId={organizationId} requestId={request.id} status={request.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
