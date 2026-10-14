(function () {
  "use strict";

  /* 年份 */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* 移动端菜单 */
  var menuBtn = document.getElementById("menuBtn");
  var siteNav = document.getElementById("siteNav");
  if (menuBtn && siteNav) {
    menuBtn.addEventListener("click", function () {
      var open = siteNav.classList.toggle("open");
      menuBtn.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    siteNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        siteNav.classList.remove("open");
        menuBtn.classList.remove("open");
      });
    });
  }

  /* 滚动显现 */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* 顶栏滚动效果 + 回到顶部（下滑藏顶栏，上滑出现） */
  var header = document.getElementById("siteHeader");
  var toTop = document.getElementById("toTop");
  var lastY = window.scrollY || 0;
  function onScroll() {
    var y = window.scrollY || 0;
    if (header) {
      header.classList.toggle("scrolled", y > 24);
      var goingDown = y > lastY && y > 120;
      var menuOpen = siteNav && siteNav.classList.contains("open");
      header.classList.toggle("nav-hidden", goingDown && !menuOpen);
    }
    if (toTop) toTop.classList.toggle("show", y > 600);
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* 光标跟随微光（仅精确指针设备） */
  var glow = document.getElementById("cursorGlow");
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (glow && finePointer && !reduceMotion) {
    var gx = -600, gy = -600, tx = gx, ty = gy, raf = null;
    function tick() {
      gx += (tx - gx) * 0.09; gy += (ty - gy) * 0.09;
      glow.style.transform = "translate(" + gx + "px," + gy + "px)";
      if (Math.abs(tx - gx) > 0.4 || Math.abs(ty - gy) > 0.4) { raf = requestAnimationFrame(tick); }
      else { raf = null; }
    }
    document.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      document.body.classList.add("glow-on");
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", function () {
      document.body.classList.remove("glow-on");
    });
  }

  /* 专属鼠标：金点 + 光环 + 点击涟漪（仅精确指针设备） */
  (function () {
    var fine = window.matchMedia("(pointer: fine)").matches;
    var rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || rm) return;
    var dot = document.getElementById("cursorDot");
    var ring = document.getElementById("cursorRing");
    if (!dot || !ring) return;
    document.body.classList.add("custom-cursor");
    var mx = -100, my = -100, rx = -100, ry = -100, raf = null;
    function loop() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      dot.style.transform = "translate(" + mx + "px," + my + "px)";
      ring.style.transform = "translate(" + rx + "px," + ry + "px)";
      raf = requestAnimationFrame(loop);
    }
    document.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener("mouseover", function (e) {
      var t = e.target;
      if (!t.closest) return;
      ring.classList.toggle("hovering", !!t.closest("a, button, .fchip, [role=button]"));
      document.body.classList.toggle("cursor-text", !!t.closest("input, textarea, select"));
    }, { passive: true });
    document.addEventListener("mousedown", function (e) {
      var s = document.createElement("span");
      s.className = "click-ripple";
      var d = 44;
      s.style.width = d + "px"; s.style.height = d + "px";
      s.style.left = (e.clientX - d / 2) + "px"; s.style.top = (e.clientY - d / 2) + "px";
      document.body.appendChild(s);
      setTimeout(function () { s.remove(); }, 550);
    }, { passive: true });
  })();

  /* 演出日历：城市筛选 */
  var filter = document.getElementById("cityFilter");
  var list = document.getElementById("eventList");
  var empty = document.getElementById("eventEmpty");
  if (filter && list) {
    var chips = filter.querySelectorAll(".fchip");
    var rows = list.querySelectorAll(".event-row");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        var city = chip.getAttribute("data-city");
        var visible = 0;
        rows.forEach(function (row) {
          var match = city === "all" || row.getAttribute("data-city") === city;
          row.classList.toggle("hide", !match);
          if (match) visible++;
        });
        if (empty) empty.hidden = visible > 0;
      });
    });
  }
})();

/* 首页 Line-up 栏目筛选 */
(function () {
  var filter = document.getElementById("lineupFilter");
  var rows = document.getElementById("lineupRows");
  if (!filter || !rows) return;
  var chips = filter.querySelectorAll(".lchip");
  var items = rows.querySelectorAll(".lineup-row");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c) { c.classList.remove("active"); });
      chip.classList.add("active");
      var col = chip.getAttribute("data-col");
      items.forEach(function (row) {
        var match = col === "all" || row.getAttribute("data-col") === col;
        row.classList.toggle("hide", !match);
      });
    });
  });
})();

/* 分轨式播放卡：按歌曲 ID 生成同心圆配色与装饰波形，点击展开网易云官方播放器 */
(function () {
  var players = document.querySelectorAll(".stem-player");
  if (!players.length) return;
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  function mulberry(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var palette = ["#ffe600", "#242424", "#ffffff", "#3a3a3a"];
  var bright = ["#ffe600", "#ffffff"];
  players.forEach(function (p) {
    var rnd = mulberry(hashStr(p.getAttribute("data-song-id") || "0"));
    var art = p.querySelector(".stem-art");
    var ring1 = p.querySelector(".stem-ring-1");
    var ring2 = p.querySelector(".stem-ring-2");
    if (art && ring1 && ring2) {
      var c1 = palette[Math.floor(rnd() * palette.length)];
      var c2 = palette[Math.floor(rnd() * palette.length)];
      if (c2 === c1) c2 = palette[(palette.indexOf(c1) + 2) % palette.length];
      /* 最内圈只用亮色，保证黑色播放按钮始终清晰可见 */
      var c3 = bright[Math.floor(rnd() * bright.length)];
      if (c3 === c2) c3 = bright[(bright.indexOf(c3) + 1) % bright.length];
      art.style.background = c1;
      ring1.style.background = c2;
      ring2.style.background = c3;
    }
    var wave = p.querySelector(".stem-wave");
    if (wave) {
      for (var i = 0; i < 48; i++) {
        var bar = document.createElement("span");
        var env = Math.sin((i / 47) * Math.PI);
        bar.style.height = Math.max(4, Math.round(4 + env * rnd() * 22)) + "px";
        wave.appendChild(bar);
      }
    }
    var btn = p.querySelector(".stem-play");
    var embed = p.querySelector(".stem-embed");
    var glyph = p.querySelector(".stem-play-glyph");
    if (btn && embed) {
      btn.addEventListener("click", function () {
        var open = embed.hidden;
        if (open) {
          var frame = embed.querySelector("iframe");
          if (frame && !frame.getAttribute("src")) frame.setAttribute("src", frame.getAttribute("data-src"));
        }
        embed.hidden = !open;
        p.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        if (glyph) glyph.textContent = open ? "✕" : "▶";
      });
    }
  });
})();

/* 彩蛋：连点顶栏 Logo 图标三下，或 Konami 秘籍 ↑↑↓↓←←→→BA，弹出站长卡通化身；点化身关闭 */
(function () {
  var egg = document.getElementById("eggAvatar");
  var mark = document.querySelector(".brand-mark");
  if (!egg || !mark) return;
  function showEgg() {
    egg.hidden = false;
    egg.classList.remove("bye");
    void egg.offsetWidth;
    egg.classList.add("show");
  }
  function hideEgg() {
    egg.classList.add("bye");
    setTimeout(function () { egg.hidden = true; egg.classList.remove("show", "bye"); }, 520);
  }
  var clicks = 0, timer = null;
  mark.addEventListener("click", function (e) {
    e.preventDefault();
    clicks++;
    clearTimeout(timer);
    if (clicks >= 3) { clicks = 0; showEgg(); return; }
    timer = setTimeout(function () { clicks = 0; }, 1200);
  });
  var seq = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowLeft", "ArrowRight", "ArrowRight", "b", "a"];
  var pos = 0;
  document.addEventListener("keydown", function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = (k === seq[pos]) ? pos + 1 : (k === seq[0] ? 1 : 0);
    if (pos === seq.length) { pos = 0; showEgg(); }
  });
  egg.querySelector(".egg-figure").addEventListener("click", hideEgg);
})();
