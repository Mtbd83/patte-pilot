import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface FieldProps extends React.ComponentProps<"div"> {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
}

/** Stacked label + control, the base unit for every form in the app. */
function Field({ label, htmlFor, hint, className, children, ...props }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      <Label htmlFor={htmlFor}>{label}</Label>
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
