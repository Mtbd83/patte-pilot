"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

/**
 * Text-filterable alternative to a native <select> — for lists long enough
 * that scrolling through every option (or relying on the browser's
 * first-letter jump) stops being practical. Renders the same way as a
 * plain input; opens a filtered dropdown of options on focus.
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "— Sélectionner —",
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = query.trim()
    ? options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function select(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 md:text-sm"
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md">
          <li>
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => select("")}
            >
              {placeholder}
            </button>
          </li>
          {filtered.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => select(option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-1.5 text-sm text-muted-foreground">Aucun résultat.</li>
          )}
        </ul>
      )}
    </div>
  );
}
