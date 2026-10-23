// LexalysClips — ranking Shorts maker. Run: npm start  ->  http://localhost:4545
// Frontend: Next.js app in ./web (built to ./web/out). Falls back to ./public if not built.
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition, ensureBrowser } = require('@remotion/renderer');

const PORT = process.env.PORT || 4545;
const ROOT = __dirname;
const D = (...p) => path.join(ROOT, 'data', ...p);

// ---- resolve ffmpeg/ffprobe robustly so the app survives moving between machines ----
function resolveFfmpegDir() {
  const env = process.env.FFMPEG_DIR;                                   // 1. explicit override
  if (env && fs.existsSync(path.join(env, 'ffmpeg.exe'))) return env;
  try {                                                                 // 2. on PATH
    const hit = execSync('where ffmpeg', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split(/\r?\n/)[0];
    if (hit && fs.existsSync(hit)) return path.dirname(hit);
  } catch {}
  try {                                                                 // 3. WinGet packages (any user / version)
    const roots = [process.env.LOCALAPPDATA, 'C:\\Users\\Administrator\\AppData\\Local']
      .filter(Boolean).map((r) => path.join(r, 'Microsoft', 'WinGet', 'Packages'));
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const pkg = fs.readdirSync(root).find((d) => /^Gyan\.FFmpeg/i.test(d));
      if (!pkg) continue;
      const build = fs.readdirSync(path.join(root, pkg)).find((d) => /ffmpeg-.*build/i.test(d));
      const bin = build && path.join(root, pkg, build, 'bin', 'ffmpeg.exe');
      if (bin && fs.existsSync(bin)) return path.dirname(bin);
    }
  } catch {}
  return '';                                                            // 4. give up -> rely on PATH
}
const FFDIR = resolveFfmpegDir();
const FFMPEG = FFDIR ? path.join(FFDIR, 'ffmpeg.exe') : 'ffmpeg';
const FFPROBE = FFDIR ? path.join(FFDIR, 'ffprobe.exe') : 'ffprobe';
const YTDLP = path.join(ROOT, 'assets', 'bin', 'yt-dlp.exe');           // bundled standalone downloader
const BASE = `http://localhost:${PORT}`;
for (const d of ['media', 'thumbs', 'projects', 'templates', 'output', 'tmp']) fs.mkdirSync(D(d), { recursive: true });

const readJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };
const writeJSON = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2));
const MEDIA_INDEX = D('media', 'index.json');
const media = () => readJSON(MEDIA_INDEX, []);
const saveMedia = (m) => writeJSON(MEDIA_INDEX, m);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { windowsHide: true }); let out = '', err = '';
  p.stdout.on('data', (d) => out += d); p.stderr.on('data', (d) => err += d); p.on('close', (c) => c === 0 ? res(out) : rej(new Error(err.slice(-800)))); });

// ------------------------------------------------------------ media ingest
const jobs = {}; // id -> {type,status,progress,msg,result}
async function ingest(srcPath, name, source, opts = {}) {
  const id = uid(); const isImg = /\.(jpe?g|png|webp)$/i.test(srcPath);
  if (isImg) {
    const file = id + path.extname(srcPath).toLowerCase(); fs.copyFileSync(srcPath, D('media', file));
    await run(FFMPEG, ['-y', '-i', D('media', file), '-vf', 'scale=320:-2', D('thumbs', id + '.jpg')]);
    const m = { id, name, file, isImage: true, duration: 4, thumb: id + '.jpg', source, added: Date.now() };
    saveMedia([m, ...media()]); return m;
  }
  const file = id + '.mp4';
  // detect baked-in black bars (letterbox / pillarbox) and crop them away
  let crop = '';
  try {
    const probe = JSON.parse(await run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', srcPath]));
    const iw = probe.streams[0].width, ih = probe.streams[0].height, dur = parseFloat(probe.format.duration) || 10;
    const det = await new Promise((res) => { const p = spawn(FFMPEG, ['-ss', String(Math.min(2, dur / 4)), '-t', String(Math.min(6, dur / 2)), '-i', srcPath, '-vf', 'fps=4,cropdetect=24:2:0', '-f', 'null', '-'], { windowsHide: true });
      let e = ''; p.stderr.on('data', (d) => e += d); p.on('close', () => res(e)); });
    // union of all detected boxes: dark scenes must not shrink the crop
    const all = [...det.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].map((m) => m.slice(1).map(Number));
    if (all.length) {
      const x0 = Math.min(...all.map((c) => c[2])), y0 = Math.min(...all.map((c) => c[3]));
      const x1 = Math.max(...all.map((c) => c[2] + c[0])), y1 = Math.max(...all.map((c) => c[3] + c[1]));
      let w = (x1 - x0) & ~1, h = (y1 - y0) & ~1;
      if ((h < ih * 0.93 || w < iw * 0.93) && w > iw * 0.5 && h > ih * 0.3) crop = `crop=${w}:${h}:${x0}:${y0},`;
    }
  } catch {}
  // normalise: h264 30fps, longest side <= 1920, aac -> fast & reliable for Remotion
  await run(FFMPEG, ['-y', '-i', srcPath, '-vf', crop + "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',fps=30", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', D('media', file)]);
  const pr = JSON.parse(await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,codec_type', '-of', 'json', D('media', file)]));
  const v = pr.streams.find((s) => s.codec_type === 'video') || {}; const hasAudio = pr.streams.some((s) => s.codec_type === 'audio');
  const duration = parseFloat(pr.format.duration);
  await run(FFMPEG, ['-y', '-ss', String(Math.min(1, duration / 3)), '-i', D('media', file), '-frames:v', '1', '-vf', 'scale=320:-2', D('thumbs', id + '.jpg')]);
  const m = { id, name, file, duration, width: v.width, height: v.height, hasAudio, keepAudio: !!opts.keepAudio && hasAudio, thumb: id + '.jpg', source, added: Date.now() };
  saveMedia([m, ...media()]); return m;
}

const app = express();
// Remotion's renderer runs on another port: fonts (FontFace) need CORS
app.use((req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });
app.use(express.json({ limit: '5mb' }));
app.set('trust proxy', true);
require('./auth')(app, path.join(ROOT, 'data')); // password gate (RANKREEL_PASSWORD)
const WEB_OUT = path.join(ROOT, 'web', 'out');
const UI_DIR = fs.existsSync(path.join(WEB_OUT, 'index.html')) ? WEB_OUT : path.join(ROOT, 'public');
app.use('/', express.static(UI_DIR, { extensions: ['html'] }));
app.use('/media', express.static(D('media')));
app.use('/thumbs', express.static(D('thumbs')));
app.use('/output', express.static(D('output')));
app.use('/assets', express.static(path.join(ROOT, 'assets')));

const upload = multer({ dest: D('tmp'), limits: { fileSize: 2 * 1024 * 1024 * 1024 } });
app.post('/api/upload', upload.array('files', 50), async (req, res) => {
  const jid = uid(); jobs[jid] = { type: 'upload', status: 'running', progress: 0, msg: `processing ${req.files.length} file(s)` }; res.json({ job: jid });
  const out = [];
  for (let i = 0; i < req.files.length; i++) {
    const f = req.files[i]; const ext = path.extname(f.originalname) || '.mp4'; const p2 = f.path + ext; fs.renameSync(f.path, p2);
    try { out.push(await ingest(p2, f.originalname, 'upload')); } catch (e) { jobs[jid].msg = 'error: ' + e.message.slice(0, 200); }
    try { fs.unlinkSync(p2); } catch {}
    jobs[jid].progress = (i + 1) / req.files.length;
  }
  Object.assign(jobs[jid], { status: 'done', result: out });
});

app.post('/api/link', async (req, res) => {
  const { url, start, end, name, keepAudio } = req.body; if (!url) return res.status(400).json({ error: 'url required' });
  const jid = uid(); jobs[jid] = { type: 'link', status: 'running', progress: 0, msg: 'downloading ' + url }; res.json({ job: jid });
  const tmp = D('tmp', jid + '.%(ext)s');
  // TikTok / Instagram: yt-dlp fetches the no-watermark source natively. Grab best quality, normalise later.
  const args = ['--no-playlist', '--no-warnings', '--no-part', '-N', '4', '--retries', '5', '--fragment-retries', '5',
    '-f', 'bv*+ba/b', '--merge-output-format', 'mp4', '-o', tmp];
  if (FFDIR) args.push('--ffmpeg-location', FFDIR);
  if (start || end) args.push('--download-sections', `*${start || 0}-${end || 'inf'}`, '--force-keyframes-at-cuts');
  // Instagram / Facebook now require a logged-in session: read cookies from the user's browser.
  const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
  const needsCookies = /instagram\.com|facebook\.com|fb\.watch|threads\.net/i.test(host);
  if (needsCookies) args.push('--cookies-from-browser', process.env.COOKIES_BROWSER || settings().cookiesBrowser || 'chrome');
  args.push(url);
  try {
    let title = name;
    if (!title) { try { title = (await run(YTDLP, ['--no-warnings', '--no-playlist', '--print', 'title', url])).trim().split(/\r?\n/)[0]; } catch { title = url; } }
    await run(YTDLP, args);
    const f = fs.readdirSync(D('tmp')).find((x) => x.startsWith(jid) && !x.endsWith('.part')); if (!f) throw new Error('download produced no file');
    jobs[jid].msg = 'normalising'; const m = await ingest(D('tmp', f), (title || url).slice(0, 80), url, { keepAudio });
    try { fs.unlinkSync(D('tmp', f)); } catch {}
    Object.assign(jobs[jid], { status: 'done', progress: 1, result: [m] });
  } catch (e) {
    let msg = (e.message || String(e)).slice(0, 400);
    if (/logged-in|cookies|empty media|login required|rate-limit/i.test(msg))
      msg = 'Instagram/this site needs a login. Open the post in Chrome while logged in, then try again (LexalysClips reads your browser login — pick the browser in Settings). ' + msg.slice(0, 160);
    Object.assign(jobs[jid], { status: 'error', msg });
  }
});

app.get('/api/media', (req, res) => res.json(media()));
app.delete('/api/media/:id', (req, res) => {
  const m = media(); const it = m.find((x) => x.id === req.params.id);
  if (it) { for (const f of [D('media', it.file), D('thumbs', it.thumb)]) try { fs.unlinkSync(f); } catch {} }
  saveMedia(m.filter((x) => x.id !== req.params.id)); res.json({ ok: true });
});
app.get('/api/jobs/:id', (req, res) => res.json(jobs[req.params.id] || { status: 'unknown' }));

// ------------------------------------------------------------ music (grouped + license info)
const KEVIN = new Set(['Clash_Defiant.mp3', 'Cyborg_Ninja.mp3', 'Epic_Unease.mp3', 'Exit_the_Premises.mp3', 'Hitman.mp3', 'Mechanolith.mp3', 'Severe_Tire_Damage.mp3', 'Volatile_Reaction.mp3']);
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// assets/music/library.json holds titles/artists for downloaded + uploaded tracks
const MUSIC_DIR = path.join(ROOT, 'assets', 'music'); const MUSIC_LIB = path.join(MUSIC_DIR, 'library.json');
const GROUP_NAMES = { hiphop: 'hip hop' };
function musicMeta(f, lib = readJSON(MUSIC_LIB, {})) {
  const L = lib[f];
  if (L) return { file: f, label: L.title || f, artist: L.artist || '', duration: L.duration || 0, group: L.group || 'other', needsCredit: !!L.needsCredit };
  const mk = /^mixkit_([a-z]+)_(\d+)\.(?:mp3|wav|m4a)$/i.exec(f);
  if (mk) return { file: f, label: `${cap1(mk[1])} ${mk[2]}`, group: GROUP_NAMES[mk[1].toLowerCase()] || mk[1].toLowerCase(), needsCredit: false };   // Mixkit Free License, no attribution
  if (KEVIN.has(f)) return { file: f, label: f.replace(/\.(mp3|wav|m4a)$/i, '').replace(/_/g, ' '), group: 'epic (credit)', needsCredit: true };
  return { file: f, label: f.replace(/\.(mp3|wav|m4a)$/i, '').replace(/[_-]/g, ' '), group: 'other', needsCredit: false };
}
app.get('/api/music', (req, res) => { const lib = readJSON(MUSIC_LIB, {}); res.json(
  fs.readdirSync(MUSIC_DIR).filter((f) => /\.(mp3|wav|m4a)$/i.test(f)).map((f) => musicMeta(f, lib))
    .sort((a, b) => ((b.group === 'my uploads') - (a.group === 'my uploads')) || (a.needsCredit - b.needsCredit) || a.group.localeCompare(b.group) || a.label.localeCompare(b.label))
); });
// add your own tracks (e.g. downloaded from the YouTube Audio Library)
app.post('/api/music/upload', upload.array('files', 50), (req, res) => {
  const lib = readJSON(MUSIC_LIB, {}); const added = [];
  for (const f of req.files || []) {
    const ext = (path.extname(f.originalname) || '.mp3').toLowerCase();
    if (!/^\.(mp3|wav|m4a)$/.test(ext)) { try { fs.unlinkSync(f.path); } catch {} continue; }
    const base = path.basename(f.originalname, path.extname(f.originalname));
    const slug = base.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 50) || 'track';
    let file = `my_${slug}${ext}`; let k = 2; while (fs.existsSync(path.join(MUSIC_DIR, file))) file = `my_${slug}_${k++}${ext}`;
    fs.copyFileSync(f.path, path.join(MUSIC_DIR, file)); try { fs.unlinkSync(f.path); } catch {}
    lib[file] = { title: base.replace(/[_-]+/g, ' ').trim(), artist: '', group: 'my uploads', needsCredit: req.body.needsCredit === 'true' };
    added.push(file);
  }
  writeJSON(MUSIC_LIB, lib); res.json({ added });
});
app.get('/api/fonts', (req, res) => res.json(['Anton', 'Bebas Neue', 'Oswald', 'Montserrat', 'Archivo Black', 'Bangers']));

// ------------------------------------------------------------ settings (Groq key stored server-side, never echoed back)
const SETTINGS_FILE = D('settings.json');
const settings = () => readJSON(SETTINGS_FILE, { groqKey: '', captionStyle: 'pop', cookiesBrowser: 'chrome' });
app.get('/api/settings', (req, res) => { const s = settings(); res.json({ ...s, groqKey: s.groqKey ? '***set***' : '' }); });
app.put('/api/settings', (req, res) => {
  const cur = settings(); const next = { ...cur, ...req.body };
  if (req.body.groqKey === '***set***' || req.body.groqKey === undefined) next.groqKey = cur.groqKey;  // don't clobber with mask/omitted
  writeJSON(SETTINGS_FILE, next); res.json({ ok: true, hasKey: !!next.groqKey });
});

// ------------------------------------------------------------ AI: viral title / hashtags / description (Groq, with no-key fallback)
async function groqChat(key, messages, model = 'llama-3.3-70b-versatile') {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.9, max_tokens: 800, response_format: { type: 'json_object' } }),
  });
  if (!r.ok) throw new Error('Groq ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return (await r.json()).choices[0].message.content;
}
function heuristicMeta(topic, items) {
  const T = (topic || 'THIS').replace(/[^\w\s]/g, '').trim().toUpperCase();
  const titles = [`${T} 🤯`, `TOP ${items.length} ${T} (WAIT FOR #1)`, `YOU WON'T BELIEVE #1 😳`, (/^(RANKING|TOP)\b/.test(T) ? `${T} 🔥` : `RANKING ${T} 🔥`), `${T} #shorts`];
  const words = [...new Set(((topic || '') + ' ' + items.map((i) => i.label || '').join(' ')).toLowerCase().match(/[a-z]{3,}/g) || [])].slice(0, 7);
  const hashtags = [...new Set(['shorts', 'viral', 'fyp', 'ranking', 'trending', 'top10', ...words])].slice(0, 12);
  const description = `${topic} — ranked! Which one surprised you most? Comment 👇 and subscribe for daily rankings.\n\n#${hashtags.slice(0, 6).join(' #')}`;
  return { titles, description, hashtags, hook: 'WAIT FOR #1' };
}
app.post('/api/generate-meta/:id', async (req, res) => {
  const p = readJSON(path.join(P_DIR, req.params.id + '.json'), null); if (!p) return res.status(404).json({ error: 'no project' });
  const items = p.items || []; const topic = p.title || 'ranking video';
  const key = (settings().groqKey || process.env.GROQ_API_KEY);
  if (key) {
    try {
      const sys = 'You are a viral YouTube Shorts strategist. Return STRICT JSON with keys: titles (array of 5 punchy titles under 60 chars, curiosity/retention driven), description (2-3 sentence YouTube description ending with a subscribe CTA), hashtags (array of 12 relevant hashtags, no # symbol), hook (3-5 word on-screen opening hook, UPPERCASE).';
      const labels = items.map((it, i) => `#${items.length - i}: ${it.label || '(no label)'}`).join('\n');
      const out = await groqChat(key, [{ role: 'system', content: sys }, { role: 'user', content: `Video title: ${topic}\nRanked items (top listed first = highest number):\n${labels}` }]);
      return res.json({ source: 'groq', ...JSON.parse(out) });
    } catch (e) { return res.json({ source: 'builtin', note: 'Groq failed (' + (e.message || '').slice(0, 80) + '), used built-in generator', ...heuristicMeta(topic, items) }); }
  }
  res.json({ source: 'builtin', note: 'Add a Groq key in Settings for AI-powered variety', ...heuristicMeta(topic, items) });
});

// ------------------------------------------------------------ auto-captions (speech -> word-timed captions via Groq Whisper)
async function groqTranscribe(key, wavPath) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(wavPath)]), 'audio.wav');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!r.ok) throw new Error('Groq ASR ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return r.json();
}
app.post('/api/captions/:id', async (req, res) => {
  const pfile = path.join(P_DIR, req.params.id + '.json'); const p = readJSON(pfile, null); if (!p) return res.status(404).json({ error: 'no project' });
  const key = (settings().groqKey || process.env.GROQ_API_KEY); if (!key) return res.status(400).json({ error: 'Add a free Groq API key in Settings to enable auto-captions.' });
  const jid = uid(); jobs[jid] = { type: 'captions', status: 'running', progress: 0, msg: 'extracting audio' }; res.json({ job: jid });
  try {
    const M = Object.fromEntries(media().map((m) => [m.id, m]));
    const caps = []; let timeline = 0; const items = p.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i]; const m = M[it.media]; const dur = Math.max(0.5, (+it.out || 0) - (+it.in || 0));
      if (m && !m.isImage && it.muted === false && m.hasAudio) {
        jobs[jid].msg = `transcribing clip ${i + 1}/${items.length}`; jobs[jid].progress = i / items.length;
        const wav = D('tmp', jid + '_' + i + '.wav');
        try {
          await run(FFMPEG, ['-y', '-ss', String(it.in), '-t', String(dur), '-i', D('media', m.file), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
          const tr = await groqTranscribe(key, wav);
          for (const w of (tr.words || [])) { const word = (w.word || '').trim(); if (word) caps.push({ word, start: +(timeline + (w.start || 0)).toFixed(2), end: +(timeline + (w.end || 0)).toFixed(2) }); }
        } catch (e) { jobs[jid].msg = 'asr warn: ' + (e.message || '').slice(0, 100); }
        try { fs.unlinkSync(wav); } catch {}
      }
      timeline += dur;
    }
    const p2 = readJSON(pfile, p); p2.captions = caps; p2.captionsOn = caps.length > 0; writeJSON(pfile, p2);
    Object.assign(jobs[jid], { status: 'done', progress: 1, msg: caps.length ? `${caps.length} words captioned` : 'no speech found (keep a clip\'s sound ON to caption it)', result: caps.length });
  } catch (e) { Object.assign(jobs[jid], { status: 'error', msg: (e.message || String(e)).slice(0, 300) }); }
});

// ------------------------------------------------------------ templates
const T_DIR = D('templates');
app.get('/api/templates', (req, res) => res.json(fs.readdirSync(T_DIR).filter((f) => f.endsWith('.json')).map((f) => readJSON(path.join(T_DIR, f), null)).filter(Boolean)));
app.put('/api/templates/:id', (req, res) => { const t = { ...req.body, id: req.params.id }; writeJSON(path.join(T_DIR, t.id + '.json'), t); res.json(t); });
app.post('/api/templates/:id/duplicate', (req, res) => {
  const t = readJSON(path.join(T_DIR, req.params.id + '.json'), null); if (!t) return res.status(404).end();
  const nt = { ...t, id: t.id + '_' + uid().slice(-4), name: t.name + ' (copy)' }; writeJSON(path.join(T_DIR, nt.id + '.json'), nt); res.json(nt);
});

// ------------------------------------------------------------ projects
const P_DIR = D('projects');
const projects = () => fs.readdirSync(P_DIR).filter((f) => f.endsWith('.json')).map((f) => readJSON(path.join(P_DIR, f), null)).filter(Boolean).sort((a, b) => b.updated - a.updated);
app.get('/api/projects', (req, res) => res.json(projects()));
app.post('/api/projects', (req, res) => {
  const p = { id: uid(), title: 'RANKING INSANE MOMENTS', hook: 'WAIT FOR #1', template: 'fire_rank', items: [], music: null, musicVolume: null,
    watermark: 'lexalysclips', status: 'draft', created: Date.now(), updated: Date.now(), ...req.body };
  writeJSON(path.join(P_DIR, p.id + '.json'), p); res.json(p);
});
app.put('/api/projects/:id', (req, res) => { const p = { ...readJSON(path.join(P_DIR, req.params.id + '.json'), {}), ...req.body, id: req.params.id, updated: Date.now() }; writeJSON(path.join(P_DIR, p.id + '.json'), p); res.json(p); });
app.delete('/api/projects/:id', (req, res) => { try { fs.unlinkSync(path.join(P_DIR, req.params.id + '.json')); } catch {} res.json({ ok: true }); });

// ------------------------------------------------------------ rendering
let bundled = null, bundledAt = 0;
const remotionMtime = () => Math.max(...fs.readdirSync(path.join(ROOT, 'remotion')).map((f) => fs.statSync(path.join(ROOT, 'remotion', f)).mtimeMs));
async function getBundle() {
  if (!bundled || remotionMtime() > bundledAt) { bundled = await bundle({ entryPoint: path.join(ROOT, 'remotion', 'index.tsx') }); bundledAt = Date.now(); }
  return bundled;
}
function buildProps(p) {
  const T = readJSON(path.join(T_DIR, p.template + '.json'), null); if (!T) throw new Error('template not found: ' + p.template);
  const M = Object.fromEntries(media().map((m) => [m.id, m]));
  const items = p.items.map((it) => { const m = M[it.media]; if (!m) throw new Error('missing media ' + it.media);
    return { src: `${BASE}/media/${m.file}`, in: +it.in || 0, out: +(it.out || (m.isImage ? 4 : m.duration)), label: it.label || '', muted: it.muted !== false, volume: it.volume ?? 1, isImage: !!m.isImage }; });
  const music = p.music === 'none' ? null : (p.music || T.music);
  return { title: p.title, hook: p.hook, items, template: T, assetsBase: `${BASE}/assets`, music: music ? `${BASE}/assets/music/${music}` : null,
    musicVolume: p.musicVolume ?? T.musicVolume, watermark: p.watermark ?? 'lexalysclips', outroText: p.outroText,
    captions: p.captionsOn ? (p.captions || []) : [], captionStyle: p.captionStyle || settings().captionStyle || 'pop' };
}
// Render speed knobs (benchmarked on the i5-8365U laptop: GPU 'angle' ~1.5x faster on full layouts, ~2.5x on boxed; more concurrency was slower)
const RENDER_GL = process.env.RENDER_GL === 'cpu' ? null : (process.env.RENDER_GL || 'angle');
const RENDER_CONCURRENCY = +process.env.RENDER_CONCURRENCY || Math.max(2, Math.floor(os.cpus().length / 2));
const queue = []; let rendering = false;
async function pump() {
  if (rendering || !queue.length) return; rendering = true;
  const { pid, jid, preview } = queue.shift(); const job = jobs[jid];
  try {
    const p = readJSON(path.join(P_DIR, pid + '.json'), null); if (!p) throw new Error('project not found');
    if (!p.items.length) throw new Error('project has no clips');
    job.status = 'running'; job.msg = 'bundling'; await ensureBrowser();
    const serveUrl = await getBundle(); const inputProps = buildProps(p);
    // GPU (ANGLE) rendering is ~2-3x faster on this laptop; falls back to CPU automatically if the GPU path fails.
    const chromiumOptions = RENDER_GL ? { gl: RENDER_GL } : {};
    const composition = await selectComposition({ serveUrl, id: 'RankReel', inputProps, chromiumOptions });
    const safe = (p.title || 'short').replace(/[^a-z0-9]+/gi, '_').slice(0, 50);
    const outName = `${safe}_${p.id}${preview ? '_preview' : ''}.mp4`;
    job.msg = 'rendering'; const t0 = Date.now();
    const opts = { composition, serveUrl, codec: 'h264', inputProps, outputLocation: D('output', outName), crf: preview ? 26 : 18,
      scale: preview ? 0.5 : 1, x264Preset: 'veryfast', audioBitrate: '256k', imageFormat: 'jpeg', jpegQuality: preview ? 70 : 90,
      concurrency: RENDER_CONCURRENCY, chromiumOptions, onProgress: ({ progress }) => { job.progress = progress; } };
    try { await renderMedia(opts); }
    catch (e) {
      if (!RENDER_GL) throw e;
      console.error('GPU render failed, retrying on CPU:', (e.message || '').slice(0, 200));
      job.msg = 'rendering (CPU fallback)'; job.progress = 0;
      await renderMedia({ ...opts, chromiumOptions: {} });
    }
    const p2 = readJSON(path.join(P_DIR, pid + '.json'), p);
    if (!preview) { p2.status = 'rendered'; p2.output = outName; p2.renderedAt = Date.now(); } else p2.preview = outName;
    writeJSON(path.join(P_DIR, pid + '.json'), p2);
    Object.assign(job, { status: 'done', progress: 1, msg: `done in ${Math.round((Date.now() - t0) / 1000)}s`, result: `/output/${outName}` });
  } catch (e) { Object.assign(job, { status: 'error', msg: (e.message || String(e)).slice(0, 600) }); console.error(e); }
  rendering = false; pump();
}
app.post('/api/render/:id', (req, res) => {
  const jid = uid(); jobs[jid] = { type: 'render', project: req.params.id, preview: !!req.body.preview, status: 'queued', progress: 0, msg: 'queued' };
  queue.push({ pid: req.params.id, jid, preview: !!req.body.preview }); pump(); res.json({ job: jid });
});
app.get('/api/renders', (req, res) => res.json(Object.entries(jobs).filter(([, j]) => j.type === 'render').map(([id, j]) => ({ id, ...j }))));
app.post('/api/open-output', (req, res) => { if (process.platform === 'win32') spawn('explorer.exe', [D('output')], { detached: true }).on('error', () => {}); res.json({ ok: true }); });

app.listen(PORT, () => {
  console.log(`LexalysClips running at ${BASE}`);
  console.log(`  ui:      ${UI_DIR}`);
  console.log(`  ffmpeg:  ${FFMPEG}`);
  console.log(`  yt-dlp:  ${fs.existsSync(YTDLP) ? YTDLP : 'MISSING (link import disabled)'}`);
  // pre-warm Remotion's headless browser so the first render isn't slow
  ensureBrowser().catch(() => {});
  // keep the bundled downloader current (TikTok/IG change often); non-blocking, best-effort
  if (fs.existsSync(YTDLP)) { try { spawn(YTDLP, ['-U', '--no-warnings'], { windowsHide: true, detached: true }).unref(); } catch {} }
});
