/* ECP mockups: Gửi duyệt dialog for manual document changes (document-workspace.html).
 * ECP_CRSubmit.open({ target, changes: [{ type: content | meta, current, proposed | fields }], onDone(ids) })
 * creates one change request per kind of change through ECP_CR.submit(), which validates and stores it.
 * - Change summary: required, one per request (it becomes the list title).
 * - Reason for change: required, shared by the requests of one submission. Drafts are kept by the editor and need none.
 * - Evidence & sources: optional, several items, each a document of the same KB (ECP_CR.sourcesOf) with a location and/or
 *   an excerpt; the document's current version is captured on submit. No upload or outside link: there is no backend for them. */
(function () {
  var CR = window.ECP_CR, KB = window.ECP_KB;
  if (!CR || !KB) return;
  var T = CR.T, esc = KB.esc, d = null, cfg = null, ev = [];
  function $(s) { return d.querySelector(s); }

  function changeLabel(c) {
    if (c.type === 'meta') return T('cs.metaChg', { f: Object.keys(c.fields).map(CR.fieldLabel).join(', ') });
    var n = 0; c.proposed.forEach(function (l, i) { if (l !== c.current[i]) n++; }); n += Math.abs(c.proposed.length - c.current.length);
    return T('cs.contentChg', { n: Math.max(n, 1) });
  }
  function evRow(e, i, srcs) {
    return '<li class="cs-ev" data-i="' + i + '"><div class="cs-evg">' +
      '<label class="sr-only" for="cs-src-' + i + '">' + esc(T('cs.evDoc')) + '</label><select class="select" id="cs-src-' + i + '" data-k="src"><option value="">' + esc(T('cs.evPick')) + '</option>' +
      srcs.map(function (s) { return '<option value="' + s.key + '"' + (e.src === s.key ? ' selected' : '') + '>' + esc(s.name) + ' · ' + esc(s.code) + ' · ' + esc(s.ver) + '</option>'; }).join('') + '</select>' +
      '<label class="sr-only" for="cs-loc-' + i + '">' + esc(T('ca2.ev.loc')) + '</label><input class="input" id="cs-loc-' + i + '" data-k="loc" value="' + esc(e.loc) + '" placeholder="' + esc(T('cs.evLocPh')) + '">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-ev-del="' + i + '">' + esc(T('cs.evDel')) + '</button></div>' +
      '<label class="sr-only" for="cs-q-' + i + '">' + esc(T('ca2.ev.quote')) + '</label><textarea class="textarea" id="cs-q-' + i + '" data-k="quote" rows="2" placeholder="' + esc(T('cs.evQuotePh')) + '">' + esc(e.quote) + '</textarea>' +
      '<p class="field-err" id="cs-ev-err-' + i + '" hidden></p></li>';
  }
  function renderEv() {
    var srcs = CR.sourcesOf(CR.target(cfg.target).kb);
    $('#cs-evl').innerHTML = ev.map(function (e, i) { return evRow(e, i, srcs); }).join('');
    $('#cs-evnone').hidden = !!ev.length;
  }
  function render() {
    var t = CR.target(cfg.target), kb = KB.get(t.kb);
    d.innerHTML = '<form method="dialog" novalidate><h2 id="cs-t">' + esc(T('cs.title')) + '</h2>' +
      '<p class="muted">' + esc(T('cs.lead', { d: t.name, kb: kb ? kb.name : t.kb, v: t.ver })) + '</p>' +
      cfg.changes.map(function (c, i) {
        return '<fieldset class="cs-grp"><legend><span class="chip ca2-type ca2-t-' + c.type + '">' + esc(T('ca2.ty.' + c.type)) + '</span> ' + esc(changeLabel(c)) + '</legend>' +
          '<label for="cs-sum-' + i + '">' + esc(T('cs.sum')) + ' <span class="ca2-req" aria-hidden="true">*</span></label>' +
          '<input class="input" id="cs-sum-' + i + '" data-sum="' + i + '" maxlength="80" aria-required="true" aria-describedby="cs-sum-h-' + i + ' cs-sum-err-' + i + '" value="' + esc(c.summary || '') + '" placeholder="' + esc(T(c.type === 'meta' ? 'cs.sumPhMeta' : 'cs.sumPh')) + '">' +
          '<p class="cs-hint muted" id="cs-sum-h-' + i + '">' + esc(T('cs.sumHint')) + ' <span data-count="' + i + '">' + (c.summary || '').length + '/80</span></p>' +
          '<p class="field-err" id="cs-sum-err-' + i + '" hidden></p></fieldset>';
      }).join('') +
      '<label for="cs-reason">' + esc(T('ca2.reasonH')) + ' <span class="ca2-req" aria-hidden="true">*</span></label>' +
      '<textarea class="textarea" id="cs-reason" rows="3" aria-required="true" aria-describedby="cs-reason-h cs-reason-err" placeholder="' + esc(T('cs.reasonPh')) + '"></textarea>' +
      '<p class="cs-hint muted" id="cs-reason-h">' + esc(T('cs.reasonHint')) + '</p><p class="field-err" id="cs-reason-err" hidden></p>' +
      '<fieldset class="cs-evs"><legend>' + esc(T('ca2.evH')) + ' <span class="muted">' + esc(T('cs.optional')) + '</span></legend>' +
      '<p class="cs-hint muted">' + esc(T('cs.evHint')) + '</p><ul class="cs-evl" id="cs-evl"></ul><p class="muted" id="cs-evnone">' + esc(T('ca2.evNone')) + '</p>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-ev-add>' + esc(T('cs.evAdd')) + '</button></fieldset>' +
      '<p class="field-err" id="cs-form-err" role="alert" hidden></p>' +
      '<div class="ca2-dlgf"><button class="btn btn-secondary" value="cancel" formnovalidate>' + esc(T('ca2.h.cancel')) + '</button><button class="btn btn-primary" value="ok">' + esc(T(cfg.changes.length > 1 ? 'cs.goN' : 'cs.go', { n: cfg.changes.length })) + '</button></div></form>';
    renderEv();
  }
  function err(id, msg, field) {
    var p = $('#' + id); p.textContent = msg || ''; p.hidden = !msg;
    if (field) { if (msg) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid'); }
    return !!msg;
  }
  function submit(e) {
    if (!e.submitter || e.submitter.value !== 'ok') return;
    e.preventDefault();
    var reason = $('#cs-reason').value, first = null, list = ev.filter(function (x) { return x.src || x.loc.trim() || x.quote.trim(); });
    cfg.changes.forEach(function (c, i) {
      c.summary = $('#cs-sum-' + i).value;
      var bad = CR.validateSubmit({ summary: c.summary, reason: reason, evidence: [] });
      if (err('cs-sum-err-' + i, bad.summary, $('#cs-sum-' + i)) && !first) first = $('#cs-sum-' + i);
    });
    var bad = CR.validateSubmit({ summary: 'x', reason: reason, evidence: list });
    if (err('cs-reason-err', bad.reason, $('#cs-reason')) && !first) first = $('#cs-reason');
    ev.forEach(function (x, i) {
      var k = list.indexOf(x), m = k === -1 ? '' : bad['ev' + k], f = $('#cs-src-' + i);
      if (err('cs-ev-err-' + i, m, f) && !first) first = x.src ? $('#cs-loc-' + i) : f;
    });
    if (first) { first.focus(); return; }
    var ids = [], fail = '';
    cfg.changes.forEach(function (c) {
      if (fail) return;
      var o = { type: c.type, target: cfg.target, summary: c.summary, reason: reason, evidence: list, current: c.current };
      if (c.type === 'content') o.proposed = c.proposed; else o.fields = c.fields;
      var res = CR.submit(o);
      if (res.ok) ids.push(res.id); else fail = Object.keys(res.errors).map(function (k) { return res.errors[k]; }).join(' ');
    });
    if (fail) { err('cs-form-err', fail); return; }
    d.close();
    if (cfg.onDone) cfg.onDone(ids);
  }
  function build() {
    d = document.createElement('dialog');
    d.className = 'ca2-dlg cs-dlg'; d.id = 'cs-dlg'; d.setAttribute('aria-labelledby', 'cs-t');
    document.body.appendChild(d);
    d.addEventListener('submit', submit);
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ev-add], [data-ev-del]'); if (!b) return;
      if (b.hasAttribute('data-ev-add')) { ev.push({ src: '', loc: '', quote: '' }); renderEv(); $('#cs-src-' + (ev.length - 1)).focus(); }
      else { ev.splice(+b.getAttribute('data-ev-del'), 1); renderEv(); $('[data-ev-add]').focus(); }
    });
    d.addEventListener('input', function (e) {
      var t = e.target, li = t.closest('.cs-ev');
      if (li && t.getAttribute('data-k')) ev[+li.getAttribute('data-i')][t.getAttribute('data-k')] = t.value;
      if (t.hasAttribute('data-sum')) $('[data-count="' + t.getAttribute('data-sum') + '"]').textContent = t.value.length + '/80';
    });
    d.addEventListener('change', function (e) { var t = e.target, li = t.closest('.cs-ev'); if (li && t.getAttribute('data-k') === 'src') ev[+li.getAttribute('data-i')].src = t.value; });
  }
  window.ECP_CRSubmit = {
    open: function (o) {
      if (!d) build();
      cfg = o; ev = [];
      // a metadata request gets a starting summary built from the fields it changes; content needs the person's words
      cfg.changes.forEach(function (c) { if (c.type === 'meta' && !c.summary) c.summary = T('cr.t.meta', { f: Object.keys(c.fields).map(CR.fieldLabel).join(', ') }); });
      render();
      d.showModal(); $('#cs-sum-0').focus();
    }
  };
})();
