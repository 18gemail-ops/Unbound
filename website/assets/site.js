/* 官网通用交互：移动端导航、当前页高亮、页脚年份、
   滚动入场动效、顶栏滚动状态与主题切换。
   注：<head> 内联脚本会给 <html> 加 .js 类，作为「动效可用」的前提，
   无 JS（或 JS 加载失败）时 .reveal 元素保持默认可见，不做任何隐藏。 */
(function () {
  "use strict";

  /** 当前语言：中文为根站点，英文在 /en/ 下，由 <html lang> 区分 */
  var LANG = (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0 ? "en" : "zh";
  /** 与语言相关的界面文案 */
  var T = LANG === "en"
    ? {
        copied: "Copied",
        langLabel: "中文",
        langTitle: "切换为中文",
        themeToDark: "Switch to dark mode",
        themeToLight: "Switch to light mode"
      }
    : {
        copied: "已复制",
        langLabel: "English",
        langTitle: "View this site in English",
        themeToDark: "切换到深色模式",
        themeToLight: "切换到浅色模式"
      };

  /** 移动端展开/收起主导航 */
  function initNav() {
    var btn = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".topnav");
    if (!btn || !nav) return;
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    // 点击导航项后自动收起
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") nav.classList.remove("open");
    });
  }

  /** 依据当前路径给顶部导航加高亮（各页面无需手写 on） */
  function initActive() {
    var path = location.pathname.replace(/\/index\.html$/, "/");
    var inDocs = path.indexOf("/docs/") !== -1 || /\/docs\/?$/.test(path);
    var file = path.substring(path.lastIndexOf("/") + 1) || "index.html";
    document.querySelectorAll(".topnav a[href]").forEach(function (a) {
      // 归一化 ./ 与 ../ 前缀后取文件名比较：手册页只高亮「使用手册」，其余页按文件名匹配
      var href = a.getAttribute("href").replace(/^\.\//, "").replace(/^\.\.\//, "");
      if (/^https?:/.test(href)) return;
      var target = href.substring(href.lastIndexOf("/") + 1) || "index.html";
      var hit = inDocs ? href.indexOf("docs/") === 0 : target === file;
      if (hit) a.classList.add("on");
    });
  }

  /** 页脚年份 */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /** 复制按钮：<button class="copy" data-copy="内容"> */
  function initCopy() {
    document.querySelectorAll("[data-copy]").forEach(function (el) {
      el.addEventListener("click", function () {
        var text = el.getAttribute("data-copy") || "";
        var done = function () {
          var old = el.getAttribute("data-label") || el.textContent;
          el.setAttribute("data-label", old);
          el.textContent = T.copied;
          setTimeout(function () {
            el.textContent = old;
          }, 1400);
        };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(done, done);
        } else {
          done();
        }
      });
    });
  }

  /** 滚动入场：进入视口的 .reveal 元素依次淡入上移
   *  - 同一父容器内的多个元素按顺序错峰（最多累计 5 档）
   *  - 动画结束后移除 .reveal，把元素交还给普通样式（避免影响 hover 变换） */
  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!els.length) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.remove("reveal"); });
      return;
    }

    // 按父容器分组错峰
    var groups = new Map();
    els.forEach(function (el) {
      var p = el.parentElement;
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p).push(el);
    });
    groups.forEach(function (list) {
      list.forEach(function (el, i) {
        if (i > 0) el.style.animationDelay = Math.min(i, 5) * 70 + "ms";
      });
    });

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          io.unobserve(el);
          el.classList.add("in");
          el.addEventListener("animationend", function onEnd(e) {
            if (e.target !== el) return;
            el.removeEventListener("animationend", onEnd);
            // 交还给普通样式：动画终态与默认态一致，移除不会产生跳变
            el.classList.remove("reveal", "in");
            el.style.animationDelay = "";
          });
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -36px 0px" }
    );
    els.forEach(function (el) { io.observe(el); });
  }

  /** 顶栏滚动状态：离开顶部后加深背景与阴影 */
  function initTopbar() {
    var bar = document.querySelector(".topbar");
    if (!bar) return;
    var onScroll = function () {
      bar.classList.toggle("scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /** 语言切换：中文与 /en/ 同路径互跳（两棵树同构，由 tools/build-lang.cjs 生成） */
  function initLang() {
    var bar = document.querySelector(".topbar-in");
    if (!bar || bar.querySelector(".lang-switch")) return;
    var s = document.querySelector('script[src*="site.js"]');
    if (!s) return;
    // 用 site.js 的绝对地址反推站点根（file:// 与 http(s) 下均可用）
    var root = s.src.replace(/assets\/site\.js.*$/, "");
    var rootPath = decodeURIComponent(new URL(root).pathname);
    var cur = decodeURIComponent(location.pathname);
    var rel = cur.toLowerCase().indexOf(rootPath.toLowerCase()) === 0 ? cur.slice(rootPath.length) : "";
    // 相对根路径以 en/ 开头即当前在英文站，否则为中文站
    var isEn = rel.indexOf("en/") === 0;
    var target = isEn ? root + rel.slice(3) : root + "en/" + (rel || "index.html");
    var a = document.createElement("a");
    a.className = "lang-switch";
    a.href = target;
    a.title = T.langTitle;
    a.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 3.9 5.7 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.7-3.9-9s1.3-6.4 3.9-9z"/></svg>' +
      "<span>" + T.langLabel + "</span>";
    var cta = bar.querySelector(".topbar-cta");
    if (cta) bar.insertBefore(a, cta);
    else bar.appendChild(a);
  }

  /* ---------- 主题切换 ---------- */
  /** localStorage 键名，与每页 <head> 内联恢复脚本保持一致 */
  var THEME_KEY = "unboundlink-site-theme";
  /** 按钮图标（stroke=currentColor，随按钮文字色走） */
  var ICONS = {
    moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.2 14.2A8.2 8.2 0 0 1 9.8 3.8 8.5 8.5 0 1 0 20.2 14.2z"/></svg>',
    sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/></svg>'
  };

  /** 当前生效主题：html[data-theme] 由内联脚本 / 切换按钮写入；缺省（异常情况）视为亮色 */
  function themeNow() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  /** 同步按钮外观：显示「将要切换到的模式」图标与提示语 */
  function paintThemeBtn(btn, t) {
    if (!btn) return;
    var toDark = t !== "dark";
    btn.innerHTML = toDark ? ICONS.moon : ICONS.sun;
    var label = toDark ? T.themeToDark : T.themeToLight;
    btn.title = label;
    btn.setAttribute("aria-label", label);
  }

  /** 主题切换按钮：点击在亮 / 深间切换并写入 localStorage */
  function initTheme() {
    var bar = document.querySelector(".topbar-in");
    if (!bar || bar.querySelector(".theme-switch")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-switch";
    var lang = bar.querySelector(".lang-switch");
    var cta = bar.querySelector(".topbar-cta");
    if (lang && lang.parentNode === bar) bar.insertBefore(btn, lang.nextSibling);
    else if (cta) bar.insertBefore(btn, cta);
    else bar.appendChild(btn);
    paintThemeBtn(btn, themeNow());
    btn.addEventListener("click", function () {
      var next = themeNow() === "dark" ? "light" : "dark";
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      // 显式写入 data-theme：即使用户偏好与系统相反，themeNow() 也能稳定读回
      document.documentElement.setAttribute("data-theme", next);
      paintThemeBtn(btn, next);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initActive();
    initYear();
    initCopy();
    initReveal();
    initTopbar();
    initLang();
    initTheme();
  });
})();
