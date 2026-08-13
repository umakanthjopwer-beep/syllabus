// Final PDF recovery pass for Year Plan capture.
// Adds rows/topics missed by narrow table layouts without overwriting good primary-parser content.
(function(){
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const parseDate=v=>{const z=clean(v).replaceAll("‐","-").replaceAll("–","-").replaceAll(".","-");const m=z.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);if(!m)return"";let y=Number(m[3]);if(y<100)y+=2000;const s=`${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;return s>="2026-06-01"&&s<="2027-04-30"?s:""};
  function groups(items,tol=2.5){const out=[];for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){let g=out.find(x=>Math.abs(x.y-it.y)<=tol);if(!g){g={y:it.y,items:[]};out.push(g)}g.items.push(it)}return out.sort((a,b)=>b.y-a.y).map(g=>({y:g.y,items:g.items.sort((a,b)=>a.x-b.x),text:clean(g.items.map(x=>x.str).join(" "))}))}
  function hx(items,rx){const a=items.filter(x=>rx.test(clean(x.str)));return a.length?a.sort((x,y)=>y.y-x.y)[0].x:null}
  function joined(items){return clean(groups(items).map(g=>g.text).filter(Boolean).join(" "))}
  function subjectFrom(text){const s=detectSubjects(text||"");return canonicalSubject(s[0]||"")}
  function rowKey(r){return `${r.grade??""}|${canonicalSubject(r.subject||"")}|${r.startDate||""}|${r.endDate||r.startDate||""}`}
  function recover(items,pageText){
    const grade=detectGrades(pageText||"")[0]||null,subject=subjectFrom(pageText);if(!grade)return[];
    let dateX=hx(items,/^Date$|^Dates?$|^Week$/i),daysX=hx(items,/Working.*Days|No\.?\s*of\s*Days|Working/i),periodX=hx(items,/Periods?|No\.?\s*of\s*Periods?/i),topicX=hx(items,/Topic|Content|Syllabus|Chapter|Lesson/i),aX=hx(items,/Track\s*[-–]?\s*A/i),bX=hx(items,/Track\s*[-–]?\s*B/i),activityX=hx(items,/^Activity$/i);
    const dated=items.filter(x=>parseDate(x.str));if(dateX==null&&dated.length)dateX=Math.min(...dated.map(x=>x.x));if(dateX==null||daysX==null)return[];
    const cols=[{k:"date",x:dateX},{k:"days",x:daysX}];for(const[k,x]of [["period",periodX],["topic",topicX],["a",aX],["b",bX],["activity",activityX]])if(x!=null&&!cols.some(c=>Math.abs(c.x-x)<3))cols.push({k,x});cols.sort((a,b)=>a.x-b.x);
    const bounds=cols.map((c,i)=>({k:c.k,min:i?((cols[i-1].x+c.x)/2):-Infinity,max:i<cols.length-1?((c.x+cols[i+1].x)/2):Infinity})),bd=bounds.find(x=>x.k==="date");
    const dateLines=groups(items.filter(x=>x.x>=bd.min&&x.x<bd.max)),anchors=[];
    for(let i=0;i<dateLines.length;i++){const start=parseDate(dateLines[i].text);if(!start)continue;let end=start,consume=0;const n1=dateLines[i+1],n2=dateLines[i+2];if(n1&&/^to$/i.test(n1.text)&&n2&&parseDate(n2.text)){end=parseDate(n2.text);consume=2}else if(n1&&parseDate(n1.text)&&/\bto\b/i.test(dateLines[i].text+" "+n1.text)){end=parseDate(n1.text);consume=1}anchors.push({start,end,y:dateLines[i].y});i+=consume}
    const uniq=[];for(const a of anchors)if(!uniq.some(x=>x.start===a.start&&x.end===a.end&&Math.abs(x.y-a.y)<3))uniq.push(a);
    const val=(region,k)=>{const b=bounds.find(x=>x.k===k);return b?joined(region.filter(x=>x.x>=b.min&&x.x<b.max)):""};
    const loose=region=>{const min=topicX!=null?Math.max(daysX+5,topicX-18):(periodX!=null?periodX+8:daysX+8);const parts=groups(region.filter(x=>x.x>=min)).map(g=>clean(g.text)).filter(Boolean).filter(t=>!parseDate(t)&&!/^to$/i.test(t)&&!/^\d{1,2}$/.test(t)&&!/^(periods?|topic|content|syllabus|chapter|lesson|activity|working.*days)$/i.test(t));return clean([...new Set(parts)].join(" | "))};
    const out=[];
    for(let i=0;i<uniq.length;i++){const a=uniq[i],nextY=i<uniq.length-1?uniq[i+1].y:-Infinity,region=items.filter(it=>it.y<=a.y+5&&it.y>nextY+4),daysText=val(region,"days"),days=Number(daysText.match(/\b([0-7])\b/)?.[1]||0)||null,periodText=val(region,"period"),period=Number(periodText.match(/\b(\d{1,2})\b/)?.[1]||0)||null,activity=val(region,"activity");
      if(bounds.some(x=>x.k==="a")){const ta=val(region,"a"),tb=val(region,"b");if(ta&&!/^Track/i.test(ta))out.push({grade,subject:"Track A",startDate:a.start,endDate:a.end,workingDays:days,plannedPeriods:period,topic:ta});if(tb&&!/^Track/i.test(tb))out.push({grade,subject:"Track B",startDate:a.start,endDate:a.end,workingDays:days,plannedPeriods:period,topic:tb});continue}
      let topic=val(region,"topic");if(!topic&&periodText&&!/^\d+$/.test(periodText))topic=periodText;if(!topic&&activity)topic=`Activity: ${activity}`;if(!topic&&days>0)topic=loose(region);out.push({grade,subject,startDate:a.start,endDate:a.end,workingDays:days,plannedPeriods:period,topic:clean(topic)})
    }
    return out
  }
  const base=pdfPageTableRows;
  pdfPageTableRows=function(items,pageText){const primary=base(items,pageText)||[],extra=recover(items,pageText),map=new Map(primary.map(r=>[rowKey(r),r]));for(const r of extra){const k=rowKey(r),old=map.get(k);if(!old){primary.push(r);map.set(k,r);continue}if(!clean(old.topic)&&clean(r.topic))old.topic=r.topic;if(old.workingDays==null&&r.workingDays!=null)old.workingDays=r.workingDays;if(old.plannedPeriods==null&&r.plannedPeriods!=null)old.plannedPeriods=r.plannedPeriods}return primary};
})();
