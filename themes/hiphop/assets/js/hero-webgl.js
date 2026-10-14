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

  function roundRect(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }

  /* 真磁带质感：纸标签 + 螺丝 + 带盘窗（辐条轮 + 磁带条）+ 底部卡口 */
  function makeFaceTexture(item, color) {
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 640;
    var x = c.getContext("2d");
    /* 壳体 */
    x.fillStyle = color;
    x.fillRect(0, 0, 1024, 640);
    x.strokeStyle = "rgba(0,0,0,0.25)";
    x.lineWidth = 6;
    x.strokeRect(10, 10, 1004, 620);
    /* 四角螺丝 */
    [[44, 44], [980, 44], [44, 596], [980, 596]].forEach(function (p) {
      x.fillStyle = "rgba(0,0,0,0.35)";
      x.beginPath(); x.arc(p[0], p[1], 16, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "rgba(255,255,255,0.35)"; x.lineWidth = 3;
      x.beginPath(); x.moveTo(p[0] - 9, p[1]); x.lineTo(p[0] + 9, p[1]); x.stroke();
    });
    /* 纸标签：栏目 + 标题，标题不再撞进窗口 */
    x.fillStyle = "#f5f0e6";
    roundRect(x, 56, 56, 912, 210, 10); x.fill();
    x.fillStyle = "#666666";
    x.font = "600 34px sans-serif";
    x.fillText(item.col, 88, 116);
    x.fillStyle = "#111111";
    x.font = "700 56px 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
    var lines = wrapTitle(x, item.title, 848, 2);
    lines.forEach(function (ln, i) { x.fillText(ln, 88, 180 + i * 62); });
    /* 磁带窗口 */
    x.fillStyle = "#141414";
    roundRect(x, 64, 300, 896, 190, 16); x.fill();
    /* 磁带条：连着两个轮 */
    x.fillStyle = "#5a3a1a";
    x.fillRect(230, 387, 564, 6);
    /* 两个带盘：磁带卷 + 白色辐条轮 + 彩色轮毂 */
    [230, 794].forEach(function (cx) {
      x.fillStyle = "#7a4a1f";
      x.beginPath(); x.arc(cx, 395, 60, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#f2f2f2";
      x.beginPath(); x.arc(cx, 395, 46, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "#141414"; x.lineWidth = 5;
      for (var k = 0; k < 3; k++) {
        var a = k * Math.PI * 2 / 3 - Math.PI / 2;
        x.beginPath();
        x.moveTo(cx, 395);
        x.lineTo(cx + Math.cos(a) * 44, 395 + Math.sin(a) * 44);
        x.stroke();
      }
      x.fillStyle = color;
      x.beginPath(); x.arc(cx, 395, 15, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#141414";
      x.beginPath(); x.arc(cx, 395, 6, 0, Math.PI * 2); x.fill();
    });
    /* 底部卡口：中间磁头开口 + 两侧小切口 */
    x.fillStyle = "#0a0a0a";
    x.beginPath();
    x.moveTo(412, 640); x.lineTo(452, 556); x.lineTo(572, 556); x.lineTo(612, 640); x.closePath(); x.fill();
    x.fillRect(180, 600, 84, 40);
    x.fillRect(760, 600, 84, 40);
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
  var tapes = [];
  var radius = 4.6;
  function shadeMat(hex, f) {
    var col = new THREE.Color(hex);
    col.multiplyScalar(f);
    return new THREE.MeshBasicMaterial({ color: col });
  }
  items.forEach(function (item, i) {
    var color = palette[i % palette.length];
    var face = new THREE.MeshBasicMaterial({ map: makeFaceTexture(item, color) });
    var edge = shadeMat(color, 0.55);
    var back = shadeMat(color, 0.3);
    var geo = new THREE.BoxGeometry(2.4, 1.5, 0.28);
    var mesh = new THREE.Mesh(geo, [edge, edge, edge, edge, face, back]);
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
  var hovering = false;
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
  el.addEventListener("pointerenter", function () { hovering = true; });
  el.addEventListener("pointerleave", function () { hovering = false; lastInteract = Date.now(); });

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
      if (Date.now() - lastInteract > 3000 && !hovering) targetRot += dt * 0.12; /* 无人操作时缓慢自转，悬停时暂停方便点选 */
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
