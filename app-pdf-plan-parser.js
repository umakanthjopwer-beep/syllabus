function pdfDateToken(s){const z=String(s||"").replaceAll("‐","-").replaceAll("–","-").replaceAll(".","-");const m=z.match(/^(\d{1,2})-(\d{1,2})-(\d{3,4})$/);if(!m)return null;let y=m[3];if(y==="202")y="2026";if(y.length!==4)return null;return`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`}
function pdfLine(items){const groups=[];for(const it of items.sort((a,b)=>b.y-a.y||a.x-b.x)){let g=groups.find(x=>Math.abs(x.y-it.y)<2);if(!g){g={y:it.y,items:[]};groups.push(g)}g.items.push(it)}return groups.sort((a,b)=>b.y-a.y).map(g=>g.items.sort((a,b)=>a.x-b.x).map(x=>x.str).join(" ").replace(/\s+/g," ").trim()).filter(Boolean).join("\n")}
function pdfColHeader(items,rx){const m=items.find(x=>rx.test(String(x.str||"").trim()));return m?m.x:null}
function pdfPageTableRows(items,pageText){
  const grade=detectGrades(pageText)[0]||null,subjects=detectSubjects(pageText);if(!grade)return[];
  const dateX=pdfColHeader(items,/^Date$/i),daysX=pdfColHeader(items,/Working/i),periodX=pdfColHeader(items,/^Period$/i),topicX=pdfColHeader(items,/^Topic$/i),trackAX=pdfColHeader(items,/Track.*A/i),trackBX=pdfColHeader(items,/Track.*B/i),activityX=pdfColHeader(items,/^Activity$/i);
  if(dateX==null||daysX==null)return[];
  const cols=[{k:"date",x:dateX},{k:"days",x:daysX}];if(periodX!=null)cols.push({k:"period",x:periodX});if(topicX!=null)cols.push({k:"topic",x:topicX});if(trackAX!=null)cols.push({k:"a",x:trackAX});if(trackBX!=null)cols.push({k:"b",x:trackBX});if(activityX!=null)cols.push({k:"activity",x:activityX});cols.sort((a,b)=>a.x-b.x);
  const boundaries=cols.map((c,i)=>({k:c.k,min:i?((cols[i-1].x+c.x)/2):-Infinity,max:i<cols.length-1?((c.x+cols[i+1].x)/2):Infinity}));
  const inDate=items.filter(x=>{const b=boundaries.find(z=>z.k==="date");return x.x>=b.min&&x.x<b.max}).sort((a,b)=>b.y-a.y);
  const starts=[];for(let i=0;i<inDate.length;i++){const d=pdfDateToken(String(inDate[i].str||"").trim());if(!d)continue;const between=inDate.slice(i+1,i+3),to=between.find(x=>/^to$/i.test(String(x.str||"").trim())),endItem=to?inDate[inDate.indexOf(to)+1]:null,end=endItem?pdfDateToken(String(endItem.str||"").trim()):null;starts.push({start:d,end:end||d,y:inDate[i].y});if(to&&endItem)i=inDate.indexOf(endItem)}
  const unique=[];for(const r of starts)if(!unique.some(x=>x.start===r.start&&Math.abs(x.y-r.y)<2))unique.push(r);
  const out=[];for(let i=0;i<unique.length;i++){const r=unique[i],nextY=i<unique.length-1?unique[i+1].y:-Infinity,region=items.filter(it=>it.y<=r.y+5&&it.y>nextY+5);const val=k=>{const b=boundaries.find(z=>z.k===k);return b?pdfLine(region.filter(x=>x.x>=b.min&&x.x<b.max&&x.y<r.y+6)):""};const dayText=val("days"),days=Number(dayText.match(/\b([0-7])\b/)?.[1]||0)||null,periodText=val("period"),period=Number(periodText.match(/\b(\d{1,2})\b/)?.[1]||0)||null,activity=val("activity");
    if(boundaries.some(x=>x.k==="a")){const a=val("a"),b=val("b");if(a&&!/^Track/i.test(a))out.push({grade,subject:"Track A",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:null,topic:(a+(activity?` | ${activity}`:"")).trim()});if(b&&!/^Track/i.test(b))out.push({grade,subject:"Track B",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:null,topic:(b+(activity?` | ${activity}`:"")).trim()})}
    else{let topic=val("topic");if(!topic&&periodText&&!/^\d+$/.test(periodText.trim()))topic=periodText;out.push({grade,subject:subjects[0]||"",startDate:r.start,endDate:r.end,workingDays:days,plannedPeriods:period,topic:topic.trim()})}
  }return out
}

const _smartParseBase=smartParse;
smartParse=async function(file){
  const ext=file.name.split(".").pop().toLowerCase();if(ext!=="pdf")return _smartParseBase(file);
  const pdfjs=await loadPdfJs(),pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let text="",rows=[],gradeContext="",subjectContext="";
  for(let i=1;i<=pdf.numPages;i++){
    const pg=await pdf.getPage(i),tc=await pg.getTextContent(),items=tc.items.map(x=>({str:x.str,x:x.transform[4],y:x.transform[5]})),pageText=items.map(x=>x.str).join(" ");
    const pageGrades=detectGrades(pageText,file.name),pageSubjects=detectSubjects(pageText,file.name);
    if(pageGrades.length)gradeContext=pageText;
    if(pageSubjects.length)subjectContext=pageText;
    const parseText=[pageText,gradeContext,subjectContext].filter(Boolean).join(" ");
    text+=pageText+"\n";rows.push(...pdfPageTableRows(items,parseText))
  }
  return smartDetection(file,text,pdf.numPages,rows)
};
