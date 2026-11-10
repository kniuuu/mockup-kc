/* ECP mockups: sample graph datasets for ecp-graph.js (MSB enterprise knowledge). Placeholder data only. */
(function () {
  function N(id, label, caption, props, hidden) {
    return { id: id, labels: [label], caption: caption, hidden: !!hidden, props: props };
  }
  var nodes = [
    // Process
    N('proc-khdn', 'Process', 'Cấp tín dụng KHDN', { name: 'Cấp tín dụng KHDN', owner: 'Khối KHDN', SLA: '5 ngày làm việc', steps: 7, layer: 'Nghiệp vụ', evidence: 'QĐ-TD-08 · Điều 8' }),
    N('proc-thamdinh', 'Process', 'Thẩm định hồ sơ', { name: 'Thẩm định hồ sơ tín dụng', owner: 'Khối QTRR', SLA: '3 ngày làm việc', steps: 5, layer: 'Nghiệp vụ' }),
    N('proc-pd2', 'Process', 'Phê duyệt cấp 2', { name: 'Phê duyệt cấp 2', owner: 'Hội đồng tín dụng', SLA: '2 ngày làm việc', steps: 3, layer: 'Nghiệp vụ' }),
    N('proc-dinhgia', 'Process', 'Định giá TSBĐ', { name: 'Định giá tài sản bảo đảm', owner: 'Khối QTRR', SLA: '4 ngày làm việc', steps: 4, layer: 'Nghiệp vụ' }),
    N('proc-kyc', 'Process', 'Quy trình KYC', { name: 'Nhận biết khách hàng tổ chức', owner: 'Tuân thủ', SLA: '1 ngày làm việc', steps: 6, layer: 'Tuân thủ' }),
    N('proc-giaingan', 'Process', 'Giải ngân', { name: 'Giải ngân khoản vay', owner: 'Khối Vận hành', SLA: '1 ngày làm việc', steps: 4, layer: 'Vận hành' }),
    // Policy
    N('pol-15von', 'Policy', 'Quy định 15% vốn', { code: 'QĐ-TD-15', title: 'Giới hạn cấp tín dụng 15% vốn tự có', owner: 'Khối QTRR', effectiveDate: '2024-01-01', status: 'Hiệu lực', version: 'v3' }),
    N('pol-kyc', 'Policy', 'KYC tổ chức', { code: 'CS-TT-04', title: 'Chính sách KYC khách hàng tổ chức', owner: 'Tuân thủ', effectiveDate: '2023-10-01', status: 'Hiệu lực', version: 'v2' }),
    N('pol-xhtd', 'Policy', 'XHTD nội bộ', { code: 'CS-RR-11', title: 'Xếp hạng tín dụng nội bộ', owner: 'Khối QTRR', effectiveDate: '2024-03-15', status: 'Hiệu lực', version: 'v4' }),
    N('pol-tsbd', 'Policy', 'Tài sản bảo đảm', { code: 'CS-RR-07', title: 'Chính sách tài sản bảo đảm', owner: 'Khối QTRR', effectiveDate: '2023-07-01', status: 'Hiệu lực', version: 'v2' }),
    N('pol-aml', 'Policy', 'Chính sách AML', { code: 'CS-TT-01', title: 'Phòng chống rửa tiền', owner: 'Tuân thủ', effectiveDate: '2023-09-01', status: 'Hiệu lực', version: 'v5' }),
    N('pol-alm', 'Policy', 'Chính sách ALM', { code: 'CS-NV-02', title: 'Quản lý tài sản nợ - có', owner: 'ALCO', effectiveDate: '2024-02-01', status: 'Hiệu lực', version: 'v2' }),
    N('pol-laisuat', 'Policy', 'Chính sách lãi suất', { code: 'CS-NV-05', title: 'Khung lãi suất cho vay', owner: 'ALCO', effectiveDate: '2024-06-01', status: 'Hiệu lực', version: 'v7' }),
    N('pol-hanmuc', 'Policy', 'Phân cấp hạn mức', { code: 'QĐ-TD-09', title: 'Phân cấp thẩm quyền phê duyệt hạn mức', owner: 'Khối QTRR', effectiveDate: '2024-01-01', status: 'Hiệu lực', version: 'v3' }),
    // Regulation
    N('reg-tt39', 'Regulation', 'Thông tư 39', { code: 'Thông tư 39/2016/TT-NHNN', issuer: 'NHNN', effectiveDate: '2017-03-15', scope: 'Hoạt động cho vay' }),
    N('reg-tt41', 'Regulation', 'Thông tư 41', { code: 'Thông tư 41/2016/TT-NHNN', issuer: 'NHNN', effectiveDate: '2020-01-01', scope: 'Tỷ lệ an toàn vốn' }),
    N('reg-tt22', 'Regulation', 'Thông tư 22', { code: 'Thông tư 22/2019/TT-NHNN', issuer: 'NHNN', effectiveDate: '2020-01-01', scope: 'Giới hạn, tỷ lệ bảo đảm an toàn' }, true),
    N('reg-ldtctd', 'Regulation', 'Luật TCTD 2024', { code: 'Luật 32/2024/QH15', issuer: 'Quốc hội', effectiveDate: '2024-07-01', scope: 'Tổ chức tín dụng' }),
    N('reg-nd13', 'Regulation', 'Nghị định 13', { code: 'Nghị định 13/2023/NĐ-CP', issuer: 'Chính phủ', effectiveDate: '2023-07-01', scope: 'Bảo vệ dữ liệu cá nhân' }, true),
    N('reg-tt09', 'Regulation', 'Thông tư 09', { code: 'Thông tư 09/2023/TT-NHNN', issuer: 'NHNN', effectiveDate: '2023-10-15', scope: 'Phòng chống rửa tiền' }),
    // Document
    N('doc-qdtd08', 'Document', 'QĐ-TD-08', { code: 'QĐ-TD-08', title: 'Quy định cấp tín dụng KHDN', docType: 'Quy định', version: 'v2.3', publishedDate: '2024-01-01', owner: 'Khối QTRR', pages: 42 }),
    N('doc-qdtd07', 'Document', 'QĐ-TD-07', { code: 'QĐ-TD-07', title: 'Quy định cấp tín dụng KHDN (cũ)', docType: 'Quy định', version: 'v1.9', publishedDate: '2021-05-10', owner: 'Khối QTRR', pages: 36 }),
    N('doc-bctc', 'Document', 'Báo cáo tài chính', { code: 'BM-TD-03', title: 'Báo cáo tài chính khách hàng', docType: 'Biểu mẫu', version: 'v1.2', publishedDate: '2023-11-02', owner: 'Khối KHDN', pages: 6 }),
    N('doc-pl02', 'Document', 'Phụ lục 02', { code: 'QĐ-TD-08/PL02', title: 'Phụ lục 02: Sản phẩm hạn mức tuần hoàn', docType: 'Phụ lục', version: 'v2.3', publishedDate: '2024-01-01', owner: 'Khối KHDN', pages: 8 }),
    N('doc-hdtd', 'Document', 'Mẫu HĐ tín dụng', { code: 'BM-PC-12', title: 'Mẫu hợp đồng tín dụng hạn mức', docType: 'Biểu mẫu', version: 'v3.0', publishedDate: '2024-04-20', owner: 'Pháp chế', pages: 14 }),
    N('doc-sotaykyc', 'Document', 'Sổ tay KYC', { code: 'ST-TT-02', title: 'Sổ tay nhận biết khách hàng', docType: 'Hướng dẫn', version: 'v2.1', publishedDate: '2023-10-01', owner: 'Tuân thủ', pages: 28 }),
    N('doc-bcalm', 'Document', 'Báo cáo ALM Q2', { code: 'BC-ALCO-2024Q2', title: 'Báo cáo ALM quý 2/2024', docType: 'Báo cáo', version: 'v1.0', publishedDate: '2024-07-15', owner: 'ALCO', pages: 19 }, true),
    N('doc-hddinhgia', 'Document', 'HD định giá BĐS', { code: 'HD-RR-05', title: 'Hướng dẫn định giá bất động sản', docType: 'Hướng dẫn', version: 'v1.4', publishedDate: '2023-08-08', owner: 'Khối QTRR', pages: 22 }, true),
    N('doc-faqsme', 'Document', 'FAQ SME', { code: 'FAQ-KHDN-01', title: 'Câu hỏi thường gặp: Hạn mức SME', docType: 'FAQ', version: 'v1.1', publishedDate: '2024-05-02', owner: 'Khối KHDN', pages: 4 }, true),
    N('doc-playbook', 'Document', 'Playbook thẩm định', { code: 'PB-RR-01', title: 'Playbook thẩm định hồ sơ SME', docType: 'Playbook', version: 'v1.0', publishedDate: '2024-06-10', owner: 'Khối QTRR', pages: 12 }),
    // Department
    N('dep-hdtd', 'Department', 'Hội đồng tín dụng', { name: 'Hội đồng tín dụng', block: 'Khối QTRR', head: 'Lê Minh Châu', headcount: 9 }),
    N('dep-khdn', 'Department', 'Khối KHDN', { name: 'Khối Khách hàng doanh nghiệp', block: 'Kinh doanh', head: 'Trần Thị Bình', headcount: 640 }),
    N('dep-qtrr', 'Department', 'Khối QTRR', { name: 'Khối Quản trị rủi ro', block: 'Hỗ trợ', head: 'Nguyễn Văn An', headcount: 210 }),
    N('dep-phapche', 'Department', 'Pháp chế', { name: 'Phòng Pháp chế', block: 'Hỗ trợ', head: 'Đỗ Lan Anh', headcount: 35 }),
    N('dep-tuanthu', 'Department', 'Tuân thủ', { name: 'Phòng Tuân thủ', block: 'Hỗ trợ', head: 'Phạm Quốc Dũng', headcount: 48 }),
    N('dep-alco', 'Department', 'ALCO', { name: 'Hội đồng ALCO', block: 'Nguồn vốn', head: 'Hoàng Thu Hà', headcount: 11 }),
    N('dep-khcn', 'Department', 'Khối KHCN', { name: 'Khối Khách hàng cá nhân', block: 'Kinh doanh', head: 'Bùi Mai Khanh', headcount: 1250 }, true),
    // Person (placeholder people)
    N('per-an', 'Person', 'Nguyễn Văn An', { name: 'Nguyễn Văn An', title: 'Giám đốc Khối QTRR', department: 'Khối QTRR', email: 'an.nv@msb.example' }),
    N('per-binh', 'Person', 'Trần Thị Bình', { name: 'Trần Thị Bình', title: 'Giám đốc Khối KHDN', department: 'Khối KHDN', email: 'binh.tt@msb.example' }),
    N('per-chau', 'Person', 'Lê Minh Châu', { name: 'Lê Minh Châu', title: 'Chủ tịch HĐTD', department: 'Hội đồng tín dụng', email: 'chau.lm@msb.example' }),
    N('per-dung', 'Person', 'Phạm Quốc Dũng', { name: 'Phạm Quốc Dũng', title: 'Trưởng phòng Tuân thủ', department: 'Tuân thủ', email: 'dung.pq@msb.example' }, true),
    N('per-ha', 'Person', 'Hoàng Thu Hà', { name: 'Hoàng Thu Hà', title: 'Thư ký ALCO', department: 'ALCO', email: 'ha.ht@msb.example' }, true),
    N('per-huy', 'Person', 'Vũ Đức Huy', { name: 'Vũ Đức Huy', title: 'Chuyên viên thẩm định', department: 'Khối KHDN', email: 'huy.vd@msb.example' }),
    N('per-lananh', 'Person', 'Đỗ Lan Anh', { name: 'Đỗ Lan Anh', title: 'Trưởng phòng Pháp chế', department: 'Pháp chế', email: 'anh.dl@msb.example' }, true),
    N('per-khanh', 'Person', 'Bùi Mai Khanh', { name: 'Bùi Mai Khanh', title: 'Giám đốc Khối KHCN', department: 'Khối KHCN', email: 'khanh.bm@msb.example' }, true),
    // Product
    N('prod-sme', 'Product', 'Hạn mức SME', { name: 'Hạn mức tín dụng SME', segment: 'SME', limit: '15% vốn tự có', tenor: '12 tháng', interestType: 'Thả nổi' }),
    N('prod-5ty', 'Product', 'Gói tuần hoàn 5 tỷ', { name: 'Gói hạn mức tuần hoàn 5 tỷ', segment: 'SME', limit: '5 tỷ VND', tenor: '12 tháng', interestType: 'Thả nổi' }),
    N('prod-vaytd', 'Product', 'Vay tiêu dùng', { name: 'Vay tiêu dùng tín chấp', segment: 'Cá nhân', limit: '500 triệu VND', tenor: '60 tháng', interestType: 'Cố định' }),
    N('prod-the', 'Product', 'Thẻ tín dụng', { name: 'Thẻ tín dụng MSB', segment: 'Cá nhân', limit: '200 triệu VND', tenor: 'Không kỳ hạn', interestType: 'Cố định' }, true),
    N('prod-baolanh', 'Product', 'Bảo lãnh thanh toán', { name: 'Bảo lãnh thanh toán', segment: 'Doanh nghiệp', limit: 'Theo hạn mức', tenor: '24 tháng', interestType: 'Phí' }),
    N('prod-xnk', 'Product', 'Tài trợ XNK', { name: 'Tài trợ xuất nhập khẩu', segment: 'Doanh nghiệp', limit: 'Theo L/C', tenor: '6 tháng', interestType: 'Thả nổi' }, true),
    N('prod-vaynha', 'Product', 'Vay mua nhà', { name: 'Vay mua nhà ở', segment: 'Cá nhân', limit: '70% giá trị TSBĐ', tenor: '25 năm', interestType: 'Thả nổi' }),
    // Concept
    N('con-vtc', 'Concept', 'Vốn tự có', { name: 'Vốn tự có', definition: 'Vốn cấp 1 + vốn cấp 2 trừ các khoản giảm trừ', synonyms: 'Own funds' }),
    N('con-ubo', 'Concept', 'Chủ sở hữu hưởng lợi', { name: 'Chủ sở hữu hưởng lợi', definition: 'Cá nhân sở hữu thực tế ≥25% vốn điều lệ', synonyms: 'UBO' }),
    N('con-ltv', 'Concept', 'Tỷ lệ LTV', { name: 'Loan-to-Value', definition: 'Dư nợ / giá trị TSBĐ', synonyms: 'LTV' }, true),
    N('con-nim', 'Concept', 'NIM', { name: 'Biên lãi ròng', definition: 'Thu nhập lãi thuần / tài sản sinh lãi bình quân', synonyms: 'Net interest margin' }, true),
    N('con-pd', 'Concept', 'Xác suất vỡ nợ', { name: 'Xác suất vỡ nợ', definition: 'Khả năng KH không trả nợ trong 12 tháng', synonyms: 'PD' }, true),
    N('con-nhomno', 'Concept', 'Nhóm nợ', { name: 'Phân loại nhóm nợ', definition: 'Nhóm 1–5 theo số ngày quá hạn', synonyms: 'Debt classification' }, true)
  ];
  var triples = [
    'proc-thamdinh PART_OF proc-khdn', 'proc-pd2 PART_OF proc-khdn', 'proc-dinhgia PART_OF proc-thamdinh', 'proc-giaingan PART_OF proc-khdn',
    'proc-kyc PART_OF proc-khdn', 'proc-khdn GOVERNED_BY pol-15von', 'proc-khdn GOVERNED_BY pol-kyc', 'dep-hdtd APPROVES proc-khdn',
    'proc-thamdinh REQUIRES doc-bctc', 'proc-thamdinh REQUIRES pol-xhtd', 'proc-thamdinh GOVERNED_BY pol-tsbd', 'proc-dinhgia IMPLEMENTS pol-tsbd',
    'proc-dinhgia REFERENCES doc-hddinhgia', 'proc-kyc IMPLEMENTS pol-kyc', 'proc-kyc REFERENCES doc-sotaykyc', 'pol-15von IMPLEMENTS reg-ldtctd',
    'pol-15von REFERENCES reg-tt39', 'pol-15von MENTIONS con-vtc', 'pol-kyc IMPLEMENTS reg-tt09', 'pol-aml IMPLEMENTS reg-tt09',
    'pol-kyc PART_OF pol-aml', 'pol-kyc DEFINES con-ubo', 'pol-xhtd DEFINES con-pd', 'pol-xhtd REFERENCES reg-tt41',
    'pol-tsbd DEFINES con-ltv', 'pol-tsbd REFERENCES reg-tt39', 'pol-alm IMPLEMENTS reg-tt22', 'pol-alm DEFINES con-nim',
    'pol-hanmuc APPLIES_TO prod-sme', 'pol-hanmuc APPLIES_TO prod-5ty', 'pol-15von APPLIES_TO prod-sme', 'pol-laisuat APPLIES_TO prod-vaytd',
    'pol-laisuat APPLIES_TO prod-vaynha', 'pol-tsbd APPLIES_TO prod-vaynha', 'pol-xhtd APPLIES_TO prod-sme', 'doc-qdtd08 ISSUED_BY dep-qtrr',
    'doc-qdtd08 DEFINES pol-15von', 'doc-qdtd08 DEFINES pol-hanmuc', 'doc-qdtd08 SUPERSEDES doc-qdtd07', 'doc-qdtd08 REFERENCES doc-qdtd07',
    'doc-pl02 PART_OF doc-qdtd08', 'doc-qdtd08 REFERENCES doc-pl02', 'doc-pl02 DEFINES prod-5ty', 'doc-qdtd08 REFERENCES reg-tt39',
    'doc-qdtd08 SUPERSEDES doc-qdtd08', 'pol-aml REFERENCES pol-aml', 'doc-hdtd APPLIES_TO prod-sme', 'doc-hdtd ISSUED_BY dep-phapche',
    'doc-sotaykyc ISSUED_BY dep-tuanthu', 'doc-sotaykyc MENTIONS con-ubo', 'doc-bcalm ISSUED_BY dep-alco', 'doc-bcalm MENTIONS con-nim',
    'doc-hddinhgia ISSUED_BY dep-qtrr', 'doc-faqsme MENTIONS prod-sme', 'doc-faqsme REFERENCES doc-qdtd08', 'doc-playbook REFERENCES proc-thamdinh',
    'doc-playbook MENTIONS pol-xhtd', 'doc-bctc MENTIONS con-vtc', 'dep-qtrr OWNS pol-15von', 'dep-qtrr OWNS pol-xhtd',
    'dep-qtrr OWNS pol-tsbd', 'dep-khdn OWNS proc-khdn', 'dep-khdn OWNS prod-sme', 'dep-khdn OWNS prod-5ty',
    'dep-khdn OWNS prod-baolanh', 'dep-khdn OWNS prod-xnk', 'dep-khcn OWNS prod-vaytd', 'dep-khcn OWNS prod-the',
    'dep-khcn OWNS prod-vaynha', 'dep-tuanthu OWNS pol-aml', 'dep-tuanthu OWNS pol-kyc', 'dep-alco OWNS pol-alm',
    'dep-alco OWNS pol-laisuat', 'dep-hdtd PART_OF dep-qtrr', 'dep-hdtd APPROVES prod-5ty', 'dep-hdtd APPROVES pol-hanmuc',
    'dep-phapche APPROVES doc-qdtd08', 'dep-tuanthu APPROVES doc-sotaykyc', 'dep-hdtd APPROVES proc-pd2', 'per-an WORKS_IN dep-qtrr',
    'per-an MANAGES dep-qtrr', 'per-binh WORKS_IN dep-khdn', 'per-binh MANAGES dep-khdn', 'per-chau WORKS_IN dep-hdtd',
    'per-chau APPROVES prod-5ty', 'per-dung WORKS_IN dep-tuanthu', 'per-dung OWNS doc-sotaykyc', 'per-ha WORKS_IN dep-alco',
    'per-ha OWNS doc-bcalm', 'per-huy WORKS_IN dep-khdn', 'per-huy OWNS doc-playbook', 'per-lananh WORKS_IN dep-phapche',
    'per-lananh OWNS doc-hdtd', 'per-khanh WORKS_IN dep-khcn', 'per-khanh MANAGES dep-khcn', 'prod-sme REQUIRES pol-kyc',
    'prod-5ty PART_OF prod-sme', 'prod-baolanh GOVERNED_BY reg-ldtctd', 'prod-xnk GOVERNED_BY pol-aml', 'prod-vaynha REQUIRES proc-dinhgia',
    'reg-tt41 DEFINES con-vtc', 'reg-tt39 MENTIONS con-nhomno', 'pol-xhtd MENTIONS con-nhomno', 'reg-nd13 APPLIES_TO pol-kyc',
    'reg-nd13 APPLIES_TO doc-sotaykyc', 'prod-the GOVERNED_BY pol-laisuat', 'dep-hdtd APPROVES prod-sme', 'proc-thamdinh APPLIES_TO prod-sme',
    'doc-qdtd08 DEFINES prod-sme', 'proc-giaingan REQUIRES doc-hdtd'
  ];
  var EV = ['QĐ-TD-08 · Điều 8', 'QĐ-TD-08 · Trang 12', 'Sổ tay KYC · Mục 3', 'CS-RR-11 · Điều 4', 'Phụ lục 02 · Mục 1', 'BC-ALCO · Slide 8'];
  var rels = triples.map(function (t, i) {
    var p = t.split(' ');
    var props = { since: '2024-0' + ((i % 9) + 1), confidence: Math.round((0.78 + (i * 37 % 21) / 100) * 100) / 100, evidence: EV[i % EV.length] };
    if (p[0] === p[2]) props.note = p[1] === 'SUPERSEDES' ? 'Chuỗi phiên bản v2.3 → v2.2' : 'Điều 12 dẫn chiếu Điều 5';
    return { id: 'r' + (i + 1), source: p[0], target: p[2], type: p[1], props: props };
  });

  // ---- ontology schema (config-ontology) ----
  function T(id, label, caption, props) { return { id: id, labels: [label], caption: caption, props: props }; }
  var onNodes = [
    T('t-product', 'Domain', 'Product', { type: 'Entity', layer: 'Domain', properties: 'ma_sp*, ten_sp, phan_khuc', instances: '1.820' }),
    T('t-loan', 'Domain', 'Loan', { type: 'Entity', layer: 'Domain', properties: 'so_hd*, du_no: decimal, nhom_no: int', instances: '48.300' }),
    T('t-customer', 'Domain', 'Customer', { type: 'Entity', layer: 'Domain', properties: 'cif*, ten, phan_khuc', instances: '96.400' }),
    T('t-org', 'Domain', 'Organization', { type: 'Entity', layer: 'Domain', properties: 'ma_dv*, ten_dv', instances: '312' }),
    T('t-collateral', 'Domain', 'Collateral', { type: 'Entity', layer: 'Domain', properties: 'loai_tai_san*: enum, gia_tri_dinh_gia: decimal, ngay_dinh_gia: date', status: 'Draft · mới', changeRequest: 'CR-031' }),
    T('t-policy', 'Concept', 'Policy', { type: 'Entity', layer: 'Concept', properties: 'ma_cs*, hieu_luc: date', instances: '214' }),
    T('t-term', 'Concept', 'BusinessTerm', { type: 'Entity', layer: 'Concept', properties: 'thuat_ngu*, dinh_nghia', instances: '1.105' }),
    T('t-role', 'Concept', 'Role', { type: 'Entity', layer: 'Concept', properties: 'ma_vai_tro*, cap_tham_quyen', instances: '64' }),
    T('t-document', 'Document', 'Document', { type: 'Entity', layer: 'Document', properties: 'ma_vb*, phien_ban, ngay_ban_hanh', instances: '5.930' }),
    T('t-process', 'Evidence', 'Process', { type: 'Entity', layer: 'Evidence', properties: 'ma_qt*, owner, sla', instances: '148' }),
    T('t-chunk', 'Evidence', 'Chunk', { type: 'Entity', layer: 'Evidence', properties: 'chunk_id*, trang, embedding', instances: '412.000' })
  ];
  var onTriples = [
    ['t-policy', 'APPLIES_TO', 't-product', 'approved', 'áp dụng', 'N:M'],
    ['t-policy', 'APPLIES_TO', 't-loan', 'approved', 'áp dụng', 'N:M'],
    ['t-document', 'REFERENCES', 't-policy', 'approved', 'tham chiếu', 'N:M'],
    ['t-customer', 'BELONGS_TO', 't-org', 'approved', 'thuộc', 'N:1'],
    ['t-collateral', 'SECURES', 't-product', 'approved', 'bảo đảm cho (mới)', 'N:M'],
    ['t-customer', 'BORROWS', 't-loan', 'approved', 'vay', '1:N'],
    ['t-policy', 'HAS_EVIDENCE', 't-chunk', 'ai', 'có bằng chứng (AI)', '1:N'],
    ['t-process', 'USES', 't-document', 'approved', 'sử dụng', 'N:M'],
    ['t-collateral', 'PLEDGES', 't-loan', 'deprecated', 'thế chấp (deprecated)', 'N:M'],
    ['t-term', 'APPLIES_TO', 't-policy', 'ai', 'áp dụng (AI)', 'N:M'],
    ['t-loan', 'APPROVED_BY', 't-role', 'approved', 'phê duyệt bởi', 'N:1'],
    ['t-process', 'PERFORMED_BY', 't-role', 'approved', 'thực hiện bởi', 'N:M'],
    ['t-process', 'PERFORMED_BY', 't-org', 'ai', 'thực hiện bởi (AI)', 'N:M'],
    ['t-customer', 'GUARANTEES', 't-customer', 'invalid', 'bảo lãnh cho (chưa định nghĩa)', 'N:M']
  ];
  var onRels = onTriples.map(function (t, i) {
    return { id: 'o' + (i + 1), source: t[0], target: t[2], type: t[1], status: t[3],
      props: { nhan: t[4], status: t[3], cardinality: t[5], crId: t[3] === 'invalid' ? '—' : 'CR-031' } };
  });

  var viewerBase = ['proc-khdn', 'pol-15von', 'pol-kyc', 'prod-sme', 'dep-hdtd', 'pol-xhtd', 'doc-qdtd08', 'proc-thamdinh', 'doc-pl02', 'reg-tt39', 'con-vtc'];
  window.ECP_GRAPH_DATA = {
    bank: { nodes: nodes, rels: rels },
    ontology: { nodes: onNodes, rels: onRels },
    'evidence-ask': { base: 'bank', focus: 'prod-sme', nodeIds: ['prod-sme', 'proc-thamdinh', 'pol-15von', 'dep-hdtd', 'doc-qdtd08', 'pol-xhtd'] },
    // ask-thread turn 3 (doanh nghiệp mới thành lập): same component + counts pattern as evidence-ask
    'evidence-thread': { base: 'bank', focus: 'proc-thamdinh', nodeIds: ['proc-thamdinh', 'prod-sme', 'pol-tsbd', 'dep-hdtd', 'doc-pl02', 'prod-5ty'] },
    'viewer-doc': { base: 'bank', focus: 'doc-qdtd08', nodeIds: viewerBase.concat(['doc-qdtd07', 'dep-qtrr', 'pol-hanmuc']) },
    'viewer-wiki': { base: 'bank', focus: 'proc-khdn', nodeIds: viewerBase.concat(['proc-pd2', 'proc-kyc', 'dep-khdn']) },
    'viewer-faq': { base: 'bank', focus: 'prod-sme', nodeIds: viewerBase.concat(['doc-faqsme', 'prod-5ty', 'pol-hanmuc']) },
    'viewer-playbook': { base: 'bank', focus: 'proc-thamdinh', nodeIds: viewerBase.concat(['doc-playbook', 'doc-bctc', 'pol-tsbd', 'proc-dinhgia']) }
  };
})();
