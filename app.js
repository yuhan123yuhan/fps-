const savedSensitivity = loadSensitivity();
const savedCrosshair = loadCrosshair();

const state = {
  running: false,
  round: 0,
  rounds: 20,
  size: 34,
  pace: 1400,
  flashDuration: 260,
  dpi: savedSensitivity.dpi,
  gameSensitivity: savedSensitivity.gameSensitivity,
  eDPI: savedSensitivity.dpi * savedSensitivity.gameSensitivity,
  useSensitivity: savedSensitivity.useSensitivity,
  crosshairStyle: savedCrosshair.style,
  crosshairColor: savedCrosshair.color,
  crosshairSize: savedCrosshair.size,
  crosshairThickness: savedCrosshair.thickness,
  target: null,
  spawnedAt: 0,
  timeoutId: null,
  flashTimeoutId: null,
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
  dpiInput: document.getElementById("dpiInput"),
  gameSensInput: document.getElementById("gameSensInput"),
  sensitivityToggle: document.getElementById("sensitivityToggle"),
  edpiValue: document.getElementById("edpiValue"),
  sensTier: document.getElementById("sensTier"),
  sensAdvice: document.getElementById("sensAdvice"),
  crosshairStyleInput: document.getElementById("crosshairStyleInput"),
  crosshairSizeInput: document.getElementById("crosshairSizeInput"),
  crosshairThicknessInput: document.getElementById("crosshairThicknessInput"),
  crosshairSizeValue: document.getElementById("crosshairSizeValue"),
  crosshairThicknessValue: document.getElementById("crosshairThicknessValue"),
  crosshairLabel: document.getElementById("crosshairLabel"),
  crosshairPreview: document.getElementById("crosshairPreview"),
  crosshairSwatches: document.querySelectorAll(".color-swatch"),
  flashField: document.getElementById("flashField"),
  flashInput: document.getElementById("flashInput"),
  roundsValue: document.getElementById("roundsValue"),
  sizeValue: document.getElementById("sizeValue"),
  paceValue: document.getElementById("paceValue"),
  flashValue: document.getElementById("flashValue"),
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

function loadSensitivity() {
  try {
    return {
      dpi: 1800,
      gameSensitivity: 0.175,
      useSensitivity: true,
      ...JSON.parse(localStorage.getItem("fpsAimSensitivity")),
    };
  } catch {
    return {
      dpi: 1800,
      gameSensitivity: 0.175,
      useSensitivity: true,
    };
  }
}

function loadCrosshair() {
  try {
    return {
      style: "cross",
      color: "#e2ff66",
      size: 30,
      thickness: 2,
      ...JSON.parse(localStorage.getItem("fpsAimCrosshair")),
    };
  } catch {
    return {
      style: "cross",
      color: "#e2ff66",
      size: 30,
      thickness: 2,
    };
  }
}

function saveSensitivity() {
  localStorage.setItem(
    "fpsAimSensitivity",
    JSON.stringify({
      dpi: state.dpi,
      gameSensitivity: state.gameSensitivity,
      useSensitivity: state.useSensitivity,
    }),
  );
}

function saveCrosshair() {
  localStorage.setItem(
    "fpsAimCrosshair",
    JSON.stringify({
      style: state.crosshairStyle,
      color: state.crosshairColor,
      size: state.crosshairSize,
      thickness: state.crosshairThickness,
    }),
  );
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
  state.flashDuration = Number(elements.flashInput.value);
  state.dpi = parsePositiveNumber(elements.dpiInput.value, 1800);
  state.gameSensitivity = parsePositiveNumber(elements.gameSensInput.value, 0.175);
  state.eDPI = state.dpi * state.gameSensitivity;
  state.useSensitivity = elements.sensitivityToggle.checked;
  elements.roundsValue.textContent = state.rounds;
  elements.sizeValue.textContent = `${state.size}px`;
  elements.paceValue.textContent = `${(state.pace / 1000).toFixed(1)}s`;
  elements.flashValue.textContent = `${state.flashDuration}ms`;
  elements.flashField.hidden = !isFlashMode();
  elements.roundLabel.textContent = `${state.round} / ${state.rounds}`;
  updateSensitivityReadout();
  saveSensitivity();
}

function formatTime(ms) {
  return ms ? `${Math.round(ms)}ms` : "--";
}

function formatEdpi(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function parsePositiveNumber(value, fallback) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getSensitivityProfile() {
  const eDPI = state.eDPI;

  if (eDPI < 260) {
    return {
      label: "低灵敏度",
      advice: "更偏大幅拉枪，重点练手臂发力和停枪",
      minRatio: 0.3,
      maxRatio: 0.48,
      microMin: 92,
      microMax: 150,
    };
  }

  if (eDPI < 420) {
    return {
      label: "中低灵敏度",
      advice: "大拉枪 + 稳定停枪，适合你的 315 eDPI",
      minRatio: 0.25,
      maxRatio: 0.43,
      microMin: 76,
      microMax: 136,
    };
  }

  if (eDPI < 700) {
    return {
      label: "中灵敏度",
      advice: "均衡定位，重点练第一下落点和微修正",
      minRatio: 0.2,
      maxRatio: 0.37,
      microMin: 62,
      microMax: 120,
    };
  }

  return {
    label: "高灵敏度",
    advice: "目标距离更紧，重点控制过冲和细小落点",
    minRatio: 0.15,
    maxRatio: 0.3,
    microMin: 46,
    microMax: 98,
  };
}

function updateSensitivityReadout() {
  const profile = getSensitivityProfile();
  elements.edpiValue.textContent = `${formatEdpi(state.eDPI)} eDPI`;
  elements.sensTier.textContent = profile.label;
  elements.sensAdvice.textContent = state.useSensitivity ? profile.advice : "已关闭灵敏度靶位适配";
}

function getCrosshairLabel(style) {
  return {
    cross: "十字",
    dot: "圆点",
    circle: "空心圆",
    t: "T 型",
    corners: "四角准星",
  }[style] || "十字";
}

function syncCrosshair() {
  state.crosshairStyle = elements.crosshairStyleInput.value;
  state.crosshairSize = Number(elements.crosshairSizeInput.value);
  state.crosshairThickness = Number(elements.crosshairThicknessInput.value);
  elements.crosshairSizeValue.textContent = `${state.crosshairSize}px`;
  elements.crosshairThicknessValue.textContent = `${state.crosshairThickness}px`;
  elements.crosshairLabel.textContent = getCrosshairLabel(state.crosshairStyle);
  applyCrosshair();
  saveCrosshair();
}

function applyCrosshair() {
  const reticles = [elements.reticle, elements.crosshairPreview];
  const styleClasses = ["style-cross", "style-dot", "style-circle", "style-t", "style-corners"];

  reticles.forEach((reticle) => {
    reticle.classList.remove(...styleClasses);
    reticle.classList.add(`style-${state.crosshairStyle}`);
    reticle.style.setProperty("--reticle-size", `${state.crosshairSize}px`);
    reticle.style.setProperty("--reticle-thickness", `${state.crosshairThickness}px`);
    reticle.style.setProperty("--reticle-color", state.crosshairColor);
  });

  elements.crosshairSwatches.forEach((swatch) => {
    const active = swatch.dataset.color.toLowerCase() === state.crosshairColor.toLowerCase();
    swatch.classList.toggle("is-active", active);
    swatch.setAttribute("aria-pressed", String(active));
  });
}

function isFlashMode() {
  return elements.modeSelect.value === "flash";
}

function clearRoundTimers() {
  clearTimeout(state.timeoutId);
  clearTimeout(state.flashTimeoutId);
  state.timeoutId = null;
  state.flashTimeoutId = null;
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

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getPointFromPolar(centerX, centerY, rect, padding, angle, distance) {
  return clampPoint(
    centerX + Math.cos(angle) * distance,
    centerY + Math.sin(angle) * distance,
    rect,
    padding,
  );
}

function getSensitivitySpawnPoint(rect, padding, centerX, centerY, mode) {
  const profile = getSensitivityProfile();
  const minDimension = Math.max(120, Math.min(rect.width, rect.height) - padding * 2);
  const baseMin = minDimension * profile.minRatio;
  const baseMax = minDimension * profile.maxRatio;

  if (mode === "micro") {
    return getPointFromPolar(
      centerX,
      centerY,
      rect,
      padding,
      Math.random() * Math.PI * 2,
      randomBetween(profile.microMin, profile.microMax),
    );
  }

  if (mode === "wide") {
    const horizontal = Math.random() > 0.5 ? 0 : Math.PI;
    const angle = horizontal + randomBetween(-0.32, 0.32);
    return getPointFromPolar(
      centerX,
      centerY,
      rect,
      padding,
      angle,
      randomBetween(baseMax * 0.92, Math.min(minDimension * 0.56, baseMax * 1.28)),
    );
  }

  if (mode === "vertical") {
    const vertical = Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2;
    const angle = vertical + randomBetween(-0.35, 0.35);
    return getPointFromPolar(centerX, centerY, rect, padding, angle, randomBetween(baseMin, baseMax));
  }

  if (mode === "flash") {
    return getPointFromPolar(
      centerX,
      centerY,
      rect,
      padding,
      Math.random() * Math.PI * 2,
      randomBetween(Math.max(baseMin, minDimension * 0.24), Math.min(minDimension * 0.52, baseMax * 1.14)),
    );
  }

  return getPointFromPolar(
    centerX,
    centerY,
    rect,
    padding,
    Math.random() * Math.PI * 2,
    randomBetween(baseMin, baseMax),
  );
}

function getSpawnPoint(rect) {
  const padding = Math.max(42, state.size + 16);
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const mode = elements.modeSelect.value;

  if (state.useSensitivity) {
    return getSensitivitySpawnPoint(rect, padding, centerX, centerY, mode);
  }

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

  if (mode === "flash") {
    const minDistance = Math.min(rect.width, rect.height) * 0.22;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const point = {
        x: padding + Math.random() * (rect.width - padding * 2),
        y: padding + Math.random() * (rect.height - padding * 2),
      };
      if (Math.hypot(point.x - centerX, point.y - centerY) >= minDistance) {
        return point;
      }
    }
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
  clearRoundTimers();
  syncInputs();
  state.running = true;
  state.round = 0;
  state.results = [];
  state.streak = 0;
  state.target = null;
  elements.stage.classList.remove("memory-active");
  elements.target.classList.remove("is-visible", "is-flash");
  elements.overlay.classList.add("is-hidden");
  elements.sessionState.textContent = "训练中";
  elements.liveFeedback.textContent = isFlashMode() ? "准备背闪" : "准备";
  updateMetrics();
  window.setTimeout(spawnTarget, 420);
}

function resetSession() {
  clearRoundTimers();
  state.running = false;
  state.round = 0;
  state.results = [];
  state.streak = 0;
  state.target = null;
  elements.stage.classList.remove("memory-active");
  elements.target.classList.remove("is-visible", "is-flash");
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
  elements.stage.classList.remove("memory-active");
  elements.target.classList.toggle("is-flash", isFlashMode());
  elements.target.classList.add("is-visible");
  elements.liveFeedback.textContent = isFlashMode() ? "背闪" : "锁定";
  updateMetrics();

  clearRoundTimers();
  if (isFlashMode()) {
    state.flashTimeoutId = window.setTimeout(() => {
      if (!state.running || !state.target) {
        return;
      }

      elements.target.classList.remove("is-visible");
      elements.stage.classList.add("memory-active");
      elements.liveFeedback.textContent = "凭记忆点击";
    }, state.flashDuration);
  }

  state.timeoutId = window.setTimeout(() => {
    registerTimeout();
  }, state.pace);
}

function registerTimeout() {
  if (!state.running || !state.target) {
    return;
  }

  clearRoundTimers();
  state.results.push({
    hit: false,
    reaction: 0,
    distance: state.size * 2,
    dx: state.size * 2,
    dy: 0,
  });
  state.streak = 0;
  elements.stage.classList.remove("memory-active");
  elements.target.classList.remove("is-visible", "is-flash");
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

  const flash = isFlashMode();
  clearRoundTimers();
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

  elements.stage.classList.remove("memory-active");
  elements.target.classList.remove("is-visible", "is-flash");
  elements.shotMarker.style.left = `${x}px`;
  elements.shotMarker.style.top = `${y}px`;
  elements.shotMarker.classList.toggle("miss", !hit);
  elements.shotMarker.classList.remove("is-visible");
  void elements.shotMarker.offsetWidth;
  elements.shotMarker.classList.add("is-visible");

  elements.liveFeedback.textContent = flash ? (hit ? "背闪命中" : "记忆偏离") : (hit ? "命中" : "偏离");
  elements.lastResult.textContent = `${flash ? (hit ? "背闪命中" : "记忆偏离") : (hit ? "命中" : "偏离")} · ${formatTime(reaction)}`;
  updateMetrics();
  window.setTimeout(spawnTarget, 260);
}

function finishSession() {
  state.running = false;
  state.target = null;
  clearRoundTimers();
  elements.stage.classList.remove("memory-active");
  elements.target.classList.remove("is-visible", "is-flash");
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

[elements.roundsInput, elements.sizeInput, elements.paceInput, elements.flashInput].forEach((input) => {
  input.addEventListener("input", () => {
    syncInputs();
    updateMetrics();
  });
});

[elements.dpiInput, elements.gameSensInput].forEach((input) => {
  input.addEventListener("input", () => {
    syncInputs();
    updateMetrics();
  });
});

elements.sensitivityToggle.addEventListener("change", () => {
  syncInputs();
  updateMetrics();
});

elements.crosshairStyleInput.addEventListener("change", syncCrosshair);

[elements.crosshairSizeInput, elements.crosshairThicknessInput].forEach((input) => {
  input.addEventListener("input", syncCrosshair);
});

elements.crosshairSwatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    state.crosshairColor = swatch.dataset.color;
    syncCrosshair();
  });
});

elements.modeSelect.addEventListener("change", () => {
  syncInputs();
  updateMetrics();
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

elements.dpiInput.value = state.dpi;
elements.gameSensInput.value = state.gameSensitivity;
elements.sensitivityToggle.checked = state.useSensitivity;
elements.crosshairStyleInput.value = state.crosshairStyle;
elements.crosshairSizeInput.value = state.crosshairSize;
elements.crosshairThicknessInput.value = state.crosshairThickness;
syncCrosshair();
syncInputs();
updateMetrics();
