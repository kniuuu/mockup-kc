/* ECP mockups · shared version history & diff popup (ecp-version-diff). Vanilla ES5, no dependencies.
 * Data: window.ECP_VERSIONS (assets/versions.js) + providers registered with ECPVH.provide(prefix, fn).
 * Triggers: any element with data-vh="<id>" [data-vh-a, data-vh-b, data-vh-view="split|unified", data-vh-restore-off="<reason>"].
 * Deep link: ?vh=<id>[&a=v2&b=v3&view=unified&only=1] opens the popup on load; state is mirrored to the URL while open.
 * Reuses: .q-dlg chrome, .q-line tints, .q-dcol-h, .segmented, select.input, the [data-q-confirm] / [data-toast] delegates and
 * role gates (window.ECP_applyGates) from screens.js. All text goes through textContent or esc(). */
(function () {
  var I = window.ECP_I18N || null;
  function fill(s, a) { return String(s).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); }
  function T(k, v, a) { return I && I.tr ? I.tr(k, v, a) : fill(v, a); }
  function TV(s) { return I && I.tv && s ? I.tv(s) : s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function warn(m) { if (window.console) console.warn('[ECPVH] ' + m); }

  var REG = window.ECP_VERSIONS = window.ECP_VERSIONS || {};
  var PROV = [];
  var ST_VI = { draft: 'Draft', pending: 'Chờ duyệt', active: 'Active', published: 'Đã xuất bản', superseded: 'Đã thay thế', rollback: 'Rollback' };
  function stLabel(s) { if (!s) return ''; var m = window.ECP_VH_STATUS || ST_VI; return T('vh.st.' + s, m[s] || ST_VI[s] || s || ''); }
  // a version may carry its own status label and display id (FE VersionEntry.statusLabel, the KB "v2.0 (hiện tại)"): lbl / vl = [i18nKey, vi, args]
  function stOf(x) { return x && x.lbl ? T(x.lbl[0], x.lbl[1], x.lbl[2]) : stLabel(x && x.status); }
  var CURRENT = { active: 1, published: 1 };

  /* ---------- data ---------- */
  function provide(prefix, fn) { if (typeof fn === 'function') PROV.push([String(prefix), fn]); }
  function drainQueue() {
    var q = window.KCVH_PROVIDERS;
    if (q && q.length) { while (q.length) { var p = q.shift(); provide(p[0], p[1]); } }
  }
  function def(id) {
    if (!id) return null;
    if (own(REG, id) && REG[id] && REG[id].versions) return REG[id];
    drainQueue();
    for (var i = 0; i < PROV.length; i++) {
      if (id.indexOf(PROV[i][0]) === 0) {
        try { var d = PROV[i][1](id); if (d) return d; } catch (e) { warn('provider ' + PROV[i][0] + ' failed: ' + e.message); }
      }
    }
    return null;
  }
  function readSrc(sel) {
    var el = null;
    try { el = document.querySelector(sel); } catch (e) { el = null; }
    if (!el) return null;
    var t = el.tagName === 'TEXTAREA' ? el.defaultValue : el.textContent;
    return String(t).replace(/\r\n?/g, '\n');
  }
  function emptyOf(kind) { return kind === 'text' ? '' : kind === 'fields' ? {} : []; }
  function applyUndo(txt, pairs, ctx, problems) {
    (pairs || []).forEach(function (p, k) {
      var from = String(p[0]), to = String(p[1] == null ? '' : p[1]);
      var i = from ? txt.indexOf(from) : -1, j = i < 0 ? -1 : txt.indexOf(from, i + 1);
      if (i < 0 || j >= 0) { problems.push({ id: ctx.id, problem: ctx.v + ' undo #' + (k + 1) + (i < 0 ? ' not found' : ' not unique') + ': ' + from.slice(0, 60) }); return; }
      txt = txt.slice(0, i) + to + txt.slice(i + from.length);
    });
    return txt;
  }
  function applyFields(o, p) {
    o = o || {};
    if (!p) return o;
    if (p.set) for (var k in p.set) if (own(p.set, k)) o[k] = p.set[k];
    (p.del || []).forEach(function (k) { delete o[k]; });
    return o;
  }
  function applyList(arr, p) {
    arr = arr || [];
    if (!p) return arr;
    var dl = p.del || [];
    arr = arr.filter(function (it) { return dl.indexOf(it.id) === -1; });
    if (p.set) arr.forEach(function (it) { var s = p.set[it.id]; if (s) for (var k in s) if (own(s, k)) it[k] = s[k]; });
    (p.add || []).forEach(function (it) {
      var c = clone(it), at = c.at; delete c.at;
      if (typeof at === 'number' && at >= 0 && at <= arr.length) arr.splice(at, 0, c); else arr.push(c);
    });
    if (p.order) {
      var map = {}; arr.forEach(function (it) { map[it.id] = it; });
      var nx = []; p.order.forEach(function (id) { if (map[id]) { nx.push(map[id]); delete map[id]; } });
      arr.forEach(function (it) { if (map[it.id]) nx.push(it); });
      arr = nx;
    }
    return arr;
  }
  function resolve(d, problems) {
    problems = problems || [];
    var order = [], content = {}, prev = null, id = d && d._id;
    ((d && d.versions) || []).forEach(function (ver, i) {
      var c = {};
      (d.sections || []).forEach(function (s) {
        var val;
        if (ver.data && own(ver.data, s.id)) val = clone(ver.data[s.id]);
        else if (prev) {
          val = clone(prev[s.id]);
          if (s.kind === 'text') val = applyUndo(String(val || ''), ver.undo && ver.undo[s.id], { id: id, v: ver.v }, problems);
          else if (s.kind === 'fields') val = applyFields(val, ver.patch && ver.patch[s.id]);
          else val = applyList(val, ver.patch && ver.patch[s.id]);
        } else if (i === 0 && s.src) {
          val = readSrc(s.src);
          if (val === null) { problems.push({ id: id, problem: 'src not found: ' + s.src }); val = emptyOf(s.kind); }
        } else val = emptyOf(s.kind);
        if (s.kind === 'text') val = String(val == null ? '' : val).replace(/\r\n?/g, '\n');
        c[s.id] = val;
      });
      order.push(ver.v); content[ver.v] = c; prev = c;
    });
    return { order: order, content: content, problems: problems };
  }
  function validate() {
    var out = [];
    Object.keys(REG).forEach(function (id) {
      var d = REG[id];
      if (!d || !d.versions || !d.versions.length) { out.push({ id: id, problem: 'no versions' }); return; }
      // defs whose text sources live on another page are skipped (only validated where their src elements exist)
      var srcs = (d.sections || []).filter(function (s) { return s.src; });
      if (srcs.length && !srcs.some(function (s) { return readSrc(s.src) !== null; })) return;
      d._id = id;
      var probs = resolve(d, []).problems;
      probs.forEach(function (p) { out.push(p); });
      var seen = {};
      d.versions.forEach(function (v) { if (seen[v.v]) out.push({ id: id, problem: 'duplicate version ' + v.v }); seen[v.v] = 1; });
    });
    return out;
  }

  /* ---------- diff algorithms ---------- */
  // LCS over two arrays → ops [{t:'eq'|'del'|'ins', i, j}] (dels before inserts inside a change block)
  function lcs(A, B, eq) {
    eq = eq || function (x, y) { return x === y; };
    var n = A.length, m = B.length, s = 0, e = 0, ops = [], k;
    while (s < n && s < m && eq(A[s], B[s])) s++;
    while (e < n - s && e < m - s && eq(A[n - 1 - e], B[m - 1 - e])) e++;
    for (k = 0; k < s; k++) ops.push({ t: 'eq', i: k, j: k });
    var a = A.slice(s, n - e), b = B.slice(s, m - e), N = a.length, M = b.length, i, j, dp = [];
    for (i = 0; i <= N; i++) { dp.push(new Array(M + 1)); dp[i][M] = 0; }
    for (j = 0; j <= M; j++) dp[N][j] = 0;
    for (i = N - 1; i >= 0; i--) for (j = M - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    i = 0; j = 0;
    var dels = [], inss = [];
    function flush() { dels.forEach(function (o) { ops.push(o); }); inss.forEach(function (o) { ops.push(o); }); dels = []; inss = []; }
    while (i < N || j < M) {
      if (i < N && j < M && eq(a[i], b[j])) { flush(); ops.push({ t: 'eq', i: i + s, j: j + s }); i++; j++; }
      else if (j >= M || (i < N && dp[i + 1][j] >= dp[i][j + 1])) { dels.push({ t: 'del', i: i + s, j: null }); i++; }
      else { inss.push({ t: 'ins', i: null, j: j + s }); j++; }
    }
    flush();
    for (k = 0; k < e; k++) ops.push({ t: 'eq', i: n - e + k, j: m - e + k });
    return ops;
  }
  var TOK = /(\s+|[.,;:()\[\]{}"“”·→—–\-])/;
  function tokens(s) { return String(s).split(TOK).filter(function (x) { return x !== '' && x !== undefined; }); }
  // word-level diff → { A: html, B: html } with changed tokens wrapped in <mark class="kvh-w">
  function words(a, b) {
    var ta = tokens(a), tb = tokens(b), ops = lcs(ta, tb), sa = [], sb = [];
    ops.forEach(function (o) {
      if (o.t === 'eq') { sa.push([ta[o.i], 0]); sb.push([tb[o.j], 0]); }
      else if (o.t === 'del') sa.push([ta[o.i], 1]);
      else sb.push([tb[o.j], 1]);
    });
    function html(seq) {
      // a single unchanged space between two changed tokens joins them into one highlight
      for (var i = 1; i < seq.length - 1; i++) if (!seq[i][1] && /^\s+$/.test(seq[i][0]) && seq[i - 1][1] && seq[i + 1][1]) seq[i][1] = 2;
      var h = '', on = false;
      seq.forEach(function (x) {
        if (x[1] && !on) { h += '<mark class="kvh-w">'; on = true; }
        if (!x[1] && on) { h += '</mark>'; on = false; }
        h += esc(x[0]);
      });
      return on ? h + '</mark>' : h;
    }
    return { A: html(sa), B: html(sb) };
  }
  function lines(t) { return String(t == null ? '' : t).replace(/\r\n?/g, '\n').split('\n'); }
  function diffText(aText, bText) {
    var A = lines(aText), B = lines(bText), raw = lcs(A, B), out = [], k = 0;
    while (k < raw.length) {
      if (raw[k].t === 'eq') { out.push({ t: 'eq', a: raw[k].i + 1, b: raw[k].j + 1, A: A[raw[k].i], B: B[raw[k].j] }); k++; continue; }
      var D = [], N = [];
      while (k < raw.length && raw[k].t === 'del') D.push(raw[k++]);
      while (k < raw.length && raw[k].t === 'ins') N.push(raw[k++]);
      var p = Math.min(D.length, N.length), x;
      for (x = 0; x < p; x++) {
        var ta = A[D[x].i], tb = B[N[x].j];
        out.push({ t: 'mod', a: D[x].i + 1, b: N[x].j + 1, A: ta, B: tb, words: words(ta, tb) });
      }
      for (x = p; x < D.length; x++) out.push({ t: 'del', a: D[x].i + 1, b: null, A: A[D[x].i], B: null });
      for (x = p; x < N.length; x++) out.push({ t: 'ins', a: null, b: N[x].j + 1, A: null, B: B[N[x].j] });
    }
    return out;
  }
  function val(v) { return v == null ? '' : Object.prototype.toString.call(v) === '[object Array]' ? v.join(', ') : String(v); }
  function diffFields(spec, A, B, single) {
    var keys = [], lab = {};
    (spec || []).forEach(function (f) { keys.push(f[0]); lab[f[0]] = f[1]; });
    [A, B].forEach(function (o) { if (o) Object.keys(o).forEach(function (k) { if (keys.indexOf(k) === -1) { keys.push(k); lab[k] = k; } }); });
    var rows = [];
    keys.forEach(function (k) {
      var ia = !single && own(A, k), ib = own(B, k);
      if (!ia && !ib) return;
      var va = ia ? val(A[k]) : '', vb = ib ? val(B[k]) : '';
      var t = single ? 'eq' : ia && ib ? (va === vb ? 'eq' : 'mod') : ib ? 'ins' : 'del';
      rows.push({ t: t, key: k, label: lab[k], A: va, B: vb, words: t === 'mod' ? words(va, vb) : null });
    });
    return rows;
  }
  // list / tree diff keyed on item.id → rows in B order (deleted rows at their A position)
  function diffList(cols, A, B, single) {
    A = single ? [] : (A || []); B = B || [];
    var mA = {}, mB = {}, pA = {}, pB = {};
    A.forEach(function (it, i) { mA[it.id] = it; pA[it.id] = i; });
    B.forEach(function (it, i) { mB[it.id] = it; pB[it.id] = i; });
    function depth(id) {
      var d = 0, cur = (mB[id] || mA[id]), seen = {};
      while (cur && cur.parent && !seen[cur.parent] && d < 8) { seen[cur.parent] = 1; d++; cur = mB[cur.parent] || mA[cur.parent]; }
      return d;
    }
    function name(id) { var it = mB[id] || mA[id]; return it ? val(it.title || it.name || it.id) : '—'; }
    function cellsOf(it) { var o = {}; (cols || []).forEach(function (c) { o[c[0]] = val(it[c[0]]); }); return o; }
    if (single) return B.map(function (it) { return { t: 'eq', id: it.id, depth: depth(it.id), cells: cellsOf(it), moved: false, detail: [], prev: null }; });
    var ca = A.filter(function (it) { return own(mB, it.id); }).map(function (it) { return it.id; });
    var cb = B.filter(function (it) { return own(mA, it.id); }).map(function (it) { return it.id; });
    var keep = {};
    lcs(ca, cb).forEach(function (o) { if (o.t === 'eq') keep[ca[o.i]] = 1; });
    function row(id, t) {
      var a = mA[id], b = mB[id], ch = [], moved = false, det = [];
      if (t === 'eq') {
        (cols || []).forEach(function (c) { var x = val(a[c[0]]), y = val(b[c[0]]); if (x !== y) ch.push({ label: c[1], A: x, B: y }); });
        if ((a.parent || '') !== (b.parent || '')) { moved = true; det.push(T('vh.moved', 'Chuyển: {a} → {b}', { a: a.parent ? name(a.parent) : '—', b: b.parent ? name(b.parent) : '—' })); }
        else if (!keep[id]) { moved = true; det.push(T('vh.pos', 'Vị trí {a} → {b}', { a: pA[id] + 1, b: pB[id] + 1 })); }
        ch.forEach(function (c) { det.push(TV(c.label) + ': ' + c.A + ' → ' + c.B); });
        t = ch.length ? 'mod' : moved ? 'move' : 'eq';
      }
      return { t: t, id: id, depth: depth(id), cells: cellsOf(b || a), moved: moved, detail: det, prev: t === 'mod' ? cellsOf(a) : null };
    }
    var rows = [], placed = {};
    // deleted items anchored after their nearest previous A item that survives in B
    var after = {}, head = [];
    A.forEach(function (it, i) {
      if (own(mB, it.id)) return;
      var anc = null;
      for (var k = i - 1; k >= 0; k--) if (own(mB, A[k].id)) { anc = A[k].id; break; }
      if (anc) (after[anc] = after[anc] || []).push(it.id); else head.push(it.id);
    });
    head.forEach(function (id) { rows.push(row(id, 'del')); });
    B.forEach(function (it) {
      if (placed[it.id]) return; placed[it.id] = 1;
      rows.push(row(it.id, own(mA, it.id) ? 'eq' : 'ins'));
      (after[it.id] || []).forEach(function (id) { rows.push(row(id, 'del')); });
    });
    return rows;
  }
  function addCount(tot, t, moved) {
    if (t === 'ins') tot.add++;
    else if (t === 'del') tot.del++;
    else if (t === 'mod' || t === 'move' || moved) tot.mod++;
  }
  function countsText(c) {
    if (!c.add && !c.del && !c.mod) return T('vh.noChange', 'Không có thay đổi');
    // one diff notation (+ added · − removed · ~ edited); zero counts are hidden
    var p = [];
    if (c.add) p.push(T('vh.cAdd', '+{n} thêm', { n: c.add }));
    if (c.del) p.push(T('vh.cDel', '−{n} xoá', { n: c.del }));
    if (c.mod) p.push(T('vh.cMod', '~{n} sửa', { n: c.mod }));
    return p.join(' · ');
  }

  /* ---------- dialog ---------- */
  var S = null, dlg = null, el = {}, uid = 0;
  var ICO_X = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICO_SWAP = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 12 4 4-4 4"/><path d="M21 16H7"/></svg>';
  var MK = { ins: '＋', del: '−', mod: '~', move: '↪' };
  function mkName(t) { return t === 'ins' ? T('vh.mkAdd', 'Thêm') : t === 'del' ? T('vh.mkDel', 'Xoá') : t === 'move' ? T('vh.mkMove', 'Di chuyển') : T('vh.mkMod', 'Sửa'); }
  function build() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'kvh-dlg'; dlg.className = 'q-dlg kvh-dlg';
    dlg.setAttribute('aria-labelledby', 'kvh-t'); dlg.setAttribute('aria-modal', 'true');
    dlg.innerHTML =
      '<div class="q-dlg-head"><h2 id="kvh-t" class="modal-title job-ell"></h2><button class="icon-btn" type="button" data-kvh-close>' + ICO_X + '</button></div>' +
      '<div class="kvh-bar">' +
        '<div class="kvh-pick"><label for="kvh-a"></label><select id="kvh-a" class="input job-sel"></select></div>' +
        '<button class="icon-btn kvh-swap" type="button">' + ICO_SWAP + '</button>' +
        '<div class="kvh-pick"><label for="kvh-b"></label><select id="kvh-b" class="input job-sel"></select></div>' +
        '<div class="segmented kvh-seg" role="group"><button type="button" data-kvh-view="split" aria-pressed="true"></button><button type="button" data-kvh-view="unified" aria-pressed="false"></button></div>' +
        '<label class="check-row kvh-only"><input type="checkbox" id="kvh-only"><span></span></label>' +
        '<p class="kvh-count" aria-live="polite"></p>' +
      '</div>' +
      '<div class="kvh-main">' +
        '<nav class="kvh-rail" data-i18n-skip><div class="kvh-top" hidden></div><ol class="kvh-vlist"></ol></nav>' +
        '<div class="kvh-body" data-i18n-skip tabindex="0"></div>' +
      '</div>' +
      '<div class="q-dlg-foot"><span class="q-dlg-note kvh-note"></span><span class="kvh-release" hidden></span>' +
        '<button class="btn btn-secondary kvh-restore" type="button" data-q-confirm data-roles-disable=""></button>' +
        '<button class="btn btn-secondary kvh-done" type="button" data-kvh-close></button>' +
      '</div>';
    document.body.appendChild(dlg);
    el = {
      t: dlg.querySelector('#kvh-t'), x: dlg.querySelector('.q-dlg-head [data-kvh-close]'),
      la: dlg.querySelector('label[for="kvh-a"]'), lb: dlg.querySelector('label[for="kvh-b"]'),
      a: dlg.querySelector('#kvh-a'), b: dlg.querySelector('#kvh-b'), swap: dlg.querySelector('.kvh-swap'),
      seg: dlg.querySelector('.kvh-seg'), only: dlg.querySelector('#kvh-only'), onlyL: dlg.querySelector('.kvh-only span'),
      count: dlg.querySelector('.kvh-count'), rail: dlg.querySelector('.kvh-rail'), list: dlg.querySelector('.kvh-vlist'),
      body: dlg.querySelector('.kvh-body'), note: dlg.querySelector('.kvh-note'), top: dlg.querySelector('.kvh-top'), rel: dlg.querySelector('.kvh-release'),
      rst: dlg.querySelector('.kvh-restore'), done: dlg.querySelector('.kvh-done')
    };
    // selects follow the rail rule: A is the older side; picking A newer than B (or B older than A) swaps them.
    // Reverse compare stays available only through the explicit ⇄ swap button.
    el.a.addEventListener('change', function () { if (!S) return; S.a = el.a.value; if (S.a === S.b && S.a) S.a = older(S.b); orderAB(); S.exp = {}; render(); });
    el.b.addEventListener('change', function () { if (!S) return; S.b = el.b.value; if (S.a === S.b && S.a) S.a = older(S.b); orderAB(); S.exp = {}; render(); });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) { close(); return; }
      ensureToast();
      var t = e.target.closest ? e.target : e.target.parentNode;
      var c = t.closest('[data-kvh-close]'); if (c) { close(); return; }
      if (t.closest('.kvh-swap')) { if (S && S.a) { var x = S.a; S.a = S.b; S.b = x; S.exp = {}; render(); } return; }
      var vb = t.closest('[data-kvh-view]'); if (vb && S) { S.view = vb.getAttribute('data-kvh-view'); render(); return; }
      var ver = t.closest('.kvh-ver'); if (ver && S) { S.b = ver.getAttribute('data-kvh-v'); S.a = older(S.b); S.exp = {}; render(); focusVer(); return; }
      var sa = t.closest('.kvh-seta'); if (sa && S) { setA(sa.getAttribute('data-kvh-seta')); return; }
      var gp = t.closest('[data-kvh-gap]'); if (gp && S) { S.exp[gp.getAttribute('data-kvh-gap')] = 1; render(); var nx = el.body.querySelector('[data-kvh-anchor="' + gp.getAttribute('data-kvh-gap') + '"]'); if (nx) nx.focus(); return; }
    });
    el.only.addEventListener('change', function () { if (!S) return; S.only = el.only.checked; S.exp = {}; render(); });
    dlg.addEventListener('keydown', function (e) {
      var qd = document.getElementById('q-dialog');
      if (qd && qd.open) return; // nested confirm owns the keyboard
      // stop here so page-level Esc handlers (e.g. the viewer overlay's "Esc = leave page") do not also fire
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = [].filter.call(dlg.querySelectorAll('button, select, input, textarea, a[href], [tabindex]:not([tabindex="-1"])'), function (x) {
        return !x.disabled && x.getAttribute('aria-disabled') !== 'true' && x.getAttribute('tabindex') !== '-1' && x.getClientRects().length;
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], ae = document.activeElement;
      if (e.shiftKey && (ae === first || !dlg.contains(ae))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (ae === last || !dlg.contains(ae))) { e.preventDefault(); first.focus(); }
    });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    // the native 'close' event arrives late; ignore it when the popup was reopened meanwhile (else it wipes the new state)
    dlg.addEventListener('close', function () { if (!dlg.open) onClosed(); });
    if (I && I.apply) I.apply(dlg);
    return dlg;
  }
  function orderAB() { var o = S.res.order; if (S.a && o.indexOf(S.a) < o.indexOf(S.b)) { var x = S.a; S.a = S.b; S.b = x; } }
  function older(v) { var o = S.res.order, i = o.indexOf(v); return i >= 0 && i + 1 < o.length ? o[i + 1] : ''; }
  function setA(v) {
    var o = S.res.order;
    if (v === S.b) { var i = o.indexOf(v); S.b = i > 0 ? o[i - 1] : v; }
    S.a = v;
    if (o.indexOf(S.a) < o.indexOf(S.b)) { var x = S.a; S.a = S.b; S.b = x; } // A newer than B → swap
    S.exp = {}; render(); focusVer();
  }
  function focusVer() { var p = el.list.querySelector('.kvh-ver[aria-pressed="true"]'); if (p) p.focus(); }
  // the shared #q-toast lives in <body>; while the modal is open it must sit inside the dialog's top layer to be visible
  function ensureToast() {
    var t = document.getElementById('q-toast');
    if (!t) { t = document.createElement('div'); t.id = 'q-toast'; t.className = 'q-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); t.hidden = true; }
    if (dlg && dlg.open && t.parentNode !== dlg) dlg.appendChild(t);
    return t;
  }
  function releaseToast() { var t = document.getElementById('q-toast'); if (t && dlg && t.parentNode === dlg) document.body.appendChild(t); }

  function verObj(v) { var vs = S.def.versions; for (var i = 0; i < vs.length; i++) if (vs[i].v === v) return vs[i]; return null; }
  function dv(v) { var o = verObj(v); return o && o.vl ? T(o.vl[0], o.vl[1], o.vl[2]) : v; }
  function verLabel(v) { var o = verObj(v); return o ? dv(v) + ' · ' + stOf(o) : v; }
  function chrome() {
    var d = S.def, name = d.name || S.id;
    var tt = T('vh.title', 'Lịch sử phiên bản · {name}', { name: '\u0001' }).split('\u0001');
    el.t.innerHTML = esc(tt[0]) + '<span data-i18n-skip>' + esc(name) + '</span>' + esc(tt[1] || '');
    el.t.setAttribute('title', el.t.textContent);
    el.x.setAttribute('aria-label', T('vh.close', 'Đóng'));
    el.la.textContent = T('vh.base', 'Bản gốc (A)');
    el.lb.textContent = T('vh.compare', 'Bản so sánh (B)');
    el.swap.setAttribute('aria-label', T('vh.swap', 'Đổi A ↔ B')); el.swap.setAttribute('title', T('vh.swap', 'Đổi A ↔ B'));
    el.seg.setAttribute('aria-label', T('vh.viewMode', 'Kiểu hiển thị'));
    el.seg.children[0].textContent = T('vh.split', 'Song song');
    el.seg.children[1].textContent = T('vh.unified', 'Gộp');
    el.onlyL.textContent = T('vh.onlyChanges', 'Chỉ hiện thay đổi');
    el.rail.setAttribute('aria-label', T('vh.list', 'Danh sách phiên bản'));
    el.body.setAttribute('aria-label', T('vh.diffBody', 'Nội dung diff'));
    el.rst.textContent = T('vh.restore', 'Khôi phục phiên bản này');
    el.done.textContent = T('vh.close', 'Đóng');
  }
  function fillSel(sel, order, cur, withNone) {
    var h = '';
    order.forEach(function (v) { h += '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(verLabel(v)) + '</option>'; });
    if (withNone) h += '<option value=""' + (!cur ? ' selected' : '') + '>—</option>';
    sel.innerHTML = h;
    sel.value = cur || '';
  }
  function railHtml() {
    var o = S.res.order, h = '';
    o.forEach(function (v, i) {
      var x = verObj(v) || { v: v }, isA = v === S.a, isB = v === S.b, st = x.status || '';
      var parts = [dv(v), stOf(x), x.by, x.at].filter(Boolean).join(' · ') + (isA ? ' · ' + T('vh.base', 'Bản gốc (A)') : '');
      h += '<li class="kvh-vi' + (isA ? ' is-a' : '') + (isB ? ' is-b' : '') + '">' +
        '<button type="button" class="kvh-ver" data-kvh-v="' + esc(v) + '" aria-pressed="' + isB + '" aria-label="' + esc(parts) + '">' +
          '<span class="kvh-vh"><b class="mono kvh-vn">' + esc(dv(v)) + '</b><span class="kvh-st is-' + esc(st) + '"><span class="kvh-dot" aria-hidden="true"></span>' + esc(stOf(x)) + '</span>' +
          (isA || isB ? '<span class="kvh-ab" aria-hidden="true">' + (isB ? 'B' : 'A') + '</span>' : '') + '</span>' +
          '<span class="kvh-vm">' + esc([x.by, x.at].filter(Boolean).join(' · ')) + '</span>' +
          (x.sum ? '<span class="kvh-vs" title="' + esc(x.sum) + '">' + esc(x.sum) + '</span>' : '') +
        '</button>' +
        (i > 0 ? '<button type="button" class="link kvh-seta" data-kvh-seta="' + esc(v) + '" aria-label="' + esc(T('vh.setAAria', 'Đặt {v} làm bản gốc (A)', { v: dv(v) })) + '"' + (isA ? ' hidden' : '') + '>' + esc(T('vh.setA', 'Đặt làm A')) + '</button>' : '') +
      '</li>';
    });
    return h;
  }
  function colA() { return T('vh.colA', 'A · {v}', { v: verLabel(S.a) }); }
  function colB() { return T('vh.colB', 'B · {v}', { v: verLabel(S.b) }); }
  function lineCell(cls, ln, mk, html, srT) {
    return '<div class="q-line kvh-l' + (cls ? ' ' + cls : '') + '"><span class="kvh-ln" aria-hidden="true">' + (ln == null ? '' : ln) + '</span><span class="kvh-mk" aria-hidden="true">' + (mk || '') + '</span><span class="kvh-c">' + (srT ? '<span class="sr-only">' + esc(srT) + ': </span>' : '') + html + '</span></div>';
  }
  function uniCell(cls, la, lb, mk, html, srT) {
    return '<div class="q-line kvh-l kvh-u' + (cls ? ' ' + cls : '') + '"><span class="kvh-ln" aria-hidden="true">' + (la == null ? '' : la) + '</span><span class="kvh-ln" aria-hidden="true">' + (lb == null ? '' : lb) + '</span><span class="kvh-mk" aria-hidden="true">' + (mk || '') + '</span><span class="kvh-c">' + (srT ? '<span class="sr-only">' + esc(srT) + ': </span>' : '') + html + '</span></div>';
  }
  // collapse long unchanged runs when "Chỉ hiện thay đổi" is on → items: op | { gap: n, key }
  function collapse(ops, si) {
    if (!S.only) return ops;
    var out = [], k = 0, n = ops.length;
    while (k < n) {
      if (ops[k].t !== 'eq') { out.push(ops[k]); k++; continue; }
      var s = k; while (k < n && ops[k].t === 'eq') k++;
      var len = k - s, key = si + ':' + s;
      if (len <= 6 || S.exp[key]) { for (var x = s; x < k; x++) { if (x === s && S.exp[key]) ops[x]._anchor = key; out.push(ops[x]); } continue; }
      var lead = s === 0 ? 0 : 3, tail = k === n ? 0 : 3, hide = len - lead - tail;
      if (hide < 2) { for (x = s; x < k; x++) out.push(ops[x]); continue; }
      for (x = s; x < s + lead; x++) out.push(ops[x]);
      out.push({ gap: hide, key: key });
      for (x = k - tail; x < k; x++) out.push(ops[x]);
    }
    return out;
  }
  function gapHtml(g, split) {
    var b = '<button type="button" class="q-line is-gap kvh-gap" data-kvh-gap="' + esc(g.key) + '">' + esc(T('vh.gap', '… {n} dòng không đổi', { n: g.gap })) + '</button>';
    return split ? '<div class="kvh-sbs-row kvh-gaprow">' + b + '</div>' : b;
  }
  function anchorAttr(o) { return o._anchor ? ' data-kvh-anchor="' + esc(o._anchor) + '" tabindex="-1"' : ''; }
  function secText(s, si, A, B, single, tot) {
    var c = { add: 0, del: 0, mod: 0 }, h = '';
    if (single) {
      var L = lines(B);
      h = '<div class="kvh-tx' + (s.code ? ' kvh-code' : '') + '"><div class="q-dcol-h">' + esc(colB()) + '</div>';
      L.forEach(function (l, i) { h += lineCell('', i + 1, '', esc(l)); });
      return { html: h + '</div>', c: c };
    }
    var ops = diffText(A, B);
    ops.forEach(function (o) { addCount(c, o.t); });
    tot.add += c.add; tot.del += c.del; tot.mod += c.mod;
    if (S.only && !c.add && !c.del && !c.mod) return { html: '<p class="kvh-nochg">' + esc(T('vh.noChange', 'Không có thay đổi')) + '</p>', c: c };
    var items = collapse(ops, si), split = S.view !== 'unified';
    var dT = T('vh.mkDel', 'Xoá'), iT = T('vh.mkAdd', 'Thêm');
    if (split) {
      h = '<div class="kvh-tx kvh-split' + (s.code ? ' kvh-code' : '') + '"><div class="kvh-sbs-row kvh-sbs-h"><div class="q-dcol-h">' + esc(colA()) + '</div><div class="q-dcol-h">' + esc(colB()) + '</div></div>';
      items.forEach(function (o) {
        if (o.gap) { h += gapHtml(o, true); return; }
        var r = '<div class="kvh-sbs-row"' + anchorAttr(o) + '>';
        if (o.t === 'eq') r += lineCell('', o.a, '', esc(o.A)) + lineCell('', o.b, '', esc(o.B));
        else if (o.t === 'mod') r += lineCell('is-del', o.a, '~', o.words.A, dT) + lineCell('is-ins', o.b, '~', o.words.B, iT);
        else if (o.t === 'del') r += lineCell('is-del', o.a, MK.del, esc(o.A), dT) + '<div class="q-line kvh-l kvh-blank" aria-hidden="true"></div>';
        else r += '<div class="q-line kvh-l kvh-blank" aria-hidden="true"></div>' + lineCell('is-ins', o.b, MK.ins, esc(o.B), iT);
        h += r + '</div>';
      });
    } else {
      h = '<div class="kvh-tx kvh-uni' + (s.code ? ' kvh-code' : '') + '"><div class="q-dcol-h">' + esc(T('vh.summary', '{a} → {b}', { a: colA(), b: colB() })) + '</div>';
      items.forEach(function (o) {
        if (o.gap) { h += gapHtml(o, false); return; }
        var an = anchorAttr(o);
        if (o.t === 'eq') h += uniCell('', o.a, o.b, '', esc(o.A)).replace('<div ', '<div' + an + ' ');
        else if (o.t === 'mod') h += uniCell('is-del', o.a, null, '~', o.words.A, dT) + uniCell('is-ins', null, o.b, '~', o.words.B, iT);
        else if (o.t === 'del') h += uniCell('is-del', o.a, null, MK.del, esc(o.A), dT);
        else h += uniCell('is-ins', null, o.b, MK.ins, esc(o.B), iT);
      });
    }
    return { html: h + '</div>', c: c };
  }
  function mkCell(t, moved) {
    if (t === 'eq') return '<td class="kvh-mkc"></td>';
    var g = t === 'mod' && moved ? MK.mod + MK.move : MK[t], n = mkName(t) + (t === 'mod' && moved ? ' · ' + T('vh.mkMove', 'Di chuyển') : '');
    return '<td class="kvh-mkc is-' + t + '"><span aria-hidden="true">' + g + '</span><span class="sr-only">' + esc(n) + '</span></td>';
  }
  function secFields(s, si, A, B, single, tot) {
    var rows = diffFields(s.fields, A, B, single), c = { add: 0, del: 0, mod: 0 };
    rows.forEach(function (r) { addCount(c, r.t); });
    tot.add += c.add; tot.del += c.del; tot.mod += c.mod;
    if (S.only && !single) rows = rows.filter(function (r) { return r.t !== 'eq'; });
    if (!rows.length) return { html: '<p class="kvh-nochg">' + esc(T('vh.noChange', 'Không có thay đổi')) + '</p>', c: c };
    var h = '<table class="table kvh-ftable' + (single ? ' is-single' : '') + '"><caption class="sr-only">' + esc(TV(s.label)) + '</caption><thead><tr><th scope="col" class="kvh-mkc"><span class="sr-only">' + esc(T('vh.change', 'Thay đổi')) + '</span></th><th scope="col">' + esc(T('vh.field', 'Trường')) + '</th>' +
      (single ? '' : '<th scope="col">' + esc(colA()) + '</th>') + '<th scope="col">' + esc(colB()) + '</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var va = r.t === 'mod' ? r.words.A : esc(r.A), vb = r.t === 'mod' ? r.words.B : esc(r.B);
      h += '<tr class="kvh-r is-' + r.t + '">' + mkCell(r.t) + '<th scope="row">' + esc(TV(r.label)) + '</th>' +
        (single ? '' : '<td class="' + (r.t === 'mod' || r.t === 'del' ? 'is-del' : '') + '">' + (r.t === 'ins' ? '<span class="muted">—</span>' : va) + '</td>') +
        '<td class="' + (r.t === 'mod' || r.t === 'ins' ? 'is-ins' : '') + '">' + (r.t === 'del' ? '<span class="muted">—</span>' : vb) + '</td></tr>';
    });
    return { html: h + '</tbody></table>', c: c };
  }
  // rows: [{ t:'eq'|'ins'|'del'|'mod'|'move', depth, cells:{col:text}, detail:[text], moved }]
  function listTable(label, cols, rows, single) {
    cols = cols && cols.length ? cols : [['title', T('vh.field', 'Trường')]];
    var h = '<table class="table kvh-ltable"><caption class="sr-only">' + esc(TV(label)) + '</caption><thead><tr><th scope="col" class="kvh-mkc"><span class="sr-only">' + esc(T('vh.change', 'Thay đổi')) + '</span></th>';
    cols.forEach(function (c) { h += '<th scope="col" class="kvh-k-' + c[0] + '">' + esc(TV(c[1])) + '</th>'; });
    if (!single) h += '<th scope="col">' + esc(T('vh.detail', 'Chi tiết')) + '</th>';
    h += '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var d = Math.max(0, Math.min(6, r.depth || 0));
      h += '<tr class="kvh-r is-' + r.t + (r.moved ? ' is-moved' : '') + '">' + mkCell(r.t, r.moved);
      cols.forEach(function (c, i) {
        var v = r.cells ? r.cells[c[0]] : '';
        h += '<td class="kvh-k-' + c[0] + (i === 0 ? ' kvh-title kvh-d' + d : '') + '">' + esc(v == null ? '' : v) + '</td>';
      });
      if (!single) h += '<td class="kvh-det">' + esc((r.detail || []).join(' · ')) + '</td>';
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }
  function secList(s, si, A, B, single, tot) {
    var rows = diffList(s.cols, A, B, single), c = { add: 0, del: 0, mod: 0 };
    rows.forEach(function (r) { addCount(c, r.t, r.moved); });
    tot.add += c.add; tot.del += c.del; tot.mod += c.mod;
    if (S.only && !single) rows = rows.filter(function (r) { return r.t !== 'eq'; });
    if (!rows.length) return { html: '<p class="kvh-nochg">' + esc(T('vh.noChange', 'Không có thay đổi')) + '</p>', c: c };
    return { html: listTable(s.label, s.cols, rows, single), c: c };
  }
  function secHtml(label, si, r) {
    var hid = 'kvh-s' + (++uid);
    return '<section class="kvh-sec" aria-labelledby="' + hid + '"><div class="kvh-sec-h"><h3 id="' + hid + '">' + esc(TV(label)) + '</h3>' +
      (S.a ? '<span class="kvh-sec-c">' + esc(countsText(r.c)) + '</span>' : '') + '</div>' + r.html + '</section>';
  }
  function bodyHtml() {
    var d = S.def, single = !S.a, tot = { add: 0, del: 0, mod: 0 }, h = '';
    if (single) h += '<p class="kvh-empty">' + esc(T('vh.noPrev', 'Chưa có phiên bản trước để so sánh')) + '</p>';
    if (typeof d.compute === 'function') {
      var cr = {};
      try { cr = d.compute(S.a || '', S.b) || {}; } catch (e) { warn('compute failed: ' + e.message); }
      (cr.sections || []).forEach(function (s, si) {
        var rows = s.rows || [], c = { add: 0, del: 0, mod: 0 };
        rows.forEach(function (r) { addCount(c, r.t, r.moved); });
        if (!cr.counts) { tot.add += c.add; tot.del += c.del; tot.mod += c.mod; }
        if (S.only && !single) rows = rows.filter(function (r) { return r.t !== 'eq'; });
        h += secHtml(s.label, si, { c: c, html: rows.length ? listTable(s.label, s.cols, rows, single) : '<p class="kvh-nochg">' + esc(T('vh.noChange', 'Không có thay đổi')) + '</p>' });
      });
      if (cr.counts) { tot.add = cr.counts.add || 0; tot.del = cr.counts.del || 0; tot.mod = cr.counts.mod || 0; }
    } else {
      var CA = S.a ? S.res.content[S.a] : null, CB = S.res.content[S.b] || {};
      (d.sections || []).forEach(function (s, si) {
        var A = CA ? CA[s.id] : null, B = CB[s.id], r;
        if (s.kind === 'text') r = secText(s, si, A, B, single, tot);
        else if (s.kind === 'fields') r = secFields(s, si, A, B, single, tot);
        else r = secList(s, si, A, B, single, tot);
        h += secHtml(s.label, si, r);
      });
    }
    if (single) tot = { add: 0, del: 0, mod: 0 };
    return { html: h, tot: tot };
  }
  function wireRestore() {
    var d = S.def, r = d.restore, b = el.rst, order = S.res.order;
    if (r === false || !order.length) {
      b.hidden = true;
      // FE <VersionHistory> has no note: the footer shows the compared pair
      el.note.textContent = S.a ? T('vh.summary', '{a} → {b}', { a: verLabel(S.a), b: verLabel(S.b) }) : verLabel(S.b);
      return;
    }
    b.hidden = false;
    el.note.textContent = S.a ? T('vh.summary', '{a} → {b}', { a: verLabel(S.a), b: verLabel(S.b) }) : verLabel(S.b);
    b.setAttribute('data-title', T('vh.restoreTitle', 'Khôi phục {v}?', { v: S.b }));
    b.setAttribute('data-body', T('vh.restoreBody', 'Tạo bản nháp mới từ {v}. Phiên bản hiện hành giữ nguyên cho tới khi bản nháp được duyệt.', { v: S.b }));
    b.setAttribute('data-toast', T('vh.restoreToast', 'Đã tạo bản nháp từ {v}', { v: S.b }));
    // r.later (Taxonomy, as the web app): restore is not built yet, so the button only toasts, with no confirm dialog
    if (r && r.later) { b.removeAttribute('data-q-confirm'); b.setAttribute('data-toast', r.later); } else b.setAttribute('data-q-confirm', '');
    if (S.b === order[0]) b.setAttribute('data-locked', T('vh.isCurrent', 'Đây là phiên bản hiện hành')); else b.removeAttribute('data-locked');
    if (S.restoreOff) { b.setAttribute('data-roles-disable', 'admin owner steward consumer'); b.setAttribute('data-reason', S.restoreOff); }
    else {
      b.setAttribute('data-roles-disable', (r && r.rolesDisable) || '');
      if (r && r.reason) b.setAttribute('data-reason', r.reason); else b.removeAttribute('data-reason');
    }
    if (window.ECP_applyGates) window.ECP_applyGates();
  }
  function render() {
    if (!S || !dlg) return;
    chrome();
    var o = S.res.order;
    if (o.indexOf(S.b) < 0) S.b = o[0];
    if (S.a && o.indexOf(S.a) < 0) S.a = older(S.b);
    fillSel(el.a, o, S.a, true); fillSel(el.b, o, S.b, false);
    el.a.disabled = o.length < 2;
    el.swap.disabled = !S.a;
    // Song song / Gộp only when the component has a text section (FE <VersionHistory>)
    el.seg.hidden = !(S.def.sections || []).some(function (x) { return x.kind === 'text'; });
    [].forEach.call(el.seg.children, function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-kvh-view') === S.view)); });
    el.only.checked = !!S.only;
    el.list.innerHTML = railHtml();
    // optional hooks of a component: railTop() = html above the rail list, foot() = html replacing the footer note (FE railTop / footerStart)
    el.top.hidden = !S.def.railTop; el.top.innerHTML = S.def.railTop ? S.def.railTop() : '';
    var bh = bodyHtml(), st = el.body.scrollTop;
    el.body.innerHTML = bh.html;
    el.body.scrollTop = st;
    var ct = S.a ? countsText(bh.tot) : T('vh.noChange', 'Không có thay đổi');
    if (el.count.textContent !== ct) el.count.textContent = ct;
    wireRestore();
    el.note.hidden = !!S.def.foot; el.rel.hidden = !S.def.foot; el.rel.innerHTML = S.def.foot ? S.def.foot() : '';
    mirror(false);
  }
  function listSize(d, res, v) {
    var n = 0, c = res.content[v] || {};
    (d.sections || []).forEach(function (s) { if (s.kind === 'list' && c[s.id]) n += c[s.id].length; });
    return n;
  }
  function open(id, opts) {
    opts = opts || {};
    var d = def(id);
    if (!d || !d.versions || !d.versions.length) {
      warn('no version history for ' + id);
      if (window.ECP_toast) window.ECP_toast(T('vh.none', 'Chưa có lịch sử phiên bản cho mục này'));
      return false;
    }
    d._id = id;
    build();
    var res = resolve(d, []);
    res.problems.forEach(function (p) { warn(p.id + ': ' + p.problem); });
    var o = res.order, b = opts.b && o.indexOf(opts.b) >= 0 ? opts.b : o[0];
    var prevOpener = S && dlg.open ? S.opener : null;
    S = { id: id, def: d, res: res, b: b, a: '', view: opts.view === 'unified' ? 'unified' : 'split', exp: {},
      opener: opts.opener || prevOpener || (document.activeElement !== document.body ? document.activeElement : null), restoreOff: opts.restoreOff || '' };
    S.a = opts.a && o.indexOf(opts.a) >= 0 && opts.a !== b ? opts.a : older(b);
    S.only = typeof opts.only === 'boolean' ? opts.only : listSize(d, res, b) > 40;
    render();
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    ensureToast();
    focusVer();
    return true;
  }
  // the native 'close' event is async (and not delivered in some headless runs): clean up synchronously; onClosed is idempotent
  function close() { if (dlg && dlg.open) dlg.close(); onClosed(); }
  function onClosed() {
    if (!S) return;
    var op = S.opener;
    releaseToast();
    mirror(true);
    S = null;
    if (op && op.isConnected && op.getClientRects().length && op.focus) op.focus();
    else if (document.body && document.body.focus) { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
  }
  var URL_KEYS = ['vh', 'a', 'b', 'view', 'only'];
  function mirror(clear) {
    try {
      var u = new URLSearchParams(location.search);
      URL_KEYS.forEach(function (k) { u.delete(k); });
      if (!clear && S) {
        u.set('vh', S.id);
        if (S.a) u.set('a', S.a);
        u.set('b', S.b);
        if (S.view === 'unified') u.set('view', 'unified');
        var dflt = listSize(S.def, S.res, S.b) > 40;
        if (S.only !== dflt) u.set('only', S.only ? '1' : '0');
      }
      var qs = u.toString(), url = location.pathname + (qs ? '?' + qs : '') + location.hash;
      if (url !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', url);
    } catch (e) { /* file:// or sandbox: ignore */ }
  }

  /* ---------- triggers, deep link, i18n ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-vh]');
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault();
    open(t.getAttribute('data-vh'), {
      a: t.getAttribute('data-vh-a') || '', b: t.getAttribute('data-vh-b') || '', view: t.getAttribute('data-vh-view') || '',
      restoreOff: t.getAttribute('data-vh-restore-off') || '', opener: t
    });
  });
  function firstTrigger(id) {
    var all = [].filter.call(document.querySelectorAll('[data-vh]'), function (x) { return x.getAttribute('data-vh') === id; });
    return all.filter(function (x) { return x.getClientRects().length; })[0] || all[0] || null;
  }
  function init() {
    drainQueue();
    var p = new URLSearchParams(location.search), id = p.get('vh');
    if (id) {
      var op = firstTrigger(id), on = p.get('only');
      open(id, {
        a: p.get('a') || (op && op.getAttribute('data-vh-a')) || '', b: p.get('b') || (op && op.getAttribute('data-vh-b')) || '',
        view: p.get('view') || (op && op.getAttribute('data-vh-view')) || '', only: on === '1' ? true : on === '0' ? false : undefined,
        restoreOff: (op && op.getAttribute('data-vh-restore-off')) || '', opener: op
      });
    }
  }
  if (I && I.onChange) I.onChange(function () {
    if (!(S && dlg && dlg.open)) return;
    render();
    if (!dlg.contains(document.activeElement)) focusVer(); // the rail was rebuilt: keep focus inside the modal
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  else setTimeout(init, 0);

  window.ECPVH = {
    open: open, close: close, provide: provide,
    def: function (id) { return def(id); },
    resolve: function (d) { return resolve(d, []); },
    diffText: diffText, validate: validate,
    // exposed for providers / probes
    diffFields: diffFields, diffList: diffList, words: words
  };
  drainQueue();
})();
