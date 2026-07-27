import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface FieldProps extends React.ComponentProps<"div"> {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  required?: boolean;
}

/**
 * Stacked label + control, the base unit for every form in the app. The
 * required-star is rendered as a sibling of the <label>, not inside it —
 * putting it inside would fold its text into the label's accessible name
 * (breaking exact-match lookups like Playwright's getByLabel, even with
 * aria-hidden) instead of just being a silent visual cue.
 */
function Field({ label, htmlFor, hint, required, className, children, ...props }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Responsive row: fields stack on mobile, sit side by side from `sm` up. */
function FieldRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-4 sm:flex-row", className)} {...props} />;
}

export { Field, FieldRow };
