/* ECP mockups: Transformation Job mock data + shared status rendering (transformation-job.html, job-detail.html).
 * - Mock only: a real build reads jobs and their documents from the job service. Nothing here is persisted;
 *   Cancel / Re-run change the in-memory records for the current page only.
 * - Job progress = documents that reached a final state (completed or error) / total documents.
 *   It is processing progress, not the success rate: a job can be 100% processed and still be Errors / Partially completed.
 * - Documents: the named ones carry their own progress, stage, error reason and stage notes. Filler documents (to reach
 *   the job's file count) are only Waiting (not started), Completed, or, where the job record says so, Error with the
 *   job's own reason and no percentage, so no progress value or error is made up for them.
 * - Pipeline stages and sub-steps follow the existing Transformation Job pipeline (tj.stg.*). */
(function () {
  var I = window.ECP_I18N || null;
  function T(k, v, a) { return I && I.tr ? I.tr(k, v, a) : String(v).replace(/\{(\w+)\}/g, function (m, x) { return a && a[x] !== undefined ? a[x] : m; }); }
  function lang() { return (I && I.lang) || 'vi'; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  var STAGES = [
    { k: 'acquisition', key: 'tj.stg.acquisition', label: 'Acquisition' },
    { k: 'processing', key: 'tj.stg.processing', label: 'Processing' },
    { k: 'indexing', key: 'tj.stg.indexing', label: 'Indexing', subs: [['chunking', 'tj.stg.chunking', 'Chunking'], ['embedding', 'tj.stg.embedding', 'Embedding']] },
    { k: 'enrichment', key: 'tj.stg.enrichment', label: 'Enrichment', subs: [['summarization', 'tj.stg.summarization', 'Summarization'], ['verifyingTags', 'tj.stg.verifyingTags', 'Verifying Tags'], ['graphifying', 'tj.stg.graphifying', 'Graphifying']] },
    { k: 'compilation', key: 'tj.stg.compilation', label: 'Compilation' }
  ];

  // error reasons: [i18n key, vi]
  var ERR = {
    ocrBlurry: ['jd.err.ocrBlurry', 'Lỗi OCR (ảnh mờ)'],
    corrupted: ['jd.err.corrupted', 'Tệp bị hỏng'],
    over50: ['jd.err.over50', 'Vượt 50 MB'],
    ocrTimeout: ['jd.err.ocrTimeout', 'Lỗi OCR (quá thời gian, trang 41–58)'],
    lowRes: ['tj.lowResolutionImage96Dpi', 'Ảnh độ phân giải thấp (96 dpi)'],
    ocrRetryable: ['jd.err.ocrRetryable', 'Lỗi OCR (có thể chạy lại)'],
    unsupportedZip: ['jd.err.unsupportedZip', 'Định dạng không hỗ trợ (.zip)']
  };

  // status: running | queued | failed | partial | done | skipped (+ cancelled, set in-session by Cancel)
  // trigger = [i18n key, vi] as recorded on the run; sourceName = source display name (mock: the source model only has a path)
  // ok = completed documents, err = documents that ended in error, total = documents in the run (null = not acquired yet)
  // dur = seconds from start to finish / last update (null = not started)
  // preset = PRESET_CHANGE (ADR-007 re-enrichment after a confirmed taxonomy / ontology preset switch): source "preset",
  //   no cancel, no re-run for anyone: the run has no action button (web.tj.presetChange label, as in the app).
  var JOBS = [
    { id: '4827', trigger: ['web.tj.presetChange', 'Đổi preset (chạy lại enrichment)'], preset: true, sourceName: 'preset · Quy định nhân sự', kb: 'hr', kbName: 'Quy định nhân sự', source: 's3://ecp-landing/preset/', status: 'running', total: 4, ok: 2, err: 0, day: 0, start: [10, 44], dur: 300 },
    { id: '4826', trigger: ['tj.sourceChanged12NewFiles', 'Source thay đổi (12 file mới, 3 sửa)'], sourceName: 'Landing · Tín dụng KHDN', kb: 'credit-corp', kbName: 'Quy trình tín dụng doanh nghiệp', source: 's3://ecp-landing/tin-dung/khdn/', status: 'running', total: 128, ok: 86, err: 4, day: 0, start: [10, 42], dur: 480 },
    { id: '4825', trigger: ['tj.scheduled', 'Lịch định kỳ'], sourceName: 'Landing · Thẻ', kb: 'card', kbName: 'Sản phẩm thẻ tín dụng', source: 's3://ecp-landing/the/', status: 'running', total: 86, ok: 12, err: 0, day: 0, start: [10, 38], dur: 720 },
    { id: '4824', trigger: ['tj.approvedEdit', 'Chỉnh sửa đã duyệt'], sourceName: 'Landing · KYC', kb: 'kyc-aml', kbName: 'Chính sách KYC/AML', source: 's3://ecp-landing/kyc/', status: 'queued', total: null, ok: 0, err: 0, day: 0, start: [10, 36], dur: null, note: ['tj.notStarted', 'Chưa bắt đầu'] },
    { id: '4823', trigger: ['tj.sourceChanged', 'Source thay đổi'], sourceName: 'Landing · Core Banking', kb: 'core-banking', kbName: 'Hướng dẫn Core Banking', source: 's3://ecp-landing/core-banking/', status: 'failed', total: 340, ok: 318, err: 22, day: 0, start: [9, 55], dur: 1260, note: ['tj.n22FilesWithOcrErrors', '22 file lỗi OCR (retryable)'], fillErr: 'ocrRetryable' },
    { id: '4822', trigger: ['tj.manualRescan', 'Quét lại thủ công'], sourceName: 'Landing · Digital', kb: 'faq-digital', kbName: 'FAQ Ngân hàng số', source: 's3://ecp-landing/digital/', status: 'partial', total: 64, ok: 62, err: 2, day: 0, start: [9, 10], dur: 840, note: ['tj.n2UnsupportedFilesZip', '2 file không hỗ trợ (.zip)'] },
    { id: '4821', trigger: ['tj.scheduled', 'Lịch định kỳ'], sourceName: 'Landing · Tín dụng KHDN', kb: 'credit-corp', kbName: 'Quy trình tín dụng doanh nghiệp', source: 's3://ecp-landing/tin-dung/khdn/', status: 'done', total: 12, ok: 12, err: 0, day: -1, start: [22, 0], dur: 360 },
    { id: '4820', trigger: ['tj.sourceChanged', 'Source thay đổi'], sourceName: 'Landing · Nhân sự', kb: 'hr', kbName: 'Quy định nhân sự', source: 's3://ecp-landing/nhan-su/', status: 'done', total: 4, ok: 4, err: 0, day: -1, start: [17, 12], dur: 120 },
    { id: '4819', trigger: ['tj.scheduled', 'Lịch định kỳ'], sourceName: 'Landing · Thẻ', kb: 'card', kbName: 'Sản phẩm thẻ tín dụng', source: 's3://ecp-landing/the/', status: 'skipped', total: 0, ok: 0, err: 0, day: -1, start: [2, 0], dur: 30, note: ['tj.deduplicatedChecksumUnchanged', 'Deduplicated: checksum không đổi'] },
    // UPLOAD = POST /document-uploads (kb-upload.html): source "manual"
    { id: '4818', trigger: ['tj.manualUpload', 'Tải lên thủ công'], sourceName: 'manual · FAQ Ngân hàng số', kb: 'faq-digital', kbName: 'FAQ Ngân hàng số', source: 's3://ecp-landing/manual/faq-digital/', status: 'done', total: 3, ok: 3, err: 0, day: -1, start: [1, 15], dur: 95 }
  ];

  // Named documents. st: processing | error | done | waiting; stage = index in STAGES; sub = index in that stage's subs.
  // at = [h, m, s] last update (same day as the job); mb = file size; info = stage notes data.
  var NAMED = {
    // preset re-enrichment: the documents of the working state go through Enrichment again (no acquisition notes)
    '4827': [
      { id: 'DOC-001963', name: 'quy-trinh-dao-tao.pdf', docType: 'Quy trình', mb: 1.3, change: 'modified', st: 'processing', pct: 85, stage: 3, sub: 1, at: [10, 48, 12], info: {} }
    ],
    '4826': [
      { id: 'DOC-001982', name: 'quy-dinh-cap-tin-dung-khdn.png', docType: 'Quy định', mb: 4.2, change: 'new', st: 'error', pct: 27, stage: 1, err: 'ocrBlurry', at: [10, 42, 48], info: { acq: [10, 42, 31] } },
      { id: 'DOC-001983', name: 'huong-dan-tham-dinh-ho-so.png', docType: 'Hướng dẫn', mb: 3.6, change: 'new', st: 'error', pct: 31, stage: 1, err: 'ocrBlurry', at: [10, 42, 18], info: { acq: [10, 42, 9] } },
      { id: 'DOC-001984', name: 'quy-trinh-phe-duyet-hoi-dong.docx', docType: 'Quy trình', mb: 1.1, change: 'modified', st: 'error', pct: 43, stage: 1, err: 'corrupted', at: [10, 42, 18], info: { acq: [10, 42, 6] } },
      { id: 'DOC-001985', name: 'mau-to-trinh-han-muc.png', docType: 'Biểu mẫu', mb: 57.3, change: 'new', st: 'error', pct: 28, stage: 1, err: 'over50', at: [10, 42, 7], info: { acq: [10, 42, 2] } },
      { id: 'DOC-001986', name: 'bang-xep-hang-tin-dung.pdf', docType: 'Quy định', mb: 2.4, change: 'modified', st: 'processing', pct: 86, stage: 3, sub: 2, at: [10, 42, 35], info: { acq: [10, 42, 3], pages: 18, ocr: 0, chunks: 64, vectors: 64 } },
      { id: 'DOC-001987', name: 'dinh-gia-tai-san-bao-dam.pdf', docType: 'Hướng dẫn', mb: 5.7, change: 'new', st: 'processing', pct: 32, stage: 1, at: [10, 42, 14], info: { acq: [10, 42, 4] } },
      { id: 'DOC-001988', name: 'phu-luc-dn-moi-thanh-lap.png', docType: 'Biểu mẫu', mb: 1.8, change: 'new', st: 'processing', pct: 70, stage: 3, sub: 0, at: [10, 42, 59], info: { acq: [10, 42, 5], pages: 1, ocr: 1, chunks: 3, vectors: 3 } },
      { id: 'DOC-001989', name: 'thong-tu-39-2016.xlsx', docType: 'Quy định', mb: 0.6, change: 'modified', st: 'processing', pct: 69, stage: 2, sub: 1, at: [10, 42, 39], info: { acq: [10, 42, 5], pages: 6, ocr: 0, chunks: 22, vectors: 20 } },
      { id: 'DOC-001990', name: 'bien-ban-hop-hdtd.pptx', docType: 'Quyết định', mb: 3.2, change: 'new', st: 'processing', pct: 76, stage: 3, sub: 1, at: [10, 42, 4], info: { acq: [10, 41, 58], pages: 14, ocr: 0, chunks: 31, vectors: 31 } },
      { id: 'DOC-001991', name: 'dao-tao-san-pham-sme.pdf', docType: 'Hướng dẫn', mb: 8.9, change: 'new', st: 'processing', pct: 41, stage: 2, sub: 1, at: [10, 43, 21], info: { acq: [10, 43, 21], pages: 12, ocr: 0, chunks: 45, vectors: 18 } }
    ],
    '4825': [
      { id: 'DOC-002301', name: 'bieu-phi-the-tin-dung-2025.pdf', docType: 'Biểu phí', mb: 1.4, change: 'modified', st: 'processing', pct: 62, stage: 2, sub: 1, at: [10, 49, 12], info: { acq: [10, 38, 40], pages: 9, ocr: 0, chunks: 28, vectors: 11 } },
      { id: 'DOC-002302', name: 'dieu-kien-phat-hanh-the.docx', docType: 'Quy định', mb: 0.8, change: 'modified', st: 'processing', pct: 35, stage: 1, at: [10, 48, 55], info: { acq: [10, 38, 41] } },
      { id: 'DOC-002303', name: 'uu-dai-the-tin-dung-q4.pptx', docType: 'Hướng dẫn', mb: 6.1, change: 'new', st: 'processing', pct: 18, stage: 1, at: [10, 49, 30], info: { acq: [10, 38, 44] } }
    ],
    '4823': [
      { id: 'DOC-000771', name: 'so-tay-T24-p3.pdf', docType: 'Hướng dẫn', mb: 22.5, change: 'modified', st: 'error', stage: 1, err: 'ocrTimeout', at: [10, 12, 40], info: { acq: [9, 55, 30] } },
      { id: 'DOC-000772', name: 'bieu-mau-scan-12.jpg', docType: 'Biểu mẫu', mb: 0.9, change: 'new', st: 'error', stage: 1, err: 'lowRes', at: [10, 14, 5], info: { acq: [9, 55, 30] } }
    ],
    '4822': [
      { id: 'DOC-000533', name: 'tai-lieu-dinh-kem-mbank.zip', mb: 14.2, change: 'new', st: 'error', stage: 0, err: 'unsupportedZip', at: [9, 10, 4], info: {} },
      { id: 'DOC-000534', name: 'anh-chup-man-hinh-ekyc.zip', mb: 9.7, change: 'new', st: 'error', stage: 0, err: 'unsupportedZip', at: [9, 10, 4], info: {} }
    ]
  };

  // filler file names per KB (sample content stays Vietnamese)
  var POOL = {
    'credit-corp': ['quy-dinh-tham-quyen-phe-duyet', 'huong-dan-lap-to-trinh', 'mau-hop-dong-tin-dung', 'chinh-sach-lai-suat-khdn', 'quy-trinh-giai-ngan', 'danh-muc-tai-san-bao-dam', 'huong-dan-cham-diem-xhtd', 'quy-trinh-tai-tham-dinh', 'bieu-mau-de-xuat-vay', 'quy-dinh-han-muc-tin-dung'],
    'card': ['bieu-phi-the', 'quy-trinh-phat-hanh-the', 'chinh-sach-hoan-tien', 'huong-dan-kich-hoat-the', 'dieu-khoan-su-dung-the', 'uu-dai-doi-tac', 'quy-trinh-khoa-the', 'han-muc-the-tin-dung'],
    'core-banking': ['so-tay-T24-giao-dich', 'tham-so-san-pham-tien-gui', 'xu-ly-su-co-cob', 'huong-dan-mo-tai-khoan', 'quy-trinh-dong-ngay', 'bieu-mau-scan', 'tai-lieu-api-t24', 'huong-dan-tra-cuu-giao-dich'],
    'faq-digital': ['faq-mbank-dang-nhap', 'faq-ekyc', 'faq-chuyen-tien-nhanh', 'faq-bao-mat-otp', 'faq-the-ao', 'faq-han-muc-giao-dich'],
    'hr': ['noi-quy-lao-dong', 'chinh-sach-nghi-phep', 'quy-che-luong-thuong', 'quy-trinh-dao-tao']
  };
  var EXTS = ['pdf', 'docx', 'pdf', 'xlsx', 'pdf', 'pptx', 'png'];
  var FT = { pdf: ['PDF', 'ft-pdf', 'PDF'], docx: ['DOC', 'ft-word', 'DOCX'], xlsx: ['XLS', 'ft-xls', 'XLSX'], pptx: ['PPT', 'ft-ppt', 'PPTX'], png: ['IMG', 'ft-img', 'PNG'], jpg: ['IMG', 'ft-img', 'JPG'], zip: ['ZIP', 'ft-pkg', 'ZIP'] };
  var DOC_BASE = { '4827': 1960, '4818': 2400, '4826': 1840, '4825': 2210, '4823': 410, '4822': 470, '4821': 1700, '4820': 1960 };

  // Compilation of a KB's knowledge packages (GET /package-compilations?knowledgeBaseId=): one row per chosen package
  // type, shown on every job of the KB (none chosen: no section). st: notStarted | running | done | failed | cancelled;
  // total / done / kept = packages (null while planning); rerun = allowedActions has RERUN (mock: the Steward gate decides)
  var COMP = {
    'credit-corp': [
      { type: 'GENERAL_WIKI', st: 'done', total: 12, done: 12, kept: 9 },
      { type: 'SOP', st: 'running', total: 8, done: 3, kept: 1 },
      { type: 'PLAYBOOK', st: 'failed', total: null, done: null, kept: null, error: 'invalid package JSON' },
      { type: 'TROUBLESHOOTING', st: 'notStarted', total: null, done: null, kept: null }
    ],
    'card': [
      { type: 'PRODUCT_WIKI', st: 'done', total: 6, done: 6, kept: 0 },
      { type: 'CONCEPT_GLOSSARY', st: 'running', total: null, done: null, kept: null }
    ],
    'hr': [
      { type: 'GENERAL_WIKI', st: 'cancelled', total: 4, done: 1, kept: 0 }
    ]
  };

  function jobById(id) { id = String(id || '').replace(/^#/, ''); return JOBS.filter(function (j) { return j.id === id; })[0] || null; }

  var cache = {};
  function docsFor(job) {
    if (!job) return [];
    if (cache[job.id]) return cache[job.id];
    var named = (NAMED[job.id] || []).map(function (d) { var c = {}; for (var k in d) c[k] = d[k]; return c; });
    var total = job.total || 0, out = named.slice();
    var cnt = { done: 0, error: 0 };
    named.forEach(function (d) { if (d.st === 'done') cnt.done++; if (d.st === 'error') cnt.error++; });
    var needDone = Math.max(0, job.ok - cnt.done), needErr = Math.max(0, job.err - cnt.error);
    var needWait = Math.max(0, total - named.length - needDone - needErr);
    var pool = POOL[job.kb] || POOL['credit-corp'], n = 0, base = DOC_BASE[job.id] || 100;
    var h = job.start[0], m = job.start[1];
    function filler(st) {
      var stem = pool[n % pool.length] + (n >= pool.length ? '-' + (Math.floor(n / pool.length) + 1) : '');
      var ext = EXTS[(n * 3 + job.id.charCodeAt(3)) % EXTS.length];
      var sec = 20 + n * 7, d = {
        id: 'DOC-' + String(1000000 + base + n).slice(1), name: stem + '.' + ext, mb: Math.round(((n * 37) % 90 + 4)) / 10,
        change: n % 3 ? 'modified' : 'new', st: st, stage: st === 'done' ? STAGES.length : st === 'error' ? 1 : 0,
        filler: true, info: {}
      };
      if (st === 'error') d.err = job.fillErr;
      if (st !== 'waiting') d.at = [h + Math.floor((m * 60 + sec) / 3600), Math.floor((m * 60 + sec) / 60) % 60, sec % 60];
      n++; return d;
    }
    var i;
    for (i = 0; i < needErr; i++) out.push(filler('error'));
    for (i = 0; i < needWait; i++) out.push(filler('waiting'));
    for (i = 0; i < needDone; i++) out.push(filler('done'));
    cache[job.id] = out;
    return out;
  }

  // ---------- formatting ----------
  function loc() { return lang() === 'en' ? 'en-GB' : 'vi-VN'; }
  function fmtTime(job, hms) {
    if (!hms) return '–';
    var d = new Date(2026, 9, 21 + (job.day || 0), hms[0], hms[1], hms[2] || 0);
    var t = new Intl.DateTimeFormat(loc(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
    return job.day ? T('common.yesterday', 'Hôm qua') + ' ' + t : t;
  }
  function fmtStart(job) {
    var d = new Date(2026, 9, 21 + (job.day || 0), job.start[0], job.start[1]);
    return new Intl.DateTimeFormat(loc(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }
  // run list: start clock (hh:mm, "Yesterday" prefix) and duration in the active locale, as the app's useJobFormat
  function fmtClock(job) {
    var t = new Intl.DateTimeFormat(loc(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(2026, 9, 21, job.start[0], job.start[1]));
    return job.day ? T('common.yesterday', 'Hôm qua') + ' ' + t : t;
  }
  function fmtDur(sec) {
    if (sec == null) return '–';
    var u = sec < 60 ? ['second', sec] : sec < 3600 ? ['minute', Math.round(sec / 60)] : ['hour', Math.round(sec / 3600)];
    return new Intl.NumberFormat(loc(), { style: 'unit', unit: u[0], unitDisplay: 'short' }).format(u[1]);
  }
  function fmtSize(mb) {
    if (mb == null) return '–';
    return new Intl.NumberFormat(loc(), { maximumFractionDigits: 1 }).format(mb) + ' MB';
  }
  function fmtInt(n) { return new Intl.NumberFormat(loc()).format(n); }
  function fileType(name) { var ext = String(name).split('.').pop().toLowerCase(); return FT[ext] ? ext : 'pdf'; }
  function fileIco(name) { var f = FT[fileType(name)]; return '<span class="file-ico sm ' + f[1] + '" aria-hidden="true">' + f[0] + '</span>'; }
  function formatLabel(name) { return FT[fileType(name)][2]; }

  // ---------- status: ring + label ----------
  // tone → ring / label colour; glyph replaces the percentage (Completed ✓, Skipped –, error without progress !)
  var CHECK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  var JOB_ST = {
    running: ['common.running', 'Đang chạy', 'info'],
    queued: ['common.waiting', 'Đang chờ', 'neutral'],
    failed: ['common.errors', 'Lỗi', 'error'],
    partial: ['tj.partiallyCompleted', 'Hoàn tất một phần', 'warning'],
    done: ['common.completed', 'Hoàn tất', 'success'],
    skipped: ['tj.skipped', 'Bỏ qua', 'neutral'],
    cancelled: ['tj.st.cancelled', 'Đã hủy', 'neutral']
  };
  var DOC_ST = {
    waiting: ['common.waiting', 'Đang chờ', 'neutral'],
    processing: ['jd.st.processing', 'Đang xử lý', 'info'],
    error: ['common.errors', 'Lỗi', 'error'],
    done: ['common.completed', 'Hoàn tất', 'success']
  };
  function jobPct(job) { return job.total ? Math.round((job.ok + job.err) / job.total * 100) : 0; }
  // pct: number or null (no meaningful value); glyph: 'check' | 'dash' | 'alert' | null
  function ringHtml(tone, pct, glyph, aria) {
    var inner = glyph === 'check' ? CHECK : glyph === 'dash' ? '–' : glyph === 'alert' ? '!' : pct + '%';
    var fill = glyph === 'check' ? 100 : glyph ? 0 : pct;
    var a = pct != null && !glyph ? ' role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"' : ' role="img"';
    return '<span class="job-progress-ring' + (glyph ? ' is-glyph' : '') + '" style="--pct:' + fill + '"' + a + ' aria-label="' + esc(aria) + '"><span class="job-progress-pct" aria-hidden="true">' + inner + '</span></span>';
  }
  function statusHtml(tone, ring, labelKey, labelVi, note, noteTitle) {
    return '<div class="job-st tone-' + tone + '">' + ring + '<div class="job-st-text"><div class="job-st-label job-ell">' + esc(T(labelKey, labelVi)) + '</div>' +
      (note ? '<div class="text-xs muted job-ell job-note" title="' + esc(noteTitle || note) + '">' + esc(note) + '</div>' : '') + '</div></div>';
  }
  function jobStatusHtml(job) {
    var s = JOB_ST[job.status] || JOB_ST.queued, pct = jobPct(job), label = T(s[0], s[1]);
    var glyph = job.status === 'done' ? 'check' : job.status === 'skipped' ? 'dash' : null;
    var aria = glyph ? label : label + ' ' + pct + '%';
    // note as the app: not started / deduplicated / n failed files (failed or partial runs only)
    var note = job.status === 'queued' ? T('tj.notStarted', 'Chưa bắt đầu')
      : job.status === 'skipped' ? T('tj.deduplicatedChecksumUnchanged', 'Deduplicated: checksum không đổi')
      : (job.status === 'failed' || job.status === 'partial') && job.err ? T('tj.nFailed', '{n} file lỗi', { n: fmtInt(job.err) }) : '';
    return statusHtml(s[2], '', s[0], s[1], note);
  }
  // one row per KB (GET /transformation-job-summaries): a running job makes it Running, a queued one Waiting; else the
  // documents of its latest run that acquired any (mock: that run's counts) decide Partial / Errors / Completed / Skipped
  function kbSummaries() {
    var by = {}, out = [];
    JOBS.forEach(function (j) {
      var s = by[j.kb];
      if (!s) { s = by[j.kb] = { kb: j.kb, kbName: j.kbName, jobs: [], total: 0, ok: 0, err: 0 }; out.push(s); }
      s.jobs.push(j);
      if (!s.docsFrom && j.total) { s.docsFrom = j; s.total = j.total; s.ok = j.ok; s.err = j.err; }
    });
    out.forEach(function (s) {
      var has = function (st) { return s.jobs.some(function (j) { return j.status === st; }); };
      s.status = has('running') ? 'running' : has('queued') ? 'queued' : s.err ? (s.ok ? 'partial' : 'failed') : s.ok ? 'done' : 'skipped';
      s.last = s.jobs[0];
    });
    return out;
  }
  function kbStatusHtml(s) {
    var st = JOB_ST[s.status];
    return statusHtml(st[2], '', st[0], st[1], (s.status === 'failed' || s.status === 'partial') && s.err ? T('tj.nFailed', '{n} file lỗi', { n: fmtInt(s.err) }) : '');
  }
  function kbProgressHtml(s) {
    var st = JOB_ST[s.status], label = T(st[0], st[1]), pct = s.total ? Math.round(s.ok / s.total * 100) : 0;
    var glyph = s.status === 'done' ? 'check' : s.status === 'skipped' ? 'dash' : null;
    return '<div class="job-st job-prog tone-' + st[2] + '">' + ringHtml(st[2], pct, glyph, glyph ? label : label + ' ' + pct + '%') + '</div>';
  }
  // Progress column: the ring only (status label + note sit in their own Status column)
  function jobProgressHtml(job) {
    var s = JOB_ST[job.status] || JOB_ST.queued, pct = jobPct(job), label = T(s[0], s[1]);
    var glyph = job.status === 'done' ? 'check' : job.status === 'skipped' ? 'dash' : null;
    return '<div class="job-st job-prog tone-' + s[2] + '">' + ringHtml(s[2], pct, glyph, glyph ? label : label + ' ' + pct + '%') + '</div>';
  }
  function docErr(d) { return d.err && ERR[d.err] ? T(ERR[d.err][0], ERR[d.err][1]) : ''; }
  function docStatusHtml(d) {
    var s = DOC_ST[d.st], label = T(s[0], s[1]);
    var pct = d.st === 'waiting' ? 0 : d.pct != null ? d.pct : null;
    var glyph = d.st === 'done' ? 'check' : (d.st === 'error' && pct == null) ? 'alert' : null;
    var aria = pct != null && !glyph ? label + ' ' + pct + '%' : label;
    return statusHtml(s[2], '', s[0], s[1], docErr(d));
  }
  function docProgressHtml(d) {
    var s = DOC_ST[d.st], label = T(s[0], s[1]);
    var pct = d.st === 'waiting' ? 0 : d.pct != null ? d.pct : null;
    var glyph = d.st === 'done' ? 'check' : (d.st === 'error' && pct == null) ? 'alert' : null;
    return '<div class="job-st job-prog tone-' + s[2] + '">' + ringHtml(s[2], pct, glyph, pct != null && !glyph ? label + ' ' + pct + '%' : label) + '</div>';
  }

  window.ECP_TJ = {
    STAGES: STAGES, JOBS: JOBS, DOC_ST: DOC_ST, JOB_ST: JOB_ST,
    job: jobById, docs: docsFor, comps: function (job) { return COMP[job.kb] || []; }, ringHtml: ringHtml, statusHtml: statusHtml, kbSummaries: kbSummaries, kbStatusHtml: kbStatusHtml, kbProgressHtml: kbProgressHtml, jobPct: jobPct, jobStatusHtml: jobStatusHtml, docStatusHtml: docStatusHtml, jobProgressHtml: jobProgressHtml, docProgressHtml: docProgressHtml, docErr: docErr,
    fmtTime: fmtTime, fmtStart: fmtStart, fmtClock: fmtClock, fmtDur: fmtDur, fmtSize: fmtSize, fmtInt: fmtInt, fileType: fileType, fileIco: fileIco, formatLabel: formatLabel,
    kbHref: function (job) { return 'ek-knowledge-detail.html?kb=' + encodeURIComponent(job.kb); },
    detailHref: function (job) { return 'job-detail.html?job=' + encodeURIComponent(job.id); },
    esc: esc, T: T
  };
})();
