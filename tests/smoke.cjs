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
for (const coreFile of ["src/core/storage.js", "src/core/clock.js", "src/core/progression.js", "src/core/navigation.js", "src/render/asset-catalog.js", "src/render/siege-art.js"]) {
 window.eval(fs.readFileSync(path.join(__dirname, "..", coreFile), "utf8"));
}
window.eval(source);

const overlay = document.getElementById("battle-overlay");
// Battlefield panels collapse independently without removing deployment.
for(const [id,key] of [["dock-toggle","dock"],["hud-toggle","hud"],["objective-toggle","objective"]]){
 const el=document.getElementById(id),before=el.getAttribute("aria-expanded");
 el.click();assert.notEqual(el.getAttribute("aria-expanded"),before,id+" must toggle");
 el.click();assert.equal(el.getAttribute("aria-expanded"),before,id+" must restore");
}
assert.ok(document.querySelector('[data-unit="walker"]'),"Deploy card survives compact mode");
assert.equal(typeof window.HungerCore.createNavigator,"function");
const menu=document.getElementById("main-menu");
assert.equal(menu.hidden,false,"Title screen must show before the player starts");
assert.equal(document.getElementById("app-shell").classList.contains("menu-open"),true);
assert.equal(document.getElementById("menu-continue").hidden,true,"Fresh browser should not show a fake save");
assert.equal(document.querySelector("#menu-actions button:not([hidden])").id,"menu-new","No save should prioritize New Game");
assert.equal(document.getElementById("menu-research-open").hidden,true,"Research must not appear before progression");
document.getElementById("menu-new").click();
assert.equal(menu.hidden,true,"New Game must enter battle without another modal");
assert.equal(overlay.classList.contains("hidden"),true,"Title screen is the only required start step");
assert.equal(document.getElementById("app-shell").classList.contains("first-chapter"),true,"First chapter must hide later-game systems");
assert.equal(document.getElementById("app-shell").classList.contains("reveal-biomass"),false,"Biomass must be undiscovered at start");
assert.equal(document.getElementById("app-shell").classList.contains("has-nest"),false,"Early UI must not expose the nest");
assert.equal(document.querySelector('[data-unit="runner"]').hidden,true,"Only walker should be shown on day one");
assert.match(document.getElementById("battle-state").textContent, /等待玩家投放/, "Start must wait for first manual deployment");
assert.equal(document.getElementById("pause-button").disabled, false, "Start must enable pause");
assert.equal(document.getElementById("zombie-count").textContent,"0","Battle must start with no free zombie squad");
assert.match(document.getElementById("shelter-hp").textContent, /180/, "The first shelter must use beginner-friendly durability");
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
qa.stepSimulation(2);
assert.equal(qa.state().missionTime,0,"Looking around before deploying must not consume the mission timer");
assert.equal(qa.state().encounterStarted,false,"Battle starts only with the first player-made zombie");
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
document.getElementById("monitor-deploy").click();
assert.equal(document.getElementById("zombie-count").textContent,"1","Random deployment must create the first zombie");
assert.equal(qa.state().encounterStarted,true,"Deploying the first zombie should activate the mission clock");
assert.equal(qa.killZombieForTest(),true,"Zombie corpses should produce resources");
assert.ok(qa.state().salvage>0,"Dead zombies produce capped salvage");
document.getElementById("monitor-deploy").click();
assert.ok(qa.state().zombies.some(z=>z.alive),"The control room can inject replacement zombies");
assert.equal(qa.state().tutorialStep,2,"Tutorial should advance after first placement");
const firstZombiePositions=qa.state().zombies.map(z=>[z.x,z.y]);
for (let i = 1; i <= 100; i++) runFrame(1000 + i * 40);
const latestZombiePositions=qa.state().zombies.map(z=>[z.x,z.y]);
assert.notEqual(document.getElementById("time-label").textContent, "00:00", "Combat clock must advance");
assert.notDeepEqual(latestZombiePositions,firstZombiePositions,"Player-deployed zombies must move on the map");

// A walker can be killed by defenders; the player must still be able to replenish the horde.
if(!qa.state().zombies.some(z=>z.alive)){
 document.getElementById("monitor-deploy").click();
}
assert.ok(qa.state().zombies.some(z=>z.alive),"Player can deploy reinforcements after losses");
const previousCount=qa.state().zombies.length;
pointer("pointerdown",850,450);pointer("pointerup",850,450);
assert.equal(qa.state().zombies.length,previousCount,"Monitor image must never directly spawn a zombie");
assert.ok(document.getElementById("monitor-deploy"),"The control room should have one injection button");

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
assert.match(document.getElementById("toast").textContent, /监控模式/, "Clicking the surveillance view must not manually deploy");

const settings = document.getElementById("setting-team-highlight");
settings.checked = false;
settings.dispatchEvent(new window.Event("change", { bubbles: true }));
assert.equal(JSON.parse(window.localStorage.getItem("hunger-protocol-prefs-v1")).teamHighlight, false, "Display preference must persist");
assert.ok(source.includes("function findPath") && source.includes("function rebuildNavigation") && source.includes("core.moveAgent") && source.includes("navGrid.approachRect"), "Shared clearance-aware navigation and anti-stuck movement must drive units");
assert.ok(source.includes("const SPRITE_DEFS=") && source.includes("function getSpriteOutline") && source.includes("function drawAnchoredSprite"), "Reusable anchored sprite manager must be present");
assert.ok(source.includes("const CITY_PALETTES=") && source.includes("art.drawScene") && source.includes("function setupBarricades") && source.includes("function damageBarricade"), "Siege rendering and interactive barricades must use shared scene and obstacle systems");
assert.ok((fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8").match(/\{/g) || []).length < 700, "UI rules should stay bounded while the menu is introduced");
assert.ok(window.HungerArt.drawScene&&window.HungerArt.paintZombie&&window.HungerArt.paintHuman, "Pixel art renderer must load from shared assets");
assert.ok(window.HungerAssets.list().some(a=>a.id==="building")&&window.HungerAssets.list().some(a=>a.id==="barricade"),"All scenery assets must be cataloged");
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
qa.damageShelter(qa.state().shelter.maxHp);
assert.equal(qa.state().shelter.destroyed,true,"Shelter must release occupants after its durability is breached");
assert.equal(qa.isBlocked(gate.x,gate.y,1),false,"Destroyed barricade should stop blocking");
document.getElementById("overlay-action").click();
assert.equal(document.querySelector('[data-unit="spitter"]').disabled,true,"Fourth unit must remain locked until the third clear");
assert.match(document.getElementById("barrier-status").textContent,/防线崩溃/,"HUD should show the demolished barricade");

// Partial elimination must NEVER open the next stage.
const roster=qa.state().humans;
for(const h of roster.filter(h=>h.kind==="civilian"))assert.equal(qa.neutralizeHumanForTest(h.id),true);
qa.stepSimulation(1/30);
assert.notEqual(qa.state().endingType,"win","Living guards prevent early victory");
assert.equal(qa.state().objectiveTarget,roster.length,"Both guard and civilian count toward total elimination");
for(const h of qa.state().humans.filter(h=>h.alive))assert.equal(qa.neutralizeHumanForTest(h.id),true);
qa.stepSimulation(1/30);
assert.equal(qa.state().endingType,"win","Every remaining human must be eliminated before progression");
assert.equal(document.querySelector('[data-unit="runner"]').hidden,false,"First clear reveals runner research");
assert.equal(document.querySelector('[data-unit="runner"]').disabled,true,"Runner must still require paid research");
assert.equal(document.getElementById("menu-research-open").hidden,false,"First clear must unlock research in menu");
assert.equal(document.getElementById("app-shell").classList.contains("has-nest"),true,"Nest should appear after first clearance");
const researchItem=document.querySelector('#menu-research-list [data-research="runner"]');
assert.ok(researchItem,"First clear must offer a playable runner research button");
assert.equal(researchItem.disabled,false,"First clear rewards must be sufficient to research runner");
researchItem.click();
assert.equal(document.querySelector('[data-unit="runner"]').disabled,false,"Runner becomes available after research");
assert.equal(JSON.parse(window.localStorage.getItem("hunger-protocol-demo-v01")).research.runner,true,"Research purchase persists");
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
// Complete the real victory condition without calling finishMission directly.
// Civilians are untouchable before breaching the shelter.
qa.resetStage();
document.getElementById("overlay-action").click();
let fullSiege=qa.state();
const protectedCivilian=fullSiege.humans.find(h=>h.kind==="civilian");
assert.ok(protectedCivilian?.sheltered,"Replay must initially protect every civilian");
assert.equal(qa.convertHumanForTest(protectedCivilian.id),false,"Protected civilians cannot be infected through walls");
const firstGate=fullSiege.barriers[0];
qa.damageBarricade(firstGate.id,firstGate.hp);
assert.equal(qa.state().barriers[0].destroyed,true);
qa.damageShelter(qa.state().shelter.hp);
assert.ok(qa.state().humans.filter(h=>h.kind==="civilian").every(h=>!h.sheltered),"Destroying shelter must expose all civilians");
const target=qa.state().objectiveTarget;
for(const h of qa.state().humans.filter(h=>h.kind==="civilian"))assert.equal(qa.convertHumanForTest(h.id),true);
qa.stepSimulation(1/30);
assert.notEqual(qa.state().endingType,"win","Infected civilians cannot clear a stage while guards remain");
for(const h of qa.state().humans.filter(h=>h.alive))assert.equal(qa.neutralizeHumanForTest(h.id),true);
qa.stepSimulation(1/30);
assert.equal(qa.state().neutralized,target,"All human entities must count toward completion");
assert.equal(qa.state().endingType,"win","Meeting all real siege conditions must end the game in victory");
assert.ok(JSON.parse(window.localStorage.getItem("hunger-protocol-demo-v01")).cleared.pt>=1,"Natural victory must persist progression");
qa.openMainMenu();
assert.equal(menu.hidden,false,"Battle must allow returning to the main menu");
assert.equal(document.getElementById("menu-continue").hidden,false,"Existing save must enable Continue");
assert.equal(document.querySelector("#menu-actions button:not([hidden])").id,"menu-continue","Existing save must prioritize Continue as the default action");
assert.ok(document.getElementById("menu-continue").classList.contains("menu-primary"),"Continue must be the main call-to-action after a save exists");
document.getElementById("menu-settings-open").click();
assert.equal(document.getElementById("menu-settings-page").hidden,false,"Main-menu settings must be functional");
document.querySelector("[data-menu-back]").click();
assert.equal(document.getElementById("menu-settings-page").hidden,true,"Menu back navigation must work");
document.getElementById("menu-continue").click();
assert.equal(menu.hidden,true,"Continue must restart an accessible campaign");
console.log("Smoke test passed: real title screen, blank-horde onboarding, progressive HUD, research purchases, legacy gameplay, full siege victory and returning to menu.");

dom.window.close();
