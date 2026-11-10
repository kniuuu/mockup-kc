/* Inline definitions for curator domain terms (Node, Rel., Package, Source, Evolution, Quét lỗi, Quan hệ AI, gold, trace).
   Markup: data-term="node" on the FIRST visible use of a term on the page. A focusable (i) button follows the term
   (inside a text element; after a button or link) and opens a short definition. Esc / outside click closes it.
   Definitions live in i18n.js under term.<name>. */
(function () {
  var I = window.ECP_I18N;
  function T(k, vi, a) { return I ? I.tr(k, vi, a) : vi; }
  var DEF = {
    node: ['Node', 'Một thực thể trong knowledge graph, ví dụ một sản phẩm, quy định hay đơn vị.'],
    rel: ['Rel. (Relationship)', 'Quan hệ nối hai node trong graph, ví dụ “áp dụng cho” hay “do … phê duyệt”.'],
    package: ['Package', 'Knowledge Package: Wiki, FAQ hoặc Playbook được sinh từ tài liệu của tri thức theo template.'],
    source: ['Source', 'Nguồn dữ liệu được kết nối (thư mục, SharePoint, S3) mà tri thức lấy tài liệu về.'],
    evolution: ['Evolution', 'Thay đổi cấu trúc của tri thức: schema, ontology hoặc loại package mới, cần duyệt trước khi áp dụng.'],
    lint: ['Quét lỗi', 'Lỗi do bộ kiểm tra tự động phát hiện: định dạng, thiếu metadata, liên kết hỏng. Thường sửa được tự động.'],
    triple: ['Quan hệ AI', 'Bộ ba chủ thể – quan hệ – đối tượng do AI trích từ tài liệu; cần người duyệt trước khi vào graph.'],
    gold: ['gold', 'Đáp án chuẩn đã được duyệt, dùng để chấm điểm câu trả lời trong lượt đánh giá.'],
    trace: ['Trace', 'Các bước tạo ra câu trả lời: truy vấn con, đoạn được truy xuất và xếp hạng, model đã gọi và trích dẫn.']
  };
  var SVG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
  var pop = null, cur = null, seq = 0;
  var INTERACTIVE = 'a[href], button, summary, select, input, textarea';

  function popEl() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'popover term-pop'; pop.id = 'term-pop'; pop.setAttribute('role', 'note'); pop.hidden = true;
    document.body.appendChild(pop);
    return pop;
  }
  function close(refocus) {
    if (!cur) return;
    var b = cur; cur = null;
    b.setAttribute('aria-expanded', 'false'); popEl().hidden = true;
    if (refocus) b.focus();
  }
  function open(b) {
    var name = b.getAttribute('data-term-btn'), d = DEF[name], p = popEl();
    p.innerHTML = '<b>' + T('term.' + name + '.t', d[0]) + '</b><span>' + T('term.' + name, d[1]) + '</span>';
    p.hidden = false; b.setAttribute('aria-expanded', 'true'); cur = b;
    var r = b.getBoundingClientRect(), w = p.offsetWidth;
    p.style.left = Math.max(8, Math.min(r.left - 12, innerWidth - w - 8)) + 'px';
    p.style.top = (r.bottom + 6 + p.offsetHeight > innerHeight ? r.top - p.offsetHeight - 6 : r.bottom + 6) + 'px';
  }
  function label(btn) {
    var d = DEF[btn.getAttribute('data-term-btn')];
    btn.setAttribute('aria-label', T('term.explain', 'Giải thích: {t}', { t: T('term.' + btn.getAttribute('data-term-btn') + '.t', d[0]) }));
  }
  // first visible [data-term] per name gets the (i); re-run after a language switch (i18n rewrites data-i18n text)
  function ensure() {
    var seen = {};
    document.querySelectorAll('[data-term]').forEach(function (el) {
      var name = el.getAttribute('data-term');
      if (!DEF[name] || seen[name]) return;
      if (!el.getClientRects().length) return; // hidden tab / state: let a visible later use carry it
      seen[name] = 1;
      var after = el.matches(INTERACTIVE) || el.querySelector(INTERACTIVE);
      var btn = after ? el.nextElementSibling : el.lastElementChild;
      if (!btn || !btn.hasAttribute('data-term-btn')) {
        btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'term-info'; btn.innerHTML = SVG;
        btn.setAttribute('data-term-btn', name); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'term-pop');
        btn.id = 'term-b' + (++seq);
        if (after) el.insertAdjacentElement('afterend', btn); else el.appendChild(btn);
      }
      label(btn);
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-term-btn]');
    if (b) { e.preventDefault(); e.stopPropagation(); var same = cur === b; close(false); if (!same) open(b); return; }
    if (cur && !(pop && pop.contains(e.target))) close(false);
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) close(true); });
  window.addEventListener('scroll', function () { close(false); }, true);
  window.addEventListener('resize', function () { close(false); });
  document.addEventListener('DOMContentLoaded', function () {
    ensure();
    if (I && I.onChange) I.onChange(function () { close(false); ensure(); });
    document.addEventListener('click', function (e) { if (e.target.closest('[role="tab"], [data-view-key]')) setTimeout(ensure, 0); });
  });
})();
