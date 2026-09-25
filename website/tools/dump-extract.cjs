/* ============================================================
   多语言站点工具：把抽取结果展开成带全局序号的中文清单
   用法：node website/tools/dump-extract.cjs
   输入：website/i18n/_extract.json   由 extract-i18n.cjs 生成
   输出：website/i18n/_extract.txt    每行「序号 [标签] 中文原文」

   用途：作为分批翻译的工作底稿；译稿写成 <lang>-partNN.txt
        （每行「序号|译文」），再由 merge-i18n.cjs 合并成 content-<lang>.json。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const i18nDir = path.resolve(__dirname, '..', 'i18n');
const data = JSON.parse(fs.readFileSync(path.join(i18nDir, '_extract.json'), 'utf8'));

let lines = [];
let n = 0;
for (const page of Object.keys(data.pages)) {
  lines.push('## ' + page);
  for (const it of data.pages[page]) {
    n++;
    lines.push(n + ' [' + it.kind.replace('block:', '') + '] ' + it.zh);
  }
  lines.push('');
}
fs.writeFileSync(path.join(i18nDir, '_extract.txt'), lines.join('\n'), 'utf8');
console.log('items=' + n + ' lines=' + lines.length);
