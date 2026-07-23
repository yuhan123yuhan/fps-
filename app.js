const state = {
  running: false,
  round: 0,
  rounds: 20,
  size: 34,
  pace: 1400,
  target: null,
  spawnedAt: 0,
  timeoutId: null,
  results: [],
  streak: 0,
  best: loadBest(),
};

const elements = {
  stage: document.getElementById("stage"),
  target: document.getElementById("target"),
  reticle: document.getElementById("reticle"),
  shotMarker: document.getElementById("shotMarker"),
  startButton: document.getElementById("startButton"),
  overlayStartButton: document.getElementById("overlayStartButton"),
  resetButton: document.getElementById("resetButton"),
  overlay: document.getElementById("startOverlay"),
  modeSelect: document.getElementById("modeSelect"),
  roundsInput: document.getElementById("roundsInput"),
  sizeInput: document.getElementById("sizeInput"),
  paceInput: document.getElementById("paceInput"),
  roundsValue: document.getElementById("roundsValue"),
  sizeValue: document.getElementById("sizeValue"),
  paceValue: document.getElementById("paceValue"),
  roundLabel: document.getElementById("roundLabel"),
  liveFeedback: document.getElementById("liveFeedback"),
  sessionState: document.getElementById("sessionState"),
  accuracyMetric: document.getElementById("accuracyMetric"),
  timeMetric: document.getElementById("timeMetric"),
  errorMetric: document.getElementById("errorMetric"),
  streakMetric: document.getElementById("streakMetric"),
  bestAccuracy: document.getElementById("bestAccuracy"),
  bestTime: document.getElementById("bestTime"),
  samplesLabel: document.getElementById("samplesLabel"),
  lastResult: document.getElementById("lastResult"),
  historyList: document.getElementById("historyList"),
  offsetMap: document.getElementById("offsetMap"),
};

const mapContext = elements.offsetMap.getContext("2d");

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem("fpsAimTrainerBest")) || {};
  } catch {
    return {};
  }
}

function saveBest(summary) {
  const shouldSave =
    !state.best.accuracy ||
    summary.accuracy > state.best.accuracy ||
    (summary.accuracy === state.best.accuracy && summary.avgTime < state.best.avgTime);

  if (!shouldSave) {
    return;
  }

  state.best = {
    accuracy: summary.accuracy,
    avgTime: summary.avgTime,
  };
  localStorage.setItem("fpsAimTrainerBest", JSON.stringify(state.best));
}

function syncInputs() {
  state.rounds = Number(elements.roundsInput.value);
  state.size = Number(elements.sizeInput.value);
  state.pace = Number(elements.paceInput.value);
  elements.roundsValue.textContent = state.rounds;
  elements.sizeValue.textContent = `${state.size}px`;
  elements.paceValue.textContent = `${(state.pace / 1000).toFixed(1)}s`;
  elements.roundLabel.textContent = `${state.round} / ${state.rounds}`;
}

function formatTime(ms) {
  return ms ? `${Math.round(ms)}ms` : "--";
}

function summarize() {
  const total = state.results.length;
  const hits = state.results.filter((result) => result.hit).length;
  const clicked = state.results.filter((result) => result.reaction);
  const accuracy = total ? Math.round((hits / total) * 100) : 0;
  const avgTime = clicked.length
    ? clicked.reduce((sum, result) => sum + result.reaction, 0) / clicked.length
    : 0;
  const avgError = clicked.length
    ? clicked.reduce((sum, result) => sum + result.distance, 0) / clicked.length
    : 0;

  return { total, hits, accuracy, avgTime, avgError };
}

function updateMetrics() {
  const summary = summarize();
  elements.accuracyMetric.textContent = `${summary.accuracy}%`;
  elements.timeMetric.textContent = formatTime(summary.avgTime);
  elements.errorMetric.textContent = summary.total ? `${Math.round(summary.avgError)}px` : "--";
  elements.streakMetric.textContent = state.streak;
  elements.samplesLabel.textContent = `${summary.total} 次`;
  elements.roundLabel.textContent = `${state.round} / ${state.rounds}`;
  elements.bestAccuracy.textContent = state.best.accuracy ? `${state.best.accuracy}%` : "--";
  elements.bestTime.textContent = state.best.avgTime ? formatTime(state.best.avgTime) : "--";
  drawOffsetMap();
  drawHistory();
}

function drawOffsetMap() {
  const width = elements.offsetMap.width;
  const height = elements.offsetMap.height;
  const center = width / 2;
  const scale = 1.35;

  mapContext.clearRect(0, 0, width, height);
  mapContext.fillStyle = "#171915";
  mapContext.fillRect(0, 0, width, height);
  mapContext.strokeStyle = "#383c32";
  mapContext.lineWidth = 1;

  for (let radius = 32; radius <= 112; radius += 32) {
    mapContext.beginPath();
    mapContext.arc(center, center, radius, 0, Math.PI * 2);
    mapContext.stroke();
  }

  mapContext.beginPath();
  mapContext.moveTo(center, 16);
  mapContext.lineTo(center, height - 16);
  mapContext.moveTo(16, center);
  mapContext.lineTo(width - 16, center);
  mapContext.stroke();

  state.results
    .filter((result) => result.reaction)
    .slice(-40)
    .forEach((result, index, collection) => {
      const x = center + result.dx * scale;
      const y = center + result.dy * scale;
      const alpha = 0.28 + (index / Math.max(collection.length - 1, 1)) * 0.62;
      mapContext.fillStyle = result.hit
        ? `rgba(69, 214, 181, ${alpha})`
        : `rgba(255, 105, 88, ${alpha})`;
      mapContext.beginPath();
      mapContext.arc(x, y, result.hit ? 4 : 5, 0, Math.PI * 2);
      mapContext.fill();
    });

  mapContext.fillStyle = "#e2ff66";
  mapContext.beginPath();
  mapContext.arc(center, center, 3, 0, Math.PI * 2);
  mapContext.fill();
}

function drawHistory() {
  const items = state.results.slice(-6).reverse();
  elements.historyList.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.innerHTML = "<span>--</span><b>暂无记录</b><span>--</span>";
    elements.historyList.appendChild(li);
    return;
  }

  items.forEach((result) => {
    const li = document.createElement("li");
    const mark = result.hit ? "中" : "偏";
    const reaction = result.reaction ? formatTime(result.reaction) : "超时";
    li.innerHTML = `
      <span class="${result.hit ? "hit" : "miss"}">${mark}</span>
      <b>${reaction}</b>
      <span>${Math.round(result.distance)}px</span>
    `;
    elements.historyList.appendChild(li);
  });
}

function getPoint(event) {
  const rect = elements.stage.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    rect,
  };
}

function placeReticle(event) {
  const { x, y } = getPoint(event);
  elements.reticle.style.left = `${x}px`;
  elements.reticle.style.top = `${y}px`;
  elements.reticle.classList.add("is-visible");
}

function getSpawnPoint(rect) {
  const padding = Math.max(42, state.size + 16);
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const mode = elements.modeSelect.value;

  if (mode === "micro") {
    const angle = Math.random() * Math.PI * 2;
    const distance = 72 + Math.random() * 120;
    return clampPoint(
      centerX + Math.cos(angle) * distance,
      centerY + Math.sin(angle) * distance,
      rect,
      padding,
    );
  }

  if (mode === "wide") {
    const side = Math.random() > 0.5 ? 1 : -1;
    const x = side > 0 ? rect.width - padding - Math.random() * 120 : padding + Math.random() * 120;
    const y = padding + Math.random() * (rect.height - padding * 2);
    return { x, y };
  }

  if (mode === "vertical") {
    const x = padding + Math.random() * (rect.width - padding * 2);
    const y = Math.random() > 0.5
      ? padding + Math.random() * 110
      : rect.height - padding - Math.random() * 110;
    return { x, y };
  }

  return {
    x: padding + Math.random() * (rect.width - padding * 2),
    y: padding + Math.random() * (rect.height - padding * 2),
  };
}

function clampPoint(x, y, rect, padding) {
  return {
    x: Math.min(Math.max(x, padding), rect.width - padding),
    y: Math.min(Math.max(y, padding), rect.height - padding),
  };
}

function startSession() {
  clearTimeout(state.timeoutId);
  syncInputs();
  state.running = true;
  state.round = 0;
  state.results = [];
  state.streak = 0;
  state.target = null;
  elements.overlay.classList.add("is-hidden");
  elements.sessionState.textContent = "训练中";
  elements.liveFeedback.textContent = "准备";
  updateMetrics();
  window.setTimeout(spawnTarget, 420);
}

function resetSession() {
  clearTimeout(state.timeoutId);
  state.running = false;
  state.round = 0;
  state.results = [];
  state.streak = 0;
  state.target = null;
  elements.target.classList.remove("is-visible");
  elements.overlay.classList.remove("is-hidden");
  elements.sessionState.textContent = "待机";
  elements.liveFeedback.textContent = "等待开始";
  elements.lastResult.textContent = "--";
  updateMetrics();
}

function spawnTarget() {
  if (!state.running) {
    return;
  }

  if (state.round >= state.rounds) {
    finishSession();
    return;
  }

  state.round += 1;
  const rect = elements.stage.getBoundingClientRect();
  const point = getSpawnPoint(rect);
  state.target = point;
  state.spawnedAt = performance.now();
  elements.target.style.setProperty("--size", `${state.size}px`);
  elements.target.style.left = `${point.x}px`;
  elements.target.style.top = `${point.y}px`;
  elements.target.classList.add("is-visible");
  elements.liveFeedback.textContent = "锁定";
  updateMetrics();

  clearTimeout(state.timeoutId);
  state.timeoutId = window.setTimeout(() => {
    registerTimeout();
  }, state.pace);
}

function registerTimeout() {
  if (!state.running || !state.target) {
    return;
  }

  state.results.push({
    hit: false,
    reaction: 0,
    distance: state.size * 2,
    dx: state.size * 2,
    dy: 0,
  });
  state.streak = 0;
  elements.target.classList.remove("is-visible");
  state.target = null;
  elements.liveFeedback.textContent = "超时";
  elements.lastResult.textContent = "超时";
  updateMetrics();
  window.setTimeout(spawnTarget, 260);
}

function handleShot(event) {
  if (!state.running || !state.target) {
    return;
  }

  clearTimeout(state.timeoutId);
  const { x, y } = getPoint(event);
  const dx = x - state.target.x;
  const dy = y - state.target.y;
  const distance = Math.hypot(dx, dy);
  const radius = state.size / 2;
  const hit = distance <= radius;
  const reaction = performance.now() - state.spawnedAt;

  state.results.push({ hit, reaction, distance, dx, dy });
  state.streak = hit ? state.streak + 1 : 0;
  state.target = null;

  elements.target.classList.remove("is-visible");
  elements.shotMarker.style.left = `${x}px`;
  elements.shotMarker.style.top = `${y}px`;
  elements.shotMarker.classList.toggle("miss", !hit);
  elements.shotMarker.classList.remove("is-visible");
  void elements.shotMarker.offsetWidth;
  elements.shotMarker.classList.add("is-visible");

  elements.liveFeedback.textContent = hit ? "命中" : "偏离";
  elements.lastResult.textContent = `${hit ? "命中" : "偏离"} · ${formatTime(reaction)}`;
  updateMetrics();
  window.setTimeout(spawnTarget, 260);
}

function finishSession() {
  state.running = false;
  state.target = null;
  clearTimeout(state.timeoutId);
  elements.target.classList.remove("is-visible");
  elements.overlay.classList.remove("is-hidden");
  elements.sessionState.textContent = "完成";
  elements.liveFeedback.textContent = "训练完成";

  const summary = summarize();
  if (summary.total) {
    saveBest(summary);
    updateMetrics();
  }
}

elements.startButton.addEventListener("click", startSession);
elements.overlayStartButton.addEventListener("click", startSession);
elements.resetButton.addEventListener("click", resetSession);
elements.stage.addEventListener("pointermove", placeReticle);
elements.stage.addEventListener("pointerleave", () => {
  elements.reticle.classList.remove("is-visible");
});
elements.stage.addEventListener("pointerdown", (event) => {
  placeReticle(event);
  handleShot(event);
});

[elements.roundsInput, elements.sizeInput, elements.paceInput].forEach((input) => {
  input.addEventListener("input", () => {
    syncInputs();
    updateMetrics();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !state.running) {
    event.preventDefault();
    startSession();
  }

  if (event.key.toLowerCase() === "r") {
    resetSession();
  }
});

syncInputs();
updateMetrics();
