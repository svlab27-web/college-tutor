// Разбор списка группы для кабинета куратора (#9): вставка текстом или файл (Excel, CSV, Word).
// Только разбор — без сети и без базы. Результат куратор проверяет и правит в таблице,
// на сервер уходит уже исправленный список (POST /api/curator/students/bulk).
//
// Понимает: «Иванова Анна 05.03.2009», «1. Иванова Анна Сергеевна; 2009», столбцы
// «№ | Фамилия | Имя | Отчество | Дата рождения» (рус/қаз заголовки), даты дд.мм.гггг,
// гггг-мм-дд, дд/мм/гг, год, даты Excel. CSV из Excel бывает в windows-1251 — распознаём.
'use strict';
(function(){
  // SheetJS 0.20.x — с исправлениями уязвимостей 0.18.5 (prototype pollution, ReDoS); новые версии публикуются только на их CDN
const XLSX_URL='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  const JSZIP_URL='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  const NAME_HDR=/фио|ф\.и\.о|фамил|имя|отчеств|аты|тег[іi]|әкес|студент|name/i;
  const DATE_HDR=/дата|рожд|туған|год|жыл|birth/i;
  const pad=n=>String(n).padStart(2,'0');

  function isoOk(y,m,d){const t=new Date(Date.UTC(y,m-1,d));return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d}
  function yy(n){const cur=new Date().getFullYear()%100;return n<=cur?2000+n:1900+n}

  // Значение ячейки → {date:'YYYY-MM-DD'} | {year:YYYY} | null
  function parseBirth(v){
    if(v===null||v===undefined||v==='')return null;
    // Excel/SheetJS отдаёт дату около полуночи со сдвигом (исторические пояса) — округляем до ближайшего дня
    if(v instanceof Date&&!isNaN(v)){const t=new Date(v.getTime()+12*3600e3);return{date:t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate())}}
    if(typeof v==='number'){
      if(Number.isInteger(v)&&v>=1950&&v<=2020)return{year:v};
      if(v>18000&&v<45000){const t=new Date(Date.UTC(1899,11,30)+Math.round(v)*864e5);return{date:t.toISOString().slice(0,10)}} // дата Excel
      return null}
    const s=String(v).trim().replace(/\s*(г\.?|года|ж\.?|жыл)$/i,'');
    let m;
    if((m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})$/))){const d=+m[1],mo=+m[2],y=m[3].length===2?yy(+m[3]):+m[3];return isoOk(y,mo,d)?{date:y+'-'+pad(mo)+'-'+pad(d)}:null}
    if((m=s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/))){const y=+m[1],mo=+m[2],d=+m[3];return isoOk(y,mo,d)?{date:y+'-'+pad(mo)+'-'+pad(d)}:null}
    if((m=s.match(/^(\d{4})$/))&&+m[1]>=1950&&+m[1]<=2020)return{year:+m[1]};
    return null}

  function cleanName(s){
    return String(s).replace(/\s+/g,' ').trim()
      .split(' ').map(w=>w.length>1&&w===w.toUpperCase()?w[0]+w.slice(1).toLowerCase():w).join(' ')}
  const isIndex=v=>typeof v==='number'?v<1950&&Number.isInteger(v):/^\d{1,3}[.)]?$/.test(String(v).trim());
  const nameLike=v=>/^[\p{L}\p{M}' .-]+$/u.test(String(v).trim())&&/\p{L}/u.test(String(v)); // без цифр: «ИС-21», телефон, почта — не ФИО

  // Таблица ячеек → строки {name, birth:{date}|{year}|null, raw}
  function fromMatrix(matrix,useHeader=true){
    const rows=matrix.map(r=>(r||[]).map(c=>c===null||c===undefined?'':c)).filter(r=>r.some(c=>String(c).trim()!==''));
    let nameCols=null,dateCol=-1,start=0;
    const hi=!useHeader?-1:rows.slice(0,3).findIndex(r=>r.some(c=>typeof c==='string'&&NAME_HDR.test(c))&&r.every(c=>!parseBirth(c)));
    if(hi>=0){const h=rows[hi];nameCols=[];h.forEach((c,i)=>{const t=String(c);if(DATE_HDR.test(t))dateCol=dateCol<0?i:dateCol;else if(NAME_HDR.test(t))nameCols.push(i)});start=hi+1}
    const out=[];
    for(const r of rows.slice(start)){
      let name='',birth=null;
      if(nameCols&&nameCols.length){name=nameCols.map(i=>r[i]).filter(c=>String(c).trim()).join(' ');birth=dateCol>=0?parseBirth(r[dateCol]):null;
        if(!birth)for(const c of r){const b=parseBirth(c);if(b){birth=b;break}}}
      else{const parts=[];r.forEach((c,i)=>{if(i===0&&isIndex(c))return;const b=!birth&&parseBirth(c);if(b){birth=b;return}if(nameLike(c))parts.push(String(c))});name=parts.join(' ')}
      name=cleanName(name);
      if(!name&&!birth)continue;
      out.push({name,birth,raw:r.map(String).join(' · ')})}
    return out}

  function parseText(text){
    const lines=String(text).split(/\r?\n/).filter(l=>l.trim());
    // Скопировано из таблицы (табуляция / точка с запятой) — столбцы и заголовки учитываем
    if(lines.filter(l=>/\t|;/.test(l)).length>=lines.length/2)return fromMatrix(lines.map(l=>l.split(/\t|;/).map(c=>c.trim())));
    // Обычный текст: «Иванова Анна 05.03.2009» — строку-заголовок без цифр пропускаем
    const body=lines.filter(l=>!(NAME_HDR.test(l)&&DATE_HDR.test(l)&&!/\d/.test(l)));
    return fromMatrix(body.map(l=>l.replace(/,/g,' ').trim().split(/\s+/)),false)}

  const loaded={};
  function load(src){return loaded[src]||(loaded[src]=new Promise((ok,fail)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>{delete loaded[src];fail(new Error('Не удалось загрузить модуль для чтения файла. Проверьте интернет.'))};document.head.appendChild(s)}))}

  async function readCsv(file){
    const buf=await file.arrayBuffer();let t=new TextDecoder('utf-8').decode(buf);
    if(t.includes('�'))t=new TextDecoder('windows-1251').decode(buf); // CSV из русского Excel
    return parseText(t.replace(/^﻿/,''))}
  async function readXlsx(file){
    await load(XLSX_URL);
    const wb=window.XLSX.read(await file.arrayBuffer(),{cellDates:true});
    const ws=wb.Sheets[wb.SheetNames[0]];
    return fromMatrix(window.XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''}))}
  async function readDocx(file){
    await load(JSZIP_URL);
    const zip=await window.JSZip.loadAsync(await file.arrayBuffer());
    const xml=await zip.file('word/document.xml').async('string');
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    // По локальному имени: разные программы пишут Word с разными пространствами имён (transitional / strict)
    const by=(el,name)=>[...el.getElementsByTagName('*')].filter(n=>n.localName===name);
    const text=el=>by(el,'t').map(t=>t.textContent).join('');
    const trs=by(doc,'tr');
    if(trs.length)return fromMatrix(trs.map(tr=>by(tr,'tc').map(text)));
    return parseText(by(doc,'p').map(text).join('\n'))}

  async function parseFile(file){
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(ext==='csv'||ext==='txt')return readCsv(file);
    if(ext==='xlsx'||ext==='xls'||ext==='ods')return readXlsx(file);
    if(ext==='docx')return readDocx(file);
    throw new Error('Этот формат не поддерживается. Подойдут Excel (.xlsx, .xls), CSV, .txt или Word (.docx).')}

  // Та же проверка ФИО, что на сервере (api/_lib/curator.ts)
  const NAME=/^[\p{L}][\p{L}\p{M}' .-]{1,118}[\p{L}.]$/u;
  const nameOk=n=>NAME.test(n)&&n.includes(' ');

  window.RosterImport={parseText,parseFile,parseBirth,fromMatrix,nameOk};
})();
