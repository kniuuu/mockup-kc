/* ECP mockups: Neo4j-style interactive graph built on d3@7.9.0 (force layout, SVG). Filter triple list is type-level (ecpg-type-triples): one row per distinct subjType–relType→objType.
   Auto-mounts every [data-ecpg-dataset]. API: window.ECPGraph.mount(el, opts); el.ecpg = { fit, zoomBy, relayout, expand, select, counts, filter: { state, open, close, reset, toggleNode, toggleRel, toggleLayer, setAll, toggleTriple, showAll } }.
   Option autoLayer (opts.autoLayer or data-ecpg-auto-layer="1", default false; knowledge-graph page only): selecting node/rel types auto-ticks the graph layer(s) they belong to and the active layer set (manual ∪ auto) feeds back into layer→node/rel narrowing; an auto-ticked layer never hides the triggering type, and auto-unticks when its last producing type is deselected (manual layer selections persist). filter.state() then also exposes autoLayer (bool), manualLayers, autoLayers, activeLayers (= manual ∪ auto); selLayers stays = manual. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  // i18n (assets/i18n.js): T(key, viFallback, args); falls back to the vi literal when i18n.js is absent
  var T = (window.ECP_I18N && window.ECP_I18N.tr) || function (k, v, a) { return String(v).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); };
  var LBL = { Document: 'kg.lbl.document', Policy: 'kg.lbl.policy', Regulation: 'kg.lbl.regulation', Department: 'kg.lbl.department', Person: 'kg.lbl.person', Product: 'kg.lbl.product', Concept: 'kg.lbl.concept', Process: 'kg.lbl.process' };
  // Neo4j palette: fill, stroke, caption (caption/fill contrast >= 4.5:1)
  var PALETTE = {
    Document: ['#F79767', '#E07B4A', '#1F2A37', 'Tài liệu'],
    Policy: ['#FFC454', '#E0A52F', '#1F2A37', 'Chính sách'],
    Regulation: ['#F16667', '#D94A4B', '#1F2A37', 'Quy định'],
    Department: ['#8DCC93', '#6BAF72', '#1F2A37', 'Phòng ban'],
    Person: ['#57C7E3', '#3AAACB', '#1F2A37', 'Nhân sự'],
    Product: ['#C990C0', '#AD72A4', '#1F2A37', 'Sản phẩm'],
    Concept: ['#D9C8AE', '#BFAE93', '#1F2A37', 'Khái niệm'],
    Process: ['#2F6DB5', '#1F5596', '#FFFFFF', 'Quy trình'],
    Domain: ['#C990C0', '#AD72A4', '#1F2A37', 'Domain'],
    Evidence: ['#57C7E3', '#3AAACB', '#1F2A37', 'Evidence']
  };
  var BASE_R = { Department: 30, Regulation: 30, Policy: 26, Process: 26, Product: 26, Domain: 28, Document: 24, Concept: 24, Evidence: 24, Person: 22 };
  // relationship-type category colours (filter tags); caption via captionFor() = #1F2A37, >= 6.40:1 on every entry
  var REL_PALETTE = ['#68BDF6', '#F3A6D1', '#9DD7A5', '#FFD86E', '#B6A1E8', '#F9A98B', '#7FD1C7', '#C9D86A', '#E7B6F0', '#A9C7FF', '#F2C49B', '#B5D6E8', '#D7A9A0', '#B9E0A5'];
  var FICONS = { filter: '<path d="M4 5h16l-6 7.5V18l-4 2v-7.5z"/>', eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>',
    legend: '<circle cx="6" cy="7" r="2.2"/><circle cx="6" cy="17" r="2.2"/><path d="M11 7h9M11 17h9"/>' };
  // graph layers (ecpg-filter-v2): type -> layers; Domain-layer instances -> concrete domain (keyed by BASE dataset)
  var LAYERS = ['concept', 'evidence', 'structure', 'provenance']; // + dynamic 'dom:<name>'
  var LAYER_GROUP = { concept: 'semantic', evidence: 'semantic', structure: 'lexical', provenance: 'lexical' };
  var LAYER_NAME = { concept: ['kg.f.lConcept', 'Concept'], evidence: ['kg.f.lEvidence', 'Evidence'], structure: ['kg.f.lStructure', 'Structure'], provenance: ['kg.f.lProvenance', 'Provenance'] };
  var LAYER_COL = { dom: ['#C990C0', '#AD72A4', '#1F2A37'], concept: ['#D9C8AE', '#BFAE93', '#1F2A37'], evidence: ['#57C7E3', '#3AAACB', '#1F2A37'],
    structure: ['#A9C7FF', '#7FA3E0', '#1F2A37'], provenance: ['#8DCC93', '#6BAF72', '#1F2A37'] };
  var LAYER_MAP = {
    bank: { types: { Product: ['domain'], Process: ['domain'], Policy: ['concept'], Regulation: ['concept'], Concept: ['concept'],
      Document: ['evidence', 'structure'], Department: ['provenance'], Person: ['provenance'] },
      domains: { 'Tín dụng doanh nghiệp': ['prod-sme', 'prod-5ty', 'prod-baolanh', 'prod-xnk', 'proc-khdn', 'proc-thamdinh', 'proc-pd2', 'proc-dinhgia', 'proc-giaingan'],
        'Tín dụng cá nhân': ['prod-vaytd', 'prod-vaynha'], 'Thẻ': ['prod-the'], 'Tuân thủ': ['proc-kyc'] } },
    ontology: { types: { Domain: ['domain'], Concept: ['concept'], Evidence: ['evidence'], Document: ['structure', 'provenance'] },
      domains: { 'Tín dụng doanh nghiệp': ['t-loan', 't-collateral', 't-org'], 'Khách hàng': ['t-customer'], 'Sản phẩm': ['t-product'] } }
  };
  var ICONS = {
    in: '<path d="M12 5v14M5 12h14"/>', out: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    re: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    all: '<circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="5" r="1.8"/><circle cx="19.5" cy="5" r="1.8"/><circle cx="4.5" cy="19" r="1.8"/><circle cx="19.5" cy="19" r="1.8"/><path d="M6 6.3l4.2 4M18 6.3l-4.2 4M6 17.7l4.2-4M18 17.7l-4.2-4"/>'
  };
  var uid = 0;

  function h(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lum(hex) {
    var c = hex.replace('#', '').match(/../g).map(function (x) { x = parseInt(x, 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function captionFor(fill) { return contrast(fill, '#1F2A37') >= 4.5 ? '#1F2A37' : '#FFFFFF'; }

  function resolve(name) {
    var all = window.ECP_GRAPH_DATA || {};
    var d = all[name];
    if (!d) return null;
    var base = d.base ? all[d.base] : d;
    var visible = d.nodeIds ? d.nodeIds.slice() : base.nodes.filter(function (n) { return !n.hidden; }).map(function (n) { return n.id; });
    return {
      nodes: base.nodes.map(function (n) { return { id: n.id, labels: n.labels, caption: n.caption, props: n.props }; }),
      rels: base.rels.map(function (r) { return { id: r.id, source: r.source, target: r.target, type: r.type, status: r.status, props: r.props }; }),
      visible: visible, focus: d.focus, base: d.base || name
    };
  }

  function mount(el, opts) {
    opts = opts || {};
    if (el.ecpg) return el.ecpg;
    if (!window.d3) { el.innerHTML = '<div class="ecpg-msg">' + T('kg.libError', 'Không tải được thư viện graph') + '</div>'; return null; }
    var d3 = window.d3;
    var data = resolve(opts.dataset || el.getAttribute('data-ecpg-dataset'));
    if (!data) { el.innerHTML = '<div class="ecpg-msg">' + T('kg.noData', 'Không có dữ liệu graph') + '</div>'; return null; }
    var id = 'ecpg' + (++uid);
    var compact = (opts.variant || el.getAttribute('data-ecpg-variant')) === 'compact';
    var focusId = opts.focus || el.getAttribute('data-ecpg-focus') || data.focus;
    var inspSel = opts.inspector || el.getAttribute('data-ecpg-inspector');
    var inspTarget = inspSel ? document.querySelector(inspSel) : null;
    // opt-in: reverse auto-select of graph layers from node/rel selection (ecpg-layer-autoselect, Option B). Default false
    // so the other graph mounts are byte-for-byte unchanged; only the knowledge-graph page sets data-ecpg-auto-layer="1".
    var autoLayer = (opts.autoLayer != null ? opts.autoLayer : el.getAttribute('data-ecpg-auto-layer') === '1');
    // opt-in: bottom-left node-color legend (kg-chat-legend). Default false so the other graph mounts stay byte-for-byte
    // unchanged; only the knowledge-graph page sets data-ecpg-legend="1".
    var legend = (opts.legend != null ? opts.legend : el.getAttribute('data-ecpg-legend') === '1');
    // opt-in: selected-properties APPENDS each new selection as an entry (no expand/unpin/open-evidence buttons) instead of the
    // built-in replace inspector. Default false so the other 6 inspector-bound mounts stay byte-for-byte unchanged; only the
    // knowledge-graph page sets data-ecpg-inspector-append="1".
    var insAppend = inspTarget && (opts.insAppend != null ? opts.insAppend : el.getAttribute('data-ecpg-inspector-append') === '1');
    // opt-in (knowledge-graph page only, data-ecpg-fe="1"): mirror the Knowledge Graph screen of micro-frontend/web
    // (features/knowledge-graph): FE toolbar / legend / node+relationship tables / prop-card are built in the host section,
    // the built-in filter, zoom toolbar, legend panel and relationship selection are off; other mounts are unchanged.
    var fe = el.getAttribute('data-ecpg-fe') === '1';
    if (fe) {
      // demo states as in the FE: ?state=loading | error | empty (toolbar without counts + a message instead of the canvas)
      var st = new URLSearchParams(location.search).get('state');
      var stMsg = { loading: ['mk.web.kg.loading', 'Đang tải graph…', 'status'], error: ['mk.esr.errorTitle', 'Không tải được kết quả', 'alert'], empty: ['kg.noData', 'Không có dữ liệu graph', ''] }[st];
      if (stMsg) {
        var host0 = el.parentNode, tb0 = h('div', { class: 'kg-tools', role: 'toolbar', 'aria-label': T('kg.tools', 'Điều khiển graph') });
        tb0.innerHTML = '<button class="btn btn-secondary btn-sm" type="button" aria-pressed="false">' + esc(T('kg.listView', 'Xem dạng danh sách')) + '</button>' +
          '<button class="btn btn-ghost btn-sm" type="button">' + esc(T('kg.showFull', 'Hiện toàn bộ graph')) + '</button>';
        var m0 = h('p', stMsg[2] ? { class: 'ecpg-msg', role: stMsg[2] } : { class: 'ecpg-msg' }, esc(T(stMsg[0], stMsg[1])));
        host0.insertBefore(tb0, el); host0.replaceChild(m0, el);
        if (inspTarget) inspTarget.innerHTML = ''; // nothing is selected yet
        return null;
      }
    }
    el.classList.add('ecpg');
    // node captions / properties are sample data (ecp-graph-data.js) and stay in their source language
    el.setAttribute('data-i18n-skip', '');
    if (inspTarget) inspTarget.setAttribute('data-i18n-skip', '');
    if (compact) el.classList.add('compact');
    // edge labels show on hover / selection only (label collisions); data-ecpg-edge-labels="always" keeps them on
    if ((opts.edgeLabels || el.getAttribute('data-ecpg-edge-labels')) === 'always') el.classList.add('ecpg-labels-always');
    // data-ecpg-hop="1": open focused on the focus node's 1-hop neighbourhood (a toolbar button restores the full graph)
    var hop1 = (opts.hop || el.getAttribute('data-ecpg-hop')) === '1' && !!focusId;
    var rScale = compact ? 0.8 : 1;

    var byId = {}; data.nodes.forEach(function (n) { byId[n.id] = n; });
    var shown = new Set(data.visible);
    function hopSet() { var s = new Set([focusId]); data.rels.forEach(function (r) { if (r.source === focusId) s.add(r.target); else if (r.target === focusId) s.add(r.source); }); return s; }
    if (hop1 && byId[focusId]) shown = hopSet();
    var fSelL = new Set(), fSelN = new Set(), fSelR = new Set(), fHide = new Set(), fOpen = false;
    // kg-legend-toggle: per-instance set of node-type labels hidden via the interactive legend. This is a PURE DISPLAY mask,
    // SEPARATE from the filter query (fSel*/fHide) — it is read ONLY inside visibleNodeIds() and is NEVER written into any filter
    // state, so the filter panel, layer auto-select, triples, counts and prune() are unchanged by legend toggling. Stays empty on
    // the other 6 mounts (only the KG page builds the interactive legend), so visibleNodeIds() is byte-identical there.
    var legendHidden = new Set();
    var lmap = LAYER_MAP[data.base] || { types: {}, domains: {} }, domOf = {}, domOrder = Object.keys(lmap.domains);
    domOrder.forEach(function (dn) { lmap.domains[dn].forEach(function (nid) { domOf[nid] = dn; }); });
    var started = false;
    var expanded = new Set();
    var selected = null; // {kind, data}
    var labelOrder = [], typeOrder = [];
    data.nodes.forEach(function (n) { if (labelOrder.indexOf(n.labels[0]) < 0) labelOrder.push(n.labels[0]); });
    data.rels.forEach(function (r) { if (typeOrder.indexOf(r.type) < 0) typeOrder.push(r.type); });
    labelOrder.forEach(setLabelVars);

    function pal(l) { return PALETTE[l] || ['#D9C8AE', '#BFAE93', '#1F2A37', l]; }
    function lblName(l) { var p = pal(l); return LBL[l] ? T(LBL[l], p[3]) : p[3]; }
    function setLabelVars(l) {
      var p = pal(l);
      el.style.setProperty('--ecpg-f-' + l, p[0]);
      el.style.setProperty('--ecpg-s-' + l, p[1]);
      el.style.setProperty('--ecpg-t-' + l, p[2]);
    }
    function radius(n) {
      var l = n.labels[0];
      return ((BASE_R[l] || 24) + Math.min(8, n.degree || 0)) * rScale;
    }

    // ---- DOM ----
    el.innerHTML = '';
    var svg = d3.select(el).append('svg').attr('class', 'ecpg-svg').attr('role', 'group').attr('tabindex', '0')
      .attr('aria-roledescription', 'graph');
    var defs = svg.append('defs');
    [['n', 'var(--mark-3)'], ['s', 'var(--accent)'], ['a', 'var(--mark-2)'], ['e', 'var(--chip-error-fg)']].forEach(function (m) {
      defs.append('marker').attr('id', id + '-arr-' + m[0]).attr('viewBox', '0 -5 10 10').attr('refX', 10).attr('refY', 0)
        .attr('markerWidth', 9).attr('markerHeight', 9).attr('markerUnits', 'userSpaceOnUse').attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4.5L10,0L0,4.5Z').attr('style', 'fill:' + m[1]);
    });
    var vp = svg.append('g').attr('class', 'ecpg-viewport');
    var gRels = vp.append('g'), gLabels = vp.append('g'), gNodes = vp.append('g');
    var live = h('div', { class: 'ecpg-sr', 'aria-live': 'polite' });
    var tools = h('div', { class: 'ecpg-tools', role: 'toolbar', 'aria-label': T('kg.tools', 'Điều khiển graph'), 'aria-orientation': 'vertical' });
    var fWrap = h('div', { class: 'ecpg-filter' });
    var fBtn = h('button', { class: 'ecpg-fbtn', type: 'button', 'aria-expanded': 'false', 'aria-controls': id + '-fp' });
    var fPanel = h('div', { class: 'ecpg-fp', id: id + '-fp', role: 'region', hidden: '' });
    fWrap.appendChild(fBtn); fWrap.appendChild(fPanel);
    var insp = null;
    if (!inspTarget) { insp = h('div', { class: 'ecpg-insp', role: 'region', 'aria-label': T('kg.inspector', 'Thuộc tính phần tử đang chọn'), hidden: '' }); }
    // tab order: filter -> toolbar -> nodes (svg is last in DOM order)
    if (!fe) { el.insertBefore(fWrap, el.firstChild); el.insertBefore(tools, svg.node()); }
    else {
      // FE canvas: the svg itself is not a tab stop; keyboard help for screen readers (aria-describedby)
      svg.attr('tabindex', null).attr('aria-roledescription', null).attr('aria-describedby', id + '-help');
      el.insertBefore(h('p', { class: 'sr-only', id: id + '-help' }, esc(T('mk.web.kg.canvasHelp', 'Phím mũi tên: chuyển tới node kề. Enter hoặc Space: chọn node. + hoặc E: mở rộng 1 hop. Esc: quay lại node trước đó.'))), svg.node());
    }
    // text alternative: relationship table ("Xem dạng danh sách" toolbar toggle)
    var listEl = h('div', { class: 'ecpg-list', id: id + '-list', role: 'region', hidden: '' });
    if (!fe) el.insertBefore(listEl, tools);
    if (insp) el.appendChild(insp); el.appendChild(live);

    // ---- node-color legend (kg-chat-legend + kg-legend-toggle): bottom-left, show/hide, KG-scoped (opt-in). Each row is an
    // INTERACTIVE per-node-type visibility toggle (aria-pressed=true means that type is hidden on the canvas). This is a pure
    // display overlay driven by the legendHidden set — it never touches the filter query. ----
    var lgWrap = null, lgBtn = null, lgBody = null, lgReset = null, lgOpen = false;
    function setLegendOpen(open, focusBtn) {
      if (!lgWrap) return;
      lgOpen = !!open; lgBody.hidden = !lgOpen; lgBtn.setAttribute('aria-expanded', String(lgOpen));
      lgBtn.setAttribute('aria-label', lgOpen ? T('kg.legendHide', 'Ẩn chú giải') : T('kg.legendShow', 'Hiện chú giải'));
      if (!lgOpen && focusBtn) lgBtn.focus();
    }
    // legend-only recompute: redraw the canvas with the current mask WITHOUT prune() and WITHOUT touching any fSel*/fHide, so the
    // filter panel/counts/triples are left intact. Canvas counts (counts() = simNodes/simRels) drop because vis shrinks.
    function applyLegendMask(label, nowHidden) {
      rebuild(); sim.alpha(0.4).restart();
      if (label != null) live.textContent = nowHidden
        ? T('kg.legendHiddenLive', 'Đã ẩn {type} trên canvas', { type: lblName(label) })
        : T('kg.legendShownLive', 'Đã hiện {type}', { type: lblName(label) });
    }
    function lgRowLabel(l, hidden) { return hidden ? T('kg.legendShowType', 'Hiện {type}', { type: lblName(l) }) : T('kg.legendHideType', 'Ẩn {type}', { type: lblName(l) }); }
    function syncLegendReset() { if (lgReset) lgReset.hidden = !legendHidden.size; }
    function buildLegend() {
      lgWrap = h('div', { class: 'ecpg-legend', role: 'region', id: id + '-lgd', 'aria-label': T('kg.legend', 'Chú giải') });
      lgBtn = h('button', { class: 'ecpg-legend-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': id + '-lgd-body' },
        ico(FICONS.legend) + '<span class="ecpg-legend-lbl">' + esc(T('kg.legend', 'Chú giải')) + '</span>');
      lgBody = h('div', { class: 'ecpg-legend-body', id: id + '-lgd-body', hidden: '' });
      // reset affordance (shows only when something is hidden) — mirrors the filter's "Hiện tất cả"
      lgReset = h('button', { class: 'ecpg-lgd-reset', type: 'button', hidden: '' }, esc(T('kg.legendShowAll', 'Hiện tất cả')));
      lgReset.addEventListener('click', function () {
        if (!legendHidden.size) return;
        legendHidden.clear();
        var rows = lgBody.querySelectorAll('.ecpg-lgd-item');
        labelOrder.forEach(function (l, i) { var r = rows[i]; if (r) { r.setAttribute('aria-pressed', 'false'); r.setAttribute('aria-label', lgRowLabel(l, false)); } });
        syncLegendReset(); applyLegendMask();
      });
      lgBody.appendChild(lgReset);
      labelOrder.forEach(function (l) {
        var p = pal(l);
        var item = h('button', { class: 'ecpg-lgd-item', type: 'button', 'data-ecpg-lgd': l, 'aria-pressed': 'false', 'aria-label': lgRowLabel(l, false) },
          '<span class="ecpg-lgd-sw" aria-hidden="true" style="--ecpg-lgd-c:' + p[0] + ';--ecpg-lgd-s:' + p[1] + '"></span>' +
          '<span class="ecpg-lgd-l">' + esc(lblName(l)) + '</span>' +
          '<span class="ecpg-lgd-eye" aria-hidden="true">' + ico(FICONS.eyeOff) + '</span>');
        lgBody.appendChild(item);
      });
      lgBody.addEventListener('click', function (ev) {
        var row = ev.target.closest('.ecpg-lgd-item'); if (!row || !lgBody.contains(row)) return;
        var l = row.getAttribute('data-ecpg-lgd');
        var nowHidden = !legendHidden.has(l);
        if (nowHidden) legendHidden.add(l); else legendHidden.delete(l);
        row.setAttribute('aria-pressed', String(nowHidden));
        row.setAttribute('aria-label', lgRowLabel(l, nowHidden));
        syncLegendReset(); applyLegendMask(l, nowHidden);
      });
      lgWrap.appendChild(lgBtn); lgWrap.appendChild(lgBody);
      lgBtn.addEventListener('click', function () { setLegendOpen(!lgOpen, false); });
      lgBtn.setAttribute('aria-label', T('kg.legendShow', 'Hiện chú giải'));
      el.insertBefore(lgWrap, svg.node());
    }
    if (legend) buildLegend();

    var TOOLS = [['in', 'kg.zoomIn', 'Phóng to', function () { zoomBy(1.3); }], ['out', 'kg.zoomOut', 'Thu nhỏ', function () { zoomBy(1 / 1.3); }],
     ['fit', 'kg.fit', 'Vừa màn hình', function () { fit(true); }], ['re', 'kg.relayout', 'Sắp xếp lại', relayout]];
    if (hop1) TOOLS.push(['all', 'kg.showFull', 'Hiện toàn bộ graph', showFull]);
    if (el.getAttribute('data-ecpg-no-list') !== '1') TOOLS.push(['list', 'kg.listView', 'Xem dạng danh sách', function () { setList(listEl.hidden); }]);   // the web Knowledge Graph rail has no list toggle
    TOOLS.forEach(function (t) {
      var b = h('button', { class: 'ecpg-tool', type: 'button', 'data-ecpg-tool': t[0] }, '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[t[0]] + '</svg>');
      if (t[0] === 'list') b.setAttribute('aria-pressed', 'false'), b.setAttribute('aria-controls', id + '-list');
      b.addEventListener('click', t[3]); tools.appendChild(b);
    });
    function setList(on) {
      listEl.hidden = !on;
      var b = tools.querySelector('[data-ecpg-tool="list"]'); if (b) b.setAttribute('aria-pressed', String(on));
      if (lgWrap) lgWrap.hidden = on;
      renderList();
    }
    function nodeBtn(n) { n = byId[n.id || n]; return '<button type="button" class="ecpg-link" data-ecpg-pick="' + esc(n.id) + '">' + esc(n.caption) + '</button> <span class="ecpg-list-type">' + esc(lblName(n.labels[0])) + '</span>'; }
    function renderList() {
      if (listEl.hidden) return;
      listEl.setAttribute('aria-label', T('kg.listView', 'Xem dạng danh sách'));
      var lone = simNodes.filter(function (n) { return !n.degree; });
      listEl.innerHTML = '<table class="table table-dense"><caption class="ecpg-list-cap">' + esc(T('kg.countNote', '{n} node · {r} quan hệ', { n: simNodes.length, r: simRels.length })) + '</caption>' +
        '<thead><tr><th scope="col">' + esc(T('kg.listFrom', 'Từ')) + '</th><th scope="col">' + esc(T('kg.listRel', 'Quan hệ')) + '</th><th scope="col">' + esc(T('kg.listTo', 'Đến')) + '</th></tr></thead><tbody>' +
        simRels.map(function (r) { return '<tr><td>' + nodeBtn(r.source) + '</td><td><span class="ecpg-chip rel">' + esc(r.type) + '</span></td><td>' + nodeBtn(r.target) + '</td></tr>'; }).join('') +
        lone.map(function (n) { return '<tr><td>' + nodeBtn(n) + '</td><td>—</td><td>—</td></tr>'; }).join('') + '</tbody></table>';
    }
    listEl.addEventListener('click', function (ev) { var b = ev.target.closest('[data-ecpg-pick]'); if (b && byId[b.getAttribute('data-ecpg-pick')]) select({ kind: 'node', data: byId[b.getAttribute('data-ecpg-pick')] }); });
    function showFull() { var add = []; data.visible.forEach(function (i) { if (!shown.has(i)) { shown.add(i); add.push(i); } }); if (add.length) { rebuild(); sim.alpha(0.8).restart(); fitAfter(900); } live.textContent = T('kg.expanded', 'Đã mở rộng {n} node', { n: add.length }); }
    // chrome labels (re-run on language change)
    function chromeLabels() {
      TOOLS.forEach(function (t) { var b = tools.querySelector('[data-ecpg-tool="' + t[0] + '"]'); if (b) { var v = T(t[1], t[2]); b.setAttribute('aria-label', v); b.setAttribute('title', v); } });
      tools.setAttribute('aria-label', T('kg.tools', 'Điều khiển graph'));
      renderFilterBtn(); fPanel.setAttribute('aria-label', T('kg.f.panelAria2', 'Bộ lọc graph layer, node, relationship và triple'));
      if (insp) insp.setAttribute('aria-label', T('kg.inspector', 'Thuộc tính phần tử đang chọn'));
      if (lgWrap) {
        lgWrap.setAttribute('aria-label', T('kg.legend', 'Chú giải'));
        var ll = lgBtn.querySelector('.ecpg-legend-lbl'); if (ll) ll.textContent = T('kg.legend', 'Chú giải');
        lgBtn.setAttribute('aria-label', lgOpen ? T('kg.legendHide', 'Ẩn chú giải') : T('kg.legendShow', 'Hiện chú giải'));
        var items = lgBody.querySelectorAll('.ecpg-lgd-item');
        labelOrder.forEach(function (l, i) {
          var row = items[i]; if (!row) return;
          var lab = row.querySelector('.ecpg-lgd-l'); if (lab) lab.textContent = lblName(l);
          row.setAttribute('aria-label', lgRowLabel(l, row.getAttribute('aria-pressed') === 'true'));
        });
        if (lgReset) lgReset.textContent = T('kg.legendShowAll', 'Hiện tất cả');
      }
    }
    chromeLabels();

    // ---- zoom ----
    var zoom = d3.zoom().scaleExtent([0.2, 4]).on('zoom', function (ev) { vp.attr('transform', ev.transform); });
    svg.call(zoom).on('dblclick.zoom', null);
    function zoomBy(k) { svg.transition().duration(200).call(zoom.scaleBy, k); }
    function fit(animate) {
      var w = el.clientWidth, hh = el.clientHeight; if (!w || !hh || !simNodes.length) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      simNodes.forEach(function (n) { var r = radius(n) + 20; x0 = Math.min(x0, n.x - r); y0 = Math.min(y0, n.y - r); x1 = Math.max(x1, n.x + r); y1 = Math.max(y1, n.y + r); });
      var top = fBtn.offsetHeight + 16, pad = 40;
      var k = Math.min(compact ? 2 : 1.4, (w - pad * 2) / (x1 - x0), (hh - top - pad) / (y1 - y0));  // full canvas: cap zoom so a 1-hop view isn't giant
      var t = d3.zoomIdentity.translate(w / 2 - k * (x0 + x1) / 2, top + (hh - top - pad / 2) / 2 - k * (y0 + y1) / 2).scale(k);
      (animate ? svg.transition().duration(300) : svg).call(zoom.transform, t);
    }

    // ---- simulation ----
    var simNodes = [], simRels = [];
    var sim = d3.forceSimulation().alphaDecay(0.03)
      .force('link', d3.forceLink().id(function (d) { return d.id; }).distance(function (l) { return (compact ? 60 : 95) + radius(l.source) + radius(l.target); }).strength(0.5))
      .force('charge', d3.forceManyBody().strength(compact ? -420 : -900).distanceMax(700))
      .force('collide', d3.forceCollide().radius(function (d) { return radius(d) + 22; }).iterations(2))
      .force('x', d3.forceX(0).strength(0.06)).force('y', d3.forceY(0).strength(0.09))
      .on('tick', ticked).stop();

    function visibleNodeIds() {
      var s = new Set();
      if (!fSelN.size && fSelR.size) {
        data.rels.forEach(function (r) { if (inB(r.source) && inB(r.target) && fSelR.has(r.type) && !fHide.has(patKey(r))) { s.add(r.source); s.add(r.target); } });
        // legend mask: drop any endpoint whose node type is legend-hidden; rebuild()'s both-endpoints-in-vis test then drops the
        // edge, so an edge touching a hidden-type node disappears and only returns when BOTH endpoints are visible again.
        if (legendHidden.size) Array.from(s).forEach(function (i) { if (legendHidden.has(labOf(i))) s.delete(i); });
        return s;
      }
      shown.forEach(function (i) { var n = byId[i]; if (n && inB(i) && effN(n.labels[0]) && !legendHidden.has(n.labels[0])) s.add(i); });
      return s;
    }
    function hiddenNeighbors(n) {
      var c = 0;
      data.rels.forEach(function (r) {
        if (r.source === n.id && !shown.has(r.target)) c++;
        else if (r.target === n.id && !shown.has(r.source)) c++;
      });
      return c;
    }

    function rebuild(seed) {
      var vis = visibleNodeIds();
      var prev = {}; simNodes.forEach(function (n) { prev[n.id] = n; });
      simNodes = []; vis.forEach(function (i) {
        var n = prev[i] || byId[i];
        if (n.x == null) { var p = seed && seed[i]; n.x = p ? p.x + (Math.random() - 0.5) * 60 : (Math.random() - 0.5) * 400; n.y = p ? p.y + (Math.random() - 0.5) * 60 : (Math.random() - 0.5) * 300; }
        n.degree = 0; simNodes.push(n);
      });
      simRels = data.rels.filter(function (r) { return vis.has(r.source) && vis.has(r.target) && effR(r.type) && !fHide.has(patKey(r)); })
        .map(function (r) { return { id: r.id, source: r.source, target: r.target, type: r.type, status: r.status, props: r.props, raw: r }; });
      simRels.forEach(function (r) { byId[r.source].degree++; if (r.target !== r.source) byId[r.target].degree++; });
      // parallel / self-loop offsets
      var groups = {};
      simRels.forEach(function (r) { var k = r.source < r.target ? r.source + '|' + r.target : r.target + '|' + r.source; (groups[k] = groups[k] || []).push(r); });
      Object.keys(groups).forEach(function (k) {
        var g = groups[k];
        g.forEach(function (r, i) { r.k = (i - (g.length - 1) / 2) * 28; r.loopI = i; r.canon = k.split('|')[0]; });
      });
      sim.nodes(simNodes); sim.force('link').links(simRels);
      draw();
      if (selected && !isShown(selected)) select(null);
      renderFilter();
      svg.attr('aria-label', T('kg.svgAria', 'Knowledge graph: {n} node, {r} quan hệ', { n: simNodes.length, r: simRels.length }));
      renderList();
      el.dispatchEvent(new CustomEvent('ecpg:change', { detail: { nodes: simNodes.length, rels: simRels.length, filter: fCount() } }));
    }
    function isShown(sel) {
      if (sel.kind === 'node') return simNodes.indexOf(sel.data) >= 0;
      return simRels.some(function (r) { return r.id === sel.data.id; });
    }

    var nodeSel, relSel, labSel;
    function relClass(r) { return 'ecpg-rel' + (r.status === 'ai' ? ' ai' : r.status === 'invalid' ? ' invalid' : r.status === 'deprecated' ? ' deprecated' : ''); }
    function marker(r, sel) { return 'url(#' + id + '-arr-' + (sel ? 's' : r.status === 'ai' ? 'a' : r.status === 'invalid' ? 'e' : 'n') + ')'; }
    function draw() {
      relSel = gRels.selectAll('g.ecpg-rel').data(simRels, function (d) { return d.id; }).join(function (enter) {
        var g = enter.append('g');
        g.append('path').attr('class', 'ecpg-hit');
        g.append('path').attr('class', 'ecpg-line');
        g.append('title');
        if (fe) g.attr('aria-hidden', 'true'); // FE: relationships are not selectable
        else g.on('click', function (ev, d) { ev.stopPropagation(); select({ kind: 'rel', data: d }); })
          .on('mouseenter', function (ev, d) { hover({ kind: 'rel', data: d }); }).on('mouseleave', function () { hover(null); });
        return g;
      });
      relSel.attr('class', relClass).select('.ecpg-line').attr('marker-end', function (d) { return marker(d, false); });
      relSel.select('title').text(function (d) { return byId[d.source.id || d.source].caption + ' —' + d.type + '→ ' + byId[d.target.id || d.target].caption; });
      labSel = gLabels.selectAll('text.ecpg-rlabel').data(simRels, function (d) { return d.id; }).join(function (enter) {
        var t = enter.append('text').attr('class', 'ecpg-rlabel').attr('dy', -3);
        t.append('textPath').attr('startOffset', '50%').attr('text-anchor', 'middle');
        return t;
      });
      labSel.select('textPath').attr('href', function (d) { return '#' + id + '-lp-' + d.id; }).text(function (d) { return d.type; });
      var lp = defs.selectAll('path.ecpg-lp').data(simRels, function (d) { return d.id; }).join('path').attr('class', 'ecpg-lp')
        .attr('id', function (d) { return id + '-lp-' + d.id; });
      lp.exit && lp.exit().remove();

      nodeSel = gNodes.selectAll('g.ecpg-node').data(simNodes, function (d) { return d.id; }).join(function (enter) {
        var g = enter.append('g').attr('tabindex', 0).attr('role', 'button');
        g.append('circle').attr('class', 'ecpg-ring');
        g.append('circle').attr('class', 'ecpg-outer');
        g.append('circle').attr('class', 'ecpg-body');
        g.append('text').attr('class', 'ecpg-cap');
        var b = g.append('g').attr('class', 'ecpg-badge').attr('aria-hidden', 'true');
        b.append('circle').attr('r', 10); b.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'central');
        g.append('title');
        if (fe) {
          // FE: click selects, double-click expands, no drag / hover; keys: Enter/Space select, + / E expand,
          // arrows move to a neighbour (roving tabindex), Esc back to the previous node
          g.on('click', function (ev, d) { ev.stopPropagation(); feActive = d.id; select({ kind: 'node', data: d }); })
            .on('dblclick', function (ev, d) { ev.stopPropagation(); expand(d.id); })
            .on('focus', function (ev, d) { feActive = d.id; feRoving(); })
            .on('keydown', function (ev, d) { feKey(ev, d); });
          return g;
        }
        g.on('click', function (ev, d) {
          ev.stopPropagation();
          if (ev.shiftKey) { d.fx = d.fy = null; d3.select(this).classed('ecpg-pinned', false); sim.alpha(0.3).restart(); }
          select({ kind: 'node', data: d });
        })
          .on('dblclick', function (ev, d) { ev.stopPropagation(); expand(d.id); })
          .on('mouseenter', function (ev, d) { hover({ kind: 'node', data: d }); }).on('mouseleave', function () { hover(null); })
          .on('keydown', function (ev, d) {
            if (ev.key === 'Enter') { ev.preventDefault(); select({ kind: 'node', data: d }); }
            else if (ev.key === ' ' || ev.key === 'e') { ev.preventDefault(); ev.stopPropagation(); expand(d.id); }
          })
          .on('focus', function (ev, d) { hover({ kind: 'node', data: d }); }).on('blur', function () { hover(null); })
          .call(d3.drag()
            .on('start', function (ev, d) { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on('drag', function (ev, d) { d.fx = ev.x; d.fy = ev.y; d3.select(this).classed('ecpg-pinned', true); })
            .on('end', function (ev) { if (!ev.active) sim.alphaTarget(0); }));
        return g;
      });
      nodeSel.attr('class', function (d) { return 'ecpg-node' + (d.fx != null ? ' ecpg-pinned' : ''); })
        .attr('aria-label', function (d) { return fe ? feAria(d) : lblName(d.labels[0]) + ': ' + d.caption; });
      nodeSel.each(function (d) {
        var g = d3.select(this), r = radius(d), l = d.labels[0];
        g.select('.ecpg-body').attr('r', r).attr('style', 'fill:var(--ecpg-f-' + l + ');stroke:var(--ecpg-s-' + l + ')');
        g.select('.ecpg-outer').attr('r', r + 2);
        g.select('.ecpg-ring').attr('r', r + 7);
        g.select('title').text(d.caption);
        if (fe) g.select('.ecpg-cap').attr('y', r + 12).attr('style', 'fill:var(--text)').text(d.caption.length > 20 ? d.caption.slice(0, 19) + '…' : d.caption);
        else fitCaption(g.select('.ecpg-cap').attr('style', 'fill:var(--ecpg-t-' + l + ')'), d.caption, r);
        var hn = hiddenNeighbors(d);
        g.select('.ecpg-badge').attr('display', hn ? null : 'none').attr('transform', 'translate(' + (r * 0.72) + ',' + (-r * 0.72) + ')')
          .select('text').text('+' + hn);
      });
      if (selected || fe) applySelected();
      if (fe) feRoving();
    }
    // ---- FE mode helpers (data-ecpg-fe) ----
    var feActive = null, feTrail = [];
    function feAria(d) {
      var hn = hiddenNeighbors(d), a = { name: d.caption, type: lblName(d.labels[0]), n: hn };
      return hn ? T('mk.web.kg.nodeAriaHidden', '{name} ({type}), {n} node lân cận chưa hiện', a) : T('mk.web.kg.nodeAria', '{name} ({type})', a);
    }
    function feNeighbours(nid) {
      var out = [];
      simRels.forEach(function (r) { var o = r.source.id === nid ? r.target.id : r.target.id === nid ? r.source.id : null; if (o && out.indexOf(o) < 0) out.push(o); });
      return out;
    }
    function feCurrent() {
      var has = function (i) { return i && simNodes.some(function (n) { return n.id === i; }); };
      return has(feActive) ? feActive : selected && has(selected.data.id) ? selected.data.id : has(focusId) ? focusId : simNodes[0] && simNodes[0].id;
    }
    function feRoving() { if (nodeSel) { var c = feCurrent(); nodeSel.attr('tabindex', function (d) { return d.id === c ? 0 : -1; }); } }
    function feFocus(nid, push) {
      if (push !== false) feTrail.push(feCurrent());
      feActive = nid; feRoving();
      nodeSel.filter(function (d) { return d.id === nid; }).each(function () { this.focus(); });
    }
    function feKey(ev, d) {
      var k = ev.key;
      if (k === 'Enter' || k === ' ') { ev.preventDefault(); select({ kind: 'node', data: d }); }
      else if (k === '+' || k === 'e' || k === 'E') { ev.preventDefault(); expand(d.id); }
      else if (k.indexOf('Arrow') === 0) {
        ev.preventDefault();
        var ns = feNeighbours(d.id); if (!ns.length) return;
        var dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[k], best = null, bs = -Infinity;
        ns.forEach(function (i) {
          var p = byId[i], dx = p.x - d.x, dy = p.y - d.y, len = Math.hypot(dx, dy) || 1, c = (dx * dir[0] + dy * dir[1]) / len;
          if (c > 0.3 && c - len / 10000 > bs) { bs = c - len / 10000; best = i; }
        });
        if (!best) best = ns[(ns.indexOf(feTrail[feTrail.length - 1]) + (k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 1) + ns.length) % ns.length];
        if (best) feFocus(best);
      } else if (k === 'Escape') {
        var back = feTrail.pop();
        if (back && byId[back] && simNodes.indexOf(byId[back]) >= 0) { ev.preventDefault(); ev.stopPropagation(); feFocus(back, false); }
      }
    }
    function fitCaption(t, text, r) {
      t.selectAll('tspan').remove(); t.text(null);
      var max = r * 1.7, words = String(text).split(/\s+/), lines = [], cur = '';
      var probe = t.append('tspan');
      function width(s) { probe.text(s); return probe.node().getComputedTextLength(); }
      for (var i = 0; i < words.length; i++) {
        var trial = cur ? cur + ' ' + words[i] : words[i];
        if (width(trial) <= max || !cur) cur = trial; else { lines.push(cur); cur = words[i]; }
      }
      if (cur) lines.push(cur);
      if (lines.length > 2) { lines = [lines[0], lines.slice(1).join(' ')]; }
      lines = lines.map(function (s) { if (width(s) <= max) return s; while (s.length > 1 && width(s + '…') > max) s = s.slice(0, -1); return s + '…'; });
      probe.remove();
      lines.forEach(function (s, i) { t.append('tspan').attr('x', 0).attr('dy', i === 0 ? (lines.length > 1 ? '-0.55em' : 0) : '1.15em').text(s); });
    }

    function geom(r) {
      var s = r.source, t = r.target, rs = radius(s), rt = radius(t);
      if (s === t) {
        var a = -Math.PI / 2 + r.loopI * 0.9, sp = 0.45, L = rs + 46;
        var p1 = [s.x + Math.cos(a - sp) * rs, s.y + Math.sin(a - sp) * rs];
        var p2 = [s.x + Math.cos(a + sp) * (rs + 2), s.y + Math.sin(a + sp) * (rs + 2)];
        var c1 = [s.x + Math.cos(a - 0.6) * L * 1.3, s.y + Math.sin(a - 0.6) * L * 1.3];
        var c2 = [s.x + Math.cos(a + 0.6) * L * 1.3, s.y + Math.sin(a + 0.6) * L * 1.3];
        var ax = s.x + Math.cos(a) * (L + 4), ay = s.y + Math.sin(a) * (L + 4);
        return { d: 'M' + p1 + 'C' + c1 + ' ' + c2 + ' ' + p2, lp: 'M' + (ax - 40) + ',' + ay + 'L' + (ax + 40) + ',' + ay };
      }
      // canonical normal keeps parallel edges on stable sides regardless of direction
      var A = r.canon === s.id ? s : t, B = A === s ? t : s;
      var dx = B.x - A.x, dy = B.y - A.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len, ny = dx / len;
      var mx = (s.x + t.x) / 2 + nx * r.k * 2, my = (s.y + t.y) / 2 + ny * r.k * 2;
      function trim(p, rad) { var vx = mx - p.x, vy = my - p.y, l = Math.sqrt(vx * vx + vy * vy) || 1; return [p.x + vx / l * rad, p.y + vy / l * rad]; }
      var p0 = trim(s, rs + 2), p3 = trim(t, rt + 3);
      var d = r.k ? 'M' + p0 + 'Q' + mx + ',' + my + ' ' + p3 : 'M' + p0 + 'L' + p3;
      var flip = p0[0] > p3[0];
      var lp = r.k ? (flip ? 'M' + p3 + 'Q' + mx + ',' + my + ' ' + p0 : d) : (flip ? 'M' + p3 + 'L' + p0 : d);
      return { d: d, lp: lp };
    }
    function ticked() {
      if (!relSel) return;
      var lpMap = {};
      relSel.each(function (r) { var g = geom(r); lpMap[r.id] = g.lp; d3.select(this).selectAll('path').attr('d', g.d); });
      defs.selectAll('path.ecpg-lp').attr('d', function (r) { return lpMap[r.id]; });
      nodeSel.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    }

    // ---- highlight & selection ----
    function hover(h) {
      if (!h) { nodeSel.classed('ecpg-dim', false).classed('ecpg-hl', false); relSel.classed('ecpg-dim', false).classed('ecpg-hl', false); labSel.classed('ecpg-dim', false).classed('ecpg-hl', false); return; }
      var keepN = new Set(), keepR = new Set();
      if (h.kind === 'node') {
        keepN.add(h.data.id);
        simRels.forEach(function (r) { if (r.source.id === h.data.id || r.target.id === h.data.id) { keepR.add(r.id); keepN.add(r.source.id); keepN.add(r.target.id); } });
      } else { keepR.add(h.data.id); keepN.add(h.data.source.id); keepN.add(h.data.target.id); }
      nodeSel.classed('ecpg-dim', function (d) { return !keepN.has(d.id); }).classed('ecpg-hl', function (d) { return keepN.has(d.id); });
      relSel.classed('ecpg-dim', function (d) { return !keepR.has(d.id); }).classed('ecpg-hl', function (d) { return keepR.has(d.id); });
      labSel.classed('ecpg-dim', function (d) { return !keepR.has(d.id); }).classed('ecpg-hl', function (d) { return keepR.has(d.id); });
    }
    function applySelected() {
      var s = selected;
      nodeSel.classed('ecpg-selected', function (d) { return !!s && s.kind === 'node' && s.data.id === d.id; });
      relSel.classed('ecpg-selected', function (d) { return !!s && s.kind === 'rel' && s.data.id === d.id; })
        .select('.ecpg-line').attr('marker-end', function (d) { return marker(d, !!s && s.kind === 'rel' && s.data.id === d.id); });
      labSel.classed('ecpg-selected', function (d) { return !!s && s.kind === 'rel' && s.data.id === d.id; });
      if (fe) {
        var on = function (d) { return feHl.has(d.id) || (!!s && (d.source.id === s.data.id || d.target.id === s.data.id)); };
        nodeSel.attr('aria-pressed', function (d) { return String(!!s && s.data.id === d.id); }).classed('ecpg-hl', function (d) { return feHl.has(d.id); });
        relSel.classed('ecpg-hl', on); labSel.classed('ecpg-hl', on);
      }
    }
    var feHl = new Set(); // FE: entities / path of the last chat answer (graph.focus)
    function select(s) {
      selected = s; applySelected();
      if (insAppend) { appendInspEntry(s); } else { renderInspector(); }
      if (s && !fe) live.textContent = T('kg.selected', 'Đã chọn {x}', { x: s.kind === 'node' ? s.data.caption : s.data.type });
      el.dispatchEvent(new CustomEvent('ecpg:select', { detail: s }));
      if (opts.onSelect) opts.onSelect(s);
    }
    function chip(l) { return '<span class="ecpg-chip" style="background:var(--ecpg-f-' + l + ');color:var(--ecpg-t-' + l + ')">' + esc(l) + '</span>'; }
    function kv(props) {
      return '<dl class="kv ecpg-kv">' + Object.keys(props || {}).map(function (k) { return '<dt>' + esc(k) + '</dt><dd>' + esc(props[k]) + '</dd>'; }).join('') + '</dl>';
    }
    // entry body for the KG selected-properties log: a chatbot-style lead-in (ecpg-ins-msg) + head + kv only (no expand/unpin/
    // open-evidence actions). The lead-in frames each inspected element as a bot message in the single running chat log.
    function insEntryHTML(s) {
      if (s.kind === 'node') {
        var n = s.data;
        return '<p class="ecpg-ins-msg">' + esc(T('kg.inspectMsg', 'Đã mở thông tin node {type}: {name}', { type: lblName(n.labels[0]), name: n.caption })) + '</p>' +
          '<div class="ecpg-ins-head"><b>' + esc(n.caption) + '</b>' + n.labels.map(chip).join('') + '<span class="ecpg-ins-id">&lt;id&gt; ' + esc(n.id) + '</span></div>' + kv(n.props);
      }
      var r = s.data;
      return '<p class="ecpg-ins-msg">' + esc(T('kg.inspectMsgRel', 'Đã mở thông tin relationship {type}', { type: r.type })) + '</p>' +
        '<div class="ecpg-ins-head"><span class="ecpg-chip rel">' + esc(r.type) + '</span><span class="ecpg-ins-id">&lt;id&gt; ' + esc(r.id) + '</span></div>' +
        '<dl class="kv ecpg-kv"><dt>' + T('kg.fromTo', 'Từ → Đến') + '</dt><dd>' + esc(r.source.caption) + ' → ' + esc(r.target.caption) + '</dd></dl>' + kv(r.props);
    }
    // KG append path: accumulate each new selection as an entry in a scrollable role="log" inside inspTarget (the .prop-card),
    // so previous entries remain, newest is visible and announced. Consecutive clicks on the SAME element do not duplicate.
    function appendInspEntry(s) {
      if (!s) return;
      var log = inspTarget.querySelector('.ecpg-ins-log');
      if (!log) {
        // first dynamic render: host an EMPTY log and clear the static placeholder, so the FIRST real selection is appended
        // through the SAME article.ecpg-ins-entry.msg-bot + insEntryHTML() path as every later entry (no divergent seed wrapper).
        log = h('div', { class: 'ecpg-ins-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
        inspTarget.innerHTML = ''; inspTarget.appendChild(log);
      }
      // the real overflow/scroll container is .chat-body (inspTarget sits inside it); scroll it to bottom on every new message,
      // respecting reduced-motion, append-only (no .focus()/scrollIntoView → SR focus is not moved; role=log/aria-live announces).
      var body = inspTarget.closest('.chat-body') || log;
      function scrollChatToBottom() {
        var smooth = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (body && body.scrollTo) body.scrollTo({ top: body.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
        else if (body) body.scrollTop = body.scrollHeight;
      }
      var key = s.kind + ':' + s.data.id;
      if (log.lastElementChild && log.lastElementChild.getAttribute('data-ecpg-sel') === key) { scrollChatToBottom(); return; }
      var entry = h('article', { class: 'ecpg-ins-entry msg-bot', 'data-ecpg-sel': key });
      entry.innerHTML = insEntryHTML(s);
      log.appendChild(entry);
      scrollChatToBottom();
    }
    function renderInspector() {
      // KG (insAppend) uses an append log inside inspTarget (handled in select → appendInspEntry); nothing to re-render here on
      // i18n change (node captions/props are source-language). All other mounts (built-in insp OR a plain inspTarget without
      // append) keep the original replace rendering below, byte-for-byte unchanged.
      if (insAppend) return;
      if (fe) { feInspector(); return; }
      var target = inspTarget || insp, s = selected;
      if (!target) return;
      if (!s) { if (insp) insp.hidden = true; return; }
      var html;
      if (s.kind === 'node') {
        var n = s.data, hn = hiddenNeighbors(n);
        html = '<div class="ecpg-ins-head"><b>' + esc(n.caption) + '</b>' + n.labels.map(chip).join('') + '<span class="ecpg-ins-id">&lt;id&gt; ' + esc(n.id) + '</span></div>' +
          kv(n.props) + '<div class="row mt-12" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' +
          '<button class="btn btn-sm btn-primary" type="button" data-ecpg-act="expand"' + (hn ? '' : ' disabled') + '>' + T('kg.expand', 'Mở rộng 1-hop') + (hn ? ' (+' + hn + ')' : '') + '</button>' +
          (n.fx != null ? '<button class="btn btn-sm btn-secondary" type="button" data-ecpg-act="unpin">' + T('kg.unpin', 'Bỏ ghim') + '</button>' : '') +
          '<a class="btn btn-sm btn-secondary" href="#">' + T('kg.openEvidence', 'Mở evidence') + '</a></div>';
      } else {
        var r = s.data;
        html = '<div class="ecpg-ins-head"><span class="ecpg-chip rel">' + esc(r.type) + '</span><span class="ecpg-ins-id">&lt;id&gt; ' + esc(r.id) + '</span></div>' +
          '<dl class="kv ecpg-kv"><dt>' + T('kg.fromTo', 'Từ → Đến') + '</dt><dd>' + esc(r.source.caption) + ' → ' + esc(r.target.caption) + '</dd></dl>' + kv(r.props);
      }
      if (insp) html += '<button class="ecpg-tool" type="button" data-ecpg-act="close" aria-label="' + T('kg.closeProps', 'Đóng thuộc tính') + '" style="position:absolute;top:4px;right:4px"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
      target.innerHTML = html;
      if (insp) insp.hidden = false;
    }
    // FE NodeInspector: name + type chip, Loại (raw type), Layer, each property, Evidence; Expand only with hidden neighbours
    function feInspector() {
      if (!inspTarget) return;
      var s = selected;
      if (!s) { inspTarget.innerHTML = ''; return; }
      var n = s.data, l = n.labels[0], hn = hiddenNeighbors(n), p = n.props || {};
      var lay = (lmap.types[l] || []).map(function (k) { return T('mk.web.kg.layer.' + k, k.charAt(0).toUpperCase() + k.slice(1)); }).join(', ') || '—';
      var rows = Object.keys(p).filter(function (k) { return k !== 'name' && k !== 'layer' && k !== 'evidence'; })
        .map(function (k) { return '<dt>' + esc(k) + '</dt><dd>' + esc(p[k]) + '</dd>'; }).join('');
      inspTarget.setAttribute('aria-label', T('common.selectedNodeProperties', 'Thuộc tính node đã chọn'));
      inspTarget.innerHTML = '<div class="row-between mb-8"><b>' + esc(n.caption) + '</b><span class="chip chip-info">' + esc(lblName(l)) + '</span></div>' +
        '<dl class="kv"><dt>' + esc(T('common.type', 'Loại')) + '</dt><dd>' + esc(l) + '</dd><dt>Layer</dt><dd>' + esc(lay) + '</dd>' + rows +
        (p.evidence ? '<dt>Evidence</dt><dd>' + esc(p.evidence) + '</dd>' : '') + '</dl>' +
        (hn ? '<button class="btn btn-secondary btn-sm" type="button" data-ecpg-act="expand">' + esc(T('kg.expand', 'Mở rộng 1-hop')) + ' · ' + esc(T('mk.web.kg.hiddenNeighbors', '+{n} node lân cận chưa hiện', { n: hn })) + '</button>' : '');
    }
    function onInspClick(ev) {
      var b = ev.target.closest('[data-ecpg-act]'); if (!b || !selected) return;
      var a = b.getAttribute('data-ecpg-act');
      if (a === 'expand' && selected.kind === 'node') expand(selected.data.id);
      if (a === 'unpin' && selected.kind === 'node') { selected.data.fx = selected.data.fy = null; draw(); renderInspector(); sim.alpha(0.3).restart(); }
      if (a === 'close') select(null);
    }
    (inspTarget || insp).addEventListener('click', onInspClick);

    // ---- expand / relayout ----
    function expand(nid) {
      var n = byId[nid], add = [];
      data.rels.forEach(function (r) {
        var o = r.source === nid ? r.target : r.target === nid ? r.source : null;
        if (o && !shown.has(o)) { shown.add(o); add.push(o); }
      });
      expanded.add(nid);
      var seed = {}; add.forEach(function (i) { seed[i] = n; });
      if (add.length) { rebuild(seed); sim.alpha(0.6).restart(); }
      live.textContent = add.length ? T('kg.expanded', 'Đã mở rộng {n} node', { n: add.length }) : T('kg.noNeighbors', 'Không còn node kề để mở rộng');
      if (selected && selected.kind === 'node' && selected.data.id === nid) renderInspector();
      return add.length;
    }
    function relayout() {
      simNodes.forEach(function (n) { n.fx = n.fy = null; n.x = (Math.random() - 0.5) * 400; n.y = (Math.random() - 0.5) * 300; });
      draw(); sim.alpha(1).restart(); fitAfter(900);
    }
    var fitTimer;
    function fitAfter(ms) { clearTimeout(fitTimer); fitTimer = setTimeout(function () { fit(true); }, ms); }

    // ---- filter panel (ecpg-filter-redesign, v2) ----
    function effN(l) { return !fSelN.size || fSelN.has(l); }
    function effR(t) { return !fSelR.size || fSelR.has(t); }
    function labOf(nid) { return byId[nid].labels[0]; }
    function relCol(t) { var c = REL_PALETTE[Math.max(0, typeOrder.indexOf(t)) % REL_PALETTE.length]; return [c, d3.color(c).darker(0.6).formatHex(), captionFor(c)]; }
    // ---- graph layers (ecpg-filter-v2) ----
    function layersOf(n) { var out = []; (lmap.types[n.labels[0]] || []).forEach(function (k) { if (k === 'domain') { if (domOf[n.id]) out.push('dom:' + domOf[n.id]); } else out.push(k); }); return out; }
    // auto-derived layer set from the current node/rel selection (empty unless autoLayer). Pure function of (fSelN, fSelR, shown):
    // never written back into fSelL, so it is idempotent and auto-unticks when the last producing type is deselected.
    // Endpoint gating uses shown membership (NOT inB) to avoid recursion with lp/activeL; only keys present in availLayers() count.
    function autoSelL() {
      if (!autoLayer || (!fSelN.size && !fSelR.size)) return new Set();
      // availability map computed locally from shown (same basis as availLayers) to avoid recursion with availLayers()
      var avail = {}; shown.forEach(function (i) { layersOf(byId[i]).forEach(function (k) { avail[k] = 1; }); });
      var s = new Set();
      function addLayers(nid) { layersOf(byId[nid]).forEach(function (k) { if (avail[k]) s.add(k); }); }
      if (fSelN.size) shown.forEach(function (i) { if (fSelN.has(labOf(i))) addLayers(i); });
      if (fSelR.size) data.rels.forEach(function (r) { if (fSelR.has(r.type) && shown.has(r.source) && shown.has(r.target)) { addLayers(r.source); addLayers(r.target); } });
      return s;
    }
    // active layer set that drives narrowing = manual (fSelL) ∪ auto-derived. Equals fSelL when autoLayer is off.
    function activeL() { if (!autoLayer) return fSelL; var s = new Set(fSelL); autoSelL().forEach(function (k) { s.add(k); }); return s; }
    function lp(n) { var al = activeL(); if (!al.size) return true; return layersOf(n).some(function (k) { return al.has(k); }); }
    function inB(nid) { return shown.has(nid) && lp(byId[nid]); }
    function relInB(r) { return inB(r.source) && inB(r.target); }
    function availLayers() {
      var c = {}; shown.forEach(function (i) { layersOf(byId[i]).forEach(function (k) { c[k] = (c[k] || 0) + 1; }); });
      var keys = domOrder.map(function (dn) { return 'dom:' + dn; }).concat(LAYERS);
      return keys.filter(function (k) { return c[k]; }).map(function (k) {
        var isD = k.indexOf('dom:') === 0;
        return { key: k, name: isD ? k.slice(4) : T(LAYER_NAME[k][0], LAYER_NAME[k][1]), group: isD ? 'semantic' : LAYER_GROUP[k], dom: isD, n: c[k], sel: autoLayer ? activeL().has(k) : fSelL.has(k), auto: autoLayer && !fSelL.has(k) && autoSelL().has(k) };
      });
    }
    function availNodes() { var c = {}; shown.forEach(function (i) { if (!inB(i)) return; var l = labOf(i); c[l] = (c[l] || 0) + 1; });
      var hn = hintsN();
      return labelOrder.filter(function (l) { return c[l]; }).map(function (l) { return { label: l, n: c[l], sel: fSelN.has(l), hint: !fSelN.has(l) && hn.has(l) }; }); }
    function availRels() { var c = {}; data.rels.forEach(function (r) { if (relInB(r)) c[r.type] = (c[r.type] || 0) + 1; });
      var hr = hintsR();
      return typeOrder.filter(function (t) { return c[t]; }).map(function (t) { return { type: t, n: c[t], sel: fSelR.has(t), hint: !fSelR.has(t) && hr.has(t) }; }); }
    function hintsR() { var s = new Set(); if (!fSelN.size) return s;
      data.rels.forEach(function (r) { if (relInB(r) && !fSelR.has(r.type) && (fSelN.has(labOf(r.source)) || fSelN.has(labOf(r.target)))) s.add(r.type); }); return s; }
    function hintsN() { var s = new Set(); if (!fSelR.size) return s;
      data.rels.forEach(function (r) { if (relInB(r) && fSelR.has(r.type)) { [labOf(r.source), labOf(r.target)].forEach(function (l) { if (!fSelN.has(l)) s.add(l); }); } }); return s; }
    function prune() {
      var an = new Set(), ar = new Set();
      shown.forEach(function (i) { if (inB(i)) an.add(labOf(i)); });
      data.rels.forEach(function (r) { if (relInB(r)) ar.add(r.type); });
      Array.from(fSelN).forEach(function (l) { if (!an.has(l)) fSelN.delete(l); });
      Array.from(fSelR).forEach(function (t) { if (!ar.has(t)) fSelR.delete(t); });
      var tl = new Set(listTriples().map(function (t) { return t.key; }));
      Array.from(fHide).forEach(function (x) { if (!tl.has(x)) fHide.delete(x); });
    }
    function fCount() { return fSelL.size + fSelN.size + fSelR.size + fHide.size; }
    // type-level triple key: subjType \u0001 relType \u0001 objType (U+0001 avoids collisions with type names)
    function patKey(r) { return labOf(r.source) + '\u0001' + r.type + '\u0001' + labOf(r.target); }
    function triTypeText(p) { var a = p.split('\u0001'); return a[0] + ' —' + a[1] + '→ ' + a[2]; }
    // distinct (subjType,relType,objType) patterns actually present in the filtered data (first-seen order; n = instance edge count)
    function listTriples() { if (!fSelN.size || !fSelR.size) return [];
      var order = [], by = {};
      data.rels.forEach(function (r) {
        if (!relInB(r) || !fSelN.has(labOf(r.source)) || !fSelN.has(labOf(r.target)) || !fSelR.has(r.type)) return;
        var k = patKey(r); if (!by[k]) { by[k] = { key: k, sourceType: labOf(r.source), type: r.type, targetType: labOf(r.target), n: 0 }; order.push(k); }
        by[k].n++;
      });
      return order.map(function (k) { return by[k]; }); }
    function ico(p) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; }
    function renderFilterBtn() {
      var n = fCount();
      fBtn.innerHTML = ico(FICONS.filter) + '<span class="ecpg-fbtn-lbl">' + esc(T('kg.f.btn', 'Bộ lọc')) + '</span><span class="ecpg-fbtn-n" aria-hidden="true"' + (n ? '' : ' hidden') + '>' + n + '</span>';
      fBtn.setAttribute('aria-label', n ? T('kg.f.btnAria', 'Bộ lọc graph, {n} đang áp dụng', { n: n }) : T('kg.f.btnAria0', 'Bộ lọc graph'));
    }
    // tri-state "Chọn tất cả" (role=checkbox): true = all available selected, mixed = some, false = none
    function chkHtml(group, items, aria) {
      var a = items.length, n = items.filter(function (x) { return x.sel; }).length;
      var st = a && n === a ? 'true' : n ? 'mixed' : 'false';
      return '<button class="ecpg-chk" type="button" role="checkbox" aria-checked="' + st + '" data-ecpg-key="A:' + group + '" data-ecpg-all="' + group + '" aria-label="' + esc(aria) + '"' + (a ? '' : ' disabled') + '>' +
        '<span class="ecpg-chk-box" aria-hidden="true"></span><span class="ecpg-chk-l" aria-hidden="true">' + esc(T('kg.f.selAll', 'Chọn tất cả')) + '</span></button>';
    }
    function tagHtml(kind, it) {
      var unit = kind === 'node' ? T('kg.f.nNodes', '{n} node', { n: it.n }) : kind === 'layer' ? T('kg.f.nLayer', '{g}, {n} node', { g: it.dom ? T('kg.f.lDomain', 'Domain') : it.groupName, n: it.n }) : T('kg.f.nTriples', '{n} triple', { n: it.n });
      var hint = it.hint ? ' data-ecpg-hint="1"' : '';
      var auto = (kind === 'layer' && it.auto) ? ' data-ecpg-auto="1"' : '';
      var autoSr = (kind === 'layer' && it.auto) ? esc(T('kg.f.autoLayer', ', tự động chọn')) : '';
      return '<button class="ecpg-tag' + (kind === 'rel' ? ' rel' : kind === 'layer' ? ' layer' : '') + (it.hint ? ' is-hint' : '') + '" type="button" data-ecpg-key="' + esc(kind + ':' + it.key) + '" data-ecpg-tag="' + esc(kind + ':' + it.key) + '" aria-pressed="' + it.sel + '"' + hint + auto + ' style="--ecpg-tag-c:' + it.col[0] + ';--ecpg-tag-s:' + it.col[1] + ';--ecpg-tag-t:' + it.col[2] + '">' +
        '<span class="ecpg-hole" aria-hidden="true"></span><span class="ecpg-tag-l">' + esc(it.label || it.key) + '</span><span class="ecpg-tag-n" aria-hidden="true">' + it.n + '</span><span class="ecpg-sr">, ' + esc(unit) + (it.hint ? ', ' + esc(T('kg.f.related', 'liên quan')) : '') + autoSr + '</span></button>';
    }
    function secHtml(kind, items) {
      var hid = id + '-fs-' + kind, nSel = items.filter(function (x) { return x.sel; }).length, isN = kind === 'node';
      return '<section class="ecpg-fs" data-ecpg-fsec="' + kind + '" aria-labelledby="' + hid + '"><div class="ecpg-fs-head"><h3 id="' + hid + '">' + esc(isN ? T('kg.f.nodes', 'Loại node') : T('kg.f.rels', 'Loại relationship')) + '</h3>' +
        '<span class="ecpg-fs-n" data-ecpg-selcount="' + kind + '">' + esc(T('kg.f.selCount', '{n}/{all} đã chọn', { n: nSel, all: items.length })) + '</span>' +
        chkHtml(kind, items, isN ? T('kg.f.selAllNodes', 'Chọn tất cả loại node') : T('kg.f.selAllRels', 'Chọn tất cả loại relationship')) + '</div>' +
        '<div class="ecpg-tags" role="group" aria-labelledby="' + hid + '">' + items.map(function (it) { return tagHtml(kind, it); }).join('') + '</div></section>';
    }
    function layerItems() {
      return availLayers().map(function (x) {
        return { key: x.key, label: x.name, n: x.n, sel: x.sel, auto: x.auto, dom: x.dom, group: x.group, groupName: x.name, col: LAYER_COL[x.dom ? 'dom' : x.key] };
      });
    }
    function layerSecHtml() {
      var hid = id + '-fs-layer', items = layerItems(), nSel = items.filter(function (x) { return x.sel; }).length;
      var grp = function (g, title, aria) {
        var its = items.filter(function (x) { return x.group === g; }); if (!its.length) return '';
        var gid = id + '-lg-' + g.slice(0, 3), doms = its.filter(function (x) { return x.dom; }), rest = its.filter(function (x) { return !x.dom; });
        return '<div class="ecpg-lg" data-ecpg-lgroup="' + g + '"><div class="ecpg-lg-head"><span class="ecpg-lg-t" id="' + gid + '">' + esc(title) + '</span>' + chkHtml(g, its, aria) + '</div>' +
          '<div class="ecpg-tags" role="group" aria-labelledby="' + gid + '">' +
          (doms.length ? '<span class="ecpg-lg-sub" aria-hidden="true">' + esc(T('kg.f.lDomain', 'Domain')) + '</span>' + doms.map(function (it) { return tagHtml('layer', it); }).join('') + (rest.length ? '<span class="ecpg-lg-sub ecpg-lg-sep" aria-hidden="true"></span>' : '') : '') +
          rest.map(function (it) { return tagHtml('layer', it); }).join('') + '</div></div>';
      };
      return '<section class="ecpg-fs ecpg-fs-layer" data-ecpg-fsec="layer" aria-labelledby="' + hid + '"><div class="ecpg-fs-head"><h3 id="' + hid + '">' + esc(T('kg.f.layers', 'Graph layer')) + '</h3>' +
        '<span class="ecpg-fs-n" data-ecpg-selcount="layer">' + esc(T('kg.f.selCount', '{n}/{all} đã chọn', { n: nSel, all: items.length })) + '</span></div>' +
        grp('semantic', T('kg.f.semantic', 'Semantic'), T('kg.f.selAllSem', 'Chọn tất cả layer Semantic')) +
        grp('lexical', T('kg.f.lexical', 'Lexical'), T('kg.f.selAllLex', 'Chọn tất cả layer Lexical')) + '</section>';
    }
    function triHtml() {
      var hid = id + '-fs-tri', tris = listTriples(), x = fHide.size, body;
      var cnt = x ? T('kg.f.triCountHid', '{n} triple · ẩn {x}', { n: tris.length, x: x }) : T('kg.f.triCount', '{n} triple', { n: tris.length });
      if (!fSelN.size || !fSelR.size) body = '<p class="ecpg-tri-hint">' + esc(T('kg.f.triHint2', 'Chọn ít nhất một loại node và một loại relationship để xem các triple.')) + '</p>';
      else if (!tris.length) body = '<p class="ecpg-tri-hint">' + esc(T('kg.f.triEmpty', 'Không có triple nào khớp bộ lọc hiện tại.')) + '</p>';
      else body = '<ul class="ecpg-tris" aria-labelledby="' + hid + '">' + tris.map(function (p) {
        var off = fHide.has(p.key), tx = triTypeText(p.key);
        return '<li><button class="ecpg-tri' + (off ? ' is-off' : '') + '" type="button" data-ecpg-key="T:' + esc(p.key) + '" data-ecpg-tri="' + esc(p.key) + '" aria-pressed="' + !off + '" aria-label="' + esc(off ? T('kg.f.triOff', 'Triple {x}, đang ẩn', { x: tx }) : T('kg.f.triOn', 'Triple {x}, đang hiển thị', { x: tx })) + '" title="' + esc(tx) + '">' +
          '<svg class="ecpg-tri-eye" viewBox="0 0 24 24" aria-hidden="true">' + (off ? FICONS.eyeOff : FICONS.eye) + '</svg><span class="ecpg-tri-s">' + esc(p.sourceType) + '</span><span class="ecpg-tri-r">' + esc(p.type) + '</span><span class="ecpg-tri-o">' + esc(p.targetType) + '</span></button></li>';
      }).join('') + '</ul>';
      return '<section class="ecpg-fs ecpg-fs-tri" data-ecpg-fsec="triple" aria-labelledby="' + hid + '"><div class="ecpg-fs-head"><h3 id="' + hid + '">' + esc(T('kg.f.triples', 'Triple')) + '</h3>' +
        '<span class="ecpg-fs-n" data-ecpg-tricount>' + esc(cnt) + '</span><button class="ecpg-link" type="button" data-ecpg-key="SA" data-ecpg-show-all' + (x ? '' : ' hidden') + '>' + esc(T('kg.f.showAll', 'Hiện tất cả ({n})', { n: x })) + '</button></div>' + body + '</section>';
    }
    function renderFilter() {
      renderFilterBtn();
      if (!started) return;
      var act = document.activeElement, key = act && fPanel.contains(act) ? act.getAttribute('data-ecpg-key') : null, st = fPanel.scrollTop;
      fPanel.innerHTML = layerSecHtml() + secHtml('node', availNodes().map(function (x) { return { key: x.label, n: x.n, sel: x.sel, hint: x.hint, col: pal(x.label) }; })) +
        secHtml('rel', availRels().map(function (x) { return { key: x.type, n: x.n, sel: x.sel, hint: x.hint, col: relCol(x.type) }; })) + triHtml();
      fPanel.scrollTop = st;
      if (key) {
        var again = fPanel.querySelector('[data-ecpg-key="' + key.replace(/"/g, '\\"') + '"]:not([hidden])');
        if (!again && key === 'SA') again = fPanel.querySelector('.ecpg-tri') || fPanel.querySelector('[data-ecpg-all="rel"]');
        if (!again) { var sec = key.split(':')[0], g = sec === 'layer' ? 'semantic' : sec; again = fPanel.querySelector('[data-ecpg-all="' + g + '"]:not([disabled])') || fPanel.querySelector('.ecpg-chk:not([disabled])'); }
        if (again) again.focus({ preventScroll: true });
      }
    }
    var prevAuto = new Set();
    function applyFilter() {
      prune(); rebuild(); sim.alpha(0.4).restart();
      var added = [];
      if (autoLayer) {
        var now = autoSelL();
        now.forEach(function (k) { if (!prevAuto.has(k) && !fSelL.has(k)) added.push(k); });
        prevAuto = now;
      }
      if (added.length) {
        var names = added.map(function (k) { return k.indexOf('dom:') === 0 ? k.slice(4) : T(LAYER_NAME[k][0], LAYER_NAME[k][1]); }).join(', ');
        live.textContent = T('kg.f.autoLive', 'Đã tự động chọn graph layer: {names}', { names: names });
      } else {
        live.textContent = T('kg.f.live', 'Đang hiển thị {n} node · {r} quan hệ', { n: simNodes.length, r: simRels.length });
      }
    }
    function setAll(group, on) {
      if (group === 'semantic' || group === 'lexical') {
        availLayers().filter(function (x) { return x.group === group; }).forEach(function (x) { if (on) fSelL.add(x.key); else fSelL.delete(x.key); });
        return;
      }
      var s = group === 'node' ? fSelN : fSelR; s.clear();
      if (on) (group === 'node' ? availNodes().map(function (x) { return x.label; }) : availRels().map(function (x) { return x.type; })).forEach(function (v) { s.add(v); });
    }
    function toggleIn(s, v) { if (s.has(v)) s.delete(v); else s.add(v); }
    function setOpen(open, focusBtn) {
      fOpen = !!open; fWrap.classList.toggle('is-open', fOpen); fPanel.hidden = !fOpen; fBtn.setAttribute('aria-expanded', String(fOpen));
      if (fOpen) renderFilter(); else if (focusBtn) fBtn.focus();
    }
    fBtn.addEventListener('click', function () { setOpen(!fOpen, false); });
    fPanel.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b || !fPanel.contains(b) || b.disabled) return;
      var tg = b.getAttribute('data-ecpg-tag'), i = tg ? tg.indexOf(':') : -1;
      if (tg) { var k = tg.slice(0, i); toggleIn(k === 'node' ? fSelN : k === 'rel' ? fSelR : fSelL, tg.slice(i + 1)); }
      else if (b.hasAttribute('data-ecpg-all')) setAll(b.getAttribute('data-ecpg-all'), b.getAttribute('aria-checked') !== 'true');
      else if (b.hasAttribute('data-ecpg-tri')) toggleIn(fHide, b.getAttribute('data-ecpg-tri'));
      else if (b.hasAttribute('data-ecpg-show-all')) fHide.clear();
      else return;
      applyFilter();
    });
    function fState() {
      var hn = hintsN(), hr = hintsR();
      return { open: fOpen, autoLayer: autoLayer, layers: availLayers(), selLayers: Array.from(fSelL), manualLayers: Array.from(fSelL), autoLayers: Array.from(autoSelL()), activeLayers: Array.from(activeL()), nodes: availNodes(), rels: availRels(), selNodes: Array.from(fSelN), selRels: Array.from(fSelR),
        hints: { nodes: Array.from(hn), rels: Array.from(hr) }, hidden: Array.from(fHide),
        layerTypes: Object.keys(lmap.types).reduce(function (o, t) { lmap.types[t].forEach(function (k) { (o[k] = o[k] || []).push(t); }); return o; }, {}),
        triples: listTriples().map(function (p) { return { id: p.key, key: p.key, sourceType: p.sourceType, targetType: p.targetType, type: p.type, n: p.n, shown: !fHide.has(p.key) }; }), count: fCount() };
    }

    // ---- keyboard & background ----
    if (!fe) svg.on('click', function () { select(null); });
    el.addEventListener('keydown', function (ev) {
      if (fe) return;
      if (ev.key === 'Escape') { if (fOpen) { ev.preventDefault(); ev.stopPropagation(); setOpen(false, true); } /* stop: viewer modals close on a document-level Esc */ else select(null); return; }
      if (ev.target !== svg.node()) return;
      var step = 60, map = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (map[ev.key]) { ev.preventDefault(); svg.transition().duration(150).call(zoom.translateBy, map[ev.key][0], map[ev.key][1]); }
      else if (ev.key === '+' || ev.key === '=') zoomBy(1.3);
      else if (ev.key === '-') zoomBy(1 / 1.3);
      else if (ev.key === '0') fit(true);
    });

    // ---- start (lazy until the container has a size; hidden tabs) ----
    function start() {
      if (started || !el.clientWidth || !el.clientHeight) return;
      started = true;
      rebuild();
      for (var i = 0; i < 300; i++) sim.tick();
      ticked(); fit(false);
      sim.alpha(0.05).restart(); setTimeout(function () { fit(true); }, 1200);
      sim.on('end.fit', function () { sim.on('end.fit', null); fit(true); });
      if (focusId && byId[focusId] && simNodes.indexOf(byId[focusId]) >= 0) select({ kind: 'node', data: byId[focusId] });
    }
    if (window.ResizeObserver) {
      var fitted = false;
      new ResizeObserver(function () { if (!started) start(); else if (!fitted) { fitted = true; } }).observe(el);
    }
    start();
    if (window.ECP_I18N) window.ECP_I18N.onChange(function () {
      chromeLabels();
      if (!started) return;
      renderFilter(); renderInspector(); renderList();
      if (nodeSel) nodeSel.attr('aria-label', function (d) { return fe ? feAria(d) : lblName(d.labels[0]) + ': ' + d.caption; });
      svg.attr('aria-label', T('kg.svgAria', 'Knowledge graph: {n} node, {r} quan hệ', { n: simNodes.length, r: simRels.length }));
    });

    var api = {
      fit: function () { fit(true); }, zoomBy: zoomBy, relayout: relayout, expand: expand,
      select: function (nid) { var n = byId[nid]; if (n) select({ kind: 'node', data: n }); },
      counts: function () { return { nodes: simNodes.length, rels: simRels.length }; },
      // FE chrome (data-ecpg-fe): shown nodes / rels, hidden neighbours, type names + layers, legend mask, full graph, answer focus
      nodes: function () { return simNodes.slice(); }, rels: function () { return simRels.slice(); },
      hiddenNeighbors: function (nid) { return byId[nid] ? hiddenNeighbors(byId[nid]) : 0; },
      typeName: lblName, layers: function (l) { return lmap.types[l] || []; },
      types: function () { var out = []; shown.forEach(function (i) { var l = byId[i] && byId[i].labels[0]; if (l && out.indexOf(l) < 0) out.push(l); }); return out; },
      typeHidden: function (l) { return legendHidden.has(l); },
      toggleType: function (l) { if (legendHidden.has(l)) legendHidden.delete(l); else legendHidden.add(l); rebuild(); sim.alpha(0.4).restart(); },
      showFull: function () { feHl.clear(); showFull(); },
      selectedId: function () { return selected && selected.kind === 'node' ? selected.data.id : null; },
      focusOn: function (nid, hl) {
        var n = byId[nid]; if (!n) return;
        var add = [nid]; data.rels.forEach(function (r) { if (r.source === nid) add.push(r.target); else if (r.target === nid) add.push(r.source); });
        add.forEach(function (i) { shown.add(i); });
        feHl = new Set(hl || add);
        rebuild(); sim.alpha(0.6).restart();
        select({ kind: 'node', data: n });
        live.textContent = T('mk.web.kg.focusLive', 'Đang xem {name}', { name: n.caption });
      },
      filter: { state: fState, open: function () { setOpen(true); }, close: function () { setOpen(false); },
        reset: function () { fSelL.clear(); fSelN.clear(); fSelR.clear(); fHide.clear(); applyFilter(); },
        toggleNode: function (l) { toggleIn(fSelN, l); applyFilter(); }, toggleRel: function (t) { toggleIn(fSelR, t); applyFilter(); },
        toggleLayer: function (k) { toggleIn(fSelL, k); applyFilter(); }, setAll: function (g, on) { setAll(g, on); applyFilter(); },
        toggleTriple: function (key) { toggleIn(fHide, key); applyFilter(); }, showAll: function () { fHide.clear(); applyFilter(); } }
    };
    el.ecpg = api;
    if (fe) feChrome(el, api);
    return api;
  }

  // Knowledge Graph screen chrome as in micro-frontend/web knowledge-graph-screen.tsx + graph-list.tsx: toolbar (list / graph
  // toggle, Show full graph, count note), legend = one toggle button per shown node type, list view = Node and Relationship tables
  function feChrome(el, api) {
    var host = el.parentNode, asList = false;
    var tools = h('div', { class: 'kg-tools', role: 'toolbar' }), legend = h('div', { class: 'kg-legend', role: 'group' });
    var list = h('div', { class: 'kg-list', hidden: '' });
    host.insertBefore(tools, el); host.insertBefore(legend, el); host.insertBefore(list, el);
    function render() {
      var c = api.counts(), nodes = api.nodes(), rels = api.rels();
      tools.setAttribute('aria-label', T('kg.tools', 'Điều khiển graph'));
      tools.innerHTML = '<button class="btn btn-secondary btn-sm" type="button" data-kgf="list" aria-pressed="' + asList + '">' +
        esc(asList ? T('mk.web.kg.graphView', 'Xem dạng graph') : T('kg.listView', 'Xem dạng danh sách')) + '</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-kgf="full">' + esc(T('kg.showFull', 'Hiện toàn bộ graph')) + '</button>' +
        '<span class="muted text-xs">' + esc(T('kg.countNote', '{n} node · {r} quan hệ', { n: c.nodes, r: c.rels })) + '</span>';
      var types = api.types();
      legend.hidden = !types.length;
      legend.setAttribute('aria-label', T('kg.legend', 'Chú giải'));
      legend.innerHTML = types.map(function (l) {
        var off = api.typeHidden(l), name = api.typeName(l);
        return '<button class="btn btn-ghost btn-sm" type="button" data-kgf-type="' + esc(l) + '" aria-pressed="' + !off + '" aria-label="' +
          esc(off ? T('kg.legendShowType', 'Hiện {type}', { type: name }) : T('kg.legendHideType', 'Ẩn {type}', { type: name })) + '">' + esc(name) + '</button>';
      }).join('');
      el.hidden = asList; list.hidden = !asList;
      if (!asList) return;
      var sel = api.selectedId(), cap = function (n) { return esc(n.caption); };
      list.innerHTML = '<table class="table"><caption>' + esc(T('mk.web.kg.listNodes', 'Node')) + '</caption><thead><tr><th scope="col">' + esc(T('mk.web.kg.listNodes', 'Node')) +
        '</th><th scope="col">' + esc(T('common.type', 'Loại')) + '</th><th scope="col">Layer</th><th scope="col">' + esc(T('mk.web.kg.hiddenLabel', 'Node ẩn')) +
        '</th><th scope="col"><span class="sr-only">' + esc(T('kg.expand', 'Mở rộng 1-hop')) + '</span></th></tr></thead><tbody>' +
        nodes.map(function (n) {
          var hn = api.hiddenNeighbors(n.id), l = n.labels[0];
          var lay = api.layers(l).map(function (k) { return T('mk.web.kg.layer.' + k, k.charAt(0).toUpperCase() + k.slice(1)); }).join(', ');
          return '<tr><th scope="row"><button class="link" type="button" data-kgf-pick="' + esc(n.id) + '" aria-pressed="' + (n.id === sel) + '">' + cap(n) + '</button></th>' +
            '<td>' + esc(api.typeName(l)) + '</td><td>' + esc(lay) + '</td><td>' + hn + '</td><td>' +
            (hn ? '<button class="btn btn-ghost btn-sm" type="button" data-kgf-expand="' + esc(n.id) + '" aria-label="' + esc(T('kg.expand', 'Mở rộng 1-hop') + ': ' + n.caption) + '">' + esc(T('kg.expand', 'Mở rộng 1-hop')) + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<table class="table"><caption>' + esc(T('mk.web.kg.listRels', 'Quan hệ')) + '</caption><thead><tr><th scope="col">' + esc(T('kg.listFrom', 'Từ')) + '</th><th scope="col">' +
        esc(T('kg.listRel', 'Quan hệ')) + '</th><th scope="col">' + esc(T('kg.listTo', 'Đến')) + '</th></tr></thead><tbody>' +
        rels.map(function (r) { return '<tr><td>' + cap(r.source) + '</td><td>' + esc(r.type) + '</td><td>' + cap(r.target) + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-kgf], [data-kgf-type], [data-kgf-pick], [data-kgf-expand]');
      if (!b || !host.contains(b)) return;
      var k = b.getAttribute('data-kgf');
      if (k === 'list') { asList = !asList; render(); var nb = tools.querySelector('[data-kgf="list"]'); if (nb) nb.focus(); }
      else if (k === 'full') api.showFull();
      else if (b.hasAttribute('data-kgf-type')) { var l = b.getAttribute('data-kgf-type'); api.toggleType(l); var again = legend.querySelector('[data-kgf-type="' + l + '"]'); if (again) again.focus(); }
      else if (b.hasAttribute('data-kgf-pick')) { api.select(b.getAttribute('data-kgf-pick')); render(); }
      else api.expand(b.getAttribute('data-kgf-expand'));
    });
    el.addEventListener('ecpg:change', render);
    el.addEventListener('ecpg:select', function () { if (asList) render(); });
    if (window.ECP_I18N) window.ECP_I18N.onChange(render);
    render();
  }

  function init() {
    // ?tab=graph opens the Graph tab on viewer pages (for screenshots / deep links)
    var tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'graph') { var t = document.getElementById('vt-graph'); if (t) t.click(); }
    document.querySelectorAll('[data-ecpg-dataset]').forEach(function (el) { mount(el); });
    // enterprise-search-ask: the "Evidence Graph" toggle shows/hides the graph and its note reflects live counts
    document.querySelectorAll('[data-ecpg-toggle]').forEach(function (btn) {
      var canvas = document.querySelector(btn.getAttribute('data-ecpg-toggle'));
      if (!canvas) return;
      var sync = function () { canvas.hidden = btn.getAttribute('aria-pressed') === 'false'; };
      new MutationObserver(sync).observe(btn, { attributes: true, attributeFilter: ['aria-pressed'] }); sync();
    });
    document.querySelectorAll('[data-ecpg-count-for]').forEach(function (note) {
      var g = document.querySelector(note.getAttribute('data-ecpg-count-for')); if (!g) return;
      var prefix = note.getAttribute('data-ecpg-count-prefix') || '';
      var upd = function () { if (g.ecpg) { var c = g.ecpg.counts(); note.textContent = (window.ECP_I18N ? window.ECP_I18N.tv(prefix) : prefix) + T('kg.countNote', '{n} node · {r} quan hệ', { n: c.nodes, r: c.rels }); } };
      g.addEventListener('ecpg:change', upd); upd();
      if (window.ECP_I18N) window.ECP_I18N.onChange(upd);
    });
  }
  window.ECPGraph = { mount: mount, palette: PALETTE, contrast: contrast };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
