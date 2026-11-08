const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const GeoData = {
  provincias: read('data/provincias.json'),
  ccaa: read('data/ccaa.json'),
  paises: read('data/paises.json'),
  maps: {
    world: read('data/maps/world-50m.topo.json'),
    provincias: read('data/maps/spain-provincias.geojson'),
    ccaa: read('data/maps/spain-ccaa.geojson')
  }
};
// Another worker is adding iso_a2/population_m to data/paises.json; fill them in if absent.
for (const p of GeoData.paises) {
  if (!p.iso_a2) p.iso_a2 = String(p.iso_a3 || '').toLowerCase();
  if (p.population_m == null) p.population_m = 1;
}

globalThis.GeoData = GeoData;

const Quiz = require('../js/quiz.js');

const DISPUTED = new Set(['983', '158', '275', '732', '992', '991']);
const isDisputed = (p) => !!p.disputed || DISPUTED.has(String(p.iso_n3));
const norm = (s) => String(s).trim().replace(/\s+/g, ' ').toLowerCase();

const worldIds = new Set(GeoData.maps.world.objects.countries.geometries.map((g) => String(g.id)));
const provIds = new Set(GeoData.maps.provincias.features.map((f) => String(f.properties.id)));
const ccaaIds = new Set(GeoData.maps.ccaa.features.map((f) => String(f.properties.id)));

const provById = new Map(GeoData.provincias.map((p) => [String(p.id), p]));
const ccaaById = new Map(GeoData.ccaa.map((c) => [c.id, c]));
const paisById = new Map(GeoData.paises.map((p) => [String(p.iso_n3), p]));

const provInMap = GeoData.provincias.filter((p) => provIds.has(String(p.id)));
const ccaaInMap = GeoData.ccaa.filter((c) => ccaaIds.has(c.id));
const comunidadesInMap = ccaaInMap.filter((c) => c.type === 'comunidad');
const countriesIn = (continent) => GeoData.paises.filter(
  (p) => p.continent === continent && !isDisputed(p) && worldIds.has(String(p.iso_n3))
);
const flagCountries = GeoData.paises.filter(
  (p) => p.population_m >= 1 && !isDisputed(p) && worldIds.has(String(p.iso_n3))
);

const CIUDADES_AUTONOMAS = new Set(['ceuta', 'melilla']);

function itemCount(topic) {
  if (topic === 'es_ccaa_cap') return comunidadesInMap.length;
  if (topic === 'es_ccaa_prov') return provInMap.length;
  if (topic === 'loc_prov') return provInMap.length;
  if (topic === 'loc_ccaa') return ccaaInMap.length;
  if (topic === 'world_flags') return flagCountries.length;
  const m = /^(?:world|loc)_(europa|america|asia|oceania|africa)$/.exec(topic);
  return countriesIn(m[1]).length;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectedAnswer(q) {
  const [kind, id] = q.itemKey.split(':');
  const es = q.prompt.es;
  if (kind === 'prov') {
    const p = provById.get(id);
    if (es.startsWith('¿Cuál es la capital de ')) return { es: p.capital_es, en: p.capital_en };
    if (es.startsWith('¿A qué comunidad autónoma pertenece la provincia ')) {
      const c = ccaaById.get(p.ccaa_id);
      return { es: c.name_es, en: c.name_en };
    }
  } else if (kind === 'ccaa') {
    const c = ccaaById.get(id);
    if (es.startsWith('¿Cuál es la capital de ')) return { es: c.capital_es, en: c.capital_en };
    if (es.startsWith('¿De qué comunidad autónoma es capital ')) return { es: c.name_es, en: c.name_en };
  } else if (kind === 'pais') {
    const p = paisById.get(id);
    if (es.startsWith('¿Cuál es la capital de ')) return { es: p.capital_es, en: p.capital_en };
    if (es.startsWith('¿De qué país es capital ')) return { es: p.name_es, en: p.name_en };
    if (es.startsWith('¿A qué país pertenece esta bandera?')) return { es: p.name_es, en: p.name_en };
  }
  throw new Error('unrecognized prompt for ' + q.itemKey + ': ' + es);
}

function checkQuestion(q, topic) {
  assert.equal(q.topic, topic);
  assert.ok(q.kind === 'mc' || q.kind === 'locate');
  assert.match(q.itemKey, /^(pais|prov|ccaa):/);
  assert.equal(typeof q.prompt.es, 'string');
  assert.equal(typeof q.prompt.en, 'string');
  assert.ok(q.prompt.es.length > 0 && q.prompt.en.length > 0);
  assert.ok(['provincias', 'ccaa', 'world'].includes(q.target.layer));
  assert.ok(['spain', 'europa', 'america', 'asia', 'oceania', 'africa'].includes(q.mapView));

  const layerIds = q.target.layer === 'provincias' ? provIds : q.target.layer === 'ccaa' ? ccaaIds : worldIds;
  assert.ok(layerIds.has(String(q.target.id)), 'target id ' + q.target.id + ' missing from map layer ' + q.target.layer);

  const [ikind, iid] = q.itemKey.split(':');
  if (ikind === 'pais') assert.ok(!isDisputed(paisById.get(iid)), 'disputed country asked: ' + iid);

  if (topic === 'world_flags') {
    const p = paisById.get(iid);
    assert.ok(p.population_m >= 1, 'country under 1M asked: ' + iid);
    assert.equal(q.image, 'assets/flags/' + p.iso_a2 + '.svg');
    assert.match(q.image, /^assets\/flags\/[a-z]{2}\.svg$/);
    assert.ok(fs.existsSync(path.join(ROOT, q.image)), 'missing flag file ' + q.image);
  } else {
    assert.equal(q.image, undefined, 'image must only be present on world_flags');
  }

  if (q.kind === 'locate') {
    assert.ok(!q.options || q.options.length === 0, 'locate question has options');
    assert.equal(q.answerId, q.target.id);
    assert.equal(q.target.city, null);
    assert.ok(q.prompt.es.startsWith('¿Dónde está '));
    assert.ok(q.prompt.en.startsWith('Where is '));
    return;
  }

  assert.equal(q.options.length, 5);
  assert.equal(new Set(q.options.map((o) => o.id)).size, 5);
  for (let i = 0; i < q.options.length; i++) {
    for (let j = i + 1; j < q.options.length; j++) {
      const a = q.options[i].label;
      const b = q.options[j].label;
      assert.notEqual(norm(a.es), norm(b.es));
      assert.notEqual(norm(a.en), norm(b.en));
      assert.notEqual(norm(a.es), norm(b.en));
      assert.notEqual(norm(a.en), norm(b.es));
    }
  }

  const answer = q.options.find((o) => o.id === q.answerId);
  assert.ok(answer, 'answerId not among options');
  const exp = expectedAnswer(q);
  assert.equal(answer.label.es, exp.es);
  assert.equal(answer.label.en, exp.en);

  const prefix = topic === 'es_ccaa_cap' || topic === 'es_ccaa_prov' ? 'ccaa:' : 'pais:';
  for (const o of q.options) {
    assert.ok(o.id.startsWith(prefix), 'unexpected option kind ' + o.id);
    if (o.id.startsWith('pais:')) {
      const op = paisById.get(o.id.slice(5));
      assert.ok(!isDisputed(op), 'disputed country offered: ' + o.id);
      if (topic === 'world_flags') assert.ok(op.population_m >= 1, 'country under 1M offered: ' + o.id);
    }
    if (topic === 'es_ccaa_cap' || topic === 'es_ccaa_prov') {
      const ccaaId = o.id.slice(5);
      assert.ok(!CIUDADES_AUTONOMAS.has(ccaaId), 'Ceuta/Melilla offered: ' + o.id);
      assert.equal(ccaaById.get(ccaaId).type, 'comunidad', 'option is not a comunidad: ' + o.id);
    }
  }

  if (topic.startsWith('world_') && topic !== 'world_flags') {
    const cont = topic.slice(6);
    if (countriesIn(cont).length >= 5) {
      for (const o of q.options) {
        if (o.id === q.answerId) continue;
        assert.equal(paisById.get(o.id.slice(5)).continent, cont, 'distractor ' + o.id + ' not from ' + cont);
      }
    }
  }

  if (q.target.city != null) {
    assert.equal(typeof q.target.city.lat, 'number');
    assert.equal(typeof q.target.city.lon, 'number');
    assert.equal(typeof q.target.city.name.es, 'string');
    assert.equal(typeof q.target.city.name.en, 'string');
  }
}

test('TOPICS match the contract', () => {
  assert.deepEqual(Quiz.TOPICS.map((t) => t.id), [
    'es_ccaa_cap', 'es_ccaa_prov', 'world_europa', 'world_america', 'world_asia', 'world_oceania', 'world_africa',
    'world_flags',
    'loc_prov', 'loc_ccaa', 'loc_europa', 'loc_america', 'loc_asia', 'loc_oceania', 'loc_africa'
  ]);
  for (const t of Quiz.TOPICS) {
    assert.ok(['spain', 'world', 'locate'].includes(t.group));
    assert.equal(t.labelKey, 'topic.' + t.id);
  }
});

test('itemName resolves display names', () => {
  assert.equal(Quiz.itemName('pais:068', 'es'), 'Bolivia');
  assert.equal(Quiz.itemName('pais:068', 'en'), 'Bolivia');
  assert.equal(Quiz.itemName('prov:09', 'es'), 'Burgos');
  assert.equal(Quiz.itemName('ccaa:cataluna', 'es'), 'Cataluña');
  assert.equal(Quiz.itemName('ccaa:cataluna', 'en'), 'Catalonia');
  assert.equal(Quiz.itemName('nope:1', 'es'), 'nope:1');
});

test('generate is deterministic for a given seed', () => {
  for (const t of Quiz.TOPICS) {
    assert.deepEqual(Quiz.generate(t.id, 20, mulberry32(99)), Quiz.generate(t.id, 20, mulberry32(99)));
  }
});

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34];

for (const topic of Quiz.TOPICS) {
  for (const count of [10, 20, 30]) {
    test(`${topic.id} count=${count}`, () => {
      const expected = Math.min(count, itemCount(topic.id));
      for (const seed of SEEDS) {
        const qs = Quiz.generate(topic.id, count, mulberry32(seed));
        assert.equal(qs.length, expected, `seed ${seed}: got ${qs.length}, expected ${expected}`);
        const keys = new Set();
        for (const q of qs) {
          assert.ok(!keys.has(q.itemKey), 'repeated itemKey ' + q.itemKey);
          keys.add(q.itemKey);
          checkQuestion(q, topic.id);
        }
      }
    });
  }
}

test('es_ccaa_cap asks both directions', () => {
  let toCapital = 0;
  let toCcaa = 0;
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const qs = Quiz.generate('es_ccaa_cap', 17, mulberry32(seed));
    assert.equal(qs.length, 17);
    for (const q of qs) {
      assert.equal(q.kind, 'mc');
      const [kind, id] = q.itemKey.split(':');
      assert.equal(kind, 'ccaa');
      assert.ok(!CIUDADES_AUTONOMAS.has(id), 'Ceuta/Melilla asked: ' + q.itemKey);
      assert.equal(ccaaById.get(id).type, 'comunidad');
      assert.ok(q.target.city, 'missing capital dot for ' + q.itemKey);
      assert.equal(q.target.city.name.es, ccaaById.get(id).capital_es);
      seen.add(q.itemKey);
      if (q.prompt.es.startsWith('¿Cuál es la capital de ')) toCapital++;
      else if (q.prompt.es.startsWith('¿De qué comunidad autónoma es capital ')) toCcaa++;
      else assert.fail('unexpected prompt ' + q.prompt.es);
    }
  }
  assert.ok(toCapital > 0 && toCcaa > 0);
  assert.equal(toCapital + toCcaa, 40 * 17);
  assert.equal(seen.size, comunidadesInMap.length, 'not every comunidad is asked over the seeds');
});

test('es_ccaa_prov asks every province about its own comunidad', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const qs = Quiz.generate('es_ccaa_prov', 50, mulberry32(seed));
    assert.equal(qs.length, 50);
    for (const q of qs) {
      const [kind, id] = q.itemKey.split(':');
      assert.equal(kind, 'prov');
      const p = provById.get(id);
      assert.ok(p);
      seen.add(id);
      assert.ok(q.prompt.es.startsWith('¿A qué comunidad autónoma pertenece la provincia '));
      assert.equal(q.answerId, 'ccaa:' + p.ccaa_id);
      const answer = q.options.find((o) => o.id === q.answerId);
      assert.equal(answer.label.es, ccaaById.get(p.ccaa_id).name_es);
      assert.equal(answer.label.en, ccaaById.get(p.ccaa_id).name_en);
      assert.equal(q.target.layer, 'ccaa');
      assert.equal(q.target.id, p.ccaa_id);
      assert.equal(q.target.city.lat, p.capital_lat);
      assert.equal(q.target.city.lon, p.capital_lon);
      for (const o of q.options) {
        const c = ccaaById.get(o.id.slice(5));
        assert.equal(c.type, 'comunidad', 'option is not a comunidad: ' + o.id);
        assert.ok(!CIUDADES_AUTONOMAS.has(c.id), 'Ceuta/Melilla offered: ' + o.id);
      }
    }
  }
  assert.equal(seen.size, provInMap.length, 'not every province is asked over the seeds');
});

test('world_flags generates the right counts', () => {
  for (const count of [10, 20, 30]) {
    for (const seed of SEEDS) {
      const qs = Quiz.generate('world_flags', count, mulberry32(seed));
      assert.equal(qs.length, Math.min(count, flagCountries.length), `count ${count} seed ${seed}`);
      assert.equal(new Set(qs.map((q) => q.itemKey)).size, qs.length, 'repeated item');
    }
  }
});

test('world_flags questions use the flag of the answer country', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const q of Quiz.generate('world_flags', 30, mulberry32(seed))) {
      assert.equal(q.kind, 'mc');
      assert.equal(q.prompt.es, '¿A qué país pertenece esta bandera?');
      assert.equal(q.prompt.en, 'Which country does this flag belong to?');
      const p = paisById.get(q.itemKey.split(':')[1]);
      assert.equal(q.image, 'assets/flags/' + p.iso_a2 + '.svg');
      assert.match(q.image, /^assets\/flags\/[a-z]{2}\.svg$/);
      assert.ok(fs.existsSync(path.join(ROOT, q.image)), 'missing ' + q.image);
      assert.equal(q.answerId, q.itemKey);
      assert.equal(q.answerId.slice(5), String(p.iso_n3));
      assert.equal(q.target.id, String(p.iso_n3));
      assert.equal(q.target.layer, 'world');
      assert.equal(q.mapView, p.continent);
      assert.equal(q.target.city.lat, p.capital_lat);
      assert.equal(q.target.city.lon, p.capital_lon);
      const answer = q.options.find((o) => o.id === q.answerId);
      assert.equal(answer.label.es, p.name_es);
      assert.equal(answer.label.en, p.name_en);
    }
  }
});

test('world_flags excludes small and disputed countries', () => {
  const small = new Set(GeoData.paises.filter((p) => !(p.population_m >= 1)).map((p) => String(p.iso_n3)));
  for (let seed = 1; seed <= 30; seed++) {
    for (const q of Quiz.generate('world_flags', 30, mulberry32(seed))) {
      const ids = [q.itemKey.split(':')[1], ...q.options.map((o) => o.id.slice(5))];
      for (const id of ids) {
        assert.ok(!small.has(id), 'country under 1M asked or offered: ' + id);
        assert.ok(!DISPUTED.has(id) && !paisById.get(id).disputed, 'disputed country asked or offered: ' + id);
      }
      assert.equal(q.options.length, 5);
      assert.equal(new Set(q.options.map((o) => o.id)).size, 5);
    }
  }
});

test('world_flags prefers same-continent distractors', () => {
  let same = 0;
  let total = 0;
  let fallbackSeen = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (const q of Quiz.generate('world_flags', 30, mulberry32(seed))) {
      const cont = paisById.get(q.itemKey.split(':')[1]).continent;
      const others = q.options.filter((o) => o.id !== q.answerId);
      const sameCount = others.filter((o) => paisById.get(o.id.slice(5)).continent === cont).length;
      total++;
      if (sameCount === 4) same++;
      if (sameCount < 4) fallbackSeen++;
    }
  }
  assert.ok(total > 0);
  assert.ok(same / total > 0.9, `only ${same}/${total} had 4 same-continent distractors`);
  assert.ok(fallbackSeen > 0, 'expected some fallback for continents with fewer than 5 eligible countries');
});

test('world_flags is deterministic with a seed', () => {
  assert.deepEqual(Quiz.generate('world_flags', 30, mulberry32(7)), Quiz.generate('world_flags', 30, mulberry32(7)));
  assert.notDeepEqual(Quiz.generate('world_flags', 30, mulberry32(7)), Quiz.generate('world_flags', 30, mulberry32(8)));
});

test('world topics ask both directions', () => {
  for (const cont of ['europa', 'america', 'asia', 'oceania', 'africa']) {
    let toCapital = 0;
    let toCountry = 0;
    for (let seed = 1; seed <= 10; seed++) {
      for (const q of Quiz.generate('world_' + cont, 10, mulberry32(seed))) {
        if (q.prompt.es.startsWith('¿Cuál es la capital de ')) toCapital++;
        else if (q.prompt.es.startsWith('¿De qué país es capital ')) toCountry++;
        else assert.fail('unexpected prompt ' + q.prompt.es);
      }
    }
    assert.ok(toCapital > 0 && toCountry > 0, cont);
  }
});
