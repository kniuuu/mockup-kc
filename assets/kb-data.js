/* ECP mockups: Knowledge Base mock data + the shared KB pieces used by Knowledge Overview (Grid + List), Create / Edit KB,
 * KB detail and Document detail.
 * - Data: people, approval-permission types (the ones the Create KB "Owners & permissions" step configures), KBs, documents.
 * - Prototype state: edits, deactivation and delegations are kept in this browser only (localStorage ecp-kb-mock);
 *   nothing is sent to a server. ?mock=reset clears it.
 * - Rendering: status tags (Suggest / Pending / Error / Unverified / Processing, only when the count > 0, count in the tooltip),
 *   KB status Active / Inactive (the only two KB states; the tags above are work items, not states),
 *   taxonomy tags via ECP_TAXONOMY.tagHtml, KB card (grid) and row (list).
 * - Access: current user per mock role (owner = Nguyễn Lan, steward = Trần Hải, admin = System Admin). */
(function () {
  var I = window.ECP_I18N || null;
  var T = (I && I.tr) || function (k, v, a) { return String(v).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); };
  var TAXO = window.ECP_TAXONOMY;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function attrArgs(o) { return esc(JSON.stringify(o)); }

  // ---------- data (sample content stays Vietnamese) ----------
  var PEOPLE = {
    nl: ['Nguyễn Lan', 'lan.nguyen@msb.com.vn'], vd: ['Vũ Đức', 'duc.vu@msb.com.vn'], dh: ['Đặng Hà', 'ha.dang@msb.com.vn'],
    pm: ['Phạm Minh', 'minh.pham@msb.com.vn'], hv: ['Hoàng Vy', 'vy.hoang@msb.com.vn'], bt: ['Bùi Thu', 'thu.bui@msb.com.vn'],
    th: ['Trần Hải', 'hai.tran@msb.com.vn'], pl: ['Phan Linh', 'linh.phan@msb.com.vn'], tm: ['Tạ Mai', 'mai.ta@msb.com.vn'],
    la: ['Lê Anh', 'anh.le@msb.com.vn'], dk: ['Đỗ Khoa', 'khoa.do@msb.com.vn'], nq: ['Ngô Quân', 'quan.ngo@msb.com.vn'],
    nh: ['Nguyễn Thị Hà', 'ha.nguyen@msb.com.vn'], tt: ['Trần Minh Tuấn', 'tuan.tran@msb.com.vn']
  };
  function initials(name) { var w = name.split(/\s+/); return (w[0][0] + w[w.length - 1][0]).toUpperCase(); }
  // Approval permissions the Owner holds; the System Admin's delegation policy (kb.approval) says which of them the Owner may delegate.
  var PERMS = [
    { id: 'evolution', key: 'kbc.approveEvolution', vi: 'Duyệt evolution' },
    { id: 'changes', key: 'kbc.approveChanges', vi: 'Duyệt thay đổi' },
    { id: 'agent', key: 'kbc.approveChangesFromAgent', vi: 'Duyệt thay đổi từ Agent' }
  ];
  var STATUS = [
    { id: 'suggest', chip: 'chip-info', vi: 'Đề xuất', tip: ['{n} đề xuất cập nhật schema', '1 đề xuất cập nhật schema'] },
    { id: 'pending', chip: 'chip-warning', vi: 'Chờ duyệt', tip: ['{n} thay đổi chờ duyệt', '1 thay đổi chờ duyệt'] },
    { id: 'error', chip: 'chip-error', vi: 'Lỗi', tip: ['{n} văn bản lỗi xử lý', '1 văn bản lỗi xử lý'] },
    // AI-made taxonomy / ontology values of the KB not verified yet (approved in Changes & Approval; open them in Taxonomy / Ontology)
    { id: 'unverified', chip: 'chip-neutral ecp-st-outline', vi: 'Unverified', tip: ['{n} giá trị taxonomy/ontology chưa xác minh', '1 giá trị taxonomy/ontology chưa xác minh'] },
    { id: 'processing', chip: 'chip-neutral', vi: 'Đang xử lý', tip: ['{n} văn bản đang xử lý', '1 văn bản đang xử lý'] }
  ];
  // approval: delegable approval permissions, the System Admin's policy for the KB (no screen edits it in this mockup);
  // stewardAgent: Admin let every Steward approve Agent changes at creation (an independent grant, untouched by delegation).
  // delegations: one record per Steward; a revoked record is kept (revoked, revokedAt, revokedBy) as history.
  // srcs: Source Paths (one KB has several paths; one path may belong to several KBs, see the shared s3://ecp-landing/tuan-thu/chung/).
  // pii: PII restriction of the KB: false = off, [] = on for every type, [types] = on for those types (PII_TYPES).
  // pkgs: requested Knowledge Package types (Create / Edit KB step 4); both default in get().
  // verifyTracked: lifecycle flag set when the KB is created with verification tracking (new KBs only). Its AI-made taxonomy and
  // ontology objects start Unverified and turn Verified only through Changes & Approval (ECP_CR.verification). Existing KBs have none.
  var KBS = [
    // retail demo KBs (documents in demo-msb-data.js), with 'card' right after them
    { id: 'deposit-khcn', name: 'Sản phẩm tiền gửi KHCN', desc: 'Biểu lãi suất, cẩm nang sản phẩm tiết kiệm, biểu phí và quy định mở tài khoản thanh toán cho khách hàng cá nhân.',
      srcs: ['s3://ecp-landing/nhbl/tien-gui/'], ver: 'v1.2', owners: ['pm'], stewards: ['la'],
      tags: [['DEPOSIT_PRODUCT', 'Tiết kiệm có kỳ hạn'], ['DEPOSIT_PRODUCT', 'Tiền gửi thanh toán'], ['CUST_SEG', 'KH Cá nhân']],
      counts: {}, updated: '2026-10-15T12:10', approval: ['changes', 'agent'], stewardAgent: true, delegations: [] },
    { id: 'unsecured-digital', name: 'Tín dụng không TSBĐ kênh số', desc: 'Quy định Gói giải pháp tín dụng không tài sản bảo đảm trên kênh số cho KHCN và các quyết định sửa đổi, bổ sung.',
      srcs: ['s3://ecp-landing/kcds/tin-chap/'], ver: 'v1.1', owners: ['nl'], stewards: ['th'],
      tags: [['LOAN_TYPE', 'Vay tiêu dùng tín chấp'], ['CUST_SEG', 'KH Cá nhân'], ['DOC_TYPE', 'Quy định']],
      counts: { suggest: 1 }, updated: '2026-10-15T13:50', approval: ['changes', 'agent'], stewardAgent: false, delegations: [] },
    { id: 'card', name: 'Sản phẩm thẻ tín dụng', desc: 'Thông tin sản phẩm, biểu phí, ưu đãi và quy trình phát hành thẻ tín dụng cá nhân.',
      srcs: ['s3://ecp-landing/the/tin-dung/'], ver: 'v3.0', owners: ['pm'], stewards: ['la'],
      tags: [['CARD_PRODUCT', 'Thẻ tín dụng cá nhân'], ['BIZ_BLOCK', 'Khối Khách hàng cá nhân'], ['DOC_TYPE', 'Biểu phí']],
      counts: { pending: 2, unverified: 6 }, updated: '2026-10-15T11:05', approval: ['changes', 'agent'], stewardAgent: true, delegations: [], verifyTracked: true },
    { id: 'credit-corp', name: 'Quy trình tín dụng doanh nghiệp', desc: 'Bộ quy trình, quy định và hướng dẫn thẩm định cấp tín dụng cho khách hàng doanh nghiệp lớn và SME.',
      srcs: ['s3://ecp-landing/tin-dung/khdn/', 's3://ecp-landing/tuan-thu/chung/'], ver: 'v2.3', owners: ['nl'], stewards: ['th', 'tt', 'nh'],
      tags: [['BIZ_BLOCK', 'Khối Khách hàng doanh nghiệp'], ['PROCESS', 'Thẩm định tín dụng'], ['RISK', 'Rủi ro tín dụng']],
      counts: { suggest: 1, pending: 3 }, updated: '2026-10-15T12:30', approval: ['changes', 'agent'], stewardAgent: true, pii: ['national_id', 'account_no', 'phone'],
      delegations: [
        { id: 'dl-1', steward: 'th', perms: ['changes'], active: true, by: 'nl', at: '2026-10-02T09:10' },
        { id: 'dl-2', steward: 'tt', perms: ['changes', 'agent'], active: true, by: 'nl', at: '2026-09-18T15:40', revoked: true, revokedAt: '2026-10-10T11:00', revokedBy: 'nl' }
      ] },
    { id: 'core-banking', name: 'Hướng dẫn Core Banking', desc: 'Tài liệu vận hành hệ thống Core Banking T24: giao dịch, tham số sản phẩm và xử lý sự cố.',
      srcs: ['s3://ecp-landing/van-hanh/core-banking/'], ver: 'v4.2', owners: ['vd'], stewards: ['pl', 'tm'],
      tags: [['DOC_TYPE', 'Hướng dẫn'], ['DEPOSIT_PRODUCT', 'Tiền gửi thanh toán']],
      counts: { pending: 5, error: 2 }, updated: '2026-10-15T09:30', approval: ['evolution', 'changes', 'agent'], stewardAgent: false,
      delegations: [{ id: 'dl-3', steward: 'pl', perms: ['agent'], active: true, by: 'vd', at: '2026-09-30T10:00' }] },
    { id: 'faq-digital', name: 'FAQ Ngân hàng số', desc: 'Câu hỏi thường gặp về MSB mBank, eKYC, chuyển tiền và bảo mật tài khoản trực tuyến.',
      srcs: ['s3://ecp-landing/digital/faq/'], ver: 'v2.0', owners: ['dh'], stewards: ['tm'],
      tags: [['DEPOSIT_PRODUCT', 'Tiết kiệm online'], ['CUST_SEG', 'KH Cá nhân']],
      counts: { suggest: 1 }, updated: '2026-10-15T08:15', approval: ['changes'], stewardAgent: false, delegations: [] },
    { id: 'kyc-aml', name: 'Chính sách KYC/AML', desc: 'Quy định nhận biết khách hàng, phòng chống rửa tiền và tài trợ khủng bố áp dụng toàn hệ thống.',
      srcs: ['s3://ecp-landing/tuan-thu/kyc-aml/', 's3://ecp-landing/tuan-thu/chung/'], ver: 'v5.1', owners: ['hv', 'nl', 'pm'], stewards: ['dk', 'th', 'la', 'nq'],
      tags: [['RISK', 'Rủi ro tuân thủ'], ['DEPARTMENT', 'Phòng Pháp chế']],
      counts: { error: 1, processing: 5 }, updated: '2026-10-12T10:05', approval: ['evolution', 'changes'], stewardAgent: false, delegations: [] },
    { id: 'hr', name: 'Quy định nhân sự', desc: 'Nội quy lao động, chính sách lương thưởng, nghỉ phép và đào tạo dành cho cán bộ nhân viên.',
      srcs: ['s3://ecp-landing/nhan-su/'], ver: 'v1.4', owners: ['bt'], stewards: ['nq'],
      tags: [['DOC_TYPE', 'Quy định'], 'Nhân sự'],
      counts: {}, updated: '2026-10-08T09:00', approval: ['changes'], stewardAgent: false, pii: false, delegations: [] }
  ];
  var PII_TYPES = ['name', 'phone', 'email', 'customer_code', 'national_id', 'passport', 'account_no', 'dob', 'address'];
  // Document detail tags: Classification → Loại văn bản, Language → Ngôn ngữ (both from the taxonomy), plus the KB tags it carries
  var DOCS = {
    'qd-tdkhdn': { kb: 'credit-corp', tags: [['DOC_TYPE', 'Quy định'], ['LANGUAGE', 'Tiếng Việt'], ['BIZ_BLOCK', 'Khối Khách hàng doanh nghiệp'], ['PROCESS', 'Thẩm định tín dụng']] }
  };
  var NOW_ISO = '2026-10-15T14:30', NOW = new Date(NOW_ISO); // mock "now", matches the relative times used across the mockups

  // ---------- prototype state (this browser only) ----------
  var KEY = 'ecp-kb-mock';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  try { if (new URLSearchParams(location.search).get('mock') === 'reset') localStorage.removeItem(KEY); } catch (e) {}
  var STATE = load();
  function base(id) { for (var i = 0; i < KBS.length; i++) if (KBS[i].id === id) return KBS[i]; return null; }
  function get(id) {
    var b = base(id); if (!b) return null;
    var kb = JSON.parse(JSON.stringify(b)), o = STATE[id] || {};
    for (var k in o) kb[k] = o[k];
    if (o.src && !o.srcs) kb.srcs = [o.src]; // state saved before multi-path
    delete kb.src;
    if (kb.active === undefined) kb.active = true;
    if (kb.pii === undefined) kb.pii = [];
    if (!kb.pkgs) kb.pkgs = ['gwiki', 'sop', 'pwiki', 'concept'];
    return kb;
  }
  // keeps the rules that must survive any edit: delegations only for current Stewards and only for delegable permissions
  function clean(kb) {
    kb.delegations = (kb.delegations || []).map(function (d) {
      d.perms = d.perms.filter(function (p) { return kb.approval.indexOf(p) !== -1; });
      return d;
    }).filter(function (d) { return d.perms.length && kb.stewards.indexOf(d.steward) !== -1; });
    return kb;
  }
  function save(id, patch) {
    var kb = get(id); if (!kb) return null;
    for (var k in patch) kb[k] = patch[k];
    clean(kb);
    var o = STATE[id] || {};
    ['name', 'desc', 'srcs', 'tags', 'owners', 'stewards', 'approval', 'stewardAgent', 'active', 'delegations', 'counts', 'pii', 'pkgs'].forEach(function (f) { o[f] = kb[f]; });
    STATE[id] = o;
    try { localStorage.setItem(KEY, JSON.stringify(STATE)); } catch (e) { return null; }
    return kb;
  }
  function all() { return KBS.map(function (b) { return get(b.id); }); }
  // KBs other than `except` whose Source Paths include `path`
  function sharedWith(path, except) { return all().filter(function (kb) { return kb.id !== except && kb.srcs.indexOf(path) !== -1; }); }

  // ---------- current user + access ----------
  var ROLE_USER = { owner: 'nl', steward: 'th' };
  function role() { return document.documentElement.getAttribute('data-role') || 'owner'; }
  function me() { return ROLE_USER[role()] || null; }
  var can = {
    edit: function (kb) { var r = role(); return r === 'admin' || (r === 'owner' && kb.owners.indexOf(me()) !== -1) || (r === 'steward' && kb.stewards.indexOf(me()) !== -1); },
    // Edit KB screen (kb-create.html?edit=): System Admin or an Owner of the KB; the ⋯ menu still offers Edit per can.edit
    editKb: function (kb) { var r = role(); return r === 'admin' || (r === 'owner' && kb.owners.indexOf(me()) !== -1); },
    deactivate: function (kb) { var r = role(); return r === 'admin' || (r === 'owner' && kb.owners.indexOf(me()) !== -1); },
    editOwners: function () { return role() === 'admin'; },
    editStewards: function (kb) { return role() === 'admin' || (role() === 'owner' && kb.owners.indexOf(me()) !== -1); },
    editApproval: function () { return role() === 'admin'; },
    // ⋯ › Ủy quyền duyệt (MANAGE_APPROVAL_DELEGATION): System Admin or an Owner of the KB
    manageDelegation: function (kb) { var r = role(); return r === 'admin' || (r === 'owner' && kb.owners.indexOf(me()) !== -1); },
    // document.create: System Admin, Owner and Steward of the KB, Active KBs only
    upload: function (kb) { return kb.active && can.edit(kb); }
  };

  // ---------- rendering ----------
  function statusList(kb) { var c = kb.counts || {}; return STATUS.filter(function (s) { return c[s.id] > 0; }); }
  function statusKeys(kb) { var l = statusList(kb).map(function (s) { return s.id; }); if (!l.length) l.push('clear'); if (!kb.active) l.push('inactive'); return l.join(' '); }
  function statusTags(kb) {
    var c = kb.counts || {};
    return statusList(kb).map(function (s) {
      var n = c[s.id], one = n === 1, k = 'kbst.' + s.id + 'Tip' + (one ? '1' : '');
      return '<span class="chip ecp-st ecp-st-' + s.id + ' ' + s.chip + '" data-ecp-tip tabindex="0" data-i18n="kbst.' + s.id + '"' +
        ' data-i18n-attr="title:' + k + '" data-i18n-args="' + attrArgs({ n: n }) + '" title="' + esc(T(k, one ? s.tip[1] : s.tip[0], { n: n })) + '">' + esc(T('kbst.' + s.id, s.vi)) + '</span>';
    }).join('');
  }
  function inactiveChip() { return '<span class="chip chip-neutral ecp-inactive" data-i18n="kbst.inactive">' + esc(T('kbst.inactive', 'Ngừng hoạt động')) + '</span>'; }
  function tagsHtml(kb, opts) { return (kb.tags || []).map(function (t) { return TAXO.tagHtml(t, opts); }).join(''); }
  // role label + first person + "+N" (full list in the tooltip)
  function people(ids, label, av2, compact) {
    var first = PEOPLE[ids[0]] || ['–'], rest = ids.slice(1).map(function (i) { return (PEOPLE[i] || [i])[0]; });
    var more = rest.length ? '<span class="chip chip-neutral ecp-more" data-ecp-tip tabindex="0" title="' + esc(rest.join(', ')) + '">+' + rest.length + '</span>' : '';
    var nm = '<span class="person-n" title="' + esc(first[0]) + '">' + esc(first[0]) + '</span>'; // long names end in "…"
    if (compact) return '<span class="person" data-i18n-skip><span class="sr-only">' + label + ': </span><span class="av' + (av2 ? ' av-2' : '') + '" aria-hidden="true">' + esc(initials(first[0])) + '</span>' + nm + more + '</span>';
    return '<span class="person" data-i18n-skip><span class="av' + (av2 ? ' av-2' : '') + '" aria-hidden="true">' + esc(initials(first[0])) + '</span>' +
      '<span class="person-txt"><span class="muted">' + label + '</span><span class="person-name">' + nm + more + '</span></span></span>';
  }
  function relTime(iso) {
    var d = new Date(iso), lang = I && I.lang === 'en' ? 'en' : 'vi', rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    var day = function (x) { return Math.floor(new Date(x.getFullYear(), x.getMonth(), x.getDate()) / 864e5); };
    var dd = day(NOW) - day(d);
    if (dd === 0) { var h = Math.round((NOW - d) / 36e5); return h < 1 ? rtf.format(0, 'minute') : rtf.format(-h, 'hour'); }
    return dd < 7 ? rtf.format(-dd, 'day') : rtf.format(-Math.round(dd / 7), 'week');
  }
  function absTime(iso) { var d = new Date(iso); return I && I.fmtDate ? I.fmtDate(d) + ' ' + I.fmtDate(d, { hour: '2-digit', minute: '2-digit' }) : iso; }
  // [data-kb-rel="<iso>"]: "Cập nhật 2 giờ trước" (data-kb-rel-pre) or "2 giờ trước", re-written on language change
  function fmtRel(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-kb-rel]'), function (el) {
      var iso = el.getAttribute('data-kb-rel'), t = relTime(iso);
      if (el.hasAttribute('data-kb-rel-pre')) t = T('kbm.updatedX', 'Cập nhật {t}', { t: I && I.lang === 'en' ? t : t.charAt(0).toLowerCase() + t.slice(1) });
      el.textContent = t;
      el.setAttribute('title', absTime(iso));
    });
  }
  if (I) I.onChange(function () { fmtRel(); });
  var ICO_DOTS = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';
  function actBtn(kb) {
    return '<button class="icon-btn ek-act-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="ek-row-menu" aria-labelledby="ek-act-lbl kbn-' + kb.id + '">' + ICO_DOTS + '</button>';
  }
  function detailHref(kb) { return 'ek-knowledge-detail.html?kb=' + encodeURIComponent(kb.id); }
  function itemAttrs(el, kb) {
    el.setAttribute('data-kb', kb.id); el.setAttribute('data-name', kb.name);
    el.setAttribute('data-owner', kb.owners.join(' ')); el.setAttribute('data-steward', kb.stewards.join(' '));
    el.setAttribute('data-tags', (kb.tags || []).map(function (t) { return TAXO.toCode(typeof t === 'string' ? t : t[1]); }).join(' '));
    el.setAttribute('data-status', statusKeys(kb)); el.setAttribute('data-updated', kb.updated);
    el.classList.toggle('is-inactive', !kb.active);
  }
  function fillCard(el, kb) {
    itemAttrs(el, kb);
    el.innerHTML = '<div class="kb-head"><h2 class="kb-name" data-i18n-skip><a class="kb-link" id="kbn-' + kb.id + '" href="' + detailHref(kb) + '" title="' + esc(kb.name) + '">' + esc(kb.name) + '</a></h2>' + actBtn(kb) + '</div>' +
      '<p class="kb-desc clamp-2" data-i18n-skip>' + esc(kb.desc) + '</p>' +
      ((kb.tags || []).length ? '<div class="row-wrap kb-tags">' + tagsHtml(kb) + '</div>' : '') + // left out when there are no tags
      '<div class="people">' + people(kb.owners, 'Owner') + people(kb.stewards, 'Steward', true) + '</div>' +
      ((kb.active ? '' : inactiveChip()) + statusTags(kb) ? '<div class="badges kb-status">' + (kb.active ? '' : inactiveChip()) + statusTags(kb) + '</div>' : '') + // left out when there is no status
      '<div class="kb-foot"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg><span class="grow"><time datetime="' + kb.updated + '" data-kb-rel="' + kb.updated + '" data-kb-rel-pre></time></span>' +
        // web: the version chip is green on an active KB, neutral on an inactive one
        '<span class="chip ' + (kb.active ? 'chip-success' : 'chip-neutral') + ' kb-ver" data-ecp-tip tabindex="0" data-i18n-attr="title:ek.stActive" title="' + esc(T('ek.stActive', 'Đang hiệu lực')) + '">' + esc(kb.ver) + '</span></div>';
    fmtRel(el);
  }
  function fillRow(tr, kb) {
    itemAttrs(tr, kb);
    var tags = kb.tags || [], shown = tags.slice(0, 2), rest = tags.slice(2);
    var more = rest.length ? '<span class="chip chip-neutral ecp-more" data-ecp-tip tabindex="0" data-i18n-skip title="' + esc(rest.map(function (t) { return TAXO.tipText(t) || (typeof t === 'string' ? t : t[1]); }).join(', ')) + '">+' + rest.length + '</span>' : '';
    tr.innerHTML = '<td class="ek-ck"><input type="checkbox" data-ek-check aria-labelledby="ek-sel-lbl kbn-' + kb.id + '"></td>' +
      '<td class="t-name"><a id="kbn-' + kb.id + '" data-i18n-skip href="' + detailHref(kb) + '" class="bold" title="' + esc(kb.name) + '">' + esc(kb.name) + '</a></td>' +
      '<td class="c-tags"><div class="ek-tags">' + (shown[0] ? TAXO.tagHtml(shown[0]) : '<span class="muted">—</span>') + (shown[1] ? '<span class="ek-tag-line">' + TAXO.tagHtml(shown[1]) + more + '</span>' : '') + '</div></td>' +
      '<td class="c-ver"><div class="ek-ver"><span class="kb-ver">' + esc(kb.ver) + '</span></div></td>' +
      '<td class="c-owner"><div class="ek-people">' + people(kb.owners, 'Owner', false, true) + '</div></td>' +
      '<td class="c-steward"><div class="ek-people">' + people(kb.stewards, 'Steward', true, true) + '</div></td>' +
      '<td class="nowrap muted c-upd"><time datetime="' + kb.updated + '" data-kb-rel="' + kb.updated + '"></time></td>' +
      '<td class="ek-act">' + actBtn(kb) + '</td>';
    fmtRel(tr);
  }
  // Tags and status are left out of a card that has none; a row is kept only when a shown card needs it, so the
  // sections line up across the cards and no empty row adds a gap (row numbers go to .kb-grid as custom properties).
  function gridRows(grid) {
    var cards = Array.prototype.filter.call(grid.querySelectorAll('.kb-card'), function (c) { return !c.hidden; });
    var tags = cards.some(function (c) { return c.querySelector('.kb-tags'); }), status = cards.some(function (c) { return c.querySelector('.kb-status'); });
    var people = tags ? 4 : 3, statusRow = people + 1, foot = statusRow + (status ? 1 : 0);
    grid.style.setProperty('--kb-rows', foot); grid.style.setProperty('--kb-r-people', people);
    grid.style.setProperty('--kb-r-status', statusRow); grid.style.setProperty('--kb-r-foot', foot);
  }
  function card(kb) { var a = document.createElement('article'); a.className = 'card kb-card'; a.setAttribute('data-i18n-skip', ''); fillCard(a, kb); return a; }
  function row(kb) { var tr = document.createElement('tr'); fillRow(tr, kb); return tr; }
  function personOpt(id, av2) {
    var p = PEOPLE[id];
    return '<li><label><input type="checkbox" data-ek-opt value="' + id + '"><span class="av' + (av2 ? ' av-2' : '') + '" aria-hidden="true" data-i18n-skip>' + esc(initials(p[0])) + '</span><span class="ek-otext" data-i18n-skip>' + esc(p[0]) + '</span></label></li>';
  }
  // Overview: cards / rows and the Owner, Steward, Tag filter options, all from the same data
  function renderOverview() {
    var kbs = all(), grid = document.querySelector('[data-kb-render="grid"]'), tbody = document.querySelector('[data-kb-render="list"]');
    if (grid) kbs.forEach(function (kb) { grid.appendChild(card(kb)); });
    if (tbody) kbs.forEach(function (kb) { tbody.appendChild(row(kb)); });
    function uniq(f) { var seen = {}, out = []; kbs.forEach(function (kb) { f(kb).forEach(function (x) { var k = typeof x === 'string' ? x : x[1]; if (!seen[k]) { seen[k] = 1; out.push(x); } }); }); return out; }
    var own = document.querySelector('#fp-owner .ek-opts'), stw = document.querySelector('#fp-steward .ek-opts'), tag = document.querySelector('#fp-tag .ek-opts');
    if (own) own.innerHTML = uniq(function (kb) { return kb.owners; }).map(function (id) { return personOpt(id); }).join('');
    if (stw) stw.innerHTML = uniq(function (kb) { return kb.stewards; }).map(function (id) { return personOpt(id, true); }).join('');
    if (tag) tag.innerHTML = uniq(function (kb) { return kb.tags; }).map(function (t) {
      var n = typeof t === 'string' ? t : t[1];
      return '<li><label><input type="checkbox" data-ek-opt value="' + TAXO.toCode(n) + '"><span class="ek-otext">' + TAXO.tagHtml(t).replace(' tabindex="0"', '') + '</span></label></li>';
    }).join('');
    if (I) [grid, tbody, own, stw, tag].forEach(function (x) { if (x) I.apply(x); });
  }

  // ---------- shared confirm dialog + toast ----------
  function confirmDlg(o) {
    var d = document.getElementById('ecp-confirm');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'ecp-confirm'; d.className = 'q-dialog ecp-confirm'; d.setAttribute('aria-labelledby', 'kcc-t'); d.setAttribute('aria-describedby', 'kcc-b');
      d.innerHTML = '<form method="dialog"><h2 id="kcc-t"></h2><p class="qd-body" id="kcc-b"></p><div class="qd-foot"><button value="cancel" class="btn btn-secondary" data-kcc-cancel></button><button value="ok" class="btn btn-danger" data-kcc-ok></button></div></form>';
      document.body.appendChild(d);
      d.addEventListener('close', function () { var f = d.__kcDone; d.__kcDone = null; if (f) f(d.returnValue === 'ok'); });
    }
    d.querySelector('#kcc-t').textContent = o.title;
    d.querySelector('#kcc-b').textContent = o.body;
    d.querySelector('[data-kcc-cancel]').textContent = T('common.cancel', 'Hủy');
    var ok = d.querySelector('[data-kcc-ok]'); ok.textContent = o.ok; ok.className = 'btn ' + (o.danger === false ? 'btn-primary' : 'btn-danger');
    d.returnValue = '';
    d.__kcDone = function (yes) { if (yes) o.onOk(); if (o.focus && o.focus.isConnected) o.focus.focus(); };
    d.showModal();
    d.querySelector('[data-kcc-cancel]').focus();
  }
  function toast(msg) {
    if (window.ECP_toast) { window.ECP_toast(msg); return; }
    var t = document.getElementById('q-toast');
    if (!t) { t = document.createElement('div'); t.id = 'q-toast'; t.className = 'q-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.hidden = false; t.textContent = msg;
    clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, 4000);
  }

  // "PII restriction" value: Tắt / Bật · mọi loại / Bật · <types>
  // VI label from the kbe.piiT.* dictionary (tr returns the given fallback in vi)
  function piiType(x) { var k = 'kbe.piiT.' + x; return T(k, (I && I.dict.vi[k]) || x); }
  function piiLabel(pii) {
    if (!pii) return T('kbe.piiOff', 'Tắt');
    if (!pii.length) return T('kbe.piiAll', 'Bật · mọi loại');
    return T('kbe.piiSome', 'Bật · {types}', { types: pii.map(piiType).join(', ') });
  }
  // toast after Edit KB returns here: ?saved=<kb> (changes saved) or ?denied=<kb> (no edit right)
  function flash() {
    var u = new URLSearchParams(location.search), msg = u.get('saved') ? T('kbe.saved', 'Đã lưu thay đổi của tri thức') : u.get('denied') ? T('kbe.editNoPerm', 'Chỉ Owner của tri thức hoặc System Admin được chỉnh sửa') : '';
    if (!msg) return;
    u.delete('saved'); u.delete('denied');
    try { history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u.toString() : '') + location.hash); } catch (e) {}
    setTimeout(function () { toast(msg); }, 0); // after screens.js has set up ECP_toast
  }

  // ---------- on load: overview cards / rows ([data-kb-render]) and Document detail tags ([data-doc-tags]) ----------
  // runs before screens.js / ek-overview.js handlers, which read the rendered items
  document.addEventListener('DOMContentLoaded', function () {
    if (document.querySelector('[data-kb-render]')) renderOverview();
    if (!document.querySelector('.wz')) flash();
    Array.prototype.forEach.call(document.querySelectorAll('[data-doc-tags]'), function (dd) {
      var doc = DOCS[dd.getAttribute('data-doc-tags')]; if (!doc) return;
      dd.innerHTML = doc.tags.map(function (t) { return TAXO.tagHtml(t, { full: true }); }).join(' ');
    });
  });

  // ---------- ADR-007 taxonomy / ontology presets (KB create step 3 "Governance", KB detail "Đổi preset") ----------
  // versions NEWEST FIRST; a preset with no published version is not choosable (left out of every select).
  // counts: ontology { e: entity types, r: relationships, tr: triples }, taxonomy { g: tag groups, v: tags }
  var PRESETS = {
    ontology: [
      { id: 'ont-global', name: 'Global', global: true, counts: { e: 24, r: 31, tr: 58 },
        versions: [{ v: 12, sum: 'Thêm quan hệ “bảo lãnh cho”' }, { v: 11, sum: 'Tách loại entity Khoản vay' }, { v: 10, sum: '' }] },
      { id: 'ont-tddn', name: 'Tín dụng doanh nghiệp', counts: { e: 28, r: 36, tr: 66 },
        versions: [{ v: 3, sum: 'Thêm Hạn mức theo ngành' }, { v: 2, sum: '' }, { v: 1, sum: 'Nhân bản từ Global v11' }] },
      { id: 'ont-retail', name: 'Bán lẻ (đang soạn)', counts: null, versions: [] }
    ],
    taxonomy: [
      { id: 'tax-global', name: 'Global', global: true, counts: { g: 9, v: 37 },
        versions: [{ v: 4, sum: 'Thêm nhóm tag Rủi ro' }, { v: 3, sum: '' }, { v: 2, sum: '' }] },
      { id: 'tax-retail', name: 'Khối Bán lẻ', counts: { g: 6, v: 22 }, versions: [{ v: 2, sum: 'Thêm sản phẩm thẻ' }, { v: 1, sum: '' }] },
      { id: 'tax-test', name: 'Taxonomy thử nghiệm', counts: null, versions: [] }
    ]
  };
  // the preset a KB uses (Global latest unless kb.presets says otherwise): { id, name, version, latest }
  var KB_PRESETS = { 'credit-corp': { ontology: ['ont-tddn', 3], taxonomy: ['tax-global', 3] } };
  function presetOf(kb, kind) {
    var pin = (KB_PRESETS[kb.id] || {})[kind], list = PRESETS[kind];
    var p = list.filter(function (x) { return pin ? x.id === pin[0] : x.global; })[0];
    return { id: p.id, name: p.name, version: pin ? pin[1] : p.versions[0].v, latest: p.versions[0].v };
  }

  window.ECP_KB = {
    PEOPLE: PEOPLE, PERMS: PERMS, DOCS: DOCS, PII_TYPES: PII_TYPES, piiLabel: piiLabel, piiType: piiType, get: get, all: all, save: save, base: base, sharedWith: sharedWith,
    person: function (id) { return PEOPLE[id] ? { id: id, name: PEOPLE[id][0], email: PEOPLE[id][1], ini: initials(PEOPLE[id][0]) } : null; },
    idByName: function (name) { for (var k in PEOPLE) if (PEOPLE[k][0] === name) return k; return null; },
    role: role, me: me, can: can,
    statusTags: statusTags, tagsHtml: tagsHtml, people: people, fillCard: fillCard, gridRows: gridRows, fillRow: fillRow, renderOverview: renderOverview,
    detailHref: detailHref, fmtRel: fmtRel, confirm: confirmDlg, toast: toast, esc: esc,
    PRESETS: PRESETS, presetOf: presetOf,
    choosable: function (kind) { return PRESETS[kind].filter(function (p) { return p.versions.length; }); }
  };
})();
