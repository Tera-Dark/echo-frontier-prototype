/* Fixed-step simulation runner: stable game speed across 30/60/120 Hz screens. */
(function(root){
 "use strict";
 function createClock({step=1/30,maxSteps=5}={}){
  let accumulated=0;
  return{
   advance(seconds,onStep){
    if(!Number.isFinite(seconds)||seconds<=0)return 0;
    accumulated=Math.min(accumulated+Math.min(seconds,step*maxSteps),step*maxSteps);
    let steps=0;
    while(accumulated+1e-9>=step&&steps<maxSteps){
     onStep(step);accumulated-=step;steps++;
    }
    if(steps===maxSteps)accumulated=0;
    return steps;
   },
   reset(){accumulated=0;},
   get remainder(){return accumulated;}
  };
 }
 root.HungerCore=Object.assign(root.HungerCore||{},{createClock});
})(typeof window!=="undefined"?window:globalThis);
