import { Loader2 } from "lucide-react";

// Shown instantly on navigation to any page under this layout — the
// sidebar stays interactive, only the content area shows this — while its
// data loads. Without this, a slow page load looked identical to a tap
// that didn't register, inviting repeated taps.
export default function Loading() {
  return (
    <div role="status" aria-label="Chargement" className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
