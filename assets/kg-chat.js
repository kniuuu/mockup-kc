/* ECP mockups: Knowledge Graph chat, mirrors micro-frontend/web features/knowledge-graph/components/kg-chat-panel.tsx.
   Two views in the panel: chat (messages, new-chat welcome with suggested questions, then the selected node's prop-card,
   which ecp-graph.js keeps rendering at the bottom of .chat-body) and history (search field, plain list of conversation
   titles with × each, "Xóa tất cả" after an inline confirm). KG conversations are separate from Enterprise Search history.
   Mock data only ({ id, updatedAt, focus, messages: [{ role, text }] }). An answer with a graph focus moves the canvas
   (graph.focus in the FE: the focus node's neighbourhood joins the graph, is highlighted and the node is selected).
   Demo states: default and ?chat=new (empty conversation + suggestions), ?chat=answered (seeded conversation), ?chat=history (history open), ?chat=empty (no history yet). */
(function () {
  var I18N = window.ECP_I18N;
  var T = function (k, vi, a) { return I18N && I18N.tr ? I18N.tr(k, vi, a) : String(vi).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); };
  var fold = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase(); };
  var MIN = 60000, DAY = 86400000;

  // suggested questions: grounded in the bank dataset (Process, Policy, Regulation, Document, Product, Department, Concept).
  // Natural-language only: the graph chat does not run Cypher, so no Cypher example is offered.
  var SUG = [
    ['kgc.sug1', 'Hiển thị quan hệ giữa sản phẩm, chính sách và quy định.'],
    ['kgc.sug2', 'Những tài liệu nào liên quan tới chính sách tín dụng SME?'],
    ['kgc.sug3', 'Tìm các entity kết nối với Khối KHDN.'],
    ['kgc.sug4', 'Giải thích Hạn mức SME và Quy định 15% vốn được kết nối thế nào.'],
    ['kgc.sug5', 'Tìm tài liệu liên quan tới node đang chọn.'],
    ['kgc.sug6', 'Tóm tắt các quan hệ chính trong graph này.']
  ];
  var ANS = [
    '<b>Hạn mức SME</b> và <b>Gói tuần hoàn 5 tỷ</b> chịu ràng buộc bởi <b>Quy định 15% vốn</b> và <b>Phân cấp hạn mức</b>; hai chính sách này căn cứ <b>Thông tư 39</b> và <b>Luật TCTD 2024</b>.',
    '4 tài liệu: <b>QĐ-TD-08</b> (quy định gốc), <b>Phụ lục 02</b> (hạn mức tuần hoàn), <b>Playbook thẩm định</b> và <b>Mẫu HĐ tín dụng</b>. <b>QĐ-TD-07</b> đã được thay thế.',
    '<b>Khối KHDN</b> có 6 kết nối: sở hữu <b>Cấp tín dụng KHDN</b>, <b>Hạn mức SME</b>, <b>Báo cáo tài chính</b>, <b>Phụ lục 02</b>; phối hợp với <b>Khối QTRR</b> và <b>Hội đồng tín dụng</b>.',
    'Đường đi ngắn nhất có 2 bước: <b>Hạn mức SME</b> → GOVERNED_BY → <b>Phân cấp hạn mức</b> → CONSTRAINED_BY → <b>Quy định 15% vốn</b>. Ngoài ra cả hai cùng được tham chiếu bởi <b>QĐ-TD-08</b>.',
    'Node đang chọn <b>Cấp tín dụng KHDN</b> có evidence ở 3 tài liệu: <b>QĐ-TD-08 · Điều 8</b>, <b>Phụ lục 02</b> và <b>Playbook thẩm định</b>.',
    'Graph có 3 cụm chính: <b>tín dụng KHDN</b> (quy trình → chính sách → Thông tư 39), <b>tuân thủ</b> (KYC, AML → Thông tư 09) và <b>ALM / lãi suất</b> do ALCO sở hữu.'
  ];
  // graph focus per suggestion (null keeps the graph as it is: "selected node" and "this graph" refer to what is on screen)
  var SUG_FOCUS = ['pol-hanmuc', 'prod-sme', 'dep-khdn', 'prod-sme', null, null];
  var GENERIC = 'Mockup: câu trả lời sẽ dựa trên các node và quan hệ trong graph hiện tại, kèm evidence từ tài liệu nguồn.';

  var now = Date.now();
  function seed(cur) {
    var c = function (id, ago, focus, msgs) { return { id: id, updatedAt: now - ago, focus: focus, messages: msgs.map(function (m, i) { return { role: i % 2 ? 'bot' : 'user', text: m }; }) }; };
    return [
      cur,
      c('kg-c2', 2 * 60 * MIN, 'prod-sme', ['Những tài liệu nào liên quan tới Hạn mức SME?', ANS[1]]),
      c('kg-c3', DAY + 3 * 60 * MIN, 'pol-15von', ['Quy định 15% vốn ảnh hưởng tới những sản phẩm nào?', '<b>Hạn mức SME</b>, <b>Gói tuần hoàn 5 tỷ</b> và <b>Tài trợ XNK</b> bị giới hạn bởi <b>Quy định 15% vốn</b>.']),
      c('kg-c4', DAY + 6 * 60 * MIN, 'proc-thamdinh', ['Ai là owner của quy trình Thẩm định hồ sơ?', '<b>Thẩm định hồ sơ</b> do <b>Khối QTRR</b> sở hữu, SLA 3 ngày làm việc.', 'Quy trình đó liên quan tới chính sách nào?', '<b>XHTD nội bộ</b> và <b>Tài sản bảo đảm</b>; tham chiếu <b>Playbook thẩm định</b>.']),
      c('kg-c5', 3 * DAY, 'reg-tt39', ['Thông tư 39 liên quan tới những chính sách nội bộ nào?', '<b>Thông tư 39</b> là căn cứ của <b>Quy định 15% vốn</b>, <b>Chính sách lãi suất</b> và <b>Phân cấp hạn mức</b>.']),
      c('kg-c6', 4 * DAY, 'pol-aml', ['Giải thích quan hệ giữa KYC tổ chức và Chính sách AML', '<b>KYC tổ chức</b> là bước bắt buộc của <b>Chính sách AML</b>; cả hai căn cứ <b>Thông tư 09</b> và do <b>Tuân thủ</b> sở hữu.']),
      c('kg-c7', 6 * DAY, 'dep-qtrr', ['Khối QTRR sở hữu những quy trình nào?', '3 quy trình: <b>Thẩm định hồ sơ</b>, <b>Định giá TSBĐ</b> và phối hợp trong <b>Cấp tín dụng KHDN</b>.']),
      c('kg-c8', 12 * DAY, 'reg-ldtctd', ['Tóm tắt các quan hệ chính của Luật TCTD 2024', '<b>Luật TCTD 2024</b> là căn cứ của 4 chính sách nội bộ, gồm <b>Quy định 15% vốn</b> và <b>Phân cấp hạn mức</b>.']),
      c('kg-c9', 15 * DAY, 'doc-qdtd08', ['Tài liệu nào thay thế QĐ-TD-07?', '<b>QĐ-TD-08</b> (v2.3, hiệu lực 01/01/2024) thay thế <b>QĐ-TD-07</b>.']),
      c('kg-c10', 21 * DAY, 'proc-dinhgia', ['Sản phẩm nào cần định giá tài sản bảo đảm?', '<b>Vay mua nhà</b> và <b>Hạn mức SME</b> có TSBĐ, đi qua quy trình <b>Định giá TSBĐ</b>.'])
    ];
  }

  document.addEventListener('DOMContentLoaded', function () {
    var panel = document.querySelector('.kg-layout .chat-panel');
    if (!panel) return;
    var body = panel.querySelector('.chat-body'), card = body.querySelector('.prop-card');
    var form = panel.querySelector('.chat-input'), input = form.querySelector('input');
    var histBtn = panel.querySelector('[data-kgc-hist]'), hist = panel.querySelector('.kg-hist'), list = hist.querySelector('.kg-hist-items');
    var hIn = hist.querySelector('#kg-hist-q'), hNone = hist.querySelector('.kg-hist-none');
    var hFoot = hist.querySelector('.hist-foot'), hClear = hFoot.querySelector('[data-kgc-clear]'), hConfirm = hFoot.querySelector('.hist-confirm');
    var mode = new URLSearchParams(location.search).get('chat');

    // drag the panel's left edge (or ← / →); narrower than 280px collapses it; --kg-chat-w persists in localStorage
    var layout = panel.closest('.kg-layout'), MINW = 280, KSTEP = 16, KEY = 'ecp-kg-chat-w', rz = document.createElement('div');
    rz.className = 'kg-chat-resize'; rz.setAttribute('role', 'separator'); rz.setAttribute('aria-orientation', 'vertical'); rz.tabIndex = 0;
    rz.setAttribute('aria-label', (I18N && I18N.tr ? I18N.tr('web.kg.resizeChat', 'Kéo để đổi độ rộng khung hỏi đáp') : 'Kéo để đổi độ rộng khung hỏi đáp')); rz.setAttribute('data-i18n-attr', 'aria-label:web.kg.resizeChat');
    panel.appendChild(rz);
    try { var sw = parseInt(localStorage.getItem(KEY), 10); if (sw >= MINW) layout.style.setProperty('--kg-chat-w', sw + 'px'); } catch (e) {}
    function chatW(px) { var w = Math.round(Math.min(px, layout.getBoundingClientRect().width * 0.4)); layout.style.setProperty('--kg-chat-w', w + 'px'); return w; }
    function chatCommit(req, prev) {
      if (req < MINW) { layout.style.setProperty('--kg-chat-w', prev + 'px'); var tg = panel.querySelector('[data-chat-toggle]'); if (tg) tg.click(); return; }
      try { localStorage.setItem(KEY, String(chatW(req))); } catch (e) {}
    }
    rz.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); rz.setPointerCapture(e.pointerId);
      var right = panel.getBoundingClientRect().right, prev = Math.round(panel.getBoundingClientRect().width), req = prev;
      rz.classList.add('is-dragging');
      function mv(ev) { req = right - ev.clientX; chatW(Math.max(MINW, req)); }
      function up() { rz.removeEventListener('pointermove', mv); rz.removeEventListener('pointerup', up); rz.removeEventListener('pointercancel', up); rz.classList.remove('is-dragging'); chatCommit(req, prev); }
      rz.addEventListener('pointermove', mv); rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
    });
    rz.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); var w = Math.round(panel.getBoundingClientRect().width);
      chatCommit(w + (e.key === 'ArrowLeft' ? KSTEP : -KSTEP), w);   // the panel grows leftwards
    });

    // ?note=truncated|degraded|both: notice over the canvas (graph cut at the node limit / some KBs did not respond)
    var note = new URLSearchParams(location.search).get('note'), cv = document.querySelector('.kg-layout .graph-canvas');
    if (cv && note) {
      var p = el('p', 'kg-note muted text-xs');
      p.setAttribute('role', 'status');
      if (note !== 'degraded') p.appendChild(el('span', '', 'Graph đã được rút gọn theo giới hạn số node.', 'web.kg.truncated'));
      if (note === 'both') p.appendChild(document.createTextNode(' '));
      if (note !== 'truncated') p.appendChild(el('span', '', 'Một số Knowledge Base không phản hồi; graph có thể chưa đầy đủ.', 'web.kg.degraded'));
      cv.insertBefore(p, cv.firstChild);
    }

    // the conversation already in the panel markup is the active one
    var first = body.querySelector('.msg-user');
    var graphEl = document.querySelector('.kg-layout .ecpg');
    var cur = { id: 'kg-c1', updatedAt: now - 12 * MIN, messages: [].map.call(body.querySelectorAll(':scope > .msg-user, :scope > .msg-bot'), function (m) { return { role: m.classList.contains('msg-user') ? 'user' : 'bot', text: m.innerHTML }; }) };
    var convs = mode === 'empty' ? [] : seed(cur);
    var active = cur;

    function el(tag, cls, vi, key) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (vi !== undefined) { e.textContent = vi; if (key) e.setAttribute('data-i18n', key); }
      return e;
    }
    function translate(n) { if (I18N && I18N.apply) I18N.apply(n); }
    function msgEl(m) {
      var d = el('div', m.role === 'user' ? 'msg-user' : 'msg-bot');
      d.setAttribute('data-i18n-skip', '');
      if (m.role === 'user') d.textContent = m.text; else d.innerHTML = m.text;
      return d;
    }
    function plain(html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent; }
    function titleOf(c) { var u = c.messages.filter(function (m) { return m.role === 'user'; })[0]; return u ? plain(u.text).slice(0, 120) : ''; }
    function hasUser(c) { return c.messages.some(function (m) { return m.role === 'user'; }); }
    // messages go above the selected node's prop-card, which always stays last in .chat-body
    function setMessages(nodes) {
      [].slice.call(body.children).forEach(function (c) { if (c !== card) body.removeChild(c); });
      nodes.forEach(function (n) { body.insertBefore(n, card); });
    }

    // ---- new-chat welcome: title, hint, suggested questions (FE .kg-welcome / .kg-suggest) ----
    function welcome() {
      var w = el('div', 'kg-welcome');
      w.appendChild(el('b', '', 'Bạn muốn tìm hiểu gì trong graph?', 'kgc.welcomeTitle'));
      w.appendChild(el('p', 'muted', 'Hỏi về quan hệ giữa quy trình, chính sách, quy định, tài liệu và sản phẩm. Câu trả lời dựa trên các node trong graph.', 'kgc.welcomeHint'));
      var ul = el('ul', 'kg-suggest');
      ul.setAttribute('aria-label', 'Câu hỏi gợi ý'); ul.setAttribute('data-i18n-attr', 'aria-label:esa.suggestedQuestions');
      SUG.forEach(function (s, i) {
        var li = el('li'), b = el('button', 'chip chip-neutral', s[1], s[0]);
        b.type = 'button'; b.setAttribute('data-kgc-sug', String(i));
        li.appendChild(b); ul.appendChild(li);
      });
      w.appendChild(ul);
      translate(w);
      return w;
    }

    function newChat() {
      active = { id: 'kg-n' + Date.now(), updatedAt: Date.now(), messages: [] };
      setMessages([welcome()]);
      showHist(false);
    }

    function open(c) {
      if (c !== active) { active = c; setMessages(c.messages.map(msgEl)); }
      showHist(false);
      body.scrollTop = body.scrollHeight;
    }

    function send(q) {
      q = q.trim();
      if (!q) return;
      var w = body.querySelector('.kg-welcome');
      if (w) w.remove(); // suggestions are shown only until the first question
      if (!hasUser(active)) convs.unshift(active);
      var u = { role: 'user', text: q };
      active.messages.push(u);
      body.insertBefore(msgEl(u), card);
      var i = -1;
      SUG.forEach(function (s, k) { if (T(s[0], s[1]) === q || s[1] === q) i = k; });
      var b = { role: 'bot', text: i < 0 ? GENERIC : ANS[i] };
      active.messages.push(b);
      body.insertBefore(msgEl(b), card);
      // graph.focus: the focus node's neighbourhood joins the canvas, is highlighted and the node is selected
      if (i >= 0 && SUG_FOCUS[i] && graphEl && graphEl.ecpg && graphEl.ecpg.focusOn) graphEl.ecpg.focusOn(SUG_FOCUS[i]);
      active.updatedAt = Date.now();
      convs.sort(function (a, z) { return z.updatedAt - a.updatedAt; });
      input.value = '';
      body.scrollTop = body.scrollHeight;
    }

    // ---- history: plain list of titles (search matches the title) ----
    function renderHist() {
      var raw = hIn.value.trim(), q = fold(raw), n = 0;
      list.innerHTML = '';
      convs.forEach(function (c) {
        if (q && fold(titleOf(c)).indexOf(q) < 0) return;
        var li = el('li', 'hist-entry'), b = el('button', 'kg-hist-item');
        b.type = 'button'; b.setAttribute('data-kgc-open', c.id);
        if (c === active) b.setAttribute('aria-current', 'true');
        var t = el('span', 'hist-q', titleOf(c)); t.setAttribute('data-i18n-skip', '');
        b.appendChild(t);
        var del = el('button', 'icon-btn is-sm hist-del');
        del.type = 'button'; del.setAttribute('data-kgc-del', c.id);
        del.setAttribute('aria-label', T('mk.web.kg.deleteChat', 'Xóa cuộc hội thoại {title}', { title: titleOf(c) }));
        del.innerHTML = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
        li.appendChild(b); li.appendChild(del);
        list.appendChild(li); n++;
      });
      hNone.hidden = n > 0;
      hNone.querySelector('p').textContent = raw ? T('hist.noMatch', 'Không có mục nào khớp “{q}”', { q: raw }) : T('kgc.emptyHistory', 'Chưa có cuộc hội thoại nào.');
      hFoot.hidden = !n;
      if (!n) setConfirm(false);
    }
    function removeConv(id) {
      var i = convs.map(function (c) { return c.id; }).indexOf(id);
      if (convs[i] === active) newChat();
      convs.splice(i, 1);
      showHist(true);
    }
    function setConfirm(open) { hConfirm.hidden = !open; hClear.hidden = open; }
    function showHist(on) {
      panel.querySelectorAll('[data-kgc-view]').forEach(function (v) { v.hidden = (v.getAttribute('data-kgc-view') === 'hist') !== on; });
      histBtn.setAttribute('aria-expanded', String(on));
      if (on) renderHist();
    }

    panel.addEventListener('click', function (e) {
      var t = e.target.closest('[data-kgc-del], [data-kgc-clear], [data-kgc-clear-ok], [data-kgc-clear-no], [data-kgc-new], [data-kgc-hist], [data-kgc-back], [data-kgc-open], [data-kgc-sug]');
      if (!t) return;
      if (t.hasAttribute('data-kgc-del')) removeConv(t.getAttribute('data-kgc-del'));
      else if (t.hasAttribute('data-kgc-clear')) setConfirm(true);
      else if (t.hasAttribute('data-kgc-clear-no')) setConfirm(false);
      else if (t.hasAttribute('data-kgc-clear-ok')) { convs = []; active = { id: 'kg-n' + Date.now(), updatedAt: Date.now(), messages: [] }; setMessages([welcome()]); setConfirm(false); renderHist(); }
      else if (t.hasAttribute('data-kgc-new')) newChat();
      else if (t.hasAttribute('data-kgc-hist')) showHist(hist.hidden);
      else if (t.hasAttribute('data-kgc-back')) showHist(false);
      else if (t.hasAttribute('data-kgc-open')) open(convs.filter(function (c) { return c.id === t.getAttribute('data-kgc-open'); })[0]);
      else send(t.textContent);
    });
    hIn.addEventListener('input', renderHist);
    form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
    if (I18N && I18N.onChange) I18N.onChange(function () { if (!hist.hidden) renderHist(); });

    if (mode !== 'answered' || !first) newChat();   // as the web screen: opens on the welcome (?chat=answered keeps the seeded conversation)
    if (mode === 'history' || mode === 'empty') showHist(true);
  });
})();
