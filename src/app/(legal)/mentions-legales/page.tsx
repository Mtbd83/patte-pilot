import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales — PattePilot" };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pattepilot.vercel.app";

export default function MentionsLegalesPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Mentions légales</h1>

      <section>
        <h2>Éditrice du site</h2>
        <p>
          Le site et l&apos;application PattePilot, accessibles à l&apos;adresse {APP_URL}, sont édités par :
        </p>
        <ul>
          <li>Maud TRIBAUDEAU, entrepreneure individuelle</li>
          <li>SIRET : 922 793 948 00022</li>
          <li>Siège social : 2 Impasse des Iris, 83136 Gareoult, France</li>
          <li>Contact : m.tribaudeau@gmail.com</li>
        </ul>
        <p>Directrice de la publication : Maud Tribaudeau.</p>
      </section>

      <section>
        <h2>Hébergement</h2>
        <p>
          L&apos;application (code et exécution) est hébergée par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA
          91789, États-Unis.
        </p>
        <p>
          La base de données et les fichiers déposés dans l&apos;application (photos, documents générés...)
          sont hébergés par Supabase Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapour 049513 — la
          base de données est physiquement localisée en France (région AWS Europe de l&apos;Ouest, Paris).
        </p>
      </section>

      <section>
        <h2>Nature du service</h2>
        <p>
          PattePilot est un outil de gestion à destination des associations de protection animale
          (familles d&apos;accueil, animaux, candidatures d&apos;adoption, stock, comptabilité). Chaque
          association qui utilise PattePilot est seule responsable des données qu&apos;elle y saisit
          concernant ses propres membres, bénévoles, familles d&apos;accueil et candidat·e·s à
          l&apos;adoption — voir la{" "}
          <a href="/confidentialite" className="text-primary underline-offset-4 hover:underline">
            politique de confidentialité
          </a>{" "}
          pour le détail de cette répartition des responsabilités.
        </p>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          La structure du site, son design et son code sont la propriété de Maud Tribaudeau, sauf mention
          contraire. Toute reproduction non autorisée est interdite. Les contenus saisis par chaque
          association (fiches animaux, documents, données de ses membres...) restent la propriété de cette
          association.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Pour toute question relative au site ou à son fonctionnement : m.tribaudeau@gmail.com.
        </p>
      </section>
    </>
  );
}
