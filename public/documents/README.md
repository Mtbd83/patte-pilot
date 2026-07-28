# Documents statiques

`certificat-engagement.pdf` et `certificat-engagement-chien.pdf` sont envoyés
**tels quels** (sans remplissage) par le bouton "Envoyer le certificat
d'engagement" — voir `src/server/actions/documents.ts`
(`sendEngagementCertificate`). Le fichier choisi dépend de l'espèce de
l'animal : `certificat-engagement-chien.pdf` pour un chien,
`certificat-engagement.pdf` pour les autres espèces (chat, lapin, autre).

Le fichier `certificat-engagement.pdf` initialement présent était un
**placeholder** généré pour permettre aux tests (unitaires/intégration/e2e)
de s'exécuter sans dépendre d'un vrai document — remplacez tout fichier
placeholder restant par le vrai PDF de votre association avant toute
utilisation réelle, sinon les adoptants recevront ce placeholder au lieu du
vrai document.
