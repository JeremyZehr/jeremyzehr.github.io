let db;

function initDB() {
  const request = window.indexedDB.open("wridges");
  return new Promise((resolve,reject)=>{
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      // Save the IDBDatabase interface
      db = event.target.result;
      const request = db.createObjectStore("scores", { keyPath: "day" });
      request.onsuccess = ()=>resolve(db);
      request.onerror = (event)=>reject(event);
    };
    request.onerror = (event) => {
      console.error("Error with IndexedDB:", event);
      reject(event);
    };  
  });
}

function dbOperation(method, ...args) {
  const scoreObjectStore = db
    .transaction(["scores"], "readwrite")
    .objectStore("scores");
  const request = scoreObjectStore[method](...(args||[]));
  return new Promise((resolve,reject)=>{
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event);
  });
};
function setDB(day, score) {
  return dbOperation("add", {day: day, score: score});
}
function updateDB(day, score) {
  return dbOperation("put", {day: day, score: score});
}
function getAllDB() {
  return dbOperation("getAll");
}
