/* ECP mockups: change-request store for Thay đổi & Phê duyệt (changes-approval-v2.html) and the manual submit flow (cr-submit.js).
 * Stands in for the governance service (services/governance, contracts/openapi/governance.yaml is still empty), so every rule the
 * service must enforce is enforced here, in one place, and the pages only render what this store returns:
 * - Request IDs are fixed in the data (CR-0xx, same series as CR-031 in versions.js); new ones take the next number in the store.
 * - Each request keeps the version of every object it was created from (base). Before any decision is applied, decide()
 *   re-reads the stored state, re-checks status, permission (Admin; KB Owner; or the Steward the Owner assigned this request to)
 *   and those versions, then writes once. A request that is no longer pending can't be decided again.
 * - The Owner (or Admin) assigns a pending request to one Steward of its KB, one at a time or in bulk; assigning again replaces
 *   the Steward, and the Owner can take it back. The Owner keeps the right to decide.
 * - Separate fields, never merged: summary (what changes; the list title), reason (why, typed by a person, required on manual
 *   submit), rationale (why the Agent recommends it), evidence (sources), decision.note (reviewer's reject reason / edit note).
 *   Agent requests have no reason unless a person adds one when submitting; none is ever made up.
 * - Evidence items reference a source by key with the source version and location captured at creation. The source's current
 *   version, page and access are resolved when shown, so old evidence is never silently replaced by newer content.
 * - Applying a change bumps the target's version; other pending requests built on the old version become Superseded.
 * - Verification (KBs with verifyTracked only): a taxonomy / ontology object of such a KB is Verified only once an approved
 *   evolution request that lists it (op.ref) has been applied; the record keeps the version, request, approver and time.
 *   Rejected, superseded or failed requests never write one, and an applied edit replaces the record only on apply.
 * - Every step is a structured audit event (actor, role, rights used, versions, original / final payload, outcome); texts shown
 *   to people are built from these structures at render time in the current language.
 * Prototype only: state lives in this browser (localStorage), so two tabs show real concurrent decisions;
 * ?mock=reset restores the sample data. Sample content (documents, quotes, rationale) stays Vietnamese like other mock data. */
(function () {
  var KB = window.ECP_KB, I = window.ECP_I18N;
  var KEY = 'ecp-cr-mock-5';
  function T(k, a) { var vi = I && I.dict.vi[k] !== undefined ? I.dict.vi[k] : k; return I ? I.tr(k, vi, a) : vi; }
  function lang() { return I && I.lang === 'en' ? 'en' : 'vi'; }
  function loc(v) { return v && typeof v === 'object' ? (v[lang()] || v.vi) : v; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var ADMIN = { id: 'sysadmin', name: 'System Admin' }, AGENT = { id: 'agent', name: 'Agent' }, SYSTEM = { id: 'system', name: 'System' };

  // ---------- sample data: objects under change (current state) ----------
  // doc: ver = content version, mver = metadata revision. processing: a Transformation Job is rebuilding it, so it can't be written.
  var TARGETS = {
    'doc-qt-hdtd': { kind: 'doc', kb: 'credit-corp', name: 'Quy trình phê duyệt tín dụng cấp Hội đồng', code: 'TD-QT-0412', ver: 'v3.0', updated: '2026-03-03T15:30', src: 'Khối Tín dụng', auth: true,
      text: ['Điều 3. Thẩm quyền của Hội đồng tín dụng', '3.1. Hội đồng tín dụng phê duyệt khoản cấp tín dụng từ 20 tỷ đồng đến 50 tỷ đồng/khách hàng.', '3.2. Khoản trên 50 tỷ đồng trình Hội đồng tín dụng cấp 2.',
        'Điều 4. Họp và biểu quyết', '4.1. Phiên họp hợp lệ khi có tối thiểu 1/2 thành viên tham dự, trong đó có Chủ tịch hoặc người được ủy quyền.', '4.2. Quyết định được thông qua khi trên 50% thành viên dự họp biểu quyết tán thành.'] },
    'doc-qd-tdkhdn': { kind: 'doc', kb: 'credit-corp', name: 'Quy định cấp tín dụng đối với KHDN', code: 'TD-QD-0208', ver: 'v2.3', updated: '2026-10-02T08:15', src: 'Khối Tín dụng', auth: true,
      text: ['Điều 8. Hạn mức tín dụng', '8.1. Mức hạn mức tín dụng tối đa cho doanh nghiệp SME không vượt quá 15% vốn tự có của ngân hàng và phải được Hội đồng tín dụng phê duyệt đối với khoản vượt ngưỡng.',
        '8.2. Giám đốc chi nhánh được phê duyệt khoản cấp tín dụng có tổng hạn mức đến 30 tỷ đồng/khách hàng.', '8.3. Khoản vượt thẩm quyền của Giám đốc chi nhánh trình Hội đồng tín dụng theo Phụ lục phân cấp thẩm quyền.'],
      mver: 'm3', meta: {} },
    'doc-hd-vld': { kind: 'doc', kb: 'credit-corp', name: 'Hướng dẫn thẩm định hồ sơ vay vốn lưu động', code: 'TD-HD-0117', ver: 'v1.7', updated: '2026-10-01T16:20', src: 'Khối Tín dụng', auth: true,
      text: ['Mục 1. Phạm vi và quy trình', '1.1. Áp dụng cho hồ sơ vay vốn lưu động của khách hàng doanh nghiệp lớn và SME.', '1.2. Quy trình gồm tiếp nhận, thẩm định, phê duyệt, giải ngân và giám sát sau giải ngân.',
        'Mục 2. Nội dung thẩm định', '2.1. Đánh giá năng lực pháp lý, tình hình tài chính 2 năm gần nhất và phương án sử dụng vốn.', '2.2. Xác định nhu cầu vốn lưu động theo vòng quay vốn và kế hoạch kinh doanh.', '2.3. Thời hạn thẩm định tối đa 5 ngày làm việc kể từ khi nhận đủ hồ sơ.'],
      mver: 'm5', meta: { eff: '01/10/2026', dept: 'Khối Khách hàng doanh nghiệp', product: 'Vay vốn lưu động', state: 'Đang hiệu lực', replaces: '—' } },
    'doc-dg-tsbd': { kind: 'doc', kb: 'credit-corp', name: 'Định giá tài sản bảo đảm', code: 'TD-HD-0233', ver: 'v1.3', updated: '2026-08-12T10:00', src: 'Khối Quản lý rủi ro', auth: true,
      mver: 'm2', meta: { eff: '12/08/2026', dept: 'Khối Quản lý rủi ro', product: 'Cho vay SME', state: 'Đang hiệu lực', replaces: '—' } },
    'doc-dt-sme': { kind: 'doc', kb: 'credit-corp', name: 'Đào tạo: Sản phẩm tín dụng SME 2024', code: 'TD-DT-0051', ver: 'v3.0', updated: '2026-06-02T09:00', src: 'Khối Tín dụng', auth: true,
      processing: { job: '4826' },
      text: ['Bài 2. Sản phẩm cho vay SME', '2.1. Hạn mức tín chấp tối đa 3 tỷ đồng/khách hàng.', '2.2. Thời hạn cho vay vốn lưu động tối đa 12 tháng.'] },
    'doc-kyc-khdn': { kind: 'doc', kb: 'kyc-aml', name: 'Quy trình KYC khách hàng doanh nghiệp', code: 'KYC-QT-0008', ver: 'v8', updated: '2024-03-12T09:00', src: 'Khối Vận hành', auth: false,
      text: ['Điều 6. Cập nhật hồ sơ', '6.2. Khách hàng rủi ro thấp được cập nhật hồ sơ định kỳ 24 tháng/lần.'] },
    'doc-kyc-policy': { kind: 'doc', kb: 'kyc-aml', name: 'Chính sách KYC/AML', code: 'KYC-CS-0001', ver: 'v14', updated: '2026-08-15T10:30', src: 'Khối Pháp chế & Tuân thủ', auth: true,
      text: ['Điều 11. Cập nhật thông tin khách hàng', '11.3. Mọi khách hàng doanh nghiệp phải được cập nhật hồ sơ định kỳ 12 tháng/lần, không phân biệt mức rủi ro.'] },
    'doc-kyc-ekyc': { kind: 'doc', kb: 'kyc-aml', name: 'Hướng dẫn eKYC khách hàng cá nhân', code: 'KYC-HD-0031', ver: 'v3', updated: '2025-11-20T14:00', src: 'Khối Pháp chế & Tuân thủ', auth: true,
      mver: 'm4', meta: { eff: '20/11/2025', dept: 'Khối Pháp chế & Tuân thủ', product: 'Tài khoản thanh toán', state: 'Đang hiệu lực', replaces: '—' } },
    'doc-t24-ops': { kind: 'doc', kb: 'core-banking', name: 'Sổ tay vận hành T24 (phần 3)', code: 'CB-ST-0303', ver: 'v41', updated: '2026-09-28T11:00', src: 'Khối Vận hành', auth: true,
      text: ['Chương 5. Hạch toán', '5.3. Giao dịch viên hạch toán bút toán theo mã giao dịch tương ứng.', '5.4. Bút toán sai được hủy trong ngày bằng giao dịch đảo.'] },
    'ontology-global': { kind: 'ontology', kb: 'credit-corp', name: 'Ontology Global', code: 'ONT-GLOBAL', ver: 'v4', updated: '2026-03-20T14:30', href: 'config-ontology.html?mode=studio' },
    'tax-LOAN_TYPE': { kind: 'taxonomy', kb: 'credit-corp', name: 'Taxonomy · Loại khoản vay', code: 'TAX-LOAN_TYPE', ver: 'r12', updated: '2026-09-02T10:00', href: 'config-taxonomy.html?node=LOAN_TYPE' },
    // tag set and ontology of the new KB Sản phẩm thẻ tín dụng, as the Agent generated them on ingestion
    'tax-card': { kind: 'taxonomy', kb: 'card', name: 'Taxonomy · Sản phẩm thẻ tín dụng', code: 'TAX-CARD', ver: 'r1', updated: '2026-10-14T16:20', href: 'config-taxonomy.html?scope=the-tin-dung' },
    'ontology-card': { kind: 'ontology', kb: 'card', name: 'Ontology · Sản phẩm thẻ tín dụng', code: 'ONT-CARD', ver: 'v1', updated: '2026-10-14T16:20', href: 'config-ontology.html?kb=the' }
  };
  // other documents in Enterprise Context Platform that evidence can cite (no change requests on them). Every cited document is in ECP.
  var SOURCES = {
    'doc-qc-cv': { kb: 'credit-corp', name: 'Quy chế cho vay đối với khách hàng doanh nghiệp', code: 'TD-QC-0004', ver: 'v4.0' },
    'doc-mau-tt': { kb: 'credit-corp', name: 'Mẫu tờ trình đề xuất hạn mức', code: 'TD-MB-0019', ver: 'v2.0' },
    'doc-cs-the26': { kb: 'card', name: 'Chính sách sản phẩm thẻ và tín chấp 2026', code: 'TH-CS-0007', ver: 'v1.0' },
    'doc-kyc-ekyc4': { kb: 'kyc-aml', name: 'Hướng dẫn eKYC khách hàng cá nhân (bản 2026)', code: 'KYC-HD-0044', ver: 'v4' },
    'doc-tb-vh07': { kb: 'core-banking', name: 'Thông báo vận hành 07/2026', code: 'CB-TB-0712', ver: 'v1' },
    'doc-qd-td08': { kb: 'credit-corp', name: 'Quyết định QĐ-2026/TD-08', code: 'TD-QD-0226', ver: 'v1.0' },
    'doc-nq-hdqt09': { kb: 'credit-corp', name: 'Nghị quyết HĐQT 09/2026', code: 'TD-NQ-0009', ver: 'v1.0' }
  };
  // vi labels are the stored field names; the page shows them through i18n (cr.f.*)
  var META_KEYS = ['eff', 'expire', 'dept', 'product', 'state', 'replaces', 'doctype', 'source', 'owner', 'steward', 'tags'];

  // ---------- sample requests ----------
  // summary {vi, en}: what changes, written by the proposer (the Agent writes both languages; a person types one).
  // evidence: { src (TARGETS / SOURCES key), ver, loc, quote }
  var REQUESTS = [
    { id: 'CR-036', type: 'content', kb: 'credit-corp', target: 'doc-qt-hdtd', by: 'th', at: '2026-10-14T09:40', assignee: null,
      summary: { vi: 'Điều chỉnh ngưỡng phê duyệt của Hội đồng tín dụng', en: 'Adjust the Credit Council approval threshold' },
      reason: 'Đồng bộ với Điều 8.2 Quy định cấp tín dụng đối với KHDN v2.3: Giám đốc chi nhánh đã được phê duyệt đến 30 tỷ đồng, nên Hội đồng tín dụng bắt đầu từ 30 tỷ đồng.',
      evidence: [
        { src: 'doc-qd-tdkhdn', ver: 'v2.3', loc: 'Điều 8.2', quote: 'Giám đốc chi nhánh được phê duyệt khoản cấp tín dụng có tổng hạn mức đến 30 tỷ đồng/khách hàng.' },
        { src: 'doc-qd-tdkhdn', ver: 'v2.3', loc: 'Trang 12 · Điều 8', quote: 'Mức hạn mức tín dụng tối đa cho doanh nghiệp SME không vượt quá 15% vốn tự có của ngân hàng và phải được Hội đồng tín dụng phê duyệt đối với khoản vượt ngưỡng.' }],
      base: { 'doc-qt-hdtd': 'v3.0' }, to: 'v3.1',
      proposed: ['Điều 3. Thẩm quyền của Hội đồng tín dụng', '3.1. Hội đồng tín dụng phê duyệt khoản cấp tín dụng từ 30 tỷ đồng đến 50 tỷ đồng/khách hàng.', '3.2. Khoản trên 50 tỷ đồng trình Hội đồng tín dụng cấp 2.',
        'Điều 4. Họp và biểu quyết', '4.1. Phiên họp hợp lệ khi có tối thiểu 2/3 thành viên tham dự, trong đó có Chủ tịch hoặc người được ủy quyền.', '4.2. Quyết định được thông qua khi trên 50% thành viên dự họp biểu quyết tán thành.', '4.3. Biên bản họp được ký trong vòng 1 ngày làm việc và lưu trên hệ thống.'] },
    { id: 'CR-038', type: 'content', kb: 'credit-corp', target: 'doc-hd-vld', by: 'agent', at: '2026-10-15T08:05', conf: 0.86, assignee: 'th', assignedBy: 'nl', assignedAt: '2026-10-15T10:00',
      summary: { vi: 'Rút thời hạn thẩm định hồ sơ SME', en: 'Shorten SME application appraisal time' },
      rationale: 'Agent phát hiện Quyết định QĐ-2026/TD-08 (hiệu lực 15/10/2026) quy định thời hạn thẩm định riêng cho hồ sơ SME có hạn mức dưới 5 tỷ đồng, chưa có trong hướng dẫn.',
      evidence: [{ src: 'doc-qd-td08', ver: 'v1.0', loc: 'Điều 4', quote: 'Hồ sơ vay vốn lưu động của khách hàng SME có hạn mức dưới 5 tỷ đồng được thẩm định trong tối đa 03 ngày làm việc.' }],
      base: { 'doc-hd-vld': 'v1.7' }, to: 'v1.8',
      proposed: ['Mục 1. Phạm vi và quy trình', '1.1. Áp dụng cho hồ sơ vay vốn lưu động của khách hàng doanh nghiệp lớn và SME.', '1.2. Quy trình gồm tiếp nhận, thẩm định, phê duyệt, giải ngân và giám sát sau giải ngân.',
        'Mục 2. Nội dung thẩm định', '2.1. Đánh giá năng lực pháp lý, tình hình tài chính 2 năm gần nhất và phương án sử dụng vốn.', '2.2. Xác định nhu cầu vốn lưu động theo vòng quay vốn và kế hoạch kinh doanh.',
        '2.3. Thời hạn thẩm định tối đa 5 ngày làm việc kể từ khi nhận đủ hồ sơ; hồ sơ SME có hạn mức dưới 5 tỷ đồng tối đa 3 ngày làm việc.'] },
    { id: 'CR-039', type: 'content', kb: 'credit-corp', target: 'doc-hd-vld', by: 'agent', at: '2026-10-15T09:20', conf: 0.79, assignee: null,
      summary: { vi: 'Cập nhật tần suất giám sát sau giải ngân', en: 'Update post-disbursement monitoring frequency' },
      rationale: 'Agent đối chiếu Quy chế cho vay đối với KHDN v4.0 (Điều 21): giám sát sau giải ngân định kỳ 3 tháng/lần, hướng dẫn hiện chưa ghi tần suất.',
      evidence: [{ src: 'doc-qc-cv', ver: 'v4.0', loc: 'Điều 21', quote: 'Kiểm tra, giám sát việc sử dụng vốn vay định kỳ tối thiểu 03 tháng/lần.' }],
      base: { 'doc-hd-vld': 'v1.7' }, to: 'v1.8',
      proposed: ['Mục 1. Phạm vi và quy trình', '1.1. Áp dụng cho hồ sơ vay vốn lưu động của khách hàng doanh nghiệp lớn và SME.', '1.2. Quy trình gồm tiếp nhận, thẩm định, phê duyệt, giải ngân và giám sát sau giải ngân định kỳ 3 tháng/lần.',
        'Mục 2. Nội dung thẩm định', '2.1. Đánh giá năng lực pháp lý, tình hình tài chính 2 năm gần nhất và phương án sử dụng vốn.', '2.2. Xác định nhu cầu vốn lưu động theo vòng quay vốn và kế hoạch kinh doanh.', '2.3. Thời hạn thẩm định tối đa 5 ngày làm việc kể từ khi nhận đủ hồ sơ.'] },
    { id: 'CR-040', type: 'meta', kb: 'credit-corp', target: 'doc-hd-vld', by: 'agent', at: '2026-10-15T09:25', conf: 0.91, assignee: 'th', assignedBy: 'nl', assignedAt: '2026-10-15T10:00',
      summary: { vi: 'Bổ sung sản phẩm Cho vay SME', en: 'Add the SME lending product' },
      rationale: 'Agent đọc lại trang 1 và Mục 1.1: văn bản áp dụng cho cả SME và thay thế Hướng dẫn số 117/2024, nhưng metadata chưa ghi.',
      evidence: [{ src: 'doc-hd-vld', ver: 'v1.7', loc: 'Trang 1', quote: 'Hướng dẫn này thay thế Hướng dẫn số 117/2024/HD-TD.' },
        { src: 'doc-hd-vld', ver: 'v1.7', loc: 'Mục 1.1', quote: 'Áp dụng cho hồ sơ vay vốn lưu động của khách hàng doanh nghiệp lớn và SME.' }],
      base: { 'doc-hd-vld#meta': 'm5' }, to: 'm6',
      fields: { product: 'Vay vốn lưu động; Cho vay SME', replaces: 'Hướng dẫn 117/2024/HD-TD' } },
    { id: 'CR-041', type: 'meta', kb: 'credit-corp', target: 'doc-dg-tsbd', by: 'th', at: '2026-10-13T16:10', assignee: null,
      summary: { vi: 'Cập nhật ngày hiệu lực và phòng ban chủ trì', en: 'Update effective date and owning department' },
      reason: 'Bản ký ngày 15/09/2026 có hiệu lực từ 01/10/2026; Khối Tín dụng cùng chủ trì theo Điều 2.',
      evidence: [], base: { 'doc-dg-tsbd#meta': 'm2' }, to: 'm3',
      fields: { eff: '01/10/2026', dept: 'Khối Quản lý rủi ro; Khối Tín dụng' } },
    { id: 'CR-042', type: 'conflict', kb: 'kyc-aml', by: 'agent', at: '2026-10-11T10:00', conf: 0.88, assignee: 'th', assignedBy: 'nl', assignedAt: '2026-10-11T14:00',
      summary: { vi: 'Xung đột về chu kỳ cập nhật hồ sơ KYC', en: 'Conflict on KYC review frequency' },
      topic: 'Chu kỳ cập nhật hồ sơ KYC của khách hàng doanh nghiệp rủi ro thấp',
      rationale: 'Hai văn bản trong cùng tri thức quy định khác nhau: 24 tháng/lần (A) và 12 tháng/lần cho mọi khách hàng doanh nghiệp (B).',
      a: { target: 'doc-kyc-khdn', loc: 'Điều 6.2', passage: '6.2. Khách hàng rủi ro thấp được cập nhật hồ sơ định kỳ 24 tháng/lần.' },
      b: { target: 'doc-kyc-policy', loc: 'Điều 11.3', passage: '11.3. Mọi khách hàng doanh nghiệp phải được cập nhật hồ sơ định kỳ 12 tháng/lần, không phân biệt mức rủi ro.' },
      rec: 'b', recWhy: 'B mới hơn (15/08/2026) và do nguồn được ủy quyền ban hành (Khối Pháp chế & Tuân thủ); A do Khối Vận hành ban hành năm 2024.',
      base: { 'doc-kyc-khdn': 'v8', 'doc-kyc-policy': 'v14' } },
    { id: 'CR-043', type: 'conflict', kb: 'credit-corp', by: 'agent', at: '2026-10-14T11:30', conf: 0.92, assignee: null,
      summary: { vi: 'Xung đột về thẩm quyền phê duyệt', en: 'Conflict on approval authority' },
      topic: 'Ai phê duyệt khoản cấp tín dụng từ 20 đến 30 tỷ đồng/khách hàng',
      rationale: 'A giao khoản từ 20 tỷ đồng cho Hội đồng tín dụng; B cho Giám đốc chi nhánh phê duyệt đến 30 tỷ đồng. Khoản 20–30 tỷ đồng đang thuộc thẩm quyền của cả hai.',
      a: { target: 'doc-qt-hdtd', loc: 'Điều 3.1', passage: '3.1. Hội đồng tín dụng phê duyệt khoản cấp tín dụng từ 20 tỷ đồng đến 50 tỷ đồng/khách hàng.' },
      b: { target: 'doc-qd-tdkhdn', loc: 'Điều 8.2', passage: '8.2. Giám đốc chi nhánh được phê duyệt khoản cấp tín dụng có tổng hạn mức đến 30 tỷ đồng/khách hàng.' },
      rec: 'b', recWhy: 'B mới hơn (02/10/2026), cùng nguồn được ủy quyền (Khối Tín dụng). CR-036 đang đề xuất sửa A theo B.',
      base: { 'doc-qt-hdtd': 'v3.0', 'doc-qd-tdkhdn': 'v2.3' } },
    { id: 'CR-031', type: 'evo', kind: 'ontology', kb: 'credit-corp', target: 'ontology-global', by: 'th', at: '2026-09-28T09:15', conf: 0.82, assignee: null,
      summary: { vi: 'Bổ sung Tài sản bảo đảm và quan hệ “bảo đảm cho”', en: 'Add Collateral and the “secures” relation' },
      rationale: 'Drift: 42 entity trong 9 tài liệu mới của Quy trình tín dụng doanh nghiệp không khớp entity type nào, phần lớn là tài sản bảo đảm.',
      reason: 'Cần mô hình hóa tài sản bảo đảm trước khi đưa 9 tài liệu mới về TSBĐ vào tri thức; quan hệ “thế chấp” hiện gắn sai giữa Khách hàng và Sản phẩm.',
      evidence: [
        { src: 'doc-dg-tsbd', ver: 'v1.3', loc: 'Trang 3', quote: 'Tài sản bảo đảm gồm quyền đòi nợ, bất động sản và hàng tồn kho luân chuyển, được định giá lại tối thiểu 6 tháng/lần.' },
        { src: 'doc-mau-tt', ver: 'v2.0', loc: 'Mục 4', quote: 'Tài sản bảo đảm: loại tài sản, giá trị định giá, tỷ lệ cho vay trên giá trị TSBĐ.' }],
      links: [['Collateral · Tài sản bảo đảm', 'config-ontology.html?mode=studio&sel=t-tsbd'], ['Product · Sản phẩm tín dụng', 'config-ontology.html?mode=studio&sel=t-sp-td'], ['Customer · Khách hàng', 'config-ontology.html?mode=studio&sel=t-kh-sme']],
      base: { 'ontology-global': 'v4' }, to: 'v5', scope: 'Ontology Global (mọi tri thức kế thừa) + Quy trình tín dụng doanh nghiệp',
      ontology: [
        { op: 'add', part: 'Entity type', name: 'Collateral (Tài sản bảo đảm)', cur: '—', next: 'Thuộc tính: loại tài sản, giá trị định giá, ngày định giá', links: 'Product' },
        { op: 'add', part: 'Quan hệ', name: 'bảo đảm cho', cur: '—', next: 'Collateral → Product · bản số 1..n', links: 'Collateral, Product' },
        { op: 'edit', part: 'Thuộc tính', name: 'Product · hạn mức', cur: 'hạn mức', next: 'hạn mức (đơn vị: VND), bắt buộc khi trích xuất', links: 'Product' },
        { op: 'del', part: 'Quan hệ', name: 'thế chấp', cur: 'Customer → Product · Active', next: 'Deprecated · alias của “bảo đảm cho”', links: 'Customer, Product' }],
      structure: [['Collateral', 'bảo đảm cho', 'Product', 'add'], ['Customer', 'thế chấp', 'Product', 'del'], ['Policy', 'áp dụng', 'Product', ''], ['Product', '(thuộc tính) hạn mức · VND', '', 'edit']],
      impact: { docs: 28, artifacts: 31, nodes: 820, edges: 204, why: 'Các tài liệu này có node gắn quan hệ “thế chấp” hoặc thuộc tính hạn mức; node được gắn lại sang “bảo đảm cho”, artifact FAQ/Wiki/SOP sinh từ các node đó được cập nhật lại.',
        list: [['doc-dg-tsbd', 'v1.3', '312 node gắn lại'], ['doc-qd-tdkhdn', 'v2.3', 'Thuộc tính hạn mức thêm đơn vị VND'], ['doc-mau-tt', 'v2.0', '96 node gắn lại'], ['doc-hd-vld', 'v1.7', '41 node gắn lại'], ['FAQ: Hạn mức & lãi suất SME', 'v5', 'Artifact sinh lại']] } },
    { id: 'CR-037', type: 'evo', kind: 'taxonomy', kb: 'credit-corp', target: 'tax-LOAN_TYPE', by: 'agent', at: '2026-10-12T14:00', conf: 0.78, assignee: 'th', assignedBy: 'nl', assignedAt: '2026-10-13T09:00',
      summary: { vi: 'Tách “Cho vay SME” theo tài sản bảo đảm', en: 'Split “Cho vay SME” by collateral' },
      rationale: '87 tài liệu gắn “Cho vay SME” chia rõ hai nhóm: có tài sản bảo đảm (64) và tín chấp (23). Tìm kiếm theo “vay SME tín chấp” đang trả lẫn tài liệu có TSBĐ.',
      evidence: [{ src: 'doc-dt-sme', ver: 'v3.0', loc: 'Bài 2', quote: 'Hạn mức tín chấp tối đa 3 tỷ đồng/khách hàng.' }, { src: 'doc-dg-tsbd', ver: 'v1.3', loc: 'Trang 3', quote: 'Tài sản bảo đảm gồm quyền đòi nợ, bất động sản…' }],
      links: [['Loại khoản vay · Cho vay SME', 'config-taxonomy.html?node=LOAN_TYPE&value=Cho%20vay%20SME']],
      base: { 'tax-LOAN_TYPE': 'r12' }, to: 'r13', scope: 'Taxonomy Global · Sản phẩm › Sản phẩm cho vay › Loại khoản vay',
      taxonomy: [
        { op: 'add', name: 'Cho vay SME có tài sản bảo đảm', parent: 'Cho vay SME', cur: '—', next: 'Từ đồng nghĩa: Vay SME có TSBĐ, SME secured loan', docs: 64 },
        { op: 'add', name: 'Cho vay SME tín chấp', parent: 'Cho vay SME', cur: '—', next: 'Từ đồng nghĩa: Vay SME không TSBĐ, SME unsecured loan', docs: 23 },
        { op: 'edit', name: 'Cho vay SME', parent: 'Loại khoản vay', cur: 'Giá trị gắn trực tiếp cho 87 tài liệu', next: 'Thành nhóm cha; tài liệu chuyển sang giá trị con', docs: 87 }],
      tree: [['Loại khoản vay', 0, ''], ['Vay tiêu dùng tín chấp', 1, ''], ['Vay mua nhà', 1, ''], ['Vay vốn lưu động', 1, ''], ['Cho vay SME', 1, 'edit'], ['Cho vay SME có tài sản bảo đảm', 2, 'add'], ['Cho vay SME tín chấp', 2, 'add'], ['Vay đầu tư tài sản cố định', 1, '']],
      impact: { docs: 87, artifacts: 9, nodes: 0, edges: 0, why: 'Tài liệu đang gắn “Cho vay SME” được gắn lại sang một trong hai giá trị con theo điều khoản tài sản bảo đảm; FAQ và Wiki lọc theo tag này được cập nhật.',
        list: [['doc-dt-sme', 'v3.0', '→ Cho vay SME tín chấp'], ['doc-dg-tsbd', 'v1.3', '→ Cho vay SME có tài sản bảo đảm'], ['doc-mau-tt', 'v2.0', '→ Cho vay SME có tài sản bảo đảm'], ['FAQ: Hạn mức & lãi suất SME', 'v5', 'Artifact lọc theo tag']] } },
    { id: 'CR-044', type: 'content', kb: 'core-banking', target: 'doc-t24-ops', by: 'agent', at: '2026-10-13T08:30', conf: 0.84, assignee: null,
      summary: { vi: 'Bổ sung bước kiểm tra số dư trước khi hạch toán', en: 'Add a balance check before posting' },
      rationale: 'Thông báo vận hành 07/2026 yêu cầu kiểm tra số dư khả dụng trước mọi bút toán ghi nợ.',
      evidence: [{ src: 'doc-tb-vh07', ver: 'v1', loc: 'Mục 2', quote: 'Giao dịch viên kiểm tra số dư khả dụng trước khi hạch toán bút toán ghi nợ.' }],
      base: { 'doc-t24-ops': 'v41' }, to: 'v42',
      proposed: ['Chương 5. Hạch toán', '5.3. Giao dịch viên kiểm tra số dư khả dụng, sau đó hạch toán bút toán theo mã giao dịch tương ứng.', '5.4. Bút toán sai được hủy trong ngày bằng giao dịch đảo.'] },
    { id: 'CR-045', type: 'meta', kb: 'kyc-aml', target: 'doc-kyc-ekyc', by: 'agent', at: '2026-10-14T15:45', conf: 0.9, assignee: null,
      summary: { vi: 'Cập nhật hiệu lực hướng dẫn eKYC v3', en: 'Update eKYC v3 guideline validity' },
      rationale: 'Hướng dẫn eKYC khách hàng cá nhân v4 (QĐ-2026/KYC-11) thay thế bản này từ 01/11/2026.',
      evidence: [{ src: 'doc-kyc-ekyc4', ver: 'v4', loc: 'Điều 3', quote: 'Hướng dẫn này thay thế Hướng dẫn eKYC khách hàng cá nhân ban hành ngày 20/11/2025.' }],
      base: { 'doc-kyc-ekyc#meta': 'm4' }, to: 'm5',
      fields: { state: 'Hết hiệu lực', expire: '31/10/2026' } },
    { id: 'CR-046', type: 'content', kb: 'credit-corp', target: 'doc-dt-sme', by: 'agent', at: '2026-10-15T07:50', conf: 0.81, assignee: 'tt', assignedBy: 'nl', assignedAt: '2026-10-15T09:00',
      summary: { vi: 'Tăng hạn mức tín chấp SME lên 5 tỷ', en: 'Raise the SME unsecured limit to 5 bn' },
      rationale: 'Chính sách sản phẩm SME 2026 nâng hạn mức tín chấp tối đa lên 5 tỷ đồng/khách hàng.',
      evidence: [{ src: 'doc-cs-the26', ver: 'v1.0', loc: 'Mục 3', quote: 'Hạn mức tín chấp tối đa 5 tỷ đồng/khách hàng.' }],
      base: { 'doc-dt-sme': 'v3.0' }, to: 'v3.1',
      proposed: ['Bài 2. Sản phẩm cho vay SME', '2.1. Hạn mức tín chấp tối đa 5 tỷ đồng/khách hàng.', '2.2. Thời hạn cho vay vốn lưu động tối đa 12 tháng.'] },
    // new KB: the Agent's suggestions on ingestion. ref = the object id the Taxonomy / Ontology screens use (g:<group>, t:<group>/<tag>,
    // e:<entity type>, r:<relationship type>); only refs listed here become Verified when the request is applied.
    { id: 'CR-047', type: 'evo', kind: 'taxonomy', kb: 'card', target: 'tax-card', by: 'agent', at: '2026-10-14T16:30', conf: 0.86, assignee: null,
      summary: { vi: 'Bộ tag riêng cho tri thức Sản phẩm thẻ tín dụng', en: 'Own tag set for the credit card knowledge base' },
      rationale: 'Agent sinh khi nạp tài liệu vào tri thức mới: các tài liệu phân biệt rõ dòng thẻ, hạng thẻ và tính năng thẻ, chưa có nhóm tag Global nào tách các chiều này.',
      evidence: [],
      links: [['Sản phẩm thẻ › Dòng thẻ', 'config-taxonomy.html?scope=the-tin-dung&node=CARD_LINE'], ['Sản phẩm thẻ › Hạng thẻ', 'config-taxonomy.html?scope=the-tin-dung&node=CARD_TIER'], ['Sản phẩm thẻ › Tính năng thẻ', 'config-taxonomy.html?scope=the-tin-dung&node=CARD_FEAT']],
      base: { 'tax-card': 'r1' }, to: 'r2', scope: 'Taxonomy · Sản phẩm thẻ tín dụng › Sản phẩm thẻ',
      taxonomy: [
        { op: 'add', ref: 'g:CARD_LINE', name: 'Dòng thẻ', parent: 'Sản phẩm thẻ', cur: '—', next: 'Nhóm tag riêng, đa trị', docs: 214 },
        { op: 'add', ref: 't:CARD_LINE/THE_TIN_DUNG', name: 'Thẻ tín dụng', parent: 'Dòng thẻ', cur: '—', next: 'Từ đồng nghĩa: Credit card, Thẻ TD', docs: 142 },
        { op: 'add', ref: 't:CARD_LINE/THE_DONG_THUONG_HIEU_MSB_VIETNAM_AIRLINES', name: 'Thẻ đồng thương hiệu MSB Vietnam Airlines', parent: 'Dòng thẻ', cur: '—', next: 'Từ đồng nghĩa: Thẻ VNA, Co-brand', docs: 38 },
        { op: 'add', ref: 't:CARD_LINE/THE_TRA_TRUOC_MSB_ONLINE', name: 'Thẻ trả trước MSB Online', parent: 'Dòng thẻ', cur: '—', next: 'Từ đồng nghĩa: Prepaid card', docs: 34 },
        { op: 'add', ref: 'g:CARD_TIER', name: 'Hạng thẻ', parent: 'Sản phẩm thẻ', cur: '—', next: 'Nhóm tag riêng, đơn trị', docs: 176 },
        { op: 'add', ref: 't:CARD_TIER/CHUAN', name: 'Chuẩn', parent: 'Hạng thẻ', cur: '—', next: 'Từ đồng nghĩa: Classic', docs: 52 },
        { op: 'add', ref: 't:CARD_TIER/VANG', name: 'Vàng', parent: 'Hạng thẻ', cur: '—', next: 'Từ đồng nghĩa: Gold', docs: 47 },
        { op: 'add', ref: 't:CARD_TIER/BACH_KIM', name: 'Bạch kim', parent: 'Hạng thẻ', cur: '—', next: 'Từ đồng nghĩa: Platinum', docs: 44 },
        { op: 'add', ref: 't:CARD_TIER/SIGNATURE', name: 'Signature', parent: 'Hạng thẻ', cur: '—', next: 'Từ đồng nghĩa: Visa Signature', docs: 33 },
        { op: 'add', ref: 'g:CARD_FEAT', name: 'Tính năng thẻ', parent: 'Sản phẩm thẻ', cur: '—', next: 'Nhóm tag riêng, đa trị', docs: 131 },
        { op: 'add', ref: 't:CARD_FEAT/HOAN_TIEN', name: 'Hoàn tiền', parent: 'Tính năng thẻ', cur: '—', next: 'Từ đồng nghĩa: Cashback', docs: 58 },
        { op: 'add', ref: 't:CARD_FEAT/TRA_GOP_0', name: 'Trả góp 0%', parent: 'Tính năng thẻ', cur: '—', next: 'Từ đồng nghĩa: Installment', docs: 49 },
        { op: 'add', ref: 't:CARD_FEAT/TICH_DIEM', name: 'Tích điểm', parent: 'Tính năng thẻ', cur: '—', next: 'Từ đồng nghĩa: Reward points', docs: 24 }],
      tree: [['Sản phẩm thẻ', 0, ''], ['Dòng thẻ', 1, 'add'], ['Thẻ tín dụng', 2, 'add'], ['Thẻ đồng thương hiệu MSB Vietnam Airlines', 2, 'add'], ['Thẻ trả trước MSB Online', 2, 'add'],
        ['Hạng thẻ', 1, 'add'], ['Chuẩn', 2, 'add'], ['Vàng', 2, 'add'], ['Bạch kim', 2, 'add'], ['Signature', 2, 'add'], ['Tính năng thẻ', 1, 'add'], ['Hoàn tiền', 2, 'add'], ['Trả góp 0%', 2, 'add'], ['Tích điểm', 2, 'add']],
      impact: { docs: 214, artifacts: 0, nodes: 0, edges: 0, why: 'Tài liệu của tri thức được gắn các tag này; tri thức mới nên chưa có artifact nào lọc theo chúng.', list: [] } },
    { id: 'CR-048', type: 'evo', kind: 'ontology', kb: 'card', target: 'ontology-card', by: 'agent', at: '2026-10-14T16:35', conf: 0.8, assignee: null,
      summary: { vi: 'Ontology riêng cho tri thức Sản phẩm thẻ tín dụng', en: 'Own ontology for the credit card knowledge base' },
      rationale: 'Agent sinh khi nạp tài liệu vào tri thức mới: sản phẩm thẻ, khách hàng dùng thẻ và quy trình phát hành thẻ xuất hiện trong phần lớn tài liệu, cùng các quan hệ quản lý, rủi ro và tuân thủ giữa chúng.',
      evidence: [],
      links: [['CardProduct · Sản phẩm thẻ', 'config-ontology.html?kb=the&mode=studio&sel=t-the-tddn'], ['Customer · Khách hàng', 'config-ontology.html?kb=the&mode=studio&sel=t-the-tdcn'], ['Process · Quy trình phát hành thẻ', 'config-ontology.html?kb=the&mode=studio&sel=t-ph-the']],
      base: { 'ontology-card': 'v1' }, to: 'v2', scope: 'Ontology · Sản phẩm thẻ tín dụng',
      ontology: [
        { op: 'add', ref: 'e:t-the-tddn', part: 'Entity type', name: 'Sản phẩm thẻ · CardProduct', cur: '—', next: 'Thuộc tính: hạn mức', links: '' },
        { op: 'add', ref: 'e:t-the-tdcn', part: 'Entity type', name: 'Khách hàng · Customer', cur: '—', next: 'Thuộc tính: hạn mức', links: '' },
        { op: 'add', ref: 'e:t-ph-the', part: 'Entity type', name: 'Quy trình · Process', cur: '—', next: 'Quy trình phát hành thẻ', links: '' },
        { op: 'add', ref: 'r:r-quanly', part: 'Quan hệ', name: 'quản lý bởi', cur: '—', next: 'CardProduct → Organization · n..1', links: 'CardProduct, Organization' },
        { op: 'add', ref: 'r:r-gianlan', part: 'Quan hệ', name: 'chịu rủi ro', cur: '—', next: 'CardProduct → Risk · n..n', links: 'CardProduct, Risk' },
        { op: 'add', ref: 'r:r-apdung-the', part: 'Quan hệ', name: 'áp dụng cho', cur: '—', next: 'Customer → Segment · n..n', links: 'Customer, Segment' },
        { op: 'add', ref: 'r:r-tuanthu', part: 'Quan hệ', name: 'tuân thủ', cur: '—', next: 'Process → Document · n..n', links: 'Process, Document' }],
      structure: [['CardProduct', 'quản lý bởi', 'Organization', 'add'], ['CardProduct', 'chịu rủi ro', 'Risk', 'add'], ['Customer', 'áp dụng cho', 'Segment', 'add'], ['Process', 'tuân thủ', 'Document', 'add']],
      impact: { docs: 214, artifacts: 0, nodes: 0, edges: 0, why: 'Tài liệu của tri thức được trích xuất theo ontology này; tri thức mới nên chưa có artifact nào sinh từ nó.', list: [] } }
  ];
  // finished requests (history) with their audit trail. applied: { k, target, from, to } built at render time
  var DONE = [
    { id: 'CR-032', type: 'content', kb: 'credit-corp', target: 'doc-qd-tdkhdn', by: 'th', at: '2026-09-30T10:00',
      summary: { vi: 'Tăng thẩm quyền Giám đốc chi nhánh lên 30 tỷ', en: 'Raise branch director authority to 30 bn' },
      reason: 'Theo Nghị quyết HĐQT 09/2026 về phân cấp thẩm quyền.',
      evidence: [{ src: 'doc-nq-hdqt09', ver: 'v1.0', loc: 'Điều 2', quote: 'Nâng thẩm quyền phê duyệt của Giám đốc chi nhánh lên 30 tỷ đồng/khách hàng.' }],
      base: { 'doc-qd-tdkhdn': 'v2.2' }, to: 'v2.3',
      current: ['Điều 8. Hạn mức tín dụng', '8.2. Giám đốc chi nhánh được phê duyệt khoản cấp tín dụng có tổng hạn mức đến 20 tỷ đồng/khách hàng.'],
      proposed: ['Điều 8. Hạn mức tín dụng', '8.2. Giám đốc chi nhánh được phê duyệt khoản cấp tín dụng có tổng hạn mức đến 30 tỷ đồng.'],
      status: 'approved_edit', final: ['Điều 8. Hạn mức tín dụng', '8.2. Giám đốc chi nhánh được phê duyệt khoản cấp tín dụng có tổng hạn mức đến 30 tỷ đồng/khách hàng.'],
      decision: { by: 'nl', role: 'owner', rights: { k: 'owner' }, at: '2026-10-02T08:15', note: 'Giữ cụm “/khách hàng” như bản hiện hành', applied: { k: 'content', target: 'doc-qd-tdkhdn', from: 'v2.2', to: 'v2.3' } } },
    { id: 'CR-033', type: 'content', kb: 'credit-corp', target: 'doc-qd-tdkhdn', by: 'agent', at: '2026-09-29T14:00',
      summary: { vi: 'Bổ sung xếp hạng tín dụng vào hồ sơ điều chỉnh', en: 'Add credit rating to limit-adjustment files' },
      rationale: 'Agent đối chiếu mẫu hồ sơ của Khối Tín dụng.', evidence: [{ src: 'doc-mau-tt', ver: 'v2.0', loc: 'Mục 5', quote: 'Kèm kết quả xếp hạng tín dụng nội bộ còn hiệu lực.' }],
      base: { 'doc-qd-tdkhdn': 'v2.2' }, to: 'v2.3',
      current: ['9.2. Hồ sơ điều chỉnh gồm: giấy đề nghị điều chỉnh hạn mức, báo cáo tài chính quý gần nhất.'],
      proposed: ['9.2. Hồ sơ điều chỉnh gồm: giấy đề nghị điều chỉnh hạn mức, báo cáo tài chính quý gần nhất, xếp hạng tín dụng nội bộ cập nhật.'],
      status: 'superseded', decision: { by: 'system', role: 'system', at: '2026-10-02T08:15', cause: 'CR-032', versions: { 'doc-qd-tdkhdn': ['v2.2', 'v2.3'] } } },
    { id: 'CR-034', type: 'evo', kind: 'ontology', kb: 'credit-corp', target: 'ontology-global', by: 'agent', at: '2026-09-20T09:00',
      summary: { vi: 'Bổ sung quan hệ “sử dụng” cho Bảo lãnh', en: 'Add the “uses” relation for guarantees' },
      rationale: 'Agent trích xuất từ mục lục Hướng dẫn bảo lãnh.', evidence: [],
      links: [['Guarantee · Bảo lãnh', 'config-ontology.html?mode=studio&sel=t-bao-lanh']],
      base: { 'ontology-global': 'v4' }, to: 'v5', scope: 'Ontology Global',
      ontology: [{ op: 'add', part: 'Quan hệ', name: 'sử dụng', cur: '—', next: 'Customer → Bảo lãnh · n..n', links: 'Customer' }],
      structure: [['Customer', 'sử dụng', 'Bảo lãnh', 'add']], impact: { docs: 6, artifacts: 2, nodes: 40, edges: 40, why: '', list: [] },
      status: 'rejected', decision: { by: 'nl', role: 'owner', rights: { k: 'owner' }, at: '2026-09-22T10:05', note: 'Quan hệ không có trong văn bản nguồn; AI suy diễn từ mục lục.' } },
    { id: 'CR-029', type: 'meta', kb: 'credit-corp', target: 'doc-hd-vld', by: 'agent', at: '2026-09-30T08:00', assignee: 'th', assignedBy: 'nl', assignedAt: '2026-09-30T09:00',
      summary: { vi: 'Cập nhật ngày hiệu lực', en: 'Update effective date' },
      rationale: 'Ngày hiệu lực ghi tại trang 1.', evidence: [{ src: 'doc-hd-vld', ver: 'v1.6', loc: 'Trang 1', quote: 'Hướng dẫn có hiệu lực từ ngày 01/10/2026.' }],
      base: { 'doc-hd-vld#meta': 'm4' }, to: 'm5', current: { eff: '20/06/2026' }, fields: { eff: '01/10/2026' },
      status: 'approved', decision: { by: 'th', role: 'steward', rights: { k: 'assigned', by: 'nl' }, at: '2026-10-01T16:20', note: '', applied: { k: 'meta', target: 'doc-hd-vld', from: 'm4', to: 'm5' } } }
  ];

  // ---------- state ----------
  function seed() {
    var st = { rev: 1, seq: 48, targets: clone(TARGETS), requests: {}, order: [], audit: [], verify: {} };
    REQUESTS.forEach(function (r) {
      r = clone(r); r.status = 'pending';
      if (r.type === 'content') r.current = clone(st.targets[r.target].text);
      if (r.type === 'meta') { var t = st.targets[r.target]; r.current = {}; Object.keys(r.fields).forEach(function (k) { r.current[k] = t.meta[k] === undefined ? '—' : t.meta[k]; }); }
      add(st, r);
    });
    DONE.forEach(function (r) {
      r = clone(r); add(st, r);
      var d = r.decision, actor = d.by === 'system' ? SYSTEM : person(d.by);
      if (r.status === 'superseded') st.audit.push(ev(r, actor, 'system', 'superseded', { at: d.at, info: { cause: d.cause }, versions: d.versions }));
      else {
        st.audit.push(ev(r, actor, d.role, 'decided', { at: d.at, decision: r.status, note: d.note, rights: d.rights, original: r.proposed || r.fields || r.ontology, final: r.final || null }));
        if (d.applied) st.audit.push(ev(r, SYSTEM, 'system', 'applied', { at: d.at, info: d.applied }));
      }
    });
    return st;
  }
  function add(st, r) {
    st.requests[r.id] = r; st.order.push(r.id);
    st.audit.push(ev(r, r.by === 'agent' ? AGENT : person(r.by), r.by === 'agent' ? 'agent' : 'steward', 'created', { at: r.at, versions: r.base, note: r.reason || '', info: { evidence: (r.evidence || []).length } }));
    if (r.assignee) st.audit.push(ev(r, person(r.assignedBy), 'owner', 'assigned', { at: r.assignedAt, info: { to: r.assignee } }));
  }
  function person(id) { var p = KB && KB.person(id); return p ? { id: id, name: p.name, email: p.email } : { id: id, name: id }; }
  function ev(r, actor, role, action, o) {
    o = o || {};
    return { id: 'ae-' + Math.random().toString(36).slice(2, 10), at: o.at || new Date().toISOString(), cr: r.id, type: r.type, kb: r.kb, target: r.target || [r.a && r.a.target, r.b && r.b.target].join(', '),
      actor: actor, role: role, rights: o.rights || null, action: action, decision: o.decision || '', note: o.note || '', info: o.info || null, versions: o.versions || null,
      original: o.original === undefined ? null : o.original, final: o.final === undefined ? null : o.final };
  }
  try { if (new URLSearchParams(location.search).get('mock') === 'reset') localStorage.removeItem(KEY); } catch (e) {}
  function read() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.rev) return s; } catch (e) {} return null; }
  var S = read() || seed();
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; } }
  if (!read()) persist();
  // another tab wrote: take its state
  window.addEventListener('storage', function (e) { if (e.key === KEY) { var s = read(); if (s) { S = s; document.dispatchEvent(new CustomEvent('ecp-cr-change')); } } });

  // ---------- versions ----------
  function curVer(key) { var p = key.split('#'), t = S.targets[p[0]]; return !t ? null : p[1] === 'meta' ? t.mver : t.ver; }
  // [[key, base, current]] for every object whose version moved since the request was made
  function staleOf(r) { return Object.keys(r.base || {}).filter(function (k) { return curVer(k) !== r.base[k]; }).map(function (k) { return [k, r.base[k], curVer(k)]; }); }
  function targetName(key) { var t = S.targets[key.split('#')[0]]; return t ? t.name + (key.indexOf('#meta') > 0 ? ' (metadata)' : '') : key; }

  // ---------- titles and the affected-object line ----------
  // The list title is the change summary (what changes), never the type, the reason, the rationale or the evidence.
  // Without a summary, a short title is built from the change itself in the current language.
  function cap(t, n) { n = n || 65; return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }
  function some(list) { return list.slice(0, 2).join(', ') + (list.length > 2 ? ' +' + (list.length - 2) : ''); }
  function title(r) {
    var s = loc(r.summary); if (s && String(s).trim()) return cap(String(s).trim());
    if (r.type === 'meta') return cap(T('cr.t.meta', { f: some(Object.keys(r.fields).map(fieldLabel)) }));
    if (r.type === 'evo') return cap(T('cr.t.evo', { n: S.targets[r.target].name.split(' · ').pop() }));
    if (r.type === 'conflict') return cap(T('cr.t.conflict', { t: r.topic }));
    return cap(T('cr.t.content', { n: S.targets[r.target].name }));
  }
  function fieldLabel(k) { return T('cr.f.' + k); }
  // [{ name, code }] objects this request changes or compares; the page shows the first, then "+N"
  function objects(r) {
    if (r.type === 'conflict') return [r.a.target, r.b.target].map(function (k) { var t = S.targets[k]; return { key: k, name: t.name, code: t.code }; });
    var t = S.targets[r.target]; return [{ key: r.target, name: t.name, code: t.code }];
  }

  // ---------- evidence: resolve each stored reference against the current sources ----------
  // Every cited document is in Enterprise Context Platform and opens in document-viewer.html at the cited passage.
  // status: ok | noaccess (the source sits in a KB the viewer can't see: name, ID and excerpt are hidden)
  function canSeeKb(kbId) {
    var kb = KB.get(kbId), ro = role(), me = KB.me(); if (!kb) return false;
    return ro === 'admin' || (ro === 'owner' && kb.owners.indexOf(me) !== -1) || (ro === 'steward' && kb.stewards.indexOf(me) !== -1);
  }
  function source(key) { var t = S.targets[key]; if (t) return { kb: t.kb, name: t.name, code: t.code, ver: t.ver }; return SOURCES[key] || null; }
  // cid: citation id (request id + evidence index or conflict side); cr: the request the evidence belongs to
  function resolveEvidence(e, cid, cr) {
    var s = source(e.src) || { kb: '', name: e.src, code: '', ver: null };
    var out = { key: e.src, name: s.name, code: s.code, kb: s.kb, verAt: e.ver, verNow: s.ver, loc: e.loc, quote: e.quote };
    if (!canSeeKb(s.kb)) { out.status = 'noaccess'; out.name = ''; out.code = ''; out.quote = ''; return out; }
    var psg = cid && e.quote ? passageOf(e.src, cid) : null;
    out.status = 'ok'; out.deep = !!psg;
    out.href = 'document-viewer.html?doc=' + encodeURIComponent(e.src) + (psg ? '&psg=' + encodeURIComponent(psg) : '') + (cr ? '&from=cr&q=' + encodeURIComponent(cr) : '');
    return out;
  }
  function evidence(r) { return (r.evidence || []).map(function (e, i) { return resolveEvidence(e, cidOf(r.id, i), r.id); }); }
  // evidence for a conflict is the two conflicting passages themselves
  function conflictSource(r, side) {
    var x = r[side];
    return resolveEvidence({ src: x.target, ver: r.base[x.target], loc: x.loc, quote: x.passage }, cidOf(r.id, side), r.id);
  }

  // ---------- document view (document-viewer.html?doc=<key>) ----------
  // The document's text plus every passage cited from it; a cited passage that is not in the stored text is shown as its own
  // block, so the viewer always opens on the exact excerpt the request cites.
  function cidOf(id, i) { return 'ev-' + id.toLowerCase() + '-' + i; }
  function citations(key) {
    var out = [];
    S.order.forEach(function (id) {
      var r = S.requests[id];
      (r.evidence || []).forEach(function (e, i) { if (e.src === key && e.quote) out.push({ id: cidOf(id, i), loc: e.loc, quote: e.quote }); });
      ['a', 'b'].forEach(function (x) { if (r[x] && r[x].target === key) out.push({ id: cidOf(id, x), loc: r[x].loc, quote: r[x].passage }); });
      if (r.type === 'content' && r.target === key) changedParas(r).forEach(function (c) { out.push({ id: c[0], loc: T('cr.chgLoc', { id: id }), quote: c[1], exact: true }); });
    });
    return out;
  }
  // the paragraphs a content request changes, so Open document can land on them: pending → the stored text's paragraphs it
  // replaces; applied → the paragraphs it wrote. [cid, text]; a changed paragraph is one the other side does not contain.
  function chgCid(id, side, i) { return 'chg-' + id.toLowerCase() + '-' + side + i; }
  function changedParas(r) {
    var to = r.final || r.proposed, mine = r.status === 'pending' ? r.current : r.decision && r.decision.applied ? to : null, other = mine === to ? r.current : to;
    if (!mine) return [];
    return mine.map(function (l, i) { return [chgCid(r.id, mine === to ? 'new' : 'cur', i), l]; }).filter(function (x) { return other.indexOf(x[1]) === -1; });
  }
  // the page for one version of a target: a document opens in the viewer (on a changed paragraph when cid names one),
  // a taxonomy / ontology in its configuration screen. null when that version is not the current one or the viewer can't see it.
  function docLink(key, ver, cid) {
    var p = key.split('#')[0], t = S.targets[p];
    if (!t || !canSeeKb(t.kb) || curVer(key) !== ver) return null;
    if (t.kind !== 'doc') return t.href || null;
    var psg = cid ? passageOf(p, cid) : null;
    return 'document-viewer.html?doc=' + encodeURIComponent(p) + (psg ? '&psg=' + encodeURIComponent(psg) : '');
  }
  function viewDoc(key) {
    var t = S.targets[key] || {}, blocks = (t.text || []).map(function (l) { return [/^(Điều|Mục|Chương|Bài)\s/.test(l) ? 'h2' : 'p', l]; });
    var passages = {}, alias = {};
    citations(key).forEach(function (c) {
      var b = blocks.filter(function (x) { return x[0] === 'p' && x[1].indexOf(c.quote) !== -1; })[0];
      if (!b) { if (c.exact) return; b = ['p', c.quote]; blocks.push(b); }   // a changed paragraph links only where the text has it
      if (!b[2]) { b[2] = c.id; passages[c.id] = { loc: [null, c.loc], page: null, search: true }; }
      alias[c.id] = b[2];
    });
    return { blocks: blocks, passages: passages, alias: alias };
  }
  function passageOf(key, cid) { return viewDoc(key).alias[cid] || null; }
  // the shape doc-viewer.js renders; null when the document is unknown or in a KB the viewer can't see
  function viewerDoc(key) {
    var s = source(key); if (!s || !canSeeKb(s.kb)) return null;
    var t = S.targets[key] || {}, kb = KB.get(s.kb), v = viewDoc(key);
    return { title: s.name, code: s.code, type: 'PDF', ft: 'ft-pdf', kb: kb ? kb.name : s.kb, ver: s.ver, status: 'active', updated: t.updated ? t.updated.slice(0, 10) : null,
      original: null, kw: [], pages: [{ no: null, blocks: v.blocks }], passages: v.passages };
  }
  // documents a person can cite from a KB (manual submission)
  function sourcesOf(kbId) {
    var out = [];
    Object.keys(S.targets).forEach(function (k) { var t = S.targets[k]; if (t.kind === 'doc' && t.kb === kbId) out.push({ key: k, name: t.name, code: t.code, ver: t.ver }); });
    Object.keys(SOURCES).forEach(function (k) { var s = SOURCES[k]; if (s.kb === kbId) out.push({ key: k, name: s.name, code: s.code, ver: s.ver }); });
    return out;
  }

  // ---------- who sees / who decides (re-read from ECP_KB on every call: latest ACL and assignment) ----------
  function role() { return KB.role(); }
  function actor() { var r = role(); return r === 'admin' ? ADMIN : person(KB.me()); }
  function sees(r) { return canSeeKb(r.kb); }
  // { ok, as, rights: { k, by } } or { ok: false, reason: { k, who } }
  function authority(r) {
    var kb = KB.get(r.kb), ro = role(), me = KB.me();
    if (!kb || !sees(r)) return { ok: false, reason: { k: 'nokb' } };
    if (ro !== 'admin' && r.by === me) return { ok: false, reason: { k: 'maker' } };
    if (ro === 'admin') return { ok: true, as: 'admin', rights: { k: 'admin' } };
    if (ro === 'owner') return { ok: true, as: 'owner', rights: { k: 'owner' } };
    if (r.assignee === me) return { ok: true, as: 'steward', rights: { k: 'assigned', by: r.assignedBy } };
    return { ok: false, reason: r.assignee ? { k: 'other', who: r.assignee } : { k: 'unassigned' } };
  }
  function rightsText(x) { return !x ? '' : x.k === 'assigned' ? T('cr.r.assigned', { n: nameOf(x.by) }) : T('cr.r.' + x.k); }
  function reasonText(x) { return T('cr.no.' + x.k, { n: x.who ? nameOf(x.who) : '' }); }
  // assigning: Admin, or an Owner of the request's KB, while it is pending
  function canAssign(r) {
    var kb = KB.get(r.kb), ro = role();
    return !!kb && r.status === 'pending' && (ro === 'admin' || (ro === 'owner' && kb.owners.indexOf(KB.me()) !== -1));
  }
  // why this request can't go to Steward s ('' = it can)
  function assignBlock(r, s) {
    if (r.status !== 'pending') return T('cr.ab.done');
    if (!canAssign(r)) return T('cr.ab.notOwner');
    var kb = KB.get(r.kb);
    if (kb.stewards.indexOf(s) === -1) return T('cr.ab.notSteward', { n: nameOf(s), kb: kb.name });
    if (r.by === s) return T('cr.ab.maker', { n: nameOf(s) });
    if (r.assignee === s) return T('cr.ab.same', { n: nameOf(s) });
    return '';
  }
  // Stewards that can take at least one of these requests, with how many
  function stewardsFor(list) {
    var out = {};
    list.forEach(function (r) { var kb = KB.get(r.kb); if (kb) kb.stewards.forEach(function (s) { out[s] = (out[s] || 0) + (assignBlock(r, s) ? 0 : 1); }); });
    return Object.keys(out).map(function (s) { return [s, out[s]]; });
  }
  // the one write path for assignment; returns [[id, { ok, code: assigned | skipped, msg }]]
  function assign(ids, s) {
    var fresh = read(); if (fresh) S = fresh;
    var who = actor(), out = ids.map(function (id) {
      var r = S.requests[id], why = r ? assignBlock(r, s) : T('cr.m.notFound');
      if (why) return [id, { ok: false, code: 'skipped', msg: why }];
      var prev = r.assignee;
      r.assignee = s; r.assignedBy = who.id; r.assignedAt = new Date().toISOString();
      S.audit.push(ev(r, who, role(), 'assigned', { info: { to: s, prev: prev } }));
      return [id, { ok: true, code: 'assigned' }];
    });
    commit(); return out;
  }
  function unassign(id) {
    var fresh = read(); if (fresh) S = fresh;
    var r = S.requests[id];
    if (!r || !r.assignee || !canAssign(r)) return { ok: false, msg: T('cr.m.cantUnassign') };
    var prev = r.assignee; r.assignee = null; r.assignedBy = null; r.assignedAt = null;
    S.audit.push(ev(r, actor(), role(), 'unassigned', { info: { prev: prev } }));
    commit(); return { ok: true, msg: T('cr.m.unassigned', { id: id, n: nameOf(prev) }) };
  }
  // why a selected request can't go through Approve selected ('' = eligible)
  function bulkBlock(r) {
    if (r.status !== 'pending') return T('cr.bb.done');
    if (r.type === 'conflict') return T('cr.bb.conflict');
    if (r.type === 'evo') return T('cr.bb.evo');
    if (staleOf(r).length) return T('cr.bb.stale');
    if (!authority(r).ok) return T('cr.bb.noRight');
    return '';
  }

  // ---------- manual submission (document content / metadata) ----------
  // o: { type: content | meta, target, summary, reason, evidence: [{ src, loc, quote }], current, proposed | fields }
  // The reason is required here (drafts are kept by the editor and need none). Evidence is optional.
  function validateSubmit(o) {
    var err = {};
    if (!(o.summary || '').trim()) err.summary = T('cr.v.summary');
    else if (o.summary.trim().length > 80) err.summary = T('cr.v.summaryLong', { n: 80 });
    if (!(o.reason || '').trim()) err.reason = T('cr.v.reason');
    (o.evidence || []).forEach(function (e, i) { if (!e.src) err['ev' + i] = T('cr.v.evSource'); else if (!(e.loc || '').trim() && !(e.quote || '').trim()) err['ev' + i] = T('cr.v.evDetail'); });
    return err;
  }
  function submit(o) {
    var err = validateSubmit(o); if (Object.keys(err).length) return { ok: false, code: 'invalid', errors: err };
    var fresh = read(); if (fresh) S = fresh;
    var t = S.targets[o.target]; if (!t) return { ok: false, code: 'invalid', errors: { form: T('cr.m.notFound') } };
    var who = actor(), id = 'CR-0' + (++S.seq);
    var r = { id: id, type: o.type, kb: t.kb, target: o.target, by: who.id, at: new Date().toISOString(), assignee: null, status: 'pending',
      summary: o.summary.trim(), reason: o.reason.trim(),
      // evidence keeps the source version as it is now: the immutable reference for this request
      evidence: (o.evidence || []).map(function (e) { var s = source(e.src); return { src: e.src, ver: s ? s.ver : '', loc: (e.loc || '').trim(), quote: (e.quote || '').trim() }; }) };
    if (o.type === 'content') { r.base = {}; r.base[o.target] = t.ver; r.to = bump(t.ver); r.current = o.current; r.proposed = o.proposed; }
    else { r.base = {}; r.base[o.target + '#meta'] = t.mver || 'm1'; r.to = bump(t.mver || 'm1'); r.current = o.current; r.fields = o.fields; }
    S.requests[id] = r; S.order.push(id);
    S.audit.push(ev(r, who, role(), 'created', { versions: r.base, note: r.reason, info: { evidence: r.evidence.length } }));
    commit();
    return { ok: true, id: id };
  }

  // ---------- decide: the one write path ----------
  // action: approve | approve_edit | reject | keep_a | keep_b | edit_approve
  // o: { reason (reviewer's reject reason), final (content lines | meta fields | consolidated text) }
  // returns { ok, code: applied | rejected | processed | denied | stale | apply_failed | invalid, msg, ... }
  function decide(id, action, o) {
    o = o || {};
    var fresh = read(); if (fresh) S = fresh;                       // latest state: another tab may have decided already
    var r = S.requests[id];
    if (!r) return { ok: false, code: 'invalid', msg: T('cr.m.notFound') };
    if (r.status !== 'pending') {
      var d = r.decision || {};
      return r.status === 'superseded' ? { ok: false, code: 'stale', msg: T('cr.m.isSuperseded') + ' ' + supersedeText(d) } : { ok: false, code: 'processed', msg: T('cr.m.processed', { n: nameOf(d.by), s: statusLabel(r.status) }) };
    }
    var a = authority(r), who = actor();
    if (!a.ok) { S.audit.push(ev(r, who, role(), 'denied', { info: { reason: a.reason }, decision: action })); commit(); return { ok: false, code: 'denied', msg: reasonText(a.reason) }; }
    if (action === 'reject') {
      if (!(o.reason || '').trim()) return { ok: false, code: 'invalid', msg: T('cr.v.rejectReason') };
      finish(r, 'rejected', a, who, o.reason.trim(), null, null);
      S.audit.push(ev(r, who, a.as, 'decided', { decision: 'rejected', note: o.reason.trim(), rights: a.rights, original: payload(r), versions: currentVersions(r) }));
      commit(); return { ok: true, code: 'rejected', msg: T('cr.m.rejected', { id: r.id }) };
    }
    var stale = staleOf(r);
    if (stale.length) {
      supersede(r, stale, who, a.as, null);
      commit(); return { ok: false, code: 'stale', stale: stale, msg: T('cr.m.stale', { v: verMoves(stale) }) };
    }
    if (r.type === 'conflict' && !/^(keep_a|keep_b|edit_approve)$/.test(action)) return { ok: false, code: 'invalid', msg: T('cr.m.pickSide') };
    if (r.type === 'evo' && action !== 'approve') return { ok: false, code: 'invalid', msg: T('cr.m.evoOnly') };
    var fin = null;
    if (action === 'approve_edit' || action === 'edit_approve') {
      fin = o.final;
      var bad = validateFinal(r, fin); if (bad) return { ok: false, code: 'invalid', msg: bad };
    }
    // apply (atomic: nothing below writes until commit)
    var t = r.target && S.targets[r.target];
    if (t && t.processing) {
      r.applyErr = { at: new Date().toISOString(), job: t.processing.job };
      S.audit.push(ev(r, who, a.as, 'apply_failed', { decision: action, info: { job: t.processing.job }, rights: a.rights }));
      commit(); return { ok: false, code: 'apply_failed', msg: T('cr.m.applyFailed', { job: t.processing.job }) };
    }
    var applied = apply(r, action, fin, who, a.as);
    var status = { approve: 'approved', approve_edit: 'approved_edit', keep_a: 'keep_a', keep_b: 'keep_b', edit_approve: 'edit_approve' }[action];
    finish(r, status, a, who, (o.note || '').trim(), fin, applied);
    S.audit.push(ev(r, who, a.as, 'decided', { decision: status, note: r.decision.note, rights: a.rights, original: payload(r), final: fin, versions: r.base }));
    S.audit.push(ev(r, SYSTEM, 'system', 'applied', { info: applied, versions: currentVersions(r) }));
    // pending requests built on the versions just replaced can no longer be applied
    var gone = [];
    S.order.forEach(function (oid) {
      var x = S.requests[oid]; if (x.status !== 'pending' || x === r) return;
      var s = staleOf(x); if (s.length) { supersede(x, s, SYSTEM, 'system', r.id); gone.push(oid); }
    });
    commit();
    return { ok: true, code: 'applied', superseded: gone, msg: statusLabel(status) + ' ' + r.id + '. ' + appliedText(applied) + '.' + (gone.length ? ' ' + T('cr.m.goneSuperseded', { ids: gone.join(', ') }) : '') };
  }
  function payload(r) { return r.proposed || r.fields || r.ontology || r.taxonomy || (r.a ? { a: r.a.passage, b: r.b.passage, rec: r.rec } : null); }
  function currentVersions(r) { var o = {}; Object.keys(r.base || {}).forEach(function (k) { o[k] = curVer(k); }); return o; }
  function validateFinal(r, fin) {
    if (r.type === 'content') {
      if (!fin || !fin.join('').trim()) return T('cr.v.finalEmpty');
      if (fin.join('\n') === r.current.join('\n')) return T('cr.v.finalSame');
    }
    if (r.type === 'meta') {
      if (!fin) return T('cr.v.finalEmpty');
      var empty = Object.keys(fin).filter(function (k) { return !String(fin[k]).trim(); });
      if (empty.length) return T('cr.v.metaEmpty', { f: empty.map(fieldLabel).join(', ') });
      var badDate = Object.keys(fin).filter(function (k) { return /^(eff|expire)$/.test(k) && fin[k] !== '—' && !/^\d{2}\/\d{2}\/\d{4}$/.test(fin[k]); });
      if (badDate.length) return T('cr.v.date', { f: fieldLabel(badDate[0]) });
    }
    if (r.type === 'conflict' && !(fin || '').trim()) return T('cr.v.merge');
    return '';
  }
  function bump(v) { var m = /^(.*?)(\d+)$/.exec(v); return m ? m[1] + (+m[2] + 1) : v + '.1'; }
  function apply(r, action, fin, who, roleCode) {
    var t = r.target && S.targets[r.target], now = new Date().toISOString();
    if (r.type === 'content') { var from = t.ver; t.text = clone(fin || r.proposed); t.ver = r.to; t.updated = now; return { k: 'content', target: r.target, from: from, to: t.ver }; }
    if (r.type === 'meta') { var f = fin || r.fields, mf = t.mver; t.meta = t.meta || {}; Object.keys(f).forEach(function (k) { t.meta[k] = f[k]; }); t.mver = r.to; return { k: 'meta', target: r.target, from: mf, to: t.mver }; }
    if (r.type === 'evo') { var ef = t.ver; t.ver = r.to; t.updated = now; return { k: 'evo', target: r.target, from: ef, to: t.ver, docs: r.impact.docs, verified: verify(r, t.ver, who, roleCode, now) }; }
    // conflict: record which passage is canonical for answers; neither source document is edited or deleted
    r.resolution = action === 'edit_approve' ? { canonical: 'merged', text: fin } : { canonical: action === 'keep_a' ? 'a' : 'b' };
    return { k: action === 'edit_approve' ? 'merged' : action };
  }
  // the objects of an applied evolution request turn Verified (new KBs only); returns their refs for the audit event
  function verify(r, ver, who, roleCode, at) {
    var kb = KB.get(r.kb); if (!kb || !kb.verifyTracked) return [];
    var refs = (r.taxonomy || r.ontology || []).filter(function (x) { return x.ref && x.op !== 'del'; }).map(function (x) { return x.ref; });
    var m = S.verify[r.kb] = S.verify[r.kb] || {};
    refs.forEach(function (ref) { m[ref] = { ver: ver, cr: r.id, by: who.id, role: roleCode, at: at }; });
    return refs;
  }
  function appliedText(x) {
    if (!x) return '';
    if (x.k === 'evo' && x.verified && x.verified.length) return T('cr.ap.evo', { n: targetName(x.target), from: x.from, to: x.to, docs: x.docs }) + '; ' + T('cr.ap.verified', { n: x.verified.length });
    if (x.k === 'content' || x.k === 'meta' || x.k === 'evo') return T('cr.ap.' + x.k, { n: targetName(x.target), from: x.from, to: x.to, docs: x.docs });
    return T('cr.ap.' + x.k);
  }
  function verMoves(stale) { return stale.map(function (s) { return targetName(s[0]) + ' ' + s[1] + ' → ' + s[2]; }).join('; '); }
  function supersedeText(d) {
    var v = Object.keys(d.versions || {}).map(function (k) { return [k, d.versions[k][0], d.versions[k][1]]; });
    return T(d.cause ? 'cr.m.supersededBy' : 'cr.m.supersededNote', { v: verMoves(v), id: d.cause || '' });
  }
  function finish(r, status, a, who, note, fin, applied) {
    r.status = status; delete r.applyErr;
    r.final = fin || (status === 'approved' ? payload(r) : null);
    r.decision = { by: who.id, name: who.name, role: a.as, rights: a.rights, at: new Date().toISOString(), note: note, applied: applied };
  }
  function supersede(r, stale, who, roleCode, cause) {
    r.status = 'superseded';
    var vers = {}; stale.forEach(function (s) { vers[s[0]] = [s[1], s[2]]; });
    r.decision = { by: who.id, name: who.name, role: 'system', at: new Date().toISOString(), cause: cause, versions: vers };
    S.audit.push(ev(r, who, roleCode, 'superseded', { info: { cause: cause }, versions: vers }));
  }
  function commit() { S.rev++; persist(); document.dispatchEvent(new CustomEvent('ecp-cr-change')); }

  // ---------- read API ----------
  function statusLabel(s) { return T('cr.st.' + s); }
  function roleLabel(code) { return T('cr.role.' + code); }
  function nameOf(id) { return id === 'system' ? T('cr.role.system') : id === 'sysadmin' ? 'System Admin' : id === 'agent' ? 'Agent' : person(id).name; }
  // one line for the timeline / audit table, from the event's structured info
  function eventNote(e) {
    var i = e.info || {};
    if (e.action === 'applied') return appliedText(i);
    if (e.action === 'superseded') return T(i.cause ? 'cr.m.supersededBy' : 'cr.m.supersededNote', { v: verMoves(Object.keys(e.versions || {}).map(function (k) { return [k, e.versions[k][0], e.versions[k][1]]; })), id: i.cause || '' });
    if (e.action === 'assigned') return i.prev ? T('cr.ev.reassigned', { a: nameOf(i.prev), b: nameOf(i.to) }) : T('cr.ev.assigned', { n: nameOf(i.to) });
    if (e.action === 'unassigned') return T('cr.ev.unassigned', { n: nameOf(i.prev) });
    if (e.action === 'apply_failed') return T('cr.m.applyFailedShort', { job: i.job });
    if (e.action === 'denied') return reasonText(i.reason);
    if (e.action === 'created') return i.evidence ? T('cr.ev.withEvidence', { n: i.evidence }) : '';
    return '';
  }
  window.ECP_CR = {
    list: function () { return S.order.map(function (id) { return S.requests[id]; }); },
    get: function (id) { return S.requests[id] || null; },
    target: function (key) { return S.targets[key] || null; },
    audit: function (id) { return S.audit.filter(function (e) { return e.cr === id; }); },
    sees: sees, authority: authority, rightsText: rightsText, reasonText: reasonText,
    canAssign: canAssign, assignBlock: assignBlock, stewardsFor: stewardsFor, assign: assign, unassign: unassign, bulkBlock: bulkBlock,
    staleOf: staleOf, curVer: curVer, targetName: targetName, title: title, objects: objects, summaryText: function (r) { return loc(r.summary) || ''; },
    evidence: evidence, resolve: resolveEvidence, docLink: docLink, chgCid: chgCid, isSource: function (k) { return !!source(k); }, viewerDoc: viewerDoc, conflictSource: conflictSource, sourcesOf: sourcesOf, validateSubmit: validateSubmit, submit: submit,
    // { ref: { ver, cr, by, role, at } } for a KB with verifyTracked, else null (the KB has no verification state)
    verification: function (kbId) { var fresh = read(); if (fresh) S = fresh; var kb = KB.get(kbId); return kb && kb.verifyTracked ? clone(S.verify[kbId] || {}) : null; },
    decide: decide, appliedText: appliedText, supersedeText: supersedeText, eventNote: eventNote,
    statusLabel: statusLabel, roleLabel: roleLabel, fieldLabel: fieldLabel, nameOf: nameOf, person: person, role: role, T: T, META_KEYS: META_KEYS
  };
})();

/* ECP_CR.reviews: governance reviews (contracts/openapi/governance.yaml /api/v1/reviews), the data the Thay đổi & Phê
 * duyệt page shows (as the micro-frontend features/changes-approval does). KNOWLEDGE_RELEASE (ADR-006): a Steward's request to
 * release a KB working state (ADMIN / KB OWNER approve or reject), or the self-approved audit record of an Owner/Admin release
 * (reason SELF_RELEASE). GLOBAL_MERGE (ADR-007): the items a Custom preset version adds / changes compared with Global; no KB;
 * only ADMIN decides (approve, approve with edits that drop items / rename codes, reject). presetCrs() stands in for the pending
 * ONTOLOGY / TAXONOMY change requests (governance /change-requests?status=PENDING). METADATA_EDIT: the enrichment pipeline
 * (role SYSTEM) or the Agent (role AI) proposes to delete tags of one document; ADMIN or the OWNER of the KB approves (as
 * proposed, or with edits that keep only some of the current tags) or rejects (reason required). STEWARD reads every review
 * and decides none (no assignment yet); CONSUMER gets 403. Reviews follow the response shape (reviewId, code, metadata,
 * finalPayload, revision, allowedActions…). Errors are thrown as { status } like the HTTP API: 403, 404, 409 (already
 * decided), 412 (stale revision), 422 (input). State lives in localStorage (ecp-rv-mock-2); ?mock=reset restores it. */
(function () {
  var CR = window.ECP_CR, KB = window.ECP_KB;
  if (!CR || !KB) return;
  var KEY = 'ecp-rv-mock-2';
  var SYS = { userId: 'service:knowledge_enrichment', name: 'knowledge_enrichment', role: 'SYSTEM' };
  var AI = { userId: 'agent:tag-validation', name: 'Agent', role: 'AI' };
  var NL = { userId: 'nl', name: 'Nguyễn Lan', role: 'OWNER' }, HV = { userId: 'hv', name: 'Hoàng Vy', role: 'OWNER' };
  var VD = { userId: 'vd', name: 'Vũ Đức', role: 'OWNER' }, ADMIN = { userId: 'sysadmin', name: 'System Admin', role: 'ADMIN' };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  // id, KB, document, content version, document version, created, maker, summary, rationale, current tags, proposed tags
  function rv(n, kb, doc, cv, ver, at, maker, summary, rationale, cur, prop, done) {
    var r = { reviewId: 'rv-' + n, code: 'RV-' + n, type: 'METADATA_EDIT', status: 'PENDING', knowledgeBaseId: kb, documentId: doc, contentVersion: cv,
      summary: summary, rationale: rationale, metadata: { current: cur, proposed: prop }, finalPayload: null, baseVersions: { document: ver },
      outcome: null, reason: null, applied: false, appliedAt: null, maker: maker, decidedBy: null, decidedAt: null, createdAt: at, revision: 1 };
    if (done) {
      r.status = done.outcome === 'REJECTED' ? 'REJECTED' : 'APPROVED'; r.outcome = done.outcome; r.reason = done.reason || null;
      r.finalPayload = done.finalPayload || null; r.decidedBy = done.by; r.decidedAt = done.at; r.applied = !!done.appliedAt; r.appliedAt = done.appliedAt || null; r.revision = done.appliedAt ? 3 : 2;
    }
    return r;
  }
  function ts(t, s) { return { tags: t, sourceTags: s }; }
  var TH = { userId: 'th', name: 'Trần Hải', role: 'STEWARD' };
  function kbRef(id) { var k = KB.get(id); return { knowledgeBaseId: id, name: k ? k.name : id }; }
  // KNOWLEDGE_RELEASE (ADR-006): n, KB, version label, bump, created, maker, notes, counts, documents, packages, decision
  function rel(n, kb, v, bump, at, maker, notes, sum, docs, pkgSum, pkgs, done) {
    var r = { reviewId: 'rv-' + n, code: 'RV-' + n, type: 'KNOWLEDGE_RELEASE', status: 'PENDING', knowledgeBaseId: kb, documentId: null, contentVersion: null,
      releaseRequestId: done && done.reason === 'SELF_RELEASE' ? null : 'rr-' + n, workingStateRevision: n - 60, releaseId: null,
      summary: 'Phát hành v' + v + ' · ' + kbRef(kb).name, rationale: '', finalPayload: null, baseVersions: {},
      metadata: { versionLabel: v, bump: bump, notes: notes, summary: sum, documents: docs, documentsTruncated: false, packageSummary: pkgSum, packages: pkgs, packagesTruncated: false, requestedBy: maker },
      outcome: null, reason: null, applied: false, appliedAt: null, maker: maker, decidedBy: null, decidedAt: null, createdAt: at, revision: 1 };
    if (done) {
      r.status = done.status || 'APPROVED'; r.outcome = done.outcome || null; r.reason = done.reason || null; r.decidedBy = done.by || null; r.decidedAt = done.at;
      r.releaseId = r.status === 'APPROVED' ? 'rel-' + n : null; r.applied = r.status === 'APPROVED'; r.appliedAt = r.applied ? done.at : null; r.revision = 2;
    }
    return r;
  }
  function d(id, title, change) { return { documentId: id, title: title, change: change }; }
  function pk(id, title, type, change) { return { artifactId: id, title: title, artifactType: type, change: change }; }
  // GLOBAL_MERGE (ADR-007 §6): n, kind, source preset, Global preset, created, maker, items, impact KBs, decision
  function gm(n, kind, src, glob, at, maker, items, kbs, done) {
    var r = { reviewId: 'rv-' + n, code: 'RV-' + n, type: 'GLOBAL_MERGE', status: 'PENDING', knowledgeBaseId: null, documentId: null, contentVersion: null,
      summary: 'Gộp ' + src.name + ' v' + src.version + ' vào Global', rationale: '', finalPayload: null, baseVersions: {},
      metadata: { presetKind: kind, sourcePreset: src, globalPreset: glob, items: items, itemsTruncated: false,
        summary: { added: items.filter(function (i) { return i.change === 'ADDED'; }).length, changed: items.filter(function (i) { return i.change === 'CHANGED'; }).length } },
      impact: { knowledgeBases: kbs.map(kbRef), totals: { knowledgeBases: kbs.length } },
      outcome: null, reason: null, applied: false, appliedAt: null, maker: maker, decidedBy: null, decidedAt: null, createdAt: at, revision: 1 };
    if (done) {
      r.status = done.outcome === 'REJECTED' ? 'REJECTED' : 'APPROVED'; r.outcome = done.outcome; r.reason = done.reason || null; r.finalPayload = done.finalPayload || null;
      r.decidedBy = done.by; r.decidedAt = done.at; r.applied = r.status === 'APPROVED'; r.appliedAt = r.applied ? done.at : null; r.revision = 3;
    }
    return r;
  }
  function it(type, code, label, change) { return { itemType: type, code: code, label: label, change: change, before: change === 'CHANGED' ? {} : null, after: {} }; }
  function ps(id, name, v) { return { presetId: id, name: name, version: v, definitionHash: 'sha256:' + id + '-' + v }; }
  function seed() {
    return { rev: 1, reviews: [
      rel(120, 'credit-corp', '2.4', 'MINOR', '2026-11-04T09:10:00.000Z', TH, 'Cập nhật quy định cấp tín dụng KHDN theo Thông tư 12/2026; bổ sung hướng dẫn định giá TSBĐ.',
        { added: 1, modified: 2, removed: 1, retagged: 1 },
        [d('doc-dg-tsbd', 'Hướng dẫn định giá tài sản bảo đảm', 'ADDED'), d('doc-qd-tdkhdn', 'Quy định cấp tín dụng KHDN', 'MODIFIED'), d('doc-qc-cv', 'Quy chế cho vay', 'MODIFIED'),
          d('doc-qd-td08', 'Quyết định thẩm định 08/2026', 'REMOVED'), d('doc-hd-vld', 'Hướng dẫn thẩm định vay vốn lưu động', 'RETAGGED')],
        { added: 1, modified: 1, removed: 0 }, [pk('pkg-faq-tsbd', 'FAQ định giá TSBĐ', 'FAQ', 'ADDED'), pk('pkg-wiki-khdn', 'Wiki tín dụng KHDN', 'Wiki', 'MODIFIED')]),
      gm(119, 'TAXONOMY', ps('tx-credit-e2e', 'Taxonomy tín dụng E2E', 3), ps('tx-global', 'Global', 7), '2026-11-04T08:55:00.000Z', HV,
        [it('TAG_TYPE', 'loai-tsbd', 'Loại tài sản bảo đảm', 'ADDED'), it('TAG_VALUE', 'loai-tsbd/bds', 'Bất động sản', 'ADDED'), it('TAG_VALUE', 'loai-tsbd/ptvt', 'Phương tiện vận tải', 'ADDED'),
          it('TAG_VALUE', 'khach-hang/sme', 'SME', 'CHANGED')], ['credit-corp', 'kyc-aml', 'core-banking', 'card']),
      rv(118, 'credit-corp', 'doc-qd-tdkhdn', 7, 'v2.3', '2026-11-04T08:40:00.000Z', SYS, 'Bỏ 2 tag không còn phù hợp', 'Tag "Thẻ tín dụng" và "Huy động vốn" không xuất hiện trong nội dung tài liệu.',
        ts(['Tín dụng doanh nghiệp', 'Hạn mức tín dụng', 'Thẻ tín dụng', 'SME', 'Huy động vốn'], ['tin-dung/khdn', 'tuan-thu/chung']), ts(['Tín dụng doanh nghiệp', 'Hạn mức tín dụng', 'SME'], ['tin-dung/khdn', 'tuan-thu/chung'])),
      rv(117, 'credit-corp', 'doc-hd-vld', 5, 'v1.7', '2026-11-04T07:55:00.000Z', AI, 'Bỏ tag sản phẩm bán lẻ khỏi hướng dẫn thẩm định', 'Hướng dẫn chỉ áp dụng cho khách hàng doanh nghiệp lớn và SME (Mục 1.1); "Cho vay tiêu dùng" và "KHCN" là sản phẩm bán lẻ.',
        ts(['Vay vốn lưu động', 'Thẩm định', 'Cho vay tiêu dùng', 'KHCN', 'SME'], ['tin-dung/khdn', 'ban-le/khcn']), ts(['Vay vốn lưu động', 'Thẩm định', 'SME'], ['tin-dung/khdn'])),
      rv(116, 'kyc-aml', 'doc-kyc-policy', 14, 'v14', '2026-11-03T16:20:00.000Z', SYS, 'Bỏ 1 tag nguồn trùng lặp', 'Tag nguồn "tuan-thu/cu" trỏ tới thư mục đã lưu trữ; nội dung đã có ở "tuan-thu/kyc-aml".',
        ts(['KYC', 'AML', 'Cập nhật hồ sơ'], ['tuan-thu/kyc-aml', 'tuan-thu/cu']), ts(['KYC', 'AML', 'Cập nhật hồ sơ'], ['tuan-thu/kyc-aml'])),
      rv(115, 'credit-corp', 'doc-qt-hdtd', 4, 'v3.0', '2026-11-03T14:05:00.000Z', SYS, 'Bỏ 3 tag không còn phù hợp', 'Các tag "Bảo hiểm", "Thanh toán quốc tế" và "Ngoại hối" không xuất hiện trong nội dung; tài liệu chỉ nói về thẩm quyền của Hội đồng tín dụng.',
        ts(['Hội đồng tín dụng', 'Thẩm quyền phê duyệt', 'Bảo hiểm', 'Thanh toán quốc tế', 'Ngoại hối'], ['tin-dung/khdn']), ts(['Hội đồng tín dụng', 'Thẩm quyền phê duyệt'], ['tin-dung/khdn'])),
      rv(114, 'core-banking', 'doc-t24-ops', 41, 'v41', '2026-11-03T10:30:00.000Z', SYS, 'Bỏ tag phiên bản T24 cũ', 'Tag "T24 R08" chỉ đúng với bản sổ tay trước; bản v41 mô tả T24 R20.',
        ts(['T24', 'Hạch toán', 'T24 R08', 'Giao dịch đảo'], ['van-hanh/core-banking']), ts(['T24', 'Hạch toán', 'Giao dịch đảo'], ['van-hanh/core-banking'])),
      rv(113, 'credit-corp', 'doc-dg-tsbd', 3, 'v1.3', '2026-11-02T15:45:00.000Z', AI, 'Bỏ tag "Cho vay mua nhà" khỏi tài liệu định giá TSBĐ', 'Tài liệu định giá tài sản bảo đảm cho khoản vay SME; không có nội dung về cho vay mua nhà của KHCN.',
        ts(['Tài sản bảo đảm', 'Định giá', 'Cho vay mua nhà', 'Bất động sản'], ['rui-ro/tsbd']), ts(['Tài sản bảo đảm', 'Định giá', 'Bất động sản'], ['rui-ro/tsbd'])),
      rv(112, 'kyc-aml', 'doc-kyc-ekyc', 3, 'v3', '2026-11-02T11:10:00.000Z', SYS, 'Bỏ 2 tag không còn phù hợp', 'Tag "Khách hàng doanh nghiệp" và "Tài trợ thương mại" không khớp phạm vi eKYC khách hàng cá nhân.',
        ts(['eKYC', 'Khách hàng cá nhân', 'Khách hàng doanh nghiệp', 'Tài trợ thương mại'], ['tuan-thu/kyc-aml', 'digital/ekyc']), ts(['eKYC', 'Khách hàng cá nhân'], ['tuan-thu/kyc-aml', 'digital/ekyc'])),
      rv(111, 'card', 'doc-cs-the26', 1, 'v1.0', '2026-11-01T09:00:00.000Z', SYS, 'Bỏ tag "Tiền gửi" khỏi chính sách thẻ', 'Chính sách sản phẩm thẻ và tín chấp không có nội dung về tiền gửi.',
        ts(['Thẻ tín dụng', 'Tín chấp', 'Tiền gửi'], ['the/tin-dung']), ts(['Thẻ tín dụng', 'Tín chấp'], ['the/tin-dung'])),
      rv(110, 'credit-corp', 'doc-qc-cv', 9, 'v4.0', '2026-10-31T16:35:00.000Z', SYS, 'Bỏ 1 tag nguồn của thư mục cũ', 'Thư mục "tin-dung/2023" đã được gộp vào "tin-dung/khdn".',
        ts(['Quy chế cho vay', 'Tín dụng doanh nghiệp', 'Giám sát sau giải ngân'], ['tin-dung/khdn', 'tin-dung/2023']), ts(['Quy chế cho vay', 'Tín dụng doanh nghiệp', 'Giám sát sau giải ngân'], ['tin-dung/khdn'])),
      rv(109, 'credit-corp', 'doc-mau-tt', 2, 'v2.0', '2026-10-31T10:20:00.000Z', AI, 'Bỏ tag quy trình khỏi mẫu tờ trình', 'Đây là biểu mẫu; các tag "Quy trình phê duyệt" và "Hội đồng tín dụng" thuộc tài liệu quy trình, không thuộc mẫu.',
        ts(['Biểu mẫu', 'Tờ trình', 'Quy trình phê duyệt', 'Hội đồng tín dụng'], ['tin-dung/khdn']), ts(['Biểu mẫu', 'Tờ trình'], ['tin-dung/khdn'])),
      rv(108, 'core-banking', 'doc-tb-vh07', 1, 'v1', '2026-10-30T14:00:00.000Z', SYS, 'Bỏ 2 tag không còn phù hợp', 'Thông báo vận hành tháng 07/2026 không có nội dung về "Thẻ ghi nợ" và "ATM".',
        ts(['Thông báo vận hành', 'T24', 'Thẻ ghi nợ', 'ATM'], ['van-hanh/core-banking']), ts(['Thông báo vận hành', 'T24'], ['van-hanh/core-banking'])),
      rv(107, 'credit-corp', 'doc-qd-td08', 1, 'v1.0', '2026-10-30T09:15:00.000Z', SYS, 'Bỏ tag "KHCN"', 'Quyết định áp dụng cho hồ sơ vay vốn lưu động của khách hàng SME.',
        ts(['Thẩm định', 'SME', 'KHCN'], ['tin-dung/khdn']), ts(['Thẩm định', 'SME'], ['tin-dung/khdn'])),
      rv(106, 'kyc-aml', 'doc-kyc-khdn', 8, 'v8', '2026-10-29T15:30:00.000Z', AI, 'Bỏ tag và tag nguồn hết hiệu lực', 'Tag "Quy định 2019" chỉ văn bản đã hết hiệu lực; tag nguồn "van-hanh/luu-tru" là thư mục lưu trữ.',
        ts(['KYC', 'Khách hàng doanh nghiệp', 'Quy định 2019'], ['tuan-thu/kyc-aml', 'van-hanh/luu-tru']), ts(['KYC', 'Khách hàng doanh nghiệp'], ['tuan-thu/kyc-aml'])),
      rv(105, 'credit-corp', 'doc-dt-sme', 3, 'v3.0', '2026-10-29T08:50:00.000Z', SYS, 'Bỏ tag năm cũ', 'Tag "2023" không khớp năm của tài liệu đào tạo (2024).',
        ts(['Đào tạo', 'SME', '2023'], ['tin-dung/dao-tao']), ts(['Đào tạo', 'SME'], ['tin-dung/dao-tao'])),
      rv(104, 'credit-corp', 'doc-nq-hdqt09', 1, 'v1.0', '2026-10-28T13:25:00.000Z', SYS, 'Bỏ 1 tag không còn phù hợp', 'Tag "Marketing" không xuất hiện trong nghị quyết.',
        ts(['Nghị quyết', 'HĐQT', 'Marketing'], ['tin-dung/khdn']), ts(['Nghị quyết', 'HĐQT'], ['tin-dung/khdn'])),
      // decided
      rel(97, 'credit-corp', '2.3', 'MINOR', '2026-10-28T09:00:00.000Z', NL, 'Bổ sung quy chế cho vay sửa đổi.', { added: 0, modified: 1, removed: 0, retagged: 0 },
        [d('doc-qc-cv', 'Quy chế cho vay', 'MODIFIED')], { added: 0, modified: 0, removed: 0 }, [], { reason: 'SELF_RELEASE', by: NL, at: '2026-10-28T09:00:00.000Z' }),
      rel(96, 'kyc-aml', '1.5', 'MINOR', '2026-10-21T10:00:00.000Z', TH, 'Cập nhật chính sách KYC/AML v13.', { added: 0, modified: 1, removed: 0, retagged: 0 },
        [d('doc-kyc-policy', 'Chính sách KYC/AML', 'MODIFIED')], { added: 0, modified: 0, removed: 0 }, [], { status: 'SUPERSEDED', at: '2026-10-26T16:45:00.000Z' }),
      gm(95, 'ONTOLOGY', ps('on-credit-e2e', 'Tín dụng doanh nghiệp E2E', 4), ps('on-global', 'Global', 5), '2026-10-22T08:00:00.000Z', HV,
        [it('ENTITY_TYPE', 'collateral', 'Collateral', 'ADDED'), it('RELATIONSHIP_TYPE', 'bao-dam-cho', 'bảo đảm cho', 'ADDED'), it('TRIPLE', 'collateral|bao-dam-cho|product', 'Collateral bảo đảm cho Product', 'ADDED'),
          it('ENTITY_TYPE', 'guarantor', 'Guarantor', 'ADDED')], ['credit-corp', 'kyc-aml'],
        { outcome: 'APPROVED_WITH_EDITS', reason: 'Đổi mã collateral để tránh trùng; Guarantor để lần sau.', by: ADMIN, at: '2026-10-22T14:30:00.000Z',
          finalPayload: { items: [{ itemType: 'ENTITY_TYPE', code: 'collateral', newCode: 'tai-san-bao-dam', newName: null }, { itemType: 'RELATIONSHIP_TYPE', code: 'bao-dam-cho', newCode: null, newName: null },
            { itemType: 'TRIPLE', code: 'collateral|bao-dam-cho|product', newCode: null, newName: null }] } }),
      rv(103, 'credit-corp', 'doc-hd-vld', 4, 'v1.6', '2026-10-27T09:00:00.000Z', SYS, 'Bỏ 2 tag không còn phù hợp', 'Tag "Ngoại hối" và "Bảo lãnh" không xuất hiện trong nội dung.',
        ts(['Vay vốn lưu động', 'Ngoại hối', 'Bảo lãnh'], ['tin-dung/khdn']), ts(['Vay vốn lưu động'], ['tin-dung/khdn']),
        { outcome: 'APPROVED', by: NL, at: '2026-10-27T10:15:00.000Z', appliedAt: '2026-10-27T10:16:30.000Z' }),
      rv(102, 'kyc-aml', 'doc-kyc-policy', 13, 'v13', '2026-10-26T14:00:00.000Z', AI, 'Bỏ 3 tag không còn phù hợp', 'Các tag "Thẻ", "Tiền gửi", "Bảo hiểm" không xuất hiện trong chính sách KYC/AML.',
        ts(['KYC', 'AML', 'Thẻ', 'Tiền gửi', 'Bảo hiểm'], ['tuan-thu/kyc-aml']), ts(['KYC', 'AML'], ['tuan-thu/kyc-aml']),
        { outcome: 'APPROVED_WITH_EDITS', reason: 'Giữ lại tag "Tiền gửi": Điều 9 có quy định về tài khoản tiền gửi.', finalPayload: ts(['KYC', 'AML', 'Tiền gửi'], ['tuan-thu/kyc-aml']), by: HV, at: '2026-10-26T16:40:00.000Z', appliedAt: '2026-10-26T16:41:10.000Z' }),
      rv(101, 'credit-corp', 'doc-qt-hdtd', 3, 'v2.9', '2026-10-25T10:30:00.000Z', SYS, 'Bỏ tag "Hội đồng tín dụng"', 'Tag không xuất hiện trong nội dung.',
        ts(['Hội đồng tín dụng', 'Thẩm quyền phê duyệt'], ['tin-dung/khdn']), ts(['Thẩm quyền phê duyệt'], ['tin-dung/khdn']),
        { outcome: 'REJECTED', reason: 'Tag vẫn phù hợp: Điều 3 quy định thẩm quyền của Hội đồng tín dụng.', by: NL, at: '2026-10-25T11:05:00.000Z' }),
      rv(100, 'core-banking', 'doc-t24-ops', 40, 'v40', '2026-10-24T08:00:00.000Z', SYS, 'Bỏ 1 tag nguồn trùng lặp', 'Tag nguồn "van-hanh/t24-cu" trùng nội dung với "van-hanh/core-banking".',
        ts(['T24', 'Hạch toán'], ['van-hanh/core-banking', 'van-hanh/t24-cu']), ts(['T24', 'Hạch toán'], ['van-hanh/core-banking']),
        { outcome: 'APPROVED', by: VD, at: '2026-10-24T09:20:00.000Z' }),
      rv(99, 'credit-corp', 'doc-qd-tdkhdn', 6, 'v2.2', '2026-10-22T15:10:00.000Z', AI, 'Bỏ tag "Cho vay mua ô tô"', 'Quy định cấp tín dụng KHDN không có sản phẩm cho vay mua ô tô.',
        ts(['Tín dụng doanh nghiệp', 'Cho vay mua ô tô'], ['tin-dung/khdn']), ts(['Tín dụng doanh nghiệp'], ['tin-dung/khdn']),
        { outcome: 'APPROVED', by: ADMIN, at: '2026-10-23T08:30:00.000Z', appliedAt: '2026-10-23T08:31:00.000Z' }),
      rv(98, 'kyc-aml', 'doc-kyc-ekyc', 2, 'v2', '2026-10-20T09:40:00.000Z', SYS, 'Bỏ 2 tag không còn phù hợp', 'Tag "Video call" và "Sinh trắc học" không xuất hiện trong nội dung.',
        ts(['eKYC', 'Video call', 'Sinh trắc học'], ['digital/ekyc']), ts(['eKYC'], ['digital/ekyc']),
        { outcome: 'REJECTED', reason: 'Mục 4 hướng dẫn xác thực qua video call và sinh trắc học; giữ nguyên tag.', by: NL, at: '2026-10-20T13:00:00.000Z' })
    ] };
  }
  try { if (new URLSearchParams(location.search).get('mock') === 'reset') localStorage.removeItem(KEY); } catch (e) {}
  function read() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.reviews) return s; } catch (e) {} return null; }
  var S = read() || seed();
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  if (!read()) persist();
  // another tab decided: take its state
  window.addEventListener('storage', function (e) { if (e.key === KEY) { var s = read(); if (s) { S = s; document.dispatchEvent(new CustomEvent('ecp-rv-change')); } } });

  // ---------- caller (X-Actor-Roles / X-Actor-Kb-Ids from the role picker) ----------
  function role() { return KB.role(); }
  function caller() {
    var r = role(), p = KB.me() && KB.person(KB.me());
    return r === 'admin' ? ADMIN : { userId: KB.me(), name: p ? p.name : KB.me(), role: r === 'owner' ? 'OWNER' : r === 'steward' ? 'STEWARD' : 'CONSUMER' };
  }
  function owns(kbId) { var k = KB.get(kbId); return !!k && k.owners.indexOf(KB.me()) !== -1; }
  // STEWARD and ADMIN see every review; OWNER those of their own KBs and the GLOBAL_MERGE ones (no KB); CONSUMER none (403)
  function sees(r) { var ro = role(); return ro === 'admin' || ro === 'steward' || (ro === 'owner' && (r.type === 'GLOBAL_MERGE' || owns(r.knowledgeBaseId))); }
  // GLOBAL_MERGE: Admin only; the others: Admin or the KB Owner
  function canDecide(r) { var ro = role(); return ro === 'admin' || (ro === 'owner' && r.type !== 'GLOBAL_MERGE' && owns(r.knowledgeBaseId)); }
  function view(r) {
    var o = clone(r);
    o.allowedActions = r.status === 'PENDING' && canDecide(r) ? (r.type === 'KNOWLEDGE_RELEASE' ? ['APPROVE', 'REJECT'] : ['APPROVE', 'APPROVE_WITH_EDITS', 'REJECT']) : [];
    return o;
  }
  function fail(status) { var e = new Error('HTTP ' + status); e.status = status; return e; }
  function subset(a, b) { return a.every(function (x) { return b.indexOf(x) !== -1; }); }

  // GET /reviews: { queue, q, kb, page (0-based), size, sortOrder (PENDING, by createdAt) } → page of reviews
  function list(x) {
    if (role() === 'consumer') throw fail(403);
    var fresh = read(); if (fresh) S = fresh;
    var q = String(x.q || '').trim().toLowerCase(), decided = x.queue === 'DECIDED';
    var rows = S.reviews.filter(function (r) {
      return (decided ? r.status !== 'PENDING' : r.status === 'PENDING') && sees(r) && (!x.kb || r.knowledgeBaseId === x.kb) &&
        (!q || r.code.toLowerCase().indexOf(q) !== -1 || r.summary.toLowerCase().indexOf(q) !== -1);
    });
    var key = decided ? 'decidedAt' : 'createdAt', dir = !decided && x.sortOrder === 'ASC' ? 1 : -1;
    rows.sort(function (a, b) { return (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * dir; });
    var size = x.size || 10, pages = Math.max(1, Math.ceil(rows.length / size));
    return { items: rows.slice(x.page * size, (x.page + 1) * size).map(view), page: x.page, size: size, totalItems: rows.length, totalPages: pages };
  }
  // POST /reviews/{id}/decisions with If-Match = revision. Checks in the contract's order: visible, reviewer, revision, PENDING, input.
  function decide(reviewId, revision, input) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        var fresh = read(); if (fresh) S = fresh;
        var r = S.reviews.filter(function (x) { return x.reviewId === reviewId; })[0];
        if (!r || !sees(r) || role() === 'consumer') return reject(fail(404));
        if (!canDecide(r)) return reject(fail(403));
        if (r.revision !== revision) return reject(fail(412));
        if (r.status !== 'PENDING') return reject(fail(409));
        var d = input.decision, fin = input.finalPayload;
        if (d === 'REJECTED' && !String(input.reason || '').trim()) return reject(fail(422));
        var codes = r.type === 'GLOBAL_MERGE' ? r.metadata.items.map(function (i) { return i.itemType + ':' + i.code; }) : null;
        if (d === 'APPROVED_WITH_EDITS' && (r.type === 'KNOWLEDGE_RELEASE' || !fin ||
          (codes ? !fin.items || !fin.items.length || !subset(fin.items.map(function (i) { return i.itemType + ':' + i.code; }), codes)
            : !subset(fin.tags, r.metadata.current.tags) || !subset(fin.sourceTags, r.metadata.current.sourceTags)))) return reject(fail(422));
        r.status = d === 'REJECTED' ? 'REJECTED' : 'APPROVED'; r.outcome = d; r.reason = input.reason || null;
        r.finalPayload = d === 'APPROVED_WITH_EDITS' ? clone(fin) : null;
        r.decidedBy = caller(); r.decidedAt = new Date().toISOString(); r.revision += 1;
        // knowledge-manager releases the snapshot / governance publishes Global when it applies the approval
        if (r.type !== 'METADATA_EDIT' && r.status === 'APPROVED') { r.applied = true; r.appliedAt = r.decidedAt; }
        S.rev += 1; persist();
        document.dispatchEvent(new CustomEvent('ecp-rv-change'));
        resolve(view(r));
      }, 250);
    });
  }
  CR.reviews = {
    list: list,
    decide: decide,
    // governance GET /change-requests?status=PENDING&objectType=ONTOLOGY,TAXONOMY (ADR-007 preset requests); CONSUMER gets 403
    presetCrs: function () {
      return role() === 'consumer' ? [] : [{ changeRequestId: 'CR-031', code: 'CR-031', objectType: 'ONTOLOGY', preset: { presetId: 'on-credit-e2e', kind: 'CUSTOM', name: 'Tín dụng doanh nghiệp E2E' },
        summary: 'Thêm entity type Collateral và relationship “bảo đảm cho”; deprecate “thế chấp”', maker: TH, href: 'quality-change-request.html' }];
    },
    // Knowledge Manager GET /knowledge-bases (names for the filter and the rows)
    kbNames: function () { return KB.all().map(function (k) { return { knowledgeBaseId: k.id, name: k.name }; }); },
    // title of the reviewed document (Knowledge Manager document list of the KB); undefined when the caller can't read it
    docTitle: function (kbId, docId) { var d = CR.viewerDoc(docId); return d ? d.title : undefined; },
    // the micro-frontend links /knowledge/{kb}/documents/{doc}; the mockup opens the document in the viewer
    docHref: function (kbId, docId) { return 'document-viewer.html?doc=' + encodeURIComponent(docId); }
  };
})();
