// FARAZ Studio front-end (vanilla JS)
const $ = (s) => document.querySelector(s);
const api = async (url, opt = {}) => { const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opt, body: opt.body && typeof opt.body !== 'string' && !(opt.body instanceof FormData) ? JSON.stringify(opt.body) : opt.body }); return r.json(); };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const esc = (s) => (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
let MEDIA = [], TEMPLATES = [], MUSIC = [], FONTS = [], P = null, PROJECTS = [], saveTimer = null;

// ------------------------------------------------ tabs
document.querySelectorAll('.tab').forEach((b) => b.onclick = () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tabpane').forEach((x) => x.classList.toggle('active', x.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'queue') loadQueue(); if (b.dataset.tab === 'templates') renderTplList();
});

// ------------------------------------------------ media
async function loadMedia() { MEDIA = await api('/api/media'); renderMedia(); }
function renderMedia() {
  const q = $('#mediaFilter').value.toLowerCase();
  $('#mediaGrid').innerHTML = MEDIA.filter((m) => !q || m.name.toLowerCase().includes(q)).map((m) => `
    <div class="card" title="${esc(m.name)}"><img src="/thumbs/${m.thumb}" loading="lazy"><span class="d">${m.isImage ? 'IMG' : fmt(m.duration)}</span>
      <button class="add" data-id="${m.id}">＋</button><button class="del" data-id="${m.id}">✕</button><div class="meta">${esc(m.name)}</div></div>`).join('');
  $('#mediaGrid').querySelectorAll('.add').forEach((b) => b.onclick = () => addItem(b.dataset.id));
  $('#mediaGrid').querySelectorAll('.del').forEach((b) => b.onclick = async () => { if (confirm('Delete this media file?')) { await api('/api/media/' + b.dataset.id, { method: 'DELETE' }); loadMedia(); } });
}
$('#mediaFilter').oninput = renderMedia;
async function watchJob(jid, el, done) {
  const t = setInterval(async () => {
    const j = await api('/api/jobs/' + jid);
    el.textContent = `${j.msg || j.status}${j.progress ? ` — ${Math.round(j.progress * 100)}%` : ''}`;
    if (j.status === 'done' || j.status === 'error') { clearInterval(t); done && done(j); }
  }, 1000);
}
$('#file').onchange = async (e) => {
  const fd = new FormData(); [...e.target.files].forEach((f) => fd.append('files', f));
  $('#ingestStatus').textContent = 'uploading…';
  const r = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json());
  watchJob(r.job, $('#ingestStatus'), () => { loadMedia(); e.target.value = ''; });
};
$('#linkGo').onclick = async () => {
  const url = $('#linkUrl').value.trim(); if (!url) return;
  $('#ingestStatus').textContent = 'starting…';
  const r = await api('/api/link', { method: 'POST', body: { url, start: $('#linkStart').value || null, end: $('#linkEnd').value || null, keepAudio: $('#linkKeepAudio').checked } });
  watchJob(r.job, $('#ingestStatus'), (j) => { loadMedia(); if (j.status === 'done') { $('#linkUrl').value = ''; $('#linkStart').value = ''; $('#linkEnd').value = ''; } });
};

// ------------------------------------------------ projects
async function loadProjects(selectId) {
  PROJECTS = await api('/api/projects');
  if (!PROJECTS.length) { await api('/api/projects', { method: 'POST', body: {} }); PROJECTS = await api('/api/projects'); }
  $('#projSel').innerHTML = PROJECTS.map((p) => `<option value="${p.id}">${esc(p.title)} ${p.status === 'rendered' ? '✓' : ''}</option>`).join('');
  const id = selectId || (P && P.id) || PROJECTS[0].id; $('#projSel').value = id; openProject(id); updateQCount();
}
function openProject(id) {
  P = PROJECTS.find((p) => p.id === id); if (!P) return;
  $('#pTitle').value = P.title || ''; $('#pHook').value = P.hook || ''; $('#pTemplate').value = P.template;
  $('#pWatermark').value = P.watermark ?? 'lexalysclips'; $('#pOutro').value = P.outroText || '';
  $('#pCapStyle').value = P.captionStyle || 'pop';
  const T = TEMPLATES.find((t) => t.id === P.template);
  buildMusicSelect($('#pMusic'), P.music || '');
  $('#pMusicVol').value = P.musicVolume ?? T?.musicVolume ?? 0.35; $('#mvVal').textContent = $('#pMusicVol').value;
  swatch($('#tplSwatch'), T); renderItems(); updateViralHint();
  showOutput(P.output ? '/output/' + P.output : (P.preview ? '/output/' + P.preview : null));
}
$('#projSel').onchange = () => openProject($('#projSel').value);
$('#projNew').onclick = async () => { const p = await api('/api/projects', { method: 'POST', body: { template: $('#pTemplate').value || 'fire_rank' } }); loadProjects(p.id); };
$('#projDup').onclick = async () => { const { id, created, updated, output, preview, status, captions, ...rest } = P; const p = await api('/api/projects', { method: 'POST', body: { ...rest, title: P.title + ' (2)' } }); loadProjects(p.id); };
$('#projDel').onclick = async () => { if (!confirm('Delete this Short?')) return; await api('/api/projects/' + P.id, { method: 'DELETE' }); P = null; loadProjects(); };
const bindField = (sel, key, num) => $(sel).oninput = () => { P[key] = num ? +$(sel).value : $(sel).value; if (sel === '#pMusicVol') $('#mvVal').textContent = $(sel).value; queueSave(); if (key === 'title') refreshSelLabel(); };
bindField('#pTitle', 'title'); bindField('#pHook', 'hook'); bindField('#pWatermark', 'watermark'); bindField('#pOutro', 'outroText'); bindField('#pMusicVol', 'musicVolume', true);
$('#pTemplate').onchange = () => { P.template = $('#pTemplate').value; const T = TEMPLATES.find((t) => t.id === P.template); swatch($('#tplSwatch'), T); if (P.musicVolume == null) $('#pMusicVol').value = T.musicVolume; queueSave(); };
$('#pMusic').onchange = () => { P.music = $('#pMusic').value || null; queueSave(); };
$('#pCapStyle').onchange = () => { P.captionStyle = $('#pCapStyle').value; queueSave(); };
function refreshSelLabel() { const o = $('#projSel').selectedOptions[0]; if (o) o.textContent = P.title; }
function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveProject, 500); }
async function saveProject() { if (!P) return; const { id, ...body } = P; P = await api('/api/projects/' + id, { method: 'PUT', body }); const i = PROJECTS.findIndex((x) => x.id === P.id); PROJECTS[i] = P; }
$('#save').onclick = async () => { await saveProject(); $('#renderStatus').textContent = 'saved ✓'; };

// grouped music select (value = filename; ⚠ = needs a credit line)
function buildMusicSelect(sel, selectedFile) {
  const groups = {}; MUSIC.forEach((m) => (groups[m.group] ||= []).push(m));
  let html = '<option value="">(template default)</option><option value="none">No music</option>';
  Object.keys(groups).forEach((g) => { html += `<optgroup label="${g}">` + groups[g].map((m) => `<option value="${m.file}">${m.label}${m.needsCredit ? ' ⚠' : ''}</option>`).join('') + '</optgroup>'; });
  sel.innerHTML = html; if (selectedFile != null) sel.value = selectedFile;
}

// ------------------------------------------------ viral tools
function updateViralHint() {
  const n = (P && P.captions) ? P.captions.length : 0;
  $('#viralHint').textContent = P && P.captionsOn && n ? `captions on · ${n} words` : '';
}
$('#genMeta').onclick = async () => {
  if (!P) return; await saveProject();
  $('#viralHint').textContent = 'thinking…';
  const r = await api('/api/generate-meta/' + P.id, { method: 'POST', body: {} });
  $('#viralHint').textContent = '';
  if (r.error) return alert(r.error);
  showMetaModal(r);
};
$('#genCaps').onclick = async () => {
  if (!P) return; await saveProject();
  const soundClips = P.items.filter((it) => it.muted === false).length;
  if (!soundClips) return alert('Auto-captions read a clip\'s own speech.\nTurn a clip\'s 🔊 sound ON first (the funny/talking ones), then run this.');
  $('#viralHint').textContent = 'transcribing…';
  const r = await api('/api/captions/' + P.id, { method: 'POST', body: {} });
  if (r.error) { $('#viralHint').textContent = ''; return alert(r.error); }
  watchJob(r.job, $('#viralHint'), async () => { PROJECTS = await api('/api/projects'); P = PROJECTS.find((x) => x.id === P.id); updateViralHint(); });
};

// ------------------------------------------------ ranking items
function addItem(mid) {
  const m = MEDIA.find((x) => x.id === mid); if (!P || !m) return;
  const out = m.isImage ? 3 : Math.min(m.duration, 6);
  P.items.unshift({ media: mid, in: 0, out: +out.toFixed(2), label: '', muted: !(m.keepAudio) });
  renderItems(); queueSave();
}
function renderItems() {
  const n = P.items.length; const total = P.items.reduce((a, it) => a + Math.max(0.5, (+it.out || 0) - (+it.in || 0)), 0);
  $('#dur').textContent = `${n} clips · ${total.toFixed(1)} s`; $('#dur').classList.toggle('warn', total > 60);
  $('#stats').textContent = `${MEDIA.length} media · ${PROJECTS.length} shorts`;
  if (!n) { $('#items').innerHTML = '<div class="empty">Add clips from the Media panel (＋). Drag cards to reorder.<br>Top card plays first (highest number); bottom card is #1.</div>'; return; }
  $('#items').innerHTML = P.items.map((it, i) => { const m = MEDIA.find((x) => x.id === it.media) || {}; const on = it.muted === false; return `
    <div class="item" data-i="${i}">
      <div class="drag-handle" draggable="true" title="Drag to reorder">⋮⋮</div>
      <div class="rank">#${n - i}</div>
      <img src="/thumbs/${m.thumb}">
      <div class="f">
        <input class="lab" placeholder="Label for #${n - i} (e.g. No-look touch)" value="${esc(it.label)}">
        <div class="row"><label>IN</label><input class="in" type="number" step="0.1" min="0" value="${it.in}"><label>OUT</label><input class="out" type="number" step="0.1" min="0" value="${it.out}">
          <span class="pill">${m.isImage ? 'image' : 'of ' + fmt(m.duration || 0)}</span></div>
        <div class="tools">
          <button class="audtog ${on ? 'on' : 'off'}" title="Keep this clip's original sound?">${on ? '🔊 Sound ON' : '🔇 Muted'}</button>
          ${m.isImage ? '' : '<button class="btn sm pv">▶ Trim</button>'}
          <button class="btn sm ghost danger rm">✕ Remove</button>
        </div>
        <div class="pvbox"></div>
      </div>
    </div>`; }).join('');
  $('#items').querySelectorAll('.item').forEach((row) => {
    const i = +row.dataset.i, it = P.items[i], m = MEDIA.find((x) => x.id === it.media) || {};
    row.querySelector('.lab').oninput = (e) => { it.label = e.target.value; queueSave(); };
    row.querySelector('.in').oninput = (e) => { it.in = +e.target.value; queueSave(); updDur(); };
    row.querySelector('.out').oninput = (e) => { it.out = +e.target.value; queueSave(); updDur(); };
    row.querySelector('.audtog').onclick = (e) => { it.muted = !(it.muted === false) ? false : true; const on = it.muted === false; e.target.className = 'audtog ' + (on ? 'on' : 'off'); e.target.textContent = on ? '🔊 Sound ON' : '🔇 Muted'; queueSave(); };
    row.querySelector('.rm').onclick = () => { P.items.splice(i, 1); renderItems(); queueSave(); };
    const pv = row.querySelector('.pv'); if (pv) pv.onclick = () => {
      const box = row.querySelector('.pvbox'); if (box.innerHTML) { box.innerHTML = ''; return; }
      box.innerHTML = `<video src="/media/${m.file}#t=${it.in}" controls muted></video><div class="tools"><button class="btn sm si">Set IN here</button><button class="btn sm so">Set OUT here</button><button class="btn sm pl">Play IN→OUT</button></div>`;
      const v = box.querySelector('video');
      box.querySelector('.si').onclick = () => { it.in = +v.currentTime.toFixed(2); row.querySelector('.in').value = it.in; queueSave(); updDur(); };
      box.querySelector('.so').onclick = () => { it.out = +v.currentTime.toFixed(2); row.querySelector('.out').value = it.out; queueSave(); updDur(); };
      box.querySelector('.pl').onclick = () => { v.currentTime = it.in; v.play(); const s = () => { if (v.currentTime >= it.out) { v.pause(); v.removeEventListener('timeupdate', s); } }; v.addEventListener('timeupdate', s); };
    };
    // drag & drop via the handle
    const h = row.querySelector('.drag-handle');
    h.ondragstart = (e) => { row.classList.add('drag'); e.dataTransfer.setData('text/plain', i); };
    h.ondragend = () => row.classList.remove('drag');
    row.ondragover = (e) => { e.preventDefault(); row.classList.add('over'); };
    row.ondragleave = () => row.classList.remove('over');
    row.ondrop = (e) => { e.preventDefault(); row.classList.remove('over'); const from = +e.dataTransfer.getData('text/plain'); if (from === i) return; const [x] = P.items.splice(from, 1); P.items.splice(i, 0, x); renderItems(); queueSave(); };
  });
}
function updDur() { const total = P.items.reduce((a, it) => a + Math.max(0.5, (+it.out || 0) - (+it.in || 0)), 0); $('#dur').textContent = `${P.items.length} clips · ${total.toFixed(1)} s`; $('#dur').classList.toggle('warn', total > 60); }

// ------------------------------------------------ render
async function render(preview) {
  await saveProject();
  const r = await api('/api/render/' + P.id, { method: 'POST', body: { preview } });
  const pid = P.id; $('#renderBar').style.width = '0%';
  const t = setInterval(async () => {
    const j = await api('/api/jobs/' + r.job);
    if (P && P.id === pid) { $('#renderStatus').textContent = `${preview ? 'Preview' : 'Final'}: ${j.msg}${j.status === 'running' && j.progress ? ` — ${Math.round(j.progress * 100)}%` : ''}`; $('#renderBar').style.width = Math.round((j.progress || 0) * 100) + '%'; }
    if (j.status === 'done' || j.status === 'error') { clearInterval(t); if (j.status === 'done' && P && P.id === pid) showOutput(j.result + '?t=' + Date.now()); PROJECTS = await api('/api/projects'); updateQCount(); }
  }, 1000);
}
$('#renderPrev').onclick = () => render(true);
$('#renderFinal').onclick = () => render(false);
function showOutput(url) { const v = $('#outVideo'); if (!url) { v.style.display = 'none'; $('#outLink').textContent = ''; return; } v.src = url; v.style.display = 'block'; $('#outLink').href = url; $('#outLink').textContent = '⬇ ' + url.split('/').pop().split('?')[0]; }

// ------------------------------------------------ templates
function swatch(el, T) { if (!T) { el.innerHTML = ''; return; } const c = T.colors; el.innerHTML = [c.headerText, c.accent, c.listNumber, c.badgeBg, T.bg].map((x) => `<span style="background:${x}"></span>`).join(''); }
let TSEL = null;
function renderTplList() {
  $('#tplList').innerHTML = TEMPLATES.map((t) => `<div class="tpl ${TSEL && TSEL.id === t.id ? 'sel' : ''}" data-id="${t.id}"><b>${t.name}</b><div style="color:var(--mut);font-size:12px">${t.layout} · ${t.fonts.header} · ${t.transition}</div><div class="swatch"></div></div>`).join('');
  $('#tplList').querySelectorAll('.tpl').forEach((d) => { swatch(d.querySelector('.swatch'), TEMPLATES.find((t) => t.id === d.dataset.id)); d.onclick = () => { TSEL = JSON.parse(JSON.stringify(TEMPLATES.find((t) => t.id === d.dataset.id))); renderTplList(); renderTplForm(); }; });
  if (!TSEL && TEMPLATES[0]) { TSEL = JSON.parse(JSON.stringify(TEMPLATES[0])); renderTplList(); renderTplForm(); }
}
const SFX = ['', 'whoosh_1', 'whoosh_2', 'impact_boom', 'ui_pop', 'bass_drop', 'glitch', 'text_swoosh'];
const TRANSITIONS = ['flash', 'zoom', 'glitch', 'whip', 'shake', 'slideup', 'cut'];
function musicOptions(selected) {
  const groups = {}; MUSIC.forEach((m) => (groups[m.group] ||= []).push(m));
  let html = `<option value="" ${!selected ? 'selected' : ''}>(none)</option>`;
  Object.keys(groups).forEach((g) => { html += `<optgroup label="${g}">` + groups[g].map((m) => `<option value="${m.file}" ${selected === m.file ? 'selected' : ''}>${m.label}${m.needsCredit ? ' ⚠' : ''}</option>`).join('') + '</optgroup>'; });
  return html;
}
function renderTplForm() {
  const T = TSEL; $('#tplTitle').textContent = 'Edit: ' + T.name;
  const sel = (path, opts) => `<select data-p="${path}">${opts.map((o) => `<option ${get(T, path) == o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  const inp = (path, type = 'text', extra = '') => `<input data-p="${path}" type="${type}" value="${get(T, path) ?? ''}" ${extra}>`;
  const F = (label, html) => `<div class="field"><label>${label}</label>${html}</div>`;
  const colors = Object.keys(T.colors).map((k) => F(k, inp('colors.' + k, 'color'))).join('');
  $('#tplForm').innerHTML = `
    <h4>General</h4>${F('Name', inp('name'))}${F('Layout', sel('layout', ['full', 'boxed']))}${F('Background', inp('bg', 'color'))}${F('Transition', sel('transition', TRANSITIONS))}
    ${F('Outro / CTA card', sel('outro', ['false', 'true']))}${F('Progress bar', sel('progress', ['true', 'false']))}
    <h4>Fonts</h4>${F('Header font', sel('fonts.header', FONTS))}${F('List / label font', sel('fonts.list', FONTS))}${F('Rank number font', sel('fonts.badge', FONTS))}
    <h4>Colors</h4>${colors}
    <h4>Header</h4>${F('Style', sel('header.style', ['stroke', 'box', 'plain']))}${F('Size', inp('header.size', 'number'))}${F('Y position', inp('header.y', 'number'))}${F('Stroke width', inp('header.strokeWidth', 'number'))}
    <h4>Ranking list</h4>${F('Show list', sel('list.show', ['true', 'false']))}${F('Text size', inp('list.size', 'number'))}${F('Y position', inp('list.y', 'number'))}${F('Row height', inp('list.rowHeight', 'number'))}
    <h4>Rank number (#5 slam)</h4>${F('Size', inp('badge.size', 'number'))}${F('Boxed', sel('badge.box', ['false', 'true']))}${F('Hold seconds', inp('badge.hold', 'number', 'step="0.05"'))}
    <h4>Label caption</h4>${F('Show', sel('caption.show', ['true', 'false']))}${F('Size', inp('caption.size', 'number'))}
    <h4>Sound</h4>${F('Music', `<select data-p="music">${musicOptions(get(T, 'music'))}</select>`)}${F('Music volume', inp('musicVolume', 'number', 'step="0.05" min="0" max="1"'))}${F('Transition SFX', sel('sfx.transition', SFX))}${F('Reveal SFX', sel('sfx.reveal', SFX))}${F('#1 reveal SFX', sel('sfx.revealFinal', SFX))}
    <h4>Watermark</h4>${F('Opacity (0.1–0.3 = light)', inp('watermark.opacity', 'number', 'step="0.02" min="0" max="1"'))}${F('Size', inp('watermark.size', 'number'))}
    ${T.layout === 'boxed' ? `<h4>Box (boxed layout)</h4>${F('Box top', inp('boxTop', 'number'))}${F('Box height', inp('boxHeight', 'number'))}` : ''}`;
  $('#tplForm').querySelectorAll('[data-p]').forEach((el) => el.oninput = () => {
    let v = el.value; if (el.type === 'number') v = +v; if (v === 'true') v = true; if (v === 'false') v = false; set(T, el.dataset.p, v);
    if (el.dataset.p === 'layout') renderTplForm();
  });
}
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach((k) => { a[k] = a[k] || {}; a = a[k]; }); a[ks.at(-1)] = v; };
$('#tplSave').onclick = async () => { await api('/api/templates/' + TSEL.id, { method: 'PUT', body: TSEL }); TEMPLATES = await api('/api/templates'); fillTemplateSelect(); renderTplList(); $('#tplStatus').textContent = 'saved ✓ — render a preview in Studio to see it'; };
$('#tplDup').onclick = async () => { const t = await api(`/api/templates/${TSEL.id}/duplicate`, { method: 'POST' }); TEMPLATES = await api('/api/templates'); TSEL = t; fillTemplateSelect(); renderTplList(); renderTplForm(); };
function fillTemplateSelect() { const v = $('#pTemplate').value; $('#pTemplate').innerHTML = TEMPLATES.map((t) => `<option value="${t.id}">${t.name}</option>`).join(''); if (v) $('#pTemplate').value = v; }

// ------------------------------------------------ queue
function updateQCount() { $('#qcount').textContent = PROJECTS.filter((p) => p.status !== 'rendered').length; }
async function loadQueue() {
  PROJECTS = await api('/api/projects'); const R = await api('/api/renders');
  const live = Object.fromEntries(R.filter((r) => r.status === 'running' || r.status === 'queued').map((r) => [r.project, r]));
  $('#qBody').innerHTML = PROJECTS.map((p) => { const T = TEMPLATES.find((t) => t.id === p.template); const len = p.items.reduce((a, it) => a + Math.max(0.5, it.out - it.in), 0); const lv = live[p.id];
    const st = lv ? `${lv.status} ${Math.round((lv.progress || 0) * 100)}%` : p.status;
    return `<tr><td><a href="#" data-open="${p.id}">${esc(p.title)}</a></td><td>${T ? T.name : p.template}</td><td>${p.items.length}</td><td>${len.toFixed(1)} s</td>
      <td class="st-${lv ? lv.status : p.status}">${st}</td><td>${p.output ? `<a href="/output/${p.output}" target="_blank">${p.output}</a>` : ''}</td></tr>`; }).join('');
  $('#qBody').querySelectorAll('[data-open]').forEach((a) => a.onclick = (e) => { e.preventDefault(); document.querySelector('[data-tab=studio]').click(); $('#projSel').value = a.dataset.open; openProject(a.dataset.open); });
  updateQCount();
}
$('#renderAll').onclick = async () => { for (const p of PROJECTS.filter((p) => p.status !== 'rendered' && p.items.length)) await api('/api/render/' + p.id, { method: 'POST', body: { preview: false } }); loadQueue(); };
$('#openOut').onclick = () => api('/api/open-output', { method: 'POST' });
setInterval(() => { if ($('#tab-queue').classList.contains('active')) loadQueue(); }, 3000);

// ------------------------------------------------ modals
const modalBack = $('#modalBack');
function openModal(id) { modalBack.classList.add('open'); document.querySelectorAll('.modal').forEach((m) => m.classList.toggle('open', m.id === id)); }
function closeModal() { modalBack.classList.remove('open'); document.querySelectorAll('.modal').forEach((m) => m.classList.remove('open')); }
modalBack.onclick = (e) => { if (e.target === modalBack) closeModal(); };
document.querySelectorAll('.mclose').forEach((b) => b.onclick = closeModal);

// settings
$('#openSettings').onclick = async () => {
  const s = await api('/api/settings');
  $('#setGroq').value = s.groqKey || ''; $('#setCapStyle').value = s.captionStyle || 'pop'; $('#setCookies').value = s.cookiesBrowser || 'chrome';
  $('#setStatus').textContent = ''; openModal('settingsModal');
};
$('#setSave').onclick = async () => {
  const body = { captionStyle: $('#setCapStyle').value, cookiesBrowser: $('#setCookies').value };
  const g = $('#setGroq').value.trim(); if (g && g !== '***set***') body.groqKey = g;
  const r = await api('/api/settings', { method: 'PUT', body });
  $('#setStatus').textContent = r.hasKey ? 'saved ✓ — AI tools enabled' : 'saved ✓ (no Groq key — AI tools use the built-in generator)';
};
// meta results
function copyBtn(text) { const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = 'Copy'; b.onclick = () => { navigator.clipboard.writeText(text); b.textContent = '✓'; setTimeout(() => b.textContent = 'Copy', 1200); }; return b; }
function showMetaModal(r) {
  const body = $('#metaBody'); body.innerHTML = '';
  const block = (title) => { const d = document.createElement('div'); d.className = 'metablock'; d.innerHTML = `<h4>${title}</h4>`; body.appendChild(d); return d; };
  if (r.source) { const n = document.createElement('div'); n.className = 'src-note'; n.textContent = r.note || (r.source === 'groq' ? 'Generated by Groq AI' : 'Built-in generator'); body.appendChild(n); }
  if (r.titles?.length) { const d = block('Title options'); r.titles.forEach((t) => { const row = document.createElement('div'); row.className = 'copyrow'; const s = document.createElement('div'); s.className = 'txt'; s.textContent = t; row.append(s, copyBtn(t)); const use = document.createElement('button'); use.className = 'btn sm'; use.textContent = 'Use'; use.onclick = () => { P.title = t; $('#pTitle').value = t; queueSave(); refreshSelLabel(); }; row.append(use); d.appendChild(row); }); }
  if (r.hook) { const d = block('On-screen hook'); const row = document.createElement('div'); row.className = 'copyrow'; const s = document.createElement('div'); s.className = 'txt'; s.textContent = r.hook; const use = document.createElement('button'); use.className = 'btn sm'; use.textContent = 'Use'; use.onclick = () => { P.hook = r.hook; $('#pHook').value = r.hook; queueSave(); }; row.append(s, copyBtn(r.hook), use); d.appendChild(row); }
  if (r.description) { const d = block('Description'); const row = document.createElement('div'); row.className = 'copyrow'; const s = document.createElement('div'); s.className = 'txt'; s.style.whiteSpace = 'pre-wrap'; s.textContent = r.description; row.append(s, copyBtn(r.description)); d.appendChild(row); }
  if (r.hashtags?.length) { const d = block('Hashtags'); const tags = document.createElement('div'); tags.className = 'tags'; r.hashtags.forEach((h) => { const t = document.createElement('span'); t.className = 'tag'; t.textContent = '#' + h; tags.appendChild(t); }); d.appendChild(tags); const row = document.createElement('div'); row.className = 'copyrow'; const s = document.createElement('div'); s.className = 'txt'; s.textContent = r.hashtags.map((h) => '#' + h).join(' '); row.append(s, copyBtn(s.textContent)); d.appendChild(row); }
  openModal('metaModal');
}

// ------------------------------------------------ boot
(async () => {
  [MEDIA, TEMPLATES, MUSIC, FONTS] = await Promise.all([api('/api/media'), api('/api/templates'), api('/api/music'), api('/api/fonts')]);
  fillTemplateSelect(); buildMusicSelect($('#pMusic'), '');
  renderMedia(); loadProjects();
})();
