const test = require('node:test');
const assert = require('node:assert/strict');
const Stats = require('../js/stats.js');

function game(overrides) {
  return Object.assign({
    topic: 'es_prov',
    count: 2,
    correct: 1,
    total: 2,
    date: '2026-01-01T10:00:00.000Z',
    answers: [
      { itemKey: 'prov:09', correct: true },
      { itemKey: 'prov:08', correct: false }
    ]
  }, overrides);
}

test('topicSummary aggregates per topic with 1-decimal pct and bestPct', () => {
  const games = [
    game({ correct: 1, total: 3, date: '2026-01-01T10:00:00.000Z' }),
    game({ correct: 2, total: 3, date: '2026-01-02T10:00:00.000Z' }),
    game({ topic: 'es_ccaa', correct: 3, total: 3, date: '2026-01-03T10:00:00.000Z' })
  ];
  assert.deepEqual(Stats.topicSummary(games), {
    es_prov: { games: 2, correct: 3, total: 6, pct: 50, bestPct: 66.7 },
    es_ccaa: { games: 1, correct: 3, total: 3, pct: 100, bestPct: 100 }
  });
});

test('topicSummary rounds to one decimal and handles empty input', () => {
  assert.deepEqual(Stats.topicSummary([]), {});
  assert.deepEqual(Stats.topicSummary(undefined), {});
  const summary = Stats.topicSummary([game({ correct: 1, total: 3 })]);
  assert.equal(summary.es_prov.pct, 33.3);
});

test('ranking applies minTotal, sorts by pct then total, and handles empty input', () => {
  const allGames = {
    Ana: [game({ correct: 9, total: 10 })],
    Bea: [game({ correct: 18, total: 20 })],
    Carla: [game({ correct: 5, total: 5 })],
    Dan: [game({ topic: 'es_ccaa', correct: 10, total: 10 })],
    Eve: [game({ correct: 9, total: 10 }), game({ correct: 9, total: 10 })]
  };
  assert.deepEqual(Stats.ranking(allGames, 'es_prov'), [
    { player: 'Bea', pct: 90, total: 20, games: 1 },
    { player: 'Eve', pct: 90, total: 20, games: 2 },
    { player: 'Ana', pct: 90, total: 10, games: 1 }
  ]);
  assert.deepEqual(Stats.ranking(allGames, 'es_prov', 20).map((r) => r.player), ['Bea', 'Eve']);
  assert.deepEqual(Stats.ranking(allGames, 'es_prov', 0).map((r) => r.player), ['Carla', 'Bea', 'Eve', 'Ana']);
  assert.deepEqual(Stats.ranking(allGames, 'world_asia'), []);
  assert.deepEqual(Stats.ranking({}, 'es_prov'), []);
  assert.deepEqual(Stats.ranking(null, 'es_prov'), []);
});

test('mostMissed sorts by missed then miss rate and respects n', () => {
  const games = [
    game({
      answers: [
        { itemKey: 'prov:09', correct: false },
        { itemKey: 'prov:08', correct: false },
        { itemKey: 'prov:10', correct: true },
        { itemKey: 'prov:11', correct: false }
      ]
    }),
    game({
      answers: [
        { itemKey: 'prov:09', correct: false },
        { itemKey: 'prov:08', correct: true },
        { itemKey: 'prov:10', correct: false },
        { itemKey: 'prov:11', correct: false }
      ]
    })
  ];
  const rows = Stats.mostMissed(games);
  assert.deepEqual(rows, [
    { itemKey: 'prov:09', missed: 2, seen: 2 },
    { itemKey: 'prov:11', missed: 2, seen: 2 },
    { itemKey: 'prov:08', missed: 1, seen: 2 },
    { itemKey: 'prov:10', missed: 1, seen: 2 }
  ]);
  assert.equal(Stats.mostMissed(games, 2).length, 2);
  assert.deepEqual(Stats.mostMissed([]), []);
  assert.deepEqual(Stats.mostMissed(undefined), []);
});

test('mostMissed breaks equal missed counts by miss rate', () => {
  const games = [
    game({ answers: [{ itemKey: 'a', correct: false }, { itemKey: 'b', correct: false }] }),
    game({ answers: [{ itemKey: 'b', correct: true }] }),
    game({ answers: [{ itemKey: 'b', correct: true }] })
  ];
  const rows = Stats.mostMissed(games);
  assert.deepEqual(rows[0], { itemKey: 'a', missed: 1, seen: 1 });
  assert.deepEqual(rows[1], { itemKey: 'b', missed: 1, seen: 3 });
});

test('streak counts consecutive correct answers across games, newest backwards', () => {
  const games = [
    game({ answers: [{ itemKey: 'a', correct: true }, { itemKey: 'b', correct: false }] }),
    game({ answers: [{ itemKey: 'c', correct: true }, { itemKey: 'd', correct: true }] }),
    game({ answers: [{ itemKey: 'e', correct: true }] })
  ];
  assert.equal(Stats.streak(games), 3);
  assert.equal(Stats.streak([game({ answers: [{ itemKey: 'a', correct: false }] })]), 0);
  assert.equal(Stats.streak([game({ answers: [{ itemKey: 'a', correct: true }] })]), 1);
  assert.equal(Stats.streak([]), 0);
  assert.equal(Stats.streak(undefined), 0);
});

test('streak spans an empty game and keeps counting', () => {
  const games = [
    game({ answers: [{ itemKey: 'a', correct: true }] }),
    game({ answers: [] }),
    game({ answers: [{ itemKey: 'b', correct: true }] })
  ];
  assert.equal(Stats.streak(games), 2);
});

test('progress filters by topic and returns oldest first', () => {
  const games = [
    game({ date: '2026-01-03T10:00:00.000Z', correct: 2, total: 2 }),
    game({ date: '2026-01-01T10:00:00.000Z', correct: 1, total: 3 }),
    game({ topic: 'es_ccaa', date: '2026-01-02T10:00:00.000Z', correct: 2, total: 2 })
  ];
  assert.deepEqual(Stats.progress(games, 'es_prov'), [
    { date: '2026-01-01T10:00:00.000Z', pct: 33.3 },
    { date: '2026-01-03T10:00:00.000Z', pct: 100 }
  ]);
  assert.deepEqual(Stats.progress(games, 'world_asia'), []);
  assert.deepEqual(Stats.progress([], 'es_prov'), []);
});

test('lastGames returns newest first with a default of 5', () => {
  const games = [];
  for (let i = 1; i <= 7; i += 1) {
    games.push(game({ date: '2026-01-0' + i + 'T10:00:00.000Z', correct: i }));
  }
  const last = Stats.lastGames(games);
  assert.equal(last.length, 5);
  assert.deepEqual(last.map((g) => g.correct), [7, 6, 5, 4, 3]);
  assert.deepEqual(Stats.lastGames(games, 2).map((g) => g.correct), [7, 6]);
  assert.deepEqual(Stats.lastGames([]), []);
  assert.deepEqual(Stats.lastGames(undefined), []);
});

test('overall aggregates every game and handles empty input', () => {
  const games = [
    game({ correct: 2, total: 4 }),
    game({ correct: 3, total: 6 })
  ];
  assert.deepEqual(Stats.overall(games), { games: 2, correct: 5, total: 10, pct: 50 });
  assert.deepEqual(Stats.overall([]), { games: 0, correct: 0, total: 0, pct: 0 });
  assert.deepEqual(Stats.overall(undefined), { games: 0, correct: 0, total: 0, pct: 0 });
});

test('overallRanking aggregates across every topic with the ranking rules', () => {
  const allGames = {
    Ana: [game({ correct: 4, total: 5 }), game({ topic: 'es_ccaa', correct: 5, total: 5 })],
    Bea: [game({ correct: 6, total: 10 })],
    Carla: [game({ correct: 2, total: 4 })],
    Dan: [game({ topic: 'world_asia', correct: 10, total: 10 })]
  };
  assert.deepEqual(Stats.overallRanking(allGames), [
    { player: 'Dan', pct: 100, total: 10, games: 1 },
    { player: 'Ana', pct: 90, total: 10, games: 2 },
    { player: 'Bea', pct: 60, total: 10, games: 1 }
  ]);
  assert.deepEqual(Stats.overallRanking(allGames, 10).map((r) => r.player), ['Dan', 'Ana', 'Bea']);
  assert.deepEqual(Stats.overallRanking(allGames, 0).map((r) => r.player), ['Dan', 'Ana', 'Bea', 'Carla']);
  assert.deepEqual(Stats.overallRanking({}, 0), []);
  assert.deepEqual(Stats.overallRanking(null), []);
  assert.deepEqual(Stats.overallRanking(undefined), []);
});

test('overallRanking sorts equal pct by total and then keeps insertion order', () => {
  const allGames = {
    Ana: [game({ correct: 9, total: 10 })],
    Bea: [game({ correct: 18, total: 20 })]
  };
  assert.deepEqual(Stats.overallRanking(allGames, 0).map((r) => r.player), ['Bea', 'Ana']);
});

test('merge unions players case-insensitively and keeps the first canonical name', () => {
  const local = {
    ana: [game({ id: 'a1', date: '2026-01-01T10:00:00.000Z' })],
    Bea: [game({ id: 'b1', date: '2026-01-02T10:00:00.000Z' })]
  };
  const central = {
    Ana: [game({ id: 'a2', date: '2026-01-03T10:00:00.000Z' })],
    Carla: [game({ id: 'c1', date: '2026-01-04T10:00:00.000Z' })]
  };
  const merged = Stats.merge(local, central);
  assert.deepEqual(Object.keys(merged), ['ana', 'Bea', 'Carla']);
  assert.deepEqual(merged.ana.map((g) => g.id), ['a1', 'a2']);
  assert.deepEqual(merged.Bea.map((g) => g.id), ['b1']);
  assert.deepEqual(merged.Carla.map((g) => g.id), ['c1']);
});

test('merge counts a shared id once and central wins', () => {
  const local = {
    Ana: [game({ id: 'x', correct: 1, total: 2, date: '2026-01-01T10:00:00.000Z' })]
  };
  const central = {
    Ana: [game({ id: 'x', correct: 2, total: 2, date: '2026-01-01T10:00:00.000Z' })]
  };
  const merged = Stats.merge(local, central);
  assert.equal(merged.Ana.length, 1);
  assert.equal(merged.Ana[0].correct, 2);
});

test('merge keeps games without id and sorts each list oldest first', () => {
  const local = {
    Ana: [
      game({ date: '2026-01-05T10:00:00.000Z' }),
      game({ date: '2026-01-01T10:00:00.000Z' })
    ]
  };
  const central = {
    Ana: [game({ id: 'c1', date: '2026-01-03T10:00:00.000Z' })]
  };
  const merged = Stats.merge(local, central);
  assert.equal(merged.Ana.length, 3);
  assert.deepEqual(merged.Ana.map((g) => g.date), [
    '2026-01-01T10:00:00.000Z',
    '2026-01-03T10:00:00.000Z',
    '2026-01-05T10:00:00.000Z'
  ]);
});

test('merge handles empty and missing inputs', () => {
  assert.deepEqual(Stats.merge({}, {}), {});
  assert.deepEqual(Stats.merge(null, null), {});
  assert.deepEqual(Stats.merge(undefined, undefined), {});
  const local = { Ana: [game({ id: 'a1' })] };
  assert.deepEqual(Stats.merge(local, null), { Ana: [game({ id: 'a1' })] });
  assert.deepEqual(Stats.merge(null, local), { Ana: [game({ id: 'a1' })] });
});

test('merge does not mutate its inputs', () => {
  const local = { Ana: [game({ date: '2026-01-05T10:00:00.000Z' }), game({ date: '2026-01-01T10:00:00.000Z' })] };
  const central = { Ana: [game({ id: 'c1', date: '2026-01-03T10:00:00.000Z' })] };
  Stats.merge(local, central);
  assert.deepEqual(local.Ana.map((g) => g.date), ['2026-01-05T10:00:00.000Z', '2026-01-01T10:00:00.000Z']);
  assert.equal(central.Ana.length, 1);
});

test('level derives from 10 XP per correct answer', () => {
  assert.deepEqual(Stats.level(0), { level: 1, name: 'level_1', xp: 0, base: 0, nextXp: 100, pct: 0 });
  const l = Stats.level(12);
  assert.equal(l.level, 2);
  assert.equal(l.xp, 120);
  assert.equal(l.base, 100);
  assert.equal(l.nextXp, 250);
  assert.equal(l.pct, 13);
  assert.equal(Stats.level(9).level, 1);
  assert.equal(Stats.level(10).level, 2);
});

test('level caps at the top and tolerates bad input', () => {
  const top = Stats.level(100000);
  assert.equal(top.level, 12);
  assert.equal(top.nextXp, null);
  assert.equal(top.pct, 100);
  assert.equal(Stats.level(-5).level, 1);
  assert.equal(Stats.level(undefined).level, 1);
});

test('recordStatus compares by topic across game lengths', () => {
  const all = {
    Ana: [game({ topic: 'a', count: 10, correct: 8, total: 10 }), game({ topic: 'a', count: 20, correct: 20, total: 20 })],
    Daniel: [game({ topic: 'a', count: 10, correct: 9, total: 10 }), game({ topic: 'b', count: 10, correct: 10, total: 10 })]
  };
  const r = Stats.recordStatus(all, 'ana', game({ topic: 'a', count: 10, correct: 9, total: 10 }));
  assert.equal(r.personal, 'none');
  assert.equal(r.absolute, 'none');
  assert.equal(r.personalBest, 100);
  assert.deepEqual(r.absoluteBest, { pct: 100, player: 'Ana' });
  const n = Stats.recordStatus(all, 'Daniel', game({ topic: 'a', count: 30, correct: 30, total: 30 }));
  assert.equal(n.personal, 'new');
  assert.equal(n.absolute, 'tie');
  const none = Stats.recordStatus(all, 'Daniel', game({ topic: 'a', count: 10, correct: 5, total: 10 }));
  assert.equal(none.personal, 'none');
  assert.equal(none.absolute, 'none');
  const other = Stats.recordStatus(all, 'Ana', game({ topic: 'zzz', count: 10, correct: 5, total: 10 }));
  assert.equal(other.personal, 'first');
  assert.equal(other.absolute, 'first');
});

test('recordStatus reports first games', () => {
  const all = { Daniel: [game({ topic: 'a', count: 10, correct: 9, total: 10 })] };
  const r = Stats.recordStatus(all, 'Ana', game({ topic: 'a', count: 10, correct: 1, total: 10 }));
  assert.equal(r.personal, 'first');
  assert.equal(r.absolute, 'none');
  assert.equal(r.personalBest, null);
  const f = Stats.recordStatus({}, 'Ana', game({ topic: 'a', count: 10, correct: 1, total: 10 }));
  assert.equal(f.personal, 'first');
  assert.equal(f.absolute, 'first');
  assert.equal(f.absoluteBest, null);
  assert.equal(Stats.recordStatus(null, 'Ana', game()).absolute, 'first');
});
