import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conditions Générales d'Utilisation — PattePilot" };

export default function CguPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Conditions Générales d&apos;Utilisation</h1>
      <p className="text-sm text-muted-foreground">Dernière mise à jour : août 2026.</p>

      <section>
        <h2>1. Objet</h2>
        <p>
          PattePilot est un outil de gestion en ligne destiné aux associations de protection animale,
          permettant notamment de suivre les animaux pris en charge, les familles d&apos;accueil, les
          candidatures d&apos;adoption, le stock et la comptabilité de l&apos;association. Les présentes
          conditions générales d&apos;utilisation (« CGU ») régissent l&apos;accès et l&apos;utilisation de
          PattePilot par toute association et tout·e utilisateur·rice de la plateforme.
        </p>
      </section>

      <section>
        <h2>2. Accès au service</h2>
        <p>
          Une association rejoint PattePilot en déposant une demande (page « Rejoindre »), validée par
          l&apos;éditrice de la plateforme, ou en étant créée directement par celle-ci. La personne de
          contact de l&apos;association reçoit alors une invitation par email pour créer son compte et
          devient la première administratrice de l&apos;association sur la plateforme.
        </p>
        <p>
          Chaque compte utilisateur·rice est ensuite créé par invitation d&apos;un·e administrateur·rice de
          l&apos;association, avec un rôle (administrateur·rice, bénévole ou famille d&apos;accueil)
          déterminant les fonctionnalités accessibles. Un même compte (une même adresse email) peut être
          membre de plusieurs associations.
        </p>
        <p>
          Le formulaire public de candidature à l&apos;adoption, lui, ne nécessite aucune création de
          compte : il est rempli directement par la personne candidate à l&apos;adoption.
        </p>
      </section>

      <section>
        <h2>3. Engagements de l&apos;utilisateur·rice</h2>
        <ul>
          <li>Fournir des informations exactes lors de la création de son compte et de son utilisation du service.</li>
          <li>Garder ses identifiants de connexion confidentiels et signaler toute utilisation non autorisée de son compte.</li>
          <li>Utiliser PattePilot dans le cadre de l&apos;activité de l&apos;association, conformément à la loi et aux droits des tiers (notamment des personnes dont les données sont saisies dans l&apos;outil).</li>
          <li>Ne pas tenter de contourner les mesures de sécurité du service ni d&apos;accéder à des données d&apos;une autre association.</li>
        </ul>
      </section>

      <section>
        <h2>4. Données saisies par les associations</h2>
        <p>
          Chaque association demeure seule propriétaire et responsable des données qu&apos;elle saisit dans
          PattePilot concernant ses animaux, ses membres, ses familles d&apos;accueil et les candidat·e·s à
          l&apos;adoption. Il lui appartient de s&apos;assurer que la collecte et le traitement de ces
          données respectent la réglementation applicable, notamment le RGPD, vis-à-vis des personnes
          concernées. L&apos;éditrice de PattePilot agit, pour ces données, en tant que sous-traitant au
          sens du RGPD — voir la{" "}
          <a href="/confidentialite" className="text-primary underline-offset-4 hover:underline">
            politique de confidentialité
          </a>
          .
        </p>
      </section>

      <section>
        <h2>5. Disponibilité et évolution du service</h2>
        <p>
          PattePilot est actuellement proposé gratuitement. L&apos;éditrice s&apos;efforce d&apos;assurer un
          accès continu au service, sans toutefois garantir une disponibilité ininterrompue : des
          interruptions peuvent survenir, notamment pour maintenance ou en raison de facteurs indépendants
          de sa volonté (hébergeurs, réseau...). Les fonctionnalités du service peuvent évoluer dans le
          temps.
        </p>
      </section>

      <section>
        <h2>6. Résiliation</h2>
        <p>
          Une association peut cesser d&apos;utiliser PattePilot à tout moment et demander la suppression de
          son compte et de ses données en écrivant à m.tribaudeau@gmail.com. Un·e utilisateur·rice peut de
          la même façon demander la suppression de son compte personnel.
        </p>
      </section>

      <section>
        <h2>7. Responsabilité</h2>
        <p>
          PattePilot est fourni « en l&apos;état ». L&apos;éditrice met en œuvre des moyens raisonnables pour
          assurer la sécurité et la fiabilité du service, sans pouvoir garantir l&apos;absence totale
          d&apos;erreur, de bug ou de perte de données. Elle ne saurait être tenue responsable d&apos;un
          usage du service contraire aux présentes CGU, ni des données saisies par les associations
          elles-mêmes.
        </p>
      </section>

      <section>
        <h2>8. Modification des CGU</h2>
        <p>
          Les présentes CGU peuvent être modifiées à tout moment. La date de dernière mise à jour figure en
          haut de cette page. Les utilisateur·rice·s seront informé·e·s de toute modification substantielle.
        </p>
      </section>

      <section>
        <h2>9. Droit applicable</h2>
        <p>
          Les présentes CGU sont soumises au droit français. Tout litige relatif à leur interprétation ou
          leur exécution relève des tribunaux français compétents.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>Pour toute question relative aux présentes CGU : m.tribaudeau@gmail.com.</p>
      </section>
    </>
  );
}
