// Visible class model: Grade + Section Code + Orientation.
// Legacy internal keys (for example 6A/6B) remain hidden so existing mappings keep working.
(function(){
  function txt(v){return String(v??"").trim()}
  function ordinal(n){n=Number(n);if(!Number.isFinite(n))return txt(n);const m=n%100;const s=(m>=11&&m<=13)?"th":({1:"st",2:"nd",3:"rd"}[n%10]||"th");return `${n}${s}`}
  function allSections(){try{return Array.isArray(SECTIONS)?SECTIONS:[]}catch(e){return[]}}
  function metaFor(value){const v=txt(value);return allSections().find(s=>txt(s.section)===v||txt(s.batch)===v)||null}
  function sectionCode(meta){if(!meta)return"";const raw=txt(meta.batch)||txt(meta.section);return /^\d+(?:st|nd|rd|th)\s+techno$/i.test(raw)?"Techno":raw}
  function compact(meta){return meta?`${ordinal(meta.grade)} · ${sectionCode(meta)}`:""}
  function full(meta){return meta?[ordinal(meta.grade),sectionCode(meta),txt(meta.program)].filter(Boolean).join(" · "):""}
  window.syllabusGradeLabel=ordinal;
  window.syllabusSectionCode=v=>sectionCode(typeof v==="object"?v:metaFor(v));
  window.syllabusClassLabel=v=>compact(typeof v==="object"?v:metaFor(v));
  window.syllabusClassFullLabel=v=>full(typeof v==="object"?v:metaFor(v));

  function relabelOptions(root=document){
    for(const opt of root.querySelectorAll?.("select option")||[]){const meta=metaFor(opt.value);if(meta){const label=full(meta);if(opt.textContent!==label)opt.textContent=label}}
  }
  function relabelHeadings(root=document){
    const replacements=new Map([["Class & Section","Grade / Section / Orientation"],["Class/Section","Grade / Section"],["Class/Sec","Grade / Section"],["Class","Grade / Section"]]);
    for(const el of root.querySelectorAll?.("label,th,.eyebrow,.panel-head h3,.metric small")||[]){const t=txt(el.textContent);if(replacements.has(t)){const label=replacements.get(t);if(el.textContent!==label)el.textContent=label}}
  }
  function relabelLegacyText(root=document){
    const map=new Map(allSections().map(s=>[txt(s.section),compact(s)]).filter(([k])=>k));if(!map.size)return;
    const walker=document.createTreeWalker(root.body||root,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;if(!p||["SCRIPT","STYLE","OPTION","TEXTAREA","INPUT"].includes(p.tagName))return NodeFilter.FILTER_REJECT;return map.has(txt(node.nodeValue))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes)n.nodeValue=map.get(txt(n.nodeValue))
  }
  function apply(){relabelOptions(document);relabelHeadings(document);relabelLegacyText(document)}
  let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
  if(typeof applyRemoteData==="function"){const previous=applyRemoteData;applyRemoteData=function(r){const out=previous(r);queue();return out}}
  if(typeof renderAll==="function"){const previous=renderAll;renderAll=function(){const out=previous();queue();return out}}
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});queue();
})();