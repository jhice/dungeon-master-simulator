# 064 — Escaliers de la vue à la première personne

Objectif de l'utilisateur : se rapprocher de l'original, ou au moins sentir la montée et la descente, avec les rampes en bois et sans zones noires.

Références : les images de DM [Stairs Up (Front 1)](assets/0113.IMG1%20%5BDungeon%20Graphics%20-%20Stairs%20Up%20(Front%201)%5D.png) et [Stairs Down (Front 1)](assets/0120.IMG1%20%5BDungeon%20Graphics%20-%20Stairs%20Down%20(Front%201)%5D.png).

## 1. Ce que montrent les images

Précisions de l'utilisateur, qui corrigent ma première lecture :

- Le saumon des images n'existe pas : c'est la couleur transparente de l'image. Les murs de l'escalier ont donc la texture des murs du niveau.
- Les marches mouchetées ont la couleur du sol.
- Montée : les marches filent vers le haut et s'assombrissent jusqu'au noir, entre deux rampes en bois avec un bloc rivé à leur extrémité proche. La première marche est au niveau du sol.
- Descente : même largeur que la montée, sans épaisseur sur les bords. Le plafond descend en pente lisse, sans gradins. Les rampes partent en T à mi-hauteur et plongent.

## 2. D'où venaient les zones noires

L'ancien modèle faisait 4 boîtes dans la case. Rien ne fermait l'espace autour : les murs voisins s'arrêtent entre le sol et le plafond, et sous le sol il n'y a que le fond noir de la scène. Une marche qui descend ouvrait donc sur le vide.

## 3. Le nouveau modèle

Chaque escalier est un **tunnel fermé** (`src/render/three/stairs-model.js`) qui se prolonge au-delà de sa case, ce qui donne une vraie profondeur.

Vérifié sur les données : les 58 escaliers ont un seul voisin ouvert, et aucun ne porte d'objet. On ne les voit donc que par leur entrée, et le tunnel peut passer sans risque au-dessus ou en dessous de la case suivante.

| | Montée | Descente |
|---|---|---|
| Marches | 8, de 0,175 de haut, la première au niveau du sol | 8, de 0,09 de haut |
| Passe la case suivante | au-dessus des murs | sous le sol |
| Plafond | monte comme les marches | pente lisse, de 0,15 au-dessus de celui du couloir jusqu'au niveau du sol en fin de case |
| Fondu | selon la profondeur | selon la hauteur, sous le niveau du sol |

- **Plafond de la case :** retiré dans les deux sens, le tunnel a le sien.
- **Pente de la descente :** vue depuis la case voisine, une pente franche serait entièrement cachée par le bord du sol. Les marches descendent donc doucement et le plafond plus fortement, jusqu'à se rejoindre dans le noir.
- **Fond noir :** ce noir-là est voulu, comme dans l'original. Les zones noires sur les côtés et sous les marches ont disparu.
- **Textures :** une répétition par case sur toutes les faces, donc rien n'est étiré. Murs et plafond reprennent celles du niveau ; `fp-renderer.js` dessine la pierre mouchetée, teintée par la couleur du sol, et le bois veiné.
- **Séparation des marches :** un trait sombre dans le modèle (couleurs de sommet), car la texture n'est plus calée sur chaque marche.

## 4. Choix et écarts

- **Lumière :** les matériaux du tunnel ne lisent pas les masques d'occlusion (doc 038). Au-delà de sa case, le tunnel est sur une case de mur, qui le rendrait noir d'un coup. Il reste éclairé par la lumière du groupe : dans le noir complet, l'escalier est noir comme le reste.
- **Option :** le tunnel dépend de l'option « Objets 3D » du panneau, comme les trappes creuses. Sans elle, on retrouve les anciennes boîtes.
- **Cartes :** la vue 3D du donjon garde ses marches simples, adaptées à la superposition des 14 niveaux.
- **Nombres :** pentes, longueurs et fondus sont réglés à l'œil, et la hauteur du plafond (0,15) est à valider.

## 5. Vérifications

Dans Chrome, avec un accès temporaire à `sim`, retiré ensuite :

- montée et descente, depuis la case voisine et à 3 cases, sur les orientations S, W et E ;
- aucune erreur dans la console.

Sur la première version du modèle seulement : orientation N, descente effective par l'escalier (niveau 6 vers 7), noir complet (palette 5).

**Non testé :** l'option « Objets 3D » décochée, car le test aurait modifié les préférences enregistrées. Il n'y a pas de test Node : le modèle dépend de Three.js, chargé par le navigateur.

## 6. Sources

Les deux images de DM fournies par l'utilisateur, dans `docs/assets/`. Aucune autre source.
