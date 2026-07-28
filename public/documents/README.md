# Documents statiques

`certificat-engagement.pdf` et `certificat-engagement-chien.pdf` ne sont
**plus lus directement par l'application**. Chaque association uploade
désormais son propre certificat (Paramètres → « Certificat d'engagement »),
stocké dans Supabase Storage — voir `certificateFileUrl`/
`certificateFileUrlChien` sur `organizations` et `sendEngagementCertificate`
(`src/server/actions/documents.ts`), qui télécharge le fichier depuis cette
URL au lieu du système de fichiers.

Ces deux PDF restent dans le repo comme **fixtures de test**
(`tests/integration/documents.test.ts` les lit directement pour simuler le
téléchargement depuis Supabase Storage, sans dépendre du réseau).

`contrat-adoption-template.pdf` reste lui un fichier statique unique, partagé
par toutes les associations — le rendre personnalisable par association
demande un outil de mappage de positions plus conséquent, pas encore fait.
