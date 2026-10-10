const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const referencedIds = new Set([...source.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]));
const missingIds = [...referencedIds].filter(id => !htmlIds.has(id));
assert.deepEqual(missingIds, [], "Every static DOM ID used by game.js must exist in index.html");
assert.equal(html.includes('id="launch-button"'), false, "There should be only one primary start action, not a duplicate footer launch button");
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
window.__HUNGER_TEST_MODE__ = true;
for (const coreFile of ["src/core/storage.js", "src/core/clock.js", "src/render/siege-art.js"]) {
 window.eval(fs.readFileSync(path.join(__dirname, "..", coreFile), "utf8"));
}
window.eval(source);

const overlay = document.getElementById("battle-overlay");
assert.equal(overlay.classList.contains("hidden"), false, "Intro overlay should be visible at startup");
document.getElementById("overlay-action").click();
assert.equal(overlay.classList.contains("hidden"), true, "Start button must dismiss intro");
assert.match(document.getElementById("battle-state").textContent, /等待玩家投放/, "Start must wait for first manual deployment");
assert.equal(document.getElementById("pause-button").disabled, false, "Start must enable pause");
assert.equal(document.getElementById("zombie-count").textContent,"0","Battle must start with no free zombie squad");
assert.match(document.getElementById("shelter-hp").textContent, /300/, "Shelter durability must initialize");
const qa = window.__HUNGER_TEST__;
assert.ok(qa, "Test hooks must be available when explicitly enabled");
const canvas = document.getElementById("world");
const pointer = (type,x,y,button=0) => {
 const event=new window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button});
 Object.defineProperty(event,"pointerId",{value:7});canvas.dispatchEvent(event);
};
let population=qa.state().humans;
assert.ok(population.some(h=>h.kind==="civilian"),"First map must have civilians");
assert.ok(population.filter(h=>h.kind==="civilian").every(h=>h.sheltered),"All civilians must initially be sheltered");
assert.ok(population.filter(h=>!h.sheltered).every(h=>["guard","elite"].includes(h.kind)&&h.patrol),"Only armed patrolling defenders may be outside");
assert.equal(qa.state().tutorialStep,1,"First-time onboarding must guide the first placement");
assert.equal(document.querySelector('[data-unit="runner"]').disabled,true,"Runner should start locked");
assert.equal(document.querySelector('[data-unit="brute"]').disabled,true,"Brute should start locked");
assert.equal(document.querySelector('[data-unit="spitter"]').disabled,true,"Spitter should start locked");

let qaState = qa.state();
assert.ok(qaState.shelter.building, "A building must be reserved as the shelter");
const refuge = qaState.shelter.building;
const routeY = refuge.y + refuge.h / 2;
const routeStart = { x: refuge.x - 18, y: routeY };
const routeEnd = { x: refuge.x + refuge.w + 18, y: routeY };
const route = qa.findPath(routeStart.x, routeStart.y, routeEnd.x, routeEnd.y);
assert.ok(route.length > 1, "A* must find a route around a blocked building");
let from = routeStart;
for (const point of route) {
  assert.equal(qa.segmentBlocked(from.x, from.y, point.x, point.y), false, "Smoothed route segments must not cross a building");
  from = point;
}
qa.damageShelter(qaState.shelter.maxHp);
assert.equal(qa.state().shelter.destroyed, true, "Shelter durability must allow the refuge to be breached");

const runFrame = stamp => {
  const callback = queuedFrame;
  queuedFrame = null;
  assert.equal(typeof callback, "function", "Game loop must schedule the next frame");
  callback(stamp);
};
runFrame(1000);
// Find a walkable placement far enough from the gun patrol to observe movement.
const gateSpot=qa.state().barriers[0];
let spawnSpot=null;
for(const radius of [160,195,225,260]){
 for(let k=0;k<24;k++){
  const x=gateSpot.x+Math.cos(k*Math.PI/12)*radius,y=gateSpot.y+Math.sin(k*Math.PI/12)*radius;
  if(x>22&&x<1258&&y>35&&y<680&&!qa.isBlocked(x,y,15)){spawnSpot={x:Math.round(x),y:Math.round(y)};break;}
 }
 if(spawnSpot)break;
}
assert.ok(spawnSpot,"A walkable area must exist for the player to deploy");
pointer("pointerdown",spawnSpot.x,spawnSpot.y);pointer("pointerup",spawnSpot.x,spawnSpot.y);
assert.equal(document.getElementById("zombie-count").textContent,"1","The first zombie must be deployed by the player");
assert.equal(qa.state().tutorialStep,2,"Tutorial should advance after first placement");
const firstZombiePositions=qa.state().zombies.map(z=>[z.x,z.y]);
for (let i = 1; i <= 100; i++) runFrame(1000 + i * 40);
const latestZombiePositions=qa.state().zombies.map(z=>[z.x,z.y]);
assert.notEqual(document.getElementById("time-label").textContent, "00:00", "Combat clock must advance");
assert.notDeepEqual(latestZombiePositions,firstZombiePositions,"Player-deployed zombies must move on the map");

document.getElementById("command-button").click();
assert.equal(document.getElementById("command-button").classList.contains("active"), true, "Command mode must activate");
pointer("pointerdown", 850, 450);
pointer("pointerup", 850, 450);
assert.match(document.getElementById("toast").textContent, /(移动指令|目标锁定)/, "Map click in command mode must issue movement");

// Touch gestures should zoom without turning the end of a pinch into a deployment.
const gesturePointer = (type, id, x, y) => {
 const event = new window.MouseEvent(type, { bubbles:true, cancelable:true, clientX:x, clientY:y, button:0 });
 Object.defineProperty(event, "pointerId", {value:id});canvas.dispatchEvent(event);
};
const prePinchCount = document.getElementById("zombie-count").textContent;
gesturePointer("pointerdown",21,500,300);
gesturePointer("pointerdown",22,600,300);
gesturePointer("pointermove",22,720,300);
assert.ok(qa.state().camera.zoom>1, "Two-finger pinch should increase camera zoom");
gesturePointer("pointerup",21,500,300);
gesturePointer("pointerup",22,720,300);
assert.equal(document.getElementById("zombie-count").textContent,prePinchCount,"Pinching must never accidentally deploy a zombie");
document.getElementById("zoom-reset").click();

const zoom = document.getElementById("zoom-level");
canvas.dispatchEvent(new window.WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true, clientX: 640, clientY: 360 }));
assert.notEqual(zoom.textContent, "100%", "Wheel must zoom the map");
for (let i = 0; i < 80; i++) {
  canvas.dispatchEvent(new window.WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true, clientX: 640, clientY: 360 }));
}
assert.ok(Number.parseInt(zoom.textContent, 10) <= 235, "Current map zoom must obey its per-map upper bound");
document.getElementById("zoom-reset").click();
canvas.dispatchEvent(new window.WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true, clientX: 640, clientY: 360 }));
const beforeDrag = contextTarget.translations.length;
pointer("pointerdown", 600, 300);
pointer("pointermove", 650, 300);
pointer("pointerup", 650, 300);
const afterDrag = contextTarget.translations.slice(beforeDrag);
assert.ok(afterDrag.length > 2, "Dragging should redraw the world");
assert.notDeepEqual(afterDrag[0], [640, 360], "Dragging at zoomed scale must pan the camera");
document.getElementById("zoom-reset").click();

document.querySelector('[data-drawer-tab="shelter"]').click();
assert.equal(document.querySelector('[data-drawer-view="shelter"]').classList.contains("active-view"), true, "Shelter entrance must open its panel");
document.getElementById("drawer-close").click();
pointer("pointerdown", Math.round(1280 * 0.37), Math.round(720 * 0.38));
pointer("pointerup", Math.round(1280 * 0.37), Math.round(720 * 0.38));
assert.match(document.getElementById("toast").textContent, /避难所与入口区域禁止投放/, "The shelter interior must reject zombie deployment");

const settings = document.getElementById("setting-team-highlight");
settings.checked = false;
settings.dispatchEvent(new window.Event("change", { bubbles: true }));
assert.equal(JSON.parse(window.localStorage.getItem("hunger-protocol-prefs-v1")).teamHighlight, false, "Display preference must persist");
assert.ok(source.includes("function findPath") && source.includes("function rebuildNavigation"), "Grid pathfinding must be wired into movement");
assert.ok(source.includes("const SPRITE_DEFS=") && source.includes("function getSpriteOutline") && source.includes("function drawAnchoredSprite"), "Reusable anchored sprite manager must be present");
assert.ok(source.includes("const CITY_PALETTES=") && source.includes("art.drawScene") && source.includes("function setupBarricades") && source.includes("function damageBarricade"), "Siege rendering and interactive barricades must use shared scene and obstacle systems");
assert.ok((fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8").match(/\{/g) || []).length < 500, "UI rules should stay consolidated in one stylesheet");
assert.ok(window.HungerArt.drawScene&&window.HungerArt.paintZombie&&window.HungerArt.paintHuman, "Pixel art renderer must load from shared assets");
assert.equal(document.querySelectorAll("[data-unit]").length,4,"The demo must offer four distinct infected classes");
assert.ok(document.querySelector(".barrier-status"),"Gate durability needs on-screen feedback");
assert.ok(source.includes("function isShelterRestricted") && source.includes("入口区域禁止投放"), "Shelter and entrance must reject deployment");

// Siege gate must have real HP and become traversable after demolition.
qa.resetStage();
let siege = qa.state();
assert.equal(siege.barriers.length,1,"A siege stage should have one destructible entry barricade");
const gate=siege.barriers[0];
assert.ok(gate.hp>0,"Barricade must start intact");
assert.equal(qa.isBlocked(gate.x,gate.y,1),true,"Intact barricade should block unit movement");
qa.damageBarricade(gate.id,gate.hp);
assert.equal(qa.state().barriers[0].destroyed,true,"Barrier should be destroyed at zero HP");
assert.equal(qa.isBlocked(gate.x,gate.y,1),false,"Destroyed barricade should stop blocking");
document.getElementById("overlay-action").click();
assert.equal(document.querySelector('[data-unit="spitter"]').disabled,true,"Fourth unit must remain locked until the third clear");
assert.match(document.getElementById("barrier-status").textContent,/防线崩溃/,"HUD should show the demolished barricade");

// Regression: the previous battle's "next/map" overlay action must not leak into a fresh campaign.
qa.finishMission(true);
assert.equal(qa.state().endingType,"win","Forced QA win must end the encounter");
assert.equal(document.querySelector('[data-unit="runner"]').disabled,false,"First clearance must unlock runner");
assert.equal(document.getElementById("overlay-action").dataset.mode,"next","Stage one victory must offer progression");
document.getElementById("overlay-action").click();
assert.equal(qa.state().stage,1,"Next-stage action must enter stage two");
assert.equal(qa.state().running,true,"Next-stage action must start a playable battle");
assert.equal(qa.state().zombies.length,0,"Next stage must still start without a free squad");
assert.equal(qa.state().humans.filter(h=>h.kind==="civilian"&&!h.sheltered).length,0,"Later stages must also start with civilians sheltered");
qa.resetStage();
assert.equal(document.getElementById("overlay-action").dataset.mode,"start","Replay must clear stale overlay action");
document.getElementById("overlay-action").click();
assert.equal(qa.state().running,true,"A replay must start normally without skipping a stage");
qa.finishMission(false);
assert.equal(document.getElementById("overlay-action").dataset.mode,"retry","Failed battle must offer retry");
document.getElementById("overlay-action").click();
assert.equal(qa.state().running,true,"Retry must start a new running mission");
qa.finishMission(false);
qa.selectCountry("pt");
assert.equal(qa.state().country,"pt","Country switching after a battle must not call a missing UI function");
assert.equal(document.getElementById("overlay-action").dataset.mode,"start","Selecting a country must reset overlay action");
document.getElementById("help-button").click();
assert.equal(document.getElementById("tutorial-card").hidden,false,"Help should replay the onboarding flow");
document.getElementById("tutorial-skip").click();
assert.equal(document.getElementById("tutorial-card").hidden,true,"Skipping tutorial hides the banner");
assert.equal(window.localStorage.getItem("hunger-protocol-tutorial-v1"),"done","Tutorial completion must persist");
console.log("Smoke test passed: start, movement, A*, shelter, camera pinch, settings, victory, retry and country-switch flow.");
dom.window.close();
