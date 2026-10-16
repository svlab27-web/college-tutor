// Вход в сервис (docs/api.md, п. 1). Открыли из Telegram — спрашиваем сервер «кто я»:
// GET /api/me с подписанным initData. По личной ссылке (startapp=i_…) сервер сам привязывает
// Telegram к студенту / куратору, которого завёл куратор / администратор (start_param — из initData).
// Ответ — в window.MeReady (Promise): null — демо (вне Telegram, нет сети, сервер недоступен).
// Роль и согласие решают role.js и consent.js по этому ответу; экран «Кто вы?» — только для демо.
'use strict';
(function(){
  const tg=window.Telegram&&window.Telegram.WebApp;
  const initData=tg&&tg.initData||'';
  window.ApiHeaders=()=>({'x-telegram-init-data':initData,'content-type':'application/json'});
  window.MeReady=!initData?Promise.resolve(null):
    fetch('/api/me',{headers:window.ApiHeaders()})
      .then(r=>r.ok?r.json():null)
      .catch(()=>null);

  let lang=null;try{lang=localStorage.getItem('my-college-lang')}catch(e){}
  if(lang!=='ru'&&lang!=='kk'){const u=tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user;lang=u&&/^kk/i.test(u.language_code||'')?'kk':'ru'}
  const T={ru:{
    joined:g=>`Вы вошли в группу «${g}». Добро пожаловать!`,
    already_yours:g=>`Вы уже в группе «${g}».`,
    used:'Этой ссылкой уже воспользовались. Если это были не вы — попросите у куратора новую ссылку.',
    revoked:'Эта ссылка больше не действует. Попросите у куратора новую.',
    expired:'Срок ссылки истёк. Попросите у куратора новую.',
    invalid:'Ссылка не найдена. Проверьте, что открыли её целиком, или попросите у куратора новую.',
    already_registered:'Ваш Telegram уже привязан к другой записи. Если это ошибка — напишите куратору.',
    demo:'Пока работает демо: прогресс не сохраняется.',ok:'Понятно'
  },kk:{
    joined:g=>`Сіз «${g}» тобына кірдіңіз. Қош келдіңіз!`,
    already_yours:g=>`Сіз «${g}» тобындасыз.`,
    used:'Бұл сілтеме бұрын пайдаланылған. Егер бұл сіз болмасаңыз — куратордан жаңа сілтеме сұраңыз.',
    revoked:'Бұл сілтеме енді жарамсыз. Куратордан жаңасын сұраңыз.',
    expired:'Сілтеменің мерзімі өтті. Куратордан жаңасын сұраңыз.',
    invalid:'Сілтеме табылмады. Оны толық ашқаныңызды тексеріңіз немесе куратордан жаңасын сұраңыз.',
    already_registered:'Сіздің Telegram басқа жазбаға байланған. Қате болса — кураторға жазыңыз.',
    demo:'Әзірге демо жұмыс істейді: прогресс сақталмайды.',ok:'Түсінікті'
  }}[lang];

  // Итог входа по ссылке — плашка сверху (успех — зелёная, проблема — с подсказкой, что делать)
  window.showJoinNotice=function(me){
    const j=me&&me.join;if(!j||!j.status)return;
    const good=j.status==='joined'||j.status==='already_yours';
    const msg=good?T[j.status](j.group?j.group.title:''):`${T[j.status]||T.invalid} ${T.demo}`;
    const el=document.createElement('div');el.setAttribute('role','status');
    el.style.cssText='position:fixed;left:12px;right:12px;top:12px;z-index:60;max-width:560px;margin:0 auto;border-radius:14px;padding:12px 14px;font:600 14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 12px 30px #0003;display:flex;gap:12px;align-items:flex-start;'+(good?'background:#e4f1d8;color:#24492f':'background:#fff1e6;color:#7a3f1a');
    el.innerHTML=`<span style="flex:1"></span><button type="button" style="border:0;background:#ffffffb3;border-radius:9px;padding:6px 10px;font:inherit;cursor:pointer;color:inherit">${T.ok}</button>`;
    el.firstChild.textContent=msg;
    el.querySelector('button').onclick=()=>el.remove();
    const put=()=>{document.body.appendChild(el);if(good)setTimeout(()=>el.remove(),6000)};
    document.body?put():document.addEventListener('DOMContentLoaded',put);
  };
})();
