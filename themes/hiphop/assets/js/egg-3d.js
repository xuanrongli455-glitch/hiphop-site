/* 彩蛋 3D 化身：低多边形小人（脏辫 + 黑夹克 + 黄 T + 宽松裤 + 白鞋），先线框幽灵再变实体，像原版一样。
   懒加载：只在第一次触发时才动态 import three，不拖首页。 */
(function () {
  var wrap = null, renderer = null, scene = null, camera = null;
  var rig = null, ghost = null, solid = null, armR = null, head = null;
  var ghostMat = null, solidMats = [];
  var raf = 0, running = false, started = false, fading = false, fadeT0 = 0;
  var targetRotY = 0;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clockStart = 0;

  function buildAvatar(THREE) {
    function mat(color) {
      return new THREE.MeshStandardMaterial({ color: color, roughness: 0.85, metalness: 0, flatShading: true, transparent: true });
    }
    var skin = mat(0xe6b98c), black = mat(0x141414), yellow = mat(0xffe600), pants = mat(0x2b2b2b), white = mat(0xf5f5f5);
    var mats = [skin, black, yellow, pants, white];
    var g = new THREE.Group();
    function box(m, w, h, d, x, y, z, parent) {
      var ms = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      ms.position.set(x, y, z);
      (parent || g).add(ms);
      return ms;
    }
    /* 腿 + 鞋（宽松裤 + 白鞋） */
    box(pants, 0.34, 0.75, 0.36, -0.2, -0.75, 0);
    box(pants, 0.34, 0.75, 0.36, 0.2, -0.75, 0);
    box(white, 0.36, 0.16, 0.62, -0.2, -1.18, 0.08);
    box(white, 0.36, 0.16, 0.62, 0.2, -1.18, 0.08);
    /* 夹克 + 黄 T */
    box(black, 0.95, 0.85, 0.55, 0, 0.05, 0);
    box(yellow, 0.45, 0.5, 0.08, 0, 0.05, 0.29);
    /* 左臂下垂 */
    var armL = new THREE.Group();
    armL.position.set(-0.58, 0.32, 0);
    var armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 8), black);
    armLMesh.position.y = -0.35;
    armL.add(armLMesh);
    var handL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), skin);
    handL.position.y = -0.75;
    armL.add(handL);
    armL.rotation.z = 0.15;
    g.add(armL);
    /* 右臂举起打招呼（会摆动） */
    var armRG = new THREE.Group();
    armRG.position.set(0.58, 0.32, 0);
    var armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 8), black);
    armRMesh.position.y = 0.35;
    armRG.add(armRMesh);
    var handR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), skin);
    handR.position.y = 0.75;
    armRG.add(handR);
    armRG.rotation.z = -2.4;
    g.add(armRG);
    /* 头（方正低多边形）+ 脸 */
    var headG = new THREE.Group();
    headG.position.set(0, 0.75, 0);
    box(skin, 0.6, 0.55, 0.5, 0, 0, 0, headG);
    var eyeGeo = new THREE.BoxGeometry(0.07, 0.09, 0.02);
    var eyeL = new THREE.Mesh(eyeGeo, black); eyeL.position.set(-0.13, 0.03, 0.26); headG.add(eyeL);
    var eyeR = new THREE.Mesh(eyeGeo, black); eyeR.position.set(0.13, 0.03, 0.26); headG.add(eyeR);
    box(black, 0.18, 0.03, 0.02, 0, -0.13, 0.26, headG);
    g.add(headG);
    /* 脏辫：绕头一圈垂下 */
    var lockGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.6, 6);
    var locks = [
      [-0.28, 0.78, -0.1, 0.15, 0], [0.28, 0.78, -0.1, -0.15, 0],
      [-0.3, 0.72, 0.1, 0.25, 0.1], [0.3, 0.72, 0.1, -0.25, -0.1],
      [-0.15, 0.88, -0.2, 0, 0.2], [0.15, 0.88, -0.2, 0, -0.2],
      [-0.32, 0.62, 0.12, 0.35, 0], [0.32, 0.62, 0.12, -0.35, 0],
      [0, 0.92, -0.18, 0, -0.15], [-0.2, 0.9, 0.05, 0.1, 0.1]
    ];
    locks.forEach(function (L) {
      var m = new THREE.Mesh(lockGeo, black);
      m.position.set(L[0], L[1], L[2]);
      m.rotation.set(L[4] || 0, 0, L[3] || 0);
      g.add(m);
    });
    return { group: g, mats: mats, armR: armRG, head: headG };
  }

  function toWireframe(THREE, group) {
    var m = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 });
    group.traverse(function (o) { if (o.isMesh) o.material = m; });
    return m;
  }

  function init() {
    wrap = document.getElementById("eggCanvasWrap");
    if (!wrap) return;
    import("three").then(function (THREE) {
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
      scene.add(rig);
      var built = buildAvatar(THREE);
      solid = built.group;
      solidMats = built.mats;
      armR = built.armR;
      head = built.head;
      solidMats.forEach(function (m) { m.opacity = 0; });
      solid.visible = false;
      rig.add(solid);
      var builtGhost = buildAvatar(THREE);
      ghost = builtGhost.group;
      ghostMat = toWireframe(THREE, ghost);
      rig.add(ghost);
      started = true;
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
      rig.position.y = Math.sin(t * 1.6) * 0.05;
      if (armR) armR.rotation.z = -2.4 + Math.sin(t * 2.2) * 0.22;
      if (head) head.rotation.z = Math.sin(t * 0.9) * 0.06;
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
      fading = true;
      fadeT0 = performance.now();
      solidMats.forEach(function (m) { m.opacity = 0; });
      solid.visible = true;
      ghost.visible = true;
      if (ghostMat) ghostMat.opacity = 0.35;
      if (!raf) loop();
    },
    hide: function () {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
  };
})();
