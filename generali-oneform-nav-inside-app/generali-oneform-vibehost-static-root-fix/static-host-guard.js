/* Static upload guard: block backend-dependent actions when API isn't available. */
(async function(){
  let apiReady=false;
  try { const r=await fetch('/api/health',{cache:'no-store'}); apiReady=r.ok; } catch(_) {}
  if(apiReady) return;
  const warn=document.getElementById('staticHostWarning');
  if(warn) warn.textContent='STATIC HOSTING MODE — API server is not deployed. Login, customer link creation, form submission, storage, database, and official email submission are unavailable. Do not enter real customer information.';
  ['loginBtn','createLink','submitApplication','nextStep','prevStep','backHome','backForm','startAgain','logoutBtn'].forEach(id=>{const e=document.getElementById(id);if(e){e.disabled=true;e.title='Backend API is not deployed';}});
  ['loginEmail','loginPass','customerEmail','linkForm'].forEach(id=>{const e=document.getElementById(id);if(e)e.disabled=true;});
  const login=document.getElementById('loginPane'); if(login){const note=document.createElement('p');note.className='notice warning';note.textContent='Static frontend only. Staff login is unavailable until the Node/API backend is deployed.';login.appendChild(note);}
  const agent=document.getElementById('agentCard'); if(agent){const create=agent.querySelector('#createLink');if(create)create.disabled=true;}
})();
