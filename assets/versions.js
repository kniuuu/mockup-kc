/* ECP mockups · version registry for the version history & diff popup (ecp-version-diff).
 * window.ECP_VERSIONS[id] = component definition read by assets/version-diff.js (window.ECPVH):
 *   { name, restore: { rolesDisable, reason } | false,
 *     sections: [{ id, label, kind: 'text'|'fields'|'list', code?, src?, fields?: [[key,label]], cols?: [[key,label]] }],
 *     versions: [ NEWEST FIRST { v, status, by, at, sum, cr, data?: { sectionId: value }, undo?: { textSectionId: [[newerStr, olderStr], …] },
 *                 patch?: { fieldsSectionId: { set: {k:v}, del: [k] }, listSectionId: { del: [id], set: { id: {col:v} }, add: [{ …item, at: index }], order: [id…] } } } ] }
 *   text: the newest version reads `src` (textarea.defaultValue / element.textContent) unless it carries data; each older version
 *   applies its `undo` pairs to the next newer text (newerStr must occur exactly once). fields / list: `data` (full snapshot) or `patch`.
 * Sample content stays Vietnamese (user content); labels are translated by vi-text lookup (ECP_I18N.tv) when a vi DICT entry exists. */
(function () {
  var V = window.ECP_VERSIONS = window.ECP_VERSIONS || {};

  // status keys → vi labels (engine translates via vh.st.<key>)
  window.ECP_VH_STATUS = {
    draft: 'Draft', pending: 'Chờ duyệt', active: 'Đang hiệu lực', published: 'Đã xuất bản', superseded: 'Đã thay thế', rollback: 'Rollback'
  };

  /* Metadata-only document history (used by FEAT-003).
   * docMeta(title, verList, lastStatus): verList is OLDEST → NEWEST; each entry is 'v1.2' or
   * { v, by, at, sum, cr, eff, pages, checksum, sync }. Missing values are derived deterministically from the index. */
  window.ECP_VH_docMeta = function (title, verList, lastStatus) {
    var list = (verList || []).map(function (x) { return typeof x === 'string' ? { v: x } : x; });
    var n = list.length, out = [];
    list.forEach(function (x, i) {
      var newest = i === n - 1, day = 10 + i * 4, mon = 3 + i * 2;
      var dd = (day < 10 ? '0' : '') + day, mm = (mon < 10 ? '0' : '') + mon;
      var at = x.at || (dd + '/' + mm + '/2026 · 09:' + (10 + i * 7));
      var stKey = newest ? (lastStatus || 'active') : 'superseded';
      var fields = {
        ver: x.v,
        st: window.ECP_VH_STATUS[stKey] || stKey,
        eff: x.eff || (dd + '/' + mm + '/2026'),
        pages: String(x.pages || (12 + i * 3)),
        checksum: x.checksum || ('sha256:' + ('9f3c' + (i * 7919 + n * 104729).toString(16)).slice(0, 10) + '…'),
        sync: x.sync || at,
        by: x.by || ['Trần Hải', 'Phạm Minh', 'Nguyễn Lan', 'Lê Thu'][i % 4]
      };
      out.unshift({ v: x.v, status: stKey, by: fields.by, at: at, sum: x.sum || (i ? 'Cập nhật văn bản nguồn' : 'Đồng bộ lần đầu'), cr: x.cr || '', data: { meta: fields } });
    });
    return {
      name: title,
      restore: false,
      sections: [{ id: 'meta', label: 'Metadata', kind: 'fields', fields: [['ver', 'Phiên bản'], ['st', 'Trạng thái'], ['eff', 'Ngày hiệu lực'], ['pages', 'Số trang'], ['checksum', 'Checksum'], ['sync', 'Đồng bộ lúc'], ['by', 'Người cập nhật']] }],
      versions: out
    };
  };

  /* ===== Package Templates (config-templates.html) ===== */
  // as the web app: title = template name, sections Skill + Mục lục (ToC) (Có / —), no restore
  var TPL_RESTORE = false;
  var SETTINGS = [['toc', 'Mục lục (ToC)']];
  function prompt(src) { return { id: 'prompt', label: 'Skill', kind: 'text', code: true, src: src }; }
  function settings() { return { id: 'settings', label: 'Mục lục (ToC)', kind: 'fields', fields: SETTINGS }; }
  function base(over) {
    var o = { toc: 'Có', temp: '0.2', top_p: '0.9', format: 'JSON', locale: 'vi-VN', cite: '[Sn] · chunk_id', pii: 'Bật' };
    for (var k in over) o[k] = over[k];
    return o;
  }

  V['tpl-faq'] = {
    name: 'FAQ',
    restore: TPL_RESTORE,
    sections: [prompt('#faq-prompt'), settings()],
    versions: [
      { v: 'v3', status: 'active', by: 'Trần Huy', at: '02/08/2026 · 10:20', sum: 'Chuẩn hoá trích dẫn [Sn] theo chunk_id; FAQ là danh sách phẳng', cr: 'CR-029',
        data: { settings: base({ toc: '—', maxItems: '40' }) } },
      { v: 'v2', status: 'superseded', by: 'Phạm Minh', at: '14/06/2026 · 15:05', sum: 'Thêm quy tắc che PII; temperature 0.3 → 0.2', cr: 'CR-021',
        undo: { prompt: [
          ['2. Trích dẫn: mọi khẳng định gắn nhãn [S1], [S2]… ứng với chunk_id trong nguồn. Không có nguồn thì không viết.', '2. Trích dẫn: ghi tên văn bản và số trang ở cuối câu trả lời. Không có nguồn thì không viết.'],
          ['\n10. FAQ không có section/mục lục: package là danh sách phẳng các cặp hỏi – đáp.', ''],
          ['4. Viết câu trả lời ≤ 120 từ, đi thẳng vào ý chính; mỗi ý gắn [Sn].', '4. Viết câu trả lời ≤ 120 từ, đi thẳng vào ý chính; ghi nguồn ở cuối câu trả lời.'],
          ['- Mọi [Sn] đều tồn tại trong {{source_chunks}} và chunk đó thực sự chứa nội dung được trích.', '- Mọi trích dẫn đều có tên văn bản và số trang khớp nguồn.']
        ] },
        patch: { settings: { set: { cite: 'Tên văn bản · số trang', maxItems: '30' } } } },
      { v: 'v1', status: 'superseded', by: 'Trần Huy', at: '03/03/2026 · 09:00', sum: 'Phiên bản đầu tiên', cr: '',
        undo: { prompt: [
          ['\n6. PII: không chép CMND/CCCD, số tài khoản, số thẻ, SĐT, email, tên khách hàng; thay bằng ***.', ''],
          ['7. Bảo mật:', '6. Bảo mật:'],
          ['8. Thuật ngữ:', '7. Thuật ngữ:'],
          ['9. Nguồn không đủ', '8. Nguồn không đủ'],
          ['\n- Không có PII chưa che; không nâng mức bảo mật.', ''],
          ['temperature 0.2', 'temperature 0.3']
        ] },
        patch: { settings: { set: { temp: '0.3', pii: 'Tắt' }, del: ['maxItems'] } } }
    ]
  };

  V['tpl-sop'] = {
    name: 'SOP',
    restore: TPL_RESTORE,
    sections: [prompt('#sop-prompt'), settings()],
    versions: [
      { v: 'v4', status: 'active', by: 'Lê Thu', at: '21/09/2026 · 14:10', sum: 'Giữ thứ tự bước theo nguồn; bước phê duyệt nêu đúng cấp thẩm quyền', cr: 'CR-024',
        data: { settings: base({ maxItems: '20' }) } },
      { v: 'v3', status: 'superseded', by: 'Trần Huy', at: '08/07/2026 · 11:30', sum: 'Đánh số lại bước khi thêm/bớt; action bắt đầu bằng động từ', cr: 'CR-018',
        undo: { prompt: [
          ['\n10. Không gộp hay đảo thứ tự bước nếu nguồn quy định thứ tự; bước phê duyệt phải nêu đúng cấp thẩm quyền trong nguồn.', ''],
          ['\n- Bước có phê duyệt nêu cấp thẩm quyền đúng như nguồn.', '']
        ] } },
      { v: 'v2', status: 'superseded', by: 'Lê Thu', at: '19/04/2026 · 16:45', sum: 'Thêm SLA escalation và điểm kiểm soát cho từng bước', cr: 'CR-011',
        undo: { prompt: [
          ['\n5. Đánh số lại no nếu có bước thêm/bớt, nhưng giữ id bước.', ''],
          ['- Tối đa {{max_items}} bước; action bắt đầu bằng động từ.', '- Tối đa {{max_items}} bước.']
        ] },
        patch: { settings: { set: { maxItems: '15' } } } },
      { v: 'v1', status: 'superseded', by: 'Trần Huy', at: '02/02/2026 · 10:00', sum: 'Phiên bản đầu tiên', cr: '',
        undo: { prompt: [
          ['4. Ghi đầu vào/đầu ra, SLA, điểm kiểm soát – phê duyệt và ngoại lệ cho từng bước.', '4. Ghi đầu vào/đầu ra và SLA cho từng bước.'],
          ['- sla để [THIẾU THÔNG TIN] nếu nguồn không quy định.', '- sla bắt buộc cho mọi bước.'],
          ['2. Liệt kê vai trò tham gia (ví dụ: GDV, KSV, CVQHKH) đúng tên trong nguồn.', '2. Liệt kê vai trò tham gia.']
        ] },
        patch: { settings: { set: { temp: '0.3' } } } }
    ]
  };

  V['tpl-general-wiki'] = {
    name: 'General Wiki',
    restore: TPL_RESTORE,
    sections: [prompt('#gw-prompt'), settings()],
    versions: [
      { v: 'v2', status: 'active', by: 'Trần Huy', at: '14/07/2026 · 09:15', sum: 'Dàn ý 4–8 section theo logic; heading dùng danh từ', cr: 'CR-022',
        data: { settings: base({ maxItems: '8' }) } },
      { v: 'v1', status: 'superseded', by: 'Phạm Minh', at: '11/03/2026 · 13:40', sum: 'Phiên bản đầu tiên', cr: '',
        undo: { prompt: [
          ['1. Đọc chunk, lập dàn ý 4–8 section theo logic: tổng quan → chi tiết → lưu ý → tham chiếu.', '1. Đọc chunk, lập dàn ý 3–6 section.'],
          ['- summary ≤ 60 từ, không chứa số liệu chưa trích dẫn.', '- summary ≤ 80 từ.'],
          ['\n- Heading dùng danh từ, không trùng nhau.', '']
        ] },
        patch: { settings: { set: { maxItems: '6' } } } }
    ]
  };

  // Product Wiki: panels product-wiki / pending / invalid share this id. v3 = Draft submitted as CR-032 (pending panel).
  // Outline mirrors the pending panel's section list (ol.tpl-sections): v3 adds "Tài sản bảo đảm" and moves "Câu hỏi thường gặp" after "Rủi ro".
  function sec(id, title, req) { return { id: id, title: title, req: req }; }
  V['tpl-product-wiki'] = {
    name: 'Product Wiki',
    restore: TPL_RESTORE,
    sections: [
      prompt('#pw-prompt'),
      settings()
    ],
    versions: [
      { v: 'v3', status: 'pending', by: 'Phạm Minh', at: '25/09/2026 · 10:05', sum: 'Thêm section Tài sản bảo đảm; FAQ chuyển xuống sau Rủi ro', cr: 'CR-032',
        data: {
          outline: [
            sec('pw-tong-quan', 'Tổng quan sản phẩm', 'Có'),
            sec('pw-doi-tuong', 'Đối tượng khách hàng & điều kiện', 'Có'),
            sec('pw-han-muc', 'Hạn mức, lãi suất & phí', 'Có'),
            sec('pw-ho-so', 'Hồ sơ & quy trình', 'Có'),
            sec('pw-tsbd', 'Tài sản bảo đảm', 'Tùy chọn'),
            sec('pw-rui-ro', 'Rủi ro & lưu ý tuân thủ', 'Có'),
            sec('pw-faq', 'Câu hỏi thường gặp', 'Tùy chọn'),
            sec('pw-nguon', 'Nguồn tham chiếu', 'Tự sinh · khóa')
          ],
          settings: base({ maxItems: '8', secCount: '8' })
        } },
      { v: 'v2', status: 'active', by: 'Phạm Minh', at: '18/05/2026 · 09:40', sum: 'Bảng lãi suất / phí bắt buộc effective_date; FAQ thành tùy chọn', cr: 'CR-016',
        undo: { prompt: [
          ['theo 8 section chuẩn', 'theo 7 section chuẩn'],
          ['2. Viết 8 section: Tổng quan sản phẩm; Đối tượng KH & điều kiện; Hạn mức, lãi suất & phí; Hồ sơ & quy trình; Tài sản bảo đảm; Rủi ro & lưu ý tuân thủ; Câu hỏi thường gặp; Nguồn tham chiếu.',
           '2. Viết 7 section: Tổng quan sản phẩm; Đối tượng KH & điều kiện; Hạn mức, lãi suất & phí; Hồ sơ & quy trình; Câu hỏi thường gặp; Rủi ro & lưu ý tuân thủ; Nguồn tham chiếu.'],
          ['- Đúng 8 section theo thứ tự trên.', '- Đúng 7 section theo thứ tự trên.'],
          ['- Đủ 8 section, đúng thứ tự.', '- Đủ 7 section, đúng thứ tự.']
        ] },
        data: {
          outline: [
            sec('pw-tong-quan', 'Tổng quan sản phẩm', 'Có'),
            sec('pw-doi-tuong', 'Đối tượng khách hàng & điều kiện', 'Có'),
            sec('pw-han-muc', 'Hạn mức, lãi suất & phí', 'Có'),
            sec('pw-ho-so', 'Hồ sơ & quy trình', 'Có'),
            sec('pw-faq', 'Câu hỏi thường gặp', 'Tùy chọn'),
            sec('pw-rui-ro', 'Rủi ro & lưu ý tuân thủ', 'Có'),
            sec('pw-nguon', 'Nguồn tham chiếu', 'Tự sinh · khóa')
          ],
          settings: base({ maxItems: '7', secCount: '7' })
        } },
      { v: 'v1', status: 'superseded', by: 'Trần Huy', at: '09/02/2026 · 14:20', sum: 'Phiên bản đầu tiên', cr: '',
        undo: { prompt: [
          ['\n10. Bảng lãi suất / phí phải có effective_date và trích dẫn từng dòng.', ''],
          ['\n- Không có lãi suất/phí nào thiếu effective_date.', ''],
          ['Đối tượng KH & điều kiện;', 'Điều kiện vay;']
        ] },
        patch: {
          outline: { set: { 'pw-doi-tuong': { title: 'Điều kiện vay' }, 'pw-faq': { req: 'Có' } } },
          settings: { set: { temp: '0.3', pii: 'Tắt' } }
        } }
    ]
  };

  function single(name, src) {
    return {
      name: name, restore: TPL_RESTORE, sections: [prompt(src), settings()],
      versions: [{ v: 'v1', status: 'active', by: 'Trần Huy', at: '05/06/2026 · 08:30', sum: 'Phiên bản đầu tiên', cr: '', data: { settings: base({}) } }]
    };
  }
  V['tpl-playbook'] = single('Playbook', '#pb-prompt');
  V['tpl-troubleshooting'] = single('Troubleshooting', '#ts-prompt');
  V['tpl-concept-glossary'] = single('Concept & Glossary', '#cg-prompt');
  V['tpl-product-wiki-the'] = single('Product Wiki – Thẻ', '#pwt-prompt');

  /* ===== Ontology Global (config-ontology.html #os-version, quality-change-request.html CR-031) =====
   * relations: built from the RELTYPES R(...) rows of config-ontology.html (entity group keys → GROUPS[k].n labels);
   * "thế chấp" (r-thechap) is the v4 relation that CR-031 deprecates in favour of "bảo đảm cho".
   * schema: v4 / v5 text equals the CR-031 page .q-diff lines (gap placeholder lines excluded). */
  var OC = { kh: 'Khách hàng', acc: 'Tài khoản & Giao dịch', cre: 'Tín dụng', legal: 'Pháp lý & Tuân thủ', ops: 'Vận hành', risk: 'Rủi ro' };
  var OL = { core: 'Core', kb: 'KB' };
  var OO = { tddn: 'Tín dụng doanh nghiệp', the: 'Thẻ' };
  var OS = { active: 'Active', draft: 'Draft', deprecated: 'Deprecated' };
  function rel(id, name, s, t, card, inv, layer, owner, status) {
    return { id: id, title: name, name: name, from: OC[s], to: OC[t], card: card, inv: inv,
      layer: OL[layer] + (owner ? ' · ' + (OO[owner] || owner) : ''), status: OS[status || 'active'] || status };
  }
  var SCHEMA_V4 = [
    'entity_types:',
    '  Product:   { props: [tên, mã, hạn mức] }',
    '  Customer:  { props: [tên, loại KH, mã KH] }',
    'relationships:',
    '  thế chấp: { from: Customer, to: Product }',
    '  áp dụng:   { from: Policy, to: Product }'
  ];
  var SCHEMA_V5 = [
    'entity_types:',
    '  Product:   { props: [tên, mã, hạn mức (đơn vị: VND)] }',
    '  Customer:  { props: [tên, loại KH, mã KH] }',
    '  Collateral: { props: [loại tài sản, giá trị định giá, ngày định giá] }',
    'relationships:',
    '  thế chấp: { deprecated: true, alias_of: bảo đảm cho }',
    '  bảo đảm cho: { from: Collateral, to: Product, card: 1..n }',
    '  áp dụng:   { from: Policy, to: Product }'
  ];
  var SCHEMA_V6 = SCHEMA_V5.concat([
    '  phát sinh rủi ro: { from: Product, to: Risk, card: n..n }',
    '  là entity kèm: { from: Product, to: Product, card: n..n, kb: Tín dụng doanh nghiệp }'
  ]);
  var SCHEMA_V3 = SCHEMA_V4.filter(function (l) { return l.indexOf('áp dụng:') < 0; });
  V['ontology-global'] = {
    name: 'Ontology Global',
    restore: { rolesDisable: 'owner consumer', reason: 'Chỉ Steward hoặc Admin được rollback ontology' },
    sections: [
      { id: 'relations', label: 'Loại quan hệ', kind: 'list',
        cols: [['name', 'Quan hệ'], ['from', 'Từ'], ['to', 'Đến'], ['card', 'Bản số'], ['inv', 'Quan hệ ngược'], ['layer', 'Lớp'], ['status', 'Trạng thái']] },
      { id: 'schema', label: 'Schema (YAML)', kind: 'text', code: true }
    ],
    versions: [
      { v: 'v6', status: 'draft', by: 'Nguyễn Lan', at: '30/09/2026 · 16:40', sum: 'Đang sửa: thêm “phát sinh rủi ro”, “là entity kèm” (tri thức Tín dụng doanh nghiệp, CR-035)', cr: '',
        data: {
          relations: [
            rel('r-quydinh', 'được quy định bởi', 'cre', 'legal', 'n..n', 'quy định', 'core'),
            rel('r-apdung', 'áp dụng cho', 'cre', 'kh', 'n..n', 'sử dụng', 'core'),
            rel('r-thechap', 'thế chấp', 'kh', 'cre', 'n..n', 'được thế chấp bởi', 'core', null, 'Deprecated · alias_of: bảo đảm cho'),
            rel('r-thamdinh', 'được thẩm định bởi', 'cre', 'ops', 'n..1', 'thẩm định', 'kb', 'tddn'),
            rel('r-quytrinh', 'thực hiện qua', 'cre', 'ops', 'n..n', 'áp dụng cho entity', 'kb', 'tddn'),
            rel('r-baodam', 'được bảo đảm bởi', 'cre', 'cre', '1..n', 'bảo đảm cho', 'kb', 'tddn'),
            rel('r-phrr', 'phát sinh rủi ro', 'cre', 'risk', 'n..n', 'phát sinh từ', 'kb', 'tddn', 'draft'),
            rel('r-phathanh', 'phát hành bởi', 'cre', 'ops', 'n..1', 'phát hành', 'kb', 'tddn'),
            rel('r-chungtu', 'yêu cầu chứng từ', 'cre', 'acc', '1..n', 'là chứng từ của', 'kb', 'tddn'),
            rel('r-tuanthu', 'tuân thủ', 'ops', 'legal', 'n..n', 'được tuân thủ bởi', 'kb', 'the'),
            rel('r-quanly', 'quản lý bởi', 'acc', 'ops', 'n..1', 'quản lý', 'kb', 'the'),
            rel('r-gianlan', 'chịu rủi ro', 'acc', 'risk', 'n..n', 'đe dọa', 'kb', 'the'),
            rel('r-kem', 'là entity kèm', 'cre', 'cre', 'n..n', 'đi kèm', 'kb', 'tddn', 'draft')
          ],
          schema: SCHEMA_V6.join('\n')
        } },
      { v: 'v5', status: 'active', by: 'Trần Hải', at: '28/09/2026 · 09:15', sum: 'Thêm Collateral và “bảo đảm cho”; deprecate “thế chấp”; hạn mức có đơn vị VND', cr: 'CR-031',
        patch: { relations: { del: ['r-phrr', 'r-kem'] } },
        data: { schema: SCHEMA_V5.join('\n') } },
      { v: 'v4', status: 'superseded', by: 'Trần Hải', at: '20/03/2026 · 14:30', sum: 'Published · thêm quan hệ “áp dụng cho”', cr: 'CR-027',
        patch: { relations: { del: ['r-baodam'], set: { 'r-thechap': { status: 'Active' } } } },
        data: { schema: SCHEMA_V4.join('\n') } },
      { v: 'v3', status: 'superseded', by: 'Nguyễn Lan', at: '12/01/2026 · 10:00', sum: 'Bổ sung quan hệ KB Tín dụng doanh nghiệp và Thẻ', cr: 'CR-019',
        patch: { relations: { del: ['r-apdung'] } },
        data: { schema: SCHEMA_V3.join('\n') } }
    ]
  };

  /* ===== Knowledge assets (FEAT-003): KB config, documents, knowledge packages =====
   * Pages: ek-knowledge-detail(.html|-empty.html), document-workspace.html, wiki/faq/playbook-viewer.html, knowledge-value.html.
   * Newest version content mirrors what the page shows; older versions are derived with undo / patch. */
  var ST = window.ECP_VH_STATUS;

  /* --- KB "Quy trình tín dụng doanh nghiệp" (crumb badge v2.3 active) --- */
  function kd(id, title, ver) { return { id: id, title: title, ver: ver }; }
  // KB detail (FE artifact-history.tsx): Thuộc tính (version, change, by) + source documents; no restore; summary = change reason
  V['kb-tddn'] = {
    name: 'Quy trình tín dụng doanh nghiệp',
    restore: false,
    sections: [
      { id: 'meta', label: 'Thuộc tính', kind: 'fields', fields: [['ver', 'Phiên bản'], ['reason', 'Thay đổi'], ['by', 'Người cập nhật']] },
      { id: 'docs', label: 'Văn bản nguồn', kind: 'list', cols: [['title', 'Văn bản'], ['ver', 'Phiên bản']] }
    ],
    versions: [
      { v: 'v2.3', status: 'active', by: 'Nguyễn Lan', at: '02/10/2026 · 08:30', sum: 'Phê duyệt thay đổi',
        data: {
          meta: { ver: 'v2.3', reason: 'Phê duyệt thay đổi', by: 'Nguyễn Lan' },
          docs: [
            kd('doc-qd-tdkhdn', 'Quy định cấp tín dụng đối với KHDN', 'v2.3'),
            kd('doc-hd-vld', 'Hướng dẫn thẩm định hồ sơ vay vốn lưu động', 'v1.7'),
            kd('doc-qt-hdtd', 'Quy trình phê duyệt tín dụng cấp Hội đồng', 'v3.1'),
            kd('doc-dt-sme', 'Đào tạo: Sản phẩm tín dụng SME 2024', 'v3.0'),
            kd('doc-bb-hdtd', 'Biên bản họp HĐTD 09/2024 (scan)', 'v1.0'),
            kd('doc-mau-totrinh', 'Mẫu tờ trình đề xuất hạn mức', 'v2.0'),
            kd('doc-tt39', 'Thông tư 39/2016/TT-NHNN', 'v1.2'),
            kd('doc-pl02', 'Phụ lục 02: DN mới thành lập', 'v1.1'),
            kd('doc-xhtd', 'Bảng xếp hạng tín dụng nội bộ', 'v4.0'),
            kd('doc-dg-tsbd', 'Định giá tài sản bảo đảm', 'v1.3')
          ]
        } },
      { v: 'v2.2', status: 'superseded', by: 'Trần Hải', at: '18/08/2026 · 17:45', sum: 'Khôi phục phiên bản cũ',
        patch: { meta: { set: { ver: 'v2.2', reason: 'Khôi phục phiên bản cũ', by: 'Trần Hải' } },
          docs: { del: ['doc-xhtd'], set: { 'doc-qd-tdkhdn': { ver: 'v2.2' }, 'doc-qt-hdtd': { ver: 'v3.0' } } } } },
      { v: 'v2.1', status: 'superseded', by: 'Phạm Minh', at: '04/08/2026 · 10:10', sum: 'Tự động thêm file mới',
        patch: { meta: { set: { ver: 'v2.1', reason: 'Tự động thêm file mới', by: 'Phạm Minh' } } } },
      { v: 'v2.0', status: 'superseded', by: 'Nguyễn Lan', at: '12/05/2026 · 09:00', sum: 'Đổi gói tri thức',
        patch: { meta: { set: { ver: 'v2.0', reason: 'Đổi gói tri thức', by: 'Nguyễn Lan' } },
          docs: { del: ['doc-pl02'], set: { 'doc-qd-tdkhdn': { ver: 'v2.1' }, 'doc-mau-totrinh': { ver: 'v1.0' } } } } }
    ]
  };

  /* --- Documents: synced from the source system, restore happens at the source --- */
  var META_F = [['ver', 'Phiên bản'], ['st', 'Trạng thái'], ['eff', 'Ngày hiệu lực'], ['pages', 'Số trang'], ['checksum', 'Checksum'], ['sync', 'Đồng bộ lúc'], ['by', 'Người cập nhật']];
  // docFull(name, text, vers): vers NEWEST FIRST { v, status, by, at, sum, cr, eff, pages, ck, undo? }; text = newest clause text
  function docFull(name, text, vers) {
    return {
      name: name, restore: false,
      sections: [{ id: 'text', label: 'Nội dung điều khoản', kind: 'text' }, { id: 'meta', label: 'Metadata', kind: 'fields', fields: META_F }],
      versions: vers.map(function (x, i) {
        var o = { v: x.v, status: x.status, by: x.by, at: x.at, sum: x.sum, cr: x.cr || '',
          data: { meta: { ver: x.v, st: ST[x.status] || x.status, eff: x.eff, pages: x.pages, checksum: x.ck, sync: x.at, by: x.by } } };
        if (i === 0) o.data.text = text.join('\n'); else o.undo = { text: x.undo || [] };
        return o;
      })
    };
  }
  function docLite(id, title, list, last) { V[id] = window.ECP_VH_docMeta(title, list, last); }

  V['doc-qd-tdkhdn'] = docFull('Quy định cấp tín dụng đối với KHDN', [
    'Điều 8. Hạn mức tín dụng',
    '8.1. Mức hạn mức tín dụng tối đa cho doanh nghiệp SME không vượt quá 15% vốn tự có của ngân hàng và phải được Hội đồng tín dụng phê duyệt đối với khoản vượt ngưỡng.',
    '8.2. Giám đốc chi nhánh được phê duyệt khoản cấp tín dụng có tổng hạn mức đến 30 tỷ đồng/khách hàng.',
    '8.3. Khoản vượt thẩm quyền của Giám đốc chi nhánh trình Hội đồng tín dụng theo Phụ lục phân cấp thẩm quyền.',
    'Điều 9. Điều chỉnh hạn mức',
    '9.1. Việc điều chỉnh hạn mức trong kỳ được thực hiện khi khách hàng doanh nghiệp có biến động doanh thu trên 20% so với kỳ đánh giá gần nhất, kèm hồ sơ chứng minh.',
    '9.2. Hồ sơ điều chỉnh gồm: giấy đề nghị điều chỉnh hạn mức, báo cáo tài chính quý gần nhất, xếp hạng tín dụng nội bộ cập nhật.'
  ], [
    { v: 'v2.3', status: 'active', by: 'Trần Hải', at: '02/10/2026 · 08:15', sum: 'Điều 8.2: thẩm quyền Giám đốc chi nhánh 20 → 30 tỷ; Điều 9.2 bổ sung hồ sơ', cr: '', eff: '01/10/2026', pages: '24', ck: 'sha256:9f3c1a77e2…' },
    { v: 'v2.2', status: 'superseded', by: 'Nguyễn Lan', at: '15/04/2026 · 14:00', sum: 'Bổ sung Điều 8.3 trình Hội đồng tín dụng', cr: '', eff: '15/04/2026', pages: '22', ck: 'sha256:4b81d0c95f…',
      undo: [
        ['đến 30 tỷ đồng/khách hàng', 'đến 20 tỷ đồng/khách hàng'],
        ['9.2. Hồ sơ điều chỉnh gồm: giấy đề nghị điều chỉnh hạn mức, báo cáo tài chính quý gần nhất, xếp hạng tín dụng nội bộ cập nhật.', '9.2. Hồ sơ điều chỉnh gồm: giấy đề nghị điều chỉnh hạn mức và báo cáo tài chính quý gần nhất.']
      ] },
    { v: 'v2.1', status: 'superseded', by: 'Nguyễn Lan', at: '10/01/2026 · 09:20', sum: 'Ban hành lại theo Thông tư 39/2016', cr: '', eff: '10/01/2026', pages: '20', ck: 'sha256:07e6aa31bd…',
      undo: [
        ['\n8.3. Khoản vượt thẩm quyền của Giám đốc chi nhánh trình Hội đồng tín dụng theo Phụ lục phân cấp thẩm quyền.', ''],
        ['biến động doanh thu trên 20%', 'biến động doanh thu trên 30%']
      ] }
  ]);
  // Document Workspace history (FE document-history.tsx): metadata section only (no effective date), no restore, no note
  V['doc-qd-tdkhdn-dw'] = (function (d) {
    return { name: d.name, restore: false,
      sections: [{ id: 'meta', label: 'Metadata', kind: 'fields', fields: META_F.filter(function (f) { return f[0] !== 'eff'; }) }],
      versions: d.versions.map(function (x) { return { v: x.v, status: x.status, by: x.by, at: x.at, sum: x.sum, cr: '', data: { meta: x.data.meta } }; }) };
  })(V['doc-qd-tdkhdn']);
  V['doc-hd-vld'] = docFull('Hướng dẫn thẩm định hồ sơ vay vốn lưu động', [
    'Mục 1. Phạm vi và quy trình',
    '1.1. Áp dụng cho hồ sơ vay vốn lưu động của khách hàng doanh nghiệp lớn và SME.',
    '1.2. Quy trình gồm tiếp nhận, thẩm định, phê duyệt, giải ngân và giám sát sau giải ngân.',
    'Mục 2. Nội dung thẩm định',
    '2.1. Đánh giá năng lực pháp lý, tình hình tài chính 2 năm gần nhất và phương án sử dụng vốn.',
    '2.2. Xác định nhu cầu vốn lưu động theo vòng quay vốn và kế hoạch kinh doanh.',
    '2.3. Thời hạn thẩm định tối đa 5 ngày làm việc kể từ khi nhận đủ hồ sơ.'
  ], [
    { v: 'v1.7', status: 'active', by: 'Phạm Minh', at: '01/10/2026 · 16:20', sum: 'Thêm bước giám sát sau giải ngân; thời hạn thẩm định 7 → 5 ngày', cr: '', eff: '01/10/2026', pages: '16', ck: 'sha256:c2d94e10a8…' },
    { v: 'v1.5', status: 'superseded', by: 'Phạm Minh', at: '20/06/2026 · 11:05', sum: 'Cập nhật văn bản nguồn', cr: '', eff: '20/06/2026', pages: '14', ck: 'sha256:5a17f3b6e0…',
      undo: [
        ['1.2. Quy trình gồm tiếp nhận, thẩm định, phê duyệt, giải ngân và giám sát sau giải ngân.', '1.2. Quy trình gồm tiếp nhận, thẩm định, phê duyệt và giải ngân.'],
        ['\n2.2. Xác định nhu cầu vốn lưu động theo vòng quay vốn và kế hoạch kinh doanh.', ''],
        ['2.3. Thời hạn thẩm định tối đa 5 ngày', '2.2. Thời hạn thẩm định tối đa 7 ngày']
      ] }
  ]);
  V['doc-qt-hdtd'] = docFull('Quy trình phê duyệt tín dụng cấp Hội đồng', [
    'Điều 3. Thẩm quyền của Hội đồng tín dụng',
    '3.1. Hội đồng tín dụng phê duyệt khoản cấp tín dụng từ 30 tỷ đồng đến 50 tỷ đồng/khách hàng.',
    '3.2. Khoản trên 50 tỷ đồng trình Hội đồng tín dụng cấp 2.',
    'Điều 4. Họp và biểu quyết',
    '4.1. Phiên họp hợp lệ khi có tối thiểu 2/3 thành viên tham dự, trong đó có Chủ tịch hoặc người được ủy quyền.',
    '4.2. Quyết định được thông qua khi trên 50% thành viên dự họp biểu quyết tán thành.',
    '4.3. Biên bản họp được ký trong vòng 1 ngày làm việc và lưu trên hệ thống.'
  ], [
    { v: 'v3.1', status: 'pending', by: 'Trần Hải', at: '02/10/2026 · 09:40', sum: 'Ngưỡng Hội đồng 20 → 30 tỷ theo Điều 8.2; quy định ký biên bản', cr: '', eff: '—', pages: '12', ck: 'sha256:e81b44c07d…' },
    { v: 'v3.0', status: 'active', by: 'Nguyễn Lan', at: '03/03/2026 · 15:30', sum: 'Phiên bản hiệu lực', cr: '', eff: '03/03/2026', pages: '11', ck: 'sha256:31f0c9ad52…',
      undo: [
        ['từ 30 tỷ đồng đến 50 tỷ', 'từ 20 tỷ đồng đến 50 tỷ'],
        ['tối thiểu 2/3 thành viên', 'tối thiểu 1/2 thành viên'],
        ['\n4.3. Biên bản họp được ký trong vòng 1 ngày làm việc và lưu trên hệ thống.', '']
      ] }
  ]);
  V['doc-mau-totrinh'] = docFull('Mẫu tờ trình đề xuất hạn mức', [
    'TỜ TRÌNH ĐỀ XUẤT HẠN MỨC TÍN DỤNG',
    '1. Thông tin khách hàng: tên doanh nghiệp, mã số thuế, ngành nghề, xếp hạng tín dụng nội bộ.',
    '2. Nhu cầu cấp tín dụng: hạn mức đề xuất, mục đích, thời hạn, phương thức cấp.',
    '3. Đánh giá tài chính: doanh thu, lợi nhuận, dòng tiền 2 năm gần nhất.',
    '4. Tài sản bảo đảm: loại tài sản, giá trị định giá, tỷ lệ cho vay trên giá trị TSBĐ.',
    '5. Đề xuất của CVQHKH và ý kiến thẩm định.',
    '6. Cấp phê duyệt theo Quy định cấp tín dụng đối với KHDN (Điều 8.2).'
  ], [
    { v: 'v2.0', status: 'active', by: 'Lê Thu', at: '24/09/2026 · 10:00', sum: 'Thêm mục Tài sản bảo đảm và cấp phê duyệt', cr: '', eff: '24/09/2026', pages: '4', ck: 'sha256:0b6e2f9c13…' },
    { v: 'v1.0', status: 'superseded', by: 'Lê Thu', at: '15/02/2026 · 08:45', sum: 'Đồng bộ lần đầu', cr: '', eff: '15/02/2026', pages: '3', ck: 'sha256:a9c5170e4d…',
      undo: [
        ['tên doanh nghiệp, mã số thuế, ngành nghề, xếp hạng tín dụng nội bộ.', 'tên doanh nghiệp, mã số thuế, ngành nghề.'],
        ['\n4. Tài sản bảo đảm: loại tài sản, giá trị định giá, tỷ lệ cho vay trên giá trị TSBĐ.', ''],
        ['5. Đề xuất của CVQHKH', '4. Đề xuất của CVQHKH'],
        ['\n6. Cấp phê duyệt theo Quy định cấp tín dụng đối với KHDN (Điều 8.2).', '']
      ] }
  ]);
  docLite('doc-dt-sme', 'Đào tạo: Sản phẩm tín dụng SME 2024', ['v1.0', 'v2.0', 'v3.0']);
  docLite('doc-bb-hdtd', 'Biên bản họp HĐTD 09/2024 (scan)', ['v1.0']);
  docLite('doc-tt39', 'Thông tư 39/2016/TT-NHNN', ['v1.0', 'v1.1', 'v1.2']);
  docLite('doc-pl02', 'Phụ lục 02: DN mới thành lập', ['v1.0', 'v1.1']);
  docLite('doc-xhtd', 'Bảng xếp hạng tín dụng nội bộ', ['v3.0', 'v3.1', 'v4.0']);
  docLite('doc-qc-cvdn', 'Quy chế cho vay đối với khách hàng doanh nghiệp', ['v3.0', 'v3.2', 'v4.0']);
  docLite('doc-dm-hspl', 'Danh mục hồ sơ pháp lý khách hàng doanh nghiệp', ['v1.0', 'v2.0', 'v2.1']);
  docLite('doc-qd-ccln', 'Quy định cơ cấu lại thời hạn trả nợ', ['v1.0', 'v1.2', 'v1.4']);
  docLite('doc-dt-tdpa', 'Đào tạo: Thẩm định phương án kinh doanh', ['v1.0']);
  docLite('doc-mau-ktsv', 'Mẫu biên bản kiểm tra sau cho vay', ['v1.0', 'v2.0', 'v3.0']);
  docLite('doc-qd-ghnganh', 'Quy định giới hạn cấp tín dụng theo ngành', ['v1.0', 'v2.0']);
  docLite('doc-dg-tsbd', 'Định giá tài sản bảo đảm', ['v1.0', 'v1.2', 'v1.3']);
  // knowledge-value.html (artifacts proposed for archive / update)
  docLite('doc-motk-online', 'Hướng dẫn mở tài khoản thanh toán online (cũ)', [
    { v: 'v1', at: '10/02/2022 · 09:00', eff: '10/02/2022' }, { v: 'v2', at: '05/07/2022 · 14:10', eff: '05/07/2022' },
    { v: 'v3', at: '20/01/2023 · 10:30', eff: '20/01/2023' }, { v: 'v4', at: '14/11/2023 · 09:30', eff: '14/11/2023' }]);
  docLite('doc-ctp-2022', 'Quy định công tác phí 2022', [
    { v: 'v1', at: '05/01/2022 · 08:30', eff: '05/01/2022' }, { v: 'v2', at: '18/03/2022 · 15:00', eff: '18/03/2022' }]);

  /* --- Knowledge packages --- */
  var PKG_RESTORE = { rolesDisable: 'consumer', reason: 'Chỉ Owner, Steward hoặc Admin được khôi phục package' };
  function pkg(name, sections, versions) { return { name: name, restore: PKG_RESTORE, sections: sections, versions: versions }; }
  // Wiki: outline list + body text, both built from a section table W and an order per version
  var WIKI_SECS = [{ id: 'outline', label: 'Mục lục', kind: 'list', cols: [['title', 'Mục'], ['cite', 'Nguồn']] }, { id: 'body', label: 'Nội dung', kind: 'text' }];
  function wiki(W, order, over) {
    over = over || {};
    function g(id, k) { return over[id] && over[id][k] !== undefined ? over[id][k] : W[id][k]; }
    return {
      outline: order.map(function (id) { return { id: id, title: g(id, 't'), cite: g(id, 'c') }; }),
      body: order.map(function (id, i) { return (i + 1) + '. ' + g(id, 't') + '\n' + g(id, 'p'); }).join('\n')
    };
  }
  // FAQ: Q&A list
  var FAQ_SECS = [{ id: 'qa', label: 'Danh sách câu hỏi', kind: 'list', cols: [['q', 'Câu hỏi'], ['a', 'Câu trả lời'], ['topic', 'Chủ đề'], ['st', 'Trạng thái']] }];
  function qa(id, q, a, topic, st) { return { id: id, title: q, q: q, a: a, topic: topic, st: st || 'Đã duyệt' }; }
  // Playbook: step list
  var PB_SECS = [{ id: 'steps', label: 'Các bước', kind: 'list', cols: [['no', 'Bước'], ['title', 'Tên bước'], ['role', 'Vai trò'], ['sla', 'Thời hạn'], ['body', 'Nội dung']] }];
  function step(id, no, title, role, sla, body) { return { id: id, no: no, title: title, role: role, sla: sla, body: body }; }

  // wiki-viewer.html: v4 = the page (TOC .wiki-toc-link + section paragraphs, cite buttons as [n])
  var W_TD = {
    s1: { t: 'Tổng quan', c: '[1]', p: 'Quy trình cấp tín dụng KHDN mô tả các bước từ tiếp nhận nhu cầu tới giải ngân, áp dụng cho khách hàng doanh nghiệp lớn và SME [1].' },
    s2: { t: 'Điều kiện cấp tín dụng', c: '[1] [2]', p: 'Khách hàng có năng lực pháp lý, mục đích vay hợp pháp, phương án khả thi và xếp hạng tín dụng nội bộ từ BBB trở lên [1] [2].' },
    s3: { t: 'Hồ sơ đề nghị', c: '[2]', p: 'Giấy đề nghị vay vốn, báo cáo tài chính 2 năm gần nhất, phương án sử dụng vốn, giấy tờ pháp lý và hồ sơ tài sản bảo đảm [2].' },
    s4: { t: 'Thẩm định và phê duyệt', c: '[1]', p: 'Chuyên viên thẩm định đánh giá hồ sơ trong 3–5 ngày làm việc. Khoản dưới 5 tỷ do Giám đốc khối KHDN phê duyệt, từ 5 tỷ do Hội đồng tín dụng [1].' },
    s5: { t: 'Giải ngân và giám sát', c: '[3]', p: 'Giải ngân theo tiến độ phương án; định kỳ hằng quý rà soát tình hình tài chính và tài sản bảo đảm [3].' }
  };
  var TD_S4_OLD = { p: 'Chuyên viên thẩm định đánh giá hồ sơ trong 5–7 ngày làm việc. Khoản dưới 3 tỷ do Giám đốc khối KHDN phê duyệt, từ 3 tỷ do Hội đồng tín dụng [1].' };
  V['pkg-wiki-tdkhdn'] = pkg('Wiki: Quy trình cấp tín dụng KHDN', WIKI_SECS, [
    { v: 'v4', status: 'published', by: 'Nguyễn Lan', at: '01/10/2026 · 17:20', sum: 'Cập nhật thời hạn và ngưỡng phê duyệt mục Thẩm định và phê duyệt', cr: '',
      data: wiki(W_TD, ['s1', 's2', 's3', 's4', 's5']) },
    { v: 'v3', status: 'superseded', by: 'Trần Hải', at: '14/08/2026 · 10:05', sum: 'Đưa Điều kiện cấp tín dụng lên trước Hồ sơ đề nghị; bổ sung nguồn [2]', cr: '',
      data: wiki(W_TD, ['s1', 's2', 's3', 's4', 's5'], { s4: TD_S4_OLD }) },
    { v: 'v2', status: 'superseded', by: 'Nguyễn Lan', at: '02/06/2026 · 15:40', sum: 'Thêm mục Điều kiện cấp tín dụng và Giải ngân và giám sát', cr: '',
      data: wiki(W_TD, ['s1', 's3', 's2', 's4', 's5'], { s2: { c: '[1]', p: 'Khách hàng có năng lực pháp lý, mục đích vay hợp pháp, phương án khả thi và xếp hạng tín dụng nội bộ từ BBB trở lên [1].' }, s4: TD_S4_OLD,
        s5: { p: 'Giải ngân theo tiến độ phương án; rà soát tình hình tài chính 6 tháng/lần [3].' } }) },
    { v: 'v1', status: 'superseded', by: 'Nguyễn Lan', at: '18/04/2026 · 09:10', sum: 'Sinh lần đầu từ 2 văn bản', cr: '',
      data: wiki(W_TD, ['s1', 's3', 's4'], { s3: { p: 'Giấy đề nghị vay vốn, báo cáo tài chính 2 năm gần nhất và phương án sử dụng vốn [2].' }, s4: TD_S4_OLD }) }
  ]);
  var W_TS = {
    t1: { t: 'Khái niệm và phân loại', c: '[1]', p: 'Tài sản bảo đảm gồm bất động sản, động sản, giấy tờ có giá và quyền tài sản theo quy định của ngân hàng [1].' },
    t2: { t: 'Định giá tài sản bảo đảm', c: '[2]', p: 'Tài sản được định giá bởi đơn vị định giá nội bộ hoặc tổ chức độc lập trong danh sách ngân hàng chấp thuận [2].' },
    t3: { t: 'Tỷ lệ cho vay tối đa', c: '[1] [2]', p: 'Tỷ lệ cho vay tối đa 70% giá trị định giá với bất động sản, 50% với động sản [1] [2].' },
    t4: { t: 'Quản lý và tái định giá', c: '[2]', p: 'Tái định giá định kỳ 12 tháng/lần hoặc khi giá thị trường biến động trên 20% [2].' }
  };
  V['pkg-wiki-tsbd'] = pkg('Wiki: Tài sản bảo đảm', WIKI_SECS, [
    { v: 'v1', status: 'draft', by: 'Trần Hải', at: '29/09/2026 · 14:00', sum: 'Bản nháp đầu tiên', cr: '', data: wiki(W_TS, ['t1', 't2', 't3', 't4']) }
  ]);
  var W_BC = {
    b1: { t: 'Tổng quan sản phẩm', c: '[1]', p: 'Bảo hiểm liên kết ngân hàng phân phối qua kênh chi nhánh cho khách hàng cá nhân [1].' },
    b2: { t: 'Quyền lợi bảo hiểm', c: '[1]', p: 'Quyền lợi tử vong, thương tật toàn bộ vĩnh viễn và bệnh hiểm nghèo theo hợp đồng [1].' },
    b3: { t: 'Quy trình tư vấn', c: '[2]', p: 'Tư vấn viên có chứng chỉ đại lý; khách hàng ký xác nhận đã được giải thích điều khoản loại trừ [2].' }
  };
  V['pkg-wiki-banca'] = pkg('Wiki: Sản phẩm bancassurance', WIKI_SECS, [
    { v: 'v1', status: 'published', by: 'Lê Thu', at: '12/08/2024 · 10:00', sum: 'Sinh lần đầu từ 2 văn bản', cr: '', data: wiki(W_BC, ['b1', 'b2', 'b3']) }
  ]);

  // faq-viewer.html: v1 Chờ duyệt only (questions + answers of .faq-item, cite buttons removed)
  V['pkg-faq-hsvld'] = pkg('FAQ: Hồ sơ vay vốn lưu động', FAQ_SECS, [
    { v: 'v1', status: 'pending', by: 'Trần Hải', at: '30/09/2026 · 11:15', sum: 'Sinh từ 3 văn bản; gửi duyệt', cr: '',
      data: { qa: [
        qa('q1', 'Hồ sơ vay vốn lưu động gồm những giấy tờ gì?', 'Hồ sơ gồm đề nghị vay, báo cáo tài chính 2 năm gần nhất, phương án sử dụng vốn và giấy tờ pháp lý doanh nghiệp.', 'Hồ sơ'),
        qa('q2', 'Hạn mức tối đa cho doanh nghiệp SME là bao nhiêu?', 'Không vượt quá 15% vốn tự có của ngân hàng; khoản vượt ngưỡng cần Hội đồng tín dụng phê duyệt.', 'Hạn mức'),
        qa('q3', 'Ai phê duyệt khoản vay từ 5 tỷ trở lên?', 'Khoản vay từ 5 tỷ do Hội đồng tín dụng phê duyệt.', 'Phê duyệt', 'Chờ duyệt'),
        qa('q4', 'Khi nào được điều chỉnh hạn mức trong kỳ?', 'Khi doanh thu biến động trên 20% so với kỳ đánh giá gần nhất, kèm hồ sơ chứng minh.', 'Hạn mức'),
        qa('q5', 'Thời gian thẩm định hồ sơ mất bao lâu?', 'Chưa có câu trả lời được xác nhận từ nguồn. Cần bổ sung evidence.', 'Hồ sơ', 'Thiếu nguồn')
      ] } }
  ]);
  V['pkg-faq-sme'] = pkg('FAQ: Hạn mức & lãi suất SME', FAQ_SECS, [
    { v: 'v2', status: 'published', by: 'Phạm Minh', at: '22/09/2026 · 09:30', sum: 'Lãi suất áp dụng từ 01/07/2026; thêm câu hỏi DN mới thành lập', cr: '',
      data: { qa: [
        qa('f1', 'Hạn mức tín dụng tối đa cho một khách hàng SME?', 'Không vượt quá 15% vốn tự có của ngân hàng.', 'Hạn mức'),
        qa('f2', 'Lãi suất cho vay vốn lưu động SME hiện hành?', 'Từ 7,2%/năm cho kỳ hạn đến 6 tháng, áp dụng từ 01/07/2026.', 'Lãi suất'),
        qa('f3', 'SME mới thành lập có được cấp hạn mức không?', 'Được, theo Phụ lục 02: DN mới thành lập, hạn mức tối đa 3 tỷ đồng và phải có tài sản bảo đảm.', 'Hạn mức'),
        qa('f4', 'Phí trả nợ trước hạn khoản vay SME?', '1% số tiền trả trước hạn trong 12 tháng đầu.', 'Phí')
      ] } },
    { v: 'v1', status: 'superseded', by: 'Phạm Minh', at: '10/03/2026 · 14:00', sum: 'Sinh lần đầu từ 3 văn bản', cr: '',
      patch: { qa: { del: ['f3'], set: { f2: { a: 'Từ 7,5%/năm cho kỳ hạn đến 6 tháng, áp dụng từ 01/01/2026.' } } } } }
  ]);
  V['pkg-faq-hdtd'] = pkg('FAQ: Hội đồng tín dụng', FAQ_SECS, [
    { v: 'v3', status: 'published', by: 'Trần Hải', at: '28/09/2026 · 16:00', sum: 'Ngưỡng Hội đồng 20 → 30 tỷ; thêm câu hỏi ký biên bản', cr: '',
      data: { qa: [
        qa('h1', 'Hội đồng tín dụng phê duyệt khoản vay từ bao nhiêu?', 'Từ 30 tỷ đồng đến 50 tỷ đồng/khách hàng; trên 50 tỷ đồng trình Hội đồng tín dụng cấp 2.', 'Thẩm quyền'),
        qa('h2', 'Phiên họp Hội đồng tín dụng hợp lệ khi nào?', 'Khi có tối thiểu 2/3 thành viên tham dự, trong đó có Chủ tịch hoặc người được ủy quyền.', 'Họp'),
        qa('h3', 'Quyết định của Hội đồng được thông qua thế nào?', 'Khi trên 50% thành viên dự họp biểu quyết tán thành.', 'Họp'),
        qa('h4', 'Biên bản họp Hội đồng ký trong bao lâu?', 'Trong vòng 1 ngày làm việc sau phiên họp.', 'Họp')
      ] } },
    { v: 'v2', status: 'superseded', by: 'Trần Hải', at: '05/06/2026 · 10:20', sum: 'Thêm câu hỏi biểu quyết', cr: '',
      patch: { qa: { del: ['h4'], set: { h1: { a: 'Từ 20 tỷ đồng đến 50 tỷ đồng/khách hàng; trên 50 tỷ đồng trình Hội đồng tín dụng cấp 2.' } } } } },
    { v: 'v1', status: 'superseded', by: 'Nguyễn Lan', at: '03/03/2026 · 15:45', sum: 'Sinh lần đầu từ 1 văn bản', cr: '',
      patch: { qa: { del: ['h3'], set: { h2: { a: 'Khi có tối thiểu 1/2 thành viên tham dự, trong đó có Chủ tịch.' } } } } }
  ]);
  V['pkg-faq-tgnd'] = pkg('FAQ: Thẻ ghi nợ nội địa', FAQ_SECS, [
    { v: 'v3', status: 'published', by: 'Hoàng Vy', at: '20/08/2024 · 11:00', sum: 'Cập nhật hạn mức rút tiền ATM', cr: '',
      data: { qa: [
        qa('g1', 'Hạn mức rút tiền ATM mỗi ngày của thẻ ghi nợ nội địa?', 'Tối đa 50 triệu đồng/ngày.', 'Hạn mức'),
        qa('g2', 'Phí phát hành lại thẻ khi mất thẻ?', '50.000 đồng/lần.', 'Phí'),
        qa('g3', 'Thẻ ghi nợ nội địa có thanh toán trực tuyến được không?', 'Được, khi đã đăng ký dịch vụ thanh toán trực tuyến trên ứng dụng.', 'Sử dụng')
      ] } },
    { v: 'v2', status: 'superseded', by: 'Hoàng Vy', at: '04/03/2024 · 09:15', sum: 'Thêm câu hỏi thanh toán trực tuyến', cr: '',
      patch: { qa: { set: { g1: { a: 'Tối đa 30 triệu đồng/ngày.' } } } } },
    { v: 'v1', status: 'superseded', by: 'Hoàng Vy', at: '12/10/2023 · 14:30', sum: 'Sinh lần đầu từ 2 văn bản', cr: '',
      patch: { qa: { del: ['g3'] } } }
  ]);

  // playbook-viewer.html: v2 = the page (.pb-step), v1 had 4 steps
  V['pkg-pb-npl2'] = pkg('Playbook: Xử lý nợ quá hạn nhóm 2', PB_SECS, [
    { v: 'v2', status: 'published', by: 'Nguyễn Lan', at: '25/09/2026 · 15:10', sum: 'Tách nhánh 4a / 4b; thêm bước Chuyển xử lý nợ', cr: '',
      data: { steps: [
        step('p1', '1', 'Xác định khoản nợ chuyển nhóm 2', 'Hệ thống', 'Ngày 1', 'Khi khoản vay quá hạn 10–90 ngày, hệ thống tự gắn cờ nhóm 2 và tạo việc cho chuyên viên quan hệ khách hàng.'),
        step('p2', '2', 'Liên hệ khách hàng', 'Chuyên viên QHKH', 'Trong 2 ngày', 'Gọi điện và gửi thông báo nhắc nợ; ghi nhận nguyên nhân chậm trả và cam kết trả nợ.'),
        step('p3', '3', 'Đánh giá khả năng trả nợ', 'Chuyên viên thẩm định', 'Trong 5 ngày', 'Rà soát dòng tiền, tài sản bảo đảm và cập nhật xếp hạng tín dụng nội bộ. Điều kiện: nếu khách hàng có phương án khả thi → bước 4a; nếu không → bước 4b.'),
        step('p4', '4a', 'Cơ cấu lại thời hạn trả nợ', 'Hội đồng tín dụng', 'Trong 10 ngày', 'Đề xuất gia hạn hoặc điều chỉnh kỳ hạn trả nợ theo quy định cơ cấu nợ.'),
        step('p5', '4b', 'Chuyển xử lý nợ', 'Phòng xử lý nợ', 'Sau bước 3', 'Chuyển hồ sơ cho phòng xử lý nợ, chuẩn bị phương án xử lý tài sản bảo đảm.')
      ] } },
    { v: 'v1', status: 'superseded', by: 'Nguyễn Lan', at: '02/07/2026 · 10:00', sum: 'Phiên bản đầu tiên · 4 bước', cr: '',
      patch: { steps: { del: ['p5'], set: { p3: { body: 'Rà soát dòng tiền và tài sản bảo đảm của khách hàng.' }, p4: { no: '4' } } } } }
  ]);
  V['pkg-pb-tinchap'] = pkg('Playbook: Xử lý hồ sơ tín chấp thủ công', PB_SECS, [
    { v: 'v2', status: 'published', by: 'Lê Thu', at: '15/06/2023 · 10:40', sum: 'Thêm bước đối chiếu CIC', cr: '',
      data: { steps: [
        step('t1', '1', 'Tiếp nhận hồ sơ giấy', 'Chuyên viên QHKH', 'Ngày 1', 'Kiểm tra đủ giấy đề nghị vay, CCCD và xác nhận thu nhập.'),
        step('t2', '2', 'Đối chiếu CIC', 'Chuyên viên thẩm định', 'Trong 1 ngày', 'Tra cứu lịch sử tín dụng trên CIC và ghi nhận nợ nhóm 2 trở lên.'),
        step('t3', '3', 'Nhập hồ sơ vào hệ thống', 'Giao dịch viên', 'Trong 1 ngày', 'Nhập thông tin khách hàng và khoản vay vào LOS.'),
        step('t4', '4', 'Trình phê duyệt', 'Trưởng phòng', 'Trong 2 ngày', 'Trình phê duyệt theo thẩm quyền khoản vay tín chấp.')
      ] } },
    { v: 'v1', status: 'superseded', by: 'Lê Thu', at: '20/01/2023 · 09:00', sum: 'Phiên bản đầu tiên · 3 bước', cr: '',
      patch: { steps: { del: ['t2'], set: { t3: { no: '2' }, t4: { no: '3' } } } } }
  ]);
  /* --- KB detail shape (FE artifact-history.tsx): no restore, no summary; only the newest version keeps its own status.
   * Document: Metadata (version, status, pages, synced at). Package: Metadata (version, status) + item list (+ body for a wiki). --- */
  function kbDetailShape(id, sections, meta) {
    var d = V[id];
    d.restore = false; d.sections = sections;
    d.versions.forEach(function (x, i) {
      if (i > 0) x.status = 'superseded';
      x.sum = ''; x.cr = ''; delete x.undo;
      var m = meta(x);
      if (x.data) { x.data.meta = m; delete x.data.text; } else { x.patch = x.patch || {}; x.patch.meta = { set: m }; }
    });
  }
  var DOC_META = [{ id: 'meta', label: 'Metadata', kind: 'fields', fields: [['ver', 'Phiên bản'], ['st', 'Trạng thái'], ['pages', 'Số trang'], ['sync', 'Đồng bộ lúc']] }];
  ['doc-qd-tdkhdn', 'doc-hd-vld', 'doc-qt-hdtd', 'doc-mau-totrinh', 'doc-dt-sme', 'doc-bb-hdtd', 'doc-tt39', 'doc-pl02', 'doc-xhtd', 'doc-qc-cvdn',
    'doc-dm-hspl', 'doc-qd-ccln', 'doc-dt-tdpa', 'doc-mau-ktsv', 'doc-qd-ghnganh', 'doc-dg-tsbd'].forEach(function (id) {
    kbDetailShape(id, DOC_META, function (x) { var o = x.data.meta; return { ver: o.ver, st: ST[x.status] || x.status, pages: o.pages, sync: o.sync }; });
  });
  var PKG_META = { id: 'meta', label: 'Metadata', kind: 'fields', fields: [['ver', 'Phiên bản'], ['st', 'Trạng thái']] };
  function pkgMeta(x) { return { ver: x.v, st: ST[x.status] || x.status }; }
  ['pkg-wiki-tdkhdn', 'pkg-wiki-tsbd'].forEach(function (id) {
    kbDetailShape(id, [PKG_META, { id: 'outline', label: 'Cấu trúc section', kind: 'list', cols: [['title', 'Mục']] }, { id: 'body', label: 'Nội dung', kind: 'text' }], pkgMeta);
  });
  ['pkg-faq-hsvld', 'pkg-faq-sme', 'pkg-faq-hdtd'].forEach(function (id) {
    kbDetailShape(id, [PKG_META, { id: 'qa', label: 'Danh sách câu hỏi', kind: 'list', cols: [['q', 'Câu hỏi'], ['a', 'Câu trả lời'], ['topic', 'Chủ đề']] }], pkgMeta);
  });
  kbDetailShape('pkg-pb-npl2', [PKG_META, { id: 'steps', label: 'Các bước', kind: 'list', cols: [['no', 'Bước'], ['title', 'Tên bước'], ['role', 'Vai trò'], ['sla', 'Thời hạn']] }], pkgMeta);
})();
