/* 首页 = 全屏 3D 世界：整页就是唱片箱。拖动旋转、滚轮推进、悬停选中、点击落针 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

(function () {
  var dataEl = document.getElementById("tapeData");
  var stage = document.getElementById("worldStage");
  var fallback = document.getElementById("worldFallback");
  var hint = document.getElementById("worldHint");
  var tapeEl = document.getElementById("worldTape");
  var guideX = document.getElementById("worldGuideX");
  var guideY = document.getElementById("worldGuideY");
  if (!dataEl || !stage) return;
  var items;
  try { items = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!items || !items.length) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* 声音：Web Audio 实时合成，无音频文件。落针“嗒” + 悬停底噪，可关 */
  var soundBtn = document.getElementById("worldSound");
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
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
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

  /* 灯光：弱环境 + 亮主光（边缘高光）+ 正面补光 + 双轮廓光（黑盘在黑底上靠轮廓光显形） */
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  var key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(5, 6, 7);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(0, 0, 8);
  scene.add(fill);
  var rim = new THREE.DirectionalLight(0xffffff, 2.5);
  rim.position.set(-6, 2, -6);
  scene.add(rim);
  var rim2 = new THREE.DirectionalLight(0xffffff, 1.2);
  rim2.position.set(6, -3, -8);
  scene.add(rim2);

  /* 盘面贴图：黑胶画片盘——文章照片直接印在盘面上（cover 裁切铺满）+ 沟纹罩染保留黑胶质感 + 小中标。
     照片异步加载：先画程序化盘面，图片到了重画并 needsUpdate；加载失败则保留程序化版。 */
  function makeVinylTexture(item) {
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 1024;
    var x = c.getContext("2d");
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;

    function drawGrooves(alpha) {
      for (var r = 195; r <= 505; r += 3) {
        x.strokeStyle = "rgba(255,255,255," + ((0.1 + (r % 15 === 0 ? 0.08 : 0)) * alpha) + ")";
        x.lineWidth = 1;
        x.beginPath(); x.arc(512, 512, r, 0, Math.PI * 2); x.stroke();
      }
    }
    function drawBase() {
      /* 盘面径向提亮：中心近黑、边缘深灰，整张盘在黑底上有体量 */
      var grad = x.createRadialGradient(512, 512, 180, 512, 512, 512);
      grad.addColorStop(0, "#0c0c0c");
      grad.addColorStop(0.6, "#161616");
      grad.addColorStop(1, "#262626");
      x.fillStyle = grad;
      x.beginPath(); x.arc(512, 512, 512, 0, Math.PI * 2); x.fill();
    }
    function drawLabel() {
      x.fillStyle = "#f2f2f2";
      x.beginPath(); x.arc(512, 512, 120, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "rgba(0,0,0,0.3)"; x.lineWidth = 2;
      x.beginPath(); x.arc(512, 512, 120, 0, Math.PI * 2); x.stroke();
      x.fillStyle = "#0a0a0a";
      x.textAlign = "center";
      x.font = "600 30px sans-serif";
      x.fillText(item.col || "HIPHOP", 512, 508);
      x.font = "600 19px sans-serif";
      x.fillStyle = "#555555";
      x.fillText("SIDE A · HIPHOPNOTE", 512, 548);
      x.fillStyle = "#111111";
      x.beginPath(); x.arc(512, 512, 7, 0, Math.PI * 2); x.fill();
    }
    function drawPhoto(img) {
      var s = Math.max(1024 / img.width, 1024 / img.height);
      var dw = img.width * s, dh = img.height * s;
      x.save();
      x.beginPath(); x.arc(512, 512, 512, 0, Math.PI * 2); x.clip();
      x.drawImage(img, 512 - dw / 2, 512 - dh / 2, dw, dh);
      x.restore();
      /* 沟纹罩染：照片上保留黑胶纹路 */
      drawGrooves(0.45);
      /* 边缘压暗，盘边更利落 */
      var edge = x.createRadialGradient(512, 512, 380, 512, 512, 512);
      edge.addColorStop(0, "rgba(0,0,0,0)");
      edge.addColorStop(1, "rgba(0,0,0,0.5)");
      x.fillStyle = edge;
      x.beginPath(); x.arc(512, 512, 512, 0, Math.PI * 2); x.fill();
    }

    drawBase();
    drawGrooves(1);
    drawLabel();

    if (item.image) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        try {
          drawBase();
          drawPhoto(img);
          drawLabel();
          tex.needsUpdate = true;
        } catch (e) {}
      };
      img.src = item.image;
    }
    return tex;
  }

  /* 横屏排布：更宽更深，盘面冲出画框、互相遮挡，像原版那样挤满画面 */
  var LAYOUT_LANDSCAPE = [
    { x: -4.8, y: 2.0, z: -1.5, rx: 0.35, ry: 0.4, rz: -0.25, s: 1.1 },
    { x: -2.0, y: 1.4, z: 1.2, rx: -0.3, ry: 0.6, rz: 0.3, s: 1.0 },
    { x: 0.6, y: 2.2, z: -2.0, rx: 0.45, ry: -0.5, rz: 0.2, s: 1.1 },
    { x: 3.2, y: 1.2, z: 0.4, rx: -0.4, ry: 0.6, rz: -0.35, s: 1.0 },
    { x: -3.6, y: -1.4, z: 0.8, rx: 0.3, ry: -0.6, rz: 0.35, s: 1.05 },
    { x: -0.8, y: -2.2, z: -1.2, rx: -0.45, ry: 0.3, rz: -0.2, s: 1.15 },
    { x: 2.0, y: -1.6, z: 1.6, rx: 0.4, ry: 0.7, rz: 0.25, s: 1.0 },
    { x: 4.6, y: -2.0, z: -0.8, rx: -0.35, ry: -0.6, rz: -0.3, s: 1.05 }
  ];
  /* 竖屏排布：竖直一摞唱片，像伸手进箱子翻找；上下拖动平移 */
  var LAYOUT_PORTRAIT = [
    { x: 0.3, y: 3.8, z: 0.3, rx: 0.25, ry: 0.4, rz: -0.15, s: 1.0 },
    { x: -0.4, y: 2.7, z: -0.4, rx: -0.2, ry: -0.5, rz: 0.2, s: 0.95 },
    { x: 0.35, y: 1.6, z: 0.5, rx: 0.3, ry: 0.5, rz: -0.1, s: 1.0 },
    { x: -0.3, y: 0.5, z: -0.3, rx: -0.25, ry: -0.4, rz: 0.15, s: 1.05 },
    { x: 0.4, y: -0.6, z: 0.4, rx: 0.2, ry: 0.45, rz: -0.2, s: 0.95 },
    { x: -0.35, y: -1.7, z: -0.5, rx: -0.3, ry: -0.5, rz: 0.1, s: 1.0 },
    { x: 0.3, y: -2.8, z: 0.2, rx: 0.25, ry: 0.4, rz: -0.15, s: 1.0 },
    { x: -0.3, y: -3.9, z: -0.2, rx: -0.2, ry: -0.45, rz: 0.2, s: 0.95 }
  ];

  var group = new THREE.Group();
  scene.add(group);
  var records = [];

  items.forEach(function (item, i) {
    var rec = new THREE.Group();
    var tex = makeVinylTexture(item);
    /* 盘面：降低环境反射强度，避免洗成灰；清漆面保留黑胶光泽 */
    var faceMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.38, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.22, envMapIntensity: 0.7 });
    var sideMat = new THREE.MeshPhysicalMaterial({ color: 0x1e1e1e, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.35 });
    /* 背面也用盘面材质：翻过来的黑胶是 B 面，不是灰饼 */
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 64), [sideMat, faceMat, faceMat]);
    disc.rotation.x = Math.PI / 2;
    rec.add(disc);
    /* 悬停选中圈（电光黄） */
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.014, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0 })
    );
    ring.position.z = 0.06;
    rec.add(ring);
    /* 常亮细边环：暗黄色，黑盘在黑底上靠它显形（不受灯光影响） */
    var edge = new THREE.Mesh(
      new THREE.TorusGeometry(1.29, 0.01, 8, 72),
      new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.3 })
    );
    edge.position.z = 0.06;
    rec.add(edge);
    rec.userData = {
      url: item.url, title: item.title, index: i,
      baseY: 0, phase: i * 1.3,
      spin: (0.15 + (i % 3) * 0.08) * (i % 2 ? 1 : -1),
      disc: disc, ring: ring,
      ringOp: 0
    };
    group.add(rec);
    records.push(rec);
  });

  var isPortrait = false;
  function applyLayout() {
    var w = stage.clientWidth || 1;
    var h = stage.clientHeight || 1;
    isPortrait = (w / h) < 1;
    var L = isPortrait ? LAYOUT_PORTRAIT : LAYOUT_LANDSCAPE;
    records.forEach(function (rec, i) {
      var p = L[i % L.length];
      rec.position.set(p.x, p.y, p.z);
      rec.rotation.set(p.rx, p.ry, p.rz);
      rec.scale.setScalar(p.s);
      rec.userData.baseY = p.y;
    });
    /* 竖屏：整摞黑胶下移，顶部给巨字标题留白，避免唱片从字中间穿过 */
    group.position.y = isPortrait ? -1.6 : 0;
    group.rotation.x = 0;
  }

  function resize() {
    var w = stage.clientWidth || 1;
    var h = stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = isPortrait ? 8.5 : 6.2;
    camera.updateProjectionMatrix();
  }
  applyLayout();
  resize();
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { applyLayout(); resize(); }, 150);
  });

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
  /* 菜单 3D：顶栏跟随鼠标轻微倾斜，像浮在世界里的面板 */
  var headerEl = document.getElementById("siteHeader");
  var worldHeadEl = document.querySelector(".world-head");
  var lastZoom = 0;
  var tiltTX = 8, tiltTY = 0, tiltCX = 8, tiltCY = 0;
  window.addEventListener("pointermove", function (e) {
    var nx = e.clientX / window.innerWidth - 0.5;
    var ny = e.clientY / window.innerHeight - 0.5;
    tiltTX = 8 + ny * 4;
    tiltTY = nx * 6;
  });
  var dragging = false, moved = 0, lastX = 0, lastY = 0, velX = 0;
  var downX = 0, downY = 0, downT = 0;
  var lastInteract = Date.now();
  /* 双指捏合缩放（iPad/触屏）：两指开合映射到镜头 z，与滚轮同一范围 3.5-12 */
  var activePointers = {};
  var pinchDist = 0;
  var wasPinch = false;
  function trackPointer(e) { activePointers[e.pointerId] = { x: e.clientX, y: e.clientY }; }
  function untrackPointer(e) {
    delete activePointers[e.pointerId];
    if (Object.keys(activePointers).length < 2) pinchDist = 0;
  }
  function currentPinchDist() {
    var ks = Object.keys(activePointers);
    if (ks.length < 2) return 0;
    var a = activePointers[ks[0]], b = activePointers[ks[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  el.addEventListener("pointerdown", function (e) {
    trackPointer(e);
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    downX = e.clientX; downY = e.clientY; downT = Date.now(); velX = 0;
    if (Object.keys(activePointers).length === 2) {
      /* 第二指落下：切换为捏合缩放，停止旋转 */
      pinchDist = currentPinchDist();
      dragging = false;
    }
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    el.style.cursor = "grabbing";
  });
  el.addEventListener("pointermove", function (e) {
    lastInteract = Date.now();
    trackPointer(e);
    if (Object.keys(activePointers).length === 2) {
      /* 双指捏合：张开=推进，合拢=拉远 */
      var pd = currentPinchDist();
      if (pinchDist > 0 && pd > 0) {
        camera.position.z = Math.max(3.5, Math.min(12, camera.position.z * (pinchDist / pd)));
        lastZoom = lastInteract;
        wasPinch = true;
      }
      pinchDist = pd;
      return;
    }
    if (dragging) {
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      if (isPortrait && Math.abs(dy) > Math.abs(dx)) {
        /* 竖屏上下拖 = 在箱子里翻找 */
        group.position.y = Math.max(-3.5, Math.min(3.5, group.position.y + dy * 0.012));
      } else {
        group.rotation.y += dx * 0.008;
        group.rotation.x = Math.max(-0.5, Math.min(0.5, group.rotation.x + dy * 0.005));
        velX = dx * 0.008;
      }
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX; lastY = e.clientY;
    } else if (canHover) {
      setSelected(pick(e.clientX, e.clientY));
      updateHud(e);
    }
  });
  el.addEventListener("pointerup", function (e) {
    untrackPointer(e);
    dragging = false;
    el.style.cursor = "grab";
    if (wasPinch) {
      if (Object.keys(activePointers).length === 0) wasPinch = false;
      return;
    }
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
  el.addEventListener("pointercancel", function (e) {
    untrackPointer(e);
    dragging = false;
    wasPinch = false;
  });
  /* 滚轮 = 镜头在世界里推进/拉远 */
  el.addEventListener("wheel", function (e) {
    lastInteract = Date.now();
    lastZoom = lastInteract;
    e.preventDefault();
    camera.position.z = Math.max(3.5, Math.min(12, camera.position.z + e.deltaY * 0.005));
  }, { passive: false });

  var clock = new THREE.Clock();
  function frame() {
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
    if (headerEl) {
      tiltCX += (tiltTX - tiltCX) * 0.08;
      tiltCY += (tiltTY - tiltCY) * 0.08;
      headerEl.style.transform = "perspective(1200px) rotateX(" + tiltCX.toFixed(2) + "deg) rotateY(" + tiltCY.toFixed(2) + "deg)";
    }
    /* 探索时标题让路：拖动/滚轮/落针中淡出，停手恢复 */
    if (worldHeadEl) {
      worldHeadEl.classList.toggle("dim", dragging || (now - lastZoom < 1200) || !!diving);
    }
    renderer.render(scene, camera);
  }

  if (fallback) fallback.hidden = true;
  if (hint) hint.hidden = false;
  frame();
})();
