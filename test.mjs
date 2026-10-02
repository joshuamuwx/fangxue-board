import worker from './worker.js';

function makeKV() {
  const store = new Map();
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v, opts) { store.set(k, v); },
    async delete(k) { store.delete(k); },
    _store: store,
  };
}
const env = { KV: makeKV(), ADMIN_PIN: '123456' };
const headers = { 'CF-Connecting-IP': '1.2.3.4' };

async function post(path, body) {
  const req = new Request('https://x.test' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const res = await worker.fetch(req, env);
  return { status: res.status, data: await res.json() };
}
async function get(path) {
  const res = await worker.fetch(new Request('https://x.test' + path, { headers }), env);
  const ct = res.headers.get('Content-Type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : (await res.text()).length };
}
function assert(cond, name) {
  if (!cond) { console.error('FAIL:', name); process.exit(1); }
  console.log('PASS:', name);
}

let r = await get('/');
assert(r.status === 200 && r.data > 5000, '家长端页面返回');
r = await get('/admin');
assert(r.status === 200 && r.data > 3000, '保安端页面返回');

r = await get('/api/status');
assert(r.data.status === 'idle', '初始状态 idle');

r = await post('/api/admin/default-order', { pin: '123456' });
assert(r.data.ok === true && r.data.order.length === 16 && r.data.order[0] === '一年级1班', '默认16个班已预置');

r = await post('/api/admin/start', { pin: '000000', order: ['三年级1班'] });
assert(r.status === 403 && r.data.ok === false, '错误 PIN 被拒绝');

// 8 个班级
const order = ['一年级1班','一年级2班','二年级1班','二年级2班',
               '三年级1班','三年级2班','三年级3班','三年级4班'];
r = await post('/api/admin/start', { pin: '123456', order });
assert(r.data.ok === true, '开始放学成功');
r = await get('/api/status');
assert(r.data.status === 'active' && Object.keys(r.data.released).length === 0, '状态 active, 0班已放');

// 一次放2个班：连点两个按钮
r = await post('/api/admin/toggle', { pin: '123456', cls: '三年级1班' });
assert(r.data.ok === true && r.data.released === true, '点亮 三年级1班');
r = await post('/api/admin/toggle', { pin: '123456', cls: '三年级2班' });
assert(r.data.ok === true && r.data.released === true, '点亮 三年级2班');
r = await get('/api/status');
assert(Object.keys(r.data.released).length === 2, '已放学 2/8 班');

// 点错了再点一次取消
r = await post('/api/admin/toggle', { pin: '123456', cls: '三年级2班' });
assert(r.data.ok === true && r.data.released === false, '再点取消 三年级2班');
r = await get('/api/status');
assert(Object.keys(r.data.released).length === 1 && r.data.released['三年级1班'], '回到 1/8 班');

// 不在表里的班级拒绝
r = await post('/api/admin/toggle', { pin: '123456', cls: '六年级99班' });
assert(r.status === 400, '非法班级被拒绝');

// 结束放学
r = await post('/api/admin/finish', { pin: '123456' });
assert(r.data.ok === true, '结束放学成功');
r = await get('/api/status');
assert(r.data.status === 'done', '状态 done');

// 重新开始：清除今日记录回到 idle
r = await post('/api/admin/reset', { pin: '123456' });
assert(r.data.ok === true, '重新开始成功');
r = await get('/api/status');
assert(r.data.status === 'idle', '状态回到 idle');

// PIN 锁定
const badHeaders = { 'CF-Connecting-IP': '9.9.9.9' };
async function badPost() {
  const req = new Request('https://x.test/api/admin/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...badHeaders },
    body: JSON.stringify({ pin: '000000' }),
  });
  return worker.fetch(req, env);
}
for (let i = 0; i < 10; i++) await badPost();
r = await badPost();
assert(r.status === 429, '10次失败后锁定IP');

// 边缘缓存：mock caches，验证缓存命中时第二次请求不再读 KV
let kvGets = 0;
const _origGet = env.KV.get.bind(env.KV);
const countingEnv = { KV: { ...env.KV, async get(k){ kvGets++; return _origGet(k); } }, ADMIN_PIN: '123456' };
const memCache = new Map();
globalThis.caches = { default: {
  async match(req){ const e = memCache.get(req.url); return e ? new Response(e.body, { status: 200, headers: e.headers }) : undefined; },
  async put(req, res){ memCache.set(req.url, { body: await res.text(), headers: Object.fromEntries(res.headers.entries()) }); },
}};
let _pending = [];
const fakeCtx = { waitUntil(p){ _pending.push(p); } };
async function getCached(path){
  _pending = [];
  const res = await worker.fetch(new Request('https://x.test' + path, { headers }), countingEnv, fakeCtx);
  await Promise.all(_pending);
  return res;
}
kvGets = 0;
let c1 = await getCached('/api/status'); await c1.json();
let c2 = await getCached('/api/status'); const c2data = await c2.json();
assert(kvGets === 2, '边缘缓存生效：idle 下首次 2 次 KV 读，第二次命中缓存 0 次');
assert(c2data.status === 'idle', '缓存返回的数据内容一致');
delete globalThis.caches;

console.log('\n全部测试通过 ✓');
