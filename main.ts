type GameState = "ready" | "playing" | "over";
type ItemType = "rice" | "egg" | "soy" | "chili";

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  targetX: number;
}

interface FallingItem {
  type: ItemType;
  x: number;
  y: number;
  radius: number;
  vy: number;
  sway: number;
  spin: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Elemen game tidak ditemukan: ${selector}`);
  }
  return element;
}

const canvas = requireElement<HTMLCanvasElement>("#gameCanvas");
const context = canvas.getContext("2d");
if (!context) {
  throw new Error("Browser tidak mendukung Canvas 2D.");
}
const ctx: CanvasRenderingContext2D = context;
const screen = requireElement<HTMLDivElement>("#screen");
const screenIcon = requireElement<HTMLDivElement>("#screenIcon");
const screenTitle = requireElement<HTMLHeadingElement>("#screenTitle");
const screenText = requireElement<HTMLParagraphElement>("#screenText");
const legend = requireElement<HTMLDivElement>("#legend");
const startButton = requireElement<HTMLButtonElement>("#startButton");
const soundButton = requireElement<HTMLButtonElement>("#soundButton");
const gameStatus = requireElement<HTMLParagraphElement>("#gameStatus");

const W = canvas.width;
const H = canvas.height;
const player: Player = { x: W / 2, y: 510, width: 150, height: 48, targetX: W / 2 };
const items: FallingItem[] = [];
const particles: Particle[] = [];
const popups: Popup[] = [];
const keys = new Set<string>();
const bestKey = "nasiGorengRushBest";
let state: GameState = "ready";
let score = 0;
let lives = 3;
let best = readBest();
let elapsed = 0;
let spawnClock = 0;
let lastTime = 0;
let soundOn = true;
let audioContext: AudioContext | null = null;
let mutedUntil = 0;

function readBest(): number {
  try {
    return Number(localStorage.getItem(bestKey)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(): void {
  try {
    localStorage.setItem(bestKey, String(best));
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

function wakeAudio(): void {
  if (!soundOn) return;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  slide: number
): void {
  if (!soundOn || !audioContext || audioContext.state !== "running") return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slide) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
  }
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playSound(kind: "catch" | "hurt" | "start"): void {
  if (!soundOn) return;
  wakeAudio();
  if (kind === "catch") {
    tone(510, 0.11, "triangle", 0.07, 220);
    tone(760, 0.13, "sine", 0.045, 90);
  } else if (kind === "hurt") {
    tone(190, 0.3, "sawtooth", 0.055, -110);
  } else {
    tone(370, 0.1, "sine", 0.05, 180);
    window.setTimeout(() => tone(590, 0.13, "sine", 0.05, 120), 90);
  }
}

function showReady(): void {
  state = "ready";
  screen.hidden = false;
  screenIcon.textContent = "🍚";
  screenTitle.textContent = "Siap masak?";
  screenText.textContent = "Tangkap bahan lezat yang berjatuhan, tapi awas cabai! Bertahan selama mungkin dan raih skor tertinggi.";
  legend.hidden = false;
  startButton.textContent = "MULAI MASAK";
}

function startGame(): void {
  wakeAudio();
  score = 0;
  lives = 3;
  elapsed = 0;
  spawnClock = 0.35;
  items.length = 0;
  particles.length = 0;
  popups.length = 0;
  player.x = W / 2;
  player.targetX = W / 2;
  lastTime = performance.now();
  state = "playing";
  screen.hidden = true;
  gameStatus.textContent = "Permainan dimulai. Tiga nyawa tersedia.";
  playSound("start");
  requestAnimationFrame(loop);
}

function endGame(): void {
  state = "over";
  screen.hidden = false;
  screenIcon.textContent = "💥";
  screenTitle.textContent = "Wajan dingin!";
  screenText.innerHTML = `Skor kamu <strong>${score}</strong> · Rekor <strong>${best}</strong><br>Masak lagi dan pecahkan rekor!`;
  legend.hidden = true;
  startButton.textContent = "MAIN LAGI";
  gameStatus.textContent = `Game over. Skor ${score}. Rekor ${best}.`;
}

function setPointer(event: PointerEvent): void {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  player.targetX = Math.max(
    player.width / 2,
    Math.min(W - player.width / 2, (event.clientX - rect.left) * scaleX)
  );
}

canvas.addEventListener("pointermove", (event: PointerEvent) => {
  if (state === "playing") setPointer(event);
});

canvas.addEventListener("pointerdown", (event: PointerEvent) => {
  if (state === "playing") {
    setPointer(event);
    canvas.setPointerCapture(event.pointerId);
  }
});

window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) {
    event.preventDefault();
    keys.add(event.key.toLowerCase());
  }
  if ((event.key === " " || event.key === "Enter") && state !== "playing") {
    event.preventDefault();
    startGame();
  }
});

window.addEventListener("keyup", (event: KeyboardEvent) => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
startButton.addEventListener("click", startGame);
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  soundButton.textContent = soundOn ? "♫" : "🔇";
  soundButton.setAttribute("aria-label", soundOn ? "Matikan suara" : "Nyalakan suara");
  soundButton.title = soundOn ? "Suara aktif" : "Suara mati";
  if (soundOn) {
    wakeAudio();
    tone(600, 0.1, "sine", 0.045, 100);
  }
});

function spawnItem(): void {
  const chiliChance = Math.min(0.32, 0.17 + elapsed * 0.002);
  const roll = Math.random();
  let type: ItemType;
  if (roll < chiliChance) type = "chili";
  else if (roll < chiliChance + 0.38) type = "rice";
  else if (roll < chiliChance + 0.65) type = "egg";
  else type = "soy";

  const radius = type === "egg" ? 22 : type === "chili" ? 19 : 18;
  items.push({
    type,
    x: 45 + Math.random() * (W - 90),
    y: -35,
    radius,
    vy: 155 + Math.min(elapsed * 2.8, 145) + Math.random() * 45,
    sway: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.8
  });
}

function addBurst(x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 150;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 35,
      size: 2 + Math.random() * 4,
      color,
      life: 0.35 + Math.random() * 0.45
    });
  }
}

function addPopup(x: number, y: number, text: string, color: string): void {
  popups.push({ x, y, text, color, life: 0.9 });
}

function update(dt: number): void {
  elapsed += dt;
  if (keys.has("arrowleft") || keys.has("a")) player.targetX -= 520 * dt;
  if (keys.has("arrowright") || keys.has("d")) player.targetX += 520 * dt;
  player.targetX = Math.max(player.width / 2, Math.min(W - player.width / 2, player.targetX));
  player.x += (player.targetX - player.x) * Math.min(1, dt * 13);

  spawnClock -= dt;
  if (spawnClock <= 0) {
    spawnItem();
    spawnClock = Math.max(0.36, 0.86 - elapsed * 0.006) * (0.72 + Math.random() * 0.48);
  }

  const panLeft = player.x - player.width * 0.43;
  const panRight = player.x + player.width * 0.43;
  const panTop = player.y - 17;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!item) continue;
    item.y += item.vy * dt;
    item.x += Math.sin(elapsed * 2.1 + item.sway) * 23 * dt;
    item.sway += dt * item.spin;
    if (
      item.y + item.radius > panTop &&
      item.y - item.radius < player.y + 10 &&
      item.x > panLeft - item.radius * 0.55 &&
      item.x < panRight + item.radius * 0.55
    ) {
      items.splice(i, 1);
      if (item.type === "chili") {
        lives--;
        mutedUntil = elapsed + 0.5;
        addBurst(item.x, item.y, "#ff6048", 15);
        addPopup(item.x, item.y - 16, "CABAI! -1", "#ff8873");
        playSound("hurt");
        gameStatus.textContent = `Aduh, kena cabai. Sisa ${lives} nyawa.`;
        if (lives <= 0) {
          if (score > best) {
            best = score;
            saveBest();
          }
          endGame();
          return;
        }
      } else {
        const points = item.type === "rice" ? 10 : item.type === "egg" ? 20 : 15;
        score += points;
        if (score > best) {
          best = score;
          saveBest();
        }
        const colors: Record<Exclude<ItemType, "chili">, string> = {
          rice: "#ffe8a4",
          egg: "#fff1bd",
          soy: "#d8a4ff"
        };
        const color = colors[item.type];
        addBurst(item.x, item.y, color, 10);
        addPopup(item.x, item.y - 12, `+${points}`, color);
        playSound("catch");
        gameStatus.textContent = `Bahan tertangkap, tambah ${points} poin. Skor ${score}.`;
      }
    } else if (item.y > H + 40) {
      items.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    if (!particle) continue;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 260 * dt;
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const popup = popups[i];
    if (!popup) continue;
    popup.y -= 35 * dt;
    popup.life -= dt;
    if (popup.life <= 0) popups.splice(i, 1);
  }
}

function roundedRect(x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawBackground(time: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#59351f");
  bg.addColorStop(0.57, "#422619");
  bg.addColorStop(0.58, "#302018");
  bg.addColorStop(1, "#21150f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#f3a44b12";
  for (let i = 0; i < 7; i++) {
    const x = 70 + i * 145;
    ctx.beginPath();
    ctx.arc(x, 100 + Math.sin(time * 0.0008 + i) * 5, 24 + (i % 3) * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#ecac6424";
  ctx.lineWidth = 2;
  for (let y = 55; y < 320; y += 51) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#170f0b";
  ctx.fillRect(0, 352, W, 17);
  ctx.fillStyle = "#9c6037";
  ctx.fillRect(0, 369, W, 5);

  ctx.fillStyle = "#281a13";
  ctx.fillRect(0, 376, W, H - 376);
  ctx.strokeStyle = "#513321";
  ctx.lineWidth = 2;
  for (let x = -50; x < W + 100; x += 105) {
    ctx.beginPath();
    ctx.moveTo(x, 380);
    ctx.lineTo(x + 75, H);
    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(player.x, player.y + 35, 10, player.x, player.y + 35, 220);
  glow.addColorStop(0, "#f7933a28");
  glow.addColorStop(1, "#f7933a00");
  ctx.fillStyle = glow;
  ctx.fillRect(player.x - 230, player.y - 180, 460, 300);
}

function drawRice(x: number, y: number, radius: number): void {
  ctx.fillStyle = "#ffe5a0";
  const grains: Array<[number, number, number]> = [[-7, 1, 7], [0, -6, 8], [7, 2, 7], [-1, 7, 7]];
  grains.forEach(([dx, dy, size], i) => {
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, size * 0.8, size * 0.53, i * 0.65, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#d77c39";
  ctx.beginPath();
  ctx.arc(x - 4, y - 1, Math.max(1.5, radius * 0.1), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#73a64f";
  ctx.beginPath();
  ctx.arc(x + 7, y - 6, 2.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawEgg(x: number, y: number): void {
  ctx.fillStyle = "#fff0bc";
  ctx.beginPath();
  ctx.ellipse(x, y, 22, 17, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f7b740";
  ctx.beginPath();
  ctx.arc(x + 2, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe38a";
  ctx.beginPath();
  ctx.arc(x - 1, y - 3, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawSoy(x: number, y: number): void {
  ctx.fillStyle = "#d39aff";
  ctx.beginPath();
  ctx.moveTo(x, y - 20);
  ctx.bezierCurveTo(x + 4, y - 13, x + 13, y - 2, x + 11, y + 5);
  ctx.bezierCurveTo(x + 9, y + 17, x - 9, y + 17, x - 11, y + 5);
  ctx.bezierCurveTo(x - 13, y - 2, x - 4, y - 13, x, y - 20);
  ctx.fill();
  ctx.fillStyle = "#f0d7ff";
  ctx.beginPath();
  ctx.ellipse(x - 4, y + 2, 2.4, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawChili(x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(elapsed * 2 + x) * 0.12);
  ctx.fillStyle = "#f34d37";
  ctx.beginPath();
  ctx.moveTo(-2, -15);
  ctx.bezierCurveTo(13, -17, 15, -3, 7, 9);
  ctx.bezierCurveTo(3, 15, -3, 20, -8, 17);
  ctx.bezierCurveTo(-3, 12, -1, 6, -7, -1);
  ctx.bezierCurveTo(-11, -7, -9, -14, -2, -15);
  ctx.fill();
  ctx.strokeStyle = "#83a34d";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-2, -14);
  ctx.quadraticCurveTo(-2, -21, 5, -20);
  ctx.stroke();
  ctx.restore();
}

function drawItem(item: FallingItem): void {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(Math.sin(item.sway) * 0.12);
  if (item.type === "rice") drawRice(0, 0, item.radius);
  else if (item.type === "egg") drawEgg(0, 0);
  else if (item.type === "soy") drawSoy(0, 0);
  else drawChili(0, 0);
  ctx.restore();
}

function drawPan(time: number): void {
  const x = player.x;
  const y = player.y;
  const wobble = state === "playing" ? Math.sin(time * 0.008) * 1.3 : 0;
  ctx.save();
  ctx.translate(0, wobble);

  ctx.fillStyle = "#171310";
  roundedRect(x + 42, y - 8, 132, 16, 8);
  ctx.fill();
  ctx.fillStyle = "#574538";
  roundedRect(x + 46, y - 5, 125, 10, 5);
  ctx.fill();

  ctx.shadowColor = "#0009";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#282a2b";
  ctx.beginPath();
  ctx.ellipse(x, y, 78, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#657176";
  ctx.beginPath();
  ctx.ellipse(x, y - 5, 73, 31, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#202321";
  ctx.beginPath();
  ctx.ellipse(x, y - 11, 64, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c58138";
  ctx.beginPath();
  ctx.ellipse(x - 10, y - 13, 45, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5d487";
  ctx.beginPath();
  ctx.ellipse(x - 14, y - 16, 36, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  drawRice(x - 15, y - 17, 12);
  drawRice(x + 15, y - 12, 12);
  ctx.fillStyle = "#75a653";
  ctx.beginPath();
  ctx.arc(x + 4, y - 23, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#d5a45e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y - 5, 72, 30, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();

  ctx.strokeStyle = "#d7d2c088";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const sx = x - 25 + i * 23;
    const rise = (time * 0.035 + i * 27) % 38;
    ctx.beginPath();
    ctx.moveTo(sx, y - 44 - rise);
    ctx.quadraticCurveTo(sx - 11, y - 57 - rise, sx + 2, y - 68 - rise);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud(): void {
  ctx.fillStyle = "#1b100bc9";
  roundedRect(22, 20, 214, 76, 15);
  ctx.fill();
  ctx.strokeStyle = "#e7a85680";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#c9a989";
  ctx.font = "700 12px Trebuchet MS, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SKOR", 40, 45);
  ctx.fillStyle = "#ffe0a2";
  ctx.font = "800 27px Trebuchet MS, sans-serif";
  ctx.fillText(String(score).padStart(3, "0"), 39, 78);

  ctx.fillStyle = "#c9a989";
  ctx.font = "700 12px Trebuchet MS, sans-serif";
  ctx.fillText("REKOR", 145, 45);
  ctx.fillStyle = "#ffca70";
  ctx.font = "800 21px Trebuchet MS, sans-serif";
  ctx.fillText(String(best), 145, 76);

  ctx.fillStyle = "#1b100bc9";
  roundedRect(W - 194, 20, 172, 76, 15);
  ctx.fill();
  ctx.strokeStyle = "#e7a85680";
  ctx.stroke();
  ctx.fillStyle = "#c9a989";
  ctx.font = "700 12px Trebuchet MS, sans-serif";
  ctx.fillText("NYAWA", W - 174, 45);
  for (let i = 0; i < 3; i++) {
    ctx.font = "25px sans-serif";
    ctx.globalAlpha = i < lives ? 1 : 0.22;
    ctx.fillText("♥", W - 174 + i * 43, 78);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.font = "700 12px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#f7d29a";
  ctx.fillText(`${Math.floor(elapsed)} dtk`, W / 2, 40);
  ctx.textAlign = "left";
}

function render(time: number): void {
  drawBackground(time);
  for (const item of items) drawItem(item);

  for (const particle of particles) {
    ctx.globalAlpha = Math.min(1, particle.life * 2);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const popup of popups) {
    ctx.globalAlpha = Math.min(1, popup.life * 2);
    ctx.fillStyle = popup.color;
    ctx.font = "800 17px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "#21150f";
    ctx.shadowBlur = 5;
    ctx.fillText(popup.text, popup.x, popup.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";

  drawPan(time);
  drawHud();

  if (state === "playing" && elapsed < mutedUntil) {
    ctx.fillStyle = "#ef574730";
    ctx.fillRect(0, 0, W, H);
  }
}

function loop(time: number): void {
  if (state !== "playing") return;
  const dt = Math.min(0.034, Math.max(0, (time - lastTime) / 1000));
  lastTime = time;
  update(dt);
  render(time);
  if (state === "playing") requestAnimationFrame(loop);
}

function idleLoop(time: number): void {
  if (state === "playing") return;
  render(time);
  requestAnimationFrame(idleLoop);
}

showReady();
render(0);
requestAnimationFrame(idleLoop);
