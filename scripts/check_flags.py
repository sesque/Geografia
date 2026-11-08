#!/usr/bin/env python3
"""Check iso_a2 / population_m in data/paises.json and flag SVG files."""
import json, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(root, 'data', 'paises.json'), encoding='utf-8'))
errs, seen, n = [], set(), 0
for x in d:
    c, p = x.get('iso_a2'), x.get('population_m')
    if not isinstance(c, str) or len(c) != 2 or c != c.lower():
        errs.append('bad iso_a2 ' + x['name_en']); continue
    if c in seen: errs.append('duplicate ' + c)
    seen.add(c)
    if isinstance(p, bool) or not isinstance(p, (int, float)): errs.append('bad population ' + x['name_en']); continue
    if p >= 1:
        n += 1
        f = os.path.join(root, 'assets', 'flags', c + '.svg')
        if not os.path.isfile(f) or os.path.getsize(f) == 0: errs.append('missing flag ' + c); continue
        t = open(f, encoding='utf-8').read()
        if '<svg' not in t or '</svg>' not in t: errs.append('invalid svg ' + c)
files = [f for f in os.listdir(os.path.join(root, 'assets', 'flags')) if f.endswith('.svg')]
extra = [f for f in files if f[:-4] not in {x['iso_a2'] for x in d if x['population_m'] >= 1}]
if extra: errs.append('extra flags: ' + ', '.join(extra))
print(len(d), 'countries,', n, 'with >=1M,', len(files), 'flag files')
for e in errs: print('ERROR', e)
print('RESULT:', 'OK' if not errs else 'FAIL')
sys.exit(1 if errs else 0)
