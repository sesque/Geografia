(function (root) {
  const TOPICS = [
    { id: 'es_prov', group: 'spain', labelKey: 'topic.es_prov' },
    { id: 'es_ccaa', group: 'spain', labelKey: 'topic.es_ccaa' },
    { id: 'world_europa', group: 'world', labelKey: 'topic.world_europa' },
    { id: 'world_america', group: 'world', labelKey: 'topic.world_america' },
    { id: 'world_asia', group: 'world', labelKey: 'topic.world_asia' },
    { id: 'world_oceania', group: 'world', labelKey: 'topic.world_oceania' },
    { id: 'world_africa', group: 'world', labelKey: 'topic.world_africa' },
    { id: 'loc_prov', group: 'locate', labelKey: 'topic.loc_prov' },
    { id: 'loc_ccaa', group: 'locate', labelKey: 'topic.loc_ccaa' },
    { id: 'loc_europa', group: 'locate', labelKey: 'topic.loc_europa' },
    { id: 'loc_america', group: 'locate', labelKey: 'topic.loc_america' },
    { id: 'loc_asia', group: 'locate', labelKey: 'topic.loc_asia' },
    { id: 'loc_oceania', group: 'locate', labelKey: 'topic.loc_oceania' },
    { id: 'loc_africa', group: 'locate', labelKey: 'topic.loc_africa' }
  ];
  // map.js refuses clicks on these, so they must never be locate targets or options.
  const DISPUTED_IDS = ['983', '158', '275', '732', '992', '991'];

  function data() { return root.GeoData || {}; }
  function provData() { return data().provincias || []; }
  function ccaaData() { return data().ccaa || []; }
  function paisData() { return data().paises || []; }

  function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(rng() * (i + 1)));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function norm(s) {
    return String(s).trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function label(es, en) {
    return { es: es, en: en };
  }

  function worldIdSet() {
    const m = data().maps && data().maps.world;
    const geoms = m && m.objects && m.objects.countries && m.objects.countries.geometries;
    if (!geoms) return null;
    return new Set(geoms.filter(g => g && g.id != null).map(g => String(g.id)));
  }

  function layerIdSet(layer) {
    const m = data().maps && data().maps[layer];
    const feats = m && m.features;
    if (!feats) return null;
    return new Set(feats.map(f => String(f.properties && f.properties.id != null ? f.properties.id : f.id)));
  }

  function isDisputed(p) {
    return !!p.disputed || DISPUTED_IDS.indexOf(String(p.iso_n3)) >= 0;
  }

  function provItems() {
    const ids = layerIdSet('provincias');
    return provData().filter(p => !ids || ids.has(String(p.id))).map(p => ({
      key: 'prov:' + p.id,
      id: String(p.id),
      name: label(p.name_es, p.name_en),
      capital: label(p.capital_es, p.capital_en),
      lat: p.capital_lat,
      lon: p.capital_lon,
      ccaaId: p.ccaa_id,
      raw: p
    }));
  }

  function ccaaItems() {
    const ids = layerIdSet('ccaa');
    return ccaaData().filter(c => !ids || ids.has(String(c.id))).map(c => ({
      key: 'ccaa:' + c.id,
      id: String(c.id),
      name: label(c.name_es, c.name_en),
      capital: label(c.capital_es, c.capital_en),
      raw: c
    }));
  }

  function countryItems(continent) {
    const ids = worldIdSet();
    return paisData()
      .filter(p => (!continent || p.continent === continent) && !isDisputed(p) && (!ids || ids.has(String(p.iso_n3))))
      .map(p => ({
        key: 'pais:' + p.iso_n3,
        id: String(p.iso_n3),
        name: label(p.name_es, p.name_en),
        capital: label(p.capital_es, p.capital_en),
        lat: p.capital_lat,
        lon: p.capital_lon,
        continent: p.continent,
        raw: p
      }));
  }

  function buildOptions(correct, orderedPool, labelOf, rng) {
    const used = new Set();
    const correctLabel = labelOf(correct);
    used.add(norm(correctLabel.es));
    used.add(norm(correctLabel.en));
    const options = [];
    for (let i = 0; i < orderedPool.length && options.length < 4; i++) {
      const cand = orderedPool[i];
      if (cand.key === correct.key) continue;
      const lbl = labelOf(cand);
      const es = norm(lbl.es);
      const en = norm(lbl.en);
      if (used.has(es) || used.has(en)) continue;
      used.add(es);
      used.add(en);
      options.push({ id: cand.key, label: lbl });
    }
    if (options.length < 4) throw new Error('quiz: not enough distractors for ' + correct.key);
    options.push({ id: correct.key, label: correctLabel });
    return shuffle(options, rng);
  }

  function promptCapitalOf(name) {
    return { es: '¿Cuál es la capital de ' + name.es + '?', en: 'What is the capital of ' + name.en + '?' };
  }

  function promptProvinceOfCapital(capital) {
    return { es: '¿De qué provincia es capital ' + capital.es + '?', en: 'Which province is ' + capital.en + ' the capital of?' };
  }

  function promptCcaaOfCapital(capital) {
    return { es: '¿De qué comunidad autónoma es capital ' + capital.es + '?', en: 'Which autonomous community is ' + capital.en + ' the capital of?' };
  }

  function promptCcaaOfProvince(name) {
    return { es: '¿En qué comunidad autónoma está ' + name.es + '?', en: 'Which autonomous community is ' + name.en + ' in?' };
  }

  function promptCountryOfCapital(capital) {
    return { es: '¿De qué país es capital ' + capital.es + '?', en: 'Which country is ' + capital.en + ' the capital of?' };
  }

  function promptWhere(name) {
    return { es: '¿Dónde está ' + name.es + '?', en: 'Where is ' + name.en + '?' };
  }

  function esProvQuestions(topicId, count, rng) {
    const items = provItems();
    const picked = shuffle(items, rng).slice(0, Math.min(count, items.length));
    const start = rng() < 0.5 ? 0 : 1;
    return picked.map((item, i) => {
      const toCapital = (i + start) % 2 === 0;
      const same = shuffle(items.filter(x => x.key !== item.key && x.ccaaId === item.ccaaId), rng);
      const rest = shuffle(items.filter(x => x.key !== item.key && x.ccaaId !== item.ccaaId), rng);
      const labelOf = toCapital ? (x => x.capital) : (x => x.name);
      return {
        topic: topicId,
        kind: 'mc',
        itemKey: item.key,
        prompt: toCapital ? promptCapitalOf(item.name) : promptProvinceOfCapital(item.capital),
        options: buildOptions(item, same.concat(rest), labelOf, rng),
        answerId: item.key,
        target: { layer: 'provincias', id: item.id, city: { lat: item.lat, lon: item.lon, name: item.capital } },
        mapView: 'spain'
      };
    });
  }

  function ccaaCity(c) {
    const first = String(c.capital_es || '').split('/')[0].trim();
    const p = provData().find(x => norm(x.capital_es) === norm(first) || norm(x.name_es) === norm(first));
    if (!p) return null;
    return { lat: p.capital_lat, lon: p.capital_lon, name: label(c.capital_es, c.capital_en) };
  }

  function esCcaaQuestions(topicId, count, rng) {
    const ccaas = ccaaItems();
    const comunidades = ccaas.filter(c => (c.raw.province_ids || []).length > 0);
    const provs = provItems();
    const ccaaMap = new Map(ccaas.map(c => [c.id, c]));
    const ccaaPool = shuffle(ccaas, rng);
    const provPool = shuffle(provs, rng);
    const kinds = ['cap', 'ofcap', 'inprov'];
    const rot = Math.floor(rng() * 3) % 3;
    const out = [];
    let ci = 0;
    let pi = 0;
    for (let i = 0; i < count; i++) {
      let kind = kinds[(i + rot) % 3];
      let item = null;
      if ((kind === 'cap' || kind === 'ofcap') && ci < ccaaPool.length) {
        item = ccaaPool[ci++];
      } else if (kind === 'inprov' && pi < provPool.length) {
        item = provPool[pi++];
      } else if (ci < ccaaPool.length) {
        item = ccaaPool[ci++];
        kind = rng() < 0.5 ? 'cap' : 'ofcap';
      } else if (pi < provPool.length) {
        item = provPool[pi++];
        kind = 'inprov';
      } else {
        break;
      }
      if (kind === 'inprov') {
        const answer = ccaaMap.get(item.ccaaId);
        if (!answer) continue;
        const pool = shuffle(comunidades.filter(x => x.key !== answer.key), rng);
        out.push({
          topic: topicId,
          kind: 'mc',
          itemKey: item.key,
          prompt: promptCcaaOfProvince(item.name),
          options: buildOptions(answer, pool, x => x.name, rng),
          answerId: answer.key,
          target: { layer: 'ccaa', id: answer.id, city: null },
          mapView: 'spain'
        });
      } else {
        const toCapital = kind === 'cap';
        const pool = shuffle(comunidades.filter(x => x.key !== item.key), rng);
        const labelOf = toCapital ? (x => x.capital) : (x => x.name);
        out.push({
          topic: topicId,
          kind: 'mc',
          itemKey: item.key,
          prompt: toCapital ? promptCapitalOf(item.name) : promptCcaaOfCapital(item.capital),
          options: buildOptions(item, pool, labelOf, rng),
          answerId: item.key,
          target: { layer: 'ccaa', id: item.id, city: ccaaCity(item.raw) },
          mapView: 'spain'
        });
      }
    }
    return out;
  }

  function worldQuestions(topicId, continent, count, rng) {
    const items = countryItems(continent);
    const all = countryItems(null);
    const picked = shuffle(items, rng).slice(0, Math.min(count, items.length));
    const start = rng() < 0.5 ? 0 : 1;
    return picked.map((item, i) => {
      const toCapital = (i + start) % 2 === 0;
      const same = shuffle(items.filter(x => x.key !== item.key), rng);
      const rest = shuffle(all.filter(x => x.key !== item.key && x.continent !== continent), rng);
      const labelOf = toCapital ? (x => x.capital) : (x => x.name);
      return {
        topic: topicId,
        kind: 'mc',
        itemKey: item.key,
        prompt: toCapital ? promptCapitalOf(item.name) : promptCountryOfCapital(item.capital),
        options: buildOptions(item, same.concat(rest), labelOf, rng),
        answerId: item.key,
        target: { layer: 'world', id: item.id, city: { lat: item.lat, lon: item.lon, name: item.capital } },
        mapView: continent
      };
    });
  }

  function locateQuestions(topicId, items, layer, view, count, rng) {
    const picked = shuffle(items, rng).slice(0, Math.min(count, items.length));
    return picked.map(item => ({
      topic: topicId,
      kind: 'locate',
      itemKey: item.key,
      prompt: promptWhere(item.name),
      answerId: item.id,
      target: { layer: layer, id: item.id, city: null },
      mapView: view
    }));
  }

  function generate(topicId, count, rng) {
    const random = typeof rng === 'function' ? rng : Math.random;
    const n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n <= 0) return [];
    if (topicId === 'es_prov') return esProvQuestions(topicId, n, random);
    if (topicId === 'es_ccaa') return esCcaaQuestions(topicId, n, random);
    if (topicId === 'loc_prov') return locateQuestions(topicId, provItems(), 'provincias', 'spain', n, random);
    if (topicId === 'loc_ccaa') return locateQuestions(topicId, ccaaItems(), 'ccaa', 'spain', n, random);
    const m = /^(world|loc)_(europa|america|asia|oceania|africa)$/.exec(topicId);
    if (m) {
      if (m[1] === 'world') return worldQuestions(topicId, m[2], n, random);
      return locateQuestions(topicId, countryItems(m[2]), 'world', m[2], n, random);
    }
    return [];
  }

  function itemName(itemKey, lang) {
    const s = String(itemKey == null ? '' : itemKey);
    const i = s.indexOf(':');
    if (i < 0) return s;
    const kind = s.slice(0, i);
    const id = s.slice(i + 1);
    let found = null;
    if (kind === 'prov') found = provData().find(x => String(x.id) === id);
    else if (kind === 'ccaa') found = ccaaData().find(x => x.id === id);
    else if (kind === 'pais') found = paisData().find(x => String(x.iso_n3) === id);
    if (!found) return s;
    const l = lang || (root.I18n && root.I18n.lang) || 'es';
    const name = l === 'en' ? found.name_en : found.name_es;
    return name || (l === 'en' ? found.name_es : found.name_en) || s;
  }

  const Quiz = { TOPICS: TOPICS, generate: generate, itemName: itemName };
  if (typeof module !== 'undefined' && module.exports) module.exports = Quiz;
  else root.Quiz = Quiz;
})(typeof window !== 'undefined' ? window : globalThis);
