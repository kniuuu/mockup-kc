/* Per-KB Transformation Job (transformation-job-kb.html, as kb-jobs-screen.tsx): the runs of one Knowledge Base in
 * Running | History tabs (opens on Running while a run is active); a run expands to its documents. Mock data: ECP_TJ. */
(function () {
  function boot() {
  var TJ = window.ECP_TJ, I = window.ECP_I18N; if (!TJ) return;
  var E = TJ.esc, T = TJ.T;
  var D = I && I.dict;
  var add = {
    'web.tj.kbNoJobs': ['Tri thức này chưa có lượt chạy nào.', 'This knowledge base has no runs yet.'],
    'web.tj.noneRunning': ['Không có lượt chạy nào đang thực hiện.', 'No run is in progress.'],
    'web.tj.noneFinished': ['Chưa có lượt chạy nào kết thúc.', 'No run has finished yet.']
  };
  if (D) Object.keys(add).forEach(function (k) { if (!D.vi[k]) { D.vi[k] = add[k][0]; D.en[k] = add[k][1]; } });
  var kb = new URLSearchParams(location.search).get('kb') || 'credit-corp';
  var jobs = TJ.JOBS.filter(function (j) { return j.kb === kb; });
  var name = jobs.length ? jobs[0].kbName : kb;
  var ACTIVE = ['running', 'queued'];
  var tabOf = function (j) { return ACTIVE.indexOf(j.status) >= 0 ? 'running' : 'history'; };
  var counts = { running: 0, history: 0 };
  jobs.forEach(function (j) { counts[tabOf(j)]++; });
  var tab = counts.running ? 'running' : 'history', open = null;
  var body = document.querySelector('[data-kbj-body]');
  document.querySelectorAll('[data-kb-name]').forEach(function (n) { n.textContent = name; });
  var h1 = document.querySelector('#main h1'); if (h1) h1.textContent = 'Transformation Job · ' + name;
  var up = document.querySelector('[data-kbj-upload]'); if (up) up.href = 'kb-upload.html?kb=' + encodeURIComponent(kb);
  document.title = name + ' · Transformation Job';

  function docs(j) {
    var rows = TJ.docs(j).slice(0, 100).map(function (d) {
      return '<tr class="kbj-doc"><td><span class="kbj-doc-name">' + TJ.fileIco(d.name) + ' <span class="job-ell" data-i18n-skip>' + E(d.name) + '</span></span></td>' +
        '<td class="muted text-sm">' + E(T(d.change === 'new' ? 'jd.change.new' : 'jd.change.modified', d.change === 'new' ? 'Mới' : 'Sửa')) + '</td>' +
        '<td class="job-st-cell">' + TJ.docProgressHtml(d) + TJ.docStatusHtml(d) + '</td></tr>';
    }).join('');
    return '<tr class="job-sub-docs"><td colspan="6"><table class="table"><caption class="sr-only">' + E(T('web.tj.runDocs', 'Tài liệu của lượt chạy')) + '</caption><tbody>' + rows + '</tbody></table></td></tr>';
  }
  function render() {
    ['running', 'history'].forEach(function (k) {
      var b = document.getElementById('kbj-tab-' + k);
      b.setAttribute('aria-selected', String(k === tab)); b.tabIndex = k === tab ? 0 : -1;
      var c = b.querySelector('.tab-count'); if (k === 'running' && !c) { c = document.createElement('span'); c.className = 'tab-count'; b.appendChild(c); }
      if (c) c.textContent = counts.running;
    });
    document.getElementById('kbj-panel').setAttribute('aria-labelledby', 'kbj-tab-' + tab);
    var list = jobs.filter(function (j) { return tabOf(j) === tab; });
    if (!list.length) {
      body.innerHTML = '<p class="muted text-sm" role="status" data-i18n="' + (!jobs.length ? 'web.tj.kbNoJobs' : tab === 'running' ? 'web.tj.noneRunning' : 'web.tj.noneFinished') + '"></p>';
      var k0 = !jobs.length ? 'web.tj.kbNoJobs' : tab === 'running' ? 'web.tj.noneRunning' : 'web.tj.noneFinished';
      body.firstChild.textContent = T(k0, add[k0][0]);
      return;
    }
    // as kb-jobs-screen.tsx: Runs (chevron + #code) / Run info / Status (ring + label) / Volume / Time; the actions column only while a run offers one
    var withAct = list.some(function (j) { return !j.preset && (ACTIVE.indexOf(j.status) >= 0 || j.status === 'failed' || j.status === 'partial'); });
    body.innerHTML = '<table class="table doc-table job-table"><caption data-i18n="tj.runs" class="sr-only">Lượt chạy</caption><colgroup><col><col class="kbj-c-info"><col class="jc-st"><col class="jc-files"><col class="kbj-c-time">' + (withAct ? '<col class="jc-act">' : '') + '</colgroup>' +
      '<thead><tr><th data-i18n="tj.runs" scope="col">Lượt chạy</th><th data-i18n="web.tj.runInfo" scope="col">Thông tin lượt chạy</th><th data-i18n="common.status" scope="col">Trạng thái</th><th data-i18n="web.tj.volume" scope="col">Khối lượng</th><th data-i18n="web.tj.time" scope="col">Thời gian</th>' + (withAct ? '<th scope="col"><span data-i18n="common.actions" class="sr-only">Hành động</span></th>' : '') + '</tr></thead><tbody>' +
      list.map(function (j) {
        var files = j.status === 'skipped' ? T('tj.n0Changes', '0 thay đổi') : j.total == null ? '–' : T('web.tj.filesOf', '{a} / {b} file', { a: TJ.fmtInt(j.ok + j.err), b: TJ.fmtInt(j.total) });
        var info = j.trigger[0] === 'tj.manualUpload' ? T('web.tj.uploadJob', 'Tải lên') : j.trigger[0] === 'tj.approvedEdit' ? T('web.tj.editJob', 'Chỉnh sửa') : T('web.tj.syncJob', 'Đồng bộ');
        var act = j.preset ? null : ACTIVE.indexOf(j.status) >= 0 ? ['cancel', T('common.cancel', 'Hủy'), 'M6 6l12 12M18 6L6 18'] : j.status === 'failed' || j.status === 'partial' ? ['rerun', T('tj.rerun', 'Chạy lại'), 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'] : null;
        var isOpen = open === j.id;
        return '<tr class="job-sub" data-run="' + E(j.id) + '" tabindex="0" aria-expanded="' + isOpen + '"><td class="job-kb"><button class="icon-btn kbj-toggle" type="button" aria-expanded="' + isOpen + '" aria-label="' + E(T('web.tj.runDocs', 'Tài liệu của lượt chạy #{code}', { code: j.id })) + '"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button><a class="mono bold link" href="' + E(TJ.detailHref(j)) + '">#' + E(j.id) + '</a></td>' +
          '<td class="job-ell" title="' + E(info) + '">' + E(info) + '</td><td class="job-st-cell"><div class="kbj-st">' + TJ.jobProgressHtml(j) + TJ.jobStatusHtml(j).replace(/<div class="text-xs muted job-ell job-note"[^>]*>.*?<\/div>/, '') + '</div></td>' +
          '<td class="nowrap text-sm">' + E(files) + '</td><td class="nowrap text-sm"><span title="' + E(T('web.tj.submittedAt', 'Thời điểm gửi')) + '">' + E(TJ.fmtClock(j)) + '</span><div class="muted text-xs" title="' + E(T('web.tj.processingTime', 'Thời gian xử lý')) + '">' + E(TJ.fmtDur(j.dur)) + '</div></td>' +
          (withAct ? '<td class="nowrap job-act">' + (act ? '<div class="kbj-acts"><button class="btn btn-sm btn-secondary" type="button" data-roles-disable="steward" data-reason="Cần vai trò Owner hoặc Admin" aria-label="' + E(act[1]) + '"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + act[2] + '"/></svg><span class="kbj-act-label">' + E(act[1]) + '</span></button></div>' : '') + '</td>' : '') + '</tr>' + (isOpen ? docs(j) : '');
      }).join('') + '</tbody></table>';
    if (I) I.apply(body);
  }
  document.querySelector('[role=tablist]').addEventListener('click', function (e) {
    var b = e.target.closest('[role=tab]'); if (!b) return;
    tab = b.id.replace('kbj-tab-', ''); open = null; render();
  });
  body.addEventListener('click', function (e) {
    var r = e.target.closest('tr.job-sub'); if (!r || e.target.closest('a,button:not(.kbj-toggle)')) return;
    var id = r.getAttribute('data-run'); open = open === id ? null : id; render();
  });
  body.addEventListener('keydown', function (e) {
    var r = e.target.closest && e.target.closest('tr.job-sub');
    if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); r.click(); }
  });
  if (I && I.onChange) I.onChange(render);
  render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
