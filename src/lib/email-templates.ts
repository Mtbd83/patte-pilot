/**
 * Minimal templating for the two adoption emails (certificate, contract):
 * `{{token}}` substitution plus `{{#flag}}...{{/flag}}` conditional blocks
 * for the passages that only apply sometimes (sterilization deposit,
 * vaccine booster reminder). Organizations can edit the subject/body text
 * themselves from Paramètres — these constants are only the fallback used
 * until they've saved their own.
 */
export function renderEmailTemplate(
  template: string,
  vars: Record<string, string>,
  flags: Record<string, boolean> = {},
): string {
  const withBlocks = template.replace(
    /{{#(\w+)}}([\s\S]*?){{\/\1}}/g,
    (_match, key: string, inner: string) => (flags[key] ? inner : ""),
  );
  return withBlocks.replace(/{{(\w+)}}/g, (_match, key: string) => vars[key] ?? "");
}

/** `white-space: pre-wrap` preserves the line breaks/paragraphs of the plain-text template as-is, with no per-line markup needed. */
export function textToHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="white-space: pre-wrap; font-family: sans-serif;">${escaped}</div>`;
}

export const DEFAULT_CERTIFICATE_EMAIL_SUBJECT = "Certificat d'engagement — {{animal}}";

export const DEFAULT_CERTIFICATE_EMAIL_BODY = `Bonjour {{prenom}},

Merci pour votre intérêt pour {{animal}} ! Nous sommes très content·e·s de cette rencontre !

Merci de nous renvoyer le certificat d'engagement et de connaissance en pièce jointe rempli et daté du {{date_jour}}.
Pour signer le document, n'hésitez pas à utiliser l'outil gratuit : https://www.ilovepdf.com/fr/signer-pdf (vous pouvez tout faire en numérique même la partie "manuscrite")

Il y a 7 jours de délai avant l'adoption. Ce certificat ne vous engage en rien malgré son nom. C'est un délai de réflexion qui nous permet de nous assurer que c'est une décision réfléchie :-).

Vous pouvez donc adopter {{animal}} à partir du {{date_limite}}. Rendez-vous à planifier avec la famille d'accueil :-)

Bien à vous
{{expediteur}}`;

export const DEFAULT_CONTRACT_EMAIL_SUBJECT = "Contrat d'adoption — {{animal}}";

export const DEFAULT_CONTRACT_EMAIL_BODY = `Bonjour {{prenom}},

L'adoption de {{animal}} arrive !

Nous avons besoin pour le jour du rdv au plus tard (par mail ou imprimé) :
- Du contrat d'adoption en remplissant votre adresse, le moyen de paiement et la signature
- Un justificatif de domicile de moins de 3 mois
- Une copie d'une pièce d'identité
Cela est nécessaire pour mettre {{animal}} à votre nom en temps voulu. Nous ferons le changement de prénom au changement de propriétaire.
{{#caution_sterilisation}}- Un chèque de caution de 150€ pour la stérilisation. Il ne sera pas encaissé. Seulement si vous ne faites pas la stérilisation vers les 6-7 mois.
{{/caution_sterilisation}}- De quoi sécuriser {{animal}} pendant le transport.

Les frais d'adoption sont de {{montant}}.

Vous pouvez régler :
- Par carte bancaire (à privilégier) : {{helloasso_lien}} (pensez à modifier les frais de fonctionnement HelloAsso à 0€)
- Par virement via le RIB suivant : {{iban}}
- Par chèque (à l'ordre de {{tresoriere}} - ayant une banque en ligne, nous l'encaissons et reversons les frais avec preuve de virement sur le compte de l'association),
{{#rappel_vaccin}}
N'oubliez pas le rappel de vaccin dans un mois ({{date_rappel_vaccin}}).{{/rappel_vaccin}}{{#caution_sterilisation}} La stérilisation doit se faire avant son 7ème mois.{{/caution_sterilisation}}

Merci ! {{animal}} vous attend !

Si vous avez la moindre question, n'hésitez pas.

Bien cordialement
{{expediteur}}`;
