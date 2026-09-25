/* 使用手册：侧边导航、跨页搜索、本页目录与上一页/下一页由本脚本统一生成，避免每个页面重复维护 */
(function () {
  "use strict";

  /** 当前语言：中文为根站点，英文在 /en/ 下，由 <html lang> 区分 */
  var LANG = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0 ? "en" : "zh";

  /** 与语言相关的界面文案 */
  var T = LANG === "en"
    ? {
        search: "Search the guide",
        noIndex: "Search index not loaded",
        notFoundPre: "No results for “",
        notFoundPost: "”<br>Try a shorter keyword.",
        toc: "On this page",
        menu: "Guide menu",
        prev: "Previous",
        next: "Next"
      }
    : {
        search: "搜索手册内容",
        noIndex: "搜索索引未加载",
        notFoundPre: "没有找到「",
        notFoundPost: "」<br>换个更短的关键词试试",
        toc: "本页目录",
        menu: "手册目录",
        prev: "上一页",
        next: "下一页"
      };

  /** 手册目录：与客户端左侧菜单一一对应，顺序保持一致 */
  var GROUPS_ZH = [
    {
      title: "开始",
      items: [
        { href: "index.html", label: "手册总览" },
        { href: "install.html", label: "安装与首次运行" }
      ]
    },
    {
      title: "功能详解",
      items: [
        { href: "dashboard.html", label: "仪表盘" },
        { href: "profiles.html", label: "订阅管理" },
        { href: "proxies.html", label: "代理节点" },
        { href: "apps.html", label: "应用分流" },
        { href: "rules.html", label: "规则列表" },
        { href: "connections.html", label: "实时连接" },
        { href: "stats.html", label: "流量统计" },
        { href: "logs.html", label: "运行日志" },
        { href: "diagnose.html", label: "网络体检" },
        { href: "unlock.html", label: "解锁测试" },
        { href: "settings.html", label: "设置" }
      ]
    },
    {
      title: "进阶",
      items: [
        { href: "advanced.html", label: "进阶技巧" },
        { href: "troubleshooting.html", label: "故障排查" }
      ]
    }
  ];

  /** 英文目录：href 与中文树同构，label 与英文页 H1 逐一对应 */
  var GROUPS_EN = [
    {
      title: "Getting started",
      items: [
        { href: "index.html", label: "User Guide overview" },
        { href: "install.html", label: "Install and first run" }
      ]
    },
    {
      title: "Feature guides",
      items: [
        { href: "dashboard.html", label: "Dashboard" },
        { href: "profiles.html", label: "Profiles" },
        { href: "proxies.html", label: "Proxies" },
        { href: "apps.html", label: "App Routing" },
        { href: "rules.html", label: "Rules" },
        { href: "connections.html", label: "Connections" },
        { href: "stats.html", label: "Traffic" },
        { href: "logs.html", label: "Logs" },
        { href: "diagnose.html", label: "Diagnostics" },
        { href: "unlock.html", label: "Unlock Test" },
        { href: "settings.html", label: "Settings" }
      ]
    },
    {
      title: "Advanced",
      items: [
        { href: "advanced.html", label: "Advanced tips" },
        { href: "troubleshooting.html", label: "Troubleshooting" }
      ]
    }
  ];

  var GROUPS = LANG === "en" ? GROUPS_EN : GROUPS_ZH;

  /** 搜索索引（由 tools/build-docs-index.cjs 预生成） */
  var INDEX = window.__DOCS_SEARCH__ || null;

  /* ---------- 基础工具 ---------- */

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function escRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** 展平成一维，用于生成上一页/下一页 */
  function flatten() {
    var out = [];
    GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        out.push(it);
      });
    });
    return out;
  }

  function fileName() {
    var p = location.pathname;
    var last = p.substring(p.lastIndexOf("/") + 1);
    return last === "" ? "index.html" : last;
  }

  function isEditable(t) {
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  /* ---------- 侧栏与翻页 ---------- */

  function renderSide(current) {
    var box = document.getElementById("docsSide");
    if (!box) return;
    var html = "";
    GROUPS.forEach(function (g) {
      html += '<div class="grp"><p class="t">' + g.title + "</p>";
      g.items.forEach(function (it) {
        var on = it.href === current ? ' class="on"' : "";
        html += '<a href="' + it.href + '"' + on + ">" + it.label + "</a>";
      });
      html += "</div>";
    });
    // 移动端（≤1024）目录默认收起：按钮 + 可折叠的目录体（桌面端按钮由 CSS 隐藏、目录体常显）
    box.innerHTML =
      '<button type="button" class="ds-toggle" aria-expanded="false">' +
      "<span>" + T.menu + "</span>" +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
      "</button>" +
      '<div class="ds-body">' + html + "</div>";
    var btn = box.querySelector(".ds-toggle");
    btn.addEventListener("click", function () {
      var open = box.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function renderPager(current) {
    var box = document.getElementById("docsPager");
    if (!box) return;
    var list = flatten();
    var i = list.findIndex(function (it) {
      return it.href === current;
    });
    if (i < 0) return;
    var prev = list[i - 1];
    var next = list[i + 1];
    var html = "";
    if (prev) {
      html += '<a class="prev" href="' + prev.href + '"><span>' + T.prev + "</span>" + prev.label + "</a>";
    } else {
      html += "<span></span>";
    }
    if (next) {
      html += '<a class="next" href="' + next.href + '"><span>' + T.next + "</span>" + next.label + "</a>";
    }
    box.innerHTML = html;
  }

  function initYear() {
    var year = document.querySelector("[data-year]");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  /* ---------- 跨页搜索 ---------- */

  var results = [];
  var activeIdx = 0;
  var panel = null;
  var input = null;
  var wrap = null;

  /** 摘取命中位置周围的一小段文本，两端按需加省略号 */
  function makeSnippet(text, terms) {
    var low = text.toLowerCase();
    var pos = -1;
    terms.forEach(function (t) {
      var p = low.indexOf(t);
      if (p >= 0 && (pos < 0 || p < pos)) pos = p;
    });
    if (pos < 0) return text.slice(0, 96) + (text.length > 96 ? "…" : "");
    var s = Math.max(0, pos - 30);
    var e = Math.min(text.length, pos + 84);
    return (s > 0 ? "…" : "") + text.slice(s, e) + (e < text.length ? "…" : "");
  }

  /** 对已转义文本做关键词高亮（terms 为小写原文，显示前统一转义） */
  function hl(text, terms) {
    var out = esc(text);
    var parts = terms.map(function (t) {
      return escRe(esc(t));
    }).filter(Boolean);
    if (!parts.length) return out;
    try {
      return out.replace(new RegExp("(" + parts.join("|") + ")", "gi"), "<mark>$1</mark>");
    } catch (err) {
      return out;
    }
  }

  function countIn(hay, needle) {
    var n = 0;
    var i = 0;
    while ((i = hay.indexOf(needle, i)) >= 0) {
      n++;
      i += needle.length;
    }
    return n;
  }

  /** 全词命中的条目（AND），按命中权重排序：标题 > 正文，页面名额外加权 */
  function runSearch(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !INDEX) return [];
    var out = [];
    INDEX.pages.forEach(function (page) {
      var pageLow = (page.title + " " + page.lead).toLowerCase();
      page.sections.forEach(function (sec) {
        var titleLow = sec.title.toLowerCase();
        var textLow = sec.text.toLowerCase();
        var score = 0;
        var ok = true;
        for (var i = 0; i < terms.length; i++) {
          var t = terms[i];
          var ct = countIn(titleLow, t);
          var cx = countIn(textLow, t);
          if (!ct && !cx) {
            ok = false;
            break;
          }
          score += ct * 10 + Math.min(cx, 5);
        }
        if (!ok) return;
        terms.forEach(function (t) {
          if (pageLow.indexOf(t) >= 0) score += 4;
        });
        out.push({
          href: page.href + (sec.id ? "#" + encodeURIComponent(sec.id) : ""),
          pageTitle: page.title,
          title: sec.title,
          text: sec.text,
          pageLevel: !sec.id,
          score: score
        });
      });
    });
    out.sort(function (a, b) {
      return b.score - a.score;
    });
    return out.slice(0, 12);
  }

  /** 结果面板定位：跟随搜索框，宽度自适应视口 */
  function placePanel() {
    var r = input.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var w = Math.min(460, vw - 32);
    var left = Math.min(Math.max(16, r.left), vw - w - 16);
    var top = r.bottom + 8;
    panel.style.width = w + "px";
    panel.style.left = left + "px";
    panel.style.top = top + "px";
    panel.style.maxHeight = Math.min(vh * 0.62, vh - top - 16) + "px";
  }

  function showPanel() {
    placePanel();
    panel.hidden = false;
  }

  function hidePanel() {
    panel.hidden = true;
  }

  function paintActive() {
    var items = panel.querySelectorAll(".hit");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("on", i === activeIdx);
    }
    var cur = items[activeIdx];
    if (!cur) return;
    var top = cur.offsetTop;
    var bot = top + cur.offsetHeight;
    if (top < panel.scrollTop) panel.scrollTop = top - 8;
    else if (bot > panel.scrollTop + panel.clientHeight) panel.scrollTop = bot - panel.clientHeight + 8;
  }

  function renderHits() {
    var q = (input.value || "").trim();
    if (!q) {
      hidePanel();
      return;
    }
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!INDEX) {
      panel.innerHTML = '<div class="none">' + T.noIndex + "</div>";
      showPanel();
      return;
    }
    if (!results.length) {
      panel.innerHTML = '<div class="none">' + T.notFoundPre + esc(q) + T.notFoundPost + "</div>";
      showPanel();
      return;
    }
    var html = "";
    results.forEach(function (r, i) {
      html +=
        '<a class="hit' + (i === activeIdx ? " on" : "") + '" href="' + esc(r.href) + '">' +
        (r.pageLevel
          ? '<span class="ht">' + hl(r.title, terms) + "</span>"
          : '<span class="hp">' + hl(r.pageTitle, terms) + '</span><span class="ht">' + hl(r.title, terms) + "</span>") +
        '<span class="hs">' + hl(makeSnippet(r.text, terms), terms) + "</span>" +
        "</a>";
    });
    panel.innerHTML = html;
    showPanel();
  }

  function buildSearchBox() {
    var side = document.getElementById("docsSide");
    if (!side || side.querySelector(".docs-search")) return;

    wrap = document.createElement("div");
    wrap.className = "docs-search";
    wrap.innerHTML =
      '<div class="ds-bar">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
      '<input id="docsQ" type="search" placeholder="' + T.search + '" autocomplete="off" aria-label="' + T.search + '">' +
      "<kbd>/</kbd>" +
      "</div>" +
      '<div class="docs-hits" id="docsHits" hidden></div>';
    side.insertBefore(wrap, side.firstChild);

    input = wrap.querySelector("#docsQ");
    panel = wrap.querySelector("#docsHits");

    input.addEventListener("input", function () {
      results = runSearch(input.value.trim());
      activeIdx = 0;
      renderHits();
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (results.length) {
          activeIdx = (activeIdx + 1) % results.length;
          paintActive();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (results.length) {
          activeIdx = (activeIdx - 1 + results.length) % results.length;
          paintActive();
        }
      } else if (e.key === "Enter") {
        var r = results[activeIdx];
        if (r) location.href = r.href;
      } else if (e.key === "Escape") {
        input.value = "";
        results = [];
        hidePanel();
        input.blur();
      }
    });

    input.addEventListener("focus", function () {
      if ((input.value || "").trim()) renderHits();
    });

    // 点击结果后收起面板（同页跳转时页面不会重载）
    panel.addEventListener("click", function (e) {
      if (e.target.closest(".hit")) hidePanel();
    });

    // 页面滚动 / 缩放时位置会失真，直接收起
    window.addEventListener("scroll", function () {
      if (!panel.hidden) hidePanel();
    }, { passive: true });
    window.addEventListener("resize", function () {
      if (!panel.hidden) hidePanel();
    });
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !wrap.contains(e.target)) hidePanel();
    });

    // 快捷键：/ 或 Ctrl/Cmd + K 唤起搜索
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        input.focus();
        input.select();
        if ((input.value || "").trim()) renderHits();
      } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditable(e.target)) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  /* ---------- 本页目录（宽屏显示） ---------- */

  function buildToc() {
    var main = document.querySelector(".docs-main");
    var shell = document.querySelector(".docs-shell");
    if (!main || !shell) return;
    var hs = main.querySelectorAll("h2[id]");
    if (hs.length < 2) return;

    var nav = document.createElement("nav");
    nav.className = "docs-toc";
    nav.id = "docsToc";
    var html = '<p class="t">' + T.toc + "</p>";
    for (var i = 0; i < hs.length; i++) {
      html += '<a href="#' + encodeURIComponent(hs[i].id) + '">' + esc(hs[i].textContent) + "</a>";
    }
    nav.innerHTML = html;
    shell.appendChild(nav);

    initScrollSpy(nav, hs);
  }

  /** 滚动时高亮当前章节 */
  function initScrollSpy(nav, hs) {
    var links = nav.querySelectorAll("a");
    var targets = Array.prototype.slice.call(hs);
    var ticking = false;

    function update() {
      ticking = false;
      var pos = window.scrollY + 130;
      var idx = 0;
      for (var i = 0; i < targets.length; i++) {
        var top = targets[i].getBoundingClientRect().top + window.scrollY;
        if (top <= pos) idx = i;
      }
      for (var j = 0; j < links.length; j++) {
        links[j].classList.toggle("on", j === idx);
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var cur = fileName();
    renderSide(cur);
    renderPager(cur);
    initYear();
    buildSearchBox();
    buildToc();
  });
})();
