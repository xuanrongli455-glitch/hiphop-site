/* 首页 Hero · WebGL 磁带画廊：每盘磁带 = 一篇文章，拖动旋转，点击进入。
   失败时（无 WebGL / CDN 失败 / 减动效偏好）自动回退到静态封面图，不阻断页面。 */
import * as THREE from "three";

(function () {
  var stage = document.getElementById("webglStage");
  var fallback = document.getElementById("webglFallback");
  var hint = document.getElementById("webglHint");
  var dataEl = document.getElementById("tapeData");
  if (!stage || !dataEl) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var items;
  try { items = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!items || !items.length) return;

  var palette = ["#ffe600", "#ff4d00", "#3cffd0", "#5200ff", "#ff2e88", "#00aaff"];

  function wrapTitle(x, title, maxWidthPx, maxLines) {
    /* 按画布实测宽度换行，优先在空格处断开，英文单词不断半 */
    var lines = [];
    var cur = "";
    var chars = Array.from(title);
    var i = 0;
    for (; i < chars.length; i++) {
      var test = cur + chars[i];
      if (x.measureText(test).width > maxWidthPx && cur) {
        var sp = cur.lastIndexOf(" ");
        if (sp > 0) {
          lines.push(cur.slice(0, sp));
          cur = cur.slice(sp + 1) + chars[i];
        } else {
          lines.push(cur);
          cur = chars[i];
        }
        if (lines.length >= maxLines) { i++; break; }
      } else {
        cur = test;
      }
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (i < chars.length) {
      var last = lines[lines.length - 1] || "";
      while (last && x.measureText(last + "…").width > maxWidthPx) last = last.slice(0, -1);
      lines[lines.length - 1] = last + "…";
    }
    return lines.slice(0, maxLines);
  }

  function makeFaceTexture(item, color) {
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 640;
    var x = c.getContext("2d");
    x.fillStyle = color;
    x.fillRect(0, 0, 1024, 640);
    /* 磁带窗口：深色横条，像磁带中间的透明窗 */
    x.fillStyle = "rgba(0,0,0,0.72)";
    x.fillRect(64, 300, 896, 150);
    x.fillStyle = "#ffffff";
    x.beginPath();
    x.arc(230, 375, 52, 0, Math.PI * 2);
    x.arc(794, 375, 52, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = color;
    x.beginPath();
    x.arc(230, 375, 30, 0, Math.PI * 2);
    x.arc(794, 375, 30, 0, Math.PI * 2);
    x.fill();
    /* 栏目 + 标题 */
    x.fillStyle = "#111111";
    x.font = "600 44px sans-serif";
    x.fillText(item.col, 64, 96);
    x.font = "700 84px 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
    var lines = wrapTitle(x, item.title, 896, 2);
    lines.forEach(function (ln, i) { x.fillText(ln, 64, 210 + i * 100); });
    /* 底部色条 */
    x.fillStyle = "#111111";
    x.fillRect(64, 560, 200, 12);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.7, 8.4);
  camera.lookAt(0, 0, 0);

  var group = new THREE.Group();
  scene.add(group);
  var dark = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  var tapes = [];
  var radius = 4.6;
  items.forEach(function (item, i) {
    var color = palette[i % palette.length];
    var face = new THREE.MeshBasicMaterial({ map: makeFaceTexture(item, color) });
    var geo = new THREE.BoxGeometry(2.4, 1.5, 0.22);
    var mesh = new THREE.Mesh(geo, [dark, dark, dark, dark, face, dark]);
    var angle = (i / items.length) * Math.PI * 2;
    mesh.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    mesh.rotation.y = angle;
    mesh.rotation.x = -0.06;
    mesh.userData.url = item.url;
    group.add(mesh);
    tapes.push(mesh);
  });

  function resize() {
    var w = stage.clientWidth || 800;
    var h = stage.clientHeight || 520;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  /* 交互：拖动旋转（带惯性），点按进入文章 */
  var targetRot = 0;
  var velocity = 0;
  var dragging = false;
  var lastX = 0;
  var downX = 0, downY = 0, downTime = 0;
  var lastInteract = 0;
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var hoverCheck = false;

  function pick(cx, cy) {
    var rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObjects(tapes, false);
    return hits.length ? hits[0].object : null;
  }

  var el = renderer.domElement;
  el.addEventListener("pointerdown", function (e) {
    dragging = true;
    lastX = e.clientX;
    downX = e.clientX; downY = e.clientY;
    downTime = Date.now();
    velocity = 0;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", function (e) {
    if (dragging) {
      var dx = e.clientX - lastX;
      lastX = e.clientX;
      targetRot += dx * 0.005;
      velocity = dx * 0.005;
      lastInteract = Date.now();
    } else {
      hoverCheck = true;
      var hit = pick(e.clientX, e.clientY);
      el.style.cursor = hit ? "pointer" : "grab";
    }
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    lastInteract = Date.now();
    var moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved < 8 && Date.now() - downTime < 400) {
      var hit = pick(e.clientX, e.clientY);
      if (hit && hit.userData.url) window.location.href = hit.userData.url;
    }
  }
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", function () { dragging = false; });

  /* 可见时才渲染，省电 */
  var visible = true;
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
  }).observe(stage);

  var last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible) return;
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!dragging) {
      if (Date.now() - lastInteract > 3000) targetRot += dt * 0.12; /* 无人操作时缓慢自转 */
      targetRot += velocity;
      velocity *= 0.94;
    }
    group.rotation.y += (targetRot - group.rotation.y) * 0.08;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);

  /* 成功初始化：显示画布，隐藏回退图 */
  stage.hidden = false;
  if (fallback) fallback.hidden = true;
  if (hint) hint.hidden = false;
  el.style.cursor = "grab";
})();
