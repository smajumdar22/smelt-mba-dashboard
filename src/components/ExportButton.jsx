import { useState } from 'react';
import { supabase } from '../lib/supabase';

// ── XML escape ───────────────────────────────────────────────
function escXml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ── Column name helper ───────────────────────────────────────
function colName(n) {
  let s = '';
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

// ── Hex color → ARGB for Excel fills ────────────────────────
function toArgb(hex) {
  const h = hex.replace('#', '');
  return 'FF' + (h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h).toUpperCase();
}

// ── Build XLSX from scratch (no external deps) ───────────────
function buildXlsx(sheets) {
  const strings = [];
  const stringMap = {};
  function si(str) {
    const k = String(str ?? '');
    if (stringMap[k] === undefined) { stringMap[k] = strings.length; strings.push(k); }
    return stringMap[k];
  }

  // Dynamic fills: index 0-5 are base fills, 6+ are course colors
  const courseColorFills = [];
  function getCourseColorFillIdx(hex) {
    const argb = toArgb(hex);
    let idx = courseColorFills.indexOf(argb);
    if (idx === -1) { idx = courseColorFills.length; courseColorFills.push(argb); }
    return idx + 6; // offset past base fills
  }

  function buildStylesXml() {
    const dynamicFills = courseColorFills.map(argb =>
      `<fill><patternFill patternType="solid"><fgColor rgb="${argb}"/></patternFill></fill>`
    ).join('');

    const dynamicXfs = courseColorFills.map((_, i) =>
      `<xf numFmtId="0" fontId="0" fillId="${i + 6}" borderId="1" xfId="0"><alignment wrapText="1" vertical="center"/></xf>`
    ).join('');

    const totalFills = 6 + courseColorFills.length;
    const totalXfs = 9 + courseColorFills.length;

    return `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="10"/><name val="Arial"/></font>
    <font><sz val="10"/><b/><name val="Arial"/><color rgb="FFFFFFFF"/></font>
    <font><sz val="10"/><b/><name val="Arial"/><color rgb="FF1A5276"/></font>
    <font><sz val="10"/><name val="Arial"/><color rgb="FF5D6D7E"/></font>
    <font><sz val="10"/><b/><name val="Arial"/></font>
  </fonts>
  <fills count="${totalFills}">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1A2F5A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD6EAF8"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F4F5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8FBF6"/></patternFill></fill>
    ${dynamicFills}
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFBDC3C7"/></left>
      <right style="thin"><color rgb="FFBDC3C7"/></right>
      <top style="thin"><color rgb="FFBDC3C7"/></top>
      <bottom style="thin"><color rgb="FFBDC3C7"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="${totalXfs}">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="9" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    ${dynamicXfs}
  </cellXfs>
</styleSheet>`;
  }

  function buildSheet(sheet) {
    const { name, headers, rows, colWidths } = sheet;
    let xml = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><selection/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>`;
    colWidths.forEach((w, i) => {
      xml += `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
    });
    xml += `</cols><sheetData>`;
    xml += `<row r="1" ht="24" customHeight="1">`;
    headers.forEach((h, i) => {
      xml += `<c r="${colName(i + 1)}1" t="s" s="1"><v>${si(h)}</v></c>`;
    });
    xml += `</row>`;
    rows.forEach((row, ri) => {
      const r = ri + 2;
      const altBg = ri % 2 === 1;
      xml += `<row r="${r}" ht="20" customHeight="1">`;
      row.forEach((cell, ci) => {
        const ref = `${colName(ci + 1)}${r}`;
        const s = cell.s !== undefined ? cell.s : (altBg ? 4 : 0);
        if (cell.f) {
          xml += `<c r="${ref}" s="${s}"><f>${escXml(cell.f)}</f></c>`;
        } else if (cell.v === null || cell.v === undefined || cell.v === '') {
          xml += `<c r="${ref}" s="${s}"/>`;
        } else if (cell.t === 'n') {
          xml += `<c r="${ref}" t="n" s="${s}"><v>${cell.v}</v></c>`;
        } else {
          xml += `<c r="${ref}" t="s" s="${s}"><v>${si(cell.v)}</v></c>`;
        }
      });
      xml += `</row>`;
    });
    xml += `</sheetData></worksheet>`;
    return xml;
  }

  const sheetXmls = sheets.map(buildSheet);
  const stylesXml = buildStylesXml();

  const ssXml = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map(s => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('')}</sst>`;

  const wbXml = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 2}"/>`).join('')}</sheets></workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${sheets.map((s, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;

  return { wbXml, wbRels, relsXml, contentTypes, ssXml, sheetXmls, stylesXml, getCourseColorFillIdx };
}

// ── ZIP builder ──────────────────────────────────────────────
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u32(n) { const b = new Uint8Array(4); b[0] = n & 0xFF; b[1] = (n >> 8) & 0xFF; b[2] = (n >> 16) & 0xFF; b[3] = (n >> 24) & 0xFF; return b; }
function u16(n) { const b = new Uint8Array(2); b[0] = n & 0xFF; b[1] = (n >> 8) & 0xFF; return b; }
function enc(str) { return new TextEncoder().encode(str); }

function buildZip(files) {
  const entries = [];
  let offset = 0;
  const parts = [];
  for (const f of files) {
    const nb = enc(f.name);
    const crc = crc32(f.data);
    const sz = f.data.length;
    const local = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nb.length), 0x00, 0x00, ...nb, ...f.data]);
    parts.push(local);
    entries.push({ nb, crc, sz, offset });
    offset += local.length;
  }
  const cd = entries.map(e => new Uint8Array([0x50, 0x4B, 0x01, 0x02, 0x14, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, ...u32(e.crc), ...u32(e.sz), ...u32(e.sz), ...u16(e.nb.length), 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, ...u32(e.offset), ...e.nb]));
  const cdSize = cd.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array([0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, ...u16(entries.length), ...u16(entries.length), ...u32(cdSize), ...u32(offset), 0x00, 0x00]);
  const all = [...parts, ...cd, eocd];
  const total = all.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

// ── Main export function ─────────────────────────────────────
async function exportToExcel({ quarterId, quarterLabel, allQuarters, courses, assignments, exportAll, onStep }) {

  onStep('Fetching modules and tasks…');

  const quarterIds = exportAll
    ? (allQuarters || []).map(q => q.id)
    : [quarterId];

  const quarterMap = Object.fromEntries((allQuarters || []).map(q => [q.id, q.label]));

  // Fetch from Supabase
  const [{ data: modules, error: modErr }, { data: modTasks, error: taskErr }, { data: modComps, error: mcErr }, { data: asgComps, error: acErr }] = await Promise.all([
    supabase.from('modules').select('*').in('quarter_id', quarterIds).order('week_number'),
    supabase.from('module_tasks').select('*').in('quarter_id', quarterIds).order('created_at'),
    supabase.from('module_task_completions').select('*'),
    supabase.from('assignment_completions').select('*'),
  ]);

  if (modErr && modErr.code === '42P01') throw new Error('modules table not found — run modules_migration.sql first');
  if (taskErr && taskErr.code === '42P01') throw new Error('module_tasks table not found — run modules_migration_v2.sql first');
  if (acErr && acErr.code === '42P01') throw new Error('assignment_completions table not found — run assignment_completions_migration.sql first');

  onStep('Building spreadsheet…');

  const courseMap = Object.fromEntries((courses || []).map(c => [c.id, c]));
  const moduleMap = Object.fromEntries((modules || []).map(m => [m.id, m]));

  // Completion maps
  const modCompMap = {};
  (modComps || []).forEach(c => {
    if (!modCompMap[c.task_id]) modCompMap[c.task_id] = {};
    modCompMap[c.task_id][c.person] = c.completed;
  });

  const asgCompMap = {};
  (asgComps || []).forEach(c => {
    if (!asgCompMap[c.assignment_id]) asgCompMap[c.assignment_id] = {};
    asgCompMap[c.assignment_id][c.person] = c.completed;
  });

  // All unique people across both task types
  const taskPeople = [...new Set((modTasks || []).flatMap(t => t.assigned_to || []))].sort();
  const asgPeople = [...new Set((assignments || []).flatMap(a => a.assigned_to || []))].sort();
  const allPeople = [...new Set([...taskPeople, ...asgPeople])].sort();

  const fmtStatus = s => s ? s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
  const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  // ── Sheet 1: Module Tasks ──
  const taskHeaders = [
    'Quarter', 'Course', 'Code', 'Week #', 'Module', 'Module Status',
    'Task', 'Due Date', 'Assignees',
    ...allPeople.map(p => `${p} ✓`),
    'Team Done?'
  ];

  const taskRows = (modTasks || []).map((task, ri) => {
    const mod = moduleMap[task.module_id] || {};
    const course = courseMap[mod.course_id] || {};
    const qLabel = quarterMap[task.quarter_id] || '';
    const assignees = task.assigned_to || [];
    const tc = modCompMap[task.id] || {};
    const donePeople = assignees.filter(p => tc[p]);
    const allDone = assignees.length > 0 && assignees.every(p => tc[p]);
    const altBg = ri % 2 === 1;
    const courseFill = course.color ? undefined : undefined; // handled per-cell

    return [
      { v: qLabel, s: altBg ? 4 : 0 },
      { v: course.name || '', s: altBg ? 4 : 0 },
      { v: course.code || '', s: altBg ? 4 : 0 },
      { v: mod.week_number ?? '', t: mod.week_number != null ? 'n' : 's', s: 5 },
      { v: mod.name || '', s: altBg ? 4 : 0 },
      { v: fmtStatus(mod.status), s: 5 },
      { v: task.name || '', s: altBg ? 4 : 0 },
      { v: fmtDate(task.due_date), s: 5 },
      { v: assignees.join(', '), s: 3 },
      ...allPeople.map(p => ({
        v: assignees.includes(p) ? (tc[p] ? '✓' : '–') : '',
        s: assignees.includes(p) ? (tc[p] ? 7 : 5) : 5
      })),
      { v: allDone ? '✅ All done' : assignees.length ? `${donePeople.length}/${assignees.length}` : '', s: allDone ? 7 : 5 }
    ];
  });

  const taskColWidths = [14, 26, 16, 8, 28, 14, 36, 13, 22,
    ...allPeople.map(() => 12), 13];

  // ── Sheet 2: Assignments per person ──
  const asgHeaders = [
    'Quarter', 'Course', 'Assignment', 'Type', 'Priority', 'Due Date', 'Assignees',
    ...allPeople.map(p => `${p} ✓`),
    'All Done?', 'Notes'
  ];

  const filteredAssignments = (assignments || []).filter(a =>
    exportAll ? true : a.quarter_id === quarterId
  );

  const asgRows = filteredAssignments.map((a, ri) => {
    const course = courseMap[a.course_id] || {};
    const qLabel = quarterMap[a.quarter_id] || '';
    const assignees = a.assigned_to || [];
    const ac = asgCompMap[a.id] || {};
    const donePeople = assignees.filter(p => ac[p]);
    const allDone = a.done || (assignees.length > 0 && assignees.every(p => ac[p]));
    const altBg = ri % 2 === 1;

    return [
      { v: qLabel, s: altBg ? 4 : 0 },
      { v: course.name || '', s: altBg ? 4 : 0 },
      { v: a.name || '', s: altBg ? 4 : 0 },
      { v: a.type || 'assignment', s: 5 },
      { v: a.priority || 'medium', s: 5 },
      { v: fmtDate(a.due_date), s: 5 },
      { v: assignees.join(', '), s: 3 },
      ...allPeople.map(p => ({
        v: assignees.includes(p)
          ? (a.done || ac[p] ? '✓' : '–')
          : '',
        s: assignees.includes(p) ? (a.done || ac[p] ? 7 : 5) : 5
      })),
      { v: allDone ? '✅ Done' : assignees.length ? `${donePeople.length}/${assignees.length}` : (a.done ? '✅ Done' : ''), s: allDone ? 7 : 5 },
      { v: a.notes || '', s: altBg ? 4 : 0 },
    ];
  });

  const asgColWidths = [14, 26, 36, 12, 10, 13, 22,
    ...allPeople.map(() => 12), 12, 28];

  // ── Sheet 3: Modules summary ──
  const modHeaders = ['Quarter', 'Course', 'Code', 'Week #', 'Module Name', 'Start Date', 'Status', 'Description', 'Tasks Total', 'Tasks Done', '% Done'];

  const modRows = (modules || []).map((mod, ri) => {
    const course = courseMap[mod.course_id] || {};
    const qLabel = quarterMap[mod.quarter_id] || '';
    const modTaskList = (modTasks || []).filter(t => t.module_id === mod.id);
    const doneTasks = modTaskList.filter(t => {
      const assignees = t.assigned_to || [];
      const tc = modCompMap[t.id] || {};
      return assignees.length > 0 && assignees.every(p => tc[p]);
    });
    const total = modTaskList.length;
    const done = doneTasks.length;
    const altBg = ri % 2 === 1;
    const r = ri + 2;

    return [
      { v: qLabel, s: altBg ? 4 : 0 },
      { v: course.name || '', s: altBg ? 4 : 0 },
      { v: course.code || '', s: 5 },
      { v: mod.week_number ?? '', t: mod.week_number != null ? 'n' : 's', s: 5 },
      { v: mod.name || '', s: altBg ? 4 : 0 },
      { v: fmtDate(mod.start_date), s: 5 },
      { v: fmtStatus(mod.status), s: 5 },
      { v: mod.description || '', s: altBg ? 4 : 0 },
      { v: total, t: 'n', s: 5 },
      { v: done, t: 'n', s: 5 },
      { f: `IFERROR(J${r}/I${r},"–")`, s: 8 },
    ];
  });

  const modColWidths = [14, 26, 16, 8, 30, 13, 14, 40, 12, 12, 10];

  // ── Sheet 4: Course summary ──
  const courseHeaders = ['Quarter', 'Course', 'Code', 'Canvas URL', 'Modules', 'Modules Complete', '% Modules Done', 'Assignments', 'Assignments Done', '% Asgn Done'];

  const filteredCourses = (courses || []).filter(c =>
    exportAll ? true : quarterIds.includes(c.quarter_id)
  );

  const courseRows = filteredCourses.map((c, ri) => {
    const qLabel = quarterMap[c.quarter_id] || '';
    const courseMods = (modules || []).filter(m => m.course_id === c.id);
    const completeMods = courseMods.filter(m => m.status === 'complete').length;
    const courseAsgs = filteredAssignments.filter(a => a.course_id === c.id);
    const doneAsgs = courseAsgs.filter(a => {
      if (a.done) return true;
      const assignees = a.assigned_to || [];
      const ac = asgCompMap[a.id] || {};
      return assignees.length > 0 && assignees.every(p => ac[p]);
    });
    const altBg = ri % 2 === 1;
    const r = ri + 2;

    return [
      { v: qLabel, s: altBg ? 4 : 0 },
      { v: c.name || '', s: altBg ? 4 : 0 },
      { v: c.code || '', s: 5 },
      { v: c.canvas_url || '', s: altBg ? 4 : 0 },
      { v: courseMods.length, t: 'n', s: 5 },
      { v: completeMods, t: 'n', s: 5 },
      { f: `IFERROR(F${r}/E${r},"–")`, s: 8 },
      { v: courseAsgs.length, t: 'n', s: 5 },
      { v: doneAsgs.length, t: 'n', s: 5 },
      { f: `IFERROR(I${r}/H${r},"–")`, s: 8 },
    ];
  });

  const courseColWidths = [14, 30, 18, 36, 10, 18, 14, 14, 16, 14];

  onStep('Writing file…');

  const xlsxData = buildXlsx([
    { name: '✅ Module Tasks', headers: taskHeaders, rows: taskRows, colWidths: taskColWidths },
    { name: '📝 Assignments', headers: asgHeaders, rows: asgRows, colWidths: asgColWidths },
    { name: '🧩 Modules', headers: modHeaders, rows: modRows, colWidths: modColWidths },
    { name: '📚 Courses', headers: courseHeaders, rows: courseRows, colWidths: courseColWidths },
  ]);

  const qSlug = (exportAll ? 'All_Quarters' : (quarterLabel || 'Export')).replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `SMELT_${qSlug}_${dateStr}.xlsx`;

  const files = [
    { name: '[Content_Types].xml', data: enc(xlsxData.contentTypes) },
    { name: '_rels/.rels', data: enc(xlsxData.relsXml) },
    { name: 'xl/workbook.xml', data: enc(xlsxData.wbXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc(xlsxData.wbRels) },
    { name: 'xl/styles.xml', data: enc(xlsxData.stylesXml) },
    { name: 'xl/sharedStrings.xml', data: enc(xlsxData.ssXml) },
    ...xlsxData.sheetXmls.map((xml, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc(xml),
    })),
  ];

  function enc(str) { return new TextEncoder().encode(str); }

  const zip = buildZip(files);
  const blob = new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export Button Component ──────────────────────────────────
export default function ExportButton({ quarterId, quarterLabel, allQuarters, courses, assignments }) {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [exportAll, setExportAll] = useState(false);

  function onStep(msg) { setStep(msg); }

  async function handleExport() {
    if (!quarterId && !exportAll) { setError('No active quarter.'); return; }
    setStatus('loading');
    setError('');
    setStep('Starting…');
    try {
      await exportToExcel({ quarterId, quarterLabel, allQuarters, courses, assignments, exportAll, onStep });
      setStatus('done');
      setStep('');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Export failed.');
      setStatus('error');
      setStep('');
    }
  }

  const isLoading = status === 'loading';
  const isDone = status === 'done';
  const isError = status === 'error';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* All quarters toggle */}
        {allQuarters && allQuarters.length > 1 && !isLoading && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: 'var(--text3)', cursor: 'pointer',
            userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={exportAll}
              onChange={e => setExportAll(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: 12, height: 12 }}
            />
            All quarters
          </label>
        )}

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={isLoading}
          title={exportAll ? 'Export all quarters' : `Export ${quarterLabel || 'current quarter'}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px',
            background: isDone ? 'var(--accent)' : isError ? 'transparent' : 'transparent',
            border: `1px solid ${isError ? 'var(--danger)' : isDone ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 8,
            color: isDone ? '#000' : isError ? 'var(--danger)' : 'var(--text)',
            fontSize: 12,
            fontWeight: 500,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: isLoading ? 0.7 : 1,
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 14 }}>
            {isDone ? '✅' : isError ? '⚠️' : '📊'}
          </span>
          {isLoading ? step : isDone ? 'Exported!' : isError ? 'Failed' : 'Export Excel'}
        </button>
      </div>

      {/* Error message */}
      {isError && error && (
        <div style={{
          fontSize: 11, color: 'var(--danger)',
          maxWidth: 220, textAlign: 'right', lineHeight: 1.4,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
