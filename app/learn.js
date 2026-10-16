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
    partsBad:'Неверная часть ответа отмечена.',saved:'Сохранено',notSaved:'Не сохраняется (демо)',
    help:'🙋 Нужна помощь',helpTitle:'Напишите куратору, что непонятно',helpPh:'Например: не понимаю, почему 1000 не входит в условие',send:'Отправить',cancel:'Отмена',
    helpSent:'Отправлено — куратор увидит ваше сообщение.',helpDemo:'Написать куратору можно после входа по личной ссылке и согласия.',
    noInput:'input() здесь не работает: данные уже есть в коде задания.',
    labPick:'Выберите вариант ответа — и испытайте его здесь, прежде чем проверять.',labIn:'Значение',labOut:'Что посчитает программа',
    labNote:'Сравни с правилом из условия: на каком значении программа ошибается?',labAdd:'Испытать',labYour:'своё',
    medal:{gold:'🥇 Золото',silver:'🥈 Серебро',bronze:'🥉 Бронза'},
    medalWhy:{gold:'Все шаги с первой попытки и без подсказок.',silver:'Самостоятельная задача — с первой попытки.',bronze:'Урок пройден.'},
    medalNext:{silver:'До золота: все шаги с первой попытки и без подсказок.',bronze:'До серебра: самостоятельную задачу — с первой попытки.'},
    streak:n=>`🔥 ${n} ${plural(n,['день','дня','дней'])} подряд`,streakStart:'🔥 Начни серию сегодня',streakToday:'сегодня уже занимался(ась) ✓',streakKeep:'позанимайся сегодня, чтобы не прервать',
    skills:(a,b)=>`Навыков освоено: ${a} из ${b}`,demoMedal:'В демо значок не сохраняется.',
    nameErr:'Ошибка в ФИО?',nameTitle:'Как правильно пишутся ваши фамилия, имя, отчество?',nameSent:'Отправлено — куратор исправит.'
  },kk:{
    brand:'Менің колледжім',all:'← Барлық сабақтар',week:n=>`${n}-апта`,extra:'Қосымша',min:'мин',
    start:'Бастау',cont:'Жалғастыру',done:'Өтілді ✓',again:'Қайталау',
    steps:(a,b)=>`${a}/${b} қадам`,stepOf:(a,b)=>`Қадам ${a}/${b}`,indep:'Өз бетінше — кеңессіз',
    story:'Жағдай',theory:'Теория',check:'Тексеру',hint:(a,b)=>`Кеңес ${a}/${b}`,noHints:'Кеңестер бітті',simple:'Қарапайым түсіндір',
    next:'Әрі қарай →',finish:'Сабақты аяқтау',solved:'✓ Қадам өтілді',pick:'Жауап нұсқасын таңдаңыз.',num:'Сан енгізіңіз.',
    browser:'Бұл жауап қосымшада тексеріледі — жақында.',fail:'Тексеру мүмкін болмады. Интернетті тексеріп, қайта басыңыз.',
    checks:'Мәндер бойынша тексеру',input:'Мән',expect:'Болуы керек',
    code:'Кодты өзің жаз',codeNote:'Код осы жерде іске қосылады. Бұл жаттығу — прогреске кірмейді.',run:'▶ Тесттерді іске қосу',running:'Іске қосылуда…',
    loadPy:'Python жүктелуде (бір рет, ~10 секунд)…',pass:'✓',failT:'✗',got:'шықты',allOk:'Барлық тесттер өтті!',someFail:(a,b)=>`Өтті: ${a}/${b}. Қай жерде сәйкес келмегенін қара.`,
    timeout:'Бағдарлама тым ұзақ жұмыс істеді — мүмкін, шексіз цикл.',pyFail:'Python жүктелмеді. Интернетті тексеріңіз.',
    endTitle:'Сабақ өтілді',endSteps:(a,b)=>`Өтілген қадамдар: ${a}/${b}`,firstTry:'Өз бетінше есепті бірінші әрекеттен шештің 🎯',
    notFirst:'Өз бетінше есеп шешілді — бірінші әрекеттен емес. Соңына дейін жеткенің жақсы.',back:'Сабақтар тізіміне',
    demoGuest:'Демо — прогресс сақталмайды. Сақтау үшін куратордан алған жеке сілтемені ашыңыз.',
    demoConsent:'Демо — деректерді өңдеуге келісім бермейінше прогресс сақталмайды.',
    demoParent:'Демо — куратор ата-ана келісімін белгілегенше прогресс сақталмайды.',
    offline:'Сервермен байланыс жоқ — демо жұмыс істейді, прогресс сақталмайды.',
    empty:'Әзірге сабақ жоқ — оқытушы оларды әлі жарияламаған.',subjects:{python:'Бағдарламалау',math:'Жоғары математика'},
    partsBad:'Жауаптың қате бөлігі белгіленді.',saved:'Сақталды',notSaved:'Сақталмайды (демо)',
    help:'🙋 Көмек керек',helpTitle:'Кураторға не түсініксіз екенін жазыңыз',helpPh:'Мысалы: 1000 неге шартқа кірмейтінін түсінбеймін',send:'Жіберу',cancel:'Болдырмау',
    helpSent:'Жіберілді — куратор хабарламаңызды көреді.',helpDemo:'Кураторға жеке сілтеме арқылы кіріп, келісім бергеннен кейін жазуға болады.',
    noInput:'input() мұнда жұмыс істемейді: деректер тапсырма кодында бар.',
    labPick:'Жауап нұсқасын таңдаңыз — тексермес бұрын оны осы жерде сынап көріңіз.',labIn:'Мән',labOut:'Бағдарлама не есептейді',
    labNote:'Шарттағы ережемен салыстыр: бағдарлама қай мәнде қателеседі?',labAdd:'Сынау',labYour:'өзіңнің',
    medal:{gold:'🥇 Алтын',silver:'🥈 Күміс',bronze:'🥉 Қола'},
    medalWhy:{gold:'Барлық қадам бірінші әрекеттен, кеңессіз.',silver:'Өз бетінше есеп — бірінші әрекеттен.',bronze:'Сабақ өтілді.'},
    medalNext:{silver:'Алтынға дейін: барлық қадам бірінші әрекеттен және кеңессіз.',bronze:'Күміске дейін: өз бетінше есепті бірінші әрекеттен шеш.'},
    streak:n=>`🔥 Қатарынан ${n} күн`,streakStart:'🔥 Серияны бүгін баста',streakToday:'бүгін оқыдың ✓',streakKeep:'серия үзілмеуі үшін бүгін оқы',
    skills:(a,b)=>`Меңгерілген дағдылар: ${a}/${b}`,demoMedal:'Демода белгі сақталмайды.',
    nameErr:'Аты-жөнде қате бар ма?',nameTitle:'Тегіңіз, атыңыз, әкеңіздің аты қалай дұрыс жазылады?',nameSent:'Жіберілді — куратор түзетеді.'
  }}[lang];

  const plural=(n,f)=>{const a=Math.abs(n)%100,b=a%10;return a>10&&a<20?f[2]:b===1?f[0]:b>=2&&b<=4?f[1]:f[2]};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uuid=()=>(crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
  async function api(path,opts={},ms=15000){
    const ac=new AbortController();const t=setTimeout(()=>ac.abort(),ms);
    const r=await fetch(path,{...opts,headers:window.ApiHeaders(),signal:ac.signal}).finally(()=>clearTimeout(t));
    const j=await r.json().catch(()=>({}));
    return {ok:r.ok,status:r.status,j};
  }
  const say=t=>{if(typeof window.toast==='function')window.toast(t)};
  const srvMsg=r=>lang==='ru'&&r&&r.j&&r.j.message||T.fail; // тексты ошибок сервера — на русском

  // Пока не ясно, будут ли уроки с сервера, прототип не показываем — без мелькания демо-экрана (не дольше 5 с)
  const html=document.documentElement;const wait=document.createElement('style');
  wait.textContent='html.lv-wait .app{visibility:hidden}';document.head.appendChild(wait);html.classList.add('lv-wait');
  const showProto=()=>html.classList.remove('lv-wait');setTimeout(showProto,5000);

  const S={busy:false,code:{},out:{},labX:{},first:{},stats:null,helpOpen:null,me:null,canSave:false,list:[],subject:null,lesson:null,progress:null,idx:0,hints:{},showSimple:{},sel:{},result:{},reveal:{},solved:new Set(),firstTry:null};
  let root;

  window.MeReady.then(async me=>{
    if(me&&me.registered&&me.user&&(me.user.role==='teacher'||me.user.role==='admin')){showProto();return} // куратор — в кабинете
    if(!me){showProto();whenReady(()=>say(T.offline));return}
    S.me=me;
    const r=await api('/api/lessons?lang='+lang,{},4500).catch(()=>null); // дольше — уже виден прототип, экран не подменяем
    if(!r||!r.ok||!Array.isArray(r.j.lessons)||!r.j.lessons.length){showProto();return} // уроков с сервера нет — прототип
    S.canSave=!!r.j.can_save_progress;S.list=r.j.lessons;S.stats=r.j.stats||null;
    whenReady(()=>{mount();showProto()});
  });
  function whenReady(f){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',f):f()}

  function mount(){
    const app=document.querySelector('.app');if(app)app.hidden=true;
    const st=document.createElement('style');
    st.textContent=`.app[hidden]{display:none!important}.lv{max-width:760px;margin:0 auto;padding:0 16px 40px}.lv-top{display:flex;align-items:center;gap:10px;height:64px;border-bottom:1px solid var(--line)}
.lv-logo{width:30px;height:30px;border-radius:9px;background:var(--green);color:var(--lime);display:grid;place-items:center;font-size:19px}.lv-brand{font-weight:800;letter-spacing:-.5px;font-size:18px;flex:1}
.lv-who{display:flex;align-items:center;gap:8px;font-size:13px}.lv-brand{white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}@media(max-width:480px){.lv-who>span:first-child{display:none}.lv-brand{font-size:16px}}.lv-who .avatar{width:32px;height:32px}
.lv-demo{margin:14px 0 0;padding:10px 14px;border-radius:11px;background:#fff1e6;color:#7a3f1a;font-size:13px;font-weight:600}
html[data-theme=dark] .lv-demo{background:#3a2518;color:#f2b48c}
.lv-tabs{display:flex;gap:8px;margin:18px 0 4px;flex-wrap:wrap}.lv-tabs button{border:1px solid var(--line);background:var(--white);color:var(--ink);border-radius:20px;padding:7px 14px;font-weight:600;font-size:13px}.lv-tabs button.on{background:var(--green);border-color:var(--green);color:#fff}
.lv-week{margin:22px 0 8px}.lv-card{display:flex;gap:14px;align-items:center;border:1px solid var(--line);background:var(--white);border-radius:14px;padding:14px 16px;margin:8px 0;cursor:pointer;color:var(--ink);text-align:left;width:100%}
.lv-card h3{margin:0 0 3px;font-size:15px}.lv-card .small{margin:0}.lv-bar{height:5px;border-radius:5px;background:#e9ece5;margin-top:8px;overflow:hidden}.lv-bar span{display:block;height:100%;background:#347654}
html[data-theme=dark] .lv-bar{background:#2a3530}.lv-go{font-size:12px;font-weight:700;color:var(--green);white-space:nowrap}
.lv-head{margin:16px 0 10px}.lv-head h1{font-size:24px;margin:6px 0}.lv-prompt{white-space:pre-wrap}.lv .code{margin:12px 0}
.lv-opt pre{margin:0;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.lv-opt{min-width:0}
.lv-opt.ok{border-color:#3a7d4f;background:#edf5e4}html[data-theme=dark] .lv-opt.ok{background:#1f3326}.lv-top .lang-switch{margin:0}.lv-opt.bad{border-color:#c05a32}
.lv-num{display:block;margin:12px 0}.lv-num span{display:block;font-size:13px;margin-bottom:6px}.lv-num input{width:180px}
.lv-num input.bad{border-color:#c05a32}.lv-hints{margin-top:12px;display:grid;gap:8px}.lv-hints p{margin:0;padding:10px 12px;border-radius:9px;background:#eef2e7;font-size:13px}
html[data-theme=dark] .lv-hints p{background:#1c2721}.lv-done{color:#39784a;font-weight:700;font-size:13px}
.lv-code textarea{width:100%;min-height:150px;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;border:1px solid var(--line);border-radius:10px;padding:12px;background:#1f302d;color:#dce9df;tab-size:4}
.lv-tests{margin-top:10px;font-size:13px}.lv-tests div{padding:4px 0;border-bottom:1px solid var(--line)}.lv-tests code{font-size:12px}
.lv-small{font-size:12px;padding:6px 0}.lv-stats{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0}.lv-stats span{border:1px solid var(--line);background:var(--white);border-radius:20px;padding:6px 12px;font-size:12px;font-weight:600}.lv-lab{margin:16px 0 4px;padding:14px;border:1px dashed #9cb98a;border-radius:12px;background:#f6f9ef}html[data-theme=dark] .lv-lab{background:#18221d;border-color:#4f6b48}.lv-lab table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}.lv-lab td,.lv-lab th{text-align:left;padding:6px 4px;border-bottom:1px solid var(--line)}.lv-lab th{font-size:11px;color:var(--muted);font-weight:500}.lv-lab .row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}.lv-lab input{width:140px}.lv-medal{font-size:44px;line-height:1;margin-bottom:8px}.lv-end{text-align:center;padding:28px 10px}.lv-end .badge{margin:0 auto 16px}`;
    document.head.appendChild(st);
    root=document.createElement('div');root.className='lv';document.body.insertBefore(root,document.body.firstChild);
    root.addEventListener('click',onClick);root.addEventListener('input',onInput);
    root.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-labx]')){e.preventDefault();const b=root.querySelector('[data-act="labadd"]');b&&b.click()}});
    const subs=[...new Set(S.list.map(l=>l.subject))];S.subject=subs[0];
    list();
  }

  function header(){
    const me=S.me||{},u=tg.initDataUnsafe&&tg.initDataUnsafe.user||{};
    const name=me.registered&&me.user&&me.user.full_name?me.user.full_name:(u.first_name||'');
    const ini=name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
    let demo='';
    // consent.js меняет me.needs после согласия — баннер следует за ним, S.canSave обновится при следующем запросе
    if(!S.canSave){const needs=me.needs||[];demo=!me.registered?T.demoGuest:needs.includes('consent')?T.demoConsent:needs.includes('parental_consent')?T.demoParent:''}
    const nameBtn=me.registered?`<button type="button" class="btn plain lv-small" data-act="nameerr">${T.nameErr}</button>`:'';
    const nameForm=S.helpOpen==='__name'?helpForm(T.nameTitle,'',me.user&&me.user.full_name||''):'';
    return `<header class="lv-top"><span class="lv-logo" aria-hidden="true">↗</span><span class="lv-brand">${T.brand}</span><span class="lang-switch" role="group" aria-label="Язык · Тіл"><button type="button" data-lang="ru" class="${lang==='ru'?'active':''}">РУС</button><button type="button" data-lang="kk" class="${lang==='kk'?'active':''}">ҚАЗ</button></span><span class="lv-who"><span>${esc(name)}</span><span class="avatar" title="${esc(name)}" aria-label="${esc(name)}">${esc(ini||'·')}</span></span></header>${nameBtn?`<div style="text-align:right">${nameBtn}</div>`:''}${nameForm}${demo?`<p class="lv-demo" role="status">${demo}</p>`:''}`;
  }

  function helpForm(title,ph,value){
    return `<div class="card" style="margin:10px 0"><b>${title}</b><textarea class="input" data-help maxlength="1000" placeholder="${esc(ph)}" style="width:100%;min-height:90px;margin-top:8px">${esc(value)}</textarea><div class="actions"><button type="button" class="btn primary" data-act="helpsend">${T.send}</button><button type="button" class="btn plain" data-act="helpclose">${T.cancel}</button></div></div>`;
  }
  const canHelp=()=>!!(S.me&&S.me.registered&&S.canSave);

  // ── Список уроков ─────────────────────────────────────────
  function list(){
    S.lesson=null;back(false);
    const subs=[...new Set(S.list.map(l=>l.subject))];
    const tabs=subs.length>1?`<div class="lv-tabs" role="tablist">${subs.map(s=>`<button type="button" role="tab" data-sub="${esc(s)}" class="${s===S.subject?'on':''}" aria-selected="${s===S.subject}">${esc(T.subjects[s]||s)}</button>`).join('')}</div>`:'';
    const ls=S.list.filter(l=>l.subject===S.subject);
    const weeks=[];for(const l of ls){const w=Number.isInteger(l.week)?l.week:null;let g=weeks.find(x=>x.w===w);if(!g)weeks.push(g={w,items:[]});g.items.push(l)}
    const card=l=>{const p=l.progress,done=p&&p.completed_at,n=p?p.completed_steps:0,tot=l.steps_total||1,md=p&&p.medal;
      return `<button type="button" class="lv-card" data-open="${esc(l.id)}"><span style="flex:1"><h3>${esc(l.title)}</h3><p class="small">${esc(l.skill)} · ${Number(l.minutes)||''} ${T.min}${p?` · ${T.steps(n,tot)}`:''}</p><div class="lv-bar"><span style="width:${Math.round(100*n/tot)}%"></span></div></span><span class="lv-go">${done?(md?`${T.medal[md].split(' ')[0]} `:'')+T.done:n?T.cont:T.start}</span></button>`};
    root.innerHTML=header()+statsBar(ls)+tabs+(ls.length?weeks.map(g=>`<div class="lv-week eyebrow">${g.w?T.week(g.w):T.extra}</div>${g.items.map(card).join('')}`).join(''):`<p class="empty">${T.empty}</p>`);
    window.scrollTo(0,0);
  }

  // Достижения — только когда прогресс сохраняется (иначе обещать нечего)
  function statsBar(ls){
    if(!S.canSave||!S.stats)return '';
    const st=S.stats,m={gold:0,silver:0,bronze:0};ls.forEach(l=>{const md=l.progress&&l.progress.medal;if(md)m[md]++});
    const done=ls.filter(l=>l.progress&&l.progress.completed_at).length;
    const streak=st.streak_days?`${T.streak(st.streak_days)} · ${st.active_today?T.streakToday:T.streakKeep}`:T.streakStart;
    return `<div class="lv-stats"><span>${streak}</span><span>🥇 ${m.gold} · 🥈 ${m.silver} · 🥉 ${m.bronze}</span><span>${T.skills(done,ls.length)}</span></div>`;
  }

  async function open(id){
    const r=await api(`/api/lessons/${encodeURIComponent(id)}?lang=${lang}`).catch(()=>null);
    if(!r||!r.ok){say(srvMsg(r));return}
    S.lesson=r.j.lesson;S.progress=r.j.progress;S.canSave=!!r.j.can_save_progress;
    S.hints={};S.showSimple={};S.sel={};S.result={};S.reveal={};S.firstTry=null;S.indepTries=0;S.code={};S.out={};S.busy=false;S.labX={};S.first={};
    S.solved=new Set(S.progress&&S.progress.completed||[]);
    const steps=S.lesson.steps;const cur=S.progress&&S.progress.current_step;
    S.idx=Math.max(0,cur?steps.findIndex(s=>s.id===cur):0); // продолжаем с того же шага
    lesson(true);
  }

  // ── Урок ──────────────────────────────────────────────────
  function lesson(toTop){
    const L=S.lesson,steps=L.steps,s=steps[S.idx],n=steps.length;
    const track=`<div class="track" aria-hidden="true">${steps.map((x,i)=>`<span class="${S.solved.has(x.id)?'done':i===S.idx?'current':''}"></span>`).join('')}</div>`;
    const top=`<div class="lv-head"><button type="button" class="btn plain" data-act="list" style="padding-left:0">${T.all}</button><div class="eyebrow">${esc(L.skill)}</div><h1>${esc(L.title)}</h1></div>`;
    const story=S.idx===0?`<section class="card" style="margin-bottom:14px"><div class="eyebrow">${T.story}</div><p class="lv-prompt" style="margin:8px 0 0">${esc(L.story)}</p>${L.material?`<details style="margin-top:10px"><summary class="small" style="cursor:pointer">${T.theory}</summary><p class="small lv-prompt" style="margin-top:8px">${esc(L.material)}</p></details>`:''}</section>`:(L.material?`<details class="small" style="margin:0 0 12px"><summary style="cursor:pointer">${T.theory}</summary><p class="lv-prompt" style="margin-top:8px">${esc(L.material)}</p></details>`:'');
    root.innerHTML=header()+top+story+`<section class="card">${track}${stepHtml(s,S.idx,n)}</section>`;
    back(true);
    if(toTop)window.scrollTo(0,0);
  }

  // Кнопка «Назад» Telegram: из урока и итога — к списку (иначе Android закрывает приложение)
  let backOn=false;
  function back(on){const bb=tg.BackButton;if(!bb)return;if(on&&!backOn){bb.onClick(onBack);backOn=true}on?bb.show():bb.hide()}
  function onBack(){if(S.lesson||root.querySelector('.lv-end')){S.helpOpen=null;reloadList()}}

  function stepHtml(s,i,n){
    const res=S.result[s.id],sel=S.sel[s.id]||{},solved=S.solved.has(s.id);
    const head=`<div class="step-header"><span>${T.stepOf(i+1,n)}</span>${s.independent?`<span>${T.indep}</span>`:''}</div><h2>${esc(s.title)}</h2>`;
    let body=`<p class="lv-prompt">${esc(s.prompt)}</p>${s.code?`<pre class="code">${esc(s.code)}</pre>`:''}`;
    const parts=res&&res.parts||{};
    if(s.answer_type==='choice'){
      body+=`<div class="choices" role="radiogroup">${(s.options||[]).map((o,j)=>{const multi=o.includes('\n')||/^[\w.(]+[ =(><]/.test(o)&&/[=()<>]/.test(o);
        const mark=res&&res.answered===j&&sel.choice===j?('choice' in parts?(parts.choice?' ok':' bad'):res.correct===true?' ok':''):'';
        return `<button type="button" class="choice lv-opt${sel.choice===j?' selected':''}${mark}" role="radio" aria-checked="${sel.choice===j}" data-ch="${j}" ${solved&&!s.lab?'disabled':''}><span class="choice-label">${String.fromCharCode(65+j)}</span>${multi?`<pre>${esc(o)}</pre>`:`<span>${esc(o)}</span>`}</button>`}).join('')}</div>`;
    }else if(s.answer_type==='number'){
      body+=`<label class="lv-num"><input class="input${res&&parts.number===false?' bad':''}" inputmode="decimal" autocomplete="off" data-in="number" value="${esc(sel.number||'')}"></label>`;
    }
    if(s.lab&&!s.independent&&s.answer_type==='choice')body+=labHtml(s,sel);
    if(s.number_part){const k=s.answer_type==='number'?'part':'number';
      body+=`<label class="lv-num"><span>${esc(s.number_part.label)}</span><input class="input${res&&parts[k]===false?' bad':''}" inputmode="decimal" autocomplete="off" data-in="${k}" value="${esc(sel[k]||'')}"></label>`}
    // Подсказки — по одной; «объясни проще»
    const hs=s.hints||[],shown=S.hints[s.id]||0;
    const hints=shown?`<div class="lv-hints">${hs.slice(0,shown).map(h=>`<p>💡 ${esc(h)}</p>`).join('')}</div>`:'';
    const simple=S.showSimple[s.id]&&s.simple?`<div class="concept" style="margin:12px 0 0">${esc(s.simple)}</div>`:'';
    const fb=res?`<div class="feedback${res.correct===true?'':res.correct===null?' neutral':' warn'}" role="status">${esc(res.feedback||'')}${res.correct===false&&res.parts?` ${T.partsBad}`:''}</div>`:'';
    const last=i===n-1;
    const actions=`<div class="actions">${solved?`<span class="lv-done">${T.solved}</span><button type="button" class="btn primary" data-act="next">${last?T.finish:T.next}</button>`:
      `<button type="button" class="btn primary" data-act="check" ${S.busy?'disabled':''}>${T.check}</button>${!s.independent&&hs.length?`<button type="button" class="btn secondary" data-act="hint" ${shown>=hs.length?'disabled':''}>${shown>=hs.length?T.noHints:T.hint(shown+1,hs.length)}</button>`:''}${s.simple&&!s.independent?`<button type="button" class="btn plain" data-act="simple">${T.simple}</button>`:''}${res&&res.correct===null?`<button type="button" class="btn plain" data-act="next">${last?T.finish:T.next}</button>`:''}`}</div>`;
    const rv=S.reveal[s.id]||(solved?{checks:s.checks,free_input:s.free_input}:null);
    const help=S.helpOpen===s.id?helpForm(T.helpTitle,T.helpPh,''):`<div style="margin-top:8px"><button type="button" class="btn plain lv-small" data-act="help">${T.help}</button></div>`;
    return head+body+hints+simple+fb+actions+help+(rv?revealHtml(s,rv):'');
  }

  // Лаборатория: та же формула, что labResult в scripts/lessons.ts (lessons:check сверяет её с checks)
  const LAB_OPS={'>':(x,t)=>x>t,'>=':(x,t)=>x>=t,'<':(x,t)=>x<t,'<=':(x,t)=>x<=t,'==':(x,t)=>x===t,'!=':(x,t)=>x!==t};
  function labResult(lab,option,options,x){
    if(lab.kind==='threshold'){const f=LAB_OPS[options[option]];if(!f)return null;return f(x,lab.threshold)?Math.round(x*lab.then_factor*100)/100:x}
    if(lab.kind==='chain'){const order=(lab.orders||[])[option];if(!order)return null;for(const [t,label] of order)if(x>=t)return label;return lab.else}
    return null;
  }
  const fmtNum=n=>Number(n).toLocaleString(lang==='kk'?'kk-KZ':'ru-RU',{maximumFractionDigits:2});
  function labHtml(s,sel){
    const lab=s.lab,xs=[...(lab.presets||[]),...(S.labX[s.id]||[])];
    const has=Number.isInteger(sel.choice);
    const val=x=>{const v=labResult(lab,sel.choice,s.options||[],x);return v===null?'—':typeof v==='number'?`${fmtNum(v)}${lab.unit?' '+esc(lab.unit):''}`:esc(v)};
    const rows=xs.map((x,i)=>`<tr><td>${fmtNum(x)}${lab.unit?' '+esc(lab.unit):''}${i>=(lab.presets||[]).length?` <span class="muted">· ${T.labYour}</span>`:''}</td><td><b>${has?val(x):'…'}</b></td></tr>`).join('');
    return `<div class="lv-lab"><b>🧪 ${esc(lab.title)}</b><p class="small" style="margin:6px 0 0">${has?T.labNote:T.labPick}</p>
      <table><thead><tr><th>${esc(lab.label)}</th><th>${T.labOut}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="row"><input class="input" inputmode="decimal" autocomplete="off" data-labx aria-label="${esc(lab.label)}" placeholder="${esc(T.labIn)}"><button type="button" class="btn secondary" data-act="labadd">${T.labAdd}</button></div></div>`;
  }

  function revealHtml(s,rv){
    let h='';
    if(Array.isArray(rv.checks)&&rv.checks.length)h+=`<div style="margin-top:18px"><h3>${T.checks}</h3><table class="test-table"><thead><tr><th>${T.input}</th><th>${T.expect}</th></tr></thead><tbody>${rv.checks.map(c=>{const u=s.lab&&s.lab.unit?' '+esc(s.lab.unit):'',f=v=>typeof v==='number'?fmtNum(v)+u:esc(v);return `<tr><td>${f(c.input)}</td><td>${f(c.expect)}</td></tr>`}).join('')}</tbody></table></div>`;
    (rv.free_input||[]).forEach((f,k)=>{
      if(f.answer_type!=='code')return; // формулы — позже (#8)
      const key=`${S.idx}-${k}`;
      h+=`<div class="lv-code" style="margin-top:20px"><h3>${T.code}</h3><p class="lv-prompt">${esc(f.prompt)}</p><textarea spellcheck="false" autocapitalize="off" data-code="${key}">${esc(S.code[key]!==undefined?S.code[key]:f.starter_code||'')}</textarea><p class="small">${T.codeNote}</p><div class="actions" style="margin-top:8px"><button type="button" class="btn secondary" data-run="${key}" ${running?'disabled':''}>${T.run}</button></div><div class="lv-tests" data-out="${key}">${S.out[key]||''}</div></div>`;
    });
    return h;
  }

  function onInput(e){
    const el=e.target;if(!S.lesson)return;const s=S.lesson.steps[S.idx];
    if(el.dataset.in){(S.sel[s.id]=S.sel[s.id]||{})[el.dataset.in]=el.value;el.classList.remove('bad')}
    if(el.dataset.code)S.code[el.dataset.code]=el.value;
  }

  async function onClick(e){
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.sub){S.subject=b.dataset.sub;list();return}
    if(b.dataset.open){open(b.dataset.open);return}
    if(b.dataset.run){runCode(b.dataset.run,b);return}
    const s=S.lesson&&S.lesson.steps[S.idx];
    if(b.dataset.ch!==undefined&&s){if(S.solved.has(s.id)&&!s.lab)return;(S.sel[s.id]=S.sel[s.id]||{}).choice=+b.dataset.ch;keepInputs();lesson();return}
    if(b.dataset.lang){try{localStorage.setItem('my-college-lang',b.dataset.lang)}catch(err){}location.reload();return}
    const a=b.dataset.act;
    if(a==='list'){S.helpOpen=null;reloadList();return}
    if(a==='help'){if(!canHelp()){say(T.helpDemo);return}keepInputs();S.helpOpen=s.id;lesson();focusHelp();return}
    if(a==='nameerr'){S.helpOpen=S.helpOpen==='__name'?null:'__name';S.lesson?(keepInputs(),lesson()):list();focusHelp();return}
    if(a==='helpclose'){S.helpOpen=null;S.lesson?(keepInputs(),lesson()):list();return}
    if(a==='helpsend'){sendHelp(b);return}
    if(a==='labadd'){const el=root.querySelector('[data-labx]');const x=Number(String(el&&el.value||'').replace(/\s/g,'').replace(',','.'));
      if(!el||el.value.trim()===''||!Number.isFinite(x)){say(T.num);el&&el.focus();return}
      const L=(S.labX[s.id]=S.labX[s.id]||[]);if(!L.includes(x)){L.push(x);if(L.length>5)L.shift()}keepInputs();lesson();return}
    if(a==='hint'){S.hints[s.id]=Math.min((S.hints[s.id]||0)+1,(s.hints||[]).length);keepInputs();lesson();return}
    if(a==='simple'){S.showSimple[s.id]=!S.showSimple[s.id];keepInputs();lesson();return}
    if(a==='next'){S.helpOpen=null;if(S.idx<S.lesson.steps.length-1){S.idx++;lesson(true)}else end();return}
    if(a==='check'){check(s,b);return}
  }
  function focusHelp(){const t=root.querySelector('[data-help]');if(t){t.focus();t.scrollIntoView({block:'center'})}}
  async function sendHelp(btn){
    const ta=root.querySelector('[data-help]');const text=(ta&&ta.value||'').trim();if(!text){ta&&ta.focus();return}
    const isName=S.helpOpen==='__name';const s=S.lesson&&S.lesson.steps[S.idx];
    const full=isName||!s?text:`Шаг «${s.title}»: ${text}`; // урок куратор видит отдельно (lesson_id)
    btn.disabled=true;
    const r=await api('/api/help',{method:'POST',body:JSON.stringify({kind:isName?'name_error':'help',text:full.slice(0,1000),lesson_id:!isName&&S.lesson?S.lesson.id:undefined})}).catch(()=>null);
    btn.disabled=false;
    if(!r){say(T.fail);return}
    if(!r.ok){say(srvMsg(r));return}
    S.helpOpen=null;say(isName?T.nameSent:T.helpSent);S.lesson?(keepInputs(),lesson()):list();
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
    if(S.busy)return;S.busy=true;btn.disabled=true;
    const L=S.lesson,rid=uuid(); // обрыв сети — повторяем тем же request_id: сервер не запишет вторую попытку
    const send=()=>api('/api/answer',{method:'POST',body:JSON.stringify({lesson_id:L.id,step_id:s.id,request_id:rid,hints_used:S.hints[s.id]||0,lang,answer})});
    let r=await send().catch(()=>null);
    if(!r)r=await send().catch(()=>null);
    S.busy=false;
    if(S.lesson!==L)return; // студент уже ушёл из урока — ответ к этому экрану не относится
    btn.disabled=false;
    if(!r){say(T.fail);lesson();return}
    if(r.status===422){say(T.browser);lesson();return}
    if(!r.ok){say(srvMsg(r));lesson();return}
    const res={...r.j,answered:Number.isInteger(sel.choice)?sel.choice:null};S.result[s.id]=res;
    if(res.correct!==null&&!(s.id in S.first))S.first[s.id]=res.correct===true;
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
    // Значок: сохранено — считает сервер; демо — по этой сессии, той же формулой
    let md=p&&p.medal!==undefined?p.medal:null;
    if(!S.canSave&&n===tot){const hints=Object.values(S.hints).reduce((a,b)=>a+b,0),all=L.steps.every(s=>S.first[s.id]===true);
      md=all&&hints===0?'gold':ft?'silver':'bronze'}
    const medal=md?`<div class="lv-medal" aria-hidden="true">${T.medal[md].split(' ')[0]}</div><h2>${T.medal[md].split(' ').slice(1).join(' ')}</h2><p class="small">${T.medalWhy[md]}${T.medalNext[md]?` ${T.medalNext[md]}`:''}${S.canSave?'':` ${T.demoMedal}`}</p>`:'';
    back(true);
    root.innerHTML=header()+`<section class="card lv-end">${medal||'<div class="badge" aria-hidden="true">🏁</div>'}<h1>${T.endTitle}</h1><p>${esc(L.title)}</p><p class="small">${T.endSteps(n,tot)} · ${S.canSave?T.saved:T.notSaved}</p>${indepSolved?`<p>${ft?T.firstTry:T.notFirst}</p>`:''}<div class="actions" style="justify-content:center"><button type="button" class="btn primary" data-act="list">${T.back}</button></div></section>`;
    window.scrollTo(0,0);
  }

  async function reloadList(){
    const r=await api('/api/lessons?lang='+lang).catch(()=>null);
    if(r&&r.ok&&Array.isArray(r.j.lessons)){S.list=r.j.lessons;S.canSave=!!r.j.can_save_progress;S.stats=r.j.stats||null}
    list();
  }

  // ── Код «напиши сам»: Pyodide в отдельном потоке, тесты tests[].call / expect (docs/api.md п. 3) ──
  const PYODIDE='https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const RUNNER=`
import sys, io, json
def _run(code, tests_json, no_input):
    tests = json.loads(tests_json)
    buf = io.StringIO(); old = sys.stdout; sys.stdout = buf
    def _no_input(*a):
        raise RuntimeError(no_input)
    ns = {"__name__": "__main__", "input": _no_input}; err = None
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
            if t["call"] == "__stdout__":
                got = buf.getvalue()
                ok = isinstance(t["expect"], str) and got.rstrip("\\n") == t["expect"].rstrip("\\n")
            else:
                got = eval(t["call"], ns); ok = got == t["expect"]
            out.append({"ok": ok, "got": repr(got)})
        except BaseException as e:
            out.append({"ok": False, "got": type(e).__name__ + ": " + str(e)})
    return json.dumps(out)
`;
  const WORKER=`importScripts('${PYODIDE}pyodide.js');let py;
self.onmessage=async e=>{try{if(!py){py=await loadPyodide({indexURL:'${PYODIDE}'});py.runPython(${JSON.stringify(RUNNER)})}
const f=py.globals.get('_run');self.postMessage({ok:true,res:JSON.parse(f(e.data.code,JSON.stringify(e.data.tests),e.data.noInput))})}catch(err){self.postMessage({ok:false,error:String(err)})}}`;
  let worker=null,ready=false,running=false;
  function runCode(key,btn){
    if(running)return; // один запуск за раз: иначе ответ первого придёт во второй
    const [idx,k]=key.split('-').map(Number);const s=S.lesson.steps[idx];if(!s)return;
    const rv=S.reveal[s.id]||{free_input:s.free_input};const f=(rv.free_input||[])[k];if(!f)return;
    const ta=root.querySelector(`[data-code="${key}"]`);const code=ta?ta.value:(S.code[key]||'');
    const L=S.lesson;const show=html=>{S.out[key]=html;if(S.lesson===L){const o=root.querySelector(`[data-out="${key}"]`);if(o)o.innerHTML=html;root.querySelectorAll('[data-run]').forEach(x=>x.disabled=running)}};
    running=true;show(esc(ready?T.running:T.loadPy));
    if(!worker)worker=new Worker(URL.createObjectURL(new Blob([WORKER],{type:'text/javascript'})));
    const done=html=>{clearTimeout(timer);running=false;show(html)};
    const timer=setTimeout(()=>{worker.terminate();worker=null;ready=false;done(esc(T.timeout))},ready?8000:60000);
    worker.onmessage=e=>{
      if(!e.data.ok){done(esc(T.pyFail));return}
      ready=true;const res=e.data.res,okN=res.filter(x=>x.ok).length;
      done((f.tests||[]).map((t,i)=>`<div>${res[i].ok?T.pass:T.failT} <code>${esc(t.call==='__stdout__'?'print(...)':t.call)}</code>${res[i].ok?'':` — ${T.got} <code>${esc(res[i].got)}</code>`}</div>`).join('')+`<p style="margin-top:8px"><b>${okN===res.length?T.allOk:T.someFail(okN,res.length)}</b></p>`)};
    worker.onerror=()=>{worker=null;ready=false;done(esc(T.pyFail))};
    worker.postMessage({code,tests:f.tests||[],noInput:T.noInput});
  }
})();
