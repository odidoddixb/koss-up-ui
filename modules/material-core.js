/*
 * 3번 원자재 비축·조합 로직
 * 재고·시황·대체 조합은 이 모듈이 들고, 6번에는 시황 1건당 economicDecision 한 번만 넘긴다.
 * 점수는 직접 계산하지 않고 calculateExpectedPlanCost / classifyMarketResponse 결과에 맡긴다.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoldenTimeMaterialCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DAYS = 5;
  const SELL_RATE = 0.7;
  const MAX_QTY = 40;
  const BASE_HOLDING = 12;
  const STORAGE_KEY = "goldentime-material-v1";

  const MATERIALS = [
    { id: "steel", label: "철강", icon: "🔩", unit: "묶음", base: 5 },
    { id: "cement", label: "시멘트", icon: "🧱", unit: "묶음", base: 4 },
    { id: "fuel", label: "경유", icon: "⛽", unit: "묶음", base: 3 },
    { id: "lumber", label: "목재", icon: "🪵", unit: "묶음", base: 4 }
  ];
  const IDS = MATERIALS.map((m) => m.id);
  const MATERIAL = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));

  // 5번 아침 시황과 같은 지수. 1일차 = 100.
  const PRICE_INDEX = {
    1: { steel: 100, cement: 100, fuel: 100, lumber: 100 },
    2: { steel: 118, cement: 125, fuel: 110, lumber: 105 },
    3: { steel: 131, cement: 138, fuel: 128, lumber: 112 },
    4: { steel: 127, cement: 130, fuel: 115, lumber: 134 },
    5: { steel: 112, cement: 115, fuel: 104, lumber: 120 }
  };

  const START = { steel: 4, cement: 4, fuel: 5, lumber: 4 };

  const PANEL = {
    id: "panel",
    label: "합성 패널",
    certified: true,
    inputs: { steel: 1, cement: 2 },
    outputEq: 2,
    fee: 1.2,
    note: "난연·규격 시험을 통과한 임시주거 벽체예요. 만들면 바로 현장에 들어가요."
  };
  const RAW_BOARD = {
    id: "raw-board",
    label: "미검증 압축 각재",
    certified: false,
    inputs: { lumber: 1 },
    outputEq: 2,
    fee: 0.2,
    note: "단가는 낮지만 시험 성적서가 없어요. 확보량으로 환산되지 않아요."
  };

  const SCENARIOS = {
    1: {
      day: 1,
      id: "reserve-day-1",
      title: "복구 자재 선제 비축",
      phase: "지진 전",
      objective: "stock",
      focus: "steel",
      requiredQuantity: 12,
      allocatedBudget: 40,
      equivalents: { steel: 1, cement: 0.75 },
      releaseOrder: ["steel", "cement"],
      recipes: [],
      forecastDailyDemand: 5,
      leadTimeDays: 1,
      safetyStock: 4,
      committedQuantity: 0,
      shortageProbability: 0.85,
      shortageImpactPerUnit: 18,
      forecastUnitPrice: 6.2,
      freshObsolescenceRate: 0.2,
      offFocusObsolescenceRate: 0.5,
      carryObsolescenceRate: 0,
      holdingRate: 0.02,
      suggestSell: false,
      briefing: "지진 위험이 커졌지만 철강·시멘트는 아직 평시 가격이에요. 오늘은 현장에 빼는 날이 아니라, 복구에 쓸 자재를 창고에 채우는 날이에요.",
      clues: [
        "재난이 나면 복구 자재부터 값이 오르는 경우가 많아요.",
        "시멘트 1묶음은 철강 0.75묶음으로 환산돼요.",
        "경유와 목재는 오늘 필요량에 포함되지 않아요."
      ],
      failHint: "평시 가격에 필요 환산량을 맞추지 못했거나, 오늘 환산되지 않는 자재·초과 매입이 비용을 키웠어요.",
      calculatorNote: "참고 매입량은 철강만 계산해요. 시멘트 재고는 0.75로 이미 필요량에 포함돼요."
    },
    2: {
      day: 2,
      id: "reserve-day-2",
      title: "급등 속 긴급 방출",
      phase: "지진 직후",
      objective: "deploy",
      focus: "steel",
      requiredQuantity: 5,
      allocatedBudget: 20,
      equivalents: { steel: 1, cement: 0.75 },
      releaseOrder: ["steel", "cement"],
      recipes: [],
      forecastDailyDemand: 3,
      leadTimeDays: 1,
      safetyStock: 3,
      committedQuantity: 0,
      shortageProbability: 0.8,
      shortageImpactPerUnit: 16,
      forecastUnitPrice: 6.8,
      freshObsolescenceRate: 0.35,
      offFocusObsolescenceRate: 0.4,
      carryObsolescenceRate: 0,
      holdingRate: 0.02,
      suggestSell: false,
      briefing: "밤사이 지진으로 보급로가 끊겼어요. 철강·시멘트가 올랐고 내일은 더 오를 수 있어요. 창고에 있는 자재를 방출해야 오늘 확보량으로 계산돼요.",
      clues: [
        "재고를 들고만 있으면 현장 확보량에 들어가지 않아요.",
        "오늘 새로 사는 물량은 이미 오른 가격이에요.",
        "필요량만 방출해도 충족이에요. 시멘트는 다음 날을 위해 남겨 둘 수 있어요."
      ],
      failHint: "창고를 열지 않아 현장이 비었거나, 이미 오른 가격에 필요 이상으로 샀어요.",
      calculatorNote: "계산기는 오늘 단가만 봐요. 이미 오른 가격을 더 살지는 직접 판단해요."
    },
    3: {
      day: 3,
      id: "reserve-day-3",
      title: "고점의 경유",
      phase: "여진",
      objective: "deploy",
      focus: "fuel",
      requiredQuantity: 8,
      allocatedBudget: 22,
      equivalents: { fuel: 1 },
      releaseOrder: ["fuel"],
      recipes: [],
      forecastDailyDemand: 5,
      leadTimeDays: 1,
      safetyStock: 3,
      committedQuantity: 0,
      shortageProbability: 0.75,
      shortageImpactPerUnit: 12,
      forecastUnitPrice: 3.2,
      forwardStock: { lumber: 2 },
      forwardStockNote: "4일차 목재 가격 상승을 대비해, 현재 재고를 뺀 부족분 최대 2묶음까지 선매입할 수 있어요.",
      freshObsolescenceRate: 0.25,
      offFocusObsolescenceRate: 0.7,
      carryObsolescenceRate: 0,
      holdingRate: 0.02,
      suggestSell: false,
      briefing: "여진으로 수송이 급해요. 경유는 크게 올랐지만 수입 물량은 5일차에 들어와요. 철강·시멘트는 오늘이 고점일 수 있지만, 목재는 4일차 가격 상승이 예상돼요.",
      clues: [
        "오늘 필요량은 경유예요. 철강·시멘트·목재를 사도 경유 확보량에는 들어가지 않아요.",
        "가진 경유를 먼저 방출하고, 부족한 묶음만 사는 편이 위험 비용이 낮아요.",
        "철강·시멘트는 고점 매입을 피하고, 4일차 목재는 필요량 부족분 최대 2묶음까지 미리 살 수 있어요."
      ],
      failHint: "경유 부족을 그대로 뒀거나, 목재 선매입 2묶음을 넘기거나, 고점인 철강·시멘트를 불필요하게 샀어요.",
      calculatorNote: "오늘 확보량은 경유만 계산해요. 단, 목재 부족분 최대 2묶음은 4일차 준비로 인정돼요."
    },
    4: {
      day: 4,
      id: "reserve-day-4",
      title: "임시주거와 대체 조합",
      phase: "임시주거",
      objective: "deploy",
      focus: "lumber",
      requiredQuantity: 6,
      allocatedBudget: 15,
      equivalents: { lumber: 1 },
      releaseOrder: ["lumber"],
      recipes: [PANEL, RAW_BOARD],
      forecastDailyDemand: 4,
      leadTimeDays: 1,
      safetyStock: 2,
      committedQuantity: 0,
      shortageProbability: 0.7,
      shortageImpactPerUnit: 14,
      forecastUnitPrice: 5.5,
      freshObsolescenceRate: 0.2,
      offFocusObsolescenceRate: 0.35,
      carryObsolescenceRate: 0,
      holdingRate: 0.02,
      suggestSell: false,
      briefing: "임시주거를 지어야 해서 목재가 품귀예요. 규격 시험을 통과한 합성 패널은 목재로 환산되고, 시험 전 압축 각재는 환산되지 않아요.",
      clues: [
        "합성 패널 1회: 철강 1 + 시멘트 2 → 목재 2묶음으로 환산, 조합비 1.2억. 바로 현장에 투입돼요.",
        "조달 계산기는 대체 조합을 모르기 때문에 목재 매입만 제안할 수 있어요.",
        "미검증 압축 각재는 목재를 소모하지만 확보량에 들어가지 않아요."
      ],
      failHint: "환산되는 조합이나 목재로 필요량을 맞추지 못했거나, 미검증 자재에 물량을 썼어요.",
      calculatorNote: "이 숫자는 목재를 그대로 사는 경우예요. 합성 패널은 포함하지 않아요."
    },
    5: {
      day: 5,
      id: "reserve-day-5",
      title: "수입 입항과 재고 정리",
      phase: "수습",
      objective: "deploy",
      focus: "steel",
      requiredQuantity: 2,
      allocatedBudget: 10,
      equivalents: { steel: 1, cement: 1, lumber: 1, fuel: 0.5 },
      releaseOrder: ["steel", "cement", "lumber", "fuel"],
      recipes: [],
      forecastDailyDemand: 1,
      leadTimeDays: 1,
      safetyStock: 1,
      committedQuantity: 0,
      shortageProbability: 0.65,
      shortageImpactPerUnit: 10,
      forecastUnitPrice: 5.4,
      freshObsolescenceRate: 0.45,
      offFocusObsolescenceRate: 0.5,
      carryObsolescenceRate: 0.6,
      holdingRate: 0.02,
      suggestSell: true,
      briefing: "수입 자재가 들어오며 가격이 내려가요. 오늘 필요량은 크지 않고, 남는 재고는 예산 부담으로 남아요. 매각은 오늘 시세의 70%예요.",
      clues: [
        "가진 자재로 필요량을 방출할 수 있는지 먼저 확인해요.",
        "하락장에서 더 사면 게임 종료 후 남는 재고가 돼요.",
        "필요량을 남긴 뒤 나머지를 매각하면 예산이 돌아와요."
      ],
      failHint: "필요량을 방출하지 않았거나, 하락장에 더 샀거나, 남는 재고를 그대로 뒀어요.",
      calculatorNote: "계산기는 매각을 모르니, 남는 재고는 따로 정리해요."
    }
  };

  const mny = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function emptyQty() {
    return { steel: 0, cement: 0, fuel: 0, lumber: 0 };
  }

  function emptyDraft() {
    return { buy: emptyQty(), release: emptyQty(), sell: emptyQty(), craft: {} };
  }

  function createWarehouse() {
    return {
      lots: MATERIALS.filter((m) => START[m.id] > 0).map((m) => ({
        materialId: m.id,
        qty: START[m.id],
        unitCost: m.base,
        day: 0
      }))
    };
  }

  function cloneLots(lots) {
    return (lots || []).map((lot) => ({
      materialId: lot.materialId,
      qty: lot.qty,
      unitCost: lot.unitCost,
      day: lot.day
    }));
  }

  function onHand(lots) {
    const hand = emptyQty();
    (lots || []).forEach((lot) => {
      hand[lot.materialId] = mny((hand[lot.materialId] || 0) + lot.qty);
    });
    return hand;
  }

  function qtyOf(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    const q = mny(n);
    if (Math.abs(q - Math.round(q)) > 0.001) return null;
    if (q > MAX_QTY) return null;
    return q;
  }

  function normalizeDraft(draft) {
    const next = emptyDraft();
    const errors = [];
    IDS.forEach((id) => {
      ["buy", "release", "sell"].forEach((key) => {
        const raw = draft && draft[key] ? draft[key][id] : 0;
        if (raw === undefined || raw === null || raw === "") {
          next[key][id] = 0;
          return;
        }
        const q = qtyOf(raw);
        if (q === null) errors.push(MATERIAL[id].label + " 수량은 0부터 " + MAX_QTY + "까지의 정수예요.");
        else next[key][id] = q;
      });
    });
    const craft = (draft && draft.craft) || {};
    Object.keys(craft).forEach((id) => {
      const raw = craft[id];
      if (raw === undefined || raw === null || raw === "" || Number(raw) === 0) return;
      const q = qtyOf(raw);
      if (q === null) errors.push("조합 횟수는 0부터 " + MAX_QTY + "까지의 정수예요.");
      else next.craft[id] = q;
    });
    return { draft: next, errors };
  }

  function consume(lots, materialId, qty, day) {
    let need = mny(qty);
    let todayBasis = 0;
    const next = [];
    lots.forEach((lot) => {
      if (lot.materialId !== materialId || need <= 0) {
        next.push(lot);
        return;
      }
      const take = Math.min(lot.qty, need);
      if (lot.day === day) todayBasis = mny(todayBasis + take * lot.unitCost);
      need = mny(need - take);
      const left = mny(lot.qty - take);
      if (left > 0) next.push({ materialId: lot.materialId, qty: left, unitCost: lot.unitCost, day: lot.day });
    });
    return { ok: need <= 0.001, lots: next, todayBasis: mny(todayBasis) };
  }

  function penaltyFor(day, reserveByDay) {
    if (day <= 1) return 0;
    const prev = reserveByDay && reserveByDay[day - 1];
    if (prev == null || !Number.isFinite(Number(prev))) return 0;
    return Math.round((1 - clamp(Number(prev), 0, 1)) * 6);
  }

  function buildMarket(day, reserveByDay) {
    const safeDay = clamp(day, 1, DAYS);
    return MATERIALS.map((mat) => {
      const history = [];
      for (let d = 1; d <= safeDay; d += 1) {
        const pen = mat.id === "steel" || mat.id === "cement" ? penaltyFor(d, reserveByDay) : 0;
        history.push(PRICE_INDEX[d][mat.id] + pen);
      }
      const index = history[history.length - 1];
      const prev = history.length > 1 ? history[history.length - 2] : index;
      return {
        id: mat.id,
        label: mat.label,
        icon: mat.icon,
        unit: mat.unit,
        index,
        change: safeDay === 1 ? 0 : index - prev,
        history,
        unitPrice: mny(mat.base * index / 100)
      };
    });
  }

  function pricesOf(rows) {
    const prices = {};
    rows.forEach((row) => {
      prices[row.id] = mny(row.unitPrice != null ? row.unitPrice : MATERIAL[row.id].base * row.index / 100);
    });
    return prices;
  }

  function certifiedEq(lots, equivalents) {
    const hand = onHand(lots);
    let eq = 0;
    IDS.forEach((id) => { eq += (hand[id] || 0) * (equivalents[id] || 0); });
    return mny(eq);
  }

  function endValueOf(lots, prices) {
    let value = 0;
    lots.forEach((lot) => { value += lot.qty * (prices[lot.materialId] || 0); });
    return mny(value);
  }

  function simulate(warehouse, scenario, rawDraft, market, budget, protectedBudget) {
    const cleaned = normalizeDraft(rawDraft);
    const errors = cleaned.errors.slice();
    const draft = cleaned.draft;
    const day = scenario.day;
    const prices = pricesOf(market);
    const equivalents = scenario.equivalents || {};
    let lots = cloneLots(warehouse.lots);
    let buyCash = 0;
    let sellProceeds = 0;
    let fees = 0;
    let deployedEq = 0;
    let certifiedReleaseTodayBasis = 0;
    let certifiedCraftTodayBasis = 0;
    let uncertifiedInputTodayBasis = 0;
    let productiveNonEqFreshBasis = 0;
    let craftFees = 0;

    if (!errors.length) {
      IDS.forEach((id) => {
        const q = draft.buy[id];
        if (q > 0) {
          lots.push({ materialId: id, qty: q, unitCost: prices[id], day });
          buyCash = mny(buyCash + q * prices[id]);
        }
      });

      scenario.recipes.forEach((recipe) => {
        const n = draft.craft[recipe.id] || 0;
        if (n <= 0) return;
        let basis = 0;
        let nonEqBasis = 0;
        let cursor = lots;
        const inputs = Object.entries(recipe.inputs);
        for (let i = 0; i < inputs.length; i += 1) {
          const id = inputs[i][0];
          const per = inputs[i][1];
          const eaten = consume(cursor, id, n * per, day);
          if (!eaten.ok) {
            errors.push(recipe.label + "에 필요한 " + MATERIAL[id].label + "이 부족해요.");
            return;
          }
          basis = mny(basis + eaten.todayBasis);
          if (!equivalents[id]) nonEqBasis = mny(nonEqBasis + eaten.todayBasis);
          cursor = eaten.lots;
        }
        if (errors.length) return;
        lots = cursor;
        const fee = mny(n * recipe.fee);
        fees = mny(fees + fee);
        craftFees = mny(craftFees + fee);
        if (recipe.certified) {
          deployedEq = mny(deployedEq + n * recipe.outputEq);
          certifiedCraftTodayBasis = mny(certifiedCraftTodayBasis + basis);
          productiveNonEqFreshBasis = mny(productiveNonEqFreshBasis + nonEqBasis);
        } else {
          uncertifiedInputTodayBasis = mny(uncertifiedInputTodayBasis + basis);
        }
      });
    }

    if (!errors.length) {
      IDS.forEach((id) => {
        const rel = draft.release[id];
        const sel = draft.sell[id];
        if (rel + sel <= 0) return;
        const have = onHand(lots)[id] || 0;
        if (rel + sel > have + 0.001) {
          errors.push(MATERIAL[id].label + " 재고가 부족해요. 보유 " + have + "묶음, 요청 " + (rel + sel) + "묶음이에요.");
          return;
        }
        if (rel > 0) {
          const eaten = consume(lots, id, rel, day);
          lots = eaten.lots;
          if (equivalents[id]) {
            deployedEq = mny(deployedEq + rel * equivalents[id]);
            certifiedReleaseTodayBasis = mny(certifiedReleaseTodayBasis + eaten.todayBasis);
          }
        }
        if (sel > 0) {
          const eaten = consume(lots, id, sel, day);
          lots = eaten.lots;
          sellProceeds = mny(sellProceeds + mny(sel * prices[id] * SELL_RATE));
        }
      });
    }

    const budgetDelta = mny(sellProceeds - buyCash - fees);
    const endBudget = mny((budget || 0) + budgetDelta);
    if (!errors.length && endBudget < -0.001) errors.push("예산이 부족해요.");
    if (!errors.length && protectedBudget > 0 && endBudget < protectedBudget - 0.001) {
      errors.push("보호 예산 " + protectedBudget + "억 원은 다른 업무를 위해 남겨 둬야 해요. 매입 후 잔액이 " + endBudget + "억 원이에요.");
    }

    const hand = onHand(lots);
    let oldEq = 0;
    let freshEq = 0;
    let freshCertifiedValue = 0;
    lots.forEach((lot) => {
      const ratio = equivalents[lot.materialId] || 0;
      if (!ratio) return;
      const eq = lot.qty * ratio;
      if (lot.day === day) {
        freshEq += eq;
        freshCertifiedValue += lot.qty * lot.unitCost;
      } else oldEq += eq;
    });
    oldEq = mny(oldEq);
    freshEq = mny(freshEq);
    freshCertifiedValue = mny(freshCertifiedValue);
    const endEq = mny(oldEq + freshEq);
    const available = mny(scenario.objective === "stock" ? endEq : deployedEq);
    const required = scenario.requiredQuantity;
    const shortage = mny(Math.max(0, required - available));

    let freshCoverEq = 0;
    if (scenario.objective === "stock") {
      const covered = Math.min(available, required);
      freshCoverEq = mny(Math.min(freshEq, Math.max(0, covered - Math.min(oldEq, required))));
    }
    let freshCoverValue = 0;
    let freshSurplusValue = 0;
    let coverLeft = freshCoverEq;
    lots.forEach((lot) => {
      if (lot.day !== day) return;
      const ratio = equivalents[lot.materialId] || 0;
      if (!ratio) return;
      const eq = lot.qty * ratio;
      const useEq = Math.min(eq, Math.max(0, coverLeft));
      const useQty = useEq / ratio;
      freshCoverValue = mny(freshCoverValue + useQty * lot.unitCost);
      freshSurplusValue = mny(freshSurplusValue + Math.max(0, lot.qty - useQty) * lot.unitCost);
      coverLeft = mny(coverLeft - useEq);
    });

    let nonEqBuy = 0;
    IDS.forEach((id) => {
      if (equivalents[id]) return;
      nonEqBuy = mny(nonEqBuy + draft.buy[id] * prices[id]);
    });
    const forwardStock = scenario.forwardStock || {};
    const initialHand = onHand(warehouse.lots);
    const forwardStockCredit = IDS.reduce((total, id) => {
      const futureNeed = SCENARIOS[day + 1]?.requiredQuantity || 0;
      const gap = Math.max(0, futureNeed - (initialHand[id] || 0));
      const eligible = Math.min(draft.buy[id], forwardStock[id] || 0, gap);
      return mny(total + eligible * prices[id]);
    }, 0);
    const offFocusSpend = mny(Math.max(0, nonEqBuy - productiveNonEqFreshBasis - forwardStockCredit));
    const warehouseValue = endValueOf(lots, prices);
    const obsolescence = mny(
      freshSurplusValue * scenario.freshObsolescenceRate
      + offFocusSpend * scenario.offFocusObsolescenceRate
      + warehouseValue * scenario.carryObsolescenceRate
    );
    const variableHolding = mny(scenario.holdingRate * (freshSurplusValue + offFocusSpend));
    const holdingCost = mny(BASE_HOLDING + variableHolding);
    const acquisitionCost = mny(buyCash + fees + shortage * scenario.forecastUnitPrice);
    const actualTotalCost = mny(
      (scenario.objective === "stock" ? freshCoverValue : mny(certifiedReleaseTodayBasis + certifiedCraftTodayBasis))
      + freshSurplusValue
      + offFocusSpend
      + craftFees
      + uncertifiedInputTodayBasis
      + variableHolding
    );

    return {
      ok: errors.length === 0,
      errors,
      draft,
      lots,
      onHand: hand,
      available,
      required,
      shortage,
      buyCash,
      sellProceeds,
      fees,
      budgetDelta,
      endBudget,
      actualTotalCost,
      acquisitionCost,
      holdingCost,
      obsolescenceCost: obsolescence,
      forwardStockCost: forwardStockCredit,
      warehouseValue,
      prices
    };
  }

  function expectedCost(system, sim, scenario) {
    return mny(system.calculateExpectedPlanCost({
      acquisitionCost: Math.max(0, sim.acquisitionCost - (sim.forwardStockCost || 0)),
      holdingCost: sim.holdingCost,
      shortageQuantity: sim.shortage,
      shortageProbability: sim.shortage > 0 ? scenario.shortageProbability : 0,
      shortageImpactPerUnit: scenario.shortageImpactPerUnit,
      obsolescenceCost: sim.obsolescenceCost
    }));
  }

  function protectedBudgetOf(day, budget) {
    const table = { 1: 2700, 2: 2500, 3: 2300, 4: 2000, 5: 1600 };
    const cash = mny(budget || 0);
    if (cash <= 50) return 0;
    return Math.min(table[day] || 0, mny(cash - 50));
  }

  function takeUnits(have, ratio, need) {
    if (need <= 0.001 || ratio <= 0 || have <= 0) return 0;
    return Math.min(have, Math.ceil(need / ratio - 1e-9));
  }

  function coverDraft(warehouse, scenario) {
    const draft = emptyDraft();
    const equivalents = scenario.equivalents || {};
    const hand = onHand(warehouse.lots);
    if (scenario.objective === "stock") {
      const gap = Math.max(0, scenario.requiredQuantity - certifiedEq(warehouse.lots, equivalents));
      const ratio = equivalents[scenario.focus] || 1;
      draft.buy[scenario.focus] = takeUnits(MAX_QTY, ratio, gap);
      return draft;
    }

    let craftEq = 0;
    if (scenario.recipes.some((recipe) => recipe.certified)) {
      scenario.recipes.filter((recipe) => recipe.certified).forEach((recipe) => {
        const lumberRatio = equivalents.lumber || 0;
        const lumberEq = (hand.lumber || 0) * lumberRatio;
        let gap = scenario.requiredQuantity - lumberEq - craftEq;
        if (gap <= 0.001) return;
        let possible = MAX_QTY;
        Object.entries(recipe.inputs).forEach(([id, per]) => {
          possible = Math.min(possible, Math.floor((hand[id] || 0) / per));
        });
        const n = Math.min(possible, Math.ceil(gap / recipe.outputEq - 1e-9));
        if (n > 0) {
          draft.craft[recipe.id] = n;
          craftEq += n * recipe.outputEq;
          Object.entries(recipe.inputs).forEach(([id, per]) => { hand[id] = mny(hand[id] - n * per); });
        }
      });
    }

    let stockEq = craftEq;
    IDS.forEach((id) => { stockEq += (hand[id] || 0) * (equivalents[id] || 0); });
    const gap = Math.max(0, scenario.requiredQuantity - stockEq);
    const focusRatio = equivalents[scenario.focus] || 0;
    if (gap > 0.001 && focusRatio > 0) {
      const buy = takeUnits(MAX_QTY, focusRatio, gap);
      draft.buy[scenario.focus] = buy;
      hand[scenario.focus] = mny((hand[scenario.focus] || 0) + buy);
    }

    let need = scenario.requiredQuantity - craftEq;
    scenario.releaseOrder.forEach((id) => {
      const ratio = equivalents[id] || 0;
      const take = takeUnits(hand[id] || 0, ratio, need);
      if (take > 0) {
        draft.release[id] = take;
        hand[id] = mny(hand[id] - take);
        need = mny(need - take * ratio);
      }
    });
    return draft;
  }

  function holdDraft(warehouse, scenario) {
    const draft = emptyDraft();
    if (scenario.objective === "stock") return draft;
    const hand = onHand(warehouse.lots);
    let need = scenario.requiredQuantity;
    scenario.releaseOrder.forEach((id) => {
      const ratio = scenario.equivalents[id] || 0;
      const take = takeUnits(hand[id] || 0, ratio, need);
      if (take > 0) {
        draft.release[id] = take;
        hand[id] -= take;
        need = mny(need - take * ratio);
      }
    });
    return draft;
  }

  function sellDraft(warehouse, scenario) {
    const draft = coverDraft(warehouse, scenario);
    const hand = onHand(warehouse.lots);
    IDS.forEach((id) => { hand[id] = mny(hand[id] + (draft.buy[id] || 0)); });
    scenario.recipes.forEach((recipe) => {
      const n = draft.craft[recipe.id] || 0;
      Object.entries(recipe.inputs).forEach(([id, per]) => {
        hand[id] = mny((hand[id] || 0) - n * per);
      });
    });
    IDS.forEach((id) => {
      hand[id] = mny((hand[id] || 0) - (draft.release[id] || 0));
      if (hand[id] > 0) draft.sell[id] = Math.min(MAX_QTY, hand[id]);
    });
    return draft;
  }

  function replenishmentFor(system, warehouse, scenario, market, budget, protectedBudget) {
    const prices = pricesOf(market);
    return system.calculateReplenishmentPlan({
      forecastDailyDemand: scenario.forecastDailyDemand,
      leadTimeDays: scenario.leadTimeDays,
      safetyStock: scenario.safetyStock,
      onHand: onHand(warehouse.lots)[scenario.focus] || 0,
      onOrder: 0,
      committedQuantity: scenario.committedQuantity || 0,
      budget: budget || 0,
      protectedBudget: protectedBudget || 0,
      unitCost: prices[scenario.focus]
    });
  }

  function evaluate(system, warehouse, scenario, rawDraft, market, budget) {
    const protectedBudget = protectedBudgetOf(scenario.day, budget);
    const sim = simulate(warehouse, scenario, rawDraft, market, budget, protectedBudget);
    const named = [
      ["채우기", coverDraft(warehouse, scenario)],
      ["보유", holdDraft(warehouse, scenario)]
    ];
    if (scenario.suggestSell) named.push(["매각", sellDraft(warehouse, scenario)]);
    if (scenario.forwardStock) {
      const prepared = coverDraft(warehouse, scenario);
      const hand = onHand(warehouse.lots);
      IDS.forEach((id) => {
        const futureNeed = SCENARIOS[scenario.day + 1]?.requiredQuantity || 0;
        const alreadyUseful = Math.min(hand[id] || 0, futureNeed);
        prepared.buy[id] = Math.max(prepared.buy[id] || 0,
          Math.min(scenario.forwardStock[id] || 0, Math.max(0, futureNeed - alreadyUseful)));
      });
      named.push(["preparation", prepared]);
    }
    const plans = named.map(([name, draft]) => {
      const planSim = simulate(warehouse, scenario, draft, market, budget, protectedBudget);
      return {
        name,
        draft,
        ok: planSim.ok,
        cost: planSim.ok ? expectedCost(system, planSim, scenario) : null,
        available: planSim.available
      };
    }).filter((plan) => plan.ok);
    const playerCost = sim.ok ? expectedCost(system, sim, scenario) : null;
    const best = plans.reduce((min, plan) => Math.min(min, plan.cost), Infinity);
    const response = sim.ok && Number.isFinite(best)
      ? system.classifyMarketResponse(playerCost, best)
      : null;
    return {
      ok: sim.ok,
      errors: sim.errors,
      sim,
      plans,
      chosenExpectedCost: playerCost,
      bestFeasibleExpectedCost: Number.isFinite(best) ? mny(best) : null,
      marketResponse: response,
      protectedBudget,
      replenishment: replenishmentFor(system, warehouse, scenario, market, budget, protectedBudget)
    };
  }

  function fulfillmentOf(available, required) {
    if (required === 0) return 1;
    return mny(clamp(available / required, 0, 1) * 100) / 100;
  }

  function buildOutcome(scenario, evaluated) {
    const sim = evaluated.sim;
    const fulfillment = fulfillmentOf(sim.available, sim.required);
    return {
      source: "material-reserves",
      label: scenario.title,
      budgetDelta: sim.budgetDelta,
      economicDecision: {
        requiredQuantity: sim.required,
        availableQuantity: Math.max(0, sim.available),
        referenceUnitCost: sim.prices[scenario.focus],
        actualTotalCost: Math.max(0, sim.actualTotalCost),
        chosenExpectedCost: evaluated.chosenExpectedCost,
        bestFeasibleExpectedCost: evaluated.bestFeasibleExpectedCost
      },
      budgetAssessment: {
        allocatedBudget: scenario.allocatedBudget,
        actualCost: Math.max(0, mny(sim.buyCash + sim.fees - sim.sellProceeds)),
        fulfillment
      },
      details: {
        eventId: scenario.id,
        day: scenario.day,
        objective: scenario.objective,
        draft: sim.draft,
        inventoryAfter: sim.onHand,
        marketResponse: evaluated.marketResponse,
        reserveQ: fulfillment
      }
    };
  }

  function hasSettled(state, day) {
    const id = "reserve-day-" + day;
    return (state.history || []).some((entry) => entry.source === "material-reserves" && entry.details && entry.details.eventId === id);
  }

  function scenarioFor(day) {
    return SCENARIOS[clamp(day, 1, DAYS)];
  }

  return Object.freeze({
    DAYS,
    SELL_RATE,
    MAX_QTY,
    BASE_HOLDING,
    STORAGE_KEY,
    MATERIALS,
    IDS,
    MATERIAL,
    PRICE_INDEX,
    START,
    SCENARIOS,
    PANEL,
    RAW_BOARD,
    mny,
    emptyDraft,
    createWarehouse,
    cloneLots,
    onHand,
    normalizeDraft,
    buildMarket,
    pricesOf,
    protectedBudgetOf,
    certifiedEq,
    simulate,
    expectedCost,
    coverDraft,
    holdDraft,
    sellDraft,
    replenishmentFor,
    evaluate,
    fulfillmentOf,
    buildOutcome,
    hasSettled,
    scenarioFor
  });
});
