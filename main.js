// IndexedDB 初期化と保存
let db;
const request = indexedDB.open("WellnestDB", 1);
request.onupgradeneeded = e => {
  db = e.target.result;
  db.createObjectStore("logs", { keyPath: "id", autoIncrement: true });
  db.createObjectStore("teams", { keyPath: "id", autoIncrement: true });
};
request.onsuccess = () => db = request.result;

// AI健康プラン生成（GAS 経由で Gemini API 使用）
async function generateHealthPlan() {
  const sleep = document.getElementById("sleep").value;
  const mood = document.getElementById("mood").value;
  const meal = document.getElementById("meal").value;

  if (!sleep || !mood || !meal) {
    alert("すべての項目を入力してください。");
    return;
  }

  const res = await fetch("https://script.google.com/macros/s/【GASのURL】/exec", {
    method: "POST",
    body: JSON.stringify({ sleep, mood, meal }),
    headers: { "Content-Type": "application/json" }
  });

  const data = await res.json();
  document.getElementById("plan").textContent = data.plan || "プラン生成に失敗しました";

  // 保存
  const tx = db.transaction("logs", "readwrite");
  const store = tx.objectStore("logs");
  store.add({
    date: new Date().toISOString(),
    input: { sleep, mood, meal },
    plan: data.plan
  });
}

// グループチャレンジ参加
function joinTeam() {
  const name = document.getElementById("teamName").value.trim();
  if (!name) return alert("チーム名を入力してください");
  
  const tx = db.transaction("teams", "readwrite");
  const store = tx.objectStore("teams");
  const team = { name, joined: new Date().toISOString() };
  store.add(team);

  const li = document.createElement("li");
  li.textContent = `✅ ${name} に参加しました`;
  document.getElementById("teamList").appendChild(li);
}

// チーム一覧読み込み
function loadTeams() {
  const tx = db.transaction("teams", "readonly");
  const store = tx.objectStore("teams");
  const request = store.getAll();
  request.onsuccess = () => {
    const list = document.getElementById("teamList");
    list.innerHTML = "";
    request.result.forEach(team => {
      const li = document.createElement("li");
      li.textContent = `👥 ${team.name} に参加中`;
      list.appendChild(li);
    });
  };
}

// カメラ姿勢検出（MediaPipe Pose）
async function setupPose() {
  const video = document.getElementById("poseVideo");
  const canvas = document.getElementById("poseCanvas");
  const ctx = canvas.getContext("2d");

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  const pose = new Pose.Pose({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });
  pose.setOptions({ modelComplexity: 1, smoothLandmarks: true });
  pose.onResults(results => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (results.poseLandmarks) {
      drawConnectors(ctx, results.poseLandmarks, Pose.POSE_CONNECTIONS, { color: '#0f0', lineWidth: 2 });
      drawLandmarks(ctx, results.poseLandmarks, { color: '#f00', lineWidth: 1 });
    }
  });

  const camera = new Camera(video, {
    onFrame: async () => {
      await pose.send({ image: video });
    },
    width: 640,
    height: 480
  });
  camera.start();
}

// 通知（毎回表示）
function notifyHydration() {
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("💧 水分補給を忘れずに！");
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => {
        if (p === "granted") {
          new Notification("💧 水分補給を忘れずに！");
        }
      });
    }
  }
}

// 初期化
window.onload = () => {
  loadTeams();
  setupPose();
  notifyHydration();
};
