/* ECP mockups: theme toggle, sidebar collapse, tabs, collapsible sections, pressed toggles. */
(function () {
  var root = document.documentElement;
  // i18n (assets/i18n.js): T(key, viFallback, args) / TV(viSourceText) / SRC(el, viText[, enText]); vi literals stay as fallback
  var I18N = window.ECP_I18N || null;
  var T = (I18N && I18N.tr) || function (k, v, a) { return String(v).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); };
  var TV = (I18N && I18N.tv) || function (v) { return v; };
  var SRC = (I18N && I18N.src) || function (el, v) { if (el) el.textContent = v; };
  function onLang(fn) { if (I18N) I18N.onChange(fn); }
  var params = new URLSearchParams(location.search);
  var saved = params.get('theme') || localStorage.getItem('ecp-theme') ||
    (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');

  // Responsive shell: <=1279px the sidebar auto-collapses to the 60px rail; <=1023px it goes
  // off-canvas (the .sb-toggle opens it as an overlay drawer, .app.sb-open). See shell.css.
  function mq(q) { return window.matchMedia ? matchMedia(q) : { matches: false, addEventListener: function () {} }; }
  var MQ_RAIL = mq('(max-width: 1279px)'), MQ_OFF = mq('(max-width: 1023px)');
  var MQ_REDUCE = mq('(prefers-reduced-motion: reduce)');
  function scrollBehavior() { return MQ_REDUCE.matches ? 'auto' : 'smooth'; }
  // Sidebar collapse must be decided BEFORE first paint, otherwise the page paints expanded
  // and only collapses at DOMContentLoaded — a visible expand→collapse flash when navigating.
  // This runs in <head> (before <body> exists), so it drives layout via an <html> class +
  // the --sb-w width variable; the .app.is-collapsed class is still applied later for JS state.
  (function () {
    var sbParam = params.get('sidebar'), sbSaved = null;
    try { sbSaved = localStorage.getItem('ecp-sidebar'); } catch (e) {}
    // No synchronous access to the static markup's class here, so default to expanded unless
    // the URL or saved state says collapsed. Pages that ship collapsed (sidebar-collapsed.html)
    // pass ?sidebar=collapsed or are handled at DOMContentLoaded.
    var collapsed = sbParam ? sbParam === 'collapsed' : sbSaved === 'collapsed';
    if (collapsed || MQ_RAIL.matches) root.classList.add('ecp-collapsed');
  })();
  // Also suppress the transition on the first paint so no animation plays for the initial state.
  root.classList.add('ecp-no-anim');

  function syncTheme() {
    var dark = root.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('aria-pressed', String(dark));
      var t = b.querySelector('.nav-text');
      if (t) t.textContent = dark ? T('common.themeDark', 'Giao diện: Tối') : T('common.themeLight', 'Giao diện: Sáng');
    });
  }

  function setTheme(next) {
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ecp-theme', next); } catch (e) { /* ignore */ }
    syncTheme();
  }
  // generic tabs: select t in its tablist, show its aria-controls panel, hide the siblings' panels
  function activateTab(t) {
    var list = t.closest('[role="tablist"]');
    if (!list) return;
    list.querySelectorAll('[role="tab"]').forEach(function (x) {
      var on = x === t;
      x.setAttribute('aria-selected', String(on));
      var p = document.getElementById(x.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
      if (p && on && syncDetail) syncDetail(p);
    });
  }
  var syncDetail = null; // set by row->detail init: reload the drawer from the shown tab's table
  // ---- user menu: avatar/role button -> dropdown (role, Cài đặt, Giao diện tối switch, ngôn ngữ, Đăng xuất) ----
  var ROLE_LABEL = { admin: 'System Admin', owner: 'Owner', steward: 'Steward', consumer: 'Consumer' };
  // Consumer only sees these sidebar destinations (by href page, no query/hash).
  var CONSUMER_NAV = ['enterprise-search-home.html', 'knowledge-graph.html', 'ek-overview-grid.html', 'ek-overview-list.html', 'settings.html'];
  function getRole() {
    var r = params.get('role');
    if (!r) { try { r = localStorage.getItem('ecp-role'); } catch (e) {} }
    return ROLE_LABEL[r] ? r : 'owner';
  }
  function syncRole() {
    var r = getRole();
    root.setAttribute('data-role', r);
    // header account button: name on top, role below (as micro-frontend/web user-menu.tsx); the role is a glossary term
    document.querySelectorAll('.user-btn .user-role').forEach(function (el) { el.textContent = ROLE_LABEL[r]; });
    document.querySelectorAll('.user-btn').forEach(function (b) { b.setAttribute('aria-label', T('common.account', 'Tài khoản') + ' Nguyễn Lan, ' + T('common.role', 'Vai trò').toLowerCase() + ' ' + ROLE_LABEL[r]); });
    document.querySelectorAll('[data-role]').forEach(function (b) { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.getAttribute('data-role') === r)); });
    // Owner: no Owner filter; Steward: no Owner + Steward filters; Admin: all
    var hide = r === 'owner' ? ['owner'] : r === 'steward' ? ['owner', 'steward'] : [];
    document.querySelectorAll('[data-role-filter]').forEach(function (el) { el.hidden = hide.indexOf(el.getAttribute('data-role-filter')) !== -1; });
    syncSidebarRole(r);
    applyRoleGates();
    syncPendingBadge(r);
    document.dispatchEvent(new CustomEvent('ecp-rolechange'));
  }
  // Consumer sidebar: show only Enterprise Search, Knowledge Graph, Overview; hide empty sections.
  function syncSidebarRole(r) {
    var limited = r === 'consumer';
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (a) {
      var li = a.closest('li'); if (!li) return;
      if (!limited) { li.hidden = false; return; }
      var href = (a.getAttribute('href') || '').split(/[?#]/)[0];
      li.hidden = CONSUMER_NAV.indexOf(href) === -1;
    });
    document.querySelectorAll('.sidebar-nav .nav-section').forEach(function (sec) {
      if (!limited) { sec.hidden = false; return; }
      var visible = sec.querySelectorAll('.nav-item').length &&
        Array.prototype.some.call(sec.querySelectorAll('li'), function (li) { return !li.hidden; });
      sec.hidden = !visible;
    });
  }
  // Pending count on the sidebar "Thay đổi & Phê duyệt" chip, if a page renders one (the header badge is gone, as in
  // micro-frontend/web): Owner/Admin = việc chờ duyệt; Steward = việc đang ASSIGNED cho Steward.
  var PENDING = { owner: 12, admin: 12, steward: 3 };
  function syncPendingBadge(r) {
    var n = PENDING[r];
    document.querySelectorAll('a.nav-item[href^="changes-approval-v2.html"] .chip').forEach(function (c) { c.textContent = n; });
  }
  // ---- Quality: role / state gates (data-roles, data-cr-show, data-roles-disable, data-self-edit, data-cr-enable, data-bulk-off, data-locked) ----
  function inList(list, v) { return (' ' + (list || '') + ' ').indexOf(' ' + v + ' ') !== -1; }
  // visible by gates only (role + CR state); filters add data-qf-out on top
  function gateVisible(el) {
    if (el.hasAttribute('data-roles') && !inList(el.getAttribute('data-roles'), getRole())) return false;
    var st = root.getAttribute('data-cr-state');
    if (st && el.hasAttribute('data-cr-show') && !inList(el.getAttribute('data-cr-show'), st)) return false;
    return true;
  }
  function gateReason(el) {
    if (el.hasAttribute('data-locked')) return TV(el.getAttribute('data-locked')) || T('q.handled', 'Đã xử lý');
    if (el.hasAttribute('data-self-edit')) return TV(el.getAttribute('data-self-edit')) || T('q.selfEdit', 'Bạn là người sửa thay đổi này');
    if (el.hasAttribute('data-roles-disable') && inList(el.getAttribute('data-roles-disable'), getRole())) return TV(el.getAttribute('data-reason')) || T('q.noPermission', 'Không đủ quyền');
    var st = root.getAttribute('data-cr-state');
    if (st && el.hasAttribute('data-cr-enable') && !inList(el.getAttribute('data-cr-enable'), st)) return TV(el.getAttribute('data-cr-reason')) || TV(el.getAttribute('data-reason')) || T('q.notInState', 'Chưa khả dụng ở trạng thái này');
    if (el.hasAttribute('data-bulk-off')) return TV(el.getAttribute('data-bulk-off'));
    return null;
  }
  var rrSeq = 0;
  function reasonBox() {
    var b = document.getElementById('q-reasons');
    if (!b && document.body) { b = document.createElement('div'); b.id = 'q-reasons'; b.className = 'sr-only'; document.body.appendChild(b); }
    return b;
  }
  function setGateDisabled(el, reason) {
    var native = /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName), sid = el.getAttribute('data-rr-id');
    if (reason) {
      // textareas stay focusable/readable for screen readers: readonly, not disabled (designs.md §6)
      if (el.tagName === 'TEXTAREA') el.readOnly = true;
      else if (native) el.disabled = true;
      else { el.setAttribute('aria-disabled', 'true'); el.classList.add('is-disabled'); el.setAttribute('tabindex', '-1'); }
      var sp = sid && document.getElementById(sid), box = reasonBox();
      if (!sp && box) {
        sid = 'rr-' + (++rrSeq); sp = document.createElement('span'); sp.id = sid; box.appendChild(sp);
        el.setAttribute('data-rr-id', sid);
        if (el.hasAttribute('title')) el.setAttribute('data-rr-title', el.getAttribute('title'));
      }
      if (sp) { sp.textContent = reason; el.setAttribute('aria-describedby', sid); }
      el.setAttribute('title', reason);
    } else {
      if (el.tagName === 'TEXTAREA') el.readOnly = false;
      else if (native) el.disabled = false;
      else if (el.classList.contains('is-disabled')) { el.removeAttribute('aria-disabled'); el.classList.remove('is-disabled'); el.removeAttribute('tabindex'); }
      if (sid) {
        var s2 = document.getElementById(sid); if (s2) s2.remove();
        el.removeAttribute('data-rr-id'); el.removeAttribute('aria-describedby');
        if (el.hasAttribute('data-rr-title')) { el.setAttribute('title', el.getAttribute('data-rr-title')); el.removeAttribute('data-rr-title'); } else el.removeAttribute('title');
      }
    }
  }
  function applyRoleGates() {
    document.querySelectorAll('[data-roles], [data-cr-show]').forEach(function (el) {
      el.hidden = !gateVisible(el) || el.hasAttribute('data-qf-out');
    });
    document.querySelectorAll('[data-roles-disable], [data-self-edit], [data-cr-enable], [data-bulk-off], [data-bulk-btn], [data-locked]').forEach(function (el) {
      setGateDisabled(el, gateReason(el));
    });
  }
  function setRole(r) {
    try { localStorage.setItem('ecp-role', r); } catch (e) {}
    params.delete && params.delete('role');
    syncRole();
  }
  // header as the web app (Header in app-shell/header.tsx): the brand is the home link to Enterprise Search,
  // and the breadcrumb landmark name is translated
  function initHeader() {
    var brand = document.querySelector('.app-header .hdr-brand');
    if (brand && !brand.querySelector('.hdr-home')) {
      var a = document.createElement('a');
      a.className = 'hdr-home'; a.href = 'enterprise-search-home.html';
      a.setAttribute('aria-label', 'MSB Context Platform · Enterprise Search');
      brand.querySelectorAll('.logo, .logo-symbol, .brand-text').forEach(function (el) {
        if (el.tagName === 'IMG') el.alt = ''; else el.setAttribute('aria-hidden', 'true');
        a.appendChild(el);
      });
      brand.insertBefore(a, brand.firstChild);
    }
    var nav = document.querySelector('.app-header .breadcrumb');
    function sync() { if (nav) nav.setAttribute('aria-label', T('shell.breadcrumb', 'Đường dẫn')); }
    sync(); onLang(sync);
  }
  // planned screens get the "Soon" badge like the web sidebar (nav-config `soon`); the mock link still opens the screen
  function initSoonNav() {
    var SOON = ['quality-eval-lab', 'quality-gaps', 'quality-overview', 'quality-feedback', 'usage-retrieval', 'serving-performance', 'knowledge-value'];
    var items = [];
    document.querySelectorAll('.sidebar .nav-item').forEach(function (a) {
      var h = (a.getAttribute('href') || '').replace(/\.html.*$/, '');
      if (SOON.indexOf(h) < 0) return;
      var b = document.createElement('span'); b.className = 'nav-soon'; b.setAttribute('aria-hidden', 'true'); b.setAttribute('data-i18n-skip', '');
      a.appendChild(b); items.push([a, b, a.getAttribute('title')]);
    });
    function sync() { items.forEach(function (x) { var s = T('shell.soon', 'Sắp có'); x[1].textContent = s; x[0].setAttribute('aria-label', x[2] + ' · ' + s); }); }
    sync(); onLang(sync);
  }
  function initUserMenu() {
    var wrap = document.querySelector('.user-menu');
    if (!wrap) return;
    var btn = wrap.querySelector('.user-btn');
    var pop = document.createElement('div');
    pop.id = 'user-pop'; pop.className = 'user-pop'; pop.hidden = true;
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Tài khoản'); pop.setAttribute('data-i18n-attr', 'aria-label:common.account');
    var curLang = I18N ? I18N.lang : 'vi';
    pop.innerHTML =
      '<div class="up-row"><span id="role-lbl" data-i18n="common.role">Vai trò</span><span class="lang-seg role-seg" role="group" aria-labelledby="role-lbl" data-exclusive><button type="button" aria-pressed="false" data-role="admin">Admin</button><button type="button" aria-pressed="false" data-role="owner">Owner</button><button type="button" aria-pressed="false" data-role="steward">Steward</button><button type="button" aria-pressed="false" data-role="consumer">Consumer</button></span></div>' +
      '<a class="up-row up-item" href="settings.html" data-i18n="common.settings">Cài đặt</a>' +
      '<div class="up-row"><span id="dark-lbl" data-i18n="common.darkMode">Giao diện tối</span><span class="switch-wrap"><span class="muted" id="dark-state">Light</span><button class="switch" id="dark-switch" type="button" role="switch" aria-checked="false" aria-labelledby="dark-lbl" aria-describedby="dark-state"></button></span></div>' +
      '<div class="up-row"><span id="lang-lbl" data-i18n-skip>Ngôn ngữ / Language</span><span class="lang-seg" role="group" aria-labelledby="lang-lbl" data-exclusive data-lang-switch data-i18n-skip><button type="button" lang="vi" data-lang="vi" aria-label="Tiếng Việt" aria-pressed="' + (curLang === 'vi') + '">VI</button><button type="button" lang="en" data-lang="en" aria-label="English" aria-pressed="' + (curLang === 'en') + '">EN</button></span></div>' +
      '<button class="up-row up-item" type="button" data-i18n="common.logout">Đăng xuất</button>';
    // the web account menu has no role row (roles come from the session): the mock role switch shows only with ?rolesw=1 (?role=<r> still sets the role)
    if (!params.get('rolesw')) pop.querySelector('.role-seg').parentNode.style.display = 'none';
    wrap.appendChild(pop);
    // the button shows the name above the role (role text set by syncRole); the static markup still has avatar + "Owner ▾"
    var oldRole = btn.querySelector('.role');
    if (oldRole) { var id = document.createElement('span'); id.className = 'user-id'; id.setAttribute('aria-hidden', 'true'); id.setAttribute('data-i18n-skip', ''); id.innerHTML = '<span class="user-name">Nguyễn Lan</span><span class="user-role"></span>'; oldRole.replaceWith(id); }
    btn.removeAttribute('data-i18n-attr');
    if (I18N) I18N.apply(pop);
    // mock role switch: drives role-based UI (e.g. EK Overview filters)
    pop.querySelectorAll('[data-role]').forEach(function (b) {
      b.addEventListener('click', function () { setRole(b.getAttribute('data-role')); });
    });
    syncRole();
    var sw = pop.querySelector('#dark-switch');
    function syncSwitch() {
      var dark = root.getAttribute('data-theme') === 'dark';
      sw.setAttribute('aria-checked', String(dark));
      pop.querySelector('#dark-state').textContent = dark ? T('shell.dark', 'Tối') : T('shell.light', 'Sáng');
    }
    syncSwitch();
    onLang(function () { syncSwitch(); syncRole(); });
    function focusables() { return pop.querySelectorAll('button, a[href]'); }
    function open() { pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); focusables()[0].focus(); }
    function close(refocus) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); }
    btn.addEventListener('click', function () { if (pop.hidden) open(); else close(true); });
    sw.addEventListener('click', function () {
      setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      syncSwitch();
    });
    document.addEventListener('keydown', function (e) {
      if (pop.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') {
        var f = focusables(), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.addEventListener('mousedown', function (e) { if (!pop.hidden && !wrap.contains(e.target)) close(false); });
  }
  // ---- Settings page (settings.html, [data-settings-page]): ports micro-frontend/web features/settings settings-screen.tsx.
  //  The sidebar lists the sections (NAV), the main area shows one at a time (?s=<section>, switched in place with
  //  pushState so mock state survives). Users & permissions and PII access: System Admin or a knowledge base Owner;
  //  Access log and the whole System group: System Admin only (others get the "no access" state). PII access is its
  //  own page (settings-users-pii.html). Mock state is in memory, except theme / language / sidebar, which use the
  //  shell's localStorage keys. Strings: i18n.js 'set.*' (mockup) and 'set.w.*' (= FE libs/i18n/extra/settings.json web.set.*).
  function initSettings() {
    var pane = document.querySelector('[data-settings-page] #set-pane');
    if (!pane) return;
    var S = function (k, a) { return T(k, I18N ? I18N.dict.vi[k] : k, a); };
    var W = function (k, a) { return S('set.w.' + k, a); };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    var SECTIONS = ['user', 'access', 'general', 'notif', 'users', 'pii', 'audit', 'providers', 'models', 'extractor', 'storage', 'advertise'];
    var ADMIN_ONLY = ['audit', 'providers', 'models', 'extractor', 'storage', 'advertise'];
    // breadcrumb group: [label key, first section of the group]
    var GROUP = { users: ['set.grp.users', 'users'], pii: ['set.grp.users', 'users'], audit: ['set.grp.users', 'users'],
      providers: ['set.grp.system', 'providers'], models: ['set.grp.system', 'providers'], extractor: ['set.grp.system', 'providers'],
      storage: ['set.grp.system', 'providers'], advertise: ['set.grp.system', 'providers'] };
    function navLabel(id) { return id === 'users' || id === 'extractor' || id === 'advertise' ? W('nav.' + id) : S('set.nav.' + id); }
    function isAdmin() { return getRole() === 'admin'; }
    function isOwner() { return getRole() === 'owner'; }   // owns at least one knowledge base (mock: the Owner role)
    function visible(id) { return ADMIN_ONLY.indexOf(id) >= 0 ? isAdmin() : (id !== 'users' && id !== 'pii') || isAdmin() || isOwner(); }

    var digest = 'instant', cur = 'user', tz = 'Asia/Ho_Chi_Minh', toastTimer = null;
    var NOTIF = [['access', 1, 1], ['assign', 1, 1], ['sla', 1, 1], ['jobDone', 1, 0], ['jobFail', 1, 1], ['cr', 1, 1], ['eval', 1, 0], ['mention', 1, 1]];
    var TZ = [['Asia/Ho_Chi_Minh', 'UTC+7'], ['Asia/Singapore', 'UTC+8'], ['Asia/Tokyo', 'UTC+9'], ['UTC', 'UTC+0']];
    // capabilities of GET /me per role (Quyền truy cập)
    var PERMS = { admin: ['all', 'read'], owner: ['read', 'editOwn', 'approveOwn', 'delegate'], steward: ['read', 'edit', 'review'], consumer: ['read'] };
    var pw = { err: {} };
    // ---- Users & permissions (admin): account requests, users, identity groups; status changes need a reason
    var AR = [
      { id: 'ar1', email: 'quang.ngo@msb.com.vn', name: 'Ngô Quang', verified: true, at: '2026-11-03T15:20:00+07:00' },
      { id: 'ar2', email: 'thao.le.partner@gmail.com', name: null, verified: false, at: '2026-11-04T08:05:00+07:00' }
    ];
    var arPending = null;   // { id, decision, role, err }
    var USERS = [
      { id: 'nl', name: 'Nguyễn Lan', mail: 'lan.nguyen@msb.com.vn', dept: 'Khối Dữ liệu & Phân tích', role: null, on: true, last: '2026-10-27T09:02:00+07:00' },
      { id: 'hv', name: 'Hoàng Vy', mail: 'vy.hoang@msb.com.vn', dept: 'Khối Ngân hàng số', role: 'steward', on: true, last: '2026-10-27T08:12:00+07:00' },
      { id: 'tm', name: 'Trần Minh', mail: 'minh.tran@msb.com.vn', dept: 'Khối Khách hàng cá nhân', role: 'owner', on: true, last: '2026-10-26T17:40:00+07:00' },
      { id: 'ph', name: 'Phạm Hà', mail: 'ha.pham@msb.com.vn', dept: 'Khối Pháp chế & Tuân thủ', role: 'owner', on: true, last: '2026-10-26T15:05:00+07:00' },
      { id: 'tma', name: 'Tạ Mai', mail: 'mai.ta@msb.com.vn', dept: 'Khối Vận hành', role: 'steward', on: true, last: '2026-10-25T10:20:00+07:00' },
      { id: 'nq', name: 'Ngô Quân', mail: 'quan.ngo@msb.com.vn', dept: 'Khối Nhân sự', role: 'steward', on: true, last: '2026-10-24T14:31:00+07:00' },
      { id: 'th', name: 'Trần Hải', mail: 'hai.tran@msb.com.vn', dept: 'Khối Khách hàng doanh nghiệp', role: 'consumer', on: true, last: '2026-10-22T09:47:00+07:00' },
      { id: 'lt', name: 'Lê Thu', mail: 'thu.le@msb.com.vn', dept: 'Khối Công nghệ', role: 'consumer', on: false, last: null }
    ];
    var GROUPS = [['ECP-Admins', 'admin', 2], ['ECP-KB-Owners', 'owner', 14], ['ECP-KB-Stewards', 'steward', 37], ['ECP-All-Staff', 'consumer', 1820]];
    var lastSync = '2026-10-27T06:00:00+07:00', uRole = 'all', pending = null, auType = 'all';
    // ---- Stewards & delegated permissions (owner): per owned knowledge base, the stewards and their approval permissions
    var PERM_KEY = { EVOLUTION: 'kbc.approveEvolution', CHANGES: 'kbc.approveChanges', AGENT: 'kbc.approveChangesFromAgent' }, PERM_IDS = ['EVOLUTION', 'CHANGES', 'AGENT'];
    var DKB = [{ id: 'kb-credit', name: 'Quy trình tín dụng doanh nghiệp' }, { id: 'kb-card', name: 'Chính sách thẻ' }];
    var DELEG = {
      'kb-credit': [{ name: 'Hoàng Vy', mail: 'vy.hoang@msb.com.vn', status: 'ACTIVE', perms: ['EVOLUTION', 'CHANGES'] }, { name: 'Tạ Mai', mail: 'mai.ta@msb.com.vn', status: 'REVOKED', perms: ['CHANGES'] },
        { name: 'Ngô Quân', mail: 'quan.ngo@msb.com.vn', status: 'NONE', perms: [] }],
      'kb-card': [{ name: 'Phạm Hà', mail: 'ha.pham@msb.com.vn', status: 'ACTIVE', perms: ['CHANGES', 'AGENT'] }]
    };
    var dKb = params.get('kb'), dErr = null;
    // access audit, newest first
    var AUDIT = [
      { at: '2026-10-27T06:00:00+07:00', actor: null, target: null, type: 'sync', ref: null },
      { at: '2026-10-26T16:40:00+07:00', actor: 'Nguyễn Lan', target: 'Tạ Mai', type: 'role', a: 'consumer', b: 'steward', ref: 'CR-041' },
      { at: '2026-10-25T09:05:00+07:00', actor: null, target: 'Lê Thu', type: 'off', ref: 'HR-2291' },
      { at: '2026-10-24T11:15:00+07:00', actor: 'Trần Minh', target: 'Hoàng Vy', type: 'deleg', d: null, ref: 'Quy trình tín dụng doanh nghiệp' },
      { at: '2026-10-21T14:02:00+07:00', actor: 'Nguyễn Lan', target: 'Trần Hải', type: 'role', a: 'steward', b: 'consumer', ref: 'Rà soát quyền Q3' }
    ];
    var AU_FILTER = { role: ['role'], status: ['off', 'on'], deleg: ['deleg', 'delegRevoke'], sync: ['sync'] };

    // ---- Providers (services/settings catalogue): types by method, saved connections, models per connection
    var F = function (key, kind, req, ph, opts) { return { key: key, kind: kind || 'TEXT', req: req !== false, ph: ph || '', opts: opts || [] }; };
    var M = function (name, kind, fam) { return { name: name, kind: kind, fam: fam || '' }; };
    var SON = 'global.anthropic.claude-sonnet-5-5', HAI = 'global.anthropic.claude-haiku-5-5', OPU = 'global.anthropic.claude-opus-5-5';
    var AZ_M = [M('gpt-4.1', 'LLM'), M('gpt-4.1', 'VLM'), M('text-embedding-3-large', 'EMBED', 'openai-text-embedding-3-large')];
    var GE_M = [M('gemini-2.5-pro', 'LLM'), M('gemini-2.5-flash', 'LLM'), M('gemini-2.5-pro', 'VLM'), M('gemini-2.5-flash', 'VLM'), M('text-embedding-004', 'EMBED', 'google-text-embedding-004')];
    var PTYPES = [
      { type: 'OPENAI', method: 'API_KEY', name: 'OpenAI', disc: true, fields: [F('apiKey', 'SECRET', true, 'sk-…'), F('baseUrl', 'TEXT', false, 'https://api.openai.com/v1')],
        sugg: [M('gpt-5.5', 'LLM'), M('gpt-4.1', 'LLM'), M('gpt-4.1-mini', 'LLM'), M('gpt-5.5', 'VLM'), M('gpt-4.1', 'VLM'), M('text-embedding-3-large', 'EMBED', 'openai-text-embedding-3-large')] },
      { type: 'ANTHROPIC', method: 'API_KEY', name: 'Anthropic', disc: true, fields: [F('apiKey', 'SECRET', true, 'sk-ant-…'), F('baseUrl', 'TEXT', false, 'https://api.anthropic.com')],
        sugg: [M('claude-opus-5-5', 'LLM'), M('claude-sonnet-5-5', 'LLM'), M('claude-haiku-5-5', 'LLM'), M('claude-opus-5-5', 'VLM'), M('claude-sonnet-5-5', 'VLM')] },
      { type: 'GEMINI', method: 'API_KEY', name: 'Google Gemini', fields: [F('apiKey', 'SECRET', true, 'AIza…')], sugg: GE_M },
      { type: 'COHERE', method: 'API_KEY', name: 'Cohere', fields: [F('apiKey', 'SECRET')],
        sugg: [M('command-a-03-2025', 'LLM'), M('embed-multilingual-v3.0', 'EMBED', 'cohere-embed-multilingual-v3'), M('rerank-v3.5', 'RERANK')] },
      { type: 'AZURE_OPENAI', method: 'API_KEY', name: 'Azure OpenAI', fields: [F('endpoint', 'TEXT', true, 'https://<resource>.openai.azure.com'), F('apiKey', 'SECRET'), F('apiVersion', 'TEXT', true, '2024-10-21')], sugg: AZ_M },
      { type: 'OPENAI_COMPATIBLE', method: 'COMPATIBLE', name: 'OpenAI-compatible (OmniRoute, vLLM, GreenNode)', disc: true, fields: [F('baseUrl', 'TEXT', true, 'http://localhost:20128/v1'), F('apiKey', 'SECRET', false, 'sk-…')], sugg: [] },
      { type: 'ANTHROPIC_COMPATIBLE', method: 'COMPATIBLE', name: 'Anthropic-compatible (LiteLLM proxy, OmniRoute)', disc: true, fields: [F('baseUrl', 'TEXT', true, 'http://localhost:4000'), F('apiKey', 'SECRET', false, 'sk-…')], sugg: [] },
      { type: 'AZURE_OPENAI_ENTRA', method: 'OAUTH', name: 'Azure OpenAI (Entra ID)', fields: [F('endpoint', 'TEXT', true, 'https://<resource>.openai.azure.com'), F('apiVersion', 'TEXT', true, '2024-10-21'), F('tenantId'), F('clientId'), F('clientSecret', 'SECRET')], sugg: AZ_M },
      { type: 'VERTEX_AI', method: 'OAUTH', name: 'Google Vertex AI', fields: [F('projectId', 'TEXT', true, 'my-gcp-project'), F('location', 'TEXT', true, 'asia-southeast1'), F('serviceAccountJson', 'SECRET_MULTILINE', true, '{"type": "service_account", …}')], sugg: GE_M },
      { type: 'BEDROCK', method: 'OAUTH', name: 'AWS Bedrock', fields: [F('region', 'SELECT', true, '', ['ap-southeast-1', 'us-east-1', 'us-west-2']), F('auth', 'SELECT', true, '', ['IAM role', 'Access key']), F('roleArn', 'TEXT', false, 'arn:aws:iam::<account>:role/ecp-bedrock')],
        sugg: [M(SON, 'LLM'), M(HAI, 'LLM'), M(OPU, 'LLM'), M(SON, 'VLM'), M(OPU, 'VLM'), M('cohere.embed-multilingual-v3', 'EMBED', 'cohere-embed-multilingual-v3'), M('amazon.titan-embed-text-v2:0', 'EMBED', 'amazon-titan-embed-text-v2'), M('cohere.rerank-v3-5:0', 'RERANK')] }
    ];
    var METHODS = ['API_KEY', 'COMPATIBLE', 'OAUTH'], METHOD_KEY = { API_KEY: 'apiKey', COMPATIBLE: 'compatible', OAUTH: 'oauth' };
    var KINDS = ['LLM', 'VLM', 'EMBED', 'RERANK'];
    function ptype(t) { return PTYPES.filter(function (x) { return x.type === t; })[0]; }
    function copy(o) { return JSON.parse(JSON.stringify(o)); }
    var seq = 10;
    var CONNS = [
      { id: 'c1', name: 'Bedrock Singapore', type: 'BEDROCK', on: true, values: { region: 'ap-southeast-1', auth: 'IAM role', roleArn: 'arn:aws:iam::482113:role/ecp-bedrock' }, cred: null,
        models: copy(ptype('BEDROCK').sugg), test: { ok: true, ms: 412, at: '2026-10-27T08:10:00+07:00' } },
      { id: 'c2', name: 'OpenAI', type: 'OPENAI', on: true, values: {}, cred: '••••a91c', models: copy(ptype('OPENAI').sugg), test: { ok: true, ms: 380, at: '2026-10-26T16:02:00+07:00' } },
      { id: 'c3', name: 'Cohere', type: 'COHERE', on: true, values: {}, cred: '••••7f2a', models: copy(ptype('COHERE').sugg), test: { ok: true, ms: 120, at: '2026-10-26T16:05:00+07:00' } },
      { id: 'c4', name: 'OmniRoute nội bộ', type: 'OPENAI_COMPATIBLE', on: false, values: { baseUrl: 'http://omniroute.ecp.internal:20128/v1' }, cred: null,
        models: [M('qwen3-72b-instruct', 'LLM')], test: { ok: false, code: 'DEPENDENCY_UNAVAILABLE', at: '2026-10-20T11:30:00+07:00' } }
    ];
    // discovery (Lấy danh sách mô hình): what the provider lists, by connection type
    var DISCOVER = { OPENAI: [['gpt-5.5', 'LLM'], ['gpt-5.5-mini', 'LLM'], ['o4-mini', null], ['text-embedding-3-small', 'EMBED']],
      OPENAI_COMPATIBLE: [['qwen3-72b-instruct', 'LLM'], ['qwen2.5-vl-72b', 'VLM'], ['bge-m3', 'EMBED'], ['bge-reranker-v2-m3', null]],
      ANTHROPIC: [['claude-opus-5-5', 'LLM']], ANTHROPIC_COMPATIBLE: [['claude-sonnet-5-5', 'LLM']] };
    var openConn = null, pcDetail = null;   // pcDetail = { id, rows, found, picked, err, failure }
    // ---- Models (settings.yaml model-settings): role → main model (connection/model, null = env var) + fallbacks
    var ROLES = [['LLM', 'LLM', 'ECP_LLM_MODEL'], ['FAST', 'LLM', 'ECP_LLM_FAST_MODEL'], ['GRAPH', 'LLM', 'ECP_GRAPH_LLM_MODEL'], ['CHUNK', 'LLM', 'ECP_CHUNK_LLM_MODEL'],
      ['VLM', 'VLM', 'ECP_VLM_MODEL'], ['OCR', 'VLM', 'ECP_OCR_MODEL'], ['EMBED', 'EMBED', 'ECP_EMBED_MODEL'], ['RERANK', 'RERANK', 'ECP_RERANK_MODEL']];
    var R = function (c, m) { return { c: c, m: m }; };
    var mSaved = {
      LLM: { model: R('c1', SON), fb: [R('c2', 'gpt-5.5')] }, FAST: { model: R('c1', HAI), fb: [R('c2', 'gpt-4.1-mini')] },
      GRAPH: { model: R('c2', 'gpt-5.5'), fb: [R('c1', SON)] }, CHUNK: { model: R('c2', 'gpt-5.5'), fb: [] },
      VLM: { model: R('c1', SON), fb: [R('c2', 'gpt-5.5')] }, OCR: { model: null, fb: [] },
      EMBED: { model: R('c3', 'embed-multilingual-v3.0'), fb: [R('c1', 'cohere.embed-multilingual-v3')] },
      RERANK: { model: R('c3', 'rerank-v3.5'), fb: [R('c1', 'cohere.rerank-v3-5:0')], topN: 8 }
    };
    var mDraft = copy(mSaved), mTested = null, mTesting = false;
    // ---- Extractor (settings.yaml extractor-settings)
    var ENG = { pdfText: ['DOCLING', 'VLM_OCR'], pdfScanned: ['VLM_OCR'], image: ['VLM_OCR'], office: ['DOCLING'] };
    var EX = {
      graph: { concurrency: ['int', 1, 32, 'ECP_GRAPH_LLM_CONCURRENCY'], entityMatchThreshold: ['num', 0.5, 1, 'ECP_ENTITY_MATCH_THRESHOLD'], tagMinConfidence: ['num', 0, 1, 'ECP_TAG_MIN_CONFIDENCE'] },
      chunking: { windowChars: ['int', 2000, 100000, 'ECP_CHUNK_WINDOW_CHARS'], embedMaxChars: ['int', 0, 100000, 'ECP_EMBED_MAX_CHARS'] },
      ocr: { timeoutSeconds: ['int', 10, 3600, 'ECP_OCR_TIMEOUT_S'], scanConcurrency: ['int', 1, 64, 'ECP_SCAN_CONCURRENCY'], vlmConcurrency: ['int', 1, 32, 'ECP_VLM_CONCURRENCY'],
        maxPages: ['int', 1, 5000, 'ECP_MAX_PAGES'], renderDpi: ['int', 72, 600, 'ECP_RENDER_DPI'], textLayerMinChars: ['int', 0, 1000, 'ECP_TEXT_LAYER_MIN_CHARS'] },
      media: { describeModel: ['text', 0, 0, 'ECP_MEDIA_DESCRIBE_MODEL'], textEmbedModel: ['text', 0, 0, 'ECP_MEDIA_TEXT_EMBED_MODEL'], imageEmbedModel: ['ntext', 0, 0, 'ECP_MEDIA_IMAGE_EMBED_MODEL'], concurrency: ['int', 1, 32, 'ECP_MEDIA_CONCURRENCY'] },
      docling: { threads: ['int', 1, 64, 'ECP_DOCLING_THREADS'], imagesScale: ['num', 1, 4], cropMarginPx: ['int', 0, 64, 'ECP_CROP_MARGIN_PX'], tableStructure: ['bool'], pictureClassification: ['bool'] }
    };
    var exSaved = { engines: { pdfText: 'DOCLING', pdfScanned: 'VLM_OCR', image: 'VLM_OCR', office: 'DOCLING' },
      'graph.concurrency': '4', 'graph.entityMatchThreshold': '0.85', 'graph.tagMinConfidence': '0.6', 'chunking.windowChars': '12000', 'chunking.embedMaxChars': '8000',
      'ocr.timeoutSeconds': '300', 'ocr.scanConcurrency': '8', 'ocr.vlmConcurrency': '4', 'ocr.maxPages': '500', 'ocr.renderDpi': '200', 'ocr.textLayerMinChars': '50',
      'media.describeModel': 'bedrock/global.anthropic.claude-sonnet-5-5', 'media.textEmbedModel': 'cohere/embed-multilingual-v3.0', 'media.imageEmbedModel': '', 'media.concurrency': '4',
      'docling.threads': '4', 'docling.imagesScale': '2', 'docling.cropMarginPx': '8', 'docling.tableStructure': true, 'docling.pictureClassification': false,
      by: 'Nguyễn Lan', at: '2026-10-20T10:12:00+07:00' };
    var exDraft = copy(exSaved), exErr = {}, exAdv = false;
    // ---- Advertise visual (login slides)
    var MAX_SLIDES = 12, MAX_BYTES = 5 * 1024 * 1024;
    var SLIDES = [{ id: 'ad1', url: 'assets/msb_symbol.svg', w: 1080, h: 1350, kb: 182 }, { id: 'ad2', url: 'assets/msb_logo_black.svg', w: 1080, h: 1350, kb: 96 }], adErr = null;
    // ---- Storage (settings.yaml store-admin)
    var STYPES = [{ type: 'S3', name: 'S3-compatible (MinIO, AWS S3)', stores: ['OBJECT'], fields: [F('endpoint', 'TEXT', true, 'https://storage.example.test:9000'), F('region', 'TEXT', false, 'us-east-1'), F('accessKey'), F('secretKey', 'SECRET')] },
      { type: 'NEO4J', name: 'Neo4j', stores: ['GRAPH', 'VECTOR'], fields: [F('uri', 'TEXT', true, 'neo4j+s://graph.example.test:7687'), F('username', 'TEXT', true, 'neo4j'), F('password', 'SECRET')] }];
    var UNSUPPORTED = ['PostgreSQL', 'pgvector (PostgreSQL)', 'ParadeDB (PostgreSQL)', 'Apache AGE + pgvector (PostgreSQL)', 'Milvus', 'Weaviate', 'MongoDB', 'Redis'];
    var SCONNS = [
      { id: 's1', name: 'MinIO nội bộ', type: 'S3', values: { endpoint: 'https://minio.ecp.internal:9000', accessKey: 'ecp-svc' }, cred: '••••q8Zt', test: { ok: true, ms: 18, at: '2026-10-27T07:40:00+07:00' } },
      { id: 's2', name: 'Neo4j Graph', type: 'NEO4J', values: { uri: 'neo4j+s://graph.ecp.internal:7687', username: 'neo4j' }, cred: '••••9k2q', test: { ok: true, ms: 42, at: '2026-10-27T07:41:00+07:00' } }
    ];
    var stSaved = { OBJECT: 's1', VECTOR: 's2', GRAPH: 's2', by: 'Nguyễn Lan', at: '2026-10-12T09:30:00+07:00' }, stDraft = copy(stSaved);
    var BUCKETS = [['ecp-landing', 'landing', 412.6, 18240], ['ecp-content', 'content', 96.3, 2104512]];
    var NEO = { version: '5.26.2', edition: 'enterprise', dbs: [
      { name: 'kb-credit', status: 'online', nodes: 18240, rels: 52110, idx: [['chunk_embedding', 'ONLINE', 100]] },
      { name: 'kb-card', status: 'online', nodes: 6402, rels: 15873, idx: [['chunk_embedding', 'POPULATING', 62.5]] },
      { name: 'kb-aml', status: 'offline', nodes: null, rels: null, idx: [] }] };

    // ---- helpers
    function fmtTime(d) { return I18N.fmtDate(d, { dateStyle: 'short', timeStyle: 'short', timeZone: tz }); }
    function fmtMed(d) { return I18N.fmtDate(d, { dateStyle: 'medium', timeStyle: 'short' }); }
    function fmtDay(v) { return I18N.fmtDate(v + 'T12:00:00Z', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }); }
    function num(n, o) { return I18N.fmtNum(n, o); }
    function row(lbl, hint, ctl) {
      return '<div class="set-row"><div><div class="set-lbl">' + lbl + '</div>' + (hint ? '<div class="set-hint">' + hint + '</div>' : '') + '</div><div class="set-ctl">' + ctl + '</div></div>';
    }
    function foot(btns) { return '<div class="set-foot">' + btns + '</div>'; }
    function chip(cls, txt) { return '<span class="chip ' + cls + '">' + txt + '</span>'; }
    function btn(cls, attrs, txt) { return '<button class="btn ' + cls + '" type="button" ' + attrs + '>' + txt + '</button>'; }
    function banner(kind, txt) { return '<div class="banner banner-' + kind + '"' + (kind === 'error' ? ' role="alert"' : '') + '><span class="icon" aria-hidden="true">' + (kind === 'info' ? 'i' : '!') + '</span><span>' + txt + '</span></div>'; }
    // Field (components/ui/field): label, control, hint, error
    function field(id, label, ctl, o) {
      o = o || {};
      var desc = [o.hint && id + '-hint', o.err && id + '-err'].filter(Boolean).join(' ');
      if (!/aria-describedby=/.test(ctl)) ctl = ctl.replace(/^(<\w+)/, '$1' + (o.req ? ' aria-required="true"' : '') + (o.err ? ' aria-invalid="true"' : '') + (desc ? ' aria-describedby="' + desc + '"' : ''));
      return '<div class="field' + (o.err ? ' has-error' : '') + (o.cls ? ' ' + o.cls : '') + '"><label for="' + id + '">' + label + '</label>' + ctl +
        (o.hint ? '<p class="field-hint" id="' + id + '-hint">' + o.hint + '</p>' : '') + '<p class="field-err" id="' + id + '-err" aria-live="polite"' + (o.err ? '' : ' hidden') + '>' + (o.err || '') + '</p></div>';
    }
    function sw(attrs, on, label) { return '<button class="switch" type="button" role="switch" ' + attrs + ' aria-checked="' + !!on + '"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '></button>'; }
    function initials(n) { return n.split(/\s+/).map(function (w) { return w[0]; }).slice(-2).join('').toUpperCase(); }
    function themePref() { var s = null; try { s = localStorage.getItem('ecp-theme'); } catch (e) {} return s || 'system'; }
    function noAccess() { return '<div class="empty set-state" role="status"><div class="empty-title">' + W('noAccessTitle') + '</div><p class="empty-body">' + W('noAccessBody') + '</p></div>'; }
    function connById(id) { return CONNS.filter(function (c) { return c.id === id; })[0]; }
    function sconnById(id) { return SCONNS.filter(function (c) { return c.id === id; })[0]; }
    function roleLabel(r) { return S('set.m.role.' + r.toLowerCase()); }
    function kindLabel(k) { return S('set.nav.' + k.toLowerCase()); }
    function fieldLabel(k) { return I18N && I18N.dict.vi['set.w.pc.f.' + k] ? W('pc.f.' + k) : k; }
    var PC_ERR = { PROVIDER_AUTH_FAILED: 'authFailed', MODEL_REJECTED: 'modelRejected', DEPENDENCY_UNAVAILABLE: 'unavailable', DEPENDENCY_TIMEOUT: 'timeout' };
    function pcErr(code) { return PC_ERR[code] ? W('pc.code.' + PC_ERR[code]) : W('pc.code.other', { code: code || '—' }); }
    function pcResult(r) { return r.ok ? W('pc.testOk', { ms: num(r.ms) }) : W('pc.testFail', { reason: pcErr(r.code) }); }
    function sameRef(a, b) { return !!a && !!b && a.c === b.c && a.m === b.m; }
    function usesConn(s, id) { return (s.model && s.model.c === id) || s.fb.some(function (f) { return f.c === id; }); }
    function usedBy(c) { return ROLES.filter(function (r) { return usesConn(mSaved[r[0]], c.id); }).map(function (r) { return r[0]; }); }
    function storesOf(c) { return ['OBJECT', 'VECTOR', 'GRAPH'].filter(function (k) { return stSaved[k] === c.id; }); }
    function storeLabel(k) { return W('st.store.' + k.toLowerCase()); }
    function say(msg) {
      var t = document.getElementById('set-toast');
      if (!t) { t = document.createElement('div'); t.id = 'set-toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
      t.textContent = msg; t.hidden = false;
      clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
    }
    // confirm dialog (components/ui/confirm-dialog): small dialog, Cancel (secondary) + confirm (danger)
    function confirmDlg(o, ok) {
      var d = document.createElement('dialog'); d.className = 'q-dialog';
      d.innerHTML = '<h2>' + esc(o.title) + '</h2><p class="qd-body">' + esc(o.body) + '</p><div class="qd-foot">' + btn('btn-secondary', 'data-no', S('q.dlgCancel')) + btn('btn-danger', 'data-ok', esc(o.confirm)) + '</div>';
      var opener = document.activeElement;
      document.body.appendChild(d);
      d.addEventListener('close', function () { d.remove(); if (opener && opener.isConnected) opener.focus(); });
      d.querySelector('[data-no]').addEventListener('click', function () { d.close(); });
      d.querySelector('[data-ok]').addEventListener('click', function () { d.close(); ok(); });
      d.showModal();
    }
    // large dialog (components/ui/dialog size lg): head (title + ×), body, footer; a click outside does not close it
    var dlg = null;
    function openDlg(title, draw, onClose) {
      var d = document.createElement('dialog'); d.className = 'q-dlg set-pc-dlg';
      d.setAttribute('aria-labelledby', 'set-dlg-t');
      d.innerHTML = '<div class="q-dlg-head"><h2 class="modal-title job-ell" id="set-dlg-t">' + esc(title) + '</h2><button class="icon-btn" type="button" data-dlg-x aria-label="' + S('common.close') + '"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="set-page set-pc-dlg-body"></div><div class="q-dlg-foot"></div>';
      var opener = document.activeElement;
      document.body.appendChild(d);
      dlg = { el: d, draw: draw };
      d.addEventListener('close', function () { d.remove(); dlg = null; if (onClose) onClose(); if (opener && opener.isConnected) opener.focus(); });
      d.querySelector('[data-dlg-x]').addEventListener('click', function () { d.close(); });
      redrawDlg();
      d.showModal();
      return d;
    }
    var redrawing = false;
    function redrawDlg(focusSel) {
      if (!dlg || redrawing) return;
      var a = document.activeElement, keep = a && dlg.el.contains(a) && a.id ? '#' + a.id : null;
      // blur first: a field's pending "change" fires now (and is folded into this redraw), not while its node is replaced
      redrawing = true; if (keep) a.blur(); redrawing = false;
      var h = dlg.draw();
      dlg.el.querySelector('.set-pc-dlg-body').innerHTML = h[0];
      dlg.el.querySelector('.q-dlg-foot').innerHTML = h[1];
      var f = dlg.el.querySelector(focusSel || keep || '#__none'); if (f) f.focus();
    }
    // ⋮ row menu (components/ui/dropdown-menu): items [key, label, danger, separated, disabled]
    var menu = null;
    function closeMenu(refocus) { if (!menu) return; var b = menu.btn; menu.el.remove(); b.setAttribute('aria-expanded', 'false'); menu = null; if (refocus) b.focus(); }
    function openMenu(b, items, onPick) {
      closeMenu();
      var m = document.createElement('div'); m.className = 'menu set-pc-menu'; m.setAttribute('role', 'menu');
      m.innerHTML = items.map(function (x) {
        return (x[3] ? '<div class="menu-sep" role="separator"></div>' : '') + '<button class="menu-item' + (x[2] ? ' is-danger' : '') + '" type="button" role="menuitem" data-mi="' + x[0] + '"' + (x[4] ? ' disabled' : '') + '>' + x[1] + '</button>';
      }).join('');
      document.body.appendChild(m);
      var r = b.getBoundingClientRect();
      m.style.position = 'fixed'; m.style.top = (r.bottom + 4) + 'px'; m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
      b.setAttribute('aria-expanded', 'true');
      menu = { el: m, btn: b };
      m.addEventListener('click', function (e) { var it = e.target.closest('[data-mi]'); if (!it || it.disabled) return; closeMenu(true); onPick(it.getAttribute('data-mi')); });
      m.addEventListener('keydown', function (e) {
        var its = [].slice.call(m.querySelectorAll('.menu-item:not([disabled])')), i = its.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); its[(i + (e.key === 'ArrowDown' ? 1 : its.length - 1)) % its.length].focus(); }
        else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(true); }
      });
      var first = m.querySelector('.menu-item:not([disabled])'); if (first) first.focus();
    }
    document.addEventListener('mousedown', function (e) { if (menu && !menu.el.contains(e.target) && e.target !== menu.btn) closeMenu(false); });

    // ---- 1. account
    function userPane() {
      return '<div class="set-profile" data-i18n-skip><span class="avatar" aria-hidden="true">NL</span><div><div class="set-lbl">Nguyễn Lan</div><div class="set-hint">lan.nguyen@msb.com.vn</div></div></div>' +
        '<dl class="kv set-kv">' + [['dept', 'Khối Dữ liệu & Phân tích'], ['title', 'Trưởng nhóm Quản trị tri thức'], ['empId', 'MSB-04821'], ['signIn', 'SSO MSB']].map(function (x) {
          return '<dt>' + S('set.a.' + x[0]) + '</dt><dd data-i18n-skip>' + esc(x[1]) + '</dd>';
        }).join('') + '</dl>' + banner('info', S('set.a.ssoNote'));
    }
    function accessPane() {
      var r = getRole(), e = pw.err;
      return row(S('set.x.sysRole'), S('set.x.sysRoleHint'), chip('chip-info', ROLE_LABEL[r])) +
        '<h2 class="set-lbl set-sec">' + S('set.x.perms') + '</h2><ul class="set-list">' + PERMS[r].map(function (k) { return '<li>' + S('set.x.p.' + k) + '</li>'; }).join('') + '</ul>' +
        '<p class="set-hint mt-16">' + S('set.x.more') + '</p>' +
        // change password (identity-sections.tsx ChangePassword)
        '<h2 class="set-lbl set-sec">' + W('pw.title') + '</h2>' + (params.get('state') === 'sso' ? '<p class="set-hint">' + W('pw.ssoOnly') + '</p>' : '<form class="set-pw" data-set-pwform novalidate>' +
        field('set-pw-current', W('pw.current'), '<input class="input" id="set-pw-current" type="password" autocomplete="current-password" required>', { req: true, err: e.current }) +
        field('set-pw-next', W('pw.next'), '<input class="input" id="set-pw-next" type="password" autocomplete="new-password" maxlength="128" required>', { req: true, hint: W('pw.hint'), err: e.next }) +
        field('set-pw-confirm', W('pw.confirm'), '<input class="input" id="set-pw-confirm" type="password" autocomplete="new-password" maxlength="128" required>', { req: true, err: e.confirm }) +
        '<div><button class="btn btn-primary" type="submit">' + W('pw.submit') + '</button></div></form>');
    }
    // ---- 2. preferences
    function generalPane() {
      var tp = themePref(), sb = null; try { sb = localStorage.getItem('ecp-sidebar'); } catch (e) {}
      var lang = I18N ? I18N.lang : 'vi';
      return row(S('set.g.theme'), S('set.g.themeHint'), '<span class="segmented" role="group" aria-label="' + S('set.g.theme') + '">' + ['light', 'dark', 'system'].map(function (v) {
          return '<button type="button" data-set-theme="' + v + '" aria-pressed="' + (tp === v) + '">' + S('set.g.theme.' + v) + '</button>';
        }).join('') + '</span>') +
        row('Ngôn ngữ / Language', S('set.g.langHint'), '<span class="lang-seg" role="group" aria-label="Ngôn ngữ / Language" data-exclusive data-lang-switch data-i18n-skip><button type="button" lang="vi" data-lang="vi" aria-label="Tiếng Việt" aria-pressed="' + (lang === 'vi') + '">VI</button><button type="button" lang="en" data-lang="en" aria-label="English" aria-pressed="' + (lang === 'en') + '">EN</button></span>') +
        row(S('set.g.sidebar'), S('set.g.sidebarHint'), sw('data-set-sidebar="1"', sb === 'collapsed', S('set.g.sidebar'))) +
        row(S('set.g.tz'), S('set.g.tzHint'), '<select class="select" data-set-tz="1" aria-label="' + S('set.g.tz') + '">' + TZ.map(function (z) {
          return '<option value="' + z[0] + '"' + (z[0] === tz ? ' selected' : '') + '>' + z[0] + ' · ' + z[1] + '</option>';
        }).join('') + '</select>') +
        row(S('set.g.format'), S('set.g.formatHint'), '<span class="mono">' + esc(num(1234567.89) + ' · ' + I18N.fmtDate(new Date(), { dateStyle: 'medium', timeStyle: 'short', timeZone: tz })) + '</span>');
    }
    function notifPane() {
      return '<div class="table-wrap"><table class="table table-dense set-notif"><thead><tr><th scope="col">' + S('set.n.event') + '</th><th scope="col">' + S('set.n.inapp') + '</th><th scope="col">Email</th></tr></thead><tbody>' +
        NOTIF.map(function (n, i) {
          return '<tr><td>' + S('set.n.' + n[0]) + '</td>' + [1, 2].map(function (c) {
            return '<td><input type="checkbox" data-set-notif="' + i + ':' + c + '"' + (n[c] ? ' checked' : '') + ' aria-label="' + S('set.n.' + n[0]) + ' · ' + (c === 1 ? S('set.n.inapp') : 'Email') + '"></td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        row(S('set.n.digest'), S('set.n.digestHint'), '<select class="select" data-set-digest="1" aria-label="' + S('set.n.digest') + '">' + ['instant', 'daily', 'off'].map(function (v) {
          return '<option value="' + v + '"' + (digest === v ? ' selected' : '') + '>' + S('set.n.digest.' + v) + '</option>';
        }).join('') + '</select>') +
        foot(btn('btn-primary', 'data-set-save="notif"', S('set.save')));
    }
    // ---- 3. users & permissions
    function accountRequests() {
      var h = '<h2 class="set-lbl set-sec">' + W('ar.title') + '</h2>';
      if (!AR.length) return h + '<p class="set-hint">' + W('ar.empty') + '</p>';
      return h + '<div class="table-wrap"><table class="table table-dense"><thead><tr><th scope="col">Email</th><th scope="col">' + W('ar.requested') + '</th><th scope="col">' + W('ar.verified') + '</th><th scope="col"><span class="sr-only">' + S('set.x.actions') + '</span></th></tr></thead><tbody>' +
        AR.map(function (r) {
          var tr = '<tr><td data-i18n-skip><div>' + esc(r.email) + '</div>' + (r.name ? '<div class="set-hint">' + esc(r.name) + '</div>' : '') + '</td><td class="nowrap">' + fmtTime(r.at) + '</td>' +
            '<td>' + chip(r.verified ? 'chip-success' : 'chip-warning', W(r.verified ? 'ar.yes' : 'ar.no')) + '</td>' +
            '<td class="ta-r nowrap">' + btn('btn-ghost btn-sm', 'data-set-ar="' + r.id + ':APPROVE" aria-label="' + esc(W('ar.approve') + ' · ' + r.email) + '"' + (r.verified ? '' : ' disabled title="' + esc(W('ar.notVerified')) + '"'), W('ar.approve')) +
            btn('btn-ghost btn-sm', 'data-set-ar="' + r.id + ':REJECT" aria-label="' + esc(W('ar.reject') + ' · ' + r.email) + '"', W('ar.reject')) + '</td></tr>';
          var p = arPending && arPending.id === r.id ? arPending : null;
          if (p) {
            var ap = p.decision === 'APPROVE';
            tr += '<tr class="set-upend"><td colspan="4"><div class="set-pend">' +
              (ap ? '<select class="select input-sm" data-set-arrole="1" aria-label="' + W('ar.role') + '">' + ['admin', 'owner', 'steward', 'consumer'].map(function (x) { return '<option value="' + x + '"' + (x === p.role ? ' selected' : '') + '>' + ROLE_LABEL[x] + '</option>'; }).join('') + '</select>' : '') +
              '<label for="set-ar-reason">' + W(ap ? 'ar.reasonApprove' : 'ar.reasonReject', { e: esc(r.email) }) + '</label><input class="input" id="set-ar-reason" maxlength="500"' + (p.err ? ' aria-invalid="true" aria-describedby="set-ar-reason-err"' : '') + '>' +
              btn((ap ? 'btn-primary' : 'btn-danger') + ' btn-sm', 'data-set-arok="1"', W(ap ? 'ar.approve' : 'ar.reject')) + btn('btn-ghost btn-sm', 'data-set-arcancel="1"', S('set.cancel')) +
              (p.err ? '<span class="field-err" id="set-ar-reason-err" role="alert">' + S('set.u.needReason') + '</span>' : '') + '</div></td></tr>';
          }
          return tr;
        }).join('') + '</tbody></table></div>';
    }
    function usersAdmin() {
      var me = getRole();
      var list = USERS.filter(function (u) { return uRole === 'all' || (u.role || me) === uRole; });
      return accountRequests() +
        '<h2 class="set-lbl set-sec">' + S('set.nav.users') + '</h2>' +
        row(S('set.u.sync'), S('set.u.syncHint'), '<span class="set-hint">' + S('set.u.lastSync', { t: fmtTime(lastSync) }) + '</span>' + btn('btn-secondary btn-sm', 'data-set-sync="1"', S('set.u.syncNow'))) +
        '<div class="set-toolbar"><label class="sr-only" for="set-u-q">' + S('set.u.search') + '</label><input class="input" type="search" id="set-u-q" data-set-usearch="1" placeholder="' + S('set.u.search') + '">' +
        '<select class="select" data-set-urolef="1" aria-label="' + S('set.u.role') + '"><option value="all">' + S('set.u.allRoles') + '</option>' + ['admin', 'owner', 'steward', 'consumer'].map(function (r) {
          return '<option value="' + r + '"' + (uRole === r ? ' selected' : '') + '>' + ROLE_LABEL[r] + '</option>';
        }).join('') + '</select></div>' +
        (list.length ? '<div class="table-wrap"><table class="table table-dense" id="set-u-table"><thead><tr><th scope="col">' + S('set.u.user') + '</th><th scope="col">' + S('set.u.dept') + '</th><th scope="col">' + S('set.u.role') + '</th><th scope="col">' + S('set.u.status') + '</th><th scope="col">' + S('set.u.lastIn') + '</th><th scope="col"><span class="sr-only">' + S('set.x.actions') + '</span></th></tr></thead><tbody>' +
        list.map(function (u) {
          var self = u.id === 'nl', pend = pending && pending.id === u.id;
          var tr = '<tr data-q="' + esc((u.name + ' ' + u.mail).toLowerCase()) + '"><td data-i18n-skip><div class="set-urow"><span class="avatar" aria-hidden="true">' + esc(initials(u.name)) + '</span><div><div>' + esc(u.name) + (self ? ' ' + chip('chip-neutral', S('set.u.you')) : '') + '</div><div class="set-hint">' + esc(u.mail) + '</div></div></div></td>' +
            '<td data-i18n-skip>' + esc(u.dept || '—') + '</td><td>' + ROLE_LABEL[u.role || me] + '</td>' +
            '<td>' + chip(u.on ? 'chip-success' : 'chip-neutral', S(u.on ? 'set.u.on' : 'set.u.off')) + '</td><td class="nowrap">' + (u.last ? fmtTime(u.last) : '—') + '</td>' +
            '<td class="ta-r">' + (self ? '' : btn('btn-ghost btn-sm', 'data-set-ustatus="' + u.id + '"', S(u.on ? 'set.u.deactivate' : 'set.u.activate'))) + '</td></tr>';
          if (pend) tr += '<tr class="set-upend"><td colspan="6"><div class="set-pend"><label for="set-u-reason">' + S('set.u.reasonFor', { p: esc(u.name) }) + '</label><input class="input" id="set-u-reason" data-set-ureason="1" placeholder="' + S('set.u.reasonPh') + '"' + (pending.err ? ' aria-invalid="true" aria-describedby="set-u-reason-err"' : '') + '>' +
            btn('btn-primary btn-sm', 'data-set-uconfirm="1"', S('set.u.confirm')) + btn('btn-ghost btn-sm', 'data-set-ucancel="1"', S('set.cancel')) +
            (pending.err ? '<span class="field-err" id="set-u-reason-err" role="alert">' + S('set.u.needReason') + '</span>' : '') + '</div></td></tr>';
          return tr;
        }).join('') + '</tbody></table></div>' : '<p class="set-hint">' + W('u.empty') + '</p>') +
        '<p class="set-hint mt-8">' + S('set.u.selfNote') + '</p>' +
        '<h2 class="set-lbl set-sec">' + S('set.u.groups') + '</h2>' +
        '<div class="table-wrap"><table class="table table-dense"><thead><tr><th scope="col">' + S('set.u.group') + '</th><th scope="col">' + S('set.u.role') + '</th><th scope="col" class="ta-r">' + S('set.u.members') + '</th></tr></thead><tbody>' +
        GROUPS.map(function (g) { return '<tr><td class="mono">' + g[0] + '</td><td>' + ROLE_LABEL[g[1]] + '</td><td class="ta-r">' + num(g[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    // delegation-section.tsx: Knowledge Base select → new delegation + delegated stewards
    function delegation() {
      var kb = DKB.some(function (k) { return k.id === dKb; }) ? dKb : DKB[0].id, rows = DELEG[kb];
      var free = rows.filter(function (d) { return d.status !== 'ACTIVE'; }), given = rows.filter(function (d) { return d.status !== 'NONE'; });
      var h = '<div class="set-dkb">' + field('set-d-kb', 'Knowledge Base', '<select class="select" id="set-d-kb" data-set-dkb="1">' + DKB.map(function (k) { return '<option value="' + k.id + '"' + (k.id === kb ? ' selected' : '') + ' data-i18n-skip>' + esc(k.name) + '</option>'; }).join('') + '</select>') + '</div>';
      h += '<h2 class="set-lbl set-sec">' + W('d.newTitle') + '</h2><p class="set-hint">' + W('d.newHint') + '</p>';
      h += free.length ? '<div class="set-dform">' +
          field('set-d-to', S('set.d.to'), '<select class="select" id="set-d-to"><option value="">' + S('set.d.pick') + '</option>' + free.map(function (d) { return '<option data-i18n-skip>' + esc(d.name) + '</option>'; }).join('') + '</select>', { err: dErr }) +
          '<fieldset class="field set-dscope"><legend class="field-label">' + S('set.d.scope') + '</legend><div class="cluster-4">' + PERM_IDS.map(function (p) {
            return '<label class="row"><input type="checkbox" data-set-dperm="' + p + '"> ' + S(PERM_KEY[p]) + '</label>';
          }).join('') + '</div></fieldset></div>' + foot(btn('btn-primary', 'data-set-dcreate="1"', S('set.d.create')))
        : '<p class="set-hint">' + W('d.noSteward') + '</p>';
      h += '<h2 class="set-lbl set-sec">' + S('set.d.given') + '</h2>';
      h += given.length ? '<div class="table-wrap"><table class="table table-dense"><thead><tr><th scope="col">' + S('set.d.to') + '</th><th scope="col">' + S('set.d.scope') + '</th><th scope="col">' + S('set.d.status') + '</th><th scope="col"><span class="sr-only">' + S('set.d.revoke') + '</span></th></tr></thead><tbody>' +
        given.map(function (d) {
          var i = rows.indexOf(d), act = d.status === 'ACTIVE';
          return '<tr><td data-i18n-skip><div>' + esc(d.name) + '</div><div class="set-hint">' + esc(d.mail) + '</div></td><td>' +
            (act ? '<div class="cluster-4">' + PERM_IDS.map(function (p) {
              return '<label class="row"><input type="checkbox" data-set-dtoggle="' + i + ':' + p + '"' + (d.perms.indexOf(p) >= 0 ? ' checked' : '') + ' aria-label="' + esc(S(PERM_KEY[p]) + ' · ' + d.name) + '"> ' + S(PERM_KEY[p]) + '</label>';
            }).join('') + '</div>' : (d.perms.map(function (p) { return S(PERM_KEY[p]); }).join(', ') || '—')) + '</td>' +
            '<td>' + (act ? chip('chip-success', S('set.d.st.active')) : chip('chip-neutral', W('d.revoked'))) + '</td>' +
            '<td class="ta-r">' + (act ? btn('btn-ghost btn-sm', 'data-set-drevoke="' + i + '" aria-label="' + esc(S('set.d.revoke') + ' · ' + d.name) + '"', S('set.d.revoke')) : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="set-hint">' + S('set.d.none') + '</p>';
      return h + '<p class="set-hint mt-16">' + S('set.d.kbNote') + '</p>';
    }
    function usersPane() {
      return (isAdmin() ? usersAdmin() : '') +
        (isOwner() ? '<section class="set-kind set-kind-card mt-16" aria-labelledby="set-perm-h"><h2 class="set-kind-h" id="set-perm-h">' + W('perm.title') + '</h2>' + delegation() + '</section>' : '');
    }
    function auChange(e) {
      if (e.type === 'deleg' && !e.d) return W('au.delegNoEnd');
      return S('set.au.t.' + e.type, { a: e.a ? ROLE_LABEL[e.a] : '', b: e.b ? ROLE_LABEL[e.b] : '', d: e.d ? fmtDay(e.d) : '' });
    }
    function auRows() { return AUDIT.filter(function (e) { return auType === 'all' || AU_FILTER[auType].indexOf(e.type) >= 0; }); }
    function auditPane() {
      var rows = auRows();
      return '<div class="set-toolbar"><label class="sr-only" for="set-au-q">' + S('set.au.search') + '</label><input class="input" type="search" id="set-au-q" data-set-ausearch="1" placeholder="' + S('set.au.search') + '">' +
        '<select class="select" data-set-autype="1" aria-label="' + S('set.au.change') + '"><option value="all">' + S('set.au.allTypes') + '</option>' + ['role', 'status', 'deleg', 'sync'].map(function (k) {
          return '<option value="' + k + '"' + (auType === k ? ' selected' : '') + '>' + S('set.au.f.' + k) + '</option>';
        }).join('') + '</select>' + btn('btn-secondary', 'data-set-auexport="1"', S('set.au.export')) + '</div>' +
        (rows.length ? '<div class="table-wrap"><table class="table table-dense" id="set-au-table"><thead><tr><th scope="col">' + S('set.au.time') + '</th><th scope="col">' + S('set.au.actor') + '</th><th scope="col">' + S('set.au.target') + '</th><th scope="col">' + S('set.au.change') + '</th><th scope="col">' + S('set.au.ref') + '</th></tr></thead><tbody>' +
        rows.map(function (e) {
          var actor = e.actor || S('set.au.system');
          return '<tr data-q="' + esc((actor + ' ' + (e.target || '')).toLowerCase()) + '"><td class="nowrap">' + fmtTime(e.at) + '</td><td data-i18n-skip>' + esc(actor) + '</td><td data-i18n-skip>' + esc(e.target || '—') + '</td><td>' + auChange(e) + '</td><td data-i18n-skip>' + esc(e.ref || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="set-hint">' + W('au.empty') + '</p>');
    }

    // ---- 4. system: providers
    var DOTS = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>';
    function testCell(t, errFn) {
      return t ? '<div class="cluster-2">' + chip(t.ok ? 'chip-success' : 'chip-error', t.ok ? '✓ ' + num(t.ms) + ' ms' : errFn(t.code)) + '<span class="set-hint">' + fmtMed(t.at) + '</span></div>' : '<span class="set-hint">' + W('st.notTested') + '</span>';
    }
    function providersPane() {
      if (pcDetail) return connModels();
      return '<div class="set-pc-bar mt-16">' + btn('btn-primary btn-sm', 'aria-haspopup="dialog" data-set-pcadd="1"', '<span aria-hidden="true">+</span>' + W('st.add')) + '</div>' +
        (CONNS.length ? '<div class="table-wrap set-st-wrap set-pc-wrap mt-8"><table class="table table-dense"><thead><tr><th scope="col">' + W('st.col.name') + '</th><th scope="col">' + W('st.col.type') + '</th><th scope="col">' + W('pc.col.enabled') + '</th><th scope="col">' + W('st.col.values') + '</th><th scope="col" class="ta-r">' + W('pc.col.models') + '</th><th scope="col">' + W('st.col.lastTest') + '</th><th scope="col">' + W('st.col.usedBy') + '</th><th scope="col" class="set-pc-actions"><span class="sr-only">' + W('st.col.actions') + '</span></th></tr></thead><tbody>' +
        CONNS.map(function (c) {
          var pt = ptype(c.type), ub = usedBy(c);
          var vals = Object.keys(c.values).filter(function (k) { return c.values[k]; }).map(function (k) { return '<div>' + fieldLabel(k) + ': <span class="mono" data-i18n-skip>' + esc(c.values[k]) + '</span></div>'; }).join('') +
            (c.cred ? '<div>' + W('st.col.cred') + ': <span class="mono">' + esc(c.cred) + '</span></div>' : '');
          return '<tr class="set-pc-row" data-set-pcrow="' + c.id + '"><td><button class="set-pc-open" type="button" id="set-pc-open-' + c.id + '" data-set-pcopen="' + c.id + '" data-i18n-skip>' + esc(c.name) + '</button></td>' +
            '<td><div class="cluster-2"><span>' + esc(pt.name) + '</span>' + chip('chip-neutral', W('pc.mt.' + METHOD_KEY[pt.method])) + '</div></td>' +
            '<td>' + chip(c.on ? 'chip-success' : 'chip-neutral', W(c.on ? 'pc.enabled' : 'pc.disabled')) + '</td><td>' + vals + '</td><td class="ta-r">' + num(c.models.length) + '</td>' +
            '<td>' + testCell(c.test, pcErr) + '</td><td>' + (ub.length ? ub.map(roleLabel).join(', ') : '—') + '</td>' +
            '<td class="set-pc-actions"><button class="icon-btn" type="button" data-set-pcmenu="' + c.id + '" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc(W('pc.actionsN', { name: c.name })) + '" title="' + esc(W('pc.actionsN', { name: c.name })) + '">' + DOTS + '</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="set-hint mt-16">' + W('pc.noConn') + '</p>');
    }
    function pcInUse(c) { return W('pc.inUse', { name: c.name, roles: usedBy(c).map(roleLabel).join(', ') }); }
    function pcMenu(b, c) {
      openMenu(b, [['edit', W('st.edit')], ['test', W('st.test')], ['toggle', W(c.on ? 'pc.disable' : 'pc.enable')], ['delete', W('st.delete'), true, true]], function (k) {
        if (k === 'edit') pcForm(c);
        else if (k === 'test') { c.test = { ok: c.on || c.type !== 'OPENAI_COMPATIBLE', ms: 300 + Math.round(Math.random() * 200), code: 'DEPENDENCY_UNAVAILABLE', at: new Date().toISOString() }; say(c.name + ': ' + pcResult(c.test)); rerender(); }
        else if (k === 'toggle') {
          if (c.on && usedBy(c).length) { say(pcInUse(c)); return; }
          c.on = !c.on; say(W(c.on ? 'pc.toastEnabled' : 'pc.toastDisabled', { name: c.name })); rerender();
        } else confirmDlg({ title: W('st.deleteTitle', { name: c.name }), body: W('pc.deleteBody'), confirm: W('st.delete') }, function () {
          if (usedBy(c).length) { say(pcInUse(c)); return; }
          CONNS.splice(CONNS.indexOf(c), 1); say(W('st.deleted', { name: c.name })); rerender();
        });
      });
    }
    // Add (2 steps: method → fields) or Edit (fields only)
    function pcForm(conn) {
      var st = { step: conn ? 2 : 1, method: conn ? ptype(conn.type).method : 'API_KEY', type: conn ? conn.type : 'OPENAI', name: conn ? conn.name : '', on: conn ? conn.on : true,
        values: conn ? copy(conn.values) : {}, err: {}, failure: null, test: null, testing: false };
      function isSecret(f) { return f.kind === 'SECRET' || f.kind === 'SECRET_MULTILINE'; }
      function req(f) { return f.req && !(conn && isSecret(f)); }
      function canProbe() {
        var pt = ptype(st.type), kept = !!(conn && conn.cred) && pt.fields.some(function (f) { return isSecret(f) && !(st.values[f.key] || '').trim(); });
        var same = !!conn && pt.fields.every(function (f) { return isSecret(f) || (st.values[f.key] || '').trim() === (conn.values[f.key] || ''); });
        return !kept || same;
      }
      function draw() {
        var pt = ptype(st.type);
        if (st.step === 1) return ['<div class="set-prov-form set-st-form"><fieldset class="set-pc-methods"><legend class="set-lbl">' + W('pc.methodLabel') + '</legend><div class="set-pc-method-cards">' +
          METHODS.map(function (m) {
            return '<label class="set-pc-method"><input type="radio" name="set-pc-method" value="' + m + '" data-pcf-method' + (st.method === m ? ' checked' : '') + '><span class="set-pc-method-t">' + W('pc.mt.' + METHOD_KEY[m]) + '</span><span class="set-pc-method-d">' + W('pc.mt.' + METHOD_KEY[m] + 'D') + '</span></label>';
          }).join('') + '</div><p class="set-hint">' + W('pc.subscriptionHint') + '</p></fieldset></div>',
          btn('btn-ghost btn-sm', 'data-pcf="cancel"', S('set.cancel')) + btn('btn-primary btn-sm', 'data-pcf="next"', W('pc.next'))];
        var body = '<div class="set-prov-form set-st-form">' +
          field('set-pc-f-method', W('pc.methodLabel'), '<input class="input" id="set-pc-f-method" readonly value="' + esc(W('pc.mt.' + METHOD_KEY[st.method])) + '">') +
          field('set-pc-f-type', W('pc.type'), conn ? '<input class="input" id="set-pc-f-type" readonly value="' + esc(pt.name) + '">'
            : '<select class="select" id="set-pc-f-type" data-pcf-type>' + PTYPES.filter(function (x) { return x.method === st.method; }).map(function (x) { return '<option value="' + x.type + '"' + (x.type === st.type ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>') +
          field('set-pc-f-name', W('st.name'), '<input class="input" id="set-pc-f-name" maxlength="100" autocomplete="off" data-pcf-name value="' + esc(st.name) + '">', { req: true, err: st.err.name }) +
          pt.fields.map(function (f) {
            var id = 'set-pc-f-' + f.key, v = st.values[f.key] || '', ctl;
            if (f.kind === 'SELECT') ctl = '<select class="select" id="' + id + '" data-pcf-val="' + f.key + '">' + (f.req ? '' : '<option value="">—</option>') + f.opts.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
            else if (f.kind === 'SECRET_MULTILINE') ctl = '<textarea class="textarea mono" id="' + id + '" rows="6" autocomplete="off" spellcheck="false" maxlength="8000" placeholder="' + esc(f.ph) + '" data-pcf-val="' + f.key + '">' + esc(v) + '</textarea>';
            else ctl = '<input class="input" id="' + id + '" type="' + (f.kind === 'SECRET' ? 'password' : 'text') + '" autocomplete="' + (f.kind === 'SECRET' ? 'new-password' : 'off') + '" maxlength="2000" placeholder="' + esc(f.ph) + '" data-pcf-val="' + f.key + '" value="' + esc(v) + '">';
            return field(id, fieldLabel(f.key), ctl, { req: req(f), hint: conn && isSecret(f) ? W('st.keepSecret') : '', err: st.err[f.key], cls: f.kind === 'SECRET_MULTILINE' ? 'set-pc-wide' : '' });
          }).join('') +
          '<div class="field set-ex-bool"><label for="set-pc-f-enabled">' + W('pc.enabledLabel') + '</label>' + sw('id="set-pc-f-enabled" data-pcf-on', st.on) + '</div>' +
          (conn ? '' : '<p class="set-hint">' + W('pc.addModelsHint') + '</p>') +
          (st.failure ? banner('error', esc(st.failure)) : '') +
          '<p class="set-hint">' + (canProbe() ? W('pc.saveTests') : W('st.testNeedsSecret')) + '</p></div>';
        var ft = (conn ? '' : '<button class="btn btn-ghost btn-sm set-pc-back" type="button" data-pcf="back"><span aria-hidden="true">←</span>' + S('common.back') + '</button>') +
          btn('btn-secondary btn-sm', 'data-pcf="test"' + (canProbe() && !st.testing ? '' : ' disabled'), st.testing ? S('set.m.testing') : S('set.m.test')) +
          '<span role="status">' + (st.test ? chip(st.test.ok ? 'chip-success' : 'chip-error', pcResult(st.test)) : '') + '</span>' +
          btn('btn-primary btn-sm', 'data-pcf="save"', S('set.save')) + btn('btn-ghost btn-sm', 'data-pcf="cancel"', S('set.cancel'));
        return [body, ft];
      }
      function check(full) {
        st.err = {};
        if (full && !st.name.trim()) st.err.name = W('ex.err.required');
        ptype(st.type).fields.forEach(function (f) { if (req(f) && !(st.values[f.key] || '').trim()) st.err[f.key] = W('ex.err.required'); });
        var first = Object.keys(st.err)[0];
        redrawDlg(first ? '#set-pc-f-' + first : null);
        return !first;
      }
      var d = openDlg(conn ? W('st.editTitle', { name: conn.name }) : W('st.addTitle'), draw);
      d.addEventListener('input', function (e) {
        var t = e.target;
        if (t.hasAttribute('data-pcf-name')) { st.name = t.value; delete st.err.name; }
        else if (t.hasAttribute('data-pcf-val')) { st.values[t.getAttribute('data-pcf-val')] = t.value; delete st.err[t.getAttribute('data-pcf-val')]; st.test = null; st.failure = null; }
      });
      d.addEventListener('change', function (e) {
        var t = e.target;
        if (t.hasAttribute('data-pcf-method')) { st.method = t.value; st.type = PTYPES.filter(function (x) { return x.method === t.value; })[0].type; st.values = {}; st.err = {}; }
        else if (t.hasAttribute('data-pcf-type')) { st.type = t.value; st.values = {}; st.err = {}; st.test = null; st.failure = null; redrawDlg('#set-pc-f-type'); }
        else if (t.hasAttribute('data-pcf-val') && t.tagName === 'SELECT') redrawDlg();
      });
      d.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-pcf-on')) { st.on = b.getAttribute('aria-checked') !== 'true'; redrawDlg('#set-pc-f-enabled'); return; }
        var a = b.getAttribute('data-pcf');
        if (a === 'cancel') d.close();
        else if (a === 'next') { st.step = 2; redrawDlg('#set-pc-f-type'); }
        else if (a === 'back') { st.step = 1; redrawDlg('input[name="set-pc-method"]:checked'); }
        else if (a === 'test') {
          if (!check(false)) return;
          st.testing = true; redrawDlg();
          setTimeout(function () { st.testing = false; st.test = { ok: true, ms: 280 + Math.round(Math.random() * 300) }; redrawDlg(); }, 600);
        } else if (a === 'save') {
          if (!check(true)) return;
          if (CONNS.some(function (c) { return c !== conn && c.name.toLowerCase() === st.name.trim().toLowerCase(); })) { st.err.name = W('st.nameTaken'); redrawDlg('#set-pc-f-name'); return; }
          if (conn && conn.on && !st.on && usedBy(conn).length) { st.failure = pcInUse(conn); redrawDlg(); return; }
          var secret = ptype(st.type).fields.filter(function (f) { return isSecret(f) && (st.values[f.key] || '').trim(); })[0];
          var vals = {}; ptype(st.type).fields.forEach(function (f) { if (!isSecret(f) && (st.values[f.key] || '').trim()) vals[f.key] = st.values[f.key].trim(); });
          var c = conn || { id: 'c' + (++seq), models: copy(ptype(st.type).sugg) };
          c.name = st.name.trim(); c.type = st.type; c.on = st.on; c.values = vals; c.test = { ok: true, ms: 300, at: new Date().toISOString() };
          if (secret) c.cred = '••••' + st.values[secret.key].trim().slice(-4); else if (!conn) c.cred = null;
          if (!conn) CONNS.push(c);
          d.close(); say(W('st.saved', { name: c.name })); rerender();
        }
      });
    }
    // one connection's models (row click): name + kind rows, Add model, Fetch (discovery), Save
    function connModels() {
      var p = pcDetail, c = connById(p.id), pt = ptype(c.type);
      var fresh = (p.found || []).filter(function (m) { return !p.rows.some(function (r) { return r.name.trim() === m[0]; }); });
      var pick = function (m) { return p.picked[m[0]] || { on: false, kind: m[1] || '' }; };
      var some = fresh.some(function (m) { return pick(m).on; }), all = fresh.length > 0 && fresh.every(function (m) { return pick(m).on; });
      var kindOpts = function (v, blank) { return (blank && !v ? '<option value="">' + W('pc.pickKindOption') + '</option>' : '') + KINDS.map(function (k) { return '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + kindLabel(k) + '</option>'; }).join(''); };
      var modelErr = Object.keys(p.err).length > 0;
      return '<div class="set-pc-detail mt-16">' + btn('btn-ghost btn-sm', 'data-set-pcback="1"', '<span aria-hidden="true">←</span>' + W('pc.back')) +
        '<div class="set-pc-detail-head"><h2 class="set-lbl" id="set-pc-h" tabindex="-1" data-i18n-skip>' + esc(c.name) + '</h2><div class="cluster-2"><span>' + esc(pt.name) + '</span>' + chip(c.on ? 'chip-success' : 'chip-neutral', W(c.on ? 'pc.enabled' : 'pc.disabled')) + '</div></div>' +
        '<fieldset class="set-pc-models"><legend class="set-lbl">' + W('pc.models') + '</legend>' +
        (p.rows.length ? p.rows.map(function (r, i) {
          var n = num(i + 1);
          return '<div class="set-pc-model"><input class="input" id="set-pc-f-model-' + i + '" data-pcm-name="' + i + '" aria-label="' + esc(W('pc.modelName', { n: n })) + '" maxlength="200" autocomplete="off" value="' + esc(r.name) + '"' + (p.err[i] ? ' aria-invalid="true"' : '') + '>' +
            '<select class="select" data-pcm-kind="' + i + '" aria-label="' + esc(W('pc.modelKind', { n: n })) + '">' + kindOpts(r.kind) + '</select>' +
            btn('btn-ghost btn-sm', 'data-pcm-del="' + i + '" aria-label="' + esc(W('pc.modelRemove', { n: n })) + '"', '×') + '</div>';
        }).join('') : '<p class="set-hint">' + W('pc.noModels') + '</p>') +
        '<p class="field-err" aria-live="polite"' + (modelErr ? '' : ' hidden') + '>' + (modelErr ? W('pc.modelRequired') : '') + '</p>' +
        '<div class="set-pc-model-bar"><div class="cluster-2">' + btn('btn-secondary btn-sm', 'data-pcm-add="1"' + (p.rows.length >= 100 ? ' disabled' : ''), W('pc.addModel')) +
        (pt.disc ? btn('btn-secondary btn-sm', 'data-pcm-fetch="1"' + (p.fetching ? ' disabled aria-busy="true"' : ''), W('pc.fetch')) : '') + '</div>' + btn('btn-primary btn-sm', 'data-pcm-save="1"', S('set.save')) + '</div>' +
        (p.found ? '<div class="set-pc-found" role="group" aria-labelledby="set-pc-found-h"><p class="set-hint" id="set-pc-found-h">' + (fresh.length ? W('pc.found', { n: num(fresh.length) }) : W('pc.allAdded')) + '</p>' +
          '<div class="set-pc-found-bar">' + (fresh.length ? '<label class="check-row" for="set-pc-d-all"><input type="checkbox" id="set-pc-d-all" data-pcm-all="1"' + (all ? ' checked' : '') + '><span>' + W('pc.selectAll') + '</span></label>' : '') +
          '<div class="cluster-2">' + (fresh.length ? btn('btn-secondary btn-sm', 'data-pcm-addpicked="1"' + (some ? '' : ' disabled'), W('pc.addPicked')) : '') + btn('btn-ghost btn-sm', 'data-pcm-foundx="1"', S('set.cancel')) + '</div></div>' +
          fresh.map(function (m, i) {
            var pk = pick(m);
            return '<div class="set-pc-found-row"><label class="check-row" for="set-pc-d-' + i + '"><input type="checkbox" id="set-pc-d-' + i + '" data-pcm-pick="' + esc(m[0]) + '"' + (pk.on ? ' checked' : '') + '><span class="mono">' + esc(m[0]) + '</span></label>' +
              '<select class="select" data-pcm-pkind="' + esc(m[0]) + '" aria-label="' + esc(W('pc.kindOf', { name: m[0] })) + '">' + kindOpts(pk.kind, true) + '</select></div>';
          }).join('') + '</div>' : '') +
        '</fieldset>' + (p.failure ? banner('error', esc(p.failure)) : '') + '<p class="set-hint">' + W('pc.modelsSaveHint') + '</p></div>';
    }
    // ---- models
    function modelsDirty() { return JSON.stringify(mDraft) !== JSON.stringify(mSaved); }
    function choicesOf(kind) {
      var out = [];
      CONNS.forEach(function (c) { if (c.on) c.models.forEach(function (m) { if (m.kind === kind) out.push({ ref: R(c.id, m.name), fam: m.fam || m.name, conn: c }); }); });
      return out;
    }
    function roleCard(r, solo) {
      var k = r[0], kind = r[1], d = mDraft[k], id = 'set-r-' + k.toLowerCase(), ch = choicesOf(kind);
      var found = function (ref) { return ch.some(function (x) { return sameRef(x.ref, ref); }); };
      var nameOf = function (ref) { var c = connById(ref.c); return c ? c.name : ref.c; };
      var famOf = function (ref) { var x = ref && ch.filter(function (y) { return sameRef(y.ref, ref); })[0]; return x ? x.fam : null; };
      var fit = function (x) { return !sameRef(x.ref, d.model) && (kind !== 'EMBED' || x.fam === famOf(d.model)); };
      var free = ch.filter(function (x) { return fit(x) && !d.fb.some(function (f) { return sameRef(f, x.ref); }); });
      var enc = function (ref) { return esc(ref.c + '/' + ref.m); };
      var missing = function (ref) { return '<option value="' + enc(ref) + '" selected>' + esc(W('m.unavailable', { conn: nameOf(ref), model: ref.m })) + '</option>'; };
      var options = function (keep, sel) {
        return CONNS.filter(function (c) { return c.on; }).map(function (c) {
          var own = ch.filter(function (x) { return x.ref.c === c.id && keep(x); });
          return own.length ? '<optgroup label="' + esc(c.name) + '">' + own.map(function (x) { return '<option value="' + enc(x.ref) + '"' + (sameRef(x.ref, sel) ? ' selected' : '') + '>' + esc(x.ref.m) + '</option>'; }).join('') + '</optgroup>' : '';
        }).join('');
      };
      var fbHint = !d.model || !ch.some(fit) ? 'set.m.fbNone' : kind === 'EMBED' ? 'set.m.fbEmbedHint' : 'set.m.fbHint';
      var res = mTested && mTested[k];
      var head = (solo ? '<h3 class="sr-only" id="' + id + '-t">' + roleLabel(k) + '</h3>' : '') +
        (!solo || res ? '<div class="set-role-head">' + (solo ? '' : '<h3 class="set-lbl" id="' + id + '-t">' + roleLabel(k) + '</h3>') + (res ? chip('chip-success', W('pc.testOk', { ms: num(res) })) : '') + '</div>' : '');
      var main = field(id + '-m', S('set.m.model'), '<select class="select" id="' + id + '-m" data-set-rmodel="' + k + '"><option value="">' + W('m.envDefault') + '</option>' +
        (d.model && !found(d.model) ? missing(d.model) : '') + options(function () { return true; }, d.model) + '</select>', { cls: 'set-role-model', hint: d.model && found(d.model) ? esc(S('set.m.provider') + ': ' + nameOf(d.model)) : '' });
      var topN = kind === 'RERANK' ? field(id + '-topN', S('set.m.p.topN'), '<input class="input" id="' + id + '-topN" type="number" min="1" max="50" step="1" value="' + esc(d.topN == null ? '' : d.topN) + '" data-set-rtopn="' + k + '">') : '';
      var fbRows = d.fb.map(function (fb, i) {
        var n = num(i + 1);
        return '<div class="set-fb-row"><span class="set-fb-n mono" aria-hidden="true">' + n + '</span><select class="select" data-set-rfb="' + k + ':' + i + '" aria-label="' + S('set.m.fbN', { n: n }) + '">' + (found(fb) ? '' : missing(fb)) +
          options(function (x) { return sameRef(x.ref, fb) || (fit(x) && !d.fb.some(function (f) { return sameRef(f, x.ref); })); }, fb) + '</select>' +
          btn('btn-ghost btn-sm', 'data-set-rfbdel="' + k + ':' + i + '" aria-label="' + S('set.m.fbRemove', { n: n }) + '"', '×') + '</div>';
      }).join('');
      var fb = '<div class="field set-role-fb" role="group" aria-labelledby="' + id + '-fbl" aria-describedby="' + id + '-fbh"><div class="set-fb-head"><span class="field-label" id="' + id + '-fbl">' + S('set.m.fallback') + '</span>' +
        btn('btn-secondary btn-sm', 'data-set-rfbadd="' + k + '" aria-label="' + S('set.m.fbAdd') + '"' + (free.length && d.fb.length < 5 ? '' : ' disabled'), '+') + '</div>' + fbRows +
        '<span class="field-hint" id="' + id + '-fbh">' + S(fbHint) + '</span></div>';
      return '<section class="set-role" aria-labelledby="' + id + '-t">' + head + '<div class="set-role-grid">' + main + topN + fb + '</div></section>';
    }
    function modelsPane() {
      var testable = ROLES.some(function (r) { return mDraft[r[0]].model; });
      return '<div class="set-foot set-m-bar"><a class="link set-foot-link" href="settings.html?s=providers" data-set-nav="providers">' + S('set.m.manageProv') + '</a>' +
        btn('btn-secondary', 'data-set-test="models"' + (testable && !mTesting ? '' : ' disabled'), mTesting ? S('set.m.testing') : S('set.m.test')) +
        btn('btn-primary', 'data-set-save="models"' + (modelsDirty() ? '' : ' disabled'), S('set.save')) + '</div>' +
        (CONNS.some(function (c) { return c.on; }) ? '' : '<p class="set-hint">' + W('m.noConn') + '</p>') +
        KINDS.map(function (kind) {
          var own = ROLES.filter(function (r) { return r[1] === kind; });
          return '<section class="set-kind set-kind-card" aria-labelledby="set-k-' + kind + '"><h2 class="set-kind-h" id="set-k-' + kind + '">' + kindLabel(kind) + '</h2><div class="set-kind-roles">' +
            own.map(function (r) { return roleCard(r, own.length === 1); }).join('') + '</div></section>';
        }).join('');
    }
    // ---- extractor
    function exPath(b, f) { return b + '.' + f; }
    function exValidate() {
      var errs = {};
      Object.keys(EX).forEach(function (b) {
        Object.keys(EX[b]).forEach(function (f) {
          var s = EX[b][f], p = exPath(b, f), v = String(exDraft[p] == null ? '' : exDraft[p]).trim();
          if (s[0] === 'bool') return;
          if (s[0] === 'text' || s[0] === 'ntext') { if (!v && s[0] === 'text') errs[p] = W('ex.err.required'); else if (v.length > 200) errs[p] = W('ex.err.invalid'); return; }
          var n = Number(v);
          if (!v) errs[p] = W('ex.err.required');
          else if (!isFinite(n) || (s[0] === 'int' && Math.floor(n) !== n)) errs[p] = W('ex.err.invalid');
          else if (n < s[1] || n > s[2]) errs[p] = W('ex.err.range', { min: num(s[1]), max: num(s[2]) });
        });
      });
      return errs;
    }
    function exDirty() { return JSON.stringify(exDraft) !== JSON.stringify(exSaved); }
    function extractorPane() {
      var eng = exDraft.engines;
      return banner('info', W('ex.applyNote')) +
        '<section class="set-kind set-kind-card" aria-labelledby="set-ex-engines"><h2 class="set-kind-h" id="set-ex-engines">' + W('ex.eng.title') + '</h2><p class="set-hint set-ex-eng-hint">' + W('ex.eng.hint') + '</p>' +
        '<div class="table-wrap set-ex-eng-wrap"><table class="table table-dense"><thead><tr><th scope="col">' + W('ex.eng.col.type') + '</th><th scope="col">' + W('ex.eng.col.engine') + '</th><th scope="col">' + W('ex.eng.col.how') + '</th></tr></thead><tbody>' +
        Object.keys(ENG).map(function (k) {
          return '<tr><td><div class="set-ex-eng-type">' + W('ex.eng.' + k) + '</div><div class="set-hint">' + W('ex.eng.fmt.' + k) + '</div></td>' +
            '<td><select class="select" data-set-exeng="' + k + '" aria-label="' + esc(W('ex.eng.engineOf', { type: W('ex.eng.' + k) })) + '"' + (ENG[k].length < 2 ? ' disabled' : '') + '>' + ENG[k].map(function (o) { return '<option value="' + o + '"' + (o === eng[k] ? ' selected' : '') + '>' + W('ex.eng.e.' + o) + '</option>'; }).join('') + '</select></td>' +
            '<td class="set-hint">' + W('ex.eng.d.' + k + '.' + eng[k]) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>' +
        '<details class="set-ex-adv" data-set-exadv' + (exAdv ? ' open' : '') + '><summary class="set-lbl">' + W('ex.adv') + '</summary>' +
        Object.keys(EX).map(function (b) {
          return '<section class="set-kind set-kind-card" aria-labelledby="set-ex-' + b + '"><h2 class="set-kind-h" id="set-ex-' + b + '">' + W('ex.' + b + '.title') + '</h2><div class="set-ex-grid">' +
            Object.keys(EX[b]).map(function (f) {
              var s = EX[b][f], p = exPath(b, f), id = 'set-ex-' + b + '-' + f, label = W('ex.' + b + '.' + f);
              if (s[0] === 'bool') return '<div class="field set-ex-bool"><label for="' + id + '">' + label + '</label>' + sw('id="' + id + '" data-set-exbool="' + p + '"', exDraft[p] === true) + '</div>';
              var env = s[3] ? '<span class="mono">' + s[3] + '</span>' : '';
              var hint = env + (s[0] === 'int' || s[0] === 'num' ? (env ? ' · ' : '') + num(s[1]) + '–' + num(s[2]) : s[0] === 'ntext' ? (env ? ' · ' : '') + W('ex.media.imageEmbedEmpty') : '');
              var text = s[0] === 'text' || s[0] === 'ntext';
              return field(id, label, '<input class="input" id="' + id + '" type="' + (text ? 'text' : 'number') + '"' + (text ? ' maxlength="200"' : ' min="' + s[1] + '" max="' + s[2] + '"' + (s[0] === 'num' ? ' step="any" inputmode="decimal"' : '')) +
                ' autocomplete="off" data-set-exval="' + p + '" value="' + esc(exDraft[p]) + '">', { req: s[0] !== 'ntext', hint: hint, err: exErr[p] });
            }).join('') + '</div></section>';
        }).join('') + '</details>' +
        foot('<span class="set-hint set-foot-link">' + W('ex.updated', { who: esc(exSaved.by || W('ex.system')), d: fmtMed(exSaved.at) }) + '</span>' + btn('btn-primary', 'data-set-save="extractor"' + (exDirty() ? '' : ' disabled'), S('set.save')));
    }
    // ---- storage
    function stDirty() { return ['OBJECT', 'VECTOR', 'GRAPH'].some(function (k) { return stDraft[k] !== stSaved[k]; }); }
    function stErr(code) { return { AUTH_FAILED: W('st.code.authFailed'), UNREACHABLE: W('st.code.unreachable'), TIMEOUT: W('st.code.timeout') }[code] || W('st.code.other', { code: code || '—' }); }
    function storeHead(title, act) { return '<div class="set-st-store-h"><h3>' + title + '</h3>' + btn('btn-secondary btn-sm', 'aria-haspopup="dialog" ' + act + ' aria-label="' + esc(W('st.edit') + ' · ' + title) + '"', W('st.edit')) + '</div>'; }
    function details(sum, table) { return '<details class="set-st-more mt-8"><summary class="set-lbl">' + sum + '</summary><div class="table-wrap mt-8">' + table + '</div></details>'; }
    function storagePane() {
      var stores = ['OBJECT', 'VECTOR', 'GRAPH'].map(function (k) {
        var id = 'set-st-' + k.toLowerCase(), serving = SCONNS.filter(function (c) { return STYPES.filter(function (x) { return x.type === c.type; })[0].stores.indexOf(k) >= 0; });
        return row('<label for="' + id + '">' + storeLabel(k) + '</label>', k === 'OBJECT' ? '' : W('st.sameHint'),
          '<select class="select" id="' + id + '" data-set-store="' + k + '"><option value="">' + W('st.envDefault') + '</option>' + serving.map(function (c) { return '<option value="' + c.id + '"' + (stDraft[k] === c.id ? ' selected' : '') + ' data-i18n-skip>' + esc(c.name) + '</option>'; }).join('') + '</select>');
      }).join('') + foot('<span class="set-hint set-foot-link">' + W('ex.updated', { who: esc(stSaved.by), d: fmtMed(stSaved.at) }) + '</span>' + btn('btn-primary', 'data-set-save="stores"' + (stDirty() ? '' : ' disabled'), S('set.save')));
      // status: what the services use now (follows the saved selection)
      var oc = sconnById(stSaved.OBJECT), gc = sconnById(stSaved.GRAPH);
      var obj = '<div class="set-st-store">' + storeHead(storeLabel('OBJECT'), 'data-set-stedit="' + (oc ? oc.id : 'new:S3') + '"') +
        row(W('st.status.connection'), '', oc ? esc(oc.name) : W('st.status.env')) +
        row(S('set.s.endpoint'), '', '<span class="mono" data-i18n-skip>' + esc(oc ? oc.values.endpoint : 'http://minio:9000') + '</span>') +
        row(W('st.status.state'), '', chip('chip-success', S('set.m.connected'))) +
        details(W('st.status.bucketCount', { n: num(BUCKETS.length) }), '<table class="table table-dense"><thead><tr><th scope="col">Bucket</th><th scope="col">' + S('set.s.purpose') + '</th><th scope="col" class="ta-r">' + S('set.s.size') + '</th><th scope="col" class="ta-r">' + S('set.s.objects') + '</th></tr></thead><tbody>' +
          BUCKETS.map(function (b) { return '<tr><td class="mono">' + b[0] + '</td><td>' + S('set.s.' + b[1]) + '</td><td class="ta-r">' + num(b[2], { style: 'unit', unit: 'gigabyte', maximumFractionDigits: 1 }) + '</td><td class="ta-r">' + num(b[3]) + '</td></tr>'; }).join('') + '</tbody></table>') + '</div>';
      var neoRows = function (kind) {
        var h = '<div class="set-st-store">' + storeHead(storeLabel(kind), 'data-set-stedit="' + (gc ? gc.id : 'new:NEO4J') + '"') +
          row(W('st.status.connection'), '', gc ? esc(gc.name) : W('st.status.env')) +
          row(S('set.s.endpoint'), '', '<span class="mono" data-i18n-skip>' + esc(gc ? gc.values.uri : 'bolt://neo4j:7687') + '</span>') +
          row(W('st.status.version'), '', 'Neo4j ' + NEO.version + ' (' + NEO.edition + ')') +
          row(W('st.status.state'), '', chip('chip-success', W('st.testOk', { ms: num(gc && gc.test ? gc.test.ms : 40) })));
        if (kind === 'GRAPH') h += details(W('st.status.dbCount', { n: num(NEO.dbs.length) }), '<table class="table table-dense"><thead><tr><th scope="col">' + W('st.status.database') + '</th><th scope="col">' + W('st.status.dbState') + '</th><th scope="col" class="ta-r">' + W('st.status.nodes') + '</th><th scope="col" class="ta-r">' + W('st.status.rels') + '</th></tr></thead><tbody>' +
          NEO.dbs.map(function (db) { return '<tr><td class="mono">' + db.name + '</td><td>' + chip(db.status === 'online' ? 'chip-success' : 'chip-neutral', db.status) + '</td><td class="ta-r">' + (db.nodes == null ? '—' : num(db.nodes)) + '</td><td class="ta-r">' + (db.rels == null ? '—' : num(db.rels)) + '</td></tr>'; }).join('') + '</tbody></table>');
        else {
          var idx = []; NEO.dbs.forEach(function (db) { db.idx.forEach(function (x) { idx.push([db.name].concat(x)); }); });
          h += idx.length ? details(W('st.status.idxCount', { n: num(idx.length), db: num(NEO.dbs.length) }), '<table class="table table-dense"><thead><tr><th scope="col">' + W('st.status.database') + '</th><th scope="col">' + W('st.status.index') + '</th><th scope="col">' + W('st.status.dbState') + '</th><th scope="col" class="ta-r">' + W('st.status.populated') + '</th></tr></thead><tbody>' +
            idx.map(function (x) { return '<tr><td class="mono">' + x[0] + '</td><td class="mono">' + x[1] + '</td><td>' + chip(x[2] === 'ONLINE' ? 'chip-success' : 'chip-neutral', x[2]) + '</td><td class="ta-r">' + num(x[3] / 100, { style: 'percent', maximumFractionDigits: 1 }) + '</td></tr>'; }).join('') + '</tbody></table>')
            : '<p class="set-hint mt-8">' + W('st.status.noIndexes') + '</p>';
        }
        return h + '</div>';
      };
      var conns = SCONNS.length ? '<details class="set-st-more mt-16"><summary class="set-lbl">' + W('st.connCount', { n: num(SCONNS.length) }) + '</summary><div class="table-wrap set-st-wrap mt-8"><table class="table table-dense"><thead><tr><th scope="col">' + W('st.col.name') + '</th><th scope="col">' + W('st.col.type') + '</th><th scope="col">' + W('st.col.values') + '</th><th scope="col">' + W('st.col.cred') + '</th><th scope="col">' + W('st.col.lastTest') + '</th><th scope="col">' + W('st.col.usedBy') + '</th><th scope="col"><span class="sr-only">' + W('st.col.actions') + '</span></th></tr></thead><tbody>' +
        SCONNS.map(function (c) {
          var ub = storesOf(c);
          return '<tr><td data-i18n-skip>' + esc(c.name) + '</td><td>' + esc(STYPES.filter(function (x) { return x.type === c.type; })[0].name) + '</td><td>' + Object.keys(c.values).filter(function (k) { return c.values[k]; }).map(function (k) { return '<div>' + W('st.f.' + k) + ': <span class="mono" data-i18n-skip>' + esc(c.values[k]) + '</span></div>'; }).join('') + '</td>' +
            '<td class="mono">' + esc(c.cred || '—') + '</td><td>' + testCell(c.test, stErr) + '</td><td>' + (ub.length ? ub.map(storeLabel).join(', ') : '—') + '</td>' +
            '<td><div class="cluster-2 set-st-actions">' + btn('btn-ghost btn-sm', 'aria-haspopup="dialog" data-set-stedit="' + c.id + '" aria-label="' + esc(W('st.editN', { name: c.name })) + '"', W('st.edit')) +
            btn('btn-ghost btn-sm', 'data-set-sttest="' + c.id + '" aria-label="' + esc(W('st.testN', { name: c.name })) + '"', W('st.test')) +
            btn('btn-ghost btn-sm', 'data-set-stdel="' + c.id + '" aria-label="' + esc(W('st.deleteN', { name: c.name })) + '"', W('st.delete')) + '</div></td></tr>';
        }).join('') + '</tbody></table></div></details>' : '';
      return '<section class="set-kind set-kind-card" aria-labelledby="set-st-stores"><h2 class="set-kind-h" id="set-st-stores">' + W('st.storesTitle') + '</h2>' + stores + '</section>' +
        '<section class="set-kind set-kind-card" aria-labelledby="set-st-status"><div class="set-kind-h set-st-status-h"><h2 id="set-st-status">' + W('st.statusTitle') + '</h2>' +
        btn('btn-primary btn-sm', 'aria-haspopup="dialog" data-set-stedit="new"', '<span aria-hidden="true">+</span>' + W('st.add')) + '</div>' +
        obj + neoRows('GRAPH') + neoRows('VECTOR') + '<p class="set-hint mt-16">' + W('st.statusNote') + '</p>' + conns + '</section>';
    }
    // store connection popup: Add (optionally prefilled: "new:S3" / "new:NEO4J") or Edit
    function stForm(key) {
      var conn = sconnById(key), preset = /^new:/.test(key) ? key.slice(4) : null;
      var st = { type: conn ? conn.type : preset || 'S3', name: conn ? conn.name : '', values: conn ? copy(conn.values) : {}, err: {}, test: null, testing: false };
      if (preset === 'S3') st.values.endpoint = 'http://minio:9000';
      if (preset === 'NEO4J') st.values.uri = 'bolt://neo4j:7687';
      var stype = function () { return STYPES.filter(function (x) { return x.type === st.type; })[0]; };
      var req = function (f) { return f.req && !(conn && f.kind === 'SECRET'); };
      function canTest() {
        var blank = stype().fields.some(function (f) { return f.kind === 'SECRET' && !(st.values[f.key] || '').trim(); });
        var same = !!conn && stype().fields.every(function (f) { return f.kind === 'SECRET' || (st.values[f.key] || '').trim() === (conn.values[f.key] || ''); });
        return !conn || !blank || same;
      }
      function draw() {
        var body = '<div class="set-prov-form set-st-form">' +
          field('set-st-f-type', W('st.type'), conn ? '<input class="input" id="set-st-f-type" readonly value="' + esc(stype().name) + '">'
            : '<select class="select" id="set-st-f-type" data-stf-type>' + STYPES.map(function (x) { return '<option value="' + x.type + '"' + (x.type === st.type ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') +
              UNSUPPORTED.map(function (n) { return '<option disabled>' + esc(W('st.notSupported', { name: n })) + '</option>'; }).join('') + '</select>') +
          field('set-st-f-name', W('st.name'), '<input class="input" id="set-st-f-name" maxlength="100" autocomplete="off" data-stf-name value="' + esc(st.name) + '">', { req: true, err: st.err.name }) +
          stype().fields.map(function (f) {
            var id = 'set-st-f-' + f.key;
            return field(id, W('st.f.' + f.key), '<input class="input" id="' + id + '" type="' + (f.kind === 'SECRET' ? 'password' : 'text') + '" autocomplete="' + (f.kind === 'SECRET' ? 'new-password' : 'off') + '" maxlength="2000" placeholder="' + esc(f.ph) + '" data-stf-val="' + f.key + '" value="' + esc(st.values[f.key] || '') + '">',
              { req: req(f), hint: conn && f.kind === 'SECRET' ? W('st.keepSecret') : '', err: st.err[f.key] });
          }).join('') + '<p class="set-hint">' + (canTest() ? W('st.saveTests') : W('st.testNeedsSecret')) + '</p></div>';
        var ft = btn('btn-secondary btn-sm', 'data-stf="test"' + (canTest() && !st.testing ? '' : ' disabled'), st.testing ? S('set.m.testing') : S('set.m.test')) +
          '<span role="status">' + (st.test ? chip('chip-success', W('st.testOk', { ms: num(st.test) })) : '') + '</span>' +
          btn('btn-primary btn-sm', 'data-stf="save"', S('set.save')) + btn('btn-ghost btn-sm', 'data-stf="cancel"', S('set.cancel'));
        return [body, ft];
      }
      function check(withName) {
        st.err = {};
        if (withName && !st.name.trim()) st.err.name = W('ex.err.required');
        stype().fields.forEach(function (f) { if (req(f) && !(st.values[f.key] || '').trim()) st.err[f.key] = W('ex.err.required'); });
        var first = Object.keys(st.err)[0]; redrawDlg(first ? '#set-st-f-' + first : null); return !first;
      }
      var d = openDlg(conn ? W('st.editTitle', { name: conn.name }) : W('st.addTitle'), draw);
      d.addEventListener('input', function (e) {
        var t = e.target;
        if (t.hasAttribute('data-stf-name')) { st.name = t.value; delete st.err.name; }
        else if (t.hasAttribute('data-stf-val')) { st.values[t.getAttribute('data-stf-val')] = t.value; delete st.err[t.getAttribute('data-stf-val')]; st.test = null; }
      });
      d.addEventListener('change', function (e) { if (e.target.hasAttribute('data-stf-type')) { st.type = e.target.value; st.values = {}; st.err = {}; st.test = null; redrawDlg('#set-st-f-type'); } });
      d.addEventListener('click', function (e) {
        var b = e.target.closest('[data-stf]'); if (!b) return;
        var a = b.getAttribute('data-stf');
        if (a === 'cancel') d.close();
        else if (a === 'test') { if (!check(false)) return; st.testing = true; redrawDlg(); setTimeout(function () { st.testing = false; st.test = 20 + Math.round(Math.random() * 40); redrawDlg(); }, 600); }
        else if (a === 'save') {
          if (!check(true)) return;
          if (SCONNS.some(function (c) { return c !== conn && c.name.toLowerCase() === st.name.trim().toLowerCase(); })) { st.err.name = W('st.nameTaken'); redrawDlg('#set-st-f-name'); return; }
          var c = conn || { id: 's' + (++seq) }, sec = stype().fields.filter(function (f) { return f.kind === 'SECRET' && (st.values[f.key] || '').trim(); })[0], vals = {};
          stype().fields.forEach(function (f) { if (f.kind !== 'SECRET' && (st.values[f.key] || '').trim()) vals[f.key] = st.values[f.key].trim(); });
          c.name = st.name.trim(); c.type = st.type; c.values = vals; c.test = { ok: true, ms: 30, at: new Date().toISOString() };
          if (sec) c.cred = '••••' + st.values[sec.key].trim().slice(-4); else if (!conn) c.cred = null;
          if (!conn) SCONNS.push(c);
          d.close(); say(W('st.saved', { name: c.name })); rerender();
        }
      });
    }
    // ---- advertise
    function advertisePane() {
      var full = SLIDES.length >= MAX_SLIDES;
      return '<div class="set-toolbar"><input type="file" accept="image/webp,image/png,image/jpeg" class="sr-only" tabindex="-1" aria-hidden="true" data-set-adfile>' +
        btn('btn-primary', 'data-set-adupload="1"' + (full ? ' disabled' : ''), W('ad.upload')) + '<span class="set-hint">' + W('ad.count', { n: num(SLIDES.length), max: num(MAX_SLIDES) }) + '</span></div>' +
        '<p class="set-hint">' + W('ad.hint') + '</p>' + (adErr ? banner('error', adErr) : '') +
        (SLIDES.length ? '<ol class="set-ad-grid" aria-label="' + W('ad.listLabel') + '">' + SLIDES.map(function (s, i) {
          var n = num(i + 1);
          return '<li class="set-ad-card"><img src="' + esc(s.url) + '" alt="' + esc(W('ad.slideAlt', { n: n })) + '" class="set-ad-img" loading="lazy"><div class="set-ad-meta"><strong>' + W('ad.slide', { n: n }) + '</strong><span class="set-hint">' +
            num(s.w) + ' × ' + num(s.h) + ' px · ' + num(s.kb, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 }) + '</span></div><div class="cluster-2">' +
            btn('btn-ghost btn-sm', 'id="set-ad-up-' + s.id + '" data-set-admove="' + i + ':-1" aria-label="' + esc(W('ad.moveUp', { n: n })) + '"' + (i === 0 ? ' disabled' : ''), '↑') +
            btn('btn-ghost btn-sm', 'id="set-ad-down-' + s.id + '" data-set-admove="' + i + ':1" aria-label="' + esc(W('ad.moveDown', { n: n })) + '"' + (i === SLIDES.length - 1 ? ' disabled' : ''), '↓') +
            btn('btn-ghost btn-sm', 'data-set-addel="' + i + '" aria-label="' + esc(W('ad.deleteN', { n: n })) + '"', W('ad.delete')) + '</div></li>';
        }).join('') + '</ol>' : '<p class="set-hint mt-16">' + W('ad.empty') + '</p>');
    }

    var PANES = { user: userPane, access: accessPane, general: generalPane, notif: notifPane, users: usersPane, audit: auditPane,
      providers: providersPane, models: modelsPane, extractor: extractorPane, storage: storagePane, advertise: advertisePane };

    // sidebar selection + breadcrumb (Cài đặt người dùng › [group ›] section) + document title + header back target
    function syncChrome() {
      document.querySelectorAll('.sidebar [data-set-nav]').forEach(function (a) {
        var on = a.getAttribute('data-set-nav') === cur;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      var bc = document.getElementById('set-crumbs'), g = GROUP[cur];
      if (bc) {
        bc.innerHTML = '<a href="settings.html" data-set-nav="user">' + S('set.title') + '</a><span class="sep" aria-hidden="true">›</span>' +
          (g ? '<a href="settings.html?s=' + g[1] + '" data-set-nav="' + g[1] + '">' + S(g[0]) + '</a><span class="sep" aria-hidden="true">›</span>' : '') +
          '<span class="crumb-current" aria-current="page">' + navLabel(cur) + '</span>';
        // ungrouped sections: the section crumb is this page, so ← goes to the app home (Enterprise Search) instead
        if (g) { bc.removeAttribute('data-back-href'); bc.removeAttribute('data-back-name'); }
        else { bc.setAttribute('data-back-href', 'enterprise-search-home.html'); bc.setAttribute('data-back-name', 'MSB Context Platform'); }
        if (window.KCBack) KCBack.sync();
      }
      document.title = navLabel(cur) + ' · ' + S('set.title') + ' · MSB Context Platform';
    }
    function render() {
      var h = '<h1 class="sr-only" tabindex="-1">' + navLabel(cur) + '</h1>';
      pane.innerHTML = h + (visible(cur) ? PANES[cur]() : noAccess());
      syncChrome();
    }
    // re-render, then put focus back on the same control (matched by id or its data-set-* / data-lang attribute)
    function rerender(focusSel) {
      var a = document.activeElement, sel = focusSel || null;
      if (!sel && a && pane.contains(a)) {
        if (a.id) sel = '#' + a.id;
        for (var i = 0; i < a.attributes.length && !sel; i++) if (/^data-(set-|pcm-|lang$)/.test(a.attributes[i].name)) sel = '[' + a.attributes[i].name + '="' + a.attributes[i].value + '"]';
      }
      render();
      var f = sel && pane.querySelector(sel); if (f) f.focus();
    }
    function go(id, push) {
      if (id === 'deleg') id = 'users';   // the former Approval delegation section, now part of Users & permissions
      if (id === 'pii') { location.replace('settings-users-pii.html'); return; }
      cur = SECTIONS.indexOf(id) >= 0 ? id : 'user';
      pending = null; arPending = null; pcDetail = null; mTested = null; exErr = {}; adErr = null; dErr = null; pw.err = {};
      if (push) { try { var u = new URL(location.href); u.searchParams.set('s', cur); history.pushState(null, '', u); } catch (e) {} }
      render();
    }

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-set-nav]');
      // PII access is its own page (settings-users-pii.html): a normal link
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || !PANES[a.getAttribute('data-set-nav')]) return;
      e.preventDefault();
      go(a.getAttribute('data-set-nav'), true);
      var app = document.querySelector('.app.sb-open'), tg = document.querySelector('.sb-toggle');
      if (app && tg) tg.click();   // off-canvas drawer: close after picking a section
      var h = pane.querySelector('h1'); if (h) h.focus();
    });
    window.addEventListener('popstate', function () { go(new URLSearchParams(location.search).get('s')); });
    pane.addEventListener('submit', function (e) {
      if (!e.target.hasAttribute('data-set-pwform')) return;
      e.preventDefault();
      var v = function (id) { return pane.querySelector('#' + id).value; };
      var c = v('set-pw-current'), n = v('set-pw-next'), cf = v('set-pw-confirm');
      pw.err = {};
      if (!c) pw.err.current = W('pw.errCurrent');
      if (n.length < 8) pw.err.next = W('pw.errShort');
      if (cf !== n) pw.err.confirm = W('pw.errConfirm');
      var first = Object.keys(pw.err)[0];
      rerender(first ? '#set-pw-' + first : null);
      if (!first) say(W('pw.changed'));
    });
    pane.addEventListener('click', function (e) {
      var b = e.target.closest('button'), g = function (x) { return b.getAttribute(x); }, x, y;
      // provider row: a click outside the actions cell opens the connection's models page
      if (!b) { var tr = e.target.closest('[data-set-pcrow]'); if (tr && !e.target.closest('.set-pc-actions')) { pcOpen(tr.getAttribute('data-set-pcrow')); } return; }
      if (b.disabled) return;
      if (g('data-set-theme')) {
        var v = g('data-set-theme');
        if (v === 'system') {
          try { localStorage.removeItem('ecp-theme'); } catch (z) {}
          root.setAttribute('data-theme', window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
          syncTheme();
        } else setTheme(v);
        rerender();
      } else if (g('data-set-sidebar')) {
        var c = g('aria-checked') !== 'true', app = document.querySelector('.app'), tg = document.querySelector('.sb-toggle');
        try { localStorage.setItem('ecp-sidebar', c ? 'collapsed' : 'expanded'); } catch (z) {}
        // desktop only: let the shell toggle apply it (the <=1279px rail is automatic)
        if (app && tg && !MQ_RAIL.matches && app.classList.contains('is-collapsed') !== c) tg.click();
        rerender();
      } else if (g('data-set-save') === 'notif') say(S('set.toastSaved'));
      else if (g('data-set-save') === 'models') { mSaved = copy(mDraft); mTested = null; say(S('set.toastSaved')); rerender(); }
      else if (g('data-set-save') === 'extractor') {
        exErr = exValidate();
        var first = Object.keys(exErr)[0];
        if (first) { exAdv = true; rerender('#set-ex-' + first.replace('.', '-')); return; }
        exDraft.by = 'Nguyễn Lan'; exDraft.at = new Date().toISOString(); exSaved = copy(exDraft); say(S('set.toastSaved')); rerender();
      } else if (g('data-set-save') === 'stores') { stDraft.by = 'Nguyễn Lan'; stDraft.at = new Date().toISOString(); stSaved = copy(stDraft); say(S('set.toastSaved')); rerender(); }
      else if (g('data-set-test') === 'models') {
        mTesting = true; rerender();
        setTimeout(function () { mTesting = false; mTested = { LLM: 820, FAST: 310, GRAPH: 1240, CHUNK: 990, VLM: 940, OCR: 1610, EMBED: 140, RERANK: 95 };
          ROLES.forEach(function (r) { if (!mDraft[r[0]].model) delete mTested[r[0]]; }); if (cur === 'models') rerender(); }, 700);
      } else if (g('data-set-rfbadd')) {
        x = g('data-set-rfbadd'); y = mDraft[x];
        var kind = ROLES.filter(function (r) { return r[0] === x; })[0][1], famOf = function (ref) { var m = ref && choicesOf(kind).filter(function (z) { return sameRef(z.ref, ref); })[0]; return m ? m.fam : null; };
        var nx = choicesOf(kind).filter(function (z) { return !sameRef(z.ref, y.model) && (kind !== 'EMBED' || z.fam === famOf(y.model)) && !y.fb.some(function (f) { return sameRef(f, z.ref); }); })[0];
        if (nx) { y.fb.push(nx.ref); mTested = null; rerender('[data-set-rfb="' + x + ':' + (y.fb.length - 1) + '"]'); }
      } else if (g('data-set-rfbdel')) { x = g('data-set-rfbdel').split(':'); mDraft[x[0]].fb.splice(+x[1], 1); mTested = null; rerender('[data-set-rfbadd="' + x[0] + '"]'); }
      else if (g('data-set-ar')) { x = g('data-set-ar').split(':'); arPending = { id: x[0], decision: x[1], role: 'consumer', err: false }; rerender('#set-ar-reason'); }
      else if (g('data-set-arcancel')) { arPending = null; rerender(); }
      else if (g('data-set-arok')) {
        var why = pane.querySelector('#set-ar-reason').value.trim(), r0 = AR.filter(function (r) { return r.id === arPending.id; })[0];
        if (!why) { arPending.err = true; rerender('#set-ar-reason'); return; }
        AR.splice(AR.indexOf(r0), 1);
        if (arPending.decision === 'APPROVE') USERS.push({ id: r0.id, name: r0.name || r0.email, mail: r0.email, dept: null, role: arPending.role, on: true, last: null });
        say(W(arPending.decision === 'APPROVE' ? 'ar.approved' : 'ar.rejected', { e: r0.email })); arPending = null; rerender();
      } else if (g('data-set-sync')) { lastSync = new Date().toISOString(); AUDIT.unshift({ at: lastSync, actor: null, target: null, type: 'sync', ref: null }); say(W('u.syncStarted')); rerender(); }
      else if (g('data-set-ustatus')) { pending = { id: g('data-set-ustatus'), err: false }; rerender('#set-u-reason'); }
      else if (g('data-set-ucancel')) { pending = null; rerender(); }
      else if (g('data-set-uconfirm')) {
        var rs = pane.querySelector('#set-u-reason').value.trim(), u2 = USERS.filter(function (u) { return u.id === pending.id; })[0];
        if (!rs) { pending.err = true; rerender('#set-u-reason'); return; }
        u2.on = !u2.on; AUDIT.unshift({ at: new Date().toISOString(), actor: 'Nguyễn Lan', target: u2.name, type: u2.on ? 'on' : 'off', ref: rs });
        say(S('set.u.toastStatus', { p: u2.name })); pending = null; rerender();
      } else if (g('data-set-dcreate')) {
        var kb = pane.querySelector('#set-d-kb').value, to = pane.querySelector('#set-d-to').value;
        if (!to) { dErr = S('set.d.errTo'); rerender('#set-d-to'); return; }
        var dd = DELEG[kb].filter(function (d) { return d.name === to; })[0];
        dd.status = 'ACTIVE'; dd.perms = [].filter.call(pane.querySelectorAll('[data-set-dperm]:checked'), function () { return true; }).map(function (c) { return c.getAttribute('data-set-dperm'); });
        dErr = null; say(W('d.toastCreated', { p: to })); rerender();
      } else if (g('data-set-drevoke')) {
        var dr = DELEG[pane.querySelector('#set-d-kb').value][+g('data-set-drevoke')];
        confirmDlg({ title: S('set.d.revoke'), body: W('d.revokeBody', { p: dr.name }), confirm: S('set.d.revoke') }, function () { dr.status = 'REVOKED'; say(S('set.d.toastRevoked', { p: dr.name })); rerender(); });
      } else if (g('data-set-auexport')) {
        // CSV of the rows matching the filters; cells that start with = + - @ are prefixed so spreadsheets don't run them
        var q = (pane.querySelector('#set-au-q').value || '').toLowerCase().trim();
        var rows = auRows().filter(function (ev) { return !q || ((ev.actor || S('set.au.system')) + ' ' + (ev.target || '')).toLowerCase().indexOf(q) >= 0; });
        var cell = function (s) { s = String(s == null ? '' : s); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
        var csv = [[S('set.au.time'), S('set.au.actor'), S('set.au.target'), S('set.au.change'), S('set.au.ref')]].concat(rows.map(function (ev) {
          return [ev.at, ev.actor || S('set.au.system'), ev.target || '', auChange(ev), ev.ref || ''];
        })).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
        var dl = document.createElement('a');
        dl.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
        dl.download = 'access-audit-events.csv'; document.body.appendChild(dl); dl.click(); dl.remove();
      } else if (g('data-set-pcadd')) pcForm(null);
      else if (g('data-set-pcmenu')) { if (menu && menu.btn === b) closeMenu(false); else pcMenu(b, connById(g('data-set-pcmenu'))); }
      else if (g('data-set-pcopen')) pcOpen(g('data-set-pcopen'));
      else if (g('data-set-pcback')) { var back = pcDetail.id; pcDetail = null; rerender('#set-pc-open-' + back); }
      else if (g('data-pcm-add')) { pcDetail.rows.push({ name: '', kind: 'LLM', fam: '' }); pcDetail.failure = null; rerender('#set-pc-f-model-' + (pcDetail.rows.length - 1)); }
      else if (g('data-pcm-del')) { pcDetail.rows.splice(+g('data-pcm-del'), 1); pcDetail.err = {}; pcDetail.failure = null; rerender(); }
      else if (g('data-pcm-fetch')) {
        pcDetail.fetching = true; pcDetail.picked = {}; pcDetail.failure = null; rerender();
        setTimeout(function () { if (!pcDetail) return; pcDetail.fetching = false; pcDetail.found = DISCOVER[connById(pcDetail.id).type] || []; rerender(); }, 600);
      } else if (g('data-pcm-foundx')) { pcDetail.found = null; pcDetail.picked = {}; rerender(); }
      else if (g('data-pcm-addpicked')) {
        var p = pcDetail, chosen = p.found.filter(function (m) { return p.picked[m[0]] && p.picked[m[0]].on && !p.rows.some(function (r) { return r.name.trim() === m[0]; }); });
        if (chosen.some(function (m) { return !p.picked[m[0]].kind; })) { p.failure = W('pc.pickKind'); rerender(); return; }
        chosen.forEach(function (m) { p.rows.push({ name: m[0], kind: p.picked[m[0]].kind, fam: '' }); });
        p.found = null; p.picked = {}; p.failure = null; rerender();
      } else if (g('data-pcm-save')) {
        var pd = pcDetail; pd.err = {};
        pd.rows.forEach(function (r, i) { if (!r.name.trim()) pd.err[i] = 1; });
        var fe = Object.keys(pd.err)[0];
        if (fe !== undefined) { rerender('#set-pc-f-model-' + fe); return; }
        var keys = pd.rows.map(function (r) { return r.kind + '|' + r.name.trim(); });
        if (keys.some(function (k2, i) { return keys.indexOf(k2) !== i; })) { pd.failure = W('pc.duplicateModel'); rerender(); return; }
        var cc = connById(pd.id); cc.models = pd.rows.map(function (r) { return M(r.name.trim(), r.kind, r.kind === 'EMBED' ? r.fam : ''); });
        pd.failure = null; say(W('st.saved', { name: cc.name })); rerender();
      } else if (g('data-set-exbool')) { exDraft[g('data-set-exbool')] = g('aria-checked') !== 'true'; delete exErr[g('data-set-exbool')]; rerender(); }
      else if (g('data-set-stedit')) stForm(g('data-set-stedit') === 'new' ? 'new' : g('data-set-stedit'));
      else if (g('data-set-sttest')) { var sc = sconnById(g('data-set-sttest')); sc.test = { ok: true, ms: 15 + Math.round(Math.random() * 30), at: new Date().toISOString() }; say(sc.name + ': ' + W('st.testOk', { ms: num(sc.test.ms) })); rerender(); }
      else if (g('data-set-stdel')) {
        var sd = sconnById(g('data-set-stdel'));
        confirmDlg({ title: W('st.deleteTitle', { name: sd.name }), body: W('st.deleteBody'), confirm: W('st.delete') }, function () {
          var ub = storesOf(sd);
          if (ub.length) { say(W('st.inUse', { name: sd.name, stores: ub.map(storeLabel).join(', ') })); return; }
          SCONNS.splice(SCONNS.indexOf(sd), 1); say(W('st.deleted', { name: sd.name })); rerender();
        });
      } else if (g('data-set-adupload')) pane.querySelector('[data-set-adfile]').click();
      else if (g('data-set-admove')) {
        x = g('data-set-admove').split(':'); var i0 = +x[0], j0 = i0 + (+x[1]), t0 = SLIDES[i0]; SLIDES[i0] = SLIDES[j0]; SLIDES[j0] = t0; adErr = null;
        rerender('#set-ad-' + (+x[1] < 0 ? 'up' : 'down') + '-' + t0.id);
      } else if (g('data-set-addel')) {
        var ai = +g('data-set-addel'), an = num(ai + 1);
        confirmDlg({ title: W('ad.deleteTitle', { n: an }), body: W('ad.deleteBody'), confirm: W('ad.delete') }, function () { SLIDES.splice(ai, 1); adErr = null; say(W('ad.deleted')); rerender(); });
      }
    });
    function pcOpen(id) { var c = connById(id); pcDetail = { id: id, rows: copy(c.models), found: null, picked: {}, err: {}, failure: null }; render(); var h = pane.querySelector('#set-pc-h'); if (h) h.focus(); }
    // live search: hide non-matching rows without re-rendering (keeps typing focus)
    pane.addEventListener('input', function (e) {
      var t = e.target, tb = t.hasAttribute('data-set-usearch') ? '#set-u-table' : t.hasAttribute('data-set-ausearch') ? '#set-au-table' : null;
      if (t.hasAttribute('data-set-exval')) { exDraft[t.getAttribute('data-set-exval')] = t.value; delete exErr[t.getAttribute('data-set-exval')]; var sv = pane.querySelector('[data-set-save="extractor"]'); if (sv) sv.disabled = !exDirty(); return; }
      if (t.hasAttribute('data-pcm-name')) { pcDetail.rows[+t.getAttribute('data-pcm-name')].name = t.value; delete pcDetail.err[t.getAttribute('data-pcm-name')]; return; }
      if (!tb) return;
      var q = t.value.toLowerCase().trim();
      pane.querySelectorAll(tb + ' tbody tr[data-q]').forEach(function (r) { r.hidden = !!q && r.getAttribute('data-q').indexOf(q) < 0; });
    });
    pane.addEventListener('toggle', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-set-exadv')) exAdv = e.target.open; }, true);
    pane.addEventListener('change', function (e) {
      var t = e.target, a = function (n) { return t.getAttribute(n); }, k;
      if (a('data-set-rmodel')) {
        k = a('data-set-rmodel'); var v = t.value, i = v.indexOf('/'), model = v ? R(v.slice(0, i), v.slice(i + 1)) : null, kind = ROLES.filter(function (r) { return r[0] === k; })[0][1];
        var famOf = function (ref) { var m = ref && choicesOf(kind).filter(function (z) { return sameRef(z.ref, ref); })[0]; return m ? m.fam : null; };
        // no main model (env var) means no fallbacks; an embedding of another family drops the fallbacks too
        mDraft[k].model = model;
        mDraft[k].fb = mDraft[k].fb.filter(function (f) { return !!model && !sameRef(f, model) && (kind !== 'EMBED' || famOf(f) === famOf(model)); });
        mTested = null; rerender();
      } else if (a('data-set-rfb')) { k = a('data-set-rfb').split(':'); var fv = t.value, fi = fv.indexOf('/'); mDraft[k[0]].fb[+k[1]] = R(fv.slice(0, fi), fv.slice(fi + 1)); mTested = null; rerender(); }
      else if (a('data-set-rtopn')) { mDraft[a('data-set-rtopn')].topN = t.value === '' ? null : Number(t.value); rerender(); }
      else if (a('data-set-notif')) { k = a('data-set-notif').split(':'); NOTIF[+k[0]][+k[1]] = t.checked ? 1 : 0; }
      else if (a('data-set-digest')) digest = t.value;
      else if (a('data-set-tz')) { tz = t.value; say(S('set.toastSaved')); rerender(); }
      else if (a('data-set-urolef')) { uRole = t.value; pending = null; rerender(); }
      else if (a('data-set-arrole')) arPending.role = t.value;
      else if (a('data-set-autype')) { auType = t.value; rerender(); }
      else if (a('data-set-dkb')) { dKb = t.value; dErr = null; rerender(); }
      else if (t.id === 'set-d-to') { dErr = null; }
      else if (a('data-set-dtoggle')) {
        k = a('data-set-dtoggle').split(':'); var dg = DELEG[pane.querySelector('#set-d-kb').value][+k[0]];
        dg.perms = t.checked ? dg.perms.concat(k[1]) : dg.perms.filter(function (p) { return p !== k[1]; });
        say(S('set.toastSaved'));
      } else if (a('data-set-exeng')) { exDraft.engines[a('data-set-exeng')] = t.value; rerender(); }
      else if (a('data-set-store')) { k = a('data-set-store'); if (k === 'OBJECT') stDraft.OBJECT = t.value || null; else stDraft.VECTOR = stDraft.GRAPH = t.value || null; rerender(); }
      else if (a('data-pcm-kind')) pcDetail.rows[+a('data-pcm-kind')].kind = t.value;
      else if (a('data-pcm-pick') || a('data-pcm-pkind')) {
        var nm = a('data-pcm-pick') || a('data-pcm-pkind'), f0 = pcDetail.found.filter(function (m) { return m[0] === nm; })[0];
        var pk = pcDetail.picked[nm] || { on: false, kind: f0[1] || '' };
        if (a('data-pcm-pick')) pk.on = t.checked; else pk.kind = t.value;
        pcDetail.picked[nm] = pk; rerender();
      } else if (a('data-pcm-all')) {
        pcDetail.found.forEach(function (m) { var pk2 = pcDetail.picked[m[0]] || { on: false, kind: m[1] || '' }; pk2.on = t.checked; pcDetail.picked[m[0]] = pk2; }); rerender();
      } else if (t.hasAttribute('data-set-adfile')) {
        var file = t.files && t.files[0]; t.value = '';
        if (!file) return;
        adErr = null;
        if (['image/webp', 'image/png', 'image/jpeg'].indexOf(file.type) < 0) adErr = W('ad.err.type');
        else if (file.size > MAX_BYTES) adErr = W('ad.err.size');
        else if (SLIDES.length >= MAX_SLIDES) adErr = W('ad.err.limit', { n: num(MAX_SLIDES) });
        if (adErr) { rerender(); return; }
        var url = URL.createObjectURL(file), img = new Image();
        img.onload = function () { SLIDES.push({ id: 'ad' + (++seq), url: url, w: img.naturalWidth, h: img.naturalHeight, kb: file.size / 1024 }); say(W('ad.uploaded')); rerender(); };
        img.src = url;
      }
    });
    onLang(function () { rerender(); redrawDlg(); });
    document.addEventListener('ecp-rolechange', function () { pending = null; arPending = null; rerender(); });
    go(params.get('s'));
  }
  // ---- header back (←) placed right before the breadcrumb. It goes to the PARENT screen, never the previous
  //  page in browser history. It is shown only when a real parent exists; otherwise it is removed from layout and
  //  the a11y tree (hidden → .hdr-back[hidden]{display:none} in screens.css). Target priority:
  //  1) in-page view handler registered with KCBack.set(key, fn, isActive) (e.g. Evaluation Lab dataset detail / job trace)
  //  2) [data-back-href] (explicit override on the breadcrumb, e.g. Review Workspace → quality-review.html?tab=mine)
  //  3) parent = the breadcrumb's second-to-last crumb (the <a> just before aria-current="page"), using its href,
  //     only when that href is a real page: not '#', not empty, and not the current page itself.
  //  No parent (top-level / single-crumb page) → no back control. There is no history.back() fallback.
  var KCBack = window.KCBack = (function () {
    var stack = [], btn = null, cur = location.pathname;
    function samePage(href) {
      try { return new URL(href, location.href).pathname === cur; } catch (e) { return false; }
    }
    // the breadcrumb's second-to-last crumb → the parent screen; null when there is no real parent
    function parentCrumb() {
      var nav = document.querySelector('.app-header .hdr-main .breadcrumb'); if (!nav) return null;
      // crumb items in order: anchors + the current (aria-current="page"/.crumb-current) span
      var items = nav.querySelectorAll('a, [aria-current="page"], .crumb-current');
      if (items.length < 2) return null;
      var parent = items[items.length - 2];
      if (parent.tagName !== 'A') return null;
      var href = parent.getAttribute('href');
      if (!href || href === '#' || samePage(href)) return null;
      return { href: href, name: (parent.textContent || '').trim() };
    }
    function top() { for (var i = stack.length - 1; i >= 0; i--) { var s = stack[i]; if (!s.active || s.active()) return s; } return null; }
    // { fn } in-page handler · { href,[name] } navigate to a page · null → hide
    function target() {
      var s = top(); if (s) return s;
      var h = document.querySelector('[data-back-href]');
      if (h) {
        var pc0 = parentCrumb();
        return { href: h.getAttribute('data-back-href'), name: h.getAttribute('data-back-name') || (pc0 ? pc0.name : null) };
      }
      return parentCrumb();
    }
    function label(t) {
      return t && t.name
        ? T('common.backToParent', 'Quay lại {name}', { name: t.name })
        : T('common.back', 'Quay lại');
    }
    function ensure() {
      if (btn) return btn;
      var nav = document.querySelector('.app-header .hdr-main .breadcrumb'); if (!nav) return null;
      btn = document.createElement('button'); btn.type = 'button'; btn.className = 'hdr-back'; btn.hidden = true;
      btn.innerHTML = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
      nav.parentNode.insertBefore(btn, nav);
      btn.addEventListener('click', go);
      return btn;
    }
    // go to the parent: the in-page handler or the parent page; false when there is none
    function go() {
      var t = target(); if (!t) return false;
      if (t.fn) { clear(t.key); t.fn(); }
      else if (t.href) location.href = t.href;
      return true;
    }
    function sync() {
      var b = ensure(); if (!b) return;
      var t = target();
      var l = label(t); b.setAttribute('aria-label', l); b.title = l;
      // hidden removes the button from layout (display:none) and the a11y tree
      b.hidden = !t;
    }
    function clear(key) { stack = stack.filter(function (s) { return s.key !== key; }); sync(); }
    function set(key, fn, active) { stack = stack.filter(function (s) { return s.key !== key; }); stack.push({ key: key, fn: fn, active: active }); sync(); }
    function focus() { if (btn && !btn.hidden) btn.focus(); }
    return { set: set, clear: clear, sync: sync, focus: focus, go: go };
  })();
  // Esc = the header ← (back to the parent). Only when Esc isn't already closing something: nothing was open when
  // the key went down (checked in the capture phase, before any popup closes itself), focus is not in a text field
  // (Esc clears a search box), and no other handler claimed the key.
  (function () {
    var OPEN = 'dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"]';
    var busy = false;
    function anyOpen() {
      return Array.prototype.some.call(document.querySelectorAll(OPEN), function (el) { return !el.hidden && el.getClientRects().length > 0; });
    }
    function inField(el) { return !!(el && el.closest && el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')); }
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') busy = anyOpen() || inField(e.target); }, true);
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || busy || e.defaultPrevented || e.repeat) return;
      if (KCBack.go()) e.preventDefault();
    });
  })();
  document.addEventListener('DOMContentLoaded', function () {
    syncTheme();
    initHeader();
    initSoonNav();
    initUserMenu();
    initSettings();
    var app = document.querySelector('.app');
    // Collapsed state persists across pages: URL ?sidebar= wins, else the saved choice,
    // else whatever the static markup declares (e.g. sidebar-collapsed.html). This lets a
    // collapsed sidebar stay collapsed when the user navigates to another screen.
    if (app) {
      var sbParam = params.get('sidebar'), sbSaved = null;
      try { sbSaved = localStorage.getItem('ecp-sidebar'); } catch (e) {}
      var collapsed = sbParam ? sbParam === 'collapsed' : (sbSaved !== null ? sbSaved === 'collapsed' : app.classList.contains('is-collapsed'));
      var wideCollapsed = collapsed;   // the desktop (>=1280px) state, restored when the viewport widens again
      app.classList.toggle('is-collapsed', collapsed || MQ_RAIL.matches);
      // Hand control to the .app.is-collapsed cascade and drop the pre-paint html-level hint.
      root.classList.remove('ecp-collapsed');
    }
    // Initial state is now applied; re-enable transitions for subsequent user toggles.
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('ecp-no-anim'); }); });
    var hdrBrand = document.querySelector('.app-header .hdr-brand'), hdrMain = document.querySelector('.app-header .hdr-main');
    function syncSidebar() {
      if (!app) return;
      var c = app.classList.contains('is-collapsed');
      document.querySelectorAll('.sb-toggle').forEach(function (b) {
        // expanded: toggle sits at the right of .hdr-brand; collapsed: first item of .hdr-main (flush left, before ← back)
        var host = c ? hdrMain : hdrBrand;
        if (host && b.parentNode !== host) {
          var hadFocus = document.activeElement === b;
          if (c) host.insertBefore(b, host.firstChild); else host.appendChild(b);
          if (hadFocus) b.focus();
        }
        b.setAttribute('aria-expanded', String(!c));
        b.setAttribute('aria-label', c ? T('common.sbExpand', 'Mở rộng sidebar') : T('common.sbCollapse', 'Thu gọn sidebar'));
      });
    }
    syncSidebar();
    // expanded width = 20px inset + widest sidebar content (nav labels/items, brand block) + 20px; re-fit on language/font change
    function fitSidebar() {
      var sb = app && app.querySelector('.sidebar');
      if (!sb) return;
      var anim = !root.classList.contains('ecp-no-anim'), wasC = app.classList.contains('is-collapsed'), PAD = 20;
      root.classList.add('ecp-no-anim');
      app.classList.remove('is-collapsed');
      app.style.setProperty('--sb-w-open', '1000px');
      var left = sb.getBoundingClientRect().left, max = 0, r = document.createRange();
      var els = Array.prototype.slice.call(sb.querySelectorAll('.nav-label, .nav-item, .theme-toggle'));
      els.forEach(function (el) {
        if (!el.getClientRects().length) return;
        r.selectNodeContents(el);
        max = Math.max(max, r.getBoundingClientRect().right - left);
      });
      if (hdrBrand) {   // logo + brand text, then the collapse toggle (pushed right by margin-left:auto) after an 8px gap
        var tg = hdrBrand.querySelector('.sb-toggle'), br = 0;
        Array.prototype.forEach.call(hdrBrand.children, function (c) { if (c !== tg && c.getClientRects().length) br = Math.max(br, c.getBoundingClientRect().right); });
        max = Math.max(max, br - hdrBrand.getBoundingClientRect().left + (tg ? 8 + tg.offsetWidth : 0));
      }
      app.style.setProperty('--sb-w-open', Math.ceil(max + PAD + 1) + 'px');   // +1: border-right
      app.classList.toggle('is-collapsed', wasC);
      if (anim) requestAnimationFrame(function () { root.classList.remove('ecp-no-anim'); });
    }
    fitSidebar();
    onLang(fitSidebar);
    // drag handle on the sidebar's right border (code: use-resize-sidebar.ts): drag or ← / →; max 25% of the window; released < 160px collapses to the rail
    (function () {
      var sb = app && app.querySelector('.sidebar');
      if (!sb || sb.querySelector('.sb-resize')) return;
      var MIN = 160, STEP = 16, h = document.createElement('div');
      h.className = 'sb-resize'; h.setAttribute('role', 'separator'); h.setAttribute('aria-orientation', 'vertical'); h.tabIndex = 0;
      h.setAttribute('aria-label', T('web.sb.resize', 'Kéo để đổi độ rộng thanh bên')); h.setAttribute('data-i18n-attr', 'aria-label:web.sb.resize');
      sb.appendChild(h);
      function aria() { h.setAttribute('aria-valuemin', MIN); h.setAttribute('aria-valuemax', Math.round(innerWidth * 0.25)); h.setAttribute('aria-valuenow', Math.round(sb.getBoundingClientRect().width)); }
      function setW(px) { root.style.setProperty('--sb-w-user', px + 'px'); aria(); }
      function commit(req, prev) {
        if (req < MIN) { setW(prev); app.classList.add('is-collapsed'); wideCollapsed = true; syncSidebar(); return; }
        setW(Math.round(Math.min(req, innerWidth * 0.25)));
      }
      h.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault(); h.setPointerCapture(e.pointerId);
        var rect = sb.getBoundingClientRect(), prev = Math.round(rect.width), req = prev;
        root.classList.add('ecp-no-anim'); h.classList.add('is-dragging');
        function mv(ev) { req = ev.clientX - rect.left; setW(Math.max(MIN, Math.round(Math.min(req, innerWidth * 0.25)))); }
        function up() { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); root.classList.remove('ecp-no-anim'); h.classList.remove('is-dragging'); commit(req, prev); }
        h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      });
      h.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault(); var w = Math.round(sb.getBoundingClientRect().width); commit(w + (e.key === 'ArrowRight' ? STEP : -STEP), w);
      });
      aria(); window.addEventListener('resize', aria);
    })();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSidebar);
    // collapsed rail: the native title tooltip never shows on keyboard focus, so mirror the label in .sb-tip (designs.md §6)
    if (app) {
      var sbTip = document.createElement('div'); sbTip.className = 'sb-tip'; sbTip.setAttribute('aria-hidden', 'true'); sbTip.hidden = true; document.body.appendChild(sbTip);
      app.addEventListener('focusin', function (e) {
        var n = e.target.closest && e.target.closest('.sidebar .nav-item');
        if (!n || !app.classList.contains('is-collapsed') || app.classList.contains('sb-open') || !n.matches(':focus-visible')) return;
        var r = n.getBoundingClientRect();
        sbTip.textContent = n.getAttribute('aria-label') || n.textContent.trim();
        sbTip.style.top = (r.top + r.height / 2) + 'px'; sbTip.style.left = (r.right + 8) + 'px'; sbTip.hidden = false;
      });
      app.addEventListener('focusout', function () { sbTip.hidden = true; });
    }
    function closeSbDrawer(refocus) {
      if (!app || !app.classList.contains('sb-open')) return;
      app.classList.remove('sb-open'); app.classList.add('is-collapsed'); syncSidebar();
      if (refocus) { var b = document.querySelector('.sb-toggle'); if (b) b.focus(); }
    }
    function onViewport() {
      if (!app) return;
      app.classList.remove('sb-open');
      app.classList.toggle('is-collapsed', MQ_RAIL.matches || wideCollapsed);
      syncSidebar();
    }
    if (app) {
      [MQ_RAIL, MQ_OFF].forEach(function (m) { if (m.addEventListener) m.addEventListener('change', onViewport); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSbDrawer(true); });
      document.addEventListener('click', function (e) {
        if (app.classList.contains('sb-open') && !e.target.closest('.sidebar, .sb-toggle')) closeSbDrawer(false);
      });
    }
    // Skip link: first focusable element on every shell page, jumps to <main>
    var mainEl = document.querySelector('main');
    if (mainEl && document.body && !document.querySelector('.skip-link')) {
      if (!mainEl.id) mainEl.id = 'main';
      if (!mainEl.hasAttribute('tabindex')) mainEl.setAttribute('tabindex', '-1');
      var skip = document.createElement('a');
      skip.className = 'skip-link'; skip.href = '#' + mainEl.id;
      skip.setAttribute('data-i18n', 'common.skipToContent');
      skip.textContent = 'Bỏ qua tới nội dung';   // vi source; I18N.apply swaps in EN
      document.body.insertBefore(skip, document.body.firstChild);
      if (I18N) I18N.apply(skip);
    }
    // WAI-ARIA tabs: roving tabindex + Arrow/Home/End (automatic activation via click(), so
    // page-specific tab click handlers keep working)
    document.querySelectorAll('[role="tablist"]').forEach(function (list) {
      var tabs = list.querySelectorAll('[role="tab"]'), sel = list.querySelector('[role="tab"][aria-selected="true"]') || tabs[0];
      tabs.forEach(function (x) { x.setAttribute('tabindex', x === sel ? '0' : '-1'); });
    });
    // keep the roving tabindex in sync whatever code changes aria-selected (activateTab or page scripts)
    if (window.MutationObserver) new MutationObserver(function (ms) {
      ms.forEach(function (m) { var x = m.target; if (x.getAttribute('role') === 'tab') x.setAttribute('tabindex', x.getAttribute('aria-selected') === 'true' ? '0' : '-1'); });
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
    document.addEventListener('keydown', function (e) {
      var t = e.target.closest && e.target.closest('[role="tab"]'), list = t && t.closest('[role="tablist"]');
      if (!list || e.altKey || e.ctrlKey || e.metaKey) return;
      var vert = list.getAttribute('aria-orientation') === 'vertical';
      var tabs = Array.prototype.filter.call(list.querySelectorAll('[role="tab"]'), function (x) {
        return !x.hidden && !x.disabled && x.getAttribute('aria-disabled') !== 'true' && x.offsetParent !== null;
      });
      var i = tabs.indexOf(t), n = tabs.length, j;
      if (i < 0 || !n) return;
      if (e.key === (vert ? 'ArrowDown' : 'ArrowRight')) j = (i + 1) % n;
      else if (e.key === (vert ? 'ArrowUp' : 'ArrowLeft')) j = (i - 1 + n) % n;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      else return;
      e.preventDefault();
      tabs[j].focus();
      if (tabs[j].getAttribute('aria-selected') !== 'true') tabs[j].click();
    });
    KCBack.sync();
    onLang(function () { syncTheme(); syncSidebar(); KCBack.sync(); syncPendingBadge(getRole()); applyRoleGates(); });
    // in-page view handlers depend on visibility (tabs, side panels): re-evaluate after interactions
    ['click', 'keyup'].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(KCBack.sync, 0); }, true); });
    // Deep-link tabs: [role=tab][data-param][data-key] is selected when ?<data-param>=<data-key>
    document.querySelectorAll('[role="tab"][data-param][data-key]').forEach(function (t) {
      if (params.get(t.getAttribute('data-param')) === t.getAttribute('data-key')) activateTab(t);
    });

    // Row -> detail: table[data-detail-target=<id>] rows tr[data-detail=<key>] load template#dt-<key> into #<id>
    document.querySelectorAll('table[data-detail-target]').forEach(function (tbl) {
      var target = document.getElementById(tbl.getAttribute('data-detail-target'));
      if (!target) return;
      function pick(r) {
        var tpl = document.getElementById('dt-' + r.getAttribute('data-detail'));
        if (!tpl) return;
        tbl.querySelectorAll('tbody tr.selected').forEach(function (x) { x.classList.remove('selected'); });
        r.classList.add('selected');
        target.innerHTML = tpl.innerHTML;
        if (target.hasAttribute('data-src')) target.setAttribute('data-src', r.getAttribute('data-detail'));
        var panel = target.closest('[data-detail-panel]');
        var head = panel && panel.querySelector('[data-detail-heading]');
        if (head && tbl.hasAttribute('data-detail-title')) SRC(head, tbl.getAttribute('data-detail-title'));
        if (panel) {
          panel.classList.remove('is-collapsed');
          if (panel.id) document.querySelectorAll('[data-panel-toggle="' + panel.id + '"]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
        }
      }
      tbl._kcPick = pick;
      tbl.querySelectorAll('tbody tr[data-detail]').forEach(function (r) {
        r.addEventListener('click', function (e) { if (!e.target.closest('input, a, button, label')) pick(r); });
        r.addEventListener('keydown', function (e) {
          if (e.target !== r) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r); }
        });
      });
    });

    // Tabbed detail: when a tab panel holding a detail table is shown, load its selected (or first) row if the drawer shows another row
    syncDetail = function (scope) {
      scope.querySelectorAll('table[data-detail-target]').forEach(function (tbl) {
        var target = document.getElementById(tbl.getAttribute('data-detail-target'));
        if (!target || !target.hasAttribute('data-src') || !tbl._kcPick) return;
        var r = tbl.querySelector('tbody tr.selected[data-detail]') || tbl.querySelector('tbody tr[data-detail]');
        if (r && r.getAttribute('data-detail') !== target.getAttribute('data-src')) tbl._kcPick(r);
      });
    };
    document.querySelectorAll('[role="tabpanel"]:not([hidden])').forEach(function (p) { if (!p.closest('[hidden]')) syncDetail(p); });
    // Bulk actions: [data-bulk] buttons in a .card are enabled only when an input[data-bulk-item] is checked
    document.querySelectorAll('.card').forEach(function (card) {
      if (!card.querySelector('[data-bulk]')) return;
      function items() { return card.querySelectorAll('input[data-bulk-item]'); }
      function syncBulk() {
        var any = [].some.call(items(), function (c) { return c.checked; });
        card.querySelectorAll('[data-bulk]').forEach(function (b) { b.disabled = !any; });
        card.querySelectorAll('.disabled-reason[data-bulk-reason]').forEach(function (r) { r.hidden = any; });
        var all = card.querySelector('input[data-bulk-all]');
        if (all) {
          var vis = [].filter.call(items(), function (c) { return !c.closest('tr[hidden]'); });
          var on = vis.filter(function (c) { return c.checked; }).length;
          all.checked = vis.length > 0 && on === vis.length;
          all.indeterminate = on > 0 && on < vis.length;
        }
      }
      card.addEventListener('change', function (e) {
        var el = e.target;
        if (el.hasAttribute('data-bulk-all')) {
          items().forEach(function (c) { if (!c.closest('tr[hidden]')) c.checked = el.checked; });
        }
        if (el.hasAttribute('data-bulk-all') || el.hasAttribute('data-bulk-item')) syncBulk();
      });
      syncBulk();
    });

    // Generic switches (only those opting in with data-switch)
    document.querySelectorAll('button.switch[role="switch"][data-switch]').forEach(function (sw) {
      sw.addEventListener('click', function () {
        var on = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', String(on));
        sw.classList.toggle('is-on', on);
      });
    });

    // [data-goto-tab=<key>]: switch to table view (if any) then to tab ?tab=<key>
    document.querySelectorAll('[data-goto-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        var view = document.querySelector('[role="tab"][data-param="view"][data-key="table"]');
        if (view) activateTab(view);
        var tab = document.querySelector('[role="tab"][data-param="tab"][data-key="' + b.getAttribute('data-goto-tab') + '"]');
        if (tab) { activateTab(tab); tab.focus(); }
      });
    });

    // [data-clear-filter]: reset the chip filter of the panel it sits in to "all"
    document.querySelectorAll('[data-clear-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        var all = document.querySelector('[data-row-filter="' + b.getAttribute('data-clear-filter') + '"] [data-filter="all"]');
        if (all) { all.click(); all.focus(); }
      });
    });

    // Modal: Esc closes (navigates via the close link), focus trap, background inert
    var modal = document.querySelector('.modal-backdrop');
    if (modal) {
      document.body.classList.add('modal-open');
      ['.app-header', '.sidebar', '.app-main'].forEach(function (sel) { var el = document.querySelector(sel); if (el) el.setAttribute('inert', ''); });
      var closeLink = modal.querySelector('.modal-head [data-modal-close]');
      var dlg = modal.querySelector('[role="dialog"]');
      // initial focus: the first focusable element of the dialog (the close button), as the app
      var firstField = dlg.querySelector('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'); if (firstField) firstField.focus();
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && closeLink) { closeLink.click(); return; }
        if (e.key !== 'Tab') return;
        var f = [].filter.call(dlg.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea'), function (x) { return x.offsetParent; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
      });
    }

    // KB create / edit wizard. Edit (?edit=<kb>&from=detail|grid|list) opens the same steps filled from kb-data.js, for a
    // System Admin or an Owner of the KB (anyone else goes back with a toast). Edit can change only the packages and the PII
    // restriction (no update API for the other fields yet): they are read-only, and Manual upload is hidden.
    var wz = document.querySelector('.wz'), KBM = window.ECP_KB;
    var EDIT = wz && KBM && params.get('edit') ? KBM.get(params.get('edit')) : null;
    var backHref = EDIT && params.get('from') === 'detail' ? KBM.detailHref(EDIT) : 'ek-overview-' + (params.get('from') === 'list' ? 'list' : 'grid') + '.html';
    function backTo(flag) { location.href = backHref + (backHref.indexOf('?') === -1 ? '?' : '&') + flag + '=' + encodeURIComponent(EDIT.id); }
    if (EDIT && !KBM.can.editKb(EDIT)) { backTo('denied'); wz = null; }
    if (wz) {
      var TAXO = window.ECP_TAXONOMY;
      var panes = wz.querySelectorAll('.wz-pane'), stepsBtn = wz.querySelectorAll('.wz-step');
      var cur = 0, last = panes.length - 1, prev = document.getElementById('wz-prev'), next = document.getElementById('wz-next');
      var PRE = 2, GOV = 3; // "Governance" (presets, ADR-007) and "Người phụ trách & quyền" steps
      var $ = function (id) { return document.getElementById(id); };
      function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
      function swOn(sw) { return sw.getAttribute('aria-checked') === 'true'; }
      function setSw(sw, on) { sw.setAttribute('aria-checked', String(on)); sw.classList.toggle('is-on', on); }
      // ---------- packages ----------
      function pkgs() { var out = []; wz.querySelectorAll('.wz-pkg tbody input[data-pkg]').forEach(function (c) { if (c.checked) out.push(c.closest('label').textContent.trim()); }); return out; }
      var pkgAll = $('pkg-all');
      function syncPkgs() {
        var all = wz.querySelectorAll('.wz-pkg tbody input[data-pkg]'), on = pkgs().length;
        pkgAll.checked = on === all.length; pkgAll.indeterminate = on > 0 && on < all.length;
        $('pkg-sum').textContent = T('kbc.pkgSum', 'Đã chọn {n}/{all} loại. Có thể bật/tắt sau ở Cài đặt KB.', { n: on, all: all.length });
      }
      pkgAll.addEventListener('change', function () { wz.querySelectorAll('.wz-pkg tbody input[data-pkg]').forEach(function (c) { c.checked = pkgAll.checked; }); syncPkgs(); });
      wz.querySelectorAll('.wz-pkg tbody input[data-pkg]').forEach(function (c) { c.addEventListener('change', syncPkgs); });
      // ---------- PII restriction + protected types (none chosen = every type) ----------
      var piiSw = $('pii-switch'), piiBox = $('pii-types'), PII = KBM ? KBM.PII_TYPES : [];
      piiBox.insertAdjacentHTML('beforeend', PII.map(function (x) { return '<label class="ck"><input type="checkbox" data-pii="' + x + '"><span data-i18n="kbe.piiT.' + x + '">' + esc(KBM.piiType(x)) + '</span></label>'; }).join('') +
        '<p data-i18n="kbe.piiReprocess" class="muted text-xs">' + esc(T('kbe.piiReprocess', 'Tài liệu đã xử lý giữ nguyên đến khi được xử lý lại')) + '</p>');
      function piiTypes() { return [].filter.call(piiBox.querySelectorAll('[data-pii]'), function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-pii'); }); }
      function syncPii() { piiBox.hidden = !swOn(piiSw); }
      piiSw.addEventListener('click', function () { setSw(piiSw, !swOn(piiSw)); syncPii(); });
      // ---------- Manual upload (create only) + Source Path: a KB needs a Source Path, manual upload, or both ----------
      var upSw = $('upload-switch'), srcIn = $('kb-src'), srcOk = null; // null = not checked, true / false = last Kiểm tra
      function syncSrc() {
        var manual = swOn(upSw), m = $('src-msg');
        wz.querySelector('[data-src-req]').hidden = manual; wz.querySelector('[data-src-opt]').hidden = !manual;
        m.textContent = srcOk === true ? T('kbe.srcFormatOk', '✓ Đúng định dạng. Quyền truy cập được kiểm tra sau khi tạo.') : srcOk === false ? T('kbc.srcBad', 'Path không hợp lệ. Dạng đúng: s3://bucket/folder/') : T('kbe.srcHint', 'Path folder trong Object Storage landing bucket.');
        m.className = 'muted src-msg text-xs' + (srcOk === true ? ' is-ok' : srcOk === false ? ' is-err' : '');
        srcIn.setAttribute('aria-invalid', String(srcOk === false));
      }
      upSw.addEventListener('click', function () { setSw(upSw, !swOn(upSw)); syncSrc(); clearErr($('src-field')); });
      $('src-check').addEventListener('click', function () { srcOk = /^s3:\/\/[\w.-]+\/.+\/$/.test(srcIn.value.trim()); syncSrc(); });
      srcIn.addEventListener('input', function () { srcOk = null; syncSrc(); clearErr($('src-field')); });
      $('kb-name').addEventListener('input', function () { clearErr($('kb-name').closest('.field')); });
      // ---------- data (mock) ----------
      // tags = Global taxonomy values [name, tag type, type code]; people from kb-data.js
      var DATA = {
        tag: TAXO ? TAXO.values().map(function (x) { return [x.name, x.typeName, x.type]; }) : [],
        own: KBM ? Object.keys(KBM.PEOPLE).map(function (id) { return [KBM.PEOPLE[id][0], KBM.PEOPLE[id][1]]; }) : []
      };
      DATA.stw = DATA.own;
      function tagItem(t) {
        if (typeof t === 'string') return [t, '', null];
        var m = TAXO && TAXO.find(t[1], t[0]);
        return [t[1], m ? m.type.name : '', t[0]];
      }
      function personItem(id) { var p = KBM.person(id); return [p.name, p.email]; }
      var SEL = EDIT ? { tag: EDIT.tags.map(tagItem), own: EDIT.owners.map(personItem), stw: EDIT.stewards.map(personItem) }
        : { tag: [['Khối Khách hàng doanh nghiệp', 'Khối', 'BIZ_BLOCK'], ['Vay vốn lưu động', 'Loại khoản vay', 'LOAN_TYPE'], ['Thẩm định tín dụng', 'Quy trình', 'PROCESS']], own: [['Nguyễn Lan', 'lan.nguyen@msb.com.vn']], stw: [['Trần Hải', 'hai.tran@msb.com.vn']] };
      var LOCKED = !!EDIT;
      function norm(t) { return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
      function has(kind, n) { return SEL[kind].some(function (x) { return x[0] === n; }); }
      function add(kind, item) { if (!has(kind, item[0])) { SEL[kind].push(item); render(kind); clearErr(wz.querySelector('[data-cbx="' + kind + '"]').closest('.field')); } }
      function remove(kind, n) { SEL[kind] = SEL[kind].filter(function (x) { return x[0] !== n; }); render(kind); }
      // ---------- chips (× disabled in edit mode) ----------
      function render(kind) {
        var box = wz.querySelector('[data-chosen="' + kind + '"]'); if (!box) return;
        var dis = LOCKED ? ' disabled' : '';
        if (kind === 'tag' && TAXO) {
          box.innerHTML = SEL.tag.map(function (x) { return TAXO.tagHtml(x[2] ? [x[2], x[0]] : x[0], { removable: true }); }).join(' ') || '<span class="muted text-xs">' + T('kbc.noneSelected', 'Chưa chọn') + '</span>';
          if (LOCKED) box.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
          return;
        }
        box.innerHTML = SEL[kind].map(function (x) {
          return '<span class="chip chip-pick">' + esc(x[0]) + ' <button type="button" class="chip-x" data-rm="' + kind + '" data-name="' + esc(x[0]) + '" aria-label="' + esc(T('kbc.removeX', 'Bỏ {x}', { x: x[0] })) + '"' + dis + '>×</button></span>';
        }).join('') || '<span class="muted text-xs">' + T('kbc.noneSelected', 'Chưa chọn') + '</span>';
      }
      wz.addEventListener('click', function (e) {
        var x = e.target.closest('[data-rm]'); if (x && !x.disabled) { remove(x.getAttribute('data-rm'), x.getAttribute('data-name')); return; }
        var tg = e.target.closest('[data-rm-tag]'); if (tg && !tg.disabled) { remove('tag', tg.getAttribute('data-rm-tag')); var ti = $('tag-in'); if (ti) ti.focus(); }
      });
      // ---------- combobox with fuzzy suggestions ----------
      wz.querySelectorAll('[data-cbx]').forEach(function (box) {
        var kind = box.getAttribute('data-cbx'), inp = box.querySelector('input'), lb = box.querySelector('[role="listbox"]'), act = -1, items = [];
        if (LOCKED) { inp.disabled = true; return; }
        function close() { lb.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); act = -1; }
        function open() {
          var q = norm(inp.value.trim());
          if (!q && kind !== 'tag') { close(); return; }
          items = DATA[kind].filter(function (x) {
            if (has(kind, x[0])) return false;
            if (!q) return true;
            var n = norm(x[0]), m = norm(x[1]);
            if (n.indexOf(q) > -1 || m.indexOf(q) > -1) return true;
            var ini = n.split(/\s+/).map(function (w) { return w[0]; }).join('');
            return ini.indexOf(q.replace(/\s+/g, '')) === 0;
          }).slice(0, kind === 'tag' ? 12 : 8);
          var lastG = null;
          lb.innerHTML = items.map(function (x, i) {
            var head = '';
            if (kind === 'tag' && x[1] !== lastG) { lastG = x[1]; head = '<li class="cbx-group" role="presentation">' + esc(x[1]) + '</li>'; }
            return head + '<li role="option" id="' + kind + '-opt' + i + '" data-i="' + i + '"><span>' + esc(x[0]) + '</span><span class="muted text-xs">' + esc(x[1]) + '</span></li>';
          }).join('') || '<li class="cbx-empty muted text-xs">' + T('kbc.noResult', 'Không có kết quả') + '</li>';
          lb.hidden = false; inp.setAttribute('aria-expanded', 'true');
        }
        function pick(i) { if (items[i]) { add(kind, items[i]); inp.value = ''; close(); inp.focus(); } }
        function hl(i) { var o = lb.querySelectorAll('[role="option"]'); if (!o.length) return; act = (i + o.length) % o.length; o.forEach(function (x, n) { x.classList.toggle('is-active', n === act); x.setAttribute('aria-selected', String(n === act)); }); inp.setAttribute('aria-activedescendant', o[act].id); }
        inp.addEventListener('input', open);
        if (kind === 'tag') inp.addEventListener('focus', open);
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowDown') { e.preventDefault(); if (lb.hidden) open(); if (!lb.hidden) hl(act + 1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); hl(act - 1); }
          else if (e.key === 'Enter') { e.preventDefault(); pick(act < 0 ? 0 : act); }
          else if (e.key === 'Escape' && !lb.hidden) { e.stopPropagation(); close(); }
        });
        lb.addEventListener('mousedown', function (e) { var li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pick(+li.getAttribute('data-i')); } });
        inp.addEventListener('blur', function () { setTimeout(close, 120); });
      });
      // chosen chips and suggestions show sample taxonomy / people data (kept in its source language)
      wz.querySelectorAll('[data-chosen], [data-cbx] [role="listbox"]').forEach(function (x) { x.setAttribute('data-i18n-skip', ''); });
      var permAgent = $('perm-agent');
      // ---------- step 3 "Governance" (ADR-007): one ontology + one taxonomy preset, Global by default; presets without a
      // published version are left out; each shows its counts. Edit: read-only, the KB's current preset (changed on the detail)
      var PRESET = {};
      function syncPresets() {
        wz.querySelectorAll('[data-preset-kind]').forEach(function (sel) {
          var kind = sel.getAttribute('data-preset-kind'), p = KBM.PRESETS[kind].filter(function (x) { return x.id === sel.value; })[0];
          PRESET[kind] = EDIT ? KBM.presetOf(EDIT, kind) : { name: p.name, version: p.versions[0].v };
          var c = !EDIT && p.counts;
          $(sel.id + '-hint').textContent = !c ? '' : kind === 'ontology' ? T('web.preset.countsOnt', '{e} entity type · {r} quan hệ · {tr} triple', c) : T('web.preset.countsTax', '{g} nhóm tag · {v} tag', c);
        });
      }
      wz.querySelectorAll('[data-preset-kind]').forEach(function (sel) {
        var kind = sel.getAttribute('data-preset-kind'), list = EDIT ? [KBM.presetOf(EDIT, kind)] : KBM.choosable(kind);
        sel.innerHTML = list.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name + ' · v' + (EDIT ? p.version : p.versions[0].v)) + '</option>'; }).join('');
        sel.value = EDIT ? list[0].id : list.filter(function (p) { return p.global; })[0].id;
        sel.disabled = !!EDIT;
        sel.addEventListener('change', syncPresets);
      });
      if (EDIT) { var pn = wz.querySelector('[data-presets-note]'); pn.setAttribute('data-i18n', 'web.kbc.presetsLocked'); pn.textContent = T('web.kbc.presetsLocked', 'Đổi preset ở trang chi tiết tri thức (Đổi preset).'); }
      syncPresets();
      // ---------- edit mode: filled from the KB; only packages and PII stay editable ----------
      if (EDIT) {
        $('kb-name').value = EDIT.name; $('kb-desc').value = EDIT.desc; srcIn.value = EDIT.srcs[0] || '';
        ['kb-name', 'kb-desc', 'kb-src', 'src-check'].forEach(function (id) { $(id).disabled = true; });
        permAgent.checked = !!EDIT.stewardAgent; permAgent.disabled = true;
        wz.querySelector('[data-manual-field]').hidden = true;
        wz.querySelectorAll('[data-edit-locked]').forEach(function (n) { n.hidden = false; });
        wz.querySelector('[data-edit-pkg]').hidden = !EDIT.active;
        setSw(piiSw, !!EDIT.pii);
        piiBox.querySelectorAll('[data-pii]').forEach(function (c) { c.checked = !!EDIT.pii && EDIT.pii.indexOf(c.getAttribute('data-pii')) !== -1; });
        wz.querySelectorAll('.wz-pkg tbody input[data-pkg]').forEach(function (c) { c.checked = EDIT.pkgs.indexOf(c.getAttribute('data-pkg')) !== -1; });
        var ttl = $('wz-title'); ttl.setAttribute('data-i18n', 'kbm.menuEdit'); ttl.textContent = T('kbm.menuEdit', 'Chỉnh sửa tri thức');
        document.querySelectorAll('[data-modal-close]').forEach(function (a) { a.setAttribute('href', backHref); });
      }
      syncPkgs(); syncPii(); syncSrc();
      ['tag', 'own', 'stw'].forEach(render);
      // ---------- required fields: name + (Source Path or manual upload) on step 1, an Owner on step 4 (Steward optional) ----------
      // stepper error mark follows the Name (step 1) and Owner (step 4) errors only, as the app
      function syncStepErr() {
        stepsBtn[0].classList.toggle('is-error', $('kb-name').closest('.field').classList.contains('has-error'));
        stepsBtn[GOV].classList.toggle('is-error', wz.querySelector('[data-cbx="own"]').closest('.field').classList.contains('has-error'));
      }
      function clearErr(fd) { if (!fd) return; fd.classList.remove('has-error'); var e = fd.querySelector('.field-err'); if (e) e.remove(); syncStepErr(); }
      function setErr(fd, key, vi) {
        fd.classList.add('has-error');
        var e = fd.querySelector('.field-err');
        if (!e) { e = document.createElement('span'); e.className = 'field-err'; e.setAttribute('role', 'alert'); fd.appendChild(e); }
        e.__kcMsg = [key, vi]; e.textContent = T(key, vi);
        syncStepErr();
      }
      function validate(i) {
        var ok = true;
        if (i === 0) { clearErr($('kb-name').closest('.field')); clearErr($('src-field')); }
        if (i === GOV) clearErr(wz.querySelector('[data-cbx="own"]').closest('.field'));
        if (i === 0) {
          if (!$('kb-name').value.trim()) { setErr($('kb-name').closest('.field'), 'kbc.errName', 'Nhập tên tri thức'); ok = false; }
          if (!swOn(upSw) && !srcIn.value.trim()) { setErr($('src-field'), 'kbe.errIntake', 'Nhập Source Path hoặc bật Cho phép tải lên thủ công'); ok = false; }
        } else if (i === GOV && !SEL.own.length) { setErr(wz.querySelector('[data-cbx="own"]').closest('.field'), 'kbc.errPeople', 'Thêm ít nhất 1 người'); ok = false; }
        return ok;
      }
      function summary() {
        var g = function (step, rows, note) {
          return '<div class="sum-group"><div class="row-between"><b>' + esc(stepsBtn[step].textContent.replace(/^(\d)/, '$1. ')) + '</b><button class="link" type="button" data-goto="' + step + '">' + T('kbc.edit', 'Sửa') + '</button></div><dl class="kv">' +
            rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' + (note ? '<p class="muted text-sm mt-8">' + note + '</p>' : '') + '</div>';
        };
        var none = '<span class="muted">' + T('kbc.sumNone', 'Chưa chọn') + '</span>';
        var tags = esc(SEL.tag.map(function (x) { return x[1] ? x[0] + ' (' + x[1] + ')' : x[0]; }).join(', ')) || none;
        var ppl = function (k) { return SEL[k].map(function (x) { return esc(x[0]); }).join(', ') || '–'; };
        var perms = T('kbc.permsSum', 'Cập nhật nội dung: Owner, Steward<br>Duyệt evolution: Owner<br>Duyệt thay đổi: Owner<br>Duyệt thay đổi từ Agent: Owner') + (permAgent.checked ? ', Steward' : '') +
          '<br><span class="muted">' + T('kbc.permsDelegLater', 'Ủy quyền duyệt cho từng Steward: Owner thiết lập ở menu ⋯ › Ủy quyền duyệt') + '</span>';
        var d1 = [[T('kbc.sumName', 'Tên'), esc($('kb-name').value)], [T('kbc.sumDesc', 'Mô tả'), esc($('kb-desc').value)], ['Tag', tags], ['Source Path', '<span class="mono">' + esc(srcIn.value.trim() || '–') + '</span>']];
        if (!LOCKED) d1.push([T('kbe.manualUpload', 'Cho phép tải lên thủ công'), swOn(upSw) ? T('kbc.on', 'Bật') : T('kbc.off', 'Tắt')]);
        d1.push(['PII restrictions', esc(KBM.piiLabel(swOn(piiSw) ? piiTypes() : false))]);
        var d3 = [['Owner', ppl('own')], ['Steward', SEL.stw.length ? ppl('stw') : T('kbe.notAssigned', 'Chưa chỉ định')]];
        if (!LOCKED) d3.push([T('kbc.sumPerms', 'Quyền'), perms]);
        $('wz-summary').innerHTML =
          g(0, d1) +
          g(1, [['Model, Storage', 'System Setting'], ['Parser', T('kbc.sumParser', 'System (Default) cho 8 loại file: MD, Web, Word, Excel, Presentation, Image, PDF 2 lớp, PDF 1 lớp (scan)')], ['Chunking', 'Document Structure Aware Agentic Chunking'], ['Media', T('kbc.sumMedia', 'RAG-Anything, Multimodal (bật)')]]) +
          g(PRE, [['Ontology', esc(PRESET.ontology.name + ' · v' + PRESET.ontology.version)], ['Taxonomy', esc(PRESET.taxonomy.name + ' · v' + PRESET.taxonomy.version)]]) +
          g(GOV, d3) +
          g(4, [[T('kbc.sumSelected', 'Đã chọn'), pkgs().length ? T('kbc.sumPkgs', '{n} loại: {list}', { n: pkgs().length, list: pkgs().map(esc).join(', ') }) : '0 Knowledge Package']]);
      }
      // forward moves (Next, stepper, ?step) check every step they pass and stop at the first one with a missing field
      function go(i) {
        for (var k = cur; k < i; k++) if (!validate(k)) { i = k; break; }
        for (var k2 = 0; k2 < i; k2++) stepsBtn[k2].classList.add('is-done');
        cur = i;
        panes.forEach(function (p, n) { p.hidden = n !== cur; });
        stepsBtn.forEach(function (b, n) { b.classList.toggle('is-current', n === cur); if (n === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
        prev.disabled = cur === 0;
        nextLabel();
        if (cur === last) summary();
        wz.querySelector('.wz-scroll').scrollTop = 0;
      }
      function nextLabel() { next.textContent = cur === last ? (EDIT ? T('kbc.saveChanges', 'Lưu thay đổi') : T('kbc.create', 'Tạo tri thức')) : T('kbc.next', 'Tiếp tục'); }
      nextLabel();
      onLang(function () {
        nextLabel(); syncPkgs(); syncSrc(); syncPresets();
        ['tag', 'own', 'stw'].forEach(render);
        wz.querySelectorAll('.field-err').forEach(function (e) { if (e.__kcMsg) e.textContent = T(e.__kcMsg[0], e.__kcMsg[1]); });
        if (cur === last) summary();
      });
      // Edit KB saves the packages and the PII restriction (mock state, this browser only), then goes back with a toast
      function saveEdit() {
        var patch = { pii: swOn(piiSw) ? piiTypes() : false, pkgs: [].filter.call(wz.querySelectorAll('.wz-pkg tbody input[data-pkg]'), function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-pkg'); }) };
        if (!KBM.save(EDIT.id, patch)) { (window.ECP_toast || function () {})(T('kbe.saveFailed', 'Không lưu được thay đổi. Hãy thử lại.')); return; }
        backTo('saved');
      }
      next.addEventListener('click', function () {
        if (cur !== last) { go(cur + 1); return; }
        for (var s = 0; s < last; s++) if (!validate(s)) { go(s); return; }
        // created: the new KB's page; a Source Path is checked after the create and reported in a toast (mock: accessible)
        if (EDIT) saveEdit(); else location.href = 'ek-knowledge-detail-empty.html' + (srcIn.value.trim() ? '?created=src' : '');
      });
      prev.addEventListener('click', function () { go(cur - 1); });
      wz.addEventListener('click', function (e) { var t = e.target.closest('[data-goto]'); if (t) go(parseInt(t.getAttribute('data-goto'), 10)); });
      var st = params.get('step'); if (st) go(Math.max(0, Math.min(last, parseInt(st, 10) || 0)));
    }

    // Transformation Job (as the app, transformation-jobs-screen.tsx): one row per Knowledge Base with its runs per outcome,
    // its last run, files and time; KB name / Last run / Time sort; the header search filters by KB name or the last run's
    // job ID; a row opens the KB's Transformation Job. ?state=loading|noperm|empty shows the other states.
    var jobTable = document.querySelector('.job-table');
    if (jobTable && window.ECP_TJ) {
      var TJ = window.ECP_TJ, jobBody = jobTable.querySelector('tbody'), E = TJ.esc, jobSort = null, jobQ = document.getElementById('qs');
      var RANK = { running: 0, queued: 1, failed: 2, partial: 3, done: 4, skipped: 5, cancelled: 6 };
      var LAB = { running: ['common.running', 'Đang chạy', 'info'], queued: ['common.waiting', 'Đang chờ', 'neutral'], failed: ['web.tj.st.error', 'Lỗi', 'error'], partial: ['web.tj.st.partial', 'Thất bại', 'error'], done: ['common.completed', 'Hoàn tất', 'success'], skipped: ['tj.skipped', 'Bỏ qua', 'neutral'], cancelled: ['web.tj.st.cancelled', 'Đã hủy', 'neutral'] };
      var COLS = [['done', 'success'], ['partial', 'error'], ['failed', 'error'], ['skipped', 'neutral'], ['cancelled', 'neutral']];
      var STATE = params.get('state'), FIRST = { name: 'asc', last: 'asc', activity: 'desc' };
      function when(j) { return (j.day || 0) * 86400 + j.start[0] * 3600 + j.start[1] * 60; }
      function jobRows() {
        var q = jobQ ? jobQ.value.trim().toLowerCase() : '';
        var items = TJ.kbSummaries().filter(function (k) { return !q || k.kbName.toLowerCase().indexOf(q) !== -1 || String(k.last.id).toLowerCase().indexOf(q) !== -1; });
        if (jobSort) {
          var sg = jobSort.dir === 'asc' ? 1 : -1, by = { name: function (a, b) { return a.kbName.localeCompare(b.kbName, 'vi', { numeric: true }); }, last: function (a, b) { return RANK[a.last.status] - RANK[b.last.status]; }, activity: function (a, b) { return when(a.last) - when(b.last); } }[jobSort.key];
          items = items.slice().sort(function (a, b) { return sg * by(a, b); });
        }
        return items;
      }
      function kbRowHtml(k) {
        var l = k.last, lab = LAB[l.status], files = l.status === 'skipped' ? T('tj.n0Changes', '0 thay đổi') : l.total == null ? '–' : T('web.tj.filesOf', '{a} / {b} file', { a: TJ.fmtInt(l.ok), b: TJ.fmtInt(l.total) });
        var cells = COLS.map(function (c) {
          var n = k.jobs.filter(function (j) { return j.status === c[0]; }).length;
          return '<td class="tj-num">' + (n ? '<span class="tj-count tone-' + c[1] + '">' + TJ.fmtInt(n) + '</span>' : '<span class="muted">' + (c[0] === 'partial' || c[0] === 'failed' ? TJ.fmtInt(0) : '–') + '</span>') + '</td>';
        }).join('');
        var href = 'transformation-job-kb.html?kb=' + encodeURIComponent(k.kb);
        return '<tr class="job-kb-row" data-kb="' + E(k.kb) + '"><td class="job-kb"><div class="job-kb-name"><a class="bold job-ell link" href="' + href + '" data-i18n-skip title="' + E(k.kbName) + '" aria-label="' + E(T('web.tj.openKbJobs', 'Xem Transformation Job của {name}', { name: k.kbName })) + '">' + E(k.kbName) + '</a></div></td>' +
          '<td class="tj-num">' + TJ.fmtInt(k.jobs.length) + '</td>' + cells +
          '<td class="job-st-cell"><div class="job-st tone-' + lab[2] + '"><div class="job-st-text"><div class="job-st-label job-ell">' + E(T(lab[0], lab[1])) + '</div></div></div></td>' +
          '<td class="nowrap text-sm">' + E(files) + '</td>' +
          '<td class="nowrap text-sm"><span title="' + E(T('web.tj.submittedAt', 'Thời điểm gửi')) + '">' + E(TJ.fmtClock(l)) + '</span><div class="muted text-xs" title="' + E(T('web.tj.processingTime', 'Thời gian xử lý')) + '">' + E(TJ.fmtDur(l.dur)) + '</div></td></tr>';
      }
      function renderJobs() {
        var items = jobRows();
        var msg = STATE === 'loading' ? T('web.tj.loading', 'Đang tải lượt chạy…') : STATE === 'noperm' ? T('web.tj.nopermDesc', 'Bạn chưa có quyền xem Transformation Job. Liên hệ Owner hoặc Admin.') : (STATE === 'empty' || !items.length) ? T('web.tj.empty', 'Chưa có lượt chạy nào. Job được tạo tự động khi source thay đổi, theo lịch hoặc sau chỉnh sửa đã duyệt.') : '';
        jobBody.innerHTML = msg ? '<tr class="filter-empty"><td colspan="10" class="muted">' + E(msg) + '</td></tr>' : items.map(kbRowHtml).join('');
        jobTable.querySelectorAll('th[data-job-sort]').forEach(function (th) {
          var on = jobSort && jobSort.key === th.getAttribute('data-job-sort');
          if (on) th.setAttribute('aria-sort', jobSort.dir === 'asc' ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort');
        });
      }
      jobTable.addEventListener('click', function (e) {
        var sb = e.target.closest('[data-job-sort] .th-sort');
        if (sb) { var key = sb.parentNode.getAttribute('data-job-sort'); jobSort = jobSort && jobSort.key === key ? { key: key, dir: jobSort.dir === 'asc' ? 'desc' : 'asc' } : { key: key, dir: FIRST[key] }; renderJobs(); return; }
        if (e.target.closest('a')) return;
        var row = e.target.closest('tr.job-kb-row');
        if (row) location.href = 'transformation-job-kb.html?kb=' + encodeURIComponent(row.getAttribute('data-kb'));
      });
      if (jobQ) jobQ.addEventListener('input', renderJobs);
      onLang(renderJobs);
      renderJobs();
    }

    // Artifact viewer: full-screen overlay, Esc closes (href-navigation close; scoped to viewer pages)
    var overlay = document.querySelector('.viewer-overlay:not(.job-log-overlay)');
    if (overlay) {
      var closeBtn = overlay.querySelector('.viewer-close');
      document.addEventListener('keydown', function (e) {
        // an open modal (version popup, confirm) owns Esc; only leave the viewer when none is open
        if (e.key === 'Escape' && closeBtn && !e.defaultPrevented && !document.querySelector('dialog[open]')) closeBtn.click();
      });
    }

    // FAQ viewer: accordion + selecting a question updates the Sources tab
    document.querySelectorAll('.faq-item').forEach(function (it) {
      var q = it.querySelector('.faq-q');
      q.addEventListener('click', function () {
        var open = q.getAttribute('aria-expanded') !== 'true';
        q.setAttribute('aria-expanded', String(open));
        var a = document.getElementById(q.getAttribute('aria-controls'));
        if (a) a.hidden = !open;
        document.querySelectorAll('.faq-item').forEach(function (x) { x.classList.toggle('is-active', x === it); });
        var label = document.getElementById('src-q');
        if (label) SRC(label, it.querySelector('.faq-q-text').textContent);
        var tpl = document.querySelector('template[data-src-for="' + it.getAttribute('data-faq') + '"]');
        var list = document.getElementById('src-list');
        if (tpl && list) list.innerHTML = tpl.innerHTML;
        pickPkgItem(it.getAttribute('data-faq'), it.querySelector('.faq-q-text').textContent);
      });
    });

    // FAQ viewer: text filter + topic chips actually filter the list
    var faqFilter = document.getElementById('faq-filter');
    var faqTopics = document.querySelector('[data-faq-topics]');
    function applyFaqFilter() {
      var q = faqFilter ? faqFilter.value.trim().toLowerCase() : '';
      var on = faqTopics ? faqTopics.querySelector('[aria-pressed="true"]') : null;
      // compare stable keys, not visible (translated) chip text
      var topic = on ? (on.getAttribute('data-topic-key') || 'all') : 'all';
      var shown = 0;
      document.querySelectorAll('.faq-item').forEach(function (it) {
        var okT = topic === 'all' || it.getAttribute('data-topic') === topic;
        var okQ = !q || it.textContent.toLowerCase().indexOf(q) !== -1;
        it.hidden = !(okT && okQ); if (!it.hidden) shown++;
      });
      var c = document.querySelector('.faq-count'); if (c) c.textContent = T('view.faqCount', '{n} câu hỏi', { n: shown });
    }
    if (document.querySelector('.faq-count')) { applyFaqFilter(); onLang(applyFaqFilter); }
    if (faqFilter) faqFilter.addEventListener('input', applyFaqFilter);
    if (faqTopics) faqTopics.addEventListener('click', function () { setTimeout(applyFaqFilter, 0); });

    // Wiki/Playbook: select a section/step -> highlight + update Sources label
    function selectSection(el, label) {
      document.querySelectorAll('.chunk-anchor.is-highlight').forEach(function (x) { x.classList.remove('is-highlight'); });
      el.classList.add('is-highlight');
      el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      var l = document.getElementById('src-q'); if (l) SRC(l, label);
      pickPkgItem(el.id, label);
    }
    // Package viewer Graph (FE PackageGraph): the current section / question / step is the selected item node and is named,
    // with its adjacent nodes and relationships, in the property strip. A click on an item node selects that item.
    function pickPkgItem(key, label) {
      var g = document.querySelector('.vg-svg [data-item="' + key + '"]'); if (!g) return;
      document.querySelectorAll('.vg-svg .vg-item').forEach(function (c) { c.classList.toggle('is-sel', c.parentNode === g); });
      var nm = document.getElementById('vg-name'); if (nm) nm.textContent = label;
      var rel = document.getElementById('vg-rel'), nmv = g.getAttribute('data-rel').split(',');
      if (rel) { rel.setAttribute('data-i18n-args', JSON.stringify({ n: +nmv[0], m: +nmv[1] })); rel.textContent = T('kbe.adjRel', '{n} node kề · {m} quan hệ', { n: nmv[0], m: nmv[1] }); }
    }
    document.querySelectorAll('.vg-svg [data-item]').forEach(function (g) {
      g.addEventListener('click', function () {
        var key = g.getAttribute('data-item'), label = g.querySelector('text').textContent;
        var toc = document.querySelector('.wiki-toc-link[data-sec="' + key + '"]'), st = document.getElementById(key), faq = document.querySelector('.faq-item[data-faq="' + key + '"]');
        if (toc) { label = toc.textContent; document.querySelectorAll('.wiki-toc-link').forEach(function (x) { x.classList.toggle('is-active', x === toc); }); }
        else if (faq) { label = faq.querySelector('.faq-q-text').textContent; document.querySelectorAll('.faq-item').forEach(function (x) { x.classList.toggle('is-active', x === faq); }); }
        else if (st && st.classList.contains('pb-step')) { label = st.querySelector('.pb-title').textContent; document.querySelectorAll('.pb-step').forEach(function (x) { x.classList.toggle('is-active', x === st); }); }
        var l = document.getElementById('src-q'); if (l) SRC(l, label);
        pickPkgItem(key, label);
      });
    });
    // "Mở evidence" opens the Sources tab
    var vgEv = document.querySelector('[data-vg-evidence]');
    if (vgEv) vgEv.addEventListener('click', function () { var tab = document.getElementById('vt-chunk'); if (tab) tab.click(); });
    document.querySelectorAll('.wiki-toc-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('.wiki-toc-link').forEach(function (x) { x.classList.toggle('is-active', x === a); });
        var sec = document.getElementById(a.getAttribute('data-sec'));
        if (sec) selectSection(sec, a.textContent);
      });
    });
    document.querySelectorAll('.pb-head').forEach(function (b) {
      b.addEventListener('click', function () {
        var st = document.getElementById(b.getAttribute('data-step'));
        document.querySelectorAll('.pb-step').forEach(function (x) { x.classList.toggle('is-active', x === st); });
        if (st) selectSection(st, st.querySelector('.pb-title').textContent);
      });
    });

    // Artifact viewer: chunk click -> scroll + highlight; resizable panes
    var vsplit = document.querySelector('.viewer-split');
    if (vsplit) {
      var doc = vsplit.querySelector('.viewer-doc');
      vsplit.querySelectorAll('.chunk-item').forEach(function (ci) {
        ci.addEventListener('click', function () {
          vsplit.querySelectorAll('.chunk-item').forEach(function (x) { x.classList.toggle('is-active', x === ci); });
          var target = document.getElementById(ci.getAttribute('data-chunk'));
          if (!target) return;
          target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
          vsplit.querySelectorAll('.chunk-anchor.is-highlight').forEach(function (x) { x.classList.remove('is-highlight'); });
          target.classList.add('is-highlight');
        });
      });
      // Graph tab: click/Enter on a node updates the property strip
      function showNode(c) {
        vsplit.querySelectorAll('[data-node]').forEach(function (x) { x.classList.toggle('n-sel', x === c); });
        var set = function (id, v) { var el = document.getElementById(id); if (el) SRC(el, v); };
        set('vg-name', c.getAttribute('data-label')); set('vg-type', c.getAttribute('data-type'));
        set('vg-layer', c.getAttribute('data-layer')); set('vg-extra', c.getAttribute('data-extra'));
      }
      vsplit.querySelectorAll('[data-node]').forEach(function (c) {
        c.addEventListener('click', function () { showNode(c); });
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showNode(c); } });
      });
      var vrez = vsplit.querySelector('[data-col-resizer]');
      if (vrez) {
        var vMin = 280, vDrag = false;
        function vMax() { return Math.round(vsplit.getBoundingClientRect().width * 0.7); }
        function vSet(px) {
          var w = Math.max(vMin, Math.min(vMax(), px));
          vsplit.style.setProperty('--viewer-side-w', w + 'px');
          try { localStorage.setItem('viewer-side-w', String(w)); } catch (e) {}
        }
        try { var vw = localStorage.getItem('viewer-side-w'); if (vw) vSet(parseInt(vw, 10)); } catch (e) {}
        // panel sits on the right: width = right edge - pointer x
        function vMove(e) { if (vDrag) { vSet(vsplit.getBoundingClientRect().right - e.clientX); } }
        function vUp() { vDrag = false; vrez.classList.remove('is-dragging'); document.body.style.userSelect = ''; document.removeEventListener('mousemove', vMove); document.removeEventListener('mouseup', vUp); }
        vrez.addEventListener('mousedown', function (e) { vDrag = true; vrez.classList.add('is-dragging'); e.preventDefault(); document.body.style.userSelect = 'none'; document.addEventListener('mousemove', vMove); document.addEventListener('mouseup', vUp); });
        vrez.addEventListener('keydown', function (e) {
          var cur = parseInt(vsplit.style.getPropertyValue('--viewer-side-w') || '400', 10) || 400;
          if (e.key === 'ArrowLeft') { vSet(cur + 16); e.preventDefault(); }
          else if (e.key === 'ArrowRight') { vSet(cur - 16); e.preventDefault(); }
        });
      }
    }

    // KB detail: collapsible + resizable right card
    var split = document.querySelector('.detail-split');
    if (split) {
      var MINW = 240, MAXW = 560;
      function setSideCollapsed(collapsed, save) {
        split.classList.toggle('side-collapsed', collapsed);
        split.querySelectorAll('[data-side-toggle]').forEach(function (b) {
          b.setAttribute('aria-expanded', String(!collapsed));
        });
        var reopen = document.querySelector('.kb-side-reopen');
        if (reopen) reopen.setAttribute('aria-expanded', String(!collapsed));
        if (save) { try { localStorage.setItem('kb-side', collapsed ? 'closed' : 'open'); } catch (e) {} }
      }
      function setSideWidth(px, save) {
        var w = Math.max(MINW, Math.min(MAXW, px));
        split.style.setProperty('--kb-side-w', w + 'px');
        if (save) { try { localStorage.setItem('kb-side-w', String(w)); } catch (e) {} }
        return w;
      }
      try {
        var sw0 = localStorage.getItem('kb-side-w');
        if (sw0) setSideWidth(parseInt(sw0, 10), false);
        setSideCollapsed(localStorage.getItem('kb-side') === 'closed', false);
      } catch (e) {}
      document.querySelectorAll('[data-side-toggle]').forEach(function (b) {
        b.addEventListener('click', function () {
          setSideCollapsed(!split.classList.contains('side-collapsed'), true);
        });
      });
      var rez = split.querySelector('[data-col-resizer]');
      if (rez) {
        var dragging = false;
        function onMove(e) {
          if (!dragging) return;
          var rect = split.getBoundingClientRect();
          setSideWidth(rect.right - e.clientX, false);
        }
        function onUp() {
          if (!dragging) return;
          dragging = false;
          document.body.style.userSelect = '';
          try { localStorage.setItem('kb-side-w', split.style.getPropertyValue('--kb-side-w').replace('px', '')); } catch (e) {}
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }
        rez.addEventListener('mousedown', function (e) {
          dragging = true; e.preventDefault();
          document.body.style.userSelect = 'none';
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
        rez.addEventListener('keydown', function (e) {
          var cur = parseInt(split.style.getPropertyValue('--kb-side-w') || '360', 10) || 360;
          if (e.key === 'ArrowLeft') { setSideWidth(cur + 16, true); e.preventDefault(); }
          else if (e.key === 'ArrowRight') { setSideWidth(cur - 16, true); e.preventDefault(); }
        });
      }
    }

    // Knowledge Graph: the chat panel opens expanded on every load (FE keeps no stored state, also <1200px)

    var esl = document.querySelector('.es-layout[data-hist-default]');
    var ES_NARROW = mq('(max-width: 1199px)');
    function setHist(collapsed, save) {
      if (!esl) return;
      esl.classList.toggle('history-collapsed', collapsed);
      document.querySelectorAll('[data-hist-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', String(!collapsed)); });
      if (save) { try { localStorage.setItem('es-history', collapsed ? 'closed' : 'open'); } catch (err) {} }
    }
    if (esl) {
      var hs = params.get('history');
      if (!hs) { try { hs = localStorage.getItem('es-history'); } catch (err) {} }
      // <1200px History is an overlay drawer (screens.css es-nd): start closed unless ?history=open
      if (ES_NARROW.matches && params.get('history') !== 'open') hs = 'closed';
      setHist((hs || esl.getAttribute('data-hist-default')) === 'closed', false);
    }

    // ===== Enterprise Search · History: search icon → inline filter; compact list capped, "View all" → right-side drawer;
    //       × on an entry deletes it, "Xóa tất cả" clears the list after a confirm dialog (mock: not persisted) =====
    var hist = document.getElementById('hist');
    var hBox = hist && hist.querySelector('.hist-search');
    if (hBox) {
      var HIST_MAX = 7;
      var hHead = hist.querySelector('.hist-head'), hIn = hBox.querySelector('input'), hBtn = hist.querySelector('.hist-search-btn');
      var hBack = hist.querySelector('.hist-back'), hAll = hist.querySelector('.hist-all'), hEmpty = hist.querySelector('.hist-empty');
      var hClear = hist.querySelector('[data-hist-clear]');
      // FE useConfirm: title, body, Hủy + red Xóa (no comment field)
      var hConfirm = document.createElement('dialog');
      hConfirm.className = 'q-dialog'; hConfirm.id = 'hist-confirm'; hConfirm.setAttribute('aria-labelledby', 'hist-confirm-t');
      hConfirm.innerHTML = '<form method="dialog"><h2 id="hist-confirm-t" data-i18n="hist.clearAllQ">Xóa toàn bộ lịch sử?</h2><p class="qd-body" data-i18n="hist.clearBody">Toàn bộ lịch sử tìm kiếm và hỏi đáp sẽ bị xóa.</p><div class="qd-foot"><button data-i18n="common.cancel" class="btn btn-secondary" value="cancel">Hủy</button><button data-i18n="hist.delete" class="btn btn-danger" value="ok">Xóa</button></div></form>';
      document.body.appendChild(hConfirm);
      if (I18N) I18N.apply(hConfirm);
      // each entry link gets a row wrapper so the delete button can sit beside it (a button can't live inside <a>)
      var wrapEntry = function (a) {
        var row = document.createElement('div');
        row.className = 'hist-entry';
        if (a.parentNode) a.parentNode.insertBefore(row, a);
        row.appendChild(a);
        var del = document.createElement('button');
        del.type = 'button'; del.className = 'icon-btn is-sm hist-del'; del.setAttribute('data-hist-del', '');
        del.setAttribute('data-i18n-attr', 'aria-label:hist.deleteEntry;title:hist.deleteEntry');
        del.setAttribute('aria-label', 'Xóa khỏi lịch sử'); del.title = 'Xóa khỏi lịch sử';
        del.innerHTML = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
        row.appendChild(del);
        return row;
      };
      var hEntries = [].map.call(hist.querySelectorAll('a.hist-item'), wrapEntry);
      // accent-insensitive match ("han muc" finds "hạn mức"); the entry type matches in both languages
      var fold = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase(); };
      var hay = function (row) {
        var ask = !!row.querySelector('[data-i18n="esr.modeAsk"]');
        return row.__hay || (row.__hay = fold(row.querySelector('.hist-q').textContent + (ask ? ' ask hỏi đáp' : ' search tìm kiếm')));
      };
      var isFull = function () { return hist.classList.contains('is-full'); };
      var histFilter = function () {
        var raw = hIn.value.trim(), words = fold(raw).split(/\s+/).filter(Boolean), matched = 0;
        hEntries.forEach(function (row) {
          var ok = words.every(function (w) { return hay(row).indexOf(w) !== -1; });
          if (ok) matched++;
          row.hidden = !ok || (!isFull() && matched > HIST_MAX);
        });
        hist.querySelectorAll('.tl-day').forEach(function (d) {
          var any = false;
          for (var n = d.nextElementSibling; n && !n.classList.contains('tl-day'); n = n.nextElementSibling) if (n.classList.contains('hist-entry') && !n.hidden) any = true;
          d.hidden = !any;
        });
        hEmpty.hidden = matched > 0;
        hEmpty.textContent = matched ? '' : !hEntries.length ? T('hist.empty', 'Chưa có lịch sử tìm kiếm hoặc hỏi đáp.') : T('hist.noMatch', 'Không có mục nào khớp “{q}”', { q: raw });
        hAll.hidden = isFull() || matched <= HIST_MAX;
        hClear.hidden = !hEntries.length;
        hBtn.disabled = !hEntries.length;
      };
      var setSearch = function (open) {
        hBox.hidden = !open;
        hHead.classList.toggle('is-searching', open);
        hBtn.setAttribute('aria-expanded', String(open));
      };
      // in the drawer the field stays open, so its × only clears the query
      var closeSearch = function () { hIn.value = ''; histFilter(); if (isFull()) { hIn.focus(); return; } setSearch(false); hBtn.focus(); };
      var setFull = function (on) {
        hist.classList.toggle('is-full', on);
        hBack.hidden = !on;
        // the drawer keeps the search field open; back to compact keeps it only while it holds a query
        setSearch(on || !!hIn.value);
        histFilter();
        if (on) hIn.focus(); else (hAll.hidden ? hBtn : hAll).focus();
      };
      var removeEntry = function (row) {
        var i = hEntries.indexOf(row);
        hEntries.splice(i, 1);
        row.remove();
        histFilter();
        // keep focus in the list: the next visible entry's delete button, else the previous one, else the search icon
        var next = hEntries.slice(i).concat(hEntries.slice(0, i).reverse()).filter(function (r) { return !r.hidden; })[0];
        (next ? next.querySelector('.hist-del') : hBtn).focus();
      };
      hBtn.addEventListener('click', function () { setSearch(true); hIn.focus(); });
      hBox.querySelector('[data-hist-search-close]').addEventListener('click', closeSearch);
      hIn.addEventListener('input', histFilter);
      hist.addEventListener('click', function (e) {
        var t = e.target.closest('[data-hist-full], [data-hist-del], [data-hist-clear]');
        if (!t) return;
        if (t.hasAttribute('data-hist-full')) setFull(t.getAttribute('data-hist-full') === 'on');
        else if (t.hasAttribute('data-hist-del')) removeEntry(t.closest('.hist-entry'));
        else { hConfirm.returnValue = ''; hConfirm.showModal(); }
      });
      hConfirm.addEventListener('close', function () {
        if (hConfirm.returnValue !== 'ok') { hClear.focus(); return; }
        hEntries.forEach(function (row) { row.remove(); });
        hEntries = []; hIn.value = '';
        if (isFull()) setFull(false); else { setSearch(false); histFilter(); }
        hEmpty.focus();
      });
      hist.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (isFull()) setFull(false);
        else if (!hBox.hidden && hBox.contains(e.target)) closeSearch();
        else return;
        e.preventDefault(); // a search field would otherwise clear itself on Esc
        e.stopPropagation();
      });
      onLang(histFilter);
      histFilter();
    }

    // ===== Enterprise Search · filter popover (es-filter) =====
    // Mở/đóng popover bộ lọc gắn vào nút phễu trên thanh tìm kiếm; bật/tắt chip Tag; "Xóa lọc".
    document.querySelectorAll('.es-filter').forEach(function (wrap) {
      var btn = wrap.querySelector('.icon-btn[aria-controls]');
      var pop = wrap.querySelector('.es-filter-pop');
      if (!btn || !pop) return;
      function focusables() { return pop.querySelectorAll('button, a[href], input, select, textarea'); }
      function open() {
        pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
        var f = focusables(); if (f.length) f[0].focus();
      }
      function close(refocus) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); }
      // start from the markup's state (results page ships open, home ships closed)
      if (!pop.hidden) btn.setAttribute('aria-expanded', 'true');
      btn.addEventListener('click', function () { if (pop.hidden) open(); else close(true); });
      // close button inside the popover
      var closeBtn = pop.querySelector('.es-filter-head .icon-btn');
      if (closeBtn) closeBtn.addEventListener('click', function () { close(true); });
      // Tag chips toggle (mock)
      pop.querySelectorAll('.es-filter-tags .chip-filter').forEach(function (chip) {
        chip.addEventListener('click', function () {
          chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
        });
      });
      // "Xóa lọc": bỏ chọn tất cả KB + tắt mọi tag
      var clear = pop.querySelector('.es-filter-foot .btn-secondary');
      if (clear) clear.addEventListener('click', function () {
        pop.querySelectorAll('.es-filter-opt input[type="checkbox"]').forEach(function (c) { c.checked = false; });
        pop.querySelectorAll('.es-filter-tags .chip-filter').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        var yr = pop.querySelector('[data-es-filter-year]'); if (yr) yr.value = '';
      });
      // "Áp dụng": mock - đóng popover
      var apply = pop.querySelector('.es-filter-foot .btn-primary');
      if (apply) apply.addEventListener('click', function () { close(true); });
      // Year: Enter applies the draft (the popover sits inside the search form, so it must not submit it)
      var year = pop.querySelector('[data-es-filter-year]');
      if (year) year.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); close(true); } });
      // Esc đóng, focus trap
      document.addEventListener('keydown', function (e) {
        if (pop.hidden) return;
        if (e.key === 'Escape') { e.preventDefault(); close(true); }
        else if (e.key === 'Tab') {
          var f = focusables(); if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
      // click ra ngoài -> đóng
      document.addEventListener('mousedown', function (e) { if (!pop.hidden && !wrap.contains(e.target)) close(false); });
    });

    // ===== Enterprise Search · Ask (ecp-ask-mode-mockups) =====
    var evg = document.getElementById('evg');
    var eslAny = document.querySelector('.es-layout');
    function setGraph(on) {
      if (!evg || !eslAny) return;
      eslAny.classList.toggle('with-graph', on);
      document.querySelectorAll('[data-graph-toggle]:not([data-graph-toggle="off"])').forEach(function (b) { b.setAttribute('aria-pressed', String(on)); });
      evg.hidden = !on;
    }
    if (evg && eslAny) {
      var gp = params.get('graph');
      if (gp !== 'on' && gp !== 'off') gp = ES_NARROW.matches ? 'off' : eslAny.getAttribute('data-graph-default') || (eslAny.classList.contains('with-graph') ? 'on' : 'off');
      setGraph(gp === 'on');
    }
    // Trace + Evidence Graph are admin detail: inline buttons in the meta row; the FE hides each one once its
    // admin-only endpoint answers 403, so here they (and the graph panel) show for the Admin role only. Re-runs on role switch.
    var ES_DET_SEL = '[data-graph-toggle]:not([data-graph-toggle="off"]), [data-drawer-open="trace-drawer"], [data-es-trace], [data-es-graph]';
    function esDetails() {
      var admin = root.getAttribute('data-role') === 'admin';
      document.querySelectorAll(ES_DET_SEL).forEach(function (c) { if (!c.closest('#evg, .es-drawer')) c.hidden = !admin; });
      if (evg && !admin) setGraph(false);
    }
    if (document.querySelector('.es-layout')) {
      esDetails();
      document.addEventListener('ecp-rolechange', esDetails);
      // a [n] marker in the answer opens the collapsed sources box before jumping to its row
      document.addEventListener('click', function (e) {
        var a = e.target.closest('a.cite[href^="#cite-"]'), li = a && document.getElementById(a.getAttribute('href').slice(1));
        var box = li && li.closest('details.cite-box');
        if (box) box.open = true;
      });
    }
    // ===== Enterprise Search · design fixes (es-nd) =====
    // Esc closes the History / Evidence Graph overlay drawers (<1200px)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !ES_NARROW.matches || drawerCur) return;
      if (evg && !evg.hidden && eslAny.classList.contains('with-graph')) { setGraph(false); var gb = document.querySelector('[data-graph-toggle]:not([data-graph-toggle="off"])'); if (gb) gb.focus(); }
      else if (esl && !esl.classList.contains('history-collapsed')) { setHist(true, false); var hb = document.querySelector('.hist-open'); if (hb) hb.focus(); }
    });
    // relevance / citation scores: raw value in data-es-score, formatted for the current language (0,94 vs 0.94)
    function esFmt() {
      var f = function (v) { return I18N && I18N.fmtNum ? I18N.fmtNum(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v); };
      document.querySelectorAll('[data-es-score]').forEach(function (el) {
        var v = parseFloat(el.getAttribute('data-es-score'));
        if (el.hasAttribute('data-es-score-tip')) el.title = T('esr.relevanceN', 'Độ liên quan {n}', { n: f(v) });
        if (!el.hasAttribute('data-es-score-tip') || el.classList.contains('cite-score')) el.textContent = f(v);
      });
      document.querySelectorAll('time[data-es-date]').forEach(function (el) { if (I18N && I18N.fmtDate) el.textContent = I18N.fmtDate(el.getAttribute('datetime')); });
    }
    esFmt(); onLang(esFmt);
    // Search results: ?state=loading|empty|noretrieval|forbidden replaces the result groups (FE enterprise-search-results)
    (function () {
      var st = new URLSearchParams(location.search).get('state'), blocks = document.querySelectorAll('[data-es-state]');
      if (!blocks.length || !st) return;
      [].forEach.call(blocks, function (b) { b.hidden = b.getAttribute('data-es-state') !== st; });
      if (st !== 'loading') [].forEach.call(document.querySelectorAll('.es-scroll > .doc-group, .es-scroll > .page-actions'), function (g) { g.hidden = true; });
      else [].forEach.call(document.querySelectorAll('.es-scroll > .doc-group'), function (g) { g.hidden = true; });
    })();
    document.addEventListener('click', function (e) {
      // result group: chevron shows / hides its matching passages
      var dt = e.target.closest('[data-doc-toggle]');
      if (dt) {
        var on = dt.getAttribute('aria-expanded') !== 'true', lbl = on ? T('esr.hidePassages', 'Ẩn các đoạn khớp') : T('esr.showPassages', 'Xem các đoạn khớp');
        dt.setAttribute('aria-expanded', String(on)); dt.setAttribute('aria-label', lbl); dt.title = lbl;
        [].forEach.call(dt.closest('.doc-group').querySelectorAll('.chunk'), function (c) { c.hidden = !on; });
        return;
      }
      // Search / Ask mode switch changes the view
      var mb = e.target.closest('.mode-toggle [data-mode-href]');
      if (mb && mb.getAttribute('aria-pressed') !== 'true') { location.href = mb.getAttribute('data-mode-href'); return; }
      // removable filter chips + "Xóa tất cả"
      var rm = e.target.closest('[data-chip-rm], [data-chip-clear]');
      if (rm) {
        var row = rm.parentNode, chips = rm.hasAttribute('data-chip-clear') ? row.querySelectorAll('[data-chip-rm]') : [rm];
        [].forEach.call(chips, function (c) { c.remove(); });
        var left = row.querySelectorAll('[data-chip-rm]').length, clr = row.querySelector('[data-chip-clear]');
        if (!left && clr) clr.remove();
        var badge = document.querySelector('.es-filter .badge-dot'); if (badge) { badge.textContent = left; badge.hidden = !left; }
        var next = row.querySelector('[data-chip-rm], [data-chip-clear], button'); if (next) next.focus();
        return;
      }
      var cp = e.target.closest('[data-es-copy]');
      if (cp) { var ans = (cp.closest('article') || document).querySelector('.answer'); if (ans) esClip(ans.innerText, T('pol.copied', 'Đã sao chép câu trả lời')); }
    });
    // submit arrows (search bar, follow-up box) are disabled while their field is empty (FE SearchBar / follow-up form)
    document.addEventListener('input', function (e) {
      var f = e.target.closest('.es-bar, .ask-follow'), b = f && e.target.matches('.es-input, .ask-follow .input') && f.querySelector('.es-submit');
      if (b) b.disabled = !e.target.value.trim();
    });
    // ===== Enterprise Search · Ask: actions under the answer (mock: nothing is sent) =====
    // Like / dislike are one rating (a second click clears it). Like rates at once; dislike opens the optional
    // feedback form and the rating is set only when that form is sent (FE AnswerActions).
    // Report opens its own form and needs a reason. Share copies the page link.
    function esClip(text, okMsg) {
      var fail = function () { window.ECP_toast(T('esa.copyFailed', 'Không sao chép được, hãy thử lại.')); };
      if (!navigator.clipboard) { fail(); return; }
      navigator.clipboard.writeText(text).then(function () { window.ECP_toast(okMsg); }, fail);
    }
    function esForm(f, opener, open) {
      if (!f) return;
      f.hidden = !open;
      if (opener) opener.setAttribute('aria-expanded', String(open));
      if (open) f.querySelector('button').focus();
      else {
        f.querySelectorAll('[aria-pressed="true"]').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        f.querySelector('textarea').value = '';
        var er = f.querySelector('.field-err'); if (er) er.hidden = true;
      }
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ask-rate], [data-ask-share], [data-ask-report], [data-form-cancel]'), art = b && b.closest('article');
      if (!art) return;
      var fb = art.querySelector('[id^="fb-form"]'), rp = art.querySelector('[id^="rp-form"]');
      var down = art.querySelector('[data-ask-rate="down"]'), rep = art.querySelector('[data-ask-report]');
      if (b.hasAttribute('data-ask-rate')) {
        var was = b.getAttribute('aria-pressed') === 'true';
        if (b !== down && !was) {
          esForm(fb, down, false); esForm(rp, rep, false);
          art.querySelectorAll('[data-ask-rate]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          window.ECP_toast(T('esa.thanksRating', 'Cảm ơn bạn đã đánh giá câu trả lời.'));
        } else if (was) { // pressing the active rating again clears it
          esForm(fb, down, false); esForm(rp, rep, false);
          b.setAttribute('aria-pressed', 'false');
          window.ECP_toast(T('esa.ratingCleared', 'Đã bỏ đánh giá.'));
        } else {
          var fOpen = fb.hidden;
          esForm(fb, down, fOpen);
          if (fOpen) esForm(rp, rep, false);
        }
      } else if (b.hasAttribute('data-ask-share')) {
        esClip(location.href, T('esa.linkCopied', 'Đã sao chép liên kết tới câu trả lời'));
      } else if (b.hasAttribute('data-ask-report')) {
        if (rep.classList.contains('is-done')) { window.ECP_toast(T('esa.alreadyReported', 'Bạn đã báo vấn đề cho câu trả lời này.')); return; }
        var open = rp.hidden;
        esForm(rp, rep, open);
        if (open) esForm(fb, down, false);
      } else {
        var f = b.closest('.fb-form'), opener = f === fb ? down : rep;
        esForm(f, opener, false);
        opener.focus();
      }
    });
    document.addEventListener('submit', function (e) {
      var f = e.target, art = f.closest('article');
      if (!art || !/^(fb|rp)-form/.test(f.id)) return;
      if (f.id.indexOf('fb-form') === 0) {
        var down = art.querySelector('[data-ask-rate="down"]');
        art.querySelectorAll('[data-ask-rate]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === down)); });
        esForm(f, down, false); down.focus();
        window.ECP_toast(T('esa.feedbackSent', 'Đã gửi phản hồi. Cảm ơn bạn!'));
        return;
      }
      if (!f.querySelector('[aria-pressed="true"]')) { f.querySelector('.field-err').hidden = false; f.querySelector('.fb-reasons button').focus(); return; }
      var rep = art.querySelector('[data-ask-report]');
      esForm(f, rep, false);
      rep.classList.add('is-done');
      rep.setAttribute('data-i18n-attr', 'aria-label:esa.reported;title:esa.reported');
      rep.title = T('esa.reported', 'Đã báo vấn đề'); rep.setAttribute('aria-label', rep.title);
      rep.focus();
      window.ECP_toast(T('esa.reportSent', 'Đã gửi báo cáo. Steward sẽ xem xét câu trả lời này.'));
    });
    var stSecs = document.querySelectorAll('[data-state-key]');
    if (stSecs.length) {
      var stWant = params.get('state'), stHit = null;
      stSecs.forEach(function (s) { if (s.getAttribute('data-state-key') === stWant) stHit = s; });
      if (!stHit) {
        var stBox = document.querySelector('[data-state-default]'), stDef = stBox && stBox.getAttribute('data-state-default');
        stSecs.forEach(function (s) { if (s.getAttribute('data-state-key') === stDef) stHit = s; });
        if (!stHit) stHit = stSecs[0];
      }
      stSecs.forEach(function (s) { s.hidden = s !== stHit; });
      var stQ = document.getElementById('esq');
      if (stQ && stHit.hasAttribute('data-state-q')) stQ.value = stHit.getAttribute('data-state-q');
    }
    document.querySelectorAll('svg[data-prop-target]').forEach(function (svg) {
      var out = document.getElementById(svg.getAttribute('data-prop-target'));
      function pickProp(g) {
        svg.querySelectorAll('[data-prop]').forEach(function (x) {
          var on = x === g, c = x.querySelector('circle');
          x.classList.toggle('is-sel', on);
          if (x.hasAttribute('aria-pressed')) x.setAttribute('aria-pressed', String(on));
          if (c && x.classList.contains('ev-node')) c.classList.toggle('n-sel', on);
        });
        var tpl = document.getElementById(g.getAttribute('data-prop'));
        if (out && tpl) out.innerHTML = tpl.innerHTML;
      }
      svg.querySelectorAll('[data-prop]').forEach(function (g) {
        g.addEventListener('click', function () { pickProp(g); });
        g.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickProp(g); }
        });
      });
    });
    var drawerOpener = null, drawerCur = null;
    function drawerFocusables(d) {
      return [].filter.call(d.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (x) { return x.getClientRects().length; });
    }
    function closeDrawer() {
      if (!drawerCur) return;
      drawerCur.hidden = true;
      var sc = document.getElementById(drawerCur.id + '-scrim'); if (sc) sc.hidden = true;
      ['.app-header', '.sidebar', '.app-main'].forEach(function (s) { var el = document.querySelector(s); if (el) el.removeAttribute('inert'); });
      drawerCur = null;
      if (drawerOpener) { drawerOpener.focus(); drawerOpener = null; }
    }
    function openDrawer(id, opener) {
      var d = document.getElementById(id); if (!d) return;
      drawerOpener = opener || document.activeElement;
      drawerCur = d;
      d.hidden = false;
      var sc = document.getElementById(id + '-scrim');
      if (sc) { sc.hidden = false; sc.onclick = closeDrawer; }
      ['.app-header', '.sidebar', '.app-main'].forEach(function (s) { var el = document.querySelector(s); if (el) el.setAttribute('inert', ''); });
      var cb = d.querySelector('[data-drawer-close]'); if (cb) cb.focus();
    }
    document.addEventListener('keydown', function (e) {
      if (!drawerCur) return;
      if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; }
      if (e.key === 'Tab') {
        var f = drawerFocusables(drawerCur); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    if (params.get('trace') === 'open' && document.getElementById('trace-drawer')) openDrawer('trace-drawer', document.querySelector('[data-drawer-open="trace-drawer"]'));

    // ===== Quality & Improvement: generic, data-attribute driven (null-safe) =====
    var Q = { item: null, assignee: '' };
    // ---- Quality pages (body.q-mod) · designs.md: active-filter tokens, contextual bulk bar + lock reasons,
    //      confidence meter (0.6 threshold), folded unchanged paragraphs, change navigator ----
    var QMOD = !!(document.body && document.body.classList.contains('q-mod'));
    var LOCK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
    function qfDimName(g) {
      if (g.hasAttribute('data-qf-name')) return g.getAttribute('data-qf-name');
      var gl = g.querySelector('.q-gl'); if (gl) return gl.textContent.replace(/[:：]\s*$/, '').trim();
      var fb = g.parentNode && g.parentNode.querySelector('.q-fbtn > span'); if (fb) return fb.textContent.trim();
      var th = g.closest('th'), ts = th && th.querySelector('.q-col-head > span:first-child, .q-th-wrap > span:first-child'); return ts ? ts.textContent.trim() : '';
    }
    function qfTokens(wrap) {
      var host = wrap.querySelector('.art-chips') || wrap.querySelector('.q-bulk'); if (!host) return;
      var items = [];
      wrap.querySelectorAll('[data-qf-dim]:not([data-qf-keep])').forEach(function (g) {
        if (g.tagName === 'SELECT') { if (g.value) items.push({ g: g, v: g.value, n: '', t: g.options[g.selectedIndex].textContent.trim() }); return; }
        var nm = qfDimName(g);
        g.querySelectorAll('[aria-pressed="true"][data-qf-val]').forEach(function (b) { var v = b.getAttribute('data-qf-val'); if (v !== 'all') items.push({ g: g, v: v, n: nm, t: b.textContent.trim() }); });
      });
      wrap.querySelectorAll('input[data-qf-search]').forEach(function (i) { if (i.value.trim()) items.push({ g: i, v: '', n: '', t: '“' + i.value.trim() + '”' }); });
      var box = host.nextElementSibling && host.nextElementSibling.classList.contains('qf-tokens') ? host.nextElementSibling : null;
      if (!box) { box = document.createElement('div'); box.className = 'qf-tokens'; box.setAttribute('role', 'group'); host.parentNode.insertBefore(box, host.nextSibling); box.__items = []; }
      var key = items.map(function (x) { return x.n + ':' + x.t; }).join('|') + '#' + ECP_LANG();
      box.hidden = !items.length; box.setAttribute('aria-label', T('qnd.activeFilters', 'Bộ lọc đang áp dụng'));
      if (box.__key === key) { box.__items = items; return; }
      box.__key = key; box.__items = items; box.textContent = '';
      var lb = document.createElement('span'); lb.className = 'qf-tokens-l'; lb.textContent = T('qnd.filteredBy', 'Đang lọc:'); box.appendChild(lb);
      items.forEach(function (x, i) {
        var b = document.createElement('button'), lab = (x.n ? x.n + ': ' : '') + x.t, s = document.createElement('span');
        b.type = 'button'; b.className = 'qf-tok'; b.setAttribute('data-qf-tok', i); s.textContent = lab; b.appendChild(s);
        b.setAttribute('aria-label', T('qnd.removeFilter', 'Bỏ lọc {f}', { f: lab })); b.title = lab;
        box.appendChild(b);
      });
      var clr = document.createElement('button'); clr.type = 'button'; clr.className = 'btn btn-sm btn-ghost'; clr.setAttribute('data-qf-reset', ''); clr.textContent = T('common.clearFilter', 'Xóa lọc'); box.appendChild(clr);
    }
    function ECP_LANG() { return (I18N && I18N.lang) || 'vi'; }
    document.addEventListener('click', function (e) {
      var tk = e.target.closest('[data-qf-tok]'); if (!tk) return;
      var box = tk.closest('.qf-tokens'), x = box && box.__items[+tk.getAttribute('data-qf-tok')], w = tk.closest('[data-qf]'); if (!x || !w) return;
      var g = x.g;
      if (g.tagName === 'SELECT' || g.tagName === 'INPUT') g.value = '';
      else {
        g.querySelectorAll('[data-qf-val="' + x.v + '"]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        var any = [].some.call(g.querySelectorAll('[aria-pressed="true"][data-qf-val]'), function (b) { return b.getAttribute('data-qf-val') !== 'all'; });
        var all = g.querySelector('[data-qf-val="all"]'); if (all && !any) all.setAttribute('aria-pressed', 'true');
      }
      qfRun(w); qColActiveSync();
      var nb = box.querySelector('.qf-tok') || box.querySelector('[data-qf-reset]'); if (nb && !box.hidden) nb.focus(); else { var fb = w.querySelector('.art-chips button, .art-chips select'); if (fb) fb.focus(); }
    });
    function qBulkCtx(scope, n) {
      scope.classList.toggle('has-sel', n > 0);
      scope.querySelectorAll('.q-bulk-ctx').forEach(function (b) { b.classList.toggle('has-sel', n > 0); });
      scope.querySelectorAll('input.q-check').forEach(function (c) {
        // label sits beside the item ID (the checkbox column has no room for text); icon-only fallback elsewhere
        var tr = c.closest('tr'), idb = tr && tr.querySelector('[data-qrow-open]'), host = idb ? idb.parentNode : c.parentNode;
        var nx = host.querySelector('.q-lock'), has = !!nx;
        if (c.disabled && !has) {
          var why = c.title || T('qnd.cantSelect', 'Không chọn được mục này'), lk = document.createElement('span');
          lk.className = 'q-lock' + (idb ? ' has-label' : ''); lk.title = why;
          lk.innerHTML = LOCK_SVG + (idb ? '<span class="q-lock-t" aria-hidden="true"></span>' : '') + '<span class="sr-only"></span>';
          if (idb) lk.querySelector('.q-lock-t').textContent = T('pol.lockShort', 'Duyệt riêng');
          lk.lastChild.textContent = why;
          if (idb) host.appendChild(lk); else c.parentNode.insertBefore(lk, c.nextSibling);
        } else if (has && !c.disabled) nx.parentNode.removeChild(nx);
        else if (has && c.title && nx.title !== c.title) { nx.title = c.title; nx.lastChild.textContent = c.title; }
      });
    }
    var CONF_SRC = { ocr: 'OCR', tag: 'AI extractor', graph: 'AI extractor', triple: 'AI extractor', dup: 'AI extractor', qa: 'LLM judge' };
    function confMeter(box, v, src) {
      var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(',', '.'));
      if (isNaN(n)) { box.className = ''; box.textContent = v || '—'; return; }
      var lv = n >= 0.8 ? ['high', T('qnd.confHigh', 'Cao'), 'chip-success'] : n >= 0.6 ? ['mid', T('qnd.confMid', 'TB'), 'chip-warning'] : ['low', T('qnd.confLow', 'Thấp'), 'chip-error'];
      var num = I18N && I18N.fmtNum ? I18N.fmtNum(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(n), thr = I18N && I18N.fmtNum ? I18N.fmtNum(0.6, { minimumFractionDigits: 1 }) : '0,6';
      box.className = 'q-confm';
      box.innerHTML = '<span class="q-confm-v"></span><span class="chip ' + lv[2] + '"></span><span class="q-confm-src"></span><span class="q-confm-bar is-' + lv[0] + '" role="meter" aria-valuemin="0" aria-valuemax="1"><span></span><i class="q-confm-th"></i></span>';
      box.children[0].textContent = num; box.children[1].textContent = lv[1];
      box.children[2].textContent = src ? T('qnd.confSrc', 'Nguồn: {s}', { s: src }) : '';
      var bar = box.children[3], th = T('qnd.confThr', 'Ngưỡng duyệt hàng loạt {t}', { t: thr });
      bar.setAttribute('aria-valuenow', String(n)); bar.setAttribute('aria-label', 'Confidence ' + num + ' (' + lv[1] + ') · ' + th);
      bar.firstChild.style.width = Math.max(0, Math.min(100, Math.round(n * 100))) + '%'; bar.lastChild.title = th;
    }
    function confFromRow(panel, r) {
      panel.querySelectorAll('[data-conf-meter]').forEach(function (b) {
        confMeter(b, r.getAttribute('data-f-conf'), CONF_SRC[r.getAttribute('data-type')] || (r.getAttribute('data-f-conf') ? 'LLM judge' : ''));
      });
    }
    document.addEventListener('ecp-qopen', function (e) { if (e.detail && e.detail.row) confFromRow(e.target, e.detail.row); });
    // Knowledge Gaps detail (FE cluster-detail.tsx): a closed cluster locks Assign + Request, an existing fill request locks Request
    document.addEventListener('ecp-qopen', function (e) {
      var bs = e.target.querySelectorAll('[data-gap-off]'); if (!bs.length || !e.detail || !e.detail.row) return;
      // Feedback detail (FE feedback-detail.tsx) reuses it: a closed item (row data-st) locks Gán + Link release
      var st = e.detail.row.getAttribute('data-gap-state') || e.detail.row.getAttribute('data-st');
      bs.forEach(function (b) { if (st && inList(b.getAttribute('data-gap-off'), st)) b.setAttribute('data-locked', ''); else b.removeAttribute('data-locked'); });
      applyRoleGates();
      // applyRoleGates skips buttons that no longer carry a gate attribute: unlock those here
      bs.forEach(function (b) { setGateDisabled(b, gateReason(b)); });
    });
    function confInit() {
      // static counts carry the raw value in data-n; render it in the current locale (48.620 vi / 48,620 en)
      if (QMOD && I18N && I18N.fmtNum) document.querySelectorAll('[data-n]').forEach(function (e) { var v = parseFloat(e.getAttribute('data-n')); if (!isNaN(v)) e.textContent = I18N.fmtNum(v); });
      document.querySelectorAll('[data-conf-meter][data-conf]').forEach(function (b) { confMeter(b, b.getAttribute('data-conf'), b.getAttribute('data-conf-src')); });
      document.querySelectorAll('[data-qpanel]').forEach(function (bx) { var r = bx.querySelector('[data-qrow].selected'), p = document.getElementById(bx.getAttribute('data-qpanel')); if (r && p) confFromRow(p, r); });
    }
    onLang(confInit); confInit();
    // diff: fold runs of unchanged paragraphs ("… N đoạn không đổi"); [data-fold-toggle] re-collapses
    function foldSync(d) { document.querySelectorAll('[data-fold-toggle]').forEach(function (t) { t.setAttribute('aria-pressed', String(d.classList.contains('is-folded'))); }); }
    document.querySelectorAll('[data-diff][data-fold]').forEach(function (d) {
      d.querySelectorAll('.q-dcol').forEach(function (col) {
        var run = [];
        function flush(before) {
          if (!run.length) return;
          var b = document.createElement('button'); b.type = 'button'; b.className = 'q-fold';
          b.textContent = T('qnd.foldN', '… {n} đoạn không đổi', { n: run.length });
          col.insertBefore(b, run[0]); run = [];
        }
        [].slice.call(col.children).forEach(function (l) {
          if (l.classList.contains('q-line') && !/\bis-(del|ins|chg|gap|dep)\b/.test(l.className)) { l.classList.add('is-same'); run.push(l); } else flush();
        });
        flush();
      });
      d.classList.add('is-folded');
      d.addEventListener('click', function (e) { if (e.target.closest('.q-fold')) { d.classList.remove('is-folded'); foldSync(d); } });
      foldSync(d);
    });
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-fold-toggle]'); if (!t) return;
      document.querySelectorAll('[data-diff][data-fold]').forEach(function (d) { d.classList.toggle('is-folded', t.getAttribute('aria-pressed') !== 'true'); foldSync(d); });
    });
    // change navigator: "Thay đổi 1/N ↑↓" over the visible changed lines (+ [data-chg-anchor] sections)
    document.querySelectorAll('[data-chgnav]').forEach(function (nav) {
      var scope = document.getElementById(nav.getAttribute('data-chgnav')) || document, cur = -1, pos = nav.querySelector('[data-chgnav-pos]');
      function list() {
        return [].filter.call(scope.querySelectorAll('.q-dcol:not(.q-dcol-old) .q-line:is(.is-chg, .is-ins, .is-del, .is-gap), [data-chg-anchor]'), function (x) { return x.offsetParent !== null; });
      }
      function show() { var l = list(); pos.textContent = (cur < 0 ? '–' : Math.min(cur, l.length - 1) + 1) + '/' + l.length; }
      function go(step) {
        var l = list(); if (!l.length) return;
        cur = cur < 0 ? (step > 0 ? 0 : l.length - 1) : (cur + step + l.length) % l.length;
        scope.querySelectorAll('.q-chg-cur').forEach(function (x) { x.classList.remove('q-chg-cur'); });
        var t = l[cur]; t.classList.add('q-chg-cur'); if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
        t.scrollIntoView({ block: 'center', behavior: scrollBehavior() }); show();
      }
      nav.addEventListener('click', function (e) { var b = e.target.closest('[data-chgnav-step]'); if (b) go(+b.getAttribute('data-chgnav-step')); });
      document.addEventListener('click', function (e) { if (e.target.closest('[data-diff-mode] [data-mode]')) setTimeout(function () { cur = -1; show(); }, 0); });
      show();
    });
    function qFill(s, btn) {
      var scope = btn && btn.closest('[data-bulk-scope]'), n = 0;
      if (scope) n = scope.querySelectorAll('input.q-check:checked').length;
      return String(s || '').replace(/\{n\}/g, n).replace(/\{id\}/g, Q.item || '').replace(/\{a\}/g, Q.assignee || '');
    }
    // block clicks on disabled links
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[aria-disabled="true"]');
      if (a) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    // multi-dimension filters (+ optional free-text search input[data-qf-search])
    function qNorm(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
    function dimMatch(rowVal, v) {
      if (Array.isArray(v)) return !v.length || v.some(function (x) { return inList(rowVal, x); });
      return !v || v === 'all' || inList(rowVal, v);
    }
    function qfRun(wrap) {
      var dims = {}, sIn = wrap.querySelector('input[data-qf-search]') || (wrap.getAttribute('data-qf-ext') && document.getElementById(wrap.getAttribute('data-qf-ext'))), qs = sIn ? qNorm(sIn.value.trim()) : '';
      wrap.querySelectorAll('[data-qf-dim]').forEach(function (g) {
        var v;
        if (g.tagName === 'SELECT') v = g.value;
        else if (g.hasAttribute('data-qf-multi')) { v = [].map.call(g.querySelectorAll('[aria-pressed="true"][data-qf-val]'), function (b) { return b.getAttribute('data-qf-val'); }).filter(function (x) { return x !== 'all'; }); if (!v.length) v = 'all'; }
        else { var on = g.querySelector('[aria-pressed="true"][data-qf-val]'); v = on ? on.getAttribute('data-qf-val') : 'all'; }
        dims[g.getAttribute('data-qf-dim')] = v;
      });
      var total = 0;
      (wrap.getAttribute('data-qf') || '').split(/\s+/).forEach(function (id) {
        var tg = id && document.getElementById(id); if (!tg) return;
        var shown = 0;
        tg.querySelectorAll('[data-qrow]').forEach(function (it) {
          var ok = Object.keys(dims).every(function (d) { return dimMatch(it.getAttribute('data-' + d), dims[d]); });
          if (ok && qs) ok = qNorm(it.textContent + ' ' + (it.getAttribute('data-search') || '')).indexOf(qs) > -1;
          if (ok) it.removeAttribute('data-qf-out'); else it.setAttribute('data-qf-out', '');
          var vis = ok && gateVisible(it);
          it.hidden = !vis;
          if (vis) shown++;
          else { var c = it.querySelector('input.q-check:checked'); if (c) c.checked = false; }
        });
        tg.querySelectorAll('.filter-empty').forEach(function (em) { em.hidden = shown > 0; });
        total += shown;
        // keep the detail panel on a visible row
        var pbox = tg.hasAttribute('data-qpanel') ? tg : tg.querySelector('[data-qpanel]'), sel = pbox && pbox.querySelector('[data-qrow].selected');
        if (sel && sel.hidden) { var fv = [].filter.call(pbox.querySelectorAll('[data-qrow]'), function (x) { return !x.hidden; })[0]; if (fv) qOpen(pbox, fv); }
      });
      wrap.querySelectorAll('[data-qf-count]').forEach(function (c) { c.textContent = total; });
      if (QMOD) qfTokens(wrap);
      document.querySelectorAll('[data-bulk-scope]').forEach(bulkSync);
    }
    function qfAll() { document.querySelectorAll('[data-qf]').forEach(qfRun); }
    document.addEventListener('click', function (e) {
      var w = e.target.closest('[data-qf]');
      if (!w) return;
      if (e.target.closest('[data-qf-dim] [data-qf-val]')) setTimeout(function () { qfRun(w); }, 0);
      var rs = e.target.closest('[data-qf-reset]');
      if (rs) {
        w.querySelectorAll('[data-qf-dim]:not([data-qf-keep])').forEach(function (g) {
          if (g.tagName === 'SELECT') g.value = '';
          else g.querySelectorAll('[data-qf-val]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-qf-val') === 'all')); });
        });
        w.querySelectorAll('input[data-qf-search]').forEach(function (i) { i.value = ''; });
        qfRun(w);
      }
    });
    document.addEventListener('change', function (e) {
      if (e.target.matches && e.target.matches('select[data-qf-dim]')) { var w = e.target.closest('[data-qf]'); if (w) qfRun(w); }
    });
    document.addEventListener('input', function (e) {
      if (e.target.matches && e.target.matches('input[data-qf-search]')) { var w = e.target.closest('[data-qf]'); if (w) qfRun(w); }
    });
    document.addEventListener('ecp-rolechange', qfAll);
    // Excel-style per-column header filter popovers (quality queue)
    function qColClose(pop) {
      if (!pop) return;
      pop.hidden = true;
      var btn = pop.parentNode && pop.parentNode.querySelector('.q-col-filter');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    function qColCloseAll(except) {
      document.querySelectorAll('.q-col-pop:not([hidden])').forEach(function (p) { if (p !== except) qColClose(p); });
    }
    function qColPosition(btn, pop) {
      // position:fixed, anchored under the button; left-align, flip to right edge if it would overflow
      pop.hidden = false;
      var r = btn.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      var pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 4;
      var left = r.left;
      if (left + pw > vw - 8) left = Math.max(8, r.right - pw);
      if (left < 8) left = 8;
      var top = r.bottom + gap;
      if (top + ph > vh - 8) { var alt = r.top - gap - ph; if (alt >= 8) top = alt; else top = Math.max(8, vh - 8 - ph); }
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    }
    function qColActiveSync() {
      document.querySelectorAll('.q-col-pop[role="group"][data-qf-dim]').forEach(function (g) {
        var active = !![].filter.call(g.querySelectorAll('[aria-pressed="true"][data-qf-val]'), function (b) { return b.getAttribute('data-qf-val') !== 'all'; }).length;
        var btn = g.parentNode && g.parentNode.querySelector('.q-col-filter');
        if (btn) btn.classList.toggle('is-active', active);
      });
    }
    // Build the Excel-style header-filter popover options for one question table.
    // Options are derived from the DISTINCT values actually present in that table's rows,
    // mapped to the Vietnamese labels the old selects used (mock values -> data-i18n-skip).
    var QCOL_MAPS = {
      st: { order: ['ok', 'pending', 'delpend'], label: { ok: 'Đã duyệt', pending: 'Chờ duyệt', delpend: 'Chờ xóa' } },
      lvl: { order: ['de', 'tb', 'kho'], label: { de: 'Dễ', tb: 'Trung bình', kho: 'Khó' } },
      cat: { order: ['fact', 'proc', 'cond', 'cmp', 'multi'], label: { fact: 'Tra cứu sự kiện', proc: 'Quy trình', cond: 'Điều kiện & ngoại lệ', cmp: 'So sánh', multi: 'Tổng hợp nhiều nguồn' } }
    };
    function qColBuild(tb) {
      if (!tb) return;
      // Only the active (visible) dataset table's popovers participate in qfRun: the shared
      // engine collects every [data-qf-dim] inside the detail wrap, and the six hidden sibling
      // tables would otherwise clobber the visible selection (same dim keys). Stash their
      // data-qf-dim into data-qf-dim-off so they are ignored until that table becomes active.
      var det = tb.closest('[data-qf]');
      if (det) {
        det.querySelectorAll('[data-ds-table] .q-col-pop[data-qf-dim], [data-ds-table] .q-col-pop[data-qf-dim-off]').forEach(function (pop) {
          var inTb = tb.contains(pop);
          if (inTb) {
            if (pop.hasAttribute('data-qf-dim-off')) { pop.setAttribute('data-qf-dim', pop.getAttribute('data-qf-dim-off')); pop.removeAttribute('data-qf-dim-off'); }
          } else if (pop.hasAttribute('data-qf-dim')) {
            pop.setAttribute('data-qf-dim-off', pop.getAttribute('data-qf-dim')); pop.removeAttribute('data-qf-dim');
          }
        });
      }
      var rows = tb.querySelectorAll('[data-qrow]');
      [].forEach.call(tb.querySelectorAll('thead .q-col-filter'), function (btn) {
        var dim = btn.getAttribute('data-col'), map = QCOL_MAPS[dim];
        var pop = btn.parentNode && btn.parentNode.querySelector('.q-col-pop');
        if (!map || !pop) return;
        var present = {};
        [].forEach.call(rows, function (r) {
          String(r.getAttribute('data-' + dim) || '').split(/\s+/).forEach(function (tok) { if (tok) present[tok] = 1; });
        });
        var codes = map.order.filter(function (c) { return present[c]; });
        var html = '<button type="button" class="q-pop-opt" data-qf-val="all" aria-pressed="true" data-i18n="q.ver.selectAll">(Chọn tất cả)</button>';
        codes.forEach(function (c) {
          html += '<button type="button" class="q-pop-opt" data-qf-val="' + c + '" aria-pressed="false" data-i18n-skip>' + map.label[c] + '</button>';
        });
        pop.innerHTML = html;
        btn.setAttribute('aria-expanded', 'false');
        pop.hidden = true;
      });
      if (window.ECP_I18N && typeof window.ECP_I18N.apply === 'function') window.ECP_I18N.apply(tb);
      qColActiveSync();
    }
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.q-col-filter');
      if (btn) {
        var pop = btn.parentNode.querySelector('.q-col-pop');
        if (!pop) return;
        var willOpen = pop.hidden;
        qColCloseAll(willOpen ? null : pop);
        if (willOpen) { qColPosition(btn, pop); btn.setAttribute('aria-expanded', 'true'); }
        else qColClose(pop);
        return;
      }
      var opt = e.target.closest('.q-col-pop [data-qf-val]');
      if (opt) {
        var p = opt.closest('.q-col-pop'), grp = opt.closest('[data-qf-multi]');
        if (grp) {
          // multi-select: toggle this option, coordinate the "All" option, keep popover open
          var val = opt.getAttribute('data-qf-val');
          var allBtn = grp.querySelector('[data-qf-val="all"]');
          if (val === 'all') {
            grp.querySelectorAll('[data-qf-val]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === allBtn)); });
          } else {
            opt.setAttribute('aria-pressed', String(opt.getAttribute('aria-pressed') !== 'true'));
            var anyOn = !![].filter.call(grp.querySelectorAll('[aria-pressed="true"][data-qf-val]'), function (b) { return b.getAttribute('data-qf-val') !== 'all'; }).length;
            if (allBtn) allBtn.setAttribute('aria-pressed', String(!anyOn));
          }
          setTimeout(qColActiveSync, 0);
          return;
        }
        setTimeout(function () { qColActiveSync(); qColClose(p); }, 0); return;
      }
      if (!e.target.closest('.q-col-pop')) qColCloseAll(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var open = document.querySelector('.q-col-pop:not([hidden])');
        if (open) { var b = open.parentNode.querySelector('.q-col-filter'); qColClose(open); if (b) b.focus(); }
      }
    });
    window.addEventListener('resize', function () { qColCloseAll(null); });
    document.addEventListener('ecp-rolechange', qColActiveSync);
    // keep funnel active-state in sync after any reset/clear
    document.addEventListener('click', function (e) { if (e.target.closest('[data-qf-reset]')) setTimeout(qColActiveSync, 0); });
    qColActiveSync();
    // row -> detail panel
    function qOpen(box, r) {
      var pid = box.getAttribute('data-qpanel'), panel = document.getElementById(pid); if (!panel) return;
      document.querySelectorAll('[data-qpanel="' + pid + '"] [data-qrow].selected').forEach(function (x) { x.classList.remove('selected'); });
      r.classList.add('selected');
      // same item shown in another view of the same panel (list row + kanban card) stays in sync
      var rid = r.getAttribute('data-id');
      if (rid) document.querySelectorAll('[data-qpanel="' + pid + '"] [data-qrow]').forEach(function (x) { if (x.getAttribute('data-id') === rid) x.classList.add('selected'); });
      var sp = panel.closest('.job-split'); if (sp) sp.classList.remove('side-closed');
      panel.querySelectorAll('[data-f]').forEach(function (el) { var v = r.getAttribute('data-f-' + el.getAttribute('data-f')); if (v !== null) SRC(el, v); });
      panel.querySelectorAll('[data-fc]').forEach(function (el) { var v = r.getAttribute('data-c-' + el.getAttribute('data-fc')); if (v !== null) el.className = v; });
      panel.querySelectorAll('[data-fh]').forEach(function (el) { var v = r.getAttribute('data-h-' + el.getAttribute('data-fh')); if (v !== null) el.setAttribute('href', v); });
      var slot = panel.querySelector('[data-qtpl-slot]'), tpl = document.querySelector('template[data-qtpl="' + r.getAttribute('data-id') + '"]');
      if (slot && tpl) slot.innerHTML = tpl.innerHTML;
      Q.item = r.getAttribute('data-id');
      panel.querySelectorAll('[data-approve]').forEach(function (b) {
        if (r.hasAttribute('data-self')) b.setAttribute('data-self-edit', 'Bạn là người sửa thay đổi này'); else b.removeAttribute('data-self-edit');
      });
      var conf = r.getAttribute('data-f-conf'), evidence = r.getAttribute('data-f-evidence');
      var confN = parseFloat((conf || '').replace(',', '.'));
      var ineligible = !evidence || /chưa có bằng chứng|thiếu bằng chứng/i.test(evidence) || (!isNaN(confN) && confN < 0.6);
      var high = r.getAttribute('data-tier') === 'high';
      panel.querySelectorAll('[data-approve]').forEach(function (b) {
        if (high) b.setAttribute('data-bulk-off', T('qap.highBlocked', 'Rủi ro cao: duyệt trong Review Workspace'));
        else if (ineligible) b.setAttribute('data-bulk-off', T('q.approveBlocked', 'Thiếu bằng chứng hoặc confidence < 0,6 — mở Review Workspace để xử lý'));
        // lifting the gate: applyRoleGates only revisits elements that still carry a gate attribute, so re-sync here
        else if (b.hasAttribute('data-bulk-off')) { b.removeAttribute('data-bulk-off'); setGateDisabled(b, gateReason(b)); }
      });
      panel.querySelectorAll('.q-foot-note').forEach(function (x) { x.hidden = !high; });
      panel.querySelectorAll('[data-fh="open"]').forEach(function (a) { a.classList.toggle('btn-primary', high); a.classList.toggle('btn-secondary', !high); });
      panel.querySelectorAll('.q-done').forEach(function (x) { x.remove(); });
      var editable = /^(edit|contrib|tag)$/.test(r.getAttribute('data-type') || '');
      panel.querySelectorAll('[data-edit-draft]').forEach(function (b) { b.hidden = !editable; });
      applyRoleGates();
      panel.dispatchEvent(new CustomEvent('ecp-qopen', { bubbles: true, detail: { row: r, box: box } }));
    }
    function qBind(box) {
      if (box.__qb) return; box.__qb = 1;
      box.addEventListener('click', function (e) {
        // explicit "open in panel" button inside a row (e.g. Trace)
        var ob = e.target.closest('[data-qrow-open]'), or = ob && ob.closest('[data-qrow]');
        if (or && box.contains(or)) { qOpen(box, or); return; }
        if (e.target.closest('button, a, input, label, select')) return;
        var r = e.target.closest('[data-qrow]'); if (!r || !box.contains(r)) return;
        // click an already-selected row (with the panel open) to toggle the detail off
        var pid = box.getAttribute('data-qpanel'), sp = (document.getElementById(pid) || {}).closest ? document.getElementById(pid).closest('.job-split') : null;
        if (!box.hasAttribute('data-qpanel-sticky') && r.classList.contains('selected') && sp && !sp.classList.contains('side-closed')) {
          sp.classList.add('side-closed');
          document.querySelectorAll('[data-qpanel="' + pid + '"] [data-qrow].selected').forEach(function (x) { x.classList.remove('selected'); });
          return;
        }
        qOpen(box, r);
      });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-qrow')) { e.preventDefault(); qOpen(box, e.target); }
      });
      var first = box.querySelector('[data-qrow].selected');
      if (first) qOpen(box, first);
    }
    document.querySelectorAll('[data-qpanel]').forEach(qBind);
    document.querySelectorAll('[data-qpanel-close]').forEach(function (b) {
      b.addEventListener('click', function () { var sp = b.closest('.job-split'); if (sp) sp.classList.add('side-closed'); });
    });
    // bulk select
    function bulkSync(scope) {
      var checks = [].slice.call(scope.querySelectorAll('input.q-check'));
      var n = checks.filter(function (c) { return c.checked; }).length;
      var eligible = checks.filter(function (c) { return !c.disabled && !c.closest('[hidden]'); });
      var on = eligible.filter(function (c) { return c.checked; }).length;
      scope.querySelectorAll('input.q-check-all').forEach(function (a) { a.checked = eligible.length > 0 && on === eligible.length; a.indeterminate = on > 0 && on < eligible.length; a.disabled = !eligible.length; });
      scope.querySelectorAll('[data-bulk-count]').forEach(function (c) { c.textContent = n; });
      if (QMOD) qBulkCtx(scope, n);
      // selected rows that are ineligible (low confidence / missing evidence) — reuses the single-item approve rule
      var selIneligible = checks.filter(function (c) {
        if (!c.checked) return false;
        var tr = c.closest('[data-qrow]'); if (!tr) return false;
        var cf = parseFloat((tr.getAttribute('data-f-conf') || '').replace(',', '.'));
        var ev = tr.getAttribute('data-f-evidence');
        return !ev || /chưa có bằng chứng|thiếu bằng chứng/i.test(ev) || (!isNaN(cf) && cf < 0.6);
      }).length;
      scope.querySelectorAll('[data-bulk-btn]').forEach(function (b) {
        var min = parseInt(b.getAttribute('data-bulk-min'), 10) || 1;
        if (n < min) b.setAttribute('data-bulk-off', T('q.bulkMin', 'Chọn ít nhất {n} mục', { n: min }));
        else if (b.hasAttribute('data-bulk-eligible') && selIneligible > 0) b.setAttribute('data-bulk-off', T('q.bulkApproveIneligible', 'Có mục thiếu bằng chứng hoặc confidence < 0,6 trong lựa chọn'));
        else b.removeAttribute('data-bulk-off');
        setGateDisabled(b, gateReason(b));
      });
      // Quality Overview KB rollup: the queue filters by one KB; with several picked it opens unfiltered
      scope.querySelectorAll('[data-bulk-kbq]').forEach(function (b) {
        var sel = checks.filter(function (c) { return c.checked; }), many = sel.length > 1, k = many ? 'q.openQueue' : 'q.openFilteredQueue';
        b.setAttribute('data-i18n', k);
        b.textContent = T(k, many ? 'Mở hàng chờ' : 'Mở hàng chờ đã lọc');
        b.setAttribute('href', 'changes-approval-v2.html' + (sel.length === 1 ? '?kb=' + encodeURIComponent(sel[0].getAttribute('data-kb')) : ''));
      });
    }
    document.addEventListener('change', function (e) {
      var t = e.target, scope = t.closest && t.closest('[data-bulk-scope]');
      if (!scope) return;
      if (t.classList.contains('q-check-all')) {
        scope.querySelectorAll('input.q-check').forEach(function (c) { if (!c.disabled && !c.closest('[hidden]')) c.checked = t.checked; });
        bulkSync(scope);
      } else if (t.classList.contains('q-check')) bulkSync(scope);
    });
    document.querySelectorAll('[data-bulk-scope]').forEach(bulkSync);
    // confirm dialog + toast
    // toast(msg[, {label, fn}]) — optional inline action (e.g. Hoàn tác, Xem job)
    function toast(msg, act) {
      var t = document.getElementById('q-toast');
      if (!t) { t = document.createElement('div'); t.id = 'q-toast'; t.className = 'q-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); t.hidden = true; document.body.appendChild(t); }
      clearTimeout(t._h); clearTimeout(t._w);
      t.hidden = false; t.textContent = '';
      t._w = setTimeout(function () {
        t.textContent = msg;
        if (act && act.fn) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'q-toast-act'; b.textContent = act.label;
          b.addEventListener('click', function () { clearTimeout(t._h); t.hidden = true; act.fn(); });
          t.appendChild(b);
        }
      }, 30);
      t._h = setTimeout(function () { t.hidden = true; }, act ? 8000 : 4000);
    }
    window.ECP_toast = toast; // reused by the taxonomy edit form (toast only after a successful save)
    // after Create KB (kb-create.html): ?created=src -> the Source Path check result (mock: accessible, 128 files), as the app
    if (params.get('created') && document.querySelector('.detail-main .art-empty')) {
      toast(T('kbc.createdSrcOk', 'Đã tạo tri thức · Source truy cập được · {n} file', { n: new Intl.NumberFormat(I18N && I18N.lang === 'en' ? 'en-GB' : 'vi-VN').format(128) }));
      var cu = new URLSearchParams(location.search); cu.delete('created');
      history.replaceState(null, '', location.pathname + (cu.toString() ? '?' + cu.toString() : '') + location.hash);
    }
    window.ECP_applyGates = applyRoleGates; // re-gates dynamically wired buttons (version history popup restore)
    var qBtn = null;
    function qDialog() {
      var d = document.getElementById('q-dialog');
      if (d) return d;
      d = document.createElement('dialog'); d.id = 'q-dialog'; d.className = 'q-dialog'; d.setAttribute('aria-labelledby', 'qd-t');
      d.innerHTML = '<form method="dialog"><h2 id="qd-t"></h2><p class="qd-body"></p><div class="qd-detail" hidden></div><div class="qd-assign" hidden><label for="qd-a" data-i18n="q.dlgAssignee">Gán lại cho (bắt buộc)</label><select id="qd-a" class="input"></select></div><label for="qd-c">Nhận xét / lý do</label><textarea id="qd-c" class="textarea" rows="3"></textarea><span class="field-err" id="qd-err" hidden></span><div class="qd-foot"><button value="cancel" class="btn btn-secondary" data-i18n="q.dlgCancel">Hủy</button><button value="ok" class="btn btn-primary" data-i18n="q.dlgOk">Xác nhận</button></div></form>';
      document.body.appendChild(d);
      if (I18N) I18N.apply(d);
      var f = d.querySelector('form'), ta = d.querySelector('#qd-c'), err = d.querySelector('#qd-err'), as = d.querySelector('#qd-a');
      f.addEventListener('submit', function (e) {
        var sub = e.submitter;
        if (!sub || sub.value !== 'ok' || !qBtn) return;
        if (qBtn.hasAttribute('data-need-assignee') && !as.value) {
          e.preventDefault();
          err.textContent = T('q.errAssignee', 'Chọn người được gán lại'); err.hidden = false;
          as.setAttribute('aria-invalid', 'true'); as.setAttribute('aria-describedby', 'qd-err'); as.focus();
          return;
        }
        if ((qBtn.hasAttribute('data-need-reason') || qBtn.hasAttribute('data-change-reason')) && !ta.value.trim()) {
          e.preventDefault();
          err.textContent = qBtn.hasAttribute('data-change-reason') ? T('q.errChangeReason', 'Nhập lý do thay đổi để gửi duyệt') : T('q.errReason', 'Nhập lý do trước khi tiếp tục'); err.hidden = false;
          as.removeAttribute('aria-invalid'); as.removeAttribute('aria-describedby');
          ta.setAttribute('aria-invalid', 'true'); ta.setAttribute('aria-describedby', 'qd-err'); ta.focus();
          return;
        }
        Q.assignee = as.value;
        var b = qBtn; setTimeout(function () { qApply(b); }, 0);
      });
      return d;
    }
    function qSetChip(el, spec) {
      var p = spec.split('|');
      SRC(el, p[0], TV(spec).split('|')[0]);
      if (p[1]) {
        el.className.split(/\s+/).forEach(function (c) { if (/^chip-(neutral|info|success|warning|error|lon|vua|thap)$/.test(c)) el.classList.remove(c); });
        el.classList.add('chip'); el.classList.add(p[1]);
      }
    }
    function qApply(b) {
      var scope = b.closest('[data-bulk-scope]'), toastMsg = qFill(TV(b.getAttribute('data-toast')), b);
      var spec = b.getAttribute('data-set-status'), tsel = b.getAttribute('data-status-target');
      if (spec && tsel) {
        if (tsel === 'checked' && scope) {
          scope.querySelectorAll('input.q-check:checked').forEach(function (c) {
            var tr = c.closest('[data-qrow]'), chip = tr && tr.querySelector('.chip-st');
            if (chip) qSetChip(chip, spec);
            c.checked = false; c.disabled = true; c.title = T('q.handled', 'Đã xử lý');
          });
        } else document.querySelectorAll(tsel).forEach(function (el) { qSetChip(el, spec); });
      }
      var lock = b.getAttribute('data-lock');
      if (lock) document.querySelectorAll(lock).forEach(function (box) {
        box.querySelectorAll('button, textarea').forEach(function (x) { if (x.tagName === 'TEXTAREA') x.disabled = true; else { x.setAttribute('data-locked', 'Đã xử lý'); setGateDisabled(x, T('q.handled', 'Đã xử lý')); } });
      });
      if (scope) bulkSync(scope);
      if (toastMsg) toast(toastMsg);
      document.dispatchEvent(new CustomEvent('ecp-qapply', { detail: { btn: b } }));
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-q-confirm]');
      if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
      e.preventDefault();
      var d = qDialog(); qBtn = b;
      d.querySelector('#qd-t').textContent = qFill(TV(b.getAttribute('data-title')) || b.textContent.trim() + '?', b);
      var body = d.querySelector('.qd-body'), bt = qFill(TV(b.getAttribute('data-body')), b);
      body.textContent = bt; body.hidden = !bt;
      // data-confirm-detail="#template-id": decision facts (author vs you, impact, missing evidence, rollback) shown above the comment
      var dd = d.querySelector('.qd-detail'), dsrc = b.getAttribute('data-confirm-detail') && document.querySelector(b.getAttribute('data-confirm-detail'));
      if (dsrc && dsrc.getAttribute('data-for') && dsrc.getAttribute('data-for') !== Q.item) dsrc = null;
      dd.innerHTML = dsrc ? dsrc.innerHTML : ''; dd.hidden = !dsrc; d.classList.toggle('has-detail', !!dsrc);
      var fbox = b.closest('.job-side');
      if (fbox) dd.querySelectorAll('[data-f-copy]').forEach(function (x) { var s = fbox.querySelector('[data-f="' + x.getAttribute('data-f-copy') + '"]'); x.textContent = s ? s.textContent : ''; });
      if (dsrc && I18N) I18N.apply(dd);
      var ta = d.querySelector('#qd-c'), cm = document.getElementById('q-comment'), err = d.querySelector('#qd-err');
      // data-no-comment: a plain confirm (title, body, two buttons), like the web app's ConfirmDialog
      ta.hidden = d.querySelector('label[for="qd-c"]').hidden = b.hasAttribute('data-no-comment');
      ta.value = cm ? cm.value : ''; err.hidden = true; ta.removeAttribute('aria-invalid'); ta.removeAttribute('aria-describedby');
      var aw = d.querySelector('.qd-assign'), as = d.querySelector('#qd-a'), needA = b.hasAttribute('data-need-assignee');
      aw.hidden = !needA; as.removeAttribute('aria-invalid'); as.removeAttribute('aria-describedby'); Q.assignee = '';
      as.innerHTML = '<option value="">' + T('q.pickPerson', 'Chọn người…') + '</option>';
      if (needA) {
        (b.getAttribute('data-assignees') || '').split('|').forEach(function (p) {
          p = p.trim(); if (!p) return;
          var o = document.createElement('option'); o.value = p.split(' · ')[0]; o.textContent = p; as.appendChild(o);
        });
        as.setAttribute('aria-required', 'true');
      } else as.removeAttribute('aria-required');
      // data-change-reason: submitting a change for review (Taxonomy / Ontology, Đưa lên Global) needs the reason for change
      var chgR = b.hasAttribute('data-change-reason');
      d.querySelector('label[for="qd-c"]').textContent = chgR ? T('q.dlgChangeReason', 'Lý do thay đổi (bắt buộc)') : b.hasAttribute('data-need-reason') ? T('q.dlgReasonReq', 'Nhận xét / lý do (bắt buộc)') : T('q.dlgCommentOpt', 'Nhận xét (không bắt buộc)');
      ta.placeholder = chgR ? T('q.changeReasonPh', 'Vì sao cần thay đổi này: căn cứ, văn bản hoặc yêu cầu nghiệp vụ') : '';
      if (chgR || b.hasAttribute('data-need-reason')) ta.setAttribute('aria-required', 'true'); else ta.removeAttribute('aria-required');
      // primary button repeats the action verb (Từ chối / Duyệt / Gán lại…); danger style only for destructive actions
      var okb = d.querySelector('button[value="ok"]'), verb = b.getAttribute('data-ok') || b.textContent.replace(/\s+/g, ' ').replace(/[?…▾]+\s*$/, '').trim();
      okb.removeAttribute('data-i18n'); okb.textContent = verb || T('q.dlgOk', 'Xác nhận');
      okb.className = 'btn ' + (b.matches('.q-danger, .btn-danger, [data-danger]') || /^(từ chối|rút lại|xóa|xoá|rollback|reject|withdraw|delete|remove)/i.test(verb) ? 'btn-danger' : b.hasAttribute('data-approve') ? 'btn-approve' : 'btn-primary');
      var det = b.closest('details'); if (det) det.open = false;
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    });
    // approval outcome: what happened, what runs next, the way back
    function qEsc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    var Q_CHECK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
    document.addEventListener('ecp-qapply', function (e) {
      var b = e.detail && e.detail.btn; if (!b || !b.hasAttribute('data-approve')) return;
      var id = Q.item || '', bar = b.closest('.q-actionbar'), foot = b.closest('.job-side-foot');
      var done = document.createElement('div'); done.className = 'q-done'; done.setAttribute('role', 'status'); done.tabIndex = -1;
      var head = '<div class="q-done-h">' + Q_CHECK + '<h3>' + qEsc(T('qap.doneT', 'Đã duyệt {id}', { id: id })) + '</h3></div>';
      if (bar) {
        var cur = document.querySelector('.q-ws-item.is-current'), all = [].slice.call(document.querySelectorAll('.q-ws-item[data-item]'));
        var nx = cur ? all[all.indexOf(cur) + 1] : null, vm = /(v[\d.]+)\s*→\s*(v[\d.]+)/.exec((cur && cur.getAttribute('data-ws-art')) || '');
        var from = vm ? vm[1] : '', to = vm ? vm[2] : '';
        done.innerHTML = head +
          '<p>' + qEsc(to ? T('qap.doneBody', '{to} đang được áp dụng. Update Pipeline cập nhật các FAQ, Wiki và graph bị ảnh hưởng; người sửa đã được thông báo.', { to: to }) : T('qap.doneBodyGen', 'Thay đổi đang được áp dụng; người sửa đã được thông báo.')) + '</p>' +
          '<div class="q-done-acts">' + (nx ? '<a class="btn btn-primary" href="' + qEsc(nx.getAttribute('href')) + '">' + qEsc(T('qap.next', 'Việc kế tiếp: {id}', { id: nx.getAttribute('data-item') })) + '</a>' : '<a class="btn btn-primary" href="quality-review.html">' + qEsc(T('qap.backQueue', 'Về hàng chờ')) + '</a>') +
          (from ? '<button class="btn btn-secondary" type="button" data-q-confirm data-danger data-need-reason data-title="' + qEsc(T('qap.rbT', 'Rollback {id} về {from}?', { id: id, from: from })) + '" data-body="' + qEsc(T('qap.rbBody', 'Tạo yêu cầu khôi phục {from}. Yêu cầu này cần một người duyệt khác; {to} vẫn hiệu lực đến khi được duyệt.', { from: from, to: to })) + '" data-ok="' + qEsc(T('qap.rbOk', 'Tạo yêu cầu rollback')) + '" data-toast="' + qEsc(T('qap.rbToast', 'Đã tạo yêu cầu rollback {id} về {from}', { id: id, from: from })) + '">' + qEsc(T('qap.rb', 'Rollback về {from}', { from: from })) + '</button>' : '') + '</div>' +
          (from ? '<p class="muted text-sm">' + qEsc(T('qap.rbNote', 'Rollback không xóa {to}: nó tạo yêu cầu khôi phục {from} và cũng đi qua maker-checker.', { from: from, to: to })) + '</p>' : '');
        bar.innerHTML = ''; bar.appendChild(done); done.focus();
      } else if (foot) {
        var body = foot.parentNode.querySelector('.job-side-body'); if (!body) return;
        done.classList.add('is-compact');
        done.innerHTML = head + '<p>' + qEsc(T('qap.doneBodyGen', 'Thay đổi đang được áp dụng; người sửa đã được thông báo.')) + ' ' + qEsc(T('qap.doneRbHint', 'Có thể rollback trong Lịch sử phiên bản.')) + '</p>';
        body.querySelectorAll('.q-done').forEach(function (x) { x.remove(); });
        body.insertBefore(done, body.firstChild); body.scrollTop = 0; done.focus();
      }
    });
    // view switch (list / kanban …)
    function qView(sw, key) {
      var sc = sw.getAttribute('data-view-switch'), scope = (sc && document.getElementById(sc)) || document;
      scope.querySelectorAll('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== key; });
    }
    document.addEventListener('click', function (e) {
      var k = e.target.closest('[data-view-switch] [data-view-key]');
      if (k) qView(k.closest('[data-view-switch]'), k.getAttribute('data-view-key'));
      var m = e.target.closest('[data-diff-mode] [data-mode]');
      if (m) {
        var card = m.closest('.card') || document;
        card.querySelectorAll('[data-diff]').forEach(function (d) { d.classList.toggle('is-unified', m.getAttribute('data-mode') === 'unified'); });
      }
      var tb = e.target.closest('[role="tab"][data-qside-close], [role="tab"][data-qside-open]');
      if (tb) {
        var spl = tb.closest('.job-split'); if (spl) spl.classList.toggle('side-closed', tb.hasAttribute('data-qside-close'));
        // reopen the panel on this tab's own row (selected visible row, else first visible row)
        var tp = tb.hasAttribute('data-qside-open') && document.getElementById(tb.getAttribute('aria-controls')), pb = tp && tp.querySelector('[data-qpanel]');
        if (pb) {
          var vis = [].filter.call(pb.querySelectorAll('[data-qrow]'), function (x) { return !x.hidden; });
          var pr = vis.filter(function (x) { return x.classList.contains('selected'); })[0] || vis[0];
          if (pr) qOpen(pb, pr);
        }
      }
      // toast-only buttons (no confirm dialog)
      var tt = e.target.closest('[data-toast]:not([data-q-confirm])');
      if (tt && !tt.disabled && tt.getAttribute('aria-disabled') !== 'true') toast(qFill(TV(tt.getAttribute('data-toast')), tt));
    });
    // fields that save on change (e.g. Feedback › Phân loại) confirm with a toast
    document.addEventListener('change', function (e) {
      var f = e.target.closest && e.target.closest('[data-toast-change]');
      if (f) toast(TV(f.getAttribute('data-toast-change')));
    });
    // review workspace ?item=
    var wsItems = document.querySelectorAll('.q-ws-item[data-item]');
    if (wsItems.length) {
      var want = params.get('item'), cur = wsItems[0];
      wsItems.forEach(function (it) { if (it.getAttribute('data-item') === want) cur = it; });
      wsItems.forEach(function (it) { var on = it === cur; it.classList.toggle('is-current', on); if (on) it.setAttribute('aria-current', 'true'); else it.removeAttribute('aria-current'); });
      Q.item = cur.getAttribute('data-item');
      document.querySelectorAll('[data-ws]').forEach(function (el) { var v = cur.getAttribute('data-ws-' + el.getAttribute('data-ws')); if (v !== null) SRC(el, v); });
      document.querySelectorAll('[data-wsc]').forEach(function (el) { var v = cur.getAttribute('data-ws-c-' + el.getAttribute('data-wsc')); if (v !== null) el.className = v; });
      document.querySelectorAll('[data-approve]').forEach(function (b) {
        if (cur.hasAttribute('data-self')) b.setAttribute('data-self-edit', 'Bạn là người sửa thay đổi này'); else b.removeAttribute('data-self-edit');
      });
    }
    // change request ?state=
    if (document.querySelector('[data-cr-show], [data-cr-enable]')) {
      var crs = params.get('state');
      if (['pending', 'approved', 'migrating'].indexOf(crs) === -1) crs = 'pending';
      root.setAttribute('data-cr-state', crs);
    }
    // ---- Evaluation Lab: dataset list -> question-set detail, add popups ----
    var dsTab = document.getElementById('ep-datasets'), dsList = dsTab && dsTab.querySelector('[data-ds-view="list"]'), dsDet = dsTab && dsTab.querySelector('[data-ds-view="detail"]');
    if (dsList && dsDet) (function () {
      var evMain = document.getElementById('main'), evSplit = dsTab.closest('.job-split'), evSide = document.getElementById('ev-side');
      var KBN = { tindung: 'Quy trình tín dụng doanh nghiệp', the: 'Sản phẩm thẻ tín dụng', kyc: 'Chính sách KYC/AML', nhansu: 'Quy định nhân sự', core: 'Hướng dẫn Core Banking', digital: 'FAQ Ngân hàng số' };
      var CATN = { fact: 'Tra cứu sự kiện', proc: 'Quy trình', cond: 'Điều kiện & ngoại lệ', cmp: 'So sánh', multi: 'Tổng hợp nhiều nguồn' };
      var LVLN = { de: ['Dễ', 'chip-thap'], tb: ['Trung bình', 'chip-vua'], kho: ['Khó', 'chip-lon'] };
      // table chips use short difficulty labels (Dễ / TB / Khó) with the full name as tooltip; category cells are keyed too
      var LVLK = { de: ['qnd.e.lvlDeS', 'Dễ', 'qnd.e.lvlDe'], tb: ['qnd.e.lvlTbS', 'TB', 'qnd.e.lvlTb'], kho: ['qnd.e.lvlKhoS', 'Khó', 'qnd.e.lvlKho'] };
      var CATK = { fact: 'qnd.e.catFact', proc: 'common.process', cond: 'qnd.e.catCond', cmp: 'qnd.e.catCmp', multi: 'qnd.e.catMulti' };
      function keyedTxt(e, key, vi, tkey, tvi) {
        e.textContent = T(key, vi); e.setAttribute('data-i18n', key); e.__kcVi = vi;
        if (tkey) { e.title = T(tkey, tvi); e.setAttribute('data-i18n-attr', 'title:' + tkey); e.__kcViA = { title: tvi }; }
      }
      function lvlChipSet(e, k) { var x = LVLK[k]; if (!x) return; keyedTxt(e, x[0], x[1], x[2], LVLN[k][0]); e.classList.remove('chip-thap', 'chip-vua', 'chip-lon'); e.classList.add('chip', LVLN[k][1]); }
      function catCellSet(e, k) { if (CATK[k]) keyedTxt(e, CATK[k], CATN[k], CATK[k], CATN[k]); else { e.textContent = k; e.title = k; } }
      var DOCS = {
        kyc: ['Chính sách KYC/AML · v5.2', 'Hướng dẫn eKYC · v3', 'Quy trình sàng lọc cấm vận · v2'],
        tindung: ['QĐ-2024/TD-112 · v2', 'QĐ-TD-098 · v4', 'Quy định cấp tín dụng đối với KHDN · v2.3'],
        the: ['Biểu phí thẻ · v7', 'Thể lệ ưu đãi Platinum 2025 · v1'],
        core: ['Hướng dẫn T24 – Hạch toán · v9'],
        digital: ['FAQ Ngân hàng số · v14'],
        nhansu: ['Quy định nhân sự · v6']
      };
      var GEN = {
        kyc: [
          { q: 'Ngưỡng báo cáo giao dịch chuyển tiền điện tử trong nước là bao nhiêu?', a: 'Từ 500 triệu đồng trở lên với mỗi giao dịch chuyển tiền điện tử trong nước.', c: [['Chính sách KYC/AML · v5.2', 'tr.26 · §10.1 · chunk c-0476']], cat: 'fact', lvl: 'de', tags: 'Chuyển tiền; Báo cáo' },
          { q: 'Khách hàng từ chối cung cấp thông tin nguồn tiền thì xử lý thế nào?', a: 'Không thực hiện giao dịch, ghi nhận vào hồ sơ và cân nhắc báo cáo giao dịch đáng ngờ trong 3 ngày làm việc.', c: [['Chính sách KYC/AML · v5.2', 'tr.12 · §5.3 · chunk c-0371'], ['Chính sách KYC/AML · v5.2', 'tr.25 · §9.6 · chunk c-0472']], cat: 'proc', lvl: 'tb', tags: 'Nguồn tiền; STR' }
        ],
        tindung: [
          { q: 'Tỷ lệ cho vay tối đa trên giá trị tài sản bảo đảm là bất động sản?', a: 'Tối đa 70% giá trị định giá tài sản bảo đảm.', c: [['QĐ-2024/TD-112 · v2', 'tr.21 · §5.1 · chunk c-0251']], cat: 'fact', lvl: 'de', tags: 'Tài sản bảo đảm' },
          { q: 'Khi nào khoản vay KHDN phải trình Hội đồng tín dụng?', a: 'Khi tổng hạn mức vượt 30 tỷ đồng hoặc khách hàng thuộc nhóm nợ 2 trở lên.', c: [['QĐ-2024/TD-112 · v2', 'tr.14 · §3.3 · chunk c-0234']], cat: 'cond', lvl: 'tb', tags: 'Thẩm quyền phê duyệt' }
        ],
        the: [
          { q: 'Phí chậm thanh toán thẻ tín dụng là bao nhiêu?', a: '4% số tiền chậm thanh toán, tối thiểu 99.000 đồng.', c: [['Biểu phí thẻ · v7', 'tr.4 · §2.1 · chunk c-0035']], cat: 'fact', lvl: 'de', tags: 'Biểu phí' },
          { q: 'Điều kiện nâng hạn mức thẻ tín dụng tạm thời?', a: 'Thẻ hoạt động từ 6 tháng, không có nợ quá hạn; tối đa 30% hạn mức hiện tại trong 30 ngày.', c: [['Biểu phí thẻ · v7', 'tr.8 · §4 · chunk c-0052']], cat: 'cond', lvl: 'tb', tags: 'Hạn mức' }
        ],
        core: [
          { q: 'Mã lỗi T24 E-3305 khi tất toán tài khoản tiết kiệm nghĩa là gì?', a: 'Tài khoản còn lệnh phong tỏa; giải tỏa trước rồi tất toán lại.', c: [['Hướng dẫn T24 – Hạch toán · v9', 'tr.27 · §6.3 · chunk c-0655']], cat: 'fact', lvl: 'tb', tags: 'T24; Mã lỗi' },
          { q: 'Các bước mở lại batch COB bị dừng giữa chừng?', a: 'Kiểm tra log COB, xử lý job lỗi, chạy lại từ bước bị dừng và xác nhận số dư cuối ngày.', c: [['Hướng dẫn T24 – Hạch toán · v9', 'tr.40 · §9 · chunk c-0701']], cat: 'proc', lvl: 'kho', tags: 'T24; COB' }
        ],
        digital: [
          { q: 'Quên mật khẩu ứng dụng ngân hàng số thì làm gì?', a: 'Chọn Quên mật khẩu, xác thực CCCD gắn chip và OTP SMS, rồi đặt mật khẩu mới.', c: [['FAQ Ngân hàng số · v14', 'mục #5 · chunk c-0281']], cat: 'proc', lvl: 'de', tags: 'Mật khẩu; App' },
          { q: 'Chuyển tiền nhanh 24/7 có mất phí không?', a: 'Miễn phí với giao dịch dưới 500.000 đồng; trên mức này theo biểu phí hiện hành.', c: [['FAQ Ngân hàng số · v14', 'mục #21 · chunk c-0305']], cat: 'fact', lvl: 'de', tags: 'Phí; Chuyển tiền' }
        ],
        nhansu: [
          { q: 'Số ngày nghỉ phép năm của nhân viên chính thức?', a: '12 ngày, cộng 1 ngày cho mỗi 5 năm thâm niên.', c: [['Quy định nhân sự · v6', 'tr.11 · §4.2 · chunk c-0090']], cat: 'fact', lvl: 'de', tags: 'Nghỉ phép' },
          { q: 'Quy trình xin nghỉ phép dài ngày?', a: 'Gửi đề xuất trước 7 ngày, trưởng đơn vị phê duyệt, nhân sự cập nhật hệ thống.', c: [['Quy định nhân sự · v6', 'tr.12 · §4.4 · chunk c-0093']], cat: 'proc', lvl: 'de', tags: 'Nghỉ phép' }
        ]
      };
      var MISS = { kyc: 'Tổ chức phi lợi nhuận có cần xác minh nguồn tài trợ không?', tindung: 'Khoản vay hợp vốn do chi nhánh nào làm đầu mối?', the: 'Thẻ phụ có được hoàn tiền riêng không?', core: 'T24 có hỗ trợ hạch toán ngày nghỉ lễ không?', digital: 'App có hỗ trợ đăng nhập bằng khuôn mặt trên máy tính bảng không?', nhansu: 'Nhân viên thử việc có được nghỉ phép không?' };
      var BY = { owner: 'Nguyễn Lan', steward: 'Trần Hải', admin: 'System Admin' };
      var caseSeq = 600, rvSeq = 1042, dsSeq = 6, curDs = null;
      var PENCIL = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3M13.5 6.5l3 3"/></svg>';
      function nextCase() { caseSeq++; return 'C-0' + caseSeq; }
      function nextRv() { rvSeq++; return 'RV-' + rvSeq; }
      function dsRow(id) { return dsList.querySelector('tr[data-ds-row][data-id="' + id + '"]'); }
      function dsTable(id) { return dsDet.querySelector('table[data-ds-table="' + id + '"]'); }
      function setT(root, k, v) { var el = root.querySelector('[data-v="' + k + '"]'); if (el) el.textContent = v; return el; }
      function num(el) { return parseInt(String(el && el.textContent || '0').replace(/\D/g, ''), 10) || 0; }
      function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
      function granted(r) { return getRole() !== 'steward' || r.hasAttribute('data-stw'); }
      // ---- dataset versions: published vN (read-only, used by evaluation jobs) + one auto-saved draft ----
      var VERS = {
        'DS-01': { pub: [
          { v: 'v1', at: '15/05 10:00', by: 'Nguyễn Lan', total: 300, ok: 300, sum: { a: 300, e: 0, d: 0 }, init: true, runs: [] },
          { v: 'v2', at: '28/05 14:00', by: 'Nguyễn Lan', total: 312, ok: 312, sum: { a: 14, e: 3, d: 2 }, runs: ['J-209'] },
          { v: 'v3', at: '12/06 09:30', by: 'Nguyễn Lan', total: 320, ok: 320, sum: { a: 10, e: 5, d: 2 }, runs: ['J-219', 'J-220', 'J-221'] }],
          draft: { v: 'v4', at: '10:42', by: 'Nguyễn Lan', add: 2, addOk: 0, edit: 1, editOk: 1, del: 1, delPend: 0 } },
        'DS-02': { pub: [
          { v: 'v1', at: '20/05 09:00', by: 'Nguyễn Lan', total: 200, ok: 200, sum: { a: 200, e: 0, d: 0 }, init: true, runs: ['J-214'] },
          { v: 'v2', at: '08/06 16:00', by: 'Nguyễn Lan', total: 210, ok: 210, sum: { a: 12, e: 4, d: 2 }, runs: ['J-217'] }],
          draft: { v: 'v3', at: '09:40', by: 'Nguyễn Lan', add: 1, addOk: 0, edit: 1, editOk: 1, del: 1, delPend: 0 } },
        'DS-03': { pub: [
          { v: 'v1', at: '06/05 10:00', by: 'Trần Hải', total: 172, ok: 172, sum: { a: 172, e: 0, d: 0 }, init: true, runs: [] },
          { v: 'v2', at: '30/05 16:30', by: 'Nguyễn Lan', total: 180, ok: 180, sum: { a: 10, e: 2, d: 2 }, runs: [] }],
          draft: { v: 'v3', at: 'Hôm qua 17:05', by: 'Trần Hải', add: 24, addOk: 0, edit: 1, editOk: 0, del: 0, delPend: 0 }, draftRuns: ['J-216'] },
        'DS-04': { pub: [], draft: { v: 'v1', at: '09:15', by: 'Trần Hải', add: 62, addOk: 0, edit: 0, editOk: 0, del: 0, delPend: 0 } },
        'DS-05': { pub: [
          { v: 'v1', at: '29/05 11:00', by: 'Vũ Đức', total: 240, ok: 240, sum: { a: 240, e: 0, d: 0 }, init: true, runs: ['J-215'] },
          { v: 'v2', at: '06/06 15:00', by: 'Vũ Đức', total: 246, ok: 246, sum: { a: 8, e: 3, d: 2 }, runs: ['J-218'] }],
          draft: { v: 'v3', at: '', by: '', add: 0, addOk: 0, edit: 0, editOk: 0, del: 0, delPend: 0 } },
        'DS-06': { pub: [
          { v: 'v1', at: '18/05 10:30', by: 'Nguyễn Lan', total: 270, ok: 270, sum: { a: 270, e: 0, d: 0 }, init: true, runs: [] },
          { v: 'v2', at: '03/06 15:20', by: 'Nguyễn Lan', total: 290, ok: 290, sum: { a: 22, e: 6, d: 2 }, runs: [] },
          { v: 'v3', at: '10/06 16:00', by: 'Hoàng Vy', total: 296, ok: 296, sum: { a: 8, e: 2, d: 2 }, runs: ['J-222'] }],
          draft: { v: 'v4', at: '09:05', by: 'Nguyễn Lan', add: 1, addOk: 0, edit: 0, editOk: 0, del: 1, delPend: 0 } }
      };
      // step diffs 'vA>vB' (sample pairs; counts come from VERS)
      var VD = { 'DS-01': {
        'v1>v2': [
          { k: 'add', id: 'C-0262', q: 'Điều kiện cấp hạn mức tín dụng tuần hoàn cho KHDN?', a: 'Khách hàng hoạt động tối thiểu 2 năm, không có nợ nhóm 2 trở lên trong 12 tháng gần nhất.', cite: 'QĐ-2024/TD-112 · v1 · tr.18 · §4.2', cat: 'cond', lvl: 'tb', by: 'Trần Hải', at: '22/05 10:00' },
          { k: 'edit', id: 'C-0120', q: 'Thời gian thẩm định hồ sơ tín dụng KHDN tối đa?', by: 'Nguyễn Lan', at: '25/05 11:20', before: { a: '05 ngày làm việc.', lvl: 'de' }, after: { a: '05 ngày làm việc; hồ sơ trình Hội đồng tín dụng: 07 ngày làm việc.', lvl: 'tb' } },
          { k: 'del', id: 'C-0095', q: 'Lãi suất cho vay ưu đãi KHDN năm 2024 là bao nhiêu?', a: '7,5%/năm cho kỳ hạn dưới 12 tháng.', by: 'Nguyễn Lan', at: '26/05 09:40', note: 'Chính sách 2024 hết hiệu lực' }],
        'v2>v3': [
          { k: 'add', id: 'C-0310', q: 'Thời hạn tối đa của khoản vay vốn lưu động KHDN?', a: '12 tháng, gia hạn 1 lần tối đa 6 tháng.', cite: 'QĐ-TD-098 · v4 · tr.6 · §2.4', cat: 'fact', lvl: 'de', by: 'Nguyễn Lan', at: '05/06 11:00' },
          { k: 'add', id: 'C-0312', q: 'Hồ sơ đề nghị cấp tín dụng KHDN gồm những gì?', a: 'Giấy đề nghị cấp tín dụng, hồ sơ pháp lý, báo cáo tài chính 2 năm gần nhất và phương án sử dụng vốn.', cite: 'Quy định cấp tín dụng đối với KHDN · v2.3 · tr.9', cat: 'multi', lvl: 'kho', by: 'Trần Hải', at: '08/06 15:20' },
          { k: 'edit', id: 'C-0187', q: 'Giám đốc chi nhánh được phê duyệt khoản cấp tín dụng có tổng hạn mức tối đa bao nhiêu?', by: 'Trần Hải', at: '05/06 10:12', before: { a: 'Tổng hạn mức đến 20 tỷ đồng.', cite: 'QĐ-2024/TD-112 · v1 · tr.12 · §3.2' }, after: { a: 'Tổng hạn mức đến 30 tỷ đồng.', cite: 'QĐ-2024/TD-112 · v2 · tr.14 · §3.2' } },
          { k: 'del', id: 'C-0150', q: 'Hạn mức bảo lãnh tối đa mà Giám đốc chi nhánh cấp 2 được phê duyệt?', a: '10 tỷ đồng mỗi khoản bảo lãnh.', by: 'Nguyễn Lan', at: '11/06 09:00', note: 'Gộp vào C-0187 sau khi QĐ-2024/TD-112 v2 hiệu lực' }],
        'v3>v4': [
          { k: 'add', st: 'pending', id: 'C-0315', q: 'Khoản vay KHDN được cơ cấu lại thời hạn trả nợ tối đa mấy lần?', a: 'Tối đa 2 lần trong suốt thời hạn khoản vay.', cite: 'Quy định cấp tín dụng đối với KHDN · v2.3 · tr.22 · §7.1', cat: 'cond', lvl: 'tb', by: 'Nguyễn Lan', at: '14/06 10:42' },
          { k: 'add', st: 'pending', id: 'C-0316', q: 'Hồ sơ giải ngân khoản vay vốn lưu động gồm những gì?', a: 'Giấy nhận nợ, chứng từ chứng minh mục đích sử dụng vốn và phương án trả nợ.', cite: 'QĐ-TD-098 · v5 · tr.9 · §3.1', cat: 'proc', lvl: 'de', by: 'Nguyễn Lan', at: '14/06 10:42' },
          { k: 'edit', id: 'C-0310', q: 'Thời hạn tối đa của khoản vay vốn lưu động KHDN?', by: 'Nguyễn Lan', at: '13/06 16:20', before: { a: '12 tháng, gia hạn 1 lần tối đa 6 tháng.', cite: 'QĐ-TD-098 · v4 · tr.6 · §2.4', lvl: 'de' }, after: { a: '12 tháng; gia hạn tối đa 2 lần, mỗi lần không quá 6 tháng.', cite: 'QĐ-TD-098 · v5 · tr.6 · §2.4', lvl: 'tb' } },
          { k: 'del', id: 'C-0298', q: 'Lãi phạt chậm trả gốc của khoản vay KHDN được tính thế nào?', a: '150% lãi suất cho vay trong hạn trên dư nợ gốc quá hạn.', by: 'Nguyễn Lan', at: '13/06 16:05', note: 'Quy định lãi phạt đã được thay thế' }]
      } };
      VD['DS-02'] = {
        'v1>v2': [
          { k: 'add', id: 'C-0230', q: 'Hạn mức thẻ tín dụng được nâng tạm thời tối đa bao nhiêu?', a: 'Tối đa 30% hạn mức hiện tại trong 30 ngày.', cite: 'Biểu phí thẻ · v7 · tr.8 · §4', cat: 'cond', lvl: 'tb', by: 'Hệ thống (log truy vấn)', at: '29/05 02:10' },
          { k: 'add', id: 'C-0231', q: 'Phí chuyển đổi ngoại tệ khi thanh toán thẻ ở nước ngoài?', a: '3% giá trị giao dịch.', cite: 'Biểu phí thẻ · v7 · tr.3 · §1.5', cat: 'fact', lvl: 'de', by: 'Hệ thống (log truy vấn)', at: '29/05 02:10' },
          { k: 'edit', id: 'C-0207', q: 'Phí thường niên thẻ tín dụng Classic là bao nhiêu?', by: 'Nguyễn Lan', at: '27/05 15:00', before: { a: '299.000 đồng/năm cho thẻ chính.', cite: 'Biểu phí thẻ · v6 · tr.2 · §1.1' }, after: { a: '399.000 đồng/năm cho thẻ chính; thẻ phụ miễn phí năm đầu.', cite: 'Biểu phí thẻ · v7 · tr.2 · §1.1' } },
          { k: 'del', id: 'C-0199', q: 'Ưu đãi hoàn tiền 5% chi tiêu siêu thị áp dụng đến khi nào?', a: 'Đến 31/12/2024 cho thẻ Platinum.', by: 'Nguyễn Lan', at: '05/06 10:00', note: 'Chương trình ưu đãi 2024 đã kết thúc' }],
        'v2>v3': [
          { k: 'add', st: 'pending', id: 'C-0236', q: 'Phí chậm thanh toán dư nợ thẻ tín dụng tính thế nào?', a: '4% số tiền chậm thanh toán, tối thiểu 99.000 đồng.', cite: 'Biểu phí thẻ · v7 · tr.4 · §2.1', cat: 'fact', lvl: 'de', by: 'Nguyễn Lan', at: '13/06 09:40' },
          { k: 'edit', id: 'C-0230', q: 'Hạn mức thẻ tín dụng được nâng tạm thời tối đa bao nhiêu?', by: 'Nguyễn Lan', at: '13/06 09:10', before: { a: 'Tối đa 30% hạn mức hiện tại trong 30 ngày.' }, after: { a: 'Tối đa 50% hạn mức hiện tại trong 30 ngày, thẻ hoạt động từ 6 tháng.' } },
          { k: 'del', id: 'C-0231', q: 'Phí chuyển đổi ngoại tệ khi thanh toán thẻ ở nước ngoài?', a: '3% giá trị giao dịch.', by: 'Nguyễn Lan', at: '13/06 09:30', note: 'Trùng với C-0203 sau khi gộp biểu phí giao dịch quốc tế' }]
      };
      VD['DS-03'] = {
        'v1>v2': [
          { k: 'add', id: 'C-0406', q: 'Khách hàng rủi ro cao cần áp dụng biện pháp tăng cường (EDD) nào?', a: 'Xác minh nguồn tiền, phê duyệt cấp quản lý và giám sát giao dịch tăng cường.', cite: 'Chính sách KYC/AML · v5.2 · tr.14 · §6.1', cat: 'proc', lvl: 'tb', by: 'Trần Hải', at: '20/05 10:00' },
          { k: 'add', id: 'C-0408', q: 'Thời hạn báo cáo giao dịch đáng ngờ kể từ khi phát hiện là bao lâu?', a: 'Trong 3 ngày làm việc.', cite: 'Chính sách KYC/AML · v5.2 · tr.25 · §9.6', cat: 'fact', lvl: 'de', by: 'Trần Hải', at: '20/05 10:05' },
          { k: 'edit', id: 'C-0144', q: 'Hồ sơ KYC của khách hàng cá nhân phải lưu trữ bao lâu sau khi đóng tài khoản?', by: 'Trần Hải', at: '28/05 09:00', before: { a: 'Tối thiểu 5 năm kể từ ngày đóng tài khoản.', cite: 'Chính sách KYC/AML · v4 · tr.30 · §11.2' }, after: { a: 'Tối thiểu 10 năm kể từ ngày đóng tài khoản hoặc kết thúc giao dịch.', cite: 'Chính sách KYC/AML · v5.2 · tr.31 · §11.2' } },
          { k: 'del', id: 'C-0139', q: 'Khách hàng dùng CMND 9 số có mở tài khoản được không?', a: 'Được, nếu CMND còn hạn sử dụng.', by: 'Nguyễn Lan', at: '29/05 14:00', note: 'CMND 9 số không còn được chấp nhận' }],
        'v2>v3': [
          { k: 'add', st: 'pending', id: 'C-0401', q: 'eKYC cho người nước ngoài cần giấy tờ gì?', a: 'Hộ chiếu còn hiệu lực và thị thực hoặc thẻ tạm trú còn hạn tối thiểu 6 tháng.', cite: 'Hướng dẫn eKYC · v3', cat: 'cond', lvl: 'tb', by: 'Hoàng Vy', at: 'Hôm qua 16:20' },
          { k: 'add', st: 'pending', id: 'C-0405', q: 'So sánh yêu cầu định danh khách hàng cá nhân khi mở tài khoản tại quầy và qua eKYC', a: 'Tại quầy: CCCD gắn chip + đối chiếu trực tiếp. eKYC: CCCD gắn chip + sinh trắc, hạn mức 100 triệu đồng/tháng.', cite: 'Hướng dẫn eKYC · v3 · tr.4 · §2.1', cat: 'cmp', lvl: 'kho', by: 'Hệ thống (log truy vấn)', at: 'Hôm qua 02:10' },
          { k: 'edit', st: 'pending', id: 'C-0403', q: 'Khi nào phải cập nhật lại hồ sơ KYC của khách hàng doanh nghiệp?', by: 'Trần Hải', at: 'Hôm qua 17:05', before: { a: '12 tháng/lần với khách hàng rủi ro cao, 24 tháng/lần với rủi ro thấp.' }, after: { a: '12 tháng/lần với khách hàng rủi ro cao, 24 tháng/lần với rủi ro thấp, và ngay khi thay đổi người đại diện theo pháp luật.' }, note: 'Bản sửa chờ duyệt trong Thay đổi & Phê duyệt' }]
      };
      VD['DS-05'] = {
        'v1>v2': [
          { k: 'add', id: 'C-0240', q: 'Mã lỗi T24 E-3305 khi tất toán tài khoản tiết kiệm nghĩa là gì?', a: 'Tài khoản còn lệnh phong tỏa; giải tỏa trước rồi tất toán lại.', cite: 'Hướng dẫn T24 – Hạch toán · v9 · tr.27 · §6.3', cat: 'fact', lvl: 'tb', by: 'Vũ Đức', at: '05/06 10:00' },
          { k: 'add', id: 'C-0241', q: 'Các bước mở lại batch COB bị dừng giữa chừng?', a: 'Kiểm tra log COB, xử lý job lỗi, chạy lại từ bước bị dừng và xác nhận số dư cuối ngày.', cite: 'Hướng dẫn T24 – Hạch toán · v9 · tr.40 · §9', cat: 'proc', lvl: 'kho', by: 'Vũ Đức', at: '05/06 10:20' },
          { k: 'edit', id: 'C-0225', q: 'Mã lỗi E-2107 khi mở tài khoản trên T24 nghĩa là gì?', by: 'Vũ Đức', at: '05/06 11:00', before: { a: 'CIF chưa hoàn tất KYC; cập nhật KYC trước khi mở tài khoản.', cite: 'Hướng dẫn T24 – Hạch toán · v8 · tr.12 · §3.4' }, after: { cite: 'Hướng dẫn T24 – Hạch toán · v9 · tr.13 · §3.4', lvl: 'de' } },
          { k: 'del', id: 'C-0219', q: 'Mã lỗi E-1001 trên T24 R17 xử lý thế nào?', a: 'Khởi động lại phiên làm việc T24 và đăng nhập lại.', by: 'Vũ Đức', at: '05/06 11:30', note: 'T24 R17 đã nâng cấp lên R22' }]
      };
      VD['DS-06'] = {
        'v1>v2': [
          { k: 'add', id: 'C-0520', q: 'Bật đăng nhập bằng sinh trắc học trên app thế nào?', a: 'Vào Cài đặt › Bảo mật › Đăng nhập sinh trắc, xác thực mật khẩu và quét vân tay/khuôn mặt.', cite: 'FAQ Ngân hàng số · v13 · mục #9', cat: 'proc', lvl: 'de', by: 'Hoàng Vy', at: '28/05 10:00' },
          { k: 'edit', id: 'C-0511', q: 'Hạn mức chuyển tiền qua app mỗi ngày là bao nhiêu?', by: 'Nguyễn Lan', at: '01/06 09:30', before: { a: '300 triệu đồng/ngày với xác thực OTP SMS.', cite: 'FAQ Ngân hàng số · v12 · mục #15' }, after: { a: '500 triệu đồng/ngày với Smart OTP; 100 triệu đồng/ngày với OTP SMS.', cite: 'FAQ Ngân hàng số · v13 · mục #15' } },
          { k: 'del', id: 'C-0505', q: 'Phí duy trì dịch vụ SMS Banking hàng tháng?', a: '11.000 đồng/tháng.', by: 'Nguyễn Lan', at: '02/06 15:00', note: 'Đã chuyển sang dataset phí dịch vụ' }],
        'v2>v3': [
          { k: 'add', id: 'C-0525', q: 'Chuyển tiền nhanh 24/7 có mất phí không?', a: 'Miễn phí với giao dịch dưới 500.000 đồng; trên mức này theo biểu phí hiện hành.', cite: 'FAQ Ngân hàng số · v14 · mục #21', cat: 'fact', lvl: 'de', by: 'Hoàng Vy', at: '08/06 10:00' },
          { k: 'edit', id: 'C-0510', q: 'Kích hoạt Smart OTP trên thiết bị mới thế nào?', by: 'Hoàng Vy', at: '09/06 14:00', before: { a: 'Đăng nhập app, xác thực CCCD gắn chip, nhận OTP SMS và đặt mã PIN Smart OTP.' }, after: { a: 'Đăng nhập app, xác thực khuôn mặt với CCCD gắn chip, nhận OTP SMS và đặt mã PIN Smart OTP; thiết bị cũ tự hủy kích hoạt.' } },
          { k: 'del', id: 'C-0508', q: 'Ứng dụng có hỗ trợ đăng nhập trên 2 thiết bị cùng lúc không?', a: 'Có, tối đa 2 thiết bị đã đăng ký.', by: 'Hoàng Vy', at: '09/06 15:00', note: 'Chính sách mới: 1 thiết bị tin cậy' }],
        'v3>v4': [
          { k: 'add', st: 'pending', id: 'C-0530', q: 'Quên mật khẩu ứng dụng ngân hàng số thì làm gì?', a: 'Chọn Quên mật khẩu, xác thực CCCD gắn chip và OTP SMS, rồi đặt mật khẩu mới.', cite: 'FAQ Ngân hàng số · v14 · mục #5', cat: 'proc', lvl: 'de', by: 'Nguyễn Lan', at: '15/06 09:05' },
          { k: 'del', id: 'C-0515', q: 'Thời gian xử lý tra soát giao dịch chuyển tiền lỗi?', a: 'Tối đa 5 ngày làm việc.', by: 'Nguyễn Lan', at: '15/06 08:50', note: 'Gộp vào câu tra soát mới theo quy định 2025' }]
      };
      // per-pair mini history (newest first)
      var QH = {
        'C-0187': [{ v: 'v2', act: 'Sửa câu trả lời, trích dẫn', by: 'Trần Hải', at: '05/06 10:12', rv: 'Nguyễn Lan · 06/06 14:30', ds: 'DS-01@v3' }, { v: 'v1', act: 'Tạo', by: 'Trần Hải', at: '10/05 09:20', rv: 'Nguyễn Lan · 12/05 16:00', ds: 'DS-01@v1' }],
        'C-0310': [{ v: 'v2', act: 'Sửa câu trả lời, trích dẫn, độ khó', by: 'Nguyễn Lan', at: '13/06 16:20', rv: 'Trần Minh Tuấn · 14/06 09:30', ds: 'bản nháp v4' }, { v: 'v1', act: 'Tạo', by: 'Nguyễn Lan', at: '05/06 11:00', rv: 'Trần Minh Tuấn · 07/06 09:05', ds: 'DS-01@v3' }],
        'C-0298': [{ v: '—', act: 'Xóa khỏi bản nháp', by: 'Nguyễn Lan', at: '13/06 16:05', ds: 'bản nháp v4' }, { v: 'v1', act: 'Tạo', by: 'Nguyễn Lan', at: '08/05 09:30', rv: 'Trần Minh Tuấn · 10/05 15:00', ds: 'DS-01@v1' }],
        'C-0150': [{ v: '—', act: 'Xóa', by: 'Nguyễn Lan', at: '11/06 09:00', ds: 'DS-01@v3' }, { v: 'v1', act: 'Tạo', by: 'Nguyễn Lan', at: '09/05 14:00', rv: 'Trần Minh Tuấn · 11/05 10:00', ds: 'DS-01@v1' }],
        'C-0262': [{ v: 'v1', act: 'Tạo', by: 'Trần Hải', at: '22/05 10:00', rv: 'Nguyễn Lan · 24/05 09:10', ds: 'DS-01@v2' }],
        'C-0312': [{ v: 'v1', act: 'Tạo', by: 'Trần Hải', at: '08/06 15:20', rv: 'Nguyễn Lan · 10/06 08:40', ds: 'DS-01@v3' }],
        'C-0315': [{ v: 'v1', act: 'Tạo (Generate)', by: 'Nguyễn Lan', at: '14/06 10:42', rv: 'Chờ duyệt · RV-1041', ds: 'bản nháp v4' }],
        'C-0316': [{ v: 'v1', act: 'Tạo (Generate)', by: 'Nguyễn Lan', at: '14/06 10:42', rv: 'Chờ duyệt · RV-1041', ds: 'bản nháp v4' }]
      };
      var curVer = null;
      function pad(n) { return (n < 10 ? '0' : '') + n; }
      function now() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
      function today() { var d = new Date(); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
      function vNum(v) { return parseInt(String(v || '').slice(1), 10) || 0; }
      function lastPub(id) { var p = VERS[id].pub; return p.length ? p[p.length - 1] : null; }
      function pubOf(id, v) { return VERS[id].pub.filter(function (x) { return x.v === v; })[0] || null; }
      function draftKey(id) { return VERS[id].draft.v; }
      function allKeys(id) { return VERS[id].pub.map(function (x) { return x.v; }).concat([draftKey(id)]); }
      function isDraft(id, v) { return v === draftKey(id); }
      function hasChg(d) { return d.add + d.edit + d.del + (d.delPend || 0) > 0; }
      function okChg(d) { return d.addOk + d.editOk + d.del > 0; }
      function pubReason(id) {
        var lp = lastPub(id), d = VERS[id].draft, r = dsRow(id);
        if (!lp) return num(r && r.querySelector('[data-cnt="ok"]')) > 0 ? null : T('q.ver.noApproved', 'Chưa có câu hỏi đã duyệt');
        if (!hasChg(d)) return T('q.ver.noChg', 'Không có thay đổi so với {v}', { v: lp.v });
        if (!okChg(d)) return T('q.ver.pendingOnly', 'Thay đổi chưa được duyệt; chỉ câu đã duyệt mới được kích hoạt');
        return null;
      }
      function autosaveText(d) { return T('q.ver.autosaved', 'Đã tự động lưu {t}', { t: d.at }); }
      function syncPublish(id) {
        var r = dsRow(id), d = VERS[id].draft, lp = lastPub(id), why = pubReason(id), bs = r ? [].slice.call(r.querySelectorAll('[data-ds-publish]')) : [];
        bs.forEach(function (b) { b.hidden = !!lp && !hasChg(d); });
        if (curDs === id && dsDet.querySelector('[data-ds-publish]')) bs.push(dsDet.querySelector('[data-ds-publish]'));
        bs.forEach(function (b) {
          // one approval verb set (Gửi duyệt / Duyệt / Kích hoạt / Từ chối): a dataset version goes live = Kích hoạt
          b.textContent = T('qrk.activateV', 'Kích hoạt {v}', { v: d.v });
          b.setAttribute('data-title', T('qrk.activateTitle', 'Kích hoạt {id} {v}?', { id: id, v: d.v }));
          b.setAttribute('data-body', T('q.ver.pubBody', 'Chỉ câu hỏi đã duyệt được đưa vào {v}. {v} không sửa được và được dùng cho job đánh giá (nội bộ).', { v: d.v }));
          b.setAttribute('data-toast', T('qrk.activateToast', 'Đã kích hoạt {id} · {v}', { id: id, v: d.v }));
          if (why) b.setAttribute('data-bulk-off', why); else b.removeAttribute('data-bulk-off');
          // the reason a version can't go live is visible next to the button, not only in its tooltip
          var cell = b.parentNode, wy = cell && cell.querySelector(':scope > .q-pub-why');
          if (why && !b.hidden) { if (!wy) { wy = document.createElement('span'); wy.className = 'q-pub-why'; cell.appendChild(wy); } wy.textContent = why; }
          else if (wy) wy.remove();
        });
        applyRoleGates();
      }
      function runTag(id, v) { var lp = lastPub(id); if (v && !isDraft(id, v)) return '@' + v; return lp ? '@' + lp.v : ' (draft)'; }
      function rowVerSync(id) {
        var r = dsRow(id); if (!r) return;
        var lp = lastPub(id), d = VERS[id].draft, chip = r.querySelector('.chip-st'), sub = r.querySelector('[data-ds-versub]');
        var txt = lp ? lp.v + ' · published' : T('q.ver.draftChip', 'bản nháp'), cls = lp ? 'chip chip-success chip-st' : 'chip chip-neutral chip-st';
        if (chip) { chip.textContent = txt; chip.className = cls; }
        r.setAttribute('data-f-ver', txt); r.setAttribute('data-c-ver', cls);
        if (lp) r.setAttribute('data-pub', lp.v); else r.removeAttribute('data-pub');
        if (sub) {
          if (!sub.hasAttribute('data-base')) sub.setAttribute('data-base', sub.textContent.split(' · ')[0]);
          var date = lp ? lp.at.split(' ')[0] : sub.getAttribute('data-base');
          r.setAttribute('data-f-verdate', date);
          if (lp && hasChg(d)) { sub.textContent = date + T('q.ver.subDraft', ' · nháp {v}', { v: d.v }); }
          else { sub.textContent = date; sub.removeAttribute('title'); }
        }
      }
      function kpiSync() {}
      function verCell(td, pv, chg) {
        td.textContent = ''; var s = document.createElement('span'); s.textContent = pv; td.appendChild(s);
        if (chg) { var c = document.createElement('span'); c.className = 'chip q-chg-chip ' + ({ add: 'chip-success', edit: 'chip-warning', del: 'chip-error' })[chg]; c.textContent = ({ add: T('q.ver.chipAdd', 'Thêm'), edit: T('q.ver.chipEdit', 'Sửa'), del: T('q.ver.chipDel', 'Xóa') })[chg]; td.appendChild(c); }
      }
      function syncUrl(id) {
        var u = new URLSearchParams(location.search); u.set('tab', 'datasets'); u.delete('q');
        if (id) u.set('ds', id); else u.delete('ds');
        if (id && curVer && VERS[id] && !isDraft(id, curVer)) u.set('v', curVer); else u.delete('v');
        try { history.replaceState(null, '', '?' + u.toString()); } catch (e) {}
      }
      function syncPerm() {
        var r = curDs && dsRow(curDs); if (!r) return;
        var ok = r.hasAttribute('data-stw');
        dsDet.querySelectorAll('[data-ds-add]').forEach(function (b) {
          b.setAttribute('data-roles-disable', ok ? '' : 'steward');
          b.setAttribute('data-reason', 'Cần được phân quyền quản lý bộ câu hỏi');
        });
        var ro = !isDraft(curDs, curVer);
        dsDet.querySelectorAll('[data-ds-permhint]').forEach(function (h) { h.hidden = ro || granted(r); });
        gateEditMode();
        syncPublish(curDs);
        bulkSync(dsDet);
      }
      function fillHead(r) {
        var id = r.getAttribute('data-id'), g = function (k) { return r.getAttribute('data-f-' + k) || ''; };
        var nm = dsDet.querySelector('[data-dsh="name"]'); nm.textContent = id + ' · ' + g('name'); nm.title = nm.textContent;
        dsDet.querySelector('[data-dsh="kb"]').textContent = g('kbname');
        var srcL = r.querySelector('td:first-child .text-xs'); dsDet.querySelector('[data-dsh="src"]').textContent = srcL ? srcL.textContent.replace(/^[^:]*:\s*/, '') : g('srcname'); // the row's translated "Nguồn: …" line
        var lp = lastPub(id);
        // no banner: the add/upload toast tells where new questions go
        dsDet.setAttribute('data-draft-note', lp ? T('q.ver.draftNote', ' · lưu vào bản nháp {d}, {p} giữ nguyên', { d: draftKey(id), p: lp.v }) : '');
        renderVerSel(id);
        setVer(id, curVer && allKeys(id).indexOf(curVer) > -1 ? curVer : draftKey(id), true);
      }
      function renderVerSel(id) {
        var sel = dsDet.querySelector('#eq-ver'); sel.textContent = '';
        allKeys(id).slice().reverse().forEach(function (v) {
          var o = document.createElement('option'), p = pubOf(id, v); o.value = v;
          o.textContent = p ? T('q.ver.pubOpt', '{v} · published {d}', { v: v, d: p.at.split(' ')[0] }) : T('q.ver.draftOpt', '{v} · bản nháp (đang sửa)', { v: v });
          sel.appendChild(o);
        });
      }
      function setVer(id, v, silent) {
        var r = dsRow(id), tb = dsTable(id); if (!r || !tb) return;
        if (qEditOn) setEditMode(false);
        curVer = v;
        var sel = dsDet.querySelector('#eq-ver'), ro = !isDraft(id, v);
        sel.value = v; sel.classList.toggle('is-pub', ro);
        if (ro) { dsDet.setAttribute('data-ds-ro', ''); evSide.setAttribute('data-ds-ro', ''); } else { dsDet.removeAttribute('data-ds-ro'); evSide.removeAttribute('data-ds-ro'); }
        dsDet.querySelectorAll('[data-ds-add]').forEach(function (b) { if (!b.hasAttribute('data-bulk-btn')) b.hidden = ro; });
        dsDet.querySelectorAll('[data-ds-permhint]').forEach(function (h) { h.hidden = ro || granted(r); });
        // counts are the dataset's, whatever version is viewed (FE datasets-panel.tsx)
        var c = { total: r.querySelector('[data-cnt="total"]').textContent, ok: r.querySelector('[data-cnt="ok"]').textContent, pending: r.querySelector('[data-cnt="pending"]').textContent };
        ['total', 'ok', 'pending'].forEach(function (k) { dsDet.querySelector('[data-dsh="' + k + '"]').textContent = c[k]; });
        var selRow = tb.querySelector('[data-qrow].selected'), selCase = selRow && selRow.getAttribute('data-f-title');
        if (!dsDet.hidden) {
          qfRun(dsDet);
          var same = selCase && [].filter.call(tb.querySelectorAll('[data-qrow]'), function (x) { return !x.hidden && x.getAttribute('data-f-title') === selCase; })[0];
          if (!dsTab.hidden) showTableOrEmpty(tb, same ? same.getAttribute('data-id') : null);
        }
        syncPublish(id);
        if (!silent) syncUrl(id);
      }
      function dsTouch(id, kind, n) {
        var d = VERS[id].draft;
        if (kind === 'add') d.add += n; else if (kind === 'edit') d.edit += 1;
        d.at = now(); d.by = BY[getRole()];
        rowVerSync(id); syncPublish(id);
      }
      function vdKey(id) { var lp = lastPub(id); return (lp ? lp.v : '') + '>' + draftKey(id); }
      function vdPush(id, it) { VD[id] = VD[id] || {}; var k = vdKey(id); (VD[id][k] = VD[id][k] || []).push(it); }
      function doPublish(id) {
        var x = VERS[id], d = x.draft, r = dsRow(id), lp = lastPub(id), tb = dsTable(id); if (!r) return;
        var tot = num(r.querySelector('[data-cnt="total"]')), pend = num(r.querySelector('[data-cnt="pending"]')), ok = tot - pend, nx = 'v' + (vNum(d.v) + 1), dv = d.v;
        var pEdit = Math.max(0, d.edit - d.editOk);
        x.pub.push({ v: dv, at: today() + ' ' + now(), by: BY[getRole()], total: ok, ok: ok, sum: lp ? { a: d.addOk, e: d.editOk, d: d.del } : { a: ok, e: 0, d: 0 }, init: !lp, runs: [] });
        if (tb) tb.querySelectorAll('[data-qrow]').forEach(function (tr) {
          var vin = ' ' + (tr.getAttribute('data-vin') || '') + ' ';
          if (vin.indexOf(' ' + dv + ' ') < 0) return;
          if (tr.classList.contains('q-row-del')) { tr.remove(); return; }
          if (tr.getAttribute('data-st') === 'pending') { tr.setAttribute('data-vin', vin.replace(' ' + dv + ' ', ' ' + nx + ' ').trim()); return; }
          tr.setAttribute('data-vin', (vin.trim() + ' ' + nx).trim());
          if (!tr.hasAttribute('data-pedit')) { var ch = tr.querySelector('.q-chg-chip'); if (ch) ch.remove(); }
        });
        VD[id] = VD[id] || {};
        var step = VD[id][(lp ? lp.v : '') + '>' + dv] || [];
        VD[id][(lp ? lp.v : '') + '>' + dv] = step.filter(function (it) { return it.st !== 'pending'; });
        VD[id][dv + '>' + nx] = step.filter(function (it) { return it.st === 'pending'; });
        x.draft = { v: nx, at: now(), by: BY[getRole()], add: pend, addOk: 0, edit: pEdit, editOk: 0, del: 0 };
        rowVerSync(id); kpiSync(); syncPublish(id);
        if (curDs === id && !dsDet.hidden) { curVer = nx; fillHead(r); syncUrl(id); }
      }
      document.addEventListener('ecp-qapply', function (e) {
        var b = e.detail && e.detail.btn; if (!b) return;
        if (b.hasAttribute('data-ds-publish')) { var tr = b.closest('tr[data-ds-row]'); var id = tr ? tr.getAttribute('data-id') : curDs; if (id && VERS[id]) doPublish(id); }
        else if (b.hasAttribute('data-ds-edit') && evSide.contains(b)) dsEdit();
      });
      evSide.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ds-edit]:not([data-q-confirm]):not([data-dlg-open])');
        if (b && !b.disabled) dsEdit();
      });
      function dsEdit(rowArg) {
        if (!curDs || dsDet.hidden) return;
        var tb = dsTable(curDs), sel = rowArg || (tb && tb.querySelector('[data-qrow].selected')); if (!sel) return;
        var cs = sel.getAttribute('data-f-title'), first = !sel.querySelector('.q-chg-chip');
        if (first) {
          sel.setAttribute('data-pedit', '');
          var td = sel.lastElementChild; verCell(td, sel.getAttribute('data-pv') || 'v1', 'edit');
          vdPush(curDs, { k: 'edit', st: 'pending', id: cs, q: (sel.querySelector('.q-qcell b') || sel).textContent, by: BY[getRole()], at: now(), note: T('q.ver.editNote', 'Bản sửa chờ duyệt trong Thay đổi & Phê duyệt') });
        }
        (QH[cs] = QH[cs] || []).unshift({ v: sel.getAttribute('data-pv') || 'v1', act: T('q.ver.actEdit', 'Mở bản sửa'), by: BY[getRole()], at: T('q.ver.justNow', 'Vừa xong'), rv: T('q.ver.pendingRv', 'Chờ duyệt'), ds: T('q.ver.draftOf', 'bản nháp {v}', { v: draftKey(curDs) }) });
        dsTouch(curDs, first ? 'edit' : 'touch');
      }
      // ---- inline edit of a Q&A pair (question/answer/category/difficulty) via #dlg-q-edit ----
      // The side panel's "Sửa" button opens the edit form instead of the plain confirm dialog,
      // so the user can actually change the question + answer text (mockup, session-only).
      var qed = document.getElementById('dlg-q-edit');
      function qeReadonlyNow() { return !!curDs && !isDraft(curDs, curVer); }
      // retrofit the freshly-injected side panel "Sửa" button to open the edit form
      evSide.addEventListener('ecp-qopen', function (e) {
        var r = e.detail && e.detail.row; if (!r || !curDs || dsDet.hidden || !r.closest('[data-ds-table]')) return;
        var btn = evSide.querySelector('.job-side-foot [data-ds-edit]'); if (!btn) return;
        btn.removeAttribute('data-q-confirm');
        btn.setAttribute('data-dlg-open', 'dlg-q-edit');
        btn.removeAttribute('data-title'); btn.removeAttribute('data-body'); btn.removeAttribute('data-toast');
      });
      function fillEditDlg(d) {
        var tb = curDs && dsTable(curDs), sel = tb && tb.querySelector('[data-qrow].selected'); if (!sel) return;
        var cs = sel.getAttribute('data-f-title');
        d.querySelector('[data-qe-case]').textContent = cs || '';
        var qb = sel.querySelector('.q-qcell b'), aEl = sel.querySelector('.q-qcell .text-xs');
        var aTxt = aEl ? aEl.textContent.replace(/^Đáp án:\s*/, '') : '';
        d.querySelector('#qe-q').value = qb ? qb.textContent : '';
        d.querySelector('#qe-a').value = aTxt;
        d.querySelector('#qe-cat').value = sel.getAttribute('data-cat') || 'fact';
        d.querySelector('#qe-lvl').value = sel.getAttribute('data-lvl') || 'tb';
        fieldErr(d.querySelector('#qe-q').closest('.field'), '');
        fieldErr(d.querySelector('#qe-a').closest('.field'), '');
      }
      // Shared row-update routine used by both #dlg-q-edit (if opened) and inline Edit mode.
      // Updates the row's displayed Q&A/category/difficulty, keeps side-panel templates in
      // sync, and (when the content actually changed) marks the row edited via dsEdit()
      // (adds the "Sửa" change chip + version diff + autosave indicator). Returns true when
      // a change was committed. Does NOT show the toast — the caller decides.
      function applyRowEdit(sel, q, a, cat, lvl) {
        if (!sel) return false;
        var qcell = sel.querySelector('.q-qcell');
        var qLine = qcell && qcell.querySelector('.job-ell:first-child'), qB = qLine && qLine.querySelector('b');
        var aLine = qcell && qcell.querySelector('.text-xs');
        var prevQ = qB ? qB.textContent : '';
        var prevA = aLine ? aLine.textContent.replace(/^Đáp án:\s*/, '') : '';
        var prevCat = sel.getAttribute('data-cat') || 'fact', prevLvl = sel.getAttribute('data-lvl') || 'tb';
        var changed = q !== prevQ || a !== prevA || cat !== prevCat || lvl !== prevLvl;
        // 1) update the row's displayed question + answer
        if (qB) qB.textContent = q;
        if (qLine) qLine.title = q;
        if (aLine) { aLine.textContent = 'Đáp án: ' + a; aLine.title = a; }
        // 2) update category cell + difficulty chip
        var cells = sel.children, catCell = cells[2] && cells[2].querySelector('.job-ell'), lvlChip = cells[3] && cells[3].querySelector('.chip');
        if (catCell) catCellSet(catCell, cat);
        sel.setAttribute('data-cat', cat);
        if (lvlChip && LVLN[lvl]) lvlChipSet(lvlChip, lvl);
        sel.setAttribute('data-lvl', lvl);
        // 3) update the open side-panel template body (question/answer text) — jobs tab reuse
        var sp = evSide.querySelector('[data-qtpl-slot]'), txts = sp ? sp.querySelectorAll('.q-pair-txt') : [];
        if (txts[0]) txts[0].textContent = q;
        if (txts[1]) txts[1].textContent = a;
        // keep the stored template in sync so re-opening the row shows the edit
        var storedTpl = document.querySelector('template[data-qtpl="' + sel.getAttribute('data-id') + '"]');
        if (storedTpl) { var st = storedTpl.content.querySelectorAll('.q-pair-txt'); if (st[0]) st[0].textContent = q; if (st[1]) st[1].textContent = a; }
        // 4) mark the row as edited ("Sửa" chip + version diff + autosave) — reuse existing dsEdit()
        if (changed) dsEdit(sel);
        return changed;
      }
      qed.querySelector('#qe-save').addEventListener('click', function () {
        var tb = curDs && dsTable(curDs), sel = tb && tb.querySelector('[data-qrow].selected'); if (!sel) return;
        var qf = qed.querySelector('#qe-q'), af = qed.querySelector('#qe-a');
        var q = qf.value.trim(), a = af.value.trim(), cat = qed.querySelector('#qe-cat').value, lvl = qed.querySelector('#qe-lvl').value;
        var bad = false;
        if (!q) { fieldErr(qf.closest('.field'), 'Nhập câu hỏi'); bad = true; } else fieldErr(qf.closest('.field'), '');
        if (!a) { fieldErr(af.closest('.field'), 'Nhập câu trả lời'); bad = true; } else fieldErr(af.closest('.field'), '');
        if (bad) { (q ? af : qf).focus(); return; }
        var cs = sel.getAttribute('data-f-title');
        applyRowEdit(sel, q, a, cat, lvl);
        qed.close();
        toast(T('q.ver.editSaved', 'Đã lưu bản sửa {id} · Chờ duyệt', { id: cs }));
      });
      dsDet.querySelector('#eq-ver').addEventListener('change', function (e) { if (curDs) setVer(curDs, e.target.value); });
      function resetFilters() {
        dsDet.querySelectorAll('[data-qf-dim]:not([data-qf-keep])').forEach(function (g) {
          if (g.tagName === 'SELECT') g.value = '';
          else g.querySelectorAll('[data-qf-val]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-qf-val') === 'all')); });
        });
        dsDet.querySelectorAll('input[data-qf-search]').forEach(function (i) { i.value = ''; });
        if (hdrQs) hdrQs.value = '';
      }
      // header quick-search filters questions while the detail view is open
      var hdrQs = document.getElementById('qs'), hdrPh = hdrQs && hdrQs.getAttribute('placeholder');
      function hdrSearch(on) {
        if (!hdrQs) return;
        if (on) { dsDet.setAttribute('data-qf-ext', 'qs'); hdrQs.setAttribute('placeholder', 'Tìm câu hỏi, câu trả lời, tag, tài liệu…'); }
        else { dsDet.removeAttribute('data-qf-ext'); hdrQs.value = ''; hdrQs.setAttribute('placeholder', hdrPh); }
      }
      if (hdrQs) hdrQs.addEventListener('input', function () { if (curDs && !dsDet.hidden) qfRun(dsDet); });
      function showTableOrEmpty(tb, qid) {
        var rows = tb.querySelectorAll('[data-qrow]'), has = rows.length > 0;
        dsDet.querySelectorAll('[data-ds-part]').forEach(function (p) { p.hidden = !has; });
        dsDet.querySelector('[data-ds-empty]').hidden = has;
        tb.hidden = !has;
        // dataset detail no longer uses the right-side panel — keep it closed so the
        // question table spans the full content width (the jobs tab manages it separately).
        evSplit.classList.add('side-closed');
        gateEditMode();
        qSelect(tb, null);
      }
      // the question code opens the pair in the side panel (FE datasets-panel.tsx → SidePanel 'question'); closing clears the row highlight
      dsDet.addEventListener('click', function (e) {
        var b = e.target.closest('[data-q-open]'), r = b && b.closest('[data-qrow]'); if (!r) return;
        qSelect(r.closest('[data-ds-table]'), r);
        var tpl = document.querySelector('template[data-qtpl="' + r.getAttribute('data-id') + '"]');
        evSide.querySelector('[data-qtpl-slot]').innerHTML = tpl ? tpl.innerHTML : '';
        [['title', 'data-f-title'], ['sub', 'data-f-sub']].forEach(function (f) { var el = evSide.querySelector('[data-f="' + f[0] + '"]'); el.textContent = r.getAttribute(f[1]) || ''; el.title = el.textContent; });
        evSplit.classList.remove('side-closed');
      });
      evSide.addEventListener('click', function (e) { if (curDs && e.target.closest('[data-qpanel-close]')) dsDet.querySelectorAll('[data-qrow].selected').forEach(function (x) { x.classList.remove('selected'); }); });
      // mark one row selected within a dataset table (no panel to open anymore)
      function qSelect(tb, r) {
        tb.querySelectorAll('[data-qrow].selected').forEach(function (x) { x.classList.remove('selected'); });
        if (r) r.classList.add('selected');
      }
      // ---- inline Edit mode: toggled from the bulk bar, edits all editable rows in place ----
      // A single "Sửa" ↔ "Xong" toggle (data-ds-editmode) turns the whole question table of
      // the open dataset into an inline editor. Each editable row swaps its question + answer
      // text for inputs and its category + difficulty for selects (styled like #dlg-q-edit).
      // Committing ("Xong") reuses applyRowEdit() so a changed row gets the "Sửa" change chip,
      // version diff, autosave indicator and toast — the same pipeline as the old dialog edit.
      var qEditOn = false;
      var editBtn = dsDet.querySelector('[data-ds-editmode]');
      // A row is editable in Edit mode when it is a normal (non pending-removal, non-removed)
      // row — matching the gating the per-row edit button used before.
      function rowEditable(tr) {
        return !tr.classList.contains('q-row-del') && tr.getAttribute('data-st') !== 'delpend';
      }
      // Edit mode is available only on a draft (editable) version and when the role has
      // permission (reuses isDraft + granted, consistent with per-row edit / bulk delete).
      function editAvailable() {
        var r = curDs && dsRow(curDs);
        return !!r && isDraft(curDs, curVer) && granted(r);
      }
      // reflect availability on the toggle (hidden on read-only like bulk delete, disabled
      // with a reason when the role lacks permission)
      function gateEditMode() {
        if (!editBtn) return;
        var r = curDs && dsRow(curDs), ro = !curDs || !isDraft(curDs, curVer);
        if (ro && qEditOn) setEditMode(false);
        var noPerm = r && !r.hasAttribute('data-stw') && getRole() === 'steward';
        // keep the role gate attribute in sync and re-apply the disabled state so the
        // toggle is unavailable for Steward without permission (same pipeline as bulk delete)
        editBtn.setAttribute('data-roles-disable', noPerm ? 'steward' : '');
        setGateDisabled(editBtn, gateReason(editBtn));
        if (noPerm && qEditOn) setEditMode(false);
        // read-only versions additionally hide the whole .q-bulk via CSS ([data-ds-ro])
      }
      function startRowEdit(tr) {
        if (tr.__editing) return;
        var qcell = tr.querySelector('.q-qcell'); if (!qcell) return;
        var qLine = qcell.querySelector('.job-ell:first-child'), qB = qLine && qLine.querySelector('b');
        var aLine = qcell.querySelector('.text-xs');
        var q = qB ? qB.textContent : '';
        var a = aLine ? aLine.textContent.replace(/^Đáp án:\s*/, '') : '';
        var cat = tr.getAttribute('data-cat') || 'fact', lvl = tr.getAttribute('data-lvl') || 'tb';
        var ed = document.createElement('div'); ed.className = 'q-inline-edit'; ed.setAttribute('data-q-inline', '');
        var qi = document.createElement('textarea'); qi.className = 'input q-inline-q'; qi.rows = 2; qi.value = q;
        qi.setAttribute('aria-label', T('q.ver.fQ', 'Câu hỏi'));
        var ai = document.createElement('textarea'); ai.className = 'input q-inline-a'; ai.rows = 2; ai.value = a;
        ai.setAttribute('aria-label', T('q.ver.fA', 'Câu trả lời'));
        ed.appendChild(qi); ed.appendChild(ai);
        tr.__editView = { q: qLine, a: aLine, qText: q, aText: a, cat: cat, lvl: lvl, qInput: qi, aInput: ai };
        if (qLine) qLine.hidden = true;
        if (aLine) aLine.hidden = true;
        qcell.appendChild(ed);
        // category select
        var catTd = tr.children[2];
        if (catTd) {
          var cdisp = catTd.querySelector('.job-ell'); if (cdisp) cdisp.hidden = true;
          var cs = document.createElement('select'); cs.className = 'input q-inline-sel'; cs.setAttribute('aria-label', T('q.ver.fCat', 'Phân loại'));
          ['fact', 'proc', 'cond', 'cmp', 'multi'].forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = CATN[k]; cs.appendChild(o); });
          cs.value = cat; cs.setAttribute('data-q-inline-cat', '');
          catTd.appendChild(cs); tr.__editView.catSel = cs; tr.__editView.catDisp = cdisp;
        }
        var lvlTd = tr.children[3];
        if (lvlTd) {
          var ldisp = lvlTd.querySelector('.chip'); if (ldisp) ldisp.hidden = true;
          var ls = document.createElement('select'); ls.className = 'input q-inline-sel'; ls.setAttribute('aria-label', T('q.ver.fLvl', 'Độ khó'));
          ['de', 'tb', 'kho'].forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = LVLN[k][0]; ls.appendChild(o); });
          ls.value = lvl; ls.setAttribute('data-q-inline-lvl', '');
          lvlTd.appendChild(ls); tr.__editView.lvlSel = ls; tr.__editView.lvlDisp = ldisp;
        }
        tr.__editing = true;
      }
      // tear down the inline editor for a row; when commit=true, apply changed values
      function endRowEdit(tr, commit) {
        if (!tr.__editing) return false;
        var v = tr.__editView, changed = false;
        if (commit) {
          var q = (v.qInput.value || '').trim() || v.qText;
          var a = (v.aInput.value || '').trim() || v.aText;
          var cat = v.catSel ? v.catSel.value : v.cat;
          var lvl = v.lvlSel ? v.lvlSel.value : v.lvl;
          changed = applyRowEdit(tr, q, a, cat, lvl);
        }
        // remove editor controls, restore display cells
        tr.querySelectorAll('[data-q-inline], [data-q-inline-cat], [data-q-inline-lvl]').forEach(function (n) { n.remove(); });
        if (v.q) v.q.hidden = false;
        if (v.a) v.a.hidden = false;
        if (v.catDisp) v.catDisp.hidden = false;
        if (v.lvlDisp) v.lvlDisp.hidden = false;
        tr.__editing = false; tr.__editView = null;
        return changed;
      }
      function setEditMode(on) {
        if (!editBtn) return;
        if (on && !editAvailable()) return;
        var tb = curDs && dsTable(curDs); if (!tb) { qEditOn = false; return; }
        if (on === qEditOn) return;
        qEditOn = on;
        dsDet.classList.toggle('q-editing', on);
        editBtn.setAttribute('aria-pressed', String(on));
        var lbl = editBtn.querySelector('[data-ds-editmode-lbl]');
        if (lbl) lbl.textContent = on ? T('q.ver.editDone', 'Xong') : T('q.ver.editMode', 'Sửa');
        editBtn.classList.toggle('is-active', on);
        var rows = [].slice.call(tb.querySelectorAll('[data-qrow]'));
        if (on) {
          rows.forEach(function (tr) { if (rowEditable(tr) && !tr.hidden) startRowEdit(tr); });
        } else {
          var anyChanged = false;
          rows.forEach(function (tr) { if (endRowEdit(tr, true)) anyChanged = true; });
          if (anyChanged) toast(T('q.ver.editSavedBulk', 'Đã lưu các bản sửa · Chờ duyệt'));
        }
      }
      if (editBtn) editBtn.addEventListener('click', function (e) {
        if (editBtn.disabled || editBtn.getAttribute('aria-disabled') === 'true') return;
        setEditMode(!qEditOn);
      });
      function dsOpen(id, qid, v) {
        var r = dsRow(id), tb = dsTable(id); if (!r || !tb || !VERS[id]) return;
        curDs = id; curVer = v && allKeys(id).indexOf(v) > -1 ? v : draftKey(id);
        dsList.hidden = true; dsDet.hidden = false;
        evMain.classList.add('q-ds-detail');
        fillHead(r);
        dsDet.querySelectorAll('input.q-check:checked').forEach(function (c) { c.checked = false; });
        dsDet.querySelectorAll('[data-ds-table]').forEach(function (t) { t.hidden = t !== tb; });
        dsDet.setAttribute('data-qf', tb.id);
        qColBuild(tb);
        hdrSearch(true);
        resetFilters();
        dsDet.querySelector('#eq-ver').value = curVer;
        qfRun(dsDet);
        showTableOrEmpty(tb, qid);
        syncPerm();
        syncUrl(id);
      }
      function dsBack() {
        if (qEditOn) setEditMode(false);
        var r = curDs && dsRow(curDs);
        dsDet.hidden = true; dsList.hidden = false; curDs = null; curVer = null;
        dsDet.removeAttribute('data-ds-ro'); evSide.removeAttribute('data-ds-ro');
        hdrSearch(false);
        evMain.classList.remove('q-ds-detail');
        evSplit.classList.add('side-closed');
        syncUrl(null);
        var rb = r && r.querySelector('[data-ds-open]'); if (rb) rb.focus();
      }
      var dsBackBtn = dsDet.querySelector('[data-ds-back]');
      if (dsBackBtn) dsBackBtn.addEventListener('click', function () { if (curDs) dsBack(); });
      dsList.addEventListener('click', function (e) {
        // only the dataset name opens the detail (FE datasets-panel.tsx); the row itself is not clickable
        var b = e.target.closest('[data-ds-open]'), r = b && b.closest('tr[data-ds-row]'); if (r) dsOpen(r.getAttribute('data-id'));
      });
      document.addEventListener('ecp-rolechange', function () { if (curDs) syncPerm(); });
      // tabs: Datasets keeps its own panel state
      document.querySelectorAll('#etab-datasets, #etab-jobs').forEach(function (t) {
        t.addEventListener('click', function () {
          setTimeout(function () {
            var k = t.getAttribute('data-tab');
            evMain.classList.toggle('q-jobs-tab', k === 'jobs');
            if (k !== 'datasets') {
              if (qEditOn) setEditMode(false); evMain.classList.remove('q-ds-detail'); evSide.removeAttribute('data-ds-ro'); if (curDs) { hdrSearch(false); qfRun(dsDet); }
              // never leave the dataset/question panel open over the runs list: reopen the selected run, else close
              var sj = jobsTb.querySelector('tr.selected[data-qrow]'); if (sj && !sj.hidden) qOpen(jobsTb, sj); else evSplit.classList.add('side-closed');
              jobUrl(); return;
            }
            if (!curDs) { evSplit.classList.add('side-closed'); syncUrl(null); return; }
            hdrSearch(true);
            evMain.classList.add('q-ds-detail');
            setVer(curDs, curVer, true);
          }, 0);
        });
      });
      function dsBump(id, n) {
        var r = dsRow(id); if (!r) return;
        var t = r.querySelector('[data-cnt="total"]'), p = r.querySelector('[data-cnt="pending"]');
        t.textContent = fmt(num(t) + n);
        var pv = num(p) + n; p.textContent = ''; var b = document.createElement('b'); b.textContent = fmt(pv); p.appendChild(b);
        if (curDs === id) fillHead(r);
      }
      function addCite(ul, doc, loc) {
        var li = document.getElementById('tpl-cite').content.firstElementChild.cloneNode(true);
        var s = setT(li, 'doc', doc); s.title = doc; setT(li, 'loc', loc);
        li.querySelector('[data-v="open"]').setAttribute('aria-label', 'Mở ' + doc + ' ' + loc);
        ul.appendChild(li);
        return li;
      }
      function addQRow(id, d) {
        var tb = dsTable(id), r = dsRow(id); if (!tb || !r) return null;
        var c = d.c, tr = document.getElementById('tpl-q-row').content.firstElementChild.cloneNode(true);
        tr.setAttribute('data-id', 'q-' + c); tr.setAttribute('data-lvl', d.lvl); tr.setAttribute('data-cat', d.cat);
        tr.setAttribute('data-search', d.tags.replace(/;/g, ' ') + ' ' + d.cites.map(function (x) { return x[0]; }).join(' ') + ' ' + d.by);
        tr.setAttribute('data-f-title', c); tr.setAttribute('data-f-sub', id + ' · ' + r.getAttribute('data-f-name'));
        setT(tr, 'case', c); setT(tr, 'q', d.q); setT(tr, 'a', d.a); setT(tr, 'cat', CATN[d.cat]);
        tr.querySelector('[data-v="qt"]').title = d.q; tr.querySelector('[data-v="at"]').title = d.a; tr.querySelector('[data-v="cat"]').title = CATN[d.cat];
        lvlChipSet(tr.querySelector('[data-v="lvl"]'), d.lvl);
        verCell(tr.lastElementChild, 'v1', 'add'); tr.setAttribute('data-vin', draftKey(id)); tr.setAttribute('data-pv', 'v1');
        tr.querySelector('input.q-check').setAttribute('aria-label', 'Chọn ' + c);
        tb.querySelector('tbody').insertBefore(tr, tb.querySelector('.filter-empty'));
        var tpl = document.createElement('template'); tpl.setAttribute('data-qtpl', 'q-' + c);
        var body = document.getElementById('tpl-q-pair').content.cloneNode(true);
        setT(body, 'rv', d.rv); setT(body, 'q', d.q); setT(body, 'a', d.a); setT(body, 'cat', CATN[d.cat]); setT(body, 'src', d.src); setT(body, 'by', d.by); setT(body, 'ver', d.verPair);
        var bl = body.querySelector('[data-v="lvl"]'); bl.textContent = LVLN[d.lvl][0]; bl.classList.add(LVLN[d.lvl][1]);
        var cul = body.querySelector('[data-v="cites"]'); d.cites.forEach(function (x) { addCite(cul, x[0], x[1]); });
        var tg = body.querySelector('[data-v="tags"]');
        d.tags.split(';').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (x) { var s = document.createElement('span'); s.className = 'chip chip-neutral'; s.textContent = x; tg.appendChild(s); });
        if (!tg.children.length) tg.textContent = '—';
        if (d.circ) { var circEl = body.querySelector('[data-v="circ"]'); if (circEl) circEl.hidden = false; }
        tpl.content.appendChild(body);
        evMain.appendChild(tpl);
        return tr;
      }
      function finishAdd(id, list, src, circ) {
        var lp = lastPub(id), dk = draftKey(id), rv = nextRv(), first = null;
        var pair = T('q.ver.pairNew', 'v1 · trong bản nháp {v} ({id})', { v: dk, id: id });
        list.forEach(function (d) {
          d.c = nextCase(); d.src = src; d.by = BY[getRole()]; d.rv = rv; d.circ = circ; d.verPair = pair;
          var tr = addQRow(id, d); if (!first) first = tr;
          vdPush(id, { k: 'add', st: 'pending', id: d.c, q: d.q, a: d.a, cite: d.cites.map(function (x) { return x[0] + ' · ' + x[1]; }).join('; '), cat: d.cat, lvl: d.lvl, by: d.by, at: now() });
          QH[d.c] = [{ v: 'v1', act: 'Tạo', by: d.by, at: T('q.ver.justNow', 'Vừa xong'), rv: T('q.ver.pendingRv', 'Chờ duyệt') + ' · ' + rv, ds: T('q.ver.draftOf', 'bản nháp {v}', { v: dk }) }];
        });
        dsTouch(id, 'add', list.length);
        dsBump(id, list.length);
        var tb = dsTable(id);
        if (curDs === id) { qfRun(dsDet); showTableOrEmpty(tb, first && first.getAttribute('data-id')); bulkSync(dsDet); }
        return rv;
      }
      // ---- dialogs ----
      var DLG = {};
      DLG['dlg-q-edit'] = fillEditDlg;
      document.addEventListener('click', function (e) {
        var o = e.target.closest('[data-dlg-open]');
        if (o && !o.disabled && o.getAttribute('aria-disabled') !== 'true') {
          var d = document.getElementById(o.getAttribute('data-dlg-open')); if (!d) return;
          d.__opener = o;
          var r = curDs && dsRow(curDs);
          d.querySelectorAll('[data-dlg-ds]').forEach(function (s) { s.textContent = r ? curDs + ' · ' + r.getAttribute('data-f-name') : ''; });
          if (DLG[d.id]) DLG[d.id](d, r);
          d.showModal();
          // focus the first field, not the ✕ in the dialog head
          var ff = [].filter.call(d.querySelectorAll('input:not([type="hidden"]), select, textarea, button, [tabindex="0"]'), function (x) { return !x.disabled && !x.closest('.q-dlg-head') && x.offsetParent !== null; })[0];
          if (ff) ff.focus();
          return;
        }
        var c = e.target.closest('dialog.q-dlg [data-dlg-close]');
        if (c) c.closest('dialog').close();
        var t = e.target.closest('dialog.q-dlg a[href="#"]');
        if (t) e.preventDefault();
      });
      document.querySelectorAll('dialog.q-dlg').forEach(function (d) {
        d.addEventListener('close', function () { var o = d.__opener; if (o && document.contains(o) && !o.closest('[hidden]')) o.focus(); });
      });
      // ---- Lịch sử phiên bản (right sheet) + So sánh phiên bản ----
      function el(tag, cls, txt) { var x = document.createElement(tag); if (cls) x.className = cls; if (txt !== undefined) x.textContent = txt; return x; }
      function sumNodes(box, s) {
        // one diff notation: + green · − red · ~ amber; zero counts hidden
        if (s.a) box.appendChild(el('span', 'q-ins', '+' + s.a + ' ' + T('q.ver.wAdd', 'thêm')));
        if (s.d) box.appendChild(el('span', 'q-del', '−' + s.d + ' ' + T('q.ver.wDel', 'xóa')));
        if (s.e) box.appendChild(el('span', 'q-chg', '~' + s.e + ' ' + T('q.ver.wEdit', 'sửa')));
      }
      DLG['dlg-ds-hist'] = function () {
        var id = curDs, list = document.getElementById('vh-list'); if (!id) return;
        list.textContent = '';
        var x = VERS[id], d = x.draft, lp = lastPub(id), items = [{ draft: true, v: d.v }].concat(x.pub.slice().reverse());
        items.forEach(function (it) {
          var li = el('li', 'q-vtl-item' + (it.draft ? ' is-draft' : '') + (it.v === curVer ? ' is-cur' : '')), h = el('div', 'q-vtl-h');
          h.appendChild(el('b', '', it.v));
          h.appendChild(el('span', 'chip ' + (it.draft ? 'chip-neutral' : 'chip-success'), it.draft ? T('q.ver.draftChip', 'bản nháp') : 'published'));
          h.appendChild(el('span', 'q-vtl-at', it.draft ? (d.at ? T('q.ver.autoAt', 'Tự động lưu {t}', { t: d.at }) : '') : it.at));
          li.appendChild(h);
          var idx = x.pub.indexOf(it), prev = it.draft ? lp : (idx > 0 ? x.pub[idx - 1] : null);
          if (it.draft) {
            li.appendChild(el('div', 'q-vtl-meta', d.by ? T('q.ver.histDraftMeta', 'Đang sửa · {by}', { by: d.by }) : T('q.ver.histDraftIdle', 'Đang sửa')));
            var rr = dsRow(id);
            li.appendChild(el('div', 'q-vtl-meta', T('q.ver.histCounts', '{t} câu · {ok} đã duyệt', { t: rr.querySelector('[data-cnt="total"]').textContent, ok: rr.querySelector('[data-cnt="ok"]').textContent })));
          } else {
            li.appendChild(el('div', 'q-vtl-meta', T('q.ver.histPubBy', 'Kích hoạt bởi {by}', { by: it.by })));
            li.appendChild(el('div', 'q-vtl-meta', T('q.ver.histCounts', '{t} câu · {ok} đã duyệt', { t: fmt(it.total), ok: fmt(it.ok) })));
          }
          var sm = el('div', 'q-vtl-sum');
          if (!it.draft && it.init) sm.appendChild(el('span', '', T('q.ver.histInit', 'Khởi tạo · +{a}', { a: it.sum.a })));
          else if (it.draft && prev && !hasChg(d)) sm.appendChild(el('span', 'muted', T('q.ver.noChg', 'Không có thay đổi so với {v}', { v: prev.v })));
          else { sumNodes(sm, it.draft ? { a: d.add, e: d.edit, d: d.del + (d.delPend || 0) } : it.sum); if (prev) sm.appendChild(el('span', 'muted', T('q.ver.vsPrev', 'so với {v}', { v: prev.v }))); }
          li.appendChild(sm);
          var ac = el('div', 'q-vtl-acts');
          if (it.draft) ac.appendChild(el('span', 'text-xs muted', x.draftRuns ? T('q.ver.draftRuns', 'Run tham khảo: {r}', { r: x.draftRuns.join(', ') }) : T('q.ver.draftNoRun', 'Run trên bản nháp chỉ để tham khảo, không làm baseline')));
          else if (it.runs.length) { var rb = el('button', 'btn btn-sm btn-ghost', T('q.ver.runsN', '{n} run · {r}', { n: it.runs.length, r: it.runs.join(', ') })); rb.type = 'button'; rb.setAttribute('data-vh-runs', id + '@' + it.v); ac.appendChild(rb); }
          else ac.appendChild(el('span', 'text-xs muted', T('q.ver.runsNone', 'Chưa có run')));
          if (it.v === curVer) ac.appendChild(el('span', 'text-xs muted', T('q.ver.viewing', 'Đang xem')));
          else { var vb = el('button', 'btn btn-sm btn-secondary', T('q.ver.view', 'Xem')); vb.type = 'button'; vb.setAttribute('data-vh-view', it.v); vb.setAttribute('aria-label', T('q.ver.view', 'Xem') + ' ' + it.v); ac.appendChild(vb); }
          if (prev) { var cb = el('button', 'btn btn-sm btn-ghost', T('q.ver.cmpWith', 'So sánh với {v}', { v: prev.v })); cb.type = 'button'; cb.setAttribute('data-vh-cmp', prev.v + '>' + it.v); ac.appendChild(cb); }
          li.appendChild(ac);
          list.appendChild(li);
        });
      };
      var vh = document.getElementById('dlg-ds-hist');
      vh.addEventListener('click', function (e) {
        var hb = dsDet.querySelector('[data-ds-histbtn]');
        var v = e.target.closest('[data-vh-view]');
        if (v) { vh.__opener = null; vh.close(); setVer(curDs, v.getAttribute('data-vh-view')); dsDet.querySelector('#eq-ver').focus(); return; }
        var c = e.target.closest('[data-vh-cmp]');
        if (c) { var p = c.getAttribute('data-vh-cmp').split('>'); vh.__opener = null; vh.close(); openDiff(p[0], p[1], hb); return; }
        var rn = e.target.closest('[data-vh-runs]');
        if (rn) { vh.__opener = null; vh.close(); showRuns(rn.getAttribute('data-vh-runs')); return; }
        if (e.target.closest('#vh-cmp')) { vh.__opener = null; vh.close(); openDiff(null, null, hb); }
      });
      function showRuns(dsv) { showJobs(dsv); }
      var FLD = [['q', 'Câu hỏi', 'q.ver.fQ'], ['a', 'Câu trả lời', 'q.ver.fA'], ['cite', 'Tài liệu trích dẫn', 'q.ver.fCite'], ['cat', 'Phân loại', 'q.ver.fCat'], ['lvl', 'Độ khó', 'q.ver.fLvl']];
      function fv(k, v) { return k === 'cat' ? (CATN[v] || v) : k === 'lvl' ? (LVLN[v] ? LVLN[v][0] : v) : v; }
      function cp(o) { var r = {}; for (var k in o) r[k] = (o[k] && typeof o[k] === 'object') ? cp(o[k]) : o[k]; return r; }
      function diffRange(id, a, b) {
        var A = vNum(a), B = vNum(b), M = {}, order = [], sum = { a: 0, e: 0, d: 0 }, x = VERS[id];
        for (var i = A; i < B; i++) {
          var to = 'v' + (i + 1), p = pubOf(id, to), s = p ? p.sum : { a: x.draft.add, e: x.draft.edit, d: x.draft.del + (x.draft.delPend || 0) };
          sum.a += s.a; sum.e += s.e; sum.d += s.d;
          ((VD[id] || {})['v' + i + '>' + to] || []).forEach(function (it) {
            var pr = M[it.id];
            if (!pr) { M[it.id] = cp(it); order.push(it.id); return; }
            if (pr.k === 'add' && it.k === 'edit') { var af = it.after || {}; for (var k in af) pr[k] = af[k]; pr.by = it.by; pr.at = it.at; if (it.st) pr.st = it.st; }
            else if (pr.k === 'add' && it.k === 'del') delete M[it.id];
            else if (pr.k === 'edit' && it.k === 'edit') { pr.before = pr.before || {}; pr.after = pr.after || {}; for (var k1 in (it.before || {})) if (!(k1 in pr.before)) pr.before[k1] = it.before[k1]; for (var k2 in (it.after || {})) pr.after[k2] = it.after[k2]; pr.by = it.by; pr.at = it.at; pr.st = it.st; if (it.note) pr.note = it.note; }
            else if (it.k === 'del') M[it.id] = cp(it);
            else if (pr.k === 'del' && it.k === 'add') M[it.id] = { k: 'edit', id: it.id, q: it.q, by: it.by, at: it.at, before: { a: pr.a }, after: { a: it.a } };
          });
        }
        return { sum: sum, items: order.filter(function (k) { return M[k]; }).map(function (k) { return M[k]; }) };
      }
      // "So sánh" → shared version history & diff popup (assets/version-diff.js · window.KCVH) via the 'eval-ds:' provider
      function openDiff(a, b, opener) {
        var id = curDs; if (!id) return;
        var lp = lastPub(id), d = VERS[id].draft;
        if (!a || !b) {
          if (lp && hasChg(d)) { a = lp.v; b = d.v; }
          else if (lp) { var ps = VERS[id].pub; a = ps.length > 1 ? ps[ps.length - 2].v : ''; b = lp.v; }
          else { a = ''; b = d.v; }
        }
        if (a && vNum(a) > vNum(b)) { var t = a; a = b; b = t; }
        if (a === b) a = '';
        if (window.KCVH) window.KCVH.open('eval-ds:' + id, { a: a, b: b, opener: opener || dsDet.querySelector('[data-ds-histbtn]') });
      }
      // provider: id 'eval-ds:<DS-ID>' → component definition built from VERS (versions) and diffRange()/VD (Q&A pair changes)
      function vhEval(vid) {
        var id = String(vid).slice('eval-ds:'.length), x = VERS[id]; if (!x) return null;
        var r = dsRow(id), d = x.draft, lp = lastPub(id), nm = r && r.getAttribute('data-f-name');
        function sumTxt(s) { return [s.a ? '+' + s.a : '', s.d ? '−' + s.d : '', s.e ? '~' + s.e : ''].filter(Boolean).join(' ') || T('vh.noChange', 'Không có thay đổi'); }
        var vers = [{ v: d.v, status: 'draft', by: d.by || '', at: d.at ? T('q.ver.autoAt', 'Tự động lưu {t}', { t: d.at }) : '',
          sum: lp && !hasChg(d) ? T('q.ver.noChg', 'Không có thay đổi so với {v}', { v: lp.v }) : sumTxt({ a: d.add, e: d.edit, d: d.del + (d.delPend || 0) }),
          cr: (x.draftRuns || []).join(', ') }].concat(x.pub.slice().reverse().map(function (p) {
          return { v: p.v, status: 'published', by: p.by, at: p.at, sum: p.init ? T('q.ver.histInit', 'Khởi tạo · +{a}', { a: p.sum.a }) : sumTxt(p.sum), cr: (p.runs || []).join(', ') };
        }));
        var K = { add: 'ins', del: 'del', edit: 'mod' };
        function val(k, v) { return v === undefined || v === null || v === '' ? '—' : fv(k, v); }
        return {
          name: id + (nm ? ' · ' + nm : ''),
          restore: false,
          restoreNote: T('vh.evalNote', 'Phiên bản đã publish là bất biến; Run dùng đúng phiên bản đã chọn.'),
          versions: vers,
          compute: function (a, b) {
            var sec = { label: T('vh.lbl.qaPairs', 'Cặp câu hỏi'), cols: [['label', T('vh.lbl.qaPairs', 'Cặp câu hỏi')], ['chg', T('vh.c.changes', 'Nội dung thay đổi')]], rows: [] };
            if (!a || !b) return { sections: [sec] };
            if (vNum(a) > vNum(b)) { var t = a; a = b; b = t; }
            var rg = diffRange(id, a, b);
            sec.rows = rg.items.map(function (it) {
              var chg = [], det = [];
              if (it.k === 'edit') {
                var bf = it.before || {}, af = it.after || {};
                FLD.forEach(function (f) { if (f[0] in bf || f[0] in af) chg.push(T(f[2], f[1]) + ': ' + val(f[0], bf[f[0]]) + ' → ' + val(f[0], af[f[0]])); });
              } else {
                (it.k === 'add' ? FLD.slice(1) : FLD.slice(1, 2)).forEach(function (f) { if (it[f[0]]) chg.push(T(f[2], f[1]) + ': ' + fv(f[0], it[f[0]])); });
              }
              if (it.st === 'pending') det.push(it.k === 'del' ? T('q.ver.pendingDel', 'Chờ duyệt xóa') : T('q.ver.pending', 'Chờ duyệt'));
              if (it.note) det.push(it.note);
              if (it.by) det.push(it.by + (it.at ? ' · ' + it.at : ''));
              return { t: K[it.k] || 'mod', depth: 0, cells: { label: it.id + ' · ' + it.q, chg: chg.join(' | ') }, detail: det };
            });
            return { sections: [sec], counts: { add: rg.sum.a, del: rg.sum.d, mod: rg.sum.e } };
          }
        };
      }
      if (window.KCVH) window.KCVH.provide('eval-ds:', vhEval);
      else (window.KCVH_PROVIDERS = window.KCVH_PROVIDERS || []).push(['eval-ds:', vhEval]);
      function fieldErr(field, msg) {
        var er = field.querySelector('.field-err');
        field.classList.toggle('has-error', !!msg);
        if (er) { er.textContent = msg || ''; er.hidden = !msg; }
        var inp = field.querySelector('input, textarea, select');
        if (inp) { if (msg) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid'); }
      }
      // Tạo bộ câu hỏi
      var dn = document.getElementById('dlg-ds-new');
      DLG['dlg-ds-new'] = function (d) {
        var nm = d.querySelector('#dn-name'); nm.value = ''; d.querySelector('#dn-desc').value = '';
        fieldErr(nm.closest('.field'), '');
        applyRoleGates();
        var sel = d.querySelector('#dn-kb'), first = [].filter.call(sel.options, function (o) { return !o.hidden; })[0];
        if (first) sel.value = first.value;
      };
      dn.querySelector('#dn-ok').addEventListener('click', function () {
        var nm = dn.querySelector('#dn-name'), v = nm.value.trim();
        if (!v) { fieldErr(nm.closest('.field'), 'Nhập tên bộ câu hỏi'); nm.setAttribute('aria-describedby', 'dn-err'); nm.focus(); return; }
        fieldErr(nm.closest('.field'), '');
        var kb = dn.querySelector('#dn-kb').value, id = 'DS-0' + (++dsSeq);
        var tr = document.getElementById('tpl-ds-row').content.firstElementChild.cloneNode(true);
        tr.setAttribute('data-id', id); tr.setAttribute('data-kb', kb); tr.setAttribute('data-f-name', v); tr.setAttribute('data-f-kbname', KBN[kb]);
        tr.setAttribute('aria-label', 'Mở bộ câu hỏi ' + id);
        if (kb === 'kyc') tr.setAttribute('data-stw', '');
        var full = setT(tr, 'full', id + ' · ' + v); full.title = full.textContent;
        var kbc = setT(tr, 'kb', KBN[kb]); kbc.title = KBN[kb];
        VERS[id] = { pub: [], draft: { v: 'v1', at: now(), by: BY[getRole()], add: 0, addOk: 0, edit: 0, editOk: 0, del: 0 } };
        var tbody = document.querySelector('#et-datasets tbody'); tbody.insertBefore(tr, tbody.firstElementChild);
        var tb = document.getElementById('tpl-eq-table').content.firstElementChild.cloneNode(true);
        tb.id = 'eq-' + id; tb.setAttribute('data-ds-table', id); tb.querySelector('caption').textContent = 'Câu hỏi của ' + id;
        var holder = dsDet.querySelector('[data-ds-tables]'); holder.insertBefore(tb, holder.querySelector('[data-ds-empty]'));
        qBind(tb);
        kpiSync(); rowVerSync(id); syncPublish(id);
        qfRun(dsList);
        dn.close();
        toast(T('q.ver.created', 'Đã tạo {id} · bản nháp', { id: id }));
        dsOpen(id);
      });
      // Thêm câu hỏi (Generate / thủ công)
      var qa = document.getElementById('dlg-q-add'), qaList = qa.querySelector('#qa-list'), qaSave = qa.querySelector('#qa-save'), qaGen = qa.querySelector('#qa-gen'), qaMode = 'gen', qaKb = 'kyc', qaTimer = null;
      function newCard(kb, manual) {
        var c = document.getElementById('tpl-gen-card').content.firstElementChild.cloneNode(true);
        var ds = c.querySelector('[data-k="doc"]');
        (DOCS[kb] || []).forEach(function (x) { var o = document.createElement('option'); o.textContent = x; ds.appendChild(o); });
        if (manual) {
          c.classList.add('is-manual');
          c.querySelector('.q-gen-h').hidden = true;
          ['lc', 'll'].forEach(function (k) { var l = c.querySelector('[data-v="' + k + '"]'); var s = document.createElement('span'); s.className = 'req'; s.textContent = ' *'; l.appendChild(s); });
          var cs = c.querySelector('[data-k="cat"]'), o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Chọn phân loại'; cs.insertBefore(o0, cs.firstChild); cs.value = '';
          var ls = c.querySelector('[data-k="lvl"]'), o1 = document.createElement('option'); o1.value = ''; o1.textContent = 'Chọn độ khó'; ls.insertBefore(o1, ls.firstChild); ls.value = '';
          c.querySelector('[data-k="q"]').outerHTML = '<textarea class="input" rows="2" data-k="q"></textarea>';
        }
        // label/for wiring
        var n = 'qc' + Math.random().toString(36).slice(2, 8);
        c.querySelectorAll('.field').forEach(function (f, i) { var l = f.querySelector('label'), inp = f.querySelector('input, textarea, select'); if (l && inp) { inp.id = n + i; l.setAttribute('for', inp.id); } var er = f.querySelector('.field-err'); if (er && inp) { er.id = n + i + 'e'; inp.setAttribute('aria-describedby', er.id); } });
        return c;
      }
      function cardCites(c) { return c.querySelector('[data-k="cites"]'); }
      function cardAddCite(c, doc, loc) {
        var li = addCite(cardCites(c), doc, loc);
        var a = li.querySelector('a'), x = document.createElement('button');
        x.type = 'button'; x.className = 'icon-btn'; x.setAttribute('data-cite-del', ''); x.setAttribute('aria-label', 'Bỏ trích dẫn ' + doc + ' ' + loc);
        x.innerHTML = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
        a.after(x);
      }
      function qaSync() {
        if (qaMode === 'manual') { qaSave.textContent = 'Lưu & gửi duyệt'; qaSave.disabled = false; qaSave.removeAttribute('title'); return; }
        var n = qaList.children.length;
        qaSave.textContent = n ? 'Lưu ' + n + ' câu & gửi duyệt' : 'Lưu & gửi duyệt';
        qaSave.disabled = !n; if (!n) qaSave.title = 'Bấm Generate trước'; else qaSave.removeAttribute('title');
      }
      function qaSetMode(m) {
        qaMode = m;
        qa.querySelectorAll('[data-qa-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-qa-mode') === m)); });
        qa.querySelectorAll('[data-qa-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-qa-pane') !== m; });
        qaSync();
      }
      DLG['dlg-q-add'] = function (d, r) {
        qaKb = r ? r.getAttribute('data-kb') : 'kyc';
        clearTimeout(qaTimer);
        qaList.textContent = '';
        qa.querySelector('#qa-status').textContent = 'Bấm Generate: hệ thống soạn câu trả lời, tài liệu trích dẫn và gợi ý Phân loại/Độ khó. Bạn sửa được mọi trường trước khi lưu.';
        qa.querySelector('#qa-res').removeAttribute('aria-busy');
        qaGen.disabled = false; qaGen.textContent = 'Generate';
        var lines = (GEN[qaKb] || []).map(function (x) { return x.q; }); lines.push(MISS[qaKb] || 'Câu hỏi khác?');
        var ta = qa.querySelector('#qa-lines'); ta.value = lines.join('\n'); fieldErr(ta.closest('.field'), '');
        var sc = qa.querySelector('#qa-scope'); sc.textContent = '';
        ['Toàn bộ tri thức'].concat(DOCS[qaKb] || []).forEach(function (x) { var o = document.createElement('option'); o.textContent = x; sc.appendChild(o); });
        var man = qa.querySelector('#qa-manual'); man.textContent = ''; man.appendChild(newCard(qaKb, true));
        var lpq = r && VERS[r.getAttribute('data-id')] && lastPub(r.getAttribute('data-id')), fb = qa.querySelector('[data-qa-draft]');
        fb.hidden = !lpq;
        if (lpq) fb.firstElementChild.textContent = T('q.ver.qaDraftBanner', 'Câu hỏi mới lưu vào bản nháp {d} (tự động lưu); {p} đã publish giữ nguyên.', { d: draftKey(r.getAttribute('data-id')), p: lpq.v });
        qaSetMode('gen');
      };
      qa.addEventListener('click', function (e) {
        var m = e.target.closest('[data-qa-mode]'); if (m) qaSetMode(m.getAttribute('data-qa-mode'));
        var dr = e.target.closest('[data-gen-drop]'); if (dr) { dr.closest('.q-gen-card').remove(); qaSync(); qa.querySelector('#qa-status').textContent = 'Còn ' + qaList.children.length + ' bản nháp'; }
        var ca = e.target.closest('[data-cite-add]');
        if (ca) {
          var c = ca.closest('.q-gen-card'), loc = c.querySelector('[data-k="loc"]').value.trim();
          cardAddCite(c, c.querySelector('[data-k="doc"]').value, loc || 'chưa ghi vị trí');
          c.querySelector('[data-k="loc"]').value = '';
          fieldErr(cardCites(c).closest('.field'), '');
        }
        var cd = e.target.closest('[data-cite-del]'); if (cd) cd.closest('li').remove();
      });
      qaGen.addEventListener('click', function () {
        var ta = qa.querySelector('#qa-lines'), lines = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 5);
        if (!lines.length) { fieldErr(ta.closest('.field'), 'Nhập ít nhất một câu hỏi'); ta.focus(); return; }
        fieldErr(ta.closest('.field'), '');
        qaGen.disabled = true; qaGen.textContent = 'Đang tạo…';
        var res = qa.querySelector('#qa-res'); res.setAttribute('aria-busy', 'true');
        qa.querySelector('#qa-status').textContent = 'Đang soạn câu trả lời và tìm trích dẫn…';
        qaList.textContent = ''; qaSync();
        qaTimer = setTimeout(function () {
          var warn = 0;
          lines.forEach(function (ln, i) {
            var hit = (GEN[qaKb] || []).filter(function (x) { return qNorm(x.q) === qNorm(ln); })[0], c = newCard(qaKb, false);
            setT(c, 't', 'Bản nháp ' + (i + 1));
            c.querySelector('[data-k="q"]').value = ln;
            if (hit) {
              c.querySelector('[data-k="a"]').value = hit.a;
              hit.c.forEach(function (x) { cardAddCite(c, x[0], x[1]); });
              c.querySelector('[data-k="cat"]').value = hit.cat; c.querySelector('[data-k="lvl"]').value = hit.lvl; c.querySelector('[data-k="tags"]').value = hit.tags;
              setT(c, 'hc', 'AI gợi ý: ' + CATN[hit.cat]); setT(c, 'hl', 'AI gợi ý: ' + LVLN[hit.lvl][0]);
            } else {
              warn++; c.classList.add('is-warn'); c.querySelector('[data-v="warn"]').hidden = false;
              c.querySelector('[data-k="cat"]').value = 'fact'; setT(c, 'hc', 'AI gợi ý: Tra cứu sự kiện'); c.querySelector('[data-k="lvl"]').value = 'tb'; setT(c, 'hl', 'AI gợi ý: Trung bình');
            }
            qaList.appendChild(c);
          });
          res.removeAttribute('aria-busy');
          qaGen.disabled = false; qaGen.textContent = 'Generate lại';
          qa.querySelector('#qa-status').textContent = 'Đã tạo ' + lines.length + ' bản nháp' + (warn ? ' · ' + warn + ' cần bổ sung trích dẫn' : '');
          qaSync();
        }, 1200);
      });
      function readCard(c) {
        var q = c.querySelector('[data-k="q"]'), a = c.querySelector('[data-k="a"]'), ul = cardCites(c), bad = null;
        var cs = c.querySelector('[data-k="cat"]'), ls = c.querySelector('[data-k="lvl"]');
        fieldErr(a.closest('.field'), !a.value.trim() ? 'Nhập câu trả lời' : ''); if (!a.value.trim()) bad = bad || a;
        fieldErr(ul.closest('.field'), !ul.children.length ? 'Cần ít nhất 1 tài liệu trích dẫn' : ''); if (!ul.children.length) bad = bad || c.querySelector('[data-k="doc"]');
        if (!q.value.trim()) { q.closest('.field').classList.add('has-error'); q.setAttribute('aria-invalid', 'true'); bad = q; } else { q.closest('.field').classList.remove('has-error'); q.removeAttribute('aria-invalid'); }
        [cs, ls].forEach(function (s) { var f = s.closest('.field'); f.classList.toggle('has-error', !s.value); if (!s.value) bad = bad || s; });
        if (bad) return { bad: bad };
        return { q: q.value.trim(), a: a.value.trim(), cat: cs.value, lvl: ls.value, tags: c.querySelector('[data-k="tags"]').value,
          cites: [].map.call(ul.children, function (li) { return [li.querySelector('[data-v="doc"]').textContent, li.querySelector('[data-v="loc"]').textContent]; }) };
      }
      qaSave.addEventListener('click', function () {
        var cards = qaMode === 'gen' ? [].slice.call(qaList.children) : [qa.querySelector('#qa-manual .q-gen-card')], out = [], bad = null;
        cards.forEach(function (c) { var d = readCard(c); if (d.bad) bad = bad || d.bad; else out.push(d); });
        if (bad) { bad.focus(); return; }
        if (!out.length || !curDs) return;
        var rv = finishAdd(curDs, out, qaMode === 'gen' ? 'Generate (LLM)' : 'Thủ công', qaMode === 'gen');
        qa.close();
        toast('Đã thêm ' + out.length + ' câu hỏi · Chờ duyệt · tạo việc ' + rv + ' (QA đánh giá)' + (dsDet.getAttribute('data-draft-note') || ''));
      });
      // Upload từ Excel
      var xl = document.getElementById('dlg-q-xlsx'), xlKb = 'kyc', xlImp = xl.querySelector('#xl-import');
      var XLCAT = {}; Object.keys(CATN).forEach(function (k) { XLCAT[CATN[k]] = k; });
      var XLLVL = { 'Dễ': 'de', 'Trung bình': 'tb', 'Khó': 'kho' };
      function xlState(s) {
        xl.querySelectorAll('[data-xl-state]').forEach(function (p) { p.hidden = p.getAttribute('data-xl-state') !== s; });
        xl.querySelectorAll('[data-xl-only]').forEach(function (b) { b.hidden = s !== 'map'; });
        if (s === 'pick') { xlImp.disabled = true; xlImp.textContent = 'Nhập câu hỏi'; xlImp.title = 'Chọn file trước'; }
        else xlValidate();
      }
      function xlValidate() {
        var miss = [].filter.call(xl.querySelectorAll('select[data-xl-map][data-req]'), function (s) { return !s.value; }).map(function (s) { return s.getAttribute('data-xl-map'); });
        var ok = 0, er = 0;
        xl.querySelectorAll('tr[data-xl-row]').forEach(function (tr) {
          var m = miss.length ? 'Thiếu cột ' + miss.join(', ') : (xlKb !== 'kyc' ? 'Tài liệu “' + tr.getAttribute('data-doc') + '” không thuộc tri thức ' + KBN[xlKb] : tr.getAttribute('data-err'));
          var cell = tr.querySelector('[data-xl-res]'); cell.textContent = '';
          var s = document.createElement('span');
          if (m) { s.className = 'q-err-msg'; s.textContent = m; er++; } else { s.className = 'chip chip-success'; s.textContent = 'Hợp lệ'; ok++; }
          cell.appendChild(s);
          tr.classList.toggle('q-row-err', !!m);
        });
        xl.querySelector('[data-xl="ok"]').textContent = ok; xl.querySelector('[data-xl="err"]').textContent = er;
        xl.querySelector('#xl-report').setAttribute('data-toast', 'Đã tải báo cáo lỗi · ' + er + ' dòng');
        xlImp.textContent = 'Nhập ' + ok + ' câu hỏi'; xlImp.disabled = !ok;
        if (!ok) xlImp.title = 'Không có dòng hợp lệ'; else xlImp.removeAttribute('title');
        xlFilter();
      }
      function xlFilter() {
        var on = xl.querySelector('[data-xl-f][aria-pressed="true"]'), err = on && on.getAttribute('data-xl-f') === 'err';
        xl.querySelectorAll('tr[data-xl-row]').forEach(function (tr) { tr.hidden = err && !tr.classList.contains('q-row-err'); });
      }
      DLG['dlg-q-xlsx'] = function (d, r) {
        xlKb = r ? r.getAttribute('data-kb') : 'kyc';
        xl.querySelectorAll('select[data-xl-map]').forEach(function (s) { s.value = s.querySelector('option[selected]').value; });
        xl.querySelectorAll('[data-xl-f]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-xl-f') === 'all')); });
        xlState('pick');
      };
      xl.querySelector('#xl-pick').addEventListener('click', function () { xlState('map'); });
      xl.querySelector('#xl-repick').addEventListener('click', function () { xlState('pick'); });
      xl.querySelector('#xl-back').addEventListener('click', function () { xlState('pick'); });
      var drop = xl.querySelector('#xl-drop');
      drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-over'); });
      drop.addEventListener('dragleave', function () { drop.classList.remove('is-over'); });
      drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-over'); xlState('map'); });
      xl.addEventListener('change', function (e) { if (e.target.matches('select[data-xl-map]')) xlValidate(); });
      xl.addEventListener('click', function (e) {
        var f = e.target.closest('[data-xl-f]'); if (f) setTimeout(xlFilter, 0);
      });
      xlImp.addEventListener('click', function () {
        if (!curDs) return;
        var out = [];
        xl.querySelectorAll('tr[data-xl-row]:not(.q-row-err)').forEach(function (tr) {
          var td = tr.querySelectorAll('td'), t = function (i) { return td[i].textContent.trim(); }, cp = t(3).split(' | ');
          out.push({ q: t(1), a: t(2), cites: [[cp[0] + ' · ' + (cp[1] || ''), cp.slice(2).join(' · ')]], cat: XLCAT[t(4)] || 'fact', lvl: XLLVL[t(5)] || 'tb', tags: '' });
        });
        if (!out.length) return;
        var rv = finishAdd(curDs, out, 'Excel · kyc-qa-2026-06.xlsx', false);
        xl.close();
        toast('Đã nhập ' + out.length + ' câu hỏi từ kyc-qa-2026-06.xlsx · Chờ duyệt · tạo việc ' + rv + ' (QA đánh giá)' + (dsDet.getAttribute('data-draft-note') || ''));
      });
      // ---- Xóa câu hỏi [Đề xuất]: Chờ duyệt → xóa ngay khỏi bản nháp; Đã duyệt → Chờ xóa + việc QA đánh giá, loại ở lần Publish sau khi được duyệt ----
      var TRASH = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
      function qText(tr) { var b = tr.querySelector('.q-qcell b'); return b ? b.textContent : ''; }
      function qAns(tr) { var a = tr.querySelector('.q-qcell .muted'); return a ? a.textContent.replace(/^Đáp án:\s*/, '') : ''; }
      function isSent(tr) { var c = tr.querySelector('.q-st2 .chip-st'); return !!c && c.classList.contains('chip-info'); }
      function okBump(id, n) {
        var r = dsRow(id); if (!r) return;
        ['total', 'ok'].forEach(function (k) { var c = r.querySelector('[data-cnt="' + k + '"]'); c.textContent = fmt(num(c) + n); });
        if (curDs === id) setVer(id, curVer, true);
      }
      function delCfg(b, tr) {
        var cs = tr.getAttribute('data-f-title'), pend = tr.getAttribute('data-st') === 'pending', dk = draftKey(curDs);
        b.setAttribute('data-title', T('q.del.title', 'Xóa câu hỏi {c}?', { c: cs }));
        b.setAttribute('data-body', pend
          ? (isSent(tr) ? T('q.del.bodySent', 'Câu hỏi bị xóa khỏi bản nháp {v} và rút khỏi hàng duyệt QA đánh giá.', { v: dk }) : T('q.del.bodyPending', 'Câu hỏi bị xóa khỏi bản nháp {v}.', { v: dk }))
          : T('q.del.bodyOk', 'Câu đã duyệt sẽ chuyển Chờ xóa, tạo việc QA đánh giá; chỉ bị loại ở lần kích hoạt sau khi được duyệt.'));
      }
      evSide.addEventListener('ecp-qopen', function (e) {
        var r = e.detail && e.detail.row; if (!curDs || dsDet.hidden || !r || !r.closest('[data-ds-table]')) return;
        if (!isDraft(curDs, curVer) || r.classList.contains('q-row-del')) return;
        var slot = evSide.querySelector('[data-qtpl-slot]'), foot = slot.querySelector('.job-side-foot');
        if (!foot) { foot = el('div', 'job-side-foot'); slot.appendChild(foot); }
        if (r.getAttribute('data-st') === 'delpend') {
          foot.querySelectorAll('[data-ds-edit]').forEach(function (x) { x.remove(); });
          slot.querySelectorAll('dl.kv dt').forEach(function (dt) {
            if (dt.textContent.trim() !== 'Trạng thái' || !dt.nextElementSibling) return;
            var dd = dt.nextElementSibling; dd.textContent = ''; dd.appendChild(el('span', 'chip chip-warning', T('q.del.chip', 'Chờ xóa')));
          });
          foot.insertBefore(el('span', 'text-xs muted q-del-note', T('q.del.pendNote', 'Chờ duyệt xóa · {rv}', { rv: r.getAttribute('data-delrv') || '' })), foot.firstChild);
          return;
        }
        var b = el('button', 'btn btn-ghost q-del-btn'); b.type = 'button'; b.innerHTML = TRASH; b.appendChild(document.createTextNode(T('q.del.btn', 'Xóa')));
        b.setAttribute('data-ds-del', ''); b.setAttribute('data-q-confirm', ''); b.setAttribute('data-toast', '');
        b.setAttribute('data-roles-disable', dsRow(curDs).hasAttribute('data-stw') ? '' : 'steward');
        b.setAttribute('data-reason', 'Cần được phân quyền quản lý bộ câu hỏi');
        delCfg(b, r);
        foot.insertBefore(b, foot.firstChild);
        applyRoleGates();
      });
      function vdDrop(id, cid) { var k = vdKey(id), L = (VD[id] || {})[k]; if (!L) return null; var i = L.map(function (x) { return x.id; }).indexOf(cid); return i > -1 ? L.splice(i, 1)[0] : null; }
      function dsDelete(id, rows) {
        var d = VERS[id], tb = dsTable(id), undo = [], rv = null, nPend = 0, nOk = 0;
        rows.forEach(function (tr) {
          var cs = tr.getAttribute('data-f-title');
          if (tr.getAttribute('data-st') === 'pending') {
            nPend++;
            var it = { tr: tr, par: tr.parentNode, nx: tr.nextSibling, vd: vdDrop(id, cs), wasAdd: d.add > 0 };
            if (it.wasAdd) d.add--;
            tr.remove(); undo.push(it);
            (QH[cs] = QH[cs] || []).unshift({ v: '—', act: T('q.del.actDel', 'Xóa khỏi bản nháp'), by: BY[getRole()], at: now(), ds: T('q.ver.draftOf', 'bản nháp {v}', { v: draftKey(id) }) });
          } else if (tr.getAttribute('data-st') === 'ok' && !tr.classList.contains('q-row-del')) {
            nOk++; rv = rv || nextRv();
            var stc = tr.children[4], old = stc.innerHTML, vc = tr.lastElementChild, oldV = vc.innerHTML;
            tr.setAttribute('data-st', 'delpend'); tr.setAttribute('data-delrv', rv); tr.classList.add('q-row-delpend');
            stc.textContent = ''; stc.appendChild(el('span', 'chip chip-warning', T('q.del.chip', 'Chờ xóa')));
            var s2 = el('div', 'q-st2'); s2.appendChild(el('span', 'chip chip-info chip-st', rv)); stc.appendChild(s2);
            if (!tr.querySelector('.q-chg-chip')) verCell(vc, tr.getAttribute('data-pv') || 'v1', 'del');
            d.delPend = (d.delPend || 0) + 1;
            var ent = { k: 'del', st: 'pending', id: cs, q: qText(tr), a: qAns(tr), by: BY[getRole()], at: now(), note: T('q.del.note', 'Chờ duyệt xóa · {rv} (QA đánh giá)', { rv: rv }) };
            vdPush(id, ent);
            (QH[cs] = QH[cs] || []).unshift({ v: tr.getAttribute('data-pv') || 'v1', act: T('q.del.actPend', 'Đề nghị xóa'), by: BY[getRole()], at: now(), rv: T('q.ver.pendingRv', 'Chờ duyệt') + ' · ' + rv, ds: T('q.ver.draftOf', 'bản nháp {v}', { v: draftKey(id) }) });
            var u = { tr: tr, ok: true, stc: stc, old: old, vc: vc, oldV: oldV, ent: ent };
            // mock reviewer: the QA đánh giá item is approved after a few seconds → removed at next Publish
            u.timer = setTimeout(function () {
              if (tr.getAttribute('data-st') !== 'delpend' || !document.contains(tr)) return;
              tr.setAttribute('data-st', 'ok'); tr.classList.remove('q-row-delpend'); tr.classList.add('q-row-del');
              stc.textContent = ''; stc.appendChild(el('span', 'chip chip-success', T('q.del.approved', 'Đã duyệt xóa')));
              d.delPend = Math.max(0, d.delPend - 1); d.del++; delete ent.st; ent.note = T('q.del.noteOk', 'Đã duyệt xóa · {rv} · loại khỏi lần kích hoạt kế tiếp', { rv: rv });
              okBump(id, -1); rowVerSync(id); syncPublish(id); kpiSync();
              if (curDs === id && tr.classList.contains('selected')) qOpen(tb, tr);
            }, 6000);
            undo.push(u);
          }
        });
        if (!undo.length) return;
        if (nPend) dsBump(id, -nPend);
        dsTouch(id, 'del');
        kpiSync();
        if (curDs === id) { qfRun(dsDet); var sel = tb.querySelector('[data-qrow].selected'); showTableOrEmpty(tb, sel && document.contains(sel) ? sel.getAttribute('data-id') : null); bulkSync(dsDet); }
        var msg = nOk ? T('q.del.toastOk', 'Đã chuyển {n} câu sang Chờ xóa · tạo việc {rv} (QA đánh giá)', { n: nOk, rv: rv }) + (nPend ? T('q.del.toastAlso', ' · xóa {p} câu chờ duyệt', { p: nPend }) : '')
          : T('q.del.toastPend', 'Đã xóa {n} câu hỏi khỏi bản nháp {v}', { n: nPend, v: draftKey(id) });
        toast(msg, { label: T('q.del.undo', 'Hoàn tác'), fn: function () {
          undo.forEach(function (u) {
            if (u.ok) {
              clearTimeout(u.timer);
              if (u.tr.getAttribute('data-st') !== 'delpend') return;
              u.tr.setAttribute('data-st', 'ok'); u.tr.removeAttribute('data-delrv'); u.tr.classList.remove('q-row-delpend');
              u.stc.innerHTML = u.old; u.vc.innerHTML = u.oldV; d.delPend = Math.max(0, d.delPend - 1);
              var L = VD[id][vdKey(id)] || [], i = L.indexOf(u.ent); if (i > -1) L.splice(i, 1);
            } else {
              u.par.insertBefore(u.tr, u.nx && document.contains(u.nx) ? u.nx : u.par.querySelector('.filter-empty'));
              if (u.wasAdd) d.add++;
              if (u.vd) vdPush(id, u.vd);
            }
          });
          if (nPend) dsBump(id, nPend);
          dsTouch(id, 'del'); kpiSync();
          if (curDs === id) { qfRun(dsDet); bulkSync(dsDet); }
          toast(T('q.del.undone', 'Đã hoàn tác xóa'));
        } });
      }
      document.addEventListener('ecp-qapply', function (e) {
        var b = e.detail && e.detail.btn; if (!b || !curDs) return;
        if (b.hasAttribute('data-ds-del')) { var tb = dsTable(curDs), sel = tb && tb.querySelector('[data-qrow].selected'); if (sel) dsDelete(curDs, [sel]); }
        else if (b.hasAttribute('data-ds-delbulk')) {
          var rows = [].map.call(dsDet.querySelectorAll('[data-ds-table]:not([hidden]) input.q-check:checked'), function (c) { c.checked = false; return c.closest('[data-qrow]'); });
          dsDelete(curDs, rows);
        }
      });

      // ---- Tab Đánh giá: evaluation jobs (list + detail) and popup "Chạy đánh giá" ----
      var jobsTab = document.getElementById('ep-jobs'), jobsTb = document.getElementById('et-jobs');
      var KBV = { tindung: ['v12', 'v13'], the: ['v6', 'v7'], kyc: ['v8', 'v9'], core: ['v4', 'v5'], digital: ['v14', 'v15'], nhansu: ['v5', 'v6'] };
      var PROMPTS = ['answer-prompt v7', 'answer-prompt v8', 'answer-prompt v9'];
      var MODELS = ['Llama-3.1-70B (on-prem)', 'Qwen2.5-72B (on-prem)', 'Llama-3.1-8B (on-prem)'];
      // mode is a neutral category chip (not a warning); status keeps its own chip; UI strings go through T()
      var MODE = { kb: [T('qnd.e.cmpVer', 'So sánh 2 version'), T('qnd.e.kbVer', 'Version tri thức'), 'chip-neutral'], prompt: [T('qnd.e.cmpPrompt', 'So sánh 2 prompt'), 'Prompt', 'chip-neutral'], model: [T('qnd.e.cmpModel', 'So sánh 2 model'), 'Model', 'chip-neutral'] };
      var JST = { queued: [T('qnd.e.queued', 'Hàng đợi'), 'chip-neutral'], running: [T('common.running', 'Đang chạy'), 'chip-info'], done: [T('common.completed', 'Hoàn tất'), 'chip-success'], failed: [T('qnd.e.failed', 'Lỗi'), 'chip-error'] };
      var METRICS = ['Faithfulness', 'Answer relevance', 'Context recall', 'Citation coverage'];
      var STEPS = [T('qnd.e.stPrep', 'Chuẩn bị dataset'), T('qnd.e.stGenA', 'Sinh câu trả lời A'), T('qnd.e.stGenB', 'Sinh câu trả lời B'), T('qnd.e.stScore', 'Chấm điểm'), T('qnd.e.stSum', 'Tổng hợp')];
      function atTxt(s) { return String(s || '').replace(/^Hôm qua/, T('qnd.e.yesterday', 'Hôm qua')).replace(/^Hôm nay/, T('common.today', 'Hôm nay')); }
      function cfgOf(kb, o) { o = o || {}; return { kbv: o.kbv || KBV[kb][1], prompt: o.prompt || 'answer-prompt v8', model: o.model || MODELS[0], retr: 'Hybrid (BM25 + dense)', chunk: 'Agentic chunking' }; }
      function J(o) {
        var kb = dsRow(o.ds).getAttribute('data-kb'), x = { kb: kb, a: cfgOf(kb, o.A), b: cfgOf(kb, o.B) };
        for (var k in o) if (k !== 'A' && k !== 'B') x[k] = o[k];
        return x;
      }
      var JOBS = [
        J({ id: 'J-222', mode: 'prompt', ds: 'DS-06', dv: 'v3', st: 'queued', prog: 0, n: 296, by: 'Hoàng Vy', at: '14/06 10:40', A: { prompt: 'answer-prompt v8' }, B: { prompt: 'answer-prompt v9' } }),
        J({ id: 'J-221', mode: 'model', ds: 'DS-01', dv: 'v3', st: 'running', prog: 64, n: 320, by: 'Trần Hải', at: '14/06 10:05', A: { model: MODELS[0] }, B: { model: MODELS[1] } }),
        J({ id: 'J-220', mode: 'prompt', ds: 'DS-01', dv: 'v3', st: 'done', prog: 100, n: 320, by: 'Nguyễn Lan', at: '13/06 15:10', dur: '38 phút', A: { prompt: 'answer-prompt v8' }, B: { prompt: 'answer-prompt v9' },
          res: { m: [[0.88, 0.84], [0.83, 0.86], [0.79, 0.81], [0.91, 0.86]], cases: [['C-0187', 0.92, 0.61], ['C-0312', 0.86, 0.79], ['C-0310', 0.90, 0.90], ['C-0262', 0.74, 0.88], ['C-0315', 0.81, 0.81]] } }),
        J({ id: 'J-219', mode: 'kb', ds: 'DS-01', dv: 'v3', st: 'done', prog: 100, n: 320, by: 'Nguyễn Lan', at: '12/06 16:20', dur: '35 phút', base: true, A: { kbv: 'v12' }, B: { kbv: 'v13' },
          res: { m: [[0.84, 0.88], [0.82, 0.83], [0.76, 0.79], [0.87, 0.91]], cases: [['C-0187', 0.61, 0.92], ['C-0310', 0.85, 0.90], ['C-0312', 0.86, 0.86], ['C-0262', 0.80, 0.79]] } }),
        J({ id: 'J-218', mode: 'model', ds: 'DS-05', dv: 'v2', st: 'done', prog: 100, n: 246, by: 'Vũ Đức', at: '11/06 09:00', dur: '29 phút', base: true, A: { model: MODELS[0] }, B: { model: MODELS[1] },
          res: { m: [[0.81, 0.82], [0.80, 0.79], [0.77, 0.78], [0.85, 0.84]], cases: [['C-0221', 0.52, 0.81], ['C-0240', 0.83, 0.82], ['C-0241', 0.78, 0.78], ['C-0225', 0.90, 0.89]] } }),
        J({ id: 'J-217', mode: 'kb', ds: 'DS-02', dv: 'v2', st: 'running', prog: 30, n: 210, by: 'Nguyễn Lan', at: '14/06 09:50', A: { kbv: 'v6' }, B: { kbv: 'v7' } }),
        J({ id: 'J-216', mode: 'prompt', ds: 'DS-03', dv: 'v3', draft: true, st: 'failed', prog: 23, n: 180, by: 'Trần Hải', at: '13/06 17:20', A: { prompt: 'answer-prompt v7' }, B: { prompt: 'answer-prompt v8' }, err: 'Timeout retriever sau 41/180 case · mã r-5b19e0\n[17:31:02] retriever dense: request timeout (30s) · shard kyc-02\n[17:31:02] job dừng ở bước Sinh câu trả lời A' }),
        J({ id: 'J-215', mode: 'kb', ds: 'DS-05', dv: 'v1', st: 'done', prog: 100, n: 240, by: 'Vũ Đức', at: '30/05 10:00', dur: '27 phút', A: { kbv: 'v4' }, B: { kbv: 'v5' },
          res: { m: [[0.78, 0.81], [0.79, 0.80], [0.74, 0.77], [0.82, 0.85]], cases: [['C-0221', 0.48, 0.52], ['C-0225', 0.88, 0.90], ['C-0242', 0.86, 0.86]] } }),
        J({ id: 'J-214', mode: 'model', ds: 'DS-02', dv: 'v1', st: 'done', prog: 100, n: 200, by: 'Nguyễn Lan', at: '28/05 14:00', dur: '22 phút', base: true, A: { model: MODELS[0] }, B: { model: MODELS[2] },
          res: { m: [[0.86, 0.80], [0.84, 0.81], [0.80, 0.78], [0.88, 0.83]], cases: [['C-0203', 0.88, 0.74], ['C-0096', 0.84, 0.90], ['C-0207', 0.90, 0.85]] } }),
        J({ id: 'J-209', mode: 'kb', ds: 'DS-01', dv: 'v2', st: 'done', prog: 100, n: 312, by: 'Nguyễn Lan', at: '29/05 10:30', dur: '33 phút', A: { kbv: 'v11' }, B: { kbv: 'v12' },
          res: { m: [[0.82, 0.84], [0.81, 0.82], [0.75, 0.76], [0.86, 0.87]], cases: [['C-0187', 0.60, 0.61], ['C-0262', 0.72, 0.80]] } })
      ];
      var jobSeq = 222, curJob = null, jobView = 'detail';
      function jobById(id) { return JOBS.filter(function (j) { return j.id === id; })[0] || null; }
      function r2(x) { return Math.round(x * 100) / 100; }
      function dfmt(x) { x = r2(x); return (x > 0 ? '+' : x < 0 ? '−' : '±') + sfmt(Math.abs(x)); }
      function sfmt(x) { return I18N && I18N.fmtNum ? I18N.fmtNum(x, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : x.toFixed(2).replace('.', ','); }
      function isReg(a, b) { return r2(b - a) <= -0.03; }
      function caseKind(a, b) { var d = r2(b - a); return d <= -0.03 ? 'reg' : d >= 0.03 ? 'up' : 'same'; }
      function jobRegN(j) { return j.res ? j.res.m.filter(function (m) { return isReg(m[0], m[1]); }).length : 0; }
      function shortModel(m) { return m.replace(' (on-prem)', '').replace('Llama-3.1-', 'Llama-').replace('Qwen2.5-', 'Qwen-'); }
      function abShort(j) {
        if (j.mode === 'kb') return 'KB ' + j.a.kbv + ' → ' + j.b.kbv;
        if (j.mode === 'prompt') return 'Prompt ' + j.a.prompt.replace('answer-prompt ', '') + ' → ' + j.b.prompt.replace('answer-prompt ', '');
        return shortModel(j.a.model) + ' → ' + shortModel(j.b.model);
      }
      function abLong(j) {
        if (j.mode === 'kb') return KBN[j.kb] + ' ' + j.a.kbv + ' vs ' + j.b.kbv;
        if (j.mode === 'prompt') return j.a.prompt + ' vs ' + j.b.prompt;
        return j.a.model + ' vs ' + j.b.model;
      }
      function dsvLabel(j) { return j.ds + '@' + j.dv + (j.draft ? ' (' + T('qnd.e.draftShort', 'nháp') + ')' : ''); }
      function jobRow(j) {
        var tr = jobsTb.querySelector('tr[data-id="' + j.id + '"]'), isNew = !tr;
        if (isNew) { tr = document.createElement('tr'); tr.setAttribute('data-qrow', ''); tr.setAttribute('data-id', j.id); }
        tr.setAttribute('data-st', j.st); tr.setAttribute('data-dsv', j.ds); tr.setAttribute('data-kb', j.kb);
        tr.setAttribute('data-f-title', j.id + ' · ' + MODE[j.mode][0]); tr.setAttribute('data-f-sub', dsvLabel(j) + ' · ' + abLong(j));
        tr.textContent = '';
        // the job ID is the row's real control (button opens the run in the panel); rows are not focusable themselves
        var c1 = el('td'), ob = el('button', 'q-rowlink', j.id); ob.type = 'button'; ob.setAttribute('data-qrow-open', ''); ob.setAttribute('aria-label', T('qnd.e.openJob', 'Mở job {id}', { id: j.id })); c1.appendChild(ob);
        if (j.base) { c1.appendChild(el('div', 'text-xs muted q-job-base', 'Baseline')); }
        var c2 = el('td', 'q-c'); c2.appendChild(el('span', 'chip ' + MODE[j.mode][2], MODE[j.mode][1]));
        var c3 = el('td', 'q-c'), d3 = el('div', 'job-ell text-sm', dsvLabel(j)); d3.title = dsvLabel(j) + ' · ' + (dsRow(j.ds).getAttribute('data-f-name') || ''); c3.appendChild(d3);
        var c4 = el('td'), d4 = el('div', 'job-ell text-sm', abShort(j)); d4.title = abLong(j); c4.appendChild(d4);
        // one status chip; the comparison outcome lives in its own "Kết quả" column
        var c5 = el('td', 'q-c'), st = el('div', 'q-job-st'); st.appendChild(el('span', 'chip ' + JST[j.st][1], JST[j.st][0])); c5.appendChild(st);
        if (j.st === 'running') {
          var pc = el('div', 'q-conf'), done = Math.round(j.n * j.prog / 100);
          pc.appendChild(el('span', 'text-xs muted', T('qnd.e.progCases', '{d}/{n} case · {p}%', { d: done, n: j.n, p: j.prog })));
          var pg = el('div', 'progress'); pg.setAttribute('role', 'progressbar'); pg.setAttribute('aria-valuenow', j.prog); pg.setAttribute('aria-valuemin', '0'); pg.setAttribute('aria-valuemax', '100'); pg.setAttribute('aria-label', T('qnd.e.progAria', 'Tiến độ {p}%', { p: j.prog }));
          var sp = el('span'); sp.style.width = j.prog + '%'; pg.appendChild(sp); pc.appendChild(pg); c5.appendChild(pc);
        } else if (j.st === 'queued') c5.appendChild(el('div', 'text-xs muted', T('qnd.e.waitRes', 'Chờ tài nguyên')));
        var c5r = el('td', 'q-c');
        if (j.st === 'done') {
          var rn = jobRegN(j), res = el('span', 'q-res ' + (rn ? 'is-fail' : 'is-pass'));
          var ic = el('span', '', rn ? '✗' : '✓'); ic.setAttribute('aria-hidden', 'true'); res.appendChild(ic);
          res.appendChild(el('span', '', rn ? T('qnd.e.nReg', '{n} regression', { n: rn }) : T('qnd.e.pass', 'Đạt'))); c5r.appendChild(res);
        } else c5r.appendChild(el('span', 'muted', '—'));
        var c6 = el('td', 'qc-lo'), d6 = el('div', 'job-ell text-sm', j.by); d6.title = j.by; d6.setAttribute('data-i18n-skip', ''); c6.appendChild(d6);
        var c7 = el('td', 'text-sm qc-lo q-c', atTxt(j.at));
        [c1, c2, c3, c4, c5, c5r, c6, c7].forEach(function (c) { tr.appendChild(c); });
        if (isNew) { var tb = jobsTb.querySelector('tbody'); tb.insertBefore(tr, tb.firstElementChild); }
        return tr;
      }
      function jobKpi() {
        var running = JOBS.filter(function (j) { return j.st === 'running'; }).length;
        var bd = document.querySelector('[data-jobs-badge]'); if (bd) { bd.hidden = !running; bd.textContent = running + ' đang chạy'; }
      }
      function jobDsvOpts() {
        var s = document.getElementById('ej-dsv'), cur = s.value; s.querySelectorAll('option:not([value=""])').forEach(function (o) { o.remove(); });
        // one option per dataset (FE runs-panel.tsx: "DS-01 · name")
        Object.keys(VERS).forEach(function (id) { var r = dsRow(id), o = document.createElement('option'); o.value = id; o.textContent = id + ' · ' + (r ? r.getAttribute('data-f-name') : ''); o.setAttribute('data-i18n-skip', ''); s.appendChild(o); });
        s.value = cur;
      }
      function jobUrl() {
        if (jobsTab.hidden) return;
        var u = new URLSearchParams(location.search); u.set('tab', 'jobs'); ['ds', 'q', 'v'].forEach(function (k) { u.delete(k); });
        if (curJob && !evSplit.classList.contains('side-closed')) u.set('job', curJob); else u.delete('job');
        try { history.replaceState(null, '', '?' + u.toString()); } catch (e) {}
      }
      function setJobDsv(dsv) {
        var s = document.getElementById('ej-dsv');
        s.value = String(dsv).split('@')[0]; qfRun(jobsTab);
      }
      // The in-page Datasets/Đánh giá tabs were removed; show the jobs panel directly.
      function showJobsPanel() {
        if (!jobsTab.hidden) return;
        if (qEditOn) setEditMode(false);
        var dsPanel = document.getElementById('ep-datasets');
        if (dsPanel) dsPanel.hidden = true;
        jobsTab.hidden = false;
        document.querySelectorAll('#etab-datasets, #etab-jobs').forEach(function (t) { t.setAttribute('aria-selected', String(t.id === 'etab-jobs')); });
        evMain.classList.add('q-jobs-tab');
        evMain.classList.remove('q-ds-detail');
        evSide.removeAttribute('data-ds-ro');
      }
      function showJobs(dsv) {
        showJobsPanel();
        if (dsv) setJobDsv(dsv);
        setTimeout(function () { document.getElementById('ej-dsv').focus(); }, 0);
      }
      function openJob(id, keepFilters) {
        showJobsPanel();
        var tr = jobsTb.querySelector('tr[data-id="' + id + '"]'); if (!tr) return;
        if (!keepFilters || tr.hidden) {
          jobsTab.querySelectorAll('[data-qf-dim]').forEach(function (g) { if (g.tagName === 'SELECT') g.value = ''; else g.querySelectorAll('[data-qf-val]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-qf-val') === 'all')); }); });
          qfRun(jobsTab);
        }
        setTimeout(function () { qOpen(jobsTb, tr); var ob = tr.querySelector('[data-qrow-open]'); if (ob) ob.focus(); }, 0);
      }
      function cfgTable(j) {
        // A and B are stacked in one cell (full values, wrapping) instead of two truncated columns
        var t = el('table', 'table q-table q-cfg-ab'), th = el('thead'), hr = el('tr');
        [T('qnd.e.component', 'Thành phần'), 'A / B'].forEach(function (h) { var x = el('th', '', h); x.scope = 'col'; hr.appendChild(x); });
        th.appendChild(hr); t.appendChild(th);
        var tb = el('tbody');
        [[T('common.kb', 'Tri thức'), 'kbv', function (v) { return KBN[j.kb] + ' ' + v; }], ['Prompt', 'prompt'], ['Model', 'model'], ['Retriever', 'retr'], ['Chunking', 'chunk']].forEach(function (f) {
          var r = el('tr'), fn = f[2] || function (v) { return v; }, diff = j.a[f[1]] !== j.b[f[1]];
          if (diff) r.className = 'is-diff';
          var h = el('th', '', f[0]); h.scope = 'row'; r.appendChild(h);
          var td = el('td');
          (diff ? [['A', j.a], ['B', j.b]] : [['A = B', j.a]]).forEach(function (p) { var ln = el('div', 'q-ab'); ln.appendChild(el('span', 'q-ab-k', p[0])); ln.appendChild(el('span', '', fn(p[1][f[1]]))); td.appendChild(ln); });
          r.appendChild(td); tb.appendChild(r);
        });
        t.appendChild(tb);
        var cap = el('caption', 'sr-only', T('qnd.e.cfgCap', 'Cấu hình A và B')); t.insertBefore(cap, t.firstChild);
        return t;
      }
      function stepsOl(j) {
        var ol = el('ol', 'jsteps'), cur = j.st === 'queued' ? -1 : j.st === 'done' ? 5 : Math.min(4, Math.floor(j.prog / 20));
        STEPS.forEach(function (s, i) {
          var cls = i < cur ? 'is-done' : i === cur ? (j.st === 'failed' ? 'is-failed' : 'is-running') : 'is-pending';
          var li = el('li', 'jstep ' + cls), dot = el('span', 'jstep-dot', String(i + 1)); dot.setAttribute('aria-hidden', 'true'); li.appendChild(dot);
          var b = el('div'); b.appendChild(el('div', 'jstep-t', s));
          var sub = i < cur ? T('qnd.e.stDone', 'Xong') : i === cur ? (j.st === 'failed' ? T('qnd.e.failed', 'Lỗi') : T('qnd.e.stRunning', 'Đang chạy · {p}%', { p: j.prog })) : (j.st === 'queued' && i === 0 ? T('qnd.e.waitRes', 'Chờ tài nguyên') : '');
          if (sub) b.appendChild(el('div', 'text-xs muted', sub));
          li.appendChild(b); ol.appendChild(li);
        });
        return ol;
      }
      function caseQ(j, c) {
        var tr = dsDet.querySelector('table[data-ds-table="' + j.ds + '"] tr[data-f-title="' + c + '"]');
        return tr ? qText(tr) : c;
      }
      function renderJob(j) {
        var slot = evSide.querySelector('[data-qtpl-slot]'); if (!slot) return;
        jobView = 'detail'; curJob = j.id;
        var tt = evSide.querySelector('[data-f="title"]'), ts = evSide.querySelector('[data-f="sub"]');
        tt.textContent = j.id + ' · ' + MODE[j.mode][0]; tt.title = tt.textContent; ts.textContent = dsvLabel(j) + ' · ' + abLong(j); ts.title = ts.textContent;
        slot.textContent = '';
        var body = el('div', 'fill-body job-side-body');
        var hd = el('div', 'q-job-st'); hd.appendChild(el('span', 'chip ' + MODE[j.mode][2], MODE[j.mode][1])); hd.appendChild(el('span', 'chip ' + JST[j.st][1], JST[j.st][0]));
        if (j.base) hd.appendChild(el('span', 'chip chip-success', 'Baseline'));
        if (j.draft) hd.appendChild(el('span', 'chip chip-warning', T('qnd.e.draftChip', 'Bản nháp')));
        body.appendChild(hd);
        body.appendChild(el('h3', 'sub-h mt-12', T('qnd.e.cfgAB', 'Cấu hình A vs B')));
        body.appendChild(cfgTable(j));
        var dl = el('dl', 'kv mt-12');
        // [label, value, user content?] — names and dataset titles keep data-i18n-skip, labels are translated
        [['Dataset', dsvLabel(j) + ' · ' + dsRow(j.ds).getAttribute('data-f-name'), 1], [T('qnd.e.nCases', 'Số case'), T('qnd.e.nApprovedQ', '{n} câu đã duyệt', { n: I18N && I18N.fmtNum ? I18N.fmtNum(j.n) : j.n })], [T('qnd.e.runBy', 'Người chạy'), j.by, 1], [T('tj.started', 'Bắt đầu'), atTxt(j.at)], [T('qnd.e.duration', 'Thời gian'), j.dur ? String(j.dur).replace('phút', T('qnd.e.minutes', 'phút')) : (j.st === 'running' ? T('common.running', 'Đang chạy') : '—')], ['Metric', METRICS.join(', ')]].forEach(function (p) { dl.appendChild(el('dt', '', p[0])); var dd = el('dd', 'job-ell', p[1]); dd.title = p[1]; if (p[2]) dd.setAttribute('data-i18n-skip', ''); dl.appendChild(dd); });
        body.appendChild(dl);
        body.appendChild(el('h3', 'sub-h mt-12', T('qnd.e.progress', 'Tiến trình')));
        body.appendChild(stepsOl(j));
        if (j.st === 'failed') body.appendChild(el('pre', 'job-log', j.err));
        if (j.st === 'done' && j.res) {
          body.appendChild(el('h3', 'sub-h mt-12', T('qnd.e.cmpResult', 'Kết quả so sánh')));
          var mt = el('table', 'table q-table q-metric-ab'); mt.appendChild(el('caption', 'sr-only', T('qnd.e.metricCap', 'Metric A, B và chênh lệch')));
          var mh = el('tr'); ['Metric', 'A', 'B', 'Δ', T('qnd.e.verdict', 'Đánh giá')].forEach(function (h, i) { var x = el('th', i && i < 4 ? 'q-num' : i ? 'q-c' : '', h); x.scope = 'col'; mh.appendChild(x); });
          var mth = el('thead'); mth.appendChild(mh); mt.appendChild(mth);
          var mtb = el('tbody');
          j.res.m.forEach(function (m, i) {
            var r = el('tr'), h = el('th', '', METRICS[i]); h.scope = 'row'; r.appendChild(h);
            r.appendChild(el('td', 'q-num', sfmt(m[0]))); r.appendChild(el('td', 'q-num', sfmt(m[1]))); r.appendChild(el('td', 'q-num', dfmt(m[1] - m[0])));
            var k = caseKind(m[0], m[1]), td = el('td', 'q-c');
            td.appendChild(el('span', 'chip ' + (k === 'reg' ? 'chip-error' : k === 'up' ? 'chip-success' : 'chip-neutral'), k === 'reg' ? '↓ regression' : k === 'up' ? T('qnd.e.upArrow', '↑ cải thiện') : T('qnd.e.same', 'Không đổi')));
            r.appendChild(td); mtb.appendChild(r);
          });
          mt.appendChild(mtb); body.appendChild(mt);
          body.appendChild(el('p', 'text-xs muted q-job-thr', T('qnd.e.thr', 'Ngưỡng regression: Δ ≤ {d} (B so với A)', { d: dfmt(-0.03) })));
          var ch = el('div', 'row-between q-job-caseh'); ch.appendChild(el('h3', 'sub-h', 'Case (Faithfulness)'));
          var cg = el('span', 'q-cg'); cg.setAttribute('role', 'group'); cg.setAttribute('aria-label', T('qnd.e.caseFilter', 'Lọc case theo thay đổi'));
          [['all', T('common.all', 'Tất cả')], ['reg', 'Regression'], ['up', T('qnd.e.up', 'Cải thiện')], ['same', T('qnd.e.same', 'Không đổi')]].forEach(function (f) { var b = el('button', 'chip-filter', f[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(f[0] === 'all')); b.setAttribute('data-jcase-f', f[0]); cg.appendChild(b); });
          ch.appendChild(cg); body.appendChild(ch);
          var ct = el('table', 'table q-table q-job-cases'); ct.appendChild(el('caption', 'sr-only', T('qnd.e.caseCap', 'Kết quả theo case')));
          var cgp = el('colgroup'); ['w-72', '', 'w-44', 'w-44', 'w-104'].forEach(function (w) { var c = el('col', w || ''); cgp.appendChild(c); }); ct.appendChild(cgp);
          var chr = el('tr'); ['Case', T('common.question', 'Câu hỏi'), 'A', 'B', T('common.changes', 'Thay đổi')].forEach(function (h, i) { var x = el('th', i === 2 || i === 3 ? 'q-num' : i === 4 ? 'q-c' : '', h); x.scope = 'col'; chr.appendChild(x); });
          var cth = el('thead'); cth.appendChild(chr); ct.appendChild(cth);
          var ctb = el('tbody');
          j.res.cases.forEach(function (c) {
            var k = caseKind(c[1], c[2]), r = el('tr'); r.setAttribute('data-jcase', c[0]); r.setAttribute('data-delta', k);
            // the case ID is a real button (opens the trace); rows are not focusable themselves
            var cd = el('td'), cb = el('button', 'q-rowlink', c[0]); cb.type = 'button'; cb.setAttribute('data-jcase-open', ''); cb.setAttribute('aria-label', T('qnd.e.viewTrace', 'Xem trace {id}', { id: c[0] })); cd.appendChild(cb); r.appendChild(cd);
            var q = caseQ(j, c[0]), qd = el('td'), qx = el('div', 'job-ell', q); qx.title = q; qx.setAttribute('data-i18n-skip', ''); qd.appendChild(qx); r.appendChild(qd);
            r.appendChild(el('td', 'q-num', sfmt(c[1]))); r.appendChild(el('td', 'q-num', sfmt(c[2])));
            var kd = el('td', 'q-c'); kd.appendChild(el('span', 'chip ' + (k === 'reg' ? 'chip-error' : k === 'up' ? 'chip-success' : 'chip-neutral'), k === 'reg' ? 'Regression' : k === 'up' ? T('qnd.e.up', 'Cải thiện') : T('qnd.e.same', 'Không đổi'))); r.appendChild(kd);
            ctb.appendChild(r);
          });
          var emp = el('tr', 'filter-empty'); emp.hidden = true; var ed = el('td', 'muted', T('qnd.e.noCase', 'Không có case khớp bộ lọc')); ed.colSpan = 5; emp.appendChild(ed); ctb.appendChild(emp);
          ct.appendChild(ctb); body.appendChild(ct);
        }
        slot.appendChild(body);
        var foot = el('div', 'job-side-foot');
        if (j.st === 'done') {
          var gp = el('a', 'btn btn-secondary', T('qnd.e.createGap', 'Tạo gap')); gp.href = 'quality-gaps.html'; foot.appendChild(gp);
        }
        if (foot.children.length) slot.appendChild(foot);
        applyRoleGates();
      }
      function renderTrace(j, cid) {
        var slot = evSide.querySelector('[data-qtpl-slot]'), c = j.res.cases.filter(function (x) { return x[0] === cid; })[0]; if (!slot || !c) return;
        jobView = 'trace';
        var tt = evSide.querySelector('[data-f="title"]'), ts = evSide.querySelector('[data-f="sub"]');
        tt.textContent = 'Trace · ' + cid; tt.title = tt.textContent; ts.textContent = j.id + ' · Faithfulness B ' + sfmt(c[2]); ts.title = ts.textContent;
        slot.textContent = '';
        var tpl = document.querySelector('template[data-qtpl="' + cid + '"]');
        if (tpl) { var w = el('div', 'q-trace-wrap'); w.innerHTML = tpl.innerHTML; while (w.firstChild) slot.appendChild(w.firstChild); if (I18N) I18N.apply(slot); }
        // in-body back to the run (FE TraceBody: ghost "← Về {id}" above the facts)
        var tb0 = slot.querySelector('.job-side-body');
        if (tb0) { var bk = el('button', 'btn btn-sm btn-ghost', '← ' + T('evl.backTo', 'Về {id}', { id: j.id })); bk.type = 'button'; bk.addEventListener('click', function () { renderJob(j); }); tb0.insertBefore(bk, tb0.firstChild); var dl0 = tb0.querySelector('dl.kv'); if (dl0) dl0.classList.add('mt-12'); }
        else {
          var body = el('div', 'fill-body job-side-body');
          var dl = el('dl', 'kv');
          [[T('common.question', 'Câu hỏi'), caseQ(j, cid), 1], [T('qnd.e.cfgB', 'Cấu hình B'), j.mode === 'kb' ? KBN[j.kb] + ' ' + j.b.kbv : j.mode === 'prompt' ? j.b.prompt : j.b.model, 1], [T('qnd.e.scoreAB', 'Điểm A · B'), sfmt(c[1]) + ' · ' + sfmt(c[2]) + ' (' + dfmt(c[2] - c[1]) + ')']].forEach(function (p) { dl.appendChild(el('dt', '', p[0])); var dd = el('dd', '', p[1]); if (p[2]) dd.setAttribute('data-i18n-skip', ''); dl.appendChild(dd); });
          body.appendChild(dl);
          body.appendChild(el('h3', 'sub-h mt-12', T('qnd.e.steps', 'Các bước')));
          var ol = el('ol', 'jsteps');
          [[T('qnd.e.tr1', 'Phân tích câu hỏi'), T('qnd.e.tr1d', 'Ý định và thực thể chính')], [T('qnd.e.tr2', 'Truy xuất top-5'), T('qnd.e.tr2d', 'Hybrid · tri thức {kb}', { kb: KBN[j.kb] + ' ' + j.b.kbv })], [T('qnd.e.tr3', 'Trả lời'), j.b.model + ' · ' + j.b.prompt], [T('qnd.e.tr4', 'Chấm điểm · {s}', { s: sfmt(c[2]) }), caseKind(c[1], c[2]) === 'reg' ? T('qnd.e.tr4bad', 'Judge: câu trả lời B thiếu một điều kiện so với tham chiếu') : T('qnd.e.tr4ok', 'Judge: câu trả lời khớp câu trả lời tham chiếu')]].forEach(function (s, i) {
            var li = el('li', 'jstep is-done'), d = el('span', 'jstep-dot', String(i + 1)); d.setAttribute('aria-hidden', 'true'); li.appendChild(d);
            var b = el('div'); b.appendChild(el('div', 'jstep-t', s[0])); b.appendChild(el('div', 'text-xs muted', s[1])); li.appendChild(b); ol.appendChild(li);
          });
          body.appendChild(ol); slot.appendChild(body);
          var foot = el('div', 'job-side-foot'), ev = el('a', 'btn btn-secondary', T('qnd.e.openEvidence', 'Mở evidence')); ev.href = 'document-workspace.html'; foot.appendChild(ev);
          var gp = el('a', 'btn btn-primary', T('qnd.e.createGap', 'Tạo gap')); gp.href = 'quality-gaps.html'; foot.appendChild(gp); slot.appendChild(foot);
        }
      }
      evSide.addEventListener('ecp-qopen', function (e) {
        var r = e.detail && e.detail.row; if (!r || !r.closest('#et-jobs')) return;
        var j = jobById(r.getAttribute('data-id')); if (j) { renderJob(j); jobUrl(); }
      });
      evSide.addEventListener('click', function (e) {
        var j = curJob && jobById(curJob); if (!j || !jobsTb.querySelector('tr.selected')) return;
        var f = e.target.closest('[data-jcase-f]');
        if (f) {
          var k = f.getAttribute('data-jcase-f'), n = 0;
          f.parentNode.querySelectorAll('[data-jcase-f]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === f)); });
          evSide.querySelectorAll('tr[data-jcase]').forEach(function (r) { var ok = k === 'all' || r.getAttribute('data-delta') === k; r.hidden = !ok; if (ok) n++; });
          var em = evSide.querySelector('.q-job-cases .filter-empty'); if (em) em.hidden = n > 0;
          return;
        }
        var cr = e.target.closest('tr[data-jcase]'); if (cr && (!e.target.closest('a, button') || e.target.closest('[data-jcase-open]'))) renderTrace(j, cr.getAttribute('data-jcase'));
      });
      evSide.addEventListener('keydown', function (e) {
        var cr = e.key === 'Enter' && e.target.closest && e.target.closest('tr[data-jcase]'), j = curJob && jobById(curJob);
        if (cr && j) { e.preventDefault(); renderTrace(j, cr.getAttribute('data-jcase')); }
      });
      evSplit.querySelectorAll('[data-qpanel-close]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(jobUrl, 0); }); });
      // simulated progress: Hàng đợi → Đang chạy → Hoàn tất (only jobs created in this session)
      function mockResult(j) {
        var base = { kb: [[0.84, 0.87], [0.82, 0.84], [0.77, 0.80], [0.87, 0.89]], prompt: [[0.86, 0.85], [0.83, 0.86], [0.79, 0.80], [0.89, 0.85]], model: [[0.86, 0.83], [0.84, 0.82], [0.80, 0.79], [0.88, 0.86]] }[j.mode];
        var rows = [].slice.call(dsDet.querySelectorAll('table[data-ds-table="' + j.ds + '"] tr[data-qrow][data-st="ok"]:not(.q-row-del)')).slice(0, 4);
        var sc = [[0.88, 0.80], [0.79, 0.86], [0.90, 0.90], [0.72, 0.73]];
        return { m: base, cases: rows.map(function (r, i) { return [r.getAttribute('data-f-title'), sc[i][0], sc[i][1]]; }) };
      }
      function tick() {
        var any = false;
        JOBS.forEach(function (j) {
          if (!j.sim) return; any = true;
          j.age++;
          if (j.st === 'queued' && j.age >= 2) { j.st = 'running'; j.prog = 4; }
          else if (j.st === 'running') { j.prog = Math.min(100, j.prog + 16); if (j.prog >= 100) { j.st = 'done'; j.prog = 100; j.dur = '1 phút'; j.res = mockResult(j); j.sim = false; if (j.setBase) { JOBS.forEach(function (x) { if (x !== j && x.ds === j.ds && x.base) { x.base = false; jobRow(x); } }); j.base = true; } toast(j.id + ' hoàn tất · ' + (jobRegN(j) ? jobRegN(j) + ' regression' : 'không regression'), { label: 'Xem job', fn: function () { openJob(j.id); } }); } }
          else return;
          var tr = jobRow(j);
          if (curJob === j.id && jobView === 'detail' && tr.classList.contains('selected') && !evSplit.classList.contains('side-closed')) renderJob(j);
        });
        if (any) { jobKpi(); qfRun(jobsTab); }
      }
      setInterval(tick, 1000);
      function createJob(o) {
        var x = { kb: dsRow(o.ds).getAttribute('data-kb'), a: cp(o.A), b: cp(o.B), id: 'J-' + (++jobSeq), mode: o.mode, ds: o.ds, dv: o.dv, draft: !!o.draft, n: o.n, st: 'queued', prog: 0, by: BY[getRole()], at: today() + ' ' + now(), sim: true, age: 0, setBase: !!o.setBase };
        JOBS.unshift(x); jobRow(x); jobKpi(); jobDsvOpts(); qfRun(jobsTab);
        var p = !x.draft && pubOf(x.ds, x.dv); if (p) p.runs.push(x.id); else if (x.draft) { VERS[x.ds].draftRuns = (VERS[x.ds].draftRuns || []).concat([x.id]); }
        return x;
      }
      JOBS.slice().reverse().forEach(jobRow);
      jobKpi(); jobDsvOpts();

      // popup "Chạy đánh giá"
      var rn = document.getElementById('dlg-q-run'), rnDs = rn.querySelector('#rn-ds'), rnDv = rn.querySelector('#rn-dv'), rnA = rn.querySelector('#rn-a'), rnB = rn.querySelector('#rn-b'), rnOk = rn.querySelector('#rn-ok'), rnBase = rn.querySelector('#rn-base');
      function rnMode() { var c = rn.querySelector('input[name="rn-mode"]:checked'); return c ? c.value : 'kb'; }
      function opts(sel, list, def) { sel.textContent = ''; list.forEach(function (p) { var o = document.createElement('option'); o.value = p[0]; o.textContent = p[1]; sel.appendChild(o); }); if (def !== undefined) sel.value = def; }
      function rnFillDv(pref) {
        // FE run-dialog.tsx: "v3" / "v4 · bản nháp"
        var id = rnDs.value, x = VERS[id], lp = lastPub(id), list = x.pub.slice().reverse().map(function (p) { return [p.v, p.v]; });
        list.push([x.draft.v, x.draft.v + ' · ' + T('q.ver.draftChip', 'bản nháp')]);
        opts(rnDv, list, pref && allKeys(id).indexOf(pref) > -1 ? pref : (lp ? lp.v : x.draft.v));
      }
      function rnFillAB() {
        var m = rnMode(), kb = dsRow(rnDs.value).getAttribute('data-kb'), kbn = KBN[kb], kv = KBV[kb];
        var L = { kb: [T('qnd.e.kbVerA', 'Version tri thức A'), T('qnd.e.kbVerB', 'Version tri thức B')], prompt: ['Prompt A', 'Prompt B'], model: ['Model A', 'Model B'] }[m];
        rn.querySelector('#rn-la').textContent = L[0]; rn.querySelector('#rn-lb').textContent = L[1];
        if (m === 'kb') { var kl = ['v' + (parseInt(kv[0].slice(1), 10) - 1)].concat(kv).map(function (v) { return [v, kbn + ' ' + v]; }); opts(rnA, kl, kv[0]); opts(rnB, kl, kv[1]); }
        else if (m === 'prompt') { var pl = PROMPTS.map(function (p) { return [p, p]; }); opts(rnA, pl, PROMPTS[1]); opts(rnB, pl, PROMPTS[2]); }
        else { var ml = MODELS.map(function (p) { return [p, p]; }); opts(rnA, ml, MODELS[0]); opts(rnB, ml, MODELS[1]); }
        var kbl = T('common.kb', 'Tri thức') + ' ' + kv[1];
        rn.querySelector('#rn-fixed').textContent = T('evl.fixed', 'Giữ nguyên: {list}', { list: ({ kb: 'prompt answer-prompt v8 · model ' + MODELS[0], prompt: 'model ' + MODELS[0] + ' · ' + kbl, model: 'prompt answer-prompt v8 · ' + kbl })[m] });
        rnCheck();
      }
      // the dataset's approved count, whatever version is picked (FE run-dialog.tsx)
      function rnOkCount() { return num(dsRow(rnDs.value).querySelector('[data-cnt="ok"]')); }
      function rnCheck() {
        var id = rnDs.value, dr = isDraft(id, rnDv.value), same = rnA.value === rnB.value, n = rnOkCount();
        rn.querySelector('#rn-draftwarn').hidden = !dr;
        var er = rn.querySelector('#rn-err'), f = rnB.closest('.field');
        er.textContent = same ? T('evl.sameAB', 'A và B phải khác nhau') : ''; er.hidden = !same; f.classList.toggle('has-error', same);
        if (same) rnB.setAttribute('aria-invalid', 'true'); else rnB.removeAttribute('aria-invalid');
        // FE: the baseline box is off on a draft, with the draft note under it; no role gate in the dialog
        rnBase.disabled = dr; if (dr) rnBase.checked = false;
        var bw = rn.querySelector('#rn-base-why'); bw.hidden = !dr; bw.textContent = dr ? T('q.ver.draftNoRun', 'Run trên bản nháp chỉ để tham khảo, không làm baseline') : '';
        rn.querySelector('#rn-base-l').textContent = T('evl.baseFor', 'Đặt kết quả A làm baseline cho {id}', { id: id });
        rnOk.disabled = same || !n;
        rn.querySelector('#rn-note').textContent = n ? T('evl.runNote', 'Chấm {n} câu đã duyệt · job vào Hàng đợi, theo dõi trong tab Lượt chạy', { n: fmt(n) }) : T('evl.runNoApproved', 'Chưa có câu hỏi đã duyệt để chấm');
      }
      DLG['dlg-q-run'] = function (d) {
        var op = d.__opener, id = (op && op.getAttribute('data-run-ds')) || curDs || 'DS-01';
        opts(rnDs, Object.keys(VERS).map(function (k) { var r = dsRow(k); return [k, k + ' · ' + (r ? r.getAttribute('data-f-name') : '')]; }), id);
        var pref = op && op.hasAttribute('data-ds-run') && curDs === id && curVer && !isDraft(id, curVer) ? curVer : null;
        rnFillDv(pref);
        var m0 = rn.querySelector('input[name="rn-mode"][value="kb"]'); m0.checked = true;
        rnFillAB();
      };
      rnDs.addEventListener('change', function () { rnFillDv(); rnFillAB(); });
      rnDv.addEventListener('change', rnCheck);
      [rnA, rnB].forEach(function (s) { s.addEventListener('change', rnCheck); });
      rn.addEventListener('change', function (e) { if (e.target.name === 'rn-mode') rnFillAB(); });
      rnOk.addEventListener('click', function () {
        rnCheck(); if (rnOk.disabled) return;
        var m = rnMode(), id = rnDs.value, kb = dsRow(id).getAttribute('data-kb'), A = cfgOf(kb), B = cfgOf(kb), key = { kb: 'kbv', prompt: 'prompt', model: 'model' }[m];
        A[key] = rnA.value; B[key] = rnB.value;
        var j = createJob({ mode: m, ds: id, dv: rnDv.value, draft: isDraft(id, rnDv.value), n: rnOkCount(), A: A, B: B, setBase: rnBase.checked });
        rn.close();
        toast(T('evl.runStarted', 'Đã tạo {id} · Hàng đợi', { id: j.id }));
        openJob(j.id);
      });

      // deep link ?ds=&q= (after the generic ?tab= click)
      dsDet.querySelectorAll('table[data-ds-table]').forEach(function (t) {
        var id = t.getAttribute('data-ds-table'); if (!VERS[id]) return;
        t.querySelectorAll('[data-qrow]').forEach(function (tr) {
          if (!tr.hasAttribute('data-vin')) tr.setAttribute('data-vin', allKeys(id).join(' '));
          if (!tr.hasAttribute('data-pv')) tr.setAttribute('data-pv', (tr.lastElementChild.textContent.trim().split(/\s/)[0]) || 'v1');
        });
      });
      Object.keys(VERS).forEach(function (id) { rowVerSync(id); syncPublish(id); });
      kpiSync();
      var wantDs = (params.get('ds') || '').replace(/[^\w-]/g, ''), wantQ = (params.get('q') || '').replace(/[^\w-]/g, ''), wantV = /^v\d+$/.test(params.get('v') || '') ? params.get('v') : null;
      var wantDsv = params.get('dsv') || '', wantJob = (params.get('job') || '').replace(/[^\w-]/g, '');
      setTimeout(function () {
        if (/^DS-\d+@v\d+$/.test(wantDsv)) setJobDsv(wantDsv);
        if (wantJob && !jobsTab.hidden) openJob(wantJob, true);
        if (wantDs && !dsTab.hidden) dsOpen(wantDs, wantQ ? 'q-' + wantQ : null, wantV);
        else if (!dsTab.hidden) evSplit.classList.add('side-closed');
      }, 0);
    })();
    applyRoleGates();
    qfAll();
    onLang(function () { document.querySelectorAll('[data-bulk-scope]').forEach(bulkSync); });

    document.addEventListener('click', function (e) {
      var t = e.target.closest('button, [role="tab"]');
      if (!t) return;
      if (t.classList.contains('theme-toggle')) {
        setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      } else if (t.classList.contains('sb-toggle') && app) {
        if (MQ_OFF.matches) {
          // off-canvas: the toggle opens/closes the drawer; nothing is persisted
          var sbOpen = !app.classList.contains('sb-open');
          app.classList.toggle('sb-open', sbOpen);
          app.classList.toggle('is-collapsed', !sbOpen);
        } else {
          var nowCollapsed = app.classList.toggle('is-collapsed');
          // only the desktop choice is remembered; the <=1279px rail is automatic
          if (!MQ_RAIL.matches) { wideCollapsed = nowCollapsed; try { localStorage.setItem('ecp-sidebar', nowCollapsed ? 'collapsed' : 'expanded'); } catch (e) {} }
        }
        syncSidebar();
      } else if (t.getAttribute('role') === 'tab') {
        activateTab(t);
      } else if (t.classList.contains('section-toggle')) {
        var open = t.getAttribute('aria-expanded') !== 'true';
        t.setAttribute('aria-expanded', String(open));
        var body = document.getElementById(t.getAttribute('aria-controls'));
        if (body) body.hidden = !open;
      } else if (t.hasAttribute('data-hist-toggle')) {
        var wasOpen = !esl.classList.contains('history-collapsed');
        setHist(wasOpen, true);
        var other = document.querySelector(wasOpen ? '.hist-open' : '#hist [data-hist-toggle]');
        if (other) other.focus();
      } else if (t.hasAttribute('data-chat-toggle')) {
        var kg = document.querySelector('.kg-layout');
        if (kg) {
          var collapsed = kg.classList.toggle('chat-collapsed');
          kg.querySelectorAll('[data-chat-toggle]').forEach(function (x) {
            x.setAttribute('aria-expanded', String(!collapsed));
          });
          var focusTo = kg.querySelector(collapsed ? '.chat-reopen' : '.chat-head [data-chat-toggle]');
          if (focusTo) focusTo.focus();
        }
      } else if (t.hasAttribute('data-panel-toggle')) {
        var panel = document.getElementById(t.getAttribute('data-panel-toggle'));
        var exp = t.getAttribute('aria-expanded') !== 'true';
        // keep every toggle of the same panel in sync (close button inside + reopen button outside)
        document.querySelectorAll('[data-panel-toggle="' + t.getAttribute('data-panel-toggle') + '"]').forEach(function (x) {
          x.setAttribute('aria-expanded', String(exp));
        });
        if (panel) panel.classList.toggle('is-collapsed', !exp);
      } else if (t.hasAttribute('data-graph-toggle')) {
        if (t.getAttribute('data-graph-toggle') === 'off') setGraph(false);
        else setGraph(!(eslAny && eslAny.classList.contains('with-graph')));
      } else if (t.hasAttribute('data-drawer-open')) {
        openDrawer(t.getAttribute('data-drawer-open'), t);
      } else if (t.hasAttribute('data-drawer-close')) {
        closeDrawer();
      } else if (t.hasAttribute('aria-pressed') && t.closest('[data-exclusive]')) {
        var grp = t.closest('[data-exclusive]');
        grp.querySelectorAll('[aria-pressed]').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === t));
        });
        var rvId = grp.getAttribute('data-reveal'), rv = rvId && document.getElementById(rvId);
        if (rv) rv.hidden = !(t.hasAttribute('data-reveal-on') && t.getAttribute('aria-pressed') === 'true');
        // chip filters bound to a table: show only rows of the selected kind
        var pid = grp.getAttribute('data-row-filter');
        if (pid && t.hasAttribute('data-filter')) {
          var key = t.getAttribute('data-filter'), shown = 0;
          var panel = document.getElementById(pid);
          panel.querySelectorAll('tbody tr[data-kind]').forEach(function (r) {
            var ok = key === 'all' || r.getAttribute('data-kind') === key;
            r.hidden = !ok; if (ok) shown++;
          });
          var em = panel.querySelector('.filter-empty'); if (em) em.hidden = shown > 0;
        }
      } else if (t.hasAttribute('aria-pressed') && t.hasAttribute('data-toggle')) {
        t.setAttribute('aria-pressed', String(t.getAttribute('aria-pressed') !== 'true'));
      }
    });

    // Quality deep links (run after the click delegate so tabs/chips behave like real clicks)
    var dTab = params.get('tab');
    // Evaluation Lab: panels are selected by ?tab= from outside (the in-page tab switcher was removed).
    var evDatasets = document.getElementById('ep-datasets'), evJobs = document.getElementById('ep-jobs');
    if (evDatasets && evJobs) {
      // old tabs Runs/Compare were merged into Đánh giá (?tab=jobs)
      if (dTab === 'runs' || dTab === 'compare') {
        dTab = 'jobs';
        try { var ru = new URLSearchParams(location.search); ru.set('tab', 'jobs'); history.replaceState(null, '', '?' + ru.toString()); } catch (e) {}
      }
      var wantJobs = dTab === 'jobs';
      evDatasets.hidden = wantJobs;
      evJobs.hidden = !wantJobs;
      // the detail panel opens only for a picked row (?job= / ?ds= reopen it), never as a stale empty "Dataset · DS-01" panel
      var evSplit = evJobs.closest('.job-split'); if (evSplit) evSplit.classList.add('side-closed');
      document.querySelectorAll('#etab-datasets, #etab-jobs').forEach(function (t) { t.setAttribute('aria-selected', String((t.id === 'etab-jobs') === wantJobs)); });
      var evJobMain = evJobs.closest('.job-main'); if (evJobMain) evJobMain.classList.toggle('q-jobs-tab', wantJobs);
      var evShown = wantJobs ? evJobs : evDatasets;
      if (syncDetail) syncDetail(evShown);
    } else if (dTab) {
      var tabEl = document.querySelector('[role="tab"][data-tab="' + dTab.replace(/[^\w-]/g, '') + '"]'); if (tabEl) tabEl.click();
    }
    var dView = params.get('view');
    if (dView) { var vEl = document.querySelector('[data-view-switch] [data-view-key="' + dView.replace(/[^\w-]/g, '') + '"]'); if (vEl) vEl.click(); }
    params.forEach(function (val, key) {
      if (key.indexOf('f-') !== 0) return;
      var dim = key.slice(2).replace(/[^\w-]/g, ''), v = String(val).replace(/[^\w-]/g, '');
      document.querySelectorAll('[data-qf] [data-qf-dim="' + dim + '"]').forEach(function (g) {
        if (g.tagName === 'SELECT') { g.value = v; var w = g.closest('[data-qf]'); if (w) qfRun(w); }
        else { var c = g.querySelector('[data-qf-val="' + v + '"]'); if (c) c.click(); }
      });
    });
  });
})();
/* ===== Package Templates (config-templates.html): one editor panel per view, ?tpl= / ?state= deep links =====
 * [data-tpl-panel=<key>] is shown for ?state=create|pending|invalid (pending/invalid only for product-wiki), else ?tpl, else the first template in the list.
 * List clicks / Tạo switch panels in place and rewrite ?tpl / ?state (history.replaceState); links stay real hrefs.
 * [data-tpl-show="k …"] / [data-tpl-hide="k …"]: shown / hidden while panel k is active. Create view: header ← via KCBack.
 * &edit=1 (QA) opens the active panel in edit mode. Publish [data-tpl-confirm-go] opens the shared confirm dialog, OK → pending.
 * Leaving a template (list click, Tạo, Hủy) with unsaved Skill edits asks first ([data-tpl-leave], the shared confirm dialog). */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var panels = document.querySelectorAll('[data-tpl-panel]');
    if (!panels.length) return;
    var I = window.ECP_I18N, T = (I && I.tr) || function (k, v, a) { return String(v).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); };
    var Back = window.KCBack, DEF = 'product-wiki', cur = null, pendingGo = null;
    var items = document.querySelectorAll('.tpl-item[data-tpl]');
    var FIRST = items.length ? items[0].getAttribute('data-tpl') : DEF; // no ?tpl → first template in the list
    function has(k) { return !!document.querySelector('[data-tpl-panel="' + String(k).replace(/[^\w-]/g, '') + '"]'); }
    function inList(l, v) { return (' ' + (l || '') + ' ').indexOf(' ' + v + ' ') !== -1; }
    // Header breadcrumb tail (#crumb-add): "{name} [vN] › + Hành động"; the menu offers Sửa (not while editing, not for the
    // pending template) and Tạo. The editor head holds only Publish, Discard (drafts) or, in edit mode, ToC, Cancel, AI Skill Refine, Save.
    var crumb = document.getElementById('crumb-add');
    var NOPERM = 'Chỉ Admin (Knowledge Architect) được tạo và sửa template. Owner và Steward chỉ xem.';
    function resetEdit(panel) { if (panel && panel.classList.contains('is-editing')) setEditing(panel, false); }
    function renderCrumb() {
      if (!crumb || !cur) return;
      var p = document.querySelector('[data-tpl-panel="' + cur.panel + '"]');
      var it = cur.panel !== 'create' && cur.tpl ? document.querySelector('.tpl-item[data-tpl="' + cur.tpl + '"]') : null;
      var gate = ' data-roles-disable="owner steward" data-reason="' + NOPERM + '"';
      var canEdit = it && cur.panel !== 'pending' && !(p && p.classList.contains('is-editing'));
      crumb.innerHTML = (it
        ? '<span class="crumb-name" data-i18n-skip>' + escH(it.querySelector('.tpl-name').textContent) + '</span>' +
          '<button class="chip chip-info crumb-badge mono kvh-trigger" type="button" data-vh="tpl-' + escH(cur.tpl) + '"' + (cur.panel === 'pending' ? ' data-vh-b="v3"' : '') +
          ' aria-label="' + escH(T('vh.open', 'Lịch sử phiên bản')) + '" title="' + escH(T('vh.open', 'Lịch sử phiên bản')) + '">' + escH(it.querySelector('.tpl-meta .mono').textContent) + '</button>' +
          '<span class="sep" aria-hidden="true">›</span>' : '') +
        '<span class="crumb-menu"><button class="crumb-action" type="button" aria-haspopup="menu" aria-expanded="false" data-crumb-toggle>+ ' + escH(T('common.action', 'Hành động')) + '</button>' +
        '<div class="menu" role="menu" hidden>' +
        (canEdit ? '<button class="menu-item" type="button" role="menuitem" data-crumb-edit data-roles="admin">' + escH(T('common.edit', 'Sửa')) + '</button>' : '') +
        '<button class="menu-item" type="button" role="menuitem" data-tpl-nav="create"' + gate + '>' + escH(T('common.create', 'Tạo')) + '</button></div></span>';
      if (window.ECP_applyGates) window.ECP_applyGates();
    }
    function closeCrumbMenu() {
      if (!crumb) return;
      crumb.querySelectorAll('.menu').forEach(function (m) { m.hidden = true; });
      crumb.querySelectorAll('[data-crumb-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    }
    function resolve(u) {
      var st = u.get('state'), tp = u.get('tpl') || (st === 'pending' || st === 'invalid' ? DEF : FIRST);
      if (!has(tp) || tp === 'create' || tp === 'pending' || tp === 'invalid') tp = FIRST;
      if (st === 'create') return { panel: 'create', tpl: null };
      if ((st === 'pending' || st === 'invalid') && tp === DEF) return { panel: st, tpl: tp };
      return { panel: tp, tpl: tp };
    }
    function render(r, focus) {
      if (cur) resetEdit(document.querySelector('[data-tpl-panel="' + cur.panel + '"]')); // leaving a panel leaves its edit mode
      cur = r;
      var p = document.querySelector('[data-tpl-panel="' + r.panel + '"]');
      panels.forEach(function (pn) { pn.hidden = pn.getAttribute('data-tpl-panel') !== r.panel; });
      renderCrumb();
      items.forEach(function (a) {
        var on = a.getAttribute('data-tpl') === r.tpl;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      // list chip of the draft template (FE templates-screen): "Draft", or "Chờ duyệt" (warning) once submitted
      var dc = document.querySelector('.tpl-item[data-tpl="' + DEF + '"] .tpl-meta .chip');
      if (dc) { var pend = r.panel === 'pending'; dc.className = 'chip ' + (pend ? 'chip-warning' : 'chip-neutral'); dc.textContent = pend ? T('cfg.tpl.pendingReview', 'Chờ duyệt') : 'Draft'; if (pend) dc.setAttribute('data-i18n', 'cfg.tpl.pendingReview'); else dc.removeAttribute('data-i18n'); }
      document.querySelectorAll('[data-tpl-show]').forEach(function (el) { el.hidden = !inList(el.getAttribute('data-tpl-show'), r.panel); });
      document.querySelectorAll('[data-tpl-hide]').forEach(function (el) { el.hidden = inList(el.getAttribute('data-tpl-hide'), r.panel); });
      if (Back) {
        if (r.panel === 'create') Back.set('tpl-create', function () { go({ tpl: DEF }, true); }, function () { return !!cur && cur.panel === 'create'; });
        else Back.clear('tpl-create');
      }
      var af = p && p.querySelector('[data-tpl-autofocus]');
      if (af) af.focus();
      else if (focus && p) { var h = p.querySelector('h2[tabindex]'); if (h) h.focus(); }
    }
    function go(o, focus) {
      var u = new URLSearchParams(location.search);
      u.delete('tpl'); u.delete('state');
      if (o.tpl) u.set('tpl', o.tpl);
      if (o.state) u.set('state', o.state);
      var qs = u.toString();
      try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) {}
      render(resolve(u), focus);
    }
    document.addEventListener('click', function (e) {
      // Gửi duyệt: the shared [data-q-confirm] delegate (registered earlier) has opened #q-dialog; OK → go to the pending state
      var cg = e.target.closest('[data-tpl-confirm-go]');
      if (cg && !cg.disabled && cg.getAttribute('aria-disabled') !== 'true') {
        var want = cg.getAttribute('data-tpl-confirm-go');
        setTimeout(function () { // the dialog may be created by the confirm delegate during this same click
          var d = document.getElementById('q-dialog');
          if (!d || !d.open) return;
          pendingGo = want;
          if (!d.__tplBound) {
            d.__tplBound = 1;
            var f = d.querySelector('form');
            // OK submits the dialog form (the shared handler runs first and cancels it on validation errors)
            if (f) f.addEventListener('submit', function (ev) {
              var g = pendingGo;
              if (!g || ev.defaultPrevented || !ev.submitter || ev.submitter.value !== 'ok') return;
              pendingGo = null; setTimeout(function () { go({ tpl: DEF, state: g }, true); }, 0);
            });
            d.addEventListener('close', function () { setTimeout(function () { if (d.returnValue !== 'ok') pendingGo = null; }, 0); });
          }
        }, 0);
        return;
      }
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('.tpl-item[data-tpl]');
      if (a) { e.preventDefault(); leave(function () { go({ tpl: a.getAttribute('data-tpl') }, true); }); return; }
      var nv = e.target.closest('[data-tpl-nav]');
      if (nv) {
        e.preventDefault();
        if (nv.getAttribute('aria-disabled') === 'true' || nv.disabled) return;
        leave(function () { go({ state: nv.getAttribute('data-tpl-nav') }, true); }); return;
      }
      var fx = e.target.closest('[data-tpl-focus]');
      if (fx) { var t = document.getElementById(fx.getAttribute('data-tpl-focus')); if (t) { e.preventDefault(); t.focus(); } return; }
    });
    // create form: "Loại mới…" → text input; Local scope → KB select; "Sao chép" → source template select
    var cType = document.getElementById('tc-type'), cScope = document.getElementById('tc-scope'), cCopy = document.getElementById('tc-copy');
    if (cType) cType.addEventListener('change', function () { document.getElementById('tc-newtype-f').hidden = cType.value !== 'new'; });
    if (cScope) cScope.addEventListener('click', function () {
      setTimeout(function () {
        var loc = cScope.querySelector('[data-scope="local"]');
        document.getElementById('tc-kb-f').hidden = !loc || loc.getAttribute('aria-pressed') !== 'true';
      }, 0);
    });
    document.querySelectorAll('input[name="tc-init"]').forEach(function (r) {
      r.addEventListener('change', function () { if (cCopy) cCopy.disabled = !(r.value === 'copy' && r.checked); });
    });
    // create form: type (new type needs a name), name, KB for Local; OK → toast (the mock creates no template)
    var cForm = document.querySelector('[data-tpl-create]');
    function cErr(id, msg) {
      var el = document.getElementById(id), er = document.getElementById(id + '-err'); if (!el || !er) return null;
      er.textContent = msg; er.hidden = !msg;
      var d = (el.getAttribute('aria-describedby') || '').split(' ').filter(function (x) { return x && x !== id + '-err'; });
      if (msg) { el.setAttribute('aria-invalid', 'true'); d.push(id + '-err'); } else el.removeAttribute('aria-invalid');
      if (d.length) el.setAttribute('aria-describedby', d.join(' ')); else el.removeAttribute('aria-describedby');
      return msg ? el : null;
    }
    if (cForm) cForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var isNew = cType.value === 'new', loc = cScope.querySelector('[data-scope="local"]').getAttribute('aria-pressed') === 'true';
      var name = document.getElementById('tc-name').value.trim();
      var bad = [cErr('tc-newtype', isNew && !document.getElementById('tc-newtype').value.trim() ? T('cfg.tpl.typeRequired', 'Nhập tên loại mới') : ''),
        cErr('tc-name', name ? '' : T('cfg.tpl.nameRequired', 'Nhập tên template')),
        cErr('tc-kb', loc && !document.getElementById('tc-kb').value ? T('cfg.tpl.kbRequired', 'Chọn tri thức áp dụng') : '')].filter(Boolean);
      if (bad.length) return;
      if (window.ECP_toast) window.ECP_toast(T('cfg.tpl.created', 'Đã tạo bản nháp {name} Draft v1', { name: name }));
    });
    // Edit mode: Edit opens it (the Skill becomes editable), Cancel and Save leave it; .tpl-viewonly / .tpl-editonly follow .is-editing.
    // Typing marks the template unsaved ("Chưa lưu"); leaving it then asks first.
    function panelOf(el) { return (cur && document.querySelector('[data-tpl-panel="' + cur.panel + '"]')) || el.closest('.tpl-panel'); }
    var leaveBtn = document.createElement('button');
    leaveBtn.type = 'button'; leaveBtn.hidden = true;
    ['data-tpl-leave', 'data-q-confirm', 'data-no-comment', 'data-danger'].forEach(function (k) { leaveBtn.setAttribute(k, ''); });
    leaveBtn.setAttribute('data-title', 'Bỏ thay đổi chưa lưu?'); leaveBtn.setAttribute('data-body', 'Các thay đổi trong Skill chưa được lưu.');
    document.body.appendChild(leaveBtn);
    var afterLeave = null;
    function dirtyPanel() { var p = cur && document.querySelector('[data-tpl-panel="' + cur.panel + '"]'); return p && p.classList.contains('is-dirty') ? p : null; }
    function setEditing(panel, on) {
      panel.classList.toggle('is-editing', on);
      var ta = panel.querySelector('.tpl-prompt');
      if (ta) { ta.readOnly = !on; ta.classList.toggle('is-editing', on); if (on) ta.setAttribute('data-saved', ta.value); }
      if (!on) markDirty(panel, false);
      renderCrumb();
    }
    function markDirty(panel, on) {
      panel.classList.toggle('is-dirty', on);
    }
    function revert(panel) { var ta = panel.querySelector('.tpl-prompt'); if (ta && ta.hasAttribute('data-saved')) ta.value = ta.getAttribute('data-saved'); setEditing(panel, false); }
    function leave(fn) {
      var p = dirtyPanel();
      if (!p) { fn(); return; }
      afterLeave = function () { revert(p); fn(); };
      leaveBtn.click();
    }
    document.addEventListener('ecp-qapply', function (e) {
      if (e.detail && e.detail.btn === leaveBtn && afterLeave) { var f = afterLeave; afterLeave = null; f(); }
    });
    document.addEventListener('input', function (e) {
      var ta = e.target.closest && e.target.closest('.tpl-panel.is-editing .tpl-prompt'); if (!ta) return;
      markDirty(ta.closest('.tpl-panel'), ta.value !== ta.getAttribute('data-saved'));
    });
    // "+ Hành động" menu in the header breadcrumb: toggle, Sửa (opens edit mode); Tạo is a [data-tpl-nav] link handled above
    document.addEventListener('click', function (e) {
      var tg = e.target.closest('[data-crumb-toggle]');
      var open = tg && tg.getAttribute('aria-expanded') !== 'true';
      closeCrumbMenu();
      if (tg) { tg.setAttribute('aria-expanded', open ? 'true' : 'false'); tg.nextElementSibling.hidden = !open; return; }
      var ed = e.target.closest('[data-crumb-edit]');
      if (ed && !ed.disabled && ed.getAttribute('aria-disabled') !== 'true') { var panel = panelOf(ed); if (panel) setEditing(panel, true); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCrumbMenu(); });
    document.querySelectorAll('.tpl-panel [data-tpl-cancel]').forEach(function (btn) {
      btn.addEventListener('click', function () { var panel = panelOf(btn); if (panel) leave(function () { revert(panel); }); });
    });
    document.querySelectorAll('.tpl-panel [data-tpl-save]').forEach(function (btn) {
      btn.addEventListener('click', function () { var panel = panelOf(btn); if (panel) setEditing(panel, false); });
    });
    // pending / invalid states show the Product Wiki v3 Skill; the invalid one carries the two lint errors listed above it
    document.querySelectorAll('[data-tpl-skill-of]').forEach(function (ta) {
      var src = document.querySelector(ta.getAttribute('data-tpl-skill-of')); if (!src) return;
      var v = src.value;
      if (ta.hasAttribute('data-tpl-invalid')) v = v.replace('Biên soạn cho phạm vi "{{kb_name}}", chủ đề "{{topic}}".', 'Biên soạn cho phạm vi "{{kb_name}}", chủ đề "{{topic}}", mã sản phẩm {{product_code}}.').replace('Trả về đúng một đối tượng JSON:\n{', 'Trả về đúng một đối tượng JSON:\n{{');
      ta.value = v;
    });
    // AI Skill Refine: the proposal as an accept / reject diff of the Skill being edited (changed lines, unchanged runs collapsed)
    var rDlg = document.getElementById('tpl-refine-dlg');
    var REFINE = { add: '11. Mỗi con số (lãi suất, phí, hạn mức) phải kèm trích dẫn [Sn] ngay sau giá trị.', after: 'Quy tắc bắt buộc:' };
    function escH(x) { return String(x).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
    var rTa = null, rNext = '';
    document.addEventListener('click', function (e) {
      var rb = e.target.closest('[data-tpl-refine]');
      if (rb && rDlg && !rb.disabled && rb.getAttribute('aria-disabled') !== 'true') {
        rTa = panelOf(rb).querySelector('.tpl-prompt'); if (!rTa) return;
        var lines = rTa.value.split('\n'), at = -1;
        for (var i = 0; i < lines.length; i++) if (lines[i].indexOf(REFINE.after) === 0) { at = i; break; }
        var out = '', changed = at >= 0 && rTa.value.indexOf(REFINE.add) < 0;
        if (changed) {
          var end = at + 1; while (end < lines.length && lines[end].trim()) end++; // proposal: one rule appended to the "Quy tắc bắt buộc" list
          rNext = lines.slice(0, end).concat([REFINE.add], lines.slice(end)).join('\n');
          var from = Math.max(0, end - 3), to = Math.min(lines.length, end + 3);
          if (from > 0) out += '<div class="gap muted">⋯ ' + from + '</div>';
          lines.slice(from, end).forEach(function (l) { out += '<div class="r-eq">  ' + escH(l) + '</div>'; });
          out += '<div class="r-ins">+ ' + escH(REFINE.add) + '</div>';
          lines.slice(end, to).forEach(function (l) { out += '<div class="r-eq">  ' + escH(l) + '</div>'; });
          if (to < lines.length) out += '<div class="gap muted">⋯ ' + (lines.length - to) + '</div>';
        }
        rDlg.querySelector('.tpl-refine-diff').innerHTML = out;
        rDlg.querySelector('.tpl-refine-diff').hidden = !changed;
        rDlg.querySelector('[data-refine-none]').hidden = changed;
        rDlg.querySelector('[data-refine-apply]').hidden = !changed;
        rDlg.showModal();
        return;
      }
      if (e.target.closest('#tpl-refine-dlg [data-refine-apply]')) {
        rTa.value = rNext; markDirty(rTa.closest('.tpl-panel'), rTa.value !== rTa.getAttribute('data-saved'));
        rDlg.close();
        if (window.ECP_toast) window.ECP_toast(T('cfg.tpl.refineApplied', 'Đã áp dụng đề xuất vào bản nháp (chưa lưu)'));
      }
      if (e.target.closest('#tpl-refine-dlg [data-refine-dismiss]')) rDlg.close();
    });
    render(resolve(new URLSearchParams(location.search)), false);
    // QA deep link: &edit=1 opens the active package directly in edit mode (AI Refine + ToC visible).
    if (new URLSearchParams(location.search).get('edit') === '1') {
      var ep = cur && document.querySelector('[data-tpl-panel="' + cur.panel + '"]');
      if (ep && cur.panel !== 'pending') setEditing(ep, true);
    }
  });
})();


/* ===== Taxonomy · scope dropdown + 3 columns (ecp-taxonomy-scope-dropdown, ecp-taxonomy-type-hierarchy) =====
 * Top row: "Tri thức" select (Global + KBs) and the context "+ Thêm" menu. Column 1 = tag-type TREE
 * (types may nest via `parent`; ARIA tree, roving tabindex, expanded state kept per code across scopes),
 * column 2 = the child tag types of a branch type, or the values table of a leaf type, column 3 = detail drawer
 * (collapse ">" inside, reopen "<" via the generic data-panel-toggle handler). All three columns are
 * rendered from the mock data below. QA deep links: ?scope=global|<kb-slug> (legacy ?tab=local →
 * first KB), &node=<TYPE_CODE> (nested codes OK, ancestors are expanded), &value=<value code or name>,
 * &detail=collapsed, &menu=kebab|add, &edit=1 (opens the column-3 edit form for the selected type/value). */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var cols = document.querySelector('[data-tax-cols]');
    if (!cols) return;
    var I = window.ECP_I18N, T = (I && I.tr) || function (k, v, a) { return String(v).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); };
    function fmtNum(n) { return I && I.fmtNum ? I.fmtNum(n) : Number(n).toLocaleString('vi-VN'); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    // VN display name → UPPER_SNAKE ASCII code ("Thẻ tín dụng" → THE_TIN_DUNG; đ → D)
    function toCode(x) { return String(x || '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
    function codeHtml(c) { return esc(c).replace(/_/g, '_<wbr>'); } // long codes wrap at underscores
    var ICO_PLUS = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    var ICO_KEBAB = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>';
    var ICO_CHEV = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

    // ---- mock data (sample content stays Vietnamese) ----
    // Global types live in ecp-taxonomy.js, shared with the taxonomy-tag colours on KB and document screens.
    var TAXO = window.ECP_TAXONOMY, v = TAXO.v;
    var GLOBAL = TAXO.global();
    window.ECP_TAX = { global: function () { return JSON.parse(JSON.stringify(GLOBAL)); } };
    // One KB-local dataset serves every KB in the mock: inherited branches PRODUCT › CARD_PRODUCT
    // with KB-own leaf children CARD_LINE, CARD_TIER, CARD_FEAT; inherited DOC_TYPE.
    var LOCAL = [
      { code: 'PRODUCT', name: 'Sản phẩm', multi: true, inherit: true, owner: 'Nguyễn Lan', kbs: 1, docs: 214, desc: 'Sản phẩm, dịch vụ ngân hàng MSB mà tài liệu đề cập.', values: [] },
      { code: 'CARD_PRODUCT', parent: 'PRODUCT', name: 'Sản phẩm thẻ', multi: true, inherit: true, owner: 'Lê Thu', checker: 'Nguyễn Lan', kbs: 1, docs: 214, desc: 'Các dòng thẻ do MSB phát hành: thẻ tín dụng, thẻ ghi nợ, thẻ trả trước.', values: [] },
      { code: 'CARD_LINE', parent: 'CARD_PRODUCT', name: 'Dòng thẻ', multi: true, owner: 'Lê Thu', kbs: 1, docs: 214, desc: 'Các dòng thẻ riêng của tri thức Sản phẩm thẻ tín dụng.', values: [
        v('Thẻ tín dụng', 'Thẻ tín dụng cá nhân và doanh nghiệp do MSB phát hành.', 142, { own: true, syn: ['Credit card', 'Thẻ TD'] }),
        v('Thẻ đồng thương hiệu MSB Vietnam Airlines', 'Thẻ tín dụng tích dặm Bông Sen Vàng khi chi tiêu.', 38, { own: true, syn: ['Thẻ VNA', 'Co-brand'] }),
        v('Thẻ trả trước MSB Online', 'Thẻ nạp tiền trước, dùng cho thanh toán trực tuyến.', 34, { own: true, on: false, syn: ['Prepaid card'] })
      ] },
      { code: 'CARD_TIER', parent: 'CARD_PRODUCT', name: 'Hạng thẻ', multi: false, owner: 'Lê Thu', kbs: 1, docs: 176, desc: 'Hạng thẻ tín dụng theo hạn mức và đặc quyền.', values: [
        v('Chuẩn', 'Hạng cơ bản, hạn mức thấp nhất.', 52, { own: true, syn: ['Classic'] }),
        v('Vàng', 'Hạn mức trung bình, ưu đãi hoàn tiền cơ bản.', 47, { own: true, syn: ['Gold'] }),
        v('Bạch kim', 'Hạn mức cao, ưu đãi phòng chờ và bảo hiểm du lịch.', 44, { own: true, syn: ['Platinum'] }),
        v('Signature', 'Dành cho khách hàng ưu tiên, đặc quyền mở rộng.', 33, { own: true, syn: ['Visa Signature'] })
      ] },
      { code: 'CARD_FEAT', parent: 'CARD_PRODUCT', name: 'Tính năng thẻ', multi: true, owner: 'Lê Thu', kbs: 1, docs: 131, desc: 'Tính năng, ưu đãi gắn với thẻ.', values: [
        v('Hoàn tiền', 'Hoàn một phần giá trị chi tiêu vào tài khoản thẻ.', 58, { own: true, syn: ['Cashback'] }),
        v('Trả góp 0%', 'Chuyển giao dịch thành trả góp không lãi suất.', 49, { own: true, syn: ['Installment'] }),
        v('Tích điểm', 'Tích điểm thưởng theo chi tiêu để đổi quà.', 24, { own: true, syn: ['Reward points'] }),
        v('Miễn phí thường niên', 'Miễn phí phí thường niên năm đầu khi chi tiêu đủ điều kiện.', 0, { own: true, syn: ['Annual fee waiver'] })
      ] },
      { code: 'DOC_TYPE', name: 'Loại văn bản', multi: false, inherit: true, owner: 'Trần Hải', kbs: 1, docs: 226, desc: 'Hình thức văn bản của tài liệu nội bộ. Mỗi tài liệu chỉ thuộc một loại văn bản.', values: [
        v('Quyết định', 'Văn bản ban hành quyết định của cấp có thẩm quyền.', 41, { syn: ['QĐ'] }),
        v('Biểu phí', 'Danh mục phí, lãi suất áp dụng cho sản phẩm, dịch vụ.', 63, { syn: ['Fee schedule'] }),
        v('Điều khoản & điều kiện thẻ', 'Điều khoản, điều kiện phát hành và sử dụng thẻ (T&C).', 122, { own: true, syn: ['T&C'] })
      ] }
    ];

    GLOBAL.concat(LOCAL).forEach(function (t) { if (t.on === undefined) t.on = true; }); // type Hoạt động flag (mock)

    // ADR-007: the preset bar (ecp-taxonomy.js ECP_PRESETS) replaces the KB scope select; each preset has its own tag set
    var DATA = { global: GLOBAL, 'the-tin-dung': LOCAL };
    function dataOf(id) { return DATA[id] || (DATA[id] = JSON.parse(JSON.stringify(GLOBAL))); } // a fork of Global (mock)
    // the set, its version pill and "+ Thêm" live in the header breadcrumb (FE config-shell); the pending chip stays in the card (FE art-head.tax-head)
    var presetBar = window.ECP_PRESETS.mount(document.querySelector('[data-preset-bar="taxonomy"]'), {
      kind: 'taxonomy', value: 'global', crumb: document.getElementById('crumb-preset'), pending: document.querySelector('[data-tax-pending]'),
      presets: [
        { id: 'global', name: 'Global', kind: 'GLOBAL', version: 4, hasChanges: true, pending: null },
        { id: 'tin-dung-dn', name: 'Tín dụng doanh nghiệp', kind: 'CUSTOM', version: 2, hasChanges: true, pending: null },
        { id: 'the-tin-dung', name: 'Sản phẩm thẻ tín dụng', kind: 'CUSTOM', version: 2, hasChanges: false, pending: 'CR-1262' }
      ],
      // "Xem phiên bản" compares Nhóm tag + Tag lists
      snapshot: function (id) {
        var d = dataOf(id), on = function (x) { return x.on !== false; };
        return { types: d.map(function (t) { return { id: t.code, name: t.name, code: t.code, active: on(t) }; }),
          values: [].concat.apply([], d.map(function (t) { return t.values.map(function (x) { var c = t.code + '/' + x.code; return { id: c, name: x.name, code: c, active: on(x) }; }); })) };
      },
      onCreate: function (p, mode, src) { DATA[p.id] = mode === 'new' ? [] : JSON.parse(JSON.stringify(mode === 'fork' ? dataOf(src) : GLOBAL.slice(0, 3))); } // import: the file's types (mock)
    });
    var sel = presetBar.select;
    var listEl = cols.querySelector('[data-tax-type-list]');
    var countEl = cols.querySelector('[data-tax-type-count]');
    var col2 = cols.querySelector('[data-tax-col2]');
    var detail = document.getElementById('tax-detail');
    var dTitle = detail.querySelector('[data-tax-detail-title]');
    var dSub = detail.querySelector('[data-tax-detail-sub]');
    var dBody = detail.querySelector('[data-tax-detail-body]');
    var addMenu = document.getElementById('tax-add');
    var addBox = addMenu.querySelector('[data-tax-add-menu]');
    var editBtn = detail.querySelector('[data-tax-edit-btn]'), editLbl = editBtn.querySelector('[data-tax-edit-label]');
    var state = { scope: 'global', type: null, value: null, form: false, formParent: null, open: {}, edit: null };

    function isKb() { return state.scope !== 'global'; }
    function kbName() { var o = sel.options[sel.selectedIndex]; return o ? o.textContent.trim() : ''; }
    // ADR-007: a preset is an independent copy, nothing is inherited; an item waiting for a change request
    // (x.pending = CR code) is read-only until it is decided
    function inheritedType() { return false; }
    function inheritedVal() { return false; }
    function lockOf(inherited, x) { return inherited ? T('cfg.tax.inheritedReadOnly', 'Kế thừa từ Global — sửa ở Global') : x && x.pending ? T('cfg.tax.pendingLocked', 'Đang chờ change request được quyết định nên chưa sửa được.') : ''; }
    // ADR-007: writes go to the preset's working state at once; "Phát hành" on the preset bar publishes them
    function submitted() { presetBar.markChanged(); return false; }
    function data() { return dataOf(state.scope); }
    // ---- hierarchy helpers (cycle-guarded; a parent missing from the dataset → top level) ----
    function byCode(c) { var d = data(); for (var i = 0; i < d.length; i++) if (d[i].code === c) return d[i]; return null; }
    function parentOf(t) { return t && t.parent && t.parent !== t.code ? byCode(t.parent) : null; }
    function kids(code) { return data().filter(function (t) { var p = parentOf(t); return code == null ? !p : !!p && p.code === code; }); }
    function isBranch(t) { return kids(t.code).length > 0; } // branch → column 2 lists child types; leaf → values
    function ancestors(t) { var out = [], seen = {}, p = parentOf(t); while (p && !seen[p.code] && out.length < 20) { seen[p.code] = 1; out.unshift(p); p = parentOf(p); } return out; } // root … direct parent
    function pathOf(t) { return ancestors(t).concat([t]).map(function (x) { return x.name; }).join(' › '); }
    function descendants(code, seen) { seen = seen || {}; var out = []; kids(code).forEach(function (k) { if (seen[k.code]) return; seen[k.code] = 1; out.push(k); out = out.concat(descendants(k.code, seen)); }); return out; }
    function flat() { var out = [], seen = {}; (function walk(code, lvl) { if (lvl > 20) return; kids(code).forEach(function (t) { if (seen[t.code]) return; seen[t.code] = 1; out.push({ t: t, lvl: lvl }); walk(t.code, lvl + 1); }); })(null, 1); return out; } // DFS
    function isOpen(t) { return Object.prototype.hasOwnProperty.call(state.open, t.code) ? !!state.open[t.code] : !parentOf(t) && kids(t.code).length > 0; }
    function reveal(code) { var t = byCode(code); if (t) ancestors(t).forEach(function (a) { state.open[a.code] = true; }); }
    function curType() { return state.type ? byCode(state.type) || data()[0] : null; } // null = nothing selected (normal mode)
    function curValue(t) { if (!state.value) return null; for (var i = 0; i < t.values.length; i++) if (t.values[i].code === state.value) return t.values[i]; return null; }
    function typeSource(t) { return !isKb() ? T('cfg.tax.srcPreset', 'Thiết lập sẵn') : t.inherit ? T('cfg.tax.srcInherited', 'Kế thừa Global') : T('cfg.tax.srcKbOwn', 'Riêng tri thức'); }
    function checkerOf(t) { return t.checker || (t.owner === 'Trần Hải' ? 'Nguyễn Lan' : 'Trần Hải'); }
    // Maker / Checker: both "Hệ thống" for seeded items nobody changed; maker + "—" while a change is unpublished. Collapsed under "Nguồn gốc".
    function provenance(owner, pend) {
      var sys = T('common.system', 'Hệ thống');
      return '<details class="tax-prov"><summary>' + esc(T('mk.web.os.provenance', 'Nguồn gốc')) + '</summary><dl class="tax-dl">' +
        row(T('cfg.tax.maker', 'Maker'), esc(pend ? owner : sys)) + row(T('cfg.tax.checker', 'Checker'), pend ? '—' : esc(sys)) + '</dl></details>';
    }
    function usage(kbs, docs) { return T('cfg.tax.usageLine', '{k} tri thức · {d} tài liệu', { k: kbs, d: fmtNum(docs) }); }
    // reason the selected type/value can't be edited ('' = editable)
    function editLock() { var t = curType(); if (!t) return ''; var val = curValue(t); return val ? lockOf(inheritedVal(val), val) : lockOf(inheritedType(t), t); }
    function canEdit() { return !!curType() && !editLock(); }
    function say(m) { if (window.ECP_toast) window.ECP_toast(m); }
    // indented path list of types for a parent <select>; `t` (and its descendants) are excluded to prevent cycles
    function parentOptions(t, selCode) {
      var skip = {};
      if (t) { skip[t.code] = 1; descendants(t.code).forEach(function (d) { skip[d.code] = 1; }); }
      return '<option value="">' + esc(T('cfg.tax.parentNone', '— Không (cấp cao nhất) —')) + '</option>' + flat().filter(function (x) { return !skip[x.t.code]; }).map(function (x) {
        return '<option value="' + esc(x.t.code) + '" data-i18n-skip' + (x.t.code === selCode ? ' selected' : '') + '>' + new Array(4 * (x.lvl - 1) + 1).join('\u00a0') + esc(x.t.name) + '</option>';
      }).join('');
    }

    // ---- column 1 · tag-type tree ----
    function typeNode(t, lvl, seen) {
      if (lvl > 20 || seen[t.code]) return '';
      seen[t.code] = 1;
      var ch = kids(t.code), has = ch.length > 0, open = has && isOpen(t), on = state.form !== 'type' && t.code === state.type, c = esc(t.code);
      var kb = on ? '<details class="tax-add-menu tax-kebab" id="tax-kebab"><summary class="icon-btn" aria-label="' + esc(T('cfg.tax.typeActionsX', 'Thao tác cho {x}', { x: t.name })) + '" title="' + esc(T('cfg.tax.typeActions', 'Thao tác nhóm tag')) + '">' + ICO_KEBAB + '</summary><div class="menu" role="menu">' + kebabItems(t) + '</div></details>' : '';
      return '<li role="treeitem" id="tax-ti-' + c + '" data-tax-type="' + c + '" aria-level="' + lvl + '" aria-selected="' + on + '"' + (has ? ' aria-expanded="' + open + '"' : '') +
        ' aria-labelledby="tax-tn-' + c + '" aria-describedby="tax-tc-' + c + '" tabindex="-1"' + ((on || t.on === false) ? ' class="' + [on ? 'is-current' : '', t.on === false ? 'is-off' : ''].join(' ').trim() + '"' : '') + '>' +
        '<div class="tax-type" style="--lvl:' + (lvl - 1) + '">' +
          (has ? '<span class="tax-tw" data-tax-twisty aria-hidden="true">' + ICO_CHEV + '</span>' : '<span class="tax-tw" aria-hidden="true"></span>') +
          '<span class="tax-type-name"><span id="tax-tn-' + c + '" data-i18n-skip title="' + esc(pathOf(t)) + '">' + (lvl === 1 && TAXO.colorOf(t.code) ? '<span class="tax-swatch ecp-tax-' + TAXO.colorOf(t.code) + '" aria-hidden="true"></span>' : '') + esc(t.name) + '</span><span class="mono muted" data-i18n-skip>' + c + '</span></span>' +
          '<span class="tax-type-count" id="tax-tc-' + c + '" aria-label="' + esc(has ? T('cfg.tax.nChildTypes', '{n} nhóm con', { n: ch.length }) : T('cfg.tax.nValues', '{n} tag', { n: t.values.length })) + '">' + (has ? ch.length : t.values.length) + '</span>' + kb +
        '</div>' +
        (has ? '<ul role="group"' + (open ? '' : ' hidden') + '>' + ch.map(function (k) { return typeNode(k, lvl + 1, seen); }).join('') + '</ul>' : '') + '</li>';
    }
    function renderTypes() {
      countEl.textContent = data().length; // all levels
      var seen = {};
      listEl.innerHTML = kids(null).map(function (t) { return typeNode(t, 1, seen); }).join('');
      var stop = item(state.type);
      if (!stop || !isVisible(stop)) stop = visibleItems()[0];
      if (stop) stop.tabIndex = 0;
    }
    function item(code) { return code ? listEl.querySelector('[role="treeitem"][data-tax-type="' + CSS.escape(code) + '"]') : null; }
    function isVisible(li) { return !li.closest('ul[hidden]'); }
    function visibleItems() { return Array.prototype.filter.call(listEl.querySelectorAll('[role="treeitem"]'), isVisible); }
    function focusItem(li) { if (!li) return; listEl.querySelectorAll('[role="treeitem"][tabindex="0"]').forEach(function (x) { x.tabIndex = -1; }); li.tabIndex = 0; li.focus(); }
    function setOpen(li, open) {
      if (!li || !li.hasAttribute('aria-expanded')) return;
      state.open[li.getAttribute('data-tax-type')] = open;
      li.setAttribute('aria-expanded', String(open));
      var g = li.querySelector(':scope > ul[role="group"]'); if (g) g.hidden = !open;
      var stop = listEl.querySelector('[role="treeitem"][tabindex="0"]');
      if (!stop || !isVisible(stop)) focusItem(li); // never leave the tab stop inside a collapsed branch
    }

    // ---- ⋮ menu of the selected tag type ----
    // only "Tắt" / "Bật" (toggles the type); Move / CSV / Import from Global / Promote / Delete wait for the taxonomy API.
    // Inherited types (KB scope) are greyed out with the reason as tooltip.
    function kebabItems(t) {
      var lock = lockOf(inheritedType(t), t);
      return '<button type="button" role="menuitem" class="menu-item" data-tax-kebab-toggle' + (lock ? ' aria-disabled="true" title="' + esc(lock) + '"' : '') + '>' +
        esc(t.on === false ? T('cfg.tax.colOn', 'Bật') : T('cfg.tax.mDisable', 'Tắt')) + '</button>';
    }

    // ---- column 2 ----
    function renderCol2() {
      if (state.form === 'type') { renderForm(); return; }
      var t = curType(), rows;
      if (!t) { col2.innerHTML = ''; return; } // nothing selected → blank main content
      // Hoạt động switch: locked for inherited items (with the reason) and for values waiting for their change request (CR code)
      function sw(attr, on, name, lock) { return '<td class="tax-on"><input type="checkbox" role="switch" class="tax-switch" ' + attr + (on ? ' checked' : '') + (lock ? ' disabled title="' + esc(lock) + '"' : '') + ' aria-label="' + esc(T('cfg.tax.enableX', 'Bật {x}', { x: name })) + '"></td>'; }
      if (isBranch(t)) {
        rows = kids(t.code).map(function (k) {
          var kb = isBranch(k), n = kb ? kids(k.code).length : k.values.length;
          var sub = kb ? T('cfg.tax.nChildTypes', '{n} nhóm con', { n: n }) : T('cfg.tax.nValues', '{n} tag', { n: n });
          if (isKb() && !k.inherit) sub += ' · ' + T('cfg.tax.srcKbOwn', 'Riêng tri thức');
          return '<tr class="tax-row' + (k.on === false ? ' is-off' : '') + '" tabindex="0" data-tax-row data-tax-child="' + esc(k.code) + '">' +
            '<td class="tax-code"><span class="mono" data-i18n-skip>' + codeHtml(k.code) + '</span></td>' +
            '<td class="tax-name"><span class="bold" data-i18n-skip>' + esc(k.name) + '</span><span class="tax-sub">' + esc(sub) + '</span></td>' +
            '<td class="tax-desc" title="' + esc(k.desc) + '" data-i18n-skip><span class="tax-desc-txt">' + esc(k.desc) + '</span></td>' +
            '<td class="tax-num">' + fmtNum(k.docs) + '</td>' + sw('data-tax-type-toggle', k.on !== false, k.name, lockOf(inheritedType(k))) + '</tr>';
        }).join('');
      } else {
        rows = t.values.length ? t.values.map(function (val) {
          var on = val.code === state.value, cls = 'tax-row' + (on ? ' is-selected' : '') + (val.on ? '' : ' is-off');
          return '<tr class="' + cls + '" tabindex="0" data-tax-row data-tax-value="' + esc(val.code) + '" data-tax-detail-synonyms="' + esc(val.syn.join(', ')) + '"' + (on ? ' aria-current="true"' : '') + '>' +
            '<td class="tax-code"><span class="mono" data-i18n-skip>' + codeHtml(val.code) + '</span></td>' +
            '<td class="tax-name"><span class="bold" data-i18n-skip>' + esc(val.name) + '</span>' + (isKb() && val.own ? '<span class="tax-own">' + esc(T('cfg.tax.srcKbOwn', 'Riêng tri thức')) + '</span>' : '') + '</td>' +
            '<td class="tax-desc" title="' + esc(val.desc) + '" data-i18n-skip><span class="tax-desc-txt">' + esc(val.desc) + '</span></td>' +
            '<td class="tax-num">' + fmtNum(val.docs) + '</td>' + sw('data-tax-toggle', val.on, val.name, inheritedVal(val) ? lockOf(true) : val.pending || '') + '</tr>';
        }).join('') : '<tr class="tax-empty"><td colspan="5">' + esc(T('cfg.tax.emptyValues', 'Nhóm tag này chưa có tag — thêm bằng + Thêm')) + '</td></tr>';
      }
      col2.innerHTML = '<div class="tax-c2-body"><table class="table doc-table cfg-table"><caption class="sr-only">' + esc(T('cfg.tax.valuesOf', 'Tag của nhóm tag {x}', { x: t.name })) + '</caption><thead><tr><th scope="col" class="tax-code">' + esc(T('cfg.tax.colCode', 'Mã')) + '</th><th scope="col" class="tax-name">' + esc(T('cfg.tax.displayName', 'Tên hiển thị')) + '</th><th scope="col" class="tax-th-desc">' + esc(T('common.description', 'Mô tả')) + '</th><th scope="col" class="tax-num">' + esc(T('cfg.tax.colDocs', 'Tài liệu')) + '</th><th scope="col" class="tax-on">' + esc(T('cfg.tax.colActive', 'Hoạt động')) + '</th></tr></thead><tbody>' + rows +
        '</tbody></table></div>';
    }
    function formTitle() { return state.formParent ? T('cfg.tax.addChildTagType', 'Thêm nhóm tag con') : T('cfg.tax.addTagType', 'Thêm nhóm tag'); }
    function renderForm() {
      var opts = parentOptions(null, state.formParent);
      col2.innerHTML = '<div class="tax-c2-head"><div class="tax-c2-title"><span class="bold">' + esc(formTitle()) + '</span>' + (isKb() ? '<span class="muted text-sm">· ' + esc(kbName()) + '</span>' : '') + '</div></div><div class="tax-c2-body"><form class="tax-type-form" data-tax-type-form novalidate>' +
        fld('ntf-code', T('cfg.tax.colCode', 'Mã'), '<input class="input mono" id="ntf-code" type="text" placeholder="CARD_TIER" data-auto="1">') +
        fld('ntf-name', T('cfg.tax.displayName', 'Tên hiển thị'), '<input class="input" id="ntf-name" type="text" placeholder="' + esc(T('cfg.tax.typeNamePh', 'Ví dụ: Hạng thẻ')) + '" required>') +
        fld('ntf-name-en', T('cfg.tax.nameEn', 'Tên tiếng Anh'), '<input class="input" id="ntf-name-en" type="text" lang="en">') +
        fld('ntf-desc', T('common.description', 'Mô tả'), '<textarea class="input" id="ntf-desc" rows="2"></textarea>') +
        fld('ntf-parent', T('cfg.tax.parentType', 'Nhóm tag cha'), '<select class="input" id="ntf-parent">' + opts + '</select>') +
        '<div class="field tax-card-field"><label class="check-row" for="ntf-multi"><input type="checkbox" id="ntf-multi" checked><span>' + esc(T('cfg.tax.multiCheck', 'Đa trị — một tài liệu có thể gắn nhiều tag')) + '</span></label><p class="text-xs muted">' + esc(T('cfg.tax.cardinalityHelp', 'Ví dụ: Loại văn bản → 1 loại; Sản phẩm → nhiều sản phẩm')) + '</p></div>' +
        '<div class="row"><button class="btn btn-primary btn-sm" type="submit">' + esc(T('common.save', 'Lưu')) + '</button></div></form></div>';
    }

    // ---- column 3 ----
    // pending = CR code a Global item waits for → "Chờ duyệt · CR-…" chip linking to the change request
    function hero(name, code, path, pending) {
      return '<div class="tax-hero"><h3 class="tax-hero-name" id="tax-hero-n" data-i18n-skip>' + esc(name) + '</h3><div class="tax-hero-meta"><span class="mono tax-code-badge" data-i18n-skip>' + codeHtml(code) + '</span>' + (path ? '<span class="tax-hero-path" data-i18n-skip>' + esc(path) + '</span>' : '') +
        (pending ? '<span class="chip chip-warning" title="' + esc(T('cfg.tax.pendingLocked', 'Đang chờ change request được quyết định nên chưa sửa được.')) + '">' + esc(T('common.pendingReview', 'Chờ duyệt')) + ' · <a class="link" href="quality-change-request.html" data-i18n-skip>' + esc(pending) + '</a></span>' : '') + '</div></div>';
    }
    function row(label, html) { return '<div><dt>' + esc(label) + '</dt><dd>' + html + '</dd></div>'; }

    // ---- version history popup (assets/version-diff.js · window.KCVH) ----
    // value history: val.hist or the 3 default entries (newest first: [date, by, text]); oldest = v1
    function valHist(t, val) {
      return val.hist || [
        ['12/05/2026', 'Nguyễn Lan', T('cfg.tax.hDesc', 'Cập nhật mô tả')],
        ['02/04/2026', 'Trần Hải', T('cfg.tax.hSyn', 'Thêm từ đồng nghĩa “{x}”', { x: val.syn[val.syn.length - 1] || '' })],
        ['15/01/2026', t.owner, T('cfg.tax.hCreate', 'Tạo tag')]
      ];
    }
    // inherited items (KB scope) are edited in Global → restore is gated with the same reason as the Sửa button
    function vhLink(id, inherited) {
      return '<button class="link kvh-link tax-link" type="button" data-vh="' + esc(id) + '"' + (inherited ? ' data-vh-restore-off="' + esc(T('cfg.tax.inheritedReadOnly', 'Kế thừa từ Global — sửa ở Global')) + '"' : '') + '>' + esc(T('vh.viewAll', 'Xem tất cả · So sánh')) + '</button>';
    }
    function onOff(on) { return on ? T('cfg.tax.colOn', 'Bật') : T('cfg.tax.mDisable', 'Tắt'); }
    function firstClause(s) {
      s = String(s || ''); var m = /[,;.]/.exec(s), c = (m ? s.slice(0, m.index) : s).trim() + '.';
      if (c !== s) return c;
      // single-clause description: the earlier wording lacked the trailing qualifier ("… của cấp có thẩm quyền")
      var b = s.replace(/[.\s]+$/, ''), cut = -1;
      [' của ', ' cho ', ' theo ', ' về ', ' trong ', ' với ', ' dùng ', ' tại ', ' khi '].forEach(function (w) { var i = b.lastIndexOf(w); if (i > 8 && i > cut) cut = i; });
      if (cut < 0) { var ws = b.split(' '); if (ws.length > 3) cut = b.length - ws[ws.length - 1].length - 1; }
      return cut > 0 ? b.slice(0, cut) + '.' : s;
    }
    var TAX_RESTORE = { rolesDisable: '', reason: '', later: T('web.tax.restoreLater', 'Khôi phục sẽ có ở phiên bản sau') }; // allowed for every role; per-trigger data-vh-restore-off gates inherited items
    function vhValue(id) {
      var p = id.slice('tax-value:'.length), k = p.indexOf('/'), t = byCode(p.slice(0, k)), val = null;
      if (k < 0 || !t) return null;
      t.values.forEach(function (x) { if (x.code === p.slice(k + 1)) val = x; });
      if (!val) return null;
      var hist = valHist(t, val), n = hist.length, out = [];
      var f = { code: val.code, name: val.name, nameEn: val.nameEn || '', desc: val.desc, syn: val.syn.slice(), on: onOff(val.on) };
      hist.forEach(function (h, i) { // newest → oldest
        if (i === 1) f.desc = firstClause(f.desc);
        if (i === 2) f.syn = f.syn.slice(0, -1);
        out.push({ v: 'v' + (n - i), status: i ? 'superseded' : 'active', by: h[1], at: h[0], sum: h[2], cr: '', data: { fields: JSON.parse(JSON.stringify(f)) } });
      });
      return {
        name: pathOf(t) + ' › ' + val.name, restore: TAX_RESTORE,
        sections: [{ id: 'fields', label: 'Thuộc tính', kind: 'fields', fields: [['code', 'Mã'], ['name', 'Tên hiển thị'], ['nameEn', 'Tên tiếng Anh'], ['desc', 'Mô tả'], ['syn', 'Từ đồng nghĩa'], ['on', 'Hoạt động']] }],
        versions: out
      };
    }
    function vhType(id) {
      var t = byCode(id.slice('tax-type:'.length));
      if (!t) return null;
      var br = isBranch(t), par = parentOf(t), top = T('cfg.tax.topLevel', '— (cấp cao nhất)');
      var items = (br ? kids(t.code) : t.values).map(function (x) { return { id: x.code, title: x.name, name: x.name, code: x.code, on: onOff(x.on !== false) }; });
      function add(x) { return x ? (br ? T('vh.tax.addChild', 'Thêm nhóm tag con “{x}”', { x: x.name }) : T('vh.tax.addValue', 'Thêm tag “{x}”', { x: x.name })) : T('cfg.tax.hDesc', 'Cập nhật mô tả'); }
      var f3 = { code: t.code, name: t.name, nameEn: t.nameEn || '', parent: par ? pathOf(par) : top, desc: t.desc, multi: t.multi ? T('vh.yes', 'Có') : T('vh.no', 'Không'), owner: t.owner, checker: checkerOf(t) };
      var f1 = JSON.parse(JSON.stringify(f3)); if (par) f1.parent = top;
      var last = items[items.length - 1], prev = items[items.length - 2];
      var sum2 = par ? T('vh.tax.moveInto', 'Chuyển vào {x}', { x: par.name }) + (prev ? ' · ' + add(prev) : '') : add(prev);
      return {
        name: pathOf(t), restore: TAX_RESTORE,
        sections: [
          { id: 'fields', label: 'Thuộc tính', kind: 'fields', fields: [['code', 'Mã'], ['name', 'Tên hiển thị'], ['nameEn', 'Tên tiếng Anh'], ['parent', 'Nhóm tag cha'], ['desc', 'Mô tả'], ['multi', 'Đa trị'], ['owner', 'Maker'], ['checker', 'Checker']] },
          { id: 'list', label: br ? 'Nhóm tag con' : 'Danh sách tag', kind: 'list', cols: [['name', 'Tên hiển thị'], ['code', 'Mã'], ['on', 'Hoạt động']] }
        ],
        versions: [
          { v: 'v3', status: 'active', by: t.owner, at: '12/05/2026 · 10:20', sum: add(last), cr: '', data: { fields: f3, list: items } },
          { v: 'v2', status: 'superseded', by: checkerOf(t), at: '02/04/2026 · 15:05', sum: sum2, cr: '', data: { fields: JSON.parse(JSON.stringify(f3)), list: items.slice(0, Math.max(0, items.length - 1)) } },
          { v: 'v1', status: 'superseded', by: t.owner, at: '15/01/2026 · 09:00', sum: T('vh.tax.create', 'Tạo nhóm tag'), cr: '', data: { fields: f1, list: items.slice(0, Math.max(0, items.length - 2)) } }
        ]
      };
    }
    if (window.KCVH) { window.KCVH.provide('tax-value:', vhValue); window.KCVH.provide('tax-type:', vhType); }
    else (window.KCVH_PROVIDERS = window.KCVH_PROVIDERS || []).push(['tax-value:', vhValue], ['tax-type:', vhType]);

    function syncEditBtn() {
      editBtn.hidden = !!state.form || !!state.edit || !curType();
      editLbl.textContent = T('common.edit', 'Sửa');
      var lock = editLock();
      editBtn.classList.toggle('is-disabled', !!lock);
      if (!lock) { editBtn.removeAttribute('aria-disabled'); editBtn.removeAttribute('title'); }
      else { editBtn.setAttribute('aria-disabled', 'true'); editBtn.title = lock; }
    }
    function fld(id, label, control, hint) {
      return '<div class="field"><label class="text-sm bold" for="' + id + '">' + esc(label) + '</label>' + control +
        (hint ? '<p class="field-hint" id="' + id + '-hint">' + esc(hint) + '</p>' : '') + '<p class="field-err" id="' + id + '-err" hidden></p></div>';
    }
    // tag-value fields: edit (prefix tax-e, code read-only) and add (prefix tax-v, code follows the name until typed)
    function valueFields(p, val) {
      var add = !val; val = val || { code: '', name: '', nameEn: '', desc: '', syn: [], on: true };
      return fld(p + '-code', T('cfg.tax.colCode', 'Mã'), '<input class="input mono" id="' + p + '-code" type="text" value="' + esc(val.code) + '"' + (add ? ' data-auto="1"' : ' readonly aria-describedby="' + p + '-code-hint"') + '>', add ? '' : T('cfg.tax.codeImmutable', 'Mã không đổi được sau khi tạo')) +
        fld(p + '-name', T('cfg.tax.displayName', 'Tên hiển thị'), '<input class="input" id="' + p + '-name" type="text" value="' + esc(val.name) + '">') +
        fld(p + '-name-en', T('cfg.tax.nameEn', 'Tên tiếng Anh'), '<input class="input" id="' + p + '-name-en" type="text" lang="en" value="' + esc(val.nameEn || '') + '">') +
        fld(p + '-desc', T('common.description', 'Mô tả'), '<textarea class="input" id="' + p + '-desc" rows="3">' + esc(val.desc) + '</textarea>') +
        fld(p + '-syn', T('cfg.tax.synonyms', 'Từ đồng nghĩa'), '<input class="input" id="' + p + '-syn" type="text" aria-describedby="' + p + '-syn-hint" value="' + esc(val.syn.join(', ')) + '">', T('cfg.tax.synonymsHint', 'Cách nhau bằng dấu phẩy')) +
        '<div class="field"><label class="tax-switch-row" for="' + p + '-on"><input type="checkbox" role="switch" class="tax-switch" id="' + p + '-on"' + (val.on ? ' checked' : '') + '><span>' + esc(T('cfg.tax.colActive', 'Hoạt động')) + '</span></label></div>' +
        '<div class="tax-detail-actions"><button class="btn btn-primary btn-sm" type="submit">' + esc(T('common.save', 'Lưu')) + '</button><button class="btn btn-secondary btn-sm" type="button" data-tax-ecancel>' + esc(T('common.cancel', 'Huỷ')) + '</button></div>';
    }
    function renderEditForm() {
      var t = curType(), val = state.edit === 'value' ? curValue(t) : null, h;
      dTitle.textContent = val ? T('cfg.tax.editTagValue', 'Sửa tag') : T('cfg.tax.editTagType', 'Sửa nhóm tag');
      dSub.textContent = ''; dSub.hidden = true;
      if (val) {
        h = valueFields('tax-e', val);
      } else {
        // codes are immutable after creation (ADR-005 §10.4)
        h = fld('tax-e-code', T('cfg.tax.colCode', 'Mã'), '<input class="input mono" id="tax-e-code" type="text" value="' + esc(t.code) + '" readonly aria-describedby="tax-e-code-hint">', T('cfg.tax.codeImmutable', 'Mã không đổi được sau khi tạo')) +
          fld('tax-e-name', T('cfg.tax.displayName', 'Tên hiển thị'), '<input class="input" id="tax-e-name" type="text" value="' + esc(t.name) + '">') +
          fld('tax-e-name-en', T('cfg.tax.nameEn', 'Tên tiếng Anh'), '<input class="input" id="tax-e-name-en" type="text" lang="en" value="' + esc(t.nameEn || '') + '">') +
          fld('tax-e-parent', T('cfg.tax.parentType', 'Nhóm tag cha'), '<select class="input" id="tax-e-parent">' + parentOptions(t, t.parent || '') + '</select>') +
          fld('tax-e-desc', T('common.description', 'Mô tả'), '<textarea class="input" id="tax-e-desc" rows="3">' + esc(t.desc) + '</textarea>') +
          '<div class="field"><label class="check-row" for="tax-e-multi"><input type="checkbox" id="tax-e-multi"' + (t.multi ? ' checked' : '') + '><span>' + esc(T('cfg.tax.multiCheck', 'Đa trị — một tài liệu có thể gắn nhiều tag')) + '</span></label><p class="text-xs muted">' + esc(T('cfg.tax.cardinalityHelp', 'Ví dụ: Loại văn bản → 1 loại; Sản phẩm → nhiều sản phẩm')) + '</p></div>' +
          '<div class="tax-detail-actions"><button class="btn btn-primary btn-sm" type="submit">' + esc(T('common.save', 'Lưu')) + '</button><button class="btn btn-secondary btn-sm" type="button" data-tax-ecancel>' + esc(T('common.cancel', 'Huỷ')) + '</button></div>';
      }
      dBody.innerHTML = hero(val ? val.name : t.name, val ? val.code : t.code, val ? pathOf(t) : (parentOf(t) ? pathOf(parentOf(t)) : '')) + '<form class="tax-edit-form" data-tax-eform novalidate aria-labelledby="tax-detail-h tax-hero-n">' + h + '</form>';
    }
    function renderDetail() {
      syncEditBtn();
      if (state.form === 'value') { // + Thêm › Tag: add-tag form in column 3
        var vt = curType();
        dTitle.textContent = T('cfg.tax.addTagValue', 'Thêm tag');
        dSub.textContent = ''; dSub.hidden = true;
        dBody.innerHTML = '<p class="muted text-sm" data-i18n-skip>' + esc((isKb() ? kbName() : 'Global') + ' · ' + pathOf(vt)) + '</p><form class="tax-edit-form" data-tax-vform novalidate aria-labelledby="tax-detail-h">' + valueFields('tax-v', null) + '</form>';
        return;
      }
      if (state.form) {
        var fp = state.formParent && byCode(state.formParent);
        dTitle.textContent = formTitle();
        dSub.textContent = ''; dSub.hidden = true;
        dBody.innerHTML = '<p class="muted text-sm">' + esc((isKb() ? kbName() : 'Global') + (fp ? ' · ' + pathOf(fp) : '')) + '</p><p class="muted text-sm">' + esc(T('cfg.tax.formHint', 'Điền thông tin nhóm tag ở cột giữa rồi bấm Lưu.')) + '</p>';
        return;
      }
      if (state.edit) { renderEditForm(); return; }
      var t = curType();
      dSub.textContent = ''; dSub.hidden = true;
      if (!t) {
        var nTags = data().reduce(function (n, x) { return n + x.values.length; }, 0);
        dTitle.textContent = T('cfg.tax.overview', 'Tổng quan taxonomy');
        dBody.innerHTML = '<dl class="tax-dl">' +
          row(T('cfg.tax.scope', 'Phạm vi'), esc(isKb() ? kbName() : 'Global')) +
          row(T('cfg.tax.tagGroups', 'Nhóm tag'), esc(T('cfg.tax.nGroupsTop', '{n} nhóm · {k} cấp cao nhất', { n: data().length, k: kids(null).length }))) +
          row(T('cfg.tax.tags', 'Tag'), esc(fmtNum(nTags))) + '</dl>' +
          '<p class="muted text-sm">' + esc(T('cfg.tax.overviewHint', 'Chọn một nhóm tag hoặc tag để xem chi tiết. Bấm lại hoặc nhấn Esc để bỏ chọn.')) + '</p>';
        return;
      }
      var val = curValue(t);
      if (!val) {
        var ch = kids(t.code), par = parentOf(t);
        dTitle.textContent = T('cfg.tax.detailType', 'Chi tiết nhóm tag');
        dBody.innerHTML = hero(t.name, t.code, par ? pathOf(par) : '', t.pending) + '<dl class="tax-dl tax-key">' +
          row(T('cfg.tax.parentType', 'Nhóm tag cha'), par ? esc(pathOf(par)) : '<span class="muted">' + esc(T('cfg.tax.topLevel', '— (cấp cao nhất)')) + '</span>') +
          row(T('cfg.tax.childTypes', 'Nhóm tag con'), ch.length ? '<ul class="tax-kids">' + ch.map(function (k) { return '<li><button type="button" class="link tax-link" data-tax-goto="' + esc(k.code) + '">' + esc(k.name) + '</button></li>'; }).join('') + '</ul>' : '<span class="muted">—</span>') +
          row(T('cfg.tax.cardinality', 'Số tag'), '<label class="check-row" for="tax-d-multi"><input type="checkbox" id="tax-d-multi" disabled' + (t.multi ? ' checked' : '') + '><span>' + esc(T('cfg.tax.multiCheck', 'Đa trị — một tài liệu có thể gắn nhiều tag')) + '</span></label>') + '</dl><dl class="tax-dl">' +
          row(T('common.description', 'Mô tả'), esc(t.desc)) +
          row(T('cfg.tax.inUse', 'Đang dùng'), esc(usage(t.kbs, t.docs))) +
          row(T('cfg.tax.history', 'Lịch sử thay đổi'), '<span class="muted" data-i18n-skip>v3 · ' + esc(t.owner) + '</span><br>' + vhLink('tax-type:' + t.code, inheritedType(t))) + '</dl>' + provenance(t.owner, t.pending);
        return;
      }
      dTitle.textContent = T('cfg.tax.detailValue', 'Chi tiết tag');
      var hist = valHist(t, val);
      var vlock = lockOf(inheritedVal(val), val);
      dBody.innerHTML = hero(val.name, val.code, pathOf(t), val.pending) + '<dl class="tax-dl">' +
        row(T('common.description', 'Mô tả'), esc(val.desc)) +
        row(T('cfg.tax.synonyms', 'Từ đồng nghĩa'), val.syn.length ? esc(val.syn.join(', ')) : '<span class="muted">—</span>') +
        row(T('cfg.tax.inUse', 'Đang dùng'), esc(usage(val.kbs, val.docs))) +
        row(T('cfg.tax.history', 'Lịch sử thay đổi'), '<ul class="tax-hist">' + hist.map(function (h) { return '<li><span class="muted">' + esc(h[0]) + ' · ' + esc(h[1]) + '</span><br>' + esc(h[2]) + '</li>'; }).join('') + '</ul>' + vhLink('tax-value:' + t.code + '/' + val.code, inheritedVal(val))) +
        '</dl>' + provenance(t.owner, val.pending) + '<div class="tax-detail-actions"><button class="btn btn-secondary btn-sm" type="button" data-tax-detail-toggle' + (vlock ? ' aria-disabled="true" title="' + esc(vlock) + '"' : '') + '>' + esc(val.on ? T('cfg.tax.mDisable', 'Tắt') : T('cfg.tax.colOn', 'Bật')) + '</button></div>';
    }

    // ---- +Thêm menu ----
    function renderAdd() {
      // two options: Thêm tag (only into a selected leaf group) · Thêm nhóm tag (child of the selected group, else level 0)
      var items = [], t = state.form === 'type' ? null : curType();
      // FE addMenu: none without EDIT_ITEMS (a preset waiting for its release review is locked; Consumer cannot edit)
      var cp = presetBar.current(); addMenu.hidden = !!(cp && cp.pending) || document.documentElement.getAttribute('data-role') === 'consumer';
      if (t && !isBranch(t)) items.push(['add-value', 'cfg.tax.menuTag', 'Tag']);
      items.push(['add-type', 'cfg.tax.menuGroup', 'Nhóm tag']); // labels without "Thêm": the button already says + Thêm
      addBox.innerHTML = items.map(function (x) { return '<button type="button" role="menuitem" class="menu-item" data-tax-add-act="' + x[0] + '">' + esc(T(x[1], x[2])) + '</button>'; }).join('');
    }

    function render() { renderTypes(); renderCol2(); renderDetail(); renderAdd(); }
    function selectType(code) {
      var focus = code;
      if (code === state.type && !state.form && !state.edit) code = null; // click the selected tag group again → unselect
      state.type = code; state.value = null; state.form = false; state.edit = null; state.formParent = null;
      if (code) reveal(code);
      render(); focusItem(item(focus));
    }
    // Esc (outside fields, menus and dialogs): unselect the tag first, then the tag group
    function unselect() {
      if (state.form || state.edit) return false;
      if (state.value) { var v = state.value; state.value = null; renderCol2(); renderDetail(); var tr = col2.querySelector('tr[data-tax-value="' + CSS.escape(v) + '"]'); if (tr) tr.focus(); return true; }
      if (state.type) { selectType(state.type); return true; }
      return false;
    }
    // verification status (new KBs only): the KB's own tag groups and tags; the option's data-kb is the KB in kb-data.js
    function setScope(s) {
      state.scope = s; state.form = false; state.edit = null; state.formParent = null; state.value = null;
      if (state.type && !byCode(state.type)) state.type = data()[0] ? data()[0].code : null;
      if (state.type) reveal(state.type); // expanded state (state.open) is kept across scopes
      render();
    }

    // ---- events ----
    sel.addEventListener('change', function () { setScope(sel.value); });
    listEl.addEventListener('click', function (e) {
      var kt = e.target.closest('[data-tax-kebab-toggle]');
      if (kt) { if (kt.getAttribute('aria-disabled') !== 'true') { var ty = curType(); setTypeOn(ty.code, ty.on === false); renderTypes(); } return; }
      if (e.target.closest('.tax-kebab')) return; // ⋮ menu handles itself
      var li = e.target.closest('[role="treeitem"]'); if (!li) return;
      if (e.target.closest('[data-tax-twisty]')) { setOpen(li, li.getAttribute('aria-expanded') !== 'true'); focusItem(li); return; } // toggle only
      selectType(li.getAttribute('data-tax-type'));
    });
    listEl.addEventListener('keydown', function (e) {
      var li = e.target;
      if (!li.matches || !li.matches('[role="treeitem"]')) return; // keys inside the ⋮ menu stay untouched
      var vis = visibleItems(), i = vis.indexOf(li), exp = li.getAttribute('aria-expanded');
      switch (e.key) {
        case 'ArrowDown': focusItem(vis[i + 1]); break;
        case 'ArrowUp': focusItem(vis[i - 1]); break;
        case 'Home': focusItem(vis[0]); break;
        case 'End': focusItem(vis[vis.length - 1]); break;
        case 'ArrowRight':
          if (exp === 'false') setOpen(li, true);
          else if (exp === 'true') focusItem(li.querySelector(':scope > ul > [role="treeitem"]'));
          break;
        case 'ArrowLeft':
          if (exp === 'true') setOpen(li, false);
          else focusItem(li.parentElement.closest('[role="treeitem"]'));
          break;
        case 'Enter': case ' ': selectType(li.getAttribute('data-tax-type')); break;
        default: return;
      }
      e.preventDefault();
    });
    function pickRow(tr) {
      var code = tr.getAttribute('data-tax-value');
      state.value = state.value === code ? null : code; state.edit = null; state.form = false; state.formParent = null;
      renderCol2(); renderDetail();
      if (state.value && taxNarrow()) taxDetailOpen(true); // <1200px the detail is an overlay drawer: open it on pick
      var again = col2.querySelector('tr[data-tax-value="' + CSS.escape(code) + '"]'); if (again) again.focus();
    }
    // branch row → select that child type in column 1 and show its own column-2 content
    function drill(code) {
      state.type = code; state.value = null; state.form = false; state.formParent = null; state.edit = null;
      reveal(code); render();
      var first = col2.querySelector('tr[data-tax-row]');
      if (first) first.focus(); else focusItem(item(code));
    }
    function activate(tr) { if (tr.hasAttribute('data-tax-child')) drill(tr.getAttribute('data-tax-child')); else pickRow(tr); }
    col2.addEventListener('click', function (e) {
      if (e.target.closest('button, a, input, label, summary, details, form')) return;
      var tr = e.target.closest('tr[data-tax-row]');
      if (tr) activate(tr);
    });
    col2.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tr = e.target.closest('tr[data-tax-row]');
      if (tr && e.target === tr) { e.preventDefault(); activate(tr); }
    });
    function setOn(code, on) {
      var t = curType(), val = null;
      t.values.forEach(function (x) { if (x.code === code) val = x; });
      if (submitted(val)) { state.edit = null; render(); return; } // Global: switch stays as it was, value now pending
      val.on = on;
      var tr = col2.querySelector('tr[data-tax-value="' + CSS.escape(code) + '"]');
      if (tr) { tr.classList.toggle('is-off', !on); var cb = tr.querySelector('[data-tax-toggle]'); if (cb) cb.checked = on; }
      if (state.value === code) {
        if (state.edit === 'value') { var sw = document.getElementById('tax-e-on'); if (sw) sw.checked = on; } // keep the open form
        else renderDetail();
      }
    }
    function setTypeOn(code, on) {
      var k = byCode(code); if (!k) return;
      if (submitted(k)) { state.edit = null; render(); return; }
      k.on = on;
      var tr = col2.querySelector('tr[data-tax-child="' + CSS.escape(code) + '"]');
      if (tr) { tr.classList.toggle('is-off', !on); var cb = tr.querySelector('[data-tax-type-toggle]'); if (cb) cb.checked = on; }
      var li = item(code); if (li) li.classList.toggle('is-off', !on);
    }
    col2.addEventListener('change', function (e) {
      var tc = e.target.closest('[data-tax-type-toggle]');
      if (tc) { setTypeOn(tc.closest('tr').getAttribute('data-tax-child'), tc.checked); return; }
      var cb = e.target.closest('[data-tax-toggle]');
      if (cb) setOn(cb.closest('tr').getAttribute('data-tax-value'), cb.checked);
    });
    // add-type form (column 2) · inline validation; Global → change request, KB → the group is created and selected
    function saveAdd() {
      clearErrs(col2);
      var nameEl = document.getElementById('ntf-name'), codeEl = document.getElementById('ntf-code');
      var name = nameEl.value.trim(), code = toCode(codeEl.value.trim() || name), first = null;
      if (!name) first = fieldErr('ntf-name', T('cfg.tax.displayNameRequired', 'Nhập tên hiển thị'));
      var cerr = !code ? T('cfg.tax.codeRequired', 'Nhập mã') : byCode(code) ? T('cfg.tax.codeTaken', 'Mã này đã được dùng') : '';
      if (cerr) { var ce = fieldErr('ntf-code', cerr); first = ce; } // code field comes first in the form
      if (first) { first.focus(); return; }
      codeEl.value = code;
      if (submitted(null)) { state.form = false; state.formParent = null; render(); return; }
      var par = gv('ntf-parent');
      LOCAL.push({ code: code, parent: par || undefined, name: name, nameEn: gv('ntf-name-en').trim(), multi: document.getElementById('ntf-multi').checked, owner: 'Nguyễn Lan', kbs: 1, docs: 0, desc: gv('ntf-desc').trim(), values: [], on: true });
      say(T('cfg.tax.toastTypeSaved', 'Đã lưu nhóm tag'));
      state.form = false; state.formParent = null;
      selectType(code);
    }
    // add-tag form (column 3) · name before code, as the API; Global → change request, KB → the tag is created and selected
    function saveAddValue() {
      clearErrs();
      var t = curType(), name = gv('tax-v-name').trim(), code = toCode(gv('tax-v-code').trim() || name), bad = null;
      if (!name) bad = fieldErr('tax-v-name', T('cfg.tax.displayNameRequired', 'Nhập tên hiển thị'));
      else if (t.values.some(function (x) { return x.name === name; })) bad = fieldErr('tax-v-name', T('cfg.tax.valueTaken', 'Nhóm tag này đã có tag cùng tên hiển thị'));
      var cerr = !code ? T('cfg.tax.codeRequired', 'Nhập mã') : t.values.some(function (x) { return x.code === code; }) ? T('cfg.tax.codeTaken', 'Mã này đã được dùng') : '';
      if (cerr) bad = fieldErr('tax-v-code', cerr); // code field comes first in the form
      if (bad) { bad.focus(); return; }
      state.form = false;
      if (submitted(null)) { render(); return; }
      var seen = {}, nv = v(name, gv('tax-v-desc').trim(), 0, { code: code, own: true, on: document.getElementById('tax-v-on').checked, syn: gv('tax-v-syn').split(',').map(function (x) { return x.trim(); }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }) });
      nv.nameEn = gv('tax-v-name-en').trim(); nv.kbs = 1;
      t.values.push(nv);
      say(T('cfg.tax.toastAddValue', 'Đã thêm tag'));
      state.value = code; render();
      var tr = col2.querySelector('tr[data-tax-value="' + CSS.escape(code) + '"]'); if (tr) tr.focus();
    }
    col2.addEventListener('submit', function (e) { if (!e.target.matches('[data-tax-type-form]')) return; e.preventDefault(); saveAdd(); });
    // auto-suggest the code from the display name while the code is empty / untouched
    var PAIRS = { 'ntf-name': 'ntf-code', 'tax-v-name': 'tax-v-code' };
    cols.addEventListener('input', function (e) {
      var id = e.target.id;
      if (PAIRS[id]) { var c = document.getElementById(PAIRS[id]); if (c && !c.readOnly && c.getAttribute('data-auto') === '1') c.value = toCode(e.target.value); }
      else if (id === 'ntf-code' || id === 'tax-v-code') e.target.setAttribute('data-auto', e.target.value.trim() ? '0' : '1');
    });
    dBody.addEventListener('click', function (e) {
      var go = e.target.closest('[data-tax-goto]');
      if (go) { selectType(go.getAttribute('data-tax-goto')); return; }
      var tg = e.target.closest('[data-tax-detail-toggle]');
      if (tg) { var val = curValue(curType()); if (val && tg.getAttribute('aria-disabled') !== 'true') setOn(val.code, !val.on); return; }
      if (e.target.closest('[data-tax-ecancel]')) { if (state.form === 'value') { state.form = false; renderDetail(); renderAdd(); } else closeEdit(); }
    });
    // ---- column-3 edit mode ----
    function openEdit(focus) {
      if (state.form || !canEdit()) return;
      state.edit = curValue(curType()) ? 'value' : 'type';
      renderDetail();
      var n = document.getElementById('tax-e-name'); if (focus && n) n.focus();
    }
    function closeEdit() { state.edit = null; renderDetail(); editBtn.focus(); }
    function fieldErr(id, msg) {
      var el = document.getElementById(id), er = document.getElementById(id + '-err');
      er.textContent = msg; er.hidden = false;
      el.setAttribute('aria-invalid', 'true');
      var d = (el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
      if (d.indexOf(id + '-err') < 0) d.push(id + '-err');
      el.setAttribute('aria-describedby', d.join(' '));
      return el;
    }
    function clearErrs(root) {
      (root || dBody).querySelectorAll('.field-err').forEach(function (er) {
        er.hidden = true; er.textContent = '';
        var el = document.getElementById(er.id.replace(/-err$/, '')); if (!el) return;
        el.removeAttribute('aria-invalid');
        var d = (el.getAttribute('aria-describedby') || '').split(' ').filter(function (x) { return x && x !== er.id; });
        if (d.length) el.setAttribute('aria-describedby', d.join(' ')); else el.removeAttribute('aria-describedby');
      });
    }
    function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    function saveEdit() {
      clearErrs();
      var t = curType(), val = state.edit === 'value' ? curValue(t) : null, bad = null;
      var name = gv('tax-e-name').trim();
      if (!name) bad = bad || fieldErr('tax-e-name', T('cfg.tax.displayNameRequired', 'Nhập tên hiển thị'));
      if (val) {
        if (name && t.values.some(function (x) { return x !== val && x.name === name; })) bad = bad || fieldErr('tax-e-name', T('cfg.tax.valueTaken', 'Nhóm tag này đã có tag cùng tên hiển thị'));
        if (bad) { bad.focus(); return; }
        if (submitted(val)) { closeEdit(); render(); return; } // Global: waits for its change request
        var seen = {};
        val.name = name; val.nameEn = gv('tax-e-name-en').trim(); val.desc = gv('tax-e-desc').trim();
        val.syn = gv('tax-e-syn').split(',').map(function (x) { return x.trim(); }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; });
        val.on = document.getElementById('tax-e-on').checked;
      } else {
        if (bad) { bad.focus(); return; }
        if (submitted(t)) { closeEdit(); render(); return; }
        var p = gv('tax-e-parent');
        t.name = name; t.nameEn = gv('tax-e-name-en').trim(); t.desc = gv('tax-e-desc').trim(); t.multi = document.getElementById('tax-e-multi').checked;
        if (p && p !== t.code) { t.parent = p; state.open[p] = true; } else delete t.parent;
        reveal(t.code);
      }
      state.edit = null;
      render();
      editBtn.focus();
      say(T('cfg.tax.toastSaved', 'Đã lưu'));
    }
    editBtn.addEventListener('click', function () { if (editBtn.getAttribute('aria-disabled') === 'true') return; openEdit(true); });
    dBody.addEventListener('submit', function (e) {
      if (e.target.matches('[data-tax-vform]')) { e.preventDefault(); saveAddValue(); return; }
      if (!e.target.matches('[data-tax-eform]')) return; e.preventDefault(); saveEdit();
    });
    detail.addEventListener('keydown', function (e) { // Esc in the edit / add-tag form cancels it
      if (e.key !== 'Escape' || !(state.edit || state.form === 'value') || !dBody.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      if (state.edit) closeEdit(); else { state.form = false; renderDetail(); renderAdd(); }
    });
    // +Thêm menu
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-tax-add-act]');
      if (a) {
        var act = a.getAttribute('data-tax-add-act');
        addMenu.removeAttribute('open');
        if (act === 'add-type') {
          var cur = state.form === 'type' ? byCode(state.formParent) : curType(); // form already open → keep its level
          if (cur && !isBranch(cur) && cur.values.length) say(T('cfg.tax.toastChildMoveHint', 'Tag hiện có sẽ cần chuyển sang nhóm con'));
          state.formParent = cur ? cur.code : null;
          state.form = 'type'; state.value = null; state.edit = null; render();
          var n = document.getElementById('ntf-name'); if (n) n.focus();
        } else if (act === 'add-value') {
          state.form = 'value'; state.value = null; state.edit = null; taxDetailOpen(true); render();
          var vn = document.getElementById('tax-v-name'); if (vn) vn.focus();
        }
        return;
      }
      // close open taxonomy menus on outside click (and after picking an item)
      document.querySelectorAll('details.tax-add-menu[open]').forEach(function (d) {
        if (!d.contains(e.target) || e.target.closest('.menu-item')) d.removeAttribute('open');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var menus = document.querySelectorAll('details.tax-add-menu[open]');
      menus.forEach(function (d) { d.removeAttribute('open'); var s = d.querySelector('summary'); if (s) s.focus(); });
      if (menus.length || e.defaultPrevented || e.target.closest('input, textarea, select, form') || document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])')) return;
      if (unselect()) e.preventDefault();
    });

    // ---- initial state from the URL ----
    var q = new URLSearchParams(location.search);
    var scope = q.get('scope'), tab = q.get('tab');
    if (!scope && tab === 'local') scope = sel.options[1].value;
    var ok = false;
    for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === scope) ok = true;
    sel.value = ok ? scope : 'global';
    state.scope = sel.value; presetBar.render();
    var node = (q.get('node') || '').replace(/^[gl]-tt-/, '');
    state.type = byCode(node) ? node : null; // normal mode: nothing selected unless ?node= is given
    if (state.type) reveal(state.type);
    var want = q.get('value');
    if (want && state.type) curType().values.forEach(function (x) { if (!state.value && (x.code === want || x.name === want)) state.value = x.code; });
    function taxNarrow() { return window.matchMedia('(max-width: 1199px)').matches; }
    function taxDetailOpen(open) {
      detail.classList.toggle('is-collapsed', !open);
      document.querySelectorAll('[data-panel-toggle="tax-detail"]').forEach(function (b) { b.setAttribute('aria-expanded', String(open)); });
    }
    if (taxNarrow() && !state.value) taxDetailOpen(false);
    if (q.get('detail') === 'collapsed') {
      detail.classList.add('is-collapsed');
      document.querySelectorAll('[data-panel-toggle="tax-detail"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    }
    render();
    if (q.get('edit') === '1') openEdit(true);
    if (q.get('menu') === 'kebab') { var k = document.getElementById('tax-kebab'); if (k) k.setAttribute('open', ''); }
    if (q.get('menu') === 'add') addMenu.setAttribute('open', '');
  });
})();

/* Taxonomy · resizable columns 1 and 3 (drag or arrow keys). Each side column is clamped to
   [min, 40% of the 3-column content width]; column 2 takes the rest. Widths persist in localStorage. */
(function () {
  function init() {
  var main = document.querySelector('.tax-cfg-main');
  var cols = main && main.querySelector('[data-tax-cols]');
  if (!cols) return;
  var MIN = { c1: 180, c3: 240 }, MAX_RATIO = 0.4, KEY = 'kc.tax.colw';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  function cur(k) { return parseFloat(getComputedStyle(main).getPropertyValue('--tax-' + k)) || MIN[k]; }
  var MIN_C2 = 360;
  function other(k) { if (k === 'c1') { var d = cols.querySelector('.tax-detail'); return d && d.offsetParent && !d.classList.contains('is-collapsed') ? cur('c3') : 0; } return cur('c1'); }
  // side column: at most 40% of the content width, and never so wide that column 2 drops below MIN_C2
  function clamp(k, px) { var W = cols.clientWidth, max = Math.max(MIN[k], Math.min(Math.floor(W * MAX_RATIO), W - other(k) - MIN_C2)); return Math.round(Math.min(max, Math.max(MIN[k], px))); }
  function apply(k, px, persist) {
    var w = clamp(k, px);
    main.style.setProperty('--tax-' + k, w + 'px');
    var h = cols.querySelector('[data-tax-resize="' + k + '"]');
    if (h) { h.setAttribute('aria-valuenow', Math.round(w / cols.clientWidth * 100)); h.setAttribute('aria-valuetext', w + 'px'); }
    if (persist) { saved[k] = w; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {} }
  }
  ['c1', 'c3'].forEach(function (k) { apply(k, saved[k] || cur(k), false); });
  cols.querySelectorAll('[data-tax-resize]').forEach(function (h) {
    var k = h.getAttribute('data-tax-resize');
    h.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      var x0 = e.clientX, w0 = cur(k);
      h.classList.add('is-dragging'); document.body.classList.add('tax-resizing');
      function move(ev) { var dx = ev.clientX - x0; apply(k, k === 'c1' ? w0 + dx : w0 - dx, false); }
      function up() { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); h.classList.remove('is-dragging'); document.body.classList.remove('tax-resizing'); apply(k, cur(k), true); }
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
    h.addEventListener('dblclick', function () { main.style.removeProperty('--tax-' + k); delete saved[k]; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {} apply(k, cur(k), false); });
    h.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 40 : 10, d = 0;
      if (e.key === 'ArrowLeft') d = -step; else if (e.key === 'ArrowRight') d = step; else if (e.key === 'Home') d = -9999; else if (e.key === 'End') d = 9999; else return;
      e.preventDefault(); apply(k, cur(k) + (k === 'c1' ? d : -d), true);
    });
  });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { ['c1', 'c3'].forEach(function (k) { apply(k, cur(k), false); }); }, 80); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* ===== Excel-style per-column multi-select filter (Documents table only) =====
   Self-contained IIFE. Guarded to #panel-docs so no other page runs it; uses only
   .xf-* classes and data-col-filter, never the shared data-exclusive/aria-pressed
   chip delegate. Within a column checked values are OR'd; across columns AND'd. */
(function () {
  function init() {
    var panel = document.getElementById('panel-docs');
    if (!panel) return;
    var table = panel.querySelector('table.doc-table');
    if (!table) return;
    var ths = panel.querySelectorAll('thead th[data-col-filter]');
    if (!ths.length) return;
    var rows = [].slice.call(table.querySelectorAll('tbody tr[data-kind]'));
    var emptyRow = panel.querySelector('.filter-empty');

    var T = function (k, vi, args) { var I = window.ECP_I18N; return I && I.tr ? I.tr(k, vi, args) : vi; };
    var KIND_LABELS = { pdf: 'PDF', word: 'Word', ppt: 'Presentation', img: T('ek.kindImg', 'Ảnh scan') };

    // per-column value extractor from a row
    function valueOf(col, row) {
      if (col === 'kind') return row.getAttribute('data-kind') || '';
      if (col === 'status') {
        var sw = row.querySelector('[data-kb-doc-switch]'); // web: the column is the Kích hoạt switch
        return sw ? T(sw.getAttribute('aria-checked') === 'true' ? 'ek.activeOn' : 'ek.activeOff', sw.getAttribute('aria-checked') === 'true' ? 'Đang kích hoạt' : 'Đã tắt') : '';
      }
      return '';
    }
    function labelOf(col, val) {
      if (col === 'kind') return KIND_LABELS[val] || val;
      return val;
    }

    // state[col] = Set of checked values when engaged, or null when not engaged (= show all)
    var state = { kind: null, status: null };
    var cols = [];
    var openPop = null;

    // paging runs after the column filters: only the filtered rows are paged. A filter change goes back to page 1.
    var page = 1, sizeSel = document.getElementById('docs-size'), size = sizeSel ? parseInt(sizeSel.value, 10) : 10; // web: no rows-per-page selector on Documents
    function apply(keepPage) {
      if (!keepPage) page = 1;
      var qv = ((document.querySelector('[data-kb-q]') || {}).value || '').trim().toLowerCase();
      var passed = rows.filter(function (row) {
        if (qv && (row.querySelector('.t-title') || row).textContent.toLowerCase().indexOf(qv) < 0) return false;
        for (var i = 0; i < cols.length; i++) {
          var sel = state[cols[i].col];
          if (sel && !sel.has(valueOf(cols[i].col, row))) return false;
        }
        return true;
      });
      var pages = Math.max(1, Math.ceil(passed.length / size));
      if (page > pages) page = pages;
      var from = (page - 1) * size, shown = passed.slice(from, from + size);
      rows.forEach(function (row) { row.hidden = shown.indexOf(row) < 0; });
      if (emptyRow) emptyRow.hidden = passed.length > 0;
      renderPager(passed.length, from, shown.length, pages);
    }
    function renderPager(total, from, count, pages) {
      var box = document.getElementById('docs-pages'); if (!box) return;
      document.getElementById('docs-range').textContent = T('jd.rangeOf', 'Hiển thị {a}–{b} / {n} tài liệu', { a: total ? from + 1 : 0, b: from + count, n: total });
      box.textContent = '';
      // ponytail: every page number is listed; add ellipsis paging (job-detail.js pageList) if a KB gets many pages
      for (var p = 1; p <= pages; p++) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = p;
        b.setAttribute('aria-label', T('ek.pageN', 'Trang {n}', { n: p }));
        if (p === page) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', (function (n) { return function () { page = n; apply(true); var c = box.querySelector('[aria-current]'); if (c) c.focus(); }; })(p));
        box.appendChild(b);
      }
      document.getElementById('docs-prev').disabled = page <= 1;
      document.getElementById('docs-next').disabled = page >= pages;
    }
    var qIn = document.querySelector('[data-kb-q]');
    if (qIn) qIn.addEventListener('input', function () { apply(); });
    if (sizeSel) sizeSel.addEventListener('change', function () { size = parseInt(sizeSel.value, 10) || 10; apply(); });
    if (document.getElementById('docs-prev')) {
      document.getElementById('docs-prev').addEventListener('click', function () { if (page > 1) { page--; apply(true); } });
      document.getElementById('docs-next').addEventListener('click', function () { page++; apply(true); });
    }

    function buildColumn(th) {
      var col = th.getAttribute('data-col-filter');
      var holder = th.querySelector('.xf-th');
      var btn = holder && holder.querySelector('.xf-btn');
      if (!holder || !btn) return null;

      // distinct values present + counts, in first-seen order
      var order = [], counts = {};
      rows.forEach(function (row) {
        var v = valueOf(col, row);
        if (!v) return;
        if (!(v in counts)) { counts[v] = 0; order.push(v); }
        counts[v]++;
      });

      var pop = document.createElement('div');
      pop.className = 'xf-pop';
      pop.hidden = true;

      var search = document.createElement('input');
      search.type = 'text';
      search.className = 'xf-search';
      search.placeholder = T('ek.xfSearch', 'Tìm…');
      search.setAttribute('aria-label', T('ek.xfSearchAria', 'Tìm giá trị'));
      pop.appendChild(search);

      var list = document.createElement('ul');
      list.className = 'xf-list';

      // "Select all" row
      var allLi = document.createElement('li');
      var allLbl = document.createElement('label');
      allLbl.className = 'xf-opt';
      var allCb = document.createElement('input');
      allCb.type = 'checkbox';
      allCb.checked = true;
      var allTxt = document.createElement('span');
      allTxt.className = 'xf-lbl';
      allTxt.textContent = T('common.all', 'Tất cả');
      allLbl.appendChild(allCb);
      allLbl.appendChild(allTxt);
      allLi.appendChild(allLbl);
      list.appendChild(allLi);

      var sep = document.createElement('hr');
      sep.className = 'xf-sep';
      list.appendChild(sep);

      var optBoxes = [], optItems = [];
      order.forEach(function (val) {
        var li = document.createElement('li');
        li.setAttribute('data-value', val);
        var lbl = document.createElement('label');
        lbl.className = 'xf-opt';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.value = val;
        var txt = document.createElement('span');
        txt.className = 'xf-lbl';
        txt.textContent = labelOf(col, val);
        var cnt = document.createElement('span');
        cnt.className = 'muted';
        cnt.textContent = String(counts[val]);
        lbl.appendChild(cb);
        lbl.appendChild(txt);
        lbl.appendChild(cnt);
        li.appendChild(lbl);
        list.appendChild(li);
        optBoxes.push(cb);
        optItems.push(li);
      });
      pop.appendChild(list);

      var foot = document.createElement('div');
      foot.className = 'xf-foot';
      var clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'xf-clear';
      clearBtn.textContent = T('ek.xfClear', 'Xóa lọc');
      foot.appendChild(clearBtn);
      pop.appendChild(foot);

      holder.appendChild(pop);

      var entry = { col: col, th: th, btn: btn, pop: pop, search: search, allCb: allCb, optBoxes: optBoxes, total: order.length };

      // reflect current state onto the UI (checkboxes + indicator)
      function sync() {
        var sel = state[col];
        var checkedCount = 0;
        optBoxes.forEach(function (cb) {
          var on = sel ? sel.has(cb.value) : true;
          cb.checked = on;
          if (on) checkedCount++;
        });
        allCb.checked = checkedCount === optBoxes.length;
        allCb.indeterminate = checkedCount > 0 && checkedCount < optBoxes.length;
        var engaged = checkedCount < optBoxes.length; // not all selected
        th.classList.toggle('is-filtered', engaged);
      }

      // read the UI into state then apply
      function commit() {
        var set = Object.create(null);
        var sel = new Set();
        var allOn = true;
        optBoxes.forEach(function (cb) {
          if (cb.checked) sel.add(cb.value); else allOn = false;
        });
        state[col] = allOn ? null : sel; // all checked => not engaged
        sync();
        apply();
      }

      optBoxes.forEach(function (cb) {
        cb.addEventListener('change', commit);
      });
      allCb.addEventListener('change', function () {
        var on = allCb.checked;
        optBoxes.forEach(function (cb) { cb.checked = on; });
        commit();
      });
      clearBtn.addEventListener('click', function () {
        state[col] = null;
        sync();
        apply();
      });
      search.addEventListener('input', function () {
        var q = search.value.trim().toLowerCase();
        order.forEach(function (val, idx) {
          var match = labelOf(col, val).toLowerCase().indexOf(q) !== -1;
          optItems[idx].hidden = !match;
        });
      });

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (pop.hidden) openColumn(entry); else closeColumn(entry, false);
      });

      entry.sync = sync;
      sync();
      return entry;
    }

    function openColumn(entry) {
      if (openPop && openPop !== entry) closeColumn(openPop, false);
      entry.pop.hidden = false;
      entry.btn.setAttribute('aria-expanded', 'true');
      openPop = entry;
      try { entry.search.focus(); } catch (e) {}
    }
    function closeColumn(entry, refocus) {
      entry.pop.hidden = true;
      entry.btn.setAttribute('aria-expanded', 'false');
      if (openPop === entry) openPop = null;
      if (refocus) { try { entry.btn.focus(); } catch (e) {} }
    }

    [].forEach.call(ths, function (th) {
      var entry = buildColumn(th);
      if (entry) cols.push(entry);
    });

    document.addEventListener('mousedown', function (e) {
      if (!openPop) return;
      if (!openPop.pop.parentNode.contains(e.target)) closeColumn(openPop, false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openPop) closeColumn(openPop, true);
    });

    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
