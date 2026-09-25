/* ============================================================
   多语言站点工具：从中文母版页面抽取可翻译文本单元
   用法：node website/tools/extract-i18n.cjs
   输出：website/i18n/_extract.json（按页面分组的 key 列表 + 全局去重 keys）
   说明：块级收集（外层优先、区间去重、只收单行 inner），属性单独收集；
        生成器 build-lang.cjs 使用同一套规则替换，规则必须保持一致。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const PAGES = [];
// 营销页 + 404
['index.html', 'features.html', 'download.html', 'faq.html', 'changelog.html', '404.html'].forEach(f => PAGES.push(f));
// 手册页
fs.readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.html')).sort().forEach(f => PAGES.push('docs/' + f));

const BLOCK_TAGS = ['title', 'h1', 'h2', 'h3', 'h4', 'p', 'li', 'td', 'th', 'button', 'option', 'label', 'b', 'strong', 'em', 'span', 'a', 'div', 'dd', 'dt', 'figcaption', 'summary'];
const CN = /[\u4e00-\u9fa5]/;

/** 收集单行块（含中文），外层优先 + 区间去重；返回 [{ tag, zh, start, end }] */
function collectBlocks(html) {
  const items = [];
  for (const tag of BLOCK_TAGS) {
    const re = new RegExp('<' + tag + '(\\s[^>]*)?>((?:(?!<\\/?' + tag + '\\b)[\\s\\S])*?)<\\/' + tag + '>', 'gi');
    let m;
    while ((m = re.exec(html)) !== null) {
      const inner = m[2];
      if (!CN.test(inner) || inner.indexOf('\n') >= 0) continue;
      const innerStart = m.index + 1 + tag.length + (m[1] ? m[1].length : 0) + 1;
      items.push({ tag: tag.toLowerCase(), zh: inner, start: innerStart, end: innerStart + inner.length });
    }
  }
  items.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let covered = -1;
  for (const it of items) {
    if (it.start >= covered) {
      out.push(it);
      covered = it.end;
    }
  }
  return out;
}

/** 收集需翻译属性值 */
function collectAttrs(html) {
  const out = [];
  const re = /(alt|aria-label|placeholder|title)="([^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (CN.test(m[2])) out.push({ kind: 'attr', name: m[1], zh: m[2] });
  }
  const metaRe = /<meta\s+[^>]*name="description"[^>]*content="([^"]*)"/g;
  while ((m = metaRe.exec(html)) !== null) {
    if (CN.test(m[1])) out.push({ kind: 'meta', name: 'description', zh: m[1] });
  }
  return out;
}

const result = { pages: {}, keys: [], keyIndex: {} };
const globalKeys = new Set();

for (const rel of PAGES) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { console.log('MISS ' + rel); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const blocks = collectBlocks(html).map(b => ({ kind: 'block:' + b.tag, zh: b.zh }));
  const attrs = collectAttrs(html);
  const list = blocks.concat(attrs);
  result.pages[rel] = list;
  list.forEach(it => globalKeys.add(it.zh));
  console.log(rel + ': items=' + list.length);
}

result.keys = Array.from(globalKeys).sort();
result.keys.forEach(k => { result.keyIndex[k] = 1; });

const outPath = path.join(root, 'i18n', '_extract.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 1), 'utf8');
console.log('---');
console.log('pages=' + Object.keys(result.pages).length + ' uniqueKeys=' + result.keys.length);
console.log('written: ' + outPath);
