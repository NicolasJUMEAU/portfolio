# Swiply – démo statique

Version de démonstration de Swiply (application Laravel/MySQL) qui tourne sans serveur, pour le portfolio.

- `data/*.json` : les tables de la base, exportées depuis les seeders Laravel (`outils/export-seeders.php`).
- `js/db.js` : remplace Eloquent. Lit les JSON et simule les écritures (swipes, wishlist, candidatures, notes) dans le `localStorage` du visiteur.
- `js/layout.js` : barre de navigation, pied de page et composants communs (équivalent des layouts Blade).
- `css/app.css` : feuille de style d'origine. `css/tailwind.css` : classes Tailwind compilées (remplace le CDN).

Le visiteur est connecté d'office au compte « Test Etudiant ». « Réinitialiser la démo » efface ses actions.
