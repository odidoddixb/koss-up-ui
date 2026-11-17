
/* =========================================================================
   [2번 담당 : 나라장터 계약 심사 모듈]

   ■ 이번 요청 반영 사항
   1) 캐릭터 이미지에서 "정면" 글자(에셋 시트의 캡션)가 함께 잘려 들어가 있던
      문제 수정 → 캡션 없이 캐릭터 그림만 다시 잘라서 사용.
   2) 판정 결과(승인/반려)에 따라 에셋 시트의 "표정 예시" 8종 중 어울리는
      표정을 캐릭터 옆에 작은 반응 아이콘으로 표시:
        - 정답(correct)        → "확신" 표정
        - 적격 오반려(ordinaryWrong) → "걱정" 표정
        - 부실 승인(falseApproval)   → "당황" 표정
        - 판단 보류(hold)             → "고민" 표정
        - 서류 열람 직후 기본 상태     → "기본" 표정
      표정 이미지는 코드 안 EXPRESSIONS 객체에서 쉽게 교체/추가할 수 있습니다.
   3) 서류를 판정하지 않고(=승인/반려 확정 없이 "보류"거나 아예 열어보지도
      않은 상태) 다음 날로 넘어가는 경우에 대한 패널티 처리 추가:
      - closeDay()를 호출하면 그 시점에 승인/반려로 확정되지 않은 모든 서류를
        자동으로 "unresolved"(미처리) 판정으로 집계합니다.
      - unresolved는 session.applyOutcome({integrityDecision:'unresolved', ...})
        로 시스템에 전달되며, 점수 계산에서 falseApproval 다음으로 큰 감점
        (-60점 가중치)을 받습니다. (MockSession.closeDay() 참고)
      - 정산 팝업에 "⚠️ 미처리 서류" 항목을 추가해 몇 건이 패널티를 받았는지
        바로 보여줍니다.

   ── 통합 방법 (6번 시스템과 합칠 때) ─────────────────────────────────────
   아래 MockSession 객체는 실제 6번 담당 game-system.js가 아직 없을 때
   화면 동작을 보여주기 위한 "가짜 session"입니다. 실제 연동 시:
     1) 6번 담당 game-system.js를 <script src="..."> 로 먼저 불러오고
     2) const session = system.createSession(...) 로 진짜 세션 생성
     3) "MOCK SESSION 시작"~"MOCK SESSION 끝" 블록만 통째로 삭제
     4) 나머지 코드는 session.applyOutcome(...) 형식만 지키므로 그대로 재사용됩니다.
     ※ 6번 시스템이 'unresolved'라는 integrityDecision 값을 아직 모른다면,
       6번 담당과 상의해서 동일한 의미의 값(예: 'unresolved' 또는 'skipped')을
       맞추거나, 혹은 'falseApproval'과 동일하게 처리하도록 요청하세요.
   ========================================================================= */

/* ===================== MOCK SESSION 시작 (실제 연동 시 삭제) ===================== */
const bridge=parent.GoldenTimeBridge;
const session={get budget(){return bridge.getState().budget},get log(){return bridge.contractLog()},get correctCount(){return bridge.counts().correct},get wrongCount(){return bridge.counts().ordinaryWrong},get falseCount(){return bridge.counts().falseApproval},get unresolvedCount(){return bridge.counts().unresolved},applyOutcome(o){bridge.applyContract(o);renderLog();renderTopbar()}};
/* ===================== MOCK SESSION 끝 ===================== */


const MAX_INVESTIGATION = 5;
const MIN_CASES_PER_DAY = 2;
const MAX_CASES_PER_DAY = 5;

/* Single-character transparent high-resolution decision portraits. */
const EXPRESSIONS = {
  default:    "assets/contract/officer-clean.png",
  correct:    "assets/contract/reaction-correct.webp",   // 확신
  ordinaryWrong: "assets/contract/reaction-wrong.webp",    // 걱정
  falseApproval: "assets/contract/reaction-false.webp", // 당황
  hold:       "assets/contract/reaction-hold.webp",     // 고민 대용(불안) — 추가조사 보류시
  open:       "assets/contract/officer-clean.png"        // 서류 열람 시 밝은 표정
};

function setFace(key){
  const img = document.getElementById('face-react');
  if(!img) return;
  img.src = EXPRESSIONS[key] || EXPRESSIONS.default;
  const labels = {correct:'올바른 판정이에요!', ordinaryWrong:'적격 업체를 반려했어요.', falseApproval:'부실 업체를 승인했어요!', hold:'판단을 보류했어요.'};
  img.alt = labels[key] || '서류를 검토하는 주무관';
  img.closest('.avatar-wrap').dataset.reaction = labels[key] ? key : '';
  const speech = img.closest('.avatar-row').querySelector('.speech-bubble');
  if (labels[key] && speech) { speech.textContent = labels[key]; speech.setAttribute('role','status'); }
  img.classList.remove('show');
  void img.offsetWidth; // 리플레이를 위한 강제 리플로우
  img.classList.add('show');
}

const DAY_INFO = {
  1:{ title:"D1 · 재난의 전조", scene:"office", urgent:false,
      news:"📰 [조달청 아침 뉴스] 동남부 지역 지진 위험 증가 — 재난 대비 물자 확보 필요성 제기.",
      speech:"평상시처럼 계약 서류부터 꼼꼼히 확인해볼까요?" },
  2:{ title:"D2 · 대형지진 발생", scene:"disaster", urgent:true,
      news:"📰 [긴급 속보] 해원시 규모 7.8 강진 발생 — 주요 도로 및 교량 붕괴, 구호물품 긴급 조달 필요.",
      speech:"지진이 발생했어요! 긴급 구호물품 계약부터 신속하게 심사할게요." },
  3:{ title:"D3 · 끊어진 보급로", scene:"warehouse", urgent:true,
      news:"📰 해원시 외곽 지역 고립 장기화 — 구호물품 운송 차질, 임시 교량 자재 수요 급증.",
      speech:"보급로가 끊겼어요. 임시 교량 자재와 운송 장비 업체를 꼼꼼히 봐야겠어요." },
  4:{ title:"D4 · 골든타임", scene:"disaster", urgent:true,
      news:"📰 강한 여진으로 임시 보급로 손상 — 대피소·의료시설 구호물품 추가 확보 시급.",
      speech:"지금이 골든타임이에요. 긴급 구호물품 계약의 우선순위를 빠르게 정해야 해요." },
  5:{ title:"D5 · 다시 움직이는 도시", scene:"warehouse", urgent:false,
      news:"📰 해원시 주요 복구 작업 진행 — 구호물품 공급망 정상화 기대, 잔여 복구 자재 계약 마무리 중.",
      speech:"마지막까지 방심은 금물이에요. 남은 복구 계약도 끝까지 확인할게요." }
};

const COMPANY_POOL = [
  { name:"해원건설산업(주)", type:"임시 교량 자재 납품", qty:"강재 모듈 200개 / 7일 이내", amountRange:[5,10],
    valid:true, verdictReason:"설립 10년, 실적 다수, 야적장/인력 실존 확인", supplierId:"supplier-a",
    clues:{ registry:{text:"설립 2015년, 자본금 8억, 최근 5년 공사 실적 12건. 특이사항 없음.",suspicious:false},
            roadview:{text:"등록 주소지에 실제 자재 야적장·사무동 존재, 중장비 다수 확인.",suspicious:false},
            phone:{text:"담당자가 납기·보유 자재 규격을 정확히 설명.",suspicious:false} },
    note:"정상 납품 시 구호 자재 공급 안정화에 기여" },

  { name:"미래복구기술(주)", type:"복구 장비 임대", qty:"굴삭기 3대 / 5일 이내", amountRange:[2,4],
    valid:false, verdictReason:"설립 2개월, 공유오피스 주소, 장비 보관 흔적 없음, 담당자 회피", supplierId:"supplier-b",
    clues:{ registry:{text:"설립 2개월 전, 본점 소재지가 공유오피스로 등록.",suspicious:true},
            roadview:{text:"등록 주소는 개인 원룸 건물, 장비 보관 흔적 전혀 없음.",suspicious:true},
            phone:{text:"담당자가 보유 장비 목록 질문에 즉답을 피하고 말을 돌림.",suspicious:true} },
    note:"승인 시 장비 미납 리스크 발생" },

  { name:"동남물류유통", type:"생수·의료물품 긴급 운송", qty:"생수 5,000병 / 당일", amountRange:[0.5,1],
    valid:true, verdictReason:"실적 보유, 물류창고·냉장 탑차 실존, 운송 동선 구체적 설명", supplierId:"supplier-c",
    clues:{ registry:{text:"설립 7년차, 조달청 납품 이력 3건.",suspicious:false},
            roadview:{text:"소형 물류창고와 냉장 탑차 2대 확인.",suspicious:false},
            phone:{text:"긴급 운송 동선·소요 시간을 구체적으로 안내.",suspicious:false} },
    note:"정상 승인 시 고립 지역 구호물품 도달률 상승" },

  { name:"그린브릿지건설", type:"도로 복구 자재 납품", qty:"콘크리트 패널 150개 / 3일 이내", amountRange:[2.5,4.5],
    valid:false, verdictReason:"동일 대표자 반복 설립 패턴, 간판 불일치, 소속 미확인", supplierId:"supplier-d",
    clues:{ registry:{text:"동일 대표자가 유사 상호의 폐업 업체 2곳과 연관됨.",suspicious:true},
            roadview:{text:"등록 주소에 '그린브릿지' 간판 없음, 다른 업체 간판만 확인.",suspicious:true},
            phone:{text:"응답자가 회사 소속을 제대로 밝히지 못함.",suspicious:true} },
    note:"승인 시 도로 복구 지연 리스크" },

  { name:"한빛통신장비", type:"이동형 통신장비 공급", qty:"이동형 기지국 10대 / 2일 이내", amountRange:[0.7,1.2],
    valid:true, verdictReason:"설립 10년, 통신장비 전문 제조업 등록, 재고·설치인력 확인됨", supplierId:"supplier-e",
    clues:{ registry:{text:"설립 10년, 통신장비 전문 제조업 등록, 특이사항 없음.",suspicious:false},
            roadview:{text:"등록 주소에 공장 및 물류 출입구 확인됨.",suspicious:false},
            phone:{text:"재고 수량과 설치 인력 배치 계획을 명확히 제시함.",suspicious:false} },
    note:"정상 승인 시 고립지역 통신 복구에 기여" },

  { name:"신속교량산업", type:"임시 교량 설치 자재", qty:"강재 모듈 80개 / 2일 이내", amountRange:[2,3.2],
    valid:false, verdictReason:"설립 1개월, 교량 시공 실적 전무, 하도급 재하도급 구조 의심", supplierId:"supplier-f",
    clues:{ registry:{text:"설립 1개월 전, 교량·토목 관련 시공 실적이 전혀 없음.",suspicious:true},
            roadview:{text:"등록 주소는 소규모 사무실, 자재 보관 공간 없음.",suspicious:true},
            phone:{text:"견적 근거를 묻자 '하도급 업체가 처리한다'며 답변 회피.",suspicious:true} },
    note:"승인 시 임시 보급로 추가 손상 리스크" },

  { name:"청솔의료물류", type:"응급 의료물품 긴급 납품", qty:"응급키트 3,000세트 / 당일", amountRange:[0.8,1.5],
    valid:true, verdictReason:"의료물류 전문 업체, 응급 대응 이력 다수, 재고 실사 가능", supplierId:"supplier-g",
    clues:{ registry:{text:"설립 8년, 의료물류 전문 등록, 재난 대응 납품 이력 2건.",suspicious:false},
            roadview:{text:"냉장·멸균 보관시설을 갖춘 물류센터 확인.",suspicious:false},
            phone:{text:"재고 수량과 포장·배송 계획을 즉시 제시함.",suspicious:false} },
    note:"정상 승인 시 의료 지원 체계 안정화" },

  { name:"대한재난테크", type:"임시 대피시설 패널 납품", qty:"조립식 패널 500매 / 1일 이내", amountRange:[1.5,2.5],
    valid:false, verdictReason:"허위 납품 실적 제출 의심, 서류 양식이 다른 낙찰 취소 업체와 일치", supplierId:"supplier-h",
    clues:{ registry:{text:"제출된 과거 납품 실적이 발주처에 등록되지 않은 허위 기록으로 확인됨.",suspicious:true},
            roadview:{text:"등록 주소는 공사 중단된 건물로 운영 흔적 없음.",suspicious:true},
            phone:{text:"납품 실적 관련 질문에 번호가 결번 처리되어 연결되지 않음.",suspicious:true} },
    note:"승인 시 대피시설 추가 피해 리스크" },

  { name:"태양광물자지원", type:"비상 발전기·태양광 패널 공급", qty:"발전기 15대 / 2일 이내", amountRange:[1.2,2.0],
    valid:true, verdictReason:"재생에너지 설비 전문 업체, 설치 이력 풍부, 재고 실물 확인", supplierId:"supplier-i",
    clues:{ registry:{text:"설립 6년, 재생에너지 설비 공급업 등록, 특이사항 없음.",suspicious:false},
            roadview:{text:"창고에 발전기·패널 재고 다수 확인됨.",suspicious:false},
            phone:{text:"설치 기사 인원과 작업 순서를 구체적으로 설명.",suspicious:false} },
    note:"정상 승인 시 고립지역 전력 공급 안정화" },

  { name:"늘푸른자원개발", type:"구호소 식자재 공급", qty:"비상식량 10,000인분 / 1일 이내", amountRange:[0.6,1.1],
    valid:false, verdictReason:"위생 허가 미보유, 보관시설 부적합, 납품 단가 비정상적으로 낮음", supplierId:"supplier-j",
    clues:{ registry:{text:"식품 관련 위생 허가가 등록되어 있지 않음.",suspicious:true},
            roadview:{text:"등록 주소는 일반 가정집으로 식자재 보관시설이 없음.",suspicious:true},
            phone:{text:"보관 온도·유통기한 관리 방식에 대한 질문에 답변하지 못함.",suspicious:true} },
    note:"승인 시 식중독 등 2차 피해 리스크" },

  { name:"스마트드론테크", type:"재난 물자 운송 드론 지원", qty:"운송 드론 8대 / 3일 이내", amountRange:[1.0,1.8],
    valid:true, verdictReason:"혁신조달 시범구매 이력 보유, 비행 테스트 영상 확인 가능", supplierId:"supplier-k",
    clues:{ registry:{text:"설립 4년, 혁신제품 지정 이력 있음, 기술 특허 2건 보유.",suspicious:false},
            roadview:{text:"드론 이착륙장과 정비시설이 갖춰진 사업장 확인.",suspicious:false},
            phone:{text:"기체 적재중량·운용 가능 거리 등을 정확히 답변.",suspicious:false} },
    note:"정상 승인 시 고립지역 긴급 물자 공중 수송 가능" },

  { name:"한솔임시주택", type:"이재민 임시주택 자재 공급", qty:"조립식 주택 모듈 40세트 / 4일 이내", amountRange:[3.0,5.0],
    valid:false, verdictReason:"법인 설립 직후 대표 변경 반복, 실제 생산시설 확인 불가", supplierId:"supplier-l",
    clues:{ registry:{text:"최근 6개월 내 대표자가 3차례 변경됨.",suspicious:true},
            roadview:{text:"등록 주소는 빈 상가로 생산·보관 흔적이 없음.",suspicious:true},
            phone:{text:"모듈 제작 공장 위치를 묻자 답변을 계속 미룸.",suspicious:true} },
    note:"승인 시 임시주택 미납·품질 문제 발생" }
];

function pick(arr,n){
  const copy = arr.slice();
  for(let i=copy.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]] = [copy[j],copy[i]];
  }
  return copy.slice(0,n);
}
function randRange([min,max]){ return Math.round((min + Math.random()*(max-min)) * 10) / 10; }
function makeId(name, day){ return (name.replace(/[^가-힣a-zA-Z0-9]/g,'') + '-' + day + '-' + Math.random().toString(36).slice(2,6)); }

function generateDay(day){
  const count = MIN_CASES_PER_DAY + Math.floor(Math.random()*(MAX_CASES_PER_DAY-MIN_CASES_PER_DAY+1));
  const templates = pick(COMPANY_POOL, count);
  return templates.map(t => {
    const amount = randRange(t.amountRange);
    return {
      id: makeId(t.name, day),
      name: t.name, type: t.type, qty: t.qty, amount,
      valid: t.valid, verdictReason: t.verdictReason, clues: t.clues,
      followUp: { supplierId: t.supplierId, expectedDeliveryDay: day+1, note: t.note }
    };
  });
}

const restored=bridge.getContract();
let currentDay=restored.day,dayCases=restored.dayCases,investLeft=restored.investLeft,activeCaseId=restored.activeCaseId,decisions=restored.decisions,investigated=restored.investigated;
function persistContract(){bridge.saveContract({day:currentDay,dayCases,investLeft,activeCaseId,decisions,investigated})}
window.exportContractState=()=>({day:currentDay,dayCases,investLeft,activeCaseId,decisions,investigated});
function cases(){ return dayCases; }
function findCase(id){ return dayCases.find(c=>c.id===id); }

function renderScene(){
  const info = DAY_INFO[currentDay];
  ['office','disaster','warehouse'].forEach(s=>{
    document.getElementById('scene-'+s).classList.toggle('active', info && info.scene===s);
  });
  document.getElementById('urgent-tag').style.display = (info && info.urgent) ? 'inline-block' : 'none';
}

function renderTopbar(){
  const info = DAY_INFO[currentDay];
  document.getElementById('day-label').textContent = info ? info.title : `D${currentDay}`;
  document.getElementById('day-num').textContent = currentDay;
  document.getElementById('case-count-label').textContent = dayCases.length;
  document.getElementById('stat-budget').textContent = session.budget.toLocaleString("ko-KR",{maximumFractionDigits:1});
  const totalJudged = session.correctCount + session.wrongCount + session.falseCount + session.unresolvedCount;
  document.getElementById('stat-integrity').textContent = `${session.correctCount} / ${totalJudged}`;
  document.getElementById('invest-count').textContent = investLeft;
  if(info) document.getElementById('news-text').textContent = info.news;
  renderScene();
}

function renderQueue(){
  persistContract();
  const list = document.getElementById('case-list');
  list.innerHTML = '';
  cases().forEach(c=>{
    const done = decisions[c.id];
    const div = document.createElement('div');
    div.className = 'case-card' + (activeCaseId===c.id?' active':'') + (done && done!=='hold' ? ' done':'');
    div.onclick = ()=>{ if(done!=='approve' && done!=='reject') openCase(c.id); };
    let badge = '<span class="badge pending">심사 대기</span>';
    if(done==='approve') badge='<span class="badge approve">✅ 승인 완료</span>';
    if(done==='reject') badge='<span class="badge reject">❌ 반려 완료</span>';
    if(done==='unresolved') badge='<span class="badge hold">미처리 마감</span>';
    if(done==='hold') badge='<span class="badge hold">⏸ 판단 보류</span>';
    div.innerHTML = `<div class="co-name">${c.name}</div>
      <div class="co-type">${c.type} · ${c.amount}억 원</div>${badge}`;
    list.appendChild(div);
  });
  renderTopbar();
}

function openCase(id){
  if(bridge.isContractClosed())return;
  activeCaseId = id;
  const c = findCase(id);
  if(!investigated[id]) investigated[id] = {registry:false, roadview:false, phone:false};

  const panel = document.getElementById('detail-panel');
  panel.innerHTML = `
    <div class="avatar-row">
      <div class="avatar-wrap">
        <img class="body" src="assets/contract/officer-clean.png" alt="신입 주무관">
        <img class="face-react" id="face-react" src="assets/contract/officer-clean.png" alt="표정">
      </div>
      <div class="speech-bubble">${c.name} 서류를 검토해볼까요?</div>
    </div>
    <h3>${c.name} — 입찰 서류 심사</h3>
    <div class="doc-box">
      <div class="row"><span>계약 목적/품목</span><span>${c.type}</span></div>
      <div class="row"><span>납품 수량·기한</span><span>${c.qty}</span></div>
      <div class="row"><span>계약 금액</span><span>${c.amount}억 원</span></div>
      <div class="row"><span>심사 상태</span><span>검토 중</span></div>
    </div>
    <div class="tools">
      <button class="tool-btn registry" id="btn-registry" onclick="investigate('registry')">📁 등기부 조회</button>
      <button class="tool-btn roadview" id="btn-roadview" onclick="investigate('roadview')">🗺️ 로드뷰 확인</button>
      <button class="tool-btn phone" id="btn-phone" onclick="investigate('phone')">☎️ 전화 조사</button>
    </div>
    <div class="result-box registry" id="result-registry"></div>
    <div class="result-box roadview" id="result-roadview"></div>
    <div class="result-box phone" id="result-phone"></div>
    <div class="decision">
      <button class="btn-approve" onclick="decide('approve')">✅ 승인</button>
      <button class="btn-reject" onclick="decide('reject')">❌ 반려</button>
      <button class="btn-hold" onclick="decide('hold')">⏸ 추가 조사(보류)</button>
    </div>
    <div class="feedback" id="feedback"></div>
  `;
  ['registry','roadview','phone'].forEach(type=>{if(investigated[id]?.[type]){const clue=c.clues[type],box=document.getElementById('result-'+type);box.textContent=clue.text;box.classList.add('show');if(clue.suspicious)box.classList.add('flag')}});
  setFace('open');
  updateToolButtons();persistContract();
  renderQueue();
}

function investigate(type){
  if(bridge.isContractClosed())return;
  if(investLeft<=0){ alert('오늘 사용 가능한 조사 횟수를 모두 소진했습니다.'); return; }
  const c = findCase(activeCaseId);
  if(investigated[activeCaseId][type]) return;
  investigated[activeCaseId][type] = true;
  investLeft--;

  const clue = c.clues[type];
  const box = document.getElementById('result-'+type);
  const labelMap = {registry:'📁 등기부 조회 결과', roadview:'🗺️ 로드뷰 확인 결과', phone:'☎️ 전화 조사 결과'};
  box.innerHTML = `<div class="label">${labelMap[type]}</div><div class="${clue.suspicious?'flag':''}">${clue.text}</div>`;
  box.classList.add('show');

  updateToolButtons();persistContract();
  renderQueue();
}

function updateToolButtons(){
  const inv = investigated[activeCaseId];
  ['registry','roadview','phone'].forEach(t=>{
    const btn = document.getElementById('btn-'+t);
    if(!btn) return;
    btn.disabled = inv[t] || investLeft<=0;
  });
}

function decide(choice){
  if(bridge.isContractClosed())return;
  const c = findCase(activeCaseId);
  if(decisions[c.id]==='approve' || decisions[c.id]==='reject') return;

  decisions[c.id] = choice;
  const fb = document.getElementById('feedback');

  if(choice==='hold'){
    fb.className = 'feedback hold';
    fb.textContent = '⏸ 판단을 보류했습니다. 오늘 업무를 마치기 전까지 승인 또는 반려를 결정해 주세요. 결정하지 않은 계약은 미처리로 평가됩니다.';
    setFace('hold');
    renderQueue();
    return;
  }

  let integrityDecision;
  if(choice==='approve' && c.valid) integrityDecision = 'correct';
  else if(choice==='reject' && !c.valid) integrityDecision = 'correct';
  else if(choice==='reject' && c.valid) integrityDecision = 'ordinaryWrong';
  else integrityDecision = 'falseApproval';

  const budgetDelta = choice==='approve' ? -c.amount : 0;

  const outcome = {
    source: "procurement-review",
    label: `${c.name} 최종 심사`,
    integrityDecision,
    budgetDelta,
    details: { contractId: c.id, supplierId: c.followUp ? c.followUp.supplierId : undefined, verdictReason: c.verdictReason, day: currentDay }
  };
  session.applyOutcome(outcome);
  setFace(integrityDecision);

  const correct = integrityDecision === 'correct';
  fb.className = 'feedback ' + (correct ? 'correct':'wrong');
  fb.textContent = correct
    ? '✅ 올바른 판정입니다. 업체의 적격성을 정확하게 판단했습니다.'
    : (integrityDecision==='ordinaryWrong'
        ? '⚠️ 적격 업체를 반려했습니다. 필요한 물품의 공급이 늦어질 수 있습니다.'
        : '🚨 부실 업체를 승인했습니다. 납품 지연이나 품질 문제가 발생할 수 있습니다.');



  renderQueue();
}

function renderLog(){
  const el = document.getElementById('log-list');
  if(session.log.length===0){ el.innerHTML = '<div class="placeholder">아직 전달된 판정이 없습니다.</div>'; return; }
  el.innerHTML = session.log.map(o=>`<div class="log-item">${o.label}</div>`).join('');
}

/* -----------------------------------------------------------------------
   closeDay(): 마감 시점에 승인/반려로 "확정"되지 않은 모든 서류
   (한 번도 열어보지 않은 서류 + 보류(hold) 상태인 서류)를
   자동으로 "unresolved"(미처리) 판정으로 집계하여 패널티를 적용합니다.
   ----------------------------------------------------------------------- */
function closeDay(){persistContract();bridge.closeContract()}
window.lockContract=()=>{document.querySelectorAll('button').forEach(b=>b.disabled=true);document.getElementById('detail-panel').innerHTML='<div class="placeholder">오늘 계약 심사를 마감했습니다. 메인 화면에서 오늘 업무를 마치면 저녁 뉴스를 확인할 수 있습니다.</div>';renderQueue()};
renderQueue();if(bridge.isContractClosed())window.lockContract();else if(activeCaseId)openCase(activeCaseId);
