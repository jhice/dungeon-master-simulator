#!/usr/bin/env python3
"""Exporte les images des objets de DM depuis une extraction de graphics.dat (doc 072).

Usage : python3 tools/extract-item-graphics.py [dossier]   (nécessite Pillow)

  dossier : les BMP de graphics.dat extraits par SCK (Amiga 3.6, numérotation de greatstone),
            par défaut celui de l'utilisateur, ci-dessous.

Produit :
  assets/items/floor/NN.png       les 86 images des objets au sol (graphismes 498 à 583,
                                  « Item on floor NN »), la couleur 10 transparente
  assets/items/floor/labels.json  NN -> objets que DM dessine avec cette image (libellés de SCK)
  assets/items/missiles/NN.png    les 32 images des projectiles (graphismes 454 à 485, « Missile … » :
                                  armes lancées de face, de dos, de côté, et sorts), doc 075
  assets/items/missiles/labels.json  NN -> libellé de SCK
  assets/items/icons.png          les 224 icônes d'inventaire (graphismes 42 à 48, 7 planches de 32 icônes
                                  de 16 × 16), empilées : l'icône n est en x = (n % 16) × 16,
                                  y = ⌊n / 16⌋ × 16 ; la couleur 12 (fond des cases) transparente, doc 076
  docs/assets/item-floor.png      planche de contrôle, agrandie 3 fois

La couleur 10 (« flesh ») est la couleur transparente des objets : DM la passe au blit
(C10_COLOR_FLESH, F115 de DUNVIEW.C, ReDMCSB).
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = Path("/home/jhice/Gamedev/sck@1.5.1@20110502.0/sck/output/graphics.dat.bak")
FLOOR_OUT = ROOT / "assets" / "items" / "floor"
SHEET = ROOT / "docs" / "assets" / "item-floor.png"
FIRST_FLOOR, COUNT_FLOOR = 498, 86
MISSILES_OUT = ROOT / "assets" / "items" / "missiles"
FIRST_MISSILE, COUNT_MISSILE = 454, 32
ICONS_OUT = ROOT / "assets" / "items" / "icons.png"
FIRST_ICONS, COUNT_ICON_SHEETS = 42, 7
ICON_BACKGROUND = 12  # DM draws the icons on this grey without transparency; transparent here (cursor)
TRANSPARENT = 10
ZOOM = 3


def source_files(src):
    """Graphic number -> (path, label) of the BMPs of the folder (the first of a number)."""
    files = {}
    for path in sorted(src.glob("*.bmp")):
        match = re.match(r"(\d{4})\.IMG1 \[(.*)\]\.bmp$", path.name)
        if match:
            files.setdefault(int(match.group(1)), (path, match.group(2)))
    return files


def transparent(image):
    """Paletted copy, colour TRANSPARENT see-through."""
    if image.mode != "P":
        raise ValueError("image without palette")
    out = image.copy()
    out.info["transparency"] = TRANSPARENT
    return out


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    files = source_files(src)
    FLOOR_OUT.mkdir(parents=True, exist_ok=True)
    for old in FLOOR_OUT.glob("*.png"):
        old.unlink()
    labels = {}
    images = []
    for n in range(COUNT_FLOOR):
        path, label = files[FIRST_FLOOR + n]
        # « Item on floor 13 - Bolt Blade - Delta - … » : the names after the number.
        names = re.sub(r"^Item on floor \d+ - ", "", label).split(" - ")
        labels[f"{n:02d}"] = names
        image = transparent(Image.open(path))
        image.save(FLOOR_OUT / f"{n:02d}.png", transparency=TRANSPARENT)
        images.append((n, image))
    (FLOOR_OUT / "labels.json").write_text(json.dumps(labels, indent=1, ensure_ascii=False) + "\n")

    # Projectiles: same transparency; numbered from the first (graphic 316 of the Atari ST, 454 here).
    MISSILES_OUT.mkdir(parents=True, exist_ok=True)
    for old in MISSILES_OUT.glob("*.png"):
        old.unlink()
    missile_labels = {}
    for n in range(COUNT_MISSILE):
        path, label = files[FIRST_MISSILE + n]
        missile_labels[f"{n:02d}"] = label
        transparent(Image.open(path)).save(MISSILES_OUT / f"{n:02d}.png", transparency=TRANSPARENT)
    (MISSILES_OUT / "labels.json").write_text(json.dumps(missile_labels, indent=1, ensure_ascii=False) + "\n")

    # Icons: the 7 sheets (256 × 32, 16 icons per row) one below the other.
    sheets = [Image.open(files[FIRST_ICONS + k][0]) for k in range(COUNT_ICON_SHEETS)]
    atlas = Image.new("P", (256, 32 * COUNT_ICON_SHEETS))
    atlas.putpalette(sheets[0].getpalette())
    for k, sheet in enumerate(sheets):
        atlas.paste(sheet, (0, 32 * k))
    atlas.save(ICONS_OUT, transparency=ICON_BACKGROUND)
    r, g, b = sheets[0].getpalette()[ICON_BACKGROUND * 3 : ICON_BACKGROUND * 3 + 3]
    print(f"icons -> {ICONS_OUT.relative_to(ROOT)}, background #{r:02x}{g:02x}{b:02x}")

    # Contact sheet: 6 columns, each picture zoomed on a grey cell with its number.
    cols, cell_w, cell_h = 6, 90 * ZOOM // 2 + 20, 30 * ZOOM + 24
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (60, 60, 60))
    draw = ImageDraw.Draw(sheet)
    for i, (n, image) in enumerate(images):
        x, y = (i % cols) * cell_w, (i // cols) * cell_h
        zoom = ZOOM if image.width * ZOOM <= cell_w - 8 else ZOOM // 2 + 0.5  # the widest at ×1.5
        big = image.convert("RGBA").resize((round(image.width * zoom), round(image.height * zoom)), Image.NEAREST)
        sheet.paste(big, (x + 4, y + 18), big)
        draw.text((x + 4, y + 3), f"{n:02d} {labels[f'{n:02d}'][0][:16]}", fill=(230, 230, 230))
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEET)
    print(f"{len(images)} images -> {FLOOR_OUT.relative_to(ROOT)}, sheet -> {SHEET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
