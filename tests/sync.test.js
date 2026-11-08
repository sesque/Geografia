const test = require('node:test');
const assert = require('node:assert/strict');
const Sync = require('../js/sync.js');

const URL = 'https://script.google.com/macros/s/abc/exec';
const QUEUE_KEY = 'geografia.queue.v1';

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
    id: 'g1',
    topic: 'es_prov',
    count: 2,
    correct: 1,
    total: 2,
    date: '2026-01-01T10:00:00.000Z',
    answers: [{ itemKey: 'prov:09', correct: true }]
  }, overrides);
}

function jsonResponse(payload) {
  return { ok: true, json: () => Promise.resolve(payload) };
}

function recordingFetch(responder) {
  const calls = [];
  const fn = function (url, init) {
    calls.push({ url, init });
    return Promise.resolve(responder(url, init, calls.length));
  };
  fn.calls = calls;
  return fn;
}

function queued(storage) {
  const raw = storage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

test('disabled mode makes no fetch calls and queues nothing', async () => {
  const storage = fakeStorage();
  const fetch = recordingFetch(() => jsonResponse({ ok: true }));
  const sync = Sync.create({ url: '', storage, fetch });
  assert.equal(sync.enabled(), false);
  assert.equal(sync.pending(), 0);
  assert.deepEqual(await sync.submitGame('Ana', game()), { sent: 0, pending: 0 });
  assert.deepEqual(await sync.flush(), { sent: 0, pending: 0 });
  assert.equal(await sync.fetchAll(), null);
  assert.equal(fetch.calls.length, 0);
  assert.equal(storage.getItem(QUEUE_KEY), null);
});

test('submitGame queues the item under the documented storage key and flushes it', async () => {
  const storage = fakeStorage();
  const fetch = recordingFetch(() => jsonResponse({ ok: true }));
  const sync = Sync.create({ url: URL, storage, fetch });
  const result = await sync.submitGame('Ana', game());
  assert.deepEqual(result, { sent: 1, pending: 0 });
  assert.equal(sync.pending(), 0);
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].url, URL);
  assert.equal(fetch.calls[0].init.method, 'POST');
  assert.equal(fetch.calls[0].init.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body), { player: 'Ana', game: game() });
});

test('queue survives a new Sync instance on the same storage', async () => {
  const storage = fakeStorage();
  const failing = recordingFetch(() => Promise.reject(new Error('offline')));
  const first = Sync.create({ url: URL, storage, fetch: failing });
  await first.submitGame('Ana', game({ id: 'persisted' }));
  assert.equal(first.pending(), 1);
  assert.equal(queued(storage).length, 1);
  assert.equal(queued(storage)[0].game.id, 'persisted');

  const fetch = recordingFetch(() => jsonResponse({ ok: true }));
  const second = Sync.create({ url: URL, storage, fetch });
  assert.equal(second.pending(), 1);
  assert.deepEqual(await second.flush(), { sent: 1, pending: 0 });
  assert.equal(queued(storage).length, 0);
});

test('flush sends queued items one at a time in order', async () => {
  const storage = fakeStorage();
  const order = [];
  const fetch = recordingFetch((url, init) => {
    order.push(JSON.parse(init.body).game.id);
    return jsonResponse({ ok: true });
  });
  const sync = Sync.create({ url: URL, storage, fetch });
  storage.setItem(QUEUE_KEY, JSON.stringify([
    { player: 'Ana', game: game({ id: 'first' }) },
    { player: 'Bea', game: game({ id: 'second' }) },
    { player: 'Ana', game: game({ id: 'third' }) }
  ]));
  assert.deepEqual(await sync.flush(), { sent: 3, pending: 0 });
  assert.deepEqual(order, ['first', 'second', 'third']);
  assert.equal(queued(storage).length, 0);
});

test('flush stops on a network failure and keeps the rest for a later retry', async () => {
  const storage = fakeStorage();
  let fail = true;
  const sent = [];
  const fetch = recordingFetch((url, init) => {
    const id = JSON.parse(init.body).game.id;
    if (fail && id === 'second') return Promise.reject(new Error('offline'));
    sent.push(id);
    return jsonResponse({ ok: true });
  });
  const sync = Sync.create({ url: URL, storage, fetch });
  storage.setItem(QUEUE_KEY, JSON.stringify([
    { player: 'Ana', game: game({ id: 'first' }) },
    { player: 'Ana', game: game({ id: 'second' }) },
    { player: 'Ana', game: game({ id: 'third' }) }
  ]));
  assert.deepEqual(await sync.flush(), { sent: 1, pending: 2 });
  assert.deepEqual(sent, ['first']);
  assert.deepEqual(queued(storage).map((item) => item.game.id), ['second', 'third']);

  fail = false;
  assert.deepEqual(await sync.flush(), { sent: 2, pending: 0 });
  assert.deepEqual(sent, ['first', 'second', 'third']);
});

test('flush stops when the response has ok:false and retries later', async () => {
  const storage = fakeStorage();
  let reject = true;
  const fetch = recordingFetch(() => jsonResponse(reject ? { ok: false, error: 'bad' } : { ok: true }));
  const sync = Sync.create({ url: URL, storage, fetch });
  storage.setItem(QUEUE_KEY, JSON.stringify([
    { player: 'Ana', game: game({ id: 'one' }) },
    { player: 'Ana', game: game({ id: 'two' }) }
  ]));
  assert.deepEqual(await sync.flush(), { sent: 0, pending: 2 });
  assert.equal(fetch.calls.length, 1);

  reject = false;
  assert.deepEqual(await sync.flush(), { sent: 2, pending: 0 });
});

test('flush stops when the response body is not JSON', async () => {
  const storage = fakeStorage();
  const fetch = recordingFetch(() => ({ ok: true, json: () => Promise.reject(new Error('not json')) }));
  const sync = Sync.create({ url: URL, storage, fetch });
  storage.setItem(QUEUE_KEY, JSON.stringify([{ player: 'Ana', game: game({ id: 'one' }) }]));
  assert.deepEqual(await sync.flush(), { sent: 0, pending: 1 });
});

test('no concurrent flushes: a second call joins the running one', async () => {
  const storage = fakeStorage();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const fetch = function () {
    calls += 1;
    return gate.then(() => jsonResponse({ ok: true }));
  };
  const sync = Sync.create({ url: URL, storage, fetch });
  storage.setItem(QUEUE_KEY, JSON.stringify([{ player: 'Ana', game: game({ id: 'one' }) }]));
  const first = sync.flush();
  const second = sync.flush();
  assert.equal(first, second);
  release();
  assert.deepEqual(await first, { sent: 1, pending: 0 });
  assert.equal(calls, 1);
  assert.deepEqual(await sync.flush(), { sent: 0, pending: 0 });
});

test('submitGame never rejects and keeps the game queued on failure', async () => {
  const storage = fakeStorage();
  const fetch = () => Promise.reject(new Error('offline'));
  const sync = Sync.create({ url: URL, storage, fetch });
  const result = await sync.submitGame('Ana', game());
  assert.deepEqual(result, { sent: 0, pending: 1 });
  assert.equal(sync.pending(), 1);
});

test('submitGame refuses games without an id', async () => {
  const storage = fakeStorage();
  const fetch = recordingFetch(() => jsonResponse({ ok: true }));
  const sync = Sync.create({ url: URL, storage, fetch });
  const noId = game();
  delete noId.id;
  assert.deepEqual(await sync.submitGame('Ana', noId), { sent: 0, pending: 0 });
  assert.deepEqual(await sync.submitGame('Ana', null), { sent: 0, pending: 0 });
  assert.equal(fetch.calls.length, 0);
});

test('fetchAll groups rows by player and parses answers JSON', async () => {
  const storage = fakeStorage();
  const fetch = recordingFetch(() => jsonResponse({
    ok: true,
    games: [
      { id: 'a1', player: 'Ana', topic: 'es_prov', count: 2, correct: 1, total: 2, date: '2026-01-01T10:00:00.000Z', answers: [{ itemKey: 'prov:09', correct: true }] },
      { id: 'b1', player: 'Bea', topic: 'es_ccaa', count: 3, correct: 3, total: 3, date: '2026-01-02T10:00:00.000Z', answers: '[]' },
      { id: 'a2', player: 'Ana', topic: 'es_ccaa', count: 1, correct: 1, total: 1, date: '2026-01-03T10:00:00.000Z', answers: [] }
    ]
  }));
  const sync = Sync.create({ url: URL, storage, fetch });
  const all = await sync.fetchAll();
  assert.equal(fetch.calls[0].url, URL + '?action=list');
  assert.deepEqual(Object.keys(all), ['Ana', 'Bea']);
  assert.equal(all.Ana.length, 2);
  assert.deepEqual(all.Ana[0], {
    id: 'a1',
    topic: 'es_prov',
    count: 2,
    correct: 1,
    total: 2,
    date: '2026-01-01T10:00:00.000Z',
    answers: [{ itemKey: 'prov:09', correct: true }]
  });
  assert.deepEqual(all.Bea[0].answers, []);
});

test('fetchAll appends action=list with & when the url already has a query', async () => {
  const fetch = recordingFetch(() => jsonResponse({ ok: true, games: [] }));
  const sync = Sync.create({ url: URL + '?key=1', storage: fakeStorage(), fetch });
  assert.deepEqual(await sync.fetchAll(), {});
  assert.equal(fetch.calls[0].url, URL + '?key=1&action=list');
});

test('fetchAll returns null on network failure, bad JSON and ok:false', async () => {
  const failing = Sync.create({
    url: URL,
    storage: fakeStorage(),
    fetch: () => Promise.reject(new Error('offline'))
  });
  assert.equal(await failing.fetchAll(), null);

  const badJson = Sync.create({
    url: URL,
    storage: fakeStorage(),
    fetch: () => ({ ok: true, json: () => Promise.reject(new Error('not json')) })
  });
  assert.equal(await badJson.fetchAll(), null);

  const rejected = Sync.create({
    url: URL,
    storage: fakeStorage(),
    fetch: () => Promise.resolve(jsonResponse({ ok: false, error: 'nope' }))
  });
  assert.equal(await rejected.fetchAll(), null);
});

test('fetchAll returns null when disabled and makes no fetch call', async () => {
  const fetch = recordingFetch(() => jsonResponse({ ok: true, games: [] }));
  const sync = Sync.create({ url: '', storage: fakeStorage(), fetch });
  assert.equal(await sync.fetchAll(), null);
  assert.equal(fetch.calls.length, 0);
});

test('newId returns unique non-empty strings', () => {
  const sync = Sync.create({ url: '', storage: fakeStorage(), fetch: null });
  const ids = new Set();
  for (let i = 0; i < 200; i += 1) {
    const id = sync.newId();
    assert.equal(typeof id, 'string');
    assert.ok(id.length > 0);
    ids.add(id);
  }
  assert.equal(ids.size, 200);
});

test('newId falls back to timestamp+random when crypto.randomUUID is unavailable', () => {
  const original = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
  try {
    const sync = Sync.create({ url: '', storage: fakeStorage(), fetch: null });
    const ids = new Set();
    for (let i = 0; i < 100; i += 1) ids.add(sync.newId());
    assert.equal(ids.size, 100);
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true, writable: true });
  }
});

test('works with a throwing storage by falling back to memory', async () => {
  const storage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    }
  };
  const fetch = recordingFetch(() => jsonResponse({ ok: true }));
  const sync = Sync.create({ url: URL, storage, fetch });
  assert.equal(sync.pending(), 0);
  assert.deepEqual(await sync.submitGame('Ana', game()), { sent: 1, pending: 0 });
});

test('works without any storage', async () => {
  const fetch = recordingFetch(() => Promise.reject(new Error('offline')));
  const sync = Sync.create({ url: URL, fetch });
  assert.deepEqual(await sync.submitGame('Ana', game()), { sent: 0, pending: 1 });
  assert.equal(sync.pending(), 1);
});

test('discardPending removes only that player\'s queued games', async () => {
  const storage = fakeStorage();
  const fetch = recordingFetch(() => Promise.reject(new Error('offline')));
  const sync = Sync.create({ url: URL, storage, fetch });
  await sync.submitGame('Ana', game({ id: 'a1' }));
  await sync.submitGame('Luis', game({ id: 'l1' }));
  await sync.submitGame('ana', game({ id: 'a2' }));
  assert.equal(sync.pending(), 3);
  assert.equal(sync.discardPending('Ana'), 2);
  assert.equal(sync.pending(), 1);
  assert.equal(JSON.parse(storage.getItem(QUEUE_KEY))[0].player, 'Luis');
  assert.equal(sync.discardPending('Nobody'), 0);
});

test('discardPending is a no-op when disabled', () => {
  const sync = Sync.create({ url: '', storage: fakeStorage(), fetch: null });
  assert.equal(sync.discardPending('Ana'), 0);
});
