# 059 — Textes du jeu et de l'interface en anglais, français et allemand

Réalisation du plan de la doc 058, avec les réponses de l'utilisateur :

- Q1 : les donjons français et allemand ont été exportés avec le même outil que `Dungeon.xml` ;
- Q2 : textes du jeu tels quels, en majuscules et sans accents ;
- Q3 : messages de DM repris quand ils existent ;
- Q4 : changement de langue par **rechargement de la page**, après confirmation.

## 1. Données

- `data/Dungeon.xml` (déplacé de la racine), `data/DungeonF.DAT.xml`, `data/DungeonG.DAT.xml` : les trois donjons.
- `data/engine-texts/` : les 9 fichiers texte de graphics.dat (objets, actions, textes divers).
- `npm run build:i18n` (`tools/build-i18n.mjs`) génère `src/i18n/game-en.js`, `game-fr.js`, `game-de.js`.

**Comparaison des trois donjons :** hors textes, les seuls écarts sont les noms absents de l'export (`?`, tirés des commentaires du dump) et le champ `important` de 4 armes. `dungeon.json` reste donc construit depuis l'anglais, et le français et l'allemand ne fournissent que `texts[]`, au même index. Le générateur s'arrête si les textes changent de place, si une fiche de champion change de valeurs ou si les cartes diffèrent.

## 2. Deux dictionnaires

| | Interface | Jeu |
|---|---|---|
| Fichiers | `src/i18n/ui-en.js`, `ui-fr.js`, `ui-de.js`, écrits à la main | `src/i18n/game-*.js`, générés |
| Appel | `t('combat.hit', { name, damage })` | `gameText.item('Torch')`, `.action(2)`, `.creature(16)`, `.misc('tooFar')`, `.text(35)` |
| Clé | Nom | Identifiant du jeu |

Tout passe par `src/i18n/i18n.js`, sans DOM. Une clé absente donne l'anglais, puis la clé elle-même. Une entrée `{ one, other }` est choisie selon `count` (0 est au singulier en français seulement).

**Écarts avec le plan :**

- les dictionnaires du jeu sont des modules JS, pas du JSON : ils se chargent de la même façon dans le navigateur et dans Node, sans `fetch` ;
- `gameText` remplace `game`, déjà pris dans `main.js` ;
- la langue a sa propre clé `dm-viewer:language`, hors des préférences : « Valeurs par défaut » n'y touche pas.

**Noms anglais :** ils restent les identifiants du code (`entry.name`, `action.name`, `spell.name`). Seul l'affichage est traduit. Les objets se retrouvent par leur nom anglais en majuscules, ce qui marche aussi pour les potions créées par un sort. La colonne `label` des actions a disparu.

**Textes du donjon :** `loadDungeon()` remplace `data.texts[i].text` au chargement ; inscriptions, messages, parchemins et fiches de champions suivent sans autre changement.

## 3. Changement de langue

`src/ui/language-select.js` construit la liste à partir de `LANGUAGES`, à droite du bouton des raccourcis. Un refus de la confirmation remet la langue courante. Comme la page recharge, la langue est fixée avant l'évaluation des modules : les tables de libellés appellent `t()` directement.

## 4. Mots de sort français

Les parchemins français écrivent 4 symboles autrement : `VIM` (Vi), `YAP` (Ya), `DOS` (Des), `EV` (Ew). Sans correction, 12 parchemins n'apprenaient plus leurs sorts, ou seulement une partie. `spellsInText()` les reconnaît, et `symbolLabel()` les affiche en français. L'allemand garde les mots anglais.

Avec cette correction, chaque parchemin apprend les mêmes sorts dans les trois langues (vérifié par `tools/test-i18n.mjs`).

## 5. Limites

- **Coquilles d'origine conservées :** `IMCOMPREHENSIBLE`, `BEAUX JUPE`, `AMORT` pour War Cry, `JE LAI2JE`. Le `2` est une coquille d'après l'Encyclopaedia.
- **Traductions sans source officielle :** noms des sorts et compétences cachées, et tous les textes propres au projet, traduits par Claude Code. **L'allemand n'a pas été relu par un germanophone.**
- **Pas de nom officiel non plus :** `CHANCE` / `GLUECK` (absent des textes de DM).
- **Restent en anglais :** types et notes des actuators dans les infobulles (`Any item / Empty hand`, `champion identifier`), qui viennent des commentaires du dump, comme avant.
- **Non testé dans le navigateur :** toutes les phrases de combat une à une ; seuls leurs clés et paramètres sont contrôlés.

## 6. Vérifications

- `node tools/test-i18n.mjs` : mêmes clés et paramètres dans les trois langues, clés du code toutes présentes, plus de français en dur, créatures alignées, 24 fiches identiques, sorts des parchemins.
- Les 12 autres tests Node passent ; ceux qui attendaient `Torch` attendent `TORCH`.
- Chrome : anglais par défaut, refus et acceptation de la confirmation, français et allemand après rechargement, inscription `HALLE DER HELDEN` dans la vue, infobulle, message `ZED MURMELT EINEN SINNLOSEN ZAUBERSPRUCH.`, modale des raccourcis, aucune erreur en console.
