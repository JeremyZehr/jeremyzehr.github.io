importScripts("mots.js");

// Use a seeded PRNG to ensure grids are consistently and uniquely random each day
function sfc32(a, b, c, d) {
  return function() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    let t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}
const d = new Date();
let random = sfc32(d.getFullYear(), d.getMonth(), d.getDate(), 1);

// We'll assign UUIDs to rows and cells
function uuid() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ (Math.floor(255*random())) & 15 >> +c / 4).toString(16)
  );
}

function shuffle(array) {
  let currentIndex = array.length;
  while (currentIndex != 0) {
    let randomIndex = Math.floor(random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

// For debug purposes
let go = ()=>null;
const COLORS = [
  "blue",
  "red",
  "green",
  "brown",
  "pink",
  "yellow"
];

const FILLERS = [
  "123",
  "456",
  "789"
];

const LENGTHS = Object.keys(DICTIONARY);

const drawRandomWord = (maxLength=-1) => {
  const lengths = [3,4,5,6/*,7,8*/];
  while (maxLength > 2 && lengths.at(-1) > maxLength)
    lengths.pop();
  const randomLength = shuffle(lengths)[0];
  const randomWords = Object.keys(DICTIONARY[randomLength]);
  const randomWord = randomWords[Math.floor(random()*randomWords.length)];
  return randomWord;
}

const delta = {
  topRight: 1,
  topLeft: 1,
  left: 0,
  right: 0,
  bottomLeft: -1,
  bottomRight: -1
};

let wordId = 0;

class Cell {
  constructor(letter="") {
    this._letter = letter;
    this._wordColor = null;
    this._wordId = undefined;
    this._id = uuid();
  }
  copy() {
    const newCell = new Cell();
    newCell._letter = this._letter;
    newCell._wordColor = this._wordColor;
    newCell._wordId = this._wordId;
    newCell._id = this._id;
    return newCell;
  }
}
class Row {
  constructor(cells) {
    this._idCells = {};
    this._cells = cells || [];
    this._cells.forEach(c=>{ c._row = this; this._idCells[c._id] = c; });
    this._id = uuid();
  }
  copy() {
    const newRow = new Row(this._cells.map(c=>c.copy()));
    newRow._id = this._id;
    return newRow;
  }
}
class Grid {
  constructor(rows) {
    this._rows = rows || [];
    this._indicesRows = new Map();
    this._idRows = {};
    for (let n=0; n<this._rows.length; n++) {
      this._indicesRows.set(this._rows[n], n);
      this._idRows[this._rows[n]._id] = this._rows[n];
    }
  }
  getCellsNeighbors(cell, row) {
    const rowIndex = this._indicesRows.get(row);
    const cells = [...row._cells];
    const cellIndex = cells.indexOf(cell);
    const rowAbove = rowIndex+1 < this._rows.length ? [...this._rows[rowIndex+1]._cells] : null;
    if (rowAbove && rowAbove.length == 4)
      rowAbove.unshift(null);
    const rowBelow = rowIndex > 0 ? [...this._rows[rowIndex-1]._cells] : null;
    if (rowBelow && rowBelow.length == 4)
      rowBelow.unshift(null);
    return {
      left: cellIndex > 0 ? cells[cellIndex-1] : null,
      right: cellIndex+1 < cells.length ? cells[cellIndex+1] : null,
      topRight: rowAbove && cellIndex+1 < rowAbove.length ? rowAbove[cellIndex+1] : null,
      topLeft: rowAbove ? rowAbove[cellIndex] : null,
      bottomRight: rowBelow && cellIndex+1 < rowBelow.length ? rowBelow[cellIndex+1] : null,
      bottomLeft: rowBelow ? rowBelow[cellIndex] : null
    }
  }
  subset(row_start, row_end) {
    if (row_start <= 0)
      row_start = 0;
    if (!row_end)
      row_end = this._rows.length;
    if (row_end < row_start)
      row_end = row_start+1;
    const newGrid = new Grid(this._rows.slice(row_start,row_end).map(r=>r.copy()));
    while (newGrid._rows.length < row_end-row_start)
      newGrid.addRow();
    return newGrid;
  }
  copy() {
    return this.subset(0,);
  }
  updateRows(rows, at=0) {
    while (at+rows.length > this._rows.length)
      this.addRow();
    for (let n=0; n<rows.length; n++) {
      const rowIndex = at + n;
      if (rowIndex < this._rows.length) {
        const oldRow = this._rows[rowIndex];
        this._indicesRows.delete(oldRow);
        delete this._idRows[oldRow._id];
      }
      this._rows[rowIndex] = rows[n];
      this._indicesRows.set(rows[n], rowIndex);
      this._idRows[rows[n]._id] = rows[n];
    }
    return this;
  }
  addRow() {
    const lastRow = this._rows.at(-1) || {_cells: []};
    const newCells = (lastRow._cells.length == 4 ? [1,2,3,4,5] : [1,2,3,4]).map(()=>new Cell());
    const newRow = new Row(newCells);
    this._indicesRows.set(newRow, this._rows.length);
    this._idRows[newRow._id] = newRow;
    this._rows.push(newRow);
  }
  async tryCompleteWord(leftInWord, cell, row, continuations, path, initialRowIndex) {
    const newLetter = leftInWord[0]
    if (cell._letter && cell._letter != newLetter) return null;
    const isContinuing = continuations instanceof Array;
    const rowIndex = this._indicesRows.get(row);
    // If we're checking a continuation and we've reached the top: good!
    if (isContinuing && row == this._rows.at(-1)) return this;
    const cellIndexInRow = row._cells.indexOf(cell);
    if (leftInWord.length == 1) {
      if (!path.includes("topRight") && !path.includes("topLeft")) return null;
      const newGrid = this.copy();
      const cellInNewGrid = newGrid._rows[rowIndex]._cells[cellIndexInRow];
      cellInNewGrid._letter = newLetter;
      cellInNewGrid._wordColor = COLORS[0];
      cellInNewGrid._wordId = wordId;
      for (let c of newGrid._rows[initialRowIndex]._cells) {
        if (c._letter) continue;
        c._letter = String.fromCharCode(65+Math.floor(random()*26)).toLocaleLowerCase();
      }
      // Continuations will make sure that each added letter allows a 3-letter word on its row
      if (!(continuations instanceof Array)) 
        continuations = [...new Array(this._rows.length-initialRowIndex-1)].map((v,i)=>FILLERS[i%FILLERS.length]);
      if (continuations.length == 0) return this;
      const continuationRowIndex = initialRowIndex+1;
      const continuationRow = newGrid._rows[continuationRowIndex];
      const onLastRow = continuationRow == newGrid._rows.at(-1);
      if (onLastRow && continuationRow._cells.some(c=>!c._letter)) return newGrid;
      const continuationWord = continuations[0];
      const newContinuations = continuations.slice(1,);
      for (let c of continuationRow._cells) {
        const attempt = await newGrid.tryCompleteWord(
          continuationWord,
          c,
          continuationRow,
          newContinuations,
          [],
          continuationRowIndex
        );
        if (attempt)
          return newGrid;
      }
      return null;
    }
    if (initialRowIndex === undefined)
      initialRowIndex = rowIndex;
    const cellNeighbors = this.getCellsNeighbors(cell, row);
    for (let neighbor of shuffle(["topRight","topLeft","left","right","bottomRight","bottomLeft"])) {
      const neighborCell = cellNeighbors[neighbor];
      if (!neighborCell) continue;
      if (neighborCell._letter && neighborCell._letter != newLetter) continue;
      let newGrid = this.copy();
      const rowInNewGrid = newGrid._rows[rowIndex];
      const cellInNewGrid = rowInNewGrid._cells[cellIndexInRow];
      cellInNewGrid._letter = newLetter;
      cellInNewGrid._wordColor = COLORS[0];
      cellInNewGrid._wordId = wordId;
      const neighborInNewGrid = newGrid.getCellsNeighbors(cellInNewGrid, rowInNewGrid)[neighbor];
      newGrid = await newGrid.tryCompleteWord(
        leftInWord.slice(1,),
        neighborInNewGrid,
        newGrid._rows[rowIndex+delta[neighbor]],
        continuations,
        [...(path || []), neighbor],
        initialRowIndex
      );
      if (newGrid) return newGrid;
    }
    return null;
  }
  async addWord(maxLength=-1) {
    wordId += 1;
    COLORS.push(COLORS.shift());
    const randomWord = drawRandomWord(maxLength);
    const randomLength = randomWord.length;
    if (this._rows.length == 0) this.addRow();
    let firstFreeRowIndex = 0;
    while (firstFreeRowIndex < this._rows.length && !this._rows[firstFreeRowIndex]._cells.find(c=>!c._letter))
      firstFreeRowIndex += 1;
    const subsetGrid = this.subset(firstFreeRowIndex,firstFreeRowIndex+randomLength);
    const rowInSubset = subsetGrid._rows[0];
    const freeIndices = rowInSubset._cells.map((c,i)=>[i,!c._letter]).filter(x=>x[1]).map(x=>x[0]);
    for (let n of shuffle(freeIndices)) {
      const cell = rowInSubset._cells[n];
      if (cell._letter && cell._letter != randomWord[0]) continue;
      const newGrid = await subsetGrid.tryCompleteWord(randomWord, cell, rowInSubset);
      if (newGrid) {
        newGrid._rows[0]._wordId = wordId;
        return this.updateRows(newGrid._rows, firstFreeRowIndex);
      }
    }
    return null;
  }
  async extendGrid(n=3, maxLength=-1, remaining) {
    if (remaining === undefined)
      remaining = n;
    if (remaining <= (-1*n)+1)
      return this;
    let firstFreeRowIndex = 0;
    while (firstFreeRowIndex < this._rows.length && !this._rows[firstFreeRowIndex]._cells.find(c=>!c._letter))
      firstFreeRowIndex += 1;
    let extendedGrid = null, success = true, attempts = 0, currentMaxLength = maxLength;
    while (!extendedGrid) {
      attempts++;
      if (attempts > 10) {
        if (remaining == n) // Try a shorter word if first call
          currentMaxLength = Math.max(3, currentMaxLength-1);
        else // Give up on this continuation: caller should try a new word
          return null;
      }
      if (attempts > 100)
        console.log("attempts over 100", attempts);
      const subsetGrid = this.subset(firstFreeRowIndex,);
      success = await subsetGrid.addWord(currentMaxLength);
      if (!success && remaining < n)
        return null; // this word didn't work
      if (success)
        extendedGrid = await subsetGrid.extendGrid(n, currentMaxLength, remaining-1);
    }
    let cutAtRow = undefined;
    if (n == remaining) {
      const cutWordId = extendedGrid._rows[n-1]._wordId;
      cutAtRow = n-1;
      while (cutAtRow < extendedGrid._rows.length && extendedGrid._rows[cutAtRow]._cells.some(c=>c._wordId <= cutWordId))
        cutAtRow += 1;
      for (let i=0; i<extendedGrid._rows.length; i++) {
        const row = extendedGrid._rows[i];
        if (i>n)
          row._wordId = undefined;
        for (let cell of row._cells) {
          if (cell._wordId && cell._wordId <= cutWordId)
            continue;
          if (cell._wordId === undefined && i <= n)
            continue;
          cell._letter = "";
          cell._wordId = undefined;
          cell._wordColor = undefined;
        }
      }
    }
    return this.updateRows(extendedGrid._rows.slice(0,cutAtRow), firstFreeRowIndex);
  }
}

let grid = new Grid();

onmessage = async (event) => {
  if ("data" in event && event.data instanceof Object) {
    const {data} = event;
    const payload = {msgId: data.msgId};
    if ("reset" in data) {
      random = sfc32(d.getFullYear(), d.getMonth(), d.getDate(), 1);
      wordId = 0;
      grid = new Grid();
    }
    if ("extend" in data) {
      if ("activeRow" in data && data.activeRow in grid._idRows) {
        const activeRow = grid._idRows[data.activeRow];
        const nrow = grid._indicesRows.get(activeRow);
        if (nrow > 1) {
          grid = grid.subset(nrow-1,);
          console.log("subset to ", grid);
        }
      }
      console.log("Processing extend", grid);
      await grid.extendGrid(data.extend, data.maxLength);
      console.log("Grid extended", grid);
      const rows = grid._rows.map(r=>Object({
        id: r._id,
        cells: r._cells.map(c=>{
          const neighbors = grid.getCellsNeighbors(c, r);
          const nIdToPos = Object.fromEntries(
            Object.entries(neighbors)
              .filter(([pos,cell])=>cell != null)
              .map(([pos,cell])=>[cell._id,pos])
          );
          return {
            color: c._wordColor,
            letter: c._letter,
            id: c._id,
            neighbors: nIdToPos
          };
        })
      }));
      payload.action = "draw";
      payload.rows = rows
      payload.activeRow = rows[0].id;
    }
    postMessage(payload);
  }
}
