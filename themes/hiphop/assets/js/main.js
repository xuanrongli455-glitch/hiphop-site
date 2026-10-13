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

  /* 顶栏滚动效果 + 回到顶部 */
  var header = document.getElementById("siteHeader");
  var toTop = document.getElementById("toTop");
  function onScroll() {
    var y = window.scrollY || 0;
    if (header) header.classList.toggle("scrolled", y > 24);
    if (toTop) toTop.classList.toggle("show", y > 600);
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
