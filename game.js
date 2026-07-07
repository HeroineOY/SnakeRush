const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const levelEl = document.querySelector("#level");
const comboEl = document.querySelector("#combo");
const timerEl = document.querySelector("#timer");
const overlay = document.querySelector("#overlay");
const overlayEyebrow = document.querySelector("#overlayEyebrow");
const messageEl = document.querySelector("#message");
const summaryEl = document.querySelector("#summary");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const soundButton = document.querySelector("#soundButton");
const boostButton = document.querySelector("#boostButton");
const boostMeter = document.querySelector("#boostMeter");
const currentModeEl = document.querySelector("#currentMode");
const currentDifficultyEl = document.querySelector("#currentDifficulty");
const modeHintEl = document.querySelector("#modeHint");
const difficultyHintEl = document.querySelector("#difficultyHint");
const boardTitleEl = document.querySelector("#boardTitle");
const leaderboardEl = document.querySelector("#leaderboard");
const modeButtons = document.querySelectorAll("[data-mode]");
const difficultyButtons = document.querySelectorAll("[data-difficulty]");
const directionButtons = document.querySelectorAll("[data-dir]");
const stage = document.querySelector("#stage");

const logicalSize = 640;
const tileCount = 24;
let tileSize = logicalSize / tileCount;

const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const modes = {
  classic: {
    label: "经典",
    hint: "Classic",
    message: "平衡规则，适合冲击稳定高分。",
    baseTick: 150,
    wrap: false,
    obstacleOffset: 0,
    obstacleStep: 3,
    scoreMultiplier: 1,
    comboDecay: 0.015,
    poison: true,
  },
  rush: {
    label: "冲刺",
    hint: "Rush",
    message: "速度更快，得分更高，冲刺能量回复也更快。",
    baseTick: 124,
    wrap: false,
    obstacleOffset: 2,
    obstacleStep: 4,
    scoreMultiplier: 1.25,
    comboDecay: 0.024,
    boostRecharge: 1.25,
    poison: true,
  },
  portal: {
    label: "传送",
    hint: "Portal",
    message: "穿过边界会从另一侧出现，路线更自由。",
    baseTick: 146,
    wrap: true,
    obstacleOffset: 1,
    obstacleStep: 3,
    scoreMultiplier: 1.08,
    comboDecay: 0.014,
    poison: true,
  },
  wall: {
    label: "电网",
    hint: "Wall",
    message: "障碍更多，奖励更高，每一步都要算准。",
    baseTick: 142,
    wrap: false,
    obstacleOffset: 7,
    obstacleStep: 5,
    scoreMultiplier: 1.35,
    comboDecay: 0.018,
    poison: true,
  },
  zen: {
    label: "禅意",
    hint: "Zen",
    message: "无毒果、无障碍、边界传送，适合放松练习。",
    baseTick: 168,
    wrap: true,
    obstacleOffset: 0,
    obstacleStep: 0,
    scoreMultiplier: 0.75,
    comboDecay: 0,
    poison: false,
  },
};

const difficulties = {
  chill: {
    label: "轻松",
    hint: "Chill",
    tickFactor: 1.18,
    scoreMultiplier: 0.9,
    obstacleMultiplier: 0.7,
    poisonChance: 0.04,
  },
  normal: {
    label: "标准",
    hint: "Normal",
    tickFactor: 1,
    scoreMultiplier: 1,
    obstacleMultiplier: 1,
    poisonChance: 0.08,
  },
  hard: {
    label: "硬核",
    hint: "Hard",
    tickFactor: 0.82,
    scoreMultiplier: 1.2,
    obstacleMultiplier: 1.35,
    poisonChance: 0.12,
  },
};

const foodCatalog = {
  normal: { label: "普通", color: "#95ff66", value: 1, combo: 0.34 },
  berry: { label: "浆果", color: "#ff4fd8", value: 3, combo: 0.68 },
  gold: { label: "金币", color: "#ffd166", value: 5, combo: 0.82 },
  slow: { label: "减速", color: "#5fe6ff", value: 2, combo: 0.55 },
  double: { label: "双倍", color: "#b985ff", value: 2, combo: 0.62 },
  poison: { label: "毒果", color: "#ff5d4d", value: -8, combo: -1 },
};

const leadNotes = [523.25, null, 659.25, 783.99, null, 698.46, null, 659.25, 587.33, null, 659.25, null, 783.99, 880, null, 987.77];
const harmonyNotes = [329.63, null, null, 392, 349.23, null, 440, null];
const bassNotes = [130.81, null, 164.81, null, 196, null, 164.81, null];

let snake;
let previousSnake;
let direction;
let queuedDirection;
let food;
let obstacles;
let particles;
let floatingTexts;
let score;
let best;
let level;
let combo;
let maxCombo;
let tickMs;
let slowTicks;
let doubleTicks;
let nextStepAt;
let lastStepAt;
let stepDuration;
let running;
let paused;
let ended;
let muted;
let boost;
let boostActive;
let audioContext;
let musicTimer;
let musicStep;
let playTimeMs;
let lastFrameAt;
let animationFrame;
let modeKey = loadValue("snakeRushMode", "classic");
let difficultyKey = loadValue("snakeRushDifficulty", "normal");
let pointerStart = null;

muted = loadValue("snakeRushMuted", "false") === "true";
resizeCanvas();
syncSoundButton();
syncMenu();
resetGame();
draw();

function resetGame() {
  const mode = getMode();
  snake = [
    { x: 8, y: 12 },
    { x: 7, y: 12 },
    { x: 6, y: 12 },
  ];
  previousSnake = snake.map(copyCell);
  direction = directions.right;
  queuedDirection = directions.right;
  obstacles = [];
  particles = [];
  floatingTexts = [];
  score = 0;
  level = 1;
  combo = 1;
  maxCombo = 1;
  tickMs = getBaseTick();
  slowTicks = 0;
  doubleTicks = 0;
  nextStepAt = 0;
  lastStepAt = 0;
  stepDuration = tickMs;
  playTimeMs = 0;
  lastFrameAt = 0;
  running = false;
  paused = false;
  ended = false;
  boost = 100;
  boostActive = false;
  musicStep = 0;
  best = getBestScore();
  food = spawnFood();
  rebuildObstacles();
  updateHud();
  updateRunCard();
  pauseButton.textContent = "暂停";
  boostButton.classList.remove("is-active");
  if (modeKey === "zen") {
    boostButton.textContent = "轻推";
  } else {
    boostButton.textContent = "冲刺";
  }
  showStartOverlay(mode.message);
}

function startGame() {
  if (!running || ended) {
    resetForStart();
  }
  running = true;
  paused = false;
  ended = false;
  pauseButton.textContent = "暂停";
  hideOverlay();
  nextStepAt = performance.now();
  lastStepAt = nextStepAt;
  stepDuration = tickMs;
  lastFrameAt = nextStepAt;
  beep(420, 0.05, "triangle");
  startMusic();
  loop();
}

function resetForStart() {
  const savedMode = modeKey;
  const savedDifficulty = difficultyKey;
  resetGame();
  modeKey = savedMode;
  difficultyKey = savedDifficulty;
  syncMenu();
  best = getBestScore();
  updateHud();
}

function togglePause() {
  if (!running || ended) return;
  paused = !paused;
  pauseButton.textContent = paused ? "继续" : "暂停";
  if (paused) {
    stopMusic();
    showPauseOverlay();
  } else {
    hideOverlay();
    nextStepAt = performance.now() + 120;
    lastStepAt = performance.now();
    lastFrameAt = performance.now();
    startMusic();
    loop();
  }
}

function loop(time = performance.now()) {
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(loop);
  const delta = lastFrameAt ? Math.min(80, Math.max(0, time - lastFrameAt)) : 0;

  if (!running || paused || ended) {
    lastFrameAt = time;
    draw(time);
    return;
  }

  playTimeMs += delta;
  updateBoost(delta);
  lastFrameAt = time;

  if (time >= nextStepAt) {
    step();
    lastStepAt = time;
    stepDuration = getCurrentStepDuration();
    nextStepAt = time + stepDuration;
  }

  draw(time);
  updateRunCard();
}

function step() {
  previousSnake = snake.map(copyCell);
  direction = queuedDirection;
  const head = snake[0];
  let next = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  if (getMode().wrap) {
    next = wrapCell(next);
  }

  const willEat = sameCell(next, food);
  if ((!getMode().wrap && hitsWall(next)) || hitsSnake(next, !willEat) || hitsObstacle(next)) {
    finishGame();
    return;
  }

  snake.unshift(next);
  if (willEat) {
    eatFood(next);
  } else {
    snake.pop();
    combo = Math.max(1, combo - getMode().comboDecay);
  }

  if (slowTicks > 0) slowTicks -= 1;
  if (doubleTicks > 0) doubleTicks -= 1;
  updateHud();
}

function eatFood(cell) {
  const item = foodCatalog[food.type];
  const isPoison = food.type === "poison";
  let gained = 0;

  if (isPoison) {
    gained = Math.max(-score, Math.ceil(item.value * level * getDifficulty().scoreMultiplier));
    score = Math.max(0, score + gained);
    combo = 1;
    shrinkSnake();
    spawnBurst(cell, item.color, gained);
    spawnText(cell, String(gained), item.color);
    playPoisonSound();
  } else {
    const multiplier = getMode().scoreMultiplier * getDifficulty().scoreMultiplier * (doubleTicks > 0 ? 2 : 1);
    gained = Math.ceil(item.value * combo * level * multiplier);
    score += gained;
    combo = Math.min(12, combo + item.combo);
    maxCombo = Math.max(maxCombo, combo);
    spawnBurst(cell, item.color, gained);
    spawnText(cell, "+" + gained, item.color);
    playEatSound(food.type);
  }

  if (food.type === "slow") {
    slowTicks = 20;
  }
  if (food.type === "double") {
    doubleTicks = 36;
  }

  level = 1 + Math.floor(score / 45);
  tickMs = Math.max(58, getBaseTick() - (level - 1) * getLevelSpeedStep());
  rebuildObstacles();
  food = spawnFood();
}

function shrinkSnake() {
  if (snake.length > 3) snake.pop();
  if (snake.length > 3) snake.pop();
}

function finishGame() {
  running = false;
  ended = true;
  boostActive = false;
  stopMusic();
  combo = 1;
  saveScore();
  best = getBestScore();
  updateHud();
  updateRunCard();
  showResultOverlay();
  beep(score >= best ? 880 : 130, 0.16, score >= best ? "triangle" : "sawtooth");
}

function spawnFood() {
  const type = pickFoodType();
  const catalog = foodCatalog[type];
  return {
    ...emptyCell(),
    type,
    color: catalog.color,
    pulse: Math.random() * Math.PI * 2,
  };
}

function pickFoodType() {
  const mode = getMode();
  const difficulty = getDifficulty();
  const roll = Math.random();
  const poisonChance = mode.poison ? difficulty.poisonChance : 0;

  if (roll < poisonChance) return "poison";
  if (roll > 0.91) return "gold";
  if (roll > 0.8) return "double";
  if (roll > 0.68) return "slow";
  if (roll > 0.52) return "berry";
  return "normal";
}

function emptyCell() {
  const occupied = new Set([
    ...snake.map(cellKey),
    ...obstacles.map(cellKey),
  ]);

  let cell;
  do {
    cell = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (occupied.has(cellKey(cell)));
  return cell;
}

function rebuildObstacles() {
  const mode = getMode();
  const difficulty = getDifficulty();
  const baseCount = mode.obstacleStep ? Math.max(0, level - 2) * mode.obstacleStep + mode.obstacleOffset : 0;
  const targetCount = Math.min(34, Math.round(baseCount * difficulty.obstacleMultiplier));
  while (obstacles.length < targetCount) {
    const cell = emptyCell();
    if (Math.abs(cell.x - snake[0].x) + Math.abs(cell.y - snake[0].y) > 5) {
      obstacles.push(cell);
    }
  }
  while (obstacles.length > targetCount) {
    obstacles.pop();
  }
}

function changeDirection(nextName) {
  const next = directions[nextName];
  if (!next) return;
  const isReverse = next.x + direction.x === 0 && next.y + direction.y === 0;
  if (!isReverse) {
    queuedDirection = next;
    if (running && !paused && !ended) {
      const responsiveDelay = Math.max(24, Math.min(48, stepDuration * 0.3));
      nextStepAt = Math.min(nextStepAt, performance.now() + responsiveDelay);
    }
  }
}

function updateBoost(delta) {
  const mode = getMode();
  const recharge = mode.boostRecharge || 1;
  if (boostActive && boost > 0) {
    boost = Math.max(0, boost - delta * 0.048);
    if (boost <= 0) boostActive = false;
  } else {
    boost = Math.min(100, boost + delta * 0.018 * recharge);
  }
  boostButton.classList.toggle("is-active", boostActive && boost > 0);
}

function draw(time = 0) {
  ctx.clearRect(0, 0, logicalSize, logicalSize);
  drawBoard(time);
  drawObstacles(time);
  drawFood(time);
  drawSnake(time);
  drawParticles();
  drawFloatingTexts();
  drawStatusRings(time);
  drawScanlines(time);
}

function drawBoard(time) {
  const mode = getMode();
  const bg = ctx.createLinearGradient(0, 0, logicalSize, logicalSize);
  bg.addColorStop(0, "#07101f");
  bg.addColorStop(0.55, modeKey === "rush" ? "#271021" : "#120c26");
  bg.addColorStop(1, "#070814");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, logicalSize, logicalSize);

  const scanOffset = (time / 70) % tileSize;
  ctx.strokeStyle = mode.wrap ? "rgba(149, 255, 102, 0.16)" : "rgba(95, 230, 255, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 1; i < tileCount; i += 1) {
    const p = i * tileSize;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, logicalSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(logicalSize, p);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 79, 216, 0.18)";
  for (let i = -1; i < tileCount; i += 4) {
    const p = i * tileSize + scanOffset;
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(logicalSize, p + logicalSize * 0.18);
    ctx.stroke();
  }

  ctx.strokeStyle = mode.wrap ? "rgba(149, 255, 102, 0.35)" : "rgba(255, 209, 102, 0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, logicalSize - 8, logicalSize - 8);
}

function getRenderSnake(time) {
  const rawProgress = stepDuration ? (time - lastStepAt) / stepDuration : 1;
  const progress = easeOutCubic(clamp(rawProgress, 0, 1));
  return snake.map((part, index) => {
    const previous = previousSnake[index] || previousSnake[previousSnake.length - 1] || part;
    const isWrapJump = Math.abs(part.x - previous.x) > tileCount / 2 || Math.abs(part.y - previous.y) > tileCount / 2;
    if (isWrapJump) return part;
    return {
      x: previous.x + (part.x - previous.x) * progress,
      y: previous.y + (part.y - previous.y) * progress,
    };
  });
}

function drawSnake(time) {
  const renderSnake = getRenderSnake(time);
  renderSnake.forEach((part, index) => {
    const inset = index === 0 ? 2 : 3.5;
    const x = part.x * tileSize + inset;
    const y = part.y * tileSize + inset;
    const size = tileSize - inset * 2;
    const bodyTone = lerpColor("#5fffe0", "#95ff66", index / Math.max(1, snake.length - 1));
    ctx.shadowColor = index === 0 ? "#5fe6ff" : bodyTone;
    ctx.shadowBlur = index === 0 ? 18 : 11;
    ctx.fillStyle = index === 0 ? "#e8fff9" : bodyTone;
    roundRect(x, y, size, size, index === 0 ? 9 : 7);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = index === 0 ? "#5fe6ff" : "rgba(7, 16, 31, 0.16)";
    roundRect(x + size * 0.18, y + size * 0.18, size * 0.45, size * 0.18, 4);
    ctx.fill();

    if (index === 0) {
      ctx.fillStyle = "#07101f";
      const eyeOffsetX = direction.x * 3;
      const eyeOffsetY = direction.y * 3;
      circle(x + size * 0.35 + eyeOffsetX, y + size * 0.35 + eyeOffsetY, 2.8);
      circle(x + size * 0.65 + eyeOffsetX, y + size * 0.65 + eyeOffsetY, 2.8);
      ctx.fill();
    }
  });
}

function drawStatusRings(time) {
  const head = getRenderSnake(time)[0];
  if (!head) return;
  const cx = (head.x + 0.5) * tileSize;
  const cy = (head.y + 0.5) * tileSize;

  if (slowTicks > 0) {
    ctx.shadowColor = "#5fe6ff";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(95, 230, 255, 0.52)";
    ctx.lineWidth = 4 + Math.sin(time / 90) * 1.5;
    circle(cx, cy, tileSize * 0.72);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (doubleTicks > 0) {
    ctx.shadowColor = "#b985ff";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(185, 133, 255, 0.56)";
    ctx.lineWidth = 3;
    circle(cx, cy, tileSize * (0.9 + Math.sin(time / 120) * 0.08));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawFood(time) {
  const pulse = 1 + Math.sin(time / 170 + food.pulse) * 0.11;
  const cx = (food.x + 0.5) * tileSize;
  const cy = (food.y + 0.5) * tileSize;
  const radius = food.type === "poison" ? tileSize * 0.34 : tileSize * 0.31;
  ctx.shadowColor = food.color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = food.color;
  circle(cx, cy, radius * pulse);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = food.type === "poison" ? "rgba(7, 16, 31, 0.78)" : "rgba(255, 255, 255, 0.88)";
  circle(cx - tileSize * 0.08, cy - tileSize * 0.1, tileSize * 0.08);
  ctx.fill();

  if (food.type === "double") {
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 14px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("2x", cx, cy + 1);
  }

  if (food.type !== "normal") {
    ctx.strokeStyle = food.color + "88";
    ctx.lineWidth = 3;
    circle(cx, cy, tileSize * 0.46 * pulse);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  circle(cx, cy, tileSize * 0.58 * (1 + Math.sin(time / 220) * 0.08));
  ctx.stroke();
}

function drawObstacles(time) {
  obstacles.forEach((block, index) => {
    const jitter = Math.sin(time / 350 + index) * 0.8;
    const x = block.x * tileSize + 5 + jitter;
    const y = block.y * tileSize + 5 - jitter;
    const color = modeKey === "wall" ? "#ffd166" : "#ff5d4d";
    ctx.shadowColor = color;
    ctx.shadowBlur = 13;
    ctx.fillStyle = color;
    roundRect(x, y, tileSize - 10, tileSize - 10, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(7, 16, 31, 0.38)";
    roundRect(x + 3, y + 3, tileSize - 16, tileSize - 16, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
    roundRect(x + 5, y + 5, tileSize - 20, 5, 3);
    ctx.fill();
  });
}

function drawParticles() {
  particles = particles.filter((p) => p.life > 0);
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.color;
    circle(p.x, p.y, p.size);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  });
}

function drawFloatingTexts() {
  floatingTexts = floatingTexts.filter((p) => p.life > 0);
  floatingTexts.forEach((p) => {
    p.y -= 0.7;
    p.life -= 1;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.font = "900 16px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  });
}

function spawnBurst(cell, color, gained) {
  const cx = (cell.x + 0.5) * tileSize;
  const cy = (cell.y + 0.5) * tileSize;
  const count = gained < 0 ? 20 : 14;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * (1.2 + Math.random() * 1.8),
      vy: Math.sin(angle) * (1.2 + Math.random() * 1.8),
      size: 2 + Math.random() * 3,
      color,
      life: 18 + Math.random() * 14,
      maxLife: 32,
    });
  }
}

function spawnText(cell, text, color) {
  floatingTexts.push({
    x: (cell.x + 0.5) * tileSize,
    y: (cell.y + 0.35) * tileSize,
    text,
    color,
    life: 34,
    maxLife: 34,
  });
}

function drawScanlines(time) {
  const sweepY = (time / 9) % logicalSize;
  ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
  ctx.fillRect(0, sweepY, logicalSize, 3);

  const vignette = ctx.createRadialGradient(
    logicalSize / 2,
    logicalSize / 2,
    logicalSize * 0.15,
    logicalSize / 2,
    logicalSize / 2,
    logicalSize * 0.72,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, logicalSize, logicalSize);
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  levelEl.textContent = level;
  comboEl.textContent = "x" + combo.toFixed(combo >= 2 ? 1 : 0);
}

function updateRunCard() {
  currentModeEl.textContent = getMode().label;
  currentDifficultyEl.textContent = getDifficulty().label;
  timerEl.textContent = formatTime(playTimeMs);
  boostMeter.style.width = Math.round(boost) + "%";
}

function showStartOverlay(message) {
  overlayEyebrow.textContent = "v0.2 Arcade Update";
  messageEl.textContent = message;
  summaryEl.classList.remove("is-visible");
  summaryEl.replaceChildren();
  startButton.textContent = "开始游戏";
  overlay.classList.add("is-visible");
  syncMenu();
}

function showPauseOverlay() {
  overlayEyebrow.textContent = "Paused";
  messageEl.textContent = "暂停中。本局规则已锁定，重开后可切换模式和难度。";
  renderSummary(false);
  startButton.textContent = "继续游戏";
  overlay.classList.add("is-visible");
}

function showResultOverlay() {
  overlayEyebrow.textContent = "Game Over";
  messageEl.textContent = score >= best ? "新纪录！这局手感很漂亮。" : "本局结束，换个模式继续冲分。";
  renderSummary(true);
  startButton.textContent = "再来一局";
  overlay.classList.add("is-visible");
  renderLeaderboard();
}

function hideOverlay() {
  overlay.classList.remove("is-visible");
}

function renderSummary(includeRank) {
  const rank = getRankForScore(score);
  const items = [
    ["分数", score],
    ["最高连击", "x" + maxCombo.toFixed(maxCombo >= 2 ? 1 : 0)],
    ["等级", level],
    ["时间", formatTime(playTimeMs)],
  ];
  if (includeRank) {
    items[3] = ["本地排名", rank ? "#" + rank : "Top 5 外"];
  }
  summaryEl.replaceChildren();
  items.forEach(([label, value]) => {
    const item = document.createElement("span");
    item.innerHTML = `${label}<strong>${value}</strong>`;
    summaryEl.append(item);
  });
  summaryEl.classList.add("is-visible");
}

function syncMenu() {
  if (!modes[modeKey]) modeKey = "classic";
  if (!difficulties[difficultyKey]) difficultyKey = "normal";
  modeButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.mode === modeKey);
  });
  difficultyButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.difficulty === difficultyKey);
  });
  modeHintEl.textContent = getMode().hint;
  difficultyHintEl.textContent = getDifficulty().hint;
  boardTitleEl.textContent = `${getMode().label} / ${getDifficulty().label}`;
  currentModeEl.textContent = getMode().label;
  currentDifficultyEl.textContent = getDifficulty().label;
  renderLeaderboard();
}

function renderLeaderboard() {
  const board = getBoard();
  leaderboardEl.replaceChildren();
  if (!board.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "还没有成绩，第一名等你来拿。";
    leaderboardEl.append(empty);
    return;
  }
  board.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = `${entry.score} 分 · ${entry.level} 级 · ${formatTime(entry.time)}`;
    leaderboardEl.append(item);
  });
}

function syncSoundButton() {
  soundButton.classList.toggle("is-muted", muted);
  soundButton.textContent = muted ? "静" : "声";
}

function saveScore() {
  if (score <= 0) return;
  const boards = loadBoards();
  const key = boardKey();
  const entry = {
    score,
    level,
    time: playTimeMs,
    combo: Number(maxCombo.toFixed(1)),
    date: new Date().toISOString(),
  };
  boards[key] = [...(boards[key] || []), entry]
    .sort((a, b) => b.score - a.score || b.level - a.level || b.time - a.time)
    .slice(0, 5);
  localStorage.setItem("snakeRushBoards:v2", JSON.stringify(boards));
  localStorage.setItem("snakeRushBest", String(Math.max(Number(loadValue("snakeRushBest", "0")), score)));
}

function getBestScore() {
  const board = getBoard();
  return board[0]?.score || Number(loadValue("snakeRushBest", "0"));
}

function getRankForScore(value) {
  const board = getBoard();
  const index = board.findIndex((entry) => entry.score === value);
  return index >= 0 ? index + 1 : null;
}

function getBoard() {
  return loadBoards()[boardKey()] || [];
}

function loadBoards() {
  try {
    return JSON.parse(localStorage.getItem("snakeRushBoards:v2") || "{}");
  } catch {
    return {};
  }
}

function boardKey() {
  return `${modeKey}:${difficultyKey}`;
}

function loadValue(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function getMode() {
  return modes[modeKey] || modes.classic;
}

function getDifficulty() {
  return difficulties[difficultyKey] || difficulties.normal;
}

function getBaseTick() {
  return Math.round(getMode().baseTick * getDifficulty().tickFactor);
}

function getLevelSpeedStep() {
  return difficultyKey === "hard" ? 10 : difficultyKey === "chill" ? 7 : 9;
}

function getCurrentStepDuration() {
  let speed = tickMs;
  if (slowTicks > 0) speed *= 1.45;
  if (boostActive && boost > 0) speed *= modeKey === "zen" ? 0.78 : 0.62;
  return Math.max(44, speed);
}

function ensureAudioContext() {
  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function beep(frequency, duration, type) {
  if (muted) return;
  ensureAudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playEatSound(type) {
  if (muted) return;
  const sounds = {
    normal: [{ frequency: 620, delay: 0, duration: 0.045, wave: "sine", volume: 0.07 }],
    berry: [
      { frequency: 520, delay: 0, duration: 0.045, wave: "triangle", volume: 0.065 },
      { frequency: 940, delay: 76, duration: 0.055, wave: "sine", volume: 0.052 },
    ],
    gold: [
      { frequency: 784, delay: 0, duration: 0.055, wave: "triangle", volume: 0.07 },
      { frequency: 988, delay: 45, duration: 0.06, wave: "triangle", volume: 0.065 },
      { frequency: 1319, delay: 92, duration: 0.085, wave: "sine", volume: 0.055 },
    ],
    slow: [
      { frequency: 440, delay: 0, duration: 0.065, wave: "sine", volume: 0.06 },
      { frequency: 247, delay: 120, duration: 0.09, wave: "triangle", volume: 0.045 },
    ],
    double: [
      { frequency: 659, delay: 0, duration: 0.05, wave: "triangle", volume: 0.065 },
      { frequency: 1318, delay: 45, duration: 0.08, wave: "sine", volume: 0.055 },
    ],
  };

  sounds[type].forEach((sound) => {
    setTimeout(() => {
      playTone(sound.frequency, sound.duration, sound.wave, sound.volume);
    }, sound.delay);
  });
  if (type === "gold" || type === "double") {
    setTimeout(() => playNoise(0.025, 0.018), 20);
  }
}

function playPoisonSound() {
  beep(150, 0.08, "sawtooth");
  setTimeout(() => beep(92, 0.12, "sawtooth"), 70);
}

function startMusic() {
  if (muted || musicTimer || !running || paused || ended) return;
  ensureAudioContext();
  playMusicStep();
  scheduleMusicStep();
}

function stopMusic() {
  clearTimeout(musicTimer);
  musicTimer = null;
}

function scheduleMusicStep() {
  if (muted || !running || paused || ended) {
    stopMusic();
    return;
  }
  musicTimer = setTimeout(() => {
    musicTimer = null;
    playMusicStep();
    scheduleMusicStep();
  }, getMusicInterval());
}

function getMusicEnergy() {
  const timeEnergy = Math.min(1, playTimeMs / 90000);
  const levelEnergy = Math.min(1, (level - 1) / 8);
  const comboEnergy = Math.min(1, (combo - 1) / 8);
  const rushEnergy = modeKey === "rush" ? 0.12 : 0;
  return Math.min(1, timeEnergy * 0.42 + levelEnergy * 0.34 + comboEnergy * 0.16 + rushEnergy);
}

function getMusicInterval() {
  return Math.round(148 - getMusicEnergy() * 58);
}

function playMusicStep() {
  if (muted || !running || paused || ended) {
    stopMusic();
    return;
  }

  const step = musicStep % 16;
  const energy = getMusicEnergy();
  const transpose = 1 + Math.floor(energy * 5) * 0.006;
  const note = leadNotes[step];
  const harmony = harmonyNotes[step % harmonyNotes.length];
  const bass = bassNotes[step % bassNotes.length];

  if (bass && step % 2 === 0) playTone(bass, 0.11, "square", 0.027 + energy * 0.01);
  if (note) playTone(note * transpose, 0.085, "triangle", 0.032 + energy * 0.018);
  if (energy > 0.28 && harmony && step % 4 !== 1) playTone(harmony * 2 * transpose, 0.06, "sine", 0.012 + energy * 0.014);
  if (energy > 0.42 && step % 4 === 2) playTone(1046.5 * transpose, 0.035, "sine", 0.016 + energy * 0.012);
  if (energy > 0.72 && step % 2 === 1) playTone(1567.98 * transpose, 0.025, "sine", 0.01);
  if (step % 4 === 0 || (energy > 0.55 && step % 4 === 2)) playNoise(0.032, 0.02 + energy * 0.012);

  musicStep += 1;
}

function playTone(frequency, duration, type, volume) {
  if (muted) return;
  ensureAudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playNoise(duration, volume) {
  if (muted) return;
  ensureAudioContext();
  const bufferSize = Math.ceil(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start(now);
}

function hitsWall(cell) {
  return cell.x < 0 || cell.x >= tileCount || cell.y < 0 || cell.y >= tileCount;
}

function wrapCell(cell) {
  return {
    x: (cell.x + tileCount) % tileCount,
    y: (cell.y + tileCount) % tileCount,
  };
}

function hitsSnake(cell, ignoreTail = false) {
  const body = ignoreTail ? snake.slice(0, -1) : snake;
  return body.some((part) => sameCell(part, cell));
}

function hitsObstacle(cell) {
  return obstacles.some((block) => sameCell(block, cell));
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function copyCell(cell) {
  return { x: cell.x, y: cell.y };
}

function cellKey(cell) {
  return cell.x + "," + cell.y;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function circle(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
}

function lerpColor(a, b, amount) {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const rr = Math.round(ar + (br - ar) * amount).toString(16).padStart(2, "0");
  const rg = Math.round(ag + (bg - ag) * amount).toString(16).padStart(2, "0");
  const rb = Math.round(ab + (bb - ab) * amount).toString(16).padStart(2, "0");
  return "#" + rr + rg + rb;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function resizeCanvas() {
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = logicalSize * ratio;
  canvas.height = logicalSize * ratio;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  tileSize = logicalSize / tileCount;
}

startButton.addEventListener("click", () => {
  if (paused) togglePause();
  else startGame();
});

pauseButton.addEventListener("click", togglePause);

restartButton.addEventListener("click", () => {
  resetGame();
  startGame();
});

soundButton.addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem("snakeRushMuted", String(muted));
  syncSoundButton();
  if (muted) stopMusic();
  else startMusic();
});

boostButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  boostActive = true;
});

["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
  boostButton.addEventListener(type, () => {
    boostActive = false;
  });
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (running && !ended) {
      messageEl.textContent = "本局规则已锁定，重开后可以切换模式。";
      return;
    }
    modeKey = button.dataset.mode;
    localStorage.setItem("snakeRushMode", modeKey);
    syncMenu();
    if (!running || ended) resetGame();
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (running && !ended) {
      messageEl.textContent = "本局规则已锁定，重开后可以切换难度。";
      return;
    }
    difficultyKey = button.dataset.difficulty;
    localStorage.setItem("snakeRushDifficulty", difficultyKey);
    syncMenu();
    if (!running || ended) resetGame();
  });
});

directionButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    changeDirection(button.dataset.dir);
  });
});

stage.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

stage.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    changeDirection(dx > 0 ? "right" : "left");
  } else {
    changeDirection(dy > 0 ? "down" : "up");
  }
});

window.addEventListener("keydown", (event) => {
  const keyMap = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };

  if (keyMap[event.key]) {
    event.preventDefault();
    changeDirection(keyMap[event.key]);
  }
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    if (!running || ended) startGame();
    else togglePause();
  }
  if (event.key === "Shift") {
    boostActive = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "Shift") {
    boostActive = false;
  }
});

window.addEventListener("resize", () => {
  resizeCanvas();
  draw(performance.now());
});
