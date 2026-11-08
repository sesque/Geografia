(function (root) {
  const QUEUE_KEY = 'geografia.queue.v1';

  function create(options) {
    const opts = options || {};
    const url = typeof opts.url === 'string' ? opts.url : '';
    const storage = opts.storage;
    const fetchImpl = typeof opts.fetch === 'function' ? opts.fetch : null;
    let memoryQueue = [];
    let memoryOnly = !storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function';
    let flushing = null;

    function enabled() {
      return !!url;
    }

    function readQueue() {
      if (!memoryOnly) {
        try {
          const raw = storage.getItem(QUEUE_KEY);
          if (raw === null || raw === undefined || raw === '') return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
          memoryOnly = true;
        }
      }
      return memoryQueue.slice();
    }

    function writeQueue(queue) {
      memoryQueue = queue;
      if (memoryOnly) return;
      try {
        storage.setItem(QUEUE_KEY, JSON.stringify(queue));
      } catch (err) {
        memoryOnly = true;
      }
    }

    function pending() {
      return readQueue().length;
    }

    function discardPending(player) {
      if (!enabled()) return 0;
      const key = String(player).toLowerCase();
      const queue = readQueue();
      const kept = queue.filter(function (item) {
        return !(item && String(item.player).toLowerCase() === key);
      });
      const removed = queue.length - kept.length;
      if (removed > 0) writeQueue(kept);
      return removed;
    }

    function newId() {
      const cryptoObj = root.crypto;
      if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        try {
          return cryptoObj.randomUUID();
        } catch (err) {
          /* fall through to the timestamp form */
        }
      }
      return Date.now().toString(36) + '-' +
        Math.random().toString(36).slice(2, 10) +
        Math.random().toString(36).slice(2, 10);
    }

    function flush() {
      if (flushing) return flushing;
      if (!enabled() || !fetchImpl) return Promise.resolve({ sent: 0, pending: pending() });
      flushing = (async function () {
        let sent = 0;
        for (;;) {
          const queue = readQueue();
          if (!queue.length) break;
          const item = queue[0];
          let ok = false;
          try {
            const res = await fetchImpl(url, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ player: item.player, game: item.game })
            });
            const data = await res.json();
            ok = !!data && data.ok === true;
          } catch (err) {
            ok = false;
          }
          if (!ok) break;
          const remaining = readQueue();
          remaining.shift();
          writeQueue(remaining);
          sent += 1;
        }
        return { sent: sent, pending: pending() };
      })();
      const current = flushing;
      current.then(function () {
        if (flushing === current) flushing = null;
      }, function () {
        if (flushing === current) flushing = null;
      });
      return current;
    }

    function submitGame(player, game) {
      return Promise.resolve().then(function () {
        if (!enabled()) return { sent: 0, pending: pending() };
        if (!game || typeof game !== 'object' || typeof game.id !== 'string' || !game.id) {
          return { sent: 0, pending: pending() };
        }
        const queue = readQueue();
        queue.push({ player: player, game: game });
        writeQueue(queue);
        return flush();
      }).catch(function () {
        return { sent: 0, pending: pending() };
      });
    }

    function fetchAll() {
      if (!enabled() || !fetchImpl) return Promise.resolve(null);
      const separator = url.indexOf('?') >= 0 ? '&' : '?';
      return Promise.resolve()
        .then(function () {
          return fetchImpl(url + separator + 'action=list');
        })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (!data || data.ok !== true || !Array.isArray(data.games)) return null;
          const grouped = {};
          data.games.forEach(function (row) {
            if (!row || typeof row.player !== 'string' || !row.player) return;
            let answers = row.answers;
            if (typeof answers === 'string') {
              try {
                answers = JSON.parse(answers);
              } catch (err) {
                answers = [];
              }
            }
            const game = {
              topic: row.topic,
              count: row.count,
              correct: row.correct,
              total: row.total,
              date: row.date,
              answers: Array.isArray(answers) ? answers : []
            };
            if (typeof row.id === 'string' && row.id) game.id = row.id;
            if (!Object.prototype.hasOwnProperty.call(grouped, row.player)) {
              Object.defineProperty(grouped, row.player, {
                value: [],
                enumerable: true,
                configurable: true,
                writable: true
              });
            }
            grouped[row.player].push(game);
          });
          return grouped;
        })
        .catch(function () {
          return null;
        });
    }

    return {
      enabled: enabled,
      newId: newId,
      submitGame: submitGame,
      flush: flush,
      pending: pending,
      discardPending: discardPending,
      fetchAll: fetchAll
    };
  }

  const Sync = { create: create };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sync;
  } else {
    let storage = null;
    try {
      storage = root.localStorage;
    } catch (err) {
      storage = null;
    }
    const config = root.GeoConfig || {};
    root.Sync = create({
      url: typeof config.sheetUrl === 'string' ? config.sheetUrl : '',
      storage: storage,
      fetch: typeof root.fetch === 'function' ? root.fetch.bind(root) : null
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
