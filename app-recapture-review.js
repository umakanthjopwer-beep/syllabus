(function(){
  function enhance(){
    const panel=document.getElementById("dataIntegrityAudit");
    if(!panel)return;
    panel.dataset.reviewReady="1";
  }
  setTimeout(enhance,0);
})();
