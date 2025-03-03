function msToDisplay(ms) {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const secsMod = secs % 60;
  const secsToDisplay = secsMod < 10 ? `0${secsMod}` : secsMod;
  return `${mins}:${secsToDisplay}`;
}

async function registerWorker() {
  // Registering Service Worker
  if (!('serviceWorker' in navigator))
    return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
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

let path = [], wentUp = false, activeRow;
let askEngine = async (data) => null;

function gameover() {
  document.getElementById("grid").classList.add("disabled");
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
  table.style.bottom = `calc(${-1 * nrow} * (${height}px - 0.75em) + 1em)`;
  table.style.transformOrigin = `center calc(${(table.children.length - nrow)} * (${height}px - 0.75em))`;
  for (let child of [...table.children].reverse()) {
    if (child.id === activeRow) break;
    child.classList.add("belowActiveRow");
  }
}

function drawRows(rows=[]) {
  const table = document.createElement("DIV");
  let nrow=-1;
  for (let {id, cells} of rows) {
    nrow += 1;
    const tr = document.createElement("DIV");
    const idx = document.createElement("SPAN");
    idx.innerText = nrow;
    tr.append(idx);
    tr.classList.add("row");
    tr.id = id;
    tr.setAttribute("nrow", nrow);
    if (cells.length == 4)
      tr.classList.add("four");
    else
      tr.classList.add("five");
    const rowId = id;
    for (let {color, letter, id, neighbors} of cells) {
      const td = document.createElement("DIV");
      td.classList.add("cell");
      td.classList.add(color);
      td.innerText = letter;//.toUpperCase();
      td.id = id;
      const info = [letter,neighbors,nrow,td];
      td.addEventListener("pointerdown", ()=>{
        if (path.length) return;
        if (rowId != activeRow) return;
        console.log("pointer down");
        td.classList.add("selected");
        tr.classList.add("selected");
        path.push(info);
      });
      td.addEventListener("pointerenter", ()=>{
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
  table.classList.add("table");
  document.getElementById("grid").replaceChildren(table);
  if (activeRow)
    alignBottomEdgeWithRow(activeRow, /*immediate=*/true);
}

async function addRowsToGrid(n=3, maxLength=-1) {
  const data = await askEngine({extend: n, maxLength: maxLength, activeRow: activeRow});
  console.log("added rows!");
  drawRows(data.rows, data.activeRow);
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

document.addEventListener("DOMContentLoaded", ()=>{
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
    if (difference <= 0) return gameover();
    window.requestAnimationFrame(updateTimer);
  }

  let score = 0, skips = 1;
  const start = async ()=>{
    activeRow = undefined;
    startTime = undefined;
    score = 0;
    skips = 1;
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
    await new Promise(r=>setTimeout(r,1000));
    loadingText.innerHTML = "D&eacute;part dans 2s";
    await new Promise(r=>setTimeout(r,1000));
    loadingText.innerHTML = "D&eacute;part dans 1s";
    await new Promise(r=>setTimeout(r,1000));
    loadingText.innerHTML = "C'est parti !";
    await new Promise(r=>setTimeout(r,500));
    loadingScreen.style.display = "none";
    window.requestAnimationFrame(updateTimer);
  };
  start();
  document.getElementById("addWord").addEventListener("pointerdown", async () => {
    await askEngine({reset: true});
    start();
  });

  document.getElementById("skip").addEventListener("pointerdown", async (e) => {
    if (skips <= 0) return;
    skips += -1;
    e.target.innerText = `Passer le niveau (${Math.max(0, skips)})`;
    if (skips <= 0) e.target.classList.add("disabled");
    const rowActive = document.getElementById(activeRow);
    const rowAbove = rowActive.previousSibling;
    goToRow(rowAbove.id);
  });

  window.addEventListener("pointerup", async ()=>{
    console.log("pointerup");
    let word = "";
    let nRowLastCell = 0;
    while (path.length) {
      const [letter,neighbors,nrow,td] = path.shift();
      td.classList.remove("selected");
      td.parentElement.classList.remove("selected");
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
      document.getElementById("score").innerText = score;
      goToRow(newBottomRow.id);
    }
    wentUp = false;
  });

})
