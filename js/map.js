(function (root) {
  const BOXES = {
    europa: [-25, 33, 65, 72],
    america: [-170, -57, -30, 75],
    asia: [25, -11, 180, 78],
    oceania: [110, -48, 205, 15],
    africa: [-20, -36, 52, 38]
  };
  const SPAIN_WORLD_ID = '724';
  const CANARIAS_IDS = ['35', '38', 'canarias'];
  const BASE_DISPUTED = ['983', '158', '275', '732', '992', '991'];
  const PIN_AREA = 110;
  const NS = 'http://www.w3.org/2000/svg';

  const worldCache = new WeakMap();
  const spainCache = new WeakMap();

  function worldFeatures(topo) {
    if (!worldCache.has(topo)) {
      const fc = root.topojson.feature(topo, topo.objects.countries);
      worldCache.set(topo, fc.features.filter(f => f.geometry));
    }
    return worldCache.get(topo);
  }

  function rewound(fc) {
    if (spainCache.has(fc)) return spainCache.get(fc);
    const d3 = root.d3;
    const flip = g => {
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      const out = polys.map(p => p.map(r => r.slice().reverse()));
      return g.type === 'Polygon' ? { type: 'Polygon', coordinates: out[0] } : { type: 'MultiPolygon', coordinates: out };
    };
    const feats = fc.features.map(f => (d3.geoArea(f) > 2 * Math.PI ? { ...f, geometry: flip(f.geometry) } : f));
    spainCache.set(fc, feats);
    return feats;
  }

  function featId(f) {
    return f.properties && f.properties.id != null ? String(f.properties.id) : f.id != null ? String(f.id) : null;
  }

  function polysOf(f) {
    const g = f.geometry;
    return g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  }

  function boxPoints(box) {
    const [w, s, e, n] = box;
    const pts = [];
    for (let x = w; x <= e; x += 2) { pts.push([x, s], [x, n]); }
    for (let y = s; y <= n; y += 2) { pts.push([w, y], [e, y]); }
    pts.push([e, s], [e, n]);
    return { type: 'MultiPoint', coordinates: pts };
  }

  const reducedMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function create(container, opts) {
    const d3 = root.d3;
    const o = opts || {};
    let lang = o.lang || 'es';
    const state = { mode: null, view: null, layer: null, targetId: null, city: null, clickedId: null, correct: null, onPick: null, picked: false, revealed: false };
    const wrap = d3.select(container).append('div').attr('class', 'geomap');
    const svg = wrap.append('svg').attr('xmlns', NS);
    const zoomBox = wrap.append('div').attr('class', 'gm-zoom').style('display', 'none');
    let scene = null;
    let zoomB = null;
    let curT = d3.zoomIdentity;
    let lastW = 0;
    let ro = null;
    let destroyed = false;

    const btn = (txt, label, fn) => zoomBox.append('button').attr('type', 'button').attr('aria-label', label).text(txt).on('click', fn);
    btn('+', 'Zoom in', () => zoomStep(1.6));
    btn('−', 'Zoom out', () => zoomStep(1 / 1.6));

    function zoomStep(f) {
      if (!zoomB) return;
      svg.transition().duration(reducedMotion() ? 0 : 250).call(zoomB.scaleBy, f);
    }

    function disputedSet() {
      const s = new Set(BASE_DISPUTED);
      ((root.GeoData && root.GeoData.paises) || []).forEach(p => { if (p.disputed) s.add(p.iso_n3); });
      return s;
    }

    function clickableWorld(view) {
      const s = new Set();
      ((root.GeoData && root.GeoData.paises) || []).forEach(p => {
        if (p.continent === view && !p.disputed) s.add(p.iso_n3);
      });
      return s;
    }

    function analyze(f, path, W, H) {
      let area = 0, best = null, bestA = -1;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      polysOf(f).forEach(coords => {
        const pf = { type: 'Polygon', coordinates: coords };
        const b = path.bounds(pf);
        if (!isFinite(b[0][0]) || b[1][0] < 0 || b[0][0] > W || b[1][1] < 0 || b[0][1] > H) return;
        const a = Math.abs(path.area(pf));
        area += a;
        x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]);
        x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]);
        if (a > bestA) { bestA = a; best = pf; }
      });
      if (!best) return null;
      const c = path.centroid(best);
      return { area, cx: c[0], cy: c[1], bounds: [Math.max(0, x0), Math.max(0, y0), Math.min(W, x1), Math.min(H, y1)] };
    }

    function buildScene() {
      const geo = root.GeoData;
      const W = Math.max(240, Math.round(container.clientWidth || 600));
      const view = state.view;
      const sc = { W, H: 0, view, areas: [], ctx: [], disputed: [], inset: null, clickable: new Set(), proj: null, insetProj: null, info: new Map() };
      const pad = 6;
      if (view === 'spain') {
        const all = rewound(geo.maps[state.layer]);
        const main = all.filter(f => !CANARIAS_IDS.includes(featId(f)));
        const can = all.filter(f => CANARIAS_IDS.includes(featId(f)));
        const mainFC = { type: 'FeatureCollection', features: main };
        const p = d3.geoConicConformal().parallels([36, 43]).rotate([3.7, 0]).precision(0.3);
        p.fitWidth(W - 2 * pad, mainFC);
        const t = p.translate();
        p.translate([t[0] + pad, t[1] + pad]);
        const path = d3.geoPath(p);
        const mb = path.bounds(mainFC);
        let H = Math.ceil(mb[1][1] + pad);
        const iw = Math.round(Math.min(Math.max(W * 0.27, 120), 230));
        const ip = d3.geoMercator().precision(0.3);
        ip.fitWidth(iw - 16, { type: 'FeatureCollection', features: can });
        const ib = d3.geoPath(ip).bounds({ type: 'FeatureCollection', features: can });
        const ih = Math.ceil(ib[1][1] - ib[0][1]) + 28;
        let landBottom = 0;
        main.forEach(f => polysOf(f).forEach(poly => poly[0].forEach(c => {
          const q = p(c);
          if (q && q[0] < pad + iw + 12 && q[1] > landBottom) landBottom = q[1];
        })));
        const iy = Math.max(H - ih - pad, Math.ceil(landBottom + 10));
        H = Math.max(H, iy + ih + pad);
        const ix = pad;
        const it = ip.translate(), is = ip.scale();
        ip.translate([it[0] + ix + 8, it[1] + iy + 20]).scale(is);
        sc.H = H; sc.proj = p; sc.insetProj = ip;
        sc.inset = { x: ix, y: iy, w: iw, h: ih, features: can, path: d3.geoPath(ip) };
        sc.path = path;
        const ctx = worldFeatures(geo.maps.world).filter(f => String(f.id) !== SPAIN_WORLD_ID);
        sc.ctx = ctx.map(f => ({ id: String(f.id), d: path(f) })).filter(c => c.d);
        sc.areas = main.map(f => ({ id: featId(f), f, d: path(f), path }));
        sc.inset.areas = can.map(f => ({ id: featId(f), f, d: sc.inset.path(f), path: sc.inset.path, inset: true }));
        main.forEach(f => sc.clickable.add(featId(f)));
        can.forEach(f => sc.clickable.add(featId(f)));
      } else {
        const box = BOXES[view];
        const obj = boxPoints(box);
        const p = d3.geoNaturalEarth1().rotate([-(box[0] + box[2]) / 2, 0]).precision(0.3);
        let H;
        if (o.fill && container.clientHeight > 100) {
          H = Math.round(container.clientHeight);
          p.fitSize([W, H], obj);
        } else {
          p.fitWidth(W, obj);
          const b = d3.geoPath(p).bounds(obj);
          H = Math.ceil(b[1][1]);
          if (H > W * 0.95) { H = Math.round(W * 0.95); p.fitSize([W, H], obj); }
        }
        sc.H = H; sc.proj = p;
        const path = d3.geoPath(p);
        sc.path = path;
        sc.areas = worldFeatures(geo.maps.world).map(f => ({ id: String(f.id), f, d: path(f), path })).filter(a => a.d);
        const set = clickableWorld(view);
        set.forEach(id => sc.clickable.add(id));
        const disp = disputedSet();
        sc.disputed = sc.areas.filter(a => disp.has(a.id));
      }
      const all = sc.areas.concat(sc.inset ? sc.inset.areas : []);
      all.forEach(a => {
        if (sc.clickable.has(a.id) || a.id === state.targetId) {
          const inf = analyze(a.f, a.path, W, sc.H);
          if (inf) sc.info.set(a.id, inf);
        }
      });
      if (state.mode === 'locate') {
        sc.areas.concat(sc.inset ? sc.inset.areas : []).forEach(a => {
          const inf = sc.info.get(a.id);
          if (!inf || !sc.clickable.has(a.id)) return;
          inf.inset = !!a.inset;
          if (inf.area < PIN_AREA) inf.pin = true;
        });
        const pins = [...sc.info.entries()].filter(([, v]) => v.pin);
        pins.forEach(([id, v]) => {
          let md = Infinity;
          pins.forEach(([id2, v2]) => {
            if (id2 !== id) md = Math.min(md, Math.hypot(v.cx - v2.cx, v.cy - v2.cy));
          });
          v.minDist = md;
        });
      } else if (sc.info.has(state.targetId) && sc.info.get(state.targetId).area < PIN_AREA) {
        sc.info.get(state.targetId).pin = true;
        sc.info.get(state.targetId).inset = !!(sc.inset && sc.inset.areas.some(a => a.id === state.targetId));
      }
      return sc;
    }

    function render() {
      if (!state.view) return;
      scene = buildScene();
      const sc = scene;
      const { W, H } = sc;
      lastW = W;
      svg.selectAll('*').remove();
      svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).style('height', 'auto');
      svg.append('rect').attr('class', 'gm-sea').attr('width', W).attr('height', H);
      const interactive = state.mode === 'locate';
      wrap.classed('gm-interactive', interactive).classed('gm-picked', state.picked);
      zoomBox.style('display', interactive ? 'flex' : 'none');

      const gW = svg.append('g').attr('class', 'gm-world');
      gW.append('g').attr('class', 'gm-ctx').selectAll('path').data(sc.ctx).join('path')
        .attr('class', 'gm-area').attr('d', d => d.d);
      sc.els = new Map();
      const gA = gW.append('g').attr('class', 'gm-areas');
      const mk = (g, list) => g.selectAll('path').data(list).join('path')
        .attr('class', d => 'gm-area' + (interactive && sc.clickable.has(d.id) ? ' gm-click' : ''))
        .attr('data-id', d => d.id).attr('d', d => d.d)
        .each(function (d) { sc.els.set(d.id, this); });
      mk(gA, sc.areas);
      const gD = gW.append('g').attr('class', 'gm-disputed');
      sc.disputed.forEach(a => {
        gD.append('path').attr('class', 'gm-disp-erase').attr('d', a.d);
        gD.append('path').attr('class', 'gm-disp').attr('d', a.d);
      });

      if (sc.inset) {
        const i = sc.inset;
        const gI = svg.append('g').attr('class', 'gm-inset');
        gI.append('rect').attr('class', 'gm-inset-frame').attr('x', i.x).attr('y', i.y).attr('width', i.w).attr('height', i.h).attr('rx', 4);
        gI.append('text').attr('class', 'gm-inset-title').attr('x', i.x + 8).attr('y', i.y + 13).text('Canarias');
        mk(gI.append('g').attr('class', 'gm-areas'), i.areas);
      }

      const ov = svg.append('g').attr('class', 'gm-ov');
      sc.markers = [];
      sc.pins = [];
      const addMarker = (g, x, y, fixed) => { const m = { g, x, y, fixed }; sc.markers.push(m); return m; };

      sc.info.forEach((inf, id) => {
        if (!inf.pin) return;
        const g = ov.append('g').attr('class', 'gm-pin').attr('data-id', id);
        if (interactive) g.append('circle').attr('class', 'gm-hit');
        g.append('circle').attr('class', 'gm-pin-dot');
        g.append('circle').attr('class', 'gm-ring').attr('r', 12).lower();
        const m = addMarker(g, inf.cx, inf.cy, inf.inset);
        m.id = id; m.inf = inf;
        sc.pins.push(m);
        if (interactive) {
          g.on('mouseenter', () => { if (!state.picked) { g.classed('gm-hover', true); d3.select(sc.els.get(id)).classed('gm-hover', true); } })
            .on('mouseleave', () => { g.classed('gm-hover', false); d3.select(sc.els.get(id)).classed('gm-hover', false); });
        }
      });
      if (interactive) {
        sc.els.forEach((el, id) => {
          if (!sc.info.get(id) || !sc.info.get(id).pin) return;
          const pinG = sc.pins.find(m => m.id === id).g;
          d3.select(el).on('mouseenter', () => { if (!state.picked) pinG.classed('gm-hover', true); })
            .on('mouseleave', () => pinG.classed('gm-hover', false));
        });
      }

      if (state.city) {
        const c = state.city;
        let proj = sc.proj, fixed = false;
        if (sc.inset && c.lat < 30 && c.lon < -12) { proj = sc.insetProj; fixed = true; }
        const q = proj([c.lon, c.lat]);
        if (q) {
          const g = ov.append('g').attr('class', 'gm-city');
          g.append('circle').attr('class', 'gm-city-dot').attr('r', 4.5);
          const name = (c.name && (c.name[lang] || c.name.es)) || '';
          const right = q[0] + 9 + name.length * 7 < W;
          const tx = g.append('text').attr('class', 'gm-city-label').attr('y', 4).attr('x', right ? 8 : -8)
            .attr('text-anchor', right ? 'start' : 'end').text(name);
          sc.cityText = tx;
          addMarker(g, q[0], q[1], fixed);
        }
      }

      svg.on('.zoom', null).on('click', null);
      zoomB = null;
      if (interactive) {
        zoomB = d3.zoom().scaleExtent([1, 40]).extent([[0, 0], [W, H]]).translateExtent([[0, 0], [W, H]])
          .on('zoom', ev => applyT(ev.transform));
        svg.call(zoomB).on('dblclick.zoom', null);
        svg.on('click', ev => {
          const el = ev.target.closest && ev.target.closest('[data-id]');
          if (!el || state.picked || !state.onPick) return;
          const id = el.getAttribute('data-id');
          if (!sc.clickable.has(id)) return;
          state.picked = true;
          state.clickedId = id;
          wrap.classed('gm-picked', true);
          state.onPick(id);
        });
      }
      applyT(curT = d3.zoomIdentity);
      applyHighlights();
    }

    function applyT(t) {
      curT = t;
      const sc = scene;
      if (!sc) return;
      svg.select('.gm-world').attr('transform', t.toString());
      sc.markers.forEach(m => {
        const x = m.fixed ? m.x : t.applyX(m.x), y = m.fixed ? m.y : t.applyY(m.y);
        m.g.attr('transform', `translate(${x},${y})`);
        if (m.inf) {
          const k = m.fixed ? 1 : t.k;
          const show = m.inf.area * k * k < PIN_AREA;
          m.g.style('display', show ? null : 'none');
          const r = Math.max(5, Math.min(11, ((m.inf.minDist ?? Infinity) * k) / 2));
          m.g.select('.gm-hit').attr('r', r);
          m.g.select('.gm-pin-dot').attr('r', Math.min(3.6, r - 1.5));
        }
      });
    }

    function applyHighlights() {
      const sc = scene;
      if (!sc || !sc.els) return;
      const cls = new Map();
      const tcls = state.revealed || state.correct === true ? 'gm-correct' : 'gm-target';
      if (state.targetId != null) cls.set(state.targetId, tcls);
      if (state.clickedId != null && state.clickedId !== state.targetId && (state.mode === 'show' || state.revealed)) cls.set(state.clickedId, 'gm-wrong');
      sc.els.forEach(el => d3.select(el).classed('gm-target', false).classed('gm-correct', false).classed('gm-wrong', false));
      sc.pins.forEach(m => m.g.classed('gm-target', false).classed('gm-correct', false).classed('gm-wrong', false));
      sc.pins.forEach(m => m.g.select('.gm-ring').attr('class', 'gm-ring'));
      cls.forEach((c, id) => {
        const el = sc.els.get(id);
        if (el) d3.select(el).classed(c, true).raise();
        const pin = sc.pins.find(m => m.id === id);
        if (pin) {
          pin.g.classed(c, true);
          pin.g.select('.gm-ring').attr('class', 'gm-ring ' + c);
        }
      });
      if (state.mode === 'locate' && state.picked) {
        sc.els.forEach(el => d3.select(el).classed('gm-click', false));
      }
      d3.select(sc.els.get(state.targetId)).raise();
    }

    function setState(patch) {
      Object.assign(state, { revealed: false, picked: false, clickedId: null, correct: null, onPick: null, city: null, targetId: null }, patch);
      curT = d3.zoomIdentity;
      render();
    }

    function attachResize() {
      if (ro || typeof root.ResizeObserver === 'undefined') return;
      ro = new root.ResizeObserver(() => {
        if (destroyed) return;
        const w = Math.max(240, Math.round(container.clientWidth || 0));
        if (state.view && w !== lastW) {
          const wasRevealed = state.revealed;
          render();
          if (wasRevealed) zoomToTargets(0);
        }
      });
      ro.observe(container);
    }

    function zoomToTargets(duration) {
      const sc = scene;
      if (!sc || !zoomB) return;
      const ids = [state.targetId, state.clickedId].filter((v, i, a) => v != null && a.indexOf(v) === i);
      const infs = ids.map(id => sc.info.get(id)).filter(Boolean);
      if (!infs.length || infs.some(i => i.inset)) return;
      const b = infs.reduce((a, i) => [Math.min(a[0], i.bounds[0]), Math.min(a[1], i.bounds[1]), Math.max(a[2], i.bounds[2]), Math.max(a[3], i.bounds[3])], [Infinity, Infinity, -Infinity, -Infinity]);
      const bw = Math.max(b[2] - b[0], 1), bh = Math.max(b[3] - b[1], 1);
      const frac = infs.length > 1 ? 0.75 : 0.5;
      const k = Math.max(1, Math.min(6, frac * sc.W / bw, frac * sc.H / bh));
      const t = d3.zoomIdentity.translate(sc.W / 2 - k * (b[0] + b[2]) / 2, sc.H / 2 - k * (b[1] + b[3]) / 2).scale(k);
      const d = reducedMotion() ? 0 : duration;
      if (d) svg.transition().duration(d).call(zoomB.transform, t);
      else svg.call(zoomB.transform, t);
    }

    attachResize();

    return {
      setLang(l) {
        lang = l;
        if (scene && scene.cityText && state.city) scene.cityText.text((state.city.name && (state.city.name[lang] || state.city.name.es)) || '');
      },
      show(a) {
        setState({ mode: 'show', view: a.view, layer: a.layer, targetId: a.targetId != null ? String(a.targetId) : null, city: a.city || null, clickedId: a.clickedId != null ? String(a.clickedId) : null, correct: a.correct == null ? null : !!a.correct });
      },
      locate(a) {
        setState({ mode: 'locate', view: a.view, layer: a.layer, onPick: a.onPick || null });
      },
      reveal(a) {
        if (!scene) return;
        state.targetId = String(a.targetId);
        state.clickedId = a.clickedId != null ? String(a.clickedId) : state.clickedId;
        state.revealed = true;
        state.picked = true;
        wrap.classed('gm-picked', true);
        if (!scene.info.has(state.targetId)) scene.info.set(state.targetId, analyze(scene.areas.concat(scene.inset ? scene.inset.areas : []).find(x => x.id === state.targetId).f, scene.path, scene.W, scene.H));
        applyHighlights();
        zoomToTargets(700);
      },
      destroy() {
        destroyed = true;
        if (ro) ro.disconnect();
        wrap.remove();
      },
      _debug: { get scene() { return scene; }, get state() { return state; }, get transform() { return curT; } }
    };
  }

  const GeoMap = { create, BOXES };
  if (typeof module !== 'undefined' && module.exports) module.exports = GeoMap;
  else root.GeoMap = GeoMap;
})(typeof window !== 'undefined' ? window : globalThis);
