const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
const dom = new JSDOM(html, { url: "https://hunger-protocol.test/", runScripts: "outside-only" });
const { window } = dom;
const { document } = window;
const gradient = { addColorStop() {} };
const contextTarget = { translations: [] };
const context = new Proxy(contextTarget, {
  get(target, key) {
    if (key === "createRadialGradient" || key === "createLinearGradient") return () => gradient;
    if (key === "translate") return (x, y) => target.translations.push([x, y]);
    if (!(key in target)) target[key] = () => {};
    return target[key];
  },
  set(target, key, value) { target[key] = value; return true; }
});
window.HTMLCanvasElement.prototype.getContext = () => context;
window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
  x: 0, y: 0, left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720,
  toJSON() { return {}; }
});
let queuedFrame = null;
window.requestAnimationFrame = callback => { queuedFrame = callback; return 1; };
window.confirm = () => true;
window.eval(source);

const overlay = document.getElementById("battle-overlay");
assert.equal(overlay.classList.contains("hidden"), false, "Intro overlay should be visible at startup");
document.getElementById("overlay-action").click();
assert.equal(overlay.classList.contains("hidden"), true, "Start button must dismiss the intro overlay");
assert.match(document.getElementById("battle-state").textContent, /尸群正在猎食/, "Start click must change battle state");
assert.equal(document.getElementById("pause-button").disabled, false, "Start click must enable pause");
assert.equal(document.getElementById("zombie-count").textContent, "4", "Start click must deploy the starter squad");

const runFrame = stamp => {
  const callback = queuedFrame;
  queuedFrame = null;
  assert.equal(typeof callback, "function", "Game loop must schedule the next frame");
  callback(stamp);
};
runFrame(1000);
const firstZombiePositions = contextTarget.translations.slice(-4).map(([x, y]) => [x, y]);
for (let i = 1; i <= 100; i++) runFrame(1000 + i * 40);
const latestZombiePositions = contextTarget.translations.slice(-4).map(([x, y]) => [x, y]);
assert.notEqual(document.getElementById("time-label").textContent, "00:00", "Simulation clock must advance during combat");
assert.notDeepEqual(latestZombiePositions, firstZombiePositions, "Starter zombies must move during combat");

document.getElementById("command-button").click();
assert.equal(document.getElementById("command-button").classList.contains("active"), true, "Command mode must activate");
const canvas = document.getElementById("world");
canvas.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 850, clientY: 450 }));
assert.match(document.getElementById("toast").textContent, /移动指令/, "Map click in command mode must issue a movement order");

const settings = document.getElementById("setting-team-highlight");
settings.checked = false;
settings.dispatchEvent(new window.Event("change", { bubbles: true }));
assert.equal(JSON.parse(window.localStorage.getItem("hunger-protocol-prefs-v1")).teamHighlight, false, "Display setting must persist");
console.log("Smoke test passed: start button, starter deployment, moving combat loop, command movement, and display settings.");
dom.window.close();
