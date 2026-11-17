const assert = require('node:assert/strict');
const News = require('../modules/golden-time-news.js');
const {chooseMood} = require('../modules/golden-time-news-expressions.js');
const api = News.create({storage:null, sound:false});
for (const [day,mood] of [[1,'happy'],[2,'worry'],[3,'worry'],[4,'sad'],[5,'calm']]) {
 const morning = api.getMorningNews(day);
 assert.equal(chooseMood(morning,{page:0}),mood);
 assert.equal(chooseMood(morning,{page:1}),day===1?'happy':'calm');
}
const first = api.getMorningNews(1);
assert.equal(chooseMood(first,{article:1}),'calm');
assert.equal(chooseMood(first,{article:0}),'happy');
for (const [input,wanted] of [
 [{contract:{correct:3},reserve:{requiredQuantity:10,availableQuantity:10},innovation:{decision:'success'}},'happy'],
 [{contract:{correct:0,falseApproval:3},reserve:{requiredQuantity:10,availableQuantity:0},innovation:{decision:'failure'}},'sad']
]) {
 const news=News.create({storage:null,sound:false});news.reportDay(2,input);
 const night=news.getNightNews(2),before=JSON.stringify(night);
 assert.equal(chooseMood(night,{page:0}),wanted);
 for (const cause of night.causes) assert.equal(chooseMood(night,{page:1,tier:cause.tier}),{good:'happy',mid:'worry',bad:'sad'}[cause.tier]);
 assert.equal(chooseMood(night,{page:2}),{joy:'happy',relief:'happy',worry:'worry',upset:'sad',angry:'sad'}[night.mood]);
 assert.equal(JSON.stringify(night),before,'Expression selection does not mutate news results');
}
console.log('PASS contextual Dari expressions: morning dates/pages, selected article, actual good/bad night results, individual result cards, map and unchanged result data.');
