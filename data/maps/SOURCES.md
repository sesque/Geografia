# Map data sources

## world-50m.topo.json
- Source: npm `world-atlas@2.0.2`, `countries-50m.json` (via cdn.jsdelivr.net), derived from Natural Earth 1:50m Admin 0 Countries.
- Licence: Natural Earth is public domain (https://www.naturalearthdata.com/about/terms-of-use/); world-atlas is ISC. No attribution required; credit "Made with Natural Earth" is courteous.
- Object `countries`; feature `id` = ISO 3166-1 numeric (string, zero-padded), `properties.name` = Natural Earth short English name.
- Local fixes (`scripts/fix_world.py`):
  - Features with no id in the source, given local ids (900-999 is the ISO user-assigned range; they carry `properties.iso_note`):
    Kosovo `983` (same code as data/paises.json), Somaliland `991`, N. Cyprus `992`, Indian Ocean Ter. `993`, Siachen Glacier `994`.
  - "Ashmore and Cartier Is." shared id `036` with Australia; reassigned `995`.
  - Tuvalu (`798`) is absent from the 1:50m dataset; added from Natural Earth 1:10m Admin 0 Countries (`ne_10m_admin_0_countries.geojson`, nvkelso/natural-earth-vector), quantised with the same transform. Islands are tiny: the app should draw a marker.
- Natural Earth draws de-facto borders (e.g. Western Sahara, Crimea assigned per NE's policy); features such as Greenland (304), W. Sahara (732), Antarctica (010) keep their NE ids.

## spain-provincias.geojson
- Source: Natural Earth 1:10m Admin 1 - States, Provinces (`ne_10m_admin_1_states_provinces.geojson`, nvkelso/natural-earth-vector), features with adm0_a3 = ESP (52: 50 provinces + Ceuta + Melilla). Public domain.
- NOT the IGN/CNIG "Líneas límite" (CC-BY 4.0): CNIG's download centre needs an interactive form, so no stable direct URL could be fetched. The click_that_hood `spain-provinces.geojson` (INE/IGN-derived) was tested and rejected: ~3900 parts, invalid rings and widespread overlaps between neighbours. Natural Earth has zero overlaps/holes between provinces.
- Processing: mapped ISO 3166-2 codes to INE codes, names from data/provincias.json (`name_es`; Ceuta, Melilla), mapshaper 0.6 `-simplify visvalingam 85% keep-shapes` (topology-aware, shared borders stay shared), coordinates rounded to 1e-4 deg (~11 m). Properties: `id` (INE 2-digit string), `name`.
- Accuracy: source scale is 1:10m, so coastlines are generalised (error of order 1 km). Fine for a quiz map; not for cadastral use.

## spain-ccaa.geojson
- Derived by mapshaper `-dissolve` of the simplified provinces file, grouped per data/ccaa.json `province_ids` (Ceuta/Melilla = features 51/52 -> ids `ceuta`, `melilla`). Properties: `id` (ccaa id), `name` (name_es). Borders coincide exactly with the provinces (verified: symmetric difference of union of provinces vs ccaa = 0).

## Reproduce
Raw downloads are kept outside the repo. Run `npx mapshaper` as above, `scripts/fix_world.py`, then `python3 scripts/check_maps.py`.
