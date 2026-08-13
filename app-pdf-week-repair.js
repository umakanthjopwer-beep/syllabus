// Robust PDF Year Plan parser repair.
// Reads every dated table row, carries grade/subject context across continuation pages,
// and verifies that every date-range visible in the Date column produced a captured row.
(function(){
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const uniq=a=>[...new Set(a.filter(Boolean))];
  function dateToken(v,fallbackYear=""){
    const z=clean(v).replaceAll("‐","-").replaceAll("–","-").replaceAll(".","-");
    const m=z.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);if(!m)return null;
    let y=String(m[3]);if(y.length===2)y=`20${y}`;else if(y.length===3&&fallbackYear)y=fallbackYear;
    if(y.length!==4)return null;const s=`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;return s>="2026-06-01"&&s<="2027-04-30"?s:null
  }
  function lineGroups(items,tol=2.6){
    const g=[];for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){let q=g.find(x=>Math.abs(x.y-it.y)<=tol);if(!q){q={y:it.y,items:[]};g.push(q)}q.items.push(it)}
    return g.sort((a,b)=>b.y-a.y).map(x=>({y:x.y,text:x.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(" ").replace(/\s+/g," ").trim(),items:x.items}))
  }
  function header(items,rx){const a=items.filter(x=>rx.test(clean(x.str)));return a.length?[...a].sort((x,y)=>y.y-x.y)[0]:null}
  function colText(region,bound){if(!bound)return"";return pdfLine(region.filter(x=>x.x>=bound.min&&x.x<bound.max))}
  function stripHeaders(v){return clean(v).replace(/^(Topic|Content|Syllabus|Chapter|Lesson|Activity)\b\s*/i,"").trim()}
  function periodCount(v){let n=0,found=false;for(const m of String(v||"").matchAll(/\b(\d{1,2})\s*Periods?\b/gi)){n+=Number(m[1]);found=true}return found?n:null}
  function parsePage(items,context){
    const grade=context.grade||null,subject=canonicalSubject(context.subject||"");if(!grade)return{rows:[],ranges:[]};
    const dateH=header(items,/^Date$|^Dates?$|^Week$/i),daysH=header(items,/^Working$|Working.*Days|No\.?\s*of\s*Days/i),periodH=header(items,/^Periods?$|No\.?\s*of\s*Periods?/i),topicH=header(items,/^Topic$|^Content$|^Syllabus$|^Chapter$|^Lesson$/i),trackAH=header(items,/Track.*A/i),trackBH=header(items,/Track.*B/i),activityH=header(items,/^Activity$/i);
    const dated=items.filter(x=>dateToken(x.str));let dateX=dateH?.x;if(dateX==null&&dated.length)dateX=Math.min(...dated.map(x=>x.x));let daysX=daysH?.x;if(dateX==null||daysX==null)return{rows:[],ranges:[]};
    const cols=[{k:"date",x:dateX},{k:"days",x:daysX}];for(const[k,h]of [["period",periodH],["topic",topicH],["a",trackAH],["b",trackBH],["activity",activityH]])if(h&&Number.isFinite(h.x)&&!cols.some(c=>Math.abs(c.x-h.x)<3))cols.push({k,x:h.x});cols.sort((a,b)=>a.x-b.x);
    const bounds=cols.map((c,i)=>({k:c.k,min:i?((cols[i-1].x+c.x)/2):-Infinity,max:i<cols.length-1?((c.x+cols[i+1].x)/2):Infinity}));
    const db=bounds.find(x=>x.k==="date"),dateLines=lineGroups(items.filter(x=>x.x>=db.min&&x.x<db.max)),anchors=[];
    for(let i=0;i<dateLines.length;i++){
      const start=dateToken(dateLines[i].text);if(!start)continue;let end=start,ys=[dateLines[i].y],consume=0,n1=dateLines[i+1],n2=dateLines[i+2];
      if(n1&&/^to$/i.test(n1.text)&&n2){const e=dateToken(n2.text,start.slice(0,4));if(e){end=e;ys.push(n1.y,n2.y);consume=2}}
      else if(n1){const e=dateToken(n1.text,start.slice(0,4));if(e&&/\bto\b/i.test(`${dateLines[i].text} ${n1.text}`)){end=e;ys.push(n1.y);consume=1}}
      anchors.push({start,end,center:ys.reduce((a,b)=>a+b,0)/ys.length});i+=consume
    }
    const ranges=anchors.map(x=>({grade,subject,startDate:x.start,endDate:x.end})),out=[],headerY=Math.max(...[dateH,daysH,periodH,topicH,trackAH,trackBH,activityH].filter(Boolean).map(x=>x.y));
    for(let i=0;i<anchors.length;i++){
      const r=anchors[i],upper=i===0?headerY-4:(anchors[i-1].center*.25+r.center*.75),lower=i===anchors.length-1?-Infinity:(r.center*.25+anchors[i+1].center*.75),region=items.filter(it=>it.y<upper&&it.y>=lower),val=k=>stripHeaders(colText(region,bounds.find(x=>x.k===k)));
      const daysText=val("days"),days=Number(daysText.match(/\b([0-7])\b/)?.[1]||0)||null,periodText=val("period"),activity=val("activity");
      if(bounds.some(x=>x.k==="a"||x.k==="b")){
        const a=val("a"),b=val("b");if(a&&!/^Track/i.test(a))out.push({grade,subject:"Track A",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:periodCount(a)||Number(periodText.match(/\b(\d{1,2})\b/)?.[1]||0)||null,topic:clean(a+(activity?` | Activity: ${activity}`:""))});if(b&&!/^Track/i.test(b))out.push({grade,subject:"Track B",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:periodCount(b)||Number(periodText.match(/\b(\d{1,2})\b/)?.[1]||0)||null,topic:clean(b+(activity?` | Activity: ${activity}`:""))});continue
      }
      let topic=val("topic");if(!topic&&periodText&&!/^\d+$/.test(periodText))topic=periodText;
      if(!topic){const minX=(topicH?.x??periodH?.x??daysX)+4,right=region.filter(x=>x.x>=minX),parts=lineGroups(right).map(x=>stripHeaders(x.text)).filter(t=>t&&!dateToken(t)&&!/^to$/i.test(t)&&!/^\d{1,2}$/.test(t)&&!/^(Date|Working|days|No Of Working days)$/i.test(t));topic=uniq(parts).join(" | ")}
      const combined=clean(topic+(activity&&(!topic||!topic.includes(activity))?` | Activity: ${activity}`:"")),explicit=Number(periodText.match(/\b(\d{1,2})\b/)?.[1]||0)||null,periods=explicit??periodCount(combined);
      out.push({grade,subject,startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:periods,topic:combined})
    }
    return{rows:out,ranges}
  }
  function rowKey(r){return`${r.grade??""}|${canonicalSubject(r.subject||"")}|${r.startDate||""}|${r.endDate||r.startDate||""}`}
  function mergeRows(base,repair,defaultSubject){
    const map=new Map();for(const r of base||[]){const x={...r,subject:canonicalSubject(r.subject||defaultSubject||"")};map.set(rowKey(x),x)}
    for(const r0 of repair||[]){const r={...r0,subject:canonicalSubject(r0.subject||defaultSubject||"")},k=rowKey(r),old=map.get(k);if(!old){map.set(k,r);continue}if(clean(r.topic)&&clean(r.topic).length>clean(old.topic).length)old.topic=r.topic;if(old.workingDays==null&&r.workingDays!=null)old.workingDays=r.workingDays;if(old.plannedPeriods==null&&r.plannedPeriods!=null)old.plannedPeriods=r.plannedPeriods}
    return[...map.values()]
  }
  const base=smartParse;
  smartParse=async function(file){
    const ext=file.name.split(".").pop().toLowerCase();if(ext!=="pdf")return base(file);
    const initial=await base(file),pdfjs=await loadPdfJs(),pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let text="",gradeCtx=null,subjectCtx=(detectSubjects("",file.name)[0]||initial.subjects?.[0]||""),repair=[],ranges=[];
    for(let i=1;i<=pdf.numPages;i++){
      const pg=await pdf.getPage(i),tc=await pg.getTextContent(),items=tc.items.map(x=>({str:x.str,x:x.transform[4],y:x.transform[5]})),pageText=items.map(x=>x.str).join(" "),explicitGrades=detectGrades(pageText),explicitSubjects=detectSubjects(pageText,file.name);
      if(explicitGrades.length)gradeCtx=explicitGrades[0];if(explicitSubjects.length)subjectCtx=explicitSubjects[0];const p=parsePage(items,{grade:gradeCtx,subject:subjectCtx});repair.push(...p.rows);ranges.push(...p.ranges);text+=pageText+"\n"
    }
    const merged=mergeRows(initial.rows||[],repair,subjectCtx),result=smartDetection(file,text,pdf.numPages,merged),captured=new Set(merged.map(rowKey)),missing=ranges.filter(r=>!captured.has(rowKey(r)));result.captureSourceAudit={sourceRanges:ranges.length,capturedRanges:ranges.length-missing.length,missingRanges:missing,coverageByGrade:{}};
    for(const g of uniq(ranges.map(r=>r.grade))){const src=ranges.filter(r=>r.grade===g),got=merged.filter(r=>Number(r.grade)===Number(g));result.captureSourceAudit.coverageByGrade[g]={sourceEnd:src.reduce((m,r)=>(r.endDate||r.startDate)>m?(r.endDate||r.startDate):m,""),capturedEnd:got.reduce((m,r)=>(r.endDate||r.startDate)>m?(r.endDate||r.startDate):m,"")}}
    return result
  }
})();