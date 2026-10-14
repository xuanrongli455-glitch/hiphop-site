/* 首页 hero：黑胶唱片画廊 — 真实黑胶照片贴图 + 散落漂浮 + 自转 + HUD */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

(function () {
  var dataEl = document.getElementById("tapeData");
  var stage = document.getElementById("webglStage");
  var fallback = document.getElementById("webglFallback");
  var hint = document.getElementById("webglHint");
  if (!dataEl || !stage) return;
  var items;
  try { items = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!items || !items.length) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a1a1a, 9, 17);
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.7, 8.4);
  camera.lookAt(0, 0, 0);

  /* 环境反射：黑胶面才有真实反光 */
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  /* 灯光：环境 + 暖主光 + 冷轮廓光 */
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  var key = new THREE.DirectionalLight(0xfff2dd, 1.8);
  key.position.set(4, 6, 7);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0x88aaff, 0.9);
  rim.position.set(-6, 3, -5);
  scene.add(rim);

  /* 真实黑胶照片（Public Domain，无品牌字，空白黄标）作盘面底 */
  var VINYL_PHOTO = "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b6/12in-Vinyl-LP-Record-Angle.jpg/1024px-12in-Vinyl-LP-Record-Angle.jpg";
  /* 每盘唱片的标签配色（站内色 + 黑胶常见色），文字与底色保证对比 */
  var LABELS = [
    { bg: "#ffe600", fg: "#111111" },
    { bg: "#f5f0e6", fg: "#111111" },
    { bg: "#ff2e2e", fg: "#ffffff" },
    { bg: "#3cffd0", fg: "#111111" },
    { bg: "#ff7a1a", fg: "#111111" },
    { bg: "#a06bff", fg: "#ffffff" },
    { bg: "#00aaff", fg: "#ffffff" },
    { bg: "#ff2e88", fg: "#ffffff" }
  ];

  function wrapTitle(ctx, text, maxW, maxLines) {
    var chars = text.split("");
    var lines = [""];
    chars.forEach(function (ch) {
      var cur = lines[lines.length - 1];
      var next = cur + ch;
      if (ctx.measureText(next).width > maxW && cur !== "") {
        if (lines.length < maxLines) lines.push(ch);
        else lines[lines.length - 1] = cur + "…";
      } else {
        lines[lines.length - 1] = next;
      }
    });
    return lines;
  }

  /* 盘面贴图：真实黑胶照片 + 覆盖中标（栏目 + 标题 + SIDE A），像一张真实唱片 */
  function makeVinylTexture(item, label) {
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 1024;
    var x = c.getContext("2d");
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      x.drawImage(img, 0, 0, 1024, 1024);
      /* 中标：盖住原图的空白黄标 */
      x.fillStyle = label.bg;
      x.beginPath(); x.arc(512, 512, 152, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "rgba(0,0,0,0.25)"; x.lineWidth = 2;
      x.beginPath(); x.arc(512, 512, 152, 0, Math.PI * 2); x.stroke();
      /* 栏目 */
      x.fillStyle = label.fg;
      x.font = "600 30px sans-serif";
      x.textAlign = "center";
      x.fillText(item.col, 512, 430);
      /* 标题（最多 2 行） */
      x.font = "700 46px 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
      var lines = wrapTitle(x, item.title, 250, 2);
      lines.forEach(function (ln, i) { x.fillText(ln, 512, 500 + i * 52); });
      /* SIDE A */
      x.font = "600 24px sans-serif";
      x.fillText("SIDE A · HIPHOPNOTE", 512, 610);
      /* 中轴孔 */
      x.fillStyle = "#111111";
      x.beginPath(); x.arc(512, 512, 7, 0, Math.PI * 2); x.fill();
      tex.needsUpdate = true;
    };
    img.onerror = function () { /* 照片加载失败：用纯黑盘面兜底 */ };
    img.src = VINYL_PHOTO;
    /* 先画纯黑底，照片到后再覆盖，避免未加载时透明 */
    x.fillStyle = "#0a0a0a";
    x.fillRect(0, 0, 1024, 1024);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /* 确定性随机：每次打开布局一致，不闪烁跳变 */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = rng(20261014);

  var group = new THREE.Group();
  scene.add(group);
  var records = [];
  var texLoader = new THREE.TextureLoader();
  texLoader.setCrossOrigin("anonymous");

  items.forEach(function (item, i) {
    var rec = new THREE.Group();
    /* 唱片本体：薄圆柱，盘面朝 +Z，自转绕盘面法线 */
    var tex = makeVinylTexture(item, LABELS[i % LABELS.length]);
    var sideMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 });
    var topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0.15 });
    var botMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 });
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.06, 64), [sideMat, topMat, botMat]);
    disc.rotation.x = Math.PI / 2;
    rec.add(disc);
    /* 浮动预览图：文章封面，加载失败时隐藏 */
    if (item.image) {
      var thumbGroup = new THREE.Group();
      var backMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
      var back = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.81), backMat);
      thumbGroup.add(back);
      var thumbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      var thumb = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), thumbMat);
      thumb.position.z = 0.01;
      thumbGroup.add(thumb);
      texLoader.load(item.image, function (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        thumbMat.map = t;
        thumbMat.needsUpdate = true;
      }, undefined, function () { thumbGroup.visible = false; });
      thumbGroup.position.set(0, -0.35, 0.95);
      thumbGroup.rotation.set(0, -0.08, 0.02);
      rec.add(thumbGroup);
    }
    /* 散落布局：位置、角度、大小都错开，像漂浮的一堆实物 */
    var angle = (i / items.length) * Math.PI * 2;
    var rr = 3.6 + rnd() * 2.0;
    var ang = angle + (rnd() - 0.5) * 0.5;
    var baseY = (rnd() - 0.5) * 2.4;
    rec.position.set(Math.sin(ang) * rr, baseY, Math.cos(ang) * rr);
    rec.rotation.y = ang + (rnd() - 0.5) * 0.8;
    rec.rotation.x = (rnd() - 0.5) * 0.9;
    rec.rotation.z = (rnd() - 0.5) * 0.8;
    rec.scale.setScalar(0.85 + rnd() * 0.35);
    rec.userData.url = item.url;
    rec.userData.baseY = baseY;
    rec.userData.phase = i * 1.3;
    rec.userData.index = i;
    rec.userData.title = item.title;
    rec.userData.disc = disc;
    rec.userData.spinSpeed = (0.2 + rnd() * 0.3) * (rnd() > 0.5 ? 1 : -1);
    group.add(rec);
    records.push(rec);
  });

  /* 尺寸 */
  function resize() {
    var w = stage.clientWidth || 1;
    var h = stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  /* 拖动旋转（带惯性）+ 点击进入文章 */
  var dragging = false, moved = 0, lastX = 0, lastY = 0, velX = 0, velY = 0;
  var downX = 0, downY = 0, downT = 0, hovering = false, hoverCheck = false;
  var el = renderer.domElement;
  el.addEventListener("pointerdown", function (e) {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    downX = e.clientX; downY = e.clientY; downT = Date.now();
    velX = 0; velY = 0;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = "grabbing";
  });
  el.addEventListener("pointermove", function (e) {
    if (dragging) {
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      group.rotation.y += dx * 0.008;
      group.rotation.x += dy * 0.004;
      group.rotation.x = Math.max(-0.5, Math.min(0.5, group.rotation.x));
      velX = dx * 0.008; velY = dy * 0.004;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX; lastY = e.clientY;
    } else {
      hoverCheck = true;
    }
  });
  function pick(cx, cy) {
    var r = el.getBoundingClientRect();
    var nx = ((cx - r.left) / r.width) * 2 - 1;
    var ny = -((cy - r.top) / r.height) * 2 + 1;
    var ray = new THREE.Raycaster();
    ray.setFromCamera({ x: nx, y: ny }, camera);
    var hits = ray.intersectObjects(records, true);
    if (!hits.length) return null;
    var o = hits[0].object;
    while (o && !o.userData.url) o = o.parent;
    return o;
  }
  el.addEventListener("pointerup", function (e) {
    dragging = false;
    el.style.cursor = "grab";
    if (moved < 8 && Date.now() - downT < 400) {
      var hit = pick(e.clientX, e.clientY);
      if (hit && hit.userData.url) window.location.href = hit.userData.url;
    }
  });
  el.addEventListener("pointerenter", function () { hovering = true; });
  el.addEventListener("pointerleave", function () { hovering = false; });

  /* HUD：坐标读数 + 悬停唱片信息 */
  var hudCoords = document.getElementById("hudCoords");
  var hudTape = document.getElementById("hudTape");
  function pad3(n) { n = Math.max(0, Math.round(n)); return ("000" + n).slice(-3); }
  el.addEventListener("pointermove", function (e) {
    if (hudCoords) {
      var r = el.getBoundingClientRect();
      hudCoords.textContent = "x: " + pad3(e.clientX - r.left) + " y: " + pad3(e.clientY - r.top);
    }
  });

  /* 渲染循环：自转 + 缓浮动 + 镜头漂移 + 无人操作 3 秒后恢复自转 */
  var clock = new THREE.Clock();
  var lastInteract = Date.now();
  var lastMove = 0;
  var running = true;
  var lastVisible = true;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    var now = Date.now();
    var dt = Math.min(clock.getDelta(), 0.05);
    if (now - lastInteract > 3000 && !dragging && !hovering) {
      group.rotation.y += 0.0012;
    }
    if (Math.abs(velX) > 0.0001 || Math.abs(velY) > 0.0001) {
      group.rotation.y += velX;
      group.rotation.x += velY;
      velX *= 0.94; velY *= 0.94;
    }
    records.forEach(function (rec) {
      rec.position.y = rec.userData.baseY + Math.sin(now * 0.0006 + rec.userData.phase) * 0.08;
      if (rec.userData.disc) rec.userData.disc.rotation.y += rec.userData.spinSpeed * dt;
    });
    camera.position.x = Math.sin(now * 0.00008) * 0.35;
    camera.position.y = 0.7 + Math.sin(now * 0.00011 + 1) * 0.18;
    camera.lookAt(0, 0, 0);
    if (hoverCheck && !dragging) {
      hoverCheck = false;
      var hit = pick(lastMoveX, lastMoveY);
      el.style.cursor = hit ? "pointer" : "grab";
      if (hudTape) {
        hudTape.textContent = hit && hit.userData.title
          ? "VINYL 0" + (hit.userData.index + 1) + " — " + hit.userData.title
          : "VINYL — / —";
      }
    }
    renderer.render(scene, camera);
  }
  var lastMoveX = 0, lastMoveY = 0;
  el.addEventListener("pointermove", function (e) { lastMoveX = e.clientX; lastMoveY = e.clientY; lastInteract = Date.now(); });
  el.addEventListener("pointerdown", function () { lastInteract = Date.now(); });
  el.addEventListener("wheel", function () { lastInteract = Date.now(); }, { passive: true });

  /* 离屏暂停 */
  new IntersectionObserver(function (entries) {
    var vis = entries[0].isIntersecting;
    if (vis && !lastVisible) { lastVisible = true; clock.getDelta(); }
    lastVisible = vis;
    running = vis;
    if (vis) frame();
  }).observe(stage);

  /* 成功初始化后显示画布，隐藏回退图 */
  stage.hidden = false;
  if (fallback) fallback.hidden = true;
  if (hint) hint.hidden = false;
  frame();
})();
