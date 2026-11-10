/* ECP mockups: Enterprise Knowledge Overview (Grid + List).
 * Both pages: filter popovers (OR within a dimension, AND across), active-filter chips, Xóa lọc,
 * filters kept in the URL, Grid|List links carry the filters.
 * Cards / rows and the Owner, Steward, Tag options come from kb-data.js (ECP_KB); both views share the ⋯ menu:
 * Mở chi tiết, Chỉnh sửa tri thức (kb-create.html?edit=<kb>), Ủy quyền duyệt (Owner or Admin of the KB: opens
 * Settings › Người dùng & nhóm for the KB), Ngừng hoạt động / Kích hoạt lại (confirm, then a lifecycle request: the KB
 * keeps its state until it is approved), Sao chép liên kết. Both views page the KBs (.ek-foot: 5 / 10 / 25 per page).
 * List page only (table.ek-table): sort, selection + bulk bar, row click,
 * Both pages: ?state=list|noresult|empty|noperm|loading (shown by the generic screens.js [data-state-key] handler). */
(function () {
  var I18N = window.ECP_I18N || null;
  var T = (I18N && I18N.tr) || function (k, v, a) { return String(v).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); };
  function onLang(fn) { if (I18N) I18N.onChange(fn); }
  function qNorm(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function live(msg) {
    var r = document.getElementById('ecp-live');
    if (!r) { r = document.createElement('div'); r.id = 'ecp-live'; r.className = 'sr-only'; r.setAttribute('aria-live', 'polite'); r.setAttribute('role', 'status'); document.body.appendChild(r); }
    r.textContent = '';
    setTimeout(function () { r.textContent = msg; }, 30);
  }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // counts stored raw in data-n, shown in the current locale (1.842 vi / 1,842 en). Any page that loads this file.
  function fmtNums() { $$('[data-n]').forEach(function (el) { var n = +el.getAttribute('data-n'); el.textContent = I18N && I18N.fmtNum ? I18N.fmtNum(n) : String(n); }); }

  document.addEventListener('DOMContentLoaded', function () {
    var KB = window.ECP_KB; // cards / rows were rendered by kb-data.js (loaded first)
    fmtNums(); onLang(fmtNums);
    // list "Cập nhật": relative time on line 1, exact date + time on line 2 (current locale)
    function fmtUpd() {
      $$('.ek-table td.c-upd time[datetime]').forEach(function (t) {
        var d = new Date(t.getAttribute('datetime')); if (isNaN(d)) return;
        var abs = t.parentNode.querySelector('.ek-upd-abs');
        if (!abs) { abs = document.createElement('span'); abs.className = 'ek-upd-abs'; t.parentNode.appendChild(abs); }
        abs.textContent = I18N && I18N.fmtDate ? I18N.fmtDate(d) + ' ' + I18N.fmtDate(d, { hour: '2-digit', minute: '2-digit' }) : t.getAttribute('title'); // dd/MM/yyyy HH:mm
      });
    }
    fmtUpd(); onLang(fmtUpd);
    if (!document.querySelector('.ek-toolbar [data-ek-dim]')) return;
    var main = document.getElementById('main');
    var table = document.querySelector('table.ek-table');
    var isList = !!table;
    var tbody = isList ? table.tBodies[0] : null;
    var items = $$(isList ? 'table.ek-table tbody tr[data-kb]' : '.kb-card[data-kb]');
    var DIMS = ['owner', 'steward', 'tag', 'status'];
    var OWNED = DIMS.concat(['sort', 'dir', 'size', 'page']);
    var params = new URLSearchParams(location.search);
    var stateKey = params.get('state') || 'list';
    main.setAttribute('data-ek-state', stateKey);
    if (stateKey === 'noperm') $$('.breadcrumb .crumb-action[data-ek-create]').forEach(function (a) { a.hidden = true; a.previousElementSibling.hidden = true; }); // web: no add action without access
    var sort = { col: 'updated', dir: 'desc' }, size = 10, page = 1;
    var SORTABLE = { name: 1, updated: 1 }, noSeed = false;

    // ---------- filters ----------
    function wrapOf(dim) { return document.querySelector('.ek-filter #fb-' + dim).parentNode; }
    function opts(dim) { return $$('#fp-' + dim + ' [data-ek-opt]'); }
    function selected(dim) { return opts(dim).filter(function (o) { return o.checked && !wrapOf(dim).hidden; }).map(function (o) { return o.value; }); }
    function clearDim(dim) { opts(dim).forEach(function (o) { o.checked = false; }); }
    function clearHiddenDims() { DIMS.forEach(function (d) { if (wrapOf(d).hidden) clearDim(d); }); }
    function matches(it) {
      var tags = (it.getAttribute('data-tags') || '').split(' '), st = (it.getAttribute('data-status') || '').split(' ');
      var val = { owner: (it.getAttribute('data-owner') || '').split(' '), steward: (it.getAttribute('data-steward') || '').split(' '), tag: tags, status: st };
      if (noSeed) return false;
      var qq = qNorm(((document.getElementById('qs') || {}).value || '').trim());
      if (qq && qNorm(it.getAttribute('data-name') || '').indexOf(qq) === -1) return false;
      return DIMS.every(function (d) {
        var sel = selected(d);
        return !sel.length || sel.some(function (v) { return val[d].indexOf(v) !== -1; });
      });
    }

    var openPop = null;
    function closePop(focusBtn) {
      if (!openPop) return;
      var b = document.getElementById('fb-' + openPop.getAttribute('data-ek-pop'));
      openPop.hidden = true; b.setAttribute('aria-expanded', 'false');
      openPop = null;
      if (focusBtn) b.focus();
    }
    $$('.ek-toolbar [data-ek-dim]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pop = document.getElementById(b.getAttribute('aria-controls'));
        if (openPop === pop) { closePop(false); return; }
        closePop(false);
        var ps = pop.querySelector('[data-ek-popsearch]'); // a reopened filter starts with an empty search
        if (ps && ps.value) { ps.value = ''; ps.dispatchEvent(new Event('input')); }
        pop.hidden = false; b.setAttribute('aria-expanded', 'true'); openPop = pop;
        var f = pop.querySelector('[data-ek-popsearch]') || pop.querySelector('[data-ek-opt]');
        if (f) f.focus();
      });
    });
    var qBox = document.getElementById('qs');
    if (qBox) qBox.addEventListener('input', function () { userRun(); }); // web: header search by KB name
    $$('.ek-pop').forEach(function (pop) {
      pop.addEventListener('change', function (e) { if (e.target.hasAttribute('data-ek-opt')) userRun(); });
      var srch = pop.querySelector('[data-ek-popsearch]');
      if (srch) srch.addEventListener('input', function () {
        var q = qNorm(srch.value.trim());
        var none = $$('.ek-opts li:not([data-ek-none])', pop).filter(function (li) { li.hidden = !!q && qNorm(li.textContent).indexOf(q) === -1; return !li.hidden; }).length === 0;
        var nr = pop.querySelector('[data-ek-none]'); // "Không có kết quả" when no option matches
        if (!nr) { nr = document.createElement('li'); nr.className = 'muted text-sm'; nr.setAttribute('data-ek-none', ''); nr.setAttribute('data-i18n', 'kbc.noResult'); nr.textContent = T('kbc.noResult', 'Không có kết quả'); pop.querySelector('.ek-opts').appendChild(nr); }
        nr.hidden = !none;
      });
      pop.querySelector('[data-ek-clear-dim]').addEventListener('click', function () { clearDim(pop.getAttribute('data-ek-pop')); userRun(); });
    });
    document.addEventListener('click', function (e) {
      if (openPop && !openPop.parentNode.contains(e.target)) closePop(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openPop) { e.preventDefault(); closePop(true); }
    });
    $$('[data-ek-clear-all]').forEach(function (b) {
      b.addEventListener('click', function () { DIMS.forEach(clearDim); userRun(); var f = document.getElementById('fb-tag'); if (f && !b.closest('.ek-chips')) f.focus(); });
    });

    // ---------- chips + counts ----------
    function labelOf(dim) { var l = document.querySelector('#fb-' + dim + ' .ek-flabel'); return l ? l.textContent.trim() : dim; }
    function renderChips() {
      var list = document.querySelector('[data-ek-chiplist]'), box = document.querySelector('[data-ek-chips]'), n = 0;
      list.textContent = '';
      DIMS.forEach(function (d) {
        var sel = selected(d), c = document.querySelector('#fb-' + d + ' [data-ek-fcount]');
        c.textContent = sel.length ? String(sel.length) : ''; c.hidden = !sel.length;
        opts(d).forEach(function (o) {
          if (!o.checked || wrapOf(d).hidden) return;
          n++;
          var f = labelOf(d) + ': ' + o.parentNode.querySelector('.ek-otext').textContent.trim();
          var chip = document.createElement('span'); chip.className = 'ek-chip'; chip.setAttribute('data-i18n-skip', '');
          var t = document.createElement('span'); t.textContent = f; chip.appendChild(t);
          var x = document.createElement('button'); x.type = 'button'; x.className = 'chip-x'; x.textContent = '×';
          x.setAttribute('aria-label', T('common.ekRemoveFilter', 'Bỏ lọc {f}', { f: f }));
          x.addEventListener('click', function () {
            o.checked = false; userRun();
            var next = document.querySelector('[data-ek-chiplist] .chip-x') || document.getElementById('fb-' + d);
            if (next && !next.closest('[hidden]')) next.focus();
          });
          chip.appendChild(x); list.appendChild(chip);
        });
      });
      box.hidden = !n;
    }

    // ---------- URL + memory ----------
    function ownedQuery() {
      var q = new URLSearchParams();
      DIMS.forEach(function (d) { var s = selected(d); if (s.length) q.set(d, s.join(',')); });
      if (sort.col !== 'updated' || sort.dir !== 'desc') { q.set('sort', sort.col); q.set('dir', sort.dir); }
      if (size !== 10) q.set('size', String(size));
      return q;
    }
    function sync(user) {
      var q = ownedQuery(), qs = q.toString().replace(/%2C/g, ',');
      var memo = qs.replace(/&?page=\d+/, '').replace(/^&/, '');
      $$('[data-ek-view-link]').forEach(function (a) { a.setAttribute('href', 'ek-overview-' + a.getAttribute('data-ek-view-link') + '.html' + (memo ? '?' + memo : '')); });
      if (!user) return;
      var url = new URLSearchParams(location.search);
      OWNED.concat(['state']).forEach(function (k) { url.delete(k); });
      q.forEach(function (v, k) { url.set(k, v); });
      if (page > 1) url.set('page', String(page));
      var s = url.toString().replace(/%2C/g, ',');
      try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) {}
    }

    // ---------- list: sort / page / selection ----------
    function sortVal(it, col) {
      if (col === 'name') return it.getAttribute('data-name');
      if (col === 'updated') return it.getAttribute('data-updated');
      return +it.getAttribute('data-' + col);
    }
    // both views are sorted (Cập nhật, newest first, unless ?sort=&dir=); only the list has sort buttons
    function applySort() {
      var box = isList ? tbody : document.querySelector('[data-kb-render="grid"]');
      var rows = items.slice().sort(function (a, b) {
        var x = sortVal(a, sort.col), y = sortVal(b, sort.col), r;
        if (sort.col === 'name') r = x.localeCompare(y, 'vi');
        else r = x < y ? -1 : x > y ? 1 : 0;
        return sort.dir === 'asc' ? r : -r;
      });
      rows.forEach(function (r) { box.appendChild(r); });
      if (!isList) return;
      $$('th[data-ek-col]', table).forEach(function (th) {
        if (th.getAttribute('data-ek-col') === sort.col) th.setAttribute('aria-sort', sort.dir === 'asc' ? 'ascending' : 'descending');
        else th.removeAttribute('aria-sort');
      });
    }
    function colLabel(col) { var b = table.querySelector('[data-ek-sort="' + col + '"]'); return b ? b.textContent.trim() : col; }

    var bulk = document.querySelector('[data-ek-bulk]'), checkAll = document.querySelector('[data-ek-check-all]');
    function visibleRows() { return items.filter(function (r) { return !r.hidden; }); }
    function syncSel() {
      if (!isList) return;
      items.forEach(function (r) { var c = r.querySelector('[data-ek-check]'); if (r.hidden) c.checked = false; r.classList.toggle('is-checked', c.checked); });
      var vis = visibleRows(), n = vis.filter(function (r) { return r.querySelector('[data-ek-check]').checked; }).length;
      checkAll.checked = !!vis.length && n === vis.length; checkAll.indeterminate = n > 0 && n < vis.length;
      bulk.hidden = !n;
      document.querySelector('[data-ek-selcount]').textContent = T('ek.selectedN', 'Đã chọn {n} tri thức', { n: n });
    }
    function selCount() { return items.filter(function (r) { return r.querySelector('[data-ek-check]').checked; }).length; }

    var pagesBox = document.querySelector('[data-ek-pages]'), prevB = document.querySelector('[data-ek-prev]'), nextB = document.querySelector('[data-ek-next]');
    var sizeSel = document.getElementById('ek-size'), rangeEl = document.querySelector('[data-ek-range]');
    var lastMatch = 0, foot = document.querySelector('.ek-foot');
    function fmtN(x) { return I18N && I18N.fmtNum ? I18N.fmtNum(x) : String(x); }
    // 1 … p-1 p p+1 … last once there are more than 7 pages (0 = gap)
    function pageSlots(cur, last) {
      if (last <= 7) { var all = []; for (var i = 1; i <= last; i++) all.push(i); return all; }
      var out = [1]; if (cur > 3) out.push(0);
      for (var p = Math.max(2, cur - 1); p <= Math.min(last - 1, cur + 1); p++) out.push(p);
      if (cur < last - 2) out.push(0);
      out.push(last); return out;
    }
    function renderPager(n) {
      var pages = Math.max(1, Math.ceil(n / size));
      pagesBox.textContent = '';
      pageSlots(page, pages).forEach(function (i) {
        if (!i) { var g = document.createElement('span'); g.className = 'muted'; g.setAttribute('aria-hidden', 'true'); g.textContent = '…'; pagesBox.appendChild(g); return; }
        var b = document.createElement('button'); b.type = 'button'; b.textContent = fmtN(i);
        b.setAttribute('aria-label', T('ek.pageN', 'Trang {n}', { n: i }));
        if (i === page) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', function () { page = i; userRun(true); var c = pagesBox.querySelector('[aria-current]'); if (c) c.focus(); });
        pagesBox.appendChild(b);
      });
      prevB.disabled = page <= 1; nextB.disabled = page >= pages;
      var a = n ? (page - 1) * size + 1 : 0, b2 = Math.min(n, page * size);
      rangeEl.textContent = T('ek.rangeOf', 'Hiển thị {a}–{b} / {n} tri thức', { a: fmtN(a), b: fmtN(b2), n: fmtN(n) });
    }

    // ---------- pipeline ----------
    function run() {
      var m = items.filter(matches);
      lastMatch = m.length;
      if (isList) {
        applySort();
        var pages = Math.max(1, Math.ceil(m.length / size));
        if (page > pages) page = pages;
        var ordered = $$('tr[data-kb]', tbody).filter(function (r) { return m.indexOf(r) !== -1; });
        items.forEach(function (r) { r.hidden = true; });
        ordered.forEach(function (r, i) { r.hidden = !(i >= (page - 1) * size && i < page * size); });
        if (stateKey === 'list' || stateKey === 'noresult') {
          var ls = document.querySelector('[data-state-key="list"]'), nr = document.querySelector('[data-state-key="noresult"]');
          ls.hidden = !m.length; nr.hidden = !!m.length;
        }
        renderPager(m.length);
        sizeSel.value = String(size);
        syncSel();
      } else {
        applySort();
        var gPages = Math.max(1, Math.ceil(m.length / size));
        if (page > gPages) page = gPages;
        var gOrdered = $$('.kb-card[data-kb]').filter(function (c) { return m.indexOf(c) !== -1; });
        items.forEach(function (c) { var i = gOrdered.indexOf(c); c.hidden = i === -1 || i < (page - 1) * size || i >= page * size; });
        var grid = document.querySelector('[data-kb-render="grid"]'), nr2 = document.querySelector('[data-ek-noresult]');
        if (stateKey === 'list' || stateKey === 'noresult') { grid.parentNode.hidden = !m.length; nr2.hidden = !!m.length; }
        if (foot) { foot.hidden = !m.length; renderPager(m.length); sizeSel.value = String(size); }
        if (KB && KB.gridRows) KB.gridRows(grid);
      }
      renderChips();
    }
    function userRun(keepPage) {
      noSeed = false;
      if (!keepPage) page = 1;
      run(); sync(true);
      live(T('common.ekResults', '{n} tri thức khớp bộ lọc', { n: lastMatch }));
    }

    // ---------- init ----------
    noSeed = stateKey === 'noresult' && !DIMS.some(function (d) { return params.get(d); }); // web: only Steward (+ header search) filters, so ?state=noresult seeds an empty result
    DIMS.forEach(function (d) {
      var v = (params.get(d) || '').split(',').filter(function (x) { return /^[\w-]+$/.test(x); });
      opts(d).forEach(function (o) { o.checked = v.indexOf(o.value) !== -1; });
    });
    clearHiddenDims();
    if (SORTABLE[params.get('sort')]) { sort.col = params.get('sort'); sort.dir = params.get('dir') === 'asc' ? 'asc' : 'desc'; }
    if ([5, 10, 25].indexOf(+params.get('size')) !== -1) size = +params.get('size');
    if (+params.get('page') > 0) page = Math.floor(+params.get('page'));
    run(); sync(false);
    document.addEventListener('ecp-rolechange', function () { clearHiddenDims(); run(); sync(false); });
    onLang(function () {
      renderChips();
      if (foot) renderPager(lastMatch);
      if (isList) syncSel();
    });
    if (stateKey === 'loading') $$('.ek-toolbar [data-ek-dim]').forEach(function (b) { b.disabled = true; });

    // ---------- ⋯ menu (grid + list): Open detail, Edit KB, Approval Delegation, Deactivate / Activate, Copy link ----------
    function toast(msg) { if (KB) KB.toast(msg); }
    var menu = document.getElementById('ek-row-menu'), menuBtn = null;
    if (menu) document.body.appendChild(menu); // above the cards' stacking context
    function menuItems() { return $$('[role="menuitem"]', menu).filter(function (m) { return !m.parentNode.hidden; }); }
    function closeMenu(focus) {
      if (!menu || menu.hidden) return;
      menu.hidden = true;
      if (menuBtn) { menuBtn.setAttribute('aria-expanded', 'false'); if (focus) menuBtn.focus(); }
      menuBtn = null;
    }
    function gate(mi, ok, why) {
      if (ok) { mi.removeAttribute('aria-disabled'); mi.removeAttribute('title'); }
      else { mi.setAttribute('aria-disabled', 'true'); mi.setAttribute('title', why); }
    }
    function openMenu(btn) {
      var it = btn.closest('[data-kb]'), kb = KB.get(it.getAttribute('data-kb'));
      menu.querySelector('[data-ek-mi="open"]').setAttribute('href', KB.detailHref(kb));
      var ed = menu.querySelector('[data-ek-mi="edit"]');
      ed.setAttribute('href', 'kb-create.html?edit=' + encodeURIComponent(kb.id) + '&from=' + (isList ? 'list' : 'grid'));
      gate(ed, KB.can.edit(kb), T('kbm.noEdit', 'Chỉ Owner, Steward của tri thức hoặc System Admin được chỉnh sửa'));
      var dg = menu.querySelector('[data-ek-mi="delegation"]');
      dg.setAttribute('href', 'settings.html?s=users&kb=' + encodeURIComponent(kb.id));
      dg.parentNode.hidden = !KB.can.manageDelegation(kb);
      var de = menu.querySelector('[data-ek-mi="deactivate"]'), ac = menu.querySelector('[data-ek-mi="activate"]');
      de.parentNode.hidden = !kb.active; ac.parentNode.hidden = kb.active;
      [de, ac].forEach(function (b) { gate(b, KB.can.deactivate(kb), T('kbm.noDeactivate', 'Chỉ Owner của tri thức hoặc System Admin')); });
      menu.setAttribute('data-ek-for', kb.id);
      menuBtn = btn; btn.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
      var r = btn.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight;
      // flip upward when opening down would run past the viewport or over the pager below the table
      var foot = document.querySelector('.ek-foot'), limit = innerHeight - 8;
      if (foot) { var ft = foot.getBoundingClientRect().top; if (ft > r.bottom) limit = Math.min(limit, ft - 4); }
      var top = r.bottom + 4; if (top + h > limit) top = Math.max(8, r.top - h - 4);
      menu.style.top = top + 'px'; menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
      menuItems()[0].focus();
    }
    // Deactivate / Reactivate send a lifecycle request; the KB keeps its state until the request is approved
    function requested(kb, on) {
      toast(T(on ? 'kbe.restoreRequested' : 'kbe.archiveRequested', on ? 'Đã gửi yêu cầu kích hoạt lại {x}' : 'Đã gửi yêu cầu ngừng hoạt động {x}', { x: kb.name }));
    }
    if (menu && KB) {
      document.addEventListener('click', function (e) {
        var b = e.target.closest('.ek-act-btn');
        if (b) { e.preventDefault(); e.stopPropagation(); if (menuBtn === b) { closeMenu(true); return; } closeMenu(false); openMenu(b); return; }
        if (!menu.hidden && !menu.contains(e.target)) closeMenu(false);
      });
      menu.addEventListener('click', function (e) {
        var mi = e.target.closest('[role="menuitem"]'); if (!mi) return;
        if (mi.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
        var id = menu.getAttribute('data-ek-for'), kb = KB.get(id), act = mi.getAttribute('data-ek-mi'), btn = menuBtn;
        if (act === 'copy') {
          closeMenu(true);
          var url = new URL(KB.detailHref(kb), location.href).href;
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast(T('kbe.linkCopied', 'Đã sao chép liên kết vào bộ nhớ tạm')); }, function () { toast(T('esa.copyFailed', 'Không sao chép được, hãy thử lại.')); });
          else toast(T('esa.copyFailed', 'Không sao chép được, hãy thử lại.'));
        } else if (act === 'deactivate') {
          closeMenu(false);
          KB.confirm({
            title: T('kbm.deactTitle', 'Ngừng hoạt động tri thức?'),
            body: T('kbm.deactBody', 'Tri thức này sẽ ngừng hoạt động và không còn xuất hiện trong khai thác tri thức (Enterprise Search, Knowledge Graph). Văn bản, package, ontology và lịch sử được giữ nguyên. Bạn có thể kích hoạt lại sau.'),
            ok: T('kbm.deactOk', 'Ngừng hoạt động'), focus: btn,
            onOk: function () { requested(kb, false); }
          });
        } else if (act === 'activate') {
          closeMenu(false);
          KB.confirm({ title: T('kbm.actTitle', 'Kích hoạt lại tri thức?'), body: T('kbm.actBody', '{x} sẽ xuất hiện lại trong khai thác tri thức theo quyền truy cập hiện có.', { x: kb.name }), ok: T('kbm.actOk', 'Kích hoạt lại'), danger: false, focus: btn, onOk: function () { requested(kb, true); } });
        }
      });
      menu.addEventListener('keydown', function (e) {
        var l = menuItems(), i = l.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); l[(i + 1) % l.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
        else if (e.key === 'Home') { e.preventDefault(); l[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); l[l.length - 1].focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
        else if (e.key === 'Tab') closeMenu(false);
      });
      $$('.ek-scroll').forEach(function (s) { s.addEventListener('scroll', function () { closeMenu(false); }); });
      window.addEventListener('scroll', function () { closeMenu(false); }, true);
      window.addEventListener('resize', function () { closeMenu(false); });
    }

    // pager (both views)
    if (foot) {
      prevB.addEventListener('click', function () { if (page > 1) { page--; userRun(true); } });
      nextB.addEventListener('click', function () { page++; userRun(true); });
      sizeSel.addEventListener('change', function () { size = +sizeSel.value; userRun(); });
    }

    if (!isList) return;

    // sort buttons
    $$('[data-ek-sort]', table).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-ek-sort');
        if (sort.col === c) sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
        else { sort.col = c; sort.dir = c === 'updated' ? 'desc' : 'asc'; }
        page = 1; run(); sync(true);
        live(T(sort.dir === 'asc' ? 'ek.sortedAsc' : 'ek.sortedDesc', sort.dir === 'asc' ? 'Đã sắp xếp theo {c}, tăng dần' : 'Đã sắp xếp theo {c}, giảm dần', { c: colLabel(c) }));
      });
    });
    // selection + bulk
    tbody.addEventListener('change', function (e) { if (e.target.hasAttribute('data-ek-check')) syncSel(); });
    checkAll.addEventListener('change', function () { visibleRows().forEach(function (r) { r.querySelector('[data-ek-check]').checked = checkAll.checked; }); syncSel(); });
    document.querySelector('[data-ek-export]').addEventListener('click', function () { toast(T('ek.exportedN', 'Đã xuất {n} tri thức ra CSV', { n: selCount() })); });
    document.querySelector('[data-ek-clear-sel]').addEventListener('click', function () {
      items.forEach(function (r) { r.querySelector('[data-ek-check]').checked = false; }); syncSel(); checkAll.focus();
    });
    // row click
    tbody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-kb]');
      if (!tr || e.target.closest('input, a, button, label, select')) return;
      var a = tr.querySelector('.t-name a');
      if (a) location.href = a.getAttribute('href');
    });
  });
})();
