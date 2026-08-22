// Exam completion-date default v28. Fills blank "Date to be Completed" as Exam Date - 3 days without changing role/access scope.
(function(){
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  function minus3(iso){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||"")))return"";
    const [y,m,d]=iso.split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d));
    dt.setUTCDate(dt.getUTCDate()-3);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}-${String(dt.getUTCDate()).padStart(2,"0")}`
  }
  function examDateFromForm(form){
    const direct=[...form.querySelectorAll("input")].find(i=>i.disabled&&/^\d{4}-\d{2}-\d{2}$/.test(i.value||""));
    if(direct)return direct.value;
    const labels=[...form.querySelectorAll("label")];
    const l=labels.find(x=>/^Exam Date\b/i.test((x.textContent||"").trim()));
    return l?.querySelector("input")?.value||""
  }
  function targetDateInput(form){
    return form.querySelector(".exam18-date,.eh18-date")||[...form.querySelectorAll("label")].find(x=>/^(Date to be Completed|By Which Date Will You Complete)/i.test((x.textContent||"").trim()))?.querySelector('input[type="date"],input')||null
  }
  function fill(form){
    const target=targetDateInput(form);if(!target||target.value)return;
    const examDate=examDateFromForm(form),v=minus3(examDate);if(!v)return;
    target.value=v;target.dataset.autoExamDeadline="1";
  }
  function run(){qa(".exam18-form,.eh18-form").forEach(fill)}
  new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
  setInterval(run,700);run()
})();
