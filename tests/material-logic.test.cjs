const assert = require("assert");
const system = require("../modules/golden-time-system.js");
const core = require("../modules/material-core.js");

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

function fail(message) {
  throw new Error(message);
}

function show(evaluated) {
  return evaluated.plans.map((plan) => plan.name + ":" + plan.cost).join(", ")
    + " | player " + evaluated.chosenExpectedCost
    + " " + evaluated.marketResponse
    + " avail " + evaluated.sim.available
    + " cost " + evaluated.sim.actualTotalCost
    + (evaluated.errors.length ? " / " + evaluated.errors.join(" ") : "");
}

function play(warehouse, day, draft, reserveByDay, budget) {
  const scenario = core.scenarioFor(day);
  const market = core.buildMarket(day, reserveByDay);
  const evaluated = core.evaluate(system, warehouse, scenario, draft, market, budget);
  return { scenario, market, evaluated };
}

function must(condition, evaluated, label) {
  if (!condition) fail(label + "\n" + show(evaluated));
}

const reserve = {};
let warehouse = core.createWarehouse();
let budget = 3000;
const session = system.createSession(memoryStorage(), {
  saveKey: "material-test",
  rankingKey: "material-test-rank",
  stateOptions: { days: 5, startingBudget: 3000 }
});

const day1 = play(warehouse, 1, { buy: { steel: 5 } }, reserve, budget);
must(day1.evaluated.marketResponse === "success", day1.evaluated, "1일차 철강 5묶음은 성공이어야 해요");
must(day1.evaluated.sim.available === 12, day1.evaluated, "1일차 확보량은 12예요");
must(day1.evaluated.replenishment.plannedPurchaseQuantity === 5, day1.evaluated, "1일차 참고 매입량은 5예요");
assert.strictEqual(day1.market.find((row) => row.id === "steel").unitPrice, 5);

const idle = play(warehouse, 1, {}, reserve, budget);
must(idle.evaluated.marketResponse === "failure", idle.evaluated, "1일차 미매입은 실패예요");

const mixed = play(warehouse, 1, { buy: { steel: 5, fuel: 4 } }, reserve, budget);
must(mixed.evaluated.marketResponse === "failure", mixed.evaluated, "1일차 경유 동반 매입은 실패예요");

const slight = play(warehouse, 1, { buy: { steel: 6 } }, reserve, budget);
must(slight.evaluated.marketResponse === "partial", slight.evaluated, "1일차 1묶음 초과는 부분 성공 허용 범위예요");

const blocked = play(warehouse, 1, { buy: { steel: 40, cement: 40, fuel: 40, lumber: 40 } }, reserve, budget);
must(!blocked.evaluated.ok, blocked.evaluated, "보호 예산을 넘는 매입은 거절해요");

session.applyOutcome(core.buildOutcome(day1.scenario, day1.evaluated));
budget = session.getState().budget;
warehouse = { lots: core.cloneLots(day1.evaluated.sim.lots) };
reserve[1] = day1.evaluated.sim.available / day1.evaluated.sim.required;
assert.strictEqual(budget, 2975);
assert.strictEqual(core.hasSettled(session.getState(), 1), true);

const day2 = play(warehouse, 2, { release: { steel: 5 } }, reserve, budget);
must(day2.evaluated.marketResponse === "success", day2.evaluated, "2일차 보유 철강 방출은 성공이에요");
must(day2.evaluated.sim.available === 5, day2.evaluated, "2일차 확보량은 5예요");
must(day2.evaluated.sim.budgetDelta === 0, day2.evaluated, "2일차 보유분 방출은 예산 변화가 없어요");
assert.strictEqual(day2.evaluated.replenishment.plannedPurchaseQuantity, 0);

const hoard = play(warehouse, 2, {}, reserve, budget);
must(hoard.evaluated.marketResponse === "failure", hoard.evaluated, "2일차 미방출은 실패예요");

const chase = play(warehouse, 2, { buy: { steel: 4 }, release: { steel: 5 } }, reserve, budget);
must(chase.evaluated.marketResponse === "failure", chase.evaluated, "2일차 추가 매입은 실패예요");

session.applyOutcome(core.buildOutcome(day2.scenario, day2.evaluated));
budget = session.getState().budget;
warehouse = { lots: core.cloneLots(day2.evaluated.sim.lots) };
reserve[2] = 1;
assert.strictEqual(core.onHand(warehouse.lots).steel, 4);
assert.strictEqual(core.onHand(warehouse.lots).cement, 4);

const shortFuel = play(warehouse, 3, { release: { fuel: 5 } }, reserve, budget);
must(shortFuel.evaluated.marketResponse === "failure", shortFuel.evaluated, "3일차 경유를 덜 맞추면 실패예요");

const fuel = play(warehouse, 3, { buy: { fuel: 3 }, release: { fuel: 8 } }, reserve, budget);
must(fuel.evaluated.marketResponse === "success", fuel.evaluated, "3일차 경유 부족분 매입은 성공이에요");
must(fuel.evaluated.sim.available === 8, fuel.evaluated, "3일차 확보량은 8이에요");
assert.strictEqual(fuel.evaluated.replenishment.plannedPurchaseQuantity, 3);

const panic = play(warehouse, 3, { buy: { fuel: 3, steel: 6 }, release: { fuel: 8 } }, reserve, budget);
must(panic.evaluated.marketResponse === "failure", panic.evaluated, "3일차 고점 철강 매입은 실패예요");

session.applyOutcome(core.buildOutcome(fuel.scenario, fuel.evaluated));
budget = session.getState().budget;
warehouse = { lots: core.cloneLots(fuel.evaluated.sim.lots) };
reserve[3] = 1;
assert.strictEqual(core.onHand(warehouse.lots).fuel, 0);
assert.strictEqual(core.onHand(warehouse.lots).steel, 4);

const lumberOnly = play(warehouse, 4, { buy: { lumber: 2 }, release: { lumber: 6 } }, reserve, budget);
must(lumberOnly.evaluated.marketResponse === "failure", lumberOnly.evaluated, "4일차 목재만 사는 선택은 조합보다 나빠요");

const crafted = play(warehouse, 4, { craft: { panel: 1 }, release: { lumber: 4 } }, reserve, budget);
must(crafted.evaluated.marketResponse === "success", crafted.evaluated, "4일차 합성 패널 조합은 성공이에요");
must(crafted.evaluated.sim.available === 6, crafted.evaluated, "4일차 확보량은 6이에요");
must(crafted.evaluated.sim.actualTotalCost < 2, crafted.evaluated, "기존 재고 조합의 실제 비용은 조합비 수준이에요");

const fake = play(warehouse, 4, { craft: { "raw-board": 4 } }, reserve, budget);
must(fake.evaluated.ok, fake.evaluated, "미검증 조합은 재고가 있으면 실행돼요");
must(fake.evaluated.sim.available === 0, fake.evaluated, "미검증 조합은 확보량에 들어가지 않아요");
must(fake.evaluated.marketResponse === "failure", fake.evaluated, "미검증 조합만으로는 실패예요");

session.applyOutcome(core.buildOutcome(crafted.scenario, crafted.evaluated));
budget = session.getState().budget;
warehouse = { lots: core.cloneLots(crafted.evaluated.sim.lots) };
reserve[4] = 1;
assert.strictEqual(core.onHand(warehouse.lots).steel, 3);
assert.strictEqual(core.onHand(warehouse.lots).cement, 2);
assert.strictEqual(core.onHand(warehouse.lots).lumber, 0);

const keep = play(warehouse, 5, { release: { steel: 2 } }, reserve, budget);
must(keep.evaluated.marketResponse === "failure", keep.evaluated, "5일차 잔여 재고를 두면 실패예요");

const unwind = play(warehouse, 5, { release: { steel: 2 }, sell: { steel: 1, cement: 2 } }, reserve, budget);
must(unwind.evaluated.marketResponse === "success", unwind.evaluated, "5일차 방출 후 매각은 성공이에요");
must(unwind.evaluated.sim.available === 2, unwind.evaluated, "5일차 확보량은 2예요");
must(unwind.evaluated.sim.budgetDelta > 0, unwind.evaluated, "5일차 매각은 예산을 되돌려요");

session.applyOutcome(core.buildOutcome(unwind.scenario, unwind.evaluated));
const summary = system.summarize(session.getState());
assert.ok(summary.scores.economicDefense >= 90, "경제 방어력 " + summary.scores.economicDefense);
assert.ok(summary.scores.budgetPerformance >= 95, "예산 결산 " + summary.scores.budgetPerformance);
assert.ok(!summary.scoredCategories.includes("integrity"));
assert.ok(summary.budget > 2900, "예산 " + summary.budget);

const reports = session.getState().history.map((entry) => entry.details.eventId);
assert.deepStrictEqual(reports, ["reserve-day-1", "reserve-day-2", "reserve-day-3", "reserve-day-4", "reserve-day-5"]);

const missed = core.buildMarket(2, { 1: 0 });
const met = core.buildMarket(2, { 1: 1 });
const almost = core.buildMarket(2, { 1: 11 / 12 });
assert.strictEqual(missed.find((row) => row.id === "steel").index, 124);
assert.strictEqual(met.find((row) => row.id === "steel").index, 118);
assert.strictEqual(almost.find((row) => row.id === "steel").index, 119);
assert.strictEqual(missed.find((row) => row.id === "cement").index, 131);
assert.strictEqual(missed.find((row) => row.id === "fuel").index, 110);

const fresh = core.createWarehouse();
const gapDay = play(fresh, 2, core.coverDraft(fresh, core.scenarioFor(2)), {}, 3000);
must(gapDay.evaluated.marketResponse === "success", gapDay.evaluated, "1일차를 비워도 2일차 필요량만 맞추면 성공이에요");

for (let day = 1; day <= 5; day += 1) session.closeDay();
assert.strictEqual(session.getState().finished, true);

const again = system.createState();
assert.strictEqual(core.hasSettled(again, 1), false);

const piled = core.createWarehouse();
piled.lots.push({ materialId: "cement", qty: 40, unitCost: 4, day: 1 });
const day5 = core.scenarioFor(5);
const market5 = core.buildMarket(5, {});
const capped = core.sellDraft(piled, day5);
assert.strictEqual(capped.sell.cement, 40);
const kept = core.evaluate(system, piled, day5, { release: { steel: 2 } }, market5, 3000);
must(kept.marketResponse === "failure", kept, "40을 넘는 재고를 그대로 두면 실패예요");
const cleared = core.evaluate(system, piled, day5, capped, market5, 3000);
must(cleared.marketResponse === "success", cleared, "한도만큼 매각하면 성공이에요");

console.log("material logic ok", {
  economicDefense: summary.scores.economicDefense,
  budgetPerformance: summary.scores.budgetPerformance,
  budget: session.getState().budget,
  finalScore: system.summarize(session.getState()).finalScore
});
