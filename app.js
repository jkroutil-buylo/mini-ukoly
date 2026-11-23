// Mini Úkoly – verze pro telefon. Pracuje se stejnými soubory na Google Disku (Můj disk/MiniUkoly) jako aplikace pro Windows.
'use strict';
(function () {
  const C = window.MINIUKOLY_CONFIG || {};
  const Y = window.MUSync;
  const DEMO = new URLSearchParams(location.search).has('demo');
  const SCOPES = 'https://www.googleapis.com/auth/drive';
  const LS_KEY = DEMO ? 'miniukoly.demo.state' : 'miniukoly.state';
  const FOLDER = C.folderName || 'MiniUkoly';
  const PRIO = { 'Vysoká': '#E5484D', 'Střední': '#F5A524', 'Nízká': '#30A46C' };
  const PRANK = { 'Vysoká': 0, 'Střední': 1, 'Nízká': 2 };

  // ---------- stav ----------
  const fresh = () => ({
    tasks: [], people: [], tombs: {}, taskSig: {}, personSig: {}, pointSig: {}, sugState: {}, sugCache: {},
    brief: null, briefMt: '', prep: null, prepMt: '', week: null, weekMt: '', weekHidden: '',
    folderId: '', files: {}, call: null, lastSync: 0, everLoggedIn: false
  });
  let S = fresh();
  try { const o = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (o) S = Object.assign(fresh(), o); } catch (e) { }
  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { } };
  const UI = { view: 'overview', filter: 'active', person: null, showDone: false, noteOpen: {}, status: 'ok', statusText: '', token: null, tokenExp: 0 };
  try { const t = JSON.parse(sessionStorage.getItem('miniukoly.token') || 'null'); if (t && t.exp > Date.now()) { UI.token = t.token; UI.tokenExp = t.exp; } } catch (e) { }
  if (location.hash.startsWith('#lide/')) { UI.view = 'people'; UI.person = decodeURIComponent(location.hash.slice(6)); }

  // ---------- pomocné ----------
  const $ = sel => document.querySelector(sel);
  const esc = v => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const arr = v => Array.isArray(v) ? v : (v === null || v === undefined ? [] : [v]);
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const parseDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const dayDiff = (a, b) => Math.round((parseDate(Y.localDate(a)) - parseDate(Y.localDate(b))) / 864e5);
  const DAYS = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  const MONTHS = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const dm = d => d.getDate() + '. ' + (d.getMonth() + 1) + '.';
  function formatDue(d) {
    const diff = dayDiff(d, new Date());
    if (diff === 0) return 'Dnes'; if (diff === 1) return 'Zítra'; if (diff === -1) return 'Včera';
    if (diff > 1 && diff < 7) return cap(DAYS[d.getDay()]);
    return d.getFullYear() === new Date().getFullYear() ? dm(d) : dm(d) + ' ' + d.getFullYear();
  }
  function formatDay(d) { const diff = dayDiff(new Date(), d); return diff === 0 ? 'dnes' : diff === 1 ? 'včera' : dm(d); }
  const hm = d => d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  const parseLocal = s => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):?(\d{2})?/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null; };
  const plural = (n, a, b, c) => n === 1 ? a : (n >= 2 && n <= 4 ? b : c);
  function workDays(from, to) { let n = 0; let d = new Date(from); d.setHours(0, 0, 0, 0); const t = new Date(to); t.setHours(0, 0, 0, 0); while (d < t) { d = addDays(d, 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++; } return n; }
  const initials = n => { const w = String(n || '').split(/\s+/).filter(Boolean); if (!w.length) return '?'; return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };
  const AV = [['#E3EBFF', '#1D4ED8'], ['#E8F7EE', '#15803D'], ['#FBEDE7', '#C6613F'], ['#F3EEFF', '#7C3AED'], ['#FEF3C7', '#B45309'], ['#E6F6F8', '#0E7490'], ['#FDECEC', '#C62828'], ['#EEF0F4', '#4B5563']];
  const avColor = n => { let h = 0; for (const c of String(n).toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 9973; return AV[h % AV.length]; };

  const I = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>',
    phoneOff: '<path d="M10.7 13.3a11 11 0 0 0 4.8 2.2L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2h4l2 5-2.5 1.5"/><path d="M3 3l18 18"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
    cal: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    spark: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    car: '<path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3z"/><circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/>',
    dot: '<circle cx="12" cy="12" r="3"/>', chevR: '<path d="m9 6 6 6-6 6"/>', chevD: '<path d="m6 9 6 6 6-6"/>', undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>'
  };
  const ico = (n, extra) => `<svg class="ico" viewBox="0 0 24 24" ${extra || ''}>${I[n] || ''}</svg>`;

  // ---------- přihlášení (Google Identity Services) ----------
  let tokenClient = null;
  const hasToken = () => DEMO || (UI.token && Date.now() < UI.tokenExp);
  function initAuth() {
    if (DEMO || tokenClient) return;
    if (!(window.google && google.accounts && google.accounts.oauth2)) { setTimeout(initAuth, 250); return; }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: C.clientId, scope: SCOPES,
      callback: r => {
        if (r.error) { setStatus('login', 'Přihlášení se nepovedlo'); return; }
        UI.token = r.access_token; UI.tokenExp = Date.now() + (Number(r.expires_in || 3600) - 120) * 1000;
        try { sessionStorage.setItem('miniukoly.token', JSON.stringify({ token: UI.token, exp: UI.tokenExp })); } catch (e) { }
        S.everLoggedIn = true; save(); sync();
      },
      error_callback: () => setStatus('login', 'Přihlášení bylo zrušeno')
    });
  }
  function login() {
    if (DEMO) return;
    if (!C.clientId || C.clientId.indexOf('apps.googleusercontent.com') < 0) { toast('Chybí ID přihlašovacího klíče v config.js'); return; }
    if (!tokenClient) { initAuth(); setTimeout(login, 400); return; }
    tokenClient.requestAccessToken({ prompt: S.everLoggedIn ? '' : 'consent' });
  }
  class AuthErr extends Error { }

  // ---------- Google Disk ----------
  const DAPI = 'https://www.googleapis.com/drive/v3';
  async function gfetch(url, opts) {
    opts = opts || {};
    const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + UI.token }, opts.headers || {}) }));
    if (r.status === 401) { UI.token = null; sessionStorage.removeItem('miniukoly.token'); throw new AuthErr('login'); }
    if (!r.ok) { let t = ''; try { t = (await r.json()).error.message; } catch (e) { } const er = new Error(t || ('HTTP ' + r.status)); er.status = r.status; throw er; }
    return r;
  }
  const RealDrive = {
    async folder() {
      if (S.folderId) return S.folderId;
      const q = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`);
      let r = await (await gfetch(`${DAPI}/files?q=${q}&fields=files(id,name)&pageSize=10`)).json();
      if (!r.files.length) {
        const q2 = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
        r = await (await gfetch(`${DAPI}/files?q=${q2}&fields=files(id,name)&pageSize=10`)).json();
      }
      if (!r.files.length) throw new Error('Na Disku chybí složka ' + FOLDER);
      S.folderId = r.files[0].id; return S.folderId;
    },
    async list() {
      const fid = await this.folder();
      const q = encodeURIComponent(`'${fid}' in parents and trashed=false`);
      let files = {}, token = '';
      do {
        const r = await (await gfetch(`${DAPI}/files?q=${q}&fields=nextPageToken,files(id,name,modifiedTime)&pageSize=1000${token ? '&pageToken=' + token : ''}`)).json();
        for (const f of r.files) if (!files[f.name] || files[f.name].mt < f.modifiedTime) files[f.name] = { id: f.id, mt: f.modifiedTime };
        token = r.nextPageToken || '';
      } while (token);
      S.files = files; return files;
    },
    async read(name, retry) {
      const f = S.files[name]; if (!f) return null;
      try {
        const t = await (await gfetch(`${DAPI}/files/${f.id}?alt=media`)).text();
        const clean = t.replace(/^﻿/, '').trim();
        return clean ? JSON.parse(clean) : null;
      } catch (e) { if (e.status === 404 && !retry) { await this.list(); return this.read(name, true); } throw e; }
    },
    async write(name, obj, retry) {
      const body = JSON.stringify(obj, null, 2);
      const f = S.files[name];
      try {
        if (f) {
          const r = await (await gfetch(`https://www.googleapis.com/upload/drive/v3/files/${f.id}?uploadType=media&fields=id,modifiedTime`,
            { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body })).json();
          S.files[name] = { id: r.id, mt: r.modifiedTime };
        } else {
          const fid = await this.folder(); const b = 'mu' + Date.now();
          const meta = JSON.stringify({ name, parents: [fid], mimeType: 'application/json' });
          const multi = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n--${b}--`;
          const r = await (await gfetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime`,
            { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: multi })).json();
          S.files[name] = { id: r.id, mt: r.modifiedTime };
        }
      } catch (e) { if (e.status === 404 && !retry) { await this.list(); return this.write(name, obj, true); } throw e; }
    }
  };
  // Ukázkový režim (?demo) – data jen v prohlížeči, pro vyzkoušení bez přihlášení
  const DemoDrive = {
    store() { try { return JSON.parse(localStorage.getItem('miniukoly.demo.files') || 'null') || demoSeed(); } catch (e) { return demoSeed(); } },
    put(st) { localStorage.setItem('miniukoly.demo.files', JSON.stringify(st)); },
    async list() { const st = this.store(); this.put(st); const files = {}; for (const k of Object.keys(st)) files[k] = { id: k, mt: st[k].mt }; S.files = files; return files; },
    async read(name) { const st = this.store(); return st[name] ? JSON.parse(JSON.stringify(st[name].data)) : null; },
    async write(name, obj) { const st = this.store(); st[name] = { mt: new Date().toISOString(), data: JSON.parse(JSON.stringify(obj)) }; this.put(st); S.files[name] = { id: name, mt: st[name].mt }; }
  };
  const Drive = DEMO ? DemoDrive : RealDrive;

  // ---------- synchronizace ----------
  let syncing = false, again = false, syncTimer = null;
  function setStatus(st, text) { UI.status = st; UI.statusText = text || ''; renderStatus(); }
  function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(sync, ms === undefined ? 1200 : ms); }
  function fixDone() { for (const t of S.tasks) { if (t.Done && !t.DoneAt) t.DoneAt = Y.localStamp(); else if (!t.Done && t.DoneAt) t.DoneAt = ''; } }

  async function sync() {
    clearTimeout(syncTimer);
    if (syncing) { again = true; return; }
    if (!hasToken()) { setStatus('login'); return; }
    if (!navigator.onLine && !DEMO) { setStatus('off', 'Offline'); return; }
    syncing = true; setStatus('sync');
    try {
      await Drive.list();
      Y.mergeTombs(S.tombs, (await Drive.read('smazane.json')) || {});
      let writeTombs = false;
      // úkoly
      fixDone();
      const c1 = Y.markChanges(S.tasks, S.taskSig, Y.TASK_FIELDS, S.tombs);
      const remT = arr(await Drive.read('ukoly.json')).filter(Boolean).map(Y.normTask);
      const oldT = JSON.stringify(remT);
      S.tasks = Y.mergeById(S.tasks.map(Y.normTask), remT, S.tombs);
      if (c1 || JSON.stringify(S.tasks) !== oldT) { await Drive.write('ukoly.json', S.tasks); writeTombs = true; }
      Y.setSigs(S.tasks, S.taskSig, Y.TASK_FIELDS);
      // lidé
      S.people = S.people.map(Y.normPerson);
      const c2 = Y.markChanges(S.people, S.personSig, Y.PERSON_FIELDS, S.tombs);
      const c3 = Y.markChanges(Y.allPoints(S.people), S.pointSig, Y.POINT_FIELDS, S.tombs);
      const remP = arr(await Drive.read('lide.json')).filter(Boolean).map(Y.normPerson);
      const oldP = JSON.stringify(remP);
      S.people = Y.mergePeople(S.people, remP, S.tombs);
      if (c2 || c3 || JSON.stringify(S.people) !== oldP) { await Drive.write('lide.json', S.people); writeTombs = true; }
      Y.setSigs(S.people, S.personSig, Y.PERSON_FIELDS); Y.setSigs(Y.allPoints(S.people), S.pointSig, Y.POINT_FIELDS);
      if (writeTombs) { S.tombs = Y.pruneTombs(S.tombs); await Drive.write('smazane.json', S.tombs); }
      await loadExtras();
      S.lastSync = Date.now(); save();
      setStatus('ok');
    } catch (e) {
      save();
      if (e instanceof AuthErr) setStatus('login'); else setStatus('off', e.message || String(e));
    } finally {
      syncing = false; render();
      if (again) { again = false; scheduleSync(300); }
    }
  }

  const newest = prefix => Object.keys(S.files).filter(n => n.startsWith(prefix) && n.endsWith('.json')).sort().reverse()[0];
  async function loadExtras() {
    for (const [prefix, key] of [['prehled', 'brief'], ['zitra-', 'prep'], ['tyden-', 'week']]) {
      const n = newest(prefix);
      if (!n) { S[key] = null; continue; }
      const mt = n + '|' + S.files[n].mt;
      if (S[key + 'Mt'] !== mt) { try { S[key] = await Drive.read(n); S[key + 'Mt'] = mt; } catch (e) { } }
    }
    // návrhy od Clauda
    S.sugState = Object.assign({}, (await Drive.read('navrhy-stav.json')) || {}, pendingDecisions);
    const limit = Date.now() - 14 * 864e5, cache = {};
    for (const n of Object.keys(S.files).filter(n => /^navrhy-\d/.test(n))) {
      const f = S.files[n]; if (Date.parse(f.mt) < limit) continue;
      const c = S.sugCache[n];
      if (c && c.mt === f.mt) cache[n] = c; else { try { const o = await Drive.read(n); cache[n] = { mt: f.mt, gen: o && o.generatedAt, items: (o && arr(o.items)) || [] }; } catch (e) { } }
    }
    S.sugCache = cache;
    if (Object.keys(pendingDecisions).length) await writeSugState();
    const auto = suggestions().filter(x => x.auto);
    if (auto.length) { for (const x of auto) approveSuggestion(x, null, true); await writeSugState(); toast('Ze Slacku přidáno: ' + auto.length); scheduleSync(200); }
  }
  let pendingDecisions = {};
  async function writeSugState() {
    const remote = (await Drive.read('navrhy-stav.json')) || {};
    const merged = Object.assign({}, remote, pendingDecisions);
    for (const k of Object.keys(pendingDecisions)) if (pendingDecisions[k] === null) delete merged[k];
    await Drive.write('navrhy-stav.json', merged);
    S.sugState = merged; pendingDecisions = {};
  }
  function suggestions() {
    const seen = {}, out = [];
    for (const n of Object.keys(S.sugCache).sort()) {
      for (const i of S.sugCache[n].items) {
        if (!i || !i.text) continue;
        const id = String(i.id || ('h' + i.text.length + i.text.slice(0, 20)));
        if (seen[id] || (S.sugState[id] && pendingDecisions[id] !== null) || pendingDecisions[id]) continue;
        if (S.tasks.some(t => t.Id === 'sug-' + id)) continue;
        seen[id] = true;
        out.push({ id, kind: i.kind === 'point' ? 'point' : 'task', text: String(i.text), person: String(i.person || ''), due: String(i.due || ''),
          priority: PRIO[i.priority] ? i.priority : 'Střední', waitingFor: String(i.waitingFor || ''), source: String(i.source || ''),
          url: /^https:\/\//.test(i.url || '') ? i.url : '', auto: !!i.auto });
      }
    }
    return out;
  }
  function decide(id, d) { pendingDecisions[id] = d === null ? null : d + '|' + Y.utcStamp(); }

  // ---------- data: úkoly a lidé ----------
  const taskById = id => S.tasks.find(t => t.Id === id);
  const personById = id => S.people.find(p => p.Id === id);
  const openPoints = p => p.Points.filter(x => !x.Done);
  function findPerson(name) {
    if (!name) return null; const k = name.toLowerCase();
    let c = S.people.filter(p => p.Name.toLowerCase() === k);
    if (!c.length) c = S.people.filter(p => p.Name.toLowerCase().split(/\s+/).includes(k) || k.split(/\s+/).includes((p.Name.toLowerCase().split(/\s+/).pop() || '')));
    return c.length === 1 ? c[0] : null;
  }
  function newTask(o) { const t = Y.normTask(Object.assign({ Id: uid(), Priority: 'Střední', Created: Y.localStamp() }, o)); S.tasks.push(t); return t; }
  function newPoint(p, text, extra) { const x = Y.normPoint(Object.assign({ Id: uid(), Text: text, Created: Y.localStamp() }, extra || {})); p.Points.push(x); return x; }
  function newPerson(name) { const p = Y.normPerson({ Id: uid(), Name: name, Created: Y.localStamp() }); S.people.push(p); return p; }
  function changed(ms) {
    // akce (ne psaní): rozepsané pole opustit, ať se obrazovka hned překreslí
    const a = document.activeElement;
    if (a && a.closest && a.closest('#main') && /^(INPUT|TEXTAREA)$/.test(a.tagName)) a.blur();
    save(); render(); scheduleSync(ms);
  }

  function approveSuggestion(sg, override, silent) {
    if (sg.kind === 'point') {
      let p = findPerson(sg.person); if (!p) p = newPerson(sg.person || 'Bez jména');
      if (!p.Points.some(x => x.Id === 'sug-' + sg.id)) newPoint(p, sg.text, { Id: 'sug-' + sg.id, Note: sg.source ? 'Zdroj: ' + sg.source : '' });
    } else if (!taskById('sug-' + sg.id)) {
      const o = override || { Text: sg.text, Priority: sg.priority, Due: sg.due, WaitingFor: sg.waitingFor, WaitingSince: sg.waitingFor ? Y.localDate() : '' };
      newTask(Object.assign(o, { Id: 'sug-' + sg.id, Url: sg.url, Source: sg.source || 'Claude' }));
    }
    decide(sg.id, 'added');
    if (!silent) changed(300);
  }

  // rychlý zápis: „Novák: …“ = bod, „čekám: …“, „!“ = vysoká, „… dnes/zítra/pozítří“ = termín
  function parseQuick(text) {
    let t = text.trim(); const r = { kind: 'task', person: null, text: t, priority: 'Střední', due: '', waiting: '' };
    if (!t) return r;
    let m = /^(čekám|cekam)(\s+na)?\s*:?\s+(.+)$/i.exec(t); if (m) { r.text = r.waiting = m[3].trim(); return r; }
    m = /^([^:]{2,40}):\s*(.+)$/.exec(t);
    if (m) { const p = findPerson(m[1].trim()); if (p) { r.kind = 'point'; r.person = p; r.text = m[2].trim(); return r; } }
    for (let i = 0; i < 2; i++) {
      if ((m = /^!\s*(.+)$/.exec(t))) { t = m[1]; r.priority = 'Vysoká'; } else if ((m = /^(.+?)\s*!$/.exec(t))) { t = m[1]; r.priority = 'Vysoká'; }
      if ((m = /^(.+?)\s+(dnes|zítra|zitra|pozítří|pozitri)$/i.exec(t))) { t = m[1]; const w = m[2].toLowerCase(); r.due = Y.localDate(addDays(today0(), w === 'dnes' ? 0 : w[0] === 'z' ? 1 : 2)); }
    }
    r.text = t.trim(); return r;
  }

  // ---------- zobrazení ----------
  function renderStatus() {
    const el = $('#status'); if (!el) return;
    const st = UI.status;
    el.className = 'status ' + (st === 'sync' ? 'sync' : st === 'off' ? 'off' : st === 'login' ? 'login' : '');
    el.innerHTML = st === 'login' ? 'Přihlásit' : `<span class="dot"></span>${st === 'sync' ? 'Ukládám…' : st === 'off' ? 'Offline' : (S.lastSync ? hm(new Date(S.lastSync)) : '')}`;
    el.title = UI.statusText || '';
  }
  function render() {
    const a = document.activeElement;
    if (a && a.closest && a.closest('#main') && /^(INPUT|TEXTAREA)$/.test(a.tagName)) { UI.renderPending = true; renderStatus(); renderNav(); return; }
    UI.renderPending = false;
    if (!DEMO && !S.everLoggedIn && !hasToken()) { renderLogin(); return; }
    const d = new Date();
    const open = S.tasks.filter(t => !t.Done);
    $('#app').innerHTML = `
      <header class="top"><div><h1>${UI.view === 'people' ? 'Lidé' : UI.view === 'tasks' ? 'Úkoly' : 'Moje úkoly'}</h1>
        <div class="sub">${cap(DAYS[d.getDay()])} ${d.getDate()}. ${MONTHS[d.getMonth()]}${open.length ? ' · ' + open.length + ' ' + plural(open.length, 'úkol čeká', 'úkoly čekají', 'úkolů čeká') : ''}</div></div>
        <button id="status" class="status" data-act="status"></button></header>
      <main id="main">${UI.view === 'tasks' ? viewTasks() : UI.view === 'people' ? (UI.person && personById(UI.person) ? viewPerson(personById(UI.person)) : viewPeople()) : viewOverview()}</main>
      <nav class="bottom" id="nav"></nav>`;
    renderStatus(); renderNav();
    if (S.call) tickCall();
  }
  function renderNav() {
    const pts = S.people.reduce((n, p) => n + openPoints(p).length, 0);
    const el = $('#nav'); if (!el) return;
    el.innerHTML = `
      <button data-act="view" data-v="overview" class="${UI.view === 'overview' ? 'on' : ''}">${ico('home')}Přehled</button>
      <button data-act="view" data-v="tasks" class="${UI.view === 'tasks' ? 'on' : ''}">${ico('list')}Úkoly</button>
      <button data-act="quick" class="add" aria-label="Rychlý zápis">${ico('plus')}</button>
      <button data-act="view" data-v="people" class="${UI.view === 'people' ? 'on' : ''}">${ico('users')}Lidé${pts ? `<span class="n">${pts}</span>` : ''}</button>`;
  }
  function renderLogin() {
    $('#app').innerHTML = `<div class="login"><div class="logo">${ico('check')}</div><h1>Mini Úkoly</h1>
      <p>Úkoly, lidé a denní plán od Clauda – stejné jako v počítači, uložené na vašem Google Disku.</p>
      <button class="btn" data-act="login">Přihlásit se účtem Google</button>
      <p class="hint" style="margin-top:18px">Přihlaste se pracovním účtem Buylo. Aplikace pracuje jen se složkou ${esc(FOLDER)} na Disku.</p></div>`;
  }

  function taskChips(t) {
    const c = [`<span class="prio"><i style="background:${PRIO[t.Priority]}"></i>${esc(t.Priority)}</span>`];
    const due = parseDate(t.Due);
    if (due) {
      const diff = dayDiff(due, new Date()); let cls = '', txt = formatDue(due);
      if (!t.Done) { if (diff < 0) { cls = 'red'; txt = 'Po termínu · ' + txt; } else if (diff === 0) cls = 'amber'; else cls = 'blue'; }
      c.push(`<span class="chip ${cls}">${ico('cal')}${esc(txt)}</span>`);
    }
    if (t.WaitingFor && !t.Done) {
      const since = parseDate(t.WaitingSince); const wd = since ? workDays(since, new Date()) : 0;
      c.push(`<span class="chip ${wd >= 3 ? 'amber' : 'violet'}">${ico('clock')}čekám: ${esc(t.WaitingFor.length > 34 ? t.WaitingFor.slice(0, 33) + '…' : t.WaitingFor)}${since ? ' · ' + (wd ? wd + ' ' + plural(wd, 'prac. den', 'prac. dny', 'prac. dnů') : 'od dneška') : ''}</span>`);
    }
    if (t.Url) c.push(`<button class="chip" data-act="url" data-url="${esc(t.Url)}">${ico('ext')}zdroj</button>`);
    return c.join('');
  }
  const taskRow = t => `<div class="row"><button class="check ${t.Done ? 'on' : ''}" data-act="toggle" data-id="${esc(t.Id)}" aria-label="Hotovo">${ico('check')}</button>
      <div class="body" data-act="edit" data-id="${esc(t.Id)}"><div class="title ${t.Done ? 'done' : (t.Priority === 'Vysoká' ? 'high' : '')}">${esc(t.Text)}</div><div class="chips">${taskChips(t)}</div></div></div>`;

  function sortTasks(list) {
    return list.slice().sort((a, b) => (a.Done - b.Done) || (PRANK[a.Priority] - PRANK[b.Priority]) || Y.cmp(a.Due || '9999', b.Due || '9999') || Y.cmp(a.Created, b.Created));
  }
  function viewTasks() {
    const act = S.tasks.filter(t => !t.Done), wait = act.filter(t => t.WaitingFor), done = S.tasks.filter(t => t.Done);
    const list = UI.filter === 'wait' ? wait : UI.filter === 'done' ? done : UI.filter === 'all' ? S.tasks : act;
    const seg = [['active', 'Aktivní', act.length], ['wait', 'Čekám', wait.length], ['done', 'Hotové', done.length], ['all', 'Vše', S.tasks.length]]
      .map(([k, l, n]) => `<button class="${UI.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l} ${n}</button>`).join('');
    return `<form class="inputrow" data-act="addtask"><input id="newtask" placeholder="Co je potřeba udělat?" autocomplete="off" enterkeyhint="done"><button class="btn small" type="submit">${ico('plus')}</button></form>
      <div class="seg">${seg}</div>
      ${list.length ? `<div class="card" style="padding:4px 14px">${sortTasks(list).map(taskRow).join('')}</div>`
        : `<div class="empty"><div class="big" style="background:var(--blue-l);color:var(--blue)">${ico('check')}</div><b>${UI.filter === 'wait' ? 'Na nikoho nečekáte' : UI.filter === 'done' ? 'Zatím nic hotového' : 'Všechno hotovo!'}</b>${UI.filter === 'active' ? 'Nový úkol přidáte tlačítkem + dole.' : ''}</div>`}
      ${done.length && UI.filter === 'done' ? `<button class="btn ghost small" data-act="cleardone">${ico('trash')}Smazat hotové (${done.length})</button>` : ''}`;
  }

  const KINDS = { meeting: ['cal', '#1D4ED8', '#EEF3FF'], travel: ['car', '#7C3AED', '#F3EEFF'], mail: ['mail', '#0E7490', '#E6F6F8'], work: ['work', '#15803D', '#EAF7EE'], task: ['check', '#B45309', '#FEF3C7'], other: ['dot', '#4B5563', '#F1F3F7'] };
  function briefItems(list) {
    return arr(list).filter(Boolean).map((x, i) => {
      const o = typeof x === 'string' ? { title: x } : x;
      const title = o.title || o.text || ''; const text = o.title ? (o.text || '') : '';
      const url = /^https:\/\//.test(o.url || '') ? o.url : '';
      return { n: i + 1, title, text, url };
    }).filter(x => x.title);
  }
  const briefList = (items, personLinks) => items.map(x => {
    const p = personLinks ? S.people.find(pp => pp.Name && x.title.toLowerCase().includes(pp.Name.toLowerCase())) : null;
    const title = p ? `<button class="linkbtn" data-act="openperson" data-id="${esc(p.Id)}">${esc(x.title)}</button>`
      : x.url ? `<button class="linkbtn" data-act="url" data-url="${esc(x.url)}">${esc(x.title)}</button>` : `<b>${esc(x.title)}</b>`;
    return `<div class="list-num"><span class="n">${x.n}</span><div>${title}${x.text ? `<div class="muted">${esc(x.text)}</div>` : ''}</div></div>`;
  }).join('');

  function viewOverview() {
    const out = [];
    // návrhy
    const sg = suggestions().filter(x => !x.auto);
    if (sg.length) {
      out.push(`<div class="card" style="border-color:#F0D3C7"><h2><span class="badge-ico" style="background:var(--clay-l);color:var(--clay)">${ico('spark')}</span>Návrhy od Clauda ${sg.length}
        ${sg.length > 1 ? `<button class="btn ghost small" style="margin-left:auto" data-act="sugall">Přidat vše</button>` : ''}</h2>
        ${sg.map(x => {
          const meta = [];
          if (x.kind === 'point') meta.push('probrat s: ' + (x.person || '?'));
          if (x.waitingFor) meta.push('čekám na: ' + x.waitingFor);
          const d = parseDate(x.due); if (d) meta.push('termín ' + formatDue(d).toLowerCase());
          if (x.priority === 'Vysoká') meta.push('vysoká priorita');
          if (x.source) meta.push(x.source);
          return `<div class="row"><span class="dotico" style="background:${x.kind === 'point' ? '#E8F7EE' : '#E3EBFF'};color:${x.kind === 'point' ? '#16A34A' : '#2563EB'};margin-top:2px">${ico(x.kind === 'point' ? 'phone' : 'check')}</span>
            <div class="body"><div class="title" style="font-weight:600">${esc(x.text)}</div><div class="small">${esc(meta.join(' · '))}</div>
            <div class="chips" style="margin-top:8px">
              <button class="btn small chipbtn" data-act="sugadd" data-id="${esc(x.id)}">${ico('plus')}Přidat</button>
              ${x.kind === 'task' ? `<button class="iconbtn" data-act="sugedit" data-id="${esc(x.id)}" aria-label="Upravit">${ico('edit')}</button>` : ''}
              ${x.url ? `<button class="iconbtn" data-act="url" data-url="${esc(x.url)}" aria-label="Zdroj">${ico('ext')}</button>` : ''}
              <button class="iconbtn" data-act="sugdel" data-id="${esc(x.id)}" aria-label="Zahodit">${ico('x')}</button></div></div></div>`;
        }).join('')}</div>`);
    }
    // denní plán
    const b = S.brief;
    if (b) {
      const bd = parseDate(b.date), isToday = bd && dayDiff(bd, new Date()) === 0;
      const gen = parseLocal(b.generatedAt);
      const sched = arr(b.schedule).filter(s => s && s.text).map(s => {
        const k = KINDS[s.kind] ? s.kind : (s.taskId && taskById(s.taskId) ? 'task' : 'other'); const kk = KINDS[k];
        return `<div class="sched"><span class="t">${esc(s.time)}</span><span class="dotico" style="background:${kk[2]};color:${kk[1]}">${ico(kk[0])}</span><span>${esc(s.text)}</span>
          <span>${s.taskId && taskById(s.taskId) ? '<span class="chip amber">úkol</span>' : ''}</span></div>`;
      }).join('');
      const secs = [['Probrat při hovoru', b.calls, true], ['Čeká se na ostatní', b.waiting], ['Pokud zbude čas', b.ifTime], ['Dopředu', b.ahead]]
        .map(([h, l, pl]) => { const it = briefItems(l); return it.length ? `<div class="sec-title">${h}</div>${briefList(it, pl)}` : ''; }).join('');
      const top = briefItems(b.top3);
      out.push(`<div class="card"><h2><span class="badge-ico" style="background:var(--clay-l);color:var(--clay)">${ico('sun')}</span>Denní plán od Clauda
        <span class="meta" style="${isToday ? '' : 'color:var(--amber)'}">${isToday ? (gen ? 'Dnes v ' + hm(gen) : 'Dnes') : (bd ? 'Plán z ' + DAYS[bd.getDay()] + ' ' + dm(bd) : 'Starší plán')}</span></h2>
        ${b.summary ? `<div class="headline">${esc(b.summary)}</div>` : ''}
        ${top.length ? `<div class="sec-title">Top 3 dnes</div>${briefList(top)}` : ''}
        ${sched ? `<div class="sec-title">Rozvrh dne</div>${sched}` : ''}${secs}
        ${b.note ? `<div class="small" style="margin-top:8px">${esc(b.note)}</div>` : ''}
        ${b.markdown ? `<button class="btn ghost small" style="margin:10px 0 -6px -10px" data-act="fullplan">${ico('note')}${UI.fullPlan ? 'Skrýt celý plán' : 'Celý plán'}</button>${UI.fullPlan ? `<pre class="full">${esc(b.markdown)}</pre>` : ''}` : ''}</div>`);
    } else {
      out.push(`<div class="card"><h2><span class="badge-ico" style="background:var(--clay-l);color:var(--clay)">${ico('sun')}</span>Denní plán od Clauda</h2><p class="muted">Plán zatím nedorazil – rutina ho ukládá ve všední dny kolem 7:00.</p></div>`);
    }
    // podklady na zítra
    const pr = S.prep, pd = pr && parseDate(pr.date);
    if (pd && dayDiff(pd, new Date()) >= 0 && dayDiff(pd, new Date()) <= 4) {
      const ms = arr(pr.meetings).filter(m => m && m.title);
      if (ms.length) {
        const dd = dayDiff(pd, new Date());
        out.push(`<div class="card"><h2><span class="badge-ico" style="background:var(--blue-l);color:var(--blue-d)">${ico('cal')}</span>Podklady na ${dd === 0 ? 'dnešní schůzky' : dd === 1 ? 'zítřek' : DAYS[pd.getDay()] + ' ' + dm(pd)}</h2>
          ${ms.map(m => `<div style="margin-top:12px"><div class="muted" style="font-weight:600">${esc(m.time || '')}</div>
            ${/^https:\/\//.test(m.url || '') ? `<button class="linkbtn" data-act="url" data-url="${esc(m.url)}">${esc(m.title)}</button>` : `<b>${esc(m.title)}</b>`}
            ${m.with ? `<div class="small">${esc(m.with)}</div>` : ''}
            ${arr(m.prep).filter(Boolean).map(x => `<div style="font-size:13.5px;margin-top:3px">• ${esc(x)}</div>`).join('')}
            ${arr(m.points).filter(Boolean).map(x => `<div style="font-size:13.5px;margin-top:3px;color:#15803D">☎ probrat: ${esc(x)}</div>`).join('')}</div>`).join('')}</div>`);
      }
    }
    // týdenní revize
    const w = S.week;
    if (w && S.weekMt && S.weekHidden !== S.weekMt.split('|')[0]) {
      const gen = parseLocal(w.generatedAt);
      if (!gen || (Date.now() - gen) / 864e5 <= 4) {
        const sec = [['Hotovo', w.done, '#15803D'], ['Zaseklo se / čeká', w.stuck, '#B45309'], ['Priority na příští týden', w.priorities, '#1D4ED8']]
          .map(([h, l, c]) => { const it = arr(l).filter(Boolean); return it.length ? `<div class="sec-title" style="color:${c}">${h}</div>${it.map(x => `<div style="font-size:13.5px;margin-top:3px">• ${esc(x)}</div>`).join('')}` : ''; }).join('');
        out.push(`<div class="card"><h2><span class="badge-ico" style="background:var(--violet-l);color:#7C3AED">${ico('chart')}</span>Týdenní revize<button class="iconbtn" style="margin-left:auto" data-act="hideweek" aria-label="Skrýt">${ico('x')}</button></h2>
          ${w.summary ? `<div class="headline" style="font-size:16px">${esc(w.summary)}</div>` : ''}${sec}</div>`);
      }
    }
    // čísla a na co se zaměřit
    const t0 = today0(), open = S.tasks.filter(t => !t.Done);
    let over = [], tod = [], wk = [];
    for (const t of open) { const d = parseDate(t.Due); if (!d) continue; if (d < t0) over.push(t); else if (+d === +t0) tod.push(t); else if (d <= addDays(t0, 7)) wk.push(t); }
    const waitN = open.filter(t => t.WaitingFor).length;
    out.push(`<div class="stats"><div class="stat"><b style="color:#C62828">${over.length}</b><span>Po termínu</span></div><div class="stat"><b style="color:#B45309">${tod.length}</b><span>Na dnes</span></div>
      <div class="stat"><b style="color:#1D4ED8">${wk.length}</b><span>7 dní</span></div><div class="stat"><b style="color:#7C3AED">${waitN}</b><span>Čekám na</span></div></div>`);
    const focus = sortTasks([...over, ...tod, ...wk]).sort((a, b) => Y.cmp(a.Due, b.Due)).concat(open.filter(t => t.Priority === 'Vysoká' && !t.Due)).slice(0, 10);
    out.push(`<div class="card" style="padding:12px 14px 4px"><h2>Na co se zaměřit<button class="btn ghost small" style="margin-left:auto" data-act="view" data-v="tasks">Všechny úkoly ${ico('chevR')}</button></h2>
      ${focus.length ? focus.map(taskRow).join('') : '<p class="muted">Nic naléhavého – žádné úkoly po termínu ani na nejbližší dny.</p>'}</div>`);
    return out.join('');
  }

  function viewPeople() {
    const sorted = S.people.slice().sort((a, b) => ((openPoints(b).length > 0) - (openPoints(a).length > 0)) || a.Name.localeCompare(b.Name, 'cs'));
    return `<form class="inputrow" data-act="addperson"><input id="newperson" placeholder="Přidat člověka" autocomplete="off" enterkeyhint="done"><button class="btn small" type="submit">${ico('plus')}</button></form>
      ${sorted.length ? sorted.map(p => {
        const n = openPoints(p).length, col = avColor(p.Name), last = p.Calls.length ? parseLocal(p.Calls[p.Calls.length - 1].Start) : null;
        const sub = S.call && S.call.personId === p.Id ? 'Hovor probíhá' : p.Info || (last ? 'Hovor ' + formatDay(last) : 'Zatím bez hovoru');
        return `<button class="person" data-act="openperson" data-id="${esc(p.Id)}"><span class="avatar" style="background:${col[0]};color:${col[1]}">${esc(initials(p.Name))}</span>
          <span style="min-width:0"><div class="name">${esc(p.Name)}</div><div class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</div></span>${n ? `<span class="count">${n}</span>` : ''}</button>`;
      }).join('') : `<div class="empty"><div class="big" style="background:var(--green-l);color:var(--green)">${ico('phone')}</div><b>Co s kým probrat</b>Přidejte člověka, zapisujte mu body k probrání a při hovoru je odškrtávejte.</div>`}`;
  }

  function viewPerson(p) {
    const col = avColor(p.Name), inCall = !!(S.call && S.call.personId === p.Id);
    const open = openPoints(p), done = p.Points.filter(x => x.Done).sort((a, b) => Y.cmp(b.DoneAt, a.DoneAt));
    const last = p.Calls.length ? p.Calls[p.Calls.length - 1] : null, ld = last && parseLocal(last.Start);
    return `<button class="btn ghost small" style="margin:-4px 0 8px -10px" data-act="backpeople">${ico('chevR', 'style="transform:rotate(180deg)"')}Lidé</button>
      <div class="phead"><span class="avatar big" style="background:${col[0]};color:${col[1]}">${esc(initials(p.Name))}</span>
        <div class="fields"><input class="pname" data-field="Name" data-id="${esc(p.Id)}" value="${esc(p.Name)}" aria-label="Jméno">
          <input class="pinfo" data-field="Info" data-id="${esc(p.Id)}" value="${esc(p.Info)}" placeholder="Firma, telefon, e-mail… (nepovinné)" aria-label="Info">
          <div class="small" style="margin-top:4px">${ld ? 'Poslední hovor ' + formatDay(ld) + ' v ' + hm(ld) + ' (' + last.Minutes + ' min)' : 'Zatím žádný hovor'}</div></div></div>
      ${inCall ? `<div class="callbar"><span class="live"></span><b>Hovor</b><span id="calltime" style="font-variant-numeric:tabular-nums"></span><span id="callstats" class="small" style="color:#15803D"></span>
          <button class="btn red small" style="margin-left:auto" data-act="endcall">${ico('phoneOff')}Ukončit</button></div>`
        : `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn green" data-act="startcall" data-id="${esc(p.Id)}">${ico('phone')}Zahájit hovor</button>
          ${p.Calls.length ? `<button class="btn chipbtn small" data-act="sharenotes" data-id="${esc(p.Id)}">${ico('share')}Zápis</button>` : ''}
          <button class="iconbtn" style="margin-left:auto" data-act="delperson" data-id="${esc(p.Id)}" aria-label="Smazat">${ico('trash')}</button></div>`}
      <form class="inputrow" data-act="addpoint" data-id="${esc(p.Id)}"><input id="newpoint" placeholder="${inCall ? 'Další bod z hovoru…' : 'Co chcete probrat?'}" autocomplete="off" enterkeyhint="done"><button class="btn small" type="submit">${ico('plus')}</button></form>
      <div class="sec-title" style="margin-top:4px">K probrání ${open.length || ''}</div>
      ${open.length ? open.map(x => {
        const showNote = inCall || x.Note || UI.noteOpen[x.Id];
        return `<div class="point"><button class="check" data-act="resolve" data-p="${esc(p.Id)}" data-id="${esc(x.Id)}" aria-label="Probráno">${ico('check')}</button>
          <div class="body"><div>${esc(x.Text)}</div>
            ${showNote ? `<textarea data-note="${esc(x.Id)}" data-p="${esc(p.Id)}" rows="2" placeholder="Poznámka z hovoru…">${esc(x.Note)}</textarea>` : ''}
            <div class="acts"><button class="btn small chipbtn" data-act="pointtask" data-p="${esc(p.Id)}" data-id="${esc(x.Id)}">${ico('check')}Úkol</button>
              ${showNote ? '' : `<button class="iconbtn" data-act="opennote" data-id="${esc(x.Id)}" aria-label="Poznámka">${ico('note')}</button>`}
              <button class="iconbtn" data-act="delpoint" data-p="${esc(p.Id)}" data-id="${esc(x.Id)}" aria-label="Smazat">${ico('trash')}</button></div></div></div>`;
      }).join('') : `<p class="muted">${done.length ? 'Všechno je probráno.' : 'Zatím nic k probrání.'}</p>`}
      ${done.length ? `<button class="btn ghost small" style="margin:8px 0 4px -10px" data-act="toggledone">${ico(UI.showDone ? 'chevD' : 'chevR')}Probráno ${done.length}</button>
        ${UI.showDone ? done.map(x => {
          const t = x.TaskId && taskById(x.TaskId), dd = parseLocal(x.DoneAt);
          return `<div class="doneitem" style="display:flex;gap:8px"><span style="color:var(--green)">✓</span><div style="flex:1"><div style="color:#4B5563">${esc(x.Text)}</div>
            ${x.Note ? `<div class="note">${esc(x.Note)}</div>` : ''}<div class="small">${dd ? 'Probráno ' + formatDay(dd) : 'Probráno'}${x.TaskId ? ` · <span class="chip amber">${t && t.Done ? 'úkol hotový' : t ? 'úkol' : 'úkol (smazaný)'}</span>` : ''}</div></div>
            <button class="iconbtn" data-act="reopen" data-p="${esc(p.Id)}" data-id="${esc(x.Id)}" aria-label="Vrátit">${ico('undo')}</button></div>`;
        }).join('') : ''}` : ''}`;
  }

  // ---------- hovor ----------
  let callInt = null;
  function tickCall() {
    clearInterval(callInt);
    if (!S.call) return;
    const upd = () => {
      const el = $('#calltime'); if (!el) return;
      const sec = Math.floor((Date.now() - parseLocal(S.call.start)) / 1000);
      el.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
      const p = personById(S.call.personId); if (!p) return;
      const st = parseLocal(S.call.start), res = p.Points.filter(x => x.Done && parseLocal(x.DoneAt) >= st);
      const tk = res.filter(x => x.TaskId).length, left = openPoints(p).length;
      $('#callstats').textContent = [res.length ? res.length + ' probráno' : '', tk ? tk + ' ' + plural(tk, 'úkol', 'úkoly', 'úkolů') : '', left ? 'zbývá ' + left : 'vše probráno'].filter(Boolean).join(' · ');
    };
    upd(); callInt = setInterval(upd, 1000);
  }
  function callNotes(p) {
    const c = p.Calls[p.Calls.length - 1]; if (!c) return '';
    const st = parseLocal(c.Start), en = parseLocal(c.End);
    const res = p.Points.filter(x => { const d = parseLocal(x.DoneAt); return x.Done && d && d >= st && (!en || d <= en); });
    const L = [`Hovor s ${p.Name} – ${dm(st)} ${st.getFullYear()} ${hm(st)}, ${c.Minutes} min`, '', 'Probráno:'];
    if (!res.length) L.push('- nic');
    for (const x of res) { L.push('- ' + x.Text); for (const l of x.Note.split(/\r?\n/).filter(s => s.trim())) L.push('  ' + l.trim()); if (x.TaskId) L.push('  → úkol: ' + x.TaskText); }
    const open = openPoints(p);
    if (open.length) { L.push('', 'Zůstává na příště:'); for (const x of open) L.push('- ' + x.Text); }
    return L.join('\n');
  }
  async function shareText(text, title) {
    if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); toast('Zápis je ve schránce'); } catch (e) { toast('Sdílení se nepovedlo'); }
  }

  // ---------- okna (sheet) ----------
  function sheet(html, onMount) {
    closeSheet();
    const bg = document.createElement('div'); bg.className = 'sheet-bg'; bg.id = 'sheet';
    bg.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
    bg.addEventListener('click', e => { if (e.target === bg) closeSheet(); });
    document.body.appendChild(bg);
    if (onMount) onMount(bg);
  }
  function closeSheet() { const s = $('#sheet'); if (s) s.remove(); if (UI.renderPending) render(); }

  function pillsPrio(cur) { return Object.keys(PRIO).map(p => `<button type="button" class="pill ${cur === p ? 'on' : ''}" data-prio="${p}"><i style="background:${PRIO[p]}"></i>${p}</button>`).join(''); }
  // úprava / nový úkol; mode: {task} | {fromPoint:{p,x}} | {sug}
  function taskSheet(mode) {
    const t = mode.task, fp = mode.fromPoint, sg = mode.sug;
    const init = t ? t : fp ? { Text: fp.p.Name + ': ' + fp.x.Text, Priority: 'Střední' } : sg ? { Text: sg.text, Priority: sg.priority, Due: sg.due, WaitingFor: sg.waitingFor } : { Text: '', Priority: 'Střední' };
    let prio = init.Priority || 'Střední';
    sheet(`<h3>${t ? 'Upravit úkol' : fp ? 'Nový úkol z hovoru' : sg ? 'Nový úkol z návrhu' : 'Nový úkol'}</h3>
      ${fp ? `<div class="hint">Bod „${esc(fp.x.Text)}“ se tím označí jako probraný.</div>` : sg && sg.source ? `<div class="hint">Zdroj: ${esc(sg.source)}</div>` : ''}
      <label>Úkol</label><textarea id="t_text" rows="2">${esc(init.Text)}</textarea>
      <label>Priorita</label><div class="pills" id="t_prio">${pillsPrio(prio)}</div>
      <label>Termín</label><div class="pills" style="margin-bottom:8px"><button type="button" class="pill" data-due="0">Dnes</button><button type="button" class="pill" data-due="1">Zítra</button>
        <button type="button" class="pill" data-due="7">Za týden</button><button type="button" class="pill" data-due="">Bez termínu</button></div>
      <input type="date" id="t_due" value="${esc(init.Due || '')}">
      <label>Čekám na (nepovinné)</label><input type="text" id="t_wait" value="${esc(init.WaitingFor || '')}" placeholder="Kdo a co – např. Doležal: podepsaný protokol">
      <div class="hint">Claude ráno zkontroluje, jestli odpověď přišla, a po 3 pracovních dnech připraví připomínku.</div>
      ${t ? `<label class="toggle"><input type="checkbox" id="t_done" ${t.Done ? 'checked' : ''} style="width:20px;height:20px"> Hotovo</label>` : ''}
      <div class="foot">${t ? `<button class="btn ghost left" data-sheet="del">${ico('trash')}Smazat</button>` : ''}
        <button class="btn ghost" data-sheet="cancel">Zrušit</button><button class="btn" data-sheet="ok">${t ? 'Uložit' : 'Vytvořit úkol'}</button></div>`, bg => {
      bg.querySelector('#t_prio').addEventListener('click', e => { const b = e.target.closest('[data-prio]'); if (!b) return; prio = b.dataset.prio; bg.querySelectorAll('[data-prio]').forEach(x => x.classList.toggle('on', x === b)); });
      bg.querySelectorAll('[data-due]').forEach(b => b.addEventListener('click', () => { bg.querySelector('#t_due').value = b.dataset.due === '' ? '' : Y.localDate(addDays(today0(), +b.dataset.due)); }));
      bg.addEventListener('click', e => {
        const a = e.target.closest('[data-sheet]'); if (!a) return;
        if (a.dataset.sheet === 'cancel') return closeSheet();
        if (a.dataset.sheet === 'del') { closeSheet(); removeTask(t); return; }
        const text = bg.querySelector('#t_text').value.trim(); if (!text) return;
        const due = bg.querySelector('#t_due').value, wait = bg.querySelector('#t_wait').value.trim();
        if (t) {
          if (wait !== t.WaitingFor) t.WaitingSince = wait ? Y.localDate() : '';
          Object.assign(t, { Text: text, Priority: prio, Due: due, WaitingFor: wait, Done: bg.querySelector('#t_done').checked });
        } else if (sg) {
          approveSuggestion(sg, { Text: text, Priority: prio, Due: due, WaitingFor: wait, WaitingSince: wait ? Y.localDate() : '' }, true);
        } else {
          const nt = newTask({ Text: text, Priority: prio, Due: due, WaitingFor: wait, WaitingSince: wait ? Y.localDate() : '', Source: fp ? 'hovor' : '' });
          if (fp) { Object.assign(fp.x, { TaskId: nt.Id, TaskText: nt.Text, Done: true, DoneAt: Y.localStamp() }); toast('Úkol vytvořen, bod je probraný'); }
        }
        closeSheet(); changed(400);
      });
      if (!t) setTimeout(() => { const ta = bg.querySelector('#t_text'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 60);
    });
  }

  function quickSheet() {
    sheet(`<h3>Rychlý zápis</h3><input type="text" id="q_text" placeholder="Co je potřeba udělat?" autocomplete="off" enterkeyhint="done" style="margin-top:10px">
      <div class="preview" id="q_prev"></div>
      <div class="hint">„Novák: …“ = bod k probrání · „čekám: …“ = čekám na odpověď · ! = vysoká priorita · dnes / zítra na konci = termín</div>
      <div class="foot"><button class="btn ghost" data-sheet="cancel">Zrušit</button><button class="btn" data-sheet="ok">Uložit</button></div>`, bg => {
      const inp = bg.querySelector('#q_text'), prev = bg.querySelector('#q_prev');
      const upd = () => {
        const q = parseQuick(inp.value);
        if (!q.text) { prev.textContent = ''; return; }
        prev.textContent = '→ ' + (q.kind === 'point' ? 'Bod k probrání pro ' + q.person.Name :
          [q.waiting ? 'Čekám na: ' + q.waiting : 'Nový úkol', q.priority === 'Vysoká' ? 'vysoká priorita' : '', q.due ? 'termín ' + formatDue(parseDate(q.due)).toLowerCase() : ''].filter(Boolean).join(' · '));
      };
      const ok = () => {
        const q = parseQuick(inp.value); if (!q.text) return;
        if (q.kind === 'point') { newPoint(q.person, q.text); toast('Bod přidán: ' + q.person.Name); }
        else { newTask({ Text: q.text, Priority: q.priority, Due: q.due, WaitingFor: q.waiting, WaitingSince: q.waiting ? Y.localDate() : '', Source: 'rychlý zápis' }); toast('Úkol přidán'); }
        closeSheet(); changed(400);
      };
      inp.addEventListener('input', upd);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
      bg.addEventListener('click', e => { const a = e.target.closest('[data-sheet]'); if (!a) return; if (a.dataset.sheet === 'cancel') closeSheet(); else ok(); });
      setTimeout(() => inp.focus(), 60);
    });
  }

  // ---------- oznámení ----------
  let toastT = null;
  function toast(text, undoFn, label) {
    let el = $('#toast'); if (el) el.remove();
    el = document.createElement('div'); el.className = 'toast'; el.id = 'toast';
    el.innerHTML = `<span>${esc(text)}</span>${undoFn ? `<button>${esc(label || 'Vrátit')}</button>` : ''}`;
    if (undoFn) el.querySelector('button').addEventListener('click', () => { el.remove(); undoFn(); });
    document.body.appendChild(el);
    clearTimeout(toastT); toastT = setTimeout(() => el.remove(), undoFn ? 6000 : 3000);
  }

  // ---------- akce ----------
  function removeTask(t) {
    const i = S.tasks.indexOf(t); if (i < 0) return;
    S.tasks.splice(i, 1); changed();
    toast('Úkol byl smazán', () => { S.tasks.splice(Math.min(i, S.tasks.length), 0, t); changed(); });
  }
  function endCall() {
    const p = personById(S.call.personId); const st = parseLocal(S.call.start), en = new Date();
    const min = Math.max(1, Math.round((en - st) / 60000));
    S.call = null; clearInterval(callInt);
    if (!p) { changed(); return; }
    p.Calls.push({ Start: Y.localStamp(st), End: Y.localStamp(en), Minutes: min });
    const res = p.Points.filter(x => { const d = parseLocal(x.DoneAt); return x.Done && d && d >= st; });
    changed(200);
    toast(`Hovor ukončen (${min} min) · ${res.length} probráno`, () => shareText(callNotes(p), 'Zápis z hovoru'), 'Sdílet zápis');
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a || a.tagName === 'FORM') return;
    const act = a.dataset.act, id = a.dataset.id;
    switch (act) {
      case 'login': login(); break;
      case 'status': if (UI.status === 'login') login(); else if (UI.status === 'off') toast(UI.statusText || 'Offline – změny se uloží později'); else sync(); break;
      case 'view': UI.view = a.dataset.v; UI.person = null; history.replaceState(null, '', location.pathname + location.search); render(); window.scrollTo(0, 0); break;
      case 'quick': quickSheet(); break;
      case 'filter': UI.filter = a.dataset.f; render(); break;
      case 'toggle': { const t = taskById(id); if (t) { t.Done = !t.Done; changed(); } break; }
      case 'edit': { const t = taskById(id); if (t) taskSheet({ task: t }); break; }
      case 'url': window.open(a.dataset.url, '_blank', 'noopener'); break;
      case 'cleardone': { const d = S.tasks.filter(t => t.Done); S.tasks = S.tasks.filter(t => !t.Done); changed(); toast('Smazáno ' + d.length, () => { S.tasks.push(...d); changed(); }); break; }
      case 'fullplan': UI.fullPlan = !UI.fullPlan; render(); break;
      case 'hideweek': S.weekHidden = S.weekMt.split('|')[0]; save(); render(); break;
      case 'sugadd': { const sg = suggestions().find(x => x.id === id); if (sg) { approveSuggestion(sg); toast(sg.kind === 'point' ? 'Bod přidán k ' + sg.person : 'Úkol přidán'); } break; }
      case 'sugedit': { const sg = suggestions().find(x => x.id === id); if (sg) taskSheet({ sug: sg }); break; }
      case 'sugdel': decide(id, 'rejected'); changed(300); toast('Návrh zahozen', () => { decide(id, null); changed(300); }); break;
      case 'sugall': { const l = suggestions().filter(x => !x.auto); for (const sg of l) approveSuggestion(sg, null, true); changed(300); toast('Přidáno: ' + l.length); break; }
      case 'openperson': UI.view = 'people'; UI.person = id; UI.showDone = false; UI.noteOpen = {}; render(); window.scrollTo(0, 0); break;
      case 'backpeople': UI.person = null; render(); break;
      case 'startcall': S.call = { personId: id, start: Y.localStamp() }; changed(5000); setTimeout(() => { const ta = document.querySelector('textarea[data-note]'); if (ta) ta.focus(); }, 80); break;
      case 'endcall': endCall(); break;
      case 'sharenotes': { const p = personById(id); if (p) shareText(callNotes(p), 'Zápis z hovoru'); break; }
      case 'delperson': {
        const p = personById(id); if (!p) break;
        if (openPoints(p).length && !confirm(`Smazat ${p.Name} i s body k probrání?`)) break;
        const i = S.people.indexOf(p); S.people.splice(i, 1); UI.person = null; changed();
        toast(p.Name + ' – smazáno', () => { S.people.splice(i, 0, p); changed(); }); break;
      }
      case 'resolve': case 'reopen': {
        const p = personById(a.dataset.p), x = p && p.Points.find(y => y.Id === id); if (!x) break;
        x.Done = act === 'resolve'; x.DoneAt = x.Done ? Y.localStamp() : ''; changed();
        if (x.Done) toast('Bod je probraný', () => { x.Done = false; x.DoneAt = ''; changed(); });
        break;
      }
      case 'delpoint': {
        const p = personById(a.dataset.p), i = p ? p.Points.findIndex(y => y.Id === id) : -1; if (i < 0) break;
        const [x] = p.Points.splice(i, 1); changed(); toast('Bod byl smazán', () => { p.Points.splice(i, 0, x); changed(); }); break;
      }
      case 'pointtask': { const p = personById(a.dataset.p), x = p && p.Points.find(y => y.Id === id); if (x) taskSheet({ fromPoint: { p, x } }); break; }
      case 'opennote': UI.noteOpen[id] = true; render(); setTimeout(() => { const ta = document.querySelector(`textarea[data-note="${CSS.escape(id)}"]`); if (ta) ta.focus(); }, 50); break;
      case 'toggledone': UI.showDone = !UI.showDone; render(); break;
    }
  });
  document.addEventListener('submit', e => {
    const f = e.target; e.preventDefault();
    const inp = f.querySelector('input'); const v = inp.value.trim(); if (!v) return;
    if (f.dataset.act === 'addtask') { const q = parseQuick(v); if (q.kind === 'point') { newPoint(q.person, q.text); toast('Bod přidán: ' + q.person.Name); } else newTask({ Text: q.text, Priority: q.priority, Due: q.due, WaitingFor: q.waiting, WaitingSince: q.waiting ? Y.localDate() : '' }); }
    else if (f.dataset.act === 'addperson') { let p = S.people.find(x => x.Name.toLowerCase() === v.toLowerCase()); if (!p) p = newPerson(v); UI.person = p.Id; }
    else if (f.dataset.act === 'addpoint') { const p = personById(f.dataset.id); if (p) newPoint(p, v); }
    inp.value = ''; inp.blur(); changed();
    setTimeout(() => { const n = document.getElementById(inp.id); if (n && f.dataset.act !== 'addperson') n.focus(); }, 30);
  });
  // poznámky a jméno: zapisují se rovnou do dat, ukládají se chvíli po dopsání
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.note) { const p = personById(el.dataset.p), x = p && p.Points.find(y => y.Id === el.dataset.note); if (x) { x.Note = el.value; save(); scheduleSync(2500); } }
    else if (el.dataset.field) { const p = personById(el.dataset.id); if (p) { p[el.dataset.field] = el.value; save(); scheduleSync(2500); } }
  });
  document.addEventListener('focusout', () => setTimeout(() => {
    const a = document.activeElement;
    if (UI.renderPending && !(a && a.closest && a.closest('#main') && /^(INPUT|TEXTAREA)$/.test(a.tagName)) && !$('#sheet')) render();
  }, 50));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
  window.addEventListener('online', () => sync());
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 60000);

  // ---------- ukázková data ----------
  function demoSeed() {
    const d = Y.localDate(), tm = Y.localDate(addDays(new Date(), 1)), now = new Date().toISOString();
    const f = (data) => ({ mt: now, data });
    return {
      'ukoly.json': f([
        { Id: 't1', Text: 'Připravit předávací protokol Krahulov', Priority: 'Vysoká', Due: d, Done: false, Created: d + 'T08:00:00' },
        { Id: 't2', Text: 'Podepsaný protokol', Priority: 'Střední', Due: '', Done: false, Created: d + 'T08:00:00', WaitingFor: 'Vaněk (ADW): podpis', WaitingSince: Y.localDate(addDays(new Date(), -6)) },
        { Id: 't3', Text: 'Objednat 20 000 tagů pro Ambiflex', Priority: 'Střední', Due: tm, Done: false, Created: d + 'T09:00:00' }]),
      'lide.json': f([{ Id: 'p1', Name: 'Jan Novák', Info: 'CROK, jan@crok.cz', Created: d + 'T08:00:00', Calls: [],
        Points: [{ Id: 'x1', Text: 'Termín dodání čteček pro Krahulov', Created: d + 'T08:00:00' }, { Id: 'x2', Text: 'Cenová nabídka na 20 000 tagů', Note: 'chce slevu nad 10 000 ks', Created: d + 'T08:01:00' }] },
        { Id: 'p2', Name: 'Petra Dvořáková', Info: 'Zebra', Created: d + 'T08:00:00', Calls: [], Points: [] }]),
      ['prehled-' + d + '.json']: f({ date: d, generatedAt: d + 'T06:47:00', summary: 'Dopoledne soustředěná práce, odpoledne hovory.',
        top3: [{ title: 'Krahulov [ADW]', text: 'Předávací protokol – podpis dnes' }], schedule: [{ time: '08:00–08:30', kind: 'mail', text: 'Vyřídit koncepty e-mailů' }, { time: '09:00–11:00', kind: 'work', text: 'Nabídka NABB-2026-114', taskId: 't1' }, { time: '14:00–14:30', kind: 'meeting', text: 'Call s Janem Novákem' }],
        calls: [{ title: 'Jan Novák', text: '2 body: termín čteček; cena tagů' }], waiting: [{ title: 'Vaněk (ADW)', text: 'podpis protokolu od 17. 11.' }], ifTime: [], ahead: [], note: '', markdown: '' }),
      ['navrhy-' + d + '-0630.json']: f({ generatedAt: d + 'T06:31:00', items: [{ id: 'g1', kind: 'task', text: 'Poslat ADW zálohovou fakturu 80 %', priority: 'Vysoká', due: tm, source: 'e-mail od Jana Králová (ADW)' }, { id: 's2', kind: 'point', text: 'Kdo z Inmedias dodá API k Heliosu', person: 'Novák', source: 'Slack #krahulov' }] }),
      ['zitra-' + tm + '.json']: f({ date: tm, generatedAt: d + 'T16:30:00', meetings: [{ time: '09:00–10:00', title: 'Krahulov – kontrolní den', with: 'Petr Vaněk (ADW FEED)', prep: ['Protokol čeká na podpis od 20. 11.'], points: ['kdo povede školení obsluhy'] }] })
    };
  }

  // ---------- start ----------
  if ('serviceWorker' in navigator && !DEMO && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  render();
  if (location.hash === '#zapis') { history.replaceState(null, '', location.pathname + location.search); setTimeout(quickSheet, 100); }   // zástupce „Rychlý zápis“ z ikony
  initAuth();
  if (hasToken()) sync(); else if (S.everLoggedIn) setStatus('login');
  window.__mu = { S, UI, sync, render, parseQuick };   // ladění
})();
