// Robust Year Plan capture: fixes PDF date-range splitting, merged exam/holiday rows,
// and improves multi-subject Excel capture before integrity validation runs.
(function(){
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  function isoDates(v){
    const z=String(v||"").replaceAll("‐","-").replaceAll("–","-").replaceAll(".","-");
    return [...z.matchAll(/(\d{1,2})-(\d{1,2})-(\d{3,4})/g)].map(m=>{
      let y=m[3];if(y==="202")y="2026";if(y.length!==4)return"";
      return`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`
    }).filter(Boolean)
  }
  function explicitSubjectV2(text){
    const m=String(text||"").match(/Subject\s*:\s*(Mathematics|Maths|Physics|Chemistry|Biology|English|Social(?: Science)?|Information Technology|IT|Hindi(?:\s*\([^)]*\))?|Telugu(?:\s*\([^)]*\))?)/i);
    if(!m)return"";const s=m[1].toLowerCase();
    if(s.startsWith("social"))return"Social";if(s==="information technology"||s==="it")return"IT";
    if(s.startsWith("english"))return"English";if(s.startsWith("physics"))return"Physics";if(s.startsWith("chemistry"))return"Chemistry";if(s.startsWith("biology"))return"Biology";
    return""
  }
  function groupsByY(items,tol=2.4){
    const groups=[];
    for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){
      let g=groups.find(x=>Math.abs(x.y-it.y)<=tol);
      if(!g){g={y:it.y,items:[]};groups.push(g)}g.items.push(it)
    }
    return groups.sort((a,b)=>b.y-a.y).map(g=>({y:g.y,items:g.items.sort((a,b)=>a.x-b.x),text:clean(g.items.sort((a,b)=>a.x-b.x).map(x=>x.str).join(" "))}))
  }
  function headerX(items,rx){
    const choices=items.filter(x=>rx.test(clean(x.str)));if(!choices.length)return null;
    return choices.sort((a,b)=>b.y-a.y)[0].x
  }
  function joined(items){return clean(groupsByY(items).map(g=>g.text).join(" "))}

  pdfPageTableRows=function(items,pageText){
    const grade=detectGrades(pageText)[0]||null;if(!grade)return[];
    const pageSubject=explicitSubjectV2(pageText)||detectSubjects(pageText)[0]||"";
    const dateX=headerX(items,/^Date$/i),daysX=headerX(items,/Working/i),periodX=headerX(items,/^Periods?$/i),topicX=headerX(items,/^Topic$/i),trackAX=headerX(items,/Track\s*[-–]?\s*A/i),trackBX=headerX(items,/Track\s*[-–]?\s*B/i),activityX=headerX(items,/^Activity$/i),cbpX=headerX(items,/Character/i),ipeX=headerX(items,/Integrated/i);
    if(dateX==null||daysX==null)return[];
    const cols=[{k:"date",x:dateX},{k:"days",x:daysX}];
    for(const [k,x] of [["period",periodX],["topic",topicX],["a",trackAX],["b",trackBX],["activity",activityX],["cbp",cbpX],["ipe",ipeX]])if(x!=null&&!cols.some(c=>Math.abs(c.x-x)<3))cols.push({k,x});
    cols.sort((a,b)=>a.x-b.x);
    const bounds=cols.map((c,i)=>({k:c.k,min:i?((cols[i-1].x+c.x)/2):-Infinity,max:i<cols.length-1?((c.x+cols[i+1].x)/2):Infinity}));
    const bDate=bounds.find(x=>x.k==="date"),dateItems=items.filter(x=>x.x>=bDate.min&&x.x<bDate.max);
    const lines=groupsByY(dateItems),anchors=[];
    for(let i=0;i<lines.length;i++){
      const ds=isoDates(lines[i].text);if(!ds.length)continue;
      let start=ds[0],end=ds[1]||"",consume=0;
      if(!end){
        const n1=lines[i+1],n2=lines[i+2];
        if(n1&&/^to$/i.test(n1.text)&&n2){const x=isoDates(n2.text);if(x.length){end=x[0];consume=2}}
        else if(n1){const x=isoDates(n1.text);if(x.length&&/\bto\b/i.test(lines[i].text+" "+n1.text)){end=x[0];consume=1}}
      }
      anchors.push({start,end:end||start,y:lines[i].y});i+=consume
    }
    const unique=[];for(const a of anchors)if(!unique.some(x=>x.start===a.start&&x.end===a.end&&Math.abs(x.y-a.y)<3))unique.push(a);
    const value=(region,k)=>{const b=bounds.find(x=>x.k===k);return b?joined(region.filter(x=>x.x>=b.min&&x.x<b.max)):""};
    const out=[];
    for(let i=0;i<unique.length;i++){
      const r=unique[i],nextY=i<unique.length-1?unique[i+1].y:-Infinity;
      const region=items.filter(it=>it.y<=r.y+5&&it.y>nextY+4);
      const daysText=value(region,"days"),days=Number(daysText.match(/\b([0-7])\b/)?.[1]||0)||null;
      const periodText=value(region,"period"),period=Number(periodText.match(/\b(\d{1,2})\b/)?.[1]||0)||null;
      const activity=value(region,"activity"),cbp=value(region,"cbp"),ipe=value(region,"ipe");
      if(bounds.some(x=>x.k==="a")){
        const a=value(region,"a"),b=value(region,"b");
        if(a&&!/^Track/i.test(a))out.push({grade,subject:"Track A",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:period,topic:a});
        if(b&&!/^Track/i.test(b))out.push({grade,subject:"Track B",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:period,topic:b});
      }else{
        let topic=value(region,"topic");
        if(!topic&&periodText&&!/^\d+$/.test(periodText))topic=periodText;
        if(!topic){const extras=[];if(activity)extras.push(`Activity: ${activity}`);if(cbp)extras.push(`CBP: ${cbp}`);if(ipe)extras.push(`IPE: ${ipe}`);topic=extras.join(" | ")}
        out.push({grade,subject:canonicalSubject(pageSubject),startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:period,topic:clean(topic)})
      }
    }
    return out
  };

  function broadTopic(t){return/(exam|examination|revision|holiday|dussehra|pongal|bonalu)/i.test(String(t||""))}
  function addDays(iso,n){const d=new Date(iso+"T00:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
  function normalizeMergedRows(rows){
    const groups=new Map();
    for(const r of rows||[]){const k=`${r.grade||""}|${canonicalSubject(r.subject||"")}`;(groups.get(k)||groups.set(k,[]).get(k)).push(r)}
    for(const g of groups.values()){
      g.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
      for(const e of g){
        if(!broadTopic(e.topic))continue;const ds=isoDates(e.topic);if(ds.length>=2){const lo=addDays(ds[0],-2),hi=addDays(ds[1],1);for(const r of g)if(!clean(r.topic)&&r.startDate<=hi&&(r.endDate||r.startDate)>=lo)r.topic=e.topic}
      }
      for(let i=1;i<g.length;i++)if(!clean(g[i].topic)&&broadTopic(g[i-1].topic)&&g[i].startDate<=addDays(g[i-1].endDate||g[i-1].startDate,8))g[i].topic=g[i-1].topic;
    }
    return rows
  }
  function parseExcelDate(v){
    if(v instanceof Date&&!isNaN(v))return[v.toISOString().slice(0,10),v.toISOString().slice(0,10)];
    const d=isoDates(v);return d.length?[d[0],d[1]||d[0]]:[null,null]
  }
  function excelRowsV2(wb,fileName){
    const out=[];
    for(const sn of wb.SheetNames){
      const ws=wb.Sheets[sn],m=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});if(!m.length)continue;
      const headText=m.slice(0,20).flat().join(" "),grades=detectGrades(headText+" "+sn+" "+fileName),grade=grades[0]||null;
      let h=-1;
      for(let i=0;i<Math.min(40,m.length);i++){const z=m[i].map(clean);if(z.some(x=>/date/i.test(x))&&(z.some(x=>/topic|content|syllabus/i.test(x))||z.some(x=>/reasoning|arithmetic|vedic/i.test(x)))){h=i;break}}
      if(h<0)continue;const hdr=m[h].map(clean);
      const dateCol=hdr.findIndex(x=>/date/i.test(x)),daysCol=hdr.findIndex(x=>/working.*days|no.*days/i.test(x)),periodCol=hdr.findIndex(x=>/period/i.test(x));
      const subCols=[];for(let i=0;i<hdr.length;i++){const c=canonicalSubject(hdr[i]);if(["Reasoning","Arithmetic","Vedic Maths","Track A","Track B"].includes(c))subCols.push([i,c])}
      const topicCol=hdr.findIndex(x=>/topic|content|syllabus/i.test(x));const detected=detectSubjects(headText,fileName);
      for(let i=h+1;i<m.length;i++){
        const r=m[i],[start,end]=parseExcelDate(r[dateCol]);if(!start)continue;const days=Number(String(r[daysCol]??"").match(/\d+/)?.[0]||0)||null,periods=Number(String(r[periodCol]??"").match(/\d+/)?.[0]||0)||null;
        if(subCols.length){for(const [ci,s] of subCols){const t=clean(r[ci]);if(t)out.push({grade,subject:s,startDate:start,endDate:end,workingDays:days,plannedPeriods:periods,topic:t})}}
        else if(topicCol>=0){const t=clean(r[topicCol]);if(t)out.push({grade,subject:detected[0]||"",startDate:start,endDate:end,workingDays:days,plannedPeriods:periods,topic:t})}
      }
    }
    return out
  }

  const beforeRobust=smartParse;
  smartParse=async function(file){
    const ext=file.name.split(".").pop().toLowerCase();
    if(["xlsx","xls","csv"].includes(ext)&&window.XLSX){
      const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}),rows=excelRowsV2(wb,file.name);
      if(rows.length){const text=wb.SheetNames.map(n=>n+" "+XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");return smartDetection(file,text,wb.SheetNames.length,normalizeMergedRows(rows))}
    }
    const d=await beforeRobust(file);d.rows=normalizeMergedRows(d.rows||[]);return d
  };
})();