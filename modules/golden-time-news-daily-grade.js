/* Read-only daily assessment for the evening news. Reuses system scoring. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GoldenTimeNewsDailyGrade=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function summarizeDay(system,state,day){
  if(!state||(state.dailyResults||[]).every(r=>r.day!==day))return null;
  let daily=system.createState({...state.rules,days:state.days,startingBudget:state.initialBudget});daily={...daily,day};
  for(const event of state.history||[]){
   if(event.day!==day)continue;
   const outcome={source:event.source,label:event.label};let scored=false;
   for(const key of ['integrityDecision','economicDecision','innovationDecision','budgetAssessment'])if(event[key]!=null){outcome[key]=event[key];scored=true;}
   if(event.scoreDeltas&&Object.values(event.scoreDeltas).some(v=>v!==0)){outcome.scoreDeltas={...event.scoreDeltas};scored=true;}
   if(scored)daily=system.applyOutcome(daily,outcome);
  }
  if(!system.getScoredCategories(daily).length)return null;
  const finalScore=system.calculateFinalScore(daily);return {day,finalScore,...system.getGrade(finalScore,state.rules)};
 }
 function attach(options){
  const root=options.root;
  function update(){
   root.querySelectorAll('.gtn-night,.gtn-ending').forEach(overlay=>{
    const stats=overlay.querySelector('.gtn-page[data-page="0"] .gtn-stats');if(!stats||stats.querySelector('.gtn-work-grade'))return;
    const day=parseInt(overlay.querySelector('.gtn-chip-day')?.textContent,10);if(!day)return;
    const result=summarizeDay(options.system,options.getState(),day),card=document.createElement('section');card.className='gtn-stat gtn-work-grade';card.dataset.day=day;
    const label=document.createElement('span');label.textContent='오늘의 업무 성과';
    const value=document.createElement('b');value.className='gtn-work-grade-value';
    const note=document.createElement('small');
    if(result){
     value.appendChild(document.createTextNode(result.grade+'등급'));
     const score=document.createElement('span');score.className='gtn-work-score';score.textContent=result.finalScore+'점';value.appendChild(score);
     note.textContent=day+'일차 · 오늘 확정된 업무 기준';card.dataset.grade=result.grade;card.dataset.score=String(result.finalScore);
    }else{value.textContent='미평가';note.textContent=day+'일차 · 평가된 업무가 없어요';}
    card.append(label,value,note);stats.prepend(card);
   });
  }
  const observer=new MutationObserver(update);observer.observe(root,{childList:true,subtree:true});update();return ()=>observer.disconnect();
 }
 return {summarizeDay,attach};
});
