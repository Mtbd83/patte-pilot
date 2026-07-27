import { Suspense } from "react";
import { PawPrint } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ConnexionForm } from "./connexion-form";

export default function ConnexionPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <PawPrint className="size-8 text-primary" />
          <h1 className="text-xl font-semibold">Anim Admin</h1>
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
