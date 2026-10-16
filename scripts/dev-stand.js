// Локальный стенд «как в Telegram»: app/ + /api через route() на локальном Postgres. ТОЛЬКО локальная база.
//   npx tsc && STAND_DATABASE_URL=postgres://postgres@localhost:55432/learn node scripts/dev-stand.js .
// Telegram-заглушка с подписанным initData (тестовый BOT_TOKEN) для любого tg и start_param.
// ?__tg=<id>&__sp=<start_param> — запоминается в cookie (переживает переход на teacher.html); ?__tg=0 — «вне Telegram».
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2];const D=p=>require(path.join(ROOT,'dist',p));
process.env.DATABASE_URL=process.env.STAND_DATABASE_URL||'postgres://postgres@localhost:55432/learn?sslmode=disable';process.env.BOT_TOKEN='123456789:TEST_ONLY_not_a_real_token';
const {route}=D('api/_lib/router.js'),{signInitData}=D('api/_lib/auth.js');
function init(tg,sp){const f={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:+tg,first_name:'Тест',language_code:'ru'})};if(sp)f.start_param=sp;return new URLSearchParams({...f,hash:signInitData(f,process.env.BOT_TOKEN)}).toString()}
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(/;\s*/).filter(Boolean).map(c=>c.split('=').map(decodeURIComponent)));
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');
  if(u.pathname.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);
    const r=await route(new Request('http://x'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}));
    res.writeHead(r.status,{'content-type':'application/json'});res.end(await r.text());return}
  const f=path.join(ROOT,'app',u.pathname==='/'?'index.html':u.pathname);if(!fs.existsSync(f)){res.writeHead(404);res.end();return}
  const headers={'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html; charset=utf-8','cache-control':'no-store'};
  let body=fs.readFileSync(f);
  if(f.endsWith('.html')){const c=cookies(req);let tg=u.searchParams.get('__tg')??c.tg,sp=u.searchParams.has('__tg')?(u.searchParams.get('__sp')||''):(c.sp||'');
    if(u.searchParams.has('__tg'))headers['set-cookie']=[`tg=${encodeURIComponent(tg)}; Path=/`,`sp=${encodeURIComponent(sp)}; Path=/`];
    const stub=tg&&tg!=='0'?`<script>window.Telegram={WebApp:{initData:${JSON.stringify(init(tg,sp))},initDataUnsafe:{user:{id:${+tg},first_name:'Тест'},start_param:${JSON.stringify(sp)}},colorScheme:'light',ready(){},expand(){},isVersionAtLeast(){return false},setHeaderColor(){},setBackgroundColor(){},BackButton:{show(){},hide(){},onClick(){}},onEvent(){},disableVerticalSwipes(){}}}</script>`:'<script>window.Telegram={WebApp:{initData:"",initDataUnsafe:{},colorScheme:"light",ready(){},expand(){},isVersionAtLeast(){return false},BackButton:{show(){},hide(){},onClick(){}},onEvent(){}}}</script>';
    body=Buffer.from(body.toString().replace('<script src="https://telegram.org/js/telegram-web-app.js"></script>',stub))}
  res.writeHead(200,headers);res.end(body)}).listen(+(process.env.STAND_PORT||8773),()=>console.log('стенд: http://127.0.0.1:'+(process.env.STAND_PORT||8773)+'/index.html?__tg=7001'));
