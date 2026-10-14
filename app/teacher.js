// Кабинет преподавателя — промо-версия на демо-данных.
// В сервисе: роль teacher выдаёт сервер по приглашению колледжа (#5), данные групп — только своему преподавателю (#9).
'use strict';
(function(){
const tg=window.Telegram&&window.Telegram.WebApp, inTg=!!(tg&&tg.initData);
const lang=document.documentElement.lang==='kk'?'kk':'ru';
const BOT='tutornvl_bot';
const STORE='my-college-teacher-demo';

// ── Тексты ───────────────────────────────────────────────────
const T={ru:{
  brand:'Мой колледж',demo:'Демо',asStudent:'← Посмотреть как студент',switchRole:'Сменить роль',about:'О прототипе',reset:'Сбросить демо',teacher:'Демо-преподаватель',
  tabs:{groups:'Мои группы',progress:'Прогресс',plan:'План занятий',tasks:'Задания',help:'Обращения'},
  groupsTitle:'Мои группы',groupsSub:'Создайте группу и отправьте студентам ссылку — они сразу попадут к вам.',
  students:n=>`${n} ${plural(n,['студент','студента','студентов'])}`,linkTill:d=>`Ссылка действует до ${d}`,
  copy:'Копировать',share:'Поделиться в Telegram',qr:'QR-код',open:'Прогресс →',
  newGroup:'Новая группа',gName:'Название группы',gNamePh:'Например, ИС-23',gSubject:'Дисциплина',gDays:'Ссылка действует',days:n=>`${n} дней`,create:'Создать',
  created:'Группа создана. Отправьте ссылку студентам.',copied:'Ссылка скопирована',
  qrTitle:'QR-код для студентов',qrSub:'Покажите на экране в аудитории — студенты наведут камеру и откроют бота.',close:'Закрыть',
  shareText:g=>`Присоединяйтесь к группе «${g}» в «Моём колледже»: короткие задачи и подсказки прямо в Telegram.`,
  progressTitle:'Прогресс группы',group:'Группа',
  tStudents:'студентов',tActive:'активны за неделю',tAvg:'средний прогресс',tStuck:'застряли',
  stuckTitle:'Кто застрял',stuckSub:'Две неудачные попытки подряд или много подсказок на одном шаге.',
  why2:s=>`2 неудачные попытки подряд · «${s}»`,whyH:(n,s)=>`${n} ${plural(n,['подсказка','подсказки','подсказок'])} · «${s}»`,write:'Написать',
  weakTitle:'Слабые темы группы',weakSub:'Доля студентов, решивших шаг с первой попытки.',
  tableTitle:'Студенты',thName:'Студент',thSteps:'Шаги',thHints:'Подсказки',thInd:'Самостоятельная',thLast:'Активность',
  indFirst:'С первой попытки',indLater:'Не с первой попытки',indNone:'Ещё нет',
  ago:h=>h<1?'только что':h<24?`${h} ч назад`:`${Math.round(h/24)} дн. назад`,
  exportX:'↓ Выгрузить в Excel',exportTg:'Выгрузка в Excel доступна в браузере — откройте кабинет на компьютере.',noStudents:'В группе пока нет студентов — отправьте им ссылку.',
  planTitle:'Мой план занятий',planSub:'Загрузите свой календарно-тематический план. AI подготовит черновики задач, вы утверждаете — студенты видят только утверждённое.',
  upload:'Загрузить КТП',uploadHint:'Word, Excel, PDF или список тем',uploaded:(f,n)=>`План «${f}» загружен: ${n} тем. В демо показан пример плана.`,
  demoPlan:'Пример плана',
  st:{approved:'Утверждено',draft:'Черновик AI — проверить',none:'Задачи не созданы',gen:'AI готовит черновик…'},
  view:'Посмотреть',generate:'Создать черновик',approve:'Утвердить',rework:'На доработку',
  draftTitle:t=>`Черновик: ${t}`,draftNote:'Черновик подготовил AI по теме вашего плана. Проверьте задачу, подсказки и ответ — студенты увидят только после утверждения.',
  approvedMsg:'Урок утверждён — студенты группы его увидят.',reworkMsg:'Отправлено на доработку: AI учтёт замечания.',genDone:'Черновик готов — проверьте его.',
  dStory:'Задача из жизни',dSteps:'Шаги',dHints:'Подсказки (лестница)',dInd:'Самостоятельная задача',
  tasksTitle:'Задания',tasksSub:'Назначьте урок группе со сроком — бот напомнит студентам.',
  newTask:'Новое задание',lesson:'Урок',deadline:'Срок',assign:'Назначить',assigned:'Задание назначено. Бот напомнит студентам.',
  doneOf:(a,b)=>`Выполнили ${a} из ${b}`,till:d=>`до ${d}`,noApproved:'Сначала утвердите урок в «План занятий».',
  helpTitle:'Обращения',helpSub:'Студенты нажали «Нужна помощь». В сервисе обращение приходит и сюда, и вам в Telegram.',
  reply:'Ответить',resolve:'Решено',resolved:'Решено',replyMsg:'В сервисе откроется чат со студентом в Telegram.',noHelp:'Новых обращений нет.',
  demoNote:'Демо-данные: студенты, прогресс и обращения выдуманы. В сервисе кабинет видит только преподаватель своей группы, вход — по приглашению колледжа.',
  subjects:{python:'Программирование',math:'Высшая математика',tech:'Спецтехнологии',service:'Спецдисциплины'}
},kk:{
  brand:'Менің колледжім',demo:'Демо',asStudent:'← Студент ретінде көру',switchRole:'Рөлді ауыстыру',about:'Прототип туралы',reset:'Демоны қалпына келтіру',teacher:'Демо-оқытушы',
  tabs:{groups:'Менің топтарым',progress:'Прогресс',plan:'Сабақ жоспары',tasks:'Тапсырмалар',help:'Өтініштер'},
  groupsTitle:'Менің топтарым',groupsSub:'Топ құрып, студенттерге сілтеме жіберіңіз — олар бірден сізге қосылады.',
  students:n=>`${n} студент`,linkTill:d=>`Сілтеме ${d} дейін жарамды`,
  copy:'Көшіру',share:'Telegram-да бөлісу',qr:'QR-код',open:'Прогресс →',
  newGroup:'Жаңа топ',gName:'Топтың атауы',gNamePh:'Мысалы, ИС-23',gSubject:'Пән',gDays:'Сілтеме мерзімі',days:n=>`${n} күн`,create:'Құру',
  created:'Топ құрылды. Сілтемені студенттерге жіберіңіз.',copied:'Сілтеме көшірілді',
  qrTitle:'Студенттерге арналған QR-код',qrSub:'Аудиториядағы экранда көрсетіңіз — студенттер камераны бағыттап, ботты ашады.',close:'Жабу',
  shareText:g=>`«Менің колледжім» сервисіндегі «${g}» тобына қосылыңыз: қысқа есептер мен кеңестер тікелей Telegram-да.`,
  progressTitle:'Топтың прогресі',group:'Топ',
  tStudents:'студент',tActive:'аптада белсенді',tAvg:'орташа прогресс',tStuck:'тығырыққа тірелді',
  stuckTitle:'Кім тығырыққа тірелді',stuckSub:'Бір қадамда қатарынан екі сәтсіз талпыныс немесе көп кеңес.',
  why2:s=>`Қатарынан 2 сәтсіз талпыныс · «${s}»`,whyH:(n,s)=>`${n} кеңес · «${s}»`,write:'Жазу',
  weakTitle:'Топтың әлсіз тақырыптары',weakSub:'Қадамды бірінші талпыныстан шешкен студенттердің үлесі.',
  tableTitle:'Студенттер',thName:'Студент',thSteps:'Қадамдар',thHints:'Кеңестер',thInd:'Өзіндік есеп',thLast:'Белсенділік',
  indFirst:'Бірінші талпыныстан',indLater:'Бірінші талпыныстан емес',indNone:'Әлі жоқ',
  ago:h=>h<1?'жаңа ғана':h<24?`${h} сағ бұрын`:`${Math.round(h/24)} күн бұрын`,
  exportX:'↓ Excel-ге жүктеу',exportTg:'Excel-ге жүктеу браузерде қолжетімді — кабинетті компьютерде ашыңыз.',noStudents:'Топта әзірге студенттер жоқ — оларға сілтеме жіберіңіз.',
  planTitle:'Менің сабақ жоспарым',planSub:'Күнтізбелік-тақырыптық жоспарыңызды жүктеңіз. AI есептердің жобаларын дайындайды, сіз бекітесіз — студенттер тек бекітілгенін көреді.',
  upload:'КТЖ жүктеу',uploadHint:'Word, Excel, PDF немесе тақырыптар тізімі',uploaded:(f,n)=>`«${f}» жоспары жүктелді: ${n} тақырып. Демода жоспардың үлгісі көрсетілген.`,
  demoPlan:'Жоспар үлгісі',
  st:{approved:'Бекітілді',draft:'AI жобасы — тексеру',none:'Есептер құрылмаған',gen:'AI жоба дайындап жатыр…'},
  view:'Қарау',generate:'Жоба құру',approve:'Бекіту',rework:'Пысықтауға',
  draftTitle:t=>`Жоба: ${t}`,draftNote:'Жобаны жоспарыңыздың тақырыбы бойынша AI дайындады. Есепті, кеңестерді және жауапты тексеріңіз — студенттер оны тек бекітілгеннен кейін көреді.',
  approvedMsg:'Сабақ бекітілді — топ студенттері оны көреді.',reworkMsg:'Пысықтауға жіберілді: AI ескертулерді ескереді.',genDone:'Жоба дайын — оны тексеріңіз.',
  dStory:'Өмірден алынған есеп',dSteps:'Қадамдар',dHints:'Кеңестер (саты)',dInd:'Өзіндік есеп',
  tasksTitle:'Тапсырмалар',tasksSub:'Топқа мерзімімен сабақ тағайындаңыз — бот студенттерге еске салады.',
  newTask:'Жаңа тапсырма',lesson:'Сабақ',deadline:'Мерзімі',assign:'Тағайындау',assigned:'Тапсырма тағайындалды. Бот студенттерге еске салады.',
  doneOf:(a,b)=>`${b} студенттің ${a}-і орындады`,till:d=>`${d} дейін`,noApproved:'Алдымен «Сабақ жоспары» бөлімінде сабақты бекітіңіз.',
  helpTitle:'Өтініштер',helpSub:'Студенттер «Көмек керек» батырмасын басты. Сервисте өтініш мұнда да, сізге Telegram-да да келеді.',
  reply:'Жауап беру',resolve:'Шешілді',resolved:'Шешілді',replyMsg:'Сервисте студентпен Telegram-дағы чат ашылады.',noHelp:'Жаңа өтініштер жоқ.',
  demoNote:'Демо-деректер: студенттер, прогресс және өтініштер ойдан алынған. Сервисте кабинетті тек өз тобының оқытушысы көреді, кіру — колледждің шақыруы бойынша.',
  subjects:{python:'Бағдарламалау',math:'Жоғары математика',tech:'Арнайы технологиялар',service:'Арнайы пәндер'}
}}[lang];
function plural(n,f){n=Math.abs(n)%100;const n1=n%10;return n>10&&n<20?f[2]:n1>1&&n1<5?f[1]:n1===1?f[0]:f[2]}

// ── Демо-данные ─────────────────────────────────────────────
const SKILLS={
  python:{ru:['Как работает условие','Граница сравнения','Проверка программы','Новая задача'],kk:['Шарт қалай жұмыс істейді','Салыстыру шекарасы','Бағдарламаны тексеру','Жаңа есеп']},
  math:{ru:['Модель площади','Нулевая производная','Поиск максимума','Перенос на новую задачу'],kk:['Аудан моделі','Нөлдік туынды','Максимумды іздеу','Жаңа есепке көшіру']}
};
const PLAN={
  python:{ru:['Переменные и типы данных','Ввод и вывод','Условия и граничные значения','Логические операторы and / or','Цикл for','Цикл while','Списки','Функции'],
          kk:['Айнымалылар және деректер түрлері','Енгізу және шығару','Шарттар және шекаралық мәндер','and / or логикалық операторлары','for циклі','while циклі','Тізімдер','Функциялар'],
          status:['approved','approved','approved','draft','draft','none','none','none'],lesson:2},
  math:{ru:['Функция и её график','Предел функции','Производная','Правила дифференцирования','Производная сложной функции','Возрастание и убывание','Наибольшее значение: оптимизация','Прикладные задачи'],
        kk:['Функция және оның графигі','Функцияның шегі','Туынды','Дифференциалдау ережелері','Күрделі функцияның туындысы','Өсу және кему','Ең үлкен мән: оңтайландыру','Қолданбалы есептер'],
        status:['approved','approved','approved','draft','none','none','approved','none'],lesson:6}
};
const DRAFTS={
  python:{3:{ru:{story:'Кинотеатр продаёт студенческий билет со скидкой, если зрителю от 16 до 23 лет включительно и у него есть студенческий билет.',steps:['Какие два условия проверяет касса?','Почему здесь нужен and, а не or?','Исправь условие age >= 16 or age <= 23.'],hints:['Скидка нужна, только если выполнены оба условия.','Что вернёт or, если зрителю 40 лет?','Пример: «вход с 18 лет и по паспорту» — age >= 18 and has_passport.'],ind:'Бесплатный проход в спортзал: студент колледжа или младше 18 лет. Какое условие подходит?'},
             kk:{story:'Кинотеатр жасы 16-дан 23-ке дейін (қоса алғанда) және студенттік билеті бар көрерменге жеңілдікпен билет сатады.',steps:['Касса қандай екі шартты тексереді?','Неге мұнда or емес, and керек?','age >= 16 or age <= 23 шартын түзет.'],hints:['Жеңілдік екі шарт та орындалса ғана беріледі.','Көрермен 40 жаста болса, or не қайтарады?','Мысал: «18 жастан бастап және төлқұжатпен» — age >= 18 and has_passport.'],ind:'Спортзалға тегін кіру: колледж студенті немесе 18-ге толмаған. Қай шарт сәйкес?'}},
          4:{ru:{story:'Кофейня копит баллы: каждый пятый кофе — бесплатно. Нужно вывести номера бесплатных чашек за день из 30 заказов.',steps:['Сколько раз должен повториться цикл?','Как проверить, что номер делится на 5?','Допиши for i in range(1, 31): …'],hints:['Перебираем номера заказов от 1 до 30.','Что даёт остаток i % 5 для каждой пятой чашки?','Пример: чётные числа — if i % 2 == 0.'],ind:'Каждый третий посетитель получает купон. Выведи номера посетителей с купоном из 20.'},
             kk:{story:'Кофехана ұпай жинайды: әр бесінші кофе — тегін. Күніне 30 тапсырыстың ішінен тегін кеселердің нөмірлерін шығару керек.',steps:['Цикл неше рет қайталануы керек?','Нөмірдің 5-ке бөлінетінін қалай тексереміз?','for i in range(1, 31): … жалғастыр.'],hints:['Тапсырыс нөмірлерін 1-ден 30-ға дейін қарап шығамыз.','Әр бесінші кеседе i % 5 қалдығы неге тең?','Мысал: жұп сандар — if i % 2 == 0.'],ind:'Әр үшінші келуші купон алады. 20 келушінің ішінен купон алғандардың нөмірлерін шығар.'}}},
  math:{3:{ru:{story:'Скорость автобуса меняется: путь s(t) = 3t² + 2t (метры, t — секунды). Найди скорость в момент t = 4 с.',steps:['Какое правило дифференцирования нужно для 3t²?','Чему равна производная s(t)?','Подставь t = 4.'],hints:['Скорость — производная пути по времени.','(tⁿ)′ = n·tⁿ⁻¹, а константа выносится за знак производной.','Пример: (5t²)′ = 10t.'],ind:'Путь s(t) = t³ + t. Какая скорость в момент t = 2 с?'},
             kk:{story:'Автобустың жылдамдығы өзгереді: жол s(t) = 3t² + 2t (метр, t — секунд). t = 4 с сәтіндегі жылдамдықты тап.',steps:['3t² үшін дифференциалдаудың қай ережесі керек?','s(t)-ның туындысы неге тең?','t = 4 мәнін қой.'],hints:['Жылдамдық — жолдың уақыт бойынша туындысы.','(tⁿ)′ = n·tⁿ⁻¹, ал тұрақты туынды таңбасының алдына шығарылады.','Мысал: (5t²)′ = 10t.'],ind:'Жол s(t) = t³ + t. t = 2 с сәтіндегі жылдамдық қандай?'}}}
};
const FIRST={ru:['Айгерим','Данияр','Алия','Ерлан','Мадина','Арман','Дана','Нурлан','Камила','Тимур','Аружан','Санжар','Жанель','Руслан','Асель','Бекзат','Диана','Ильяс','Томирис','Максим','Сабина','Әлихан','Карина','Олжас','Виктория','Ернур'],
  last:['А.','Б.','В.','Ж.','Е.','К.','М.','Н.','О.','С.','Т.','Ш.']};
function rng(seed){let s=seed;return()=>((s=Math.imul(s^s>>>15,1|s)+0x6d2b79f5|0,((s^s>>>7)>>>0)%10000)/10000)}
function makeStudents(n,seed,subject){const r=rng(seed),out=[];
  for(let i=0;i<n;i++){let done=Math.min(4,Math.floor(r()*5.6));let hints=Math.floor(r()*(done<2?7:4));
    // Примерно каждый шестой застрял: две неудачи подряд или много подсказок на шаге «Граница сравнения» / «Нулевая производная»
    let stuck=null;if(i%7===2||i===5){done=1+(i%2);stuck={step:1,why:i%3?'two':'hints',hints:4+(i%3)};hints=Math.max(hints,stuck.hints)}
    const ind=done===4?(r()<.62?'first':'later'):'none';const last=i%5===4?170+Math.floor(r()*240):Math.floor(r()*96);
    out.push({name:FIRST.ru[(i*7+seed)%FIRST.ru.length]+' '+FIRST.last[(i*5+seed)%FIRST.last.length],done,hints,ind,last,stuck,ok:[0,1,2,3].map(k=>k<done?r()<(k===1?.48:k===3?.62:.82):null)})}
  return out}
const DEFAULT={
  groups:[{id:'is21',name:'ИС-21',subject:'python',code:'G7K2QX',days:14,created:Date.now()-3*864e5,n:24,seed:21},
          {id:'pr22',name:'ПР-22',subject:'math',code:'M4T9LB',days:30,created:Date.now()-8*864e5,n:22,seed:22}],
  plan:{python:PLAN.python.status.slice(),math:PLAN.math.status.slice()},
  tasks:[{group:'is21',topic:2,subject:'python',deadline:addDays(3),done:15},{group:'pr22',topic:6,subject:'math',deadline:addDays(6),done:9}],
  help:[{id:1,group:'is21',student:'Камила Н.',topic:2,step:1,text:{ru:'Не понимаю, почему 1000 не больше 1000. Это же одно и то же число?',kk:'1000 неге 1000-нан үлкен емес екенін түсінбеймін. Бұл бір сан емес пе?'},h:1,done:false},
        {id:2,group:'pr22',student:'Ильяс С.',topic:6,step:2,text:{ru:'Ползунок показывает максимум при 10, а у меня в тетради получилось 20.',kk:'Жүгірткі максимумды 10-да көрсетеді, ал менің дәптерімде 20 шықты.'},h:5,done:false},
        {id:3,group:'is21',student:'Тимур К.',topic:2,step:2,text:{ru:'Касса пишет 3 из 4, не могу найти ошибку.',kk:'Касса 4-тен 3 деп жазады, қатені таба алмаймын.'},h:26,done:false}],
  uploaded:null
};
function addDays(n){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
let S;try{S=JSON.parse(localStorage.getItem(STORE)||'null')}catch(e){}
if(!S||!S.groups)S=JSON.parse(JSON.stringify(DEFAULT));
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(S))}catch(e){}};
const cache={};const studentsOf=g=>cache[g.id]||(cache[g.id]=makeStudents(g.n,g.seed||7,g.subject));
const topicName=(subj,i)=>PLAN[subj]?PLAN[subj][lang][i]:'';
// Казахских названий месяцев в браузерах нет («M10 24»), поэтому на казахском — цифрами: «24.10»
const fmtDate=s=>{const d=new Date(s);return lang==='kk'?String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0'):d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})};
const linkOf=g=>`https://t.me/${BOT}?startapp=g_${g.code}`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ── Каркас ──────────────────────────────────────────────────
let tab='groups',cur=S.groups[0]&&S.groups[0].id;
document.querySelectorAll('[data-t]').forEach(el=>{el.textContent=T[el.dataset.t]});
const u=inTg&&tg.initDataUnsafe&&tg.initDataUnsafe.user;
const nm=u&&u.first_name?u.first_name:T.teacher;
document.getElementById('t-name').textContent=nm;
document.getElementById('t-ava').textContent=nm.split(/\s|-/).filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase();
document.title=(lang==='kk'?'Менің колледжім — оқытушы кабинеті':'Мой колледж — кабинет преподавателя');
document.querySelectorAll('.lang-switch button').forEach(b=>{b.classList.toggle('active',b.dataset.lang===lang);b.onclick=()=>{if(b.dataset.lang===lang)return;try{localStorage.setItem('my-college-lang',b.dataset.lang)}catch(e){}location.reload()}});
const resetLink=document.createElement('a');resetLink.href='#';resetLink.textContent=T.reset;resetLink.onclick=e=>{e.preventDefault();try{localStorage.removeItem(STORE)}catch(err){}location.reload()};document.querySelector('footer').appendChild(resetLink);
if(inTg){tg.ready();tg.expand();try{if(tg.isVersionAtLeast('7.7'))tg.disableVerticalSwipes();const c=document.documentElement.dataset.theme==='dark'?'#121916':'#f5f6f1';tg.setHeaderColor(c);tg.setBackgroundColor(c)}catch(e){}}

function toast(t){const el=document.getElementById('toast');el.textContent=t;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),3200)}
function modal(html){const m=document.getElementById('modal');m.innerHTML=`<section class="modal" role="dialog" aria-modal="true">${html}</section>`;m.classList.remove('hidden');return m}
function closeModal(){const m=document.getElementById('modal');m.classList.add('hidden');m.innerHTML=''}
document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal'||e.target.closest('[data-close]'))closeModal()});

function renderTabs(){const open=S.help.filter(h=>!h.done).length;
  document.getElementById('tabs').innerHTML=Object.entries(T.tabs).map(([k,v])=>`<button type="button" data-tab="${k}" class="${k===tab?'active':''}">${v}${k==='help'&&open?`<span class="count">${open}</span>`:''}</button>`).join('')}
document.getElementById('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;render();window.scrollTo({top:0})}});
function groupSelect(){return `<select class="i" id="grp" aria-label="${T.group}">${S.groups.map(g=>`<option value="${g.id}" ${g.id===cur?'selected':''}>${esc(g.name)} · ${T.subjects[g.subject]}</option>`).join('')}</select>`}
function render(){renderTabs();document.getElementById('view').innerHTML=({groups,progress,plan,tasks,help})[tab]()+`<p class="note">${T.demoNote}</p>`}

// ── Экраны ──────────────────────────────────────────────────
function groups(){const till=g=>fmtDate(g.created+g.days*864e5);
  return `<h1>${T.groupsTitle}</h1><p class="sub">${T.groupsSub}</p>
  ${S.groups.map(g=>`<div class="card"><div class="row"><div class="grow"><b style="font-size:17px">${esc(g.name)}</b> <span class="tag t-violet">${T.subjects[g.subject]}</span><div class="muted">${T.students(g.n)} · ${T.linkTill(till(g))}</div></div><button class="btn secondary" data-act="open" data-g="${g.id}">${T.open}</button></div>
    <div class="link">${linkOf(g)}</div>
    <div class="row"><button class="btn primary" data-act="share" data-g="${g.id}">${T.share}</button><button class="btn secondary" data-act="copy" data-g="${g.id}">${T.copy}</button><button class="btn secondary" data-act="qr" data-g="${g.id}">${T.qr}</button></div></div>`).join('')}
  <div class="card"><b>${T.newGroup}</b><div class="form">
    <div><label class="f" for="g-name">${T.gName}</label><input class="i" id="g-name" placeholder="${T.gNamePh}" maxlength="24"></div>
    <div><label class="f" for="g-subj">${T.gSubject}</label><select class="i" id="g-subj">${Object.entries(T.subjects).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
    <div><label class="f" for="g-days">${T.gDays}</label><select class="i" id="g-days">${[7,14,30].map(d=>`<option value="${d}" ${d===14?'selected':''}>${T.days(d)}</option>`).join('')}</select></div>
    <button class="btn lime" data-act="create">${T.create}</button></div></div>`}

function progress(){const g=S.groups.find(x=>x.id===cur)||S.groups[0];if(!g)return '';const st=studentsOf(g),n=st.length;
  const sk=(SKILLS[g.subject]||SKILLS.python)[lang];
  const active=st.filter(s=>s.last<168).length,avg=n?Math.round(st.reduce((a,s)=>a+s.done,0)/(n*4)*100):0,stuck=st.filter(s=>s.stuck);
  const weak=sk.map((name,k)=>{const tried=st.filter(s=>s.ok[k]!==null);const p=tried.length?Math.round(tried.filter(s=>s.ok[k]).length/tried.length*100):0;return{name,p,tried:tried.length}});
  const ind=s=>s.ind==='first'?`<span class="tag t-ok">${T.indFirst}</span>`:s.ind==='later'?`<span class="tag t-draft">${T.indLater}</span>`:`<span class="muted">${T.indNone}</span>`;
  return `<h1>${T.progressTitle}</h1><div class="row" style="margin-bottom:14px"><div class="grow">${groupSelect()}</div></div>
  ${n?`<div class="tiles"><div class="tile"><b>${n}</b><span>${T.tStudents}</span></div><div class="tile"><b>${active}</b><span>${T.tActive}</span></div><div class="tile"><b>${avg}%</b><span>${T.tAvg}</span></div><div class="tile ${stuck.length?'alert':''}"><b>${stuck.length}</b><span>${T.tStuck}</span></div></div>
  <div class="card"><b>${T.stuckTitle}</b><div class="muted">${T.stuckSub}</div>${stuck.map(s=>`<div class="topic"><span class="num">!</span><div class="grow"><b>${esc(s.name)}</b><div class="muted">${s.stuck.why==='two'?T.why2(sk[s.stuck.step]):T.whyH(s.stuck.hints,sk[s.stuck.step])}</div></div><button class="btn secondary" data-act="write">${T.write}</button></div>`).join('')}</div>
  <div class="card"><b>${T.weakTitle}</b><div class="muted">${T.weakSub}</div>${weak.map(w=>`<div style="margin-top:12px"><div class="row"><span class="grow">${esc(w.name)}</span><b>${w.p}%</b></div><div class="bar ${w.p<55?'low':w.p<75?'mid':''}"><i style="width:${w.p}%"></i></div></div>`).join('')}</div>
  <div class="card"><div class="row"><b class="grow">${T.tableTitle}</b><button class="btn secondary" data-act="export">${T.exportX}</button></div>
  <div class="table-wrap"><table><thead><tr><th>${T.thName}</th><th>${T.thSteps}</th><th>${T.thHints}</th><th>${T.thInd}</th><th>${T.thLast}</th></tr></thead><tbody>
  ${st.slice().sort((a,b)=>(b.stuck?1:0)-(a.stuck?1:0)||b.done-a.done).map(s=>`<tr class="${s.stuck?'stuck':''}"><td>${esc(s.name)}</td><td>${s.done}/4</td><td>${s.hints}</td><td>${ind(s)}</td><td class="muted">${T.ago(s.last)}</td></tr>`).join('')}
  </tbody></table></div></div>`:`<div class="card muted">${T.noStudents}</div>`}`}

function plan(){const g=S.groups.find(x=>x.id===cur)||S.groups[0];const subj=g&&PLAN[g.subject]?g.subject:'python';const P=PLAN[subj],stat=S.plan[subj];
  const tag=s=>`<span class="tag ${s==='approved'?'t-ok':s==='draft'?'t-draft':s==='gen'?'t-violet':'t-none'}">${T.st[s]}</span>`;
  return `<h1>${T.planTitle}</h1><p class="sub">${T.planSub}</p>
  <div class="card"><div class="row"><div class="grow">${groupSelect()}</div><label class="btn primary" style="cursor:pointer">${T.upload}<input type="file" id="ktp" accept=".doc,.docx,.xls,.xlsx,.pdf,.txt,.csv" hidden></label></div><div class="muted" style="margin-top:6px">${S.uploaded?esc(T.uploaded(S.uploaded,P[lang].length)):T.uploadHint}</div></div>
  <div class="card"><b>${T.demoPlan}: ${T.subjects[subj]}</b>
  ${P[lang].map((t,i)=>`<div class="topic"><span class="num">${i+1}</span><div class="grow">${esc(t)}<div style="margin-top:4px">${tag(stat[i])}</div></div>
    ${stat[i]==='draft'?`<button class="btn secondary" data-act="draft" data-s="${subj}" data-i="${i}">${T.view}</button>`:stat[i]==='none'?`<button class="btn secondary" data-act="gen" data-s="${subj}" data-i="${i}">${T.generate}</button>`:''}</div>`).join('')}</div>`}

function draftHtml(subj,i){const d=DRAFTS[subj]&&DRAFTS[subj][i]&&DRAFTS[subj][i][lang];const t=topicName(subj,i);
  const D=d||(lang==='kk'?{story:`«${t}» тақырыбы бойынша өмірден алынған есеп: колледж студентіне таныс жағдай.`,steps:['Ұғымды түсіну: шағын сұрақ','Мысалда тексеру','Тренажёрда байқап көру'],hints:['Ишара — негізгі идеяға назар аудару','Нақтылаушы сұрақ','Ұқсас мысал'],ind:'Кеңессіз жаңа жағдайдағы есеп.'}:{story:`Задача из жизни по теме «${t}»: ситуация, знакомая студенту колледжа.`,steps:['Понять идею: короткий вопрос','Проверить на примере','Попробовать в тренажёре'],hints:['Намёк — на главную идею','Наводящий вопрос','Похожий пример'],ind:'Задача в новой ситуации без подсказок.'});
  return `<h2>${esc(T.draftTitle(t))}</h2><p class="muted">${T.draftNote}</p>
  <div class="draft-box"><b>${T.dStory}</b><p>${esc(D.story)}</p><b>${T.dSteps}</b><ol>${D.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><b>${T.dHints}</b><ol>${D.hints.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><b>${T.dInd}</b><p>${esc(D.ind)}</p></div>
  <div class="row"><button class="btn primary" data-act="approve" data-s="${subj}" data-i="${i}">${T.approve}</button><button class="btn secondary" data-act="rework" data-s="${subj}" data-i="${i}">${T.rework}</button><button class="btn plain" data-close>${T.close}</button></div>`}

function tasks(){const approved=g=>PLAN[g.subject]?S.plan[g.subject].map((s,i)=>s==='approved'?i:null).filter(i=>i!==null):[];
  const g=S.groups.find(x=>x.id===cur)||S.groups[0];
  return `<h1>${T.tasksTitle}</h1><p class="sub">${T.tasksSub}</p>
  ${S.tasks.map(t=>{const gr=S.groups.find(x=>x.id===t.group);if(!gr)return '';const total=gr.n,p=total?Math.round(t.done/total*100):0;
    return `<div class="card"><div class="row"><div class="grow"><b>${esc(topicName(t.subject,t.topic))}</b><div class="muted">${esc(gr.name)} · ${T.subjects[t.subject]} · ${T.till(fmtDate(t.deadline))}</div></div><span class="tag ${p>=60?'t-ok':'t-draft'}">${T.doneOf(t.done,total)}</span></div><div class="bar ${p<40?'low':p<60?'mid':''}"><i style="width:${p}%"></i></div></div>`}).join('')}
  <div class="card"><b>${T.newTask}</b><div class="form">
    <div><label class="f" for="grp">${T.group}</label>${groupSelect()}</div>
    <div><label class="f" for="t-topic">${T.lesson}</label>${approved(g).length?`<select class="i" id="t-topic">${approved(g).map(i=>`<option value="${i}">${esc(topicName(g.subject,i))}</option>`).join('')}</select>`:`<div class="muted">${T.noApproved}</div>`}</div>
    <div><label class="f" for="t-date">${T.deadline}</label><input class="i" type="date" id="t-date" value="${addDays(7)}" min="${addDays(0)}"></div>
    <button class="btn lime" data-act="assign" ${approved(g).length?'':'disabled'}>${T.assign}</button></div></div>`}

function help(){const open=S.help.filter(h=>!h.done),done=S.help.filter(h=>h.done);
  const card=h=>{const gr=S.groups.find(x=>x.id===h.group)||{name:'',subject:'python'};const sk=(SKILLS[gr.subject]||SKILLS.python)[lang];
    return `<div class="card" style="${h.done?'opacity:.6':''}"><div class="row"><div class="grow"><b>${esc(h.student)}</b> <span class="muted">· ${esc(gr.name)} · ${T.ago(h.h)}</span><div class="muted">${esc(topicName(gr.subject,h.topic))} · ${esc(sk[h.step])}</div></div>${h.done?`<span class="tag t-ok">${T.resolved}</span>`:''}</div><p style="margin:10px 0">«${esc(h.text[lang])}»</p>${h.done?'':`<div class="row"><button class="btn primary" data-act="reply">${T.reply}</button><button class="btn secondary" data-act="resolve" data-h="${h.id}">${T.resolve}</button></div>`}</div>`};
  return `<h1>${T.helpTitle}</h1><p class="sub">${T.helpSub}</p>${open.length?open.map(card).join(''):`<div class="card muted">${T.noHelp}</div>`}${done.map(card).join('')}`}

// ── Действия ────────────────────────────────────────────────
document.getElementById('view').addEventListener('change',e=>{
  if(e.target.id==='grp'){cur=e.target.value;render()}
  if(e.target.id==='ktp'&&e.target.files[0]){S.uploaded=e.target.files[0].name;save();render();toast(T.uploaded(S.uploaded,8))}
});
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,g=S.groups.find(x=>x.id===b.dataset.g);
  if(a==='open'){cur=g.id;tab='progress';render();window.scrollTo({top:0})}
  if(a==='copy'){const l=linkOf(g);(navigator.clipboard?navigator.clipboard.writeText(l):Promise.reject()).then(()=>toast(T.copied)).catch(()=>{const ta=document.createElement('textarea');ta.value=l;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast(T.copied)}catch(err){}ta.remove()})}
  if(a==='share'){const url='https://t.me/share/url?url='+encodeURIComponent(linkOf(g))+'&text='+encodeURIComponent(T.shareText(g.name));if(inTg&&tg.openTelegramLink)tg.openTelegramLink(url);else window.open(url,'_blank','noopener')}
  if(a==='qr'){const m=modal(`<h2>${T.qrTitle}</h2><p class="muted">${T.qrSub}</p><div class="qr" id="qr-box"></div><div class="link">${linkOf(g)}</div><div class="row"><button class="btn primary" data-close>${T.close}</button></div>`);
    if(window.QRCode)new QRCode(m.querySelector('#qr-box'),{text:linkOf(g),width:200,height:200,colorDark:'#182c29',colorLight:'#ffffff'});else m.querySelector('#qr-box').textContent=linkOf(g)}
  if(a==='create'){const name=document.getElementById('g-name').value.trim();if(!name){document.getElementById('g-name').focus();return}
    const code=Math.random().toString(36).slice(2,8).toUpperCase();const ng={id:'g'+Date.now(),name,subject:document.getElementById('g-subj').value,code,days:+document.getElementById('g-days').value,created:Date.now(),n:0,seed:Date.now()%997};
    S.groups.unshift(ng);save();render();toast(T.created)}
  if(a==='export'){const gr=S.groups.find(x=>x.id===cur);const st=studentsOf(gr);
    if(inTg){toast(T.exportTg);return}
    const rows=[[T.thName,T.thSteps,T.thHints,T.thInd,T.tStuck]].concat(st.map(s=>[s.name,s.done+'/4',s.hints,s.ind==='first'?T.indFirst:s.ind==='later'?T.indLater:T.indNone,s.stuck?'!':'']));
    const csv='﻿'+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const l=document.createElement('a');l.href=url;l.download=`${gr.name}-progress.csv`;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  if(a==='write'||a==='reply')toast(T.replyMsg);
  if(a==='resolve'){const h=S.help.find(x=>x.id===+b.dataset.h);if(h){h.done=true;save();render()}}
  if(a==='draft')modal(draftHtml(b.dataset.s,+b.dataset.i));
  if(a==='gen'){const s=b.dataset.s,i=+b.dataset.i;S.plan[s][i]='gen';render();setTimeout(()=>{S.plan[s][i]='draft';save();if(tab==='plan')render();toast(T.genDone)},1600)}
  if(a==='approve'){S.plan[b.dataset.s][+b.dataset.i]='approved';save();closeModal();render();toast(T.approvedMsg)}
  if(a==='rework'){closeModal();toast(T.reworkMsg)}
  if(a==='assign'){const gr=S.groups.find(x=>x.id===cur);const sel=document.getElementById('t-topic');if(!sel)return;S.tasks.unshift({group:gr.id,topic:+sel.value,subject:gr.subject,deadline:document.getElementById('t-date').value||addDays(7),done:0});save();render();toast(T.assigned)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
render();
})();
