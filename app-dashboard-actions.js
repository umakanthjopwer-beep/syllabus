// Super Admin dashboard quick actions.
(function(){
  function go(view){
    try{showView(view)}catch(e){const b=document.querySelector(`[data-view="${view}"]`);b?.click()}
  }
  function ensureStyles(){
    if(document.getElementById("dashboardQuickActionStyles"))return;
    const s=document.createElement("style");s.id="dashboardQuickActionStyles";s.textContent=`
      .dashboard-quick-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:-2px 0 18px;box-shadow:var(--shadow)}
      .dashboard-quick-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.dashboard-quick-head h3{margin:3px 0 0;font-size:16px}.dashboard-quick-head small{color:var(--muted)}
      .dashboard-quick-actions{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.dashboard-quick-actions button{border:1px solid #d5dfec;background:#fff;color:#23528e;border-radius:11px;padding:12px 10px;font-weight:800;font-size:11px;line-height:1.25}.dashboard-quick-actions button:hover{background:#f4f8fe;border-color:#8db0df}.dashboard-quick-actions .primary-action{background:linear-gradient(135deg,#2865c2,#1b4a93);color:#fff;border-color:transparent}
      @media(max-width:900px){.dashboard-quick-actions{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:600px){.dashboard-quick-actions{grid-template-columns:1fr 1fr}.dashboard-quick-head{align-items:flex-start;flex-direction:column}}
    `;document.head.appendChild(s)
  }
  function audit(){
    go("setup");setTimeout(()=>{const el=document.getElementById("dataIntegrityAudit");if(el)el.scrollIntoView({behavior:"smooth",block:"start"})},120)
  }
  function fullRecapture(){
    go("setup");setTimeout(()=>{const b=document.getElementById("bulkRecaptureAllBtn");if(b){b.scrollIntoView({behavior:"smooth",block:"center"});b.click()}else alert("Full Year Re-capture is still loading. Open Setup and try again.")},180)
  }
  function ensurePanel(){
    const dash=document.getElementById("dashboard");if(!dash)return;let p=document.getElementById("dashboardQuickActions");
    if(!p){
      p=document.createElement("div");p.id="dashboardQuickActions";p.className="dashboard-quick-panel";p.innerHTML=`
        <div class="dashboard-quick-head"><div><div class="eyebrow">SUPER ADMIN</div><h3>Quick Actions</h3></div><small>Common syllabus monitoring actions</small></div>
        <div class="dashboard-quick-actions">
          <button type="button" id="dashWeeklyBtn" class="primary-action">Weekly Status</button>
          <button type="button" id="dashReportsBtn">Reports</button>
          <button type="button" id="dashAuditBtn">Year Plan Audit & Fix</button>
          <button type="button" id="dashRecaptureBtn">Full Year Re-capture</button>
          <button type="button" id="dashUsersBtn">Users & Access</button>
        </div>`;
      const stats=dash.querySelector(".stats-grid");stats?.after(p);if(!stats)dash.prepend(p);
      document.getElementById("dashWeeklyBtn").onclick=()=>go("weekly");
      document.getElementById("dashReportsBtn").onclick=()=>go("reports");
      document.getElementById("dashAuditBtn").onclick=audit;
      document.getElementById("dashRecaptureBtn").onclick=fullRecapture;
      document.getElementById("dashUsersBtn").onclick=()=>go("users")
    }
    p.classList.toggle("hidden",currentUser?.role!=="Super Admin")
  }
  ensureStyles();
  const baseRenderDashboard=renderDashboard;
  renderDashboard=function(){const r=baseRenderDashboard();ensurePanel();return r};
  const baseOpenApp=openApp;
  openApp=function(){const r=baseOpenApp();setTimeout(ensurePanel,0);return r};
  setTimeout(ensurePanel,0)
})();