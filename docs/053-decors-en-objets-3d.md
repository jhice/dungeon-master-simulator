# 053 — Décors en objets 3D, portes à ouvertures, trappes creuses

> Demandes de l'utilisateur :
> - remplacer les décors peints sur les murs par de vrais objets 3D composés (l'extrusion du dessin a été essayée puis abandonnée) : levier, porte-torche, miroir, serrures, puis interrupteurs, fontaine, Vi Altar, Amalgam, tête de goule ;
> - voir à travers les portes à ouvertures ;
> - des trappes en creux, au sol et au plafond.
>
> Sources : ReDMCSB, `DUNVIEW.C`. Voir [000-sources.md](000-sources.md).

## 1. Objets composés (`src/render/first-person/fp-models.js`)

- Un objet est un assemblage de pièces simples (plaques percées, cylindres, sphères déformées, tores, profils tournés). Il n'y a aucun fichier de modèle.
- Un objet se place à l'endroit du rectangle de son décor (`WALL_ART`). Il remplace le dessin à plat.
- Ce qui est arrondi (tête, vasque) est entier : sa moitié arrière est cachée dans le mur.
- La fontaine, le Vi Altar et l'Amalgam descendent jusqu'au sol (`build` reçoit la hauteur du centre).
- Géométries et matériaux sont partagés entre les copies et gardés le temps de la vue. Le niveau ne les libère pas (`userData.model`).
- Les clics restent ceux du mur derrière : les objets ne sont pas sélectionnables.

| Décor | Pièces |
|---|---|
| Interrupteurs vert, rouge, bleu, grand, petit, minuscule | Plaque percée et rivetée, bouton sorti ou enfoncé dans le trou |
| Eye Switch | Plaque de pierre, globe, iris, pupille, paupières |
| Crack Switch | Fissure à plat, pierre sortie ou enfoncée dans son trou sombre |
| Fontaine | Tête de lion (crinière, museau, oreilles, gueule), filet d'eau, vasque sur pied, surface de l'eau |
| Vi Altar | Deux colonnes et un linteau gravé VI autour de la niche, bloc sous le rebord |
| Amalgam (3 états) | Socle, buste, bras, tête à cornes, niche de poitrine ; gemme libre, ou enchâssée dans du laiton |
| Tête de goule | Crâne, mâchoire, orbites, arcades, nez, dents |

Ce sont des interprétations : les proportions viennent des dessins de `ornament-art.js`, pas des graphismes de DM.

### Occultation

La doc 038 lit le masque de lumière d'un fragment dans la case où le pousse sa normale, ce qui convient à une face de mur. Sur un objet arrondi, cette poussée envoie certaines parties dans le mur, qui deviennent noires. Les matériaux des objets ont donc la constante `OCC_AT_POSITION` : ils lisent le masque à leur position réelle, toujours dans la case devant le mur.

## 2. Portes à ouvertures

- **Dans DM :** un ornement est copié dans l'image de la porte en gardant ses pixels de la couleur transparente, puis la porte est dessinée avec cette même transparence (`DUNVIEW.C`, F109 et F102). Ces pixels percent donc le battant.
- **Ici :** `Arched Grid`, `Square Grid`, `Wooden Bars` et `Iron Bars` découpent une ouverture dans la texture du battant (`opening()`, `ornament-art.js`), puis y dessinent leurs barreaux. Le battant les laisse voir grâce à `alphaTest`, déjà utilisé pour les herses. `alphaToCoverage` évite que les barreaux scintillent au loin.
- **À confirmer :** la liste des quatre ornements percés vient de leur nom. Je n'ai pas contrôlé leurs pixels dans `graphics.dat`.
- **Lumière :** une herse ou une porte à ouverture ne stoppe plus la lumière (`doorSeesThrough`), sinon le couloir derrière resterait noir avec l'occultation. Les portes fermées pleines la stoppent toujours.
- **Créatures :** `perception.js` ne change pas. Elles voient à travers les herses et les portes Ra (doc 022), pas à travers les fenêtres.

## 3. Trappes creuses

- Pas de soustraction de volumes : la case est construite creuse, ce qui ne demande ni bibliothèque ni calcul.
- **Au sol** (`level-meshes.js`, option `hollowPits`, trappe ouverte et visible) : pas de dalle, mais un cadre percé à la hauteur du sol (`pitRimGeometry`), qui prolonge sa texture, et un puits vu de l'intérieur (`pitShaftGeometry`, profondeur 0,6).
- **Au plafond** (`buildCeiling`, `fp-renderer.js`) : le même cadre tourné vers le bas, avec le puits qui monte.
- **Texture du puits :** des blocs de pierre qui s'enfoncent dans le noir, et une arête claire en haut (`pitShaftTexture`).
- **Clic :** dans un puits, la case et la moitié de case visées sont calculées là où le rayon traverse le niveau du sol, pas sur la paroi du fond.
- **Inchangé :** une trappe invisible reste un sol, et une trappe fermée garde son couvercle.

## 4. Vérifications

Sur le vrai GPU (Chrome sans interface, piloté par le protocole DevTools), dans une copie du projet :

- **Clics réels :** Green, Blue, Red et Crack Switch passent de Out à In. Big Switch révèle sa Square Alcove (niveau 1). Eye Switch et Small Switch ne changent pas d'image, car ils n'ont qu'un dessin.
- **Objet lâché dans une trappe :** il arrive à (20, 13) au niveau 3, comme sans le creux.
- **Reconstruction d'un niveau** (médianes, ms, sans / avec objets) : 2,4 / 2,9 (niveau 0) ; 7 / 8 (1) ; 4,9 / 5,4 (2) ; 5,8 / 6,1 (5) ; 4 / 4,2 (8) ; 1,7 / 1,9 (13).
- **Appels de dessin**, sans / avec, depuis une même position : 12 / 54 (0) ; 103 / 282 (1) ; 65 / 103 (2) ; 78 / 138 (5) ; 60 / 73 (8) ; 15 / 35 (13).
- **Mémoire :** stable après 60 reconstructions (257 géométries, 93 textures).
- **Tests Node :** les 12 passent.

## 5. Limites

- Flamme et eau sont immobiles : la vue n'est dessinée qu'à la demande.
- Le matériau Lambert ne donne aucun reflet sur le métal ni sur l'eau.
- La niche des alcôves reste un aplat sombre, pas un vrai creux dans le mur.
- Il reste sans objet 3D : Coin Slot, Gem Hole, trous de projectiles, Lord Order, anneaux, crochet, menottes, grilles, sortie de slime. Les décors plats (fissures, griffures, slime) peuvent rester peints.
