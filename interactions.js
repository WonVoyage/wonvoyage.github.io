const study = document.querySelector("[data-study]");
const field = study.querySelector(".study-field");
const diagram = field.querySelector("svg");
const play = study.querySelector("[data-play]");
const restart = study.querySelector("[data-restart]");
const scoreDisplay = study.querySelector("[data-score]");
const livesDisplay = study.querySelector("[data-lives]");
const status = study.querySelector("[data-status]");
const paddleNode = study.querySelector("[data-paddle]");
const ballNode = study.querySelector("[data-ball]");
const bricks = Array.from(study.querySelectorAll(".study-bricks rect"), (node) => ({
  node,
  x: node.x.baseVal.value,
  y: node.y.baseVal.value,
  width: node.width.baseVal.value,
  height: node.height.baseVal.value,
  cleared: false,
}));

const bounds = { left: 100, right: 381, top: 71, bottom: 307 };
const center = (bounds.left + bounds.right) / 2;
const paddle = { x: center, y: paddleNode.y.baseVal.value, half: paddleNode.width.baseVal.value / 2 };
const ball = { x: center, y: 280, vx: 0, vy: 0, radius: ballNode.r.baseVal.value };
const keys = new Set();
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const timeStep = 1 / 160;
const phases = JSON.parse(study.dataset.phases);
let phase = "ready";
let score = 0;
let lives = 3;
let frame = 0;
let lastTime = 0;
let accumulator = 0;
let touchPointer = null;

function draw() {
  paddleNode.setAttribute("x", paddle.x - paddle.half);
  ballNode.setAttribute("cx", ball.x);
  ballNode.setAttribute("cy", ball.y);
}

function setPhase(next) {
  phase = next;
  study.dataset.phase = next;
  play.textContent = phases[next].button;
  status.textContent = phases[next].message;
  restart.disabled = next === "ready";
  if (next !== "playing") {
    cancelAnimationFrame(frame);
    keys.clear();
  }
}

function placeBall() {
  ball.x = paddle.x;
  ball.y = paddle.y - ball.radius - 2;
}

function movePaddle(x) {
  paddle.x = clamp(x, bounds.left + paddle.half, bounds.right - paddle.half);
  if (phase === "serve") placeBall();
}

function launch() {
  ball.vx = 104;
  ball.vy = -180;
  startFrame();
}

function newGame() {
  paddle.x = center;
  score = 0;
  lives = 3;
  scoreDisplay.textContent = score;
  livesDisplay.textContent = lives;
  for (const brick of bricks) {
    brick.cleared = false;
    brick.node.style.removeProperty("display");
  }
  placeBall();
  draw();
  launch();
}

function startFrame() {
  cancelAnimationFrame(frame);
  setPhase("playing");
  lastTime = performance.now();
  accumulator = 0;
  frame = requestAnimationFrame(tick);
}

function tick(now) {
  accumulator += Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  while (accumulator >= timeStep && phase === "playing") {
    step();
    accumulator -= timeStep;
  }
  draw();
  if (phase === "playing") frame = requestAnimationFrame(tick);
}

function direction() {
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  return Number(right) - Number(left);
}

function step() {
  movePaddle(paddle.x + direction() * 245 * timeStep);
  const oldY = ball.y;
  const r = ball.radius;
  ball.x += ball.vx * timeStep;
  ball.y += ball.vy * timeStep;

  if (ball.x < bounds.left + r || ball.x > bounds.right - r) {
    ball.x = clamp(ball.x, bounds.left + r, bounds.right - r);
    ball.vx = -ball.vx;
  }
  if (ball.y < bounds.top + r) {
    ball.y = bounds.top + r;
    ball.vy = Math.abs(ball.vy);
  }

  const crossedPaddle = oldY + r <= paddle.y && ball.y + r >= paddle.y;
  if (ball.vy > 0 && crossedPaddle && Math.abs(ball.x - paddle.x) <= paddle.half + r) {
    const hit = clamp((ball.x - paddle.x) / paddle.half, -1, 1);
    const speed = Math.min(310, Math.hypot(ball.vx, ball.vy) * 1.035);
    ball.y = paddle.y - r;
    ball.vx = Math.sin(hit * 1.05) * speed;
    ball.vy = -Math.cos(hit * 1.05) * speed;
  }

  const brick = bricks.find((tile) => !tile.cleared
    && ball.x + r >= tile.x && ball.x - r <= tile.x + tile.width
    && ball.y + r >= tile.y && ball.y - r <= tile.y + tile.height);
  if (brick) {
    if (oldY + r <= brick.y || oldY - r >= brick.y + brick.height) ball.vy = -ball.vy;
    else ball.vx = -ball.vx;
    brick.cleared = true;
    brick.node.style.display = "none";
    score += 10;
    scoreDisplay.textContent = score;
    if (score === bricks.length * 10) setPhase("won");
  }

  if (ball.y - r > bounds.bottom) {
    lives -= 1;
    livesDisplay.textContent = lives;
    placeBall();
    setPhase(lives === 0 ? "lost" : "serve");
  }
}

function togglePlay() {
  switch (phase) {
    case "playing":
      setPhase("paused");
      break;
    case "paused":
      startFrame();
      break;
    case "serve":
      launch();
      break;
    default:
      newGame();
  }
}

play.disabled = false;
play.addEventListener("click", () => {
  togglePlay();
  if (phase === "playing") field.focus({ preventScroll: true });
});
restart.addEventListener("click", () => {
  keys.clear();
  newGame();
  field.focus({ preventScroll: true });
});

function isMovement(code) {
  return code === "ArrowLeft" || code === "ArrowRight" || code === "KeyA" || code === "KeyD";
}

field.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) togglePlay();
  } else if (isMovement(event.code) && (phase === "playing" || phase === "serve")) {
    event.preventDefault();
    if (phase === "playing") keys.add(event.code);
    if (!event.repeat || phase === "serve") {
      const right = event.code === "ArrowRight" || event.code === "KeyD";
      movePaddle(paddle.x + (right ? 8 : -8));
      draw();
    }
  }
});
field.addEventListener("keyup", (event) => keys.delete(event.code));
field.addEventListener("blur", () => keys.clear());

function followPointer(event) {
  if (phase !== "playing" && phase !== "serve") return;
  const rect = diagram.getBoundingClientRect();
  movePaddle((event.clientX - rect.left) * diagram.viewBox.baseVal.width / rect.width);
  draw();
}

field.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  if (event.pointerType !== "mouse") {
    touchPointer = event.pointerId;
    field.setPointerCapture(event.pointerId);
  }
  followPointer(event);
});
field.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse" || event.pointerId === touchPointer) followPointer(event);
});
field.addEventListener("lostpointercapture", (event) => {
  if (event.pointerId === touchPointer) touchPointer = null;
});

function pauseGame() {
  if (phase === "playing") setPhase("paused");
}

study.addEventListener("focusout", (event) => {
  if (!study.contains(event.relatedTarget)) pauseGame();
});
window.addEventListener("blur", pauseGame);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseGame();
});

const screenshotDialog = document.querySelector(".screenshot-dialog");
const screenshotTitle = screenshotDialog.querySelector("h2");
const screenshotImage = screenshotDialog.querySelector("img");
for (const link of document.querySelectorAll(".game-image-link")) {
  link.addEventListener("click", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (typeof screenshotDialog.showModal !== "function") return;
    event.preventDefault();
    const preview = link.querySelector("img");
    screenshotTitle.textContent = link.dataset.screenshotTitle;
    screenshotImage.alt = preview.alt;
    screenshotImage.width = preview.width;
    screenshotImage.height = preview.height;
    screenshotImage.src = link.href;
    screenshotDialog.classList.toggle("portrait", preview.height > preview.width);
    screenshotDialog.showModal();
  });
}
screenshotDialog.addEventListener("click", (event) => {
  if (event.target === screenshotDialog) screenshotDialog.close();
});

const topbar = document.querySelector(".topbar");
const translatedPage = topbar.querySelector('.locale-picker a[aria-current="false"]');
const translatedPath = translatedPage.getAttribute("href");

function preserveSection() {
  translatedPage.setAttribute("href", translatedPath + location.hash);
}

window.addEventListener("hashchange", preserveSection);
preserveSection();

const sections = Array.from(topbar.querySelectorAll("nav a"), (link) => ({
  link,
  target: document.getElementById(link.hash.slice(1)),
}));
let activeLink;
let navFrame = 0;

function updateNav() {
  navFrame = 0;
  const marker = topbar.getBoundingClientRect().bottom + Math.min(120, window.innerHeight * 0.18);
  const last = sections.findLast(({ target }) => target.getBoundingClientRect().top <= marker);
  const atEnd = window.scrollY > 0 && Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;
  const link = atEnd ? sections.at(-1).link : last?.link;
  if (activeLink === link) return;
  activeLink?.removeAttribute("aria-current");
  link?.setAttribute("aria-current", "location");
  activeLink = link;
}

function scheduleNav() {
  if (!navFrame) navFrame = requestAnimationFrame(updateNav);
}

window.addEventListener("scroll", scheduleNav, { passive: true });
window.addEventListener("resize", scheduleNav);
updateNav();

const motionToggle = document.querySelector("[data-motion-toggle]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const motionPreferenceKey = "portfolio-background-motion";
let motionEnabled = true;
try {
  motionEnabled = localStorage.getItem(motionPreferenceKey) !== "off";
} catch {
  // The toggle still works when browser storage is unavailable.
}

function updateBackgroundMotion() {
  const running = motionEnabled && !reducedMotion.matches;
  document.documentElement.dataset.motion = running ? "on" : "off";
  motionToggle.hidden = reducedMotion.matches;
  motionToggle.setAttribute("aria-pressed", String(running));
}

motionToggle.addEventListener("click", () => {
  motionEnabled = !motionEnabled;
  updateBackgroundMotion();
  try {
    localStorage.setItem(motionPreferenceKey, motionEnabled ? "on" : "off");
  } catch {
    // The preference applies for the current page.
  }
});
reducedMotion.addEventListener("change", updateBackgroundMotion);
updateBackgroundMotion();
