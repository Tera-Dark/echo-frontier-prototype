/* Campaign progression and chapter framing. Pure data and rules shared by Web/App. */
(function(root) {
 "use strict";
 const RESEARCH=[
  {id:"runner",name:"迅猎者",requires:1,cost:45,summary:"第一份活性样本 · 高速追击溃逃人类",story:"那些跑得最快的感染者，似乎还保留着生前的肌肉记忆。"},
  {id:"brute",name:"重尸",requires:2,cost:90,summary:"骨骼过度增生 · 正面突破防线",story:"钢门挡得住饥饿，却挡不住一副不停生长的骨架。"},
  {id:"spitter",name:"喷吐者",requires:3,cost:135,summary:"感染腺体异变 · 远程腐蚀压制",story:"它并不靠近猎物。空气本身开始替它狩猎。"}
 ];
 const STORY=[
  {kicker:"序章 · 零号信号",title:"第一声饥饿",line:"南湾，19:43。城市最后一段求救信号消失了。某种意识在雨后的街道苏醒。",goal:"只有一只普通行尸能够回应你的呼唤。点击空地，赋予它第一个方向。"},
  {kicker:"第一章 · 尸巢回响",title:"它们开始奔跑",line:"避难所沦陷后，巢群获得了第一份活性样本。更快的躯体也许能追上最后的撤离者。",goal:"在尸巢研究迅猎者。研究完成后，再突破公路检查站。"},
  {kicker:"第二章 · 破城者",title:"钢门之下",line:"检查站的钢铁残骸中，一具感染体正在改造自己的骨骼。人类开始修筑更高的墙。",goal:"研究重尸，试着用它撕开下一道防线。"},
  {kicker:"第三章 · 瘟疫呼吸",title:"最后的广播",line:"所有电台都在播放同一段撤离通告，但没有人再能回答。巢群开始改变空气。",goal:"研究喷吐者，继续扩张感染区。"}
 ];
 function clearCount(meta){return Math.max(0,Number(meta?.cleared?.nz)||0,Number(meta?.cleared?.pt)||0);}
 function isAvailable(meta,id){const item=RESEARCH.find(x=>x.id===id);return !!item&&clearCount(meta)>=item.requires;}
 function isResearched(meta,id){return id==="walker"||!!meta?.research?.[id];}
 function storyFor(meta){return STORY[Math.min(clearCount(meta),STORY.length-1)];}
 function canResearch(meta,id){const item=RESEARCH.find(x=>x.id===id);return !!item&&isAvailable(meta,id)&&!isResearched(meta,id)&&meta.biomass>=item.cost;}
 root.HungerCore=Object.assign(root.HungerCore||{},{RESEARCH,STORY,clearCount,isAvailable,isResearched,storyFor,canResearch});
})(typeof window!=="undefined"?window:globalThis);
