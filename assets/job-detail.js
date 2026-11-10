/* ECP mockups: Job Detail (job-detail.html?job=<id>) — the documents of one Transformation Job run.
 * - Data: window.ECP_TJ (tj-data.js). Filters: All / In progress (waiting + processing) / Needs attention (error) / Finished.
 * - Row click selects the document and fills the right panel (metadata, short error summary, processing pipeline).
 *   There is no log: errors show as a short summary, never as raw log lines.
 * - Re-run (one document, or all failed documents) re-queues them in-session only.
 * - View state (filter, search, type, page, rows per page, selected document) is kept in the URL.
 * - Compilation section (as the app's job-detail-screen Compilations / CompilationRow): one item per knowledge package
 *   type of the KB with status, packages done / total / unchanged, and Re-run (not while running); hidden when the KB
 *   has no package type. Re-run restarts that type in-session (planning, then counted by the real service). */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var TJ = window.ECP_TJ, split = document.getElementById('jd-split');
    if (!TJ || !split) return;
    var I = window.ECP_I18N, T = TJ.T, esc = TJ.esc;
    var params = new URLSearchParams(location.search);
    var job = TJ.job(params.get('job') || '4826');
    var $ = function (id) { return document.getElementById(id); };
    var rowsBox = $('jd-rows'), emptyEl = $('jd-empty'), foot = $('jd-foot'), typeSel = $('jd-type'), qIn = $('jd-q'), sizeSel = $('jd-size');
    var bulk = $('jd-rerun-failed'), side = $('jd-side'), body = $('jd-d-body'), sideFoot = $('jd-d-foot');
    var GROUP = { waiting: 'progress', processing: 'progress', error: 'attention', done: 'finished' };

    if (!job) {
      $('jd-crumb').textContent = '#' + (params.get('job') || '');
      document.querySelector('.jd-main .art-head').hidden = true; $('jd-meta').hidden = true; foot.hidden = true; split.classList.add('side-closed');
      emptyEl.textContent = T('jd.notFound', 'Không tìm thấy job này.'); emptyEl.hidden = false;
      return;
    }
    var docs = TJ.docs(job);
    $('jd-crumb').textContent = '#' + job.id;
    $('jd-h1').textContent = 'Job #' + job.id + ' · ' + job.kbName;

    var S = {
      f: params.get('f') || 'all', q: params.get('q') || '', type: params.get('type') || '',
      page: parseInt(params.get('page'), 10) || 1, size: parseInt(params.get('size'), 10) || 25,
      doc: params.get('doc') || '', open: false
    };
    if (!docById(S.doc)) S.doc = docs.length ? docs[0].id : '';
    S.open = !!S.doc && (!!params.get('doc') || innerWidth >= 1440);
    if ([10, 25, 50].indexOf(S.size) === -1) S.size = 25;
    sizeSel.value = String(S.size); qIn.value = S.q;

    function docById(id) { return docs.filter(function (d) { return d.id === id; })[0] || null; }
    function syncUrl() {
      var u = new URLSearchParams(); u.set('job', job.id);
      if (S.f !== 'all') u.set('f', S.f);
      if (S.q) u.set('q', S.q);
      if (S.type) u.set('type', S.type);
      if (S.page > 1) u.set('page', String(S.page));
      if (S.size !== 25) u.set('size', String(S.size));
      if (S.open && S.doc) u.set('doc', S.doc);
      history.replaceState(null, '', location.pathname + '?' + u.toString() + location.hash);
    }
    function gates() { if (window.ECP_applyGates) window.ECP_applyGates(); }

    // file type options = the formats present in this job
    (function () {
      var seen = {};
      docs.forEach(function (d) {
        var ext = TJ.fileType(d.name); if (seen[ext]) return; seen[ext] = 1;
        var o = document.createElement('option'); o.value = ext; o.textContent = TJ.formatLabel(d.name); o.setAttribute('data-i18n-skip', ''); typeSel.appendChild(o);
      });
      if (!seen[S.type]) S.type = '';
      typeSel.value = S.type;
    })();

    function matches(d, ignoreGroup) {
      if (!ignoreGroup && S.f !== 'all' && GROUP[d.st] !== S.f) return false;
      if (S.type && TJ.fileType(d.name) !== S.type) return false;
      if (S.q) { var q = S.q.toLowerCase(); if (d.name.toLowerCase().indexOf(q) === -1 && d.id.toLowerCase().indexOf(q) === -1) return false; }
      return true;
    }

    function renderChips() {
      var n = { all: 0, progress: 0, attention: 0, finished: 0 };
      docs.forEach(function (d) { if (!matches(d, true)) return; n.all++; n[GROUP[d.st]]++; });
      document.querySelectorAll('[data-jd-status] [data-f]').forEach(function (b) {
        var k = b.getAttribute('data-f');
        b.setAttribute('aria-pressed', String(k === S.f));
        b.querySelector('[data-n]').textContent = TJ.fmtInt(n[k]);
      });
    }
    function renderBulk() {
      var n = docs.filter(function (d) { return d.st === 'error'; }).length;
      bulk.hidden = !n;
      bulk.textContent = T('jd.rerunFailed', 'Chạy lại {n} file lỗi', { n: TJ.fmtInt(n) });
      bulk.setAttribute('data-title', T('jd.rerunFailedTitle', 'Chạy lại {n} file lỗi trong #{id}?', { n: TJ.fmtInt(n), id: job.id }));
      bulk.setAttribute('data-ok', T('tj.rerun', 'Chạy lại'));
      bulk.setAttribute('data-body', T('jd.rerunFailedBody', 'Các file lỗi được xếp lại từ Acquisition. File đã hoàn tất không bị ảnh hưởng.'));
    }
    function pageList(cur, last) {
      if (last <= 7) { var a = []; for (var i = 1; i <= last; i++) a.push(i); return a; }
      var out = [1], from = Math.max(2, cur - 1), to = Math.min(last - 1, cur + 1);
      if (from > 2) out.push(0);
      for (var j = from; j <= to; j++) out.push(j);
      if (to < last - 1) out.push(0);
      out.push(last); return out;
    }
    function renderList() {
      var list = docs.filter(function (d) { return matches(d); });
      var pages = Math.max(1, Math.ceil(list.length / S.size));
      if (S.page > pages) S.page = pages;
      var from = (S.page - 1) * S.size, shown = list.slice(from, from + S.size);
      rowsBox.innerHTML = shown.map(function (d) {
        var sel = S.open && d.id === S.doc;
        return '<tr data-doc="' + esc(d.id) + '" tabindex="0"' + (sel ? ' class="selected" aria-current="true"' : '') + '>' +
          '<td><div class="jd-doc">' + TJ.fileIco(d.name) + '<div><div class="bold job-ell" title="' + esc(d.name) + '">' + esc(d.name) + '</div><div class="mono text-xs muted job-ell">' + esc(d.id) + '</div></div></div></td>' +
          '<td class="job-prog-cell">' + TJ.docProgressHtml(d) + '</td>' +
          '<td>' + TJ.docStatusHtml(d) + '</td>' +
          '<td class="jd-upd">' + esc(d.at ? TJ.fmtTime(job, d.at) : '–') + '</td>' +
          '<td class="jd-upd">' + esc(d.st === 'waiting' ? '–' : TJ.fmtDur(d.st === 'processing' ? 40 : 20 + (d.name.length % 5) * 12)) + '</td></tr>';
      }).join('');
      // empty states: nothing acquired yet / nothing changed / filters match nothing
      var none = !docs.length;
      emptyEl.hidden = !!list.length;
      emptyEl.textContent = none
        ? (job.status === 'queued' ? T('jd.emptyQueued', 'Job chưa bắt đầu. Danh sách tài liệu hiện sau bước Acquisition.')
          : job.status === 'skipped' ? T('jd.emptySkipped', 'Không có tài liệu thay đổi trong lượt chạy này.')
          : T('jd.emptyNone', 'Job này không có tài liệu.'))
        : T('jd.noMatch', 'Không có tài liệu khớp bộ lọc');
      foot.hidden = none;
      $('jd-range').textContent = T('jd.rangeOf', 'Hiển thị {a}–{b} / {n} tài liệu', { a: TJ.fmtInt(list.length ? from + 1 : 0), b: TJ.fmtInt(from + shown.length), n: TJ.fmtInt(list.length) });
      var box = $('jd-pages'); box.textContent = '';
      pageList(S.page, pages).forEach(function (p) {
        if (!p) { var s = document.createElement('span'); s.className = 'muted'; s.setAttribute('aria-hidden', 'true'); s.textContent = '…'; box.appendChild(s); return; }
        var b = document.createElement('button'); b.type = 'button'; b.textContent = TJ.fmtInt(p);
        b.setAttribute('aria-label', T('ek.pageN', 'Trang {n}', { n: p }));
        if (p === S.page) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', function () { S.page = p; render(); var c = box.querySelector('[aria-current]'); if (c) c.focus(); });
        box.appendChild(b);
      });
      $('jd-prev').disabled = S.page <= 1; $('jd-next').disabled = S.page >= pages;
    }

    // ---------- selected document panel ----------
    function note(text, err) { return text ? '<div class="text-xs ' + (err ? 'jstep-note-err' : 'muted') + '">' + esc(text) + '</div>' : ''; }
    function stepLi(cls, sub, key, label, notes) {
      var glyph = cls === 'is-done' ? '✓' : cls === 'is-running' ? '●' : cls === 'is-failed' ? '!' : '';
      return '<li class="jstep' + (sub ? ' jstep-sub' : '') + ' ' + cls + '"><span class="jstep-dot" aria-hidden="true">' + glyph + '</span><div><div class="jstep-t">' + esc(T(key, label)) +
        '<span class="sr-only"> · ' + esc(T('jd.stepState.' + cls, { 'is-done': 'Hoàn tất', 'is-running': 'Đang chạy', 'is-failed': 'Lỗi', 'is-pending': 'Chưa chạy' }[cls])) + '</span></div>' + notes + '</div></li>';
    }
    function pipelineHtml(d) {
      var info = d.info || {}, html = '';
      TJ.STAGES.forEach(function (s, i) {
        var cls = d.st === 'done' ? 'is-done' : d.st === 'waiting' ? 'is-pending'
          : i < d.stage ? 'is-done' : i > d.stage ? 'is-pending' : d.st === 'error' ? 'is-failed' : 'is-running';
        var n = '';
        if (s.k === 'acquisition') {
          if (d.st === 'waiting') n = note(T('tj.notStarted', 'Chưa bắt đầu'));
          else if (cls === 'is-done' && info.acq) n = note(T('jd.n.downloaded', 'Đã tải · checksum mới · {t}', { t: TJ.fmtTime(job, info.acq) }));
        }
        if (s.k === 'processing' && cls === 'is-done' && info.pages != null) n = note(T('jd.n.pages', '{p} trang · OCR {o} trang', { p: TJ.fmtInt(info.pages), o: TJ.fmtInt(info.ocr || 0) }));
        if (cls === 'is-failed') n = note(TJ.docErr(d), true);
        html += stepLi(cls, false, s.key, s.label, n);
        (s.subs || []).forEach(function (sb, j) {
          var c2 = cls === 'is-running' ? (j < d.sub ? 'is-done' : j === d.sub ? 'is-running' : 'is-pending') : cls === 'is-done' ? 'is-done' : 'is-pending';
          var n2 = '';
          if (sb[0] === 'chunking' && c2 !== 'is-pending' && info.chunks != null) n2 = note(T('jd.n.chunks', '{n} chunk', { n: TJ.fmtInt(info.chunks) }));
          if (sb[0] === 'embedding' && c2 !== 'is-pending' && info.vectors != null) n2 = note(T('jd.n.vectors', '{a} / {b} vector', { a: TJ.fmtInt(info.vectors), b: TJ.fmtInt(info.chunks) }));
          html += stepLi(c2, true, sb[1], sb[2], n2);
        });
      });
      return '<ol class="jsteps jd-pipe">' + html + '</ol>';
    }
    function renderPanel() {
      var d = docById(S.doc);
      split.classList.toggle('side-closed', !(S.open && d));
      if (!d) return;
      $('jd-d-name').textContent = d.name; $('jd-d-id').textContent = d.id;
      var st = TJ.DOC_ST[d.st], stLabel = T(st[0], st[1]) + (d.st === 'processing' && d.pct != null ? ' · ' + d.pct + '%' : '');
      var fmt = TJ.formatLabel(d.name), type = d.docType ? d.docType + ' · ' + fmt : fmt;
      var change = d.change === 'new' ? '<span class="jd-change-new">' + esc(T('jd.change.new', 'Mới')) + '</span>' : esc(T('jd.change.modified', 'Đã sửa'));
      var err = TJ.docErr(d), stage = d.st === 'error' ? TJ.STAGES[d.stage] : null;
      body.innerHTML = '<dl class="kv">' +
        '<dt>' + esc(T('jd.size', 'Kích thước')) + '</dt><dd>' + esc(TJ.fmtSize(d.mb)) + '</dd>' +
        '<dt>' + esc(T('qap.dChange', 'Thay đổi')) + '</dt><dd>' + change + '</dd>' +
        '<dt>' + esc(T('web.tj.checksum', 'Mã kiểm tra (SHA-256)')) + '</dt><dd class="mono jd-checksum text-xs">' + esc(sum(d.id)) + '</dd></dl>' +
        (err ? '<p class="jd-errsum" role="note"><b>' + esc(T(stage.key, stage.label)) + ':</b> ' + esc(err) + '</p>' : '') +
        '<h3 class="sub-h jd-pipe-h">' + esc(T('jd.pipeline', 'Pipeline xử lý')) + '</h3>' + pipelineHtml(d);
      sideFoot.innerHTML = (d.st === 'error' ? '<button class="btn btn-secondary" type="button" data-jd-rerun data-roles-disable="steward" data-reason="Cần vai trò Owner hoặc Admin">' + esc(T('tj.rerun', 'Chạy lại')) + '</button>' : '') +
        '<a class="btn btn-secondary" href="' + esc(TJ.kbHref(job)) + '">' + esc(T('tj.openKb', 'Mở tri thức')) + '</a>';
    }
    // compact job + KB context row: job ID, trigger, KB, source (name, path as secondary + tooltip), start date
    function sum(id) { var h = '', n = 0, i; for (i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0; for (i = 0; i < 8; i++) { n = (n * 1103515245 + 12345) >>> 0; h += ('00000000' + n.toString(16)).slice(-8); } return h; } // mock SHA-256
    function renderMeta() {
      function item(label, value, sub, title) {
        return '<div class="jd-meta-item"><dt>' + esc(label) + '</dt><dd class="job-ell" title="' + esc(title || value) + '">' + esc(value) +
          (sub ? '</dd><dd class="jd-meta-sub mono job-ell" title="' + esc(sub) + '">' + esc(sub) : '') + '</dd></div>';
      }
      $('jd-meta').innerHTML =
        item(T('jd.jobId', 'Job ID'), '#' + job.id) +
        item(T('jd.trigger', 'Kích hoạt'), T(job.trigger[0], job.trigger[1])) +
        '<div class="jd-meta-item"><dt>' + esc(T('jd.kb', 'Tri thức')) + '</dt><dd class="job-ell"><a class="link" href="' + esc(TJ.kbHref(job)) + '" title="' + esc(job.kbName) + '">' + esc(job.kbName) + '</a></dd></div>' +
        item(T('jd.started', 'Bắt đầu'), TJ.fmtStart(job));
    }
    // ---------- compilation of the KB's knowledge packages ----------
    // package type labels: glossary terms, not translated (app job-bits PKG_LABEL)
    var PKG = { GENERAL_WIKI: 'Wiki', PRODUCT_WIKI: 'Product Wiki', PLAYBOOK: 'Playbook', SOP: 'SOP', TROUBLESHOOTING: 'Troubleshooting', CONCEPT_GLOSSARY: 'Glossary' };
    function pkg(type) { return PKG[type] || type; }
    // status -> [label key, vi, tone, glyph] (app COMPILE_STATUS)
    var COMP_ST = {
      notStarted: ['jd.comp.notStarted', 'Chưa biên dịch', 'neutral', 'dash'],
      running: ['common.running', 'Đang chạy', 'info', null],
      done: ['common.completed', 'Hoàn tất', 'success', 'check'],
      failed: ['common.errors', 'Lỗi', 'error', 'alert'],
      cancelled: ['tj.st.cancelled', 'Đã hủy', 'neutral', 'dash']
    };
    function compRow(c) {
      var s = COMP_ST[c.st], label = T(s[0], s[1]), counted = c.total != null && c.done != null;
      var pct = c.st === 'running' ? (counted ? Math.round(c.done / Math.max(1, c.total) * 100) : 0) : null;
      var note = c.st === 'failed' ? (c.error || '')
        : c.st === 'running' && !counted ? T('jd.comp.planning', 'Đang lập kế hoạch gói…')
        : counted ? [T('jd.comp.packages', '{done}/{total} gói', { done: TJ.fmtInt(c.done), total: TJ.fmtInt(c.total) }), c.kept ? T('jd.comp.kept', '{n} gói giữ nguyên', { n: TJ.fmtInt(c.kept) }) : ''].filter(Boolean).join(' · ')
        : '';
      var aria = pct != null && !s[3] ? label + ' ' + pct + '%' : label;
      return '<li class="jd-comp-item"><div class="job-st job-prog tone-' + s[2] + '">' + TJ.ringHtml(s[2], pct, s[3], aria) + '</div>' +
        '<div class="jd-comp-text"><div class="bold job-ell">' + esc(pkg(c.type)) + '</div>' + TJ.statusHtml(s[2], '', s[0], s[1], note) + '</div>' +
        (c.st !== 'running' ? '<button class="btn btn-sm btn-secondary" type="button" data-jd-comp="' + esc(c.type) + '" data-roles-disable="steward" data-reason="Cần vai trò Owner hoặc Admin">' + esc(T('tj.rerun', 'Chạy lại')) + '</button>' : '') + '</li>';
    }
    function renderComps() {
      return; // web: no per-package section on Job Detail; Compilation is a pipeline step of each document
      var list = TJ.comps(job), box = $('jd-comp');
      box.hidden = !list.length;
      box.innerHTML = list.length ? '<h3 id="jd-comp-h" class="jd-comp-h">' + esc(T('jd.comp.title', 'Biên dịch · gói tri thức')) + '</h3><ul class="jd-comp-list">' + list.map(compRow).join('') + '</ul>' : '';
    }
    function render() { renderMeta(); renderComps(); renderChips(); renderBulk(); renderList(); renderPanel(); gates(); syncUrl(); }

    // ---------- events ----------
    document.querySelector('[data-jd-status]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]'); if (!b) return;
      S.f = b.getAttribute('data-f'); S.page = 1; render();
    });
    qIn.addEventListener('input', function () { S.q = qIn.value.trim(); S.page = 1; render(); });
    var hq = $('qs'); if (hq) { hq.value = S.q; hq.addEventListener('input', function () { qIn.value = hq.value; qIn.dispatchEvent(new Event('input')); }); }
    typeSel.addEventListener('change', function () { S.type = typeSel.value; S.page = 1; render(); });
    sizeSel.addEventListener('change', function () { S.size = parseInt(sizeSel.value, 10) || 25; S.page = 1; render(); });
    $('jd-prev').addEventListener('click', function () { if (S.page > 1) { S.page--; render(); } });
    $('jd-next').addEventListener('click', function () { S.page++; render(); });
    function select(tr) {
      S.doc = tr.getAttribute('data-doc'); S.open = true; render();
      var again = rowsBox.querySelector('tr[data-doc="' + S.doc + '"]'); if (again) again.focus();
    }
    rowsBox.addEventListener('click', function (e) {
      if (e.target.closest('button, a')) return;
      var tr = e.target.closest('tr[data-doc]'); if (tr) select(tr);
    });
    rowsBox.addEventListener('keydown', function (e) {
      var tr = e.target.closest('tr[data-doc]');
      if (tr && e.target === tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(tr); }
    });
    function closePanel() {
      var id = S.doc; S.open = false; render();
      var tr = rowsBox.querySelector('tr[data-doc="' + id + '"]'); if (tr) tr.focus();
    }
    $('jd-close').addEventListener('click', closePanel);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.open && innerWidth < 1440 && !document.querySelector('dialog[open]')) closePanel(); });

    // re-run: one document (panel foot, no confirm, like the job Re-run) or all failed documents (confirmed)
    function requeue(d) { d.st = 'waiting'; d.pct = 0; d.stage = 0; d.sub = undefined; d.err = null; d.at = null; d.info = {}; }
    function toast(m) { if (window.ECP_toast) window.ECP_toast(m); }
    sideFoot.addEventListener('click', function (e) {
      var b = e.target.closest('[data-jd-rerun]'); if (!b || b.disabled) return;
      var d = docById(S.doc); if (!d) return;
      requeue(d); render();
      toast(T('jd.toastRerunDoc', 'Đã xếp lại {id}', { id: d.id }));
    });
    // compilation Re-run: no confirm (as the app); the type starts again, planning its packages
    if ($('jd-comp')) $('jd-comp').addEventListener('click', function (e) {
      var b = e.target.closest('[data-jd-comp]'); if (!b || b.disabled) return;
      var c = TJ.comps(job).filter(function (x) { return x.type === b.getAttribute('data-jd-comp'); })[0]; if (!c) return;
      c.st = 'running'; c.total = c.done = c.kept = null; c.error = null; render();
      toast(T('jd.comp.toastRerun', 'Đang biên dịch lại {type}', { type: pkg(c.type) }));
    });
    document.addEventListener('ecp-qapply', function (e) {
      if (!e.detail || e.detail.btn !== bulk) return;
      var failed = docs.filter(function (d) { return d.st === 'error'; });
      failed.forEach(requeue); render();
      toast(T('jd.toastRerunFailed', 'Đã xếp lại {n} file lỗi', { n: TJ.fmtInt(failed.length) }));
    });

    render();
    if (I && I.onChange) I.onChange(render);
  });
})();
