(function () {
  const $ = (id) => document.getElementById(id);
  const t = (k, vars) => I18n.t(k, I18n.lang, vars);
  const SCREENS = ['player', 'menu', 'quiz', 'result', 'stats'];
  const COUNTS = [10, 20, 30];
  const MIN_RANK = 10;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    screen: 'player',
    player: null,
    topic: null,
    count: 10,
    statsTopic: null,
    playerError: null,
    central: null,
    centralLoading: false,
    centralOk: false,
    centralTried: false,
    syncInfo: null,
    game: null
  };

  const syncOn = () => !!(window.Sync && window.Sync.enabled && window.Sync.enabled());

  function ciGet(obj, name) {
    const k = Object.keys(obj || {}).find((x) => x.toLowerCase() === String(name).toLowerCase());
    return k ? obj[k] : [];
  }

  let centralPromise = null;

  function loadCentral(force) {
    if (!syncOn()) return Promise.resolve(null);
    if (centralPromise) return centralPromise;
    if (state.centralTried && !force) return Promise.resolve(state.central);
    state.centralLoading = true;
    state.centralTried = true;
    centralPromise = Promise.resolve().then(() => Sync.fetchAll()).catch(() => null).then((c) => {
      centralPromise = null;
      state.centralLoading = false;
      state.centralOk = !!c;
      if (c) state.central = c;
      return state.central;
    });
    return centralPromise;
  }

  function safePending() {
    try { return Sync.pending() || 0; } catch (e) { return 0; }
  }

  function validTopic(id) {
    return topics().some((x) => x.id === id);
  }

  function keepValid(list) {
    return (list || []).filter((g) => g && validTopic(g.topic));
  }

  function keepValidAll(all) {
    const out = {};
    Object.keys(all || {}).forEach((k) => { out[k] = keepValid(all[k]); });
    return out;
  }

  function ensureTopics() {
    const first = topics()[0] && topics()[0].id;
    if (!validTopic(state.topic)) state.topic = first;
    if (!validTopic(state.statsTopic)) state.statsTopic = first;
  }

  function topics() {
    return (window.Quiz && window.Quiz.TOPICS) || [];
  }

  function topicLabel(id) {
    return t('topic.' + id);
  }

  function pickName(obj) {
    return obj ? (I18n.lang === 'en' ? obj.name_en : obj.name_es) : '';
  }

  function areaName(layer, id) {
    const d = window.GeoData || {};
    let list = [];
    let found = null;
    if (layer === 'provincias') { list = d.provincias || []; found = list.find((x) => x.id === id); }
    else if (layer === 'ccaa') { list = d.ccaa || []; found = list.find((x) => x.id === id); }
    else if (layer === 'world') { list = d.paises || []; found = list.find((x) => x.iso_n3 === id); }
    return found ? pickName(found) : String(id);
  }

  function itemName(itemKey) {
    const i = itemKey.indexOf(':');
    const kind = itemKey.slice(0, i);
    const id = itemKey.slice(i + 1);
    if (kind === 'pais') return areaName('world', id);
    if (kind === 'prov') return areaName('provincias', id);
    if (kind === 'ccaa') return areaName('ccaa', id);
    return itemKey;
  }

  function show(screen) {
    state.screen = screen;
    SCREENS.forEach((s) => $('s-' + s).classList.toggle('hide', s !== screen));
    if (screen !== 'quiz') destroyMap();
    window.scrollTo(0, 0);
  }

  function destroyMap() {
    const g = state.game;
    if (g && g.map) {
      try { g.map.destroy(); } catch (e) { /* ignore */ }
      g.map = null;
    }
  }

  /* ---------- header & language ---------- */

  function applyLang() {
    const l = I18n.lang;
    document.documentElement.lang = l;
    document.title = t('title');
    $('title').textContent = t('title');
    const sk = $('splash-skip');
    if (sk) sk.textContent = t('splash_skip');
    document.querySelectorAll('#lang-group button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.l === l)));
    $('lang-group').setAttribute('aria-label', t('lang_label'));
  }

  function setLang(l) {
    if (l === I18n.lang) return;
    I18n.lang = l;
    applyLang();
    renderCurrent();
  }

  function renderCurrent() {
    const s = state.screen;
    if (s === 'player') renderPlayer();
    else if (s === 'menu') renderMenu();
    else if (s === 'quiz') paintQuiz();
    else if (s === 'result') renderResult();
    else if (s === 'stats') renderStats();
  }

  /* ---------- shared helpers ---------- */

  const TOPIC_STYLE = {
    es_ccaa_cap: ['🏛️', '#ff4d6d'],
    es_ccaa_prov: ['🗺️', '#ff4d6d'],
    world_europa: ['🏰', '#3d8bff'],
    world_america: ['🌎', '#2dff9a'],
    world_asia: ['🏯', '#ffd23f'],
    world_oceania: ['🦘', '#00e5ff'],
    world_africa: ['🦁', '#ff9a3d'],
    world_flags: ['🏁', '#ff5ecb'],
    loc_prov: ['📍', '#c46bff'],
    loc_ccaa: ['🧭', '#c46bff'],
    loc_europa: ['🏰', '#c46bff'],
    loc_america: ['🌎', '#c46bff'],
    loc_asia: ['🏯', '#c46bff'],
    loc_oceania: ['🦘', '#c46bff'],
    loc_africa: ['🦁', '#c46bff']
  };
  const topicIcon = (id) => (TOPIC_STYLE[id] || ['🌍', '#00e5ff'])[0];
  const topicColor = (id) => (TOPIC_STYLE[id] || ['🌍', '#00e5ff'])[1];
  const topicGroup = (id) => { const x = topics().find((o) => o.id === id); return x ? x.group : 'world'; };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const MEDALS = ['🥇', '🥈', '🥉'];

  function setAccent(id) {
    const c = topicColor(id);
    document.documentElement.style.setProperty('--acc', c);
    document.documentElement.style.setProperty('--c', c);
  }

  function mergedAll() {
    let all = {};
    try {
      all = Store.allGames();
      if (syncOn() && state.central) all = Stats.merge(all, state.central);
    } catch (e) { all = {}; }
    return keepValidAll(all);
  }

  function playerGames() {
    return ciGet(mergedAll(), state.player);
  }

  function hudData(correct, streak) {
    const lv = Stats.level(correct);
    return { lv: lv, streak: streak };
  }

  function hudHtml(quit) {
    return '<div class="top">' +
      (quit ? '<button type="button" class="back" data-act="quit" aria-label="' + esc(t('quit')) + '">✕</button>' : '<div class="avatar" aria-hidden="true">🧑‍🚀</div>') +
      '<div class="whowrap"><span class="who">' + esc(state.player || '') + '</span><span class="lvl" data-hud="lvl"></span></div>' +
      '<div class="xpwrap"><div class="xpbar"><div class="xpfill" data-hud="xp"></div></div><div class="xplbl"><span data-hud="xptxt"></span><span data-hud="next"></span></div></div>' +
      '<div class="streak" title="' + esc(t('streak')) + '"><span class="flame" data-hud="flame" aria-hidden="true">🔥</span><span data-hud="streak"></span></div>' +
      '</div>';
  }

  function paintHud(scope, correct, streak) {
    const h = hudData(correct, streak);
    const lv = h.lv;
    const set = (k, fn) => scope.querySelectorAll('[data-hud="' + k + '"]').forEach(fn);
    set('lvl', (e) => { e.textContent = t('level') + ' ' + lv.level + ' · ' + t(lv.name); });
    set('xp', (e) => { e.style.width = lv.pct + '%'; });
    set('xptxt', (e) => { e.textContent = lv.nextXp === null ? lv.xp + ' ' + t('xp_unit') : (lv.xp - lv.base) + ' / ' + (lv.nextXp - lv.base) + ' ' + t('xp_unit'); });
    set('next', (e) => { e.textContent = lv.nextXp === null ? '' : t('level') + ' ' + (lv.level + 1) + ' · ' + t('level_' + (lv.level + 1)); });
    set('streak', (e) => { e.textContent = String(streak); });
    set('flame', (e) => { e.style.transform = 'scale(' + Math.min(1 + streak * 0.08, 1.9).toFixed(2) + ')'; e.classList.toggle('cold', streak === 0); });
    return lv;
  }

  function paintHudIdle(scope) {
    const games = playerGames();
    return paintHud(scope, Stats.overall(games).correct, Stats.streak(games));
  }

  /* ---------- player ---------- */

  function renderPlayer() {
    let names = [];
    try { names = Store.listPlayers(); } catch (e) { names = []; }
    const lower = names.map((n) => n.toLowerCase());
    const remote = state.central ? Object.keys(state.central).filter((n) => lower.indexOf(n.toLowerCase()) < 0).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())) : [];
    const err = state.playerError;
    const btns = (list, del) => '<div class="chips left">' + list.map((n) => '<span class="prow"><button type="button" class="pbtn" data-act="pick-player" data-name="' + esc(n) + '"><span class="av" aria-hidden="true">🧑‍🚀</span>' + esc(n) + '</button>' +
      (del ? '<button type="button" class="delp" data-act="del-player" data-name="' + esc(n) + '" aria-label="' + esc(t('del_player_aria', { name: n })) + '" title="' + esc(t('del_player_aria', { name: n })) + '"><span aria-hidden="true">🗑</span></button>' : '') + '</span>').join('') + '</div>';
    $('s-player').innerHTML =
      '<div class="panel pcard"><h2>' + t('new_player') + '</h2>' +
      '<form class="pform" id="player-form" novalidate>' +
      '<input id="player-name" maxlength="60" autocomplete="off" placeholder="' + esc(t('name')) + '" aria-label="' + esc(t('name')) + '"' + (err ? ' aria-invalid="true" aria-describedby="player-err"' : '') + '>' +
      '<button type="submit" class="go">' + t('enter') + '</button></form>' +
      '<p class="err" id="player-err" role="alert">' + (err ? esc(err) : '') + '</p>' +
      ((names.length || !remote.length) ? '<h2>' + t('existing') + '</h2>' : '') +
      (names.length ? btns(names, true) : (remote.length ? '' : '<p class="note">' + t('no_players') + '</p>')) +
      (remote.length ? '<h2>' + t('central_players') + '</h2>' + btns(remote) : '') +
      '</div>';
  }

  function deletePlayer(name) {
    if (!window.confirm(t('del_confirm', { name: name }))) return;
    try { Store.removePlayer(name); } catch (e) { /* ignore */ }
    try { if (window.Sync && Sync.discardPending) Sync.discardPending(name); } catch (e) { /* ignore */ }
    if (state.player && sameName(state.player, name)) state.player = null;
    const v = $('player-name') ? $('player-name').value : '';
    renderPlayer();
    $('player-name').value = v;
  }

  function submitPlayer() {
    const input = $('player-name');
    const name = input.value.trim();
    if (!name) return playerError(t('err_empty'));
    if (name.length > 24) return playerError(t('err_long'));
    let canon;
    try { canon = Store.addPlayer(name); } catch (e) {
      return playerError(/24|long|largo/i.test(String(e.message)) ? t('err_long') : (/empty|vac/i.test(String(e.message)) ? t('err_empty') : t('err_generic')));
    }
    enterMenu(canon);
  }

  function playerError(msg) {
    state.playerError = msg;
    const keep = $('player-name').value;
    renderPlayer();
    $('player-name').value = keep;
    $('player-name').focus();
  }

  function enterMenu(name) {
    state.player = name;
    state.playerError = null;
    openMenu();
  }

  function openMenu() {
    renderMenu();
    show('menu');
    if (syncOn()) loadCentral().then(() => { if (state.screen === 'menu') refreshMenuDynamic(); });
    paintRank();
  }

  /* ---------- menu ---------- */

  function renderMenu() {
    ensureTopics();
    setAccent(state.topic);
    const cards = topics().map((x) => {
      const on = x.id === state.topic;
      return '<button type="button" class="tcard' + (on ? ' sel' : '') + '" aria-pressed="' + on + '" data-act="topic" data-topic="' + x.id + '" style="--c:' + topicColor(x.id) + '">' +
        '<span class="ic" aria-hidden="true">' + topicIcon(x.id) + '</span><span class="grp">' + esc(t('group_' + x.group)) + '</span><span class="nm">' + esc(topicLabel(x.id)) + '</span></button>';
    }).join('');
    $('s-menu').innerHTML = hudHtml(false) +
      '<div class="layout"><div>' +
      '<h2>' + t('choose_topic') + '</h2><div class="grid">' + cards + '</div>' +
      '<h2>' + t('count') + '</h2><div class="seg">' +
      COUNTS.map((n) => '<button type="button" aria-pressed="' + (state.count === n) + '" class="' + (state.count === n ? 'on' : '') + '" data-act="count" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<button type="button" class="big" data-act="start">' + t('start_go') + '</button>' +
      '<p class="err" id="menu-err" role="alert"></p>' +
      '<div class="menu-links"><button type="button" class="sec" data-act="stats">📊 ' + t('my_stats') + '</button></div>' +
      '</div><aside class="rank" id="rank" aria-live="polite"></aside></div>';
    paintHudIdle($('s-menu'));
    paintRank();
  }

  function refreshMenuDynamic() {
    if (!$('rank')) return;
    paintHudIdle($('s-menu'));
    paintRank();
  }

  function sameName(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  function rankRow(r, pos, me) {
    const medal = pos <= 3;
    return '<div class="rk' + (me ? ' me' : '') + '"><div class="' + (medal ? 'medal' : 'pos') + '">' +
      (medal ? '<span role="img" aria-label="' + esc(t('medal_' + pos)) + '">' + MEDALS[pos - 1] + '</span>' : pos) + '</div>' +
      '<div class="rinfo"><div class="rn">' + esc(r.player) + (me ? ' <span class="you">(' + t('you') + ')</span>' : '') + '</div><div class="rs">' + t(r.games === 1 ? 'games_n_one' : 'games_n', { n: r.games }) + ' · ' + r.total + ' ' + t('answers').toLowerCase() + '</div></div>' +
      '<div class="rp">' + fmtPct(r.pct) + ' %</div></div>';
  }

  function rankList(rk, limit) {
    const top = rk.slice(0, limit);
    let html = top.map((r, i) => rankRow(r, i + 1, sameName(r.player, state.player))).join('');
    const mine = rk.findIndex((r) => sameName(r.player, state.player));
    if (mine >= limit) html += '<div class="gap" aria-hidden="true">⋮</div>' + rankRow(rk[mine], mine + 1, true);
    return html;
  }

  function paintRank() {
    const el = $('rank');
    if (!el) return;
    const id = state.topic;
    el.style.setProperty('--c', topicColor(id));
    let rk = [];
    try { rk = Stats.ranking(mergedAll(), id, MIN_RANK); } catch (e) { rk = []; }
    let status = '';
    if (!syncOn()) status = '<p class="sync">' + t('local_only') + '</p>';
    else if (state.centralLoading) status = '<p class="sync">' + t('loading') + '</p>';
    else if (!state.centralOk) status = '<p class="sync warn">' + t('sync_offline') + '</p>';
    el.innerHTML = '<h3>🏆 ' + t(syncOn() ? 'rank_family' : 'rank_local') + '</h3>' +
      '<div class="sub">' + topicIcon(id) + ' ' + esc(topicLabel(id)) + '</div>' + status +
      (rk.length ? rankList(rk, 5)
        : '<div class="empty"><span class="e" aria-hidden="true">🌱</span>' + t('rank_nobody') + '<br>' + t('rank_nobody_sub') + '</div>') +
      '<p class="note">' + t('rank_min_topic', { n: MIN_RANK }) + '</p>';
  }

  /* ---------- quiz ---------- */

  function startGame() {
    ensureTopics();
    let qs = [];
    try { qs = Quiz.generate(state.topic, state.count) || []; } catch (e) { qs = []; }
    if (!qs.length) {
      const me = $('menu-err');
      if (me) me.textContent = t('err_no_questions');
      return;
    }
    destroyMap();
    const games = playerGames();
    state.game = {
      topic: state.topic,
      count: state.count,
      questions: qs,
      idx: 0,
      correct: 0,
      answers: [],
      answered: false,
      picked: null,
      clicked: null,
      wasRight: false,
      map: null,
      saved: false,
      baseCorrect: Stats.overall(games).correct,
      streak0: Stats.streak(games),
      streak: Stats.streak(games),
      level0: Stats.level(Stats.overall(games).correct).level,
      cheer: 0
    };
    setAccent(state.topic);
    $('s-quiz').innerHTML = hudHtml(true) +
      '<div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" id="pbar-wrap"><div class="pfill" id="pbar"></div></div>' +
      '<div class="pinfo"><span id="pq"></span><span id="pp"></span></div><div id="qarea"></div>';
    buildQuestion();
    show('quiz');
  }

  function curQ() {
    return state.game.questions[state.game.idx];
  }

  function buildQuestion() {
    const g = state.game;
    const q = curQ();
    destroyMap();
    g.answered = false;
    g.picked = null;
    g.clicked = null;
    g.wasRight = false;
    if (q.kind === 'locate') {
      $('qarea').innerHTML =
        '<div class="mapcard locate"><div class="qtitle"><small id="qgrp"></small><span id="qprompt"></span></div><div class="mapbox wide" id="mapbox"></div><div class="fb" id="fb" role="status" aria-live="polite"></div></div>';
      g.map = GeoMap.create($('mapbox'), { lang: I18n.lang });
      g.map.locate({ view: q.mapView, layer: q.target.layer, onPick: (id) => answer(id) });
    } else if (q.image) {
      $('qarea').innerHTML =
        '<div class="qtitle flagtitle"><small id="qgrp"></small><span id="qprompt"></span></div>' +
        '<div class="qgrid flags"><div id="flagbox"></div><div><div id="opts"></div><div class="fb" id="fb" role="status" aria-live="polite"></div></div></div>';
    } else {
      $('qarea').innerHTML =
        '<div class="qgrid"><div><div class="qtitle"><small id="qgrp"></small><span id="qprompt"></span></div><div id="flagbox"></div><div id="opts"></div><div class="fb" id="fb" role="status" aria-live="polite"></div></div>' +
        '<div class="mapcard"><div class="mapbox" id="mapbox"><div class="ph" id="mapph"></div></div></div></div>';
    }
    paintQuiz();
  }

  function paintQuiz() {
    const g = state.game;
    if (!g || !$('qprompt')) return;
    const q = curQ();
    const n = g.questions.length;
    const lang = I18n.lang;
    const doneN = g.answers.length;
    $('pq').textContent = t('question') + ' ' + (g.idx + 1) + '/' + n;
    $('pp').textContent = (doneN ? Math.round(g.correct / doneN * 100) : 0) + ' % ' + t('correct_pct');
    const pct = Math.round(doneN / n * 100);
    $('pbar').style.width = pct + '%';
    $('pbar-wrap').setAttribute('aria-valuenow', String(pct));
    $('qgrp').textContent = topicIcon(g.topic) + ' ' + topicLabel(g.topic);
    $('qprompt').textContent = q.prompt[lang] + (q.kind === 'locate' && !g.answered ? ' · ' + t('locate_hint') : '');
    paintHud($('s-quiz'), g.baseCorrect + g.correct, g.streak);

    if (q.kind === 'mc') {
      const fbx = $('flagbox');
      if (fbx) {
        if (q.image && !fbx.firstChild) fbx.innerHTML = '<div class="flagcard"><img src="' + esc(q.image) + '" alt="' + esc(t('flag_alt')) + '" decoding="async"></div>';
        else if (q.image) fbx.firstChild.firstChild.alt = t('flag_alt');
      }
      $('opts').innerHTML = q.options.map((o, i) => {
        let cls = 'ans';
        if (g.answered) {
          if (o.id === q.answerId) cls += ' ok';
          else if (o.id === g.picked) cls += ' bad';
          else cls += ' dim';
        }
        return '<button type="button" class="' + cls + '" data-act="answer" data-id="' + esc(o.id) + '"' + (g.answered ? ' disabled' : '') + '>' +
          '<b aria-hidden="true">' + (i + 1) + '</b><span>' + esc(o.label[lang]) + '</span></button>';
      }).join('');
      const ph = $('mapph');
      if (ph) ph.textContent = t('map_placeholder');
    }

    const fb = $('fb');
    if (!g.answered) { fb.innerHTML = ''; }
    else {
      let msg;
      if (g.wasRight) msg = '<div class="msg ok">✨ ' + esc(t('cheer_' + g.cheer)) + ' <span class="sub">' + t('ok') + '</span></div>';
      else {
        const label = q.kind === 'mc'
          ? q.options.find((o) => o.id === q.answerId).label[lang]
          : areaName(q.target.layer, q.target.id);
        msg = '<div class="msg bad">' + esc(t('wrong_was', { answer: label })) + '</div>';
        if (q.kind === 'locate' && g.clicked != null) {
          msg += '<p class="note">' + esc(t('you_clicked', { name: areaName(q.target.layer, g.clicked) })) + '</p>';
        }
      }
      const last = g.idx >= n - 1;
      fb.innerHTML = msg + '<button type="button" class="next" data-act="next">' + (last ? t('finish') : t('next')) +
        ' <kbd>' + t('key_hint') + '</kbd></button>';
    }
    if (g.map) g.map.setLang(lang);
  }

  function flash(kind) {
    const e = $('edge');
    if (!e || reduced()) return;
    e.className = 'edge ' + kind;
    void e.offsetWidth;
    e.classList.add('go');
  }

  function floatXp(fromEl) {
    const f = document.createElement('div');
    f.className = 'float';
    f.textContent = t('xp_gain', { n: 10 });
    const r = fromEl ? fromEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: 200, width: 0 };
    f.style.left = (r.left + r.width / 2) + 'px';
    f.style.top = r.top + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1200);
    return r;
  }

  function answer(id) {
    const g = state.game;
    if (!g || g.answered) return;
    const q = curQ();
    const right = id === q.answerId;
    g.answered = true;
    g.picked = id;
    g.clicked = q.kind === 'locate' ? id : null;
    g.wasRight = right;
    if (right) { g.correct++; g.streak++; g.cheer = 1 + Math.floor(Math.random() * 6); } else g.streak = 0;
    g.answers.push({ itemKey: q.itemKey, correct: right });

    if (q.kind === 'mc' && q.image) {
      /* flags: no map */
    } else if (q.kind === 'mc') {
      const box = $('mapbox');
      box.innerHTML = '';
      g.map = GeoMap.create(box, { lang: I18n.lang });
      g.map.show({ view: q.mapView, layer: q.target.layer, targetId: q.target.id, city: q.target.city, clickedId: q.target.id, correct: right });
    } else {
      g.map.reveal({ targetId: q.target.id, clickedId: id });
    }
    if (g.idx >= g.questions.length - 1) saveGame();
    paintQuiz();
    if (q.kind === 'mc' && right) {
      const okBtn = document.querySelector('#opts .ans.ok');
      const r = floatXp(okBtn);
      if (!reduced()) confetti(r.left + r.width / 2, r.top + (r.height || 0) / 2, 50);
    } else if (right) {
      const r = floatXp($('mapbox'));
      if (!reduced()) confetti(window.innerWidth / 2, r.top + 60, 50);
    }
    flash(right ? 'ok' : 'bad');
    const nx = document.querySelector('#fb .next');
    if (nx) nx.focus({ preventScroll: true });
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(undefined), ms))]);
  }

  function saveGame() {
    const g = state.game;
    if (g.saved) return;
    g.saved = true;
    let before = {};
    try { before = Store.allGames(); } catch (e) { before = {}; }
    let game = null;
    try {
      game = {
        id: window.Sync ? Sync.newId() : undefined,
        topic: g.topic,
        count: g.count,
        correct: g.correct,
        total: g.questions.length,
        date: new Date().toISOString(),
        answers: g.answers.slice()
      };
      if (game.id === undefined) delete game.id;
      Store.recordGame(state.player, game);
    } catch (e) {
      g.saveError = true;
    }
    if (!game) return;
    const needFetch = syncOn() && !(state.centralOk && state.central);
    g.recordReady = (needFetch ? withTimeout(loadCentral(true), 1500) : Promise.resolve())
      .catch(() => {})
      .then(() => {
        const central = syncOn() && state.centralOk ? state.central : null;
        const absOk = !syncOn() || !!central;
        let merged = before;
        try { merged = keepValidAll(central ? Stats.merge(before, central) : before); } catch (e) { merged = before; }
        try {
          g.record = { st: Stats.recordStatus(merged, state.player, game), absOk: absOk, n: game.count === g.questions.length ? game.count : g.questions.length };
        } catch (e) { g.record = null; }
        if (syncOn()) {
          try {
            Promise.resolve(Sync.submitGame(state.player, game)).catch(() => {})
              .then(() => loadCentral(true))
              .then(() => { if (state.screen === 'menu') refreshMenuDynamic(); });
          } catch (e) { /* ignore */ }
        }
      });
  }

  function nextQuestion() {
    const g = state.game;
    if (!g || !g.answered) return;
    if (g.idx >= g.questions.length - 1) {
      g.nexting = true;
      Promise.resolve(g.recordReady).then(() => {
        if (state.screen !== 'quiz') return;
        renderResult();
        show('result');
        celebrate();
      });
      return;
    }
    g.idx++;
    buildQuestion();
    const h = $('qprompt');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  function quitGame() {
    destroyMap();
    openMenu();
  }

  /* ---------- result ---------- */

  function recordHtml(g) {
    const r = g.record;
    if (!r) return '';
    const st = r.st, n = g.questions.length;
    const pct = (x) => fmtPct(x);
    const items = [];
    const item = (cls, title, sub) => items.push('<div class="rec ' + cls + '"><b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>');
    const abs = r.absOk ? st.absolute : null;
    if (abs === 'new') item('gold', t('rec_abs_new', { n: n }), st.absoluteBest ? t('rec_prev_abs', { pct: pct(st.absoluteBest.pct), player: st.absoluteBest.player }) : '');
    if (st.personal === 'new') item('star', t('rec_pers_new', { n: n }), t('rec_prev_pers', { pct: pct(st.personalBest) }));
    if (st.personal === 'first' && (abs === 'first' || !r.absOk || abs !== 'first')) item('first', t('rec_first', { n: n }), '');
    if (st.personal === 'tie') item('tie', t('rec_tie_pers', { n: n, pct: pct(st.personalBest) }), '');
    if (abs === 'tie' && st.absoluteBest) item('tie', t('rec_tie_abs', { n: n, pct: pct(st.absoluteBest.pct), player: st.absoluteBest.player }), '');
    if (st.personal === 'none') {
      let line = t('rec_none_pers', { n: n, pers: pct(st.personalBest) });
      if (abs === 'none' && st.absoluteBest) line += ' · ' + t('rec_abs_best', { pct: pct(st.absoluteBest.pct), player: st.absoluteBest.player });
      item('none', line, '');
    } else if (st.personal === 'new' && abs === 'none' && st.absoluteBest) {
      items[items.length - 1] = items[items.length - 1].replace('</div>', '<span>' + esc(t('rec_abs_best', { pct: pct(st.absoluteBest.pct), player: st.absoluteBest.player })) + '</span></div>');
    }
    if (syncOn() && !r.absOk) items.push('<p class="sync warn">' + esc(t('rec_offline')) + '</p>');
    return items.length ? '<div class="recs">' + items.join('') + '</div>' : '';
  }

  function hasNewRecord(g) {
    const r = g.record;
    return !!(r && (r.st.personal === 'new' || (r.absOk && r.st.absolute === 'new')));
  }

  function renderResult() {
    const g = state.game;
    if (!g) return;
    const total = g.questions.length;
    const pct = total ? Math.round(g.correct / total * 100) : 0;
    const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;
    const msg = pct >= 90 ? 'msg_great' : pct >= 70 ? 'msg_good' : pct >= 50 ? 'msg_ok' : 'msg_low';
    const lvNow = Stats.level(g.baseCorrect + g.correct);
    $('s-result').innerHTML = '<div class="res">' +
      '<div class="rtxt">' + t(pct >= 70 ? 'res_win' : 'res_train') + '</div>' +
      '<div class="rsub topiclbl">' + topicIcon(g.topic) + ' ' + esc(topicLabel(g.topic)) + '</div>' +
      '<div class="stars" role="img" aria-label="' + stars + '/3">' + [0, 1, 2].map((i) => '<span class="' + (i < stars ? 'on' : '') + '" style="animation-delay:' + (i * 0.25) + 's">⭐</span>').join('') + '</div>' +
      '<div class="score">' + g.correct + '/' + total + '</div>' +
      '<div class="rtxt">' + pct + ' % ' + t('pct_correct_of') + '</div>' +
      '<p class="rsub">' + t(msg) + '</p>' + recordHtml(g) +
      '<div class="chips"><span class="chip">⚡ ' + t('xp_gain', { n: g.correct * 10 }) + '</span><span class="chip">🔥 ' + t('streak_chip', { n: g.streak }) + '</span>' +
      '<span class="chip">' + t('level') + ' ' + lvNow.level + ' · ' + t(lvNow.name) + '</span>' +
      (lvNow.level > g.level0 ? '<span class="chip up">⬆ ' + t('level_up', { n: lvNow.level }) + '</span>' : '') + '</div>' +
      (g.saveError ? '<p class="err">' + t('err_storage') + '</p>' : '') +
      '<div class="rbtns"><button type="button" class="big" data-act="again">↻ ' + t('again') + '</button>' +
      '<button type="button" class="sec" data-act="menu">' + t('menu') + '</button>' +
      '<button type="button" class="sec" data-act="stats">📊 ' + t('my_stats') + '</button></div></div>';
  }

  function celebrate() {
    const g = state.game;
    if (!g || reduced()) return;
    const pct = g.questions.length ? g.correct / g.questions.length * 100 : 0;
    if (pct < 70 && !hasNewRecord(g)) return;
    const w = window.innerWidth;
    confetti(w * 0.25, window.innerHeight * 0.3, 70);
    setTimeout(() => confetti(w * 0.75, window.innerHeight * 0.3, 70), 350);
    setTimeout(() => confetti(w * 0.5, window.innerHeight * 0.2, 80), 700);
  }

  /* ---------- confetti ---------- */

  let parts = [];
  let raf = 0;
  const COL = ['#2dff9a', '#ffd23f', '#ff5ecb', '#00e5ff', '#7a5cff', '#ff9a3d'];

  function confetti(x, y, n) {
    const cv = $('confetti');
    if (!cv || reduced()) return;
    if (cv.width !== window.innerWidth) cv.width = window.innerWidth;
    if (cv.height !== window.innerHeight) cv.height = window.innerHeight;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 9;
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 5, w: 6 + Math.random() * 7, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: COL[i % COL.length], life: 0 });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    const cv = $('confetti');
    const cx = cv.getContext('2d');
    cx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter((p) => p.life < 110 && p.y < cv.height + 20);
    parts.forEach((p) => {
      p.life++; p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      cx.save(); cx.globalAlpha = Math.min(1, (110 - p.life) / 30); cx.translate(p.x, p.y); cx.rotate(p.r);
      cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
    });
    raf = parts.length ? requestAnimationFrame(tick) : 0;
  }

  /* ---------- stats ---------- */

  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(I18n.lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtPct(x) {
    return (Math.round(x * 10) / 10).toString().replace('.', I18n.lang === 'es' ? ',' : '.');
  }

  function lineChart(points, topic) {
    const W = 320, H = 150, L = 30, R = 12, T = 12, B = 24;
    const pw = W - L - R, ph = H - T - B;
    const y = (p) => T + ph * (1 - p / 100);
    const x = (i) => (points.length === 1 ? L + pw / 2 : L + pw * i / (points.length - 1));
    const title = t('progress_for', { topic: topicLabel(topic) });
    const desc = t('progress_desc', { n: points.length, first: Math.round(points[0].pct), last: Math.round(points[points.length - 1].pct) });
    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="chart-t chart-d" style="--c:' + topicColor(topic) + '"><title id="chart-t">' + esc(title) + '</title><desc id="chart-d">' + esc(desc) + '</desc>';
    [0, 50, 100].forEach((v) => {
      s += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text class="axis" x="' + (L - 4) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v + '</text>';
    });
    if (points.length > 1) s += '<polyline class="line" points="' + points.map((p, i) => x(i).toFixed(1) + ',' + y(p.pct).toFixed(1)).join(' ') + '"/>';
    points.forEach((p, i) => {
      s += '<circle class="dot" cx="' + x(i).toFixed(1) + '" cy="' + y(p.pct).toFixed(1) + '" r="3.5"><title>' + esc(fmtDate(p.date) + ': ' + fmtPct(p.pct) + ' %') + '</title></circle>';
    });
    s += '<text class="axis" x="' + L + '" y="' + (H - 6) + '" text-anchor="start">' + esc(fmtDate(points[0].date)) + '</text>';
    if (points.length > 1) s += '<text class="axis" x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(fmtDate(points[points.length - 1].date)) + '</text>';
    return s + '</svg>';
  }

  function openStats() {
    renderStats();
    show('stats');
    if (!syncOn()) return;
    loadCentral().then(() => { if (state.screen === 'stats') renderStats(); });
  }

  function syncLine() {
    if (!syncOn()) return '';
    if (state.centralLoading) return '<p class="sync" role="status">' + t('loading') + '</p>';
    const pend = safePending();
    let msg, warn = false;
    if (!state.centralOk) { msg = t('sync_offline'); warn = true; }
    else if (pend > 0) msg = t('sync_pending', { n: pend });
    else msg = t('sync_ok');
    if (!state.centralOk && pend > 0) msg += ' · ' + t('sync_pending', { n: pend });
    return '<p class="sync' + (warn ? ' warn' : '') + '" role="status">' + esc(msg) + '</p>';
  }

  function renderStats() {
    const all = mergedAll();
    const games = ciGet(all, state.player);
    ensureTopics();
    const tl = topics().map((x) => x.id);
    const sum = Stats.topicSummary(games);
    const ov = Stats.overall(games);

    const rows = tl.filter((id) => sum[id]).map((id) =>
      '<tr><td><span aria-hidden="true">' + topicIcon(id) + '</span> ' + esc(topicLabel(id)) + '</td><td class="num">' + fmtPct(sum[id].pct) + ' %</td><td class="num">' + fmtPct(sum[id].bestPct) + ' %</td><td class="num">' + sum[id].games + '</td></tr>').join('');
    const summary = '<div class="panel"><h2>' + t('per_topic') + '</h2>' +
      (rows ? '<div class="scroll"><table><tr><th>' + t('topic') + '</th><th class="num">' + t('pct') + '</th><th class="num">' + t('best') + '</th><th class="num">' + t('games') + '</th></tr>' + rows + '</table></div>' +
        '<p class="note">' + t('overall') + ': ' + ov.correct + '/' + ov.total + ' · ' + fmtPct(ov.pct) + ' % · ' + ov.games + ' ' + t('games_unit') + '</p>'
        : '<p class="note">' + t('last_empty') + '</p>') + '</div>';

    const streak = '<div class="panel"><h2>' + t('streak') + '</h2><div class="kpi">🔥 ' + Stats.streak(games) + ' <span class="note">' + t('streak_unit') + '</span></div></div>';

    const miss = Stats.mostMissed(games, 5).filter((m) => m.missed > 0);
    const missed = '<div class="panel"><h2>' + t('missed') + '</h2>' + (miss.length
      ? '<ol class="missed">' + miss.map((m) => '<li>' + esc(itemName(m.itemKey)) + ' <span class="note">(' + esc(t('missed_times', { missed: m.missed, seen: m.seen })) + ')</span></li>').join('') + '</ol>'
      : '<p class="note">' + t('missed_empty') + '</p>') + '</div>';

    const last = Stats.lastGames(games, 5);
    const lastHtml = '<div class="panel"><h2>' + t('last_games') + '</h2>' + (last.length
      ? '<div class="scroll"><table><tr><th>' + t('date') + '</th><th>' + t('topic') + '</th><th class="num">' + t('score') + '</th></tr>' +
        last.map((gm) => '<tr><td>' + esc(fmtDate(gm.date)) + '</td><td>' + esc(topicLabel(gm.topic)) + '</td><td class="num">' + gm.correct + '/' + gm.total + '</td></tr>').join('') + '</table></div>'
      : '<p class="note">' + t('last_empty') + '</p>') + '</div>';

    const sel = '<select id="stats-topic" aria-label="' + esc(t('topic')) + '">' +
      tl.map((id) => '<option value="' + id + '"' + (id === state.statsTopic ? ' selected' : '') + '>' + esc(topicIcon(id) + ' ' + topicLabel(id)) + '</option>').join('') + '</select>';

    const rk = Stats.ranking(all, state.statsTopic, MIN_RANK);
    const ranking = '<div class="panel"><h2>' + t('rank_topic') + '</h2>' + sel + '<div class="rklist">' + (rk.length
      ? rankList(rk, 10) : '<p class="note">' + t('rank_empty') + '</p>') + '</div>' +
      '<p class="note">' + t('rank_min', { n: MIN_RANK }) + '</p></div>';
    let ork = [];
    try { ork = Stats.overallRanking ? Stats.overallRanking(all, MIN_RANK) : []; } catch (e) { ork = []; }
    const overallCard = '<div class="panel"><h2>' + t('rank_overall') + '</h2><div class="rklist">' + (ork.length ? rankList(ork, 10) : '<p class="note">' + t('rank_empty') + '</p>') + '</div>' +
      '<p class="note">' + t('rank_min', { n: MIN_RANK }) + '</p></div>';

    const prog = Stats.progress(games, state.statsTopic);
    const progress = '<div class="panel"><h2>' + t('progress') + ' · ' + esc(topicLabel(state.statsTopic)) + '</h2>' +
      (prog.length ? lineChart(prog, state.statsTopic) : '<p class="note">' + t('progress_empty') + '</p>') + '</div>';

    $('s-stats').innerHTML = hudHtml(false) +
      '<div class="stats-head"><h1>' + t('stats_title') + '</h1><button type="button" class="sec" data-act="menu">← ' + t('back') + '</button></div>' +
      summary + '<div class="stats-grid">' + streak + missed + '</div>' +
      '<div class="stats-grid">' + lastHtml + progress + '</div>' + syncLine() + '<div class="stats-grid">' + overallCard + ranking + '</div>';
    paintHud($('s-stats'), ov.correct, Stats.streak(games));
  }

  /* ---------- events ---------- */

  document.addEventListener('click', (e) => {
    const lb = e.target.closest('#lang-group button');
    if (lb) return setLang(lb.dataset.l);
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'del-player') deletePlayer(b.dataset.name);
    else if (a === 'pick-player') { let nm = b.dataset.name; try { nm = Store.addPlayer(nm); } catch (er) { /* keep name */ } enterMenu(nm); }
    else if (a === 'topic') {
      state.topic = b.dataset.topic;
      setAccent(state.topic);
      document.querySelectorAll('.tcard').forEach((c) => { const on = c.dataset.topic === state.topic; c.classList.toggle('sel', on); c.setAttribute('aria-pressed', String(on)); });
      paintRank();
    }
    else if (a === 'count') {
      state.count = +b.dataset.n;
      document.querySelectorAll('.seg button').forEach((c) => { const on = +c.dataset.n === state.count; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
    }
    else if (a === 'quit') quitGame();
    else if (a === 'start') startGame();
    else if (a === 'answer') answer(b.dataset.id);
    else if (a === 'next') nextQuestion();
    else if (a === 'again') { state.topic = state.game.topic; state.count = state.game.count; startGame(); }
    else if (a === 'menu') openMenu();
    else if (a === 'stats') openStats();
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'player-form') { e.preventDefault(); submitPlayer(); }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'stats-topic') {
      state.statsTopic = e.target.value;
      renderStats();
      $('stats-topic').focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (splashActive) {
      if (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); endSplash(); }
      return;
    }
    if (state.screen !== 'quiz' || !state.game) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const g = state.game;
    if (e.code === 'Space') {
      if (!g.answered) return;
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      nextQuestion();
      return;
    }
    const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
    if (m && !g.answered && curQ().kind === 'mc') {
      const o = curQ().options[+m[1] - 1];
      if (o) { e.preventDefault(); answer(o.id); }
    }
  });

  /* ---------- splash ---------- */

  let splashActive = true;
  let splashTimer = null;

  function buildSplashTitle() {
    const colors = ['#ff4d6d', '#ffd23f', '#2dff9a', '#3d8bff', '#c46bff', '#ff5ecb', '#00e5ff'];
    const rot = [-8, 6, -4, 9, -6, 5, -9, 4, -5];
    const text = t('splash_title');
    const h = $('splash-title');
    h.setAttribute('aria-label', text);
    let i = 0;
    text.split(' ').forEach((w) => {
      const g = document.createElement('div');
      g.className = 'w';
      g.setAttribute('aria-hidden', 'true');
      Array.from(w).forEach((ch) => {
        const s = document.createElement('span');
        s.textContent = ch;
        s.style.setProperty('--i', i);
        s.style.setProperty('--r', rot[i % rot.length] + 'deg');
        s.style.setProperty('--s', ch === '?' ? 1.25 : (i % 3 === 0 ? 1.1 : 1));
        s.style.color = colors[i % colors.length];
        g.appendChild(s);
        i++;
      });
      h.appendChild(g);
    });
  }

  function endSplash() {
    if (!splashActive) return;
    splashActive = false;
    clearTimeout(splashTimer);
    const sp = $('splash');
    if (sp) sp.remove();
    const inp = $('player-name');
    if (inp && state.screen === 'player') inp.focus();
  }

  /* ---------- init ---------- */

  function init() {
    applyLang();
    buildSplashTitle();
    $('splash').addEventListener('click', endSplash);
    splashTimer = setTimeout(endSplash, 5000);
    renderPlayer();
    show('player');
    if (syncOn()) loadCentral().then(() => { if (state.screen === 'menu') refreshMenuDynamic(); if (state.screen === 'player') { const v = $('player-name') ? $('player-name').value : ''; renderPlayer(); if ($('player-name')) $('player-name').value = v; } });
  }

  init();
})();
