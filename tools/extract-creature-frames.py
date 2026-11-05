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

# Frame d'attaque choisie à l'œil (None : pas d'image d'attaque). DM n'en a pas pour le Giggler et le
# Ruster : la frame 5 du Ruster est sa face en miroir, avec un décalage (doc 070).
ATTACK = {
    "Animated_Armour": 7, "Black_Flame": 3, "Couatl": 8, "Demon": 7, "Dragon": 6,
    "Ghost": 4, "Giant_Wasp": 8, "Giggler": None, "Grey_Lord": None, "Lord_Chaos": 5,
    "Lord_Order": None, "Magenta_Worm": 5, "Materializer": 9, "Mummy": 5, "Oitu": 7,
    "Pain_Rat": 6, "Rock_Pile": 1, "Ruster": None, "Scorpion": 5, "Screamer": 1,
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

# Jeu de coordonnées de DM (graphics.dat, item 558, octet 11 de l'espèce) :
# 0 moyen (par défaut), 1 bas (groupes de 1 ou 2), 2 haut (volants).
COORDINATE_SET = {
    "Scorpion": 1, "Pain_Rat": 1, "Ruster": 1, "Stone_Golem": 1, "Black_Flame": 1,
    "Couatl": 1, "Magenta_Worm": 1, "Wizard_Eye": 2, "Giant_Wasp": 2,
}

# Durée de l'image d'attaque, en ticks (Encyclopaedia, Creature Details : Next attack aspect update ticks).
ATTACK_TICKS = {
    "Scorpion": 2, "Swamp_Slime": 3, "Giggler": 2, "Wizard_Eye": 1, "Pain_Rat": 1, "Ruster": 2,
    "Screamer": 2, "Rock_Pile": 1, "Ghost": 1, "Stone_Golem": 4, "Mummy": 4, "Black_Flame": 1,
    "Skeleton": 1, "Couatl": 1, "Vexirk": 6, "Magenta_Worm": 2, "Trolin": 3, "Giant_Wasp": 1,
    "Animated_Armour": 1, "Materializer": 1, "Water_Elemental": 3, "Oitu": 2, "Demon": 1,
    "Lord_Chaos": 5, "Dragon": 4, "Lord_Order": 5, "Grey_Lord": 5,
}

# Espèces dont l'attaque s'affiche au hasard normale ou en miroir (même page : Flip Attack).
FLIP_ATTACK = {
    "Scorpion", "Swamp_Slime", "Wizard_Eye", "Pain_Rat", "Ruster", "Rock_Pile", "Ghost", "Black_Flame",
    "Couatl", "Vexirk", "Magenta_Worm", "Giant_Wasp", "Animated_Armour", "Materializer",
    "Water_Elemental", "Oitu", "Demon", "Dragon",
}

# Vie sur place (même page) : (Flip Non Attack, Maximum Horizontal Offset, Maximum Vertical Offset,
# Non attack aspect update ticks). Grey_Lord et Lord_Order : sans objet, le donjon n'en place pas.
IDLE = {
    "Animated_Armour": (True, 2, 2, 4), "Black_Flame": (True, 0, 0, 1), "Couatl": (True, 3, 2, 1),
    "Demon": (True, 1, 1, 2), "Dragon": (True, 1, 2, 4), "Ghost": (True, 1, 1, 1),
    "Giant_Wasp": (True, 3, 3, 1), "Giggler": (False, 2, 1, 2), "Grey_Lord": (False, 0, 0, 6),
    "Lord_Chaos": (False, 0, 0, 6), "Lord_Order": (False, 0, 0, 6), "Magenta_Worm": (True, 1, 1, 5),
    "Materializer": (True, 2, 3, 1), "Mummy": (False, 1, 0, 8), "Oitu": (True, 2, 2, 2),
    "Pain_Rat": (False, 2, 2, 4), "Rock_Pile": (False, 0, 0, 15), "Ruster": (True, 1, 1, 6),
    "Scorpion": (True, 2, 1, 5), "Screamer": (False, 0, 0, 15), "Skeleton": (False, 2, 1, 3),
    "Stone_Golem": (False, 3, 1, 15), "Swamp_Slime": (True, 2, 2, 8), "Trolin": (False, 2, 2, 3),
    "Vexirk": (False, 1, 0, 6), "Water_Elemental": (True, 0, 0, 4), "Wizard_Eye": (True, 3, 2, 1),
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
        "coordinateSet": COORDINATE_SET.get(name, 0),
        "attack": attack,
        "attackTicks": ATTACK_TICKS[name],
        "flipAttack": name in FLIP_ATTACK,
        "idleFlip": IDLE[name][0],
        "idleOffset": list(IDLE[name][1:3]),
        "idleTicks": IDLE[name][3],
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
