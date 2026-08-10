/**
 * Karta Bingo 75-Ball Engine
 * Standard 5x5 grid with FREE square at (row 2, col 2).
 * Columns: B (1-15), I (16-30), N (31-45), G (46-60), O (61-75)
 */

// Simple pseudo-random number generator using seed for deterministic card generation
function pseudoRandom(seed) {
  let value = seed;
  return function () {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

/**
 * Generate a 5x5 Bingo Card for a given card ID (1 to 100).
 * Card #ID will always have the exact same numbers so players can pick their lucky numbers!
 */
export function generateBingoCard(cardId) {
  const rng = pseudoRandom(cardId * 777 + 12345);

  const getColumnNumbers = (min, max, count) => {
    const pool = [];
    for (let i = min; i <= max; i++) pool.push(i);
    // Shuffle pool with rng
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count).sort((a, b) => a - b);
  };

  const bCol = getColumnNumbers(1, 15, 5);
  const iCol = getColumnNumbers(16, 30, 5);
  const nCol = getColumnNumbers(31, 45, 4); // 4 numbers, middle is FREE
  const gCol = getColumnNumbers(46, 60, 5);
  const oCol = getColumnNumbers(61, 75, 5);

  // Construct 5x5 matrix
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
    id: cardId,
    name: `Karta #${cardId}`,
    matrix
  };
}

/**
 * Check if card has a winning pattern based on called balls array.
 * @param {Object} card Matrix or card object
 * @param {Array<number>} calledBalls Array of called numbers
 * @returns {Object} { isValid: boolean, pattern: string, matchedNumbers: Array }
 */
export function validateBingoClaim(card, calledBalls) {
  const calledSet = new Set(calledBalls);
  calledSet.add('FREE'); // FREE space is always marked

  const matrix = card.matrix || card;

  // Helper to check if a cell is marked
  const isMarked = (r, c) => {
    const cell = matrix[r][c];
    return cell.number === 'FREE' || calledSet.has(cell.number);
  };

  // 1. Check Horizontal Rows (5 rows)
  for (let r = 0; r < 5; r++) {
    let complete = true;
    const rowNums = [];
    for (let c = 0; c < 5; c++) {
      if (!isMarked(r, c)) {
        complete = false;
        break;
      }
      rowNums.push(matrix[r][c].number);
    }
    if (complete) {
      return { isValid: true, pattern: `Row ${r + 1} (Horizontal)`, matchedNumbers: rowNums };
    }
  }

  // 2. Check Vertical Columns (5 columns)
  const letters = ['B', 'I', 'N', 'G', 'O'];
  for (let c = 0; c < 5; c++) {
    let complete = true;
    const colNums = [];
    for (let r = 0; r < 5; r++) {
      if (!isMarked(r, c)) {
        complete = false;
        break;
      }
      colNums.push(matrix[r][c].number);
    }
    if (complete) {
      return { isValid: true, pattern: `Column ${letters[c]} (Vertical)`, matchedNumbers: colNums };
    }
  }

  // 3. Check Main Diagonal (Top-Left to Bottom-Right)
  let diag1 = true;
  const diag1Nums = [];
  for (let i = 0; i < 5; i++) {
    if (!isMarked(i, i)) {
      diag1 = false;
      break;
    }
    diag1Nums.push(matrix[i][i].number);
  }
  if (diag1) {
    return { isValid: true, pattern: 'Diagonal (Top-Left to Bottom-Right)', matchedNumbers: diag1Nums };
  }

  // 4. Check Anti Diagonal (Top-Right to Bottom-Left)
  let diag2 = true;
  const diag2Nums = [];
  for (let i = 0; i < 5; i++) {
    if (!isMarked(i, 4 - i)) {
      diag2 = false;
      break;
    }
    diag2Nums.push(matrix[i][4 - i].number);
  }
  if (diag2) {
    return { isValid: true, pattern: 'Diagonal (Top-Right to Bottom-Left)', matchedNumbers: diag2Nums };
  }

  // 5. Check 4 Corners
  const corners = [[0, 0], [0, 4], [4, 0], [4, 4]];
  let allCorners = true;
  const cornerNums = [];
  for (const [r, c] of corners) {
    if (!isMarked(r, c)) {
      allCorners = false;
      break;
    }
    cornerNums.push(matrix[r][c].number);
  }
  if (allCorners) {
    return { isValid: true, pattern: '4 Corners', matchedNumbers: cornerNums };
  }

  // 6. Check Full House (All 25 squares)
  let fullHouse = true;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!isMarked(r, c)) {
        fullHouse = false;
        break;
      }
    }
    if (!fullHouse) break;
  }
  if (fullHouse) {
    return { isValid: true, pattern: 'Full House (All Marked)', matchedNumbers: [] };
  }

  return { isValid: false, pattern: null, matchedNumbers: [] };
}

/**
 * Get letter for ball number (1-75)
 */
export function getLetterForNumber(num) {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}
