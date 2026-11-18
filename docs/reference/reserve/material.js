/*
 * 3번 원자재 비축·조합 화면
 * 재고는 이 모듈이 저장하고, 확정 때 6번 applyOutcome과 5번 reportDay를 한 번씩 호출한다.
 * 날짜를 넘기거나 closeDay는 호출하지 않는다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GoldenTimeMaterial = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const RESPONSE = { success: "성공", partial: "부분 성공", failure: "실패" };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function clampRatio(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function money(core, value) {
    const n = core.mny(value || 0);
    const digits = Number.isInteger(n) ? 0 : 2;
    return n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: 2 });
  }

  function signed(core, value) {
    const n = core.mny(value || 0);
    return (n > 0 ? "+" : "") + money(core, n);
  }

  function spark(history) {
    if (!history || history.length < 2) return "";
    const min = Math.min.apply(null, history) - 6;
    const max = Math.max.apply(null, history) + 6;
    const width = 88;
    const height = 32;
    const pad = 4;
    const pts = history.map((value, index) => {
      const x = pad + (index * (width - pad * 2)) / (history.length - 1);
      const y = pad + (1 - (value - min) / (max - min || 1)) * (height - pad * 2);
      return [x, y];
    });
    const last = pts[pts.length - 1];
    const rising = history[history.length - 1] > history[0];
    const color = rising ? "#9d2c2c" : "#1d6b45";
    const d = pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L");
    return '<svg class="mat-spark" viewBox="0 0 ' + width + " " + height + '" aria-hidden="true"><path d="M' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.5" fill="' + color + '"/></svg>';
  }

  function blankSave(core) {
    return { version: 1, lots: core.createWarehouse().lots, settled: {}, draft: null, draftDay: null };
  }

  function readSave(storage, key, core) {
    try {
      const raw = JSON.parse(storage.getItem(key) || "null");
      if (!raw || raw.version !== 1 || !Array.isArray(raw.lots)) return blankSave(core);
      raw.settled = raw.settled || {};
      return raw;
    } catch (error) {
      return blankSave(core);
    }
  }

  function lotsFromHand(hand) {
    return Object.keys(hand || {}).filter((id) => hand[id] > 0).map((id) => ({
      materialId: id,
      qty: hand[id],
      unitCost: 0,
      day: 0
    }));
  }

  function materialEntries(state) {
    return (state.history || []).filter((entry) => entry.source === "material-reserves" && entry.details && entry.details.eventId);
  }

  function create(options) {
    const core = options.core || (typeof GoldenTimeMaterialCore !== "undefined" ? GoldenTimeMaterialCore : null);
    const system = options.system || (typeof GoldenTimeSystem !== "undefined" ? GoldenTimeSystem : null);
    if (!core || !system) throw new Error("자재 모듈에는 로직과 게임 시스템이 필요해요.");
    if (!options.session || !options.mount) throw new Error("session과 mount가 필요해요.");

    const session = options.session;
    const mount = options.mount;
    const news = options.news || null;
    const bridge = options.bridge || null;
    const storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const storageKey = options.storageKey || (options.demo ? "goldentime-material-demo-v1" : core.STORAGE_KEY);
    let save = storage ? readSave(storage, storageKey, core) : blankSave(core);
    let armed = false;
    let busy = false;
    let focusKey = "";
    let seenDay = null;
    let seenClosed = false;

    function persist() {
      if (storage) storage.setItem(storageKey, JSON.stringify(save));
    }

    function reconcile() {
      const state = session.getState();
      const entries = materialEntries(state);
      const savedIds = Object.values(save.settled).map((row) => row.eventId).sort().join("|");
      const liveIds = entries.map((entry) => entry.details.eventId).sort().join("|");
      if (entries.length && savedIds !== liveIds) {
        const latest = entries[entries.length - 1];
        save.lots = lotsFromHand(latest.details.inventoryAfter);
        save.settled = {};
        entries.forEach((entry) => {
          const decision = entry.economicDecision || {};
          const required = decision.requiredQuantity || 0;
          const available = decision.availableQuantity || 0;
          save.settled[entry.details.day] = {
            eventId: entry.details.eventId,
            label: entry.label,
            available,
            required,
            reserveQ: required > 0 ? core.mny(Math.max(0, Math.min(1, available / required))) : 1,
            response: entry.details.marketResponse || (entry.economicComponents && entry.economicComponents.marketResponse) || "",
            budgetDelta: entry.budgetDelta || 0,
            actualTotalCost: decision.actualTotalCost || 0
          };
        });
        save.draft = null;
        persist();
      }
    }

    function reserveMap() {
      const map = {};
      Object.keys(save.settled).forEach((day) => {
        const row = save.settled[day];
        if (row && row.required > 0) map[day] = clampRatio(row.available / row.required);
      });
      return map;
    }

    function marketFor(day) {
      if (news && typeof news.getMarket === "function") {
        const rows = news.getMarket(day) || [];
        if (rows.length) {
          return rows.map((row) => {
            const meta = core.MATERIAL[row.id] || { unit: "묶음", icon: "", base: 0, label: row.label || row.id };
            return {
              id: row.id,
              label: row.label || meta.label,
              icon: row.icon || meta.icon,
              unit: meta.unit,
              index: row.index,
              change: row.change || 0,
              history: row.history || [row.index],
              unitPrice: core.mny(row.unitPrice != null ? row.unitPrice : meta.base * row.index / 100)
            };
          });
        }
      }
      return core.buildMarket(day, reserveMap());
    }

    function draftNow(day) {
      if (save.draft && save.draftDay === day) return save.draft;
      return core.emptyDraft();
    }

    function setDraft(day, draft) {
      save.draft = draft;
      save.draftDay = day;
      armed = false;
      persist();
    }

    function entryFor(day) {
      return materialEntries(session.getState()).find((entry) => entry.details && entry.details.day === day) || null;
    }

    function onClick(event) {
      const node = event.target.closest("[data-act]");
      if (!node || node.disabled) return;
      const act = node.dataset.act;
      if (act === "close") {
        if (options.onClose) options.onClose();
        return;
      }
      if (act === "reset-draft") {
        save.draft = core.emptyDraft();
        save.draftDay = session.getState().day;
        armed = false;
        persist();
        render();
        return;
      }
      if (act === "step") {
        const draft = draftNow(session.getState().day);
        const bucket = node.dataset.bucket;
        const id = node.dataset.id;
        const dir = Number(node.dataset.dir);
        const bag = bucket === "craft" ? draft.craft : draft[bucket];
        const next = Math.max(0, Math.min(core.MAX_QTY, (Number(bag[id]) || 0) + dir));
        if (bucket === "craft") draft.craft[id] = next;
        else draft[bucket][id] = next;
        focusKey = bucket + "-" + id;
        setDraft(session.getState().day, draft);
        render();
        return;
      }
      if (act === "arm") {
        armed = true;
        render();
        return;
      }
      if (act === "confirm") confirm();
    }

    function onInput(event) {
      const input = event.target;
      if (!input.dataset || !input.dataset.bucket) return;
      const day = session.getState().day;
      const draft = draftNow(day);
      const bucket = input.dataset.bucket;
      const id = input.dataset.id;
      const raw = input.value.trim();
      const qty = raw === "" ? 0 : Number(raw);
      if (bucket === "craft") draft.craft[id] = qty;
      else draft[bucket][id] = qty;
      focusKey = input.dataset.key || "";
      setDraft(day, draft);
      render();
    }

    function confirm() {
      if (busy) return;
      const state = session.getState();
      const day = state.day;
      const scenario = core.scenarioFor(day);
      if (state.finished || core.hasSettled(state, day) || save.settled[day]) return;
      const evaluated = core.evaluate(system, { lots: save.lots }, scenario, draftNow(day), marketFor(day), state.budget);
      if (!evaluated.ok) {
        armed = false;
        render();
        return;
      }
      busy = true;
      try {
        const outcome = core.buildOutcome(scenario, evaluated);
        const report = {
          reserve: {
            requiredQuantity: outcome.economicDecision.requiredQuantity,
            availableQuantity: outcome.economicDecision.availableQuantity
          }
        };
        if (bridge && typeof bridge.applyOutcome === "function") bridge.applyOutcome(outcome);
        else session.applyOutcome(outcome);
        if (bridge && typeof bridge.reportDay === "function") bridge.reportDay(day, report);
        else if (news && typeof news.reportDay === "function") news.reportDay(day, report);
        save.lots = evaluated.sim.lots;
        save.settled[day] = {
          eventId: scenario.id,
          label: scenario.title,
          available: evaluated.sim.available,
          required: evaluated.sim.required,
          reserveQ: outcome.details.reserveQ,
          response: evaluated.marketResponse,
          budgetDelta: evaluated.sim.budgetDelta,
          actualTotalCost: evaluated.sim.actualTotalCost
        };
        save.draft = null;
        save.draftDay = null;
        armed = false;
        persist();
        if (options.onSettled) options.onSettled(save.settled[day]);
      } finally {
        busy = false;
        render();
      }
    }

    function render() {
      reconcile();
      const state = session.getState();
      const day = state.day;
      const scenario = core.scenarioFor(day);
      const market = marketFor(day);
      const closed = state.finished || core.hasSettled(state, day) || Boolean(save.settled[day]);
      const entry = entryFor(day);
      const liveDraft = draftNow(day);
      const draft = closed && entry && entry.details && entry.details.draft ? entry.details.draft : liveDraft;
      const warehouse = { lots: save.lots };
      const hand = core.onHand(warehouse.lots);
      const stockEq = core.certifiedEq(warehouse.lots, scenario.equivalents);
      const protectedBudget = core.protectedBudgetOf(day, state.budget);
      const evaluated = core.evaluate(system, warehouse, scenario, closed ? core.emptyDraft() : liveDraft, market, state.budget);
      const scored = system.getScoredCategories(state).includes("economicDefense");
      const scoreText = scored ? money(core, state.scores.economicDefense) + "점" : "미평가";

      const cards = market.map((row) => {
        const tone = row.change > 0 ? "is-up" : row.change < 0 ? "is-down" : "is-flat";
        const change = row.change > 0 ? "▲" + row.change : row.change < 0 ? "▼" + Math.abs(row.change) : "보합";
        return '<article><h2>' + esc(row.icon + " " + row.label) + '</h2><div class="mat-index">' + esc(row.index) + '</div><div class="mat-change ' + tone + '">' + esc(change) + '</div><div class="mat-price">매입가 ' + money(core, row.unitPrice) + "억 · 매각 " + money(core, row.unitPrice * core.SELL_RATE) + '억</div>' + spark(row.history) + "</article>";
      }).join("");

      const rows = core.MATERIALS.map((mat) => {
        const ratio = scenario.equivalents[mat.id];
        const price = (market.find((row) => row.id === mat.id) || {}).unitPrice || 0;
        const bag = {
          buy: (draft.buy && draft.buy[mat.id]) || 0,
          release: (draft.release && draft.release[mat.id]) || 0,
          sell: (draft.sell && draft.sell[mat.id]) || 0
        };
        return "<tr><td><div class=\"mat-name\">" + esc(mat.icon + " " + mat.label) + "</div></td>"
          + "<td data-label=\"매입가\">" + money(core, price) + "억</td>"
          + "<td data-label=\"재고\">" + esc(hand[mat.id] || 0) + "묶음</td>"
          + "<td data-label=\"매입\">" + stepper("buy", mat.id, bag.buy, closed) + "</td>"
          + "<td data-label=\"방출\">" + stepper("release", mat.id, bag.release, closed) + "</td>"
          + "<td data-label=\"매각\">" + stepper("sell", mat.id, bag.sell, closed) + "</td>"
          + "<td data-label=\"오늘 환산\" class=\"" + (ratio ? "" : "mat-off") + "\">" + (ratio ? "환산 " + ratio : "환산 안 됨") + "</td></tr>";
      }).join("");

      const recipes = scenario.recipes.length ? '<div class="mat-recipes">' + scenario.recipes.map((recipe) => {
        const inputs = Object.entries(recipe.inputs).map(([id, per]) => core.MATERIAL[id].label + " " + per).join(" + ");
        const count = (draft.craft && draft.craft[recipe.id]) || 0;
        return '<article class="mat-recipe"><header><h3>' + esc(recipe.label) + '</h3><span class="mat-badge ' + (recipe.certified ? "is-ok" : "is-bad") + '">' + (recipe.certified ? "환산됨" : "환산 안 됨") + '</span></header><p>' + esc(recipe.note) + '</p><p>' + esc(inputs) + " · 조합비 " + money(core, recipe.fee) + "억 → 현장 " + (recipe.certified ? recipe.outputEq + "묶음" : "0묶음") + "</p>" + stepper("craft", recipe.id, count, closed) + "</article>";
      }).join("") + "</div>" : "";

      const preview = evaluated.ok ? previewHtml(core, scenario, evaluated, protectedBudget) : '<ul class="mat-errors">' + evaluated.errors.map((text) => "<li>" + esc(text) + "</li>").join("") + "</ul>";
      const releaseWarn = scenario.objective === "stock" && core.IDS.some((id) => ((liveDraft.release && liveDraft.release[id]) || 0) > 0)
        ? '<p class="mat-warn">오늘은 비축일이라 방출한 수량만큼 확보량에서 빠져요.</p>' : "";
      const meter = scenario.objective === "stock"
        ? "지금 창고의 환산 재고는 " + stockEq + "묶음이에요. 오늘 필요량은 " + scenario.requiredQuantity + "묶음이에요."
        : "창고를 환산하면 " + stockEq + "묶음이지만, 방출하거나 환산되는 조합을 해야 오늘 확보량으로 계산돼요. 필요량은 " + scenario.requiredQuantity + "묶음이에요.";

      const actions = closed
        ? (options.onClose ? '<button type="button" class="mat-btn" data-act="close">대시보드로</button>' : "")
        : '<button type="button" class="mat-btn ghost" data-act="reset-draft">수량 초기화</button>'
          + (options.onClose ? '<button type="button" class="mat-btn" data-act="close">대시보드로</button>' : "")
          + (evaluated.ok
            ? (armed
              ? '<button type="button" class="mat-btn primary is-armed" data-act="confirm">한 번 더 누르면 오늘 결과에 반영해요</button>'
              : '<button type="button" class="mat-btn primary" data-act="arm">이 계획으로 확정</button>')
            : '<button type="button" class="mat-btn primary" disabled>수량을 다시 확인해 주세요</button>');

      const past = Object.keys(save.settled).sort((a, b) => a - b).map((key) => {
        const row = save.settled[key];
        return "DAY " + key + " " + esc(row.label) + " · " + esc(RESPONSE[row.response] || "기록") + " · 확보 " + row.available + "/" + row.required;
      }).join("<br>");

      mount.innerHTML = '<section class="mat">'
        + '<header class="mat-top"><div><p class="mat-kicker">조달청 자재비축과 · 3번 업무</p><h1>원자재 비축·조합</h1></div>'
        + '<div class="mat-stamp"><strong>DAY ' + day + '</strong><span>' + esc(scenario.phase) + '</span></div>'
        + '<dl class="mat-stats"><div><dt>가용 예산</dt><dd>' + money(core, state.budget) + '억</dd></div><div><dt>경제 방어력</dt><dd>' + scoreText + '</dd></div></dl></header>'
        + '<div class="mat-market">' + cards + '</div>'
        + '<section class="mat-mission"><h2>' + esc(scenario.title) + '</h2><p class="mat-brief">' + esc(scenario.briefing) + '</p><ul class="mat-clues">'
        + scenario.clues.map((clue) => "<li>" + esc(clue) + "</li>").join("")
        + (scenario.forwardStockNote ? "<li>" + esc(scenario.forwardStockNote) + "</li>" : "") + "</ul>"
        + '<div class="mat-meters"><div class="mat-meter"><strong>오늘 임무</strong><p class="mat-big">' + scenario.requiredQuantity + '묶음</p><p>' + esc(meter) + '</p></div>'
        + '<div class="mat-calc"><strong>' + esc(core.MATERIAL[scenario.focus].label) + " 참고 매입 " + evaluated.replenishment.plannedPurchaseQuantity + '묶음</strong><p>목표 재고 ' + evaluated.replenishment.targetStock + " · 재고 위치 " + evaluated.replenishment.stockPosition + " · 예산으로 살 수 있는 양 " + evaluated.replenishment.affordableQuantity + "묶음. " + esc(scenario.calculatorNote) + "</p></div></div></section>"
        + (closed && entry ? resultHtml(core, scenario, entry, save.settled[day]) : "")
        + (closed && !entry && save.settled[day] ? '<section class="mat-result is-' + (save.settled[day].response === "partial" ? "partial" : save.settled[day].response === "failure" ? "failure" : "success") + '"><h2>오늘 결과 · ' + esc(RESPONSE[save.settled[day].response] || "반영됨") + "</h2><p>확보 " + save.settled[day].available + " / " + save.settled[day].required + "묶음 · 예산 변화 " + signed(core, save.settled[day].budgetDelta) + "억</p></section>" : "")
        + (closed && !entry && !save.settled[day] ? '<section class="mat-result is-failure"><h2>오늘 계획이 반영되지 않았어요</h2><p>확정 전에 하루가 넘어가면 뉴스와 경제 방어력에는 이 모듈의 결과가 들어가지 않아요.</p></section>' : "")
        + '<section class="mat-sheet"><h2>창고 작업</h2><p class="mat-note">적용 순서는 매입 → 조합 → 방출·매각이에요. 방출은 현장 투입이고, 매각은 시세의 70%를 예산으로 돌려받아요. 다른 업무를 위해 ' + money(core, protectedBudget) + '억 원은 남겨 둬요.</p>'
        + '<div class="mat-table-wrap"><table><thead><tr><th>자재</th><th>매입가(억)</th><th>재고</th><th>매입</th><th>방출</th><th>매각</th><th>오늘 환산</th></tr></thead><tbody>' + rows + "</tbody></table></div></section>"
        + recipes
        + (closed ? "" : '<section class="mat-preview" aria-live="polite"><h2>확정 전 미리보기</h2>' + preview + releaseWarn + "</section>")
        + (past ? '<p class="mat-log">' + past + "</p>" : "")
        + '<div class="mat-actions">' + actions + "</div></section>";

      const keep = focusKey && mount.querySelector('[data-key="' + focusKey + '"]');
      if (keep) {
        keep.focus();
        if (keep.setSelectionRange && typeof keep.value === "string") {
          const end = keep.value.length;
          keep.setSelectionRange(end, end);
        }
      }
      if (seenDay !== null && (seenDay !== day || (closed && !seenClosed))) {
        const result = mount.querySelector(".mat-result");
        const target = result || mount;
        if (target.scrollIntoView) target.scrollIntoView({ block: "start" });
      }
      seenDay = day;
      seenClosed = closed;
    }

    function stepper(bucket, id, value, closed) {
      const key = bucket + "-" + id;
      const shown = value || 0;
      if (closed) return "<b>" + esc(shown) + "</b>";
      return '<div class="mat-step"><button type="button" data-act="step" data-bucket="' + bucket + '" data-id="' + id + '" data-dir="-1" aria-label="줄이기">−</button>'
        + '<input data-key="' + key + '" data-bucket="' + bucket + '" data-id="' + id + '" inputmode="numeric" value="' + esc(shown) + '" aria-label="' + esc(key) + '">'
        + '<button type="button" data-act="step" data-bucket="' + bucket + '" data-id="' + id + '" data-dir="1" aria-label="늘리기">+</button></div>';
    }

    mount.addEventListener("click", onClick);
    mount.addEventListener("input", onInput);
    render();

    return {
      destroy() {
        mount.removeEventListener("click", onClick);
        mount.removeEventListener("input", onInput);
        mount.replaceChildren();
      },
      refresh: render,
      reset() {
        save = blankSave(core);
        armed = false;
        persist();
        render();
      },
      isClosed() {
        const state = session.getState();
        return Boolean(state.finished || core.hasSettled(state, state.day) || save.settled[state.day]);
      },
      getSave: () => JSON.parse(JSON.stringify(save))
    };
  }

  function previewHtml(core, scenario, evaluated, protectedBudget) {
    const sim = evaluated.sim;
    const bits = core.IDS.filter((id) => sim.onHand[id] > 0).map((id) => core.MATERIAL[id].label + " " + sim.onHand[id]).join(" · ") || "비어 있음";
    return '<div class="mat-preview-grid"><div><span>확보량</span><b>' + sim.available + " / " + sim.required + '</b></div><div><span>예산 변화</span><b>' + signed(core, sim.budgetDelta) + '억</b></div><div><span>확정 후 예산</span><b>' + money(core, sim.endBudget) + '억</b></div><div><span>보호 예산</span><b>' + money(core, protectedBudget) + '억</b></div></div><p class="mat-stockline">확정 후 창고: ' + esc(bits) + "</p>";
  }

  function resultHtml(core, scenario, entry, settled) {
    const components = entry.economicComponents || {};
    const response = (settled && settled.response) || (components && components.marketResponse) || "";
    const tone = response === "success" ? "is-success" : response === "partial" ? "is-partial" : "is-failure";
    const supply = components.supplyFulfillment == null ? "" : Math.round(components.supplyFulfillment * 100) + "%";
    const efficiency = components.budgetEfficiency == null ? "" : Math.round(components.budgetEfficiency * 100) + "%";
    const hint = response === "success"
      ? "위험 조정 비용이 당시 실행 가능한 최선보다 10% 이내예요."
      : response === "partial"
        ? "최선보다 비용이 높지만 35% 이내예요."
        : scenario.failHint;
    return '<section class="mat-result ' + tone + '"><h2>오늘 결과 · ' + esc(RESPONSE[response] || "반영됨") + '</h2>'
      + '<div class="mat-result-grid"><div><span>확보</span><b>' + (settled ? settled.available : entry.economicDecision.availableQuantity) + " / " + scenario.requiredQuantity + '</b></div>'
      + '<div><span>예산 변화</span><b>' + signed(core, entry.budgetDelta) + '억</b></div>'
      + '<div><span>수요 충족</span><b>' + esc(supply || "-") + '</b></div>'
      + '<div><span>예산 효율</span><b>' + esc(efficiency || "-") + '</b></div></div>'
      + "<p>" + esc(hint) + " 선택 비용 " + money(core, entry.economicDecision.chosenExpectedCost) + "억, 당시 최선 " + money(core, entry.economicDecision.bestFeasibleExpectedCost) + "억이에요. 뉴스에는 필요량 " + scenario.requiredQuantity + "과 확보량을 전달했어요.</p></section>";
  }

  function peek(storage, key) {
    const core = typeof GoldenTimeMaterialCore !== "undefined" ? GoldenTimeMaterialCore : null;
    if (!core || !storage) return null;
    const save = readSave(storage, key || core.STORAGE_KEY, core);
    return {
      settled: save.settled,
      isDayClosed(day) { return Boolean(save.settled[day]); }
    };
  }

  return { create, peek };
});
