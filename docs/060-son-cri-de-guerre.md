# 060 — Sons du cri de guerre et du cor

## Constat

`assets/sounds/27.mp3` (War Cry) n'était jamais joué. Les docs 040 à 042 l'avaient mis en attente de son action, prévue en C3c. Or l'action existe depuis la doc 044 : il manquait seulement le branchement. Le son 24 (Horn of Fear) était dans le même cas.

## Réalisation

- `src/core/sound-info.js` : sons `warCry` (27) et `horn` (24).
- `src/core/action-info.js` : champ `sound` des actions War Cry et Blow Horn.
- `src/sim/simulation.js`, `frighten()` : le son part dès que l'action est faite, en lecture immédiate comme les coups.
- `tools/test-sounds.mjs` : avec et sans créature en face ; Calm ne joue aucun des deux.

Les 33 sons sont maintenant utilisés.

## Déduction à vérifier

Ces deux sons n'existent que sur Amiga, et ReDMCSB ne couvre que l'Atari ST, où ces actions sont muettes (`F407`, `MENUS.C`). Aucune source ne donne donc leur déclencheur exact. Le son est joué **même sans créature en face**, parce qu'un cri ou un cor s'entend quelle que soit la cible. À comparer avec le jeu Amiga si besoin.

## Sources

Aucune nouvelle : ReDMCSB, page graphics.dat de greatstone (voir [000-sources.md](000-sources.md)).
