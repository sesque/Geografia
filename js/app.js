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
    topic: 'es_prov',
    count: 10,
    statsTopic: 'es_prov',
    playerError: null,
    central: null,
    centralLoading: false,
    syncInfo: null,
    game: null
  };

  const syncOn = () => !!(window.Sync && window.Sync.enabled && window.Sync.enabled());

  function ciGet(obj, name) {
    const k = Object.keys(obj || {}).find((x) => x.toLowerCase() === String(name).toLowerCase());
    return k ? obj[k] : [];
  }

  function loadCentral() {
    if (!syncOn()) return Promise.resolve(null);
    state.centralLoading = true;
    return Promise.resolve().then(() => Sync.fetchAll()).catch(() => null).then((c) => {
      state.centralLoading = false;
      state.central = c;
      state.syncInfo = { ok: !!c, pending: safePending() };
      return c;
    });
  }

  function safePending() {
    try { return Sync.pending() || 0; } catch (e) { return 0; }
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

  /* ---------- player ---------- */

  function renderPlayer() {
    let names = [];
    try { names = Store.listPlayers(); } catch (e) { names = []; }
    const lower = names.map((n) => n.toLowerCase());
    const remote = state.central ? Object.keys(state.central).filter((n) => lower.indexOf(n.toLowerCase()) < 0).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())) : [];
    const err = state.playerError;
    $('s-player').innerHTML =
      '<div class="card"><h2>' + t('new_player') + '</h2>' +
      '<form class="row" id="player-form" novalidate>' +
      '<input id="player-name" maxlength="60" autocomplete="off" placeholder="' + esc(t('name')) + '" aria-label="' + esc(t('name')) + '"' + (err ? ' aria-invalid="true" aria-describedby="player-err"' : '') + '>' +
      '<button type="submit" class="on">' + t('enter') + '</button></form>' +
      '<p class="err" id="player-err" role="alert">' + (err ? esc(err) : '') + '</p>' +
      ((names.length || !remote.length) ? '<h2>' + t('existing') + '</h2>' : '') +
      (names.length
        ? '<div class="row">' + names.map((n) => '<button type="button" data-act="pick-player" data-name="' + esc(n) + '">' + esc(n) + '</button>').join('') + '</div>'
        : (remote.length ? '' : '<p class="note">' + t('no_players') + '</p>')) +
      (remote.length ? '<h2>' + t('central_players') + '</h2><div class="row">' + remote.map((n) => '<button type="button" data-act="pick-player" data-name="' + esc(n) + '">' + esc(n) + '</button>').join('') + '</div>' : '') +
      '</div>';
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
    renderMenu();
    show('menu');
  }

  /* ---------- menu ---------- */

  function chip(id) {
    return '<button type="button" aria-pressed="' + (state.topic === id) + '" data-act="topic" data-topic="' + id + '">' + esc(topicLabel(id)) + '</button>';
  }

  function renderMenu() {
    const groups = { spain: [], world: [], locate: [] };
    topics().forEach((x) => { if (groups[x.group]) groups[x.group].push(x.id); });
    const sec = (key, ids) => '<h2>' + t(key) + '</h2><div class="row">' + ids.map(chip).join('') + '</div>';
    $('s-menu').innerHTML =
      '<div class="row between"><b>' + t('hi') + ', ' + esc(state.player || '') + '</b>' +
      '<button type="button" data-act="stats">' + t('my_stats') + '</button></div>' +
      sec('group_spain', groups.spain) + sec('group_world', groups.world) + sec('group_locate', groups.locate) +
      '<h2>' + t('count') + '</h2><div class="row">' +
      COUNTS.map((n) => '<button type="button" aria-pressed="' + (state.count === n) + '" data-act="count" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<p><button type="button" class="on" data-act="start">' + t('start') + '</button></p>' +
      '<p class="err" id="menu-err" role="alert"></p>';
  }

  /* ---------- quiz ---------- */

  function startGame() {
    let qs = [];
    try { qs = Quiz.generate(state.topic, state.count) || []; } catch (e) { qs = []; }
    if (!qs.length) {
      $('menu-err').textContent = t('err_no_questions');
      return;
    }
    destroyMap();
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
      saved: false
    };
    buildQuiz();
    show('quiz');
  }

  function curQ() {
    return state.game.questions[state.game.idx];
  }

  function buildQuiz() {
    const g = state.game;
    const q = curQ();
    destroyMap();
    g.answered = false;
    g.picked = null;
    g.clicked = null;
    g.wasRight = false;
    const head = '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" id="pbar-wrap"><i id="pbar"></i></div>' +
      '<p class="note prog"><span id="pq"></span><span id="pp"></span></p>';
    if (q.kind === 'locate') {
      $('s-quiz').innerHTML = head +
        '<div class="card"><h3 id="qprompt"></h3><div class="mapbox wide" id="mapbox"></div><div class="fb" id="fb" role="status" aria-live="polite"></div></div>';
      g.map = GeoMap.create($('mapbox'), { lang: I18n.lang });
      g.map.locate({ view: q.mapView, layer: q.target.layer, onPick: (id) => answer(id) });
    } else {
      $('s-quiz').innerHTML = head +
        '<div class="quiz"><div class="card"><h3 id="qprompt"></h3><div id="opts"></div><div class="fb" id="fb" role="status" aria-live="polite"></div></div>' +
        '<div class="card"><div class="mapbox" id="mapbox"><div class="ph" id="mapph"></div></div></div></div>';
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
    $('qprompt').textContent = q.prompt[lang] + (q.kind === 'locate' && !g.answered ? ' ' + '· ' + t('locate_hint') : '');

    if (q.kind === 'mc') {
      $('opts').innerHTML = q.options.map((o, i) => {
        let cls = 'opt';
        if (g.answered) {
          if (o.id === q.answerId) cls += ' ok';
          else if (o.id === g.picked) cls += ' bad';
        }
        return '<button type="button" class="' + cls + '" data-act="answer" data-id="' + esc(o.id) + '"' + (g.answered ? ' disabled' : '') + '>' +
          '<span class="k">' + (i + 1) + '</span> ' + esc(o.label[lang]) + '</button>';
      }).join('');
      const ph = $('mapph');
      if (ph) ph.textContent = t('map_placeholder');
    }

    const fb = $('fb');
    if (!g.answered) { fb.innerHTML = ''; }
    else {
      let msg;
      if (g.wasRight) msg = '<p class="good"><b>' + t('ok') + '</b></p>';
      else {
        const label = q.kind === 'mc'
          ? q.options.find((o) => o.id === q.answerId).label[lang]
          : areaName(q.target.layer, q.target.id);
        msg = '<p class="miss"><b>' + esc(t('wrong_was', { answer: label })) + '</b></p>';
        if (q.kind === 'locate' && g.clicked != null) {
          msg += '<p class="note">' + esc(t('you_clicked', { name: areaName(q.target.layer, g.clicked) })) + '</p>';
        }
      }
      const last = g.idx >= n - 1;
      fb.innerHTML = msg + '<button type="button" class="on next" data-act="next">' + (last ? t('finish') : t('next')) +
        ' <small>' + t('key_space') + '</small></button>';
    }
    if (g.map) g.map.setLang(lang);
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
    if (right) g.correct++;
    g.answers.push({ itemKey: q.itemKey, correct: right });

    if (q.kind === 'mc') {
      const box = $('mapbox');
      box.innerHTML = '';
      g.map = GeoMap.create(box, { lang: I18n.lang });
      g.map.show({ view: q.mapView, layer: q.target.layer, targetId: q.target.id, city: q.target.city, clickedId: q.target.id, correct: right });
    } else {
      g.map.reveal({ targetId: q.target.id, clickedId: id });
    }
    if (g.idx >= g.questions.length - 1) saveGame();
    paintQuiz();
    const nx = document.querySelector('#fb .next');
    if (nx) nx.focus({ preventScroll: true });
  }

  function saveGame() {
    const g = state.game;
    if (g.saved) return;
    g.saved = true;
    try {
      const game = {
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
      if (syncOn()) {
        try { Promise.resolve(Sync.submitGame(state.player, game)).catch(() => {}); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      g.saveError = true;
    }
  }

  function nextQuestion() {
    const g = state.game;
    if (!g || !g.answered) return;
    if (g.idx >= g.questions.length - 1) {
      renderResult();
      show('result');
      return;
    }
    g.idx++;
    buildQuiz();
    const h = $('qprompt');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  /* ---------- result ---------- */

  function renderResult() {
    const g = state.game;
    if (!g) return;
    const total = g.questions.length;
    const pct = total ? Math.round(g.correct / total * 100) : 0;
    const msg = pct >= 90 ? 'msg_great' : pct >= 70 ? 'msg_good' : pct >= 50 ? 'msg_ok' : 'msg_low';
    $('s-result').innerHTML =
      '<div class="card"><h2>' + t('result') + ' · ' + esc(topicLabel(g.topic)) + '</h2>' +
      '<div class="big">' + g.correct + '/' + total + ' · ' + pct + ' %</div>' +
      '<p>' + t(msg) + '</p>' +
      (g.saveError ? '<p class="err">' + t('err_storage') + '</p>' : '') +
      '<div class="row"><button type="button" class="on" data-act="again">' + t('again') + '</button>' +
      '<button type="button" data-act="menu">' + t('menu') + '</button>' +
      '<button type="button" data-act="stats">' + t('my_stats') + '</button></div></div>';
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
    let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="chart-t chart-d"><title id="chart-t">' + esc(title) + '</title><desc id="chart-d">' + esc(desc) + '</desc>';
    [0, 50, 100].forEach((v) => {
      s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
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

  function rankTable(rk) {
    const medals = ['🥇', '🥈', '🥉'];
    return '<div class="scroll"><table><tr><th>#</th><th>' + t('player') + '</th><th class="num">' + t('pct') + '</th><th class="num">' + t('answers') + '</th></tr>' +
      rk.map((r, i) => {
        const me = r.player.toLowerCase() === String(state.player).toLowerCase();
        const pos = i < 3 ? '<span class="medal" role="img" aria-label="' + esc(t('medal_' + (i + 1))) + '">' + medals[i] + '</span>' : (i + 1);
        return '<tr' + (me ? ' class="me"' : '') + '><td>' + pos + '</td><td>' + esc(r.player) + (me ? ' <span class="note">(' + t('you') + ')</span>' : '') + '</td><td class="num">' + fmtPct(r.pct) + ' %</td><td class="num">' + r.total + '</td></tr>';
      }).join('') + '</table></div>';
  }

  function syncLine() {
    if (!syncOn()) return '';
    if (state.centralLoading) return '<p class="sync" role="status">' + t('loading') + '</p>';
    const pend = safePending();
    let msg, warn = false;
    if (!state.central) { msg = t('sync_offline'); warn = true; }
    else if (pend > 0) msg = t('sync_pending', { n: pend });
    else msg = t('sync_ok');
    if (!state.central && pend > 0) msg += ' · ' + t('sync_pending', { n: pend });
    return '<p class="sync' + (warn ? ' warn' : '') + '" role="status">' + esc(msg) + '</p>';
  }

  function renderStats() {
    let games = [], all = {};
    try {
      games = Store.getGames(state.player); all = Store.allGames();
      if (syncOn() && state.central) {
        all = Stats.merge(all, state.central);
        games = ciGet(all, state.player);
      }
    } catch (e) { games = []; all = {}; }
    const tl = topics().map((x) => x.id);
    if (tl.indexOf(state.statsTopic) < 0) state.statsTopic = tl[0];
    const sum = Stats.topicSummary(games);
    const ov = Stats.overall(games);

    const rows = tl.filter((id) => sum[id]).map((id) =>
      '<tr><td>' + esc(topicLabel(id)) + '</td><td class="num">' + fmtPct(sum[id].pct) + ' %</td><td class="num">' + fmtPct(sum[id].bestPct) + ' %</td><td class="num">' + sum[id].games + '</td></tr>').join('');
    const summary = '<div class="card"><h2>' + t('per_topic') + '</h2>' +
      (rows ? '<div class="scroll"><table><tr><th>' + t('topic') + '</th><th class="num">' + t('pct') + '</th><th class="num">' + t('best') + '</th><th class="num">' + t('games') + '</th></tr>' + rows + '</table></div>' +
        '<p class="note">' + t('overall') + ': ' + ov.correct + '/' + ov.total + ' · ' + fmtPct(ov.pct) + ' % · ' + ov.games + ' ' + t('games_unit') + '</p>'
        : '<p class="note">' + t('last_empty') + '</p>') + '</div>';

    const streak = '<div class="card"><h2>' + t('streak') + '</h2><div class="kpi">' + Stats.streak(games) + ' <span class="note">' + t('streak_unit') + '</span></div></div>';

    const miss = Stats.mostMissed(games, 5).filter((m) => m.missed > 0);
    const missed = '<div class="card"><h2>' + t('missed') + '</h2>' + (miss.length
      ? '<ol class="missed">' + miss.map((m) => '<li>' + esc(itemName(m.itemKey)) + ' <span class="note">(' + esc(t('missed_times', { missed: m.missed, seen: m.seen })) + ')</span></li>').join('') + '</ol>'
      : '<p class="note">' + t('missed_empty') + '</p>') + '</div>';

    const last = Stats.lastGames(games, 5);
    const lastHtml = '<div class="card"><h2>' + t('last_games') + '</h2>' + (last.length
      ? '<div class="scroll"><table><tr><th>' + t('date') + '</th><th>' + t('topic') + '</th><th class="num">' + t('score') + '</th></tr>' +
        last.map((gm) => '<tr><td>' + esc(fmtDate(gm.date)) + '</td><td>' + esc(topicLabel(gm.topic)) + '</td><td class="num">' + gm.correct + '/' + gm.total + '</td></tr>').join('') + '</table></div>'
      : '<p class="note">' + t('last_empty') + '</p>') + '</div>';

    const sel = '<select id="stats-topic" aria-label="' + esc(t('topic')) + '">' +
      tl.map((id) => '<option value="' + id + '"' + (id === state.statsTopic ? ' selected' : '') + '>' + esc(topicLabel(id)) + '</option>').join('') + '</select>';

    const rk = Stats.ranking(all, state.statsTopic, MIN_RANK);
    const ranking = '<div class="card"><h2>' + t('rank_topic') + '</h2><div class="row between">' + sel + '</div>' + (rk.length
      ? rankTable(rk) : '<p class="note">' + t('rank_empty') + '</p>') +
      '<p class="note">' + t('rank_min', { n: MIN_RANK }) + '</p></div>';
    let ork = [];
    try { ork = Stats.overallRanking ? Stats.overallRanking(all, MIN_RANK) : []; } catch (e) { ork = []; }
    const overallCard = '<div class="card"><h2>' + t('rank_overall') + '</h2>' + (ork.length ? rankTable(ork) : '<p class="note">' + t('rank_empty') + '</p>') +
      '<p class="note">' + t('rank_min', { n: MIN_RANK }) + '</p></div>';

    const prog = Stats.progress(games, state.statsTopic);
    const progress = '<div class="card"><h2>' + t('progress') + ' · ' + esc(topicLabel(state.statsTopic)) + '</h2>' +
      (prog.length ? lineChart(prog, state.statsTopic) : '<p class="note">' + t('progress_empty') + '</p>') + '</div>';

    $('s-stats').innerHTML =
      '<div class="row between"><h2>' + t('stats_title') + ' · ' + esc(state.player || '') + '</h2><button type="button" data-act="menu">' + t('back') + '</button></div>' +
      summary + '<div class="stats-grid">' + streak + missed + '</div><div style="height:16px"></div>' +
      '<div class="stats-grid">' + lastHtml + progress + '</div><div style="height:16px"></div>' + syncLine() + '<div class="stats-grid">' + overallCard + ranking + '</div>';
  }

  /* ---------- events ---------- */

  document.addEventListener('click', (e) => {
    const lb = e.target.closest('#lang-group button');
    if (lb) return setLang(lb.dataset.l);
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'pick-player') { let nm = b.dataset.name; try { nm = Store.addPlayer(nm); } catch (er) { /* keep name */ } enterMenu(nm); }
    else if (a === 'topic') { state.topic = b.dataset.topic; renderMenu(); const f = document.querySelector('[data-topic="' + state.topic + '"]'); if (f) f.focus(); }
    else if (a === 'count') { state.count = +b.dataset.n; renderMenu(); const f = document.querySelector('[data-n="' + state.count + '"]'); if (f) f.focus(); }
    else if (a === 'start') startGame();
    else if (a === 'answer') answer(b.dataset.id);
    else if (a === 'next') nextQuestion();
    else if (a === 'again') { state.topic = state.game.topic; state.count = state.game.count; startGame(); }
    else if (a === 'menu') { renderMenu(); show('menu'); }
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
    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
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
    if (syncOn()) loadCentral().then(() => { if (state.screen === 'player') { const v = $('player-name') ? $('player-name').value : ''; renderPlayer(); if ($('player-name')) $('player-name').value = v; } });
  }

  init();
})();
