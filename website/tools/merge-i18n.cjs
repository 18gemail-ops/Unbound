/* ============================================================
   多语言站点工具：合并分批译稿，生成 content-<lang>.json
   用法：node website/tools/merge-i18n.cjs [lang]     （默认 en）

   输入：
     - website/i18n/_extract.json      抽取阶段产物（pages 顺序即全局序号顺序）
     - website/i18n/<lang>-part*.txt   分批译稿，每行「序号|译文」
   输出：
     - website/i18n/content-<lang>.json { lang, generated, sourceItems, strings: { 中文原文: 译文 } }

   校验：序号必须完整覆盖 1..N（无缺失、无重复、无越界，译文不得为空）；
        同一中文 key 出现多个不同译文时报冲突并终止。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const i18nDir = path.resolve(__dirname, '..', 'i18n');
const lang = process.argv[2] || 'en';
const data = JSON.parse(fs.readFileSync(path.join(i18nDir, '_extract.json'), 'utf8'));

/* 1) 与 dump-extract.cjs 保持同一顺序，重建「序号 -> 中文 key」 */
const seq = [];
for (const page of Object.keys(data.pages)) {
  for (const it of data.pages[page]) seq.push(it.zh);
}

/* 2) 读取全部 <lang>-part*.txt，解析「序号|译文」 */
const files = fs.readdirSync(i18nDir).filter(f => new RegExp('^' + lang + '-part\\d+\\.txt$').test(f)).sort();
const byNo = new Map();
const problems = [];
for (const f of files) {
  const lines = fs.readFileSync(path.join(i18nDir, f), 'utf8').split(/\r?\n/);
  let parsed = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(/^(\d+)\|(.*)$/);
    if (!m) { problems.push(f + ': bad line -> ' + line.slice(0, 60)); continue; }
    const no = +m[1];
    const en = m[2];
    if (byNo.has(no)) { problems.push('duplicate seq ' + no + ' (' + f + ')'); continue; }
    if (no < 1 || no > seq.length) { problems.push('seq out of range ' + no + ' (' + f + ')'); continue; }
    if (!en.trim()) { problems.push('empty translation seq ' + no + ' (' + f + ')'); continue; }
    byNo.set(no, en);
    parsed++;
  }
  console.log(f + ': parsed=' + parsed + ' total=' + byNo.size);
}

/* 3) 覆盖完整性检查 */
const missing = [];
for (let i = 1; i <= seq.length; i++) if (!byNo.has(i)) missing.push(i);
if (missing.length) console.log('MISSING seq (' + missing.length + '): ' + missing.slice(0, 50).join(', '));
if (problems.length) console.log('PROBLEMS (' + problems.length + '):\n  ' + problems.slice(0, 50).join('\n  '));

/* 4) 构建字典并检测同一 key 多译冲突 */
const dict = {};
const conflicts = [];
for (let i = 1; i <= seq.length; i++) {
  const zh = seq[i - 1];
  const en = byNo.get(i);
  if (en === undefined) continue;
  if (zh in dict && dict[zh] !== en) {
    conflicts.push('seq ' + i + ': "' + dict[zh] + '" vs "' + en + '"');
  } else {
    dict[zh] = en;
  }
}
if (conflicts.length) console.log('CONFLICTS (' + conflicts.length + '):\n  ' + conflicts.slice(0, 50).join('\n  '));

if (missing.length || problems.length || conflicts.length) {
  console.log('--- ABORT: fix the issues above and re-run.');
  process.exit(1);
}

/* 5) 输出字典 */
const out = {
  lang: lang,
  generated: new Date().toISOString().slice(0, 10),
  sourceItems: seq.length,
  strings: dict
};
const outPath = path.join(i18nDir, 'content-' + lang + '.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 1), 'utf8');
console.log('---');
console.log('items=' + seq.length + ' covered=' + byNo.size + ' uniqueKeys=' + Object.keys(dict).length);
console.log('written: ' + outPath);
