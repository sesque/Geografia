#!/usr/bin/env python3
"""Validate map geometry against the datasets. Usage: python3 scripts/check_maps.py
Uses shapely when available, otherwise pure-python ray casting."""
import json, math, os, sys
from collections import Counter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'data'); M = os.path.join(D, 'maps')
try:
    from shapely.geometry import shape, Point
    HAVE = True
except ImportError:
    HAVE = False

def load(p):
    with open(p, encoding='utf-8') as f: return json.load(f)

# ---------- geometry helpers (km via local equirectangular projection) ----------
def _proj(lon, lat, lat0): return (lon * math.cos(math.radians(lat0)) * 111.195, lat * 111.195)

def _rings_to_polys(geom):
    t = geom['type']; c = geom['coordinates']
    return [c] if t == 'Polygon' else c if t == 'MultiPolygon' else []

def _in_ring(x, y, ring):
    ins = False; n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]; x2, y2 = ring[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: ins = not ins
    return ins

def _seg_dist(px, py, a, b):
    ax, ay = a; bx, by = b; dx, dy = bx - ax, by - ay
    l = dx * dx + dy * dy
    t = 0 if l == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / l))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)

def inside_and_dist(geom, lon, lat):
    """(inside, km distance to nearest border or 0)"""
    if HAVE:
        g = shape(geom)
        p = Point(lon, lat)
        if g.contains(p): return True, 0.0
        # distance in projected degrees -> km
        from shapely.ops import nearest_points
        q = nearest_points(g, p)[0]
        a = _proj(lon, lat, lat); b = _proj(q.x, q.y, lat)
        return False, math.hypot(a[0] - b[0], a[1] - b[1])
    polys = _rings_to_polys(geom)
    best = 1e9
    for poly in polys:
        if _in_ring(lon, lat, poly[0]) and not any(_in_ring(lon, lat, h) for h in poly[1:]):
            return True, 0.0
        for ring in poly:
            for i in range(len(ring) - 1):
                a = _proj(*ring[i], lat); b = _proj(*ring[i + 1], lat); p = _proj(lon, lat, lat)
                best = min(best, _seg_dist(p[0], p[1], a, b))
    return False, best

# ---------- TopoJSON decode ----------
def topo_features(t, name):
    sx, sy = t['transform']['scale']; tx, ty = t['transform']['translate']
    arcs = []
    for arc in t['arcs']:
        x = y = 0; pts = []
        for dx, dy in arc:
            x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    def arc_pts(i): return arcs[i] if i >= 0 else arcs[~i][::-1]
    def ring(idx):
        out = []
        for i in idx:
            p = arc_pts(i); out.extend(p if not out else p[1:])
        return out
    res = []
    for g in t['objects'][name]['geometries']:
        if g['type'] == 'Polygon': coords = [ring(r) for r in g['arcs']]; geo = {'type': 'Polygon', 'coordinates': coords}
        elif g['type'] == 'MultiPolygon': geo = {'type': 'MultiPolygon', 'coordinates': [[ring(r) for r in p] for p in g['arcs']]}
        else: continue
        res.append({'id': g.get('id'), 'properties': g.get('properties', {}), 'geometry': geo})
    return res

def main():
    print('engine:', 'shapely' if HAVE else 'pure python'); bad = 0
    prov = load(os.path.join(D, 'provincias.json')); ccaa = load(os.path.join(D, 'ccaa.json'))
    pf = load(os.path.join(M, 'spain-provincias.geojson'))['features']
    cf = load(os.path.join(M, 'spain-ccaa.geojson'))['features']
    # (a) ids
    exp_p = {p['id'] for p in prov}
    ciudades = {c['id'] for c in ccaa if not c['province_ids']}   # ceuta, melilla
    exp_p |= {'51', '52'}                                          # their province-level features
    got_p = Counter(f['properties']['id'] for f in pf)
    exp_c = {c['id'] for c in ccaa}; got_c = Counter(f['properties']['id'] for f in cf)
    print('\n(a) id coverage')
    for label, exp, got in (('provincias', exp_p, got_p), ('ccaa', exp_c, got_c)):
        miss = sorted(exp - set(got)); extra = sorted(set(got) - exp); dup = sorted(k for k, v in got.items() if v > 1)
        print(f'  {label}: expected {len(exp)}, features {sum(got.values())}, missing={miss}, extra={extra}, duplicated={dup}')
        bad += len(miss) + len(extra) + len(dup)
    # (b) capitals
    print('\n(b) province capitals inside own polygon (coastal tolerance 5 km)')
    G = {f['properties']['id']: f['geometry'] for f in pf}; n_out = 0
    for p in prov:
        ins, d = inside_and_dist(G[p['id']], p['capital_lon'], p['capital_lat'])
        if not ins:
            ok = d <= 5; n_out += 1; bad += (not ok)
            print(f"  {'WITHIN-TOL' if ok else 'FAIL'} {p['id']} {p['name_es']} / {p['capital_es']}: outside polygon, {d:.2f} km from nearest border")
    print(f'  checked {len(prov)}, outside polygon: {n_out}')
    # (c) countries
    pp = os.path.join(D, 'paises.json')
    if os.path.exists(pp):
        print('\n(c) countries (capital tolerance 10 km)')
        paises = load(pp); feats = topo_features(load(os.path.join(M, 'world-50m.topo.json')), 'countries')
        byid = {}
        for f in feats: byid.setdefault(f['id'], []).append(f)
        dup = [k for k, v in byid.items() if k and len(v) > 1]
        print(f'  duplicate world ids: {dup}'); bad += len(dup)
        nomiss = 0
        for c in paises:
            fs = byid.get(c['iso_n3'])
            if not fs: print(f"  FAIL no world feature for {c['iso_n3']} {c['name_en']}"); bad += 1; continue
            res = [inside_and_dist(f['geometry'], c['capital_lon'], c['capital_lat']) for f in fs]
            if not any(r[0] for r in res):
                d = min(r[1] for r in res); ok = d <= 10; bad += (not ok)
                print(f"  {'WITHIN-TOL' if ok else 'FAIL'} {c['iso_n3']} {c['name_en']} / {c['capital_en']}: outside polygon, {d:.1f} km from border")
        print(f'  checked {len(paises)} countries')
    else:
        print('\n(c) data/paises.json not found, skipped')
    print('\nRESULT:', 'OK' if bad == 0 else f'{bad} problem(s)')
    return 1 if bad else 0

if __name__ == '__main__': sys.exit(main())
