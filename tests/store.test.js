const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../js/store.js');

function fakeStorage(initial) {
  const data = new Map(Object.entries(initial || {}));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    data
  };
}

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

test('addPlayer trims and returns the canonical name', () => {
  const store = Store.create(fakeStorage());
  assert.equal(store.addPlayer('  Ana  '), 'Ana');
  assert.deepEqual(store.listPlayers(), ['Ana']);
});

test('addPlayer duplicate is case-insensitive and returns the existing canonical name', () => {
  const store = Store.create(fakeStorage());
  store.addPlayer('Ana');
  assert.equal(store.addPlayer('ana'), 'Ana');
  assert.equal(store.addPlayer('ANA'), 'Ana');
  assert.deepEqual(store.listPlayers(), ['Ana']);
});

test('listPlayers sorts case-insensitively', () => {
  const store = Store.create(fakeStorage());
  store.addPlayer('zoe');
  store.addPlayer('Ana');
  store.addPlayer('bea');
  assert.deepEqual(store.listPlayers(), ['Ana', 'bea', 'zoe']);
});

test('addPlayer rejects empty, whitespace-only, over-long and non-string names', () => {
  const store = Store.create(fakeStorage());
  assert.throws(() => store.addPlayer(''), Error);
  assert.throws(() => store.addPlayer('   '), Error);
  assert.throws(() => store.addPlayer('x'.repeat(25)), Error);
  assert.throws(() => store.addPlayer(null), Error);
  assert.throws(() => store.addPlayer(42), Error);
  assert.doesNotThrow(() => store.addPlayer('x'.repeat(24)));
  assert.deepEqual(store.listPlayers(), ['x'.repeat(24)]);
});

test('state persists across Store.create() calls on the same storage', () => {
  const storage = fakeStorage();
  const first = Store.create(storage);
  first.addPlayer('Ana');
  first.recordGame('Ana', game());
  first.setSetting('lang', 'en');

  const second = Store.create(storage);
  assert.deepEqual(second.listPlayers(), ['Ana']);
  assert.equal(second.getGames('Ana').length, 1);
  assert.equal(second.getSetting('lang'), 'en');
  assert.deepEqual(second.allGames(), { Ana: [game()] });
});

test('falls back to in-memory when getItem throws', () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    }
  };
  const store = Store.create(storage);
  assert.equal(store.addPlayer('Ana'), 'Ana');
  store.recordGame('Ana', game());
  assert.deepEqual(store.listPlayers(), ['Ana']);
  assert.equal(store.getGames('Ana').length, 1);
  assert.equal(store.getSetting('lang'), undefined);
  store.setSetting('lang', 'es');
  assert.equal(store.getSetting('lang'), 'es');
});

test('falls back to in-memory when only setItem throws', () => {
  const storage = fakeStorage();
  storage.setItem = function () {
    throw new Error('quota');
  };
  const store = Store.create(storage);
  store.addPlayer('Ana');
  store.recordGame('Ana', game());
  assert.deepEqual(store.listPlayers(), ['Ana']);
  assert.equal(store.getGames('Ana').length, 1);
});

test('keeps already-read data when getItem starts throwing later', () => {
  const storage = fakeStorage();
  const store = Store.create(storage);
  store.addPlayer('Ana');
  store.recordGame('Ana', game());
  storage.getItem = function () {
    throw new Error('blocked');
  };
  assert.deepEqual(store.listPlayers(), ['Ana']);
  store.recordGame('Ana', game({ topic: 'es_ccaa' }));
  assert.equal(store.getGames('Ana').length, 2);
});

test('corrupt stored JSON is treated as an empty state', () => {
  const store = Store.create(fakeStorage({ 'geografia.v1': '{not json' }));
  assert.deepEqual(store.listPlayers(), []);
  assert.deepEqual(store.allGames(), {});
  assert.equal(store.addPlayer('Ana'), 'Ana');
});

test('recordGame validates every field', () => {
  const store = Store.create(fakeStorage());
  store.addPlayer('Ana');

  assert.throws(() => store.recordGame('Unknown', game()), /Unknown player/);
  assert.throws(() => store.recordGame('Ana', null), Error);
  assert.throws(() => store.recordGame('Ana', game({ topic: '' })), Error);
  assert.throws(() => store.recordGame('Ana', game({ count: 0 })), Error);
  assert.throws(() => store.recordGame('Ana', game({ count: 1.5 })), Error);
  assert.throws(() => store.recordGame('Ana', game({ total: -1 })), Error);
  assert.throws(() => store.recordGame('Ana', game({ correct: 3, total: 2 })), Error);
  assert.throws(() => store.recordGame('Ana', game({ correct: -1 })), Error);
  assert.throws(() => store.recordGame('Ana', game({ date: 'not a date' })), Error);
  assert.throws(() => store.recordGame('Ana', game({ answers: 'nope' })), Error);
  assert.throws(() => store.recordGame('Ana', game({ answers: [{ itemKey: '', correct: true }] })), Error);
  assert.throws(() => store.recordGame('Ana', game({ answers: [{ itemKey: 'prov:09', correct: 'yes' }] })), Error);
  assert.throws(() => store.recordGame('Ana', game({ answers: [null] })), Error);

  assert.equal(store.getGames('Ana').length, 0);
});

test('recordGame appends games oldest first and matches player case-insensitively', () => {
  const store = Store.create(fakeStorage());
  store.addPlayer('Ana');
  const first = game({ date: '2026-01-01T10:00:00.000Z' });
  const second = game({ topic: 'es_ccaa', correct: 2, date: '2026-01-02T10:00:00.000Z' });
  store.recordGame('ana', first);
  store.recordGame('ANA', second);
  assert.deepEqual(store.getGames('Ana'), [first, second]);
  assert.deepEqual(store.allGames(), { Ana: [first, second] });
});

test('recordGame stores a copy, not the caller object', () => {
  const store = Store.create(fakeStorage());
  store.addPlayer('Ana');
  const input = game();
  store.recordGame('Ana', input);
  input.correct = 0;
  input.answers[0].correct = false;
  assert.equal(store.getGames('Ana')[0].correct, 1);
  assert.equal(store.getGames('Ana')[0].answers[0].correct, true);
});

test('getGames returns [] for unknown players and getGames result is a copy', () => {
  const store = Store.create(fakeStorage());
  store.addPlayer('Ana');
  store.recordGame('Ana', game());
  assert.deepEqual(store.getGames('Nobody'), []);
  const games = store.getGames('Ana');
  games[0].correct = 99;
  assert.equal(store.getGames('Ana')[0].correct, 1);
});

test('settings round-trip, including falsy values', () => {
  const store = Store.create(fakeStorage());
  assert.equal(store.getSetting('missing'), undefined);
  store.setSetting('lang', 'en');
  store.setSetting('sound', false);
  assert.equal(store.getSetting('lang'), 'en');
  assert.equal(store.getSetting('sound'), false);
});

test('removePlayer removes case-insensitively and reports whether it existed', () => {
  const store = Store.create(fakeStorage());
  store.addPlayer('Ana');
  store.addPlayer('Bea');
  assert.equal(store.removePlayer('ana'), true);
  assert.deepEqual(store.listPlayers(), ['Bea']);
  assert.equal(store.removePlayer('Ana'), false);
  assert.equal(store.removePlayer(null), false);
});

test('create() without storage works in memory', () => {
  const store = Store.create();
  store.addPlayer('Ana');
  store.recordGame('Ana', game());
  assert.equal(store.getGames('Ana').length, 1);
});

test('recordGame keeps an optional string id and omits it when absent', () => {
  const store = Store.create(fakeStorage());
  store.addPlayer('Ana');
  store.recordGame('Ana', game({ id: 'abc-123' }));
  store.recordGame('Ana', game());
  const games = store.getGames('Ana');
  assert.equal(games[0].id, 'abc-123');
  assert.equal(Object.prototype.hasOwnProperty.call(games[1], 'id'), false);
  assert.equal(store.allGames().Ana[0].id, 'abc-123');
});

test('recordGame persists the id across Store.create() calls', () => {
  const storage = fakeStorage();
  const first = Store.create(storage);
  first.addPlayer('Ana');
  first.recordGame('Ana', game({ id: 'persisted-id' }));
  const second = Store.create(storage);
  assert.equal(second.getGames('Ana')[0].id, 'persisted-id');
});

test('recordGame rejects a non-string or empty id', () => {
  const store = Store.create(fakeStorage());
  store.addPlayer('Ana');
  assert.throws(() => store.recordGame('Ana', game({ id: 42 })), Error);
  assert.throws(() => store.recordGame('Ana', game({ id: '' })), Error);
  assert.throws(() => store.recordGame('Ana', game({ id: null })), Error);
  assert.equal(store.getGames('Ana').length, 0);
});

test('recordGame returns the stored game including its id', () => {
  const store = Store.create(fakeStorage());
  store.addPlayer('Ana');
  const stored = store.recordGame('Ana', game({ id: 'returned-id' }));
  assert.equal(stored.id, 'returned-id');
});
