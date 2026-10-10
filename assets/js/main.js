/* =========================================================
   无界工作室 · 官网交互 v3
   原则：动效克制、零依赖、无持续空转的 rAF、避免布局回流
   仅保留：点阵地球 / 粒子星空 / 文字入场 / 滚动淡入 / 数字滚动 /
           滚动进度 / 导航高亮 / FAQ 手风琴
   ========================================================= */
(function () {
  'use strict';

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = mqReduce.matches;
  var docEl = document.documentElement;

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------
     1. 滚动进度 / 顶栏 / 回到顶部
     --------------------------------------------------------- */
  var progressBar = $('#scrollProgress');
  var progressFill = progressBar ? progressBar.firstElementChild : null;
  var header = $('#siteHeader');
  var toTop = $('#toTop');
  var ticking = false;

  /* 顶栏随背景区块切换深浅：缓存各区块的文档区间，滚动时只做数值比较，
     不在每帧读取布局，避免强制回流 */
  var themeSections = $$('.hero, .section');
  var themeRanges = [];
  var lastLight = null;
  var PROBE = 38;   // 探测点：顶栏中部的视口高度

  function measureThemes() {
    var sy = window.pageYOffset || docEl.scrollTop;
    themeRanges = themeSections.map(function (s) {
      var r = s.getBoundingClientRect();
      var top = r.top + sy;
      return { top: top, bottom: top + r.height, light: s.classList.contains('theme-light') };
    });
  }

  function isLightAt(y) {
    var probe = y + PROBE;
    for (var i = 0; i < themeRanges.length; i++) {
      var r = themeRanges[i];
      if (probe >= r.top && probe < r.bottom) return r.light;
    }
    return false;   // 落在页脚等未标注区域时维持深色
  }

  function onScrollFrame() {
    ticking = false;
    var y = window.pageYOffset || docEl.scrollTop;
    var max = docEl.scrollHeight - window.innerHeight;
    var pct = max > 0 ? clamp((y / max) * 100, 0, 100) : 0;

    if (progressFill) progressFill.style.width = pct.toFixed(2) + '%';
    if (header) header.classList.toggle('scrolled', y > 14);
    if (toTop) toTop.classList.toggle('show', y > 600);

    var light = isLightAt(y);
    if (light !== lastLight) {
      lastLight = light;
      docEl.classList.toggle('on-light', light);
    }
  }

  function requestScrollFrame() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScrollFrame);
  }

  window.addEventListener('scroll', requestScrollFrame, { passive: true });
  window.addEventListener('resize', measureThemes);
  window.addEventListener('load', measureThemes);
  measureThemes();
  onScrollFrame();

  /* ---------------------------------------------------------
     2. 移动端菜单
     --------------------------------------------------------- */
  var nav = $('#nav');
  var menuToggle = $('#menuToggle');

  function closeMenu() {
    if (!nav || !menuToggle) return;
    nav.classList.remove('open');
    menuToggle.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '打开菜单');
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuToggle.classList.toggle('open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('open') && !e.target.closest('.site-header')) closeMenu();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* ---------------------------------------------------------
     3. 导航当前区块高亮
     --------------------------------------------------------- */
  var navLinks = $$('.nav-link[href^="#"]');
  var sections = $$('main section[id]');

  function setActive(id) {
    navLinks.forEach(function (l) {
      l.classList.toggle('active', l.getAttribute('href') === '#' + id);
    });
  }

  if ('IntersectionObserver' in window && sections.length) {
    var navObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { navObs.observe(s); });
  }

  /* ---------------------------------------------------------
     4. 滚动淡入
     --------------------------------------------------------- */
  var revealEls = $$('[data-reveal], [data-stagger]');

  if ('IntersectionObserver' in window && !reduced) {
    var revealObs = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var d = Number(el.getAttribute('data-delay') || 0);
        if (d) el.style.transitionDelay = d + 'ms';
        el.classList.add('in');
        obs.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { revealObs.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------------------------------------------------------
     5. 标题逐字入场（hero 与各区块标题，按行逐字错峰）
     --------------------------------------------------------- */
  var splitIndex = 0;

  $$('.line[data-split]').forEach(function (el) {
    // 非首屏标题：每行索引重置，避免延迟随行号累加
    if (!el.closest('.hero-title')) splitIndex = 0;
    var text = el.textContent;
    el.textContent = '';
    Array.prototype.forEach.call(text, function (ch) {
      var span = document.createElement('span');
      span.className = 'ch';
      span.style.setProperty('--i', splitIndex++);
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      el.appendChild(span);
    });
  });

  var splitLines = $$('.line[data-split]');

  function revealLine(line) { line.classList.add('ready'); }

  if ('IntersectionObserver' in window && !reduced) {
    var lineObs = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        revealLine(entry.target);
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
    splitLines.forEach(function (l) { lineObs.observe(l); });
  } else {
    splitLines.forEach(revealLine);
  }

  // 首屏兜底：无论观察器是否触发，尽早让 hero 标题可见
  var heroLines = $$('.hero-title .line');
  var heroPlayed = false;

  function playHeroTitle() {
    if (heroPlayed) return;
    heroPlayed = true;
    heroLines.forEach(revealLine);
  }

  if (document.readyState === 'complete') {
    setTimeout(playHeroTitle, 120);
  } else {
    window.addEventListener('load', function () { setTimeout(playHeroTitle, 120); });
  }
  setTimeout(playHeroTitle, 1200); // 兜底，避免资源异常时标题不可见

  /* ---------------------------------------------------------
     6. 数字滚动
     --------------------------------------------------------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var dur = 1400;
    var start = 0;

    function frame(ts) {
      if (!start) start = ts;
      var p = clamp((ts - start) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = String(target);
    }
    requestAnimationFrame(frame);
  }

  var counters = $$('[data-count]');

  if ('IntersectionObserver' in window && !reduced) {
    var countObs = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { countObs.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
  }

  /* ---------------------------------------------------------
     7. FAQ 手风琴
     --------------------------------------------------------- */
  $$('.faq-item').forEach(function (item) {
    var btn = $('.faq-q', item);
    var panel = $('.faq-a', item);
    if (!btn || !panel) return;

    btn.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');

      $$('.faq-item.open').forEach(function (other) {
        if (other === item) return;
        other.classList.remove('open');
        $('.faq-q', other).setAttribute('aria-expanded', 'false');
        $('.faq-a', other).style.height = '0px';
      });

      if (isOpen) {
        item.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        panel.style.height = '0px';
      } else {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        panel.style.height = panel.firstElementChild.offsetHeight + 'px';
      }
    });
  });

  var faqResizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(faqResizeTimer);
    faqResizeTimer = setTimeout(function () {
      var open = $('.faq-item.open');
      if (!open) return;
      var p = $('.faq-a', open);
      p.style.height = p.firstElementChild.offsetHeight + 'px';
    }, 150);
  });

  /* ---------------------------------------------------------
     8. 首屏粒子星空
     性能约束：粒子数上限 72、DPR 上限 1.5、无逐点光晕、
              离开视口或切后台立即停帧
     --------------------------------------------------------- */
  var canvas = $('#heroCanvas');
  var hero = $('#hero');

  if (canvas && hero && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, DPR = 1;
    var parts = [];
    var pointer = { x: -9999, y: -9999 };
    var LINK = 132;
    var running = false;
    var rafId = 0;
    var visible = false;

    function buildParticles() {
      // 点数刻意压低：地球是主体，粒子只作环境星点
      var density = window.innerWidth < 768 ? 28000 : 18000;
      var count = clamp(Math.round((W * H) / density), 14, 44);
      parts.length = 0;
      for (var i = 0; i < count; i++) {
        parts.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24,
          r: Math.random() * 1.4 + 0.9
        });
      }
    }

    function resizeCanvas() {
      var rect = hero.getBoundingClientRect();
      DPR = Math.min(window.devicePixelRatio || 1, 1.5);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.max(1, Math.floor(W * DPR));
      canvas.height = Math.max(1, Math.floor(H * DPR));
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildParticles();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      var i, j, a, b, dx, dy, d2, d, n = parts.length;

      // 连线（仅一次遍历对数）
      for (i = 0; i < n; i++) {
        a = parts[i];
        for (j = i + 1; j < n; j++) {
          b = parts[j];
          dx = a.x - b.x;
          dy = a.y - b.y;
          d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          d = Math.sqrt(d2);
          ctx.globalAlpha = (1 - d / LINK) * 0.3;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // 节点
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#a5b4fc';
      for (i = 0; i < n; i++) {
        a = parts[i];
        a.x += a.vx;
        a.y += a.vy;

        if (a.x < -16) a.x = W + 16; else if (a.x > W + 16) a.x = -16;
        if (a.y < -16) a.y = H + 16; else if (a.y > H + 16) a.y = -16;

        // 鼠标轻微排斥
        dx = a.x - pointer.x;
        dy = a.y - pointer.y;
        d2 = dx * dx + dy * dy;
        if (d2 < 14000 && d2 > 0.01) {
          d = Math.sqrt(d2);
          var f = (1 - d / 118) * 0.8;
          a.x += (dx / d) * f;
          a.y += (dy / d) * f;
        }

        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, 6.2832);
        ctx.fill();
      }
    }

    function loop() {
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function start() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function staticFrame() {
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#a5b4fc';
      for (var i = 0; i < parts.length; i++) {
        ctx.beginPath();
        ctx.arc(parts[i].x, parts[i].y, parts[i].r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 1;
    resizeCanvas();

    var heroResizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(heroResizeTimer);
      heroResizeTimer = setTimeout(function () {
        resizeCanvas();
        if (reduced || !running) staticFrame();
      }, 160);
    });

    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    }, { passive: true });

    hero.addEventListener('mouseleave', function () { pointer.x = -9999; pointer.y = -9999; });

    if (reduced) {
      staticFrame();
    } else {
      var visObs = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !document.hidden) start(); else stop();
      }, { threshold: 0 });
      visObs.observe(hero);

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop();
        else if (visible) start();
      });
    }
  }

  /* ---------------------------------------------------------
     9. 首屏点阵地球
     数据：离线烘焙的 240×120 陆地掩码（Natural Earth，公有领域）
     渲染：正交投影 + Y 轴自转 + 23.5° 轴倾角，正面半球按深度着色
     性能：单位向量预计算、每帧零三角函数、陆地单色批量绘制、
           经纬网格合并单路径描边、离开视口立即停帧
     --------------------------------------------------------- */
  var LAND_MASK = { w: 240, h: 120, data: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//8////44AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPx/n/////AAAA/AAYAAAAfAAAAAAAAAAAAAAAAEO3v4f////+AAAPgAAAAAAAAcAAAAAAAAAAAAAADAAAfgP////+AAAHAAAAAAAAAMAAAAAAAAAAAAAAA9jjCAAP///+AAAAAAAAHgAAP/8AAPAAAAAAAAAAcAAAAAAD///8AAAAAAAAYAAD//gAAAAAAAAAAAAAe6zs/AAB///4AAAAAAABgDA/////wGAAAAwAEAAAI/wM//AAf//////////xwHf/////z/+AAAAB//wPI/+sEP4A///wAAAAf8AACHf////////8B8P////////////////////8AAOcgEQAAAAAAAAAAAE////////////////////4AAHAAAgAAAAAAAAAAA5////////////////////wOB4AAAAAAAAAAAAAAAAAf///////Ng+AP4ADAAA/n////////////////+AD///////8COMAHwAAAAD/P///////////////v8AD/7/////4APwABgAAAAH/P//////////////wfAAA+AH////4APzAAAAAAAD/D/////////////JhgAAAFAAf///8AH/gAAAAAIAOD////////////4AHAAAAQAAP////wH/gAAAAAMBuP////////////wAPgAACAAAH////+f/8AAAAAWAhf////////////AAPAAAAAAAT////+f/+AAAAA3H//////////////+AOAAAAAAAB/////f/8AAAAAHn//////////////+AIAAAAAAAB//////8wAAAAAMf//////////////9AAAAAAAAAA//////2HAAAAAF///////////////4AAAAAAAAAAf/////+AgAAAAD///////////////4AAAAAAAAAAf//////wAAAAAB///yfx/////////wAAAAAAAAAAf/////yAAAAAAB/z/gPj/////////jAAAAAAAAAAf/////gAAAAAA/wY/gDx////////8HAAAAAAAAAAf/////AAAAAAA/gGfnn4////////wAAAAAAAAAAAf////+AAAAAAA/ACY//4///////1gGAAAAAAAAAAP////8AAAAAAA/ACM//4///////hwEAAAAAAAAAAH////4AAAAAAAOLgA//////////4wcAAAAAAAAAAH////4AAAAAAAN/gDC/////////wz8AAAAAAAAAAB////wAAAAAAAf/gAA/////////wDgAAAAAAAAAAA////AAAAAAAA//8YB/////////4EAAAAAAAAAAAAX///AAAAAAAA///f//////////4AAAAAAAAAAAAAX/5BAAAAAAAB//////z///////4AAAAAAAAAAAAAb/gBAAAAAAAH////8/5///////4AAAAAAAAAAAAAF/gBoAAAAAAP////+/4f//////wAAAAAAAAAAAAAE/gAAAAAAAAP////+f8wH/////gAAAAAAAAAAAAAAfgAAAAAAAAf/////P/4D/////IAAAAAAAAAAAAAAPgAQAAAAAAf/////v/8D/+f/4AAAAAAAAAAAAAAAPgwOAAAAAAf/////n/4Af8P+AAAAAAAAAAAAAAAAHxwAwAAAAAf/////n/wAfwH+wAAAAAAAAAAAAAAAB/gAAAAAAAf/////z/gAfgH+AMAAAAAAAAAAAAAAAT8AAAAAAAf/////z+AAfAF/AIAAAAAAAAAAAAAAAB+AAAAAAAf/////94AAOAB/gIAAAAAAAAAAAAAAAAMAAAAAAAf//////AAAOAA/gCAAAAAAAAAAAAAAAAEBQAAAAAP/////+MAAGAAHAFAAAAAAAAAAAAAAAACDfgAAAAH//////8AAGAACAAAAAAAAAAAAAAAAAABP/wAAAAH//////4AABABgADAAAAAAAAAAAAAAAAAP/4AAAAD//////4AABAAQABAAAAAAAAAAAAAAAAAP//gAAAA/H////wAAAACYBgAAAAAAAAAAAAAAAAAH//wAAAAAA////wAAAADYDAAAAAAAAAAAAAAAAAAP//wAAAAAA////gAAAABoPgAAAAAAAAAAAAAAAAAf//4AAAAAA///+AAAAAA4fuQAAAAAAAAAAAAAAAA///+AAAAAA///8AAAAAAYfASAAAAAAAAAAAAAAAA////AAAAAA///4AAAAAAcfYBYAAAAAAAAAAAAAAA////8AAAAAf//4AAAAAAOCEh/AAAAAAAAAAAAAAA/////AAAAAP//wAAAAAAGAAAPgAAAAAAAAAAAAAA/////gAAAAP//wAAAAAADIABPwIAAAAAAAAAAAAAf////gAAAAH//wAAAAAAAOAAPYCAAAAAAAAAAAAAP////AAAAAH//4AAAAAAAACAAMAAAAAAAAAAAAAAP///+AAAAAH//4AAAAAAAAAAAAAAAAAAAAAAAAAAH///+AAAAAH//4AAAAAAAAAHhAAAAAAAAAAAAAAAH///8AAAAAP//4IAAAAAAAAvjAAAAAAAAAAAAAAAD///8AAAAAP//4cAAAAAAAB/jgAAAAAAAAAAAAAAA///8AAAAAP//h4AAAAAAAD/7gAAAAAAAAAAAAAAAf//8AAAAAP//B4AAAAAAAH//wAAAAAAAAAAAAAAAf//4AAAAAH/+AwAAAAAAAf//4AQAAAAAAAAAAAAAf//4AAAAAH//BwAAAAAAB///8AIAAAAAAAAAAAAAf//gAAAAAD//BwAAAAAAD///+AAAAAAAAAAAAAAAf/8AAAAAAD/+BgAAAAAAD////AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAD////AAAAAAAAAAAAAAAf/8AAAAAAD/8AAAAAAAAD////AAAAAAAAAAAAAAA//4AAAAAAB/4AAAAAAAAB////AAAAAAAAAAAAAAA//wAAAAAAA/wAAAAAAAAB////AAAAAAAAAAAAAAA//gAAAAAAA/gAAAAAAAAB/h//AAAAAAAAAAAAAAA//AAAAAAAA+AAAAAAAAAB+Av+AAAAAAAAAAAAAAA/8AAAAAAAAAAAAAAAAAAAAAP8AAQAAAAAAAAAAAB/8AAAAAAAAAAAAAAAAAAAAAH8AAIAAAAAAAAAAAB/4AAAAAAAAAAAAAAAAAAAAADQAAOAAAAAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAYAAIAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAYAAwAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAADwAACAefH/gAAAAAAAAAAAAAAAAEAAAAAAAAAAAB//8B///////4AAAAAAAAAAAAAAA/AAAAAAAAAAH///8P////////8AAAAAAAAAAAAAB3gAAAAATf//////8//////////+AAAAAAAAAAAgAHgAAAAH////////////////////AAAAAAAB4B////gAAAAP///////////////////4AAAAD////////4AAAAD////////////////////gAAALP///////8AAAAD/////////////////////gAABj////////wAAHg//////////////////////4AAAAD///////8AQ/AB////////////////////+AAAAB//////////AGP//////////////////////AAAAA///////////////////////////////////8AAD//gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" };

  var globeCanvas = $('#globeCanvas');

  if (globeCanvas && globeCanvas.getContext) {
    var gctx = globeCanvas.getContext('2d');
    var GW = 1, GH = 1, GDPR = 1, gR = 1, gcx = 0, gcy = 0;
    var glowGrad = null;
    var gSpin = 0, gRunning = false, gRaf = 0, gVisible = false, gStart = 0;
    var gResizeTimer = null;

    var SPIN_SPEED = 0.075;                        // rad/s，约 84 秒一圈
    var TILT = 23.5 * Math.PI / 180;               // 地轴倾角
    var SIN_T = Math.sin(TILT), COS_T = Math.cos(TILT);
    var sinSpin = 0, cosSpin = 1;
    var tx = 0, ty = 0, tz = 0;

    /* ---- 掩码解码 → 单位向量（一次性） ---- */
    var px = [], py = [], pz = [];
    (function decodeMask() {
      var w = LAND_MASK.w, h = LAND_MASK.h, rad = Math.PI / 180;
      var bin = atob(LAND_MASK.data);
      var total = w * h;
      for (var i = 0; i < total; i++) {
        var byte = bin.charCodeAt(i >> 3);
        if (!((byte >> (7 - (i & 7))) & 1)) continue;
        var row = (i / w) | 0;
        var col = i - row * w;
        var phi = (90 - (row + 0.5) * (180 / h)) * rad;
        var lam = (-180 + (col + 0.5) * (360 / w)) * rad;
        var cp = Math.cos(phi);
        px.push(cp * Math.sin(lam));
        py.push(Math.sin(phi));
        pz.push(cp * Math.cos(lam));
      }
      px = Float32Array.from(px);
      py = Float32Array.from(py);
      pz = Float32Array.from(pz);
    })();

    /* ---- 投影：球面单位向量 → 屏幕坐标（写入 tx/ty/tz） ---- */
    function gProject(x0, y0, z0, scale) {
      var x = x0 * cosSpin + z0 * sinSpin;
      var z = z0 * cosSpin - x0 * sinSpin;
      var y2 = y0 * COS_T - z * SIN_T;
      var z2 = y0 * SIN_T + z * COS_T;
      var rr = (scale || 1) * gR;
      tx = gcx + x * rr;
      ty = gcy - y2 * rr;
      tz = z2;
    }

    function ll2v(lat, lon) {
      var rad = Math.PI / 180;
      var phi = lat * rad, lam = lon * rad, cp = Math.cos(phi);
      return [cp * Math.sin(lam), Math.sin(phi), cp * Math.cos(lam)];
    }

    /* ---- 经纬网格 ---- */
    var graticule = (function () {
      var rad = Math.PI / 180, out = [], j, k;
      for (j = -180; j < 180; j += 30) {           // 经线
        var mer = [];
        for (k = -90; k <= 90; k += 6) {
          var phi = k * rad, lam = j * rad, cp = Math.cos(phi);
          mer.push([cp * Math.sin(lam), Math.sin(phi), cp * Math.cos(lam)]);
        }
        out.push({ pts: mer, equator: false });
      }
      [-60, -30, 0, 30, 60].forEach(function (lat) {  // 纬线（含赤道）
        var phi = lat * rad, cp = Math.cos(phi), sp = Math.sin(phi), pl = [];
        for (k = -180; k <= 180; k += 6) {
          var lam = k * rad;
          pl.push([cp * Math.sin(lam), sp, cp * Math.cos(lam)]);
        }
        out.push({ pts: pl, equator: lat === 0 });
      });
      return out;
    })();

    function emitGraticule(equator) {
      for (var i = 0; i < graticule.length; i++) {
        var g = graticule[i];
        if (g.equator !== equator) continue;
        var started = false;
        for (var j = 0; j < g.pts.length; j++) {
          var p = g.pts[j];
          gProject(p[0], p[1], p[2], 1);
          if (tz > 0.03) {
            if (started) gctx.lineTo(tx, ty);
            else { gctx.moveTo(tx, ty); started = true; }
          } else started = false;
        }
      }
    }

    /* ---- 城市与大陆间飞线 ---- */
    var cityVec = {
      beijing: ll2v(39.90, 116.40),
      frankfurt: ll2v(50.11, 8.68),
      losangeles: ll2v(34.05, -118.24),
      singapore: ll2v(1.35, 103.82),
      dubai: ll2v(25.20, 55.27),
      saopaulo: ll2v(-23.55, -46.63)
    };

    function slerpArc(a, b, steps) {
      var dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
      var omega = Math.acos(dot), so = Math.sin(omega), out = [];
      for (var i = 0; i <= steps; i++) {
        var t = i / steps, c1, c2;
        if (so < 1e-6) { c1 = 1 - t; c2 = t; }
        else { c1 = Math.sin((1 - t) * omega) / so; c2 = Math.sin(t * omega) / so; }
        out.push({
          v: [a[0] * c1 + b[0] * c2, a[1] * c1 + b[1] * c2, a[2] * c1 + b[2] * c2],
          t: t
        });
      }
      return out;
    }

    var ROUTES = [
      { a: 'beijing', b: 'frankfurt', off: 0.00 },
      { a: 'beijing', b: 'losangeles', off: 0.45 },
      { a: 'singapore', b: 'dubai', off: 0.22 },
      { a: 'saopaulo', b: 'frankfurt', off: 0.72 }
    ].map(function (r) {
      r.from = cityVec[r.a];
      r.to = cityVec[r.b];
      r.pts = slerpArc(r.from, r.to, 48);
      return r;
    });

    /* ---- 绘制 ---- */
    function drawLand(stride) {
      gctx.fillStyle = '#818cf8';
      var n = px.length;
      for (var i = 0; i < n; i += stride) {
        gProject(px[i], py[i], pz[i], 1);
        if (tz <= 0) continue;
        var s = 0.9 + tz * 1.2;
        gctx.globalAlpha = 0.16 + tz * 0.74;
        gctx.fillRect(tx - s * 0.5, ty - s * 0.5, s, s);
      }
    }

    function drawRoutes(now) {
      var PERIOD = 4200;
      for (var r = 0; r < ROUTES.length; r++) {
        var route = ROUTES[r], pts = route.pts, i;

        // 弧线（沿球面 + 抬升 16%）
        gctx.globalAlpha = 1;
        gctx.strokeStyle = 'rgba(165,180,252,.5)';
        gctx.lineWidth = 1.1;
        gctx.beginPath();
        var started = false;
        for (i = 0; i < pts.length; i++) {
          var p = pts[i];
          gProject(p.v[0], p.v[1], p.v[2], 1 + 0.16 * Math.sin(Math.PI * p.t));
          if (tz > 0.04) {
            if (started) gctx.lineTo(tx, ty);
            else { gctx.moveTo(tx, ty); started = true; }
          } else started = false;
        }
        gctx.stroke();

        // 端点
        gctx.fillStyle = '#c7d2fe';
        [route.from, route.to].forEach(function (v) {
          gProject(v[0], v[1], v[2], 1);
          if (tz <= 0) return;
          gctx.globalAlpha = 0.9;
          gctx.beginPath();
          gctx.arc(tx, ty, 2.1, 0, 6.2832);
          gctx.fill();
        });

        // 脉冲光点
        var prog = ((now / PERIOD) + route.off) % 1;
        var idx = prog * (pts.length - 1);
        var i0 = Math.floor(idx);
        var i1 = Math.min(i0 + 1, pts.length - 1);
        var f = idx - i0;
        var v0 = pts[i0].v, v1 = pts[i1].v;
        gProject(
          v0[0] + (v1[0] - v0[0]) * f,
          v0[1] + (v1[1] - v0[1]) * f,
          v0[2] + (v1[2] - v0[2]) * f,
          1 + 0.16 * Math.sin(Math.PI * prog)
        );
        if (tz > 0.02) {
          gctx.fillStyle = '#e0e7ff';
          gctx.globalAlpha = 0.2;
          gctx.beginPath();
          gctx.arc(tx, ty, 6.5, 0, 6.2832);
          gctx.fill();
          gctx.globalAlpha = 0.95;
          gctx.beginPath();
          gctx.arc(tx, ty, 2.4, 0, 6.2832);
          gctx.fill();
        }
      }
    }

    function renderGlobe(now) {
      gctx.clearRect(0, 0, GW, GH);

      // 外层光晕（缓存渐变，球体之外）
      if (glowGrad) {
        gctx.globalAlpha = 1;
        gctx.fillStyle = glowGrad;
        gctx.beginPath();
        gctx.arc(gcx, gcy, gR * 1.18, 0, 6.2832);
        gctx.fill();
      }

      // 球体轮廓
      gctx.globalAlpha = 0.55;
      gctx.strokeStyle = 'rgba(129,140,248,.30)';
      gctx.lineWidth = 1;
      gctx.beginPath();
      gctx.arc(gcx, gcy, gR, 0, 6.2832);
      gctx.stroke();

      // 经纬网格（合并为两条路径）
      gctx.globalAlpha = 1;
      gctx.lineWidth = 1;
      gctx.strokeStyle = 'rgba(129,140,248,.11)';
      gctx.beginPath();
      emitGraticule(false);
      gctx.stroke();
      gctx.strokeStyle = 'rgba(129,140,248,.22)';
      gctx.beginPath();
      emitGraticule(true);
      gctx.stroke();

      // 陆地（窄屏抽样降载）
      drawLand(window.innerWidth < 900 ? 2 : 1);
      // 飞线
      drawRoutes(now);

      gctx.globalAlpha = 1;
    }

    /* ---- 尺寸 ---- */
    function resizeGlobe() {
      var rect = globeCanvas.getBoundingClientRect();
      GDPR = Math.min(window.devicePixelRatio || 1, 1.5);
      GW = Math.max(1, Math.round(rect.width));
      GH = Math.max(1, Math.round(rect.height));
      globeCanvas.width = Math.max(1, Math.floor(GW * GDPR));
      globeCanvas.height = Math.max(1, Math.floor(GH * GDPR));
      gctx.setTransform(GDPR, 0, 0, GDPR, 0, 0);
      gcx = GW / 2;
      gcy = GH / 2;
      gR = Math.min(GW, GH) * 0.42;
      glowGrad = gctx.createRadialGradient(gcx, gcy, gR * 0.9, gcx, gcy, gR * 1.18);
      glowGrad.addColorStop(0, 'rgba(129,140,248,.14)');
      glowGrad.addColorStop(0.55, 'rgba(129,140,248,.05)');
      glowGrad.addColorStop(1, 'rgba(129,140,248,0)');
    }

    /* ---- 循环控制 ---- */
    function gLoop(ts) {
      gSpin = (ts - gStart) / 1000 * SPIN_SPEED;
      sinSpin = Math.sin(gSpin);
      cosSpin = Math.cos(gSpin);
      renderGlobe(ts);
      gRaf = requestAnimationFrame(gLoop);
    }

    function gStartLoop() {
      if (gRunning) return;
      gRunning = true;
      gStart = performance.now() - gSpin / SPIN_SPEED * 1000;   // 保留当前相位
      gRaf = requestAnimationFrame(gLoop);
    }

    function gStopLoop() {
      gRunning = false;
      if (gRaf) cancelAnimationFrame(gRaf);
      gRaf = 0;
    }

    function gStaticFrame() {
      gSpin = 0.6;
      sinSpin = Math.sin(gSpin);
      cosSpin = Math.cos(gSpin);
      renderGlobe(2100);
    }

    resizeGlobe();

    window.addEventListener('resize', function () {
      clearTimeout(gResizeTimer);
      gResizeTimer = setTimeout(function () {
        resizeGlobe();
        if (!gRunning) renderGlobe(2100);
      }, 160);
    });

    if (reduced) {
      gStaticFrame();
    } else if ('IntersectionObserver' in window) {
      var gVisObs = new IntersectionObserver(function (entries) {
        gVisible = entries[0].isIntersecting;
        if (gVisible && !document.hidden) gStartLoop(); else gStopLoop();
      }, { threshold: 0 });
      gVisObs.observe(globeCanvas);

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) gStopLoop();
        else if (gVisible) gStartLoop();
      });
    } else {
      gStartLoop();
    }
  }

  /* ---------------------------------------------------------
     10. 页脚年份
     --------------------------------------------------------- */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------
     11. 偏好变化
     --------------------------------------------------------- */
  function onPrefChange() { reduced = mqReduce.matches; }
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', onPrefChange);

  /* ---------------------------------------------------------
     12. 邮箱一键复制
     --------------------------------------------------------- */
  var copyBtn = $('#copyMail');
  var toastEl = $('#toast');
  var toastTimer = null;

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }

  // 兼容不支持 Clipboard API 的环境
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = copyBtn.getAttribute('data-copy') || '';
      var fail = function () {
        showToast(fallbackCopy(text) ? '已复制：' + text : '复制失败，请手动选择');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast('已复制：' + text);
        }, fail);
      } else {
        fail();
      }
    });
  }
})();