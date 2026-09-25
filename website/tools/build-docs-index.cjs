/* ============================================================
   手册搜索索引生成工具（开发时运行，非网站运行依赖）
   用法：node website/tools/build-docs-index.cjs

   做两件事（幂等，可重复运行）：
   1. 为 docs/*.html 里的 h2 / h3 补锚点 id（标题文本作 id，重复自动加序号）
   2. 提取每个标题下的直属正文，生成 assets/docs-search-index.js
      （以 <script src> 引入，file:// 下同样可用，避免 fetch 的跨域限制）

   英文站（/en/，由 build-lang.cjs 生成）同样生成一份索引：
     en/docs/*.html -> assets/docs-search-index.en.js
   英文页锚点 id 已由 build-lang.cjs 按译文重写，这里只读提取；
   若发现漏网的无 id 标题，按同一英文 slug 规则补齐并写回，保证索引与页面一致。

   运行顺序（改动手册后）：
     本脚本 -> build-lang.cjs -> 再本脚本（或直接重复跑本脚本）
   ============================================================ */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const docsDir = path.join(root, 'docs');
const assetsDir = path.join(root, 'assets');

/* ---------- 工具函数 ---------- */

// 去掉 HTML 标签与实体，压成单行纯文本（先剥标签再解实体，避免正文中的 &lt; 被误剥）
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

// 标题文本转锚点 id：空白转 -，去掉 URL 敏感字符，中文原样保留
function slugify(text) {
  return String(text)
    .replace(/\s+/g, '-')
    .replace(/["'<>#?&/\\:;,.()（）【】\[\]!！?？。，、·|]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 英文标题转锚点 id：与 build-lang.cjs 的 slugifyEn 规则一致（小写 + 去 URL 敏感字符）
function slugifyEn(text) {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/["'<>#?&/\\:;,.()!?|]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ---------- 单页处理 ---------- */

function processPage(file, dir, slugFn, writeBack) {
  const p = path.join(dir, file);
  const src = fs.readFileSync(p, 'utf8');

  const mainOpen = src.match(/<main[^>]*class="docs-main"[^>]*>/);
  if (!mainOpen) return { file, error: 'main.docs-main not found' };
  const mainStart = mainOpen.index;
  const mainEnd = src.indexOf('</main>', mainStart);
  if (mainEnd < 0) return { file, error: '</main> not found' };

  const main = src.slice(mainStart + mainOpen[0].length, mainEnd);

  // 1) 注入锚点 id（已有 id 的沿用）
  const used = new Set();
  const headingRe = /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g;
  const newMain = main.replace(headingRe, (full, lvl, attrs, inner) => {
    let id;
    const has = attrs.match(/\bid="([^"]*)"/);
    if (has) {
      id = has[1];
    } else {
      const base = slugFn(stripHtml(inner)) || 'sec';
      id = base;
      let n = 2;
      while (used.has(id)) id = base + '-' + n++;
    }
    used.add(id);
    const cleanAttrs = attrs.replace(/\s*\bid="[^"]*"/, '');
    return '<h' + lvl + ' id="' + id + '"' + cleanAttrs + '>' + inner + '</h' + lvl + '>';
  });
  const changed = newMain !== main;
  // 索引提取用副本：翻页导航不进索引（写回内容 newMain 保留原有结构）
  const idxMain = newMain.replace(/<nav class="docs-pager"[\s\S]*?<\/nav>/g, ' ');

  // 2) 切分章节：每个 h2/h3 的直属正文（标题到下个标题之间的内容）
  const marks = [];
  let m;
  headingRe.lastIndex = 0;
  while ((m = headingRe.exec(idxMain)) !== null) {
    const idm = m[2].match(/\bid="([^"]*)"/);
    marks.push({
      level: +m[1],
      id: idm ? idm[1] : '',
      title: stripHtml(m[3]),
      start: m.index,
      end: headingRe.lastIndex
    });
  }

  const title = stripHtml((idxMain.match(/<h1>([\s\S]*?)<\/h1>/) || [, ''])[1]);
  const lead = stripHtml((idxMain.match(/<p class="page-lead">([\s\S]*?)<\/p>/) || [, ''])[1]);

  const sections = [];
  // 页面开头（lead 与第一个标题前的提示块）作为页级条目，锚点为空
  const head = stripHtml(idxMain.slice(0, marks.length ? marks[0].start : idxMain.length));
  const headText = [lead, head.replace(new RegExp(escapeRe(title), 'g'), ' ')].join(' ').replace(/\s+/g, ' ').trim();
  if (headText) sections.push({ id: '', title: title, level: 1, text: headText });

  marks.forEach((mk, i) => {
    const segEnd = i + 1 < marks.length ? marks[i + 1].start : idxMain.length;
    let text = stripHtml(idxMain.slice(mk.end, segEnd));
    if (text.length > 2400) text = text.slice(0, 2400);
    sections.push({ id: mk.id, title: mk.title, level: mk.level, text });
  });

  if (changed && writeBack) fs.writeFileSync(p, src.slice(0, mainStart + mainOpen[0].length) + newMain + src.slice(mainEnd), 'utf8');

  return { file, title, lead, sections, changed };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ---------- 主流程 ---------- */

// 页序跟随侧栏目录（解析 docs.js 中 GROUPS_ZH / GROUPS_EN 的 href 顺序，按首次出现去重）
const docsJs = fs.readFileSync(path.join(assetsDir, 'docs.js'), 'utf8');
const order = [];
const hrefRe = /href:\s*"([^"]+)"/g;
let hm;
while ((hm = hrefRe.exec(docsJs)) !== null) {
  if (!order.includes(hm[1])) order.push(hm[1]);
}

/** 为一棵树生成索引：dir 为手册目录，slugFn 决定补 id 的规则，writeBack 控制是否回写缺 id 的页面 */
function buildIndex(label, dir, outFile, slugFn, writeBack) {
  if (!fs.existsSync(dir)) {
    console.log('SKIP ' + label + ': ' + dir + ' not found');
    return;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  const ordered = order.filter(f => files.includes(f)).concat(files.filter(f => !order.includes(f)));

  const pages = [];
  let totalChars = 0;
  for (const f of ordered) {
    const r = processPage(f, dir, slugFn, writeBack);
    if (r.error) { console.log('SKIP ' + label + '/' + f + ': ' + r.error); continue; }
    totalChars += r.sections.reduce((a, s) => a + s.text.length, 0);
    pages.push({ href: f, title: r.title, lead: r.lead, sections: r.sections });
    console.log(label + '/' + f + ': sections=' + r.sections.length + (r.changed ? ' (ids injected)' : ' (ids ok)'));
  }

  const out =
    '/* 由 tools/build-docs-index.cjs 生成，请勿手改；改动手册后重新运行该脚本 */\n' +
    'window.__DOCS_SEARCH__ = ' + JSON.stringify({ generated: new Date().toISOString().slice(0, 10), pages: pages }) + ';\n';
  fs.writeFileSync(outFile, out, 'utf8');
  console.log('---');
  console.log('index written: ' + outFile);
  console.log('pages=' + pages.length + ' chars=' + totalChars + ' size=' + Math.round(out.length / 1024) + 'KB');
}

// 中文树：注入锚点 id 并生成索引；英文树：锚点已就绪，仅兜底补 id
buildIndex('zh', docsDir, path.join(assetsDir, 'docs-search-index.js'), slugify, true);
buildIndex('en', path.join(root, 'en', 'docs'), path.join(assetsDir, 'docs-search-index.en.js'), slugifyEn, true);
