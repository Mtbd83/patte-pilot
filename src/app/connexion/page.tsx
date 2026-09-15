import { Suspense } from "react";
import { connection } from "next/server";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ConnexionForm } from "./connexion-form";

// Forces dynamic rendering — required for the CSP nonce (see src/proxy.ts)
// to actually reach this page's scripts: a statically-prerendered page has
// no per-request nonce to embed, so the browser blocks every script tag.
export default async function ConnexionPage() {
  await connection();
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <Image
        src="/images/closeup-shot-cute-dog-laying-with-cat-isolated-white.jpg"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-background/85" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pattepilot-logo.svg" alt="PattePilot" className="h-40 w-auto" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
            <CardDescription>Accédez à l&apos;espace de gestion de votre association.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense>
              <ConnexionForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
