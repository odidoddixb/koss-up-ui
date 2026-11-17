const assert = require("assert");
const system = require("../modules/golden-time-system.js");
const core = require("../modules/material-core.js");
const ui = require("../modules/material.js");

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

function mountNode() {
  const node = {
    innerHTML: "",
    _listeners: {},
    addEventListener(type, fn) { node._listeners[type] = fn; },
    removeEventListener(type) { delete node._listeners[type]; },
    replaceChildren() { node.innerHTML = ""; },
    querySelector() { return null; },
    contains() { return false; }
  };
  return node;
}

function click(node, dataset) {
  node._listeners.click({ target: { closest: () => ({ dataset, disabled: false }) } });
}

const storage = memoryStorage();
const reports = [];
const session = system.createSession(storage, {
  saveKey: "ui-system",
  rankingKey: "ui-rank",
  stateOptions: { days: 5, startingBudget: 3000 }
});
session.start();
const mount = mountNode();
const material = ui.create({
  mount,
  session,
  system,
  core,
  storage,
  storageKey: "ui-material",
  news: {
    reportDay(day, payload) { reports.push({ day, payload }); },
    getMarket: (day) => core.buildMarket(day, {})
  }
});

assert.ok(mount.innerHTML.includes("복구 자재 선제 비축"));
assert.ok(mount.innerHTML.includes("미평가"));
for (let i = 0; i < 5; i += 1) click(mount, { act: "step", bucket: "buy", id: "steel", dir: "1" });
assert.ok(mount.innerHTML.includes("12 / 12") || mount.innerHTML.includes(">12 / 12<"));
click(mount, { act: "arm" });
assert.ok(mount.innerHTML.includes("한 번 더 누르면"));
click(mount, { act: "confirm" });
assert.ok(mount.innerHTML.includes("오늘 결과 · 성공"));
assert.strictEqual(reports.length, 1);
assert.strictEqual(reports[0].payload.reserve.requiredQuantity, 12);
assert.strictEqual(reports[0].payload.reserve.availableQuantity, 12);
assert.strictEqual(session.getState().budget, 2975);
assert.ok(mount.innerHTML.includes("점"));
assert.ok(!mount.innerHTML.includes("미평가"));

click(mount, { act: "confirm" });
assert.strictEqual(session.getState().history.length, 1);

session.closeDay();
material.refresh();
assert.ok(mount.innerHTML.includes("급등 속 긴급 방출"));
assert.ok(mount.innerHTML.includes("DAY 2"));

material.destroy();
assert.strictEqual(mount.innerHTML, "");

const bridgeLog = [];
const bridgeMount = mountNode();
const bridgeSession = system.createSession(memoryStorage(), {
  saveKey: "bridge-system",
  rankingKey: "bridge-rank",
  stateOptions: { days: 5, startingBudget: 3000 }
});
bridgeSession.start();
const bridged = ui.create({
  mount: bridgeMount,
  session: bridgeSession,
  system,
  core,
  storage: memoryStorage(),
  storageKey: "bridge-material",
  bridge: {
    applyOutcome(outcome) { bridgeLog.push(outcome); },
    reportDay() {}
  },
  news: { getMarket: (day) => core.buildMarket(day, {}) }
});
for (let i = 0; i < 5; i += 1) click(bridgeMount, { act: "step", bucket: "buy", id: "steel", dir: "1" });
click(bridgeMount, { act: "arm" });
click(bridgeMount, { act: "confirm" });
click(bridgeMount, { act: "confirm" });
assert.strictEqual(bridgeLog.length, 1);
assert.strictEqual(bridgeSession.getState().budget, 3000);
assert.strictEqual(core.onHand(bridged.getSave().lots).steel, 9);
assert.ok(bridgeMount.innerHTML.includes("오늘 결과 · 성공"));
assert.ok(!bridgeMount.innerHTML.includes("이 계획으로 확정"));
bridged.destroy();

console.log("material ui ok");
