/* 彩蛋 3D 化身：低多边形小人（脏辫 + 黑夹克 + 黄 T + 宽松裤 + 白鞋），先线框幽灵再变实体，像原版一样。
   懒加载：只在第一次触发时才动态 import three，不拖首页。 */
(function () {
  var wrap = null, renderer = null, scene = null, camera = null;
  var rig = null, ghost = null, solid = null, armR = null, armRElbow = null, armL = null, head = null;
  var ghostMat = null, solidMats = [];
  var raf = 0, running = false, started = false, fading = false, fadeT0 = 0;
  var targetRotY = 0;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clockStart = 0;

  /* 精修版：按原版那种 polished 低多边形做——圆角、自然比例、两段式手臂、脏辫顺重力下垂、待机跳舞 */
  function buildAvatar(THREE, RBG) {
    function mat(color) {
      return new THREE.MeshStandardMaterial({ color: color, roughness: 0.85, metalness: 0, flatShading: true, transparent: true });
    }
    var skin = mat(0xe6b98c), black = mat(0x141414), yellow = mat(0xffe600), pants = mat(0x2b2b2b), white = mat(0xf5f5f5), sole = mat(0x9a9a9a);
    var mats = [skin, black, yellow, pants, white, sole];
    var g = new THREE.Group();
    function box(m, w, h, d, x, y, z, parent, r) {
      var geo = (RBG && r) ? new RBG(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
      var ms = new THREE.Mesh(geo, m);
      ms.position.set(x, y, z);
      (parent || g).add(ms);
      return ms;
    }
    function cyl(m, rTop, rBot, len, x, y, z, parent) {
      var ms = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 8), m);
      ms.position.set(x, y, z);
      (parent || g).add(ms);
      return ms;
    }
    /* 腿 + 鞋（宽松裤 + 白鞋 + 灰厚底） */
    box(pants, 0.3, 0.72, 0.32, -0.18, -0.72, 0, null, 0.04);
    box(pants, 0.3, 0.72, 0.32, 0.18, -0.72, 0, null, 0.04);
    box(white, 0.32, 0.14, 0.58, -0.18, -1.12, 0.06, null, 0.03);
    box(white, 0.32, 0.14, 0.58, 0.18, -1.12, 0.06, null, 0.03);
    box(sole, 0.34, 0.05, 0.62, -0.18, -1.21, 0.06);
    box(sole, 0.34, 0.05, 0.62, 0.18, -1.21, 0.06);
    /* 夹克 + 黄 T + 领口 */
    box(black, 0.86, 0.78, 0.5, 0, 0.08, 0, null, 0.06);
    box(yellow, 0.4, 0.44, 0.06, 0, 0.08, 0.26);
    var collarL = box(black, 0.14, 0.18, 0.03, -0.11, 0.46, 0.25);
    collarL.rotation.z = 0.4;
    var collarR = box(black, 0.14, 0.18, 0.03, 0.11, 0.46, 0.25);
    collarR.rotation.z = -0.4;
    /* 脖子 */
    box(skin, 0.18, 0.1, 0.18, 0, 0.52, 0);
    /* 头（圆角）+ 脸 */
    var headG = new THREE.Group();
    headG.position.set(0, 0.92, 0);
    box(skin, 0.56, 0.55, 0.5, 0, 0, 0, headG, 0.08);
    var eyeGeo = new THREE.BoxGeometry(0.06, 0.08, 0.02);
    var eyeL = new THREE.Mesh(eyeGeo, black); eyeL.position.set(-0.12, 0.02, 0.26); headG.add(eyeL);
    var eyeR = new THREE.Mesh(eyeGeo, black); eyeR.position.set(0.12, 0.02, 0.26); headG.add(eyeR);
    box(black, 0.15, 0.025, 0.02, 0, -0.12, 0.26, headG);
    g.add(headG);
    /* 脏辫：细、垂、长短不一，顺着重力往下挂，不往外杈 */
    var lockGeo = new THREE.CylinderGeometry(0.045, 0.035, 1.0, 6);
    var locks = [
      [-0.3, 1.18, 0.02, 0.06, 0, 0.95],
      [0.3, 1.18, 0.02, -0.06, 0, 0.9],
      [-0.24, 1.16, 0.26, 0.04, 0.06, 0.8],
      [0.24, 1.16, 0.26, -0.04, -0.06, 0.85],
      [-0.16, 1.2, -0.26, 0, 0.08, 1.0],
      [0.16, 1.2, -0.26, 0, -0.08, 0.95],
      [0, 1.2, -0.28, 0, -0.06, 0.85],
      [-0.32, 1.1, -0.12, 0.08, 0.05, 0.9],
      [0.32, 1.1, -0.12, -0.08, -0.05, 0.85],
      [-0.1, 1.22, 0.1, 0.02, 0.04, 0.55]
    ];
    locks.forEach(function (L) {
      var m = new THREE.Mesh(lockGeo, black);
      m.scale.y = L[5];
      m.position.set(L[0], L[1] - L[5] / 2, L[2]);
      m.rotation.set(L[4] || 0, 0, L[3] || 0);
      g.add(m);
    });
    /* 手臂：两段式，左臂自然下垂微屈，右臂举起打招呼 */
    function arm(side, shoulderRotZ, elbowRotZ) {
      var sh = new THREE.Group();
      sh.position.set(0.5 * side, 0.4, 0);
      sh.rotation.z = shoulderRotZ;
      cyl(black, 0.09, 0.085, 0.4, 0, -0.2, 0, sh);
      var el = new THREE.Group();
      el.position.set(0, -0.4, 0);
      el.rotation.z = elbowRotZ;
      cyl(black, 0.085, 0.08, 0.38, 0, -0.19, 0, el);
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), skin);
      hand.position.set(0, -0.42, 0);
      el.add(hand);
      sh.add(el);
      g.add(sh);
      return { shoulder: sh, elbow: el };
    }
    var aL = arm(-1, -0.15, 0.3);
    var aR = arm(1, 2.6, 0.5);
    return { group: g, mats: mats, armR: aR.shoulder, armRElbow: aR.elbow, armL: aL.shoulder, head: headG };
  }

  function toWireframe(THREE, group) {
      var m = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
    group.traverse(function (o) { if (o.isMesh) o.material = m; });
    return m;
  }

  function startFade() {
    fading = true;
    fadeT0 = performance.now();
    solidMats.forEach(function (m) { m.opacity = 0; });
    solid.visible = true;
    ghost.visible = true;
    if (ghostMat) ghostMat.opacity = 0.5;
  }

  function init() {
    wrap = document.getElementById("eggCanvasWrap");
    if (!wrap) return;
    Promise.all([
      import("three"),
      import("three/addons/geometries/RoundedBoxGeometry.js").catch(function () { return null; })
    ]).then(function (mods) {
      var THREE = mods[0];
      var RBG = mods[1] ? mods[1].RoundedBoxGeometry : null;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(wrap.clientWidth || 340, wrap.clientHeight || 420, false);
      wrap.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(35, (wrap.clientWidth || 340) / (wrap.clientHeight || 420), 0.1, 100);
      camera.position.set(0, -0.1, 4.8);
      camera.lookAt(0, -0.1, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      var dir = new THREE.DirectionalLight(0xffffff, 1.2);
      dir.position.set(2, 3, 4);
      scene.add(dir);
      rig = new THREE.Group();
      rig.scale.setScalar(1.1);
      scene.add(rig);
      var built = buildAvatar(THREE, RBG);
      solid = built.group;
      solidMats = built.mats;
      armR = built.armR;
      armRElbow = built.armRElbow;
      armL = built.armL;
      head = built.head;
      solidMats.forEach(function (m) { m.opacity = 0; });
      solid.visible = false;
      rig.add(solid);
      var builtGhost = buildAvatar(THREE, RBG);
      ghost = builtGhost.group;
      ghostMat = toWireframe(THREE, ghost);
      rig.add(ghost);
      started = true;
      if (running) startFade();
      if (running && !raf) loop();
    }).catch(function () { /* 3D 失败则只显示气泡，不挡彩蛋 */ });
  }

  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    var t = (performance.now() - clockStart) / 1000;
    if (fading) {
      var k = Math.min(1, (performance.now() - fadeT0) / 500);
      solidMats.forEach(function (m) { m.opacity = k; });
      if (ghostMat) ghostMat.opacity = 0.35 * (1 - k);
      if (k >= 1) { fading = false; ghost.visible = false; }
    }
    if (!reduceMotion) {
      /* 待机跳舞：重心左右移 + 点头 + 右臂挥手 + 左臂微摆 */
      rig.position.y = Math.sin(t * 2.4) * 0.03;
      rig.position.x = Math.sin(t * 1.2) * 0.05;
      rig.rotation.z = Math.sin(t * 1.2) * 0.04;
      if (armR) armR.rotation.z = 2.6 + Math.sin(t * 2.2) * 0.22;
      if (armRElbow) armRElbow.rotation.z = 0.5 + Math.sin(t * 2.2 + 0.6) * 0.15;
      if (armL) armL.rotation.z = -0.15 + Math.sin(t * 1.2) * 0.06;
      if (head) { head.rotation.z = Math.sin(t * 1.2 + 0.5) * 0.05; head.rotation.x = Math.sin(t * 2.4) * 0.03; }
      rig.rotation.y += (targetRotY - rig.rotation.y) * 0.06;
    }
    renderer.render(scene, camera);
  }

  window.addEventListener("pointermove", function (e) {
    targetRotY = (e.clientX / window.innerWidth - 0.5) * 0.6;
  });
  window.addEventListener("resize", function () {
    if (!renderer || !wrap) return;
    var w = wrap.clientWidth || 340, h = wrap.clientHeight || 420;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  window.HipHopEgg = {
    show: function () {
      running = true;
      clockStart = performance.now();
      if (!started) { init(); return; }
      /* 每次弹出都重播一次线框幽灵 → 实体 */
      startFade();
      if (!raf) loop();
    },
    hide: function () {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
  };
})();
