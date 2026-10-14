/* 首页 hero：密集黑胶场 — 原版式 3D 取景器：黑胶挤满画面 + 悬停出图 + 落针飞入 + 声音 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

(function () {
  var dataEl = document.getElementById("tapeData");
  var stage = document.getElementById("vinylStage");
  var fallback = document.getElementById("vinylFallback");
  var hint = document.getElementById("vinylHint");
  var coordEl = document.getElementById("vinylCoord");
  var tapeEl = document.getElementById("vinylTape");
  var guideX = document.getElementById("vinylGuideX");
  var guideY = document.getElementById("vinylGuideY");
  if (!dataEl || !stage) return;
  var items;
  try { items = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!items || !items.length) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* 声音：Web Audio 实时合成，无音频文件。落针“嗒” + 悬停底噪，可关 */
  var soundBtn = document.getElementById("vinylSound");
  var soundOn = true;
  try { soundOn = localStorage.getItem("hiphop-vinyl-sound") !== "off"; } catch (e) {}
  var audioCtx = null;
  function ensureAudio() {
    if (!soundOn) return null;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }
  function thock() {
    var ctx = ensureAudio();
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.15);
  }
  function crackle() {
    var ctx = ensureAudio();
    if (!ctx) return;
    var t = ctx.currentTime;
    var len = Math.floor(ctx.sampleRate * 0.12);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = "bandpass"; filt.frequency.value = 3500; filt.Q.value = 0.8;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.02, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(filt).connect(gain).connect(ctx.destination);
    src.start(t); src.stop(t + 0.12);
  }
  if (soundBtn) {
    soundBtn.textContent = "SOUND: " + (soundOn ? "ON" : "OFF");
    soundBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      soundOn = !soundOn;
      try { localStorage.setItem("hiphop-vinyl-sound", soundOn ? "on" : "off"); } catch (err) {}
      soundBtn.textContent = "SOUND: " + (soundOn ? "ON" : "OFF");
      if (soundOn) { ensureAudio(); thock(); }
    });
  }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  stage.appendChild(renderer.domElement);
  var el = renderer.domElement;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.3, 6.8);
  camera.lookAt(0, 0, 0);

  /* 环境反射：清漆面才有真实反光 */
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  /* 灯光：弱环境 + 亮主光（边缘高光）+ 正面补光 + 冷轮廓光 */
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  var key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(5, 6, 7);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(0, 0, 8);
  scene.add(fill);
  var rim = new THREE.DirectionalLight(0x88aaff, 1.5);
  rim.position.set(-6, 2, -6);
  scene.add(rim);

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

  /* 盘面贴图：纯 Canvas 绘制（黑胶纹路 + 彩色中标），无外部图片依赖 */
  function makeVinylTexture(item, label) {
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 1024;
    var x = c.getContext("2d");
    x.fillStyle = "#0a0a0a";
    x.fillRect(0, 0, 1024, 1024);
    for (var r = 195; r <= 505; r += 3) {
      x.strokeStyle = "rgba(255,255,255," + (0.04 + (r % 15 === 0 ? 0.05 : 0)) + ")";
      x.lineWidth = 1;
      x.beginPath(); x.arc(512, 512, r, 0, Math.PI * 2); x.stroke();
    }
    x.fillStyle = label.bg;
    x.beginPath(); x.arc(512, 512, 185, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "rgba(0,0,0,0.3)"; x.lineWidth = 2;
    x.beginPath(); x.arc(512, 512, 185, 0, Math.PI * 2); x.stroke();
    x.fillStyle = label.fg;
    x.textAlign = "center";
    x.font = "600 28px sans-serif";
    x.fillText(item.col, 512, 395);
    x.font = "700 44px 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
    var lines = wrapTitle(x, item.title, 300, 2);
    lines.forEach(function (ln, i) { x.fillText(ln, 512, 495 + i * 52); });
    x.font = "600 22px sans-serif";
    x.fillText("SIDE A · HIPHOPNOTE", 512, 630);
    x.fillStyle = "#111111";
    x.beginPath(); x.arc(512, 512, 7, 0, Math.PI * 2); x.fill();
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /* 密集排布：手调固定位置，挤满画面、互相遮挡、每张都带倾斜，没有正对镜头的盘子 */
  var LAYOUT = [
    { x: -3.3, y: 1.35, z: 0.2, rx: 0.35, ry: 0.4, rz: -0.25, s: 1.05 },
    { x: -1.15, y: 1.55, z: -0.6, rx: -0.3, ry: 1.1, rz: 0.3, s: 0.95 },
    { x: 1.15, y: 1.35, z: 0.6, rx: 0.45, ry: -0.5, rz: 0.2, s: 1.05 },
    { x: 3.3, y: 1.05, z: -0.3, rx: -0.4, ry: 0.9, rz: -0.35, s: 0.95 },
    { x: -3.5, y: -1.15, z: -0.4, rx: 0.3, ry: -0.8, rz: 0.35, s: 1.0 },
    { x: -1.0, y: -1.35, z: 0.9, rx: -0.45, ry: 0.3, rz: -0.2, s: 1.1 },
    { x: 1.35, y: -1.25, z: -0.7, rx: 0.4, ry: 1.4, rz: 0.25, s: 0.95 },
    { x: 3.5, y: -1.45, z: 0.3, rx: -0.35, ry: -0.6, rz: -0.3, s: 1.0 }
  ];

  var group = new THREE.Group();
  scene.add(group);
  var records = [];
  var texLoader = new THREE.TextureLoader();
  texLoader.setCrossOrigin("anonymous");

  items.forEach(function (item, i) {
    var L = LAYOUT[i % LAYOUT.length];
    var rec = new THREE.Group();
    var tex = makeVinylTexture(item, LABELS[i % LABELS.length]);
    var faceMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.28, envMapIntensity: 1 });
    var sideMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.35 });
    var botMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 64), [sideMat, faceMat, botMat]);
    disc.rotation.x = Math.PI / 2;
    rec.add(disc);
    /* 悬停选中圈（黄） */
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.018, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0 })
    );
    ring.position.z = 0.06;
    rec.add(ring);
    /* 悬停预览图：默认隐藏，悬停才出现（原版的交互） */
    var preview = null;
    if (item.image) {
      var pg = new THREE.Group();
      var backMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 });
      var back = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.07), backMat);
      pg.add(back);
      var pm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
      var pim = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 0.99), pm);
      pim.position.z = 0.01;
      pg.add(pim);
      pg.position.set(1.05, 0.8, 1.3);
      pg.rotation.set(0, -0.15, 0.05);
      pg.visible = false;
      rec.add(pg);
      texLoader.load(item.image, function (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        pm.map = t;
        pm.needsUpdate = true;
      }, undefined, function () { pg.userData.failed = true; });
      preview = { group: pg, mats: [backMat, pm] };
    }
    rec.position.set(L.x, L.y, L.z);
    rec.rotation.set(L.rx, L.ry, L.rz);
    rec.scale.setScalar(L.s);
    rec.userData = {
      url: item.url, title: item.title, index: i,
      baseY: L.y, phase: i * 1.3,
      spin: (0.15 + (i % 3) * 0.08) * (i % 2 ? 1 : -1),
      disc: disc, ring: ring, preview: preview,
      ringOp: 0, prevOp: 0
    };
    group.add(rec);
    records.push(rec);
  });

  function resize() {
    var w = stage.clientWidth || 1;
    var h = stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = (w / h < 1) ? 10 : 6.8;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  function pad3(n) { n = Math.max(0, Math.round(n)); return ("000" + n).slice(-3); }

  var selected = null;
  function setSelected(rec) {
    if (selected === rec) return;
    selected = rec;
    if (rec) crackle();
    if (tapeEl) {
      tapeEl.textContent = rec
        ? "VINYL 0" + (rec.userData.index + 1) + " — " + rec.userData.title
        : "VINYL — / —";
    }
    el.style.cursor = rec ? "pointer" : "grab";
  }

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

  function updateHud(e) {
    var r = el.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    if (coordEl) coordEl.textContent = "x: " + pad3(mx) + " y: " + pad3(my);
    if (guideX) { guideX.style.display = "block"; guideX.style.left = mx + "px"; }
    if (guideY) { guideY.style.display = "block"; guideY.style.top = my + "px"; }
  }

  /* 落针：镜头飞进唱片 + 转速拉起，约 500ms 后进入文章（超时兜底保证跳转） */
  var diving = null;
  function diveTo(rec) {
    if (diving) return;
    thock();
    group.updateMatrixWorld();
    var wp = group.localToWorld(rec.position.clone());
    diving = {
      rec: rec, url: rec.userData.url, t0: Date.now(),
      from: camera.position.clone(),
      to: new THREE.Vector3(wp.x, wp.y, wp.z + 1.4)
    };
    setTimeout(function () { window.location.href = (diving && diving.url) || rec.userData.url; }, 500);
  }

  var canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
  var dragging = false, moved = 0, lastX = 0, velX = 0;
  var downX = 0, downY = 0, downT = 0;
  var lastInteract = Date.now();

  el.addEventListener("pointerdown", function (e) {
    dragging = true; moved = 0; lastX = e.clientX;
    downX = e.clientX; downY = e.clientY; downT = Date.now(); velX = 0;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    el.style.cursor = "grabbing";
  });
  el.addEventListener("pointermove", function (e) {
    lastInteract = Date.now();
    if (dragging) {
      var dx = e.clientX - lastX;
      group.rotation.y += dx * 0.008;
      velX = dx * 0.008;
      moved += Math.abs(dx);
      lastX = e.clientX;
    } else if (canHover) {
      setSelected(pick(e.clientX, e.clientY));
      updateHud(e);
    }
  });
  el.addEventListener("pointerup", function (e) {
    dragging = false;
    el.style.cursor = "grab";
    if (moved < 8 && Date.now() - downT < 400) {
      var hit = pick(e.clientX, e.clientY);
      if (hit && hit.userData.url) {
        if (canHover) { diveTo(hit); }
        else if (selected === hit) { diveTo(hit); }
        else { setSelected(hit); }
      } else if (!canHover) { setSelected(null); }
    }
  });
  el.addEventListener("pointerleave", function () { if (canHover) setSelected(null); });
  el.addEventListener("wheel", function () { lastInteract = Date.now(); }, { passive: true });

  var clock = new THREE.Clock();
  var running = true, lastVisible = true;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    var now = Date.now();
    var dt = Math.min(clock.getDelta(), 0.05);
    if (now - lastInteract > 3000 && !dragging && !selected) group.rotation.y += 0.0009;
    if (Math.abs(velX) > 0.0001) { group.rotation.y += velX; velX *= 0.94; }
    records.forEach(function (rec) {
      var u = rec.userData;
      var target = (rec === selected) ? 1 : 0;
      u.ringOp += (target - u.ringOp) * 0.15;
      u.ring.material.opacity = u.ringOp * 0.95;
      if (u.preview && !u.preview.group.userData.failed) {
        u.prevOp += (target - u.prevOp) * 0.12;
        u.preview.mats.forEach(function (m) { m.opacity = u.prevOp; });
        u.preview.group.visible = u.prevOp > 0.02;
      }
      rec.position.y = u.baseY + Math.sin(now * 0.0005 + u.phase) * 0.06;
      u.disc.rotation.y += u.spin * dt;
    });
    if (diving) {
      var k = Math.min(1, (now - diving.t0) / 450);
      var ease = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(diving.from, diving.to, ease);
      diving.rec.userData.disc.rotation.y += 3.5 * dt;
      group.updateMatrixWorld();
      camera.lookAt(diving.rec.position.clone().applyMatrix4(group.matrixWorld));
    } else {
      camera.position.x = Math.sin(now * 0.00008) * 0.25;
      camera.position.y = 0.3 + Math.sin(now * 0.00011 + 1) * 0.12;
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
  }

  new IntersectionObserver(function (entries) {
    var vis = entries[0].isIntersecting;
    if (vis && !lastVisible) { lastVisible = true; clock.getDelta(); }
    lastVisible = vis;
    running = vis;
    if (vis) frame();
  }).observe(stage);

  if (fallback) fallback.hidden = true;
  if (hint) hint.hidden = false;
  frame();
})();
