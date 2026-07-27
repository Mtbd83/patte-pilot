"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/select";
import { STATUS_LABELS } from "@/lib/animal-labels";
import type { AnimalStatus } from "@/db/schema";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as [AnimalStatus, string][];

export function AnimalStatusFilter({ currentStatus }: { currentStatus: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Select
      aria-label="Filtrer par statut"
      value={currentStatus}
      onChange={(e) => handleChange(e.target.value)}
      className="w-auto"
    >
      <option value="">Tous les statuts</option>
      {STATUS_OPTIONS.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}
