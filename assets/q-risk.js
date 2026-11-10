/* Review Workspace · risk-tier gate.
   High-risk items (data-ws-tier="high" on the current queue item) need every change ticked as reviewed
   and a comment before Duyệt / Duyệt kèm sửa can open the confirm dialog. Other tiers: no gate. */
(function () {
  var I = window.ECP_I18N;
  function T(k, vi, a) { return I ? I.tr(k, vi, a) : vi.replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); }

  document.addEventListener('DOMContentLoaded', function () {
    var list = document.querySelector('[data-risk-checks]');
    if (!list) return;
    var cur = document.querySelector('.q-ws-item.is-current'), high = !!cur && cur.getAttribute('data-ws-tier') === 'high';
    var checks = [].slice.call(list.querySelectorAll('input[type="checkbox"]'));
    var cm = document.getElementById('q-comment'), cmLbl = document.querySelector('label[for="q-comment"]');
    var gate = document.getElementById('q-gate');
    var btns = [].slice.call(document.querySelectorAll('.q-acts [data-approve]'));

    document.querySelectorAll('[data-risk-only]').forEach(function (el) { el.hidden = !high; });
    if (!high) return;

    if (cmLbl) { cmLbl.removeAttribute('data-i18n'); cmLbl.textContent = T('qrk.cmReq', 'Nhận xét (bắt buộc: rủi ro cao)'); }
    if (cm) cm.setAttribute('aria-required', 'true');
    // the shared confirm dialog enforces the comment too (pre-filled from #q-comment)
    btns.forEach(function (b) { b.setAttribute('data-need-reason', ''); b.setAttribute('aria-describedby', 'q-gate'); });

    function sync() {
      var n = checks.filter(function (c) { return c.checked; }).length, t = checks.length;
      var needCm = !cm || !cm.value.trim(), ok = n === t && !needCm;
      var parts = [T('qrk.gateHigh', 'Rủi ro cao'), T('qrk.gateN', 'Đã xem xét {n}/{t} thay đổi', { n: n, t: t })];
      parts.push(ok ? T('qrk.gateReady', 'Đủ điều kiện duyệt') : (needCm ? T('qrk.gateCm', 'Cần nhận xét') : ''));
      gate.textContent = parts.filter(Boolean).join(' · ');
      gate.classList.toggle('is-ready', ok);
      btns.forEach(function (b) {
        if (b.disabled || b.hasAttribute('data-locked')) return; // role gate / already decided wins
        if (ok) { b.removeAttribute('aria-disabled'); b.classList.remove('is-disabled'); if (b.getAttribute('title') === b.__qrkTitle) b.removeAttribute('title'); }
        else { b.setAttribute('aria-disabled', 'true'); b.classList.add('is-disabled'); b.__qrkTitle = T('qrk.blocked', 'Đánh dấu đã xem xét mọi thay đổi và nhập nhận xét trước khi duyệt'); b.setAttribute('title', b.__qrkTitle); }
      });
      checks.forEach(function (c) { c.closest('.q-chk-i').classList.toggle('is-done', c.checked); });
    }
    list.addEventListener('change', sync);
    if (cm) cm.addEventListener('input', sync);
    if (I && I.onChange) I.onChange(function () { if (cmLbl) cmLbl.textContent = T('qrk.cmReq', 'Nhận xét (bắt buộc: rủi ro cao)'); sync(); });
    sync();
  });
})();
