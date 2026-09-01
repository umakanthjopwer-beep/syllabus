// PDF Year Plan v45: robust Track A / Track B table repair.
// Uses midpoint row boundaries, tolerant date-range detection and merged exam/event propagation.
(function(){
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const canon=v=>typeof canonicalSubject==="function"?canonicalSubject(v||""):clean(v);
  const pad=n=>String(n).padStart(2,"0");
  function dateToken(v){
    const z=clean(v).replaceAll("‐","-").replaceAll("–","-").replaceAll("—","-").replaceAll(".","-").replaceAll("/","-");
    const m=z.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);if(!m)return"";
    let y=Number(m[3]);if(y<100)y+=2000;const s=`${y}-${pad(m[2])}-${pad(m[1])}`;
    return s>="2026-06-01"&&s<="2027-04-30"?s:""
  }
  function groups(items,tol=2.8){
    const out=[];for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){let g=out.find(x=>Math.abs(x.y-it.y)<=tol);if(!g){g={y:it.y,items:[]};out.push(g)}g.items.push(it)}
    return out.sort((a,b)=>b.y-a.y).map(g=>({y:g.y,text:clean(g.items.sort((a,b)=>a.x-b.x).map(x=>x.str).join(" ")),items:g.items}))
  }
  function header(items,rx){const a=items.filter(x=>rx.test(clean(x.str)));return a.length?[...a].sort((p,q)=>q.y-p.y)[0]:null}
  function layout(items,previous){
    const fresh={
      date:header(items,/^Date$|^Dates?$|^Week$/i),
      days:header(items,/Working.*Days|No\.?\s*of\s*Working.*Days|No\.?\s*of\s*Days/i),
      a:header(items,/Track\s*[-–—]?\s*A/i),
      b:header(items,/Track\s*[-–—]?\s*B/i),
      activity:header(items,/^Activity$/i)
    };
    if(fresh.date&&fresh.days&&fresh.a&&fresh.b)return Object.fromEntries(Object.entries(fresh).map(([k,v])=>[k,v?.x??null]));
    if(previous?.date!=null&&previous?.days!=null&&previous?.a!=null&&previous?.b!=null)return previous;
    return null
  }
  function bounds(l){
    const cols=["date","days","a","b","activity"].map(k=>({k,x:l?.[k]})).filter(x=>Number.isFinite(x.x));cols.sort((a,b)=>a.x-b.x);
    return cols.map((c,i)=>({k:c.k,min:i?(cols[i-1].x+c.x)/2:-Infinity,max:i<cols.length-1?(c.x+cols[i+1].x)/2:Infinity}))
  }
  function lineText(region,b){if(!b)return"";return clean(groups(region.filter(x=>x.x>=b.min&&x.x<b.max)).map(x=>x.text).filter(Boolean).join(" "))}
  function anchors(items,b){
    const db=b.find(x=>x.k==="date");if(!db)return[];const lines=groups(items.filter(x=>x.x>=db.min&&x.x<db.max)),out=[];
    for(let i=0;i<lines.length;i++){
      const start=dateToken(lines[i].text);if(!start)continue;let end=start,used=0,ys=[lines[i].y],n1=lines[i+1],n2=lines[i+2];
      if(n1&&/^to$/i.test(n1.text)&&n2){const e=dateToken(n2.text);if(e){end=e;used=2;ys.push(n1.y,n2.y)}}
      else if(n1){
        const e=dateToken(n1.text);if(e){const hi=Math.max(lines[i].y,n1.y)+3,lo=Math.min(lines[i].y,n1.y)-3,toBetween=items.some(it=>/^to$/i.test(clean(it.str))&&it.y<=hi&&it.y>=lo&&it.x>=db.min-22&&it.x<db.max+22);if(toBetween){end=e;used=1;ys.push(n1.y)}}
      }
      out.push({start,end,center:ys.reduce((a,y)=>a+y,0)/ys.length});i+=used
    }
    return out
  }
  function weak(t){const z=clean(t);return !z||z.length<12||/^(task\)\)|\(?concept,?|\(?tentatively\)?|activity\s*-?\s*\d+)$/i.test(z)}
  function datesIn(t){return[...clean(t).matchAll(/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b/g)].map(m=>dateToken(m[0])).filter(Boolean)}
  function shared(t){return/\b(exams?|assessment|tests?|holidays?|vacation|break|term\s*exam|unit\s*test)\b/i.test(clean(t))}
  function overlaps(a,b,c,d){return a&&c&&a<=d&&(b||a)>=c}
  function propagate(rows){
    const out=(rows||[]).map(r=>({...r})),events=[];
    for(const r of out){const ds=datesIn(r.topic);if(ds.length>=2&&shared(r.topic)){let s=ds[0],e=ds[1];if(e<s){const x=s;s=e;e=x}events.push({grade:r.grade,start:s,end:e,topic:clean(r.topic)})}}
    for(const e of events)for(const r of out){if(Number(r.grade||0)!==Number(e.grade||0)||!/^Track [AB]$/i.test(canon(r.subject))||!overlaps(r.startDate,r.endDate||r.startDate,e.start,e.end))continue;if(!clean(r.topic)||weak(r.topic))r.topic=e.topic}
    return out
  }
  function parsePage(items,pageText,l){
    const grade=(typeof detectGrades==="function"?detectGrades(pageText)[0]:null)||null;if(!grade||!l)return[];const b=bounds(l),as=anchors(items,b);if(!as.length)return[];
    const headerY=Math.max(...items.filter(x=>/^(Date|Track\s*[-–—]?\s*A|Track\s*[-–—]?\s*B|Activity)$/i.test(clean(x.str))).map(x=>x.y),Infinity*-1),out=[];
    for(let i=0;i<as.length;i++){
      const r=as[i],upper=i===0?(Number.isFinite(headerY)?headerY-3:r.center+40):(as[i-1].center+r.center)/2,lower=i===as.length-1?-Infinity:(r.center+as[i+1].center)/2,region=items.filter(x=>x.y<upper&&x.y>=lower),get=k=>lineText(region,b.find(x=>x.k===k));
      const days=Number(get("days").match(/\b([0-7])\b/)?.[1]||0)||null,activity=get("activity"),a=clean(get("a").replace(/^Track\s*[-–—]?\s*A\b/i,"")),bb=clean(get("b").replace(/^Track\s*[-–—]?\s*B\b/i,""));
      const addActivity=t=>clean(t+(activity&&t&&!t.includes(activity)?` | Activity - ${activity.replace(/[^0-9]+/g,"")||activity}`:""));
      // Keep both subjects for every dated source anchor. Blank placeholders are important for merged event cells.
      out.push({grade,subject:"Track A",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:null,topic:addActivity(a)});
      out.push({grade,subject:"Track B",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:null,topic:addActivity(bb)})
    }
    return out
  }
  function key(r){return`${Number(r.grade||0)}|${canon(r.subject)}|${r.startDate||""}|${r.endDate||r.startDate||""}`}
  function merge(base,repair){
    let rows=(base||[]).map(r=>({...r}));
    for(const r of repair||[]){
      const t=clean(r.topic);if(t){rows=rows.filter(x=>{if(Number(x.grade||0)!==Number(r.grade||0)||canon(x.subject)!==canon(r.subject))return true;const contained=x.startDate>=r.startDate&&(x.endDate||x.startDate)<=r.endDate;if(!contained||key(x)===key(r))return true;const xt=clean(x.topic);return !(weak(xt)||t.length>xt.length*1.65)})}
      const i=rows.findIndex(x=>key(x)===key(r));if(i<0){rows.push({...r});continue}const old=rows[i],ot=clean(old.topic);if(t&&(!ot||weak(ot)||t.length>ot.length))old.topic=t;if(old.workingDays==null&&r.workingDays!=null)old.workingDays=r.workingDays
    }
    const m=new Map();for(const r of rows){const k=key(r),old=m.get(k);if(!old){m.set(k,r);continue}if(clean(r.topic).length>clean(old.topic).length)old.topic=r.topic;if(old.workingDays==null&&r.workingDays!=null)old.workingDays=r.workingDays}
    return[...m.values()].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||Number(a.grade||0)-Number(b.grade||0)||canon(a.subject).localeCompare(canon(b.subject)))
  }
  const base=smartParse;
  smartParse=async function(file){
    const d=await base(file),ext=String(file?.name||"").split(".").pop().toLowerCase();if(ext!=="pdf")return d;
    try{
      const pdfjs=await loadPdfJs(),pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let repair=[],ctx=null,gradeCtx="";
      for(let i=1;i<=pdf.numPages;i++){
        const pg=await pdf.getPage(i),tc=await pg.getTextContent(),items=tc.items.map(x=>({str:x.str,x:x.transform[4],y:x.transform[5]})),pageText=items.map(x=>x.str).join(" "),g=detectGrades(pageText,file.name);if(g.length)gradeCtx=pageText;ctx=layout(items,ctx);repair.push(...parsePage(items,[pageText,gradeCtx].join(" "),ctx))
      }
      repair=propagate(repair);if(repair.some(r=>clean(r.topic))){d.rows=merge(d.rows||[],repair);d.pdfTrackTableRepairV45=true}
    }catch(e){console.warn("Track-table PDF repair",e)}
    return d
  };
  window.__PDF_TRACK_TABLE_REPAIR_V45__=true;
})();
