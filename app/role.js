// Демо: экран «Кто вы? Студент / Преподаватель» при открытии из меню бота.
// В сервисе роль определяет сервер по приглашению (#5), этот экран уберём.
'use strict';
(function(){
  const KEY='my-college-role';
  const tg=window.Telegram&&window.Telegram.WebApp;
  const sp=(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.start_param)||'';
  const q=new URLSearchParams(location.search);
  const get=()=>{try{return localStorage.getItem(KEY)}catch(e){return null}};
  const set=v=>{try{v?localStorage.setItem(KEY,v):localStorage.removeItem(KEY)}catch(e){}};
  const toTeacher=()=>location.replace('teacher.html'+location.hash);

  if(q.has('choose'))set(null);
  // Явный вход по ссылке важнее сохранённого выбора
  if(sp==='teacher'||q.get('role')==='teacher'){set('teacher');toTeacher();return}
  if(sp==='student'||sp.indexOf('g_')===0||sp.indexOf('i_')===0||q.get('role')==='student'){set('student');return}
  const saved=get();
  if(saved==='teacher'){toTeacher();return}
  if(saved==='student')return;

  // Выбора ещё не было — показываем экран
  let lang=null;try{lang=localStorage.getItem('my-college-lang')}catch(e){}
  if(lang!=='ru'&&lang!=='kk'){const u=tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user;lang=u&&/^kk/i.test(u.language_code||'')?'kk':'ru'}
  const T={ru:{brand:'Мой колледж',who:'Кто вы?',student:'Я студент',studentSub:'Уроки, подсказки, мой прогресс',teacher:'Я преподаватель',teacherSub:'Группы, ссылки для студентов, прогресс, план занятий',note:'Демо-версия: в сервисе роль определяется по приглашению колледжа.'},
           kk:{brand:'Менің колледжім',who:'Сіз кімсіз?',student:'Мен студентпін',studentSub:'Сабақтар, кеңестер, менің прогресім',teacher:'Мен оқытушымын',teacherSub:'Топтар, студенттерге сілтемелер, прогресс, сабақ жоспары',note:'Демо-нұсқа: сервисте рөл колледждің шақыруы бойынша анықталады.'}}[lang];
  function show(){
    const st=document.createElement('style');
    st.textContent='.role-bg{position:fixed;inset:0;z-index:40;background:var(--bg,#f5f6f1);display:grid;place-items:center;padding:20px;overflow:auto}.role{max-width:420px;width:100%;text-align:center}.role-logo{width:52px;height:52px;border-radius:16px;background:#21614c;color:#e0ef94;display:grid;place-items:center;font-size:30px;margin:0 auto 12px}.role h1{font-size:26px;letter-spacing:-.8px;margin:0 0 4px}.role h2{font-size:17px;font-weight:600;color:var(--muted,#687872);margin:0 0 20px}.role-btn{display:block;width:100%;text-align:left;border:1px solid var(--line,#dfe5dc);background:var(--white,#fff);color:var(--ink,#182c29);border-radius:14px;padding:16px 18px;margin:10px 0;cursor:pointer}.role-btn b{display:block;font-size:17px}.role-btn span{font-size:13px;color:var(--muted,#687872)}.role-btn.main{background:#21614c;border-color:#21614c;color:#fff}.role-btn.main span{color:#d3e1d9}.role-note{font-size:12px;color:var(--muted,#687872);margin-top:16px}.role-lang{display:inline-flex;gap:2px;border:1px solid var(--line,#dfe5dc);border-radius:20px;padding:2px;margin-top:14px}.role-lang button{border:0;background:none;padding:4px 10px;border-radius:16px;font-size:11px;font-weight:700;color:var(--muted,#687872);cursor:pointer}.role-lang button.on{background:#21614c;color:#fff}';
    document.head.appendChild(st);
    const bg=document.createElement('div');bg.className='role-bg';bg.setAttribute('role','dialog');bg.setAttribute('aria-modal','true');bg.setAttribute('aria-labelledby','role-who');
    bg.innerHTML=`<div class="role"><div class="role-logo" aria-hidden="true">↗</div><h1>${T.brand}</h1><h2 id="role-who">${T.who}</h2>
      <button type="button" class="role-btn main" data-role="student"><b>🎓 ${T.student}</b><span>${T.studentSub}</span></button>
      <button type="button" class="role-btn" data-role="teacher"><b>👩‍🏫 ${T.teacher}</b><span>${T.teacherSub}</span></button>
      <div class="role-lang" role="group" aria-label="Язык · Тіл"><button type="button" data-l="ru" class="${lang==='ru'?'on':''}">РУС</button><button type="button" data-l="kk" class="${lang==='kk'?'on':''}">ҚАЗ</button></div>
      <p class="role-note">${T.note}</p></div>`;
    bg.addEventListener('click',e=>{
      e.stopPropagation();
      const l=e.target.closest('[data-l]');if(l){try{localStorage.setItem('my-college-lang',l.dataset.l)}catch(err){}location.reload();return}
      const b=e.target.closest('[data-role]');if(!b)return;
      set(b.dataset.role);
      if(b.dataset.role==='teacher')toTeacher();else bg.remove();
    });
    document.body.appendChild(bg);
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',show):show();
})();
