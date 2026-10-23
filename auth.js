// ─────────────────────────────────────────────────────────────
//  LexalysClips — password gate.
//  Set a password with the env var RANKREEL_PASSWORD (recommended on a server)
//  or "appPassword" in data/settings.json. No password set = no gate (local use).
//  Login lasts 30 days per browser. Changing the password signs everyone out.
// ─────────────────────────────────────────────────────────────
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COOKIE = 'rr_auth';
const MAX_AGE = 30 * 24 * 3600; // seconds

module.exports = function setupAuth(app, dataDir) {
  const settingsFile = path.join(dataDir, 'settings.json');
  const secretFile = path.join(dataDir, '.auth_secret');

  const password = () => {
    if (process.env.RANKREEL_PASSWORD) return String(process.env.RANKREEL_PASSWORD);
    try { return String(JSON.parse(fs.readFileSync(settingsFile, 'utf8')).appPassword || ''); } catch { return ''; }
  };
  let secret = process.env.RANKREEL_SECRET || '';
  if (!secret) {
    try { secret = fs.readFileSync(secretFile, 'utf8').trim(); } catch {}
    if (!secret) { secret = crypto.randomBytes(32).toString('hex'); try { fs.writeFileSync(secretFile, secret); } catch {} }
  }
  const tokenFor = (pw) => crypto.createHmac('sha256', secret).update('rankreel:' + pw).digest('hex');
  const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const readCookie = (req) => {
    const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
    return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : '';
  };
  const isAuthed = (req) => { const pw = password(); return !pw || same(readCookie(req), tokenFor(pw)); };
  const secure = (req) => req.secure || req.headers['x-forwarded-proto'] === 'https';

  // simple brute-force brake: 8 wrong tries per IP per 15 minutes
  const fails = new Map();
  const ipOf = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  app.get('/api/auth', (req, res) => res.json({ required: !!password(), ok: isAuthed(req) }));

  app.post('/api/login', (req, res) => {
    const pw = password();
    if (!pw) return res.json({ ok: true });
    const ip = ipOf(req); const now = Date.now();
    const f = (fails.get(ip) || []).filter((t) => now - t < 15 * 60e3);
    if (f.length >= 8) return res.status(429).json({ error: 'Too many wrong tries. Wait 15 minutes and try again.' });
    if (!same((req.body && req.body.password) || '', pw)) {
      f.push(now); fails.set(ip, f);
      return res.status(401).json({ error: 'Wrong password' });
    }
    fails.delete(ip);
    res.setHeader('Set-Cookie', `${COOKIE}=${tokenFor(pw)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure(req) ? '; Secure' : ''}`);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  });

  app.get('/login', (req, res) => res.type('html').send(LOGIN_HTML));

  // everything below this line needs a valid login
  // the video renderer (headless Chrome on this same machine) loads fonts/clips over http://localhost
  const LOOPBACK = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/;
  const isRenderer = (req) => req.method === 'GET' && !req.headers['x-forwarded-for'] &&
    LOOPBACK.test(req.socket.remoteAddress || '') && /^\/(assets|media|thumbs|output)\//.test(req.path);

  app.use((req, res, next) => {
    if (isAuthed(req) || isRenderer(req)) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Login required', auth: true });
    const accepts = req.headers.accept || '';
    if (req.method === 'GET' && accepts.includes('text/html')) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    res.status(401).send('Login required');
  });
};

const LOGIN_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#08080a"><title>LexalysClips · Sign in</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20width%3D%2232%22%20height%3D%2232%22%20rx%3D%228%22%20fill%3D%22%23c6f432%22/%3E%3Crect%20x%3D%225.5%22%20y%3D%2217%22%20width%3D%224%22%20height%3D%228%22%20rx%3D%221.2%22%20fill%3D%22%230a0b05%22/%3E%3Crect%20x%3D%2211%22%20y%3D%2212.5%22%20width%3D%224%22%20height%3D%2212.5%22%20rx%3D%221.2%22%20fill%3D%22%230a0b05%22/%3E%3Cpath%20d%3D%22M17.5%207.8c0-.95%201.03-1.54%201.85-1.06l8.6%208.9c.75.5.75%201.6%200%202.1l-8.6%208.4c-.82.48-1.85-.11-1.85-1.06Z%22%20fill%3D%22%230a0b05%22/%3E%3C/svg%3E">
<style>
  :root{--bg:#08080a;--surface:#0f0f12;--s2:#151519;--border:#212126;--bs:#2d2d33;--text:#f4f4f5;--muted:#8d8d96;--faint:#5a5a63;--accent:#c6f432;--ink:#0a0b05;--danger:#ff5a5f}
  *{box-sizing:border-box}html,body{height:100%;margin:0}
  body{background:var(--bg);color:var(--text);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;place-items:center;padding:16px;-webkit-font-smoothing:antialiased}
  .card{width:100%;max-width:360px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px 24px}
  .brand{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:600;letter-spacing:-.03em}.brand svg{filter:drop-shadow(0 0 6px rgba(198,244,50,.55)) drop-shadow(0 0 14px rgba(198,244,50,.25))}
  p{color:var(--muted);margin:6px 0 22px;font-size:13px}
  label{display:block;font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
  .row{position:relative}
  input{width:100%;height:46px;padding:0 44px 0 14px;border-radius:9px;border:1px solid var(--bs);background:var(--s2);color:var(--text);font-size:16px;outline:none}
  input:focus{border-color:rgba(198,244,50,.5)}
  .eye{position:absolute;right:4px;top:4px;height:38px;width:38px;border:0;background:transparent;color:var(--muted);border-radius:7px;cursor:pointer;font-size:12px}
  button.go{margin-top:14px;width:100%;height:46px;border:0;border-radius:9px;background:var(--accent);color:var(--ink);font-weight:600;font-size:14px;cursor:pointer}
  button.go:disabled{opacity:.5}
  .err{color:var(--danger);font-size:12.5px;min-height:18px;margin-top:10px}
</style></head><body>
<form class="card" id="f" autocomplete="on">
  <div class="brand"><svg width="30" height="30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#c6f432"/><rect x="5.5" y="17" width="4" height="8" rx="1.2" fill="#0a0b05"/><rect x="11" y="12.5" width="4" height="12.5" rx="1.2" fill="#0a0b05"/><path d="M17.5 7.8c0-.95 1.03-1.54 1.85-1.06l8.6 8.9c.75.5.75 1.6 0 2.1l-8.6 8.4c-.82.48-1.85-.11-1.85-1.06Z" fill="#0a0b05"/></svg><span>lexalysclips</span></div>
  <p>This studio is private. Enter the password to continue.</p>
  <label for="pw">Password or PIN</label>
  <div class="row">
    <input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
    <button type="button" class="eye" id="eye" aria-label="Show password">Show</button>
  </div>
  <button class="go" id="go" type="submit">Unlock</button>
  <div class="err" id="err" role="alert"></div>
</form>
<script>
  var f=document.getElementById('f'),pw=document.getElementById('pw'),go=document.getElementById('go'),err=document.getElementById('err'),eye=document.getElementById('eye');
  eye.onclick=function(){var s=pw.type==='password';pw.type=s?'text':'password';eye.textContent=s?'Hide':'Show';pw.focus();};
  f.onsubmit=async function(e){e.preventDefault();err.textContent='';go.disabled=true;go.textContent='Checking…';
    try{var r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw.value})});
      var d=await r.json().catch(function(){return{}});
      if(r.ok){var n=new URLSearchParams(location.search).get('next')||'/';location.replace(n.charAt(0)==='/'&&n.charAt(1)!=='/'?n:'/');return;}
      err.textContent=d.error||'Wrong password';pw.select();
    }catch(x){err.textContent='Cannot reach the server.';}
    go.disabled=false;go.textContent='Unlock';};
</script>
</body></html>`;
