// Согласие на обработку персональных данных — демо-экран для показа заказчику.
// Тексты — ЧЕРНОВИК (docs/consent-draft.md): утверждает или возвращает на доработку заказчик.
// В прототипе ничего не отправляется: в браузере запоминается только факт, что экран пройден.
// В сервисе согласие пишет сервер в таблицу consents (#5); согласие родителя оформляет колледж (бланк), куратор отмечает в кабинете.
'use strict';
(function(){
  const SEEN_KEY='my-college-consent-demo';
  const DOC_VERSION='draft-2026-10';
  const T={
    ru:{
      badge:'Черновик · на утверждение заказчика',
      title:'Согласие на обработку данных',
      intro:'Прежде чем начать, прочитай, какие данные собирает «Мой колледж» и зачем.',
      age:'Сколько тебе лет?', adult:'Мне 18 или больше', minor:'Мне меньше 18',
      minorNote:'Нужно согласие родителя или законного представителя. Его оформляет колледж: родитель подписывает бланк, куратор отмечает это в сервисе. Можешь показать родителю этот текст.',
      checkAdult:'Я прочитал(а) и даю согласие',
      minorOk:'Понятно: родитель подписывает согласие в колледже. Пока можно заниматься в демо — прогресс не сохраняется.',
      minorGo:'Понятно — в демо',
      go:'Продолжить', back:'← Назад', later:'Не сейчас — посмотреть демо',
      laterNote:'Без согласия результаты не сохраняются. В демо можно смотреть уроки.',
      demoNote:'Демо: данные никуда не отправляются.',
      link:'Согласие на обработку данных',
      adultText:[
        'Я, пользователь учебного сервиса «Мой колледж» (далее — Сервис), в соответствии с Законом Республики Казахстан от 21 мая 2013 года № 94-V «О персональных данных и их защите» даю согласие [наименование колледжа] (далее — Оператор) на сбор и обработку моих персональных данных на следующих условиях.',
        '1. Какие данные: фамилия, имя, отчество; дата (или год) рождения; идентификатор Telegram; учебная группа; язык обучения; результаты учебной работы в Сервисе (ответы, попытки, подсказки, прогресс); обращения к преподавателю.',
        '2. Зачем: организация обучения, учёт учебного прогресса, обратная связь от преподавателя, улучшение учебных материалов.',
        '3. Что с ними делают: сбор, запись, хранение, уточнение, использование, обезличивание и удаление. Доступ к данным есть у преподавателей моей группы и администраторов Сервиса.',
        '4. AI-тьютор: в сервис подсказок передаются только текст вопроса и учебный материал — без ФИО, идентификатора Telegram и других персональных данных.',
        '5. Личные результаты не публикуются в общих каналах колледжа.',
        '6. Срок: на время обучения и [срок] после его окончания, затем данные удаляются или обезличиваются.',
        '7. Отзыв: я могу отозвать согласие, обратившись к куратору группы или в колледж. После отзыва данные удаляются, кроме случаев, предусмотренных законом.'
      ],
      minor3:'3. Что с ними делают: сбор, запись, хранение, уточнение, использование, обезличивание и удаление. Доступ к данным есть у преподавателей группы моего ребёнка и администраторов Сервиса.',
      minorLead:'Я, родитель (законный представитель) обучающегося, в соответствии с Законом Республики Казахстан от 21 мая 2013 года № 94-V «О персональных данных и их защите» даю согласие [наименование колледжа] (далее — Оператор) на сбор и обработку персональных данных моего ребёнка в учебном сервисе «Мой колледж» на следующих условиях.'
    },
    kk:{
      badge:'Жоба · тапсырыс берушінің бекітуіне',
      title:'Деректерді өңдеуге келісім',
      intro:'Бастамас бұрын «Менің колледжім» қандай деректер жинайтынын және не үшін екенін оқы.',
      age:'Жасың нешеде?', adult:'Маған 18 немесе одан көп', minor:'Маған 18-ге толмаған',
      minorNote:'Ата-анаңның немесе заңды өкіліңнің келісімі керек. Оны колледж ресімдейді: ата-анаң бланкке қол қояды, куратор мұны сервисте белгілейді. Бұл мәтінді ата-анаңа көрсете аласың.',
      checkAdult:'Оқыдым және келісім беремін',
      minorOk:'Түсінікті: ата-анам келісімге колледжде қол қояды. Әзірге демода оқуға болады — прогресс сақталмайды.',
      minorGo:'Түсінікті — демоға',
      go:'Жалғастыру', back:'← Артқа', later:'Қазір емес — демоны көру',
      laterNote:'Келісімсіз нәтижелер сақталмайды. Демода сабақтарды көруге болады.',
      demoNote:'Демо: деректер ешқайда жіберілмейді.',
      link:'Деректерді өңдеуге келісім',
      adultText:[
        'Мен, «Менің колледжім» оқу сервисінің (бұдан әрі — Сервис) пайдаланушысы, «Дербес деректер және оларды қорғау туралы» Қазақстан Республикасының 2013 жылғы 21 мамырдағы № 94-V Заңына сәйкес [колледждің атауы] (бұдан әрі — Оператор) менің дербес деректерімді мына шарттармен жинауына және өңдеуіне келісім беремін.',
        '1. Қандай деректер: тегі, аты, әкесінің аты; туған күні (немесе жылы); Telegram идентификаторы; оқу тобы; оқыту тілі; Сервистегі оқу жұмысының нәтижелері (жауаптар, талпыныстар, кеңестер, прогресс); оқытушыға өтініштер.',
        '2. Не үшін: оқуды ұйымдастыру, оқу прогресін есепке алу, оқытушының кері байланысы, оқу материалдарын жақсарту.',
        '3. Олармен не істейді: жинау, жазу, сақтау, нақтылау, пайдалану, иесіздендіру және жою. Деректерге менің тобымның оқытушылары мен Сервис әкімшілерінің қолжетімділігі бар.',
        '4. AI-тьютор: кеңес беру сервисіне тек сұрақтың мәтіні мен оқу материалы жіберіледі — аты-жөнсіз, Telegram идентификаторынсыз және басқа дербес деректерсіз.',
        '5. Жеке нәтижелер колледждің ортақ арналарында жарияланбайды.',
        '6. Мерзімі: оқу кезеңінде және ол аяқталғаннан кейін [мерзім] бойы, содан кейін деректер жойылады немесе иесіздендіріледі.',
        '7. Кері қайтарып алу: мен топ кураторына немесе колледжге жүгініп, келісімді кері қайтарып ала аламын. Кері қайтарылғаннан кейін деректер жойылады, заңда көзделген жағдайлардан басқа.'
      ],
      minor3:'3. Олармен не істейді: жинау, жазу, сақтау, нақтылау, пайдалану, иесіздендіру және жою. Деректерге баламның тобының оқытушылары мен Сервис әкімшілерінің қолжетімділігі бар.',
      minorLead:'Мен, білім алушының ата-анасы (заңды өкілі), «Дербес деректер және оларды қорғау туралы» Қазақстан Республикасының 2013 жылғы 21 мамырдағы № 94-V Заңына сәйкес [колледждің атауы] (бұдан әрі — Оператор) «Менің колледжім» оқу сервисінде баламның дербес деректерін мына шарттармен жинауына және өңдеуіне келісім беремін.'
    }
  };
  const L=()=>T[document.documentElement.lang==='kk'?'kk':'ru'];
  const seen=()=>{try{return localStorage.getItem(SEEN_KEY)===DOC_VERSION}catch(e){return false}};
  const markSeen=()=>{try{localStorage.setItem(SEEN_KEY,DOC_VERSION)}catch(e){}};
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const box=document.createElement('div');
  box.className='modal-backdrop hidden consent-backdrop';
  document.body.appendChild(box);
  const style=document.createElement('style');
  style.textContent='.consent-backdrop{z-index:30}.consent{max-width:560px;max-height:calc(100vh - 40px);overflow:auto}.consent-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.3px;color:#8c491f;background:#fff1e6;border-radius:6px;padding:4px 8px;margin-bottom:12px}html[data-theme=dark] .consent-badge{background:#3a2518;color:#f2b48c}.consent-text{font-size:13px;line-height:1.55;max-height:38vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:12px 0}.consent-text p{margin:0 0 8px}.consent-note{font-size:12px;color:var(--muted)}.consent-check{display:flex;gap:10px;align-items:flex-start;font-size:13px;margin:10px 0}.consent-check input{margin-top:3px}.consent .actions .btn[disabled]{opacity:.45}.consent-link{background:none;border:0;padding:0;color:var(--muted);font-size:11px;text-decoration:underline;cursor:pointer}';
  document.head.appendChild(style);

  function show(step,who){
    const t=L();
    let body='';
    if(step==='age'){
      body=`<p>${t.intro}</p><h3>${t.age}</h3><div class="actions"><button type="button" class="btn primary" data-consent="adult">${t.adult}</button><button type="button" class="btn secondary" data-consent="minor">${t.minor}</button></div><div class="actions"><button type="button" class="btn plain" data-consent="later">${t.later}</button></div>`;
    }else{
      const paras=(who==='minor'?t.adultText.map((p,i)=>i===0?t.minorLead:i===3?t.minor3:p):t.adultText).map(p=>`<p>${esc(p)}</p>`).join('');
      body=`${who==='minor'?`<p class="consent-note">${t.minorNote}</p>`:''}<div class="consent-text" tabindex="0">${paras}</div>${who==='minor'?`<p class="consent-check">${t.minorOk}</p><div class="actions"><button type="button" class="btn secondary" data-consent="back">${t.back}</button><button type="button" class="btn primary" data-consent="later">${t.minorGo}</button></div>`:`<label class="consent-check"><input type="checkbox" id="consent-ok"> <span>${t.checkAdult}</span></label><div class="actions"><button type="button" class="btn secondary" data-consent="back">${t.back}</button><button type="button" class="btn primary" data-consent="agree" disabled>${t.go}</button></div>`}<p class="consent-note">${t.demoNote}</p>`;
    }
    box.innerHTML=`<section class="modal consent" role="dialog" aria-modal="true" aria-labelledby="consent-title"><span class="consent-badge">${t.badge}</span><h2 id="consent-title">${t.title}</h2>${body}</section>`;
    box.classList.remove('hidden');
    const first=box.querySelector('button,input');first&&first.focus();
  }
  function close(){box.classList.add('hidden');box.innerHTML=''}

  box.addEventListener('change',e=>{if(e.target.id==='consent-ok')box.querySelector('[data-consent=agree]').disabled=!e.target.checked});
  box.addEventListener('click',e=>{
    const b=e.target.closest('[data-consent]');if(!b)return;
    e.stopPropagation();
    const a=b.dataset.consent;
    if(a==='adult'||a==='minor')show('text',a);
    if(a==='back')show('age');
    if(a==='agree'){markSeen();close()}
    if(a==='later'){markSeen();close();if(typeof toast==='function')toast(L().laterNote)}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.classList.contains('hidden')&&box.querySelector('[data-consent=later]')){markSeen();close()}});

  // Ссылка в подвале — открыть текст ещё раз
  const footer=document.querySelector('.footer');
  if(footer){const a=document.createElement('button');a.type='button';a.className='consent-link';a.textContent=L().link;a.addEventListener('click',()=>show('age'));footer.appendChild(a)}

  if(!seen())show('age');
})();
