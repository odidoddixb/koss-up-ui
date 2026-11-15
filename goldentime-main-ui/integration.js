/* 1/2/5/6 integration. The session alone owns dates, budgets and scores. */
(function(){
 'use strict';
 const SYS=window.GoldenTimeSystem;
 const keys={system:'goldentime-system-integrated-v1',contracts:'goldentime-contracts-v1',flow:'goldentime-flow-v1',news:'goldentime-news-integrated-v1',profile:'goldentime-profile-configured-v1',soundMigration:'goldentime-original-sound-default-v1'};
 const read=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k))||fallback}catch{return fallback}};
 const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let session=SYS.createSession(localStorage,{saveKey:keys.system,rankingKey:'goldentime-ranking-integrated-v1'});
 let unbindLifecycle=session.bindPageLifecycle(window);if(!session.getState().finished)session.start();
 const newsStage=document.createElement('div');newsStage.id='news-stage';newsStage.hidden=true;document.body.appendChild(newsStage);
 const citizenFaces=(happy,worry,upset)=>({joy:happy,relief:happy,worry,upset,angry:upset,default:happy});
 const newsAssets={
  dari:{happy:'assets/news/dari-happy.png',calm:'assets/news/dari-calm.png',worry:'assets/news/dari-worry.png',sad:'assets/news/dari-sad.png'},
  citizens:{
   evacuee:citizenFaces('assets/news/evacuee-happy.png','assets/news/evacuee-worry.png','assets/news/evacuee-upset.png'),
   driver:citizenFaces('assets/news/driver-happy.png','assets/news/driver-worry.png','assets/news/driver-upset.png'),
   nurse:citizenFaces('assets/news/nurse-happy.png','assets/news/nurse-worry.png','assets/news/nurse-upset.png')
  },
  scenes:{quake:'assets/news/disaster.jpg',bridge:'assets/news/disaster.jpg',warehouse:'assets/news/warehouse.jpg',office:'assets/news/office.jpg'}
 };
 let newsModule=window.GoldenTimeNews.create({session,system:SYS,mount:newsStage,storage:localStorage,storageKey:keys.news,assets:newsAssets});
 // One-time repair of stale mute state; subsequent user mute choices remain saved.
 if(!read(keys.soundMigration,false)){newsModule.setMuted(false);write(keys.soundMigration,true)}
 let contracts=read(keys.contracts,{}),busy=false;
 state.avatar='female';state.avatarSelectionVersion=3;write('goldentime-v1',{name:state.name,avatar:'female',avatarSelectionVersion:3});
 const originalRender=render,originalView=view;
 function counts(day){const out={correct:0,ordinaryWrong:0,falseApproval:0,unresolved:0};session.getState().history.forEach(e=>{if(e.source==='procurement-review'&&(day===undefined||e.day===day)&&Object.hasOwn(out,e.integrityDecision))out[e.integrityDecision]++});return out}
 function getContract(day=session.getState().day){
  if(!contracts[day]){contracts[day]={day,dayCases:ContractData.generateDay(day),investLeft:5,activeCaseId:null,decisions:{},investigated:{},closed:false};write(keys.contracts,contracts)}
  const d=contracts[day];
  // Recover a decision saved by the system even if the browser closed before the module snapshot.
  session.getState().history.filter(e=>e.day===day&&e.source==='procurement-review').forEach(e=>{if(e.details?.contractId)d.decisions[e.details.contractId]=e.integrityDecision==='unresolved'?'unresolved':e.details.choice||(e.budgetDelta<0?'approve':'reject')});
  return structuredClone(d);
 }
 function saveContract(snapshot){if(snapshot.day!==session.getState().day||contracts[snapshot.day]?.closed)return;contracts[snapshot.day]={...snapshot,closed:false};write(keys.contracts,contracts)}
 function report(day){newsModule.reportDay(day,{contract:counts(day)})}
 function applyContract(outcome){
  const g=session.getState();if(g.finished||contracts[g.day]?.closed)throw Error('오늘 계약 심사는 이미 마감했습니다.');
  const id=outcome.details?.contractId;
  if(!id||!getContract().dayCases.some(c=>c.id===id))throw Error('등록되지 않은 계약입니다.');
  if(g.history.some(e=>e.source==='procurement-review'&&e.day===g.day&&e.details?.contractId===id))return g;
  const next=session.applyOutcome({...outcome,source:'procurement-review',details:{...outcome.details,day:g.day,choice:outcome.integrityDecision==='unresolved'?'unresolved':outcome.budgetDelta<0?'approve':'reject'}});
  report(g.day);render();return next;
 }
 function syncFrame(){const frame=document.querySelector('#contract-frame');if(frame?.contentWindow?.exportContractState)saveContract(frame.contentWindow.exportContractState())}
 function unresolvedCount(){syncFrame();const d=getContract();return d.dayCases.filter(c=>!['approve','reject','unresolved'].includes(d.decisions[c.id])).length}
 function settleContract(){
  syncFrame();const day=session.getState().day,d=getContract();if(d.closed)return;
  for(const c of d.dayCases){if(!['approve','reject','unresolved'].includes(d.decisions[c.id])){applyContract({source:'procurement-review',label:c.name+' 미처리 마감',integrityDecision:'unresolved',budgetDelta:0,details:{contractId:c.id,supplierId:c.followUp?.supplierId,day,reason:'하루 안에 승인/반려를 확정하지 않음'}});d.decisions[c.id]='unresolved'}}
  contracts[day]={...d,closed:true};write(keys.contracts,contracts);report(day);render();
  const frame=document.querySelector('#contract-frame');if(frame?.contentWindow?.lockContract)frame.contentWindow.lockContract();
 }
 window.GoldenTimeBridge={getState:()=>session.getState(),getContract,saveContract,counts,contractLog:()=>session.getState().history.filter(e=>e.source==='procurement-review'),applyContract,isContractClosed:()=>Boolean(contracts[session.getState().day]?.closed)||session.getState().finished,closeContract:()=>{if(busy)return;const missing=unresolvedCount();if(missing&&!confirm(`미확정 계약 ${missing}건을 미처리로 마감할까요? 미처리 1건은 -60점 기준으로 계산됩니다.`))return;settleContract();toast('계약 심사를 마감했습니다. 오늘 업무 마치기에서 정산해 주세요.')}};
 render=function(){
  const g=session.getState(),all=counts();state.day=g.day;state.budget=g.budget;state.correct=all.correct;state.total=Object.values(all).reduce((a,b)=>a+b,0);state.recovery=Math.round(g.finished?newsModule.getNightNews(5).progress:g.disaster.progress);state.completed=contracts[g.day]?.closed?[0]:[];
  originalRender();$('#budget').textContent=Number.isInteger(g.budget)?g.budget:g.budget.toFixed(1);
  const vals=document.querySelectorAll('.stat-value');vals[1].textContent='—';vals[2].textContent=SYS.getScoredCategories(g).includes('integrity')?g.scores.integrity:'—';
  $('#phase').textContent=g.finished?'5일간 업무 완료':phases[g.day-1];$('#task-count').textContent=`(${state.completed.length}/1)`;
  document.querySelectorAll('.work-card').forEach((b,i)=>{if(i>0){b.classList.add('module-pending');b.querySelector('.pending').textContent='준비 중'}});
  $('#task-list').querySelectorAll('li').forEach((li,i)=>{if(i>0){li.classList.add('module-pending');li.querySelector('.task-label').textContent=['','원자재 비축 · 준비 중','혁신제품 지원 · 준비 중'][i]}});
  const morning=newsModule.getMorningNews(g.day);$('#headline').textContent=morning.headline?.title||morning.title||headlines[g.day-1];
  $('.news-teaser p').textContent=g.day===1?'1일차 밤 23:47 지진 발생에 대비해 물자를 준비하세요.':'현장 상황과 오늘의 업무 포인트를 확인하세요.';
  $('#recovery-state').textContent=g.disaster.active?'복구 중':'지진 발생 전';$('#progress-label').textContent=`복구율 ${state.recovery}%`;
  $('#end-day').textContent=g.finished?'최종 성과 확인':'오늘 업무 마치기 →';
 };
 save=function(){write(keys.profile,true);write('goldentime-v1',{name:state.name,avatar:state.avatar,avatarSelectionVersion:state.avatarSelectionVersion});render()};
 function restartGame(){
  if(busy)return;
  unbindLifecycle();session.pause();newsModule.reset();
  newsStage.replaceChildren();newsStage.hidden=true;$('#other-view').replaceChildren();
  [keys.system,keys.contracts,keys.flow,keys.news,keys.profile,'goldentime-v1'].forEach(k=>localStorage.removeItem(k));
  contracts={};state.name='';state.avatar='female';state.avatarSelectionVersion=3;
  session=SYS.createSession(localStorage,{saveKey:keys.system,rankingKey:'goldentime-ranking-integrated-v1'});
  unbindLifecycle=session.bindPageLifecycle(window);session.start();
  newsModule=window.GoldenTimeNews.create({session,system:SYS,mount:newsStage,storage:localStorage,storageKey:keys.news,assets:newsAssets});
  window.GoldenTime.session=session;window.GoldenTime.news=newsModule;window.GoldenTimeNewsInstance=newsModule;
  close();render();view('home');setup(false);
 }
 function renderResults(){const g=session.getState(),summary=SYS.summarize(g),scored=new Set(summary.scoredCategories),labels={integrity:'청렴도',economicDefense:'경제 방어력',innovation:'혁신 기여도',budgetPerformance:'예산 결산'},c=counts();
  $('#other-view').innerHTML=`<div class="view-heading"><span class="eyebrow">SHARED GAME SYSTEM</span><h1>${g.finished?'최종 업무 성적표':'나의 업무 성과'}</h1><p>2번 계약 심사 기준 · 정답 +100 / 일반 오답 −40 / 부실 승인 −100 / 미처리 −60</p></div><article class="content-panel"><div class="result-grid">${Object.entries(labels).map(([k,l])=>`<div><small>${l}</small><b>${scored.has(k)?summary.scores[k]+'점':'미평가'}</b></div>`).join('')}</div><p>종합 ${summary.finalScore}점 · ${summary.grade}등급 · 가용 예산 ${g.budget.toFixed(1)}억 원</p><p>정답 ${c.correct}건 · 일반 오답 ${c.ordinaryWrong}건 · 부실 승인 ${c.falseApproval}건 · 미처리 ${c.unresolved}건</p><p>3·4번은 준비 중입니다. 미평가 항목은 종합 점수에서 제외됩니다. 재난 복구율은 별도의 현장 지표입니다.</p></article><article class="content-panel"><h2>일일 성적표</h2>${g.dailyResults.length?g.dailyResults.map(d=>`<p>DAY ${d.day} · ${d.finalScore}점 · ${d.grade}등급 · ${d.budget.toFixed(1)}억 원</p>`).join(''):'<p>아직 마감한 날짜가 없습니다.</p>'}<button class="outline" id="archive-results">지난 뉴스 보기</button>${g.finished?' <button class="outline" id="restart-integrated">새 게임 시작</button>':''}</article>`;
  $('#archive-results').onclick=()=>openArchive();if($('#restart-integrated'))$('#restart-integrated').onclick=()=>{if(confirm('새 게임을 시작할까요? 이름을 다시 입력하고 1일차부터 시작합니다. 완료한 랭킹 기록은 유지됩니다.'))restartGame()};
 }
 view=function(v){originalView(v);if(v==='work'){
  const host=$('#work-module');if(tab===0){host.innerHTML='<div class="integration-toolbar"><span>하루 조사 5회 · 승인/반려/보류 · 계약 심사 기준 적용</span><button class="outline" id="contract-home">대시보드로</button></div><iframe id="contract-frame" title="나라장터 계약 심사 업무"></iframe>';$('#contract-home').onclick=()=>view('home');$('#contract-frame').srcdoc=window.GoldenTimeContractDocument}
  else host.innerHTML='<div class="integration"><h3>준비 중인 업무입니다.</h3><p>담당자의 코드가 도착하면 공통 시스템에 연결합니다. 현재 이 항목에는 점수를 부여하지 않습니다.</p></div>';
 }else if(v==='results')renderResults();else if(v==='ranking'){
  const rows=read('goldentime-ranking-integrated-v1',[]);$('#other-view').innerHTML='<div class="view-heading"><h1>완료 게임 랭킹</h1><p>이 브라우저에 저장된 5일 완료 기록입니다.</p></div><article class="content-panel">'+(rows.length?rows.map((r,i)=>`<p>${r.rank||i+1}. ${esc(r.name)} · ${r.finalScore}점 · ${r.grade}등급</p>`).join(''):'<p>아직 5일을 완료한 기록이 없습니다.</p>')+'</article>';
 }else if(v==='help'){const p=document.createElement('article');p.className='content-panel';p.innerHTML='<h2>현재 통합 범위</h2><p>계약 심사·뉴스·시스템이 연결되어 있습니다. 3·4번은 준비 중이며, 해당 분야의 뉴스는 뉴스 모듈의 기본 시나리오로 표시됩니다. 게임은 3,000억 원으로 시작합니다.</p><button class="outline" id="archive-help">지난 뉴스 보기</button>';$('#other-view').appendChild(p);$('#archive-help').onclick=()=>openArchive()}
 };
 function lock(value){busy=value;document.querySelector('.app').inert=value||!newsStage.hidden}
 function flow(){return read(keys.flow,null)}
 async function showMorning(fromCommute=false){if(busy)return;if(flow()?.phase==='morning'&&!fromCommute){showCommute();return;}newsModule.resumeSound();showCommute(true);newsStage.classList.add('morning-stage');render();view('home');lock(true);try{await newsModule.playMorning({day:session.getState().day});localStorage.removeItem(keys.flow);render();view('home');newsStage.hidden=true;newsStage.replaceChildren();newsStage.classList.remove('morning-stage')}finally{lock(false)}}
 async function showNight(day){if(busy)return;newsModule.resumeSound();lock(true);showCommute(true);try{await newsModule.playNight({day});write(keys.flow,{day,phase:session.getState().finished?'ending':'morning'});render();if(session.getState().finished){session.finalizeRanking(state.name||'플레이어');localStorage.removeItem(keys.flow);view('results');newsStage.hidden=true;newsStage.replaceChildren()}}finally{lock(false)}if(!session.getState().finished)showCommute()}
 function endDay(){if(busy)return;if(session.getState().finished){view('results');return}const pending=flow();if(pending?.phase==='night'){showNight(pending.day);return}const n=unresolvedCount();show(`<div class="modal-inner"><h2>오늘 업무를 마칠까요?</h2><p>미확정 계약 ${n}건${n?'은 미처리로 마감됩니다. 미처리는 1건당 −60점 기준으로 평가됩니다.':'입니다.'}</p><p>퇴근 후 저녁 뉴스를 확인합니다. 다음 날은 출근하기를 눌러 아침 뉴스로 시작해요.</p><div class="modal-actions"><button class="outline" id="stay-integrated">계속 근무</button><button class="primary" id="finish-integrated">🌙 퇴근하고 저녁 뉴스 보기</button></div></div>`);$('#stay-integrated').onclick=close;$('#finish-integrated').onclick=()=>{close();if(busy)return;settleContract();const day=session.getState().day;write(keys.flow,{day,phase:'night'});session.closeDay();render();showNight(day)}}
 news=function(evening=false){if(evening)return endDay();const p=flow();if(p?.phase==='night')return showNight(p.day);if(p?.phase==='ending')return showNight(p.day);return showMorning()};
 const newsWidget=document.createElement('div');newsWidget.className='news-widget';$('#news-card').before(newsWidget);newsWidget.append($('#news-card'),$('#end-day'));
 $('#morning').onclick=$('#news-card').onclick=()=>news(false);$('#end-day').onclick=endDay;
 window.GoldenTime={session,news:newsModule,getState:()=>({...session.getState(),profile:{name:state.name,avatar:state.avatar}}),navigate:view,openTab:i=>{if(Number.isInteger(i)&&i>=0&&i<3){tab=i;view('work')}},applyOutcome:o=>{const g=session.applyOutcome(o);render();return g},reportDay:(d,o)=>newsModule.reportDay(d,o)};
 window.GoldenTimeNewsInstance=newsModule;
 function openArchive(){const hidden=newsStage.hidden,app=document.querySelector('.app'),inert=app.inert;newsStage.hidden=false;app.inert=true;newsModule.resumeSound();return newsModule.openArchive().finally(()=>{newsStage.hidden=hidden;app.inert=inert})}
 function showCommute(background=false){
  newsStage.hidden=false;document.querySelector('.app').inert=true;
  const existing=document.querySelector('#commute-screen');
  if(existing){existing.inert=background;existing.classList.toggle('commute-prepared',background);if(!background)existing.focus();return;}
  const g=session.getState(),metrics=Object.values(g.disaster.metrics||{});
  const screen=document.createElement('div');screen.id='commute-screen';screen.className='commute-screen';screen.tabIndex=-1;screen.setAttribute('aria-label',`${g.day}일차 출근 준비`);
  screen.innerHTML=`<section class="commute-stage"><div class="commute-hud"><span class="commute-brand"><small>조달청</small><strong>프로젝트 <em>골든타임</em></strong></span><strong class="commute-day">${g.day}일차${g.disaster.active?' · D+'+(g.day-1):''}</strong><span class="commute-budget">예산 ${g.budget.toLocaleString('ko-KR',{maximumFractionDigits:1})}억 원</span><button type="button" class="commute-archive" id="commute-archive">▤ 지난 뉴스</button></div><div class="commute-center"><button type="button" class="commute-go" id="commute-go">☀️ ${g.day}일차 출근하기</button><p class="commute-caption">달이가 아침 뉴스를 준비했어요</p></div>${g.disaster.active?`<div class="commute-metrics">${metrics.map(m=>`<div class="commute-metric"><div><span>${esc(m.label)}</span><b>${m.achieved||0}/${m.target}</b></div><span class="commute-track"><i style="width:${Math.max(0,Math.min(100,100*(m.achieved||0)/m.target))}%"></i></span></div>`).join('')}<div class="commute-total"><strong>${Math.round(g.disaster.progress)}%</strong><small>${esc(g.disaster.status)}</small></div></div>`:'<p class="commute-note">오늘의 공공조달 업무를 시작할 준비가 되었나요?</p>'}</section>`;
  newsStage.appendChild(screen);screen.inert=background;screen.classList.toggle('commute-prepared',background);
  const commuteButton=$('#commute-go');let commuteArmed=false;
  commuteButton.addEventListener('pointerdown',e=>{commuteArmed=!screen.inert&&e.detail<2});
  commuteButton.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){commuteArmed=!screen.inert&&!e.repeat;if(e.repeat)e.preventDefault()}});
  commuteButton.onclick=e=>{const intentional=commuteArmed&&e.detail<2;commuteArmed=false;if(intentional&&!screen.inert)showMorning(true)};
  if(!background)screen.focus();
  $('#commute-archive').onclick=()=>{screen.inert=true;newsModule.resumeSound();openArchive().then(()=>{screen.inert=false;$('#commute-archive').focus()})};
 }
 function requestResume(){
  show(`<div class="modal-inner"><span class="modal-eyebrow">PROJECT GOLDEN TIME</span><h2>다시 오셨네요, 주무관님!</h2><p>저장된 ${session.getState().day}일차 근무를 이어서 시작합니다.</p><div class="modal-actions"><button class="primary" id="resume-integrated" type="button">이어서 근무하기 →</button></div></div>`);
  modal.dataset.profileRequired='true';
  $('#resume-integrated').onclick=()=>{close();const p=flow();if(p?.phase==='night'||p?.phase==='ending')showNight(p.day);else showMorning()};
 }
 // Resume an interrupted settlement before allowing another day to close.
 const p=flow();if(p?.phase==='night'&&!session.getState().dailyResults.some(d=>d.day===p.day))localStorage.removeItem(keys.flow);
 render();const needsProfile=!state.name||(!read(keys.profile,false)&&session.getState().day===1&&session.getState().history.length===0&&!session.getState().finished);if(needsProfile)setup(false);else if(session.getState().finished&&!flow())view('results');else if(flow()?.phase==='morning')showCommute();else requestResume();
})();
