# 064 — Escaliers de la vue à la première personne

Objectif de l'utilisateur : se rapprocher de l'original, ou au moins sentir la montée et la descente, avec les rampes en bois et sans zones noires.

Références : les images de DM [Stairs Up (Front 1)](assets/0113.IMG1%20%5BDungeon%20Graphics%20-%20Stairs%20Up%20(Front%201)%5D.png) et [Stairs Down (Front 1)](assets/0120.IMG1%20%5BDungeon%20Graphics%20-%20Stairs%20Down%20(Front%201)%5D.png).

## 1. Ce que montrent les images

- **Montée :** les marches de pierre mouchetée filent vers le haut et s'assombrissent jusqu'au noir. Les murs sont en enduit saumon. Deux rampes en bois montent de chaque côté, avec un bloc rivé à leur extrémité proche.
- **Descente :** j'y lis surtout le **plafond**, qui plonge par bandes claires. Les marches ne sont visibles qu'en bas de l'image, sombres et serrées. L'enduit reste à l'entrée, puis viennent des joues de pierre. Les rampes partent en T à mi-hauteur et plongent vers le bas. Cette lecture est mon interprétation de l'image, pas une information tirée du moteur.

## 2. D'où venaient les zones noires

L'ancien modèle faisait 4 boîtes dans la case. Rien ne fermait l'espace autour : les murs voisins s'arrêtent entre le sol et le plafond, et sous le sol il n'y a que le fond noir de la scène. Une marche qui descend ouvrait donc sur le vide.

## 3. Le nouveau modèle

Chaque escalier est un **tunnel fermé** (`src/render/three/stairs-model.js`) qui se prolonge au-delà de sa case, ce qui donne une vraie profondeur.

Vérifié sur les données : les 58 escaliers ont un seul voisin ouvert, et aucun ne porte d'objet. On ne les voit donc que par leur entrée, et le tunnel peut passer sans risque au-dessus ou en dessous de la case suivante.

| | Montée | Descente |
|---|---|---|
| Longueur | 2 cases, 8 marches | 1,6 case, 7 marches |
| Passe la case suivante | au-dessus des murs | sous le sol |
| Pente | sol et plafond parallèles | sol doux, plafond raide en 6 bandes |
| Plafond de la case | retiré | conservé, le tunnel passe dessous |

- **Pente de la descente :** vue depuis la case voisine, une pente franche serait entièrement cachée par le bord du sol. C'est pourquoi le sol descend doucement et le plafond fortement, ce qui correspond à l'image.
- **Fondu :** il est dans les couleurs de sommet, et atteint le noir au bout du tunnel. Ce noir-là est voulu, comme dans l'original. Les zones noires sur les côtés et sous les marches ont disparu.
- **Textures :** `fp-renderer.js` les dessine : pierre mouchetée avec nez de marche, enduit, bois veiné.

## 4. Choix et écarts

- **Lumière :** les matériaux du tunnel ne lisent pas les masques d'occlusion (doc 038). Au-delà de sa case, le tunnel est sur une case de mur, qui le rendrait noir d'un coup. Il reste éclairé par la lumière du groupe : dans le noir complet, l'escalier est noir comme le reste.
- **Option :** le tunnel dépend de l'option « Objets 3D » du panneau, comme les trappes creuses. Sans elle, on retrouve les anciennes boîtes.
- **Cartes :** la vue 3D du donjon garde ses marches simples, adaptées à la superposition des 14 niveaux.
- **Nombres :** pentes, longueurs et fondus sont réglés à l'œil.

## 5. Vérifications

Dans Chrome, avec un accès temporaire à `sim`, retiré ensuite :

- montée et descente depuis la case voisine, puis depuis 3 cases ;
- orientations S, N, W et E ;
- descente effective par l'escalier (niveau 6 vers 7) ;
- noir complet (palette 5) ;
- aucune erreur dans la console.

**Non testé :** l'option « Objets 3D » décochée, car le test aurait modifié les préférences enregistrées. Il n'y a pas de test Node : le modèle dépend de Three.js, chargé par le navigateur.

## 6. Sources

Les deux images de DM fournies par l'utilisateur, dans `docs/assets/`. Aucune autre source.
