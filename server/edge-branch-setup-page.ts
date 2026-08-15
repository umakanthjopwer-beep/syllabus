// Public invitation page for authorized branch self-onboarding.
// The invitation token stays in the browser URL and is validated server-side by branch-onboarding.
const PAGE_URL="https://raw.githubusercontent.com/umakanthjopwer-beep/syllabus/a2678980c384821fbc696b6f8a1b634a44c01b60/branch-setup.html";
let cachedPage="";

Deno.serve(async req=>{
  if(req.method!=="GET")return new Response("Method not allowed",{status:405,headers:{"Content-Type":"text/plain;charset=utf-8"}});
  try{
    if(!cachedPage){
      const r=await fetch(PAGE_URL,{headers:{"Accept":"text/html"}});
      if(!r.ok)throw new Error(`Unable to load setup page (${r.status})`);
      cachedPage=await r.text();
    }
    return new Response(cachedPage,{status:200,headers:{"Content-Type":"text/html;charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}})
  }catch(e){
    console.error(e);
    return new Response("Branch setup page is temporarily unavailable. Please try again.",{status:503,headers:{"Content-Type":"text/plain;charset=utf-8","Cache-Control":"no-store"}})
  }
});