#!/usr/bin/env python3
"""Post-process world-atlas countries-50m.json: give ids to features lacking one,
fix a duplicate id, and add Tuvalu (absent at 1:50m) from Natural Earth 1:10m.
Usage: python3 -I fix_world.py <countries-50m.json> <tuvalu_feature.json> <out.topo.json>"""
import json, sys
src, tuv, out = sys.argv[1:4]
t = json.load(open(src))
obj = t['objects']['countries']
IDS = {  # name -> id (900-999 = ISO 3166-1 user-assigned range; 983 = Kosovo as used in data/paises.json)
    'Kosovo': '983', 'Somaliland': '991', 'N. Cyprus': '992',
    'Indian Ocean Ter.': '993', 'Siachen Glacier': '994'}
for g in obj['geometries']:
    n = g['properties']['name']
    if n in IDS: g['id'] = IDS[n]; g['properties']['iso_note'] = 'no ISO 3166-1 numeric code; id assigned locally'
    if n == 'Ashmore and Cartier Is.':
        g['id'] = '995'; g['properties']['iso_note'] = 'Natural Earth shares AUS 036; id assigned locally'
# add Tuvalu (798) from 10m geometry, quantised with the same transform
sx, sy = t['transform']['scale']; tx, ty = t['transform']['translate']
geom = json.load(open(tuv))['geometry']
polys = []
for poly in geom['coordinates']:
    rings = []
    for ring in poly:
        q = [(round((x - tx) / sx), round((y - ty) / sy)) for x, y in ring]
        arc = [list(q[0])] + [[q[i][0] - q[i-1][0], q[i][1] - q[i-1][1]] for i in range(1, len(q))]
        t['arcs'].append(arc); rings.append([len(t['arcs']) - 1])
    polys.append(rings)
obj['geometries'].append({'type': 'MultiPolygon', 'arcs': polys, 'id': '798',
    'properties': {'name': 'Tuvalu', 'iso_note': 'added from Natural Earth 1:10m (absent in 1:50m); islands are tiny - draw a marker'}})
json.dump(t, open(out, 'w'), separators=(',', ':'), ensure_ascii=False)
