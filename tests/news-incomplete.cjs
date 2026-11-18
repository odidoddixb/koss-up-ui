const assert=require('node:assert/strict');const path=require('path');
const N=require(path.join(__dirname,'..','modules','golden-time-news.js'));
const session={getState:()=>({day:1}),applyMorningOutcomes(){},beginDisaster(){},queueMorningOutcome(){}};
const news=N.create({session,storage:null});

// 1) 마치지 못한 업무는 전날 값·점수를 물려받지 않고 "미완료 / 실패"로 처리된다.
news.reportDay(1,{contract:{correct:3,unresolved:1},incomplete:['reserve','innovation']});
const n1=news.getNightNews(1),c=Object.fromEntries(n1.causes.map(x=>[x.key,x]));
assert.deepEqual(news.getState().raw[1].incomplete,['reserve','innovation']);
assert.equal(c.reserve.tier,'bad');assert.match(c.reserve.input,/마치지 못했어요/);assert.doesNotMatch(c.reserve.title+c.reserve.body,/확보|절반|즉시 방출/);
assert.match(c.innovation.input,/마치지 못했어요/);assert.doesNotMatch(c.innovation.input,/앞서 지원한 기업/);

// 2) 미처리 서류는 카드와 기사에 나온다.
assert.match(c.contract.input,/미처리 1건/);assert.match(c.contract.input,/심사 4건/);assert.match(c.contract.title+c.contract.body,/미처리|심사하지 못한|서류/);assert.doesNotMatch(c.contract.body,/적격 업체가 심사에서 떨어지면서/);

// 3) 나중에 결과가 들어오면 미완료 표시가 풀린다.
news.reportDay(2,{incomplete:['reserve']});assert.deepEqual(news.getState().raw[2].incomplete,['reserve']);
news.reportDay(2,{reserve:{requiredQuantity:10,availableQuantity:8}});assert.deepEqual(news.getState().raw[2].incomplete,[]);assert.equal(news.getState().inputs[2].reserveQ,0.8);

// 4) 이미 결과가 있는 업무는 incomplete가 덮어쓰지 않는다.
news.reportDay(3,{reserve:{requiredQuantity:10,availableQuantity:10}});news.reportDay(3,{incomplete:['reserve']});
assert.equal(news.getState().inputs[3].reserveQ,1);assert.deepEqual(news.getState().raw[3].incomplete,[]);

// 5) 혁신 결과 문구는 지원/거절 여부와 무관한 표현이다.
news.reportDay(4,{innovation:{decision:'success'}});assert.doesNotMatch(news.getNightNews(4).causes[2].input,/지원한/);

// 6) incomplete를 보내지 않으면 기존 동작(점수·전날 값 대체)과 같다.
const base=N.freshState();base.inputs[1]=N.normalizeInputs({contract:{correct:3},reserve:{fulfillment:1},innovation:{decision:'success'}});
assert.equal(N.buildNightNews(base,1,null).progress,10);
// 7) 드론 이야기는 1일차 드론 기업의 결정에서만 나온다. 2~5일차는 그날 기업의 제품 기사가 나온다.
{const nw=N.create({session,storage:null}),b={contract:{correct:3},reserve:{requiredQuantity:10,availableQuantity:10}};
 nw.reportDay(1,{...b,innovation:{decision:'failure'}});nw.reportDay(2,{...b,innovation:{decision:'success'}});nw.reportDay(3,{...b,innovation:{decision:'success'}});nw.reportDay(5,{...b,incomplete:['innovation']});
 assert.equal(nw.getNightNews(1).droneLevel,0);assert.equal(nw.getNightNews(2).droneLevel,0,'이후 날의 성공이 드론 효과를 만들면 안 된다');
 assert.match(nw.getNightNews(2).causes[2].title,/통신장비/);assert.doesNotMatch(nw.getNightNews(2).causes[2].title,/드론/);
 assert.match(nw.getNightNews(3).causes[2].title,/도입 보류/); // 검증 안 된 의료기기는 거절이 success
 assert.match(nw.getNightNews(5).causes[2].title,/지원 결정 못 내려/);
 const dr=N.create({session,storage:null});dr.reportDay(1,{...b,innovation:{decision:'success'}});assert.equal(dr.getNightNews(1).droneLevel,1);}

console.log('PASS: incomplete tasks, unresolved contracts and neutral innovation copy.');
