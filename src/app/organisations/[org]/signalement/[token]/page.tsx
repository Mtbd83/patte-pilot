import { notFound } from "next/navigation";
import { getPublicReportingMap } from "@/server/actions/sterilization-reports";
import { PublicReportingMapView } from "./public-reporting-map-view";

/** Fully public page — no authentication required to report a stray cat or comment on one. */
export default async function SignalementPage(
  props: {
    params: Promise<{ org: string; token: string }>;
  }
) {
  const params = await props.params;

  let map;
  try {
    map = await getPublicReportingMap({ token: params.token });
  } catch {
    notFound();
  }

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pattepilot-logo.svg" alt="" className="mx-auto h-16 w-auto" />
          <h1 className="mt-2 text-2xl font-semibold">Signalement de chats errants — {map.city}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Carte de {map.organizationName}. Cliquez sur la carte à l&apos;endroit où vous avez vu le chat pour le
            signaler, ou cliquez sur un marqueur existant pour voir les détails et commenter. La zone en bleu
            indique où un signalement peut être placé, à {map.city}.
          </p>
        </div>
        <PublicReportingMapView
          mapToken={params.token}
          reports={map.reports}
          city={map.city}
          boundary={map.boundary}
        />
      </main>
    </div>
  );
}
