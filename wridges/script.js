function msToDisplay(ms) {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const secsMod = secs % 60;
  const secsToDisplay = secsMod < 10 ? `0${secsMod}` : secsMod;
  return `${mins}:${secsToDisplay}`;
}

function customEvent(...args) {
  const nodes = args.filter(a=>a === window || a instanceof Node);
  const events = args.filter(a=>typeof(a) == "string");
  const handlers = args.filter(a=>a instanceof Function);
  for (let node of nodes)
    for (let event of events)
      for (handler of handlers)
        node.addEventListener(event, handler);
}

async function registerWorker() {
  // Registering Service Worker
  if (!('serviceWorker' in navigator))
    return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    if (registration.installing) {
      console.log("Service worker installing", registration.installing);
    } else if (registration.waiting) {
      console.log("Service worker installed");
    } else if (registration.active) {
      console.log("Service worker active");
    }
    console.log("registration", registration);

  } catch (error) {
    console.error(`Registration failed with ${error}`);
  }

  navigator.serviceWorker.ready.then((registration) => {
    navigator.serviceWorker.addEventListener("message", (message) => {
      console.log("message back from the worker", message);
    });
    registration.active.postMessage(
      "Test message sent immediately after creation",
    );
  });
}
registerWorker();

const TODAY = (()=>{
  const d = new Date();
  return [d.getFullYear(), d.getMonth()+1, d.getDate()].map(n=>n < 10 ? "0"+n : n).join("");
})();
let allBonusLetters = [], allScores = [], topScoreToday;
let bonusLettersCollected = [], score = 0, skips = 1;
let path = [], wentUp = false, activeRow;
let askEngine = async (data) => null;

async function gameover(score) {
  document.getElementById("grid").classList.add("disabled");
  const gameoverNode = document.getElementById("gameover");
  gameoverNode.querySelector("[name='level']").innerText = score;
  for (let n in allBonusLetters) {
    const span = gameoverNode.querySelector(`[name='bonus${parseInt(n)+1}']`);
    if (bonusLettersCollected.some(l=>l.id == allBonusLetters[n].id))
      span.innerText = allBonusLetters[n].letter;
    else
      span.innerText = "*";
  }
  if (topScoreToday === undefined)
    await setDB(TODAY, score);
  else if (score > topScoreToday)
    await updateDB(TODAY, score);
  topScoreToday = Math.max(score, topScoreToday || 0);
  allScores = await getAllDB();
  const allScoresNode = gameoverNode.querySelector("[name='allScores']");
  allScoresNode.replaceChildren();
  for (let {day, score} of allScores) {
    const record = document.createElement("SPAN");
    const dateTxt = `${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6,8)}`;
    record.innerText = `${dateTxt} : ${score}`;
    const tryThatDay = document.createElement("INPUT");
    tryThatDay.type = "button";
    tryThatDay.value = "↺";
    tryThatDay.addEventListener("pointerdown", async () => {
      await askEngine({reset: dateTxt});
      start();
    });
    record.append(tryThatDay);
    allScoresNode.prepend(record);
  }
}

async function alignBottomEdgeWithRow(rowId, immediate=false) {
  activeRow = rowId;
  const table = document.querySelector("#grid .table");
  table.querySelector(`.row[id='${rowId}']`).classList.add("active");
  if (immediate)
    table.style.transition = "unset";
  else
    table.style.transition = "bottom 1s";
  const activeRowTr = document.getElementById(activeRow);
  const nrow = activeRowTr.getAttribute("nrow");
  const dummyRow = document.getElementById("dummyRow");
  const {height} = dummyRow.getBoundingClientRect();
  table.style.bottom = `calc(${-1 * nrow} * (${height}px - 0.75em))`;
  table.style.transformOrigin = `center calc(${(table.children.length - nrow)} * (${height}px - 0.75em))`;
  for (let child of [...table.children].reverse()) {
    if (child.id === activeRow) break;
    child.classList.add("belowActiveRow");
  }
}

function drawRows(rows=[], nBottomRow=0) {
  const table = document.createElement("DIV");
  let nrow=-1;
  for (let {id, cells} of rows) {
    nrow += 1;
    const tr = document.createElement("DIV");
    const idx = document.createElement("SPAN");
    idx.innerText = nrow;
    tr.append(idx);
    tr.classList.add("row");
    if (topScoreToday && nrow+nBottomRow == topScoreToday)
      tr.classList.add("topScore");
    tr.id = id;
    tr.setAttribute("nrow", nrow);
    if (cells.length == 4)
      tr.classList.add("four");
    else
      tr.classList.add("five");
    const rowId = id;
    for (let {color, letter, id, neighbors, bonusLetter} of cells) {
      const td = document.createElement("DIV");
      td.classList.add("cell");
      if (bonusLetter) {
        td.classList.add("bonus");
        if (!bonusLettersCollected.some(l=>l.id === id))
          td.classList.add("uncollected");
        const nextBonusLetter = allBonusLetters.find(l=>l.id === null);
        if (nextBonusLetter && !allBonusLetters.some(l=>l.id === id))
          nextBonusLetter.id = id;
      }
      td.classList.add(color);
      td.innerText = letter;//.toUpperCase();
      td.id = id;
      const info = [letter,neighbors,nrow,td];
      td.addEventListener("pointerdown", ()=>{
        if (path.length) return;
        if (rowId != activeRow) return;
        console.log("pointer down");
        td.classList.add("selected");
        path.push(info);
      });
      customEvent(td, "pointerenter", ()=>{
        if (path.length==0) return;
        const pIdx = path.indexOf(info);
        if (pIdx > -1) {
          path.forEach(c=>c.at(-1).classList.remove("selected"));
          path = path.slice(0,pIdx+1);
          path.forEach(c=>c.at(-1).classList.add("selected"));
        }
        else {
          const lastCellInPath = path.at(-1);
          const isNeighbor = id in lastCellInPath[1];
          if (!isNeighbor) return;
          wentUp = wentUp || lastCellInPath[1][id].startsWith("top");
          td.classList.add("selected");
          path.push(info);
        }
      })
      tr.append(td);
    }
    table.prepend(tr);
  }
  // Add a touchmove event on the whole table for mobile devices,
  // which won't trigger pointerenter otherwise
  customEvent(table, "touchmove", e=>{
    const cx = e.targetTouches[0].clientX, cy = e.targetTouches[0].clientY;
    const trs = [...table.children].reverse();
    for (let tr of trs) {
      var {x,y,width,height} = tr.getBoundingClientRect();
      if (cx < x || cx > x+width || cy < y || cy > y+height) continue;
      for (let td of tr.children) {
        var {x,y,width,height} = td.getBoundingClientRect();
        const touchPadding = 15;
        const x2 = x+touchPadding, y2 = y+touchPadding;
        const x2w = x+width-touchPadding, y2h = y+height-touchPadding;
        if (cx < x2 || cx > x2w || cy < y2 || cy > y2h) continue;
        return td.dispatchEvent(new Event("pointerenter"));
      }
    }
  });
  table.classList.add("table");
  document.getElementById("grid").replaceChildren(table);
  if (activeRow)
    alignBottomEdgeWithRow(activeRow, /*immediate=*/true);
}

async function addRowsToGrid(n=3, maxLength=-1) {
  const data = await askEngine({extend: n, maxLength: maxLength, activeRow: activeRow});
  console.log("added rows!", data);
  drawRows(data.rows, data.nBottomRow);
  if (!activeRow)
    alignBottomEdgeWithRow(data.rows[0].id);
}

const stackAddRows = [];
async function addStack(...args) {
  stackAddRows.push(args);
  if (stackAddRows.length > 1)
    return;
  while (a = stackAddRows.shift())
    await addRowsToGrid(...a);
}

function goToRow(rowId) {
  alignBottomEdgeWithRow(rowId);
  const rowActive = document.getElementById(activeRow);
  const allRows = document.querySelector("#grid .table").children;
  if (allRows.length - rowActive.getAttribute("nrow") <= 20) {
    // Add 20 words in two steps
    addStack(10);
    addStack(10);
  }
}

const updateDisplay = () => {
  const cWidth = document.documentElement.clientWidth;
  const cHeight = document.documentElement.clientHeight;
  if (cHeight > cWidth) {
    const table = document.querySelector("#grid .table")
    const currentScale = table.style.transform.replace(/^.*scale\((\d+(\.\d+)?)\).*$/, "$1");
    const {width} = document.querySelector("#dummyGrid .table").getBoundingClientRect();
    const newScale = (cWidth - 40) / width; // At least 20px on each side
    if (Math.abs(newScale - currentScale) > 0.1)
      table.style.transform = `scale(${newScale}) translateY(0.75em)`;
  }
  // Update the height of the grid (calc(100vw - 4.5em) doesn't work on mobile devices)
  const grid = document.getElementById("grid");
  grid.style.height = `${cHeight - document.getElementById("bottomBar").getBoundingClientRect().height}px`;
  window.requestAnimationFrame(updateDisplay);
}


const TTL = 60000;
let startTime = undefined;
const updateTimer = timestamp => {
  if (startTime === undefined) startTime = timestamp;
  const difference = TTL - (timestamp - startTime);
  document.getElementById("timer").innerText = msToDisplay(Math.max(0, difference));
  const timerWheel = document.getElementById("timerWheel");
  let wheelColor = "green";
  const perc = 100 * Math.min(1, difference / TTL);
  if (perc < 50) wheelColor = "orange";
  if (perc <= 17) wheelColor = "red";
  timerWheel.style.background = `conic-gradient(white ${100 - perc}%, 0, ${wheelColor}) border-box`;
  if (difference <= 0) return gameover(score);
  window.requestAnimationFrame(updateTimer);
}

const start = async ()=>{
  activeRow = undefined;
  startTime = undefined;
  score = 0;
  skips = 1;
  allBonusLetters.forEach(l=>l.id = null);
  bonusLettersCollected = [];
  document.getElementById("score").innerText = score;
  const skipNode = document.getElementById("skip");
  skipNode.innerText = `Passer le niveau (${skips})`;
  skipNode.classList.remove("disabled");
  // loading
  const loadingScreen = document.getElementById("loadingScreen");
  const loadingText = document.getElementById("loadingText");
  const loadingBar = document.getElementById("loadingBar");
  loadingScreen.style.display = "flex";
  document.getElementById("grid").classList.remove("disabled");
  loadingText.innerText = "Chargement...";
  loadingBar.style.background = "linear-gradient(to right, pink 0%, white 0%)";
  // Start by adding 7*5 rows of short words for performance
  const lengths = [4,5,5,6,6,6,6];
  let nRowsPerIteration = 5;
  for (let n in lengths) {
    const maxLength = lengths[n];
    loadingBar.style.background = `linear-gradient(to right, pink ${100 * n / lengths.length}%, white 0%)`;
    await addRowsToGrid(nRowsPerIteration, maxLength);
  }
  loadingBar.style.background = `linear-gradient(to right, pink 100%, white 0%)`;
  loadingText.innerHTML = "D&eacute;part dans 3s";
  // await new Promise(r=>setTimeout(r,1000));
  // loadingText.innerHTML = "D&eacute;part dans 2s";
  // await new Promise(r=>setTimeout(r,1000));
  // loadingText.innerHTML = "D&eacute;part dans 1s";
  // await new Promise(r=>setTimeout(r,1000));
  // loadingText.innerHTML = "C'est parti !";
  // await new Promise(r=>setTimeout(r,500));
  loadingScreen.style.display = "none";
  window.requestAnimationFrame(updateTimer);
};

document.addEventListener("DOMContentLoaded", async ()=>{

  updateDisplay();

  const worker = new Worker("worker.js");
  let workerCallbacks = [];
  let msgId = 0;
  askEngine = (data) => new Promise(r=>{
    const currentId = msgId;
    const callback = (payload) => {
      if (payload.msgId != currentId) return;
      workerCallbacks = workerCallbacks.filter(c=>c!=callback);
      r(payload);
    };
    workerCallbacks.push(callback)
    data.msgId = currentId;
    worker.postMessage(data);
    msgId++;
  });
  worker.onerror = e=>console.log("error", e);
  worker.onmessage = (event) => workerCallbacks.forEach(f=>f instanceof Function && f.call(worker, event.data));
  
  document.getElementById("resetGrid").addEventListener("pointerdown", async () => {
    await askEngine({reset: true});
    start();
  });

  document.getElementById("skip").addEventListener("pointerdown", async (e) => {
    console.log("skip!");
    const grid = document.getElementById("grid");
    if (skips <= 0 || [grid,e.target].some(x=>x.classList.contains("disabled"))) return;
    skips += -1;
    score += 1;
    document.getElementById("score").innerText = score;
    e.target.innerText = `Passer le niveau (${Math.max(0, skips)})`;
    if (skips <= 0) e.target.classList.add("disabled");
    const rowActive = document.getElementById(activeRow);
    const rowAbove = rowActive.previousSibling;
    console.log("goToRow", rowAbove.id);
    goToRow(rowAbove.id);
  });

  customEvent(window, "pointerup", "touchcancel", async ()=>{
    let word = "";
    let nRowLastCell = 0;
    const bonusInPath = [];
    while (path.length) {
      const [letter,neighbors,nrow,td] = path.shift();
      td.classList.remove("selected");
      td.parentElement.classList.remove("selected");
      if (td.classList.contains("uncollected"))
        bonusInPath.push({letter: letter, id: td.id});
      word += letter;
      nRowLastCell = nrow;
    }
    if (word.length < 3) return (path = []);
    const words = DICTIONARY[word.length];
    if (wentUp && words && words[word]) {
      const allRows = document.querySelector("#grid .table").children;
      const rowLastCell = allRows[(allRows.length-1) - nRowLastCell];
      const rowActive = document.getElementById(activeRow);
      const rowAboveActive = rowActive.previousSibling;
      const newBottomRow = Number(rowAboveActive.getAttribute("nrow")) > Number(rowLastCell.getAttribute("nrow"))
        ? rowAboveActive
        : rowLastCell;
      console.log("rowlastcell", rowLastCell, rowActive, rowAboveActive, newBottomRow);
      const levelsGained = parseInt(newBottomRow.getAttribute("nrow")) - parseInt(rowActive.getAttribute("nrow"));
      score += levelsGained;
      startTime += 1000 * levelsGained;
      startTime += 1000 * Math.max(0, word.length-3);
      const skipNode = document.getElementById("skip");
      while (bonusInPath.length) {
        startTime += 2000 * (bonusLettersCollected.length+1);
        if (bonusLettersCollected.length==4)
          startTime += 10000;
        skips += 1;
        skipNode.innerText = `Passer le niveau (${Math.max(0, skips)})`;
        skipNode.classList.remove("disabled");
        const collected = bonusInPath.shift();
        const td = document.getElementById(collected.id);
        td.classList.remove("uncollected");
        bonusLettersCollected.push(collected);
      }
      document.getElementById("score").innerText = score;
      goToRow(newBottomRow.id);
    }
    wentUp = false;
  });

  await initDB();
  allScores = await getAllDB();
  const record = allScores.find(s=>s.day === TODAY);
  if (record)
    topScoreToday = record.score;
  const dataBonusLetters = await askEngine({getBonusLetters: true});
  allBonusLetters = dataBonusLetters.bonusLetters;
  start();
})
