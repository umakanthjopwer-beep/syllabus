(function(){
  function enhance(){
    const panel=document.getElementById("dataIntegrityAudit");
    if(!panel)return;
    panel.querySelectorAll("#auditTable tr").forEach(function(tr){
      if(tr.dataset.reviewReady==="1"||tr.cells.length<8)return;
      tr.dataset.reviewReady="1";
      const b=document.createElement("button");
      b.type="button";
      b.textContent="View Issue";
      tr.cells[7].appendChild(b);
    });
  }
  setTimeout(enhance,0);
})();
