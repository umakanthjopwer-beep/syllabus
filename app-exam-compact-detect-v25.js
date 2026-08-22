// Compact upload detection UX. Keeps the parser work unchanged but removes the oversized reading panel.
(function(){
  const q=s=>document.querySelector(s);
  function css(){if(q('#examCompactDetectCss'))return;const s=document.createElement('style');s.id='examCompactDetectCss';s.textContent=`
    .exam-detect-mini{display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:10px;border:1px solid #e1e8f0;border-radius:10px;background:#fff;color:#536a82;font-weight:750;font-size:12px}.exam-detect-dot{width:14px;height:14px;border:2px solid #c8d7e7;border-top-color:#2d659f;border-radius:50%;animation:examspin .8s linear infinite}@keyframes examspin{to{transform:rotate(360deg)}}
  `;document.head.appendChild(s)}
  function compact(){css();const host=q('#examAutoMappings');if(!host)return;const text=(host.textContent||'').replace(/\s+/g,' ').trim();if(!/Reading .*subject|Reading the two-level|Reading .*exam PDF|Detecting syllabus/i.test(text))return;if(host.querySelector('.exam-detect-mini'))return;host.innerHTML='<div class="exam-detect-mini"><span class="exam-detect-dot"></span><span>Detecting syllabus…</span></div>'}
  const mo=new MutationObserver(compact);mo.observe(document.body,{childList:true,subtree:true,characterData:true});setInterval(compact,350);compact()
})();