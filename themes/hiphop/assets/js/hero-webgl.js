/* 首页 Hero · WebGL 磁带画廊：每盘磁带 = 一篇文章，拖动旋转，点击进入。
   失败时（无 WebGL / CDN 失败 / 减动效偏好）自动回退到静态封面图，不阻断页面。 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a1a1a, 9, 17);
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.7, 8.4);
  camera.lookAt(0, 0, 0);

  /* 灯光：环境 + 暖主光 + 冷轮廓光，塑料壳才有高光和明暗 */
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  var key = new THREE.DirectionalLight(0xfff2dd, 1.6);
  key.position.set(4, 6, 7);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0x88aaff, 0.7);
  rim.position.set(-6, 3, -5);
  scene.add(rim);

  var group = new THREE.Group();
  scene.add(group);
  var tapes = [];
  var radius = 4.6;
  function shade(hex, f) {
    var col = new THREE.Color(hex);
    col.multiplyScalar(f);
    return col;
  }
  items.forEach(function (item, i) {
    var color = palette[i % palette.length];
    /* 圆角壳 + 正面贴图 + 背面，圆角吃光才像实物 */
    var tape = new THREE.Group();
    var shell = new THREE.Mesh(
      new RoundedBoxGeometry(2.4, 1.5, 0.28, 4, 0.06),
      new THREE.MeshStandardMaterial({ color: shade(color, 0.55), roughness: 0.4, metalness: 0.05 })
    );
    var face = new THREE.Mesh(
      new THREE.PlaneGeometry(2.36, 1.46),
      new THREE.MeshStandardMaterial({ map: makeFaceTexture(item, color), roughness: 0.35, metalness: 0 })
    );
    face.position.z = 0.141;
    var back = new THREE.Mesh(
      new THREE.PlaneGeometry(2.36, 1.46),
      new THREE.MeshStandardMaterial({ color: shade(color, 0.3), roughness: 0.5, metalness: 0 })
    );
    back.position.z = -0.141;
    back.rotation.y = Math.PI;
    tape.add(shell, face, back);
    /* 原版式浮动预览图：文章封面卡悬在磁带前方，压住窗口区，标签标题仍可见 */
    if (item.image) {
      var thumb = new THREE.Group();
      var backing = new THREE.Mesh(
        new THREE.PlaneGeometry(1.26, 0.81),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
      );
      backing.position.z = -0.005;
      /* 注意：材质 color 会与贴图相乘，必须用白色，否则照片会被压成黑块 */
      var thumbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0 });
      var thumbMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), thumbMat);
      thumb.add(backing, thumbMesh);
      thumb.position.set(0, -0.35, 0.95);
      thumb.rotation.set(0, -0.08, 0.02);
      tape.add(thumb);
      new THREE.TextureLoader().load(item.image, function (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        thumbMat.map = tex;
        thumbMat.needsUpdate = true;
      }, undefined, function () { thumb.visible = false; });
    }
    var angle = (i / items.length) * Math.PI * 2;
    /* 打破完美圆环：每盘高低、倾斜、大小都略有不同，像漂浮的实物 */
    var baseY = Math.sin(i * 2.3) * 0.45;
    tape.position.set(Math.sin(angle) * radius, baseY, Math.cos(angle) * radius);
    tape.rotation.y = angle;
    tape.rotation.x = -0.06 + Math.sin(i * 1.3) * 0.05;
    tape.rotation.z = Math.sin(i * 1.7) * 0.1;
    tape.scale.setScalar(0.95 + (i % 3) * 0.05);
    tape.userData.url = item.url;
    tape.userData.baseY = baseY;
    tape.userData.phase = i * 1.3;
    group.add(tape);
    tapes.push(tape);
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
    var hits = raycaster.intersectObjects(tapes, true);
    if (!hits.length) return null;
    var obj = hits[0].object;
    while (obj && !obj.userData.url) obj = obj.parent;
    return obj;
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
    /* 磁带各自缓缓浮动 + 镜头轻微漂移，原版那种“活的”镜头感 */
    tapes.forEach(function (t) {
      t.position.y = t.userData.baseY + Math.sin(now * 0.0006 + t.userData.phase) * 0.08;
    });
    camera.position.x = Math.sin(now * 0.00008) * 0.35;
    camera.position.y = 0.7 + Math.sin(now * 0.00011 + 1) * 0.18;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);

  /* 成功初始化：显示画布，隐藏回退图 */
  stage.hidden = false;
  if (fallback) fallback.hidden = true;
  if (hint) hint.hidden = false;
  el.style.cursor = "grab";
})();
