/* Presentation only: choose Dari's face from the visible news context. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GoldenTimeNewsExpressions=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const moodFace={joy:'happy',relief:'happy',worry:'worry',upset:'sad',angry:'sad'};
 function results(news){
  const tiers=(news.causes||[]).map(c=>c.tier),good=tiers.filter(t=>t==='good').length,bad=tiers.filter(t=>t==='bad').length;
  if(bad>good)return 'sad';if(good>bad)return bad?'worry':'happy';if(bad)return 'worry';return news.dariMood||'calm';
 }
 function articleMood(article){
  if(article.tone==='bad')return 'sad';if(article.tone==='good')return 'happy';
  const text=article.title||'';
  if(/유령|담합|부실|불량|회수|차질|고립|붕괴|여진|피해|급등|폭등|부족|지연|위험/.test(text))return 'worry';
  if(/성공|활약|재개|정상화|하락|입항|재건|확보|복구 완료|다시 웃/.test(text))return 'happy';
  return 'calm';
 }
 function chooseMood(news,context){
  const c=context||{},page=c.page||0;
  if(c.tier)return {good:'happy',mid:'worry',bad:'sad'}[c.tier]||'calm';
  if(news.type==='morning'){
   if(page===1)return news.day===1?'happy':'calm';
   if(c.article>0&&news.articles[c.article-1])return articleMood(news.articles[c.article-1]);
   return {1:'happy',2:'worry',3:'worry',4:'sad',5:news.progress>=85?'happy':'calm'}[news.day]||'calm';
  }
  if(page===0)return news.day===1?'worry':news.type==='ending'?news.dariMood:results(news);
  if(page===1)return results(news);
  if(page===2)return moodFace[news.mood]||results(news);
  return news.dariMood||results(news);
 }
 function attach(options){
  const root=options.root,api=options.news,assets=options.assets;let hovered=null;
  function update(){
   root.querySelectorAll('.gtn-overlay').forEach(overlay=>{
    const image=overlay.querySelector('img.gtn-dari'),page=overlay.querySelector('.gtn-page:not([hidden])');
    if(!image||!page)return;
    const day=parseInt(overlay.querySelector('.gtn-chip-day')?.textContent,10);if(!day)return;
    const news=overlay.classList.contains('gtn-morning')?api.getMorningNews(day):api.getNightNews(day);
    const selected=overlay.querySelector('.gtn-item.gtn-on'),card=hovered&&overlay.contains(hovered)&&page.contains(hovered)?hovered:null;
    const tier=card?['good','mid','bad'].find(t=>card.classList.contains('gtn-tier-'+t)):null;
    const mood=chooseMood(news,{page:Number(page.dataset.page),article:selected?Number(selected.dataset.i):0,tier});
    const src=assets[mood]||assets.calm;
    if(image.getAttribute('src')!==src)image.setAttribute('src',src);
    image.dataset.mood=mood;
    image.alt='달이 · '+({happy:'기쁨',calm:'기본',worry:'걱정',sad:'슬픔'}[mood])+' 표정';
   });
  }
  const observer=new MutationObserver(update);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  function enter(event){const card=event.target.closest?.('.gtn-cause');if(card!==hovered){hovered=card;update();}}
  function leave(event){if(hovered&&!hovered.contains(event.relatedTarget)){hovered=null;update();}}
  root.addEventListener('pointerover',enter);root.addEventListener('focusin',enter);root.addEventListener('pointerout',leave);root.addEventListener('focusout',leave);update();
  return ()=>{observer.disconnect();root.removeEventListener('pointerover',enter);root.removeEventListener('focusin',enter);root.removeEventListener('pointerout',leave);root.removeEventListener('focusout',leave);};
 }
 return {chooseMood,attach};
});
