/* 平滑滚动（Lenis 思路，手写轻量版）：滚轮输入经插值跟随，锚点/键盘/滚动条跳转保持原生。
   首页 3D 世界自带滚轮推进，不启用；减动效、触控设备不启用。 */
(function () {
  if (document.body.classList.contains("world-home")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  document.documentElement.style.scrollBehavior = "auto";
  var target = window.scrollY, current = target, raf = null;
  function tick() {
    current += (target - current) * 0.12;
    if (Math.abs(target - current) < 0.5) {
      window.scrollTo(0, target);
      current = target;
      raf = null;
      return;
    }
    window.scrollTo(0, current);
    raf = requestAnimationFrame(tick);
  }
  window.addEventListener("wheel", function (e) {
    if (e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && t.closest && t.closest("input, textarea, select, [data-native-scroll]")) return;
    e.preventDefault();
    var max = Math.max(0, document.body.scrollHeight - window.innerHeight);
    target = Math.max(0, Math.min(max, target + e.deltaY));
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: false });
  /* 锚点/键盘/滚动条跳转后同步目标值，避免插值把页面拉回去 */
  window.addEventListener("scroll", function () {
    if (!raf) { target = window.scrollY; current = target; }
  }, { passive: true });
})();
