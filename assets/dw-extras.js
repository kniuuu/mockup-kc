/* Document workspace extras (document-workspace-screen.tsx): content edit with the visual (WYSIWYG) editor and the
 * Markdown source mode (editor | preview), and the chat over this one document in the side panel. Mock state only.
 * ?state=edit-pii: edit disabled on a PII-restricted KB; ?state=chat-hypothesis | chat-noevidence | chat-error. */
(function () {
  var I = window.ECP_I18N; if (!I) return;
  var P = 'web.documentWorkspace.';
  var t = {
    'dw.editContent': ['Chỉnh sửa nội dung', 'Edit content'],
    'dw.visualEditor': ['Trình soạn trực quan', 'Visual editor'],
    'dw.chatCite1': ['Mức hạn mức tín dụng tối đa cho doanh nghiệp SME không vượt quá 15% vốn tự có…', 'The maximum credit limit for SMEs may not exceed 15% of the bank\'s own capital…'],
    'dw.chatQ1': ['Hạn mức tối đa cho SME là bao nhiêu?', 'What is the maximum limit for SMEs?'],
    'dw.chatA1': ['Tối đa **15% vốn tự có** của ngân hàng; khoản vượt ngưỡng cần Hội đồng tín dụng phê duyệt [1].', 'At most **15% of the bank\'s own capital**; amounts above the threshold need Credit Council approval [1].'],
    'dw.chatQ2': ['Ai phê duyệt khoản vay trên 50 tỷ?', 'Who approves loans above 50 billion?'],
    'dw.chatA2': ['Hội đồng tín dụng cấp 2 [1].', 'The Level-2 Credit Council [1].']
  };
  var m = {
    discard: ['Bỏ thay đổi', 'Discard'], discardTitle: ['Bỏ các thay đổi?', 'Discard your changes?'], discardBody: ['Nội dung bạn đã sửa sẽ bị mất.', 'Your edits to this document will be lost.'],
    editorLabel: ['Trình soạn Markdown', 'Markdown editor'], preview: ['Xem trước', 'Preview'],
    editPii: ['Không thể sửa văn bản của tri thức hạn chế PII.', 'Editing is not available for PII-restricted knowledge bases.'],
    saved: ['Đã lưu. Nội dung sửa đang được xử lý thành phiên bản mới.', 'Saved. The edit is being processed as a new version.'],
    markdownSource: ['Mã nguồn Markdown', 'Markdown source'],
    chatOpen: ['Hỏi đáp về văn bản', 'Ask about this document'], chatClose: ['Quay lại thông tin văn bản', 'Back to document information'],
    chatTitle: ['Hỏi đáp về văn bản', 'Ask about this document'], chatHint: ['Đặt câu hỏi; câu trả lời chỉ dựa trên văn bản này.', 'Ask a question; answers come only from this document.'],
    chatPlaceholder: ['Hỏi về văn bản này…', 'Ask about this document…'], chatSend: ['Gửi câu hỏi', 'Send question'],
    chatError: ['Không trả lời được câu hỏi. Thử lại sau.', 'Could not answer the question. Try again later.'],
    chatNoEvidence: ['Văn bản này không có thông tin để trả lời câu hỏi.', 'This document has no information to answer the question.'],
    chatHypothesis: ['Văn bản này không đủ thông tin đáng tin cậy để trả lời chắc chắn — đây là câu trả lời giả định, chưa được kiểm chứng. Hãy đọc các đoạn được trích dẫn trước khi sử dụng.', 'This document doesn\'t have enough reliable information to answer with confidence — this is an unverified hypothesis. Read the cited passages before relying on it.'],
    chatPage: ['trang {n}', 'page {n}']
  };
  Object.keys(m).forEach(function (k) { t[P + k] = m[k]; });
  Object.keys(t).forEach(function (k) { I.dict.vi[k] = t[k][0]; I.dict.en[k] = t[k][1]; });
  var T = function (k, args) { return I.tr(k, (t[k] || [I.dict.vi[k] || k])[0], typeof args === 'object' ? args : undefined); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var bold = function (s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); };
  var ico = function (d) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; };
  var state = new URLSearchParams(location.search).get('state') || '';

  function init() {
    var doc = document.querySelector('.viewer-doc'), side = document.querySelector('.viewer-side'), bar = document.querySelector('[data-doc-edit-bar]');
    if (!doc || !side) return;
    var pages = Array.prototype.slice.call(doc.querySelectorAll('.a4-page'));

    // ---- content edit: visual editor | Markdown source (editor | preview) ----
    if (bar) {
      var eb = document.createElement('button');
      eb.className = 'btn btn-sm btn-secondary'; eb.type = 'button'; eb.setAttribute('data-dw-content-edit', '');
      eb.innerHTML = ico('M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z') + '<span data-i18n="dw.editContent">' + esc(t['dw.editContent'][0]) + '</span>';
      if (state === 'edit-pii' || new URLSearchParams(location.search).get('pii')) { eb.disabled = true; eb.title = T(P + 'editPii'); }
      bar.insertBefore(eb, bar.firstChild);
      var pane = null, raw = false, dirty = false, md = '';
      var toMd = function () { return pages.map(function (p) { return Array.prototype.map.call(p.querySelectorAll('h1,h2,p,table'), function (n) { var x = n.textContent.trim(); return n.tagName === 'H1' ? '# ' + x : n.tagName === 'H2' ? '## ' + x : n.tagName === 'TABLE' ? '| … |' : x; }).join('\n\n'); }).join('\n\n<!-- page 2 -->\n\n'); };
      var render = function () {
        pane.innerHTML = '<div class="dw-toolbar" role="toolbar" aria-label="' + esc(T(P + 'markdownSource')) + '"><span class="grow"></span>' +
          '<button class="icon-btn" type="button" data-dw-raw aria-pressed="' + raw + '" aria-label="' + esc(T(P + 'markdownSource')) + '" title="' + esc(T(P + 'markdownSource')) + '">' + ico('M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16') + '</button>' +
          '<button class="icon-btn" type="button" data-dw-discard aria-label="' + esc(T(P + 'discard')) + '" title="' + esc(T(P + 'discard')) + '">' + ico('M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3') + '</button>' +
          '<button class="icon-btn" type="button" data-dw-save aria-label="' + esc(T('common.save')) + '" title="' + esc(T('common.save')) + '"' + (dirty ? '' : ' disabled') + '>' + ico('M5 12l5 5L20 7') + '</button></div>' +
          '<div class="dw-edit-body' + (raw ? ' is-source' : '') + '">' + (raw
            ? '<textarea class="dw-src" aria-label="' + esc(T(P + 'editorLabel')) + '">' + esc(md) + '</textarea><article class="a4-page md-body" aria-label="' + esc(T(P + 'preview')) + '">' + esc(md).replace(/\n/g, '<br>') + '</article>'
            : '<article class="a4-page md-body dw-visual" contenteditable="true" role="textbox" aria-multiline="true" aria-label="' + esc(T('dw.visualEditor')) + '">' + pages.map(function (p, i) { return (i ? '<span class="dw-page-chip" contenteditable="false">' + esc(T('dv.pageNofM', { n: i + 1, m: pages.length })) + '</span>' : '') + p.innerHTML.replace(/<span[^>]*class="page-no"[\s\S]*?<\/span>/, ''); }).join('') + '</article>') + '</div>';
        I.apply(pane);
      };
      var stop = function () { pane.remove(); pane = null; pages.forEach(function (p) { p.hidden = false; }); eb.hidden = false; };
      eb.addEventListener('click', function () {
        md = toMd(); raw = false; dirty = false;
        pane = document.createElement('div'); pane.className = 'dw-edit-pane';
        pages.forEach(function (p) { p.hidden = true; }); eb.hidden = true;
        doc.appendChild(pane); render();
      });
      doc.addEventListener('input', function (e) { if (pane && pane.contains(e.target) && !dirty) { dirty = true; pane.querySelector('[data-dw-save]').disabled = false; if (e.target.classList.contains('dw-src')) md = e.target.value; } });
      doc.addEventListener('click', function (e) {
        if (!pane) return;
        var b = e.target.closest('button'); if (!b || !pane.contains(b)) return;
        if (b.hasAttribute('data-dw-raw')) { var s = pane.querySelector('.dw-src'); if (s) md = s.value; raw = !raw; render(); }
        else if (b.hasAttribute('data-dw-discard')) { if (!dirty || confirm(T(P + 'discardTitle') + '\n' + T(P + 'discardBody'))) stop(); }
        else if (b.hasAttribute('data-dw-save')) { stop(); if (window.ECP_toast) window.ECP_toast(T(P + 'saved')); }
      });
    }

    // ---- chat over this document (side panel overlay) ----
    var head = side.querySelector('.art-head');
    if (head) {
      var cb = document.createElement('button');
      cb.className = 'icon-btn'; cb.type = 'button'; cb.innerHTML = ico('m15 6-6 6 6 6');
      cb.setAttribute('data-i18n-attr', 'aria-label:' + P + 'chatOpen;title:' + P + 'chatOpen');
      cb.setAttribute('aria-label', T(P + 'chatOpen')); cb.title = T(P + 'chatOpen');
      var act = head.querySelector('.art-head-actions') || head.appendChild(document.createElement('div'));
      act.classList.add('art-head-actions'); act.appendChild(cb);
      var chat = document.createElement('div'); chat.className = 'dw-chat'; chat.hidden = true;
      chat.setAttribute('role', 'region'); chat.setAttribute('aria-label', T(P + 'chatTitle'));
      var cite = function () { return '<ol class="dw-chat-cites"><li><button class="dw-chat-cite" type="button"><b>[1]</b> ' + esc(T(P + 'chatPage', { n: 1 })) + '<span class="muted">' + esc(T('dw.chatCite1')) + '</span></button></li></ol>'; };
      var qa = function (q, a, extra) { return '<div class="dw-chat-q">' + esc(T(q)) + '</div><div class="dw-chat-a">' + (extra || '') + '<p>' + bold(T(a)) + '</p>' + cite() + '</div>'; };
      var first = state === 'chat-hypothesis' ? qa('dw.chatQ2', 'dw.chatA2', '<p class="dw-chat-warn" role="status">' + esc(T(P + 'chatHypothesis')) + '</p>')
        : state === 'chat-noevidence' ? '<div class="dw-chat-q">' + esc(T('dw.chatQ2')) + '</div><div class="dw-chat-a">' + esc(T(P + 'chatNoEvidence')) + '</div>'
        : state === 'chat-error' ? '<div class="dw-chat-q">' + esc(T('dw.chatQ1')) + '</div><div class="dw-chat-a" role="alert">' + esc(T(P + 'chatError')) + '</div>' : '';
      chat.innerHTML = '<div class="dw-chat-head"><button class="icon-btn" type="button" data-dw-chat-close aria-label="' + esc(T(P + 'chatClose')) + '" title="' + esc(T(P + 'chatClose')) + '">' + ico('m9 6 6 6-6 6') + '</button><h2>' + esc(T(P + 'chatTitle')) + '</h2></div>' +
        '<div class="dw-chat-body" aria-live="polite">' + (first || '<p class="muted text-sm">' + esc(T(P + 'chatHint')) + '</p>') + '</div>' +
        '<form class="dw-chat-input"><label class="sr-only" for="dw-chat-q">' + esc(T('common.question')) + '</label><textarea id="dw-chat-q" class="input" rows="2" placeholder="' + esc(T(P + 'chatPlaceholder')) + '"></textarea>' +
        '<button class="icon-btn" type="submit" aria-label="' + esc(T(P + 'chatSend')) + '" title="' + esc(T(P + 'chatSend')) + '">' + ico('M5 12h14M13 6l6 6-6 6') + '</button></form>';
      side.appendChild(chat);
      var body = chat.querySelector('.dw-chat-body');
      cb.addEventListener('click', function () { chat.hidden = false; chat.querySelector('textarea').focus(); });
      chat.addEventListener('click', function (e) { if (e.target.closest('[data-dw-chat-close]')) { chat.hidden = true; cb.focus(); } });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !chat.hidden) { chat.hidden = true; cb.focus(); } });
      chat.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var ta = chat.querySelector('textarea'), q = ta.value.trim(); if (!q) return;
        if (!first) body.innerHTML = '';
        body.insertAdjacentHTML('beforeend', '<div class="dw-chat-q">' + esc(q) + '</div><div class="dw-chat-a"><p>' + bold(T('dw.chatA1')) + '</p>' + cite() + '</div>');
        ta.value = ''; body.scrollTop = body.scrollHeight;
      });
    }
    I.apply(document);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
