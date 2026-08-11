import type { Metadata } from "next";

export const metadata: Metadata = { title: "Politique de confidentialité — PattePilot" };

export default function ConfidentialitePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Politique de confidentialité</h1>
      <p className="text-sm text-muted-foreground">Dernière mise à jour : août 2026.</p>

      <section>
        <h2>1. Qui traite vos données ?</h2>
        <p>
          PattePilot est édité par Maud Tribaudeau (entrepreneure individuelle, SIRET 922 793 948 00022,
          voir les{" "}
          <a href="/mentions-legales" className="text-primary underline-offset-4 hover:underline">
            mentions légales
          </a>
          ). Selon la donnée concernée, deux cas se distinguent :
        </p>
        <ul>
          <li>
            <strong>Pour les comptes de la plateforme</strong> (email, mot de passe, rôle, demandes
            d&apos;inscription d&apos;association) : Maud Tribaudeau est responsable de traitement.
          </li>
          <li>
            <strong>Pour les données qu&apos;une association saisit dans l&apos;outil</strong> (candidatures
            d&apos;adoption, familles d&apos;accueil, comptabilité...) : l&apos;association concernée est
            responsable de traitement, et PattePilot agit en tant que sous-traitant au sens du RGPD — elle
            héberge et fait fonctionner l&apos;outil, sans utiliser ces données pour son propre compte.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Données collectées</h2>
        <p>En tant que responsable de traitement, PattePilot collecte :</p>
        <ul>
          <li>Lors de la création d&apos;un compte : adresse email, mot de passe (stocké de façon chiffrée/hachée, jamais en clair), rôle(s) et association(s) rattachée(s).</li>
          <li>Lors d&apos;une demande d&apos;inscription d&apos;association (page « Rejoindre ») : nom de l&apos;association, nom du contact, email, téléphone, SIREN et adresse.</li>
          <li>Si l&apos;utilisateur·rice active les notifications : les informations techniques nécessaires à l&apos;envoi de notifications push (identifiant technique de l&apos;abonnement et clés de chiffrement liées à l&apos;appareil/navigateur — jamais le contenu d&apos;autres données personnelles).</li>
        </ul>
        <p>
          Pour le compte d&apos;une association (en tant que sous-traitant), PattePilot héberge notamment :
          les candidatures d&apos;adoption (identité, coordonnées, situation de logement et familiale des
          candidat·e·s), les coordonnées des familles d&apos;accueil et des membres de l&apos;association,
          les fiches des animaux pris en charge, les écritures comptables et les documents générés
          (contrats d&apos;adoption, certificats).
        </p>
      </section>

      <section>
        <h2>3. Finalités</h2>
        <ul>
          <li>Permettre la création et la gestion des comptes utilisateur·rice·s et l&apos;authentification.</li>
          <li>Instruire les demandes d&apos;inscription d&apos;association à la plateforme.</li>
          <li>Envoyer des notifications liées à l&apos;activité de l&apos;association (nouvelle candidature, rappel vaccinal à venir...) lorsque l&apos;utilisateur·rice les a activées.</li>
          <li>Assurer le fonctionnement, la sécurité et l&apos;amélioration du service.</li>
        </ul>
      </section>

      <section>
        <h2>4. Base légale</h2>
        <p>
          Le traitement des données de compte repose sur l&apos;exécution des{" "}
          <a href="/cgu" className="text-primary underline-offset-4 hover:underline">
            CGU
          </a>{" "}
          acceptées lors de l&apos;utilisation du service, ainsi que sur l&apos;intérêt légitime de
          l&apos;éditrice à assurer la sécurité et le bon fonctionnement de la plateforme. Les notifications
          push reposent sur le consentement explicite de l&apos;utilisateur·rice, révocable à tout moment.
        </p>
      </section>

      <section>
        <h2>5. Destinataires et sous-traitants</h2>
        <p>Les données sont hébergées et traitées par les prestataires suivants :</p>
        <ul>
          <li><strong>Vercel Inc.</strong> (États-Unis) — hébergement et exécution de l&apos;application.</li>
          <li><strong>Supabase Inc.</strong> — base de données et fichiers déposés (photos, documents) ; la base de données est physiquement hébergée en France (région Paris).</li>
          <li>
            <strong>Fournisseur de messagerie (Gmail/Google)</strong> — envoi des tout premiers emails de la
            plateforme (ex. invitation suite à validation d&apos;une demande d&apos;inscription). Chaque
            association configure ensuite, si elle le souhaite, sa propre adresse d&apos;envoi pour ses
            propres emails, sous sa propre responsabilité.
          </li>
          <li><strong>Apple, Google et/ou Mozilla</strong>, selon l&apos;appareil ou le navigateur utilisé — relais technique des notifications push, sans accès au contenu au-delà du message notifié.</li>
        </ul>
        <p>
          Ces prestataires peuvent être situés hors de l&apos;Union européenne (États-Unis, Singapour) ; ils
          s&apos;engagent contractuellement à respecter des garanties appropriées pour ces transferts
          (clauses contractuelles types de la Commission européenne). Aucune donnée n&apos;est vendue à des
          tiers ni utilisée à des fins publicitaires.
        </p>
      </section>

      <section>
        <h2>6. Durée de conservation</h2>
        <p>
          Les données de compte sont conservées tant que le compte est actif, et supprimées sur demande ou
          après une période d&apos;inactivité prolongée. Les données saisies par une association pour son
          propre compte (candidatures, familles d&apos;accueil...) sont conservées selon la durée définie
          par cette association, dans le respect de ses propres obligations légales.
        </p>
      </section>

      <section>
        <h2>7. Cookies</h2>
        <p>
          PattePilot utilise uniquement un cookie strictement nécessaire au fonctionnement du service : le
          cookie de session qui vous maintient connecté·e après authentification. Aucun cookie publicitaire
          ou de mesure d&apos;audience n&apos;est déposé, et ce cookie ne nécessite donc pas de recueil de
          consentement préalable.
        </p>
      </section>

      <section>
        <h2>8. Sécurité</h2>
        <p>
          Les mots de passe sont stockés sous forme hachée, jamais en clair. Les échanges avec le site sont
          chiffrés (HTTPS). L&apos;accès aux données d&apos;une association est cloisonné : un compte
          n&apos;a accès qu&apos;aux organisations dont il est membre.
        </p>
      </section>

      <section>
        <h2>9. Vos droits</h2>
        <p>
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement,
          de limitation, de portabilité et d&apos;opposition sur vos données.
        </p>
        <ul>
          <li>Pour vos données de compte sur la plateforme (email, mot de passe, notifications) : écrivez à m.tribaudeau@gmail.com.</li>
          <li>
            Pour des données saisies par une association (candidature d&apos;adoption, fiche famille
            d&apos;accueil...), adressez votre demande directement à cette association, responsable de
            traitement de ces données ; nous pouvons vous aider à l&apos;identifier si besoin.
          </li>
        </ul>
        <p>
          Vous pouvez également introduire une réclamation auprès de la Commission Nationale de
          l&apos;Informatique et des Libertés (CNIL) — cnil.fr.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>Pour toute question relative à cette politique de confidentialité : m.tribaudeau@gmail.com.</p>
      </section>
    </>
  );
}
