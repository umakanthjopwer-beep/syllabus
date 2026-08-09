function simplifyStaffLogin(){
  const screen=document.getElementById("loginScreen");
  if(!screen)return;
  const title=screen.querySelector("h2");
  if(title)title.textContent="Staff Login";
  const intro=screen.querySelector("p.muted");
  if(intro)intro.textContent="Enter your username and password.";
  const button=document.getElementById("loginBtn");
  if(button)button.textContent="LOGIN";
  const note=screen.querySelector(".info-note");
  if(note)note.remove();
  const username=document.getElementById("loginUsername");
  const password=document.getElementById("loginPassword");
  if(username){username.setAttribute("autocomplete","username");username.setAttribute("autocapitalize","none");username.setAttribute("spellcheck","false")}
  if(password)password.setAttribute("autocomplete","current-password");
}
simplifyStaffLogin();
