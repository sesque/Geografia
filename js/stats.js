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

  function ranking(allGames, topic, minTotal) {
    const threshold = typeof minTotal === 'number' ? minTotal : 10;
    const players = allGames && typeof allGames === 'object' ? allGames : {};
    const rows = [];
    Object.keys(players).forEach(function (player) {
      const games = asGames(players[player]).filter(function (game) {
        return game.topic === topic;
      });
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

  const Stats = {
    topicSummary: topicSummary,
    ranking: ranking,
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
