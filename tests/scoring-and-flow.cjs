const assert=require('node:assert/strict');
const System=require('../modules/golden-time-system.js');
const News=require('../modules/golden-time-news.js');
for(const [counts,wanted] of [[{correct:9,ordinaryWrong:1},86],[{correct:9,falseApprovals:1},80],[{correct:1,unresolved:1},20],[{unresolved:3},0],[{correct:3},100]])assert.equal(System.calculateIntegrityScore(counts),wanted);
const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const session=System.createSession(storage),news=News.create({session,system:System,storage:null,sound:false});
for(let day=1;day<=5;day++){
 assert.equal(session.getState().day,day);
 session.applyOutcome({source:'procurement-review',integrityDecision:'correct',budgetDelta:-8});
 session.applyOutcome({source:'procurement-review',integrityDecision:'unresolved',budgetDelta:0});
 news.reportDay(day,{contract:{correct:1,ordinaryWrong:0,falseApproval:0,unresolved:1}});
 session.closeDay();const n=news.getNightNews(day);assert.equal(n.metrics.length,4);
 if(day===1)session.beginDisaster(news.quake.status,news.objectives.map(x=>({id:x.id,label:x.label,target:x.target})));
 if(day<5){const effect=News.toMorningOutcome(news.getState(),n);assert(!Object.hasOwn(effect,'budgetDelta'));session.queueMorningOutcome(effect,`day-${day}-night-outcome`);session.applyMorningOutcomes();const once=session.getState();session.applyMorningOutcomes();assert.deepEqual(session.getState(),once)}
}
assert.equal(session.getState().budget,2960);assert.equal(session.getState().scores.integrity,20);assert.equal(session.getState().integrityStats.unresolved,5);assert(session.getState().finished);assert.equal(session.getState().dailyResults.length,5);assert.throws(()=>session.closeDay());
console.log('PASS: module 2 weights/unresolved; five-day news data; single morning effect; no news budget debit; final settlement.');
