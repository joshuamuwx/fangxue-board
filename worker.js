/**
 * 放学公告牌 · Cloudflare Worker 单文件版（开源版）
 * 使用前先改下方 CONFIG 配置区（学校名、校区、反馈邮箱、校徽），班级名单在 DEFAULT_ORDER。
 * 免费额度内长期运行：Workers 10万请求/天，KV 读10万/天、写1000/天
 * 部署：1) Cloudflare 建 KV namespace；2) 新建 Worker 粘贴本文件；
 *      3) 绑定 KV(binding 名=KV)；4) 设置 Secret ADMIN_PIN(6位数字)；5) 部署。
 * 保安端: https://你的域名/admin   家长端: https://你的域名/
 */

/* ================= 部署配置（只需改这里） ================= */
const CONFIG = {
  schoolName: '示例小学',      // 学校名称，显示在页面标题与页眉
  campusName: '本校区东门',     // 校区 / 校门名称，显示在页眉第二行
  feedbackEmail: '',           // 「提供建议」按钮的收件邮箱；留空则不显示该按钮
  logo: '',                    // 校徽图片（图片 URL 或 data: 形式）；留空则不显示校徽
};

/* ---- 以下为由配置生成的页面片段，一般不用改 ---- */
const LOGO_IMG = CONFIG.logo ? '<img src="' + CONFIG.logo + '" alt="校徽">' : '';
const LOGO_BADGE = CONFIG.logo ? '<span class="badge"><img src="' + CONFIG.logo + '" alt="校徽"></span>' : '';
const FEEDBACK_BTN = CONFIG.feedbackEmail
  ? '<br><a class="fbbtn" href="mailto:' + CONFIG.feedbackEmail + '?subject=' + encodeURIComponent('放学看板建议') + '&body=' + encodeURIComponent('您的建议：\n\n（请在此填写）') + '">💬 提供建议</a>'
  : '';

/* ================= 家长端页面 ================= */
const HTML_PARENT = `<!DOCTYPE html>
<html lang="zh-CN" class="notranslate">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="google" content="notranslate">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${CONFIG.schoolName} · 放学实时看板</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:linear-gradient(180deg,#bcdcf7 0%,#d9eefa 30%,#e7f5e3 58%,#c9e8c2 100%);background-attachment:fixed;color:#1f2d3d;padding:14px}
.wrap{max-width:520px;margin:0 auto}
h2{text-align:center;font-size:20px;margin:6px 0 12px}
.card{background:#fff;border-radius:14px;padding:18px;margin-bottom:12px;box-shadow:0 2px 8px rgba(30,60,120,.08)}
.big{text-align:center;padding:26px 16px}
.cls{font-size:16px;font-weight:800;color:#1f6fd6;margin:6px 0;line-height:1.2}
.lbl{font-size:14px;color:#5a6b82}
.prog{font-size:14px;color:#5a6b82;margin-top:6px}
.mine{margin-top:14px;padding:16px;border-radius:12px;background:#f0f8ff;font-size:20px;font-weight:700;line-height:1.7}
.mine b{font-size:30px;color:#d9480f}
.mine.hot{background:#fff3e8;border:2px solid #f5c99b}
.mine.now{background:#e8f9ef;border:2px solid #8fd6a8}
.eta{font-size:13px;color:#7a8aa0;margin-top:8px}
#notice{display:none;margin-bottom:12px;padding:14px;border-radius:12px;background:#fff8e6;border:1px solid #ecd28a;font-size:16px}
.row{display:flex;gap:8px;margin-bottom:12px}
select{flex:1;font-size:16px;padding:10px;border-radius:10px;border:1px solid #d5dde8}
button{font-size:16px;padding:10px 16px;border-radius:10px;border:none;background:#2f7cf6;color:#fff}
button.ghost{background:#e8eef7;color:#2f7cf6}
.log{font-size:13px;color:#4a5a70;max-height:220px;overflow:auto}
.log div{padding:6px 0;border-bottom:1px dashed #edf1f7;display:flex;justify-content:space-between}
.log .done{color:#1c7a45}
.foot{text-align:center;font-size:12px;color:#8a99af;margin-top:10px;line-height:1.8}
.fbbtn{display:inline-block;margin-top:8px;padding:6px 20px;border:1px solid #c3d0e2;border-radius:20px;color:#5b7ba6;font-size:13px;text-decoration:none;background:#fff}
.fbbtn:active{background:#eef4fb}
.nextup{margin-top:14px;padding:14px;border-radius:12px;background:#fff7e6;border:2px solid #f0b429;font-size:22px;font-weight:700;color:#b26a00;line-height:1.6;text-align:center}
.nextup b{color:#d9480f;font-size:34px}
.big .nextup:first-child{margin-top:0}
.log .soon{background:#fff7e6;border-radius:6px;font-weight:700}
.hint{font-size:13px;color:#7a8aa0;background:#fff;border-radius:10px;padding:10px 14px;margin-bottom:12px}
.brand{display:flex;align-items:center;justify-content:center;gap:10px;margin:4px 0 12px}
.brand img{width:64px;height:64px;border-radius:14px;box-shadow:0 2px 6px rgba(30,60,120,.15)}
.brand .school{font-size:20px;font-weight:800;text-align:left}
.brand .sub{font-size:13px;color:#5a6b82;text-align:left}
.clockrow{display:flex;align-items:center;justify-content:center;gap:10px;margin:-4px 0 12px}
.clock{font-size:13px;color:#7a8aa0;letter-spacing:1px}
.rbtn{font-size:13px;padding:6px 16px;border-radius:20px;background:#e8eef7;color:#2f7cf6;border:none}
.play{text-align:center;font-size:20px;letter-spacing:8px;margin:0 0 10px}
.field{margin-top:14px;border-radius:16px;padding:16px 10px 12px;text-align:center;font-size:24px;letter-spacing:8px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.30) 0 3px,transparent 3px 54px),linear-gradient(180deg,#83c880,#5da85d);box-shadow:inset 0 0 0 3px rgba(255,255,255,.55)}
.field .t{display:block;font-size:13px;letter-spacing:6px;color:#f4fbf4;font-weight:700;margin-top:6px}
</style>
</head>
<body>
<div class="wrap">
<div class="brand">${LOGO_IMG}<div><div class="school">${CONFIG.schoolName}</div><div class="sub">${CONFIG.campusName}</div><div class="sub">放学实时看板</div></div></div>
<div class="play">🌻🌱⚽🏃‍♀️🌼🏃‍♂️🌿🦋</div>
<div class="clockrow"><div class="clock" id="clock"></div><button class="rbtn" id="refreshBtn">⟳ 刷新</button></div>
<div id="notice"></div>
<div class="card">
<div class="row">
<select id="sel"><option value="">-- 选择您家班级 --</option></select>
<button id="saveBtn">确定</button>
</div>
<div class="row">
<button class="ghost" id="primeBtn" style="flex:1">点我开启到班提醒（响铃+震动）</button>
</div>
</div>
<div class="card big">
<div class="nextup" id="nextup" style="display:none"></div>
<div class="lbl" id="label">正在加载…</div>
<div class="mine" id="mine" style="display:none"></div>
<div class="eta" id="eta"></div>
<div class="prog" id="prog"></div>
<div class="cls" id="cls">—</div>
</div>
<div class="card">
<div class="lbl" style="margin-bottom:8px">今日放学记录</div>
<div class="log" id="log"><div>暂无</div></div>
</div>
<div class="field">⚽🏃‍♂️🏃‍♀️🌻🌱<span class="t">好好学习天天向上</span></div>
<div class="foot">信息仅供参考，以门口翻牌为准<br>更新于 <span id="upd">—</span> · 每15秒自动刷新${FEEDBACK_BTN}</div>
</div>
<script>
var myClass = localStorage.getItem('fx_myclass') || '';
var notified = {}; // 当天已提醒过的 key: date+class+kind
function $(id){ return document.getElementById(id); }
function todayStr(){ return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}); }
function speak(text){
  try{
    if(!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang='zh-CN'; u.rate=0.95;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
function buzz(p){ try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} }
function showNotice(t,b){
  var n=$('notice'); n.style.display='block';
  n.innerHTML='<b>'+t+'</b><br>'+b;
}
function alertOnce(kind, text, strong){
  var key = todayStr()+'|'+myClass+'|'+kind;
  if(notified[key]) return; notified[key]=1;
  buzz(strong?[400,200,400,200,600]:[250,120,250]);
  speak(text);
  showNotice(strong?'到您家了！':'准备下车', text);
}
function fmtTime(iso){
  try{ return new Date(iso).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}); }
  catch(e){ return ''; }
}
function avgInterval(rel){
  var arr=[];
  for(var k in rel){ if(rel.hasOwnProperty(k)) arr.push(new Date(rel[k]).getTime()); }
  if(arr.length<2) return 2*60*1000;
  arr.sort();
  var d=(arr[arr.length-1]-arr[0])/(arr.length-1);
  return (d>0 && d<30*60*1000) ? d : 2*60*1000;
}
function render(s){
  var label=$('label'), cls=$('cls'), prog=$('prog'), mine=$('mine'), eta=$('eta'), log=$('log');
  mine.style.display='none'; mine.className='mine';
  if(!s || s.status==='idle'){
    label.textContent='今日放学尚未开始'; cls.textContent='—';
    prog.textContent=''; eta.textContent=''; log.innerHTML='<div>暂无</div>';
    $('nextup').style.display='none';
    fillSel([]); return;
  }
  fillSel(s.order||[]);
  $('upd').textContent = s.updatedAt ? fmtTime(s.updatedAt) : '—';
  var rel = s.released || {};
  var n = s.order ? s.order.length : 0;
  var doneCount = 0, k;
  for(k=0;k<n;k++){ if(rel[s.order[k]]) doneCount++; }
  var pending=[];
  for(var p=0;p<n;p++){ if(!rel[s.order[p]]) pending.push(s.order[p]); }
  var nu=$('nextup');
  if(s.status==='done'){
    label.textContent='今日放学已结束'; cls.textContent='完毕';
    prog.textContent='共 '+n+' 个班，全部放学';
    nu.style.display='none';
  } else {
    label.textContent='正在放学';
    cls.textContent='已放 '+doneCount+' / '+n+' 班';
    prog.textContent='绿色=已放学，灰色=还没轮到';
    if(pending.length){
      nu.style.display='block';
      nu.innerHTML='接下来放学，准备排队！<br><b>'+pending[0]+'</b>'+(pending[1]?'<br><b>'+pending[1]+'</b>':'');
    } else nu.style.display='none';
  }
  // 您家班级逻辑
  if(myClass && s.order){
    if(s.order.indexOf(myClass)<0){
      mine.style.display='block'; mine.textContent='今日顺序表里没有 '+myClass;
    } else if(rel[myClass] || s.status==='done'){
      mine.style.display='block'; mine.className='mine now';
      var t=rel[myClass]?fmtTime(rel[myClass]):'';
      mine.innerHTML='您家 <b>'+myClass+'</b> '+(t?('已于 '+t+' 放学'):'已放学')+'，去接吧';
      if(s.status!=='done') alertOnce('now','您家'+myClass+'已放学，请去接孩子',true);
    } else {
      var myIdx=pending.indexOf(myClass);
      var mins=Math.round(myIdx*avgInterval(rel)/60000);
      mine.style.display='block'; mine.className='mine hot';
      mine.innerHTML='您家 <b>'+myClass+'</b> 前面还有 <b>'+myIdx+'</b> 个班没放';
      eta.textContent='按今日实际节奏估算：约 '+mins+' 分钟后到（仅供参考）';
      if(myIdx<=1) alertOnce('soon','马上到'+myClass+'了，准备下车',false);
    }
  }
  // 今日记录
  if(n){
    var h='';
    for(var m=0;m<n;m++){
      var c=s.order[m];
      var tm=rel[c]?fmtTime(rel[c]):'等待中';
      var soon=(!rel[c]&&(c===pending[0]||c===pending[1]))?' soon':'';
      h+='<div class="'+(rel[c]?'done':'')+soon+'"><span>'+c+(soon?' 🔜':'')+'</span><span>'+tm+'</span></div>';
    }
    log.innerHTML=h;
  }
}
function fillSel(order){
  var sel=$('sel'), cur=sel.value||myClass;
  sel.innerHTML='<option value="">-- 选择您家班级 --</option>';
  for(var i=0;i<order.length;i++){
    var o=document.createElement('option'); o.value=order[i]; o.textContent=order[i];
    sel.appendChild(o);
  }
  if(cur) sel.value=cur;
}
async function load(){
  try{
    var r=await fetch('/api/status',{cache:'no-store'});
    render(await r.json());
  }catch(e){ $('label').textContent='网络异常，以门口翻牌为准'; }
}
$('saveBtn').onclick=function(){
  var v=$('sel').value;
  if(v){ myClass=v; localStorage.setItem('fx_myclass',v); notified={}; load(); }
};
$('primeBtn').onclick=function(){
  speak('提醒已开启，轮到您家班级时手机会响铃震动');
  buzz([200,100,200]);
  showNotice('提醒已开启','请保持本页面打开，轮到时会自动提醒');
};
function tickClock(){
  try{
    var d=new Date();
    $('clock').textContent=d.toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'})
      +' '+d.toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  }catch(e){}
}
tickClock(); setInterval(tickClock,1000);
if(myClass){ /* 下拉会在 load 后填充 */ }
$('refreshBtn').onclick=function(){ load(); };
load();
setInterval(load,15000);
document.addEventListener('visibilitychange',function(){ if(!document.hidden) load(); });
</script>
</body>
</html>`;

/* ================= 保安端页面 ================= */
const HTML_ADMIN = `<!DOCTYPE html>
<html lang="zh-CN" class="notranslate">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="google" content="notranslate">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${CONFIG.schoolName} · 放学管理</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:#1c2530;color:#fff;padding:14px;min-height:100vh}
.wrap{max-width:520px;margin:0 auto}
h2{text-align:center;font-size:20px;margin:8px 0 14px}
.card{background:#27313f;border-radius:14px;padding:18px;margin-bottom:12px}
.bigbtn{display:block;width:100%;font-size:30px;font-weight:800;padding:26px 0;margin:10px 0;border-radius:16px;border:none;background:#2f7cf6;color:#fff}
.bigbtn:active{background:#1f5fd0}
.bigbtn.warn{background:#e8833a}
.bigbtn.dim{background:#3a4656;color:#aeb9c7;font-size:18px;padding:14px 0}
.cur{text-align:center;font-size:52px;font-weight:800;color:#ffd666;margin:10px 0;line-height:1.2}
.lbl{text-align:center;color:#9fb0c7;font-size:14px}
input,textarea{width:100%;font-size:18px;padding:12px;border-radius:10px;border:1px solid #3a4656;background:#1c2530;color:#fff;margin:8px 0}
textarea{height:180px;font-size:15px;line-height:1.8}
button.go{width:100%;font-size:20px;padding:14px;border-radius:12px;border:none;background:#22a06b;color:#fff;margin-top:8px}
.msg{text-align:center;color:#ffd666;min-height:24px;font-size:15px;margin-top:8px}
.foot{text-align:center;color:#5f6f85;font-size:12px;margin-top:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
.cbtn{font-size:20px;font-weight:700;padding:20px 0;border-radius:12px;border:2px solid #39424f;background:#39424f;color:#7a8aa0}
.cbtn small{display:block;font-size:12px;font-weight:400;color:#5f6f85;margin-top:4px}
.cbtn.off{background:#1c7a45;border-color:#1c7a45;color:#fff}
.cbtn.off small{color:#d9efe2}
.brand{display:flex;align-items:center;justify-content:center;gap:10px;margin:6px 0 14px}
.brand .badge{background:#fff;border-radius:12px;padding:3px;line-height:0}
.brand .badge img{width:58px;height:58px;border-radius:12px}
.brand .school{font-size:20px;font-weight:800;text-align:left}
.brand .sub{font-size:13px;color:#9fb0c7;text-align:left}
.clock{text-align:center;font-size:13px;color:#9fb0c7;margin:-4px 0 12px;letter-spacing:1px}
</style>
</head>
<body>
<div class="wrap">
<div class="brand">${LOGO_BADGE}<div><div class="school">${CONFIG.schoolName}</div><div class="sub">${CONFIG.campusName}</div><div class="sub">放学管理</div></div></div>
<div class="clock" id="clock"></div>
<div class="card" id="pinCard">
<div class="lbl">请输入6位管理密码</div>
<input id="pin" type="password" inputmode="numeric" maxlength="6" placeholder="6位数字密码">
<button class="go" id="pinBtn">进入</button>
<div class="msg" id="pinMsg"></div>
</div>
<div class="card" id="idleCard" style="display:none">
<div class="lbl">今日放学顺序（每行一个班，可调整）</div>
<textarea id="order"></textarea>
<button class="go" id="startBtn">开始放学</button>
<div class="msg" id="idleMsg"></div>
</div>
<div class="card" id="activeCard" style="display:none">
<div class="lbl">点班级=已放学（变绿），再点=取消</div>
<div class="grid" id="grid"></div>
<div class="lbl" id="prog" style="margin:8px 0"></div>
<button class="bigbtn warn" id="finishBtn">今日放学结束</button>
<div class="msg" id="actMsg"></div>
</div>
<div class="card" id="doneCard" style="display:none">
<div class="lbl">今日放学已结束</div>
<div class="cur" style="font-size:36px">完毕</div>
<button class="bigbtn dim" id="againBtn">重新开始（慎用）</button>
</div>
<div class="foot">点班级按钮变绿=已放学，再翻对应的牌子<br>家长端显示仅供参考，以翻牌为准</div>
</div>
<script>
var pin = sessionStorage.getItem('fx_pin') || '';
function $(id){ return document.getElementById(id); }
function msg(id,t){ $(id).textContent=t; setTimeout(function(){ $(id).textContent=''; },3000); }
async function api(path, body){
  body = body || {}; body.pin = pin;
  var r = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  return r.json();
}
async function refresh(){
  var r = await fetch('/api/status?b='+Date.now(),{cache:'no-store'});
  var s = await r.json();
  $('pinCard').style.display = pin ? 'none' : 'block';
  $('idleCard').style.display = 'none'; $('activeCard').style.display='none'; $('doneCard').style.display='none';
  if(!pin) return;
  if(!s || s.status==='idle'){
    $('idleCard').style.display='block';
    if(s && s.defaultOrder) $('order').value = s.defaultOrder.join('\\n');
    else if(!$('order').value){
      var d = await api('/api/admin/default-order',{});
      if(d.order) $('order').value = d.order.join('\\n');
    }
  } else if(s.status==='done'){ $('doneCard').style.display='block'; }
  else {
    $('activeCard').style.display='block';
    var grid=$('grid'); grid.innerHTML='';
    var rel=s.released||{}, done=0;
    for(var i=0;i<s.order.length;i++){
      (function(cls){
        var b=document.createElement('button');
        var t=rel[cls];
        b.className='cbtn'+(t?' off':'');
        b.innerHTML = t ? cls+'<small>已放学 '+fmtT(t)+'</small>' : cls;
        b.onclick=function(){ toggle(cls, b); };
        grid.appendChild(b);
        if(t) done++;
      })(s.order[i]);
    }
    $('prog').textContent='已放学 '+done+' / '+s.order.length+' 班';
  }
}
function fmtT(iso){
  try{ return new Date(iso).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}); }
  catch(e){ return ''; }
}
async function toggle(cls, btn){
  if(btn){ btn.disabled=true; btn.style.opacity='0.5'; }
  var r = await api('/api/admin/toggle',{cls:cls});
  if(r.ok){
    if(btn){
      btn.className='cbtn'+(r.released?' off':'');
      btn.innerHTML = r.released ? cls+'<small>已放学 '+fmtT(new Date().toISOString())+'</small>' : cls;
      btn.disabled=false; btn.style.opacity='';
    }
    refresh();
  } else {
    if(btn){ btn.disabled=false; btn.style.opacity=''; }
    msg('actMsg','失败：'+(r.error||'未知'));
  }
}
$('pinBtn').onclick = async function(){
  var v=$('pin').value.trim();
  if(!/^[0-9]{6}$/.test(v)){ msg('pinMsg','请输入6位数字'); return; }
  pin=v;
  var r = await api('/api/admin/check',{});
  if(r.ok){ sessionStorage.setItem('fx_pin',pin); $('pin').value=''; refresh(); }
  else { pin=''; msg('pinMsg', r.locked?'密码错误太多次，已锁定10分钟':'密码错误'); }
};
$('startBtn').onclick = async function(){
  var lines=$('order').value.split('\\n').map(function(x){return x.trim();}).filter(function(x){return x;});
  if(!lines.length){ msg('idleMsg','请先填写放学顺序'); return; }
  var r = await api('/api/admin/start',{order:lines});
  if(r.ok){ msg('idleMsg','已开始'); setTimeout(refresh,600); }
  else msg('idleMsg','失败：'+(r.error||'未知'));
};
$('finishBtn').onclick = async function(){
  if(!confirm('确认今日放学全部结束？')) return;
  var r = await api('/api/admin/finish',{});
  if(r.ok) refresh(); else msg('actMsg','失败：'+(r.error||'未知'));
};
$('againBtn').onclick = async function(){
  if(!confirm('确认清除今日放学记录、重新开始？')) return;
  var r = await api('/api/admin/reset',{});
  if(r.ok) refresh(); else msg('actMsg','失败：'+(r.error||'未知'));
};
function tickClock(){
  try{
    var d=new Date();
    $('clock').textContent=d.toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'})
      +' '+d.toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  }catch(e){}
}
tickClock(); setInterval(tickClock,1000);
refresh(); setInterval(refresh,15000);
</script>
</body>
</html>`;

/* ================= Worker 逻辑 ================= */
const TZ = 'Asia/Shanghai';
// 门口放学班级名单（示例，部署时改成自己学校的；顺序可在保安端每天调整）
const DEFAULT_ORDER = [
  "一年级1班","一年级2班","一年级3班","一年级4班",
  "二年级1班","二年级2班","二年级3班","二年级4班",
  "三年级1班","三年级2班","三年级3班","三年级4班",
  "四年级1班","四年级2班","四年级3班","四年级4班"
];
function todayStr(){ return new Date().toLocaleDateString('en-CA',{timeZone:TZ}); }
function nowISO(){ return new Date().toISOString(); }

async function readToday(env){
  const raw = await env.KV.get('fx:today');
  if(!raw) return null;
  try{ const s = JSON.parse(raw); return (s.date===todayStr()) ? s : null; }
  catch(e){ return null; }
}
async function writeToday(env, s){
  s.updatedAt = nowISO();
  await env.KV.put('fx:today', JSON.stringify(s));
}
function json(data, status){
  return new Response(JSON.stringify(data), {
    status: status||200,
    headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}
async function readBody(req){
  try{ return await req.json(); }catch(e){ return {}; }
}
// PIN 校验：10次失败锁定IP 10分钟（计数写KV，正常操作不产生写）
async function gateCheck(req, env){
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const key = 'fx:fail:'+ip;
  const n = parseInt(await env.KV.get(key) || '0', 10);
  return { locked: n>=10, key };
}
async function verifyPin(data, env, gate){
  if(data && data.pin && env.ADMIN_PIN && data.pin===env.ADMIN_PIN) return {ok:true};
  const n = parseInt(await env.KV.get(gate.key) || '0', 10) + 1;
  await env.KV.put(gate.key, String(n), {expirationTtl:600});
  return {ok:false};
}

export default {
  async fetch(req, env, ctx){
    const url = new URL(req.url);
    const path = url.pathname;

    if(path==='/' && req.method==='GET')
      return new Response(HTML_PARENT,{headers:{'Content-Type':'text/html; charset=utf-8'}});
    if(path==='/admin' && req.method==='GET')
      return new Response(HTML_ADMIN,{headers:{'Content-Type':'text/html; charset=utf-8'}});

    if(path==='/api/status' && req.method==='GET'){
      try{
        // 边缘缓存 10 秒：放学状态是全局的，所有家长看到同一份数据。
        // 缓存命中时直接返回，不读 KV、不计入 Workers/KV 日额度。
        // 本地 node 测试环境没有 caches 全局变量，自动降级为直接读 KV。
        var useCache = (typeof caches!=='undefined') && ctx && ctx.waitUntil;
        var cacheKey = null;
        if(useCache){
          cacheKey = new Request(url.toString(),{method:'GET'});
          var hit = await caches.default.match(cacheKey);
          if(hit) return hit;
        }
        const s = await readToday(env);
        var payload;
        if(!s){
          const d = await env.KV.get('fx:config:order');
          payload = {status:'idle', defaultOrder: d?JSON.parse(d):DEFAULT_ORDER};
        } else {
          payload = s;
        }
        var body = JSON.stringify(payload);
        if(useCache){
          var cachedRes = new Response(body,{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=10'}});
          ctx.waitUntil(caches.default.put(cacheKey, cachedRes));
        }
        return new Response(body,{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
      }catch(e){ return json({status:'unknown', error:'后端额度或网络异常，以门口翻牌为准'}); }
    }

    if(path==='/api/admin/default-order' && req.method==='POST'){
      const data = await readBody(req);
      const gate = await gateCheck(req, env);
      if(gate.locked) return json({ok:false, locked:true}, 429);
      const v = await verifyPin(data, env, gate);
      if(!v.ok) return json({ok:false}, 403);
      const d = await env.KV.get('fx:config:order');
      return json({ok:true, order: d?JSON.parse(d):DEFAULT_ORDER});
    }

    if(path==='/api/admin/check' && req.method==='POST'){
      const data = await readBody(req);
      const gate = await gateCheck(req, env);
      if(gate.locked) return json({ok:false, locked:true}, 429);
      const v = await verifyPin(data, env, gate);
      return v.ok ? json({ok:true}) : json({ok:false}, 403);
    }

    if(path==='/api/admin/start' && req.method==='POST'){
      const data = await readBody(req);
      const gate = await gateCheck(req, env);
      if(gate.locked) return json({ok:false, locked:true}, 429);
      const v = await verifyPin(data, env, gate);
      if(!v.ok) return json({ok:false}, 403);
      let order = (data.order||[]).map(x=>String(x).trim()).filter(Boolean);
      if(!order.length){
        const d = await env.KV.get('fx:config:order');
        order = d ? JSON.parse(d) : DEFAULT_ORDER.slice();
      }
      if(!order.length) return json({ok:false, error:'请先设置放学顺序'}, 400);
      await env.KV.put('fx:config:order', JSON.stringify(order));
      const s = {date:todayStr(), order, released:{}, status:'active'};
      await writeToday(env, s);
      return json({ok:true});
    }

    if(path==='/api/admin/toggle' && req.method==='POST'){
      const data = await readBody(req);
      const gate = await gateCheck(req, env);
      if(gate.locked) return json({ok:false, locked:true}, 429);
      const v = await verifyPin(data, env, gate);
      if(!v.ok) return json({ok:false}, 403);
      const s = await readToday(env);
      if(!s || s.status!=='active') return json({ok:false, error:'今日放学未开始'}, 400);
      const cls = String(data.cls||'').trim();
      if(!cls || s.order.indexOf(cls)<0) return json({ok:false, error:'班级不在顺序表中'}, 400);
      s.released = s.released || {};
      let nowReleased;
      if(s.released[cls]){ delete s.released[cls]; nowReleased=false; }
      else { s.released[cls]=nowISO(); nowReleased=true; }
      await writeToday(env, s);
      return json({ok:true, released:nowReleased});
    }

    if(path==='/api/admin/finish' && req.method==='POST'){
      const data = await readBody(req);
      const gate = await gateCheck(req, env);
      if(gate.locked) return json({ok:false, locked:true}, 429);
      const v = await verifyPin(data, env, gate);
      if(!v.ok) return json({ok:false}, 403);
      const s = await readToday(env);
      if(!s) return json({ok:false, error:'今日无记录'}, 400);
      s.status='done';
      await env.KV.put('fx:history:'+s.date, JSON.stringify(s), {expirationTtl:7776000});
      await writeToday(env, s);
      return json({ok:true});
    }

    if(path==='/api/admin/reset' && req.method==='POST'){
      const data = await readBody(req);
      const gate = await gateCheck(req, env);
      if(gate.locked) return json({ok:false, locked:true}, 429);
      const v = await verifyPin(data, env, gate);
      if(!v.ok) return json({ok:false}, 403);
      await env.KV.delete('fx:today');
      return json({ok:true});
    }

    if(path==='/api/history' && req.method==='GET'){
      const d = url.searchParams.get('date') || todayStr();
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ok:false}, 400);
      const raw = await env.KV.get('fx:history:'+d);
      return json(raw ? JSON.parse(raw) : {ok:false, error:'无记录'});
    }

    return new Response('Not Found', {status:404});
  }
};
