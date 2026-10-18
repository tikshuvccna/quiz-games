// index of the single best score, or -1 on a tie
function winnerOf(scores) {
  const best = Math.max(...scores);
  return scores.filter((s) => s === best).length > 1 ? -1 : scores.indexOf(best);
}

module.exports = { winnerOf };
