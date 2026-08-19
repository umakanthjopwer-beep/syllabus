// Visible class model: Grade + Section Code + Orientation.
// Legacy internal keys (for example 6A/6B) remain hidden so existing mappings keep working.
(function(){
  function txt(v){return String(v??"").trim()}
  function ordinal(n){n=Number(n);if(!Number.isFinite(n))return txt(n);const m=n%100;const s=(m>=11&&m<=13)?"th":({1:"st",2:"nd",3:"rd"}[n%10]||"th");return `${n}${s}`}
  function allSections(){try{return Array.isArray(SECTIONS)?SECTIONS:[]}catch(e){return[]}}
  function metaFor(value){const v=txt(value);return allSections().find(s=>txt(s.section)===v||txt(s.batch)===v)||null}
  function sectionCode(meta){if(!meta)return"";const raw=txt(meta.batch)||txt(meta.section);return /^\d+(?:st|nd|rd|th)\s+techno$/i.test(raw)?"Techno":raw}
  function compact(meta){return meta?`${ordinal(meta.grade)} · ${sectionCode(meta)}`:""}
  function full(meta){if(!meta)return"";const code=sectionCode(meta),program=txt(meta.program);return [ordinal(meta.grade),code,program&&program.toLowerCase()!==code.toLowerCase()?program:""] .filter(Boolean).join(" · ")}
  window.syllabusGradeLabel=ordinal;
  window.syllabusSectionCode=v=>sectionCode(typeof v==="object"?v:metaFor(v));
  window.syllabusClassLabel=v=>compact(typeof v==="object"?v:metaFor(v));
  window.syllabusClassFullLabel=v=>full(typeof v==="object"?v:metaFor(v));

  function relabelOptions(root=document){
    for(const opt of root.querySelectorAll?.("select option")||[]){
      const meta=metaFor(opt.value);if(!meta)continue;
      const label=full(meta);if(opt.textContent!==label)opt.textContent=label
    }
  }

  // IMPORTANT: never set label.textContent. Doing so removes nested <select>/<input> controls.
  // Change only the label's own direct text node and preserve every child control.
  function replaceOwnLabelText(label,newText){
    if(!label)return;
    const direct=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&txt(n.nodeValue));
    if(direct){
      if(txt(direct.nodeValue)!==newText)direct.nodeValue=newText;
      return
    }
    // If markup has no direct text node, insert one before the first control instead of replacing children.
    label.insertBefore(document.createTextNode(newText),label.firstChild||null)
  }
  function relabelHeadings(root=document){
    const replacements=new Map([["Class & Section","Grade / Section / Orientation"],["Class/Section","Grade / Section"],["Class/Sec","Grade / Section"],["Class","Grade / Section"]]);
    for(const el of root.querySelectorAll?.("label,th,.eyebrow,.panel-head h3,.metric small")||[]){
      if(el.tagName==="LABEL"){
        const own=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>txt(n.nodeValue)).find(Boolean)||"";
        if(replacements.has(own))replaceOwnLabelText(el,replacements.get(own));
        continue
      }
      const t=txt(el.textContent);if(replacements.has(t)&&el.textContent!==replacements.get(t))el.textContent=replacements.get(t)
    }
  }
  function relabelLegacyText(root=document){
    const map=new Map(allSections().map(s=>[txt(s.section),compact(s)]).filter(([k])=>k));if(!map.size)return;
    const walker=document.createTreeWalker(root.body||root,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;if(!p||["SCRIPT","STYLE","OPTION","TEXTAREA","INPUT","SELECT"].includes(p.tagName))return NodeFilter.FILTER_REJECT;return map.has(txt(node.nodeValue))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const n of nodes)n.nodeValue=map.get(txt(n.nodeValue))
  }

  // Defensive repair for pages that were already damaged by the old relabel code before this build loaded.
  function ensureWeeklySectionControl(){
    if(document.getElementById("wkSection"))return;
    const weekly=document.getElementById("weekly");if(!weekly)return;
    const labels=[...weekly.querySelectorAll("label")];
    const label=labels.find(x=>/Grade\s*\/\s*Section|Class\s*&\s*Section/i.test(txt([...x.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.nodeValue).join(" "))));
    if(!label)return;
    const sel=document.createElement("select");sel.id="wkSection";label.appendChild(sel);
    try{
      const sections=typeof ownTeacherSections==="function"?ownTeacherSections():allSections().map(s=>s.section);
      if(typeof fillSelect==="function")fillSelect(sel,sections,sections[0]||"");
      else sel.innerHTML=sections.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
      if(typeof updateWeeklySubjects==="function")updateWeeklySubjects();
      if(typeof fillWeeklyCalendarFromPlan==="function")fillWeeklyCalendarFromPlan(true)
    }catch(e){console.warn("Recovered Weekly Status section selector",e)}
  }

  function apply(){ensureWeeklySectionControl();relabelOptions(document);relabelHeadings(document);relabelLegacyText(document)}
  let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
  if(typeof applyRemoteData==="function"){const previous=applyRemoteData;applyRemoteData=function(r){const out=previous(r);queue();return out}}
  if(typeof renderAll==="function"){const previous=renderAll;renderAll=function(){const out=previous();queue();return out}}
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});queue();
})();
