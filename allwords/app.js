function shuffleArray(array) {
  let curId = array.length;
  // There remain elements to shuffle
  while (0 !== curId) {
    // Pick a remaining element
    let randId = Math.floor(Math.random() * curId);
    curId -= 1;
    // Swap it with the current element.
    let tmp = array[curId];
    array[curId] = array[randId];
    array[randId] = tmp;
  }
  return array;
}

// Registering Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

setTimeout(()=>startGame(1), 500);

const MAX_WORDS = 45;
const LEVELS = [
  {max: 5, min: 3, blackout: 1000, minP: 1000, maxP: 2000},  // 1 ; 8*3, 7*4, 1*5
  {max: 5, min: 3, blackout: 1000, minP: 2000, maxP: 3000},  // 2 ; 7*3, 11*4, 6*5
  {max: 6, min: 3, blackout: 1500, minP: 2000, maxP: 3500},  // 3 ; 10*3, 8*4, 2*5, 2*6
  {max: 6, min: 3, blackout: 1500, minP: 3000, maxP: 4000},  // 4  ; 10*3, 11*4, 7*5, 2*6
  {max: 6, min: 4, blackout: 1500, minP: 3000, maxP: 4500},  // 5 ; 17*4, 7*5, 1*6
  {max: 7, min: 4, blackout: 2000, minP: 4000, maxP: 5000},  // 6 ; 18*4, 2*5, 4*6, 1*7
  {max: 7, min: 4, blackout: 2000, minP: 4000, maxP: 5500},  // 7 ; 19*4, 10*5, 4*6, 1*7
  {max: 7, min: 4, blackout: 2000, minP: 4000, maxP: 6000},  // 8 ; 21*4, 15*5, 4*6, 1*7
  {max: 7, min: 5, blackout: 2500, minP: 5000, maxP: 7000},  // 9 ; 29*5, 8*6, 1*7
  {max: 7, min: 5, blackout: 2500, minP: 5000, maxP: 7500}  // 10 ; 24*5, 9*6, 1*7
];
const pointsPerLengths = {3: 60, 4: 90, 5: 140, 6: 220, 7: 340};

refs = JSON.parse(refs);
const dics = {
  3: JSON.parse(dic3),
  4: JSON.parse(dic4),
  5: JSON.parse(dic5),
  6: JSON.parse(dic6),
  7: JSON.parse(dic7)
}

let points = 0;
let hiscore = localStorage.getItem("hiscore") || 0;
document.querySelector("#hiscore").innerText = hiscore;

const startGame = async level => {
  if (level==1) points = 0;

  const pick = n_letters => {
    const candidates = Object.keys(dics[n_letters]);
    const p = candidates[Math.floor(Math.random()*candidates.length)];
    console.log("pick", p);
    const pick_refs = dics[n_letters][p];
    console.log("pick refs", pick_refs);
    const words_list = refs[n_letters][p];
    for (let n in pick_refs){
      if (n<3) continue;
      words_list.push( ...(pick_refs[n].map(r=>Object.entries(refs[n])[r][1])).flat() );
    }
    return words_list;
  }
  let pi = [], tmpPoints = -1;
  while (tmpPoints<LEVELS[level-1].minP || tmpPoints>LEVELS[level-1].maxP || pi.length>MAX_WORDS) {
    pi = pick(LEVELS[level-1].max);
    pi = pi.filter((w,i)=>pi.indexOf(w,i+1)<0 && w.length >= LEVELS[level-1].min);
    tmpPoints = pi.map(w=>pointsPerLengths[w.length]).reduce((x,y)=>x+y);
  }
  console.log("words list", pi);
  console.log("points", tmpPoints);

  document.querySelector("#level").innerText = level;
  const ui = document.querySelector("#ui");
  ui.style.display = 'none';
  const nextlevelButton = document.querySelector("#nextlevel");
  nextlevelButton.classList.remove("unlocked");
  nextlevelButton.addEventListener("click",()=>nextlevelunlocked && stopGame());
  nextlevelButton.addEventListener("touchstart",()=>nextlevelunlocked && stopGame());
  const pauseButton = document.querySelector("#pause");

  let nextlevelunlocked = false;
  let gameOver = false;
  let stoppingGame = false;
  let paused = false;

  let timer = 180, startTimer;
  let temporarilyDisablePause = false;
  pause = ()=>{
    if (gameOver) return;
    temporarilyDisablePause = true;
    setTimeout(()=>temporarilyDisablePause=false, 300);
    paused = !paused;
    if (paused) {
      const d = document.querySelector("#timer").innerText.split(':');
      timer = Number(d[0])*60 + Number(d[1]);
      startTimer = undefined;
      message("Gamed paused.");
      ui.innerHTML = "";
      const resume = document.createElement("DIV");
      resume.innerText = "Resume";
      resume.addEventListener("click", ()=>setTimeout(pause, 100));
      resume.addEventListener("touchstart", ()=>setTimeout(pause, 100));
      ui.append(resume);
      ui.style.display = 'flex';
    }
    else{
      message("Game resumed.");
      ui.style.display = 'none';
      window.requestAnimationFrame(updateTimer);
    }
  }
  pauseButton.addEventListener("click", pause);
  pauseButton.addEventListener("touchstart", pause);
  document.addEventListener("visibilitychange", () => document.visibilityState != "visible" && !paused && pause() );
  window.addEventListener("blur", () => !paused && pause() );

  const stopGame = ()=>{
    if (stoppingGame || paused) return;
    stoppingGame = true;
    gameOver=true;
    [...words.values()].forEach(w=>{
      w.classList.remove("max");
      w.reveal();
    });
    ui.innerText = "";
    if (nextlevelunlocked && level<10) {
      level++;
      const nextlvl = document.createElement("div");
      nextlvl.innerText = "Next level";
      nextlvl.addEventListener("click", ()=>startGame(level));
      nextlvl.addEventListener("touchstart", ()=>startGame(level));
      ui.append(nextlvl);
      message("Moving on to level "+level);
    }
    else {
      const newgame = document.createElement("div");
      newgame.innerText = "Start new game";
      newgame.addEventListener("click", ()=>startGame(1));
      newgame.addEventListener("touchstart", ()=>startGame(1));
      ui.append(newgame);
      if (nextlevelunlocked) message("Congratulations! Your final score is "+points);
      else message("Game Over! Your final score is "+points);
    }
    setTimeout(()=>ui.style.display='flex',2000);
  }
  
  await new Promise(r=>setTimeout(r,200));

  const updateTimer = timestamp => {
    if (gameOver || paused) return;
    if (startTimer===undefined) startTimer=timestamp;
    const diff = timer - (timestamp-startTimer)/1000;
    if (diff<=0) stopGame();
    else {
      let mins = Math.trunc(diff/60);
      let secs = Math.trunc(diff%60);
      document.querySelector("#timer").innerText = `${mins}:${secs<10?'0':''}${secs}`;
      window.requestAnimationFrame(updateTimer);
    }
  }
  window.requestAnimationFrame(updateTimer);

  const score = n=>{
    if (isNaN(n)) return;
    points += n;
    document.querySelector("#score").innerText = points;
    if (points > hiscore) {
      hiscore = points;
      localStorage.setItem("hiscore", hiscore);
      document.querySelector("#hiscore").innerText = hiscore;
    }
  }

  const messageDOM = document.querySelector("#message");
  const lettersDOM = document.querySelector("#letters");
  const guessDom = document.querySelector("#guess");

  messageDOM.style.display = 'none';
  lettersDOM.innerHTML = "";
  guessDom.innerHTML = "";
  guessDom.style.display = 'flex';
  const wordsToRemove = [...document.querySelectorAll("#grid .word")];
  while (wordsToRemove.length) wordsToRemove.pop().remove();

  const message = msg =>{
    console.log("message", msg);
    messageDOM.innerText = msg;
    messageDOM.style.display = 'block';
    guessDom.style.display = 'none';
  }
  
  const letters = pi[0].split("");
  const letterButtons = letters.map(l=>{
    const d = document.createElement("DIV");
    d.classList.add('letter');
    d.innerText = l;
    let guessing = true;
    let position = -1;
    d.switch = ()=>{
      guessing = !guessing;
      console.log("moving",d,guessing);
      if (guessing) {
        position = [...lettersDOM.children].findIndex(c=>c.contains(d));
        const freeGuess = [...guessDom.children].find(c=>c.childElementCount==0);
        freeGuess.append(d);
        guessDom.style.display = 'flex';
        messageDOM.style.display = 'none';
      }
      else {
        if (position<0 || lettersDOM.children[position].childElementCount>0) {
          const freeLetter = [...lettersDOM.children].find(c=>c.childElementCount==0);
          freeLetter.append(d);
          position = [...lettersDOM.children].findIndex(c=>c.contains(d));
        }
        else
          lettersDOM.children[position].append(d);
      }
    }
    return d;
  });
  shuffleArray(letterButtons);
  console.log("letterButtons", letterButtons);
  letterButtons.forEach(b=>{
    const letterContainer = document.createElement("div");
    letterContainer.classList.add("container");
    lettersDOM.append(letterContainer);
    const guessContainer = document.createElement("div");
    guessContainer.classList.add("container");
    guessDom.append(guessContainer);
    b.switch();
  });

  const words = new Map();
  pi.sort((x,y)=>Number(x.length==y.length?x>y:x.length>y.length)-0.5).forEach(w=>{
    const word = document.createElement("a");
    word.classList.add("word");
    w.split("").forEach(l=>{
      const letter = document.createElement("span");
      letter.classList.add("letter");
      letter.innerText = "_";
      word.append(letter);
    })
    if (w.length==LEVELS[level-1].max) word.className += " max locked";
    words.set(w,word);
    let revealed = false;
    word.reveal = ()=>{
      if (revealed) return message(w+" already found!");
      revealed = true;
      word.innerHTML = "";
      word.classList.add("revealed");
      w.split("").forEach(l=>{
        const letter = document.createElement("span");
        letter.classList.add("letter");
        letter.innerText = l;
        word.append(letter);
      });
      word.setAttribute("href", "https://en.wiktionary.org/wiki/"+w.toLowerCase()+"#English");
      word.setAttribute("target", "_blank");
      if (gameOver)
        word.classList.add("notfound");
      else {
        word.classList.add("justfound");
        message(w+": "+pointsPerLengths[w.length]+" points!");
        score(pointsPerLengths[w.length]);
        if (!nextlevelunlocked && w.length==LEVELS[level-1].max) {
          nextlevelunlocked = true;
          document.querySelector("#nextlevel").classList.add("unlocked");
          [...words.values()].forEach(w2=>w2.classList.remove("locked"));
          message(w+": "+pointsPerLengths[w.length]+" points! Next level unlocked");
        }
        if ([...words.values()].find(e=>!e.classList.contains("revealed"))) return;
        gameOver=true;
        message("Blackout bonus: "+LEVELS[level-1].blackout+" points!");
        setTimeout(stopGame, 2500);
      }
    }
    document.querySelector("#grid").append(word);
  });
  console.log("words map", words);

  let down = false;
  const contactXY = (x,y) => {
    if (!down) return;
    if (gameOver || paused) return;
    [...words.values()].forEach(w=>w.classList.remove("justfound"));
    document.elementsFromPoint(x,y).forEach(el=>{
      if (letterButtons.indexOf(el)<0) 
        el = letterButtons.find(l=>[...guessDom.children,...lettersDOM.children].find(c=>el===c)&&el.contains(l));
      if (el) el.switch();
    });
  }
  const stopContact = () => {
    down = false;
    const toConcatenate = [...guessDom.children].filter(c=>c.childElementCount>0).map(c=>c.children[0]);
    toConcatenate.forEach((l,i)=>guessDom.children[i].append(l));
  }
  document.addEventListener("mousedown", e=>{down=true;contactXY(e.clientX,e.clientY);});
  document.addEventListener("touchstart", e=>{down=true;contactXY(e.touches[0].clientX,e.touches[0].clientY);});
  document.addEventListener("mouseup", stopContact);
  document.addEventListener("touchend", stopContact);
  document.addEventListener("touchcancel", ()=>down=false);
  document.addEventListener("mousemove", e=>contactXY(e.clientX,e.clientY));
  document.addEventListener("touchmove", e=>contactXY(e.touches[0].clientX,e.touches[0].clientY));

  let temporarilyDisableShuffle = false;
  const shuffleLetters = ()=>{
    if (gameOver || paused || temporarilyDisableShuffle) return;
    temporarilyDisableShuffle = true;
    setTimeout(()=>temporarilyDisableShuffle=false, 300);
    const lettersToShuffle = [...lettersDOM.children].filter(c=>c.childElementCount>0).map(c=>c.children[0]);
    if (lettersToShuffle.length<2) return;
    const copyLettersToShuffle = [...lettersToShuffle];
    while (lettersToShuffle.every((e,i)=>e===copyLettersToShuffle[i])) shuffleArray(lettersToShuffle);
    lettersToShuffle.forEach((l,i)=>lettersDOM.children[i].append(l));
  }
  document.querySelector("#shuffleButton").addEventListener("click", shuffleLetters);
  document.querySelector("#shuffleButton").addEventListener("touchstart", shuffleLetters);

  let temporarilyDisableSubmit = false;
  const submit = ()=>{
    if (gameOver || paused || temporarilyDisableSubmit) return;
    temporarilyDisableSubmit = true;
    setTimeout(()=>temporarilyDisableSubmit=false, 300);
    const guess = guessDom.innerText.replace(/\n/g,'');
    if (guess.length==0) return;
    if (guess.length<LEVELS[level-1].min) message("Words must be at least "+LEVELS[level-1].min+" letters long");
    else {
      const goodGuess = words.get(guess);
      if (goodGuess!==undefined) goodGuess.reveal();
      else message(guess+" not in the list.");
    }
    const lettersLeft = [...lettersDOM.children].filter(c=>c.childElementCount>0).map(c=>c.children[0]);
    const lettersInGuess = [...guessDom.children].filter(c=>c.childElementCount>0).map(c=>c.children[0]);
    console.log("lettersInGuess", lettersInGuess);
    lettersInGuess.forEach(l=>l.switch());
    for (let i=0; i<letters.length; i++) {
      if (lettersInGuess.length>0) lettersDOM.children[i].append(lettersInGuess.shift());
      else lettersDOM.children[i].append(lettersLeft.shift());
    }
  }
  document.querySelector("#submit").addEventListener("click", submit);
  document.querySelector("#submit").addEventListener("touchstart", submit);
}

let ratio = 1;
const zoom = percent => {
  ratio = 0.5 + percent/100;
  document.querySelector("#container").style.scale = ratio;
}
const scaleDOM = document.querySelector("#scale");
scaleDOM.addEventListener("input", e=>zoom(e.target.value));
const changeRatio = diff=>{
  console.log("yay!");
  ratio += diff;
  scaleDOM.value = 100 * ratio - 50;
  zoom(scaleDOM.value);
}
document.querySelector("#plus").addEventListener("click", e=>changeRatio(0.1));
document.querySelector("#plus").addEventListener("touchstart", e=>changeRatio(0.1));
document.querySelector("#minus").addEventListener("click", e=>changeRatio(-0.1));
document.querySelector("#minus").addEventListener("touchstart", e=>changeRatio(-0.1));
