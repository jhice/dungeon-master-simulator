# 058 — Plan : textes du jeu et de l'interface en anglais, français et allemand

Plan seulement : aucun code du jeu n'a changé à cette étape. **Réalisé dans la doc 059**, qui tranche les questions du § 6.

## 1. Demande

- Textes du jeu et de l'interface en anglais, français et allemand, comme DM Amiga 3.6.
- Choix de la langue par une liste, à côté du bouton des raccourcis clavier. Anglais par défaut.
- Dictionnaire simple, fondé sur les données du jeu, avec une séparation entre jeu et interface.

## 2. Ce que les sources fournissent

Tout vient de greatstone, DM Amiga 3.6 version CAPS (liens dans la doc 000).

### Textes du moteur (graphics.dat)

| Contenu | Anglais | Français | Allemand | Remarques |
|---|---|---|---|---|
| Noms d'objets | 0694 | 0735 | 0745 | 199 lignes, une par icône : une épée a une ligne, une boussole en a 4 |
| Noms d'actions | 0699 | 0736 | 0746 | 44 lignes, dans l'ordre des actions de `action-info.js` |
| Textes divers | 0700 | 0737 | 0747 | Voir ci-dessous |

Les textes divers contiennent :

- classes et niveaux de compétence ;
- directions ;
- états (`(VIDE)`, `EMPOISONNE`, `MAUDIT`) ;
- caractéristiques ;
- messages (`MARMONNE UNE CONJURATION…`, `TROP LOIN`, `SANS MUNITION`, pile ou face) ;
- **noms des créatures**.

Trois limites :

- **Pas d'accents ni de minuscules :** `EPEE`, `KNUPPEL`, `KAEMPFER`.
- **Noms de créatures :** ils tiennent parfois sur deux lignes (`CHEVALIER` / `DE LA MORT`, `STEINERNER` / `GOLEM`), et le nombre de lignes change selon la langue. Leur correspondance se fait donc à la main, une fois pour toutes.
- **Coquilles d'origine :** `IMCOMPREHENSIBLE`, `BEAUX JUPE`, `TRANQUILISER`.

### Textes du donjon (dungeon.dat, dungeonf.dat, dungeong.dat)

Les fichiers `.dat` ne sont pas téléchargeables sur greatstone. Les 14 cartes HTML de chaque langue (`map_1.html` à `map_14.html`, `map_n` = niveau n−1) donnent les textes dans leurs infobulles.

**Vérification faite** par position, avec un script, contre `data/dungeon.json` :

- 91 textes de cases sur 91 retrouvés en anglais ;
- 34 parchemins placés retrouvés ; le 35e n'a pas de position dans les données ;
- mêmes nombres de textes en français et en allemand, case par case.

Le texte des infobulles est **dégradé** :

- plus de retours à la ligne ;
- casse changée (réversible : tout est en majuscules à l'origine) ;
- espace perdue après les mots spéciaux (`thetrue`), et sans doute ailleurs : `Anouveau` est peut-être `A` / `NOUVEAU` sur deux lignes. Impossible de trancher sans le fichier d'origine.

L'absence d'apostrophes (`navez`) n'est pas une dégradation : l'alphabet du format n'en a pas. Le `2` de `lai2je` reste à comprendre.

### Ce qui n'existe pas dans DM

Noms des sorts, décors et tout ce que le projet a ajouté : messages de combat détaillés, panneau, raccourcis, légende. Ces textes seront **traduits par Claude Code**. L'allemand n'aura pas été relu par un germanophone.

## 3. Proposition : deux dictionnaires, deux appels

Les deux sortes de textes n'ont ni la même origine ni la même clé, d'où deux fichiers et deux fonctions.

| | Interface | Jeu |
|---|---|---|
| Origine | Écrit à la main | **Généré** depuis les sources, jamais modifié à la main |
| Fichiers | `src/i18n/ui-en.js`, `ui-fr.js`, `ui-de.js` | `data/i18n/en.json`, `fr.json`, `de.json` |
| Clé | Nom (`panel.defaults`) | Identifiant du jeu (type d'objet, index de texte) |
| Appel | `t('panel.defaults')`, `t('combat.hit', { name, damage })` | `game.item('weapon', 8)`, `game.action(2)`, `game.creature(16)`, `game.text(35)`, `game.misc('tooFar')` |

Si une clé manque dans une langue, on affiche l'anglais ; si elle manque aussi en anglais, la clé elle-même. Le module `src/i18n/` ne touche pas au DOM, donc les tests Node l'utilisent aussi.

### Noms anglais internes : ils restent des identifiants

Le code compare aujourd'hui des noms affichés : `action.name === 'Throw'`, `name === 'Full Torch Holder'`, `ALCOVES` dans `ornaments.js`, `creatureTypes` dans `main.js`, `item-ids.js`. Ces noms ne se traduisent pas : ils restent tels quels comme identifiants, et seul l'affichage passe par le dictionnaire. `dungeon.json` ne change pas.

## 4. Étapes (un commit par étape)

Un comptage grossier trouve 795 chaînes candidates, dont beaucoup sont des noms anglais de tables ou des clés. L'estimation de 300 à 400 textes réels reste à confirmer à l'étape 3.

1. **Socle.**
   - `src/i18n/` : langue courante, `t()`, `game.*`, abonnement au changement.
   - Liste construite à partir des langues disponibles, dans la barre du haut.
   - Préférence dans `preferences.js`, épargnée par « Valeurs par défaut » ; attribut `lang` de la page.
2. **Générateur `tools/build-i18n.mjs`.**
   - Il lit les 9 fichiers texte et les 42 cartes, gardés en entrée dans un dossier dédié, et écrit `data/i18n/`.
   - Objets : on cherche chaque nom du catalogue dans la liste anglaise, et on prend la même ligne en français et en allemand. Les écarts sont listés et traités à la main.
   - Textes : par position, avec contrôle de l'anglais contre `dungeon.json` ; le script s'arrête si une case ne correspond pas.
   - Fiches de champions : seuls le nom et le titre sont traduits ; les caractéristiques restent celles de `dungeon.json`.
3. **Tables de `src/core/`.**
   - `contents.js`, `item-info.js`, `action-info.js` (colonne `label` retirée), `texts.js`, `logic.js`, `tile-states.js`, `spell-info.js`, `creature-info.js`.
   - La simulation garde ses événements structurés ; elle n'a presque pas de texte.
4. **Interface.** `main.js` (la plus grosse part, dont `say()`), `shortcuts-modal.js`, `control-panel.js`, `legend.js`, panneaux, renderers.
5. **Textes du donjon en jeu.** Inscriptions de la vue, messages, parchemins, grimoire, panneau des textes.
   - **Retours à la ligne :** recalculés à la largeur de la langue, sauf si les fichiers d'origine sont fournis (Q1).
   - Le grimoire reconnaît les sorts dans le texte : à vérifier en français et en allemand.
6. **Changement de langue à chaud.** Reconstruire panneau, légende, modale et vue. Les messages déjà affichés restent dans leur langue.
7. **Contrôles.**
   - `tools/test-i18n.mjs` : mêmes clés et mêmes paramètres dans les trois langues, plus aucun texte français en dur.
   - Mise à jour des tests existants (61 lignes y contiennent des accents français).
   - Essai dans Chrome dans les trois langues.

## 5. Risques

- **Changement à chaud :** les tables de textes évaluées au chargement doivent passer à un appel au moment de l'affichage. C'est le plus gros du travail mécanique.
- **Longueurs :** l'allemand est plus long ; panneau d'actions, cadre de Zed et menus sont à vérifier.
- **Anglais par défaut :** l'interface, aujourd'hui en français, passera en anglais à la première ouverture.

## 6. Questions à trancher

- **Q1. Textes du donjon :** peux-tu fournir `DUNGEONF.DAT` et `DUNGEONG.DAT` (ou leurs XML, comme `Dungeon.xml`) ? On aurait les textes exacts. Sinon, on part des infobulles, avec retours à la ligne recalculés et quelques mots peut-être collés.
- **Q2. Aspect des textes du jeu :** tels quels (`EPEE`) ou réécrits (`Épée`) ?
  - Recommandation : **tels quels**, fidèles à DM, et sans correction à la main de 200 noms par langue.
  - Conséquence : l'anglais passerait aussi en majuscules (`TORCH` et non `Torch`) pour rester cohérent.
- **Q3. Messages du jeu :** reprendre ceux de DM quand ils existent (`MUMBLES A MEANINGLESS SPELL` au lieu de « a prononcé un sort incompréhensible », formulation de la doc 012) ?
  - Recommandation : **oui**.
- **Q4. Changement de langue :** à chaud ou par rechargement de la page ?
  - Recommandation : **à chaud**, car un rechargement perdrait la partie en cours tant qu'il n'y a pas de sauvegarde (phase F).
