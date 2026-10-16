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

// Вкладка «Студенты»: список группы ведёт куратор (docs/decisions.md, «Вход студента — личная ссылка от куратора»)
Object.assign(T,{ru:{
  tabRoster:'Студенты',
  groupsSub:'Создайте группу и внесите студентов — у каждого будет своя личная ссылка.',
  demoLink:'Общая ссылка группы — только для демо-показа. Реальные студенты входят по личным ссылкам (вкладка «Студенты»).',toRoster:'Студенты и ссылки →',
  rosterTitle:'Студенты группы',rosterSub:'Список ведёт куратор: вносит студентов, отмечает согласия родителей и выдаёт каждому личную ссылку. Студент свои данные не вводит и не меняет.',
  uploadList:'Загрузить список',uploadListHint:'Excel или CSV: ФИО, дата рождения',listUploaded:f=>`Список «${f}» загружен. В демо показан пример группы.`,
  rTotal:'студентов',rIn:'вошли',rMinor:'младше 18',rWait:'ждём согласие родителя',
  rf:{all:'Все',wait:'Ждём согласие',out:'Не вошли',err:'Ошибки в данных'},
  age:n=>`${n} ${plural(n,['год','года','лет'])}`,refN:n=>`личное дело № ${n}`,
  consentOk:r=>`Согласие родителя · ${r}`,consentWait:'Ждём бланк родителя',demoOnly:'Демо: прогресс не сохраняется',
  entered:a=>`Вход: ${a}`,linkFree:'Ссылка не использована',
  markConsent:'Отметить согласие',edit:'Исправить',newLink:'Новая ссылка',sqr:'QR',errMsg:'Студент сообщил об ошибке в ФИО',
  seqBtn:'QR по очереди — для пары',seqTitle:'Личные ссылки по очереди',seqSub:'Покажите на экране: студент сканирует свой QR. Следующий — кнопкой «Дальше».',seqEmpty:'Все студенты уже вошли.',prev:'← Назад',next:'Дальше →',seqOf:(a,b)=>`${a} из ${b}`,
  sqrSub:'Личная ссылка — покажите только этому студенту. После входа она ни для кого больше не работает.',
  reissued:'Старая ссылка отключена. Новая готова — скопируйте или покажите QR.',
  cTitle:'Согласие родителя',cSub:n=>`Студент: ${n}. Родитель подписывает бланк в колледже — здесь только отметка.`,cParent:'ФИО родителя (законного представителя)',cRef:'Где лежит бланк',cRefPh:'Например, личное дело № 12',cCheck:'Бланк подписан родителем и хранится в колледже',cNote:'Сканы и фото бланка в сервис не загружаем.',save:'Сохранить',cSaved:'Согласие отмечено — прогресс студента теперь сохраняется.',cNeed:'Укажите, где лежит бланк, и подтвердите галочкой.',
  eTitle:'Данные студента',eName:'ФИО',eBirth:'Дата рождения',eSaved:'Данные исправлены.',
  addTitle:'Добавить студента',add:'Добавить',added:'Студент добавлен — личная ссылка готова.',noRoster:'В группе пока нет студентов — загрузите список или добавьте вручную.',
  live:'Настоящие данные — из базы колледжа',linkHint:'Как студент входит: дайте ему его личную ссылку (в личные сообщения) или покажите его QR на паре. Если он просто откроет бота — попадёт в демо без сохранения.',helpOpen:n=>`Просит помощи: ${n} — см. «Обращения»`,linkedTag:'Вошёл в приложение',yearBorn:y=>`${y} г. р.`,unlink:'Отвязать Telegram',unlinkTitle:'Отвязать Telegram?',unlinkSub:n=>`${n}: если по ссылке вошёл не сам студент. Согласие на обработку данных отзывается, прогресс остаётся. Затем выдайте новую ссылку.`,unlinkDone:'Telegram отвязан. Выдайте студенту новую ссылку.',noLink:'Ссылки нет — выдайте новую',errGeneric:'Не получилось. Попробуйте ещё раз.',needParent:'Укажите ФИО родителя и где лежит бланк, подтвердите галочкой.',noGroups:'Вас пока не добавили ни в одну группу. Обратитесь к администратору колледжа.',listSoon:'Загрузка списка файлом — скоро. Пока добавляйте студентов по одному.',loading:'Загружаю…',
  impTitle:'Список группы',impPaste:'Вставить списком',impFile:'Загрузить файл',impPasteHint:'По одному студенту в строке: ФИО и дата рождения (или год). Можно скопировать столбцы прямо из Excel.',impPh:'Иванова Анна Сергеевна 05.03.2009\nСейткалиев Әлихан 2006\n…',impParse:'Разобрать',impDrop:'Перетащите файл сюда или нажмите, чтобы выбрать',impFormats:'Excel (.xlsx, .xls), CSV, .txt или Word (.docx) с таблицей. Первая строка может быть заголовком: «ФИО», «Дата рождения».',impReading:'Читаю файл…',impEmpty:'Не нашла в списке ни одного студента. Проверьте формат.',impCheck:'Проверьте и при необходимости исправьте',impName:'ФИО',impBirth:'Дата или год рождения',impBirthPh:'дд.мм.гггг или год',impAddRow:'+ Строка',impBack:'← Назад',impSave:n=>`Добавить ${n} ${plural(n,['студента','студента','студентов'])}`,impOk:'Готово',impErrName:'ФИО: фамилия и имя',impErrBirth:'Нужна дата или год',impDupe:'Повтор',impExists:'Уже в группе',impDone:n=>`Добавлено: ${n}. У каждого — личная ссылка.`,dupTitle:'Такой студент уже есть',dupYes:'Добавить тёзку',impFixed:n=>`Исправьте строки с ошибками: ${n}`
},kk:{
  tabRoster:'Студенттер',
  groupsSub:'Топ құрып, студенттерді енгізіңіз — әрқайсысының жеке сілтемесі болады.',
  demoLink:'Топтың ортақ сілтемесі — тек демо-көрсетілім үшін. Нақты студенттер жеке сілтемелер арқылы кіреді («Студенттер» қойындысы).',toRoster:'Студенттер мен сілтемелер →',
  rosterTitle:'Топ студенттері',rosterSub:'Тізімді куратор жүргізеді: студенттерді енгізеді, ата-ана келісімдерін белгілейді және әрқайсысына жеке сілтеме береді. Студент өз деректерін енгізбейді және өзгертпейді.',
  uploadList:'Тізімді жүктеу',uploadListHint:'Excel немесе CSV: аты-жөні, туған күні',listUploaded:f=>`«${f}» тізімі жүктелді. Демода топ мысалы көрсетілген.`,
  rTotal:'студент',rIn:'кірді',rMinor:'18-ге толмаған',rWait:'ата-ана келісімі күтілуде',
  rf:{all:'Барлығы',wait:'Келісім күтілуде',out:'Кірмегендер',err:'Деректердегі қателер'},
  age:n=>`${n} жаста`,refN:n=>`жеке іс № ${n}`,
  consentOk:r=>`Ата-ана келісімі · ${r}`,consentWait:'Ата-ана бланкі күтілуде',demoOnly:'Демо: прогресс сақталмайды',
  entered:a=>`Кірді: ${a}`,linkFree:'Сілтеме пайдаланылмаған',
  markConsent:'Келісімді белгілеу',edit:'Түзету',newLink:'Жаңа сілтеме',sqr:'QR',errMsg:'Студент аты-жөніндегі қате туралы хабарлады',
  seqBtn:'QR кезекпен — сабақта',seqTitle:'Жеке сілтемелер кезекпен',seqSub:'Экранда көрсетіңіз: студент өз QR-ын сканерлейді. Келесісі — «Әрі қарай» батырмасымен.',seqEmpty:'Барлық студент кірді.',prev:'← Артқа',next:'Әрі қарай →',seqOf:(a,b)=>`${a} / ${b}`,
  sqrSub:'Жеке сілтеме — тек осы студентке көрсетіңіз. Кіргеннен кейін ол басқа ешкімге жұмыс істемейді.',
  reissued:'Ескі сілтеме өшірілді. Жаңасы дайын — көшіріңіз немесе QR көрсетіңіз.',
  cTitle:'Ата-ана келісімі',cSub:n=>`Студент: ${n}. Ата-ана бланкке колледжде қол қояды — мұнда тек белгі.`,cParent:'Ата-ананың (заңды өкілдің) аты-жөні',cRef:'Бланк қайда сақталады',cRefPh:'Мысалы, жеке іс № 12',cCheck:'Бланкке ата-ана қол қойды және ол колледжде сақталады',cNote:'Бланктің сканы мен фотосын сервиске жүктемейміз.',save:'Сақтау',cSaved:'Келісім белгіленді — студенттің прогресі енді сақталады.',cNeed:'Бланк қайда екенін көрсетіп, белгімен растаңыз.',
  eTitle:'Студент деректері',eName:'Аты-жөні',eBirth:'Туған күні',eSaved:'Деректер түзетілді.',
  addTitle:'Студент қосу',add:'Қосу',added:'Студент қосылды — жеке сілтеме дайын.',noRoster:'Топта әзірге студент жоқ — тізімді жүктеңіз немесе қолмен қосыңыз.',
  live:'Нақты деректер — колледж базасынан',linkHint:'Студент қалай кіреді: оған жеке сілтемесін (жеке хабарламаға) беріңіз немесе сабақта оның QR-ын көрсетіңіз. Ботты жай ғана ашса — сақтаусыз демоға түседі.',helpOpen:n=>`Көмек сұрайды: ${n} — «Өтініштер» бөлімін қараңыз`,linkedTag:'Қосымшаға кірді',yearBorn:y=>`${y} ж. т.`,unlink:'Telegram-ды ажырату',unlinkTitle:'Telegram-ды ажырату керек пе?',unlinkSub:n=>`${n}: егер сілтеме арқылы студенттің өзі кірмесе. Деректерді өңдеуге келісім кері қайтарылады, прогресс сақталады. Содан кейін жаңа сілтеме беріңіз.`,unlinkDone:'Telegram ажыратылды. Студентке жаңа сілтеме беріңіз.',noLink:'Сілтеме жоқ — жаңасын беріңіз',errGeneric:'Болмады. Қайтадан көріңіз.',needParent:'Ата-ананың аты-жөнін және бланк қайда екенін көрсетіп, белгімен растаңыз.',noGroups:'Сізді әзірге ешбір топқа қоспаған. Колледж әкімшісіне жүгініңіз.',listSoon:'Тізімді файлмен жүктеу — жақында. Әзірге студенттерді бір-бірлеп қосыңыз.',loading:'Жүктеп жатырмын…',
  impTitle:'Топ тізімі',impPaste:'Тізіммен қою',impFile:'Файл жүктеу',impPasteHint:'Әр жолда бір студент: аты-жөні және туған күні (немесе жылы). Excel-ден бағандарды тікелей көшіруге болады.',impPh:'Иванова Анна Сергеевна 05.03.2009\nСейткалиев Әлихан 2006\n…',impParse:'Талдау',impDrop:'Файлды осында сүйреңіз немесе таңдау үшін басыңыз',impFormats:'Excel (.xlsx, .xls), CSV, .txt немесе кестесі бар Word (.docx). Бірінші жол тақырып болуы мүмкін: «Аты-жөні», «Туған күні».',impReading:'Файлды оқып жатырмын…',impEmpty:'Тізімнен бірде-бір студент табылмады. Форматты тексеріңіз.',impCheck:'Тексеріп, қажет болса түзетіңіз',impName:'Аты-жөні',impBirth:'Туған күні немесе жылы',impBirthPh:'кк.аа.жжжж немесе жыл',impAddRow:'+ Жол',impBack:'← Артқа',impSave:n=>`${n} студент қосу`,impOk:'Дұрыс',impErrName:'Тегі мен аты',impErrBirth:'Күні немесе жылы керек',impDupe:'Қайталанады',impExists:'Топта бар',impDone:n=>`Қосылды: ${n}. Әрқайсысының жеке сілтемесі бар.`,dupTitle:'Мұндай студент бар',dupYes:'Аттасын қосу',impFixed:n=>`Қатесі бар жолдарды түзетіңіз: ${n}`
}}[lang]);
T.tabs=Object.assign({groups:T.tabs.groups,roster:T.tabRoster},T.tabs);

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

function renderTabs(){const H=LIVE&&LIVE.help&&LIVE.help[LIVE.gid];const open=LIVE?(Array.isArray(H)?H.filter(h=>h.status==='new').length:0):S.help.filter(h=>!h.done).length;
  document.getElementById('tabs').innerHTML=Object.entries(T.tabs).map(([k,v])=>`<button type="button" data-tab="${k}" class="${k===tab?'active':''}">${v}${k==='help'&&open?`<span class="count">${open}</span>`:''}</button>`).join('')}
document.getElementById('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;if(tab==='progress'&&LIVE&&LIVE.gid&&LIVE.pr[LIVE.gid]!=='loading')delete LIVE.pr[LIVE.gid];if(tab==='help'&&LIVE&&LIVE.gid&&LIVE.help[LIVE.gid]!=='loading')delete LIVE.help[LIVE.gid];render();window.scrollTo({top:0})}});
function groupSelect(){return `<select class="i" id="grp" aria-label="${T.group}">${S.groups.map(g=>`<option value="${g.id}" ${g.id===cur?'selected':''}>${esc(g.name)} · ${T.subjects[g.subject]}</option>`).join('')}</select>`}
function render(){renderTabs();document.getElementById('view').innerHTML=({groups,roster,progress,plan,tasks,help})[tab]()+(LIVE&&(tab==='roster'||tab==='progress'||tab==='help')?'':`<p class="note">${T.demoNote}</p>`)}

// ── Экраны ──────────────────────────────────────────────────
function groups(){const till=g=>fmtDate(g.created+g.days*864e5);
  return `<h1>${T.groupsTitle}</h1><p class="sub">${T.groupsSub}</p>
  ${S.groups.map(g=>`<div class="card"><div class="row"><div class="grow"><b style="font-size:17px">${esc(g.name)}</b> <span class="tag t-violet">${T.subjects[g.subject]}</span><div class="muted">${T.students(g.n)} · ${T.linkTill(till(g))}</div></div><button class="btn secondary" data-act="toRoster" data-g="${g.id}">${T.toRoster}</button></div>
    <div class="muted" style="margin-top:10px">${T.demoLink}</div><div class="link">${linkOf(g)}</div>
    <div class="row"><button class="btn primary" data-act="share" data-g="${g.id}">${T.share}</button><button class="btn secondary" data-act="copy" data-g="${g.id}">${T.copy}</button><button class="btn secondary" data-act="qr" data-g="${g.id}">${T.qr}</button></div></div>`).join('')}
  <div class="card"><b>${T.newGroup}</b><div class="form">
    <div><label class="f" for="g-name">${T.gName}</label><input class="i" id="g-name" placeholder="${T.gNamePh}" maxlength="24"></div>
    <div><label class="f" for="g-subj">${T.gSubject}</label><select class="i" id="g-subj">${Object.entries(T.subjects).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
    <div><label class="f" for="g-days">${T.gDays}</label><select class="i" id="g-days">${[7,14,30].map(d=>`<option value="${d}" ${d===14?'selected':''}>${T.days(d)}</option>`).join('')}</select></div>
    <button class="btn lime" data-act="create">${T.create}</button></div></div>`}

function progress(){if(LIVE)return liveProgress();const g=S.groups.find(x=>x.id===cur)||S.groups[0];if(!g)return '';const st=studentsOf(g),n=st.length;
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

function help(){if(LIVE)return liveHelp();const open=S.help.filter(h=>!h.done),done=S.help.filter(h=>h.done);
  const card=h=>{const gr=S.groups.find(x=>x.id===h.group)||{name:'',subject:'python'};const sk=(SKILLS[gr.subject]||SKILLS.python)[lang];
    return `<div class="card" style="${h.done?'opacity:.6':''}"><div class="row"><div class="grow"><b>${esc(h.student)}</b> <span class="muted">· ${esc(gr.name)} · ${T.ago(h.h)}</span><div class="muted">${esc(topicName(gr.subject,h.topic))} · ${esc(sk[h.step])}</div></div>${h.done?`<span class="tag t-ok">${T.resolved}</span>`:''}</div><p style="margin:10px 0">«${esc(h.text[lang])}»</p>${h.done?'':`<div class="row"><button class="btn primary" data-act="reply">${T.reply}</button><button class="btn secondary" data-act="resolve" data-h="${h.id}">${T.resolve}</button></div>`}</div>`};
  return `<h1>${T.helpTitle}</h1><p class="sub">${T.helpSub}</p>${open.length?open.map(card).join(''):`<div class="card muted">${T.noHelp}</div>`}${done.map(card).join('')}`}


// ── Студенты группы (вносит куратор) ───────────────────────
const SUR={'А.':'Абенов','Б.':'Бекмуратов','В.':'Васильев','Ж.':'Жумабаев','Е.':'Ермеков','К.':'Калиев','М.':'Мусин','Н.':'Нургалиев','О.':'Омаров','С.':'Сейткалиев','Т.':'Тулегенов','Ш.':'Шаймерденов'};
const FEM=new Set(['Айгерим','Алия','Мадина','Дана','Камила','Аружан','Жанель','Асель','Диана','Томирис','Сабина','Карина','Виктория']);
const CH='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function newCode(r){r=r||Math.random;let c='';for(let k=0;k<16;k++)c+=CH[Math.floor(r()*CH.length)];return c}
const isoDate=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function rosterOf(g){S.roster=S.roster||{};if(S.roster[g.id])return S.roster[g.id];
  const r=rng((g.seed||7)*31+5);
  const list=studentsOf(g).map((st,i)=>{const [first,ini]=st.name.split(' ');const sur=(SUR[ini]||'Ахметов')+(FEM.has(first)?'а':'');
    const age=[15,16,16,17,17,17,18,18,19][Math.floor(r()*9)];const b=new Date();b.setFullYear(b.getFullYear()-age);b.setDate(b.getDate()-1-Math.floor(r()*360));
    return {id:g.id+'-'+i,name:sur+' '+first,birth:isoDate(b),consent:age<18&&r()<.7?{n:10+i}:null,code:newCode(r),used:i%6===3?null:st.last,err:i===4}});
  return S.roster[g.id]=list}
const ageOf=b=>{const d=new Date(b),n=new Date();let a=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return a};
const fmtBirth=b=>b.split('-').reverse().join('.');
const personalLink=s=>`https://t.me/${BOT}?startapp=i_${s.code}`;
let rf='all',seq=0;
// Живой режим: куратор, заведённый в базе, открыл кабинет в Telegram → «Студенты» работают с API (#9).
// Иначе (браузер, демо-ссылка, не куратор) — демо-данные, как раньше.
let LIVE=null;
function api(method,path,body){return fetch('/api'+path,{method,headers:{'x-telegram-init-data':tg.initData,'content-type':'application/json'},body:body?JSON.stringify(body):undefined})
  .then(r=>r.json().catch(()=>({})).then(j=>{if(!r.ok)throw Object.assign(new Error(j.message||T.errGeneric),{status:r.status,body:j});return j}))}
const fromApi=x=>({id:x.id,name:x.full_name||'—',birth:x.birth_date,year:x.birth_year,minor:x.minor,consent:x.parental?{ref:x.parental.document_ref}:null,
  code:x.invite&&!x.invite.expired?x.invite.token.replace(/^i_/,''):null,used:x.linked?0:null,err:x.name_errors>0,help:x.open_help||0,live:true});
function loadLive(){return api('GET','/curator/students?group_id='+encodeURIComponent(LIVE.gid)).then(r=>{LIVE.st[LIVE.gid]=r.students.map(fromApi)})}
function liveDo(p,msg){return p.then(r=>{const x=r.student;if(x){const L=LIVE.st[LIVE.gid],i=L.findIndex(s=>s.id===x.id),v=fromApi(x);if(i<0)L.push(v);else L[i]=v}closeModal();render();if(msg)toast(msg);return r}).catch(e=>toast(e.message||T.errGeneric))}
if(inTg){api('GET','/curator/groups').then(r=>{LIVE={groups:r.groups||[],gid:(r.groups&&r.groups[0]||{}).id,st:{},pr:{},help:{}};if(LIVE.gid)loadHelp(LIVE.gid); // счётчик на вкладке
  const badge=document.querySelector('.demo-badge');if(badge)badge.hidden=true; // данные настоящие — не «Демо»
  if(LIVE.gid)return loadLive().then(()=>{tab='roster';render()});tab='roster';render()}).catch(()=>{})}
// ── Обращения на настоящих данных (GET/PATCH /api/curator/help) ──
const TH={ru:{nameErr:'Ошибка в ФИО',help:'Нужна помощь',lesson:'Урок',done:'Решено',undo:'Вернуть',showAll:'Показать решённые',hideAll:'Скрыть решённые',
  sub:'Студенты нажали «Нужна помощь» в уроке или сообщили об ошибке в ФИО. Ошибку в ФИО исправьте во вкладке «Студенты» — обращение закроется само.',
  write:'Написать в Telegram — скоро; пока ответьте студенту лично или на паре.'},
 kk:{nameErr:'Аты-жөндегі қате',help:'Көмек керек',lesson:'Сабақ',done:'Шешілді',undo:'Қайтару',showAll:'Шешілгендерді көрсету',hideAll:'Шешілгендерді жасыру',
  sub:'Студенттер сабақта «Көмек керек» батырмасын басты немесе аты-жөндегі қате туралы хабарлады. Аты-жөндегі қатені «Студенттер» бөлімінде түзетіңіз — өтініш өзі жабылады.',
  write:'Telegram-ға жазу — жақында; әзірге студентке жеке немесе сабақта жауап беріңіз.'}}[lang];
let HELP_ALL=false;
function loadHelp(gid){LIVE.help[gid]='loading';api('GET','/curator/help?group_id='+encodeURIComponent(gid)+'&status=all')
  .then(r=>{LIVE.help[gid]=r.requests||[];if(LIVE.gid===gid)render()}).catch(e=>{LIVE.help[gid]='error';if(tab==='help'){render();toast(e.message||T.errGeneric)}})}
function liveHelp(){
  if(!LIVE.gid)return `<h1>${T.helpTitle}</h1><div class="card muted">${T.noGroups}</div>`;
  const sel=`<select class="i" id="lgrp" aria-label="${T.group}">${LIVE.groups.map(x=>`<option value="${x.id}" ${x.id===LIVE.gid?'selected':''}>${esc(x.title)}</option>`).join('')}</select>`;
  const head=`<h1>${T.helpTitle}</h1><p class="sub">${TH.sub}</p><div class="row" style="margin-bottom:10px"><div class="grow">${sel}</div></div><p><span class="tag t-ok">● ${T.live}</span></p>`;
  const H=LIVE.help[LIVE.gid];
  if(H===undefined)loadHelp(LIVE.gid);
  if(H==='error')return head+`<div class="card"><p class="muted">${T.errGeneric}</p><button class="btn secondary" data-act="lretry">${TP.retry}</button></div>`;
  if(!Array.isArray(H))return head+`<div class="card muted">${TP.loading}</div>`;
  const ago=t=>T.ago(Math.max(0,Math.round((Date.now()-Date.parse(t))/36e5)));
  const card=h=>`<div class="card" style="${h.status==='resolved'?'opacity:.6':''}"><div class="row"><div class="grow"><b>${esc(h.full_name||'—')}</b> <span class="muted">· ${ago(h.created_at)}</span>
    <div class="muted">${h.kind==='name_error'?`⚠ ${TH.nameErr}`:`🙋 ${TH.help}`}${h.lesson_title?` · ${TH.lesson}: ${esc(h.lesson_title)}`:''}</div></div>${h.status==='resolved'?`<span class="tag t-ok">${TH.done}</span>`:''}</div>
    <p style="margin:10px 0;white-space:pre-wrap">«${esc(h.text)}»</p><div class="row">${h.status==='new'?`<button class="btn primary" data-act="lhelp" data-h="${esc(h.id)}" data-st="resolved">${TH.done}</button>`:`<button class="btn plain" data-act="lhelp" data-h="${esc(h.id)}" data-st="new">${TH.undo}</button>`}</div></div>`;
  const open=H.filter(h=>h.status==='new'),done=H.filter(h=>h.status!=='new');
  return head+(open.length?open.map(card).join(''):`<div class="card muted">${T.noHelp}</div>`)+`<p class="muted">${TH.write}</p>`+
    (done.length?`<button class="btn plain" data-act="lhelpall">${HELP_ALL?TH.hideAll:TH.showAll} (${done.length})</button>${HELP_ALL?done.map(card).join(''):''}`:'')}

// ── Прогресс группы на настоящих данных (GET /api/curator/progress, docs/api.md п. 2) ──
const TP={ru:{started:'начали уроки',lessonsDone:'уроков пройдено',stuck:'застряли',students:'студентов',
  stuckTitle:'Кто застрял',stuckSub:'Урок не закончен, а попыток или подсказок уже много. Стоит написать или подойти на паре.',noStuck:'Никто не застрял — все движутся.',
  stuckWhy:(l,a,h)=>`«${l}» — ${a} ${plural(a,['попытка','попытки','попыток'])}, ${h} ${plural(h,['подсказка','подсказки','подсказок'])}`,
  lessonsTitle:'Уроки',lStarted:(k,n)=>`начали ${k} из ${n}`,lDone:k=>`прошли ${k}`,lFirst:(f,c)=>`самостоятельную с первой попытки: ${f} из ${c}`,
  tableTitle:'Студенты',thDone:'Уроки',thSteps:'Шаги',thHints:'Подсказки',thInd:'Самост. с 1-й попытки',thLast:'Активность',never:'не заходил(а)',
  demoTag:'демо — не сохраняется',loading:'Загружаем…',retry:'Повторить',noLessons:'Опубликованных уроков пока нет.',noStudents:'В группе пока нет студентов.',
  how:'Прогресс сохраняется только у студентов с согласием (а у младше 18 — с отметкой согласия родителя).'},
 kk:{started:'сабақты бастады',lessonsDone:'сабақ өтілді',stuck:'кептеліп қалды',students:'студент',
  stuckTitle:'Кім кептеліп қалды',stuckSub:'Сабақ аяқталмаған, ал әрекет немесе кеңес көп. Жазып немесе сабақта жақындаған жөн.',noStuck:'Ешкім кептелген жоқ — бәрі алға жылжып келеді.',
  stuckWhy:(l,a,h)=>`«${l}» — ${a} әрекет, ${h} кеңес`,
  lessonsTitle:'Сабақтар',lStarted:(k,n)=>`бастады: ${k}/${n}`,lDone:k=>`${k} өтті`,lFirst:(f,c)=>`өз бетінше есеп бірінші әрекеттен: ${f}/${c}`,
  tableTitle:'Студенттер',thDone:'Сабақтар',thSteps:'Қадамдар',thHints:'Кеңестер',thInd:'Өз бетінше 1-әрекеттен',thLast:'Белсенділік',never:'кірмеген',
  demoTag:'демо — сақталмайды',loading:'Жүктелуде…',retry:'Қайталау',noLessons:'Жарияланған сабақтар әзірге жоқ.',noStudents:'Топта әзірге студент жоқ.',
  how:'Прогресс тек келісімі бар студенттерде сақталады (18-ге толмағандарда — ата-ана келісімі белгіленгенде).'}}[lang];
// Уроки — только опубликованные и в порядке плана: берём из /api/lessons (куратору он отдаёт все с is_published, week, order; #55)
function loadProgress(gid){LIVE.pr[gid]='loading';
  Promise.all([api('GET','/curator/progress?group_id='+encodeURIComponent(gid)),api('GET','/lessons?lang='+lang).catch(()=>null)])
  .then(([r,ls])=>{if(ls&&Array.isArray(ls.lessons)){const pub=ls.lessons.filter(l=>l.is_published),ids=new Set(pub.map(l=>l.id));
      r.lessons=pub.map(l=>({...(r.lessons||[]).find(x=>x.id===l.id)||{},id:l.id,title:l.title,week:l.week,order:l.order,steps_total:l.steps_total}));
      (r.students||[]).forEach(s=>{for(const id of Object.keys(s.lessons||{}))if(!ids.has(id))delete s.lessons[id]})}
    LIVE.pr[gid]=r;if(tab==='progress'&&LIVE.gid===gid)render()}).catch(e=>{LIVE.pr[gid]='error';if(tab==='progress')render();toast(e.message||T.errGeneric)})}
function liveProgress(){
  if(!LIVE.gid)return `<h1>${T.progressTitle}</h1><div class="card muted">${T.noGroups}</div>`;
  const sel=`<select class="i" id="lgrp" aria-label="${T.group}">${LIVE.groups.map(x=>`<option value="${x.id}" ${x.id===LIVE.gid?'selected':''}>${esc(x.title)}</option>`).join('')}</select>`;
  const head=`<h1>${T.progressTitle}</h1><div class="row" style="margin-bottom:10px"><div class="grow">${sel}</div></div><p><span class="tag t-ok">● ${T.live}</span></p>`;
  const P=LIVE.pr[LIVE.gid];
  if(P===undefined){loadProgress(LIVE.gid)}
  if(P==='error')return head+`<div class="card"><p class="muted">${T.errGeneric}</p><button class="btn secondary" data-act="lretry">${TP.retry}</button></div>`;
  if(!P||P==='loading')return head+`<div class="card muted">${TP.loading}</div>`;
  const L=P.lessons||[],St=P.students||[],n=St.length;
  if(!n)return head+`<div class="card muted">${TP.noStudents}</div>`;
  if(!L.length)return head+`<div class="card muted">${TP.noLessons}</div>`;
  const title=id=>(L.find(l=>l.id===id)||{}).title||'—';
  const hoursAgo=t=>t?Math.max(0,Math.round((Date.now()-Date.parse(t))/36e5)):null;
  const rows=St.map(s=>{const ls=Object.entries(s.lessons||{});
    const done=ls.filter(([,x])=>x.completed_at).length,steps=ls.reduce((a,[,x])=>a+(x.completed_steps||0),0),hints=ls.reduce((a,[,x])=>a+(x.hints_used||0),0);
    const ind=ls.filter(([,x])=>x.independent&&x.independent.solved),first=ind.filter(([,x])=>x.independent.first_try).length;
    const last=ls.map(([,x])=>x.last_activity).filter(Boolean).sort().pop()||null;
    const stuck=ls.filter(([,x])=>!x.completed_at&&hoursAgo(x.last_activity)!==null&&hoursAgo(x.last_activity)<24*7&&((x.attempts||0)-(x.completed_steps||0)>=3||(x.hints_used||0)>=3))
      .map(([id,x])=>TP.stuckWhy(title(id),x.attempts||0,x.hints_used||0));
    return {s,started:ls.length>0,done,steps,hints,ind:ind.length,first,last,stuck}});
  const stuck=rows.filter(r=>r.stuck.length);
  const tiles=`<div class="tiles"><div class="tile"><b>${n}</b><span>${TP.students}</span></div><div class="tile"><b>${rows.filter(r=>r.started).length}</b><span>${TP.started}</span></div><div class="tile"><b>${rows.reduce((a,r)=>a+r.done,0)}</b><span>${TP.lessonsDone}</span></div><div class="tile ${stuck.length?'alert':''}"><b>${stuck.length}</b><span>${TP.stuck}</span></div></div>`;
  const stuckCard=`<div class="card"><b>${TP.stuckTitle}</b><div class="muted">${TP.stuckSub}</div>${stuck.length?stuck.map(r=>`<div class="topic"><span class="num">!</span><div class="grow"><b>${esc(r.s.full_name||'—')}</b>${r.stuck.map(w=>`<div class="muted">${esc(w)}</div>`).join('')}</div></div>`).join(''):`<div class="muted" style="margin-top:10px">${TP.noStuck}</div>`}</div>`;
  const lessonsCard=`<div class="card"><b>${TP.lessonsTitle}</b>${L.map(l=>{const xs=St.map(s=>(s.lessons||{})[l.id]).filter(Boolean),c=xs.filter(x=>x.completed_at).length,
      solved=xs.filter(x=>x.independent&&x.independent.solved),f=solved.filter(x=>x.independent.first_try).length,p=Math.round(100*xs.length/n);
      return `<div style="margin-top:12px"><div class="row"><span class="grow">${esc(l.title)}</span><b>${p}%</b></div><div class="bar ${p<40?'low':p<70?'mid':''}"><i style="width:${p}%"></i></div><div class="muted">${TP.lStarted(xs.length,n)} · ${TP.lDone(c)}${solved.length?` · ${TP.lFirst(f,solved.length)}`:''}</div></div>`}).join('')}</div>`;
  const table=`<div class="card"><b>${TP.tableTitle}</b><div class="table-wrap"><table><thead><tr><th>${T.thName}</th><th>${TP.thDone}</th><th>${TP.thSteps}</th><th>${TP.thHints}</th><th>${TP.thInd}</th><th>${TP.thLast}</th></tr></thead><tbody>
    ${rows.slice().sort((a,b)=>(b.stuck.length?1:0)-(a.stuck.length?1:0)||b.steps-a.steps).map(r=>`<tr class="${r.stuck.length?'stuck':''}"><td>${esc(r.s.full_name||'—')}${r.s.can_save_progress?'':`<div class="muted">${TP.demoTag}</div>`}</td><td>${r.done}/${L.length}</td><td>${r.steps}</td><td>${r.hints}</td><td>${r.ind?`${r.first}/${r.ind}`:'—'}</td><td class="muted">${r.last?T.ago(hoursAgo(r.last)):r.s.can_save_progress?TP.never:'—'}</td></tr>`).join('')}
    </tbody></table></div><p class="muted" style="margin-top:10px">${TP.how}</p></div>`;
  return head+tiles+stuckCard+lessonsCard+table}

const minorOf=s=>s.minor!==undefined&&s.minor!==null?s.minor:s.birth?ageOf(s.birth)<18:false;
const birthText=s=>s.birth?`${T.age(ageOf(s.birth))} · ${fmtBirth(s.birth)}`:s.year?T.yearBorn(s.year):'';
function roster(){if(LIVE&&!LIVE.gid)return `<h1>${T.rosterTitle}</h1><div class="card muted">${T.noGroups}</div>`;
  const g=LIVE?null:(S.groups.find(x=>x.id===cur)||S.groups[0]);if(!LIVE&&!g)return '';const R=LIVE?(LIVE.st[LIVE.gid]||[]):rosterOf(g);
  const minor=minorOf,wait=R.filter(s=>minor(s)&&!s.consent),inn=R.filter(s=>s.used!==null),errs=R.filter(s=>s.err);
  const shown=R.filter(s=>rf==='wait'?minor(s)&&!s.consent:rf==='out'?s.used===null:rf==='err'?s.err:true);
  const ref=c=>c.ref?esc(c.ref):T.refN(c.n);
  const row=s=>`<div class="topic" style="align-items:flex-start"><span class="num">${R.indexOf(s)+1}</span><div class="grow"><b>${esc(s.name)}</b><div class="muted">${birthText(s)}</div>
    <div class="row" style="gap:6px;margin-top:6px">${minor(s)?(s.consent?`<span class="tag t-ok">${T.consentOk(ref(s.consent))}</span>`:`<span class="tag t-draft">${T.consentWait}</span>`):`<span class="tag t-none">18+</span>`}
    ${s.used!==null?`<span class="tag t-ok">${s.live?T.linkedTag:T.entered(T.ago(s.used))}</span>`:s.code?`<span class="tag t-violet">${T.linkFree}</span>`:`<span class="tag t-draft">${T.noLink}</span>`}
    ${minor(s)&&!s.consent&&s.used!==null?`<span class="tag t-draft">${T.demoOnly}</span>`:''}${s.err?`<span class="tag t-draft">⚠ ${T.errMsg}</span>`:''}${s.help?`<span class="tag t-draft">🙋 ${T.helpOpen(s.help)}</span>`:''}</div>
    <div class="row" style="gap:6px;margin-top:8px">${minor(s)&&!s.consent?`<button class="btn primary" data-act="consent" data-s="${s.id}">${T.markConsent}</button>`:''}
    ${s.used===null&&s.code?`<button class="btn secondary" data-act="scopy" data-s="${s.id}">${T.copy}</button><button class="btn secondary" data-act="sqr" data-s="${s.id}">${T.sqr}</button>`:''}
    <button class="btn ${s.err?'secondary':'plain'}" data-act="edit" data-s="${s.id}">${T.edit}</button>${s.used!==null?`<button class="btn plain" data-act="unlink" data-s="${s.id}">${T.unlink}</button>`:`<button class="btn ${s.code?'plain':'primary'}" data-act="reissue" data-s="${s.id}">${T.newLink}</button>`}</div></div></div>`;
  const sel=LIVE?`<select class="i" id="lgrp" aria-label="${T.group}">${LIVE.groups.map(x=>`<option value="${x.id}" ${x.id===LIVE.gid?'selected':''}>${esc(x.title)}</option>`).join('')}</select>`:groupSelect();
  return `<h1>${T.rosterTitle}</h1><p class="sub">${T.rosterSub}</p>${LIVE?`<p><span class="tag t-ok">● ${T.live}</span></p><p class="muted" style="margin-top:6px">💡 ${T.linkHint}</p>`:''}
  <div class="card"><div class="row"><div class="grow">${sel}</div><button class="btn primary" data-act="import">${T.uploadList}</button></div><div class="muted" style="margin-top:6px">${T.impFormats}</div></div>
  ${R.length?`<div class="tiles"><div class="tile"><b>${R.length}</b><span>${T.rTotal}</span></div><div class="tile"><b>${inn.length}</b><span>${T.rIn}</span></div><div class="tile"><b>${R.filter(minor).length}</b><span>${T.rMinor}</span></div><div class="tile ${wait.length?'alert':''}"><b>${wait.length}</b><span>${T.rWait}</span></div></div>
  <nav style="margin:14px 0 4px;padding:0;flex-wrap:wrap">${Object.entries(T.rf).map(([k,v])=>`<button type="button" data-act="rf" data-f="${k}" class="${rf===k?'active':''}">${v}${k==='wait'&&wait.length?`<span class="count">${wait.length}</span>`:k==='err'&&errs.length?`<span class="count">${errs.length}</span>`:''}</button>`).join('')}</nav>
  <div class="card"><div class="row"><b class="grow">${T.tableTitle}</b><button class="btn lime" data-act="qrseq">${T.seqBtn}</button></div>${shown.map(row).join('')||`<div class="muted" style="padding:12px 0">—</div>`}</div>`:`<div class="card muted">${T.noRoster}</div>`}
  <div class="card"><b>${T.addTitle}</b><div class="form" style="grid-template-columns:2fr 1.2fr auto">
    <div><label class="f" for="s-name">${T.eName}</label><input class="i" id="s-name" maxlength="120"></div>
    <div><label class="f" for="s-birth">${T.eBirth}</label><input class="i" type="date" id="s-birth"></div>
    <button class="btn lime" data-act="sadd">${T.add}</button></div></div>`}
// ── Импорт списка группы: вставка или файл → таблица для правки → сохранить ──
let IMP=null,PENDING=null;
const birthStr=b=>!b?'':b.date?b.date.split('-').reverse().join('.'):String(b.year);
function impCheck(){if(!IMP)return;const have=new Set(curRoster().map(s=>(s.name||'').toLowerCase()+'|'+(s.year||(s.birth?+s.birth.slice(0,4):''))));const seen=new Set();
  IMP.rows.forEach(r=>{const b=RosterImport.parseBirth(r.birthText);r.birth=b;const y=b?(b.year||+b.date.slice(0,4)):'';const k=r.name.trim().toLowerCase()+'|'+y;
    r.err=!RosterImport.nameOk(r.name.trim().replace(/\s+/g,' '))?T.impErrName:!b?T.impErrBirth:have.has(k)?T.impExists:seen.has(k)?T.impDupe:(r.server||'');seen.add(k)})}
function impOpen(){IMP={mode:'paste',rows:null,text:''};impRender()}
function impRender(){if(!IMP)return;let body;
  if(!IMP.rows){body=`<div class="imp-tabs"><button type="button" data-act="impMode" data-m="paste" class="${IMP.mode==='paste'?'on':''}">${T.impPaste}</button><button type="button" data-act="impMode" data-m="file" class="${IMP.mode==='file'?'on':''}">${T.impFile}</button></div>`+
    (IMP.mode==='paste'?`<p class="muted">${T.impPasteHint}</p><textarea class="i" id="imp-text" placeholder="${T.impPh}">${esc(IMP.text)}</textarea><div class="row" style="margin-top:10px"><button class="btn primary" data-act="impParse">${T.impParse}</button><button class="btn plain" data-close>${T.close}</button></div>`
      :`<label class="drop" id="imp-drop"><input type="file" id="imp-file" accept=".xlsx,.xls,.ods,.csv,.txt,.docx" hidden><b>${T.impDrop}</b><div class="muted" style="margin-top:6px">${T.impFormats}</div></label><div class="row" style="margin-top:10px"><button class="btn plain" data-close>${T.close}</button></div>`)}
  else{impCheck();const bad=IMP.rows.filter(r=>r.err).length,n=IMP.rows.length;
    body=`<p class="muted">${T.impCheck}</p><div class="imp-scroll"><table class="imp-table"><thead><tr><th>#</th><th>${T.impName}</th><th style="width:160px">${T.impBirth}</th><th></th><th></th></tr></thead><tbody>${IMP.rows.map((r,i)=>`<tr class="${r.err?'bad':''}"><td class="muted">${i+1}</td><td><input class="${r.err&&r.err!==T.impErrBirth?'e':''}" data-imp="name" data-i="${i}" value="${esc(r.name)}"></td><td><input class="${r.err===T.impErrBirth?'e':''}" data-imp="birth" data-i="${i}" value="${esc(r.birthText)}" placeholder="${T.impBirthPh}"></td><td class="imp-st ${r.err?'bad':'ok'}">${r.err?'⚠ '+esc(r.err):'✓ '+T.impOk}</td><td><button class="x" data-act="impDel" data-i="${i}" aria-label="×">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div class="row"><button class="btn secondary" data-act="impAdd">${T.impAddRow}</button><span class="grow"></span><button class="btn plain" data-act="impBack">${T.impBack}</button><button class="btn primary" data-act="impSave" ${bad||!n?'disabled':''}>${bad?T.impFixed(bad):T.impSave(n)}</button></div>`}
  const m=modal(`<h2>${T.impTitle}</h2>${body}`);m.querySelector('.modal').classList.add('wide');
  const drop=m.querySelector('#imp-drop');if(drop){['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,()=>drop.classList.remove('over')));
    drop.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)impFile(f)})}}
function impSet(rows){if(!rows.length){toast(T.impEmpty);return}IMP.rows=rows.map(r=>({name:r.name,birthText:birthStr(r.birth)}));impRender()}
function impFile(f){toast(T.impReading);RosterImport.parseFile(f).then(impSet).catch(e=>toast(e.message))}
function impSave(){const rows=IMP.rows.map(r=>{const o={full_name:r.name.trim().replace(/\s+/g,' ')};if(r.birth.date)o.birth_date=r.birth.date;else o.birth_year=r.birth.year;return o});
  if(LIVE){api('POST','/curator/students/bulk',{group_id:LIVE.gid,students:rows}).then(r=>{(LIVE.st[LIVE.gid]=LIVE.st[LIVE.gid]||[]).push(...r.students.map(fromApi));IMP=null;closeModal();render();toast(T.impDone(r.created))})
    .catch(e=>{toast(e.message);if(e.body&&e.body.rows){e.body.rows.forEach(x=>{if(IMP.rows[x.index])IMP.rows[x.index].server=x.message});impRender()}});return}
  const g=S.groups.find(x=>x.id===cur)||S.groups[0];const R=rosterOf(g);
  rows.forEach((o,i)=>R.push({id:g.id+'-i'+Date.now()+i,name:o.full_name,birth:o.birth_date||null,year:o.birth_year||(o.birth_date?+o.birth_date.slice(0,4):null),consent:null,code:newCode(),used:null,err:false}));
  g.n=Math.max(g.n,R.length);save();IMP=null;closeModal();render();toast(T.impDone(rows.length))}
document.getElementById('modal').addEventListener('input',e=>{const t=e.target;if(!IMP||!IMP.rows||t.dataset.imp===undefined)return;const r=IMP.rows[+t.dataset.i];if(t.dataset.imp==='name')r.name=t.value;else r.birthText=t.value;r.server=''})
// Статусы строк обновляем на месте — без перерисовки, чтобы не сбивать курсор
function impStatus(){impCheck();const m=document.getElementById('modal');let bad=0;
  IMP.rows.forEach((r,i)=>{const tr=m.querySelector(`[data-i="${i}"][data-imp="name"]`);if(!tr)return;const row=tr.closest('tr');if(r.err)bad++;row.classList.toggle('bad',!!r.err);
    row.querySelector('[data-imp="name"]').classList.toggle('e',!!r.err&&r.err!==T.impErrBirth);row.querySelector('[data-imp="birth"]').classList.toggle('e',r.err===T.impErrBirth);
    const st=row.querySelector('.imp-st');st.className='imp-st '+(r.err?'bad':'ok');st.textContent=r.err?'⚠ '+r.err:'✓ '+T.impOk});
  const sv=m.querySelector('[data-act="impSave"]');if(sv){sv.disabled=!!bad||!IMP.rows.length;sv.textContent=bad?T.impFixed(bad):T.impSave(IMP.rows.length)}}
document.getElementById('modal').addEventListener('change',e=>{const t=e.target;if(t.id==='imp-file'&&t.files[0]){impFile(t.files[0]);return}if(IMP&&IMP.rows&&t.dataset.imp!==undefined)impStatus()})
const curRoster=()=>LIVE?(LIVE.st[LIVE.gid]||[]):rosterOf(S.groups.find(x=>x.id===cur)||S.groups[0]);
const findS=id=>curRoster().find(x=>x.id===id);
function qrInto(box,text){if(window.QRCode)new QRCode(box,{text,width:200,height:200,colorDark:'#182c29',colorLight:'#ffffff'});else box.textContent=text}
function copyText(l){(navigator.clipboard?navigator.clipboard.writeText(l):Promise.reject()).then(()=>toast(T.copied)).catch(()=>{const ta=document.createElement('textarea');ta.value=l;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast(T.copied)}catch(err){}ta.remove()})}
function showSeq(){const list=curRoster().filter(s=>s.used===null&&s.code);
  if(!list.length){modal(`<h2>${T.seqTitle}</h2><p class="muted">${T.seqEmpty}</p><div class="row"><button class="btn primary" data-close>${T.close}</button></div>`);return}
  seq=(seq+list.length)%list.length;const s=list[seq];
  const m=modal(`<h2>${T.seqTitle}</h2><p class="muted">${T.seqSub}</p><div style="text-align:center"><b style="font-size:20px">${esc(s.name)}</b><div class="muted">${T.seqOf(seq+1,list.length)}</div></div><div class="qr" id="qr-box"></div><div class="row" style="justify-content:space-between"><button class="btn secondary" data-act="seqPrev">${T.prev}</button><button class="btn plain" data-close>${T.close}</button><button class="btn primary" data-act="seqNext">${T.next}</button></div>`);
  qrInto(m.querySelector('#qr-box'),personalLink(s))}

// ── Действия ────────────────────────────────────────────────
document.getElementById('view').addEventListener('change',e=>{
  if(e.target.id==='grp'){cur=e.target.value;render()}
  if(e.target.id==='lgrp'){LIVE.gid=e.target.value;if(LIVE.help[LIVE.gid]===undefined)loadHelp(LIVE.gid);loadLive().then(render).catch(err=>{toast(err.message);render()})}
  if(e.target.id==='roster-file'&&e.target.files[0])toast(LIVE?T.listSoon:T.listUploaded(e.target.files[0].name));
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
  if(a==='lhelpall'){HELP_ALL=!HELP_ALL;render()}
  if(a==='lretry'){delete LIVE.pr[LIVE.gid];delete LIVE.help[LIVE.gid];render()}
  if(a==='lhelp'){b.disabled=true;api('PATCH','/curator/help/'+encodeURIComponent(b.dataset.h),{status:b.dataset.st})
    .then(r=>{const L=LIVE.help[LIVE.gid];const h=Array.isArray(L)&&L.find(x=>x.id===b.dataset.h);if(h){h.status=r.request.status;h.resolved_at=r.request.resolved_at}render()})
    .catch(e=>{b.disabled=false;toast(e.message||T.errGeneric)})}
  if(a==='draft')modal(draftHtml(b.dataset.s,+b.dataset.i));
  if(a==='gen'){const s=b.dataset.s,i=+b.dataset.i;S.plan[s][i]='gen';render();setTimeout(()=>{S.plan[s][i]='draft';save();if(tab==='plan')render();toast(T.genDone)},1600)}
  if(a==='approve'){S.plan[b.dataset.s][+b.dataset.i]='approved';save();closeModal();render();toast(T.approvedMsg)}
  if(a==='rework'){closeModal();toast(T.reworkMsg)}
  if(a==='toRoster'){cur=g.id;tab='roster';rf='all';render();window.scrollTo({top:0})}
  if(a==='rf'){rf=b.dataset.f;render()}
  if(a==='import')impOpen();
  if(a==='addForce'&&PENDING){const body=Object.assign({},PENDING,{force:true});PENDING=null;liveDo(api('POST','/curator/students',body),T.added)}
  if(a==='impMode'){IMP.mode=b.dataset.m;impRender()}
  if(a==='impParse'){IMP.text=document.getElementById('imp-text').value;impSet(RosterImport.parseText(IMP.text))}
  if(a==='impDel'){IMP.rows.splice(+b.dataset.i,1);impRender()}
  if(a==='impAdd'){IMP.rows.push({name:'',birthText:''});impRender()}
  if(a==='impBack'){IMP.rows=null;impRender()}
  if(a==='impSave'){impCheck();if(IMP.rows.some(r=>r.err)){impRender();return}impSave()}
  if(a==='scopy'){const s=findS(b.dataset.s);if(s)copyText(personalLink(s))}
  if(a==='sqr'){const s=findS(b.dataset.s);if(!s)return;const m=modal(`<h2>${esc(s.name)}</h2><p class="muted">${T.sqrSub}</p><div class="qr" id="qr-box"></div><div class="link">${personalLink(s)}</div><div class="row"><button class="btn primary" data-close>${T.close}</button></div>`);qrInto(m.querySelector('#qr-box'),personalLink(s))}
  if(a==='qrseq'){seq=0;showSeq()}
  if(a==='seqNext'){seq++;showSeq()}
  if(a==='seqPrev'){seq--;showSeq()}
  if(a==='reissue'){const s=findS(b.dataset.s);if(!s)return;
    if(s.live){api('POST','/curator/students/'+s.id+'/invite').then(r=>{s.code=r.invite.token.replace(/^i_/,'');render();toast(T.reissued)}).catch(e=>toast(e.message));return}
    s.code=newCode();s.used=null;save();render();toast(T.reissued)}
  if(a==='unlink'){const s=findS(b.dataset.s);if(!s)return;modal(`<h2>${T.unlinkTitle}</h2><p class="muted">${esc(T.unlinkSub(s.name))}</p><div class="row"><button class="btn primary" data-act="unlinkOk" data-s="${s.id}">${T.unlink}</button><button class="btn plain" data-close>${T.close}</button></div>`)}
  if(a==='unlinkOk'){const s=findS(b.dataset.s);if(!s)return;
    if(s.live){liveDo(api('POST','/curator/students/'+s.id+'/unlink'),T.unlinkDone);return}
    s.used=null;s.code=null;save();closeModal();render();toast(T.unlinkDone)}
  if(a==='consent'){const s=findS(b.dataset.s);if(!s)return;modal(`<h2>${T.cTitle}</h2><p class="muted">${esc(T.cSub(s.name))}</p>
    <label class="f" for="c-parent">${T.cParent}</label><input class="i" id="c-parent" maxlength="80">
    <label class="f" for="c-ref">${T.cRef}</label><input class="i" id="c-ref" maxlength="60" placeholder="${T.cRefPh}">
    <label class="row" style="margin:12px 0;font-size:13px;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" id="c-ok" style="margin-top:3px"> <span>${T.cCheck}</span></label>
    <p class="muted">${T.cNote}</p><div class="row"><button class="btn primary" data-act="consentSave" data-s="${s.id}">${T.save}</button><button class="btn plain" data-close>${T.close}</button></div>`)}
  if(a==='consentSave'){const s=findS(b.dataset.s);const ref=document.getElementById('c-ref').value.trim();if(!s)return;if(!ref||!document.getElementById('c-ok').checked){toast(T.cNeed);return}
    const parent=document.getElementById('c-parent').value.trim();
    if(s.live){if(parent.length<3){toast(T.needParent);return}liveDo(api('POST','/curator/students/'+s.id+'/parental',{parent_name:parent,document_ref:ref}),T.cSaved);return}
    s.consent={ref,parent};save();closeModal();render();toast(T.cSaved)}
  if(a==='edit'){const s=findS(b.dataset.s);if(!s)return;modal(`<h2>${T.eTitle}</h2>${s.err?`<p class="muted">⚠ ${T.errMsg}</p>`:''}
    <label class="f" for="e-name">${T.eName}</label><input class="i" id="e-name" maxlength="120" value="${esc(s.name)}">
    <label class="f" for="e-birth">${T.eBirth}</label><input class="i" type="date" id="e-birth" value="${s.birth||''}">
    <div class="row" style="margin-top:14px"><button class="btn primary" data-act="editSave" data-s="${s.id}">${T.save}</button><button class="btn plain" data-close>${T.close}</button></div>`)}
  if(a==='editSave'){const s=findS(b.dataset.s);const n=document.getElementById('e-name').value.trim(),bd=document.getElementById('e-birth').value;if(!s||!n)return;
    if(s.live){const body={full_name:n};if(bd)body.birth_date=bd;liveDo(api('PATCH','/curator/students/'+s.id,body),T.eSaved);return}
    if(!bd)return;s.name=n;s.birth=bd;s.err=false;save();closeModal();render();toast(T.eSaved)}
  if(a==='sadd'){const n=document.getElementById('s-name'),bd=document.getElementById('s-birth');if(!n.value.trim()){n.focus();return}if(!bd.value){bd.focus();return}
    if(LIVE){const body={group_id:LIVE.gid,full_name:n.value.trim(),birth_date:bd.value};
      api('POST','/curator/students',body).then(r=>liveDo(Promise.resolve(r),T.added)).catch(e=>{if(e.body&&e.body.error==='duplicate'){PENDING=body;modal(`<h2>${T.dupTitle}</h2><p class="muted">${esc(e.message)}</p><div class="row"><button class="btn primary" data-act="addForce">${T.dupYes}</button><button class="btn plain" data-close>${T.close}</button></div>`)}else toast(e.message)});return}
    const gr=S.groups.find(x=>x.id===cur)||S.groups[0];const R=rosterOf(gr);R.push({id:gr.id+'-n'+Date.now(),name:n.value.trim(),birth:bd.value,consent:null,code:newCode(),used:null,err:false});gr.n=Math.max(gr.n,R.length);save();render();toast(T.added)}
  if(a==='assign'){const gr=S.groups.find(x=>x.id===cur);const sel=document.getElementById('t-topic');if(!sel)return;S.tasks.unshift({group:gr.id,topic:+sel.value,subject:gr.subject,deadline:document.getElementById('t-date').value||addDays(7),done:0});save();render();toast(T.assigned)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
render();
})();
