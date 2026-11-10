/* ECP mockups: change request detail (quality-change-request.html), as micro-frontend/web change-request-detail.tsx.
 * ?state=draft|pending|approved|migrating|rejected|withdrawn|forbidden|notfound|loading|error picks the sample state (default
 * pending); ?mig=none hides the Migration chip, tab and action (preset requests); screens.js shows [data-cr-show] for it. ?preset=custom|global|none picks the preset of the sample (ADR-007; default
 * custom): the preset chip and the reviewer hint follow it, and only an Admin decides a Global preset request. Actions follow allowedActions, which the governance service returns;
 * here they are derived from the user-menu role: maker = Steward (or Admin), checker = Owner (or Admin).
 * Every visible string goes through i18n (q.*, qcr.*, common.*); sample content is data. */
(function () {
  var I = window.ECP_I18N, root = document.documentElement;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function T(k, a) { return I ? I.tr(k, I.dict.vi[k] !== undefined ? I.dict.vi[k] : k, a) : k; }
  function toast(m) { if (window.ECP_toast) window.ECP_toast(m); }
  var STATES = ['draft', 'pending', 'approved', 'migrating', 'rejected', 'withdrawn', 'forbidden', 'notfound', 'loading', 'error'];
  var ID = 'CR-031', st = new URLSearchParams(location.search).get('state');
  if (STATES.indexOf(st) === -1) st = 'pending';
  var preset = new URLSearchParams(location.search).get('preset');
  if (['custom', 'global', 'none'].indexOf(preset) === -1) preset = 'custom';
  var CHANGES = [
    { op: 'ADD', itemType: 'ENTITY_TYPE', label: 'Collateral', after: { props: ['loại tài sản', 'giá trị định giá', 'ngày định giá'] } },
    { op: 'ADD', itemType: 'RELATIONSHIP_TYPE', label: 'bảo đảm cho', after: { from: 'Collateral', to: 'Product', cardinality: '1..n' } },
    { op: 'UPDATE', itemType: 'ENTITY_TYPE', label: 'Product', detail: 'property hạn mức: thêm đơn vị VND (bắt buộc khi trích xuất)', before: { props: ['tên', 'mã', 'hạn mức'] }, after: { props: ['tên', 'mã', 'hạn mức (đơn vị: VND)'] } },
    { op: 'DEPRECATE', itemType: 'RELATIONSHIP_TYPE', label: 'thế chấp', detail: 'Giữ làm alias của “bảo đảm cho”; graph cũ được re-label khi migration', before: { from: 'Customer', to: 'Product' }, after: { deprecated: true, alias_of: 'bảo đảm cho' } }
  ];

  // allowedActions of the sample CR for the current role (the service rechecks every command)
  function allowed() {
    var r = root.getAttribute('data-role') || 'owner', maker = r === 'steward' || r === 'admin', checker = r === 'admin' || (r === 'owner' && preset !== 'global');
    return {
      draft: maker ? ['EDIT'] : [],
      pending: (checker ? ['APPROVE', 'REJECT'] : []).concat(r === 'steward' ? ['WITHDRAW'] : []),
      approved: maker ? ['MIGRATE'] : [],
      migrating: maker ? ['ROLLBACK'] : []
    }[st] || [];
  }
  var mode = null; // null | 'edit' | 'reject'
  function render() {
    // CONSUMER gets 403 on getChangeRequest
    var shown = (root.getAttribute('data-role') || 'owner') === 'consumer' && STATES.indexOf(st) < 6 ? 'forbidden' : st;
    root.setAttribute('data-cr-state', shown);
    var chip = $('[data-cr-preset]');
    chip.hidden = preset === 'none';
    chip.className = 'chip chip-' + (preset === 'global' ? 'global' : 'local');
    chip.textContent = preset === 'global' ? T('web.ch.preset', { x: 'Global', k: 'Global' }) : T('web.ch.preset', { x: 'Tín dụng doanh nghiệp E2E', k: 'Custom' });
    $('[data-cr-hint]').textContent = T(preset === 'global' ? 'qrk.crGlobalReviewer' : preset === 'custom' ? 'qrk.crPresetReviewer' : 'qrk.crOneReviewer');
    $$('[data-cr-show]').forEach(function (el) { el.hidden = (' ' + el.getAttribute('data-cr-show') + ' ').indexOf(' ' + shown + ' ') === -1; });
    // ?mig=none (preset request, no migration steps: applied in the approval itself): no Migration chip, tab or action
    var noMig = new URLSearchParams(location.search).get('mig') === 'none';
    if (noMig) $$('[data-cr-mig]').forEach(function (el) { el.hidden = true; });
    var can = allowed();
    $$('[data-act]').forEach(function (b) {
      var a = b.getAttribute('data-act');
      b.hidden = can.indexOf(a) === -1 || (noMig && a === 'MIGRATE') || (a === 'EDIT' && mode === 'edit') || (a === 'REJECT' && mode === 'reject');
    });
    if (mode === 'edit' && can.indexOf('EDIT') === -1) mode = null;
    if (mode === 'reject' && can.indexOf('REJECT') === -1) mode = null;
    $('#cr-edit').hidden = mode !== 'edit';
    $('#cr-reject').hidden = mode !== 'reject';
    $('#cr-self').hidden = !(st === 'pending' && can.indexOf('APPROVE') === -1 && can.indexOf('WITHDRAW') !== -1);
    $('#cr-none').hidden = can.length > 0;
    var lang = I && I.lang === 'en' ? 'en-GB' : 'vi-VN';
    $$('time[datetime]').forEach(function (t) {
      t.textContent = new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(t.getAttribute('datetime')));
    });
  }
  function confirmDlg(title, body, danger, okLabel, onOk) {
    var d = $('#cr-confirm'), ok = $('#cr-confirm-ok');
    $('#cr-confirm-t').textContent = title;
    $('#cr-confirm-b').textContent = body;
    ok.textContent = okLabel; // the confirm button repeats the action's own label, as the web app
    ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    d.returnValue = '';
    d.onclose = function () { if (d.returnValue === 'ok') onOk(); };
    d.showModal();
  }
  function go(next, msg) { if (next) st = next; mode = null; render(); toast(msg); }
  var scope = function () { return T('qcr.globalLayer') + ' + Quy trình tín dụng doanh nghiệp'; };

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (b) {
      var a = b.getAttribute('data-act');
      if (a === 'EDIT') {
        mode = 'edit';
        $('#cr-edit-s').value = $('[data-cr-summary]').textContent;
        $('#cr-edit-c').value = JSON.stringify(CHANGES, null, 2);
        $('#cr-edit-err').hidden = true;
        render(); $('#cr-edit-s').focus();
      } else if (a === 'REJECT') { mode = 'reject'; render(); $('#cr-reject-r').focus(); }
      else if (a === 'APPROVE') confirmDlg(T('q.approveId', { id: ID }), T('qcr.approveBody'), false, T('q.approve'), function () { go('approved', T('q.approvedIdApplying', { id: ID })); });
      else if (a === 'WITHDRAW') confirmDlg(T('q.withdrawId', { id: ID }), T('qcr.withdrawBody'), true, T('q.withdraw'), function () { go('withdrawn', T('qcr.withdrawn', { id: ID })); });
      else if (a === 'MIGRATE') confirmDlg(T('q.runMigration') + ' ' + ID + '?', T('qcr.migrateBody', { x: scope() }), false, T('q.runMigration'), function () { go('migrating', T('qcr.migrationStarted', { id: ID })); });
      else if (a === 'ROLLBACK') confirmDlg('Rollback ' + ID + '?', T('qcr.rollbackBody', { v: 'v4' }), true, 'Rollback', function () { go(null, T('qcr.rollbackStarted', { id: ID })); });
      return;
    }
    if (e.target.closest('[data-retry]')) { st = 'pending'; render(); return; }   // Retry refetches; the sample loads as pending
    if (e.target.closest('[data-cancel]')) { mode = null; render(); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'cr-reject-r') $('#cr-reject [type="submit"]').disabled = !e.target.value.trim();
  });
  $('#cr-reject').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('#cr-reject-r').value.trim(); if (!v) return;
    $('[data-cr-reason]').textContent = v;
    $('[data-cr-reason-note]').textContent = ' · ' + v;
    go('rejected', T('q.rejectedId', { id: ID }));
  });
  $('#cr-edit').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#cr-edit-err'), s = $('#cr-edit-s').value.trim(), c = $('#cr-edit-c'), parsed = null;
    c.removeAttribute('aria-invalid'); c.removeAttribute('aria-describedby');
    err.hidden = true;
    // as the web app: any error marks the changes field (not the summary) and focus stays put
    function fail(k) { err.textContent = T(k); err.hidden = false; c.setAttribute('aria-invalid', 'true'); c.setAttribute('aria-describedby', 'cr-edit-err'); }
    if (!s) return fail('qcr.editSummaryRequired');
    // nothing changed: close the form without a request, as the web app (merge patch of changed fields only)
    if (s === $('[data-cr-summary]').textContent && c.value === JSON.stringify(CHANGES, null, 2)) { mode = null; render(); return; }
    try { parsed = JSON.parse(c.value); } catch (x) { parsed = null; }
    if (!Array.isArray(parsed) || !parsed.length) return fail('qcr.editChangesInvalid');
    CHANGES = parsed;
    $('[data-cr-summary]').textContent = s;
    go(null, T('qcr.edited', { id: ID }));
  });
  document.addEventListener('ecp-rolechange', render);
  if (I) I.onChange(render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
