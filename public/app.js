const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const qs=new URLSearchParams(location.search);const hashToken=qs.get('token')||(location.hash.match(/[#&]t=([A-Za-z0-9_.-]+)/)||[])[1]||null;
const state={user:null,form:null,step:0,token:hashToken,answers:{},members:[{}],signatureMode:'draw',signatureData:null,stampData:null,lang:'ms',drafts:{},busy:false,link:null};
const templates={PI:'PI-Security-Guards-02-2025.pdf',PL:'Public-Liability-02-2025.pdf',GPA:'Biz-PA-Proposal-12-2025.pdf'};
const steps={
PI:[{title:'General Data',desc:'Page 1/6 · Professional Indemnity - Security Guards',fields:[['firm','Name of firm','text',1],['reg','Business Registration No.','text',1],['established','When was the firm established?','date'],['head','Address of Head Office','textarea',1],['branch','Address of Branch Office(s), if any','textarea'],['licensed','Are you licensed by Home Ministry?','yesno'],['licence','License No. & Expiry Date','text'],['coverFrom','Period of cover required - From','date'],['coverTo','Period of cover required - To','date'],['staffDirector','Number of Director/CEO/Principal Officer','number'],['staffManager','Number of Managers/Supervisors','number'],['staffAdmin','Number of Administrative/Clerical Staff','number'],['armed','Number of Security Guards - Armed','number'],['unarmed','Number of Security Guards - Unarmed','number'],['others','Number of Others','number']]},{title:'Company Profile & Controls',desc:'Page 2/6 · Management, clients, firearms, turnover and procedures',fields:[['profile','Company Profile / related information','textarea',1],['ppkkm','PPKKM member?','yesno'],['ppkkmRef','PPKKM membership reference','text'],['management','Names of principals / management and experience','textarea'],['structure','Organizational structure','textarea'],['clients','List of major clients','textarea'],['firearms','Are employees/guards equipped with firearms on duty?','yesno'],['firearmDetails','Number and type of firearms','textarea'],['fyFrom','Financial year - From','date'],['fyTo','Financial year - To','date'],['audited','Latest audited accounts / annual report details','textarea'],['turnoverLast','Last financial year turnover (RM)','number'],['turnoverCurrent','Estimate current financial year (RM)','number'],['turnoverNext','Estimate next financial year (RM)','number'],['training','Training given to security guards? Details and conductors','textarea'],['background','Background checking before employment? Details','textarea'],['drug','Random and ongoing drug testing? Details','textarea'],['sop','Operating procedures reviewed periodically? Frequency','textarea'],['ethics','Established code of ethics for guards? Details','textarea']]},{title:'Activities & Risk Details',desc:'Page 3/6 · Breakdown of activities, screening, indemnity and excess',fields:[['staticUnarmed','Static guards - Unarmed (%)','number'],['staticArmed','Static guards - Armed (%)','number'],['escorts','Security escorts (%)','number'],['cash','Transit cash / monetary items (%)','number'],['vault','Overnight vaulting and bank in service (%)','number'],['payroll','Payroll packaging (%)','number'],['dogs','Guard dogs services (%)','number'],['cmsWithout','CMS without patrolling (%)','number'],['cmsWith','CMS with patrolling (%)','number'],['otherServices','Other services (%) / specify','textarea'],['agreement','Require client to sign PPKKM standard service agreement?','yesno'],['agreementReason','If no, reasons','textarea'],['screening','Process of screening and conditions before employment','textarea'],['sopCheck','How ensure SOP is carried out before employment?','textarea'],['armedDocs','Documentary proof, licensing and procedure for armed guards','textarea'],['outsourcing','Outsource guards or use other companies’ guards?','textarea'],['indemnity','Amount of insurance indemnity required','textarea'],['excessClaim','Excess for any one claim (RM)','number'],['excessAll','Excess for all claims during period (RM)','number']]},{title:'Claims, Declaration & Signature',desc:'Page 4/6 · Claims history, important notices and proposer signature',fields:[['claims5','Claims made against firm in past 5 years? Give particulars','textarea'],['discipline','Disciplinary proceedings for professional misconduct? Details','textarea'],['claims10','Claims for negligence / breach of professional duty in last 10 years? Details','textarea'],['circumstances','Circumstances likely to give rise to a claim? Details','textarea'],['previous','Previously proposed / insured for this liability?','yesno'],['insurer','Name of insurer','text'],['indemnityPrev','Previous amount of indemnity','text'],['excessPrev','Previous excess borne by firm','text'],['expiryPrev','Previous policy expiry date','date'],['declined','Declined to insure?','yesno'],['special','Special terms imposed?','yesno'],['cancelled','Cancelled / refused renewal?','yesno'],['mandatory','I/We agree with mandatory Terms & Conditions','checkbox',1],['marketing','Optional marketing consent','checkbox'],['signerName','Name of authorized signatory','text',1],['designation','Designation','text',1],['signedDate','Date','date',1]]}],
PL:[{title:'Proposer Details',desc:'Page 1/5 · Public Liability Insurance Proposal Form',fields:[['proposer','Name of Proposer','text',1],['ic','I/C or Company No.','text',1],['address','Postal Address','textarea',1],['postcode','Post Code','text'],['occupation','Occupation','text',1],['phone','Tel No.','tel',1],['from','Period of Insurance - From','date',1],['to','Period of Insurance - To','date',1],['gst','Are you a GST Registrant?','yesno'],['gstNo','GST Registration No.','text'],['gstDate','GST Registration Date','date'],['gstEnd','GST Registration Termination Date','date'],['use','Insurance purchased for','select',0,['Personal Use','Business Use']]]},{title:'Risk & Premises',desc:'Page 2/5 · Premises, activities, employees and claims',fields:[['premises','Premises / situation','textarea',1],['lifts','Lifts / escalators / cranes details','textarea'],['machinery','Machinery condition','textarea'],['offsite','Activities away from premises','textarea'],['digging','Digging / excavation activities','textarea'],['employees','Employees / payroll details','textarea'],['subcontractors','Subcontractors details','textarea'],['hazards','Hazardous substances details','textarea'],['previous','Previous insurance details','textarea'],['claims','Claims history / circumstances','textarea'],['otherInsurance','Other insurance','textarea']]},{title:'Limit, Declaration & Stamp',desc:'Page 3/5 · Limit of indemnity, consent, company stamp and agent verification',fields:[['limit','Limit of Indemnity','text',1],['project','Project / Contract details','textarea'],['signedDay','Dated this day','text'],['signedMonth','Month','text'],['designation','Designation','text',1],['mandatory','Mandatory consent','checkbox',1],['marketing','Optional marketing consent','checkbox'],['agentSignature','Agent verification signature name / details','textarea'],['agentName','Agent name','text'],['agentNric','Agent NRIC No.','text'],['agentDate','Agent date','date']]}],
GPA:[{title:'Proposer & Contact Details',desc:'Page 1-2/7 · Biz PA Proposal Form (EM) 12/2025',fields:[['company','Company Name','text',1],['reg','Company Registration / Business License No.','text',1],['sst','SST Registration No.','text'],['address','Company Address','textarea',1],['postcode','Postcode','text'],['telephone','Telephone No.','tel'],['email','Email','email'],['nature','Nature of Business','textarea',1],['contact1','Name of Contact Person 1','text'],['designation1','Designation','text'],['contactNo1','Contact No.','tel'],['contact2','Name of Contact Person 2','text'],['designation2','Designation','text'],['contactNo2','Contact No.','tel'],['from','Period of Insurance - From','date',1],['to','Period of Insurance - To','date',1],['subsidiary','Separate billing for subsidiary?','yesno'],['subsidiaryDetails','Subsidiary name, registration number and address','textarea'],['q1','Insurer ever defer/decline/terminate accident insurance?','yesno'],['q2','Similar benefit insurance currently in force?','yesno'],['q3','Claims lodged? Provide full details','textarea']]},{title:'Declaration & Payment',desc:'Page 3/7 · Employer declaration, witness, authorized officer and payment',fields:[['employerName','Employer / authorized company name','text',1],['agentBroker','Agent / Broker signature name','text'],['witness','Witnessed by','text'],['authorizedName','Authorized Officer name','text',1],['designation','Designation','text',1],['datedAt','Dated at','text'],['paymentMethod','Payment method','select',0,['Cheque','Online Transfer','Other']],['chequeNo','Cheque number (if applicable)','text'],['bank','Bank / payment details','text'],['paymentAmount','Payment amount (RM)','number'],['marketing','Optional marketing consent','checkbox'] ]},{title:'Persons to be Insured',desc:'Page 7/7 · Particular of persons to be insured and premium calculation',fields:[['totalPremium','Total Premium (RM)','number'],['serviceTax','8% Service Tax (RM)','number'],['stampDuty','Stamp Duty (RM)','number'],['totalPayable','Total Payable (RM)','number']]}]
};
const translations={ms:{portalEjen:"PORTAL EJEN",loginTitle:"Log masuk ejen",email:"Emel",password:"Kata laluan",loginBtn:"Log masuk",custNote:"Pelanggan: sila gunakan pautan selamat yang diberikan oleh ejen anda.",createTitle:"Cipta pautan pelanggan",logout:"Log keluar",createBtn:"Cipta pautan",custEmail:"Emel pelanggan (pilihan)",linkLabel:"Pautan selamat (sah 7 hari)",copy:"Salin",linkNote:"Hantar pautan ini kepada pelanggan anda sahaja.",recent:"Permohonan terkini",downloadPdf:"Muat turun PDF lengkap",exportRec:"Eksport rekod",importRec:"Import rekod",expiredLink:"Pautan telah tamat tempoh (7 hari). Minta ejen anda menjana pautan baharu.",doneText:"Permohonan anda telah disimpan. Muat turun PDF dan hantar fail rekod kepada ejen anda.",pdfFail:"Gagal menjana PDF.",storageErr:"Storan pelayar penuh. Padam data lama dan cuba lagi.",locked:"Terlalu banyak percubaan. Cuba lagi dalam 5 minit.",imported:"Rekod diimport:",importErr:"Fail rekod tidak sah.",navHome:'Utama',loginFirst:'Sila log masuk sebagai ejen, atau gunakan pautan selamat daripada ejen anda.',noApps:'Belum ada permohonan.',loginFail:'Log masuk gagal.',nextBtn:'Seterusnya →',reviewBtn:'Semak permohonan →',badLink:'Pautan tidak sah',wrongForm:'Pautan ini khusus untuk borang',dateErr:'Tarikh tamat mesti selepas tarikh mula.',missing:'Sila lengkapkan:',imgErr:'Sila pilih PNG/JPG maksimum 3MB.',needConfirm:'Sila sahkan maklumat dahulu.',needSign:'Sila masukkan tandatangan.',needLink:'Pautan pelanggan diperlukan. Minta ejen anda menjana pautan.',submitFail:'Penghantaran gagal.',copied:'Pautan disalin.',linkFail:'Tidak dapat mencipta pautan.',secure:'Portal selamat',eyebrow:'PORTAL PERMOHONAN PELANGGAN',headline:'Borang insurans,<br><em>lebih mudah.</em>',subheadline:'Pilih borang, lengkapkan maklumat dan hantar kepada ejen anda melalui pautan selamat.',trust1:'Tidak perlu akaun pelanggan',trust2:'Simpan semasa mengisi',trust3:'Template PDF asal',start:'MULA DI SINI',choose:'Pilih jenis borang',note:'Pautan pelanggan perlu dijana oleh ejen.',createLink:'Cipta pautan pelanggan',back:'Kembali',sourcePdf:'Borang asal Generali',downloadBlank:'Muat turun template kosong',previous:'Sebelumnya',next:'Seterusnya',reviewTitle:'Semak sebelum dihantar',reviewSub:'Pastikan maklumat betul. Tandatangan dan cop dimasukkan sebagai imej sokongan.',signature:'Tandatangan pemohon',stamp:'Cop syarikat (Company Stamp)',stampHelp:'Upload cop rasmi syarikat dalam format PNG/JPG.',uploadStamp:'Upload cop syarikat',clear:'Padam',chooseFile:'Pilih imej',confirm:'Saya mengesahkan maklumat yang diberikan adalah tepat dan telah membaca notis serta persetujuan yang berkenaan dalam borang asal.',submit:'Hantar permohonan',received:'Permohonan diterima',startAgain:'Kembali ke halaman utama',backEdit:'Kembali ke borang',f1:'Template asal',f1s:'Dokumen rasmi dikekalkan sebagai rujukan',f2:'Akses tetamu',f2s:'Pelanggan tidak perlu daftar akaun',f3:'Semakan ejen',f3s:'Aliran semakan ejen dirancang',footer:'Bukan portal rasmi Generali dan bukan saluran penghantaran terus kepada insurer.'},en:{portalEjen:"AGENT PORTAL",loginTitle:"Agent sign-in",email:"Email",password:"Password",loginBtn:"Sign in",custNote:"Customers: please use the secure link provided by your agent.",createTitle:"Create customer link",logout:"Sign out",createBtn:"Create link",custEmail:"Customer email (optional)",linkLabel:"Secure link (valid 7 days)",copy:"Copy",linkNote:"Send this link to your customer only.",recent:"Recent applications",downloadPdf:"Download complete PDF",exportRec:"Export records",importRec:"Import records",expiredLink:"This link has expired (7 days). Ask your agent for a new one.",doneText:"Your application is saved. Download the PDF and send the record file to your agent.",pdfFail:"Could not generate the PDF.",storageErr:"Browser storage is full. Clear old data and try again.",locked:"Too many attempts. Try again in 5 minutes.",imported:"Records imported:",importErr:"Invalid record file.",navHome:'Home',loginFirst:'Please sign in as an agent, or use the secure link from your agent.',noApps:'No applications yet.',loginFail:'Sign-in failed.',nextBtn:'Next →',reviewBtn:'Review application →',badLink:'Invalid link',wrongForm:'This link is only for form',dateErr:'End date must be after the start date.',missing:'Please complete:',imgErr:'Please choose a PNG/JPG up to 3MB.',needConfirm:'Please confirm the declaration first.',needSign:'Please add a signature.',needLink:'A customer link is required. Ask your agent to create one.',submitFail:'Submission failed.',copied:'Link copied.',linkFail:'Could not create the link.',secure:'Secure portal',eyebrow:'CUSTOMER APPLICATION PORTAL',headline:'Insurance forms,<br><em>made simpler.</em>',subheadline:'Choose a form, complete the details and submit to your agent through a secure link.',trust1:'No customer account required',trust2:'Save while completing',trust3:'Original PDF templates',start:'GET STARTED',choose:'Choose an application',note:'Customer links should be issued by your agent.',createLink:'Create customer link',back:'Back',sourcePdf:'Original Generali form',downloadBlank:'Download blank template',previous:'Previous',next:'Next',reviewTitle:'Review before submission',reviewSub:'Check your details. Signature and company stamp are attached as supporting images.',signature:'Applicant signature',stamp:'Company Stamp',stampHelp:'Upload the official company stamp as PNG/JPG.',uploadStamp:'Upload company stamp',clear:'Clear',chooseFile:'Choose image',confirm:'I confirm that the information provided is accurate and that I have read the relevant notices and consents in the original form.',submit:'Submit application',received:'Application received',startAgain:'Return to home',backEdit:'Back to form',f1:'Original templates',f1s:'Official documents retained as reference',f2:'Guest access',f2s:'Customers do not need an account',f3:'Agent review',f3s:'Agent review workflow planned',footer:'Not an official Generali portal and not a direct submission channel to the insurer.'}};
const FORM_NAV={PI:3,GPA:1,PL:2}, NAV_FORMS=[null,'GPA','PL','PI'];
const FORM_NAMES={PI:['Professional Indemnity','Security Guards'],PL:['Public Liability','Insurance Proposal Form'],GPA:['Biz PA / GPA','Group Personal Accident workflow']};
const DATE_PAIRS=[['coverFrom','coverTo'],['from','to'],['fyFrom','fyTo']];
let nav=null;
/* Nav dock only lives inside the app: after agent login, or on a customer link. Never on the public login page. */
function syncMode(){document.body.dataset.mode=(state.user||state.token)?'app':'auth'}
const reduceMotion=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function t(k){return translations[state.lang][k]||k}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>el.classList.remove('show'),3200)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function formVisible(){return !$('#formView').classList.contains('hidden')}
function show(id){['#homeView','#formView','#reviewView','#doneView'].forEach(s=>$(s).classList.add('hidden'));$(id).classList.remove('hidden');window.scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'});syncNav(id)}
function syncNav(id){if(!nav)return;const onHome=id==='#homeView'||id==='#doneView'||!state.form;nav.setActive(onHome?0:FORM_NAV[state.form])}
function navLabels(){return[t('navHome'),'Biz PA','Public Liability','PI Security Guards']}
function applyLang(){document.documentElement.lang=state.lang;$$('[data-i18n]').forEach(el=>{el.innerHTML=t(el.dataset.i18n)});$('#langBtn').textContent=state.lang==='ms'?'EN':'BM';if(nav)nav.setLabels(navLabels())}

/* ---------- drafts: kept in memory only (no PII in browser storage) ---------- */
function saveDraft(){if(state.form)state.drafts[state.form]={answers:{...state.answers},members:state.members.map(m=>({...m})),step:state.step};if(state.link)OneForm.saveDraft(state.link.id,state.drafts[state.form])}
function collect(){
  if(!state.form||!formVisible())return;
  const form=$('#dynamicForm');new FormData(form).forEach((v,k)=>state.answers[k]=v);
  form.querySelectorAll('input[type=checkbox]').forEach(x=>state.answers[x.name]=x.checked);
  saveDraft();
}
function startForm(type){
  if(state.form&&state.form!==type)saveDraft();
  const d=state.drafts[type]||(state.link&&OneForm.loadDraft(state.link.id));
  state.form=type;state.step=d?d.step:0;state.answers=d?{...d.answers}:{};state.members=d?d.members.map(m=>({...m})):[{}];
  const [name,sub]=FORM_NAMES[type];$('#formTitle').textContent=name;$('#formSubtitle').textContent=sub;
  $('#downloadTemplate').onclick=()=>{location.href='./templates/'+templates[type]};
  renderStep();show('#formView');
}
const linkMsg=e=>e.message==='expired'?t('expiredLink'):e.message==='bad'?t('badLink'):e.message;
async function openForm(type){
  if(!state.token){toast(t('loginFirst'));return}
  try{const d=await OneForm.readToken(state.token,qs.get('type'),qs.get('exp'));state.link=d;if(d.type!==type)throw Error(t('wrongForm')+' '+d.type);startForm(type)}
  catch(e){toast(linkMsg(e));syncNav(formVisible()?'#formView':'#homeView')}
}
function goHome(){collect();show('#homeView')}
function onNav(i){
  if(i===0){if(state.token)goHome();else show('#homeView');return}
  if(state.token)return openForm(NAV_FORMS[i]);
  if(state.user){$('#linkForm').value=NAV_FORMS[i];$('#linkForm').focus();return}
  toast(t('loginFirst'));nav.setActive(0);
}

/* ---------- rendering ---------- */
function renderStep(){
  const arr=steps[state.form],s=arr[state.step],last=state.step===arr.length-1;
  $('#extraArea').innerHTML='';$('#stepEyebrow').textContent=`STEP ${state.step+1} / ${arr.length}`;$('#stepTitle').textContent=s.title;$('#stepDescription').textContent=s.desc;
  $('#progressBar').style.width=((state.step+1)/arr.length*100)+'%';
  $('#stepList').innerHTML=arr.map((x,i)=>`<div class="step-item ${i===state.step?'active':''} ${i<state.step?'done':''}"${i===state.step?' aria-current="step"':''}><span>${i<state.step?'✓':i+1}</span>${esc(x.title)}</div>`).join('');
  $('#prevStep').style.visibility=state.step===0?'hidden':'visible';
  $('#nextStep').textContent=last?t('reviewBtn'):t('nextBtn');
  $('#fieldGrid').innerHTML=s.fields.map(fieldHtml).join('');
  if(state.form==='GPA'&&state.step===2){renderMembers();wireGpaTotals()}
}
function fieldHtml(f){
  const [key,label,type,required,options]=f,val=state.answers[key]??'',id='f_'+key,req=required?' required':'',L=esc(label);let input='',head=`<label for="${id}">${L}${required?' *':''}</label>`;
  if(type==='textarea')input=`<textarea id="${id}" name="${key}" placeholder="${L}"${req}>${esc(val)}</textarea>`;
  else if(type==='yesno'){head=`<span class="field-label" id="${id}_l">${L}</span>`;input=`<div class="choice-row" role="radiogroup" aria-labelledby="${id}_l">${['Yes','No'].map(v=>`<label><input type="radio" name="${key}" value="${v}"${val===v?' checked':''}${req}> ${v}</label>`).join('')}</div>`}
  else if(type==='checkbox'){head='';input=`<div class="choice-row"><label><input type="checkbox" name="${key}"${val?' checked':''}${req}> ${L}${required?' *':''}</label></div>`}
  else if(type==='select')input=`<select id="${id}" name="${key}"${req}><option value="">Select…</option>${options.map(o=>`<option${val===o?' selected':''}>${esc(o)}</option>`).join('')}</select>`;
  else{const num=type==='number'?` step="any" min="0" inputmode="decimal"${/\(%\)/.test(label)?' max="100"':''}`:'';input=`<input id="${id}" name="${key}" type="${type}" value="${esc(val)}"${req}${num}>`}
  return `<div class="field ${type==='textarea'?'full-width':''}">${head}${input}</div>`;
}
const MEMBER_COLS=['Name','NRIC/Passport','DOB','Nationality','Gender','Occupation','Class','Plan','Benefits','Premium RM'],MEMBER_KEYS=['name','id','dob','nationality','gender','occupation','class','plan','benefits','premium'];
function renderMembers(){
  const wrap=document.createElement('div');wrap.className='field full-width';
  wrap.innerHTML=`<span class="field-label">Particular of persons to be insured – Page 7/7</span><div class="table-wrap"><table class="repeat-table"><thead><tr>${MEMBER_COLS.map(x=>`<th>${x}</th>`).join('')}<th><span class="sr-only"></span></th></tr></thead><tbody id="memberRows"></tbody></table></div><button type="button" class="add-row" id="addMember">＋ Add insured person</button><p class="hint">This data table is a digital collection aid. Final PDF coordinate mapping remains pending.</p>`;
  $('#extraArea').append(wrap);drawMemberRows();$('#addMember').onclick=()=>{state.members.push({});drawMemberRows()};
}
function drawMemberRows(){
  $('#memberRows').innerHTML=state.members.map((m,i)=>`<tr>${MEMBER_KEYS.map((k,c)=>`<td><input data-row="${i}" data-key="${k}" value="${esc(m[k]||'')}" aria-label="${MEMBER_COLS[c]} #${i+1}"${k==='premium'?' inputmode="decimal"':''}></td>`).join('')}<td><button type="button" class="row-del" data-del="${i}" aria-label="Remove person #${i+1}">×</button></td></tr>`).join('');
  $$('#memberRows input').forEach(el=>el.oninput=()=>{state.members[+el.dataset.row][el.dataset.key]=el.value;if(el.dataset.key==='premium')recalcGpa(true)});
  $$('#memberRows [data-del]').forEach(b=>b.onclick=()=>{const i=+b.dataset.del;if(state.members.length>1)state.members.splice(i,1);else state.members[0]={};drawMemberRows();recalcGpa(true)});
}
/* GPA totals: premium = sum of members (until typed manually), 8% service tax, payable = premium + tax + stamp duty. All stay editable. */
function wireGpaTotals(){const p=document.querySelector('[name=totalPremium]');if(!p)return;p.addEventListener('input',()=>{p.dataset.manual=p.value?'1':'';recalcGpa(false)});const sd=document.querySelector('[name=stampDuty]');if(sd)sd.addEventListener('input',()=>recalcGpa(false))}
function recalcGpa(fromMembers){
  if(state.form!=='GPA'||state.step!==2)return;const q=n=>document.querySelector(`[name=${n}]`),p=q('totalPremium');if(!p)return;
  const sum=state.members.reduce((a,m)=>a+(parseFloat(m.premium)||0),0);
  if(fromMembers&&sum>0&&!p.dataset.manual)p.value=sum.toFixed(2);
  const prem=parseFloat(p.value)||0,tax=+(prem*0.08).toFixed(2),stamp=parseFloat(q('stampDuty')?.value)||0;
  q('serviceTax').value=prem?tax.toFixed(2):'';q('totalPayable').value=prem?(prem+tax+stamp).toFixed(2):'';
}

/* ---------- validation ---------- */
function dateError(){for(const [a,b] of DATE_PAIRS)if(state.answers[a]&&state.answers[b]&&state.answers[b]<state.answers[a])return t('dateErr');return null}
function firstMissing(){
  for(let i=0;i<steps[state.form].length;i++)for(const f of steps[state.form][i].fields){if(!f[3])continue;const v=state.answers[f[0]];if(f[2]==='checkbox'?v!==true:!String(v??'').trim())return{step:i,label:f[1]}}
  return null;
}
function review(){
  collect();const dErr=dateError();if(dErr){toast(dErr);return}
  const miss=firstMissing();if(miss){state.step=miss.step;renderStep();toast(t('missing')+' '+miss.label);requestAnimationFrame(()=>$('#dynamicForm').reportValidity());return}
  let html='';
  steps[state.form].forEach(s=>{const rows=s.fields.filter(f=>{const v=state.answers[f[0]];return v!==undefined&&v!==''&&v!==false}).map(f=>{const v=state.answers[f[0]];return `<div class="summary-item"><small>${esc(f[1])}</small><b>${esc(v===true?'Yes':v)}</b></div>`});if(rows.length)html+=`<h3 class="summary-title">${esc(s.title)}</h3>`+rows.join('')});
  if(state.form==='GPA'){const named=state.members.filter(m=>Object.values(m).some(Boolean));html+=`<h3 class="summary-title">Insured persons</h3><div class="summary-item"><small>Count</small><b>${named.length}</b></div><div class="summary-item"><small>Names</small><b>${esc(named.map(m=>m.name).filter(Boolean).join(', ')||'-')}</b></div>`}
  $('#reviewSummary').innerHTML=html||'<p>No answers yet.</p>';show('#reviewView');
}

/* ---------- signature + stamp ---------- */
function canvasSetup(){
  const c=$('#signatureCanvas'),ctx=c.getContext('2d');ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#182331';let drawing=false,ink=false;
  const pos=e=>{const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}};
  c.addEventListener('pointerdown',e=>{if(state.signatureMode!=='draw')return;drawing=true;c.setPointerCapture(e.pointerId);const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)});
  c.addEventListener('pointermove',e=>{if(!drawing)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();ink=true});
  ['pointerup','pointercancel'].forEach(ev=>c.addEventListener(ev,()=>{if(!drawing)return;drawing=false;if(ink)state.signatureData=c.toDataURL('image/png')}));
  clearSignature=()=>{ctx.clearRect(0,0,c.width,c.height);state.signatureData=null;ink=false;$('#signatureFile').value=''};
  $('#clearSignature').onclick=clearSignature;$('#chooseSignature').onclick=()=>$('#signatureFile').click();
  $('#signatureFile').onchange=e=>readImage(e.target.files[0],data=>{state.signatureData=data;ctx.clearRect(0,0,c.width,c.height);const im=new Image();im.onload=()=>{const k=Math.min(c.width/im.width,c.height/im.height),w=im.width*k,h=im.height*k;ctx.drawImage(im,(c.width-w)/2,(c.height-h)/2,w,h)};im.src=data});
  $$('[data-signmode]').forEach(b=>b.onclick=()=>{state.signatureMode=b.dataset.signmode;$$('[data-signmode]').forEach(x=>x.classList.toggle('active',x===b));$('#chooseSignature').classList.toggle('hidden',state.signatureMode!=='upload')});
  $('#stampFile').onchange=e=>readImage(e.target.files[0],data=>{state.stampData=data;$('#stampPreview').innerHTML=`<img alt="Company stamp preview" src="${data}">`});
}
let clearSignature=()=>{};
function readImage(file,cb){if(!file)return;if(!['image/png','image/jpeg'].includes(file.type)||file.size>3*1024*1024){toast(t('imgErr'));return}const r=new FileReader();r.onload=()=>cb(r.result);r.readAsDataURL(file)}

/* ---------- submit / reset ---------- */
async function submit(){
  if(state.busy)return;
  if(!$('#confirmAccuracy').checked){toast(t('needConfirm'));return}
  if(!state.signatureData){toast(t('needSign'));return}
  if(!state.token){toast(t('needLink'));return}
  const btn=$('#submitApplication');
  state.busy=true;btn.disabled=true;
  try{
    const d=await OneForm.submit(state.link,{answers:state.answers,members:state.members,signatureData:state.signatureData,stampData:state.stampData});
    $('#referenceNo').textContent=d.reference;$('#doneText').textContent=t('doneText');show('#doneView');
  }catch(e){toast(e.message==='image'?t('imgErr'):e.message==='storage'?t('storageErr'):e.message||t('submitFail'))}finally{state.busy=false;btn.disabled=false}
}
function resetAll(){
  state.form=null;state.token=null;syncMode();state.drafts={};state.answers={};state.members=[{}];state.stampData=null;clearSignature();
  $('#stampPreview').innerHTML='';$('#stampFile').value='';$('#confirmAccuracy').checked=false;$('#linkResult').classList.add('hidden');
  state.link=null;history.replaceState({},'',location.pathname);show('#homeView');
}
async function copyLink(){const el=$('#guestUrl');try{await navigator.clipboard.writeText(el.value)}catch{el.select();document.execCommand('copy')}toast(t('copied'))}
async function createLink(){
  const btn=$('#createLink');btn.disabled=true;
  try{const d=await OneForm.createLink($('#linkForm').value,$('#customerEmail').value.trim());$('#guestUrl').value=d.url;$('#linkResult').classList.remove('hidden');loadApps()}
  catch(e){toast(t('linkFail'))}finally{btn.disabled=false}
}

/* ---------- agent session (httpOnly cookies; JS never sees the token) ---------- */
const STATUS={ms:{draft:'Menunggu pelanggan',submitted:'Diterima',under_review:'Dalam semakan',needs_correction:'Perlu pembetulan',approved_by_agent:'Diluluskan ejen',email_sent:'Dihantar ke HQ',closed:'Selesai'},en:{draft:'Waiting for customer',submitted:'Received',under_review:'Under review',needs_correction:'Needs correction',approved_by_agent:'Approved by agent',email_sent:'Sent to HQ',closed:'Closed'}};
function paneAuth(user){state.user=user;syncMode();$('#loginPane').classList.toggle('hidden',!!user);$('#agentPane').classList.toggle('hidden',!user);if(user){$('#agentName').textContent=user.name;loadApps()}else{$('#appList').innerHTML='';$('#linkResult').classList.add('hidden')}}
function loadApps(){
  const rows=OneForm.listRecords(),S=STATUS[state.lang];
  $('#appList').innerHTML=rows.length?rows.map(a=>`<div class="app-row"><b>${esc(a.ref)}</b><span>${esc(a.type)}</span><span class="pill st-${esc(a.status)}">${esc(S[a.status]||a.status)}</span><small>${esc((a.created||'').slice(0,10))}</small>${a.status==='submitted'&&OneForm.getSubmission(a.id)?`<button type="button" class="row-pdf" data-pdf="${esc(a.id)}">PDF</button>`:'<span></span>'}</div>`).join(''):`<p class="hint">${t('noApps')}</p>`;
}
function initAuth(){paneAuth(OneForm.me())}
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();const btn=$('#loginBtn');if(!e.target.reportValidity())return;btn.disabled=true;
  try{const u=await OneForm.login($('#loginEmail').value,$('#loginPass').value);$('#loginPass').value='';paneAuth(u)}
  catch(err){toast(err.message==='locked'?t('locked'):t('loginFail'))}finally{btn.disabled=false}
});
$('#logoutBtn').onclick=()=>{OneForm.logout();paneAuth(null)};

/* ---------- wiring ---------- */
$$('.form-choice').forEach(b=>b.onclick=()=>openForm(b.dataset.form));
$('#createLink').onclick=createLink;$('#copyLink').onclick=copyLink;
$('#langBtn').onclick=()=>{collect();state.lang=state.lang==='ms'?'en':'ms';applyLang();if(formVisible())renderStep()};
$('#backHome').onclick=goHome;$('#backForm').onclick=()=>show('#formView');$('#dynamicForm').addEventListener('submit',e=>e.preventDefault());
$('#nextStep').onclick=()=>{const form=$('#dynamicForm');if(!form.reportValidity())return;collect();const e=dateError();if(e){toast(e);return}if(state.step<steps[state.form].length-1){state.step++;saveDraft();renderStep();window.scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'})}else review()};
$('#prevStep').onclick=()=>{collect();state.step=Math.max(0,state.step-1);saveDraft();renderStep()};
$('#submitApplication').onclick=submit;$('#startAgain').onclick=resetAll;

if(window.LiquidNav){nav=LiquidNav.mount($('#liquidNav'),{tone:'light',ariaLabel:'Main',onChange:onNav,items:navLabels().map((label,i)=>({label,icon:LiquidNav.ICONS[['home','shield','globe','badge'][i]],fx:['glow','drop','spin','wave'][i]}))})}
syncMode();canvasSetup();applyLang();
if(state.token){
  $('#homeView').classList.add('hidden');
  OneForm.readToken(state.token,qs.get('type'),qs.get('exp')).then(d=>{state.link=d;startForm(d.type)}).catch(e=>{state.token=null;syncMode();show('#homeView');toast(linkMsg(e))});
}
if(!state.token)initAuth();
/* ---------- PDF + records export/import ---------- */
async function makePdf(form,ref,answers,members,sig,stamp){
  const sections=steps[form].map(s=>({title:s.title,rows:s.fields.map(f=>[f[1],answers[f[0]]===true?'Yes':answers[f[0]]===false?'No':String(answers[f[0]]??'')])}));
  const rows=form==='GPA'?members.filter(m=>Object.values(m).some(Boolean)).map(m=>MEMBER_KEYS.map(k=>m[k]||'-').join(' | ')):[];
  try{OneForm.downloadBytes(await OneForm.buildPdf({title:FORM_NAMES[form].join(' - '),reference:ref,sections,members:rows,signature:sig,stamp}),`${ref}-${form}.pdf`)}catch{toast(t('pdfFail'))}
}
function downloadPdf(){collect();makePdf(state.form,state.link?state.link.ref:'DRAFT',state.answers,state.members,state.signatureData,state.stampData)}
$('#downloadPdfReview').onclick=downloadPdf;$('#downloadPdfDone').onclick=downloadPdf;
$('#appList').onclick=e=>{const b=e.target.closest('[data-pdf]');if(!b)return;const r=OneForm.listRecords().find(x=>x.id===b.dataset.pdf),s=OneForm.getSubmission(b.dataset.pdf);if(r&&s)makePdf(r.type,r.ref,s.answers,s.members,s.signatureData,s.stampData)};
$('#exportRec').onclick=()=>OneForm.downloadBytes(OneForm.exportAll(),'oneform-rekod.json','application/json');
$('#importRec').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const n=OneForm.importAll(await f.text());loadApps();toast(t('imported')+' '+n)}catch{toast(t('importErr'))}};
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
