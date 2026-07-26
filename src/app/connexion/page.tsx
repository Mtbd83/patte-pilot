import { Suspense } from "react";
import { ConnexionForm } from "./connexion-form";

export default function ConnexionPage() {
  return (
    <main style={{ maxWidth: 400, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Connexion</h1>
      <Suspense>
        <ConnexionForm />
      </Suspense>
    </main>
  );
}
