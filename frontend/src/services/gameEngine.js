/**
 * Karta Bingo 75-Ball Engine
 * Standard 5x5 grid with FREE square at (row 2, col 2).
 * Columns: B (1-15), I (16-30), N (31-45), G (46-60), O (61-75)
 */

function pseudoRandom(seed) {
  let value = seed;
  return function () {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

export function generateBingoCard(cardId) {
  const rng = pseudoRandom((cardId || 72) * 777 + 12345);

  const getColumnNumbers = (min, max, count) => {
    const pool = [];
    for (let i = min; i <= max; i++) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count).sort((a, b) => a - b);
  };

  const bCol = getColumnNumbers(1, 15, 5);
  const iCol = getColumnNumbers(16, 30, 5);
  const nCol = getColumnNumbers(31, 45, 4);
  const gCol = getColumnNumbers(46, 60, 5);
  const oCol = getColumnNumbers(61, 75, 5);

  const matrix = [];
  for (let r = 0; r < 5; r++) {
    const row = [];
    row.push({ number: bCol[r], letter: 'B', marked: false });
    row.push({ number: iCol[r], letter: 'I', marked: false });
    
    if (r === 2) {
      row.push({ number: 'FREE', letter: 'N', marked: true, isFree: true });
    } else {
      const nIndex = r > 2 ? r - 1 : r;
      row.push({ number: nCol[nIndex], letter: 'N', marked: false });
    }

    row.push({ number: gCol[r], letter: 'G', marked: false });
    row.push({ number: oCol[r], letter: 'O', marked: false });

    matrix.push(row);
  }

  return {
    id: cardId || 72,
    name: `Card No. ${cardId || 72}`,
    matrix
  };
}

export function getLetterForNumber(num) {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}
