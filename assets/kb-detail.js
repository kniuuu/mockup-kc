/* ECP mockups: KB detail (ek-knowledge-detail.html?kb=<id>): fills the KB name, description, tags, Owner, Steward, PII
 * restriction and status badge ([data-kb-f]) from the selected KB in kb-data.js (default credit-corp).
 * The edit button opens Edit KB (kb-create.html?edit=<kb>&from=detail) for a System Admin or an Owner of the KB; for
 * anyone else it is disabled with the reason as its tooltip. PII restriction is only shown here (edited in Edit KB).
 * Also: the Upload dialog (files, then the Job detail of the job they start), the All tab pager and, below, the working
 * state / release flow (ADR-006 §5) and "Đổi preset" (ADR-007). */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var KB = window.ECP_KB;
    if (!KB || !document.querySelector('[data-kb-f]')) return;
    var I = window.ECP_I18N, T = (I && I.tr) || function (k, v) { return v; };
    var esc = KB.esc, params = new URLSearchParams(location.search);
    var k = KB.get(params.get('kb')) || KB.get('credit-corp');
    function person(id, av2) { var p = KB.person(id); return '<span data-i18n-skip class="person"><span class="av' + (av2 ? ' av-2' : '') + '" aria-hidden="true">' + esc(p.ini) + '</span>' + esc(p.name) + '</span>'; }
    document.querySelectorAll('[data-kb-f="name"]').forEach(function (el) { el.textContent = k.name; if (el.hasAttribute('title')) el.setAttribute('title', k.name); });
    var d = document.querySelector('[data-kb-f="desc"]'); if (d) d.textContent = k.desc;
    var tg = document.querySelector('[data-kb-f="tags"]'); if (tg) tg.innerHTML = KB.tagsHtml(k);
    var ow = document.querySelector('[data-kb-f="owner"]'); if (ow) ow.innerHTML = k.owners.map(function (id) { return person(id); }).join(' ');
    var sw = document.querySelector('[data-kb-f="steward"]'); if (sw) sw.innerHTML = k.stewards.length ? k.stewards.map(function (id) { return person(id, true); }).join(' ') : '—';
    var pii = document.querySelector('[data-kb-f="pii"]');
    function fillPii() { if (pii) pii.innerHTML = '<span class="chip ' + (k.pii ? 'chip-warning' : 'chip-neutral') + '" data-i18n-skip>' + esc(KB.piiLabel(k.pii)) + '</span>'; }
    var edit = document.querySelector('[data-kb-edit]');
    function gateEdit() {
      if (!edit) return;
      var ok = KB.can.editKb(k);
      if (ok) edit.setAttribute('href', 'kb-create.html?edit=' + encodeURIComponent(k.id) + '&from=detail'); else edit.removeAttribute('href');
      edit.setAttribute('aria-disabled', String(!ok));
      edit.setAttribute('title', ok ? T('ek.editKb', 'Chỉnh sửa tri thức') : T('kbe.editNoPerm', 'Chỉ Owner của tri thức hoặc System Admin được chỉnh sửa'));
    }
    fillPii(); gateEdit();
    // header: version badge label; "Tải lên" only for who can edit an active KB; search also filters the packages
    var vb = document.querySelector('.crumb-badge[data-vh]');
    if (vb) { vb.textContent = k.ver; vb.setAttribute('data-i18n-args', JSON.stringify({ v: k.ver })); vb.setAttribute('aria-label', T('vh.cellAria', '{v} · Lịch sử phiên bản', { v: k.ver })); }
    function gateUpload() {
      var up = document.querySelector('.breadcrumb [data-kb-upload]'); if (!up) return;
      up.hidden = up.previousElementSibling.hidden = !KB.can.upload(k);
    }
    gateUpload(); document.addEventListener('ecp-rolechange', gateUpload);
    var qIn = document.querySelector('[data-kb-q]');
    if (qIn) qIn.addEventListener('input', function () {
      var q = qIn.value.trim().toLowerCase();
      [].forEach.call(document.querySelectorAll('#panel-pkgs tbody tr[data-kind]'), function (r) { r.classList.toggle('q-hide', !!q && r.cells[1].textContent.toLowerCase().indexOf(q) < 0); });
    });
    // Documents | Knowledge Packages switch (pager, left): the only way between the two lists
    [].forEach.call(document.querySelectorAll('[data-kb-art]'), function (b) {
      b.addEventListener('click', function () {
        var to = b.getAttribute('data-kb-art');
        document.getElementById('panel-docs').hidden = to !== 'docs'; document.getElementById('panel-pkgs').hidden = to !== 'pkgs';
        var nb = document.querySelector('#panel-' + to + ' [data-kb-art="' + to + '"]'); if (nb) nb.focus();
      });
    });
    // Kích hoạt switch of a document: off = not searchable; read-only unless the user can edit the KB
    function gateSwitches() { [].forEach.call(document.querySelectorAll('[data-kb-doc-switch]'), function (s) { s.disabled = !KB.can.edit(k); }); }
    gateSwitches(); document.addEventListener('ecp-rolechange', gateSwitches);
    document.addEventListener('click', function (e) {
      var s = e.target.closest && e.target.closest('[data-kb-doc-switch]'); if (!s || s.disabled) return;
      var on = s.getAttribute('aria-checked') !== 'true';
      s.setAttribute('aria-checked', String(on)); s.closest('tr').classList.toggle('is-inactive', !on);
    });
    if (I) I.onChange(function () { fillPii(); gateEdit(); });
    document.addEventListener('ecp-rolechange', gateEdit);
    allPager();
  });

  // All tab: rows per page 10 / 25 / 50 and page buttons (same pager as the Documents tab)
  function allPager() {
    var T = (window.ECP_I18N && window.ECP_I18N.tr) || function (k, v) { return v; };
    var size = document.getElementById('all-size'); if (!size) return;
    var rows = [].slice.call(document.querySelectorAll('#panel-all tbody tr')), page = 1, box = document.getElementById('all-pages');
    function render() {
      var n = parseInt(size.value, 10), pages = Math.max(1, Math.ceil(rows.length / n)), from = (page - 1) * n;
      rows.forEach(function (r, i) { r.hidden = i < from || i >= from + n; });
      document.getElementById('all-range').textContent = T('jd.rangeOf', 'Hiển thị {a}–{b} / {n} tài liệu', { a: rows.length ? from + 1 : 0, b: Math.min(rows.length, from + n), n: rows.length });
      box.textContent = '';
      for (var p = 1; p <= pages; p++) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = p;
        b.setAttribute('aria-label', T('ek.pageN', 'Trang {n}', { n: p }));
        if (p === page) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', (function (x) { return function () { page = x; render(); }; })(p));
        box.appendChild(b);
      }
      document.getElementById('all-prev').disabled = page <= 1;
      document.getElementById('all-next').disabled = page >= pages;
    }
    size.addEventListener('change', function () { page = 1; render(); });
    document.getElementById('all-prev').addEventListener('click', function () { page--; render(); });
    document.getElementById('all-next').addEventListener('click', function () { page++; render(); });
    if (window.ECP_I18N) window.ECP_I18N.onChange(render);
    render();
  }

  // Upload (art-head button): drag files in or click to choose; unsupported types are skipped; at most 50 files / 50 MB.
  // "Tải lên và xử lý" opens the Job detail of the Transformation Job the upload starts.
  var UP_EXT = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls', '.csv', '.html', '.htm', '.md', '.png', '.jpg', '.jpeg', '.webp'];
  var UP_MAX_FILES = 50, UP_MAX_BYTES = 50 * 1024 * 1024;
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('[data-kb-upload]'); if (!btn) return;
    var I = window.ECP_I18N, T = (I && I.tr) || function (k, v, a) { return String(v).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); };
    var esc = window.ECP_KB.esc, files = [], skipped = [];
    var X = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    var d = document.createElement('dialog'); d.className = 'q-dlg kb-up-dlg'; d.setAttribute('aria-labelledby', 'kb-up-t');
    d.innerHTML = '<div class="q-dlg-head"><h2 class="modal-title job-ell" id="kb-up-t" data-i18n="kbe.upTitle">Tải tài liệu lên</h2>' +
      '<button class="icon-btn" type="button" data-kb-up-close data-i18n-attr="aria-label:common.close" aria-label="Đóng">' + X + '</button></div>' +
      '<div class="kb-up-body"><input type="file" multiple class="sr-only" tabindex="-1" aria-hidden="true" accept="' + UP_EXT.join(',') + '">' +
      '<button class="kb-up-drop" type="button" aria-describedby="kb-up-hint"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>' +
      '<span class="kb-up-drop-t" data-i18n="kbe.dropHint">Kéo thả tệp vào đây hoặc bấm để chọn</span></button>' +
      '<p class="muted text-xs" id="kb-up-hint" data-i18n="kbe.upFilesHint" data-i18n-args=\'{"n":50}\'>Tối đa 50 tệp, tổng 50 MB. PDF, ảnh, Word, PowerPoint, Excel, CSV, HTML, Markdown.</p>' +
      '<div data-kb-up-out></div></div>' +
      '<div class="q-dlg-foot"><button class="btn btn-secondary" type="button" data-kb-up-close data-i18n="common.cancel">Hủy</button>' +
      '<button class="btn btn-primary" type="button" data-kb-up-submit disabled data-i18n="kbe.upSubmit">Tải lên và xử lý</button></div>';
    document.body.appendChild(d);
    if (I) I.apply(d);
    var input = d.querySelector('input[type=file]'), drop = d.querySelector('.kb-up-drop'), out = d.querySelector('[data-kb-up-out]'), submit = d.querySelector('[data-kb-up-submit]');
    function ext(n) { var i = n.lastIndexOf('.'); return i < 0 ? '' : n.slice(i).toLowerCase(); }
    function mb(b) { return new Intl.NumberFormat(I && I.lang === 'en' ? 'en' : 'vi', { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(b / 1048576); }
    function render() {
      var total = files.reduce(function (n, f) { return n + f.size; }, 0), many = files.length > UP_MAX_FILES, big = total > UP_MAX_BYTES, h = '';
      if (skipped.length) h += '<p class="kb-up-err" role="status">' + esc(T('kbe.upSkipped', 'Bỏ qua {n} tệp không hỗ trợ: {names}', { n: skipped.length, names: skipped.join(', ') })) + '</p>';
      if (files.length) {
        h += '<ul class="kb-up-files" aria-label="' + esc(T('kbe.upSelected', 'Tệp đã chọn')) + '">' + files.map(function (f, i) {
          var rm = esc(T('kbc.removeX', 'Bỏ {x}', { x: f.name }));
          return '<li><span class="kb-up-name" data-i18n-skip>' + esc(f.name) + '</span><span class="muted">' + mb(f.size) + '</span><button class="icon-btn" type="button" data-rm="' + i + '" aria-label="' + rm + '" title="' + rm + '">' + X + '</button></li>';
        }).join('') + '<li class="kb-up-total"><span class="kb-up-name">' + esc(T('kbe.upNFiles', '{n} tệp', { n: files.length })) + '</span><span>' + mb(total) + '</span></li></ul>';
      }
      if (many || big) h += '<p class="kb-up-err" role="alert">' + esc(many ? T('kbe.upErrTooMany', 'Tối đa {n} tệp mỗi lần.', { n: UP_MAX_FILES }) : T('kbe.upErrTooLarge', 'Tổng dung lượng vượt 50 MB.')) + '</p>';
      out.innerHTML = h;
      submit.disabled = !files.length || many || big;
    }
    function add(list) {
      var picked = [].slice.call(list || []), seen = files.map(function (f) { return f.name + ':' + f.size; });
      skipped = picked.filter(function (f) { return UP_EXT.indexOf(ext(f.name)) < 0; }).map(function (f) { return f.name; });
      picked.forEach(function (f) { if (UP_EXT.indexOf(ext(f.name)) >= 0 && seen.indexOf(f.name + ':' + f.size) < 0) files.push(f); });
      render();
    }
    btn.addEventListener('click', function () { files = []; skipped = []; render(); d.showModal(); });
    drop.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { add(input.files); input.value = ''; });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-drag'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-drag'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-drag'); add(e.dataTransfer.files); });
    out.addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (b) { files.splice(+b.getAttribute('data-rm'), 1); render(); } });
    d.querySelectorAll('[data-kb-up-close]').forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
    d.addEventListener('close', function () { btn.focus(); });
    submit.addEventListener('click', function () { location.href = 'job-detail.html'; });
    if (I) I.onChange(function () { if (d.open) render(); });
  });
})();

/* Working state + releases (ADR-006 §5) and "Đổi preset" (ADR-007) on the KB detail, as the app (kb-side-panel.tsx,
 * working-state-card.tsx, release-dialog.tsx, preset-switch-dialog.tsx, artifact-history.tsx). Mock state, this page only.
 * The working state ("v2.3 · hiện tại" = the release + the changes since) is seen by an Owner / Steward of the KB and the
 * System Admin: Owner / Admin release directly, a Steward sends a release request. The version chip opens the version
 * history: "v2.3 (hiện tại)" above "v2.3 · Bản phát hành gốc", So sánh, and the release button in the footer.
 * Before v1.0 (ek-knowledge-detail-empty.html: no version chip) there is no working state and no "Đổi preset". */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var KB = window.ECP_KB, presetDds = document.querySelectorAll('[data-preset]');
    if (!KB || !presetDds.length) return;
    var I = window.ECP_I18N, T = (I && I.tr) || function (k, v, a) { return String(v).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); };
    var esc = KB.esc, k = KB.get(new URLSearchParams(location.search).get('kb')) || KB.get('credit-corp');
    var chip = document.querySelector('[data-kb-f="ver"]'), card = document.querySelector('[data-kb-ws]');
    var VER = k.ver || 'v1.0', n = VER.slice(1).split('.'), NEXT = { MINOR: 'v' + n[0] + '.' + (+n[1] + 1), MAJOR: 'v' + (+n[0] + 1) + '.0' };
    var NOTES_MAX = 2000, N_DOCS = 128, KIND = { taxonomy: 'Taxonomy', ontology: 'Ontology' };
    var X = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    // changes since VER was released (documentChanges, packageSummary, presetChanges)
    var WS = {
      docs: [['doc-qd-ghnganh', 'Quy định giới hạn cấp tín dụng theo ngành', 'ADDED'], ['doc-qt-hdtd', '', 'MODIFIED'], ['doc-tt39', '', 'RETAGGED']],
      pkgs: { added: 0, modified: 1, removed: 0 }, presets: [], working: {}, presetRun: null, publishing: null, pending: []
    };
    if (chip) {
      chip.textContent = VER; chip.setAttribute('data-i18n-args', JSON.stringify({ v: VER }));
      chip.setAttribute('aria-label', T('vh.cellAria', '{v} · Lịch sử phiên bản', { v: VER }));
    }
    function fmt(x) { return new Intl.NumberFormat(I && I.lang === 'en' ? 'en' : 'vi').format(x); }
    function sees() { return !!chip && KB.can.edit(k); }
    function direct() { return KB.can.editKb(k); }
    function docN(c) { return WS.docs.filter(function (d) { return d[2] === c; }).length; }
    function changes() { return WS.docs.length + WS.pkgs.added + WS.pkgs.modified + WS.pkgs.removed + WS.presets.length; }
    function pText(p) { return p.name + ' · v' + p.version; }
    function released(kind) { return chip ? KB.presetOf(k, kind) : KB.presetOf({ id: '' }, kind); }
    var RC = { added: '{n} thêm', modified: '{n} sửa', removed: '{n} gỡ', retagged: '{n} đổi tag' };
    function parts(list) {
      return list.filter(function (x) { return x[1]; }).map(function (x) { return T('web.rel.c.' + x[0], RC[x[0]], { n: fmt(x[1]) }); }).join(' · ') || T('web.rel.none', 'Không đổi');
    }
    // ChangeSummary: documents, packages, KB tags, preset switches
    function summaryHtml() {
      var h = '<dl class="kv kb-rel-sum"><dt>' + esc(T('common.document', 'Văn bản')) + '</dt><dd>' + esc(parts([['added', docN('ADDED')], ['modified', docN('MODIFIED')], ['removed', docN('REMOVED')], ['retagged', docN('RETAGGED')]])) + '</dd>' +
        '<dt>Package</dt><dd>' + esc(parts([['added', WS.pkgs.added], ['modified', WS.pkgs.modified], ['removed', WS.pkgs.removed]])) + '</dd>' +
        '<dt>Tags</dt><dd>' + esc(T('web.rel.none', 'Không đổi')) + '</dd>';
      WS.presets.forEach(function (c) { h += '<dt>' + KIND[c.kind] + '</dt><dd data-i18n-skip>' + esc(pText(c.from) + ' → ' + pText(c.to)) + '</dd>'; });
      return h + '</dl>';
    }
    // ReleaseStatus: re-enrichment after "Đổi preset", the release in progress, pending release requests
    function statusHtml() {
      var li = [];
      if (WS.presetRun) li.push('<li role="status">' + esc(T('web.kbd.preset.running', 'Đang chạy lại enrichment sau khi đổi preset {k}; version KB mới được phát hành khi xong.', { k: KIND[WS.presetRun] })) +
        ' <a class="link" href="job-detail.html">' + esc(T('web.kbd.preset.viewJob', 'Xem tiến độ')) + '</a></li>');
      if (WS.publishing) li.push('<li role="status">' + esc(T('web.rel.publishing', 'Đang phát hành {v}…', { v: WS.publishing })) + '</li>');
      WS.pending.forEach(function (r) { li.push('<li>' + esc(T('web.rel.pending', 'Đang chờ Owner duyệt · {code} ({v})', r)) + '</li>'); });
      return li.length ? '<ul class="kb-rel-pending" aria-label="' + esc(T('web.rel.pendingH', 'Trạng thái phát hành')) + '">' + li.join('') + '</ul>' : '';
    }
    function releaseBtn(sm) {
      var busy = !!WS.publishing;
      return '<button class="btn btn-primary' + (sm ? ' btn-sm' : '') + '" type="button" data-kb-release' + (!changes() || busy ? ' disabled' : '') +
        (busy ? ' title="' + esc(T('web.rel.err.RELEASE_IN_PROGRESS', 'Một phiên bản đang được phát hành. Thử lại khi xong.')) + '"' : '') + '>' +
        esc(direct() ? T('web.rel.release', 'Phát hành phiên bản') : T('web.rel.request', 'Gửi yêu cầu phát hành')) + '</button>';
    }
    var compareBtn = function () { return '<button class="btn btn-secondary btn-sm" type="button" data-kb-compare>' + esc(T('web.rel.compare', 'So sánh')) + '</button>'; };

    // ---------- working state card (above the artifacts) ----------
    function renderCard() {
      if (!card) return;
      card.hidden = !sees() || (!changes() && !WS.pending.length && !WS.publishing);
      if (card.hidden) return;
      card.innerHTML = '<div class="kb-ws-text"><h2 id="kb-ws-h" class="kb-ws-h">' + esc(T('web.rel.workingState', '{v} · hiện tại', { v: VER })) +
        '<span class="muted text-sm">' + esc(T('web.rel.unreleased', '{n} thay đổi chưa phát hành', { n: fmt(changes()) }) + ' · ' + T('web.rel.comparedTo', 'so với {v} bản phát hành gốc', { v: VER })) + '</span></h2>' +
        summaryHtml() + statusHtml() + '</div><div class="kb-ws-actions">' + compareBtn() + releaseBtn(true) + '</div>';
    }

    // ---------- side panel Taxonomy / Ontology: released preset, newer version, working-state preset, "Đổi preset" ----------
    function renderPresets() {
      presetDds.forEach(function (dd) {
        var kind = dd.getAttribute('data-preset'), rel = released(kind), w = WS.working[kind], sw = T('web.kbd.preset.switch', 'Đổi preset');
        dd.innerHTML = '<span data-i18n-skip>' + esc(pText(rel)) + '</span>' +
          (rel.latest > rel.version ? '<span class="muted text-xs"> · ' + esc(T('web.kbd.preset.newer', 'có {v}', { v: 'v' + rel.latest })) + '</span>' : '') +
          (w ? '<span class="muted kb-preset-ws text-xs">' + esc(T('web.kbd.preset.working', 'Hiện tại: {x}', { x: pText(w) })) + '</span>' : '') +
          (sees() ? ' <button class="link text-xs" type="button" data-kb-preset="' + kind + '" aria-label="' + esc(sw + ' · ' + KIND[kind]) + '">' + esc(sw) + '</button>' : '');
      });
    }

    // ---------- version history (versions.js kb-tddn): the current state above the released versions ----------
    var VD = window.ECP_VERSIONS && window.ECP_VERSIONS['kb-tddn'], REL = VD ? VD.versions.slice() : [];
    var ACT = REL.filter(function (x) { return x.status === 'active'; })[0], CUR = ACT ? ACT.v + '-current' : '';
    function syncVh() {
      if (!VD || !ACT || !chip) return;
      var see = sees(), ch = {};
      WS.docs.forEach(function (d) { ch[d[0]] = d[2]; });
      var docs = ACT.data.docs.filter(function (d) { return ch[d.id] !== 'REMOVED'; }).map(function (d) {
        return ch[d.id] === 'MODIFIED' || ch[d.id] === 'RETAGGED' ? { id: d.id, title: d.title, ver: T('web.rel.ch.' + ch[d.id], ch[d.id] === 'MODIFIED' ? 'Sửa' : 'Đổi tag') } : d;
      }).concat(WS.docs.filter(function (d) { return d[2] === 'ADDED'; }).map(function (d) { return { id: d[0], title: d[1], ver: T('web.rel.ch.ADDED', 'Thêm') }; }));
      var cur = { v: CUR, vl: ['web.rel.currentId', '{v} (hiện tại)', { v: ACT.v }], status: 'draft', lbl: ['web.rel.unreleased', '{n} thay đổi chưa phát hành', { n: fmt(changes()) }],
        by: '', at: '', sum: '', data: { meta: ACT.data.meta, docs: docs } };
      ACT.lbl = see ? ['web.rel.asReleased', 'Bản phát hành gốc'] : null;
      VD.versions = see ? [cur].concat(REL) : REL.slice();
      VD.railTop = see ? function () {
        return '<section class="kvh-ws" aria-label="' + esc(T('web.rel.workingState', '{v} · hiện tại', { v: ACT.v })) + '">' + statusHtml() + '<span class="kvh-ws-actions">' + compareBtn() + '</span></section>';
      } : null;
      VD.foot = function () { return see ? releaseBtn() : ''; };
    }
    function vhOpen() { var d = document.getElementById('kvh-dlg'); return d && d.open; }

    // ---------- dialogs ----------
    function dialog(id) {
      var d = document.createElement('dialog'); d.className = 'q-dlg kb-up-dlg kb-rel-dlg'; d.setAttribute('aria-labelledby', id + '-t');
      d.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) d.close(); });
      document.body.appendChild(d);
      return d;
    }
    function frame(d, id, title, body, foot) {
      d.innerHTML = '<div class="q-dlg-head"><h2 class="modal-title job-ell" id="' + id + '-t">' + esc(title) + '</h2><button class="icon-btn" type="button" data-x aria-label="' + esc(T('common.close', 'Đóng')) + '">' + X + '</button></div>' +
        '<div class="kb-up-body">' + body + '</div><div class="q-dlg-foot">' + foot + '</div>';
    }
    var BUMP = { MINOR: ['Phiên bản phụ', 'Bổ sung, cập nhật nội dung'], MAJOR: ['Phiên bản chính', 'Thay đổi lớn về phạm vi hoặc cấu trúc'] };
    function bumpsHtml(name, hints) {
      return '<fieldset class="kb-rel-bumps"><legend class="kb-rel-lbl">' + esc(T('web.rel.bump', 'Loại phiên bản')) + '</legend>' + ['MINOR', 'MAJOR'].map(function (b) {
        return '<label class="kb-rel-bump"><input type="radio" name="' + name + '" value="' + b + '"' + (b === 'MINOR' ? ' checked' : '') + '><span class="kb-rel-bump-t">' +
          esc(T('web.rel.bump' + b, BUMP[b][0])) + ' <b class="mono">' + NEXT[b] + '</b></span>' + (hints ? '<span class="muted text-xs">' + esc(T('web.rel.bump' + b + 'Hint', BUMP[b][1])) + '</span>' : '') + '</label>';
      }).join('') + '</fieldset>';
    }
    function notesHtml(id) {
      return '<label class="kb-rel-lbl" for="' + id + '">' + esc(T('web.rel.notes', 'Ghi chú phát hành')) + '</label>' +
        '<textarea class="input" id="' + id + '" rows="3" placeholder="' + esc(T('web.rel.notesPh', 'Tóm tắt nội dung thay đổi (không bắt buộc)')) + '" aria-describedby="' + id + '-c"></textarea><p id="' + id + '-c"></p>';
    }
    // notes counter (at most NOTES_MAX) + MINOR / MAJOR: upd(tooLong, bump) on every change
    function wireForm(d, id, upd) {
      var ta = d.querySelector('#' + id), c = d.querySelector('#' + id + '-c');
      function sync() {
        var long = ta.value.length > NOTES_MAX;
        c.className = long ? 'kb-up-err' : 'muted text-xs'; ta.setAttribute('aria-invalid', String(long));
        c.textContent = T('web.rel.notesCount', '{n} / {max} ký tự', { n: fmt(ta.value.length), max: fmt(NOTES_MAX) });
        upd(long, d.querySelector('input[type=radio]:checked').value);
      }
      ta.addEventListener('input', sync); d.querySelectorAll('input[type=radio]').forEach(function (r) { r.addEventListener('change', sync); });
      sync();
    }

    // Release dialog: MINOR / MAJOR with the label preview, notes, change summary
    var rd = dialog('kb-rel');
    function openRelease() {
      var dir = direct(), bump = 'MINOR';
      frame(rd, 'kb-rel', dir ? T('web.rel.release', 'Phát hành phiên bản') : T('web.rel.request', 'Gửi yêu cầu phát hành'),
        '<p class="muted text-sm">' + esc(dir ? T('web.rel.releaseHint', 'Tạo phiên bản mới từ {v} hiện tại; {v} bản phát hành gốc được giữ nguyên. Người dùng thấy phiên bản mới ngay khi phát hành xong.', { v: VER })
          : T('web.rel.requestHint', 'Owner duyệt yêu cầu trong Thay đổi & Phê duyệt. Phiên bản hiện tại giữ nguyên cho đến khi được duyệt.')) + '</p>' +
        bumpsHtml('kb-rel-bump', true) + '<p class="kb-rel-preview" aria-live="polite" data-preview></p>' + notesHtml('kb-rel-notes') +
        '<span class="kb-rel-lbl">' + esc(T('web.rel.summary', 'Tóm tắt thay đổi')) + '</span>' + summaryHtml(),
        '<button class="btn btn-secondary" type="button" data-x>' + esc(T('common.cancel', 'Hủy')) + '</button><button class="btn btn-primary" type="button" data-go></button>');
      var go = rd.querySelector('[data-go]');
      wireForm(rd, 'kb-rel-notes', function (long, b) {
        bump = b;
        rd.querySelector('[data-preview]').textContent = T('web.rel.preview', 'Phiên bản mới: {from} → {to}', { from: VER, to: NEXT[b] });
        go.textContent = dir ? T('web.rel.releaseGo', 'Phát hành {v}', { v: NEXT[b] }) : T('web.rel.requestGo', 'Gửi yêu cầu {v}', { v: NEXT[b] });
        go.disabled = long;
      });
      go.addEventListener('click', function () {
        var v = NEXT[bump];
        rd.close();
        if (dir) { WS.publishing = v; KB.toast(T('web.rel.publishing', 'Đang phát hành {v}…', { v: v })); }
        else { var code = 'RV-' + (12 + WS.pending.length); WS.pending.push({ code: code, v: v }); KB.toast(T('web.rel.requested', 'Đã gửi yêu cầu phát hành {code} · đang chờ Owner duyệt', { code: code })); }
        renderAll();
      });
      rd.showModal();
    }

    // "Đổi preset": 1) preset + version (default the latest), 2) re-run enrichment / tagging and release (Owner / Admin) or request
    var pd = dialog('kb-preset');
    var ASK = {
      askOnt: 'Chạy lại enrichment cho {n} tài liệu và phát hành version KB mới?', askOntReq: 'Chạy lại enrichment cho {n} tài liệu và gửi yêu cầu phát hành version KB mới?',
      askTax: 'Chạy lại gắn tag cho {n} tài liệu và phát hành version KB mới?', askTaxReq: 'Chạy lại gắn tag cho {n} tài liệu và gửi yêu cầu phát hành version KB mới?'
    };
    function openPreset(kind) {
      var list = KB.choosable(kind), cur = WS.working[kind] || released(kind), title = T('web.kbd.preset.title', 'Đổi preset {k}', { k: KIND[kind] });
      frame(pd, 'kb-preset', title,
        '<p class="muted text-sm">' + esc(T('web.kbd.preset.pickHint', 'Chọn preset và version. Thay đổi vào trạng thái hiện tại của tri thức; người đọc thấy ở version phát hành kế tiếp.')) + '</p>' +
        '<label class="kb-rel-lbl" for="kb-preset-pick">Preset</label><select class="input" id="kb-preset-pick" data-i18n-skip>' + list.map(function (p) {
          return '<option value="' + esc(p.id) + '"' + (p.id === cur.id ? ' selected' : '') + '>' + esc(p.name + ' · v' + p.versions[0].v) + '</option>';
        }).join('') + '</select>' +
        '<label class="kb-rel-lbl" for="kb-preset-ver">' + esc(T('web.kbd.preset.version', 'Version')) + '</label><select class="input" id="kb-preset-ver"></select>' +
        '<p class="muted text-sm" role="status" data-same hidden>' + esc(T('web.kbd.preset.unchanged', 'Tri thức đang dùng đúng preset và version này.')) + '</p>',
        '<button class="btn btn-secondary" type="button" data-x>' + esc(T('common.cancel', 'Hủy')) + '</button><button class="btn btn-primary" type="button" data-next>' + esc(T('kbc.next', 'Tiếp tục')) + '</button>');
      var ps = pd.querySelector('#kb-preset-pick'), vs = pd.querySelector('#kb-preset-ver'), nx = pd.querySelector('[data-next]');
      function chosen() { return list.filter(function (p) { return p.id === ps.value; })[0]; }
      function target() { var p = chosen(); return { id: p.id, name: p.name, version: vs.value ? +vs.value : p.versions[0].v }; }
      function upd() { var t = target(), same = t.id === cur.id && t.version === cur.version; pd.querySelector('[data-same]').hidden = !same; nx.disabled = same; }
      function fillVer() {
        var p = chosen();
        vs.innerHTML = '<option value="">' + esc(T('web.kbd.preset.latest', 'Mới nhất ({v})', { v: 'v' + p.versions[0].v })) + '</option>' +
          p.versions.map(function (v) { return '<option value="' + v.v + '" data-i18n-skip>' + esc('v' + v.v + (v.sum ? ' · ' + v.sum : '')) + '</option>'; }).join('');
        upd();
      }
      ps.addEventListener('change', fillVer); vs.addEventListener('change', upd); fillVer();
      nx.addEventListener('click', function () { confirmPreset(kind, title, cur, target()); });
      pd.showModal();
    }
    function confirmPreset(kind, title, from, to) {
      var q = (kind === 'ontology' ? 'askOnt' : 'askTax') + (direct() ? '' : 'Req');
      frame(pd, 'kb-preset', title, '<p class="kb-rel-preview" role="status">' + esc(T('web.kbd.preset.' + q, ASK[q], { n: fmt(N_DOCS) })) + '</p>' +
        '<p class="muted text-sm" data-i18n-skip>' + esc(pText(from) + ' → ' + pText(to)) + '</p>' + bumpsHtml('kb-preset-bump', false) + notesHtml('kb-preset-notes'),
        '<button class="btn btn-secondary" type="button" data-x>' + esc(T('web.kbd.preset.no', 'Không')) + '</button><button class="btn btn-primary" type="button" data-go>' + esc(T('web.kbd.preset.yes', 'Đồng ý')) + '</button>');
      var go = pd.querySelector('[data-go]');
      wireForm(pd, 'kb-preset-notes', function (long) { go.disabled = long; });
      go.addEventListener('click', function () {
        pd.close();
        WS.working[kind] = to; WS.presetRun = kind;
        WS.presets = WS.presets.filter(function (c) { return c.kind !== kind; }).concat([{ kind: kind, from: released(kind), to: to }]);
        KB.toast(T(kind === 'ontology' ? 'web.kbd.preset.startedOnt' : 'web.kbd.preset.startedTax', kind === 'ontology' ? 'Đã đổi preset; đang chạy lại enrichment cho {n} tài liệu' : 'Đã đổi preset; đang chạy lại gắn tag cho {n} tài liệu', { n: fmt(N_DOCS) }));
        renderAll();
      });
      pd.querySelector('#kb-preset-notes').focus();
    }

    function renderAll() {
      renderCard(); renderPresets(); syncVh();
      if (vhOpen()) window.ECPVH.open('kb-tddn', { opener: chip }); // the open history shows the new state
    }
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : e.target.parentNode;
      if (t.closest('[data-kb-compare]')) { if (window.ECPVH && CUR) window.ECPVH.open('kb-tddn', { a: ACT.v, b: CUR, opener: chip }); }
      else if (t.closest('[data-kb-release]')) openRelease();
      else { var p = t.closest('[data-kb-preset]'); if (p) openPreset(p.getAttribute('data-kb-preset')); }
    });
    renderAll();
    if (I) I.onChange(renderAll);
    document.addEventListener('ecp-rolechange', renderAll);
  });
})();
