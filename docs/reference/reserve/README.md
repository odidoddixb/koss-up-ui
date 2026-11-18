# 3번 원자재 비축·조합

해원시 재난 대응 5일 동안 철강·시멘트·경유·목재를 사고, 현장에 방출하고, 남는 물량을 매각하고, 규격이 확인된 자재로 대체 조합하는 업무 모듈이에요.

재고와 시황 판단은 이 모듈이 들고, 점수와 예산 잔액은 6번 게임 시스템에 맡겨요. 혁신 기여도처럼 경제 방어력 점수를 직접 계산해서 보내지 않아요.

## 파일

| 파일 | 내용 |
| --- | --- |
| `index.html` | 3번만 5일 연습하는 화면 |
| `material.js` | 창고 화면. `GoldenTimeMaterial.create` |
| `material-core.js` | 시세, 재고, 조합, 위험 비용 계산 |
| `material.css` | `mat-` 접두사 스타일 |
| `vendor/golden-time-system.js` | 6번 시스템 원본. 연습 화면에서만 함께 불러요 |
| `tests/` | 5일 판정과 화면 확정 흐름 검사 |

이미지는 쓰지 않아요. 메인 게임에 붙일 때 별도 그림 폴더가 필요하지 않아요.

## 연습 실행

이 폴더에서 서버를 켜요.

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 을 열어요. 파일을 그냥 더블클릭하면 저장이 브라우저마다 달라질 수 있어요.

화면 위쪽의 `다음 날`은 연습용이에요. 본게임에서는 1번 화면이 퇴근과 아침 뉴스에서 날짜를 넘겨요. 이 모듈은 `closeDay()`를 호출하지 않아요.

로직 확인:

```bash
node tests/material-logic.test.cjs
node tests/material-ui.test.cjs
```

## 플레이어가 하는 일

하루 시황이 하나 있고, 확정은 하루에 한 번이에요. 적용 순서는 **매입 → 조합 → 방출·매각**이에요.

- **매입**은 오늘 시세로 창고에 들어와요.
- **방출**은 현장 투입이에요. 예산이 돌아오지 않아요.
- **매각**은 오늘 시세의 70%만 예산으로 돌아와요.
- **합성 패널**은 4일차에 철강 1과 시멘트 2가 목재 2묶음으로 환산돼요. 조합비는 1.2억 원이고 바로 현장에 들어가요.
- **미검증 압축 각재**는 싸 보이지만 확보량에 들어가지 않아요.

1일차는 지진 전이라 창고를 채우는 날이에요. 2일차부터는 창고에 있어도 방출하거나 환산되는 조합을 해야 확보량으로 계산해요. 다른 업무 예산을 위해 날짜별 보호 예산을 남겨 둬요. 그 아래로 내려가는 매입은 확정되지 않아요.

가격 지수는 5번 아침 시황과 같아요. 1일차가 100이고, 전날 필요량을 다 채우지 못하면 다음 날 철강·시멘트가 최대 6포인트 더 올라요. 목재는 3일차 지수 112에서 4일차 134로 올라요(1일차 대비 34%, 전날 대비 약 20%). `news.getMarket(day)`가 있으면 그 지수를 쓰고, 없으면 같은 표를 모듈 안에서 계산해요.

| 날 | 임무 | 필요량 | 판단 포인트 |
| --- | --- | --- | --- |
| 1 | 복구 자재 선제 비축 | 환산 재고 12묶음 | 철강 1, 시멘트 0.75. 평시 가격에 부족한 만큼만 |
| 2 | 급등 속 긴급 방출 | 방출 5묶음 | 가진 철강을 현장에 내보내요. 오른 가격의 추가 매입은 불리해요 |
| 3 | 고점의 경유 | 경유 8묶음 | 경유만 오늘 확보량에 들어가요. 4일차 목재 가격 상승에 대비해 현재 재고 부족분 최대 2묶음을 선매입할 수 있고, 이 비용은 3일차 계획 비교에서 다음 날 준비로 인정돼요. 철강·시멘트 추가 매입은 여전히 불리해요 |
| 4 | 임시주거와 대체 조합 | 목재 환산 6묶음 | 합성 패널은 환산되고, 미검증 각재는 빠져요 |
| 5 | 수입 입항과 재고 정리 | 방출 2묶음 | 필요량만 방출하고 나머지는 매각. 하락장 추가 매입은 불리해요 |

조달 계산기는 6번의 `calculateReplenishmentPlan`으로 기준 자재의 참고 매입량만 보여 줘요. 가격 전망, 방출, 대체 조합은 계산하지 않아요.

## 메인 화면 연결

1번이 만든 세션을 그대로 받아요. 새 세션을 만들지 않아요.

```html
<link rel="stylesheet" href="modules/material.css">
<script src="modules/material-core.js"></script>
<script src="modules/material.js"></script>
```

업무 탭의 원자재 자리에 붙여요.

```js
host.innerHTML = '<div id="material-root"></div>';
const material = GoldenTimeMaterial.create({
  mount: document.querySelector("#material-root"),
  session,                 // 1번이 만든 공통 세션
  system: GoldenTimeSystem,
  news: newsModule,        // 5번. getMarket, reportDay를 쓸 수 있으면 넘김
  bridge: window.GoldenTime, // 있으면 applyOutcome과 reportDay는 여기로
  onClose() { view("home"); }
});
```

`bridge`가 없으면 `session.applyOutcome`과 `news.reportDay`를 직접 호출해요. 1번 `GoldenTime.applyOutcome`을 쓰면 메인 예산 표시까지 같이 갱신돼요.

확정할 때 나가는 값은 아래 한 번이에요.

```js
GoldenTime.applyOutcome({
  source: "material-reserves",
  label: "복구 자재 선제 비축",
  budgetDelta: -25,
  economicDecision: {
    requiredQuantity: 12,
    availableQuantity: 12,
    referenceUnitCost: 5,
    actualTotalCost: 25,
    chosenExpectedCost: 37,
    bestFeasibleExpectedCost: 37
  },
  budgetAssessment: { allocatedBudget: 40, actualCost: 25, fulfillment: 1 },
  details: { eventId: "reserve-day-1", day: 1 }
});

GoldenTime.reportDay(day, {
  reserve: { requiredQuantity: 12, availableQuantity: 12 }
});
```

- `marketResponse`는 보내지 않아요. 선택 비용과 당시 최선의 비용을 넘기면 6번이 성공(10% 이내), 부분 성공(35% 이내), 실패(35% 초과)로 나눠요.
- 위험 비용은 `calculateExpectedPlanCost`로 맞춰요. 예산 안에서 실행 가능한 채우기·보유·매각만 비교해요.
- 이미 가진 재고를 쓰는 비용은 이번 시황의 실제 비용에 다시 넣지 않아요. 오늘 산 물량, 조합비, 환산되지 않는 매입만 들어가요.
- `budgetDelta`만 잔액을 바꿔요. `budgetAssessment.actualCost`는 예산 결산 점수용이고 잔액에서 한 번 더 빠지지 않아요.
- 같은 날 `reserve-day-N`은 한 번만 반영해요. 다시 확정해도 예산이 중복으로 빠지지 않아요.
- 재고는 `localStorage` 키 `goldentime-material-v1`에 있어요. 연습 화면은 `goldentime-material-demo-v1`을 써서 본게임 저장과 섞이지 않아요.
- 새 게임은 `reset()`이나 저장 키 삭제로 창고를 비워요. 장부가 비어 있다는 이유만으로 창고 노트를 지우지는 않아요. 세션 이력만 남아 있으면 마지막 `inventoryAfter`로 재고를 복구해요.

1번 체크리스트에서 3번을 준비 중으로 숨기려면, 공통 이력에 `source === "material-reserves"`이고 `details.eventId === "reserve-day-" + day`인 기록이 있는지 보면 돼요. `GoldenTimeMaterial.peek(localStorage).isDayClosed(day)`도 같은 저장을 읽어요.

## 일부러 하지 않는 일

- 날짜 증가, `closeDay`, 아침 결과 반영, 재난 지표 갱신은 1번과 5번 흐름에 맡겨요.
- 청렴도, 혁신 기여도, `scoreDeltas.economicDefense`는 보내지 않아요.
- 5번 뉴스 문장과 티커는 만들지 않아요. 필요량과 확보량만 넘겨요.
