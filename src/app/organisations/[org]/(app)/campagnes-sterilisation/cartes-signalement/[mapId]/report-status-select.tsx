"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateReportManagementStatus } from "@/server/actions/sterilization-reports";
import type { ReportManagementStatus } from "@/db/schema";
import { REPORT_MANAGEMENT_STATUS_LABELS } from "@/lib/report-labels";
import { Select } from "@/components/ui/select";

const STATUS_OPTIONS = Object.entries(REPORT_MANAGEMENT_STATUS_LABELS) as [ReportManagementStatus, string][];

/** Admin or bénévole with "campagne_sterilisation": changes a report's own workflow status, applied immediately. */
export function ReportStatusSelect({
  organizationId,
  reportId,
  currentStatus,
}: {
  organizationId: string;
  reportId: string;
  currentStatus: ReportManagementStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value as ReportManagementStatus;
    setPending(true);
    try {
      await updateReportManagementStatus({ reportId, organizationId, status });
      toast.success("Statut mis à jour");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Select value={currentStatus} disabled={pending} onChange={handleChange} className="w-auto">
      {STATUS_OPTIONS.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}
