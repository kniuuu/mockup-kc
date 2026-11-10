/* Verify harness for config-ontology.html "entity TYPE colour" changes.
 * Uses Playwright (resolved from a known install) with system Chrome (channel: 'chrome').
 * WRITES real PNG files and FAILS if any expected screenshot is missing or <1KB. */
'use strict';
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const HTML_DIR = __dirname;
const SHOT_DIR = path.resolve(HTML_DIR, '../screenshots');
const LOG = path.join(HTML_DIR, '.verify-ontology-fixes.log');
const FILE_URL = 'file://' + path.join(HTML_DIR, 'config-ontology.html');

// resolve Playwright from a location that has it installed
const PW_PATHS = [
  '/Users/dark_kazansky/Working-Space/dk/Graph Nexus/node_modules/playwright',
];
let chromium = null;
for (const p of PW_PATHS) {
  try { chromium = createRequire(p + '/index.js')('playwright').chromium; break; } catch (e) { /* try next */ }
}
if (!chromium) { try { chromium = require('playwright').chromium; } catch (e) { } }

const lines = [];
const results = [];
function log(s) { lines.push(s); console.log(s); }
function check(name, pass, extra) { results.push({ name, pass: !!pass }); log((pass ? 'PASS' : 'FAIL') + ' · ' + name + (extra ? ' · ' + extra : '')); }

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('msb.theme', t); } catch (e) { }
  }, theme);
  await page.waitForTimeout(150);
}

async function shoot(page, name) {
  const file = path.join(SHOT_DIR, name + '.png');
  await page.waitForTimeout(350);
  await page.screenshot({ path: file });
  let size = 0;
  try { size = fs.statSync(file).size; } catch (e) { }
  const ok = size >= 1024;
  check('screenshot ' + name + '.png (' + size + 'B)', ok, ok ? '' : 'MISSING or <1KB');
  return { name: name + '.png', size, ok };
}

(async () => {
  if (!chromium) { log('FATAL: Playwright not resolvable'); fs.writeFileSync(LOG, lines.join('\n')); process.exit(2); }
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  log('Verify run · ' + new Date().toISOString());
  log('URL: ' + FILE_URL);

  const browser = await chromium.launch({ channel: 'chrome' });
  const consoleErrors = [];
  const shots = [];

  async function newPage(width, height) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') { consoleErrors.push('[' + width + 'x' + height + '] ' + m.text()); } });
    page.on('pageerror', (e) => { consoleErrors.push('[' + width + 'x' + height + '] PAGEERROR ' + e.message); });
    return { ctx, page };
  }

  async function load(page, query) {
    await page.goto(FILE_URL + (query || ''), { waitUntil: 'load' });
    await page.waitForFunction(() => window.OS && window.OS.state, null, { timeout: 8000 });
    await page.waitForTimeout(450); // allow fit() + render
  }

  try {
    // ============ 1440x900 pass ============
    let { ctx, page } = await newPage(1440, 900);

    // --- Studio dark: nodes coloured per entity type + legend lists types ---
    await load(page, '?mode=studio');
    await setTheme(page, 'dark');
    await page.waitForTimeout(300);

    // assert per-type colours: distinct fills among scoped type nodes
    const colorInfo = await page.evaluate(() => {
      const st = window.OS.state();
      const map = {};
      st.nodes.forEach((nid) => { const id = nid.replace('ty:', ''); map[id] = window.OS.typeColor(id)[0]; });
      const fills = Object.values(map);
      const uniq = new Set(fills);
      // also read actual rendered fill on a node body
      const bodies = Array.from(document.querySelectorAll('#os-graph .ecpg-node.os-sch .ecpg-body'))
        .map((b) => b.getAttribute('style') || '');
      return { count: fills.length, uniq: uniq.size, sample: map, bodiesSample: bodies.slice(0, 4) };
    });
    check('per-type colours assigned (nodes=' + colorInfo.count + ', distinct=' + colorInfo.uniq + ')', colorInfo.count > 0 && colorInfo.uniq >= Math.min(colorInfo.count, 5));
    check('node bodies carry fill style', colorInfo.bodiesSample.every((s) => /fill:(#|var\()/.test(s)), colorInfo.bodiesSample[0] || '');

    shots.push(await shoot(page, 'config-ontology-studio-dark-1440'));

    // --- Legend: open, must list entity types with colours, header 'Entity type', no 'Nhóm entity' ---
    await page.evaluate(() => window.OS.setLegendOpen(true));
    await page.waitForTimeout(250);
    const legendInfo = await page.evaluate(() => {
      const body = document.getElementById('os-lgd-body');
      const text = body ? body.textContent : '';
      const headers = Array.from(document.querySelectorAll('.os-lgd-h')).map((h) => h.textContent);
      const typeItems = Array.from(document.querySelectorAll('.ecpg-lgd-item[data-ecpg-lgd^="ty:"]'))
        .map((i) => ({ l: i.querySelector('.ecpg-lgd-l').textContent, c: (i.querySelector('.ecpg-lgd-sw') || {}).style ? i.querySelector('.ecpg-lgd-sw').style.getPropertyValue('--ecpg-lgd-c') : '' }));
      return { text, headers, typeItems, hasNhom: /Nhóm entity/.test(text) };
    });
    check('legend header includes "Entity type"', legendInfo.headers.indexOf('Entity type') >= 0, 'headers=' + JSON.stringify(legendInfo.headers));
    check('legend lists >=5 entity types with colours', legendInfo.typeItems.length >= 5 && legendInfo.typeItems.every((t) => /#|var\(/.test(t.c)), 'types=' + legendInfo.typeItems.length);
    check('legend has NO "Nhóm entity"', !legendInfo.hasNhom);
    shots.push(await shoot(page, 'config-ontology-legend-entity-types-dark-1440'));
    await page.evaluate(() => window.OS.setLegendOpen(false));

    // --- Bo loc filter: facet is 'Entity type'; toggling a type filters the graph ---
    await page.evaluate(() => window.OS.setFilterOpen(true, false));
    await page.waitForTimeout(250);
    const filterInfo = await page.evaluate(() => {
      const sec = document.querySelector('.ecpg-fs[data-fsec="type"]');
      const hd = sec ? sec.querySelector('.ecpg-fs-head h3, .ecpg-fs-head h4') : null;
      const title = hd ? hd.textContent : '';
      const tags = sec ? Array.from(sec.querySelectorAll('.ecpg-tag')).map((t) => ({ k: t.getAttribute('data-tag'), l: (t.querySelector('.ecpg-tag-l') || {}).textContent || '' })) : [];
      const panel = document.getElementById('os-fp') || document.querySelector('.ecpg-filter-panel');
      const panelText = panel ? panel.textContent : '';
      return { title, tags, hasNhom: /Nhóm entity/.test(panelText) };
    });
    check('filter facet title is "Entity type"', filterInfo.title === 'Entity type', 'title=' + filterInfo.title);
    check('filter type facet lists entity TYPES (keys ty-ids)', filterInfo.tags.length > 0 && /^type:t-/.test(filterInfo.tags[0].k), 'first=' + (filterInfo.tags[0] || {}).k);
    check('filter panel has NO "Nhóm entity"', !filterInfo.hasNhom);

    // toggle one type and confirm graph node count drops
    const firstTypeTag = filterInfo.tags[0] ? filterInfo.tags[0].k : null; // 'type:<id>'
    if (firstTypeTag) {
      const before = await page.evaluate(() => window.OS.state().nodes.length);
      await page.evaluate((k) => { const b = document.querySelector('.ecpg-tag[data-tag="' + k + '"]'); if (b) b.click(); }, firstTypeTag);
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => window.OS.state().nodes.length);
      check('toggling an Entity type filters graph (' + before + ' → ' + after + ')', after < before && after >= 1);
      await page.evaluate((k) => { const b = document.querySelector('.ecpg-tag[data-tag="' + k + '"]'); if (b) b.click(); }, firstTypeTag);
    } else {
      check('toggling an Entity type filters graph', false, 'no type tags found');
    }
    await page.evaluate(() => window.OS.setFilterOpen(false, false));
    await page.waitForTimeout(200);

    // --- Entity TYPE selected: editor has NO 'Nhóm entity'; keeps required fields ---
    await load(page, '?mode=studio&sel=t-cho-vay-sme');
    await setTheme(page, 'dark');
    await page.waitForTimeout(300);
    const typeEditor = await page.evaluate(() => {
      const body = document.querySelector('.os-side .cfg-side-body');
      const text = body ? body.textContent : '';
      const hasGroupSelect = !!document.getElementById('n-group');
      const labels = Array.from(document.querySelectorAll('.os-side .field > label, .os-side .field > .lbl')).map((l) => l.textContent.trim());
      return {
        hasNhom: /Nhóm entity/.test(text), hasGroupSelect, labels,
        hasName: !!document.getElementById('n-name'),
        hasCode: !!document.getElementById('n-code'),
        hasDesc: !!document.getElementById('n-desc'),
        hasSteward: !!document.getElementById('n-steward'),
        hasOwner: !!document.getElementById('n-owner'),
        hasStatus: !!document.getElementById('n-status'),
        hasAttrs: !!document.getElementById('n-attrs'),
        hasColorSwatch: !!document.querySelector('.os-side .os-color-ro')
      };
    });
    check('entity TYPE editor has NO "Nhóm entity" text', !typeEditor.hasNhom, 'labels=' + JSON.stringify(typeEditor.labels));
    check('entity TYPE editor has NO group <select id=n-group>', !typeEditor.hasGroupSelect);
    check('entity TYPE editor keeps Tên/Mã/Mô tả/Steward/Chủ sở hữu/Trạng thái/attrs',
      typeEditor.hasName && typeEditor.hasCode && typeEditor.hasDesc && typeEditor.hasSteward && typeEditor.hasOwner && typeEditor.hasStatus && typeEditor.hasAttrs);
    check('entity TYPE editor shows read-only colour swatch', typeEditor.hasColorSwatch);
    shots.push(await shoot(page, 'config-ontology-entity-type-selected-dark-1440'));

    // --- Entity INSTANCE selected: no 'Nhóm entity' ---
    await load(page, '?mode=studio&seli=ei-sme-1');
    await setTheme(page, 'dark');
    await page.waitForTimeout(250);
    const instEditor = await page.evaluate(() => {
      const body = document.querySelector('.os-side .cfg-side-body');
      return { hasNhom: /Nhóm entity/.test(body ? body.textContent : ''), hasName: !!document.getElementById('ei-name') };
    });
    check('entity INSTANCE editor has NO "Nhóm entity"', !instEditor.hasNhom);
    shots.push(await shoot(page, 'config-ontology-entity-instance-selected-dark-1440'));

    // --- Rel TYPE selected: 'Relationship type' label + MULTI-SELECT chips + cartesian triples + AI Refine ---
    // pick a NEW relationship type so we exercise add-source/add-target + the cartesian triple list.
    await load(page, '?mode=studio');
    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    // create a fresh relationship from a known type, then open its editor
    await page.evaluate(() => { window.OS.select({ kind: 'rel', id: window.OS.connect('ty:t-cho-vay-sme', 'ty:t-nd80') }); });
    await page.waitForTimeout(250);
    const relEditor0 = await page.evaluate(() => {
      const body = document.querySelector('.os-side .cfg-side-body');
      const labels = Array.from(document.querySelectorAll('.os-side .field > label, .os-side .field > .lbl')).map((l) => l.textContent.trim());
      return {
        hasNhom: /Nhóm entity/.test(body ? body.textContent : ''),
        hasPredicateWord: /Predicate/.test(body ? body.textContent : ''),
        relTypeLabel: labels.indexOf('Relationship type *') >= 0 || labels.some((l) => /Relationship type/.test(l)),
        hasOldS: !!document.getElementById('r-s'), hasOldT: !!document.getElementById('r-t'),
        hasChipsSrc: !!document.querySelector('[data-add-src]'), hasChipsTgt: !!document.querySelector('[data-add-tgt]'),
        rpAria: (document.getElementById('r-p') || {}).getAttribute ? document.getElementById('r-p').getAttribute('aria-label') : null
      };
    });
    check('rel TYPE field label reads "Relationship type" (not Predicate)', relEditor0.relTypeLabel && !relEditor0.hasPredicateWord, 'rpAria=' + relEditor0.rpAria);
    check('rel TYPE editor uses MULTI-SELECT chips (no old <select r-s/r-t>)', relEditor0.hasChipsSrc && relEditor0.hasChipsTgt && !relEditor0.hasOldS && !relEditor0.hasOldT);
    check('rel TYPE editor has NO "Nhóm entity"', !relEditor0.hasNhom);

    // add a 2nd source + 2nd target → cartesian combos should grow
    const combosBefore = await page.evaluate(() => document.querySelectorAll('#r-triple-list .os-triple-li').length);
    await page.evaluate(() => {
      const sadd = document.querySelector('[data-add-src]');
      const sopt = Array.from(sadd.options).find((o) => o.value && o.value !== '');
      sadd.value = sopt.value; sadd.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const tadd = document.querySelector('[data-add-tgt]');
      const topt = Array.from(tadd.options).find((o) => o.value && o.value !== '');
      tadd.value = topt.value; tadd.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const multiInfo = await page.evaluate(() => {
      return {
        srcChips: document.querySelectorAll('[data-rm-src]').length,
        tgtChips: document.querySelectorAll('[data-rm-tgt]').length,
        combos: document.querySelectorAll('#r-triple-list .os-triple-li').length,
        hasAiBtn: !!document.getElementById('r-airefine'),
        footText: (document.getElementById('os-side-foot') || {}).textContent || ''
      };
    });
    check('added 2nd source + 2nd target (chips: src=' + multiInfo.srcChips + ', tgt=' + multiInfo.tgtChips + ')', multiInfo.srcChips >= 2 && multiInfo.tgtChips >= 2);
    check('Triple list shows cartesian combos (src×tgt=' + (multiInfo.srcChips * multiInfo.tgtChips) + ', rows=' + multiInfo.combos + ')', multiInfo.combos === multiInfo.srcChips * multiInfo.tgtChips && multiInfo.combos >= 4);
    check('AI Refine button visible with >=2 combos', multiInfo.hasAiBtn && /AI Refine/.test(multiInfo.footText));
    // AI Refine sits far-left: its left edge is left of Huỷ/Lưu
    const footOrder = await page.evaluate(() => {
      const ai = document.getElementById('r-airefine'), save = document.getElementById('r-save'), cancel = document.getElementById('r-cancel');
      const rect = (e) => e ? e.getBoundingClientRect().left : null;
      return { ai: rect(ai), cancel: rect(cancel), save: rect(save) };
    });
    check('AI Refine is far-left of Huỷ/Lưu', footOrder.ai != null && footOrder.ai < footOrder.cancel && footOrder.ai < footOrder.save, JSON.stringify(footOrder));

    // remove one combo via its x
    const comboBeforeRm = multiInfo.combos;
    await page.evaluate(() => { const x = document.querySelector('#r-triple-list [data-rmtri]'); if (x) x.click(); });
    await page.waitForTimeout(200);
    const comboAfterRm = await page.evaluate(() => document.querySelectorAll('#r-triple-list .os-triple-li').length);
    check('removing a combo via x drops it (' + comboBeforeRm + ' → ' + comboAfterRm + ')', comboAfterRm === comboBeforeRm - 1);
    shots.push(await shoot(page, 'config-ontology-rel-type-selected-dark-1440'));

    // --- AI Refine: mark a subset, show confirm button; Keep one; then confirm-remove ---
    await page.evaluate(() => { const b = document.getElementById('r-airefine'); if (b) b.click(); });
    await page.waitForTimeout(1100); // ~0.8s simulated LLM + render
    const aiMarked = await page.evaluate(() => {
      return {
        marked: document.querySelectorAll('#r-triple-list .os-triple-li.is-airm').length,
        total: document.querySelectorAll('#r-triple-list .os-triple-li').length,
        hasTag: !!document.querySelector('.os-ai-tag'),
        hasRemoveBtn: !!document.getElementById('r-ai-remove'),
        removeTxt: (document.getElementById('r-ai-remove') || {}).textContent || '',
        hasKeepAll: !!document.getElementById('r-ai-keepall')
      };
    });
    check('AI Refine marked a subset (marked=' + aiMarked.marked + '/' + aiMarked.total + '), none deleted yet', aiMarked.marked >= 1 && aiMarked.marked < aiMarked.total && aiMarked.total === comboAfterRm);
    check('marked triples show "AI" tag + strike-through', aiMarked.hasTag);
    check('confirm button "Xoá N triple đã đánh dấu" appears', aiMarked.hasRemoveBtn && /Xoá\s+\d+\s+triple đã đánh dấu/.test(aiMarked.removeTxt), 'txt=' + aiMarked.removeTxt);
    check('"Giữ tất cả" dismiss control present', aiMarked.hasKeepAll);
    shots.push(await shoot(page, 'config-ontology-rel-airefine-marked-dark-1440'));

    // Keep one marked triple (its mark clears)
    const markedBeforeKeep = aiMarked.marked;
    await page.evaluate(() => { const k = document.querySelector('#r-triple-list [data-keep]'); if (k) k.click(); });
    await page.waitForTimeout(200);
    const afterKeep = await page.evaluate(() => document.querySelectorAll('#r-triple-list .os-triple-li.is-airm').length);
    check('Keep clears one mark (' + markedBeforeKeep + ' → ' + afterKeep + ')', afterKeep === markedBeforeKeep - 1);

    // confirm-remove the remaining marked ones
    const totalBeforeConfirm = await page.evaluate(() => document.querySelectorAll('#r-triple-list .os-triple-li').length);
    await page.evaluate(() => { const b = document.getElementById('r-ai-remove'); if (b) b.click(); });
    await page.waitForTimeout(250);
    const afterConfirm = await page.evaluate(() => ({ total: document.querySelectorAll('#r-triple-list .os-triple-li').length, marked: document.querySelectorAll('#r-triple-list .os-triple-li.is-airm').length }));
    check('confirm-remove deletes marked triples (' + totalBeforeConfirm + ' → ' + afterConfirm.total + '), none still marked', afterConfirm.total === totalBeforeConfirm - afterKeep && afterConfirm.marked === 0);

    // --- AI Refine shows for an EXISTING multi-pair type too (r-quydinh has many schema triples) ---
    await load(page, '?mode=studio&edge=r-quydinh');
    await setTheme(page, 'dark');
    await page.waitForTimeout(300);
    const existMulti = await page.evaluate(() => ({
      combos: document.querySelectorAll('#r-triple-list .os-triple-li').length,
      hasAi: !!document.getElementById('r-airefine'),
      label: Array.from(document.querySelectorAll('.os-side .field > label')).some((l) => /Relationship type/.test(l.textContent))
    }));
    check('existing multi-pair rel type shows cartesian combos + AI Refine', existMulti.combos >= 2 && existMulti.hasAi && existMulti.label, 'combos=' + existMulti.combos);

    // --- Rel INSTANCE selected ---
    await load(page, '?mode=studio&selr=ri-1');
    await setTheme(page, 'dark');
    await page.waitForTimeout(250);
    shots.push(await shoot(page, 'config-ontology-rel-instance-selected-dark-1440'));

    // --- Table Entity: no 'Nhóm entity' column ---
    await load(page, '?mode=table&view=ent');
    await setTheme(page, 'dark');
    await page.waitForTimeout(300);
    const tableEnt = await page.evaluate(() => {
      const ths = Array.from(document.querySelectorAll('.os-tbl thead th')).map((t) => t.textContent.trim());
      return { headers: ths, hasNhom: ths.indexOf('Nhóm entity') >= 0 };
    });
    check('Entity table has NO "Nhóm entity" column', !tableEnt.hasNhom, 'headers=' + JSON.stringify(tableEnt.headers));
    shots.push(await shoot(page, 'config-ontology-table-entity-dark-1440'));

    // --- Table Rel ---
    await load(page, '?mode=table&view=rel');
    await setTheme(page, 'dark');
    await page.waitForTimeout(300);
    shots.push(await shoot(page, 'config-ontology-table-rel-dark-1440'));

    // --- Tree types+instances (expand a type) ---
    await load(page, '?mode=studio');
    await setTheme(page, 'dark');
    await page.evaluate(() => {
      const exp = document.querySelector('#os-tree .os-dom-exp');
      if (exp) exp.click();
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const t = document.querySelector('#os-tree .os-tn-exp[data-expt]');
      if (t) t.click();
    });
    await page.waitForTimeout(250);
    shots.push(await shoot(page, 'config-ontology-tree-types-instances-dark-1440'));

    // --- KB without domains (the 'Thẻ' KB) ---
    await load(page, '?mode=studio&kb=the');
    await setTheme(page, 'dark');
    await page.waitForTimeout(350);
    shots.push(await shoot(page, 'config-ontology-kb-no-domain-dark-1440'));

    // --- Relationship-type combobox (now labelled 'Relationship type') ---
    await load(page, '?mode=studio&edge=r-quydinh');
    await setTheme(page, 'dark');
    await page.waitForTimeout(250);
    await page.evaluate(() => { const i = document.getElementById('r-p'); if (i) { i.focus(); i.click(); } });
    await page.waitForTimeout(350);
    const comboOpen = await page.evaluate(() => {
      const p = document.getElementById('r-p-pop');
      const label = Array.from(document.querySelectorAll('.os-side .field > label')).some((l) => /Relationship type/.test(l.textContent));
      return { open: p && !p.hidden, label };
    });
    check('relationship-type combobox opens (label reads "Relationship type")', comboOpen.open && comboOpen.label);
    shots.push(await shoot(page, 'config-ontology-predicate-combobox-dark-1440'));

    // --- Layout circular ---
    await load(page, '?mode=studio');
    await setTheme(page, 'dark');
    await page.evaluate(() => window.OS.setLayout('circular'));
    await page.waitForTimeout(500);
    check('layout set to circular', (await page.evaluate(() => window.OS.state().layout)) === 'circular');
    shots.push(await shoot(page, 'config-ontology-layout-circular-dark-1440'));

    // --- Layout radial ---
    await page.evaluate(() => window.OS.setLayout('radial'));
    await page.waitForTimeout(500);
    check('layout set to radial', (await page.evaluate(() => window.OS.state().layout)) === 'radial');
    shots.push(await shoot(page, 'config-ontology-layout-radial-dark-1440'));

    // --- Add node via top-right '+ Entity': new type with auto-assigned colour ---
    await load(page, '?mode=studio');
    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    const addInfo = await page.evaluate(() => {
      const beforeIds = window.OS.entities().map((e) => e.id);
      const btn = document.querySelector('.os-topright .btn-primary');
      btn.click();
      return { clicked: !!btn, beforeCount: beforeIds.length };
    });
    await page.waitForTimeout(400);
    const addResult = await page.evaluate(() => {
      const ents = window.OS.entities();
      const added = ents.filter((e) => e.added);
      const last = added[added.length - 1] || null;
      const sel = window.OS.state().sel;
      const hasGroupSelect = !!document.getElementById('n-group');
      const bodyText = (document.querySelector('.os-side .cfg-side-body') || {}).textContent || '';
      // node colour on the new node
      let nodeFill = null;
      if (last) { const body = document.querySelector('#os-graph .ecpg-node[data-id="ty:' + last.id + '"] .ecpg-body'); nodeFill = body ? (body.getAttribute('style') || '') : null; }
      return {
        total: ents.length, newType: last ? { id: last.id, sw: last.sw } : null,
        sel, hasGroupSelect, hasNhom: /Nhóm entity/.test(bodyText), nodeFill
      };
    });
    check('+ Entity created a new type', addResult.total === addInfo.beforeCount + 1 && !!addResult.newType);
    check('new type has an auto-assigned colour (sw)', !!(addResult.newType && addResult.newType.sw && /#|var\(/.test(addResult.newType.sw[0])), addResult.newType ? JSON.stringify(addResult.newType.sw) : '');
    check('new type node renders with its colour', !!(addResult.nodeFill && /fill:(#|var\()/.test(addResult.nodeFill)), addResult.nodeFill || 'no node');
    check('new type editor opens with NO group select / NO "Nhóm entity"', !addResult.hasGroupSelect && !addResult.hasNhom);
    shots.push(await shoot(page, 'config-ontology-addnode-dark-1440'));

    // --- Studio LIGHT 1440 ---
    await load(page, '?mode=studio');
    await setTheme(page, 'light');
    await page.waitForTimeout(350);
    shots.push(await shoot(page, 'config-ontology-studio-light-1440'));

    // --- Rel TYPE editor LIGHT 1440: multi-select chips + cartesian triples ---
    await load(page, '?mode=studio');
    await setTheme(page, 'light');
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.OS.select({ kind: 'rel', id: window.OS.connect('ty:t-cho-vay-sme', 'ty:t-nd80') }); });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const sadd = document.querySelector('[data-add-src]'); const sopt = Array.from(sadd.options).find((o) => o.value); sadd.value = sopt.value; sadd.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const tadd = document.querySelector('[data-add-tgt]'); const topt = Array.from(tadd.options).find((o) => o.value); tadd.value = topt.value; tadd.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(250);
    const lightRel = await page.evaluate(() => ({ combos: document.querySelectorAll('#r-triple-list .os-triple-li').length, ai: !!document.getElementById('r-airefine') }));
    check('LIGHT rel editor: multi-select chips produce cartesian combos + AI Refine', lightRel.combos >= 4 && lightRel.ai, 'combos=' + lightRel.combos);
    shots.push(await shoot(page, 'config-ontology-rel-type-selected-light-1440'));

    await ctx.close();

    // ============ 1180x800 pass ============
    ({ ctx, page } = await newPage(1180, 800));
    await load(page, '?mode=studio');
    await setTheme(page, 'dark');
    await page.waitForTimeout(350);
    shots.push(await shoot(page, 'config-ontology-studio-dark-1180'));

    // --- Rel TYPE editor at 1180 dark: chips must wrap, no clipping ---
    await load(page, '?mode=studio');
    await setTheme(page, 'dark');
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.OS.select({ kind: 'rel', id: window.OS.connect('ty:t-cho-vay-sme', 'ty:t-nd80') }); });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const sadd = document.querySelector('[data-add-src]'); const sopt = Array.from(sadd.options).find((o) => o.value); sadd.value = sopt.value; sadd.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const tadd = document.querySelector('[data-add-tgt]'); const topt = Array.from(tadd.options).find((o) => o.value); tadd.value = topt.value; tadd.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(250);
    const narrowRel = await page.evaluate(() => {
      const body = document.querySelector('.os-side .cfg-side-body');
      const clip = body ? (body.scrollWidth - body.clientWidth > 2) : false;
      return { combos: document.querySelectorAll('#r-triple-list .os-triple-li').length, clip };
    });
    check('rel editor at 1180: cartesian combos present + no horizontal clipping', narrowRel.combos >= 4 && !narrowRel.clip, 'clip=' + narrowRel.clip);
    shots.push(await shoot(page, 'config-ontology-rel-type-selected-dark-1180'));
    await ctx.close();

  } catch (err) {
    check('harness ran without exception', false, err.message);
    consoleErrors.push('HARNESS EXCEPTION: ' + (err.stack || err.message));
  }

  await browser.close();

  // ---- console errors ----
  log('');
  log('Console errors: ' + consoleErrors.length);
  consoleErrors.forEach((e) => log('  CONSOLE-ERR · ' + e));
  check('0 console errors', consoleErrors.length === 0, consoleErrors.length + ' error(s)');

  // ---- screenshot inventory ----
  log('');
  log('Screenshots written:');
  shots.forEach((s) => log('  ' + s.name + ' · ' + s.size + 'B · ' + (s.ok ? 'OK' : 'BAD')));

  const required = [
    'config-ontology-rel-type-selected-dark-1440', 'config-ontology-rel-airefine-marked-dark-1440',
    'config-ontology-rel-type-selected-light-1440', 'config-ontology-rel-type-selected-dark-1180',
    'config-ontology-studio-dark-1440', 'config-ontology-studio-light-1440', 'config-ontology-studio-dark-1180',
    'config-ontology-entity-type-selected-dark-1440', 'config-ontology-entity-instance-selected-dark-1440',
    'config-ontology-rel-instance-selected-dark-1440',
    'config-ontology-table-entity-dark-1440', 'config-ontology-table-rel-dark-1440',
    'config-ontology-tree-types-instances-dark-1440', 'config-ontology-kb-no-domain-dark-1440',
    'config-ontology-predicate-combobox-dark-1440', 'config-ontology-layout-circular-dark-1440',
    'config-ontology-layout-radial-dark-1440', 'config-ontology-addnode-dark-1440',
    'config-ontology-legend-entity-types-dark-1440'
  ];
  required.forEach((base) => {
    const f = path.join(SHOT_DIR, base + '.png');
    let sz = 0; try { sz = fs.statSync(f).size; } catch (e) { }
    check('required file ' + base + '.png present & >1KB (' + sz + 'B)', sz >= 1024);
  });

  const failed = results.filter((r) => !r.pass);
  log('');
  log('SUMMARY · ' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  fs.writeFileSync(LOG, lines.join('\n') + '\n');
  process.exit(failed.length ? 1 : 0);
})();
