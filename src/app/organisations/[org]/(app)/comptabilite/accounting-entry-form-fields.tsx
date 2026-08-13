import { ACCOUNTING_TYPE_LABELS, ACCOUNTING_CATEGORY_LABELS, ACCOUNTING_CATEGORIES_BY_TYPE } from "@/lib/accounting-labels";
import type { AccountingCategory, AccountingType } from "@/db/schema";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FieldRow } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";

const TYPE_OPTIONS = Object.entries(ACCOUNTING_TYPE_LABELS) as [AccountingType, string][];

export interface AnimalOption {
  id: string;
  name: string;
}

/** Date/type/category/amount/animal/comment fields, shared by the create and edit forms. */
export function AccountingEntryFormFields({
  idPrefix,
  date,
  onDateChange,
  type,
  onTypeChange,
  category,
  onCategoryChange,
  amount,
  onAmountChange,
  animalId,
  onAnimalIdChange,
  comment,
  onCommentChange,
  animals,
}: {
  idPrefix: string;
  date: string;
  onDateChange: (value: string) => void;
  type: AccountingType;
  onTypeChange: (value: AccountingType) => void;
  category: AccountingCategory;
  onCategoryChange: (value: AccountingCategory) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  animalId: string;
  onAnimalIdChange: (value: string) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  animals: AnimalOption[];
}) {
  const categoryOptions = ACCOUNTING_CATEGORIES_BY_TYPE[type];

  function handleTypeChange(value: AccountingType) {
    onTypeChange(value);
    if (!ACCOUNTING_CATEGORIES_BY_TYPE[value].includes(category)) {
      onCategoryChange(ACCOUNTING_CATEGORIES_BY_TYPE[value][0]!);
    }
  }

  return (
    <>
      <Field label="Date" htmlFor={`${idPrefix}-date`}>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          required
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </Field>

      <FieldRow>
        <Field label="Type" htmlFor={`${idPrefix}-type`} className="flex-1">
          <Select
            id={`${idPrefix}-type`}
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as AccountingType)}
          >
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Catégorie" htmlFor={`${idPrefix}-category`} className="flex-1">
          <Select
            id={`${idPrefix}-category`}
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as AccountingCategory)}
          >
            {categoryOptions.map((value) => (
              <option key={value} value={value}>
                {ACCOUNTING_CATEGORY_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
      </FieldRow>

      <Field label="Montant (€)" htmlFor={`${idPrefix}-amount`}>
        <Input
          id={`${idPrefix}-amount`}
          type="number"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
        />
      </Field>

      <Field label="Animal lié (optionnel)" htmlFor={`${idPrefix}-animal`}>
        <SearchableSelect
          id={`${idPrefix}-animal`}
          value={animalId}
          onChange={onAnimalIdChange}
          options={animals.map((animal) => ({ value: animal.id, label: animal.name }))}
          placeholder="— Aucun —"
        />
      </Field>

      <Field label="Commentaire" htmlFor={`${idPrefix}-comment`}>
        <Input id={`${idPrefix}-comment`} value={comment} onChange={(e) => onCommentChange(e.target.value)} />
      </Field>
    </>
  );
}
