/* Enterprise Search · document viewer (document-viewer.html). Vanilla ES5, file:// safe.
 *
 * Deep link: document-viewer.html?doc=<doc id>&psg=<passage id>[&from=search|ask][&q=<query or question>][&cite=<n>]
 *   doc   document id (keys of DOCS below)
 *   psg   passage (chunk) id inside that document; the viewer scrolls to it and highlights it
 *   from  where the link came from: "search" (result card), "ask" (answer citation) or "cr" (evidence of a change request)
 *   q     the search query / question / request ID, shown as context
 *   cite  citation number in the answer (Ask only)
 * Selecting another passage rewrites psg with history.replaceState, so a refresh keeps the document and passage.
 *
 * DOCS is mock data copied from the search results / citations / document metadata already in the mockups
 * (enterprise-search-results.html, enterprise-search-ask-*.html, enterprise-search-home.html, document-workspace.html,
 * versions.js). Fields without a source in the mockups are left out instead of being invented.
 * Documents cited as evidence in Thay đổi & Phê duyệt come from ECP_CR.viewerDoc(id) (cr-data.js) when it is loaded.
 */
(function () {
  var I18N = window.ECP_I18N;
  var T = (I18N && I18N.tr) || function (k, v, a) { return String(v).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); };
  function onLang(fn) { if (I18N) I18N.onChange(fn); }

  // pages: { no: page number or null (unknown), label: [key, vi] (slides), landscape, blocks: [[tag, text, passage id?], …] }
  // passages: { id: { loc: [i18n key, vi], page, search: true when it matched the search query } } in document order
  var DOCS = {
    'qd-tdkhdn': {
      title: 'Quy định cấp tín dụng đối với khách hàng doanh nghiệp', type: 'PDF', ft: 'ft-pdf',
      kb: 'Quy trình tín dụng doanh nghiệp', ver: 'v2.3', status: 'active', updated: '2026-10-18', owner: 'Nguyễn Lan', pageCount: 24,
      original: null,
      kw: ['hạn mức tín dụng', 'hạn mức', 'doanh nghiệp'],
      pages: [
        { no: 12, blocks: [
          ['h2', 'Điều 8. Hạn mức tín dụng'],
          ['p', '8.1. Hạn mức tín dụng được xác định cho từng khách hàng trên cơ sở nhu cầu vốn, khả năng trả nợ và kết quả xếp hạng tín dụng nội bộ.'],
          ['p', '8.2. Mức hạn mức tín dụng tối đa cho doanh nghiệp SME không vượt quá 15% vốn tự có của ngân hàng và phải được Hội đồng tín dụng phê duyệt đối với khoản vượt ngưỡng.', 'p12-82'],
          ['p', '8.3. Khoản vượt thẩm quyền của Giám đốc chi nhánh trình Hội đồng tín dụng theo Phụ lục phân cấp thẩm quyền.']
        ] },
        { no: 14, blocks: [
          ['h2', 'Điều 9. Điều chỉnh hạn mức'],
          ['p', '9.1. Việc điều chỉnh hạn mức trong kỳ được thực hiện khi khách hàng doanh nghiệp có biến động doanh thu trên 20% so với kỳ đánh giá gần nhất, kèm hồ sơ chứng minh.', 'p14-91'],
          ['p', '9.2. Hồ sơ điều chỉnh gồm: giấy đề nghị điều chỉnh hạn mức, báo cáo tài chính quý gần nhất, xếp hạng tín dụng nội bộ cập nhật.']
        ] },
        { no: null, blocks: [
          ['h2', 'Phụ lục 02. Doanh nghiệp mới thành lập'],
          ['p', 'Hạn mức cho doanh nghiệp mới thành lập tối đa 2 tỷ đồng, bắt buộc có tài sản bảo đảm, thẩm quyền Hội đồng tín dụng.', 'pl02']
        ] }
      ],
      passages: {
        'p12-82': { loc: ['esr.page12Article82', 'Trang 12 · Điều 8.2'], page: 12, search: true },
        'p14-91': { loc: ['esr.page14Article91', 'Trang 14 · Điều 9.1'], page: 14, search: true },
        'pl02': { loc: ['dv.appendix02', 'Phụ lục 02'], page: null }
      }
    },
    'hd-vld': {
      title: 'Hướng dẫn thẩm định hồ sơ vay vốn lưu động', type: 'DOC', ft: 'ft-word',
      kb: 'Quy trình tín dụng doanh nghiệp', ver: 'v1.7', status: 'active', updated: '2026-10-14',
      original: null,
      kw: ['hạn mức tín dụng', 'hạn mức', 'doanh nghiệp'],
      pages: [
        { no: null, blocks: [
          ['h1', 'Hướng dẫn thẩm định hồ sơ vay vốn lưu động'],
          ['h2', 'Mục 3. Thẩm định khách hàng doanh nghiệp'],
          ['p', '3.4. Chuyên viên thẩm định xác định hạn mức tín dụng dựa trên nhu cầu vốn lưu động, vòng quay vốn và báo cáo tài chính 2 năm gần nhất của doanh nghiệp.', 's3-4'],
          ['p', '3.5. Kết quả thẩm định được lập theo mẫu TĐ-02 và lưu trên hệ thống quản lý hồ sơ tín dụng.'],
          ['p', '3.6. Hồ sơ đề xuất hạn mức phải kèm bảng xếp hạng tín dụng nội bộ (XHTD) còn hiệu lực.', 's3-6'],
          ['p', '3.7. Trường hợp thông tin tài chính chưa kiểm toán, chuyên viên ghi rõ nguồn và mức độ tin cậy của số liệu.'],
          ['p', '3.8. Thời hạn hoàn thành thẩm định không quá 3 ngày làm việc kể từ khi nhận đủ hồ sơ.'],
          ['p', '3.9. Trường hợp doanh nghiệp mới thành lập dưới 12 tháng áp dụng quy trình riêng tại Phụ lục 02.', 's3-9']
        ] }
      ],
      passages: {
        's3-4': { loc: ['esr.section34', 'Mục 3.4'], page: null, search: true },
        's3-6': { loc: ['esr.section36', 'Mục 3.6'], page: null, search: true },
        's3-9': { loc: ['esr.section39', 'Mục 3.9'], page: null, search: true }
      }
    },
    'dt-sme': {
      title: 'Đào tạo: Sản phẩm tín dụng SME 2024', type: 'PPT', ft: 'ft-ppt',
      kb: 'Sản phẩm thẻ tín dụng', ver: 'v3.0', status: 'active',
      original: null,
      kw: ['hạn mức tín dụng', 'doanh nghiệp'],
      pages: [
        { no: 8, label: ['dv.slideN', 'Slide {n}'], landscape: true, blocks: [
          ['h2', 'Gói hạn mức tuần hoàn cho doanh nghiệp nhỏ'],
          ['p', 'Gói hạn mức tín dụng tuần hoàn cho doanh nghiệp nhỏ: tối đa 5 tỷ đồng, thời hạn 12 tháng.', 'slide8'],
          ['p', 'Giải ngân nhiều lần trong thời hạn của hạn mức; dư nợ đã trả được tái sử dụng.'],
          ['p', 'Hồ sơ theo Hướng dẫn thẩm định hồ sơ vay vốn lưu động.']
        ] }
      ],
      passages: {
        'slide8': { loc: ['dv.slide8', 'Slide 8'], page: null, search: true }
      }
    },
    'bp-the-2024': {
      title: 'Biểu phí dịch vụ thẻ 2024', type: null,
      kb: 'Sản phẩm thẻ tín dụng', ver: 'v4.1', updated: '2026-10-16',
      original: null,
      kw: ['phí thường niên', 'thẻ tín dụng doanh nghiệp'],
      pages: [
        { no: null, blocks: [
          ['h2', 'Mục 2. Phí thẻ tín dụng'],
          ['p', '2.1. Phí thường niên thẻ tín dụng doanh nghiệp: 300.000 VND/thẻ/năm.', 's2-1']
        ] }
      ],
      passages: {
        's2-1': { loc: ['dv.section21', 'Mục 2.1'], page: null }
      }
    }
  };
  var STATUS = { active: ['esr.statusActive', 'Đang hiệu lực', 'chip-success'] };

  // ---- helpers ----
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function markKw(text, kw) {
    var h = esc(text);
    if (!kw || !kw.length) return h;
    var re = new RegExp('(' + kw.slice().sort(function (a, b) { return b.length - a.length; }).map(function (k) { return esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
    return h.replace(re, '<mark>$1</mark>');
  }
  function locText(p) { return p.loc[0] ? T(p.loc[0], p.loc[1]) : p.loc[1]; }
  function fmtDate(iso) { return I18N && I18N.fmtDate ? I18N.fmtDate(iso) : iso; }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('[data-doc-viewer]');
    if (!root) return;
    var params = new URLSearchParams(location.search);
    var docId = params.get('doc'), doc = DOCS[docId] || (window.ECP_CR && window.ECP_CR.viewerDoc(docId));
    var from = /^(ask|search|cr)$/.test(params.get('from')) ? params.get('from') : null;
    var q = params.get('q') || '';
    var cite = params.get('cite');
    var cur = params.get('psg'), citedPsg = cite ? cur : null;
    var $ = function (sel) { return root.querySelector(sel); };

    if (!doc) { $('[data-dv-missing]').hidden = false; $('[data-dv-split]').hidden = true; $('[data-dv-download]').hidden = true; return; }

    // passages listed in the side panel: search matches, plus the cited passage when it did not match the query
    var ids = Object.keys(doc.passages).filter(function (id) { return doc.passages[id].search || id === cur; });
    if (ids.indexOf(cur) === -1) cur = ids[0];

    function renderHead() {
      document.title = doc.title + ' · MSB Context Platform';
      var ico = $('[data-dv-ico]');
      ico.className = 'file-ico sm ' + (doc.ft || 'ft-md');
      ico.textContent = doc.type || '';
      ico.hidden = !doc.type;
      $('[data-dv-title]').textContent = doc.title;
      $('[data-dv-title]').setAttribute('title', doc.title);
      var st = STATUS[doc.status];
      $('[data-dv-sub]').innerHTML = 'KB: <span>' + esc(doc.kb) + '</span>' +
        ' <span aria-hidden="true">·</span> <span class="chip ' + (st ? st[2] : 'chip-neutral') + '">' + esc(doc.ver) + (st ? ' · ' + esc(T(st[0], st[1])) : '') + '</span>';
      // why the document was opened: the query (Search) or the question + citation number (Ask)
      var ctx = $('[data-dv-ctx]');
      ctx.hidden = !(from && q);
      if (from === 'search') ctx.innerHTML = esc(T('dv.ctxSearch', 'Kết quả cho')) + ' <b>“' + esc(q) + '”</b>';
      else if (from === 'cr') ctx.innerHTML = esc(T('dv.ctxCr', 'Bằng chứng trong')) + ' <b>' + esc(q) + '</b>';
      else if (from === 'ask') ctx.innerHTML = (cite ? '<span class="cite" aria-hidden="true">' + esc(cite) + '</span> ' : '') + esc(T('dv.ctxAsk', 'Trích dẫn trong câu trả lời cho')) + ' <b>“' + esc(q) + '”</b>';
      ctx.setAttribute('title', q);
    }

    function renderDoc() {
      var html = '<p class="dv-note">' + esc(T('dv.excerptNote', 'Mockup: chỉ hiển thị các trang có đoạn liên quan.')) + '</p>';
      doc.pages.forEach(function (pg) {
        var label = pg.no == null ? '' : pg.label ? T(pg.label[0], pg.label[1], { n: pg.no }) :
          doc.pageCount ? T('dv.pageNofM', 'Trang {n} / {m}', { n: pg.no, m: doc.pageCount }) : T('dv.pageN', 'Trang {n}', { n: pg.no });
        html += '<article class="a4-page md-body' + (pg.landscape ? ' landscape' : '') + '"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '>';
        pg.blocks.forEach(function (b) {
          var id = b[2], isPsg = id && ids.indexOf(id) !== -1;
          // a table block carries { head, rows, text } (text: the passage snippet for the side list)
          var body = typeof b[1] === 'string' ? (isPsg ? markKw(b[1], doc.kw) : esc(b[1])) :
            '<thead><tr>' + b[1].head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
            b[1].rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + (isPsg ? markKw(c, doc.kw) : esc(c)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
          html += '<' + b[0] + ' data-i18n-skip' + (id ? ' id="psg-' + esc(id) + '" class="dv-psg"' : '') + '>' + body + '</' + b[0] + '>';
        });
        if (label) html += '<span class="page-no" aria-hidden="true">' + esc(label) + '</span>';
        html += '</article>';
      });
      $('[data-dv-pages]').innerHTML = html;
    }

    function renderSide() {
      $('[data-dv-count]').textContent = ids.length === 1 ? T('dv.n1Passage', '1 đoạn') : T('dv.nPassages', '{n} đoạn', { n: ids.length });
      $('[data-dv-list]').innerHTML = ids.map(function (id) {
        var p = doc.passages[id], text = '';
        doc.pages.forEach(function (pg) { pg.blocks.forEach(function (b) { if (b[2] === id) text = typeof b[1] === 'string' ? b[1] : b[1].text; }); });
        var cited = from === 'ask' && id === citedPsg;
        return '<li><button class="chunk-item dv-card" type="button" data-psg="' + esc(id) + '" aria-current="false">' +
          '<span class="chunk-top"><span class="chunk-loc">' + esc(locText(p)) + '</span>' +
          (cited ? '<span class="chip chip-info dv-cited">' + esc(T('dv.citedN', 'Trích dẫn [{n}]', { n: cite })) + '</span>' : '') + '</span>' +
          '<span data-i18n-skip class="chunk-ex">' + markKw(text, doc.kw) + '</span></button></li>';
      }).join('');
      var st = STATUS[doc.status], rows = [
        ['Knowledge Base', esc(doc.kb)]
      ].concat(doc.code ? [[T('dv.code', 'Mã tài liệu'), esc(doc.code)]] : []).concat([
        ['Version', esc(doc.ver) + (st ? ' · ' + esc(T(st[0], st[1])) : '')]
      ]);
      if (doc.updated) rows.push([T('common.updated', 'Cập nhật'), '<time datetime="' + doc.updated + '">' + esc(fmtDate(doc.updated)) + '</time>']);
      if (doc.owner) rows.push(['Owner', esc(doc.owner)]);
      if (doc.type) rows.push([T('common.type', 'Loại'), esc(doc.type)]);
      $('[data-dv-info]').innerHTML = rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd data-i18n-skip>' + r[1] + '</dd>'; }).join('');
    }

    function select(id, scroll) {
      cur = id;
      var i = ids.indexOf(id), p = doc.passages[id];
      if (!p) { $('[data-dv-pos]').textContent = ''; $('[data-dv-prev]').disabled = $('[data-dv-next]').disabled = true; return; }
      root.querySelectorAll('.dv-psg.is-active').forEach(function (x) { x.classList.remove('is-active'); });
      var el = document.getElementById('psg-' + id);
      if (el) el.classList.add('is-active');
      root.querySelectorAll('[data-psg]').forEach(function (b) {
        var on = b.getAttribute('data-psg') === id;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-current', String(on));
      });
      $('[data-dv-pos]').textContent = T('dv.passageIofN', 'Đoạn {i}/{n}', { i: i + 1, n: ids.length }) + ' · ' + locText(p);
      $('[data-dv-prev]').disabled = i <= 0;
      $('[data-dv-next]').disabled = i >= ids.length - 1;
      if (scroll && el) el.scrollIntoView({ behavior: scroll === 'smooth' && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto', block: 'center' });
      // keep the passage in the URL so a refresh / shared link reopens it
      params.set('psg', id);
      try { history.replaceState(null, '', location.pathname + '?' + params.toString()); } catch (e) {}
    }

    function renderAll() { renderHead(); renderDoc(); renderSide(); select(cur, false); }
    renderAll();
    requestAnimationFrame(function () { select(cur, 'auto'); });
    onLang(renderAll);

    root.addEventListener('click', function (e) {
      var card = e.target.closest('[data-psg]');
      if (card) { select(card.getAttribute('data-psg'), 'smooth'); return; }
      if (e.target.closest('[data-dv-prev]')) select(ids[ids.indexOf(cur) - 1], 'smooth');
      else if (e.target.closest('[data-dv-next]')) select(ids[ids.indexOf(cur) + 1], 'smooth');
    });

    // Download original. Integration point: ECPDocViewer.resolveOriginal(docId, doc) returns the original file's URL
    // (e.g. a presigned object-storage URL from the document service) or null. The mockup has no source files, so it
    // returns doc.original (null) and the viewer says the file is unavailable instead of faking a download.
    var dl = $('[data-dv-download]'), note = $('[data-dv-dl-note]');
    dl.addEventListener('click', function () {
      var url = window.ECPDocViewer.resolveOriginal(docId, doc);
      if (url) {
        var a = document.createElement('a');
        a.href = url; a.download = ''; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        note.hidden = true;
        return;
      }
      note.hidden = false;
    });
    note.querySelector('[data-dv-dl-close]').addEventListener('click', function () { note.hidden = true; dl.focus(); });
  });

  window.ECPDocViewer = {
    docs: DOCS,
    resolveOriginal: function (docId, doc) { return doc && doc.original || null; }
  };
})();
