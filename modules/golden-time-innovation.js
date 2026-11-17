/* 프로젝트 골든타임 · 4번 혁신제품 시범구매 모듈 (UI/시나리오/연동만 담당) */
(function(root){
'use strict';
const CASES = [
 {id:'drone',day:1,company:'하늘테크',product:'재난 물자 운송 드론',icon:'🚁',cost:50,quality:'good',intro:'도로가 끊긴 지역에 소형 구호물품을 전달하는 운송 드론을 개발했습니다.',facts:['최대 5kg 물품을 운송하며, 강풍일 때는 비행을 중단합니다.','기본 비행 안전 시험을 통과했습니다. 실제 현장 운용에는 담당 기관의 승인과 추가 점검이 필요합니다.','시범 장비 확보 이후 운용 계획을 수립할 수 있습니다.'],impact:'고립 지역 의료·생활 물품 운송 지원',evaluateDay:3},
 {id:'comms',day:2,company:'연결솔루션',product:'이동형 긴급 통신장비',icon:'📡',cost:35,quality:'good',intro:'통신망이 끊긴 지역에 임시 통신망을 구축할 수 있습니다.',facts:['이동형 중계기를 설치해 대피소와 현장 본부 간 연결을 지원합니다.','실증 시험 기록과 기본 안전 검사 결과가 제출돼 있습니다.','현장 여건이 충족되면 당일 장비 공급이 가능합니다.'],impact:'대피소와 현장 본부 간 연락 지원',evaluateDay:2},
 {id:'medical',day:3,company:'메디퀵',product:'AI 자동 진단 의료기기',icon:'🩺',cost:65,quality:'bad',intro:'AI로 환자를 빠르게 진단하는 장비를 현장에 투입하고 싶습니다.',facts:['영상 분석 결과를 자동으로 분류하는 장비입니다.','의료기기 인허가·임상 성능을 확인할 자료가 아직 충분하지 않습니다.','즉시 현장 도입을 요청하고 있지만 검증 완료 일정은 불명확합니다.'],impact:'검증 전 현장 사용 시 환자 안전 우려',evaluateDay:3},
 {id:'bridge',day:4,company:'안전센서랩',product:'교량 균열 탐지 센서',icon:'🌉',cost:40,quality:'limited',intro:'손상된 교량의 균열 위험을 감지하는 센서를 제안합니다.',facts:['균열 감지 데이터를 점검 담당자에게 전송합니다.','시험실 성능은 확인됐으나 지진 피해 현장 실증은 일부 구간에 한정됩니다.','검증된 일부 구간부터 제한적으로 도입할 수 있습니다.'],impact:'복구 현장 일부 구간 안전 점검 지원',evaluateDay:4},
 {id:'water',day:5,company:'클린워터',product:'이동형 정수장치',icon:'💧',cost:30,quality:'good',intro:'대피소에서 위생적인 식수를 확보할 수 있도록 돕겠습니다.',facts:['현장에 설치 가능한 이동형 정수장치입니다.','공인 수질 시험 결과가 제출돼 있으며 정기적인 필터 교체가 필요합니다.','장비와 교체 필터를 당일 공급할 수 있습니다.'],impact:'대피소 식수 공급 지원',evaluateDay:5}
];
const CHOICES={full:'전액 시범구매 지원',limited:'일부 시범구매 지원',reject:'지원 거절'};
const LABELS={success:'성공',partial:'부분 성공',failure:'실패'};
const clone=o=>JSON.parse(JSON.stringify(o));
const DEFAULT_KEY='golden-time-innovation-progress-v4';
function create({session,news=null,mount,storage,saveKey=DEFAULT_KEY,onChange=()=>{}}={}){
 if(!session||typeof session.getState!=='function'||typeof session.applyOutcome!=='function')throw Error('공용 session.getState / applyOutcome이 필요합니다.');
 if(!mount)throw Error('4번 화면을 표시할 mount 요소가 필요합니다.');
 const store=storage===undefined?(typeof localStorage!=='undefined'?localStorage:null):storage;
 const fresh=()=>({version:4,decisions:{},evaluated:{},reported:{},questionByCase:{}});
 let data=fresh();
 try{const prior=store&&JSON.parse(store.getItem(saveKey)||'null');if(prior&&prior.version===4)data={...fresh(),...prior};}catch(e){console.warn('[innovation] 저장 데이터를 읽지 못했습니다.',e);}
 const save=()=>{try{if(store)store.setItem(saveKey,JSON.stringify(data));}catch(e){console.warn('[innovation] 저장 실패',e);}onChange(clone(data));};
 const day=()=>session.getState().day;
 const current=()=>CASES.find(c=>c.day===day());
 const getCost=(c,choice)=>choice==='full'?c.cost:choice==='limited'?Math.ceil(c.cost/2):0;
 function classify(c,choice,budgetAtDecision){
   if(c.quality==='bad')return choice==='reject'?'success':'failure';
   if(c.quality==='limited')return choice==='limited'?'success':choice==='full'?'partial':budgetAtDecision>=c.cost?'failure':'partial';
   if(choice==='full')return 'success';
   if(choice==='limited')return 'partial';
   return budgetAtDecision>=c.cost?'failure':'partial';
 }
 // 평가 결과가 실제 확인되는 날에만 6번 점수 시스템에 반영한다.
 function resolveDue(targetDay=day()){
   let changed=false;
   for(const c of CASES){
     const r=data.decisions[c.id];
     if(!r||data.evaluated[c.id]||c.evaluateDay>targetDay)continue;
     const result=classify(c,r.choice,r.budgetAtDecision);
     session.applyOutcome({source:'sme-support',label:c.product+' 활용 결과',innovationDecision:result,
       budgetAssessment:{allocatedBudget:c.cost,actualCost:r.spent,fulfillment:result==='success'?1:result==='partial'?0.5:0},
       details:{innovationId:c.id,decision:r.choice,result,verifiedDay:targetDay}});
     data.evaluated[c.id]=result;changed=true;
   }
   if(changed)save();
   render();
   return changed;
 }
 // 5번 뉴스에 대한 '당일' 전달. 한 날짜에 중복 보고하지 않는다.
 function reportDay(targetDay=day()){
   if(data.reported[targetDay])return false;
   const c=CASES.find(c=>c.day===targetDay);
   const record=c&&data.decisions[c.id];
   if(!record||!news||typeof news.reportDay!=='function')return false;
   // 시범구매 당일의 1차 결정 결과. 점수는 검증일 이후에만 확정된다.
   const result=data.evaluated[c.id]||classify(c,record.choice,record.budgetAtDecision);
   news.reportDay(targetDay,{innovation:{decision:result}});
   data.reported[targetDay]=true;save();
   return true;
 }
 function decide(choice){
   if(!Object.hasOwn(CHOICES,choice))throw Error('알 수 없는 지원 선택입니다.');
   const c=current();if(!c||data.decisions[c.id])return false;
   const budget=session.getState().budget,spent=getCost(c,choice);
   if(spent>budget){alert('현재 예산이 부족합니다. 지원 규모를 조정해 주세요.');return false;}
   if(spent>0)session.applyOutcome({source:'sme-support',label:c.product+' 시범구매 예산 집행',budgetDelta:-spent,
     details:{innovationId:c.id,choice,spent}});
   data.decisions[c.id]={id:c.id,day:c.day,choice,spent,budgetAtDecision:budget};save();
   resolveDue(day());reportDay(day());render();return true;
 }
 function render(){
   const c=current();
   if(!c){mount.innerHTML='<div class="gti-root"><div class="gti-panel">해당 날짜의 기업 심사가 없습니다.</div></div>';return;}
   const r=data.decisions[c.id],q=data.questionByCase[c.id];
   const root=document.createElement('section');root.className='gti-root';
   root.innerHTML=`<header class="gti-header"><div><small>PROJECT GOLDEN TIME · 04</small><h2>💡 혁신제품 시범구매</h2></div><div class="gti-chip">DAY ${c.day} <span>·</span> 예산 ${Number(session.getState().budget).toLocaleString('ko-KR')}억 원</div></header>
   <div class="gti-columns"><article class="gti-panel gti-person"><div class="gti-icon" aria-hidden="true">${c.icon}</div><div class="gti-person-name">${c.company} 대표</div><div class="gti-bubble" id="gti-bubble"></div><h3>대표에게 질문하기</h3><div id="gti-questions"></div></article>
   <article class="gti-panel"><div class="gti-section-label">📑 기업 제안서</div><h2 class="gti-product">${c.product}</h2><dl class="gti-details"><div><dt>기업명</dt><dd>${c.company}</dd></div><div><dt>제안 예산</dt><dd>${c.cost}억 원</dd></div><div><dt>기대 공공 가치</dt><dd>${c.impact}</dd></div></dl><div class="gti-note">📌 제품 성능·검증·납품 조건을 확인하고 지원 규모를 판단하세요.</div><div class="gti-actions" id="gti-actions"></div><div id="gti-result" aria-live="polite"></div></article></div>`;
   mount.replaceChildren(root);
   root.querySelector('#gti-bubble').textContent=Number.isInteger(q)?c.facts[q]:c.intro;
   const questions=root.querySelector('#gti-questions');
   ['제품의 성능을 설명해 주세요.','안전성 및 검증 자료가 있나요?','납품 일정과 활용 조건은 무엇인가요?'].forEach((label,i)=>{
     const b=document.createElement('button');b.type='button';b.className='gti-question';b.textContent=label;b.disabled=!!r;
     b.addEventListener('click',()=>{data.questionByCase[c.id]=i;save();render()});questions.append(b);
   });
   const actions=root.querySelector('#gti-actions');
   for(const [choice,label] of Object.entries(CHOICES)){
     const b=document.createElement('button');b.type='button';b.className='gti-action '+choice;b.textContent=label;b.disabled=!!r;b.addEventListener('click',()=>decide(choice));actions.append(b);
   }
   if(r){const evalResult=data.evaluated[c.id];const result=root.querySelector('#gti-result');result.className='gti-result';
     result.textContent=`결정 완료: ${CHOICES[r.choice]} · 집행 ${r.spent}억 원 · ${evalResult?'활용 평가 '+LABELS[evalResult]:'활용 결과 DAY '+c.evaluateDay+' 확인 예정'}`;
   }
 }
 function reset(){data=fresh();save();render();}
 return Object.freeze({render,decide,resolveDue,reportDay,reset,getData:()=>clone(data),getCases:()=>clone(CASES)});
}
root.GoldenTimeInnovation=Object.freeze({create,CASES:clone(CASES)});
})(typeof globalThis!=='undefined'?globalThis:window);
