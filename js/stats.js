(function (root) {
  function asGames(games) {
    return Array.isArray(games) ? games : [];
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function pctOf(correct, total) {
    return total > 0 ? round1((correct / total) * 100) : 0;
  }

  function topicSummary(games) {
    const summary = {};
    asGames(games).forEach(function (game) {
      const topic = game.topic;
      if (!summary[topic]) summary[topic] = { games: 0, correct: 0, total: 0, pct: 0, bestPct: 0 };
      const entry = summary[topic];
      entry.games += 1;
      entry.correct += game.correct;
      entry.total += game.total;
      const pct = pctOf(game.correct, game.total);
      if (pct > entry.bestPct) entry.bestPct = pct;
    });
    Object.keys(summary).forEach(function (topic) {
      const entry = summary[topic];
      entry.pct = pctOf(entry.correct, entry.total);
    });
    return summary;
  }

  function rankRows(allGames, keep, minTotal) {
    const threshold = typeof minTotal === 'number' ? minTotal : 10;
    const players = allGames && typeof allGames === 'object' ? allGames : {};
    const rows = [];
    Object.keys(players).forEach(function (player) {
      const games = asGames(players[player]).filter(keep);
      if (!games.length) return;
      let correct = 0;
      let total = 0;
      games.forEach(function (game) {
        correct += game.correct;
        total += game.total;
      });
      if (total < threshold) return;
      rows.push({ player: player, pct: pctOf(correct, total), total: total, games: games.length });
    });
    rows.sort(function (a, b) {
      if (b.pct !== a.pct) return b.pct - a.pct;
      return b.total - a.total;
    });
    return rows;
  }

  function ranking(allGames, topic, minTotal) {
    return rankRows(allGames, function (game) {
      return game.topic === topic;
    }, minTotal);
  }

  function overallRanking(allGames, minTotal) {
    return rankRows(allGames, function () {
      return true;
    }, minTotal);
  }

  function compareDates(a, b) {
    const left = Date.parse(a.date);
    const right = Date.parse(b.date);
    if (Number.isNaN(left) || Number.isNaN(right)) return 0;
    return left - right;
  }

  function merge(local, central) {
    const records = [];
    const byId = Object.create(null);

    function add(source, isCentral) {
      if (!source || typeof source !== 'object') return;
      Object.keys(source).forEach(function (name) {
        asGames(source[name]).forEach(function (game) {
          if (!game || typeof game !== 'object') return;
          const id = game.id;
          if (typeof id === 'string' && id) {
            if (byId[id] !== undefined) {
              const previous = records[byId[id]];
              if (isCentral && !previous.central) {
                previous.game = game;
                previous.central = true;
              }
              return;
            }
            byId[id] = records.length;
          }
          records.push({ name: name, game: game, central: isCentral });
        });
      });
    }

    add(local, false);
    add(central, true);

    const groups = Object.create(null);
    const order = [];
    records.forEach(function (record) {
      const key = String(record.name).toLowerCase();
      if (!groups[key]) {
        groups[key] = { name: record.name, games: [] };
        order.push(key);
      }
      groups[key].games.push(record.game);
    });

    const result = {};
    order.forEach(function (key) {
      const group = groups[key];
      Object.defineProperty(result, group.name, {
        value: group.games.sort(compareDates),
        enumerable: true,
        configurable: true,
        writable: true
      });
    });
    return result;
  }

  function mostMissed(games, n) {
    const limit = typeof n === 'number' ? n : 5;
    const items = {};
    asGames(games).forEach(function (game) {
      asGames(game.answers).forEach(function (answer) {
        if (!items[answer.itemKey]) items[answer.itemKey] = { itemKey: answer.itemKey, missed: 0, seen: 0 };
        items[answer.itemKey].seen += 1;
        if (!answer.correct) items[answer.itemKey].missed += 1;
      });
    });
    const rows = Object.keys(items).map(function (key) {
      return items[key];
    });
    rows.sort(function (a, b) {
      if (b.missed !== a.missed) return b.missed - a.missed;
      return (b.missed / b.seen) - (a.missed / a.seen);
    });
    return rows.slice(0, Math.max(0, limit));
  }

  function streak(games) {
    const list = asGames(games);
    let count = 0;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const answers = asGames(list[i].answers);
      for (let j = answers.length - 1; j >= 0; j -= 1) {
        if (!answers[j].correct) return count;
        count += 1;
      }
    }
    return count;
  }

  function progress(games, topic) {
    return asGames(games)
      .filter(function (game) {
        return game.topic === topic;
      })
      .sort(function (a, b) {
        return Date.parse(a.date) - Date.parse(b.date);
      })
      .map(function (game) {
        return { date: game.date, pct: pctOf(game.correct, game.total) };
      });
  }

  function lastGames(games, n) {
    const limit = typeof n === 'number' ? n : 5;
    if (!(limit > 0)) return [];
    return asGames(games).slice(-limit).reverse();
  }

  function overall(games) {
    const list = asGames(games);
    let correct = 0;
    let total = 0;
    list.forEach(function (game) {
      correct += game.correct;
      total += game.total;
    });
    return { games: list.length, correct: correct, total: total, pct: pctOf(correct, total) };
  }

  function recordStatus(allGames, player, game) {
    const g = game || {};
    const key = String(player).toLowerCase();
    const pct = pctOf(g.correct, g.total);
    let pBest = null;
    let aBest = null;
    Object.keys(allGames || {}).forEach(function (name) {
      asGames(allGames[name]).forEach(function (old) {
        if (!old || old.topic !== g.topic) return;
        const p = pctOf(old.correct, old.total);
        if (aBest === null || p > aBest.pct) aBest = { pct: p, player: name };
        if (String(name).toLowerCase() === key && (pBest === null || p > pBest)) pBest = p;
      });
    });
    function cmp(best) {
      if (best === null) return 'first';
      if (pct > best) return 'new';
      return pct === best ? 'tie' : 'none';
    }
    return {
      personal: cmp(pBest),
      absolute: cmp(aBest === null ? null : aBest.pct),
      personalBest: pBest,
      absoluteBest: aBest
    };
  }

  const XP_PER_CORRECT = 10;
  const LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000];

  function level(totalCorrect) {
    const n = Number(totalCorrect);
    const xp = (isFinite(n) && n > 0 ? Math.floor(n) : 0) * XP_PER_CORRECT;
    let lv = 0;
    for (let i = 0; i < LEVEL_XP.length; i += 1) if (xp >= LEVEL_XP[i]) lv = i;
    const base = LEVEL_XP[lv];
    const nextXp = lv + 1 < LEVEL_XP.length ? LEVEL_XP[lv + 1] : null;
    const pct = nextXp === null ? 100 : Math.floor((xp - base) / (nextXp - base) * 100);
    return { level: lv + 1, name: 'level_' + (lv + 1), xp: xp, base: base, nextXp: nextXp, pct: pct };
  }

  const Stats = {
    level: level,
    recordStatus: recordStatus,
    topicSummary: topicSummary,
    ranking: ranking,
    overallRanking: overallRanking,
    merge: merge,
    mostMissed: mostMissed,
    streak: streak,
    progress: progress,
    lastGames: lastGames,
    overall: overall
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Stats;
  } else {
    root.Stats = Stats;
  }
})(typeof window !== 'undefined' ? window : globalThis);
