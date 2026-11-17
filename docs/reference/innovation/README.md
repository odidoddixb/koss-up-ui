# 프로젝트 골든타임 — 4번 혁신 및 중소기업 지원

> **범위:** 4번 업무 모듈만 포함. **5번 뉴스 화면·지진 연출, 6번 게임 시스템 구현은 포함하지 않습니다.** `index.html`은 4번만 시연하는 독립 데모로, 날짜와 예산에 **임시 세션**을 사용합니다.

## 실행

1. 압축을 풀고 전체 폴더를 VS Code에서 엽니다.
2. `index.html`을 **Live Server**로 실행합니다.
3. 기업 대표와 질문·답변을 진행한 뒤 전액/일부 지원/거절 중 하나를 선택합니다.
4. **다음 날짜** 버튼으로 DAY 1~5를 테스트합니다. DAY 1 드론은 DAY 3에 결과가 확정됩니다.

## 파일

| 파일 | 설명 |
| --- | --- |
| `golden-time-innovation.js` | 기업 시나리오, 선택형 대화, 지원 판단, 예산/평가/뉴스 데이터 전달 |
| `golden-time-innovation.css` | 4번 전용 UI 스타일 (`gti-` 접두사로 충돌 방지) |
| `index.html` | 4번 기능만 확인하는 독립 데모 (임시 세션) |
| `img/office.jpg` | 팀 제공 조달청 사무실 배경 이미지 (데모에서만 사용) |
| `NOTION_HANDOFF.md` | 팀 연동 및 노션 인수인계 |

## 구현 범위

- DAY 1~5 기업 제안서와 대표 대화 3문항
- 제품 성능·검증·납품 조건 확인
- 전액 지원 / 일부 지원 / 지원 거절
- 예산 초과 선택 차단, 예산 집행은 `session.applyOutcome({budgetDelta: -금액})`로 전달
- **활용 결과가 확인된 이후** `innovationDecision`과 `budgetAssessment`를 6번 시스템에 전달
- 5번 뉴스에 `news.reportDay(day, { innovation: { decision: "success" | "partial" | "failure" } })` 전달
- 로컬 저장, 같은 기업 중복 결정·평가 및 같은 날짜 뉴스 중복 보고 방지

> **시나리오 관련:** 기업명·제품 조건·금액·정답 규칙은 현재 공모전 시연용 가상 데이터입니다. 팀 전체 시나리오 및 실제 정책 설명과 최종 대조가 필요합니다. 이 모듈이 직접 뉴스 기사·종합 점수·지진 진척도·랭킹을 생성하지 않습니다.

## 통합 방법 (1번 담당자)

최종 메인 HTML에 4번 CSS/JS만 추가합니다.

```html
<link rel="stylesheet" href="golden-time-innovation.css">
<div id="innovation-panel"></div>
<script src="golden-time-innovation.js"></script>
```

1번 담당자가 **한 번 생성한 공용** `session`과 5번 담당자의 `news` 객체를 전달합니다.

```js
const innovation = GoldenTimeInnovation.create({
  session, // 6번 createSession(...)의 공용 객체
  news,    // 5번 GoldenTimeNews.create(...)의 공용 객체
  mount: document.querySelector('#innovation-panel'),
  saveKey: 'golden-time-innovation-progress-v4'
});

// 4번 탭 열 때
innovation.render();

// 새 날짜의 아침 뉴스 결과까지 적용한 뒤, 낮 업무 시작 전
innovation.resolveDue(session.getState().day);
innovation.render();

// 하루 업무가 끝났는지 확인하고 마감 전에 보조 호출 가능
innovation.reportDay(session.getState().day);
```

### 호출 타이밍

- **기업 지원/거절 선택 즉시:** `session.applyOutcome({ budgetDelta })` 로 집행 비용 반영 (거절은 예산 변화 0).
- **해당 기업의 활용 결과 확인일:** `innovation.resolveDue(currentDay)` → `session.applyOutcome({ innovationDecision, budgetAssessment })` 각 기업당 한 번.
- **하루 결과 확정 시:** `news.reportDay(day,{innovation:{decision:...}})` 각 날짜당 한 번. `decide()` 호출 뒤 자동 보고를 시도하며, 마감 직전 `reportDay(day)`를 다시 호출해도 중복 보고하지 않습니다.
- `session.closeDay()`, `news.playMorning()`, `news.playNight()`는 **1·5번 담당자가 호출**합니다. 이 모듈에서는 호출하지 않습니다.

### 팀원에게 전달할 규칙

- 금액 단위는 억 원. 전액/일부 시범구매 비용은 `budgetDelta`로 **음수** 전달합니다.
- 혁신 기여도를 UI에서 수동으로 계산하지 않습니다. 6번 시스템의 `innovationDecision`(`success`/`partial`/`failure`)을 이용합니다.
- `budgetAssessment`는 배정 예산, 순지출, 결과 달성률을 보냅니다.
- DAY 1 드론의 최종 활용 평가는 DAY 3에 확인되도록 설정했습니다. **DAY 1의 뉴스 결과는 시범구매 당시 판단을 나타내는 잠정 결과**이며 평가 점수 확정과 다릅니다.
- 뉴스가 연결되지 않은 독립 데모에서는 `reportDay` 호출을 건너뜁니다. `news`를 자동으로 생성하지 않습니다.
- 새 게임 시작 시 **공용 `session` 저장뿐 아니라** `innovation.reset()` 또는 혁신 모듈 저장 키 초기화가 필요합니다. 기존 게임 저장과 섞이지 않도록 주의하세요.
- 저장은 같은 브라우저의 `localStorage`에 보관합니다. 본 모듈 저장 상태는 6번 시스템 저장과 별개이므로 통합 테스트에서 함께 초기화해야 합니다.

## 테스트 체크리스트

- [ ] DAY 1 기업 정보와 질문 3개 표시
- [ ] 각 지원 선택 시 올바른 금액 차감 / 거절 시 차감 없음
- [ ] 동일 기업 두 번 결정 불가
- [ ] DAY 3 진입 시 DAY 1 드론 활용 평가 1회 적용
- [ ] 날짜별 심사와 기업 정보 교체
- [ ] 뉴스 연결 시 날짜마다 1회만 `reportDay` 호출
- [ ] 새 게임 시 모듈 저장 초기화
- [ ] 게임 시스템의 예산 및 점수 연동 확인 (통합 환경에서)
