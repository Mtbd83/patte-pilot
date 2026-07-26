# Documents statiques

`certificat-engagement.pdf` est envoyé **tel quel** (sans remplissage) par le
bouton "Envoyer le certificat d'engagement" — voir
`src/server/actions/documents.ts` (`sendEngagementCertificate`).

Le fichier actuellement présent est un **placeholder** généré pour permettre
aux tests (unitaires/intégration/e2e) de s'exécuter sans dépendre d'un vrai
document. **Remplacez-le par le vrai PDF du certificat d'engagement de votre
association avant toute utilisation réelle** — sinon les adoptants recevront
ce placeholder au lieu du vrai document.
