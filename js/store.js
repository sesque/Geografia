(function (root) {
  const KEY = 'geografia.v1';

  // Null-prototype maps so names like "__proto__" are stored as ordinary keys.
  function dict(source) {
    const out = Object.create(null);
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      Object.keys(source).forEach(function (key) {
        out[key] = source[key];
      });
    }
    return out;
  }

  function emptyState() {
    return { players: dict(), settings: dict() };
  }

  function normalizeState(value) {
    const state = value && typeof value === 'object' ? value : {};
    return { players: dict(state.players), settings: dict(state.settings) };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function create(storage) {
    let memory = null;
    let memoryOnly = !storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function';

    function read() {
      if (!memoryOnly) {
        try {
          const raw = storage.getItem(KEY);
          memory = raw === null || raw === undefined || raw === ''
            ? emptyState()
            : normalizeState(JSON.parse(raw));
          return memory;
        } catch (err) {
          memoryOnly = true;
        }
      }
      if (!memory) memory = emptyState();
      return memory;
    }

    function write(state) {
      memory = state;
      if (memoryOnly) return;
      try {
        storage.setItem(KEY, JSON.stringify(state));
      } catch (err) {
        memoryOnly = true;
      }
    }

    function canonicalName(players, name) {
      const lower = name.toLowerCase();
      const names = Object.keys(players);
      for (let i = 0; i < names.length; i += 1) {
        if (names[i].toLowerCase() === lower) return names[i];
      }
      return null;
    }

    function listPlayers() {
      return Object.keys(read().players).sort(function (a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      });
    }

    function addPlayer(name) {
      if (typeof name !== 'string') throw new Error('Player name must be a string');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Player name is required');
      if (trimmed.length > 24) throw new Error('Player name must be 24 characters or fewer');
      const state = read();
      const existing = canonicalName(state.players, trimmed);
      if (existing !== null) return existing;
      state.players[trimmed] = { games: [] };
      write(state);
      return trimmed;
    }

    function validateGame(game) {
      if (!game || typeof game !== 'object' || Array.isArray(game)) throw new Error('Game must be an object');
      if (typeof game.topic !== 'string' || !game.topic.trim()) throw new Error('Game topic is required');
      if (!Number.isInteger(game.count) || game.count < 1) throw new Error('Game count must be a positive integer');
      if (!Number.isInteger(game.total) || game.total < 0) throw new Error('Game total must be a non-negative integer');
      if (!Number.isInteger(game.correct) || game.correct < 0 || game.correct > game.total) {
        throw new Error('Game correct must be between 0 and total');
      }
      if (typeof game.date !== 'string' || Number.isNaN(Date.parse(game.date))) {
        throw new Error('Game date must be a valid ISO string');
      }
      if (!Array.isArray(game.answers)) throw new Error('Game answers must be an array');
      for (let i = 0; i < game.answers.length; i += 1) {
        const answer = game.answers[i];
        if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
          throw new Error('Game answers must be objects');
        }
        if (typeof answer.itemKey !== 'string' || !answer.itemKey) throw new Error('Answer itemKey is required');
        if (typeof answer.correct !== 'boolean') throw new Error('Answer correct must be a boolean');
      }
    }

    function recordGame(player, game) {
      if (typeof player !== 'string' || !player.trim()) throw new Error('Player name is required');
      validateGame(game);
      const state = read();
      const name = canonicalName(state.players, player.trim());
      if (name === null) throw new Error('Unknown player: ' + player);
      const entry = state.players[name] && typeof state.players[name] === 'object'
        ? state.players[name]
        : {};
      state.players[name] = entry;
      if (!Array.isArray(entry.games)) entry.games = [];
      const stored = {
        topic: game.topic,
        count: game.count,
        correct: game.correct,
        total: game.total,
        date: game.date,
        answers: game.answers.map(function (answer) {
          return { itemKey: answer.itemKey, correct: answer.correct };
        })
      };
      entry.games.push(stored);
      write(state);
      return clone(stored);
    }

    function getGames(player) {
      if (typeof player !== 'string') return [];
      const state = read();
      const name = canonicalName(state.players, player.trim());
      if (name === null) return [];
      const entry = state.players[name];
      const games = entry && typeof entry === 'object' ? entry.games : null;
      return Array.isArray(games) ? clone(games) : [];
    }

    function allGames() {
      const state = read();
      const result = {};
      Object.keys(state.players).forEach(function (name) {
        const games = state.players[name] && state.players[name].games;
        Object.defineProperty(result, name, {
          value: Array.isArray(games) ? clone(games) : [],
          enumerable: true,
          configurable: true,
          writable: true
        });
      });
      return result;
    }

    function getSetting(key) {
      return read().settings[key];
    }

    function setSetting(key, value) {
      const state = read();
      state.settings[key] = value;
      write(state);
      return value;
    }

    function removePlayer(name) {
      if (typeof name !== 'string') return false;
      const state = read();
      const canonical = canonicalName(state.players, name.trim());
      if (canonical === null) return false;
      delete state.players[canonical];
      write(state);
      return true;
    }

    return {
      listPlayers: listPlayers,
      addPlayer: addPlayer,
      recordGame: recordGame,
      getGames: getGames,
      allGames: allGames,
      getSetting: getSetting,
      setSetting: setSetting,
      removePlayer: removePlayer
    };
  }

  const Store = { create: create };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Store;
  } else {
    let instance = null;
    Object.defineProperty(root, 'Store', {
      configurable: true,
      get: function () {
        if (!instance) {
          try {
            instance = create(root.localStorage);
          } catch (err) {
            instance = create(null);
          }
        }
        return instance;
      }
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
