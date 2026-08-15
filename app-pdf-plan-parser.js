function pdfDateToken(s){
  const z=String(s||"").trim().replaceAll("‐","-").replaceAll("–","-").replaceAll("—","-").replaceAll(".","-");
  const m=z.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);if(!m)return null;
  let y=Number(m[3]);if(y<100)y+=2000;const d=`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return d>="2026-06-01"&&d<="2027-04-30"?d:null
}
function pdfLine(items){
  const groups=[];for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){let g=groups.find(x=>Math.abs(x.y-it.y)<2.5);if(!g){g={y:it.y,items:[]};groups.push(g)}g.items.push(it)}
  return groups.sort((a,b)=>b.y-a.y).map(g=>g.items.sort((a,b)=>a.x-b.x).map(x=>x.str).join(" ").replace(/\s+/g," ").trim()).filter(Boolean).join("\n")
}
function pdfTopHeaderX(items,rx){const a=items.filter(x=>rx.test(String(x.str||"").trim()));return a.length?a.sort((p,q)=>q.y-p.y)[0].x:null}
function pdfGroups(items,tol=2.5){
  const out=[];for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){let g=out.find(x=>Math.abs(x.y-it.y)<=tol);if(!g){g={y:it.y,items:[]};out.push(g)}g.items.push(it)}
  return out.sort((a,b)=>b.y-a.y).map(g=>({y:g.y,text:g.items.sort((a,b)=>a.x-b.x).map(x=>x.str).join(" ").replace(/\s+/g," ").trim(),items:g.items}))
}
function pdfLayout(items,previous=null){
  const current={
    date:pdfTopHeaderX(items,/^Date$|^Dates?$|^Week$/i),
    days:pdfTopHeaderX(items,/Working.*Days|No\.?\s*of\s*Working.*Days|No\.?\s*of\s*Days/i),
    period:pdfTopHeaderX(items,/^Periods?$|No\.?\s*of\s*Periods?|Periods?\s*Per\s*Week/i),
    topic:pdfTopHeaderX(items,/^Topic$|Content|Syllabus|Chapter|Lesson/i),
    a:pdfTopHeaderX(items,/Track\s*[-–—]?\s*A/i),
    b:pdfTopHeaderX(items,/Track\s*[-–—]?\s*B/i),
    activity:pdfTopHeaderX(items,/^Activity$/i)
  };
  const hasFresh=current.date!=null&&current.days!=null;
  if(hasFresh)return{...current,fresh:true};
  if(previous&&previous.date!=null&&previous.days!=null)return{...previous,fresh:false};
  const dated=items.filter(x=>pdfDateToken(String(x.str||"").trim()));
  if(dated.length&&current.days!=null){current.date=Math.min(...dated.map(x=>x.x));return{...current,fresh:true}}
  return null
}
function pdfBounds(layout){
  const cols=[];for(const k of ["date","days","period","topic","a","b","activity"]){const x=layout?.[k];if(x!=null&&!cols.some(c=>Math.abs(c.x-x)<3))cols.push({k,x})}
  cols.sort((a,b)=>a.x-b.x);return cols.map((c,i)=>({k:c.k,x:c.x,min:i?((cols[i-1].x+c.x)/2):-Infinity,max:i<cols.length-1?((c.x+cols[i+1].x)/2):Infinity}))
}
function pdfDateAnchors(items,bounds){
  const bd=bounds.find(x=>x.k==="date");if(!bd)return[];
  const lines=pdfGroups(items.filter(x=>x.x>=bd.min&&x.x<bd.max));const out=[];
  for(let i=0;i<lines.length;i++){
    const direct=[...lines[i].text.matchAll(/\b\d{1,2}[.\-‐–—]\d{1,2}[.\-‐–—]\d{2,4}\b/g)].map(m=>pdfDateToken(m[0])).filter(Boolean);
    if(!direct.length)continue;const start=direct[0];let end=direct[1]||start,consume=0;
    if(direct.length<2){const n1=lines[i+1],n2=lines[i+2];if(n1&&/^to$/i.test(n1.text)&&n2){const d=pdfDateToken(n2.text);if(d){end=d;consume=2}}else if(n1){const d=pdfDateToken(n1.text);if(d&&/\bto\b/i.test(lines[i].text+" "+n1.text)){end=d;consume=1}}}
    out.push({start,end,y:lines[i].y});i+=consume
  }
  const uniq=[];for(const r of out)if(!uniq.some(x=>x.start===r.start&&x.end===r.end&&Math.abs(x.y-r.y)<2.5))uniq.push(r);return uniq
}
function pdfCell(region,bounds,k){const b=bounds.find(x=>x.k===k);return b?pdfLine(region.filter(x=>x.x>=b.min&&x.x<b.max)):""}
function pdfBroadTopic(region,layout,bounds){
  const startX=layout.topic!=null?layout.topic:(layout.period!=null?layout.period+8:layout.days+8);
  const parts=pdfGroups(region.filter(x=>x.x>=startX)).map(g=>g.text).filter(t=>t&&!pdfDateToken(t)&&!/^to$/i.test(t)&&!/^\d{1,2}$/.test(t)&&!/^(periods?|topic|content|syllabus|chapter|lesson|activity|working.*days)$/i.test(t));
  return[...new Set(parts)].join(" | ")
}
function pdfRowsFromLayout(items,pageText,layout){
  const grade=detectGrades(pageText)[0]||null,subjects=detectSubjects(pageText),subject=canonicalSubject(subjects[0]||"");if(!grade||!layout)return[];
  const bounds=pdfBounds(layout);if(!bounds.some(x=>x.k==="date")||!bounds.some(x=>x.k==="days"))return[];
  const anchors=pdfDateAnchors(items,bounds);if(!anchors.length)return[];const out=[];
  for(let i=0;i<anchors.length;i++){
    const r=anchors[i],nextY=i<anchors.length-1?anchors[i+1].y:-Infinity,region=items.filter(it=>it.y<=r.y+6&&it.y>nextY+4);
    const daysText=pdfCell(region,bounds,"days"),days=Number(daysText.match(/\b([0-7])\b/)?.[1]||0)||null;
    const periodText=pdfCell(region,bounds,"period"),period=Number(periodText.match(/\b(\d{1,2})\b/)?.[1]||0)||null,activity=pdfCell(region,bounds,"activity");
    if(bounds.some(x=>x.k==="a")){
      let a=pdfCell(region,bounds,"a"),b=pdfCell(region,bounds,"b");
      if(!a&&layout.a!=null)a=pdfBroadTopic(region.filter(x=>x.x>=layout.a&&(layout.b==null||x.x<layout.b)),{...layout,topic:layout.a},bounds);
      if(!b&&layout.b!=null)b=pdfBroadTopic(region.filter(x=>x.x>=layout.b),{...layout,topic:layout.b},bounds);
      const aTopic=a&&!/^Track\s*[-–—]?\s*A$/i.test(a.trim())?(a+(activity?` | ${activity}`:"")).trim():"";
      const bTopic=b&&!/^Track\s*[-–—]?\s*B$/i.test(b.trim())?(b+(activity?` | ${activity}`:"")).trim():"";
      // Keep placeholder rows for dated source anchors even when a merged cell has no text at that Y position.
      // A later pass can then propagate a merged exam/holiday/event block across every affected source date row.
      out.push({grade,subject:"Track A",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:period,topic:aTopic});
      out.push({grade,subject:"Track B",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:period,topic:bTopic});
      continue
    }
    let topic=pdfCell(region,bounds,"topic");if(!topic&&periodText&&!/^\d+$/.test(periodText.trim()))topic=periodText;if(!topic&&activity)topic=`Activity: ${activity}`;if(!topic&&days>0)topic=pdfBroadTopic(region,layout,bounds);
    out.push({grade,subject,startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:period,topic:String(topic||"").trim()})
  }
  return out
}
function pdfMergeRows(primary,extra){
  const map=new Map();for(const r of [...primary,...extra]){const k=`${r.grade??""}|${canonicalSubject(r.subject||"")}|${r.startDate||""}|${r.endDate||r.startDate||""}`,old=map.get(k);if(!old){map.set(k,{...r});continue}if(!String(old.topic||"").trim()&&String(r.topic||"").trim())old.topic=r.topic;if(String(r.topic||"").trim().length>String(old.topic||"").trim().length)old.topic=r.topic;if(old.workingDays==null&&r.workingDays!=null)old.workingDays=r.workingDays;if(old.plannedPeriods==null&&r.plannedPeriods!=null)old.plannedPeriods=r.plannedPeriods}
  return[...map.values()]
}
function pdfTextDateSpan(text){
  const hits=[...String(text||"").matchAll(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/g)].map(m=>pdfDateToken(`${m[1]}-${m[2]}-${m[3]}`)).filter(Boolean);if(hits.length<2)return null;let start=hits[0],end=hits[1];if(end<start){const t=start;start=end;end=t}return{start,end}
}
function pdfOverlap(a,b,c,d){return!!a&&!!c&&a<=d&&(b||a)>=c}
function pdfWeakMergedFragment(text){const t=String(text||"").trim();return!t||/^\(?\s*tentatively\s*\)?[.!]?$/i.test(t)}
function pdfSharedCalendarEvent(text){return/\b(exams?|assessment|tests?|holidays?|vacation|break|term\s*exam|unit\s*test)\b/i.test(String(text||""))}
function pdfPropagateMergedDatedEvents(rows){
  const out=(rows||[]).map(r=>({...r})),events=[];
  for(const r of out){const span=pdfTextDateSpan(r.topic);if(!span)continue;const fragments=out.filter(x=>Number(x.grade||0)===Number(r.grade||0)&&x.startDate===r.startDate&&(x.endDate||x.startDate)===(r.endDate||r.startDate)&&x!==r&&pdfWeakMergedFragment(x.topic)).map(x=>String(x.topic||"").trim()).filter(Boolean);const topic=[String(r.topic||"").trim(),...fragments].join(" ").replace(/\s+/g," ").trim();events.push({grade:r.grade,start:span.start,end:span.end,topic,shared:pdfSharedCalendarEvent(topic)})}
  for(const e of events){for(const r of out){if(Number(r.grade||0)!==Number(e.grade||0)||!/^Track [AB]$/i.test(canonicalSubject(r.subject||""))||!pdfOverlap(r.startDate,r.endDate||r.startDate,e.start,e.end))continue;if(e.shared||pdfWeakMergedFragment(r.topic))r.topic=e.topic}}
  return pdfMergeRows([],out)
}
const _smartParseBase=smartParse;
smartParse=async function(file){
  const ext=file.name.split(".").pop().toLowerCase();if(ext!=="pdf")return _smartParseBase(file);
  const pdfjs=await loadPdfJs(),pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let text="",rows=[],gradeContext="",subjectContext="",layoutContext=null;
  for(let i=1;i<=pdf.numPages;i++){
    const pg=await pdf.getPage(i),tc=await pg.getTextContent(),items=tc.items.map(x=>({str:x.str,x:x.transform[4],y:x.transform[5]})),pageText=items.map(x=>x.str).join(" ");
    const pageGrades=detectGrades(pageText,file.name),pageSubjects=detectSubjects(pageText,file.name);if(pageGrades.length)gradeContext=pageText;if(pageSubjects.length)subjectContext=pageText;
    const parseText=[pageText,gradeContext,subjectContext].filter(Boolean).join(" "),nextLayout=pdfLayout(items,layoutContext);if(nextLayout)layoutContext=nextLayout;
    const parsed=pdfRowsFromLayout(items,parseText,layoutContext);rows.push(...parsed);text+=pageText+"\n"
  }
  const repaired=pdfPropagateMergedDatedEvents(pdfMergeRows([],rows)),d=smartDetection(file,text,pdf.numPages,repaired);d.pdfContinuationLayout=true;d.pdfMergedDatedEventRepair=true;return d
};
