/* PII reveal: port of micro-frontend/web src/components/pii (PiiToggle, PiiRevealDialog, PiiNotice) + lib/use-pii-reveal.ts.
 * One reveal state per page. The server returns labels (piiMode=LABEL: "Tên người 1") as plain text; Reveal asks
 * for a purpose + confirmation, then the granted values show in clear (REVEAL) until Hide, 60 s or leaving the page.
 * Markup:
 *   button[data-pii-toggle]      Reveal / Hide (every one on the page mirrors the same state; [data-pii-locked] = disabled)
 *   [data-pii-notice]            empty host for the info banner (while revealed, and after the 60 s auto-hide)
 *   span[data-pii-v="value"]     text is the label; the real value is the attribute
 * ?pii=nogrant: the viewer has no PII grant, the toggle is disabled with a tooltip.
 * Enterprise Search pages: no ?pii = no restricted KB, so no toggle (see the guard below). */
(function () {
  var MS = 60000;
  function tr(k, vi) { return window.ECP_I18N ? window.ECP_I18N.tr(k, vi) : vi; }
  document.addEventListener('DOMContentLoaded', function () {
    var btns = [].slice.call(document.querySelectorAll('[data-pii-toggle]'));
    if (!btns.length) return;
    var mode = new URLSearchParams(location.search).get('pii');
    var noGrant = mode === 'nogrant';
    var spans = [].slice.call(document.querySelectorAll('[data-pii-v]'));
    var notices = [].slice.call(document.querySelectorAll('[data-pii-notice]'));
    var on = false, autoHidden = false, timer = null, opener = null;
    // Enterprise Search (FE PiiKbsToggle): the control exists only if a result / answer KB is PII-restricted. Default =
    // no restricted KB: no toggle, no notice, plain values. ?pii=restricted | nogrant | revealed | autohidden | dialog.
    if ((document.querySelector('.es-layout') || document.querySelector('.viewer-doc[data-doc-format]')) && !mode) { // Document workspace (FE: access.piiRestricted) too
      btns.forEach(function (b) { b.remove(); });
      spans.forEach(function (s) { s.textContent = s.getAttribute('data-pii-v'); });
      return;
    }

    notices.forEach(function (n) {
      n.className = 'banner banner-info';
      n.setAttribute('role', 'status');
      n.hidden = true;
      n.innerHTML = '<span class="icon" aria-hidden="true">i</span>' +
        '<span data-i18n="piiv.revealedNote" data-pii-note="on">Đang hiển thị giá trị thật, tự ẩn sau 60 giây.</span>' +
        '<span data-i18n="piiv.autoHidden" data-pii-note="auto" hidden>Giá trị thật đã được ẩn sau 60 giây.</span>';
    });
    spans.forEach(function (s) { s.__lbl = s.textContent; });

    var dlg = document.createElement('dialog');
    dlg.className = 'q-dlg pii-dlg';
    dlg.setAttribute('aria-labelledby', 'pii-dlg-t');
    dlg.innerHTML =
      '<div class="q-dlg-head"><h2 class="modal-title job-ell" id="pii-dlg-t" data-i18n="piiv.revealTitle">Xem giá trị thật</h2>' +
      '<button class="icon-btn" type="button" data-pii-cancel data-i18n-attr="aria-label:common.cancel" aria-label="Hủy"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="q-dlg-body pii-form">' +
      '<fieldset class="field pii-fs"><legend class="field-label bold" data-i18n="piiv.purposeLegend">Mục đích sử dụng</legend>' +
      '<label class="row"><input type="radio" name="pii-purpose" value="customer-service"> <span data-i18n="piiv.pCustomerService">Hỗ trợ khách hàng</span></label> ' +
      '<label class="row"><input type="radio" name="pii-purpose" value="audit"> <span data-i18n="piiv.pAudit">Kiểm tra, kiểm toán</span></label> ' +
      '<label class="row"><input type="radio" name="pii-purpose" value="investigation"> <span data-i18n="piiv.pInvestigation">Điều tra khiếu nại</span></label>' +
      '</fieldset>' +
      '<label class="row"><input type="checkbox" data-pii-sure> <span data-i18n="piiv.revealConfirm">Tôi xác nhận chỉ dùng cho mục đích trên</span></label>' +
      '<div class="banner banner-info" role="note"><span class="icon" aria-hidden="true">i</span><span data-i18n="piiv.revealLogged">Lượt xem được ghi nhật ký kèm mục đích. Giá trị thật tự ẩn sau 60 giây.</span></div>' +
      '</div>' +
      '<div class="q-dlg-foot"><button class="btn btn-ghost" type="button" data-pii-cancel data-i18n="common.cancel">Hủy</button>' +
      '<button class="btn btn-primary" type="button" data-pii-go disabled data-i18n="piiv.revealGo">Xem giá trị thật</button></div>';
    document.body.appendChild(dlg);
    var go = dlg.querySelector('[data-pii-go]'), sure = dlg.querySelector('[data-pii-sure]');
    function purpose() { var r = dlg.querySelector('input[name="pii-purpose"]:checked'); return r && r.value; }
    function sync() { go.disabled = !purpose() || !sure.checked; }
    dlg.addEventListener('change', sync);
    // the page's own Esc / Tab handlers (overlay close, drawer focus trap) must not see the dialog's keys
    dlg.addEventListener('keydown', function (e) { e.stopPropagation(); });
    dlg.addEventListener('close', function () { if (opener) opener.focus(); });
    dlg.querySelectorAll('[data-pii-cancel]').forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    go.addEventListener('click', function () { if (!purpose() || !sure.checked) return; dlg.close(); set(true); });

    function render() {
      spans.forEach(function (s) { s.textContent = on ? s.getAttribute('data-pii-v') : s.__lbl; });
      btns.forEach(function (b) {
        var locked = b.hasAttribute('data-pii-locked') && !on;
        b.disabled = noGrant || locked;
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('title', noGrant ? tr('piiv.noGrant', 'Bạn chưa được cấp quyền xem giá trị thật') : tr('piiv.toggleHint', 'Hiện hoặc ẩn giá trị PII thật (cần quyền xem PII)'));
        var t = b.querySelector('[data-pii-t]'); if (t) t.textContent = on ? tr('piiv.hide', 'Hide') : tr('piiv.reveal', 'Reveal');
      });
      notices.forEach(function (n) {
        n.hidden = !on && !autoHidden;
        n.querySelector('[data-pii-note="on"]').hidden = !on;
        n.querySelector('[data-pii-note="auto"]').hidden = on;
      });
    }
    function set(next, auto) {
      clearTimeout(timer);
      on = next; autoHidden = !!auto;
      if (on) timer = setTimeout(function () { set(false, true); }, MS);
      render();
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (on) { set(false); return; }
        opener = b;
        dlg.querySelectorAll('input').forEach(function (i) { i.checked = false; });
        sync();
        dlg.showModal();
      });
    });
    if (window.ECP_I18N) window.ECP_I18N.onChange(render);
    render();
    if (mode === 'revealed') set(true);
    else if (mode === 'autohidden') set(false, true);
    else if (mode === 'dialog') btns[0].click();
  });
})();
