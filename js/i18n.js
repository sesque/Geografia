(function (root) {
  const TOPIC_IDS = ['es_ccaa_cap', 'es_ccaa_prov', 'world_europa', 'world_america', 'world_asia', 'world_oceania', 'world_africa',
    'loc_prov', 'loc_ccaa', 'loc_europa', 'loc_america', 'loc_asia', 'loc_oceania', 'loc_africa'];

  const dict = {
    es: {
      title: 'Geografía',
      splash_title: '¿Dónde está Burgos?',
      splash_skip: 'Clic o espacio para saltar',
      new_player: 'Nuevo jugador',
      name: 'Nombre',
      enter: 'Entrar',
      existing: 'Jugadores existentes',
      no_players: 'Todavía no hay jugadores',
      hi: 'Hola',
      my_stats: 'Mis estadísticas',
      group_spain: 'España',
      group_world: 'Mundo (países y capitales)',
      group_locate: 'Situar en el mapa',
      count: 'Nº de preguntas',
      start: 'Empezar',
      question: 'Pregunta',
      correct_pct: 'aciertos',
      ok: '¡Correcto!',
      wrong_was: 'Incorrecto. Era {answer}',
      you_clicked: 'Has hecho clic en {name}',
      you_clicked_here: 'Has hecho clic aquí',
      next: 'Siguiente',
      finish: 'Ver resultado',
      key_space: '(barra espaciadora)',
      result: 'Resultado',
      again: 'Repetir',
      menu: 'Menú',
      back: 'Volver',
      stats_title: 'Estadísticas',
      per_topic: 'Resumen por tema',
      topic: 'Tema',
      pct: '% aciertos',
      best: 'Mejor',
      games: 'Partidas',
      rank: 'Ranking por tema',
      rank_min: 'Mínimo {n} respuestas en el tema',
      rank_empty: 'Aún no hay jugadores con suficientes respuestas',
      player: 'Jugador',
      answers: 'Respuestas',
      missed: 'Más falladas',
      missed_empty: 'Sin fallos todavía',
      missed_times: '{missed} de {seen}',
      streak: 'Racha actual',
      streak_unit: 'seguidas',
      last_games: 'Últimas partidas',
      last_empty: 'Aún no has jugado ninguna partida',
      date: 'Fecha',
      score: 'Aciertos',
      progress: 'Progreso',
      progress_for: 'Progreso en {topic}',
      progress_desc: '{n} partidas, de {first} % a {last} % de aciertos',
      progress_empty: 'Juega al menos una partida de este tema para ver la gráfica',
      overall: 'Total',
      err_empty: 'Escribe un nombre',
      err_long: 'El nombre no puede tener más de 24 caracteres',
      err_generic: 'No se pudo crear el jugador',
      err_no_questions: 'No hay preguntas para este tema',
      err_storage: 'No se pudo guardar la partida',
      lang_label: 'Idioma',
      loading: 'Cargando…',
      sync_ok: 'Sincronizado con el marcador de la familia',
      sync_offline: 'Sin conexión: se muestran solo los datos de este dispositivo',
      sync_pending: '{n} partidas pendientes de sincronizar',
      rank_overall: 'Ranking general (todos los temas)',
      rank_topic: 'Ranking por tema',
      medal_1: 'Primer puesto',
      medal_2: 'Segundo puesto',
      medal_3: 'Tercer puesto',
      central_players: 'Jugadores de la familia',
      you: 'tú',
      map_placeholder: 'El mapa aparecerá al responder',
      locate_hint: 'Haz clic en el mapa',
      games_unit: 'partidas',
      fewer: 'Este tema solo tiene {n} elementos: se jugarán todos',
      msg_great: '¡Excelente!',
      msg_good: '¡Muy bien!',
      msg_ok: 'Buen intento, ¡a seguir practicando!',
      msg_low: 'A repasar un poco más',
      'topic.es_ccaa_cap': 'Capitales de comunidades autónomas',
      'topic.es_ccaa_prov': 'Provincias de comunidades autónomas',
      'topic.world_europa': 'Europa',
      'topic.world_america': 'América',
      'topic.world_asia': 'Asia',
      'topic.world_oceania': 'Oceanía',
      'topic.world_africa': 'África',
      'topic.loc_prov': 'Provincias',
      'topic.loc_ccaa': 'Comunidades',
      'topic.loc_europa': 'Países: Europa',
      'topic.loc_america': 'Países: América',
      'topic.loc_asia': 'Países: Asia',
      'topic.loc_oceania': 'Países: Oceanía',
      'topic.loc_africa': 'Países: África'
    },
    en: {
      title: 'Geography',
      splash_title: 'Where is Burgos?',
      splash_skip: 'Click or press space to skip',
      new_player: 'New player',
      name: 'Name',
      enter: 'Enter',
      existing: 'Existing players',
      no_players: 'No players yet',
      hi: 'Hi',
      my_stats: 'My stats',
      group_spain: 'Spain',
      group_world: 'World (countries and capitals)',
      group_locate: 'Locate on the map',
      count: 'Number of questions',
      start: 'Start',
      question: 'Question',
      correct_pct: 'correct',
      ok: 'Correct!',
      wrong_was: 'Wrong. It was {answer}',
      you_clicked: 'You clicked {name}',
      you_clicked_here: 'You clicked here',
      next: 'Next',
      finish: 'See result',
      key_space: '(space bar)',
      result: 'Result',
      again: 'Play again',
      menu: 'Menu',
      back: 'Back',
      stats_title: 'Statistics',
      per_topic: 'Summary by topic',
      topic: 'Topic',
      pct: '% correct',
      best: 'Best',
      games: 'Games',
      rank: 'Ranking by topic',
      rank_min: 'At least {n} answers in the topic',
      rank_empty: 'No players with enough answers yet',
      player: 'Player',
      answers: 'Answers',
      missed: 'Most missed',
      missed_empty: 'No mistakes yet',
      missed_times: '{missed} of {seen}',
      streak: 'Current streak',
      streak_unit: 'in a row',
      last_games: 'Last games',
      last_empty: 'You have not played any game yet',
      date: 'Date',
      score: 'Score',
      progress: 'Progress',
      progress_for: 'Progress in {topic}',
      progress_desc: '{n} games, from {first}% to {last}% correct',
      progress_empty: 'Play at least one game of this topic to see the chart',
      overall: 'Overall',
      err_empty: 'Enter a name',
      err_long: 'The name cannot be longer than 24 characters',
      err_generic: 'The player could not be created',
      err_no_questions: 'There are no questions for this topic',
      err_storage: 'The game could not be saved',
      lang_label: 'Language',
      loading: 'Loading…',
      sync_ok: 'Synced with the family scoreboard',
      sync_offline: 'Offline: showing this device only',
      sync_pending: '{n} games waiting to sync',
      rank_overall: 'Overall ranking (all topics)',
      rank_topic: 'Ranking by topic',
      medal_1: 'First place',
      medal_2: 'Second place',
      medal_3: 'Third place',
      central_players: 'Family players',
      you: 'you',
      map_placeholder: 'The map will appear after you answer',
      locate_hint: 'Click on the map',
      games_unit: 'games',
      fewer: 'This topic only has {n} items: all of them will be played',
      msg_great: 'Excellent!',
      msg_good: 'Very good!',
      msg_ok: 'Good try, keep practising!',
      msg_low: 'Time for a bit more review',
      'topic.es_ccaa_cap': 'Capitals of autonomous communities',
      'topic.es_ccaa_prov': 'Provinces of autonomous communities',
      'topic.world_europa': 'Europe',
      'topic.world_america': 'Americas',
      'topic.world_asia': 'Asia',
      'topic.world_oceania': 'Oceania',
      'topic.world_africa': 'Africa',
      'topic.loc_prov': 'Provinces',
      'topic.loc_ccaa': 'Communities',
      'topic.loc_europa': 'Countries: Europe',
      'topic.loc_america': 'Countries: Americas',
      'topic.loc_asia': 'Countries: Asia',
      'topic.loc_oceania': 'Countries: Oceania',
      'topic.loc_africa': 'Countries: Africa'
    }
  };

  // Quiz.TOPICS labelKey may be either 'topic.<id>' or the bare id.
  TOPIC_IDS.forEach(function (id) {
    dict.es[id] = dict.es['topic.' + id];
    dict.en[id] = dict.en['topic.' + id];
  });

  const LANGS = ['es', 'en'];
  const warned = {};
  let current = null;

  function store() {
    try { return root.Store || null; } catch (e) { return null; }
  }

  function has(key, lang) {
    return !!(dict[lang || I18n.lang] && Object.prototype.hasOwnProperty.call(dict[lang || I18n.lang], key));
  }

  function t(key, lang, vars) {
    const l = LANGS.indexOf(lang) >= 0 ? lang : I18n.lang;
    let s = dict[l] && dict[l][key];
    if (typeof s !== 'string') {
      if (!warned[key]) {
        warned[key] = true;
        if (typeof console !== 'undefined') console.warn('i18n: missing key ' + key);
      }
      return key;
    }
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }

  const I18n = { t: t, has: has, dict: dict, langs: LANGS };
  Object.defineProperty(I18n, 'lang', {
    enumerable: true,
    get: function () {
      if (current) return current;
      let l = null;
      try { const s = store(); l = s && s.getSetting('lang'); } catch (e) { l = null; }
      current = LANGS.indexOf(l) >= 0 ? l : 'es';
      return current;
    },
    set: function (l) {
      if (LANGS.indexOf(l) < 0) return;
      current = l;
      try { const s = store(); if (s) s.setSetting('lang', l); } catch (e) { /* ignore */ }
    }
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = I18n;
  else root.I18n = I18n;
})(typeof window !== 'undefined' ? window : globalThis);
