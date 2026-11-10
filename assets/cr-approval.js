/* ECP mockups: Thay đổi & Phê duyệt (changes-approval-v2.html).
 * One-way sync of the micro-frontend remotes/quality/src/features/changes-approval (changes-approval-screen.tsx,
 * review-drawer.tsx, release-review-drawer.tsx, global-merge-drawer.tsx, labels.ts; 152984bd) on mock data: ECP_CR.reviews in cr-data.js stands in for governance /api/v1/reviews.
 * List: two tabs, Chờ duyệt (selectable for bulk approve, sortable by time) and Lịch sử duyệt, searched by the header field
 * (code or summary) and filtered by KB, paged. A row opens the review in one large dialog: header, a collapsible "Thông tin
 * request" panel and the proposed changes (current vs proposed tags, side by side or merged), then Từ chối / Duyệt kèm sửa
 * (keep some of the tags) / Duyệt, each confirmed in a dialog. KNOWLEDGE_RELEASE (ADR-006) opens the release review (version,
 * notes, changed documents / packages; Duyệt / Từ chối); GLOBAL_MERGE (ADR-007, KB column "Global") opens the merge review
 * (source preset, items added / changed vs Global, impact KBs; Admin approves, approves with edits: untick items, rename code /
 * name, or rejects). Pending preset change requests are listed above the pending table as links to their page and counted in
 * the tab. No Steward assignment, reviewer column or confidence (not in the API). Roles come from the user menu (or ?role=). */
(function () {
  var CR = window.ECP_CR, KB = window.ECP_KB, I = window.ECP_I18N;
  if (!CR || !CR.reviews || !KB) return;
  var RV = CR.reviews, esc = KB.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var SIZES = [5, 10, 25];

  // ---------- labels (labels.ts): messages, dates, numbers, status / outcome chips, actor roles ----------
  function lang() { return I && I.lang === 'en' ? 'en' : 'vi'; }
  function num(n) { return new Intl.NumberFormat(lang()).format(n); }
  // next-intl messages: {x}, {n, number} and {n, plural, one {…#…} other {…#…}}
  function T(k, a) {
    var d = I ? I.dict : { en: {}, vi: {} }, s = d[lang()][k];
    if (s === undefined) s = d.vi[k];
    if (s === undefined) return k;
    a = a || {};
    s = String(s).replace(/\{(\w+), plural, one \{([^}]*)\} other \{([^}]*)\}\}/g, function (m, x, one, other) { var n = a[x]; return (n === 1 ? one : other).replace(/#/g, num(n)); });
    s = s.replace(/\{(\w+), number\}/g, function (m, x) { return a[x] !== undefined ? num(a[x]) : m; });
    return s.replace(/\{(\w+)\}/g, function (m, x) { return a[x] !== undefined ? a[x] : m; });
  }
  function date(iso) {
    return iso ? new Intl.DateTimeFormat(lang(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso)) : '—';
  }
  var RESULT = { PENDING: ['cr.st.pending', 'warning'], APPROVED: ['cr.st.approved', 'success'], APPROVED_WITH_EDITS: ['cr.st.approved_edit', 'success'], REJECTED: ['cr.st.rejected', 'error'], SUPERSEDED: ['web.ca.rel.superseded', 'neutral'] };
  var ROLE = { ADMIN: 'cr.role.admin', OWNER: 'cr.role.owner', STEWARD: 'cr.role.steward', SYSTEM: 'cr.role.system', AI: 'cr.role.agent' };
  function result(r) { var x = RESULT[r.outcome || r.status]; return [T(x[0]), x[1]]; }
  function roleOf(a) { return ROLE[a.role] ? T(ROLE[a.role]) : ''; }
  function chip(label, tone) { return '<span class="chip chip-' + (tone || 'neutral') + '">' + esc(label) + '</span>'; }
  function resultChip(r) { var x = result(r); return chip(x[0], x[1]); }
  function typeChip(type) {
    return type === 'KNOWLEDGE_RELEASE' ? '<span class="chip ca2-type ca2-t-rel">' + esc(T('web.ca.rel.type')) + '</span>'
      : type === 'GLOBAL_MERGE' ? '<span class="chip ca2-type ca2-t-gm">' + esc(T('web.ca.gm.type')) + '</span>'
        : '<span class="chip ca2-type ca2-t-meta">' + esc(T('ca2.ty.meta')) + '</span>';
  }
  // release-review-drawer.tsx: "2 thêm · 1 sửa" from the snapshot counts, zero counts left out; SELF_RELEASE in words
  var CHANGES = ['ADDED', 'MODIFIED', 'REMOVED', 'RETAGGED'], CH_TONE = { ADDED: 'success', MODIFIED: 'warning', REMOVED: 'error', RETAGGED: 'info' };
  function counts(s, empty) {
    return CHANGES.filter(function (c) { return s[c.toLowerCase()] > 0; }).map(function (c) { return T('web.ca.rel.c.' + c, { n: num(s[c.toLowerCase()]) }); }).join(' · ') || T(empty || 'web.ca.rel.noDocs');
  }
  function releaseReason(r) { return r.type === 'KNOWLEDGE_RELEASE' && r.reason === 'SELF_RELEASE' ? T('web.ca.rel.selfRelease') : r.reason; }
  // who sent it: the AI agent as the "AI" badge + Agent, a person / service by name
  function maker(a) { return a.role === 'AI' ? '<span class="ca2-ai" title="' + esc(T('ca2.aiTip')) + '">AI</span> ' + esc(T('cr.role.agent')) : esc(a.name); }
  function who(a) { var r = roleOf(a); return a.name + (r ? ' · ' + r : ''); }
  var ICO = { close: 'M6 6l12 12M18 6 6 18', left: 'm15 6-6 6 6 6', right: 'm9 6 6 6-6 6', copy: 'M9 9h10v10H9zM5 15V5h10', doc: 'M7 3h7l5 5v13H7zM14 3v5h5',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6' };
  function ico(k) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICO[k] + '"/></svg>'; }

  // ---------- list state (changes-approval-screen.tsx) ----------
  var kb0 = ''; try { kb0 = new URLSearchParams(location.search).get('kb') || ''; } catch (e) {}
  var st = { queue: 'PENDING', q: '', kb: kb0, page: 0, size: 10, sortOrder: 'DESC', sel: {}, open: null, bulk: null, loading: true, rows: [] };
  var kbs = [];
  // GLOBAL_MERGE reviews belong to no KB (they change the Global preset)
  function kbName(id) { if (id === null) return 'Global'; var k = kbs.filter(function (x) { return x.knowledgeBaseId === id; })[0]; return k ? k.name : id; }
  function history() { return st.queue === 'DECIDED'; }
  function load() {
    try { return { data: RV.list({ queue: st.queue, q: st.q, kb: st.kb, page: st.page, size: st.size, sortOrder: history() ? undefined : st.sortOrder }) }; }
    catch (e) { return { error: e }; }
  }
  function pendingTotal() { try { return RV.list({ queue: 'PENDING', q: '', kb: '', page: 0, size: 1 }).totalItems; } catch (e) { return undefined; } }
  function picked() { return Object.keys(st.sel).map(function (k) { return st.sel[k]; }); }
  function canApprove(r) { return r.allowedActions.indexOf('APPROVE') !== -1; }
  function removedN(r) { var c = r.metadata.current, p = r.metadata.proposed; return c.tags.length - p.tags.length + c.sourceTags.length - p.sourceTags.length; }

  // second line: tags the review deletes, the version + change counts of a release, or the source preset + items of a merge
  function objLine(r) {
    var m = r.metadata;
    return r.type === 'KNOWLEDGE_RELEASE' ? 'v' + m.versionLabel + ' · ' + counts(m.summary)
      : r.type === 'GLOBAL_MERGE' ? T('web.ca.gm.line', { x: m.sourcePreset.name + ' · v' + m.sourcePreset.version, a: num(m.summary.added), c: num(m.summary.changed) })
        : T('web.ca.removesN', { n: removedN(r) });
  }
  function titleCell(r) { return '<td class="ca2-tc"><div class="ca2-ttl" title="' + esc(r.summary) + '">' + esc(r.summary) + '</div><div class="ca2-obj">' + esc(objLine(r)) + '</div></td>'; }
  function kbCell(r) { var n = kbName(r.knowledgeBaseId); return '<td class="ca2-kbc"><span title="' + esc(n) + '">' + esc(n) + '</span></td>'; }
  function trOpen(r) { return '<tr data-id="' + esc(r.reviewId) + '" tabindex="0"' + (st.sel[r.reviewId] ? ' class="is-checked"' : '') + (st.open && st.open.r.reviewId === r.reviewId ? ' aria-current="true"' : '') + '>'; }
  function idCell(r) { return '<td class="ca2-idc"><span class="ca2-id">' + esc(r.code) + '</span></td>'; }
  function historyTable(rows) {
    return '<table class="ca2-table table"><thead><tr><th scope="col">' + esc(T('ca2.h.id')) + '</th><th scope="col">' + esc(T('ca2.h.titleObj')) + '</th><th scope="col" class="ca2-tyc">' + esc(T('ca2.h.type')) + '</th><th scope="col">' + esc(T('ca2.h.kb')) + '</th><th scope="col">' + esc(T('ca2.h.result')) + '</th><th scope="col">' + esc(T('ca2.h.decider')) + '</th><th scope="col">' + esc(T('ca2.h.when')) + '</th><th scope="col">' + esc(T('ca2.h.notes')) + '</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var note = releaseReason(r) || (r.status === 'SUPERSEDED' ? T('web.ca.rel.supersededHint') : '') || (r.status === 'APPROVED' ? (r.applied ? T('web.ca.applied', { t: date(r.appliedAt) }) : T('web.ca.notApplied')) : '');
        var role = r.decidedBy && roleOf(r.decidedBy);
        return trOpen(r) + idCell(r) + titleCell(r) + '<td class="ca2-tyc">' + typeChip(r.type) + '</td>' + kbCell(r) + '<td>' + resultChip(r) + '</td>' +
          '<td class="ca2-by">' + esc(r.decidedBy ? r.decidedBy.name : '—') + (role ? '<div class="muted">' + esc(role) + '</div>' : '') + '</td>' +
          '<td class="ca2-at"><time datetime="' + esc(r.decidedAt || '') + '">' + date(r.decidedAt) + '</time></td>' +
          '<td class="ca2-why"><span' + (note ? ' title="' + esc(note) + '"' : '') + '>' + esc(note || '—') + '</span></td></tr>';
      }).join('') + '</tbody></table>';
  }
  function pendingTable(rows) {
    var on = rows.filter(function (r) { return st.sel[r.reviewId]; }).length;
    return '<table class="ca2-table table"><thead><tr><th scope="col" class="ca2-ck"><input type="checkbox" id="ca2-all" aria-label="' + esc(T('ca2.h.pickAll')) + '"' + (on > 0 && on === rows.length ? ' checked' : '') + '></th>' +
      '<th scope="col">' + esc(T('ca2.h.id')) + '</th><th scope="col" class="ca2-tyc">' + esc(T('ca2.h.type')) + '</th><th scope="col">' + esc(T('ca2.h.titleObj')) + '</th><th scope="col">' + esc(T('ca2.h.kb')) + '</th><th scope="col">' + esc(T('ca2.h.by')) + '</th>' +
      '<th scope="col" aria-sort="' + (st.sortOrder === 'ASC' ? 'ascending' : 'descending') + '"><button type="button" class="th-sort" data-sort>' + esc(T('ca2.h.at')) + '</button></th><th scope="col"><span class="sr-only">' + esc(T('ca2.h.open')) + '</span></th></tr></thead><tbody>' +
      rows.map(function (r) {
        return trOpen(r) + '<td class="ca2-ck" data-ck><input type="checkbox" data-sel="' + esc(r.reviewId) + '" aria-label="' + esc(T('ca2.pick', { id: r.code })) + '"' + (st.sel[r.reviewId] ? ' checked' : '') + '></td>' +
          idCell(r) + '<td class="ca2-tyc">' + typeChip(r.type) + '</td>' + titleCell(r) + kbCell(r) + '<td class="ca2-by">' + maker(r.maker) + '</td>' +
          '<td class="ca2-at"><time datetime="' + esc(r.createdAt) + '">' + date(r.createdAt) + '</time></td><td class="ca2-go" aria-hidden="true">›</td></tr>';
      }).join('') + '</tbody></table>';
  }
  // 1 … p-1 p p+1 … last once there are more than 7 pages (ui/pagination pageSlots)
  function slots(page, total) {
    var out = [], p;
    if (total <= 7) { for (p = 1; p <= Math.max(1, total); p++) out.push(p); return out; }
    out.push(1); if (page > 3) out.push('…');
    for (p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) out.push(p);
    if (page < total - 2) out.push('…');
    out.push(total); return out;
  }
  function renderPager(total, totalPages) {
    var el = $('#ca2-pager'); el.hidden = !total;
    if (!total) { el.innerHTML = ''; return; }
    var page = st.page + 1, pages = Math.max(1, totalPages), a = (page - 1) * st.size + 1, b = Math.min(total, page * st.size);
    el.innerHTML = '<span data-ek-range>' + esc(T('ca2.range', { a: num(a), b: num(b), n: num(total) })) + '</span>' +
      '<label for="ca2-size">' + esc(T('ek.rowsPerPage')) + '</label><select class="input" id="ca2-size">' + SIZES.map(function (s) { return '<option value="' + s + '"' + (s === st.size ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
      '<nav class="ek-pager" aria-label="' + esc(T('ek.pagination')) + '"><button type="button" data-pg="' + (page - 1) + '" aria-label="' + esc(T('ek.prevPage')) + '"' + (page <= 1 ? ' disabled' : '') + '>‹</button><span data-ek-pages>' +
      slots(page, pages).map(function (p) { return typeof p === 'number' ? '<button type="button" data-pg="' + p + '" aria-label="' + esc(T('ek.pageN', { n: p })) + '"' + (p === page ? ' aria-current="page"' : '') + '>' + num(p) + '</button>' : '<span class="muted" aria-hidden="true">…</span>'; }).join('') +
      '</span><button type="button" data-pg="' + (page + 1) + '" aria-label="' + esc(T('ek.nextPage')) + '"' + (page >= pages ? ' disabled' : '') + '>›</button></nav>';
  }
  function renderBulk() {
    var bar = $('#ca2-bulk'), all = picked(), ok = all.filter(canApprove), bad = all.filter(function (r) { return !canApprove(r); });
    bar.hidden = history() || !all.length;
    if (bar.hidden) { bar.innerHTML = ''; return; }
    bar.innerHTML = '<div class="ca2-bulkrow"><span aria-live="polite">' + esc(T('ca2.selected', { n: num(all.length) })) + '</span>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="clear">' + esc(T('ca2.h.clearSel')) + '</button>' +
      '<button type="button" class="btn btn-approve btn-sm" data-act="bulk"' + (ok.length ? '' : ' disabled') + '>' + esc(T('ca2.approveN', { n: num(ok.length) })) + '</button></div>' +
      (bad.length ? '<div class="ca2-bulkwarn" role="status"><span class="ca2-warn-ico" aria-hidden="true">!</span><span>' + esc(T('ca2.bulkBad', { n: num(bad.length) })) + ' ' +
        esc(bad.map(function (r) { return r.code; }).join(', ')) + '. ' + esc(T('web.ca.notReviewer')) + '</span></div>' : '');
  }
  function render() {
    kbs = RV.kbNames();
    var sel = $('#ca2-kb');
    sel.innerHTML = '<option value="">' + esc(T('ca2.allKb')) + '</option>' + kbs.map(function (k) { return '<option value="' + esc(k.knowledgeBaseId) + '">' + esc(k.name) + '</option>'; }).join('');
    sel.value = st.kb;
    ['PENDING', 'DECIDED'].forEach(function (k) { var b = $('#ca2-tab-' + k); b.setAttribute('aria-selected', String(st.queue === k)); b.tabIndex = st.queue === k ? 0 : -1; });
    // both tabs control the one panel; the shell's generic tab handler (screens.js) hides the panels of unselected tabs
    $('#ca2-pane').setAttribute('aria-labelledby', 'ca2-tab-' + st.queue); $('#ca2-pane').hidden = false;
    // preset change requests (Steward preset releases, ADR-007) are not reviews: listed here, decided on their page
    var crs = RV.presetCrs(), crEl = $('#ca2-crs');
    var n = pendingTotal(), cnt = $('#ca2-n');
    cnt.hidden = n === undefined; cnt.textContent = n === undefined ? '' : num(n + crs.length);
    crEl.hidden = history() || !crs.length;
    crEl.innerHTML = crEl.hidden ? '' : crs.map(function (cr) {
      return '<li><a href="' + esc(cr.href) + '"><span class="ca2-id">' + esc(cr.code) + '</span> ' + esc(T('web.ca.presetCr', { kind: cr.objectType === 'ONTOLOGY' ? 'Ontology' : 'Taxonomy', x: cr.preset ? cr.preset.name : '—' })) +
        ' · ' + esc(cr.summary) + ' · ' + esc(cr.maker.name) + '</a></li>';
    }).join('');
    var res = st.loading ? null : load(), rows = res && res.data ? res.data.items : [], body;
    st.rows = rows;
    if (st.loading) body = '<div class="ca2-empty" role="status" aria-busy="true">' + esc(T('web.ca.loading')) + '</div>';
    else if (res.error && res.error.status === 403) body = '<div class="ca2-empty"><b>' + esc(T('web.ca.noAccess')) + '</b></div>';
    else if (!rows.length && !history() && crs.length && !st.q.trim() && !st.kb) body = ''; // the preset requests above are the queue
    else if (!rows.length) body = '<div class="ca2-empty">' + (st.q.trim() || st.kb ? '<b>' + esc(T('ca2.noMatch')) + '</b>' : history() ? '<b>' + esc(T('ca2.h.noHistory')) + '</b>' : '<b>' + esc(T('ca2.emptyT')) + '</b><span>' + esc(T('ca2.emptyB')) + '</span>') + '</div>';
    else body = history() ? historyTable(rows) : pendingTable(rows);
    $('#ca2-list').innerHTML = body;
    var all = $('#ca2-all');
    if (all) { var on = rows.filter(function (r) { return st.sel[r.reviewId]; }).length; all.indeterminate = on > 0 && on < rows.length; }
    renderBulk();
    renderPager(res && res.data ? res.data.totalItems : 0, res && res.data ? res.data.totalPages : 1);
  }
  // a new search, filter, tab or order starts from the first page; the selection belongs to one result set
  function reset(clearSel) { st.page = 0; if (clearSel) st.sel = {}; render(); }
  function pick(r, on) { if (on) st.sel[r.reviewId] = r; else delete st.sel[r.reviewId]; }
  function rowById(id) { return st.rows.filter(function (r) { return r.reviewId === id; })[0]; }

  // ---------- confirm / result dialogs (Ask, mockup .ca2-dlg): title, body, extra content, Hủy + the action ----------
  var askEl = null;
  function closeAsk() { if (askEl) { var d = askEl; askEl = null; if (d.open) d.close(); d.remove(); } }
  function ask(o) {
    closeAsk();
    var d = document.createElement('dialog');
    d.className = 'q-dialog ca2-dlg'; d.setAttribute('aria-labelledby', 'ca2-ask-t');
    if (o.body) d.setAttribute('aria-describedby', 'ca2-ask-b');
    d.innerHTML = '<h2 id="ca2-ask-t">' + esc(o.title) + '</h2>' + (o.body ? '<p class="qd-body" id="ca2-ask-b">' + esc(o.body) + '</p>' : '') + (o.extra || '') +
      '<div class="qd-foot">' + (o.go ? '<button type="button" class="btn btn-secondary" data-ask="cancel">' + esc(T('ca2.h.cancel')) + '</button><button type="button" class="btn btn-' + (o.variant || 'approve') + '" data-ask="go">' + esc(o.go) + '</button>'
        : '<button type="button" class="btn btn-primary" data-ask="cancel">' + esc(T('ca2.h.close')) + '</button>') + '</div>';
    document.body.appendChild(d);
    d.addEventListener('cancel', function (e) { e.preventDefault(); if (!d.__busy) { closeAsk(); if (o.onCancel) o.onCancel(); } });
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ask]');
      // the result dialog closes on an outside click; the confirm dialogs only through their buttons
      if (!b && e.target === d && !o.go) { closeAsk(); if (o.onCancel) o.onCancel(); return; }
      if (!b || b.disabled) return;
      if (b.getAttribute('data-ask') === 'cancel') { if (d.__busy) return; closeAsk(); if (o.onCancel) o.onCancel(); }
      else o.onGo(d);
    });
    askEl = d; d.showModal();
    return d;
  }
  function busy(d, on) { if (!d) return; d.__busy = on; var g = $('[data-ask="go"]', d); if (g) { g.disabled = on; if (on) g.setAttribute('aria-busy', 'true'); else g.removeAttribute('aria-busy'); } }

  // ---------- bulk approve: one decision per review, one after the other, each with its own If-Match ----------
  function askBulk() {
    var ok = picked().filter(canApprove);
    if (!ok.length) return;
    ask({ title: T('ca2.bulkQ', { n: num(ok.length) }), body: T('ca2.h.bulkB'), go: T('ca2.bulkGo', { n: num(ok.length) }),
      extra: '<ul class="ca2-bklist">' + ok.map(function (r) { return '<li><b>' + esc(r.code) + '</b> ' + typeChip(r.type) + ' ' + esc(r.summary) + '</li>'; }).join('') + '</ul>',
      onGo: function (d) { runBulk(d, ok); } });
  }
  function runBulk(d, list) {
    busy(d, true);
    var out = [], i = 0;
    (function next() {
      if (i >= list.length) { st.sel = {}; closeAsk(); render(); showResults(out); return; }
      var r = list[i++];
      RV.decide(r.reviewId, r.revision, { decision: 'APPROVED' }).then(function () { out.push({ r: r, status: null }); next(); }, function (e) { out.push({ r: r, status: e.status || 0 }); next(); });
    })();
  }
  function why(s) { return T(s === 409 ? 'web.ca.err.decided' : s === 412 ? 'web.ca.err.stale' : s === 403 ? 'ca2.out.denied' : 'web.ca.err.generic'); }
  function showResults(out) {
    var groups = [['cr.st.approved', 'success', out.filter(function (x) { return x.status === null; })], ['ca2.out.processed', 'neutral', out.filter(function (x) { return x.status === 409; })],
      ['web.ca.outFailed', 'error', out.filter(function (x) { return x.status !== null && x.status !== 409; })]];
    ask({ title: T('ca2.resN', { n: num(out.length) }), extra: groups.filter(function (g) { return g[2].length; }).map(function (g) {
      return '<section class="ca2-resg"><h3>' + chip(T(g[0]), g[1]) + ' ' + num(g[2].length) + '</h3><ul>' + g[2].map(function (x) {
        return '<li><b>' + esc(x.r.code) + '</b> ' + esc(x.r.summary) + (x.status !== null ? '<div class="muted">' + esc(why(x.status)) + '</div>' : '') + '</li>';
      }).join('') + '</ul></section>';
    }).join('') });
  }

  // ---------- review dialog (review-drawer.tsx) ----------
  var FIELDS = [['tags', 'cr.f.tags'], ['sourceTags', 'web.ca.sourceTags']];
  var drawer = null, scrim = null, opener = null;
  function D() { return st.open; }
  function openReview(r, from) {
    opener = from || document.activeElement;
    st.open = r.type === 'METADATA_EDIT' ? { r: r, mode: 'view', keep: JSON.parse(JSON.stringify(r.metadata.proposed)), side: true, view: 'side', chg: 0 } : { r: r, dropped: {}, renames: {} };
    if (!drawer) {
      scrim = document.createElement('div'); scrim.className = 'ca2-scrim';
      drawer = document.createElement('div'); drawer.className = 'ca2-panel ca2-drawer'; drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-labelledby', 'ca2-dt'); drawer.tabIndex = -1;
      document.body.appendChild(scrim); document.body.appendChild(drawer);
      scrim.addEventListener('click', closeReview);
      drawer.addEventListener('click', onDrawerClick);
      drawer.addEventListener('change', onDrawerChange);
      // rename inputs (GLOBAL_MERGE): keep the value, re-render (the approve label follows the edits), put the caret back
      drawer.addEventListener('input', function (e) {
        var t = e.target, o = D(); if (!o || !t.matches('[data-gm-rn]')) return;
        var k = t.getAttribute('data-k'), f = t.getAttribute('data-gm-rn'), at = t.selectionStart;
        o.renames[k] = o.renames[k] || { newCode: '', newName: '' }; o.renames[k][f] = t.value;
        renderDrawer();
        var el = drawer.querySelector('[data-gm-rn="' + f + '"][data-k="' + k.replace(/"/g, '\\"') + '"]'); if (el) { el.focus(); el.setSelectionRange(at, at); }
      });
    }
    scrim.hidden = false; drawer.hidden = false;
    renderDrawer();
    var first = tabbables()[0]; (first || drawer).focus();
    render();
  }
  function closeReview() {
    if (!st.open) return;
    closeAsk();
    st.open = null; drawer.hidden = true; scrim.hidden = true; drawer.innerHTML = '';
    render();
    var back = opener && opener.isConnected ? opener : opener && opener.getAttribute && $('tr[data-id="' + opener.getAttribute('data-id') + '"]');
    if (back) back.focus();
  }
  function tabbables() { return Array.prototype.slice.call(drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]')).filter(function (el) { return el.offsetParent !== null; }); }
  function removed(f) { var o = D(), r = o.r, after = afterSet(); return r.metadata.current[f].filter(function (x) { return after[f].indexOf(x) === -1; }); }
  function afterSet() { var o = D(), r = o.r; return o.mode === 'edit' ? o.keep : (r.finalPayload || r.metadata.proposed); }
  function changed() { return FIELDS.map(function (x) { return x[0]; }).filter(function (f) { return removed(f).length > 0; }); }
  function tags(list, del) {
    del = del || [];
    return list.length ? '<ul class="ca2-chips">' + list.map(function (x) { return del.indexOf(x) !== -1 ? '<li class="ca2-tag is-del" title="' + esc(T('web.ca.removed')) + '"><del>' + esc(x) + '</del></li>' : '<li class="ca2-tag">' + esc(x) + '</li>'; }).join('') + '</ul>' : '<span class="ca2-gap">—</span>';
  }
  function kv(rows) { return '<dl class="ca2-kv is-side">' + rows.filter(Boolean).map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl>'; }
  function sec(title, body) { return '<section class="ca2-ss"><h3 class="ca2-sub">' + esc(title) + '</h3>' + body + '</section>'; }
  function renderDrawer() {
    var t = D().r.type;
    if (t === 'KNOWLEDGE_RELEASE') return renderRelease();
    if (t === 'GLOBAL_MERGE') return renderMerge();
    var o = D(), r = o.r, pending = r.status === 'PENDING', editing = o.mode === 'edit', cur = r.metadata.current, after = afterSet();
    var ch = changed(), nRemoved = ch.reduce(function (n, f) { return n + removed(f).length; }, 0), n = editing ? 0 : ch.length;
    var kbN = kbName(r.knowledgeBaseId), docTitle = RV.docTitle(r.knowledgeBaseId, r.documentId) || r.documentId, docHref = RV.docHref(r.knowledgeBaseId, r.documentId);
    var ver = r.baseVersions.document || '—', can = function (a) { return pending && r.allowedActions.indexOf(a) !== -1; };
    var sideLbl = T(o.side ? 'ca2.side.hide' : 'ca2.side.show');
    var sbt = '<button type="button" class="ca2-sbt" data-d="side" aria-controls="ca2-side" aria-expanded="' + o.side + '" aria-label="' + esc(sideLbl) + '" title="' + esc(sideLbl) + '">' + ico('left') + '</button>';
    function rows(value) {
      return FIELDS.map(function (x) {
        var c = ch.indexOf(x[0]);
        return '<div class="ca2-mrow' + (c > -1 ? ' is-chg' : '') + (c === o.chg && !editing ? ' is-cur' : '') + '"' + (c > -1 ? ' data-c="' + c + '"' : '') + '><dt>' + esc(T(x[1])) + '</dt><dd>' + value(x[0]) + '</dd></div>';
      }).join('');
    }
    var edited = r.outcome === 'APPROVED_WITH_EDITS' && r.finalPayload ? '<section class="ca2-sec ca2-dvc"><div class="ca2-dvh"><h3>' + esc(T('ca2.reviewerEdited')) + '</h3></div><div class="table-wrap"><table class="ca2-mt"><thead><tr><th scope="col">' + esc(T('ca2.field')) + '</th><th scope="col">' + esc(T('ca2.cur')) + '</th><th scope="col">' + esc(T('ca2.orig')) + '</th><th scope="col">' + esc(T('ca2.approvedText')) + '</th></tr></thead><tbody>' +
      FIELDS.map(function (x) { var f = x[0], fin = r.finalPayload[f].join(', '), orig = r.metadata.proposed[f].join(', ');
        return '<tr><th scope="row">' + esc(T(x[1])) + '</th><td>' + esc(cur[f].join(', ') || '—') + '</td><td>' + esc(orig || '—') + '</td><td' + (fin !== orig ? ' class="ca2-edited"' : '') + '>' + esc(fin || '—') + '</td></tr>'; }).join('') + '</tbody></table></div></section>' : '';
    var toolbar = '<div class="ca2-tb"><div class="ca2-tbl"><div class="ca2-tbt"><h3>' + ico('list') + esc(T('ca2.previewH')) + '</h3>' + (n > 0 ? chip(n === 1 ? T('ca2.nChange1') : T('ca2.nChanges', { n: num(n) })) : '') + '</div>' +
      (nRemoved > 0 ? '<span class="ca2-tbs">' + esc(T('web.ca.removesN', { n: nRemoved })) + '</span>' : '') + '</div>' +
      (editing ? '' : '<div class="ca2-tbc">' + (n > 0 ? '<span class="ca2-nav"><button type="button" class="btn btn-secondary btn-sm" data-d="prev" aria-label="' + esc(T('ca2.prevChg')) + '"' + (o.chg <= 0 ? ' disabled' : '') + '>' + ico('left') + '<span class="ca2-navl">' + esc(T('ca2.prevChg')) + '</span></button>' +
        '<span class="ca2-pos" aria-live="polite">' + esc(T('ca2.chgPos', { i: num(o.chg + 1), n: num(n) })) + '</span><button type="button" class="btn btn-secondary btn-sm" data-d="next" aria-label="' + esc(T('ca2.nextChg')) + '"' + (o.chg >= n - 1 ? ' disabled' : '') + '><span class="ca2-navl">' + esc(T('ca2.nextChg')) + '</span>' + ico('right') + '</button></span>' : '') +
        '<span class="segmented" role="group" aria-label="' + esc(T('ca2.viewMode')) + '">' + ['side', 'inline'].map(function (m) { return '<button type="button" data-view="' + m + '" aria-pressed="' + (o.view === m) + '">' + esc(T('ca2.mode.' + m)) + '</button>'; }).join('') + '</span></div>') + '</div>';
    function docHead(label, sub, link) {
      return '<div class="ca2-doch"><span class="ca2-doci">' + ico('doc') + '</span><div class="ca2-docl"><b>' + esc(label) + '</b><span class="muted" title="' + esc(docTitle) + '">' + esc(docTitle) + '</span>' + (sub ? '<span class="muted">' + esc(sub) + '</span>' : '') + '</div>' +
        (link ? '<a class="btn btn-secondary btn-sm" href="' + esc(docHref) + '">' + esc(T('common.openDocument')) + ico('ext') + '</a>' : '') + '</div>';
    }
    var workspace = o.view === 'inline' && !editing
      ? '<section class="ca2-sec ca2-dvc"><div class="ca2-dvh"><h3>' + esc(T('ca2.diffH')) + '</h3></div><dl class="ca2-mlist">' + rows(function (f) { return tags(cur[f], removed(f)); }) + '</dl></section>' + edited
      : '<div class="ca2-docs is-meta" style="--rows: ' + (FIELDS.length + 1) + '"><section class="ca2-doc is-rows">' + docHead(T(pending ? 'ca2.curV' : 'ca2.beforeV', { v: ver }), null, true) + '<dl class="ca2-mlist">' + rows(function (f) { return tags(cur[f], removed(f)); }) + '</dl></section>' +
        '<section class="ca2-doc is-rows is-new">' + docHead(T(r.status === 'APPROVED' ? 'ca2.approvedText' : editing ? 'ca2.finalEditing' : 'ca2.proposed'), pending ? T('ca2.proposedAt', { t: date(r.createdAt) }) : r.applied ? T('ca2.appliedAt', { t: date(r.appliedAt) }) : null, false) +
        '<dl class="ca2-mlist">' + rows(function (f) {
          if (!editing) return tags(after[f]);
          return cur[f].length ? '<ul class="ca2-chips">' + cur[f].map(function (tag) { return '<li><label class="ca2-tagck"><input type="checkbox" data-keep="' + f + '" value="' + esc(tag) + '"' + (o.keep[f].indexOf(tag) !== -1 ? ' checked' : '') + '>' + esc(tag) + '</label></li>'; }).join('') + '</ul>' : '<span class="ca2-gap">—</span>';
        }) + '</dl></section></div>' + edited;
    var side = !o.side ? '' : '<aside class="ca2-side" id="ca2-side" aria-label="' + esc(T('ca2.side.req')) + '">' + sbt +
      sec(T('ca2.side.req'), kv([[T('ca2.h.id'), '<span class="ca2-code">' + esc(r.code) + '</span><button type="button" class="icon-btn ca2-copy" data-d="copy" aria-label="' + esc(T('ca2.copyId', { id: r.code })) + '" title="' + esc(T('ca2.copyId', { id: r.code })) + '">' + ico('copy') + '</button>'],
        [T('ca2.h.type'), typeChip()], [T('ca2.status'), resultChip(r)]])) +
      sec(T('ca2.side.rel'), kv([[T('ca2.kb'), esc(kbN)], [T('ca2.object'), '<a class="ca2-ext" href="' + esc(docHref) + '"><span title="' + esc(docTitle) + '">' + esc(docTitle) + '</span>' + ico('ext') + '</a>']])) +
      (r.rationale ? (r.maker.role === 'AI' ? sec(T('ca2.rationaleH'), '<p class="ca2-why-t is-ai">' + esc(r.rationale) + '</p>') : sec(T('ca2.reasonH'), '<p class="ca2-reason">' + esc(r.rationale) + '</p>')) : '') +
      sec(T('ca2.version'), kv([[T('ca2.docs'), esc(ver)], [T('web.ca.contentVersion'), num(r.contentVersion)]])) +
      sec(T('ca2.side.more'), kv([[T('ca2.side.by'), r.maker.role === 'AI' ? maker(r.maker) : esc(who(r.maker))], [T('ca2.side.at'), '<time datetime="' + esc(r.createdAt) + '">' + date(r.createdAt) + '</time>']])) +
      (pending ? '' : sec(T('ca2.decisionH'), kv([[T('ca2.result'), resultChip(r)], r.decidedBy ? [T('ca2.decider'), esc(who(r.decidedBy))] : null, [T('ca2.when'), date(r.decidedAt)],
        r.reason ? [T(r.outcome === 'REJECTED' ? 'ca2.rejectReason' : 'ca2.reviewNote'), esc(r.reason)] : null,
        r.status === 'APPROVED' ? [T('ca2.status'), esc(r.applied ? T('web.ca.applied', { t: date(r.appliedAt) }) : T('web.ca.notApplied'))] : null]) +
        (r.status === 'REJECTED' ? '<p class="muted ca2-note">' + esc(T('ca2.closed')) + '</p>' : ''))) + '</aside>';
    var actions = !pending ? '' : '<div class="ca2-act">' + (r.allowedActions.length === 0 ? '<div class="ca2-who">' + esc(T('web.ca.notReviewer')) + '</div>' : '') + '<div class="ca2-btns">' +
      (editing ? '<button type="button" class="btn btn-secondary" data-d="cancelEdit">' + esc(T('ca2.cancelEdit')) + '</button><button type="button" class="btn btn-approve" data-d="askEdit">' + esc(T('ca2.do.approve_edit')) + '</button>'
        : (can('REJECT') ? '<button type="button" class="btn btn-danger-outline" data-d="reject">' + esc(T('ca2.reject')) + '</button>' : '') +
          (can('APPROVE_WITH_EDITS') ? '<button type="button" class="btn btn-secondary" data-d="edit">' + esc(T('ca2.do.approveEditBtn')) + '</button>' : '') +
          (can('APPROVE') ? '<button type="button" class="btn btn-approve" data-d="approve">' + esc(T('ca2.approve')) + '</button>' : '')) + '</div></div>';
    drawer.innerHTML = '<div class="ca2-dhd"><div class="ca2-dhl"><div class="ca2-dmeta"><span class="ca2-id is-static">' + esc(r.code) + '</span>' + typeChip() + resultChip(r) + '</div>' +
      '<h2 id="ca2-dt">' + esc(r.summary) + '</h2><div class="ca2-hrow"><p class="ca2-hmeta"><span>' + esc(T('ca2.kb')) + ': ' + esc(kbN) + '</span><span><a class="link" href="' + esc(docHref) + '">' + esc(T('common.openDocument')) + '</a></span></p>' +
      '<p class="ca2-hmeta ca2-hby"><span>' + maker(r.maker) + '</span><span><time datetime="' + esc(r.createdAt) + '">' + date(r.createdAt) + '</time></span></p></div></div>' +
      '<button type="button" class="icon-btn" data-close data-d="close" aria-label="' + esc(T('ca2.close')) + '">' + ico('close') + '</button></div>' +
      '<div class="ca2-dmain' + (o.side ? '' : ' is-noside') + '">' + side + '<div class="ca2-ws">' + (o.side ? '' : '<div class="ca2-wsh">' + sbt + '</div>') +
      '<div class="ca2-dbody" tabindex="0">' + toolbar + (editing ? '<p class="ca2-ban is-warn">' + esc(T('web.ca.editHint')) + '</p>' : '') + workspace + '</div></div></div>' + actions;
    var c = drawer.querySelector('.ca2-dbody [data-c="' + o.chg + '"]'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' });
  }
  // ---------- release / merge review (release-review-drawer.tsx, global-merge-drawer.tsx): same dialog chrome, no side toggle ----------
  function dHead(r, meta) {
    return '<div class="ca2-dhd"><div class="ca2-dhl"><div class="ca2-dmeta"><span class="ca2-id is-static">' + esc(r.code) + '</span>' + typeChip(r.type) + resultChip(r) + '</div>' +
      '<h2 id="ca2-dt">' + esc(r.summary) + '</h2><div class="ca2-hrow"><p class="ca2-hmeta">' + meta + '</p>' +
      '<p class="ca2-hmeta ca2-hby"><span>' + maker(r.maker) + '</span><span><time datetime="' + esc(r.createdAt) + '">' + date(r.createdAt) + '</time></span></p></div></div>' +
      '<button type="button" class="icon-btn" data-close data-d="close" aria-label="' + esc(T('ca2.close')) + '">' + ico('close') + '</button></div>';
  }
  function decisionSec(r, reason) {
    return r.status === 'PENDING' ? '' : sec(T('ca2.decisionH'), kv([[T('ca2.result'), resultChip(r)], r.decidedBy ? [T('ca2.decider'), esc(who(r.decidedBy))] : null, [T('ca2.when'), date(r.decidedAt)],
      r.reason ? [T(r.outcome === 'REJECTED' ? 'ca2.rejectReason' : 'ca2.reviewNote'), esc(reason)] : null]) +
      (r.status === 'SUPERSEDED' ? '<p class="muted ca2-note">' + esc(T('web.ca.rel.supersededHint')) + '</p>' : ''));
  }
  function actBar(r, who0, extra, approve) {
    var can = function (a) { return r.allowedActions.indexOf(a) !== -1; };
    return r.status !== 'PENDING' ? '' : '<div class="ca2-act">' + (r.allowedActions.length === 0 ? '<div class="ca2-who">' + esc(T(who0)) + '</div>' : '') + (extra || '') + '<div class="ca2-btns">' +
      (can('REJECT') ? '<button type="button" class="btn btn-danger-outline" data-d="reject">' + esc(T('ca2.reject')) + '</button>' : '') + (approve || '') + '</div></div>';
  }
  function groups(list, keyOf, line) {
    return CHANGES.map(function (c) {
      var xs = list.filter(function (x) { return x.change === c; });
      return xs.length ? '<div class="ca2-relg"><h4 class="ca2-sub">' + chip(T('web.rel.ch.' + c), CH_TONE[c]) + ' <span class="muted">' + num(xs.length) + '</span></h4><ul class="ca2-bklist">' +
        xs.map(function (x) { return '<li data-k="' + esc(keyOf(x)) + '">' + line(x) + '</li>'; }).join('') + '</ul></div>' : '';
    }).join('');
  }
  function renderRelease() {
    var r = D().r, m = r.metadata, pending = r.status === 'PENDING', v = 'v' + m.versionLabel, kbN = kbName(r.knowledgeBaseId);
    var side = '<aside class="ca2-side" aria-label="' + esc(T('ca2.side.req')) + '">' +
      sec(T('ca2.side.req'), kv([[T('ca2.h.id'), '<span class="ca2-code">' + esc(r.code) + '</span>'], [T('ca2.h.type'), typeChip(r.type)], [T('ca2.status'), resultChip(r)]])) +
      sec(T('ca2.version'), kv([[T('ca2.kb'), esc(kbN)], [T('web.ca.rel.version'), esc(v)], [T('web.ca.rel.bump'), esc(T('web.rel.bump' + m.bump))]]) +
        (pending ? '<p class="muted ca2-note">' + esc(T('web.ca.rel.provisional')) + '</p>' : '')) +
      sec(T('ca2.side.more'), kv([[T('ca2.side.by'), esc(who(m.requestedBy || r.maker))], [T('ca2.side.at'), '<time datetime="' + esc(r.createdAt) + '">' + date(r.createdAt) + '</time>']])) +
      decisionSec(r, releaseReason(r)) + '</aside>';
    var pkgs = m.packages || [];
    var body = '<section class="ca2-sec"><h3 class="ca2-sub">' + esc(T('web.rel.notes')) + '</h3><p class="ca2-reason">' + esc(m.notes || '—') + '</p></section>' +
      '<section class="ca2-sec"><h3 class="ca2-sub">' + esc(T('web.ca.rel.changes')) + '</h3><p>' + esc(T('common.document')) + ': ' + esc(counts(m.summary)) + '</p>' +
        groups(m.documents, function (x) { return x.documentId; }, function (x) { return esc(x.title); }) +
        (m.documentsTruncated ? '<p class="muted ca2-note" role="note">' + esc(T('web.rel.truncated', { n: num(m.documents.length) })) + '</p>' : '') + '</section>' +
      // glossary term, not translated
      '<section class="ca2-sec"><h3 class="ca2-sub">Knowledge Packages</h3><p>' + esc(counts(m.packageSummary || { added: 0, modified: 0, removed: 0 }, 'web.ca.rel.noPkgs')) + '</p>' +
        groups(pkgs, function (x) { return x.artifactId; }, function (x) { return esc(x.title) + ' <span class="muted">· ' + esc(x.artifactType) + '</span>'; }) +
        (m.packagesTruncated ? '<p class="muted ca2-note" role="note">' + esc(T('web.rel.truncated', { n: num(pkgs.length) })) + '</p>' : '') + '</section>';
    drawer.innerHTML = dHead(r, '<span>' + esc(T('ca2.kb')) + ': ' + esc(kbN) + '</span><span>' + esc(v) + '</span>') +
      '<div class="ca2-dmain">' + side + '<div class="ca2-ws"><div class="ca2-dbody" tabindex="0">' + body + '</div></div></div>' +
      actBar(r, 'web.ca.notReviewer', '', r.allowedActions.indexOf('APPROVE') !== -1 ? '<button type="button" class="btn btn-approve" data-d="approve">' + esc(T('ca2.approve')) + '</button>' : '');
  }
  var ITEM_LABEL = { TAG_TYPE: 'Tag type', TAG_VALUE: 'Tag', ENTITY_TYPE: 'Entity type', RELATIONSHIP_TYPE: 'Relationship type', TRIPLE: 'Triple' };
  function mKey(i) { return i.itemType + ':' + i.code; }
  // the Admin's edits as a finalPayload (kept items, renames trimmed); null when nothing was edited, so the decision is a plain APPROVED
  function mergePayload() {
    var o = D(), items = o.r.metadata.items, kept = items.filter(function (i) { return !o.dropped[mKey(i)]; });
    var out = kept.map(function (i) { var rn = o.renames[mKey(i)] || {}; return { itemType: i.itemType, code: i.code, newCode: (rn.newCode || '').trim() || null, newName: (rn.newName || '').trim() || null }; });
    return kept.length < items.length || out.some(function (x) { return x.newCode || x.newName; }) ? { items: out } : null;
  }
  function keptN() { var o = D(); return o.r.metadata.items.filter(function (i) { return !o.dropped[mKey(i)]; }).length; }
  function renderMerge() {
    var o = D(), r = o.r, m = r.metadata, pending = r.status === 'PENDING', editable = pending && r.allowedActions.indexOf('APPROVE_WITH_EDITS') !== -1;
    var src = m.sourcePreset.name + ' · v' + m.sourcePreset.version, kind = m.presetKind === 'ONTOLOGY' ? 'Ontology' : 'Taxonomy', imp = r.impact;
    var fin = null; if (r.finalPayload) { fin = {}; r.finalPayload.items.forEach(function (x) { fin[mKey(x)] = x; }); }
    var payload = mergePayload(), kept = keptN();
    var side = '<aside class="ca2-side" aria-label="' + esc(T('ca2.side.req')) + '">' +
      sec(T('web.ca.gm.preset'), kv([[T('web.ca.gm.kind'), kind], [T('web.ca.gm.source'), esc(src)], [T('web.ca.gm.global'), esc(m.globalPreset.name + ' · v' + m.globalPreset.version)]])) +
      sec(T('web.ca.gm.impact'), imp && imp.knowledgeBases.length ? '<ul class="ca2-bklist">' + imp.knowledgeBases.map(function (k) { return '<li>' + esc(k.name) + '</li>'; }).join('') + '</ul>' : '<p class="muted ca2-note">' + esc(T('web.ca.gm.noImpact')) + '</p>') +
      decisionSec(r, r.reason) + '</aside>';
    var rows = m.items.map(function (i) {
      var k = mKey(i), on = !o.dropped[k], f = fin && fin[k], left = !!fin && !f, rn = o.renames[k] || {};
      return '<tr' + (left ? ' class="muted"' : '') + '>' +
        (editable ? '<td><input type="checkbox" data-gm-keep="' + esc(k) + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(T('web.ca.gm.keepX', { x: i.label })) + '"></td>' : '') +
        '<td>' + chip(T('web.ca.gm.ch.' + i.change), i.change === 'ADDED' ? 'success' : 'warning') + '</td>' +
        '<td>' + (left ? '<s>' + esc(i.label) + '</s>' : esc(i.label)) + ' <span class="muted text-xs">· ' + ITEM_LABEL[i.itemType] + '</span></td>' +
        '<td class="mono text-sm">' + (f && f.newCode ? '<s>' + esc(i.code) + '</s> → ' + esc(f.newCode) : esc(i.code)) + (f && f.newName ? '<span class="muted"> · ' + esc(f.newName) + '</span>' : '') + '</td>' +
        (editable ? '<td>' + (i.itemType !== 'TRIPLE' && on ? '<span class="ca2-gm-rn"><input class="input input-sm" data-gm-rn="newCode" data-k="' + esc(k) + '" value="' + esc(rn.newCode || '') + '" maxlength="64" placeholder="' + esc(T('web.ca.gm.newCode')) + '" aria-label="' + esc(T('web.ca.gm.newCodeX', { x: i.code })) + '">' +
          '<input class="input input-sm" data-gm-rn="newName" data-k="' + esc(k) + '" value="' + esc(rn.newName || '') + '" maxlength="200" placeholder="' + esc(T('web.ca.gm.newName')) + '" aria-label="' + esc(T('web.ca.gm.newNameX', { x: i.label })) + '"></span>' : '') + '</td>' : '') + '</tr>';
    }).join('');
    var body = '<section class="ca2-sec"><h3 class="ca2-sub">' + esc(T('web.ca.gm.items', { a: num(m.summary.added), c: num(m.summary.changed) })) + '</h3>' +
      (editable ? '<p class="muted ca2-note">' + esc(T('web.ca.gm.editHint')) + '</p>' : '') +
      '<table class="ca2-gm-table table"><caption class="sr-only">' + esc(T('web.ca.gm.itemsCap')) + '</caption><thead><tr>' + (editable ? '<th scope="col">' + esc(T('web.ca.gm.keep')) + '</th>' : '') +
      '<th scope="col">' + esc(T('web.ca.gm.change')) + '</th><th scope="col">' + esc(T('web.ca.gm.item')) + '</th><th scope="col">' + esc(T('web.ca.gm.code')) + '</th>' + (editable ? '<th scope="col">' + esc(T('web.ca.gm.rename')) + '</th>' : '') +
      '</tr></thead><tbody>' + rows + '</tbody></table>' + (m.itemsTruncated ? '<p class="muted ca2-note" role="note">' + esc(T('web.ca.gm.truncated', { n: num(m.items.length) })) + '</p>' : '') + '</section>';
    var showApprove = payload ? editable : pending && r.allowedActions.indexOf('APPROVE') !== -1;
    drawer.innerHTML = dHead(r, '<span>' + kind + ' · ' + esc(src) + '</span>') +
      '<div class="ca2-dmain">' + side + '<div class="ca2-ws"><div class="ca2-dbody" tabindex="0">' + body + '</div></div></div>' +
      actBar(r, 'web.ca.gm.adminOnly', editable && kept === 0 ? '<div class="ca2-who" role="status">' + esc(T('web.ca.gm.noneKept')) + '</div>' : '',
        showApprove ? '<button type="button" class="btn btn-approve" data-d="approve"' + (kept === 0 ? ' disabled' : '') + '>' + esc(T(payload ? 'web.ca.gm.approveEdits' : 'ca2.approve')) + '</button>' : '');
  }
  function refocus(sel) { var el = sel && drawer.querySelector(sel); if (el) el.focus(); }
  function send(d, x) {
    var o = D(), r = o.r;
    busy(d, true);
    RV.decide(r.reviewId, r.revision, x).then(function (done) {
      KB.toast(T('web.ca.done.' + x.decision, { code: r.code }));
      closeAsk();
      if (!st.open || st.open.r.reviewId !== r.reviewId) return;
      o.mode = 'view'; o.r = done; o.dropped = {}; o.renames = {}; pick(done, false);
      renderDrawer(); render();
      var f = tabbables()[0]; if (f) f.focus();
    }, function (e) {
      closeAsk();
      var s = e.status || 0;
      KB.toast(T(s === 412 ? 'web.ca.err.stale' : s === 409 ? 'web.ca.err.decided' : 'web.ca.err.generic'));
      if (s === 412 || s === 409) closeReview();
    });
  }
  function askReject() {
    var r = D().r;
    ask({ title: T('ca2.rejectQ', { id: r.code }), body: T(r.type === 'KNOWLEDGE_RELEASE' ? 'web.ca.rel.rejectB' : r.type === 'GLOBAL_MERGE' ? 'web.ca.gm.rejectB' : 'ca2.rejectB'), go: T('ca2.h.reject'), variant: 'danger',
      extra: '<label for="ca2-reason">' + esc(T('ca2.h.rejectReason')) + ' <span class="ca2-req" aria-hidden="true">*</span></label><textarea class="textarea" id="ca2-reason" rows="4" placeholder="' + esc(T('ca2.h.rejectPh')) + '" aria-required="true"></textarea>',
      onGo: function (d) {
        var ta = $('#ca2-reason', d), v = ta.value.trim();
        if (!v) {
          ta.setAttribute('aria-invalid', 'true'); ta.setAttribute('aria-describedby', 'ca2-reason-err');
          if (!$('#ca2-reason-err', d)) ta.insertAdjacentHTML('afterend', '<p id="ca2-reason-err" class="field-err" role="alert">' + esc(T('ca2.h.rejectErr')) + '</p>');
          return;
        }
        send(d, { decision: 'REJECTED', reason: v });
      } });
    var ta = $('#ca2-reason', askEl);
    ta.addEventListener('input', function () { ta.removeAttribute('aria-invalid'); ta.removeAttribute('aria-describedby'); var e = $('#ca2-reason-err', askEl); if (e) e.remove(); });
    ta.focus();
  }
  function askApprove(edit) {
    var o = D(), r = o.r, a = T(edit ? 'ca2.do.approve_edit' : 'ca2.do.approve');
    if (r.type === 'KNOWLEDGE_RELEASE') {
      var v = 'v' + r.metadata.versionLabel;
      return ask({ title: T('web.ca.rel.approveQ', { v: v, id: r.code }), body: T('web.ca.rel.approveB'), go: a, onGo: function (d) { send(d, { decision: 'APPROVED' }); } });
    }
    if (r.type === 'GLOBAL_MERGE') {
      var pl = mergePayload();
      return ask({ title: T('web.ca.gm.approveQ', { id: r.code }), body: T(pl ? 'web.ca.gm.approveEditsB' : 'web.ca.gm.approveB', { n: num(keptN()), v: 'v' + (r.metadata.globalPreset.version + 1) }), go: a,
        onGo: function (d) { send(d, pl ? { decision: 'APPROVED_WITH_EDITS', finalPayload: pl } : { decision: 'APPROVED' }); } });
    }
    ask({ title: T('ca2.confirmQ', { a: a, id: r.code }), body: T(edit ? 'ca2.okEditB' : 'ca2.okB'), go: a,
      onGo: function (d) { send(d, edit ? { decision: 'APPROVED_WITH_EDITS', finalPayload: JSON.parse(JSON.stringify(o.keep)) } : { decision: 'APPROVED' }); } });
  }
  function copy() {
    var r = D().r;
    if (navigator.clipboard) navigator.clipboard.writeText(r.code).then(function () { KB.toast(T('ca2.copied', { id: r.code })); }, function () { KB.toast(T('ca2.copyFail')); });
  }
  function onDrawerClick(e) {
    var o = D(); if (!o) return;
    var v = e.target.closest('[data-view]');
    if (v) { o.view = v.getAttribute('data-view'); renderDrawer(); refocus('[data-view="' + o.view + '"]'); return; }
    var b = e.target.closest('[data-d]'); if (!b || b.disabled) return;
    var k = b.getAttribute('data-d');
    if (k === 'close') closeReview();
    else if (k === 'side') { o.side = !o.side; renderDrawer(); refocus('[data-d="side"]'); }
    else if (k === 'prev' || k === 'next') { o.chg += k === 'prev' ? -1 : 1; renderDrawer(); refocus('[data-d="' + k + '"]:not([disabled])') ; }
    else if (k === 'copy') copy();
    else if (k === 'reject') askReject();
    else if (k === 'approve') askApprove(false);
    else if (k === 'edit') { o.keep = JSON.parse(JSON.stringify(o.r.metadata.proposed)); o.mode = 'edit'; renderDrawer(); refocus('[data-keep]'); }
    else if (k === 'cancelEdit') { o.mode = 'view'; renderDrawer(); refocus('[data-d="edit"]'); }
    else if (k === 'askEdit') askApprove(true);
  }
  // the service keeps tag order; keep it here too
  function onDrawerChange(e) {
    var o = D(), t = e.target;
    if (o && t.matches('[data-gm-keep]')) { var k = t.getAttribute('data-gm-keep'); if (t.checked) delete o.dropped[k]; else o.dropped[k] = true; renderDrawer(); refocus('[data-gm-keep="' + k.replace(/"/g, '\\"') + '"]'); return; }
    if (!o || !t.matches('[data-keep]')) return;
    var f = t.getAttribute('data-keep'), tag = t.value, on = t.checked;
    o.keep[f] = o.r.metadata.current[f].filter(function (x) { return x === tag ? on : o.keep[f].indexOf(x) !== -1; });
    renderDrawer(); refocus('[data-keep="' + f + '"][value="' + tag.replace(/"/g, '\\"') + '"]');
  }

  // ---------- list events ----------
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (drawer && drawer.contains(t)) return;
    var tab = t.closest('#ca2-tabs [role="tab"]');
    if (tab) { st.queue = tab.getAttribute('data-queue'); reset(true); setTimeout(function () { $('#ca2-pane').hidden = false; }); return; }
    if (t.closest('[data-sort]')) { st.sortOrder = st.sortOrder === 'ASC' ? 'DESC' : 'ASC'; reset(false); $('[data-sort]').focus(); return; }
    var pg = t.closest('[data-pg]');
    if (pg && !pg.disabled) { st.page = +pg.getAttribute('data-pg') - 1; render(); return; }
    var act = t.closest('[data-act]');
    if (act && !act.disabled) { if (act.getAttribute('data-act') === 'clear') { st.sel = {}; render(); } else askBulk(); return; }
    // the checkbox selects, it does not open the row
    if (t.closest('[data-ck]') || t.closest('.ca2-ck')) return;
    var tr = t.closest('#ca2-list tbody tr[data-id]');
    if (tr) { var r = rowById(tr.getAttribute('data-id')); if (r) openReview(r, tr); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'ca2-kb') { st.kb = t.value; reset(true); return; }
    if (t.id === 'ca2-size') { st.size = +t.value; reset(false); var s = $('#ca2-size'); if (s) s.focus(); return; }
    if (t.id === 'ca2-all') { st.rows.forEach(function (r) { pick(r, t.checked); }); render(); $('#ca2-all').focus(); return; }
    if (t.matches && t.matches('[data-sel]')) { var r = rowById(t.getAttribute('data-sel')); if (r) pick(r, t.checked); render(); var c = $('[data-sel="' + t.getAttribute('data-sel') + '"]'); if (c) c.focus(); }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'qs') { st.q = e.target.value; reset(true); } });
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (st.open && !document.querySelector('dialog[open]')) {
      if (e.key === 'Escape') { e.preventDefault(); if (st.open.mode === 'edit') { st.open.mode = 'view'; renderDrawer(); refocus('[data-d="edit"]'); } else closeReview(); return; }
      // keep the focus inside the review dialog
      if (e.key === 'Tab') {
        var list = tabbables(); if (!list.length) return;
        var i = list.indexOf(document.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); list[list.length - 1].focus(); }
        else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); list[0].focus(); }
        else if (i === -1) { e.preventDefault(); list[0].focus(); }
        return;
      }
    }
    // arrow keys switch tabs
    if (t.closest && t.closest('#ca2-tabs [role="tab"]') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault(); st.queue = st.queue === 'PENDING' ? 'DECIDED' : 'PENDING'; reset(true); $('#ca2-tab-' + st.queue).focus(); return;
    }
    // the row opens the review; Enter / Space too
    if ((e.key === 'Enter' || e.key === ' ') && t.matches && t.matches('#ca2-list tbody tr[data-id]')) { e.preventDefault(); var r = rowById(t.getAttribute('data-id')); if (r) openReview(r, t); }
  });
  // another tab decided (or this one did): refresh the list; the open review keeps the copy it was opened with
  document.addEventListener('ecp-rv-change', function () { render(); });
  document.addEventListener('ecp-rolechange', function () { closeReview(); st.sel = {}; st.page = 0; render(); });
  if (I && I.onChange) I.onChange(function () { render(); if (st.open) renderDrawer(); });
  function start() { render(); setTimeout(function () { st.loading = false; render(); }, 200); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
