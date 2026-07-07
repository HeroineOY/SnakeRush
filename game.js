const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const levelEl = document.querySelector("#level");
const comboEl = document.querySelector("#combo");
const overlay = document.querySelector("#overlay");
const messageEl = document.querySelector("#message");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const soundButton = document.querySelector("#soundButton");
const directionButtons = document.querySelectorAll("[data-dir]");

const tileCount = 24;
const tileSize = canvas.width / tileCount;
const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let snake;
let previousSnake;
let direction;
let queuedDirection;
let food;
let obstacles;
let particles;
let score;
let best;
let level;
let combo;
let foodStreak;
let tickMs;
let slowTicks;
let nextStepAt;
let lastStepAt;
let stepDuration;
let running;
let paused;
let ended;
let muted;
let audioContext;
let musicTimer;
let musicStep;
let playTimeMs;
let lastFrameAt;
let animationFrame;

const leadNotes = [
  523.25,
  null,
  659.25,
  783.99,
  null,
  698.46,
  null,
  659.25,
  587.33,
  null,
  659.25,
  null,
  783.99,
  880,
  null,
  987.77,
];
const harmonyNotes = [329.63, null, null, 392, 349.23, null, 440, null];
const bassNotes = [130.81, null, 164.81, null, 196, null, 164.81, null];

best = Number(localStorage.getItem("snakeRushBest") || 0);
muted = localStorage.getItem("snakeRushMuted") === "true";
bestEl.textContent = best;
syncSoundButton();
resetGame();
draw();

function resetGame() {
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
  score = 0;
  level = 1;
  combo = 1;
  foodStreak = 0;
  tickMs = 150;
  slowTicks = 0;
  nextStepAt = 0;
  lastStepAt = 0;
  stepDuration = tickMs;
  playTimeMs = 0;
  lastFrameAt = 0;
  running = false;
  paused = false;
  ended = false;
  food = spawnFood();
  updateHud();
  pauseButton.textContent = "暂停";
}

function startGame() {
  if (ended) {
    resetGame();
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

function togglePause() {
  if (!running || ended) return;
  paused = !paused;
  pauseButton.textContent = paused ? "继续" : "暂停";
  if (paused) {
    stopMusic();
    showOverlay("稍作停顿", "继续");
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
  if (!running || paused || ended) {
    lastFrameAt = time;
    draw(time);
    return;
  }
  if (lastFrameAt) {
    playTimeMs += Math.min(80, Math.max(0, time - lastFrameAt));
  }
  lastFrameAt = time;
  if (time >= nextStepAt) {
    step();
    const speed = slowTicks > 0 ? tickMs * 1.45 : tickMs;
    lastStepAt = time;
    stepDuration = speed;
    nextStepAt = time + speed;
  }
  draw(time);
}

function step() {
  previousSnake = snake.map(copyCell);
  direction = queuedDirection;
  const head = snake[0];
  const next = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  const willEat = sameCell(next, food);
  if (hitsWall(next) || hitsSnake(next, !willEat) || hitsObstacle(next)) {
    finishGame();
    return;
  }

  snake.unshift(next);
  if (sameCell(next, food)) {
    eatFood(next);
  } else {
    snake.pop();
    combo = Math.max(1, combo - 0.015);
  }

  if (slowTicks > 0) slowTicks -= 1;
  updateHud();
}

function eatFood(cell) {
  const value = food.type === "gold" ? 5 : food.type === "berry" ? 3 : 1;
  const gained = Math.ceil(value * combo * level);
  score += gained;
  combo = Math.min(9, combo + (food.type === "normal" ? 0.35 : 0.75));
  foodStreak += 1;
  spawnBurst(cell, food.color, gained);
  playEatSound(food.type);

  if (food.type === "slow") {
    slowTicks = 18;
  }

  level = 1 + Math.floor(score / 35);
  tickMs = Math.max(72, 150 - (level - 1) * 9);
  rebuildObstacles();
  food = spawnFood();
}

function finishGame() {
  running = false;
  ended = true;
  stopMusic();
  combo = 1;
  if (score > best) {
    best = score;
    localStorage.setItem("snakeRushBest", String(best));
    showOverlay("新纪录 " + score, "再来一局");
    beep(880, 0.12, "triangle");
  } else {
    showOverlay("得分 " + score, "再来一局");
    beep(130, 0.16, "sawtooth");
  }
  updateHud();
}

function spawnFood() {
  const roll = Math.random();
  const type =
    roll > 0.9 ? "gold" :
    roll > 0.78 ? "slow" :
    roll > 0.64 ? "berry" :
    "normal";
  const color = {
    normal: "#95ff66",
    gold: "#ffd166",
    slow: "#5fe6ff",
    berry: "#ff4fd8",
  }[type];

  return {
    ...emptyCell(),
    type,
    color,
    pulse: Math.random() * Math.PI * 2,
  };
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
  const targetCount = Math.min(20, Math.max(0, level - 2) * 3);
  while (obstacles.length < targetCount) {
    const cell = emptyCell();
    if (Math.abs(cell.x - snake[0].x) + Math.abs(cell.y - snake[0].y) > 5) {
      obstacles.push(cell);
    }
  }
}

function changeDirection(nextName) {
  const next = directions[nextName];
  if (!next) return;
  const isReverse = next.x + direction.x === 0 && next.y + direction.y === 0;
  if (!isReverse) {
    queuedDirection = next;
    if (running && !paused && !ended) {
      const responsiveDelay = Math.max(28, Math.min(52, stepDuration * 0.32));
      nextStepAt = Math.min(nextStepAt, performance.now() + responsiveDelay);
    }
  }
}

function draw(time = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard(time);
  drawObstacles(time);
  drawFood(time);
  drawSnake(time);
  drawParticles();
  drawScanlines(time);
}

function drawBoard(time) {
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#07101f");
  bg.addColorStop(0.55, "#120c26");
  bg.addColorStop(1, "#070814");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scanOffset = (time / 70) % tileSize;
  ctx.strokeStyle = "rgba(95, 230, 255, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 1; i < tileCount; i += 1) {
    const p = i * tileSize;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(canvas.width, p);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 79, 216, 0.18)";
  for (let i = -1; i < tileCount; i += 4) {
    const p = i * tileSize + scanOffset;
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(canvas.width, p + canvas.height * 0.18);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 209, 102, 0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
}

function getRenderSnake(time) {
  const rawProgress = stepDuration ? (time - lastStepAt) / stepDuration : 1;
  const progress = easeOutCubic(clamp(rawProgress, 0, 1));
  return snake.map((part, index) => {
    const previous = previousSnake[index] || previousSnake[previousSnake.length - 1] || part;
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

  if (slowTicks > 0) {
    ctx.shadowColor = "#5fe6ff";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(95, 230, 255, 0.52)";
    ctx.lineWidth = 4 + Math.sin(time / 90) * 1.5;
    const head = renderSnake[0];
    circle((head.x + 0.5) * tileSize, (head.y + 0.5) * tileSize, tileSize * 0.72);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawFood(time) {
  const pulse = 1 + Math.sin(time / 170 + food.pulse) * 0.11;
  const cx = (food.x + 0.5) * tileSize;
  const cy = (food.y + 0.5) * tileSize;
  ctx.shadowColor = food.color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = food.color;
  circle(cx, cy, tileSize * 0.31 * pulse);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  circle(cx - tileSize * 0.08, cy - tileSize * 0.1, tileSize * 0.08);
  ctx.fill();

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
    ctx.shadowColor = "#ff5d4d";
    ctx.shadowBlur = 13;
    ctx.fillStyle = "#ff5d4d";
    roundRect(x, y, tileSize - 10, tileSize - 10, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(7, 16, 31, 0.34)";
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

function spawnBurst(cell, color, gained) {
  const cx = (cell.x + 0.5) * tileSize;
  const cy = (cell.y + 0.5) * tileSize;
  for (let i = 0; i < 14; i += 1) {
    const angle = (Math.PI * 2 * i) / 14;
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
  particles.push({
    x: cx,
    y: cy - 8,
    vx: 0,
    vy: -1.1,
    size: Math.min(9, 4 + gained * 0.25),
    color: "#18201c",
    life: 24,
    maxLife: 24,
  });
}

function drawScanlines(time) {
  const sweepY = (time / 9) % canvas.height;
  ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
  ctx.fillRect(0, sweepY, canvas.width, 3);

  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.15,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.72,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  levelEl.textContent = level;
  comboEl.textContent = "x" + combo.toFixed(combo >= 2 ? 1 : 0);
}

function showOverlay(message, buttonLabel) {
  messageEl.textContent = message;
  startButton.textContent = buttonLabel;
  overlay.classList.add("is-visible");
}

function hideOverlay() {
  overlay.classList.remove("is-visible");
}

function syncSoundButton() {
  soundButton.classList.toggle("is-muted", muted);
  soundButton.textContent = muted ? "静" : "声";
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
    normal: [
      { frequency: 620, delay: 0, duration: 0.045, wave: "sine", volume: 0.07 },
      { frequency: 820, delay: 42, duration: 0.045, wave: "triangle", volume: 0.055 },
    ],
    berry: [
      { frequency: 520, delay: 0, duration: 0.045, wave: "triangle", volume: 0.065 },
      { frequency: 700, delay: 38, duration: 0.045, wave: "triangle", volume: 0.06 },
      { frequency: 940, delay: 76, duration: 0.055, wave: "sine", volume: 0.052 },
    ],
    gold: [
      { frequency: 784, delay: 0, duration: 0.055, wave: "triangle", volume: 0.07 },
      { frequency: 988, delay: 45, duration: 0.06, wave: "triangle", volume: 0.065 },
      { frequency: 1319, delay: 92, duration: 0.085, wave: "sine", volume: 0.055 },
    ],
    slow: [
      { frequency: 440, delay: 0, duration: 0.065, wave: "sine", volume: 0.06 },
      { frequency: 330, delay: 55, duration: 0.075, wave: "sine", volume: 0.055 },
      { frequency: 247, delay: 120, duration: 0.09, wave: "triangle", volume: 0.045 },
    ],
  };

  sounds[type].forEach((sound) => {
    setTimeout(() => {
      playTone(sound.frequency, sound.duration, sound.wave, sound.volume);
    }, sound.delay);
  });
  if (type === "gold") {
    setTimeout(() => playNoise(0.025, 0.018), 20);
  }
}

function startMusic() {
  if (muted || musicTimer || !running || paused || ended) return;
  ensureAudioContext();
  musicStep = musicStep || 0;
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
  return Math.min(1, timeEnergy * 0.48 + levelEnergy * 0.36 + comboEnergy * 0.16);
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

  if (bass && step % 2 === 0) {
    playTone(bass, 0.11, "square", 0.027 + energy * 0.01);
  }
  if (note) {
    playTone(note * transpose, 0.085, "triangle", 0.032 + energy * 0.018);
  }
  if (energy > 0.28 && harmony && step % 4 !== 1) {
    playTone(harmony * 2 * transpose, 0.06, "sine", 0.012 + energy * 0.014);
  }
  if (energy > 0.42 && step % 4 === 2) {
    playTone(1046.5 * transpose, 0.035, "sine", 0.016 + energy * 0.012);
  }
  if (energy > 0.72 && step % 2 === 1) {
    playTone(1567.98 * transpose, 0.025, "sine", 0.01);
  }
  if (step % 4 === 0 || (energy > 0.55 && step % 4 === 2)) {
    playNoise(0.032, 0.02 + energy * 0.012);
  }

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

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", () => {
  resetGame();
  startGame();
});
soundButton.addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem("snakeRushMuted", String(muted));
  syncSoundButton();
  if (muted) {
    stopMusic();
  } else {
    startMusic();
  }
});

directionButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    changeDirection(button.dataset.dir);
  });
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
});
