/* ============================================================
   多语言站点工具：按旧词典重映射译稿（中文文案变更后的增量同步）
   用法：node website/tools/remap-i18n.cjs [lang]      （默认 en）

   背景：中文母版文本增删后，extract-i18n.cjs 的全局序号会整体偏移，
        历史 en-part*.txt 的序号全部失效，无法直接复用。
   做法：以 content-<lang>.json 的「中文全文 -> 译文」映射为唯一来源，
        对最新 _extract.json 的每个条目复用既有译文；词典未命中的
        新增 / 变更文本写入 i18n/_todo-<lang>.txt 并退出（退出码 1）。
        按清单翻译后写成 i18n/<lang>-patch.txt（每行「序号|译文」），
        重跑本脚本即生成全量 <lang>-part01.txt（旧编号稿自动清理），
        再依次运行 merge-i18n.cjs 与 build-lang.cjs。
   注意：patch 文件只对应当前 _todo-<lang>.txt 的缺失条目，
        补译完成、词典重建后即可删除，避免文案再次变更时错位复用。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const i18nDir = path.join(root, 'i18n');
const lang = process.argv[2] || 'en';

const extract = JSON.parse(fs.readFileSync(path.join(i18nDir, '_extract.json'), 'utf8'));
const dict = JSON.parse(fs.readFileSync(path.join(i18nDir, 'content-' + lang + '.json'), 'utf8')).strings;

const seq = [];
for (const page of Object.keys(extract.pages)) {
  for (const it of extract.pages[page]) seq.push(it.zh);
}

const patchPath = path.join(i18nDir, lang + '-patch.txt');
const patch = {};
if (fs.existsSync(patchPath)) {
  for (const line of fs.readFileSync(patchPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^(\d+)\|(.*)$/);
    if (!m) { console.log('bad patch line: ' + line.slice(0, 60)); continue; }
    patch[+m[1]] = m[2];
  }
}

const lines = [];
const missing = [];
seq.forEach((zh, i) => {
  const no = i + 1;
  let text = dict[zh];
  if (typeof text !== 'string' || !text.trim()) text = patch[no];
  if (typeof text !== 'string' || !text.trim()) missing.push(no + '|' + zh);
  else lines.push(no + '|' + text);
});

if (missing.length) {
  fs.writeFileSync(path.join(i18nDir, '_todo-' + lang + '.txt'), missing.join('\n'), 'utf8');
  console.log('MISSING=' + missing.length + ' -> i18n/_todo-' + lang + '.txt');
  process.exit(1);
}

/* 旧编号稿的序号已全部失效，先清理再写入全量新稿（避免 merge 序号冲突） */
for (const f of fs.readdirSync(i18nDir)) {
  if (new RegExp('^' + lang + '-part\\d+\\.txt$').test(f)) fs.unlinkSync(path.join(i18nDir, f));
}
fs.writeFileSync(path.join(i18nDir, lang + '-part01.txt'), lines.join('\n'), 'utf8');
console.log('OK: ' + lang + '-part01.txt lines=' + lines.length + ' (seq=' + seq.length + ')');
