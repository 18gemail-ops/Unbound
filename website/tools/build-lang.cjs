/* ============================================================
   多语言站点生成器：从中文母版生成整站译文（/en/ 等）
   用法：node website/tools/build-lang.cjs [lang]      （默认 en）

   中文页为母版（根目录 URL 不变），译文站点放在 /<lang>/ 下同构镜像。
   每个页面依次处理：
     1. 文本替换：与 extract-i18n.cjs 完全相同的块级规则 + content-<lang>.json
     2. 属性替换：alt / aria-label / placeholder / title / meta description
     3. extra 字面替换：嵌套结构等无法按块提取的遗留文本（extra-<lang>.json）
     4. URL 重写：页面相对链接保持不变（两棵树同构）；
        assets / favicon 等共享资源加深一层；绝对页面路径加语言前缀；
        手册搜索索引改引用 .en 版（docs-search-index.<lang>.js）
     5. html lang 属性改为目标语言
     6. 手册页 h2/h3 按译文重新生成锚点 id（英文小写 slug，重名自动加序号）
   最后扫描译文页残留中文，写入 i18n/_leftover-<lang>.txt 供补漏。

   依赖：
     i18n/content-<lang>.json   merge-i18n.cjs 生成
     i18n/extra-<lang>.json     可选，手工维护的兜底替换字典
   ============================================================ */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const lang = process.argv[2] || 'en';
const i18nDir = path.join(root, 'i18n');
const outDir = path.join(root, lang);

const dict = JSON.parse(fs.readFileSync(path.join(i18nDir, 'content-' + lang + '.json'), 'utf8')).strings;
const extraPath = path.join(i18nDir, 'extra-' + lang + '.json');
const extra = fs.existsSync(extraPath) ? JSON.parse(fs.readFileSync(extraPath, 'utf8')) : {};
const extraKeys = Object.keys(extra).sort((a, b) => b.length - a.length);

/* 页面清单：与 extract-i18n.cjs 保持一致（营销页 + 404 + 手册页） */
const PAGES = [];
['index.html', 'features.html', 'download.html', 'faq.html', 'changelog.html', '404.html'].forEach(f => PAGES.push(f));
fs.readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.html')).sort().forEach(f => PAGES.push('docs/' + f));

const BLOCK_TAGS = ['title', 'h1', 'h2', 'h3', 'h4', 'p', 'li', 'td', 'th', 'button', 'option', 'label', 'b', 'strong', 'em', 'span', 'a', 'div', 'dd', 'dt', 'figcaption', 'summary'];
const CN = /[\u4e00-\u9fa5]/;
/* 语言自称词（与产品语言选择器一致）：语言清单里按惯例保留原文，不计入残留检测 */
const ENDONYM = /中文|繁體中文|日本語/g;

/* ---------- 与 extract-i18n.cjs 完全一致的块级收集（外层优先 + 区间去重） ---------- */
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

/* ---------- 与 build-docs-index.cjs 一致的纯文本提取与 slug 规则 ---------- */
function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(td|th|li|p|h[1-6]|div|tr|ol|ul)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/* 英文锚点：小写 + 空白转 -，去掉 URL 敏感字符 */
function slugifyEn(text) {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/["'<>#?&/\\:;,.()!?|]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ---------- URL 重写 ---------- */
function rewriteUrl(url) {
  if (!url || /^(https?:|mailto:|tel:|data:|javascript:|#)/.test(url)) return url;
  // 手册搜索索引：译文页引用 .<lang> 版本
  if (/docs-search-index\.js$/.test(url)) {
    url = url.replace('docs-search-index.js', 'docs-search-index.' + lang + '.js');
  }
  if (url.charAt(0) === '/') {
    // 绝对路径：共享资源不动，页面链接加语言前缀（如 404 页）
    if (/^\/(assets\/|favicon\.ico)/.test(url)) return url;
    return '/' + lang + url;
  }
  // 相对路径：共享资源加深一层，其余（页面链接）保持同构
  const isShared = /(^|\/)assets\//.test(url) || /favicon\.ico$/.test(url) || /app-icon\.png$/.test(url);
  if (!isShared) return url;
  let u = url.startsWith('./') ? url.slice(2) : url;
  return '../' + u;
}

/* ---------- 单页处理 ---------- */
function translateBlocks(html) {
  const blocks = collectBlocks(html);
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    const en = dict[b.zh];
    if (en != null) html = html.slice(0, b.start) + en + html.slice(b.end);
  }
  return html;
}

function translateAttrs(html) {
  html = html.replace(/(alt|aria-label|placeholder|title)="([^"]*)"/g, function (full, name, val) {
    return dict[val] != null ? name + '="' + dict[val] + '"' : full;
  });
  html = html.replace(/(<meta\s+[^>]*\bname="description"[^>]*\bcontent=")([^"]*)(")/g, function (full, pre, val, post) {
    return dict[val] != null ? pre + dict[val] + post : full;
  });
  return html;
}

function applyExtra(html) {
  for (const k of extraKeys) html = html.split(k).join(extra[k]);
  return html;
}

function rewriteUrls(html) {
  return html.replace(/(href|src)="([^"]*)"/g, function (full, attr, url) {
    const nv = rewriteUrl(url);
    return nv === url ? full : attr + '="' + nv + '"';
  });
}

function setHtmlLang(html) {
  return html.replace(/<html([^>]*)>/, function (full, attrs) {
    const clean = attrs.replace(/\s*\blang="[^"]*"/, '');
    return '<html lang="' + lang + '"' + clean + '>';
  });
}

/* 手册页 h2/h3：按译文重生成锚点 id（英文小写 slug，重名加序号） */
function reslugHeadings(html) {
  const used = new Set();
  return html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g, function (full, lvl, attrs, inner) {
    const base = slugifyEn(stripHtml(inner)) || 'sec';
    let id = base;
    let n = 2;
    while (used.has(id)) id = base + '-' + n++;
    used.add(id);
    const cleanAttrs = attrs.replace(/\s*\bid="[^"]*"/, '');
    return '<h' + lvl + ' id="' + id + '"' + cleanAttrs + '>' + inner + '</h' + lvl + '>';
  });
}

/* ---------- 主流程 ---------- */
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const leftovers = [];
for (const rel of PAGES) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  let html = src;
  html = translateBlocks(html);
  html = translateAttrs(html);
  html = applyExtra(html);
  html = rewriteUrls(html);
  html = setHtmlLang(html);
  if (rel.indexOf('docs/') === 0) html = reslugHeadings(html);

  const dst = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, html, 'utf8');

  const lines = html.split('\n');
  let cn = 0;
  lines.forEach(function (line, i) {
    if (CN.test(line.replace(ENDONYM, ''))) {
      cn++;
      if (leftovers.length < 400) leftovers.push(rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 160));
    }
  });
  console.log(rel + ': written' + (cn ? '  [leftover cn lines=' + cn + ']' : '  ok'));
}

fs.writeFileSync(path.join(i18nDir, '_leftover-' + lang + '.txt'), leftovers.join('\n'), 'utf8');
console.log('---');
console.log('pages=' + PAGES.length + ' leftoverEntries=' + leftovers.length + ' -> i18n/_leftover-' + lang + '.txt');
