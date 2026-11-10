/* ECP mockups: Global taxonomy (Taxonomy Management mock data) + the shared taxonomy-tag component.
 * One source for the tag values shown on KB cards / rows, the Create / Edit KB tag picker, KB detail and Document detail,
 * and for config-taxonomy.html (screens.js reads ECP_TAXONOMY.global()).
 * Colour rule: every value takes the colour of its top-level tag type (the parent taxonomy), so all values under
 * "Sản phẩm" share one colour on every screen and different parents get different colours (--tax-1..9 in shell.css).
 * A tag with no taxonomy mapping falls back to the neutral chip.
 * API: global(), v(), find(name[, typeCode]), values(), tagHtml(tag, {full, removable}), tipText(tag)
 * Also the preset bar of Taxonomy Management and Ontology Studio (ADR-007): window.ECP_PRESETS.mount(host, opts), below. */
(function () {
  function toCode(x) { return String(x || '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // ---- mock data (sample content stays Vietnamese) ----
  // A type may carry `parent: '<CODE>'`; sibling order = array order (kept in DFS order here).
  function v(name, desc, docs, opt) { opt = opt || {}; return { name: name, code: opt.code || toCode(name), desc: desc, docs: docs, on: opt.on !== false, syn: opt.syn || [], own: !!opt.own, kbs: opt.kbs || 1 + (docs % 5), hist: opt.hist }; }
  var GLOBAL = [
    { code: 'PRODUCT', name: 'Sản phẩm', multi: true, owner: 'Nguyễn Lan', kbs: 6, docs: 1196, desc: 'Sản phẩm, dịch vụ ngân hàng MSB mà tài liệu đề cập.', values: [] },
    { code: 'LOAN_PRODUCT', parent: 'PRODUCT', name: 'Sản phẩm cho vay', multi: true, owner: 'Nguyễn Lan', checker: 'Phạm Minh', kbs: 4, docs: 412, desc: 'Các sản phẩm cho vay KHCN và KHDN của MSB.', values: [] },
    { code: 'LOAN_TYPE', parent: 'LOAN_PRODUCT', name: 'Loại khoản vay', multi: true, owner: 'Nguyễn Lan', checker: 'Phạm Minh', kbs: 4, docs: 412, desc: 'Hình thức cho vay KHCN và KHDN của MSB.', values: [
      v('Vay tiêu dùng tín chấp', 'Cho vay không tài sản bảo đảm phục vụ nhu cầu đời sống cá nhân.', 96, { syn: ['Vay tín chấp', 'Unsecured loan'] }),
      v('Vay mua nhà', 'Cho vay mua, xây dựng, sửa chữa nhà ở có tài sản bảo đảm.', 121, { syn: ['Vay mua bất động sản', 'Mortgage'] }),
      v('Vay mua ô tô', 'Cho vay mua xe ô tô mới hoặc đã qua sử dụng, thế chấp bằng chính xe mua.', 58, { syn: ['Auto loan'] }),
      v('Vay vốn lưu động', 'Cho vay bổ sung vốn lưu động phục vụ sản xuất kinh doanh của doanh nghiệp, hộ kinh doanh.', 104, { syn: ['Working capital loan', 'VLĐ'] }),
      v('Cho vay SME', 'Cho vay doanh nghiệp nhỏ và vừa phục vụ sản xuất kinh doanh.', 87, { syn: ['Vay SME', 'SME loan'] }),
      v('Vay đầu tư tài sản cố định', 'Cho vay trung, dài hạn đầu tư máy móc, nhà xưởng, dự án.', 33, { on: false, syn: ['Capex loan'] })
    ] },
    { code: 'LOAN_PURPOSE', parent: 'LOAN_PRODUCT', name: 'Mục đích vay', multi: false, owner: 'Phạm Minh', kbs: 3, docs: 268, desc: 'Mục đích sử dụng vốn vay ghi trong hồ sơ, hợp đồng tín dụng. Mỗi tài liệu gắn một mục đích chính.', values: [
      v('Tiêu dùng cá nhân', 'Chi tiêu sinh hoạt, mua sắm, chữa bệnh, cưới hỏi.', 74, { syn: ['Consumer'] }),
      v('Mua, xây sửa nhà ở', 'Mua nhà, mua đất, xây mới hoặc sửa chữa nhà ở.', 88, { syn: ['Housing'] }),
      v('Bổ sung vốn kinh doanh', 'Thanh toán tiền hàng, chi phí sản xuất kinh doanh thường xuyên.', 71, { syn: ['Working capital'] }),
      v('Du học', 'Chi trả học phí, sinh hoạt phí và chứng minh tài chính du học.', 35, { syn: ['Study abroad'] })
    ] },
    { code: 'CARD_PRODUCT', parent: 'PRODUCT', name: 'Sản phẩm thẻ', multi: true, owner: 'Lê Thu', checker: 'Nguyễn Lan', kbs: 3, docs: 297, desc: 'Các dòng thẻ do MSB phát hành: thẻ tín dụng, thẻ ghi nợ, thẻ trả trước.', values: [
      v('Thẻ tín dụng quốc tế', 'Thẻ tín dụng Visa, Mastercard dùng trong và ngoài nước.', 132, { syn: ['International credit card', 'Visa', 'Mastercard'] }),
      v('Thẻ tín dụng doanh nghiệp', 'Thẻ tín dụng cấp cho doanh nghiệp, quản lý chi tiêu của nhân viên.', 44, { syn: ['Corporate card'] }),
      v('Thẻ tín dụng cá nhân', 'Thẻ tín dụng cấp cho khách hàng cá nhân theo hạn mức được duyệt.', 76, { syn: ['Personal credit card'] }),
      v('Thẻ ghi nợ nội địa', 'Thẻ thanh toán gắn tài khoản, dùng trong mạng Napas.', 61, { syn: ['Debit card nội địa', 'Napas'] }),
      v('Thẻ ghi nợ quốc tế', 'Thẻ ghi nợ Visa Debit, Mastercard Debit gắn tài khoản thanh toán.', 57, { syn: ['International debit card'] }),
      v('Thẻ trả trước', 'Thẻ nạp tiền trước, không gắn tài khoản thanh toán.', 29, { syn: ['Prepaid card'] }),
      v('Thẻ đồng thương hiệu', 'Thẻ hợp tác giữa MSB và đối tác như Vietnam Airlines.', 18, { syn: ['Co-brand card'] }),
      v('Thẻ Visa Signature Ưu tiên', 'Thẻ tín dụng hạng cao cho khách hàng ưu tiên, kèm đặc quyền phòng chờ và hoàn tiền.', 12, { on: false, syn: ['Visa Signature'] })
    ] },
    { code: 'DEPOSIT_PRODUCT', parent: 'PRODUCT', name: 'Sản phẩm tiền gửi', multi: true, owner: 'Phạm Minh', kbs: 3, docs: 205, desc: 'Các sản phẩm huy động vốn: tiền gửi thanh toán, tiết kiệm, chứng chỉ tiền gửi.', values: [
      v('Tiền gửi thanh toán', 'Tài khoản thanh toán không kỳ hạn của KHCN và KHDN.', 64, { syn: ['Tài khoản thanh toán', 'CASA'] }),
      v('Tiết kiệm có kỳ hạn', 'Tiền gửi tiết kiệm với kỳ hạn cố định và lãi suất theo kỳ hạn.', 72, { syn: ['Term deposit'] }),
      v('Tiết kiệm không kỳ hạn', 'Tiền gửi tiết kiệm rút bất cứ lúc nào, lãi suất không kỳ hạn.', 23, { syn: ['Demand savings'] }),
      v('Tiết kiệm online', 'Mở và tất toán sổ tiết kiệm trên MSB mBank.', 31, { syn: ['Online savings', 'e-Savings'] }),
      v('Chứng chỉ tiền gửi', 'Giấy tờ có giá do MSB phát hành để huy động vốn.', 15, { on: false, syn: ['Certificate of deposit', 'CD'] })
    ] },
    { code: 'TRADE_FINANCE', parent: 'PRODUCT', name: 'Tài trợ thương mại', multi: true, owner: 'Trần Hải', checker: 'Nguyễn Lan', kbs: 2, docs: 115, desc: 'Sản phẩm phục vụ thanh toán, tài trợ xuất nhập khẩu và bảo lãnh.', values: [
      v('Thư tín dụng (L/C)', 'Thư tín dụng nhập khẩu, xuất khẩu theo UCP 600.', 38, { syn: ['L/C', 'Letter of credit'] }),
      v('L/C nhập khẩu', 'Thư tín dụng MSB phát hành theo yêu cầu của nhà nhập khẩu.', 27, { syn: ['Import L/C'] }),
      v('Nhờ thu', 'Nhờ thu kèm chứng từ (D/P, D/A) và nhờ thu trơn.', 13, { on: false, syn: ['Collection', 'D/P'] }),
      v('Bảo lãnh ngân hàng', 'Cam kết của MSB thực hiện nghĩa vụ tài chính thay khách hàng khi khách hàng không thực hiện.', 64, { syn: ['Bank guarantee'] }),
      v('Bảo lãnh dự thầu', 'Bảo lãnh nghĩa vụ của nhà thầu khi tham gia đấu thầu.', 21, { syn: ['Bid bond'] }),
      v('Bảo lãnh thanh toán', 'Bảo lãnh nghĩa vụ thanh toán của khách hàng với bên thụ hưởng.', 17, { syn: ['Payment guarantee'] })
    ] },
    { code: 'DOC_TYPE', name: 'Loại văn bản', multi: false, owner: 'Trần Hải', kbs: 6, docs: 1532, desc: 'Hình thức văn bản của tài liệu nội bộ. Mỗi tài liệu chỉ thuộc một loại văn bản.', values: [
      v('Quyết định', 'Văn bản ban hành quyết định của cấp có thẩm quyền.', 318, { syn: ['QĐ'] }),
      v('Quy định', 'Văn bản quy định nội bộ về điều kiện, thẩm quyền và trách nhiệm thực hiện nghiệp vụ.', 274, { syn: ['Regulation', 'Chính sách'] }),
      v('Quy trình', 'Các bước thực hiện một nghiệp vụ, kèm vai trò và thời hạn.', 541, { syn: ['SOP', 'Process'] }),
      v('Hướng dẫn', 'Hướng dẫn chi tiết cách áp dụng quy trình hoặc sản phẩm.', 466, { syn: ['HD', 'Guideline'] }),
      v('Biểu phí', 'Danh mục phí, lãi suất áp dụng cho sản phẩm, dịch vụ.', 207, { syn: ['Fee schedule'] })
    ] },
    { code: 'BIZ_UNIT', name: 'Khối nghiệp vụ', multi: true, owner: 'Nguyễn Lan', kbs: 5, docs: 948, desc: 'Khối hoặc đơn vị nghiệp vụ sở hữu, ban hành tài liệu.', values: [] },
    { code: 'BIZ_BLOCK', parent: 'BIZ_UNIT', name: 'Khối', multi: true, owner: 'Nguyễn Lan', checker: 'Trần Hải', kbs: 5, docs: 948, desc: 'Khối kinh doanh sở hữu, ban hành tài liệu.', values: [
      v('Khối Khách hàng cá nhân', 'Phục vụ khách hàng cá nhân (Retail).', 402, { syn: ['KHCN', 'Retail'] }),
      v('Khối Khách hàng doanh nghiệp', 'Phục vụ doanh nghiệp lớn và vừa.', 331, { syn: ['KHDN', 'Corporate'] }),
      v('Khối SME', 'Phục vụ doanh nghiệp nhỏ và vừa, hộ kinh doanh.', 215, { syn: ['Doanh nghiệp nhỏ và vừa'] })
    ] },
    { code: 'DEPARTMENT', parent: 'BIZ_UNIT', name: 'Phòng ban', multi: true, owner: 'Trần Hải', checker: 'Nguyễn Lan', kbs: 5, docs: 512, desc: 'Phòng, ban trực thuộc khối nghiệp vụ chịu trách nhiệm nội dung tài liệu.', values: [
      v('Phòng Quản lý tín dụng', 'Thẩm định, phê duyệt và giám sát khoản vay.', 138, { syn: ['QLTD', 'Credit management'] }),
      v('Phòng Pháp chế', 'Rà soát pháp lý hợp đồng, văn bản nội bộ.', 97, { syn: ['Legal'] }),
      v('Phòng Vận hành thẻ', 'Phát hành, quản lý và xử lý tra soát thẻ.', 84, { syn: ['Card operations'] }),
      v('Phòng Quản lý rủi ro', 'Nhận diện, đo lường và kiểm soát rủi ro hoạt động.', 112, { syn: ['QLRR', 'Risk management'] }),
      v('Phòng Dịch vụ khách hàng', 'Tiếp nhận, giải đáp yêu cầu và khiếu nại của khách hàng.', 81, { syn: ['CSKH', 'Customer service'] }),
      v('Trung tâm Thẻ', 'Đơn vị quản lý sản phẩm và phát hành thẻ của MSB.', 73, { syn: ['Card center'] })
    ] },
    { code: 'CUST_SEG', name: 'Phân khúc khách hàng', multi: true, owner: 'Phạm Minh', kbs: 2, docs: 187, desc: 'Phân khúc khách hàng theo loại hình và quy mô, dùng cho tài liệu tín dụng và thẻ.', values: [
      v('KH Doanh nghiệp SME', 'Khách hàng doanh nghiệp nhỏ và vừa.', 66, { syn: ['SME'] }),
      v('KH Doanh nghiệp lớn', 'Khách hàng doanh nghiệp quy mô lớn.', 41, { syn: ['Corporate'] }),
      v('KH Cá nhân', 'Khách hàng cá nhân sử dụng sản phẩm bán lẻ.', 92, { syn: ['Retail'] }),
      v('Siêu nhỏ', 'Doanh nghiệp siêu nhỏ theo tiêu chí phân loại của Chính phủ.', 38, { syn: ['Micro'] }),
      v('Nhỏ', 'Doanh nghiệp nhỏ theo doanh thu và lao động.', 61, { syn: ['Small'] }),
      v('Vừa', 'Doanh nghiệp vừa theo doanh thu và lao động.', 54, { syn: ['Medium'] }),
      v('Lớn', 'Doanh nghiệp vượt ngưỡng doanh nghiệp vừa.', 34, { on: false, syn: ['Large', 'Corporate'] })
    ] },
    { code: 'LEGAL_DOC', name: 'Văn bản pháp lý', multi: true, owner: 'Trần Hải', checker: 'Nguyễn Lan', kbs: 4, docs: 386, desc: 'Văn bản quy phạm pháp luật và quy định nội bộ điều chỉnh sản phẩm, quy trình.', values: [
      v('NĐ 80/2021', 'Nghị định hướng dẫn Luật Hỗ trợ doanh nghiệp nhỏ và vừa.', 48, { syn: ['Nghị định 80'] }),
      v('TT 11/2022/TT-NHNN', 'Thông tư quy định về bảo lãnh ngân hàng.', 57, { syn: ['Thông tư 11'] }),
      v('TT 39/2016', 'Thông tư quy định hoạt động cho vay của tổ chức tín dụng.', 73, { syn: ['Thông tư 39'] }),
      v('QĐ-TD-08', 'Quy định nội bộ về cho vay vốn lưu động.', 22),
      v('UCP 600', 'Quy tắc thực hành thống nhất về tín dụng chứng từ của ICC.', 35),
      v('TT 19/2016', 'Thông tư quy định về hoạt động thẻ ngân hàng.', 41, { syn: ['Thông tư 19'] }),
      v('QĐ-THE-02', 'Quy định nội bộ về phát hành và sử dụng thẻ.', 16)
    ] },
    { code: 'PROCESS', name: 'Quy trình', multi: true, owner: 'Phạm Minh', checker: 'Trần Hải', kbs: 4, docs: 274, desc: 'Quy trình nghiệp vụ được tài liệu mô tả hoặc tham chiếu.', values: [
      v('Thẩm định tín dụng', 'Đánh giá hồ sơ, năng lực tài chính và tài sản bảo đảm của khách hàng.', 64),
      v('Phê duyệt tín dụng', 'Phê duyệt khoản cấp tín dụng theo thẩm quyền.', 52),
      v('Phát hành bảo lãnh', 'Các bước phát hành thư bảo lãnh cho khách hàng.', 31),
      v('Mở L/C', 'Tiếp nhận yêu cầu và phát hành thư tín dụng nhập khẩu.', 27),
      v('Phát hành thẻ', 'Tiếp nhận hồ sơ, phê duyệt và giao thẻ cho khách hàng.', 46),
      v('Khóa thẻ', 'Khóa tạm thời hoặc vĩnh viễn thẻ theo yêu cầu hoặc khi có rủi ro.', 18)
    ] },
    { code: 'RISK', name: 'Rủi ro', multi: true, owner: 'Nguyễn Lan', checker: 'Phạm Minh', kbs: 3, docs: 158, desc: 'Loại rủi ro mà tài liệu nhận diện hoặc kiểm soát.', values: [
      v('Rủi ro tín dụng', 'Rủi ro khách hàng không trả được nợ đúng hạn.', 83, { syn: ['Credit risk'] }),
      v('Rủi ro gian lận thẻ', 'Rủi ro giao dịch thẻ giả mạo, chiếm đoạt.', 39),
      v('Rủi ro tuân thủ', 'Rủi ro vi phạm quy định pháp luật và nội bộ.', 36)
    ] },
    { code: 'RECORD', name: 'Hồ sơ/Chứng từ', multi: true, owner: 'Trần Hải', kbs: 2, docs: 121, desc: 'Hồ sơ, chứng từ khách hàng cung cấp trong giao dịch.', values: [
      v('Hồ sơ vay', 'Bộ hồ sơ đề nghị vay vốn của khách hàng.', 54),
      v('Bộ chứng từ L/C', 'Chứng từ xuất trình theo điều kiện thư tín dụng.', 29),
      v('Tài sản bảo đảm', 'Tài sản thế chấp, cầm cố cho nghĩa vụ trả nợ.', 38, { syn: ['TSBĐ', 'Collateral'] })
    ] },
    { code: 'LANGUAGE', name: 'Ngôn ngữ', multi: false, owner: 'Trần Hải', kbs: 6, docs: 1532, desc: 'Ngôn ngữ chính của nội dung tài liệu. Mỗi tài liệu gắn một ngôn ngữ chính.', values: [
      v('Tiếng Việt', 'Tài liệu viết bằng tiếng Việt.', 1384, { syn: ['Vietnamese', 'vi'] }),
      v('Tiếng Anh', 'Tài liệu viết bằng tiếng Anh.', 148, { syn: ['English', 'en'] })
    ] }
  ];

  // ---- parent-taxonomy colour mapping ----
  // Fixed per top-level type so a colour never shifts between pages; a new top-level type takes the next free slot.
  var COLOR = { PRODUCT: 1, RISK: 2, BIZ_UNIT: 3, CUST_SEG: 4, PROCESS: 5, LANGUAGE: 6, DOC_TYPE: 7, LEGAL_DOC: 8, RECORD: 9 };
  var BY = {};
  GLOBAL.forEach(function (t) { BY[t.code] = t; });
  var next = 0;
  GLOBAL.forEach(function (t) { if (!t.parent && !COLOR[t.code]) COLOR[t.code] = (next++ % 9) + 1; });
  function rootOf(t) { while (t.parent && BY[t.parent]) t = BY[t.parent]; return t; }

  // tag = [typeCode, valueName] (or a bare string, matched by name). Returns null when the value is not in the taxonomy.
  function find(name, typeCode) {
    for (var i = 0; i < GLOBAL.length; i++) {
      var t = GLOBAL[i];
      if (typeCode && t.code !== typeCode) continue;
      for (var j = 0; j < t.values.length; j++) {
        if (t.values[j].name === name) { var r = rootOf(t); return { name: name, code: t.values[j].code, type: t, root: r, color: COLOR[r.code] }; }
      }
    }
    return null;
  }
  function norm(tag) { return typeof tag === 'string' ? { type: null, name: tag } : { type: tag[0], name: tag[1] }; }
  function match(tag) { var n = norm(tag); return find(n.name, n.type); }
  // "Sản phẩm › Sản phẩm thẻ · Thẻ tín dụng quốc tế" (one level when the value sits on the top-level type)
  function tipText(tag) {
    var m = match(tag);
    if (!m) return null;
    return (m.root === m.type ? m.type.name : m.root.name + ' › ' + m.type.name) + ' · ' + m.name;
  }
  // every value, flattened in taxonomy order: { type, typeName, root, name, code, color }
  function values() {
    var out = [];
    GLOBAL.forEach(function (t) { t.values.forEach(function (x) { if (x.on === false) return; var r = rootOf(t); out.push({ type: t.code, typeName: t.name, root: r.name, name: x.name, code: x.code, color: COLOR[r.code] }); }); });
    return out;
  }
  // opts.full: label "Parent · Value" (Document detail); opts.removable: × button with data-rm-tag (Create / Edit KB)
  var TAG_ICO = '<svg class="ico ecp-tax-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>';
  function tagHtml(tag, opts) {
    opts = opts || {};
    var n = norm(tag), m = match(tag), x = '';
    if (opts.removable) {
      var rm = window.ECP_I18N ? window.ECP_I18N.tr('kbc.removeX', 'Bỏ {x}', { x: n.name }) : 'Bỏ ' + n.name;
      x = '<button type="button" class="chip-x" data-rm-tag="' + esc(n.name) + '" aria-label="' + esc(rm) + '">×</button>';
    }
    if (!m) {
      return '<span class="chip chip-neutral ecp-tax ecp-tax-none" data-ecp-tip tabindex="0" data-i18n-skip data-tag="' + esc(n.name) + '"' +
        ' title="' + esc((window.ECP_I18N ? window.ECP_I18N.tr('tax.unmappedTip', 'Tag chưa thuộc taxonomy · {x}', { x: n.name }) : 'Tag chưa thuộc taxonomy · ' + n.name)) + '"' +
        ' data-i18n-attr="title:tax.unmappedTip" data-i18n-args="' + esc(JSON.stringify({ x: n.name })) + '">' + TAG_ICO + esc(n.name) + x + '</span>';
    }
    var label = opts.full ? m.root.name + ' · ' + m.name : m.name;
    return '<span class="chip ecp-tax ecp-tax-' + m.color + '" data-ecp-tip tabindex="0" data-i18n-skip data-tag="' + esc(m.name) + '" data-tax-type="' + m.type.code + '" data-tax-root="' + m.root.code + '"' +
      ' title="' + esc(tipText(tag)) + '">' + TAG_ICO + esc(label) + x + '</span>';
  }

  // ---- shared hover / focus tooltip for [data-ecp-tip] (status + taxonomy tags) ----
  // Reads the element's title (kept translated by i18n.js) and suppresses the native one while shown.
  // An element may instead carry built markup in el.__kcTipHtml (verification summary); it also opens on click / tap.
  var tip = null, tipFor = null;
  function hideTip() {
    if (!tipFor) return;
    if (tipFor.__kcTitle && !tipFor.getAttribute('title')) tipFor.setAttribute('title', tipFor.__kcTitle);
    tipFor = null; if (tip) tip.hidden = true;
  }
  function showTip(el) {
    var html = el.__kcTipHtml, text = html ? '' : el.getAttribute('title') || el.__kcTitle;
    if (!html && !text) return;
    hideTip();
    if (!tip) { tip = document.createElement('div'); tip.className = 'ecp-tip'; tip.setAttribute('role', 'tooltip'); tip.id = 'ecp-tip'; tip.hidden = true; document.body.appendChild(tip); }
    tip.classList.toggle('ecp-tip-rich', !!html);
    if (html) tip.innerHTML = html;
    else { el.__kcTitle = text; el.removeAttribute('title'); tip.textContent = text; }
    tip.hidden = false; tipFor = el;
    var r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    var top = r.top - h - 6; if (top < 8) top = r.bottom + 6;
    tip.style.top = top + 'px';
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  }
  function tipTarget(e) { return e.target.closest ? e.target.closest('[data-ecp-tip]') : null; }
  document.addEventListener('mouseover', function (e) { var el = tipTarget(e); if (el && el !== tipFor) showTip(el); else if (!el && tipFor) hideTip(); });
  document.addEventListener('focusin', function (e) { var el = tipTarget(e); if (el) showTip(el); });
  document.addEventListener('focusout', function (e) { if (tipTarget(e) === tipFor) hideTip(); });
  document.addEventListener('click', function (e) { var el = tipTarget(e); if (el && el.__kcTipHtml) showTip(el); else if (!el && tipFor) hideTip(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });
  document.addEventListener('scroll', hideTip, true);

  window.ECP_TAXONOMY = {
    global: function () { return JSON.parse(JSON.stringify(GLOBAL)); },
    v: v, toCode: toCode, find: find, match: match, values: values, tipText: tipText, tagHtml: tagHtml, refreshTip: function (el) { if (el === tipFor) { if (el.hidden) hideTip(); else showTip(el); } }, colorOf: function (rootCode) { return COLOR[rootCode]; }
  };
})();

/* Preset bar (ADR-007), as web components/presets/{preset-bar,preset-create-dialog,preset-version-history}.tsx:
 * preset select (Global + presets of one kind) · "Phát hành" (Owner / Admin) or "Gửi yêu cầu phát hành" (Steward) ·
 * version menu "v2 ▾" (Xem phiên bản | Nhân bản, Import từ file | Tạo preset mới, Lưu trữ) · "Chờ duyệt phát hành" chip.
 * The members dialog is not mirrored: the web app has no entry point for it yet.
 * mount(host, { kind: 'taxonomy'|'ontology', presets: [{ id, name, kind: 'GLOBAL'|'CUSTOM', version, hasChanges, pending }],
 *   value, snapshot(id) → { sectionId: [{ id, name, code, active }] }, onCreate(preset, mode, sourceId), onChange(id) })
 * → { select, markChanged(), current(), selectId(id) }. onRelease(preset) runs after a publish / request. The select element is kept across renders (pages listen to its change event). */
(function () {
  function fill(s, a) { return String(s).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); }
  function T(k, vi, a) { var I = window.ECP_I18N; return I && I.tr ? I.tr(k, vi, a) : fill(vi, a); }
  function N(n) { var I = window.ECP_I18N; return I && I.fmtNum ? I.fmtNum(n) : String(n); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(m) { if (window.ECP_toast) window.ECP_toast(m); }
  var SUMMARY_MAX = 300, MAX_BYTES = 10 * 1024 * 1024, crSeq = 1270, seq = 0;
  var ACCEPT = { taxonomy: ['json', 'csv', 'xlsx'], ontology: ['json', 'csv', 'xlsx', 'ttl', 'owl', 'rdf'] };
  var TEMPLATES = { taxonomy: ['JSON', 'CSV', 'Excel (.xlsx)'], ontology: ['JSON', 'CSV', 'Excel (.xlsx)', 'Turtle (.ttl)', 'RDF/OWL (.owl)'] };
  var ICO_X = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  // releaseMode(): Admin and the preset's Owner publish, a Steward requests. Mock: the Owner owns every custom preset
  // and is a Steward of Global (Global's owners are the Admins); Viewer / Consumer get no button.
  function modeOf(p) {
    var r = document.documentElement.getAttribute('data-role') || 'owner';
    return r === 'admin' || (r === 'owner' && p.kind === 'CUSTOM') ? 'direct' : r === 'owner' || r === 'steward' ? 'request' : null;
  }
  // FE Dialog (.q-dlg chrome): title, body, Hủy + primary / danger; removed from the DOM on close
  function dialog(title, body, okLabel, danger) {
    var d = document.createElement('dialog');
    d.className = 'q-dlg is-md preset-dlg'; d.setAttribute('aria-labelledby', 'preset-dlg-t');
    d.innerHTML = '<div class="q-dlg-head"><h2 class="modal-title job-ell" id="preset-dlg-t"></h2><button class="icon-btn" type="button" data-px aria-label="' + esc(T('common.close', 'Đóng')) + '">' + ICO_X + '</button></div>' +
      '<div class="q-dlg-body preset-dlg-body">' + body + '</div>' +
      '<div class="q-dlg-foot"><button class="btn btn-secondary" type="button" data-px>' + esc(T('common.cancel', 'Hủy')) + '</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" type="button" data-pok>' + esc(okLabel) + '</button></div>';
    d.querySelector('h2').textContent = title;
    d.addEventListener('click', function (e) { if (e.target.closest('[data-px]')) d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    document.body.appendChild(d); d.showModal();
    return d;
  }
  function fieldErr(d, sel, msg) { var e = d.querySelector(sel); e.textContent = msg || ''; e.hidden = !msg; }

  // ---- "Xem phiên bản": the preset's published versions in the shared version popup (version-diff.js) ----
  function sections(kind) {
    var name = ['name', T('web.preset.vh.name', 'Tên')], code = ['code', T('web.preset.vh.code', 'Mã')], act = ['active', T('web.preset.vh.active', 'Trạng thái')];
    function L(id, k, vi, cols) { return { id: id, label: T(k, vi), kind: 'list', cols: cols || [name, code, act] }; }
    return kind === 'taxonomy'
      ? [L('types', 'web.preset.vh.tagTypes', 'Nhóm tag'), L('values', 'web.preset.vh.tagValues', 'Tag')]
      : [L('entities', 'web.preset.vh.entityTypes', 'Loại entity'), L('relations', 'web.preset.vh.relationshipTypes', 'Loại quan hệ'),
        L('triples', 'web.preset.vh.triples', 'Triple', [['name', T('web.preset.vh.triple', 'Nguồn · quan hệ · đích')], act])];
  }
  var pv = null; // the preset whose version popup is open (its footer buttons act on it)
  function closeVersions() { if (window.ECPVH) window.ECPVH.close(); }
  var SUMS = ['Phát hành lần đầu', 'Bổ sung nhóm và tag theo góp ý của Steward', 'Chuẩn hoá mã, ngừng dùng mục trùng lặp', 'Thêm mục cho sản phẩm mới quý IV'];
  function openVersions(o, p, opener, bar) {
    var snap = o.snapshot(p.id) || {}, secs = sections(o.kind), n = p.version, vers = [], on = T('web.preset.vh.on', 'Đang dùng'), off = T('web.preset.vh.off', 'Ngừng dùng');
    var fmt = window.Intl ? new Intl.DateTimeFormat(document.documentElement.lang || 'vi', { dateStyle: 'short', timeStyle: 'short' }) : null;
    // an older version = the newest one less the items added after it (mock); the working state on top when it has changes
    function data(drop) {
      var out = {};
      secs.forEach(function (s) {
        var all = snap[s.id] || [], step = Math.max(1, Math.round(all.length / (n + 3)));
        out[s.id] = all.slice(0, Math.max(0, all.length - drop * step)).map(function (x) { return { id: x.id, name: x.name, code: x.code, active: x.active === false ? off : on }; });
      });
      return out;
    }
    var dirty = p.hasChanges ? 1 : 0;
    if (dirty) vers.push({ v: T('web.preset.vh.currentId', '{v} (hiện tại)', { v: 'v' + n }), status: 'draft', lbl: ['web.preset.vh.unpublishedChanges', 'Chưa phát hành'], by: '', at: '', sum: '', cr: '', data: data(0) });
    for (var k = n; k >= 1; k--) {
      vers.push({ v: 'v' + k, status: k === n ? 'active' : 'superseded', lbl: k === n && dirty ? ['web.preset.vh.initial', 'Phiên bản đầu'] : undefined, by: k % 2 ? 'Nguyễn Lan' : 'Trần Hải', at: fmt ? fmt.format(new Date(2026, 3 + k, 2 + 3 * k, 9 + k, 15)) : '', sum: SUMS[(k - 1) % SUMS.length], cr: '', data: data(n - k + dirty) });
    }
    var id = 'preset-' + o.kind + '-' + p.id;
    window.ECP_VERSIONS = window.ECP_VERSIONS || {};
    // footerAction of the FE popup: "Nhân bản" (a version exists) and "Phát hành" / "Gửi yêu cầu phát hành", disabled while pending / nothing to release
    function foot() {
      var m = modeOf(p), why = p.pending ? T('web.preset.pending', 'Chờ duyệt phát hành · {code}', { code: p.pending }) : !p.hasChanges ? T('web.preset.nothingToRelease', 'Bản nháp không có thay đổi để phát hành') : '';
      return '<span class="kvh-acts">' + (p.version && m ? '<button type="button" class="btn btn-secondary" data-pv="fork">' + esc(T('web.preset.fork', 'Nhân bản')) + '</button>' : '') +
        (m ? '<button type="button" class="btn btn-primary preset-act" data-pv="release"' + (why ? ' disabled aria-disabled="true" title="' + esc(why) + '"' : '') + '>' + esc(m === 'direct' ? T('web.preset.release', 'Phát hành') : T('web.preset.request', 'Gửi yêu cầu phát hành')) + '</button>' : '') + '</span>';
    }
    window.ECP_VERSIONS[id] = { name: p.name, restore: false, sections: secs, versions: vers, foot: foot };
    pv = { bar: bar, o: o, p: p };
    if (window.ECPVH) window.ECPVH.open(id, { opener: opener });
  }

  // ---- Release (PresetReleaseDialog): summary required, at most 300 characters ----
  function openRelease(bar, p, mode) {
    var next = 'v' + ((p.version || 0) + 1), direct = mode === 'direct';
    var d = dialog(direct ? T('web.preset.releaseTitle', 'Phát hành {x} {v}', { x: p.name, v: next }) : T('web.preset.requestTitle', 'Gửi yêu cầu phát hành {x} {v}', { x: p.name, v: next }),
      '<p class="muted text-sm">' + esc(direct ? T('web.preset.releaseHint', 'Bản nháp được phát hành ngay thành version mới. Các KB đang dùng preset giữ version cũ cho tới khi đổi sang version mới.') : T('web.preset.requestHint', 'Yêu cầu được gửi tới Owner của preset (Global: Admin) ở Thay đổi & Phê duyệt. Bản nháp bị khoá cho tới khi được duyệt hoặc từ chối.')) + '</p>' +
      '<label class="bold text-sm" for="preset-rel-sum">' + esc(T('web.preset.summary', 'Tóm tắt thay đổi')) + ' <span class="req">*</span></label>' +
      '<textarea class="input" id="preset-rel-sum" rows="3" aria-required="true" aria-describedby="preset-rel-err"></textarea><p class="field-err" id="preset-rel-err" role="alert" hidden></p>',
      direct ? T('web.preset.release', 'Phát hành') : T('web.preset.request', 'Gửi yêu cầu phát hành'));
    var ta = d.querySelector('textarea');
    ta.addEventListener('input', function () { ta.removeAttribute('aria-invalid'); fieldErr(d, '#preset-rel-err', ''); });
    d.querySelector('[data-pok]').addEventListener('click', function () {
      var s = ta.value.trim();
      if (!s || s.length > SUMMARY_MAX) { ta.setAttribute('aria-invalid', 'true'); fieldErr(d, '#preset-rel-err', T('web.preset.summaryErr', 'Nhập tóm tắt (tối đa {max} ký tự)', { max: N(SUMMARY_MAX) })); ta.focus(); return; }
      if (direct) { p.version = (p.version || 0) + 1; p.hasChanges = false; toast(T('web.preset.released', 'Đã phát hành {x} {v}', { x: p.name, v: 'v' + p.version })); }
      else { p.pending = 'CR-' + (++crSeq); toast(T('web.preset.requested', 'Đã gửi yêu cầu phát hành {code}', { code: p.pending })); }
      d.close(); closeVersions(); bar.render(); bar.changed();
    });
  }

  // ---- Create (PresetCreateDialog): empty, a fork of the selected preset, or from a file (upload → report → name) ----
  function report(kind, file) {
    var bad = /loi|lỗi|error|invalid/i.test(file.name), loc = function (sh, row, col) { return [T('web.preset.imp.sheet', 'Sheet {x}', { x: sh }), T('web.preset.imp.row', 'dòng {n}', { n: N(row) })].concat(col ? [T('web.preset.imp.col', 'cột {x}', { x: col })] : []).join(' · '); };
    var tax = kind === 'taxonomy';
    var issues = bad ? [
      { sev: 'ERROR', loc: loc(tax ? 'Tag' : 'EntityType', 12, 'code'), msg: tax ? 'Mã tag "THE_TD" bị trùng trong nhóm CARD_PRODUCT' : 'Mã entity type "LOAN" bị trùng' },
      { sev: 'ERROR', loc: loc(tax ? 'Tag' : 'Triple', 18, tax ? 'tagTypeCode' : 'targetCode'), msg: tax ? 'Nhóm tag "CARD_TIERS" không có trong file' : 'Entity type đích "COLLATERALS" không có trong file' },
      { sev: 'WARNING', loc: loc(tax ? 'TagType' : 'RelationshipType', 4), msg: 'Thiếu mô tả' }
    ] : [{ sev: 'WARNING', loc: loc(tax ? 'TagType' : 'EntityType', 7), msg: 'Thiếu mô tả' }];
    return { fileName: file.name, valid: !bad, errors: bad ? 2 : 0, warnings: 1, issues: issues,
      counts: tax ? { tagTypes: 6, tagValues: 31 } : { entityTypes: 14, relationshipTypes: 9, triples: 18 } };
  }
  function reportHtml(r) {
    return '<section class="preset-report" aria-labelledby="preset-report-h"><h3 id="preset-report-h" class="bold text-sm">' + esc(T('web.preset.imp.report', 'Kết quả kiểm tra {x}', { x: r.fileName })) + ' <span class="chip ' + (r.valid ? 'chip-success' : 'chip-error') + '">' + esc(r.valid ? T('web.preset.imp.valid', 'Hợp lệ') : T('web.preset.imp.invalid', 'Có lỗi')) + '</span></h3>' +
      '<p class="text-sm" role="status">' + esc(T('web.preset.imp.counts', '{e} lỗi · {w} cảnh báo', { e: N(r.errors), w: N(r.warnings) }) + ' · ' + Object.keys(r.counts).map(function (k) { return k + ' ' + N(r.counts[k]); }).join(' · ')) + '</p>' +
      (r.valid ? '' : '<p class="field-err text-sm">' + esc(T('web.preset.imp.fixAndRetry', 'Sửa các lỗi trong file rồi tải lên lại.')) + '</p>') +
      '<div class="preset-report-scroll"><table class="table table-dense preset-report-table"><caption class="sr-only">' + esc(T('web.preset.imp.issues', 'Lỗi và cảnh báo')) + '</caption><thead><tr><th scope="col">' + esc(T('web.preset.imp.severity', 'Mức độ')) + '</th><th scope="col">' + esc(T('web.preset.imp.location', 'Vị trí')) + '</th><th scope="col">' + esc(T('web.preset.imp.message', 'Nội dung')) + '</th></tr></thead><tbody>' +
      r.issues.map(function (i) { var e = i.sev === 'ERROR'; return '<tr><td><span class="chip ' + (e ? 'chip-error' : 'chip-warning') + '">' + esc(e ? T('web.preset.imp.error', 'Lỗi') : T('web.preset.imp.warning', 'Cảnh báo')) + '</span></td><td class="mono text-sm">' + esc(i.loc) + '</td><td class="text-sm" data-i18n-skip>' + esc(i.msg) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>';
  }
  function openCreate(bar, o, mode) {
    var src = mode === 'fork' ? bar.current() : null, imp = mode === 'import';
    var hint = mode === 'new' ? '<p class="muted text-sm">' + esc(T('web.preset.newHint', 'Preset rỗng chưa chọn được cho KB cho tới khi phát hành version đầu tiên.')) + '</p>'
      : src ? '<p class="muted text-sm">' + esc(T('web.preset.forkHint', 'Bản sao độc lập của {x} {v}, phát hành ngay thành version 1. Thay đổi sau này của {x} không tự chảy vào bản nhân bản.', { x: src.name, v: 'v' + src.version })) + '</p>'
      : '<p class="muted text-sm">' + esc(T('web.preset.imp.hint', 'Tải file lên để kiểm tra. Nội dung hợp lệ thành version 1 của preset mới.')) + '</p>' +
        // template links: the web app downloads the file (bearer token); the mockup has no files behind them
        '<div class="preset-tpl"><span class="text-sm">' + esc(T('web.preset.imp.templates', 'File mẫu:')) + '</span>' + TEMPLATES[o.kind].map(function (f) { return '<button type="button" class="link text-sm">' + esc(f) + '</button>'; }).join('') + '</div>' +
        '<label class="bold text-sm" for="preset-file">' + esc(T('web.preset.imp.file', 'File')) + '</label><input class="input" id="preset-file" type="file" accept="' + ACCEPT[o.kind].map(function (x) { return '.' + x; }).join(',') + '">' +
        '<p class="muted text-sm" role="status" data-pchk hidden>' + esc(T('web.preset.imp.checking', 'Đang kiểm tra file…')) + '</p><div data-prep></div>';
    var d = dialog(mode === 'fork' ? T('web.preset.forkTitle', 'Nhân bản preset {x}', { x: src.name }) : imp ? T('web.preset.import', 'Import từ file') : T('web.preset.new', 'Tạo preset mới'),
      hint + '<div class="preset-form" data-pform' + (imp ? ' hidden' : '') + '><div class="field"><label class="bold text-sm" for="preset-name">' + esc(T('web.preset.name', 'Tên preset')) + ' <span class="req">*</span></label><input class="input" id="preset-name" maxlength="120" aria-required="true" aria-describedby="preset-name-err"><p class="field-err" id="preset-name-err" role="alert" hidden></p></div>' +
        '<div class="field"><label class="bold text-sm" for="preset-desc">' + esc(T('web.preset.description', 'Mô tả')) + '</label><textarea class="input" id="preset-desc" rows="3" maxlength="2000"></textarea></div></div><p class="field-err" data-perr role="alert" hidden></p>',
      mode === 'fork' ? T('web.preset.fork', 'Nhân bản') : T('web.preset.create', 'Tạo preset'));
    var name = d.querySelector('#preset-name'), ok = d.querySelector('[data-pok]'), form = d.querySelector('[data-pform]');
    if (src) name.value = T('web.preset.forkName', '{x} (bản sao)', { x: src.name });
    ok.disabled = imp;
    name.addEventListener('input', function () { name.removeAttribute('aria-invalid'); fieldErr(d, '#preset-name-err', ''); });
    if (imp) d.querySelector('#preset-file').addEventListener('change', function () {
      var f = this.files && this.files[0], input = this, chk = d.querySelector('[data-pchk]'), rep = d.querySelector('[data-prep]');
      if (!f) return;
      rep.innerHTML = ''; form.hidden = true; ok.disabled = true; fieldErr(d, '[data-perr]', '');
      var ext = (f.name.match(/\.([^.]+)$/) || ['', ''])[1].toLowerCase();
      if (ACCEPT[o.kind].indexOf(ext) < 0) { fieldErr(d, '[data-perr]', T('web.preset.imp.badFormat', 'Định dạng file không được hỗ trợ')); input.value = ''; return; }
      if (f.size > MAX_BYTES) { fieldErr(d, '[data-perr]', T('web.preset.imp.tooLarge', 'File lớn hơn 10 MB')); input.value = ''; return; }
      chk.hidden = false; input.disabled = true;
      setTimeout(function () { // mock POST …-presets/imports
        var r = report(o.kind, f);
        chk.hidden = true; input.disabled = false; input.value = ''; // the same (fixed) file can be uploaded again
        rep.innerHTML = reportHtml(r);
        if (r.valid) { form.hidden = false; ok.disabled = false; if (!name.value) name.value = f.name.replace(/\.[^.]+$/, ''); }
      }, 400);
    });
    ok.addEventListener('click', function () {
      var v = name.value.trim();
      if (!v) { name.setAttribute('aria-invalid', 'true'); fieldErr(d, '#preset-name-err', T('web.preset.nameErr', 'Nhập tên preset')); name.focus(); return; }
      if (o.presets.some(function (p) { return p.name.toLowerCase() === v.toLowerCase(); })) { name.setAttribute('aria-invalid', 'true'); fieldErr(d, '#preset-name-err', T('web.preset.nameTaken', 'Tên này đã có preset khác dùng')); name.focus(); return; }
      var p = { id: 'preset-' + (++seq), name: v, kind: 'CUSTOM', version: mode === 'new' ? null : 1, hasChanges: false, pending: null };
      o.presets.push(p);
      if (o.onCreate) o.onCreate(p, mode, src ? src.id : null);
      toast(T('web.preset.created', 'Đã tạo preset {x}', { x: p.name }));
      d.close(); closeVersions(); bar.selectId(p.id);
    });
  }

  // ---- Members (PresetMembersDialog): Owners + Stewards by email / user id; Global's owners are the Admins, so only Stewards ----
  var MEMBERS = {}; // preset id -> { owners: [name], stewards: [name] } (mock)
  function openMembers(p) {
    var glob = p.kind === 'GLOBAL', canEdit = modeOf(p) === 'direct', m = MEMBERS[p.id] || (MEMBERS[p.id] = { owners: glob ? [] : ['Nguyễn Lan'], stewards: ['Phạm Minh'] });
    var own = m.owners.slice(), stw = m.stewards.slice();
    function picker(kind, label, add, req) {
      return '<div class="field" data-pp="' + kind + '"><span class="lbl" id="pp-' + kind + '-lbl">' + esc(label) + (req ? ' <span class="req">*</span>' : '') + '</span><div class="row"><label class="sr-only" for="pp-' + kind + '-in">' + esc(add) + '</label>' +
        '<input class="input grow" id="pp-' + kind + '-in" placeholder="' + esc(T('mk.web.kbc.enterEmailOrId', 'Nhập email hoặc user id…')) + '"' + (canEdit ? '' : ' disabled') + '><button type="button" class="btn btn-secondary" data-pp-add="' + kind + '"' + (canEdit ? '' : ' disabled') + '>' + esc(T('common.add', 'Thêm')) + '</button></div>' +
        '<div class="chip-row" data-chosen="' + kind + '" role="list"></div></div>';
    }
    var d = dialog(T('web.preset.membersTitle', 'Thành viên của {x}', { x: p.name }),
      (glob ? '<p class="muted text-sm">' + esc(T('web.preset.globalOwners', 'Owner của preset Global là các Admin hệ thống.')) + '</p>' : picker('own', 'Owner', T('web.preset.addOwner', 'Thêm Owner'), true)) +
      picker('stw', 'Steward', T('web.preset.addSteward', 'Thêm Steward'), false) +
      (canEdit ? '' : '<p class="muted text-sm" role="note">' + esc(T('web.preset.membersReadOnly', 'Chỉ Owner của preset hoặc Admin được sửa thành viên.')) + '</p>') + '<p class="field-err" data-perr role="alert" hidden></p>',
      T('common.save', 'Lưu'));
    d.classList.remove('is-md'); // FE size="lg" = the default width
    function draw() {
      [['own', own], ['stw', stw]].forEach(function (x) {
        var box = d.querySelector('[data-chosen="' + x[0] + '"]'); if (!box) return;
        box.innerHTML = x[1].length ? x[1].map(function (n, i) { return '<span class="chip chip-neutral chip-pick" role="listitem" data-i18n-skip>' + esc(n) + (canEdit ? '<button type="button" class="chip-x" data-pp-rm="' + x[0] + ':' + i + '" aria-label="' + esc(T('kbc.removeX', 'Bỏ {x}', { x: n })) + '">×</button>' : '') + '</span>'; }).join('') : '<span class="muted text-xs">' + esc(T('kbc.noneSelected', 'Chưa chọn')) + '</span>';
      });
    }
    draw();
    d.addEventListener('click', function (e) {
      var a = e.target.closest('[data-pp-add]'), r = e.target.closest('[data-pp-rm]');
      if (a) { var k = a.getAttribute('data-pp-add'), inp = d.querySelector('#pp-' + k + '-in'), v = inp.value.trim(); if (v && (k === 'own' ? own : stw).indexOf(v) < 0) (k === 'own' ? own : stw).push(v); inp.value = ''; fieldErr(d, '[data-perr]', ''); draw(); }
      if (r) { var q = r.getAttribute('data-pp-rm').split(':'); (q[0] === 'own' ? own : stw).splice(+q[1], 1); draw(); }
    });
    var ok = d.querySelector('[data-pok]'); ok.hidden = !canEdit;
    ok.addEventListener('click', function () {
      if (!glob && !own.length) { fieldErr(d, '[data-perr]', T('web.preset.ownerRequired', 'Preset cần ít nhất một Owner')); return; }
      m.owners = own; m.stewards = stw; toast(T('web.preset.membersSaved', 'Đã lưu thành viên')); d.close();
    });
  }

  function mount(host, o) {
    var sel = document.createElement('select'), lbl = document.createElement('label');
    host.classList.add('preset-bar'); host.setAttribute('data-kind', o.kind); host.innerHTML = '';
    lbl.className = 'sr-only'; lbl.htmlFor = sel.id = 'preset-' + o.kind; sel.className = 'input job-sel';
    host.appendChild(lbl); host.appendChild(sel);
    // the selected preset is the select's value (a page may set it from a deep link, then call render())
    var want = null; // selectId(): a preset that has no option yet
    function P() { var id = want || sel.value || o.value; return o.presets.filter(function (p) { return p.id === id; })[0]; }
    function item(act, label, off, danger) { return '<button type="button" class="menu-item' + (danger ? ' is-danger' : '') + '" role="menuitem" data-pa="' + act + '"' + (off ? ' disabled aria-disabled="true"' : '') + '>' + esc(label) + '</button>'; }
    var bar = {
      select: sel,
      current: P,
      markChanged: function () { var p = P(); if (p) p.hasChanges = true; },
      changed: function () { if (o.onRelease) o.onRelease(P()); },
      render: function () {
        var p = P(), m = modeOf(p), cur = p.id;
        lbl.textContent = T('web.preset.label', 'Preset');
        sel.innerHTML = o.presets.map(function (x) { return '<option value="' + esc(x.id) + '" data-i18n-skip' + (x.id === cur ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
        while (sel.nextSibling) host.removeChild(sel.nextSibling);
        if (o.crumb) { renderCrumb(p, m); return; }
        host.insertAdjacentHTML('beforeend',
          (m ? '<button type="button" class="btn btn-primary btn-sm preset-act" data-pa="release">' + esc(m === 'direct' ? T('web.preset.release', 'Phát hành') : T('web.preset.request', 'Gửi yêu cầu phát hành')) + '</button>' : '') +
          '<details class="preset-menu preset-ver"><summary class="btn btn-secondary btn-sm" aria-haspopup="menu">' + esc(p.version ? 'v' + p.version : T('web.preset.unpublished', 'chưa phát hành')) + ' ▾</summary><div class="menu" role="menu">' +
            item('versions', T('web.preset.viewVersions', 'Xem phiên bản'), !p.version) + '<div class="menu-sep" role="separator"></div>' +
            item('fork', T('web.preset.fork', 'Nhân bản'), !p.version) + item('import', T('web.preset.import', 'Import từ file')) + '<div class="menu-sep" role="separator"></div>' +
            item('new', T('web.preset.new', 'Tạo preset mới')) + (p.kind === 'CUSTOM' ? item('archive', T('web.preset.archive', 'Lưu trữ'), false, true) : '') +
          '</div></details>' +
          (p.pending ? '<span class="chip chip-warning" role="status">' + esc(T('web.preset.pending', 'Chờ duyệt phát hành · {code}', { code: p.pending })) + '</span>' : ''));
      },
      // switch preset programmatically (after create / archive): pages hear the select's change event
      selectId: function (id) { want = id; bar.render(); want = null; sel.dispatchEvent(new Event('change')); }
    };
    // FE host breadcrumb (config-shell presetCrumb): « {preset ▾} [vN] » — the menu lists the other presets, then Tạo preset mới, Import từ file,
    // Thành viên (Owner / Admin) and Lưu trữ (custom preset); the vN pill opens the version popup (Nhân bản / Phát hành are in its footer).
    // o.crumb = the element after the page crumb; o.pending = element for the "Chờ duyệt phát hành" chip (shown only while pending)
    var CHEV = '<svg class="crumb-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
    function renderCrumb(p, m) {
      var others = o.presets.filter(function (x) { return x.id !== p.id; });
      o.crumb.innerHTML = '<span class="crumb-menu"><button type="button" class="crumb-current crumb-menu-btn" aria-haspopup="menu" aria-expanded="false" data-pc-toggle><span data-i18n-skip>' + esc(p.name) + '</span>' + CHEV + '</button><div class="menu" role="menu" hidden>' +
        others.map(function (x) { return '<button type="button" class="menu-item" role="menuitem" data-pc-id="' + esc(x.id) + '" data-i18n-skip>' + esc(x.name) + '</button>'; }).join('') + (others.length ? '<div class="menu-sep" role="separator"></div>' : '') +
        item('new', T('web.preset.new', 'Tạo preset mới')) + item('import', T('web.preset.import', 'Import từ file')) +
        (m === 'direct' ? item('members', T('web.preset.members', 'Thành viên')) : '') + (p.kind === 'CUSTOM' && m === 'direct' ? item('archive', T('web.preset.archive', 'Lưu trữ')) : '') + '</div></span>' +
        '<button type="button" class="chip chip-info crumb-badge" data-pa="versions" aria-label="' + esc(T('web.preset.viewVersions', 'Xem phiên bản')) + '">' + esc(p.version ? 'v' + p.version : T('web.preset.unpublished', 'chưa phát hành')) + '</button>';
      if (o.pending) { o.pending.hidden = !p.pending; o.pending.innerHTML = p.pending ? '<span class="chip chip-warning" role="status">' + esc(T('web.preset.pending', 'Chờ duyệt phát hành · {code}', { code: p.pending })) + '</span>' : ''; }
    }
    sel.addEventListener('change', function () { bar.render(); if (o.onChange) o.onChange(sel.value); });
    function archive(p) {
      var d = dialog(T('web.preset.archiveTitle', 'Lưu trữ preset {x}?', { x: p.name }), '<p>' + esc(T('web.preset.archiveBody', 'Không hoàn tác được. KB đang dùng giữ version đã chọn, nhưng preset không chọn, nhân bản hay đổi sang được nữa.')) + '</p>', T('web.preset.archive', 'Lưu trữ'), true);
      d.querySelector('[data-pok]').addEventListener('click', function () {
        o.presets.splice(o.presets.indexOf(p), 1);
        toast(T('web.preset.archived', 'Đã lưu trữ {x}', { x: p.name }));
        d.close(); bar.selectId(o.presets.filter(function (x) { return x.kind === 'GLOBAL'; })[0].id);
      });
    }
    function closeCrumbMenu() { if (!o.crumb) return; var mn = o.crumb.querySelector('.crumb-menu > .menu'); if (mn) mn.hidden = true; var bt = o.crumb.querySelector('[data-pc-toggle]'); if (bt) bt.setAttribute('aria-expanded', 'false'); }
    function onAct(e) {
      var pc = e.target.closest('[data-pc-id]');
      if (pc) { closeCrumbMenu(); sel.value = pc.getAttribute('data-pc-id'); bar.render(); if (o.onChange) o.onChange(sel.value); return; }
      var tg = e.target.closest('[data-pc-toggle]');
      if (tg) { var mn = tg.parentNode.querySelector('.menu'); mn.hidden = !mn.hidden; tg.setAttribute('aria-expanded', String(!mn.hidden)); return; }
      var b = e.target.closest('[data-pa]'); if (!b || b.disabled) return;
      var p = P(), a = b.getAttribute('data-pa'), det = host.querySelector('details.preset-menu');
      closeCrumbMenu();
      if (det) det.open = false;
      if (a === 'release') { if (p.pending) toast(T('web.preset.pending', 'Chờ duyệt phát hành · {code}', { code: p.pending })); else if (!p.hasChanges) toast(T('web.preset.nothingToRelease', 'Bản nháp không có thay đổi để phát hành')); else openRelease(bar, p, modeOf(p)); }
      else if (a === 'versions') openVersions(o, p, det ? det.querySelector('summary') : b, bar);
      else if (a === 'archive') archive(p);
      else if (a === 'members') openMembers(p);
      else openCreate(bar, o, a);
    }
    host.addEventListener('click', onAct);
    if (o.crumb) {
      o.crumb.addEventListener('click', onAct);
      o.crumb.addEventListener('keydown', function (e) { var mn = o.crumb.querySelector('.crumb-menu > .menu:not([hidden])'); if (e.key === 'Escape' && mn) { closeCrumbMenu(); o.crumb.querySelector('[data-pc-toggle]').focus(); e.stopPropagation(); } });
      document.addEventListener('click', function (e) { if (!o.crumb.contains(e.target)) closeCrumbMenu(); });
    }
    // the menu closes on Escape (focus back on "v2 ▾") and on a click outside
    host.addEventListener('keydown', function (e) { var det = host.querySelector('details.preset-menu[open]'); if (e.key === 'Escape' && det) { det.open = false; det.querySelector('summary').focus(); e.stopPropagation(); } });
    document.addEventListener('click', function (e) { var det = host.querySelector('details.preset-menu[open]'); if (det && !det.contains(e.target)) det.open = false; });
    new MutationObserver(function () { bar.render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-role'] });
    if (window.ECP_I18N && window.ECP_I18N.onChange) window.ECP_I18N.onChange(function () { bar.render(); });
    bar.render();
    return bar;
  }
  // the version popup's footer buttons (FE footerAction): the preset whose popup is open is `pv`
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pv]'); if (!b || b.disabled || !pv) return;
    if (b.getAttribute('data-pv') === 'fork') openCreate(pv.bar, pv.o, 'fork');
    else openRelease(pv.bar, pv.p, modeOf(pv.p));
  });
  window.ECP_PRESETS = { mount: mount };
})();
