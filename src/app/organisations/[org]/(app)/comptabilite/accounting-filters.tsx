"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ACCOUNTING_CATEGORY_LABELS, MONTH_LABELS } from "@/lib/accounting-labels";
import type { AccountingCategory } from "@/db/schema";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

const CATEGORY_OPTIONS = Object.entries(ACCOUNTING_CATEGORY_LABELS) as [AccountingCategory, string][];

export type PeriodMode = "all" | "year" | "month" | "custom";

interface AnimalOption {
  id: string;
  name: string;
}

export function AccountingFilters({
  periodMode,
  year,
  month,
  dateFrom,
  dateTo,
  category,
  animalId,
  years,
  animals,
}: {
  periodMode: PeriodMode;
  year: string;
  month: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  animalId: string;
  years: number[];
  animals: AnimalOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handlePeriodModeChange(value: PeriodMode) {
    if (value === "all") {
      navigate({ periodMode: "", year: "", month: "", dateFrom: "", dateTo: "" });
    } else if (value === "year") {
      navigate({ periodMode: "year", year: year || String(years[0] ?? new Date().getFullYear()), month: "", dateFrom: "", dateTo: "" });
    } else if (value === "month") {
      navigate({
        periodMode: "month",
        year: year || String(years[0] ?? new Date().getFullYear()),
        month: month || String(new Date().getMonth() + 1).padStart(2, "0"),
        dateFrom: "",
        dateTo: "",
      });
    } else {
      navigate({ periodMode: "custom", year: "", month: "" });
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Période" htmlFor="filter-period-mode">
        <Select
          id="filter-period-mode"
          className="w-auto"
          value={periodMode}
          onChange={(e) => handlePeriodModeChange(e.target.value as PeriodMode)}
        >
          <option value="all">Toutes</option>
          <option value="year">Année</option>
          <option value="month">Mois</option>
          <option value="custom">Personnalisée</option>
        </Select>
      </Field>

      {(periodMode === "year" || periodMode === "month") && (
        <Field label="Année" htmlFor="filter-year">
          <Select
            id="filter-year"
            className="w-auto"
            value={year}
            onChange={(e) => navigate({ year: e.target.value })}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {periodMode === "month" && (
        <Field label="Mois" htmlFor="filter-month">
          <Select
            id="filter-month"
            className="w-auto"
            value={month}
            onChange={(e) => navigate({ month: e.target.value })}
          >
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={String(i + 1).padStart(2, "0")}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {periodMode === "custom" && (
        <>
          <Field label="Du" htmlFor="filter-date-from">
            <Input
              id="filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => navigate({ dateFrom: e.target.value })}
            />
          </Field>
          <Field label="Au" htmlFor="filter-date-to">
            <Input
              id="filter-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => navigate({ dateTo: e.target.value })}
            />
          </Field>
        </>
      )}

      <Field label="Catégorie" htmlFor="filter-category">
        <Select
          id="filter-category"
          className="w-auto"
          value={category}
          onChange={(e) => navigate({ category: e.target.value })}
        >
          <option value="">Toutes les catégories</option>
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Animal" htmlFor="filter-animal">
        <Select
          id="filter-animal"
          className="w-auto"
          value={animalId}
          onChange={(e) => navigate({ animalId: e.target.value })}
        >
          <option value="">Tous les animaux</option>
          {animals.map((animal) => (
            <option key={animal.id} value={animal.id}>
              {animal.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
