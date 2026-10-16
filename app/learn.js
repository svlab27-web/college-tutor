// Уроки с сервера (#6, docs/api.md п. 2): в Telegram студент проходит уроки из базы —
// список по неделям плана, шаги, подсказки по одной, проверка ответа на сервере, разбор ошибок,
// самостоятельная задача (вариант выбирает сервер), продолжение с того же шага.
// Ответы в браузер не приходят: checks и free_input сервер отдаёт только после верного ответа (reveal).
// Код «напиши сам» запускается в браузере (Pyodide в отдельном потоке) и в прогресс не идёт (решение #7).
// Нет Telegram, нет связи или уроков на сервере нет — остаётся прототип (демо на localStorage).
'use strict';
(function(){
  const tg=window.Telegram&&window.Telegram.WebApp;
  if(!(tg&&tg.initData)||!window.MeReady)return;
  const lang=document.documentElement.lang==='kk'?'kk':'ru';
  const T={ru:{
    brand:'Мой колледж',all:'← Все уроки',week:n=>`Неделя ${n}`,extra:'Дополнительно',min:'мин',
    start:'Начать',cont:'Продолжить',done:'Пройден ✓',again:'Повторить',
    steps:(a,b)=>`${a} из ${b} шагов`,stepOf:(a,b)=>`Шаг ${a} из ${b}`,indep:'Самостоятельно — без подсказок',
    story:'Ситуация',theory:'Теория',check:'Проверить',hint:(a,b)=>`Подсказка ${a} из ${b}`,noHints:'Подсказки закончились',simple:'Объясни проще',
    next:'Дальше →',finish:'Завершить урок',solved:'✓ Шаг пройден',pick:'Выберите вариант ответа.',num:'Введите число.',
    browser:'Этот ответ проверяется в приложении — скоро.',fail:'Не удалось проверить. Проверьте интернет и нажмите ещё раз.',
    checks:'Проверка на значениях',input:'Значение',expect:'Должно получиться',
    code:'Напиши код сам',codeNote:'Код запускается прямо здесь. Это тренировка — в прогресс не идёт.',run:'▶ Запустить тесты',running:'Запускаем…',
    loadPy:'Загружаем Python (один раз, ~10 секунд)…',pass:'✓',failT:'✗',got:'получилось',allOk:'Все тесты пройдены!',someFail:(a,b)=>`Пройдено ${a} из ${b}. Посмотри, где не совпало.`,
    timeout:'Программа работала слишком долго — возможно, бесконечный цикл.',pyFail:'Не удалось загрузить Python. Проверьте интернет.',
    endTitle:'Урок пройден',endSteps:(a,b)=>`Шагов пройдено: ${a} из ${b}`,firstTry:'Самостоятельную задачу решил(а) с первой попытки 🎯',
    notFirst:'Самостоятельная решена — не с первой попытки. Хорошо, что дошёл(ла) до конца.',back:'К списку уроков',
    demoGuest:'Демо — прогресс не сохраняется. Чтобы сохранять, откройте личную ссылку от куратора.',
    demoConsent:'Демо — прогресс не сохраняется, пока вы не дали согласие на обработку данных.',
    demoParent:'Демо — прогресс не сохраняется, пока куратор не отметит согласие родителя.',
    offline:'Нет связи с сервером — работает демо, прогресс не сохраняется.',
    empty:'Уроков пока нет — преподаватель ещё не опубликовал их.',subjects:{python:'Программирование',math:'Высшая математика'},
    partsBad:'Неверная часть ответа отмечена.',saved:'Сохранено',notSaved:'Не сохраняется (демо)'
  },kk:{
    brand:'Менің колледжім',all:'← Барлық сабақтар',week:n=>`${n}-апта`,extra:'Қосымша',min:'мин',
    start:'Бастау',cont:'Жалғастыру',done:'Өтілді ✓',again:'Қайталау',
    steps:(a,b)=>`${b} қадамның ${a}-і`,stepOf:(a,b)=>`${b} қадамның ${a}-қадамы`,indep:'Өз бетінше — кеңессіз',
    story:'Жағдай',theory:'Теория',check:'Тексеру',hint:(a,b)=>`Кеңес: ${b}-тің ${a}-і`,noHints:'Кеңестер бітті',simple:'Қарапайым түсіндір',
    next:'Әрі қарай →',finish:'Сабақты аяқтау',solved:'✓ Қадам өтілді',pick:'Жауап нұсқасын таңдаңыз.',num:'Сан енгізіңіз.',
    browser:'Бұл жауап қосымшада тексеріледі — жақында.',fail:'Тексеру мүмкін болмады. Интернетті тексеріп, қайта басыңыз.',
    checks:'Мәндер бойынша тексеру',input:'Мән',expect:'Болуы керек',
    code:'Кодты өзің жаз',codeNote:'Код осы жерде іске қосылады. Бұл жаттығу — прогреске кірмейді.',run:'▶ Тесттерді іске қосу',running:'Іске қосылуда…',
    loadPy:'Python жүктелуде (бір рет, ~10 секунд)…',pass:'✓',failT:'✗',got:'шықты',allOk:'Барлық тесттер өтті!',someFail:(a,b)=>`${b} тесттің ${a}-і өтті. Қай жерде сәйкес келмегенін қара.`,
    timeout:'Бағдарлама тым ұзақ жұмыс істеді — мүмкін, шексіз цикл.',pyFail:'Python жүктелмеді. Интернетті тексеріңіз.',
    endTitle:'Сабақ өтілді',endSteps:(a,b)=>`Өтілген қадамдар: ${b}-тің ${a}-і`,firstTry:'Өз бетінше есепті бірінші әрекеттен шештің 🎯',
    notFirst:'Өз бетінше есеп шешілді — бірінші әрекеттен емес. Соңына дейін жеткенің жақсы.',back:'Сабақтар тізіміне',
    demoGuest:'Демо — прогресс сақталмайды. Сақтау үшін куратордан алған жеке сілтемені ашыңыз.',
    demoConsent:'Демо — деректерді өңдеуге келісім бермейінше прогресс сақталмайды.',
    demoParent:'Демо — куратор ата-ана келісімін белгілегенше прогресс сақталмайды.',
    offline:'Сервермен байланыс жоқ — демо жұмыс істейді, прогресс сақталмайды.',
    empty:'Әзірге сабақ жоқ — оқытушы оларды әлі жарияламаған.',subjects:{python:'Бағдарламалау',math:'Жоғары математика'},
    partsBad:'Жауаптың қате бөлігі белгіленді.',saved:'Сақталды',notSaved:'Сақталмайды (демо)'
  }}[lang];

  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uuid=()=>(crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
  async function api(path,opts={}){
    const r=await fetch(path,{...opts,headers:window.ApiHeaders()});
    const j=await r.json().catch(()=>({}));
    return {ok:r.ok,status:r.status,j};
  }
  const say=t=>{if(typeof window.toast==='function')window.toast(t)};

  // Пока не ясно, будут ли уроки с сервера, прототип не показываем — без мелькания демо-экрана (не дольше 5 с)
  const html=document.documentElement;const wait=document.createElement('style');
  wait.textContent='html.lv-wait .app{visibility:hidden}';document.head.appendChild(wait);html.classList.add('lv-wait');
  const showProto=()=>html.classList.remove('lv-wait');setTimeout(showProto,5000);

  const S={me:null,canSave:false,list:[],subject:null,lesson:null,progress:null,idx:0,hints:{},showSimple:{},sel:{},result:{},reveal:{},solved:new Set(),firstTry:null};
  let root;

  window.MeReady.then(async me=>{
    if(me&&me.registered&&me.user&&(me.user.role==='teacher'||me.user.role==='admin')){showProto();return} // куратор — в кабинете
    if(!me){showProto();whenReady(()=>say(T.offline));return}
    S.me=me;
    const r=await api('/api/lessons?lang='+lang).catch(()=>null);
    if(!r||!r.ok||!Array.isArray(r.j.lessons)||!r.j.lessons.length){showProto();return} // уроков с сервера нет — прототип
    S.canSave=!!r.j.can_save_progress;S.list=r.j.lessons;
    whenReady(()=>{mount();showProto()});
  });
  function whenReady(f){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',f):f()}

  function mount(){
    const app=document.querySelector('.app');if(app)app.hidden=true;
    const st=document.createElement('style');
    st.textContent=`.app[hidden]{display:none!important}.lv{max-width:760px;margin:0 auto;padding:0 16px 40px}.lv-top{display:flex;align-items:center;gap:10px;height:64px;border-bottom:1px solid var(--line)}
.lv-logo{width:30px;height:30px;border-radius:9px;background:var(--green);color:var(--lime);display:grid;place-items:center;font-size:19px}.lv-brand{font-weight:800;letter-spacing:-.5px;font-size:18px;flex:1}
.lv-who{display:flex;align-items:center;gap:8px;font-size:13px}.lv-who .avatar{width:32px;height:32px}
.lv-demo{margin:14px 0 0;padding:10px 14px;border-radius:11px;background:#fff1e6;color:#7a3f1a;font-size:13px;font-weight:600}
html[data-theme=dark] .lv-demo{background:#3a2518;color:#f2b48c}
.lv-tabs{display:flex;gap:8px;margin:18px 0 4px;flex-wrap:wrap}.lv-tabs button{border:1px solid var(--line);background:var(--white);color:var(--ink);border-radius:20px;padding:7px 14px;font-weight:600;font-size:13px}.lv-tabs button.on{background:var(--green);border-color:var(--green);color:#fff}
.lv-week{margin:22px 0 8px}.lv-card{display:flex;gap:14px;align-items:center;border:1px solid var(--line);background:var(--white);border-radius:14px;padding:14px 16px;margin:8px 0;cursor:pointer;color:var(--ink);text-align:left;width:100%}
.lv-card h3{margin:0 0 3px;font-size:15px}.lv-card .small{margin:0}.lv-bar{height:5px;border-radius:5px;background:#e9ece5;margin-top:8px;overflow:hidden}.lv-bar span{display:block;height:100%;background:#347654}
html[data-theme=dark] .lv-bar{background:#2a3530}.lv-go{font-size:12px;font-weight:700;color:var(--green);white-space:nowrap}
.lv-head{margin:16px 0 10px}.lv-head h1{font-size:24px;margin:6px 0}.lv-prompt{white-space:pre-wrap}.lv .code{margin:12px 0}
.lv-opt pre{margin:0;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre}.lv-opt{overflow-x:auto}
.lv-opt.ok{border-color:#3a7d4f;background:#edf5e4}.lv-opt.bad{border-color:#c05a32}
.lv-num{display:block;margin:12px 0}.lv-num span{display:block;font-size:13px;margin-bottom:6px}.lv-num input{width:180px}
.lv-num input.bad{border-color:#c05a32}.lv-hints{margin-top:12px;display:grid;gap:8px}.lv-hints p{margin:0;padding:10px 12px;border-radius:9px;background:#eef2e7;font-size:13px}
html[data-theme=dark] .lv-hints p{background:#1c2721}.lv-done{color:#39784a;font-weight:700;font-size:13px}
.lv-code textarea{width:100%;min-height:150px;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;border:1px solid var(--line);border-radius:10px;padding:12px;background:#1f302d;color:#dce9df;tab-size:4}
.lv-tests{margin-top:10px;font-size:13px}.lv-tests div{padding:4px 0;border-bottom:1px solid var(--line)}.lv-tests code{font-size:12px}
.lv-end{text-align:center;padding:28px 10px}.lv-end .badge{margin:0 auto 16px}`;
    document.head.appendChild(st);
    root=document.createElement('div');root.className='lv';document.body.insertBefore(root,document.body.firstChild);
    root.addEventListener('click',onClick);root.addEventListener('input',onInput);
    const subs=[...new Set(S.list.map(l=>l.subject))];S.subject=subs[0];
    list();
  }

  function header(){
    const me=S.me||{},u=tg.initDataUnsafe&&tg.initDataUnsafe.user||{};
    const name=me.registered&&me.user&&me.user.full_name?me.user.full_name:(u.first_name||'');
    const ini=name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
    let demo='';
    if(!S.canSave){const needs=me.needs||[];demo=!me.registered?T.demoGuest:needs.includes('consent')?T.demoConsent:needs.includes('parental_consent')?T.demoParent:T.demoGuest}
    return `<header class="lv-top"><span class="lv-logo" aria-hidden="true">↗</span><span class="lv-brand">${T.brand}</span><span class="lv-who"><span>${esc(name)}</span><span class="avatar" aria-hidden="true">${esc(ini||'·')}</span></span></header>${demo?`<p class="lv-demo" role="status">${demo}</p>`:''}`;
  }

  // ── Список уроков ─────────────────────────────────────────
  function list(){
    S.lesson=null;
    const subs=[...new Set(S.list.map(l=>l.subject))];
    const tabs=subs.length>1?`<div class="lv-tabs" role="tablist">${subs.map(s=>`<button type="button" role="tab" data-sub="${esc(s)}" class="${s===S.subject?'on':''}" aria-selected="${s===S.subject}">${esc(T.subjects[s]||s)}</button>`).join('')}</div>`:'';
    const ls=S.list.filter(l=>l.subject===S.subject);
    const weeks=[];for(const l of ls){const w=Number.isInteger(l.week)?l.week:null;let g=weeks.find(x=>x.w===w);if(!g)weeks.push(g={w,items:[]});g.items.push(l)}
    const card=l=>{const p=l.progress,done=p&&p.completed_at,n=p?p.completed_steps:0,tot=l.steps_total||1;
      return `<button type="button" class="lv-card" data-open="${esc(l.id)}"><span style="flex:1"><h3>${esc(l.title)}</h3><p class="small">${esc(l.skill)} · ${l.minutes} ${T.min}${p?` · ${T.steps(n,tot)}`:''}</p><div class="lv-bar"><span style="width:${Math.round(100*n/tot)}%"></span></div></span><span class="lv-go">${done?T.done:n?T.cont:T.start}</span></button>`};
    root.innerHTML=header()+tabs+(ls.length?weeks.map(g=>`<div class="lv-week eyebrow">${g.w?T.week(g.w):T.extra}</div>${g.items.map(card).join('')}`).join(''):`<p class="empty">${T.empty}</p>`);
    window.scrollTo(0,0);
  }

  async function open(id){
    const r=await api(`/api/lessons/${encodeURIComponent(id)}?lang=${lang}`).catch(()=>null);
    if(!r||!r.ok){say(r&&r.j&&r.j.message||T.fail);return}
    S.lesson=r.j.lesson;S.progress=r.j.progress;S.canSave=!!r.j.can_save_progress;
    S.hints={};S.showSimple={};S.sel={};S.result={};S.reveal={};S.firstTry=null;S.indepTries=0;
    S.solved=new Set(S.progress&&S.progress.completed||[]);
    const steps=S.lesson.steps;const cur=S.progress&&S.progress.current_step;
    S.idx=Math.max(0,cur?steps.findIndex(s=>s.id===cur):0); // продолжаем с того же шага
    lesson();
  }

  // ── Урок ──────────────────────────────────────────────────
  function lesson(){
    const L=S.lesson,steps=L.steps,s=steps[S.idx],n=steps.length;
    const track=`<div class="track" aria-hidden="true">${steps.map((x,i)=>`<span class="${S.solved.has(x.id)?'done':i===S.idx?'current':''}"></span>`).join('')}</div>`;
    const top=`<div class="lv-head"><button type="button" class="btn plain" data-act="list" style="padding-left:0">${T.all}</button><div class="eyebrow">${esc(L.skill)}</div><h1>${esc(L.title)}</h1></div>`;
    const story=S.idx===0?`<section class="card" style="margin-bottom:14px"><div class="eyebrow">${T.story}</div><p class="lv-prompt" style="margin:8px 0 0">${esc(L.story)}</p>${L.material?`<details style="margin-top:10px"><summary class="small" style="cursor:pointer">${T.theory}</summary><p class="small lv-prompt" style="margin-top:8px">${esc(L.material)}</p></details>`:''}</section>`:(L.material?`<details class="small" style="margin:0 0 12px"><summary style="cursor:pointer">${T.theory}</summary><p class="lv-prompt" style="margin-top:8px">${esc(L.material)}</p></details>`:'');
    root.innerHTML=header()+top+story+`<section class="card">${track}${stepHtml(s,S.idx,n)}</section>`;
    window.scrollTo(0,0);
  }

  function stepHtml(s,i,n){
    const res=S.result[s.id],sel=S.sel[s.id]||{},solved=S.solved.has(s.id);
    const head=`<div class="step-header"><span>${T.stepOf(i+1,n)}</span>${s.independent?`<span>${T.indep}</span>`:''}</div><h2>${esc(s.title)}</h2>`;
    let body=`<p class="lv-prompt">${esc(s.prompt)}</p>${s.code?`<pre class="code">${esc(s.code)}</pre>`:''}`;
    const parts=res&&res.parts||{};
    if(s.answer_type==='choice'){
      body+=`<div class="choices" role="radiogroup">${(s.options||[]).map((o,j)=>{const multi=o.includes('\n')||/^[\w.(]+[ =(><]/.test(o)&&/[=()<>]/.test(o);
        const mark=res&&sel.choice===j&&'choice' in parts?(parts.choice?' ok':' bad'):'';
        return `<button type="button" class="choice lv-opt${sel.choice===j?' selected':''}${mark}" role="radio" aria-checked="${sel.choice===j}" data-ch="${j}"><span class="choice-label">${String.fromCharCode(65+j)}</span>${multi?`<pre>${esc(o)}</pre>`:`<span>${esc(o)}</span>`}</button>`}).join('')}</div>`;
    }else if(s.answer_type==='number'){
      body+=`<label class="lv-num"><input class="input${res&&parts.number===false?' bad':''}" inputmode="decimal" autocomplete="off" data-in="number" value="${esc(sel.number||'')}"></label>`;
    }
    if(s.number_part){const k=s.answer_type==='number'?'part':'number';
      body+=`<label class="lv-num"><span>${esc(s.number_part.label)}</span><input class="input${res&&parts[k]===false?' bad':''}" inputmode="decimal" autocomplete="off" data-in="${k}" value="${esc(sel[k]||'')}"></label>`}
    // Подсказки — по одной; «объясни проще»
    const hs=s.hints||[],shown=S.hints[s.id]||0;
    const hints=shown?`<div class="lv-hints">${hs.slice(0,shown).map(h=>`<p>💡 ${esc(h)}</p>`).join('')}</div>`:'';
    const simple=S.showSimple[s.id]&&s.simple?`<div class="concept" style="margin:12px 0 0">${esc(s.simple)}</div>`:'';
    const fb=res?`<div class="feedback${res.correct===true?'':res.correct===null?' neutral':' warn'}" role="status">${esc(res.feedback||'')}${res.correct===false&&res.parts?` ${T.partsBad}`:''}</div>`:'';
    const last=i===n-1;
    const actions=`<div class="actions">${solved?`<span class="lv-done">${T.solved}</span><button type="button" class="btn primary" data-act="next">${last?T.finish:T.next}</button>`:
      `<button type="button" class="btn primary" data-act="check">${T.check}</button>${!s.independent&&hs.length?`<button type="button" class="btn secondary" data-act="hint" ${shown>=hs.length?'disabled':''}>${shown>=hs.length?T.noHints:T.hint(shown+1,hs.length)}</button>`:''}${s.simple&&!s.independent?`<button type="button" class="btn plain" data-act="simple">${T.simple}</button>`:''}${res&&res.correct===null?`<button type="button" class="btn plain" data-act="next">${last?T.finish:T.next}</button>`:''}`}</div>`;
    const rv=S.reveal[s.id]||(solved?{checks:s.checks,free_input:s.free_input}:null);
    return head+body+hints+simple+fb+actions+(rv?revealHtml(s,rv):'');
  }

  function revealHtml(s,rv){
    let h='';
    if(Array.isArray(rv.checks)&&rv.checks.length)h+=`<div style="margin-top:18px"><h3>${T.checks}</h3><table class="test-table"><thead><tr><th>${T.input}</th><th>${T.expect}</th></tr></thead><tbody>${rv.checks.map(c=>`<tr><td>${esc(c.input)}</td><td>${esc(c.expect)}</td></tr>`).join('')}</tbody></table></div>`;
    (rv.free_input||[]).forEach((f,k)=>{
      if(f.answer_type!=='code')return; // формулы — позже (#8)
      h+=`<div class="lv-code" style="margin-top:20px"><h3>${T.code}</h3><p class="lv-prompt">${esc(f.prompt)}</p><textarea spellcheck="false" autocapitalize="off" data-code="${s.id}:${k}">${esc(f.starter_code||'')}</textarea><p class="small">${T.codeNote}</p><div class="actions" style="margin-top:8px"><button type="button" class="btn secondary" data-run="${s.id}:${k}">${T.run}</button></div><div class="lv-tests" id="lv-t-${s.id}-${k}"></div></div>`;
    });
    return h;
  }

  function onInput(e){
    const el=e.target;if(!S.lesson)return;const s=S.lesson.steps[S.idx];
    if(el.dataset.in){(S.sel[s.id]=S.sel[s.id]||{})[el.dataset.in]=el.value;el.classList.remove('bad')}
  }

  async function onClick(e){
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.sub){S.subject=b.dataset.sub;list();return}
    if(b.dataset.open){open(b.dataset.open);return}
    if(b.dataset.run){runCode(b.dataset.run,b);return}
    const s=S.lesson&&S.lesson.steps[S.idx];
    if(b.dataset.ch!==undefined&&s){(S.sel[s.id]=S.sel[s.id]||{}).choice=+b.dataset.ch;keepInputs();lesson();return}
    const a=b.dataset.act;
    if(a==='list'){reloadList();return}
    if(a==='hint'){S.hints[s.id]=Math.min((S.hints[s.id]||0)+1,(s.hints||[]).length);keepInputs();lesson();return}
    if(a==='simple'){S.showSimple[s.id]=!S.showSimple[s.id];keepInputs();lesson();return}
    if(a==='next'){if(S.idx<S.lesson.steps.length-1){S.idx++;lesson()}else end();return}
    if(a==='check'){check(s,b);return}
  }
  function keepInputs(){root.querySelectorAll('[data-in]').forEach(el=>{const s=S.lesson.steps[S.idx];(S.sel[s.id]=S.sel[s.id]||{})[el.dataset.in]=el.value})}

  async function check(s,btn){
    keepInputs();
    const sel=S.sel[s.id]||{};let answer;
    if(s.answer_type==='choice'){
      if(!Number.isInteger(sel.choice)){say(T.pick);return}
      answer=s.number_part?{choice:sel.choice,number:(sel.number||'').trim()}:sel.choice;
      if(s.number_part&&!answer.number){say(T.num);return}
    }else if(s.answer_type==='number'){
      const num=(sel.number||'').trim();if(!num){say(T.num);return}
      answer=s.number_part?{number:num,part:(sel.part||'').trim()}:num;
      if(s.number_part&&!answer.part){say(T.num);return}
    }else{say(T.browser);return}
    btn.disabled=true;
    const send=()=>api('/api/answer',{method:'POST',body:JSON.stringify({lesson_id:S.lesson.id,step_id:s.id,request_id:uuid(),hints_used:S.hints[s.id]||0,lang,answer})});
    let r=await send().catch(()=>null);
    if(r&&r.status===409)r=await send().catch(()=>null); // request_id уже был — новый и ещё раз
    btn.disabled=false;
    if(!r){say(T.fail);return}
    if(r.status===422){say(T.browser);return}
    if(!r.ok){say(r.j.message||T.fail);return}
    const res=r.j;S.result[s.id]=res;
    if(res.correct===true){S.solved.add(s.id);if(res.reveal)S.reveal[s.id]=res.reveal}
    if(res.progress)S.progress=res.progress;
    // С первой попытки: сохранено — знает сервер; демо — считаем сами
    if(s.independent&&res.correct!==null){S.indepTries=(S.indepTries||0)+1;if(res.correct===true&&S.firstTry===null)S.firstTry=S.indepTries===1}
    lesson();
  }

  function end(){
    const L=S.lesson,tot=L.steps.length,n=S.solved.size;const p=S.progress;
    const ft=p&&p.independent?p.independent.first_try:S.firstTry;
    const indepSolved=L.steps.some(s=>s.independent&&S.solved.has(s.id));
    root.innerHTML=header()+`<section class="card lv-end"><div class="badge" aria-hidden="true">🏁</div><h1>${T.endTitle}</h1><p>${esc(L.title)}</p><p class="small">${T.endSteps(n,tot)} · ${S.canSave?T.saved:T.notSaved}</p>${indepSolved?`<p>${ft?T.firstTry:T.notFirst}</p>`:''}<div class="actions" style="justify-content:center"><button type="button" class="btn primary" data-act="list">${T.back}</button></div></section>`;
    window.scrollTo(0,0);
  }

  async function reloadList(){
    const r=await api('/api/lessons?lang='+lang).catch(()=>null);
    if(r&&r.ok&&Array.isArray(r.j.lessons)){S.list=r.j.lessons;S.canSave=!!r.j.can_save_progress}
    list();
  }

  // ── Код «напиши сам»: Pyodide в отдельном потоке, тесты tests[].call / expect (docs/api.md п. 3) ──
  const PYODIDE='https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const RUNNER=`
import sys, io, json
def _run(code, tests_json):
    tests = json.loads(tests_json)
    buf = io.StringIO(); old = sys.stdout; sys.stdout = buf
    ns = {"__name__": "__main__"}; err = None
    try:
        exec(code, ns)
    except BaseException as e:
        err = type(e).__name__ + ": " + str(e)
    finally:
        sys.stdout = old
    out = []
    for t in tests:
        if err:
            out.append({"ok": False, "got": err}); continue
        try:
            got = buf.getvalue() if t["call"] == "__stdout__" else eval(t["call"], ns)
            out.append({"ok": got == t["expect"], "got": repr(got)})
        except BaseException as e:
            out.append({"ok": False, "got": type(e).__name__ + ": " + str(e)})
    return json.dumps(out)
`;
  const WORKER=`importScripts('${PYODIDE}pyodide.js');let py;
self.onmessage=async e=>{try{if(!py){py=await loadPyodide({indexURL:'${PYODIDE}'});py.runPython(${JSON.stringify(RUNNER)})}
const f=py.globals.get('_run');self.postMessage({ok:true,res:JSON.parse(f(e.data.code,JSON.stringify(e.data.tests)))})}catch(err){self.postMessage({ok:false,error:String(err)})}}`;
  let worker=null,ready=false;
  function runCode(key,btn){
    const [sid,k]=key.split(':');const s=S.lesson.steps.find(x=>x.id===sid);
    const rv=S.reveal[sid]||{free_input:s.free_input};const f=(rv.free_input||[])[+k];if(!f)return;
    const code=root.querySelector(`[data-code="${key}"]`).value;const out=root.querySelector(`#lv-t-${sid}-${k}`);
    out.textContent=ready?T.running:T.loadPy;btn.disabled=true;
    if(!worker)worker=new Worker(URL.createObjectURL(new Blob([WORKER],{type:'text/javascript'})));
    const timer=setTimeout(()=>{worker.terminate();worker=null;ready=false;btn.disabled=false;out.textContent=T.timeout},ready?8000:60000);
    worker.onmessage=e=>{clearTimeout(timer);btn.disabled=false;ready=true;
      if(!e.data.ok){out.textContent=T.pyFail;return}
      const res=e.data.res,okN=res.filter(x=>x.ok).length;
      out.innerHTML=(f.tests||[]).map((t,i)=>`<div>${res[i].ok?T.pass:T.failT} <code>${esc(t.call==='__stdout__'?'print(...)':t.call)}</code>${res[i].ok?'':` — ${T.got} <code>${esc(res[i].got)}</code>`}</div>`).join('')+`<p style="margin-top:8px"><b>${okN===res.length?T.allOk:T.someFail(okN,res.length)}</b></p>`};
    worker.onerror=()=>{clearTimeout(timer);btn.disabled=false;out.textContent=T.pyFail;worker=null;ready=false};
    worker.postMessage({code,tests:f.tests||[]});
  }
})();
