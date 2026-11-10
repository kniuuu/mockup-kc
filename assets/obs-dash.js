/* Observation & Analytic dashboards (body.obs-flat pages only).
 * 1) KPI tiles: the definition that used to live in the tile's title="" becomes a focusable (i) button + popover
 *    (definition · source · window), reachable by keyboard and touch.
 * 2) Numbers and dates in tables / KPI values / axes are re-formatted for the current language with
 *    ECP_I18N.fmtNum / fmtDate. Markup keeps the vi source text ("48.620", "91,4%", "16/05"); that text is the data.
 *    Strings that come from the dictionary ([data-i18n]) are left to i18n.js.
 */
(function () {
  var I = window.ECP_I18N;
  if (!I || !I.fmtNum) return;
  var YEAR = 2025; // ponytail: mock data year; real data carries full ISO dates
  var T = function (k, vi, a) { return I.tr(k, vi, a); };

  // ---------- 1) KPI (i) popovers ----------
  var INFO_SVG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
  var tips = [];
  function fillTip(t) {
    var text = T(t.key, t.vi);
    var html = '<dl>';
    text.split(' · ').forEach(function (part, i) {
      var m = /^([^:]{2,24}):\s*(.+)$/.exec(part);
      var dt = m ? m[1] : (i === 0 ? T('an.kpiDefinition', 'Định nghĩa') : '');
      var dd = m ? m[2] : part;
      html += '<dt>' + esc(dt) + '</dt><dd>' + esc(dd) + '</dd>';
    });
    t.pop.innerHTML = html + '</dl>';
    t.btn.setAttribute('aria-label', T('an.kpiInfoFor', 'Giải thích chỉ số {name}', { name: t.label.textContent.trim() }));
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function close(t, refocus) { t.pop.hidden = true; t.btn.setAttribute('aria-expanded', 'false'); if (refocus) t.btn.focus(); }
  function initTips() {
    // body.kpi-native-title (Usage, Serving, Value): the FE keeps the definition in the tile's native title tooltip
    [].forEach.call(document.querySelectorAll('body.obs-flat:not(.kpi-native-title) .sum-card[title]'), function (card, n) {
      var label = card.querySelector('.kpi-label'); if (!label) return;
      var attr = card.getAttribute('data-i18n-attr') || '';
      var km = /(?:^|;)\s*title:([^;]+)/.exec(attr);
      var vi = (card.__kcViA && card.__kcViA.title) || card.getAttribute('title');
      card.removeAttribute('title');
      if (km) card.setAttribute('data-i18n-attr', attr.replace(km[0], '').replace(/^;/, ''));
      if (!card.getAttribute('data-i18n-attr')) card.removeAttribute('data-i18n-attr');
      var id = 'kpi-pop-' + n;
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'kpi-info'; btn.innerHTML = INFO_SVG;
      btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', id); btn.setAttribute('aria-describedby', id);
      var pop = document.createElement('div');
      pop.className = 'popover kpi-pop'; pop.id = id; pop.hidden = true;
      // label text stays a leaf (data-i18n); the button sits next to it
      var wrap = document.createElement('div'); wrap.className = 'kpi-label';
      label.className = ''; label.parentNode.insertBefore(wrap, label); wrap.appendChild(label); wrap.appendChild(btn);
      card.appendChild(pop);
      var t = { key: km ? km[1].trim() : '', vi: vi, btn: btn, pop: pop, label: label };
      tips.push(t); fillTip(t);
      btn.addEventListener('click', function () {
        var open = pop.hidden;
        tips.forEach(function (o) { close(o); });
        if (open) { pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
      });
    });
    if (!tips.length) return;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      tips.forEach(function (t) { if (!t.pop.hidden) close(t, true); });
    });
    document.addEventListener('mousedown', function (e) {
      tips.forEach(function (t) { if (!t.pop.hidden && !t.btn.contains(e.target) && !t.pop.contains(e.target)) close(t); });
    });
  }

  // ---------- 2) locale numbers / dates ----------
  var SKIP = '[data-i18n],[data-i18n-html],[data-i18n-src],[data-i18n-skip],.mono,code,option,script,template,textarea';
  var SCOPE = 'td, th[scope="row"], dd, .kpi-value, .q-axis, .an-ylab, .q-legend, .an-sub, .q-bar-tot, .q-spark-lab, .q-qc, .an-anom-h, .kpi-delta';
  var RE_DATE = /(?<![\/\d])(\d{2})\/(\d{2})(?![\/\d])/g;
  var RE_NUM = /(?<![\w.,])(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+)(?![\w.,]?\d)/g;
  function num(s) {
    var p = s.split(','), dec = p[1] ? p[1].length : 0;
    return I.fmtNum(Number(p[0].replace(/\./g, '') + (dec ? '.' + p[1] : '')), { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function fmt(vi, axis) {
    var s = vi.replace(RE_DATE, function (m, d, mo) {
      if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return m;
      var dt = new Date(YEAR, mo - 1, +d);
      if (!axis) return I.fmtDate(dt);
      return I.lang === 'en' ? I.fmtDate(dt, { month: 'short', day: 'numeric' }) : m; // vi axis keeps dd/MM
    });
    s = s.replace(RE_NUM, num);
    if (I.lang === 'en') s = s.replace(/(\d) triệu\b/g, '$1M');
    return s;
  }
  function fmtTree(root) {
    if (!root.querySelectorAll) return;
    var els = [].slice.call(root.querySelectorAll(SCOPE));
    if (root.matches && root.matches(SCOPE)) els.push(root);
    els.forEach(function (el) {
      if (el.closest('.kpi-value') === el && /^\d{1,2}\/\d{1,2}$/.test(el.textContent.trim())) return; // "16/18" is a ratio
      var axis = !!el.closest('.q-axis');
      var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) {
        var p = n.parentElement;
        if (!p || p.closest(SKIP)) continue;
        if (n.__anVi === undefined) { if (!/\d/.test(n.nodeValue)) continue; n.__anVi = n.nodeValue; }
        var v = fmt(n.__anVi, axis);
        if (n.nodeValue !== v) n.nodeValue = v;
      }
    });
  }

  function init() {
    if (!document.body.classList.contains('obs-flat')) return;
    // "Cần chú ý" CTAs that apply an on-page filter: data-an-click="<selector of the filter chip>"
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-an-click]'); if (!b) return;
      var t = document.querySelector(b.getAttribute('data-an-click'));
      if (t) { t.click(); t.scrollIntoView({ block: 'nearest' }); }
    });
    // Xuất CSV: data-an-csv="<file name>" + data-an-csv-table="<table selector>"; rows/columns marked data-an-csv-skip are left out
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-an-csv]'); if (!b) return;
      var tb = document.querySelector(b.getAttribute('data-an-csv-table')); if (!tb) return;
      var skip = [].map.call(tb.querySelectorAll('thead th'), function (th) { return th.hasAttribute('data-an-csv-skip'); });
      var rows = [].filter.call(tb.querySelectorAll('thead tr, tbody tr'), function (tr) { return !tr.hasAttribute('data-an-csv-skip'); }).map(function (tr) {
        return [].filter.call(tr.children, function (c, i) { return !skip[i]; }).map(function (c) {
          return '"' + c.textContent.trim().replace(/"/g, '""') + '"';
        }).join(',');
      });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
      a.download = b.getAttribute('data-an-csv');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 0);
    });
    var main = document.querySelector('main') || document.body;
    initTips();
    fmtTree(main);
    I.onChange(function () { tips.forEach(fillTip); fmtTree(main); });
    // side panels clone <template> content later
    if (window.MutationObserver) new MutationObserver(function (ms) {
      ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (x) {
        if (x.nodeType === 1) fmtTree(x);
        else if (x.nodeType === 3 && x.parentElement) { var sc = x.parentElement.closest(SCOPE); if (sc) fmtTree(sc); }
      }); });
    }).observe(main, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
