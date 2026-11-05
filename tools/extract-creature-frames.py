#!/usr/bin/env python3
"""Exporte chaque frame des GIFs de assets/creatures/ en PNG transparents (doc 066).

Usage : python3 tools/extract-creature-frames.py   (nécessite Pillow)

Produit :
  assets/creatures/<Nom>/NN[-role].png   une image par frame, toutes au format du GIF
  assets/creatures/frames.json           pour chaque créature : taille, frames, rôles
  docs/assets/creature-frames.png        planche de contrôle, attaque encadrée en rouge

Pour changer une attaque : modifier ATTACK ci-dessous et relancer. Le script ne
supprime que les PNG des sous-dossiers de créatures et réécrit les autres sorties.
"""
import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps, ImageSequence

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "creatures"
SHEET = ROOT / "docs" / "assets" / "creature-frames.png"

# Créatures sans vues de côté ni de dos : leurs premières frames sont une animation.
NO_VIEWS = {
    "Black_Flame", "Ghost", "Grey_Lord", "Lord_Order", "Rock_Pile", "Screamer",
    "Swamp_Slime", "Water_Elemental", "Wizard_Eye",
}

# Frame d'attaque choisie à l'œil (None : aucune frame ne s'impose).
ATTACK = {
    "Animated_Armour": 7, "Black_Flame": 3, "Couatl": 8, "Demon": 7, "Dragon": 6,
    "Ghost": 4, "Giant_Wasp": 8, "Giggler": None, "Grey_Lord": None, "Lord_Chaos": 5,
    "Lord_Order": None, "Magenta_Worm": 5, "Materializer": 9, "Mummy": 5, "Oitu": 7,
    "Pain_Rat": 6, "Rock_Pile": 1, "Ruster": 5, "Scorpion": 5, "Screamer": 1,
    "Skeleton": 6, "Stone_Golem": 5, "Swamp_Slime": 3, "Trolin": 7, "Vexirk": 5,
    "Water_Elemental": 2, "Wizard_Eye": 4,
}

# Espèce de src/core/creature-info.js (les noms diffèrent parfois : Scorpion, Rock_Pile, Dragon).
# Grey_Lord et Lord_Order n'ont pas d'espèce dans la table.
TYPE_BY_NAME = {
    "Scorpion": 0, "Swamp_Slime": 1, "Giggler": 2, "Wizard_Eye": 3, "Pain_Rat": 4,
    "Ruster": 5, "Screamer": 6, "Rock_Pile": 7, "Ghost": 8, "Stone_Golem": 9,
    "Mummy": 10, "Black_Flame": 11, "Skeleton": 12, "Couatl": 13, "Vexirk": 14,
    "Magenta_Worm": 15, "Trolin": 16, "Giant_Wasp": 17, "Animated_Armour": 18,
    "Materializer": 19, "Water_Elemental": 20, "Oitu": 21, "Demon": 22,
    "Lord_Chaos": 23, "Dragon": 24,
}

VIEW_ROLES = {0: "front", 1: "side", 2: "back", 3: "side2"}
NAME_RE = re.compile(r",Creature,([^,]+),Screenshot\.gif$")


def role_of(name, index):
    if index == ATTACK[name]:
        return "attack"
    if name not in NO_VIEWS:
        return VIEW_ROLES.get(index)
    return "front" if index == 0 else None


def extract(gif):
    """Écrit les PNG d'une créature et renvoie son entrée de frames.json et ses images."""
    name = NAME_RE.search(gif.name).group(1)
    folder = SRC / name
    folder.mkdir(exist_ok=True)
    for old in folder.glob("*.png"):
        old.unlink()

    source = Image.open(gif)
    images, entries, seen = [], [], {}
    for index, frame in enumerate(ImageSequence.Iterator(source)):
        image = frame.convert("RGBA")
        duration = frame.info.get("duration", 0)
        role = role_of(name, index)
        filename = f"{index:02d}{'-' + role if role else ''}.png"
        image.save(folder / filename, optimize=True)

        entry = {"file": filename, "durationMs": duration}
        if role:
            entry["role"] = role
        pixels = hashlib.md5(image.tobytes()).digest()
        if pixels in seen:
            entry["sameAs"] = seen[pixels]
        else:
            seen[pixels] = index
        images.append(image)
        entries.append(entry)

    # Frame symétrique de l'attaque : l'attaque de l'autre côté, sans transformation.
    mirror = None
    attack = ATTACK[name]
    if attack is not None:
        flipped = ImageOps.mirror(images[attack]).tobytes()
        mirror = next((i for i, im in enumerate(images) if im.tobytes() == flipped), None)

    info = {
        "folder": name,
        "type": TYPE_BY_NAME.get(name),
        "size": list(source.size),
        "hasViews": name not in NO_VIEWS,
        "attack": attack,
        "attackMirror": mirror,
        "frames": entries,
    }
    return name, info, images


def draw_sheet(creatures):
    scale, gap, width = 2, 8, 1500
    height = sum((im.height * scale + 18) * len(ims) for _, _, ims in creatures for im in ims[:1])
    sheet = Image.new("RGB", (width, height), (70, 70, 110))
    draw = ImageDraw.Draw(sheet)
    y = 0
    for name, info, images in creatures:
        draw.text((8, y + 4), name, fill="yellow")
        y += 18
        x = 8
        step = info["size"][1] * scale + gap
        for index, image in enumerate(images):
            big = image.resize((image.width * scale, image.height * scale), Image.NEAREST)
            if x + big.width > width:  # les frames d'une créature large passent à la ligne
                x, y = 8, y + step
            sheet.paste(big, (x, y), big)
            draw.text((x + 1, y), str(index), fill="white")
            if index == info["attack"]:
                draw.rectangle((x - 2, y - 2, x + big.width + 1, y + big.height + 1), outline="red", width=2)
            x += big.width + gap
        y += step
    sheet.crop((0, 0, width, y)).save(SHEET, optimize=True)


def main():
    gifs = sorted((g for g in SRC.glob("*.gif") if NAME_RE.search(g.name)), key=lambda g: NAME_RE.search(g.name).group(1))
    creatures = [extract(gif) for gif in gifs]
    manifest = {name: info for name, info, _ in creatures}
    (SRC / "frames.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    draw_sheet(creatures)
    total = sum(len(images) for _, _, images in creatures)
    print(f"{len(creatures)} créatures, {total} frames exportées dans {SRC}")


if __name__ == "__main__":
    main()
