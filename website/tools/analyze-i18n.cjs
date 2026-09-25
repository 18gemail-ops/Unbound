/* 冲突分析（开发辅助）：列出同一中文 key 在所有序号下的译文，输出 i18n/_conflicts-<lang>.txt
   用法：node website/tools/analyze-i18n.cjs [lang]     （默认 en，与 merge-i18n.cjs 一致） */
const fs = require('fs');
const path = require('path');
const i18nDir = path.resolve(__dirname, '..', 'i18n');
const lang = process.argv[2] || 'en';
const data = JSON.parse(fs.readFileSync(path.join(i18nDir, '_extract.json'), 'utf8'));
const seq = [];
for (const page of Object.keys(data.pages)) for (const it of data.pages[page]) seq.push(it.zh);
const files = fs.readdirSync(i18nDir).filter(f => new RegExp('^' + lang + '-part\\d+\\.txt$').test(f)).sort();
const byNo = new Map();
for (const f of files) {
  for (const line of fs.readFileSync(path.join(i18nDir, f), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(\d+)\|(.*)$/);
    if (m) byNo.set(+m[1], { en: m[2], file: f });
  }
}
const groups = new Map();
for (let i = 1; i <= seq.length; i++) {
  const zh = seq[i - 1];
  if (!groups.has(zh)) groups.set(zh, []);
  groups.get(zh).push(i);
}
const out = [];
let count = 0;
for (const [zh, nos] of groups) {
  const vals = new Set(nos.map(n => byNo.get(n).en));
  if (vals.size > 1) {
    count++;
    out.push('KEY: ' + zh.slice(0, 90));
    for (const n of nos) out.push('  ' + n + ' [' + byNo.get(n).file + '] ' + byNo.get(n).en.slice(0, 110));
    out.push('');
  }
}
fs.writeFileSync(path.join(i18nDir, '_conflicts-' + lang + '.txt'), out.join('\n'), 'utf8');
console.log('conflict keys=' + count + ' -> i18n/_conflicts-' + lang + '.txt');
