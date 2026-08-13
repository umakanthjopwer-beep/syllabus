(function(){
  function enhance(){
    const panel=document.getElementById("dataIntegrityAudit");
    if(!panel)return;
    panel.querySelectorAll("#auditTable tr").forEach(function(tr){
      if(tr.dataset.reviewReady==="1"||tr.cells.length<8)return;
      tr.dataset.reviewReady="1";
      const d=document.createElement("details");
      const s=document.createElement("summary");
      s.textContent="View Issue";
      const p=document.createElement("div");
      p.textContent=String(tr.cells[6].textContent||"").trim();
      d.appendChild(s);d.appendChild(p);
      tr.cells[7].appendChild(d);
    });
  }
  setTimeout(enhance,0);
})();
