// Mini Úkoly – slučování dat mezi zařízeními. Stejná pravidla jako Sync.ps1 v aplikaci pro Windows:
// každá položka má Updated (UTC), smazané položky jsou v smazane.json (Id → čas smazání),
// při slučování vyhraje novější změna, při shodě ta místní.
(function (root) {
  'use strict';

  const TASK_FIELDS = ['Text', 'Priority', 'Due', 'Done', 'Created', 'WaitingFor', 'WaitingSince', 'Url', 'Source', 'DoneAt'];
  const PERSON_FIELDS = ['Name', 'Info', 'Created'];
  const POINT_FIELDS = ['Text', 'Note', 'Done', 'Created', 'DoneAt', 'TaskId', 'TaskText', 'WaitingFor'];
  const PRIORITIES = ['Vysoká', 'Střední', 'Nízká'];

  const s = v => (v === null || v === undefined) ? '' : String(v);
  const utcStamp = () => new Date().toISOString();                       // 2026-11-23T15:08:22.197Z
  const pad = n => String(n).padStart(2, '0');
  function localStamp(d) {                                                // 2026-11-23T16:08:22 (místní čas)
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  const localDate = d => localStamp(d).slice(0, 10);
  const cmp = (a, b) => { a = s(a); b = s(b); return a < b ? -1 : a > b ? 1 : 0; };   // jako CompareOrdinal

  function normTask(i) {
    i = i || {};
    return {
      Id: s(i.Id), Text: s(i.Text), Priority: PRIORITIES.includes(s(i.Priority)) ? s(i.Priority) : 'Střední',
      Due: s(i.Due), Done: !!i.Done, Created: s(i.Created), WaitingFor: s(i.WaitingFor), WaitingSince: s(i.WaitingSince),
      Url: s(i.Url), Source: s(i.Source), DoneAt: s(i.DoneAt), Updated: s(i.Updated)
    };
  }
  function normPoint(x) {
    x = x || {};
    return {
      Id: s(x.Id), Text: s(x.Text), Note: s(x.Note), Done: !!x.Done, Created: s(x.Created), DoneAt: s(x.DoneAt),
      TaskId: s(x.TaskId), TaskText: s(x.TaskText), WaitingFor: s(x.WaitingFor), Updated: s(x.Updated)
    };
  }
  const arr = v => Array.isArray(v) ? v : (v === null || v === undefined ? [] : [v]);
  function normPerson(i) {
    i = i || {};
    return {
      Id: s(i.Id), Name: s(i.Name), Info: s(i.Info), Created: s(i.Created), Updated: s(i.Updated),
      Points: arr(i.Points).filter(Boolean).map(normPoint),
      Calls: arr(i.Calls).filter(Boolean).map(c => ({ Start: s(c.Start), End: s(c.End), Minutes: parseInt(c.Minutes, 10) || 0 }))
    };
  }

  const sig = (o, fields) => fields.map(f => s(o[f])).join('\u001f');

  function tombed(tombs, item) {
    const t = tombs[item.Id];
    return !!t && cmp(t, item.Updated) >= 0;
  }

  // Změněným položkám nastaví Updated, chybějící zapíše mezi smazané. Vrací true, když se něco změnilo.
  function markChanges(items, sigs, fields, tombs) {
    const now = utcStamp(); let changed = false; const seen = {};
    for (const it of items) {
      seen[it.Id] = true;
      const g = sig(it, fields);
      if (Object.prototype.hasOwnProperty.call(sigs, it.Id)) {
        if (sigs[it.Id] !== g) { it.Updated = now; changed = true; }
      } else {
        if (!it.Updated || tombs[it.Id]) it.Updated = now;
        delete tombs[it.Id]; changed = true;
      }
    }
    for (const id of Object.keys(sigs)) if (!seen[id]) { tombs[id] = now; changed = true; }
    return changed;
  }
  function setSigs(items, sigs, fields) {
    for (const k of Object.keys(sigs)) delete sigs[k];
    for (const it of items) sigs[it.Id] = sig(it, fields);
  }

  function mergeById(local, remote, tombs, onBoth) {
    const map = new Map();
    for (const r of remote) if (r.Id) map.set(r.Id, r);
    for (const l of local) {
      if (!l.Id) continue;
      if (map.has(l.Id)) {
        const r = map.get(l.Id);
        const win = cmp(l.Updated, r.Updated) >= 0 ? l : r;
        if (onBoth) onBoth(win, l, r);
        map.set(l.Id, win);
      } else map.set(l.Id, l);
    }
    return [...map.values()].filter(x => !tombed(tombs, x));
  }

  function mergePeople(local, remote, tombs) {
    return mergeById(local, remote, tombs, (win, l, r) => {
      // stálé pořadí: podle vzniku, při shodě podle místního pořadí (ne podle náhodného Id)
      const order = {}; let i = 0;
      for (const x of l.Points) order[x.Id] = i++;
      for (const x of r.Points) if (!(x.Id in order)) order[x.Id] = 100000 + i++;
      const pts = mergeById(l.Points, r.Points, tombs, null)
        .sort((a, b) => cmp(a.Created, b.Created) || (order[a.Id] - order[b.Id]));
      const calls = {};
      for (const c of [...l.Calls, ...r.Calls]) if (c && c.Start) calls[c.Start] = c;
      win.Points = pts;
      win.Calls = Object.keys(calls).sort().map(k => calls[k]);
    });
  }

  function mergeTombs(into, from) {
    for (const k of Object.keys(from || {})) if (!into[k] || cmp(from[k], into[k]) > 0) into[k] = s(from[k]);
  }
  function pruneTombs(tombs) {
    const limit = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
    const o = {};
    for (const k of Object.keys(tombs).sort()) if (cmp(tombs[k], limit) >= 0) o[k] = tombs[k];
    return o;
  }

  const allPoints = people => people.flatMap(p => p.Points);

  const api = {
    TASK_FIELDS, PERSON_FIELDS, POINT_FIELDS, utcStamp, localStamp, localDate, cmp,
    normTask, normPoint, normPerson, sig, tombed, markChanges, setSigs, mergeById, mergePeople, mergeTombs, pruneTombs, allPoints
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MUSync = api;
})(this);
