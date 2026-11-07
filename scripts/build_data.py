#!/usr/bin/env python3
"""Build data/bundle.js from the JSON datasets and map files."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
MAPS = os.path.join(DATA, "maps")
OUT = os.path.join(DATA, "bundle.js")


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    bundle = {
        "provincias": load(os.path.join(DATA, "provincias.json")),
        "ccaa": load(os.path.join(DATA, "ccaa.json")),
        "paises": load(os.path.join(DATA, "paises.json")),
        "maps": {
            "world": load(os.path.join(MAPS, "world-50m.topo.json")),
            "provincias": load(os.path.join(MAPS, "spain-provincias.geojson")),
            "ccaa": load(os.path.join(MAPS, "spain-ccaa.geojson")),
        },
    }
    payload = json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("window.GeoData = " + payload + ";\n")
    print("wrote %s (%d bytes)" % (OUT, os.path.getsize(OUT)))


if __name__ == "__main__":
    main()
