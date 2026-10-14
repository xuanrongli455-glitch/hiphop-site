/* 鼠标流体：按 Luis Bizarro（路易斯·比比罗斯）的思路——鼠标不再是小圆点，而是搅动一团流体。
   做法：WebGL 简化流体模拟——splat 注入速度 + 染料、半拉格朗日平流、耗散；无压力投影，稳定且便宜。
   染料为白色（配 all-black opium + VVS 银白），仅精确指针设备 + 非减动效偏好时启用。 */
(function () {
  if (!window.matchMedia) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'mouseFluid';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998;mix-blend-mode:screen;';
  document.body.appendChild(canvas);

  var gl = null;
  try {
    gl = canvas.getContext('webgl', { alpha: true, depth: false, stencil: false, antialias: false, powerPreference: 'low-power' }) ||
         canvas.getContext('experimental-webgl', { alpha: true, depth: false, stencil: false, antialias: false });
  } catch (e) { gl = null; }
  if (!gl) { canvas.remove(); return; }

  var VERT = 'attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*0.5+0.5;gl_Position=vec4(aPosition,0.0,1.0);}';
  var SPLAT_FRAG = 'precision highp float;varying vec2 vUv;uniform sampler2D uTarget;uniform vec2 uPoint;uniform float uRadius;uniform float uAspect;uniform vec4 uAdd;void main(){vec2 p=vUv-uPoint;p.x*=uAspect;float d=length(p);float f=exp(-d*d/(uRadius*uRadius));gl_FragColor=texture2D(uTarget,vUv)+uAdd*f;}';
  var ADVECT_FRAG = 'precision highp float;varying vec2 vUv;uniform sampler2D uVelocity;uniform sampler2D uSource;uniform float uDt;uniform float uDissipation;uniform float uIsVelocity;void main(){vec2 vel=(texture2D(uVelocity,vUv).xy-0.5)*10.0;vec2 coord=vUv-vel*uDt;vec4 r=texture2D(uSource,coord);if(uIsVelocity>0.5){r.rgb=mix(vec3(0.5),r.rgb,uDissipation);r.a=1.0;}else{r*=uDissipation;}gl_FragColor=r;}';
  var DISPLAY_FRAG = 'precision highp float;varying vec2 vUv;uniform sampler2D uDye;void main(){vec4 dye=texture2D(uDye,vUv);float a=clamp(dye.a,0.0,1.0)*0.55;gl_FragColor=vec4(dye.rgb*a,a);}';

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  }
  function program(fragSrc) {
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  }

  var splatProg = program(SPLAT_FRAG);
  var advectProg = program(ADVECT_FRAG);
  var displayProg = program(DISPLAY_FRAG);
  if (!splatProg || !advectProg || !displayProg) { canvas.remove(); return; }

  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  function bindQuad(prog) {
    var loc = gl.getAttribLocation(prog, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }
  function uni(prog, name) { return gl.getUniformLocation(prog, name); }

  function createFBO(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: tex, fbo: fbo, w: w, h: h };
  }

  var vel = { read: null, write: null };
  var dye = { read: null, write: null };
  var simW = 0, simH = 0, aspect = 1;

  function resize() {
    var w = Math.max(96, Math.min(180, Math.floor(window.innerWidth / 8)));
    var h = Math.max(48, Math.floor(w * window.innerHeight / Math.max(1, window.innerWidth)));
    if (w === simW && h === simH) return;
    simW = w; simH = h; aspect = w / h;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    vel.read = createFBO(w, h); vel.write = createFBO(w, h);
    dye.read = createFBO(w, h); dye.write = createFBO(w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, vel.read.fbo);
    gl.clearColor(0.5, 0.5, 0.5, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, vel.write.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dye.read.fbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dye.write.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  resize();

  function swap(f) { var t = f.read; f.read = f.write; f.write = t; }

  function blit(target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : canvas.width, target ? target.h : canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function splat(f, x, y, add, radius) {
    gl.useProgram(splatProg);
    bindQuad(splatProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, f.read.tex);
    gl.uniform1i(uni(splatProg, 'uTarget'), 0);
    gl.uniform2f(uni(splatProg, 'uPoint'), x, y);
    gl.uniform1f(uni(splatProg, 'uRadius'), radius);
    gl.uniform1f(uni(splatProg, 'uAspect'), aspect);
    gl.uniform4f(uni(splatProg, 'uAdd'), add[0], add[1], add[2], add[3]);
    blit(f.write);
    swap(f);
  }

  function advect(f, isVelocity, dissipation) {
    gl.useProgram(advectProg);
    bindQuad(advectProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, vel.read.tex);
    gl.uniform1i(uni(advectProg, 'uVelocity'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, f.read.tex);
    gl.uniform1i(uni(advectProg, 'uSource'), 1);
    gl.uniform1f(uni(advectProg, 'uDt'), 1.0);
    gl.uniform1f(uni(advectProg, 'uDissipation'), dissipation);
    gl.uniform1f(uni(advectProg, 'uIsVelocity'), isVelocity ? 1 : 0);
    blit(f.write);
    swap(f);
  }

  function display() {
    gl.useProgram(displayProg);
    bindQuad(displayProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
    gl.uniform1i(uni(displayProg, 'uDye'), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    blit(null);
    gl.disable(gl.BLEND);
  }

  var lastX = -1, lastY = -1, hoverBoost = 1.0;

  function toUV(cx, cy) { return [cx / window.innerWidth, 1 - cy / window.innerHeight]; }

  document.addEventListener('mousemove', function (e) {
    var uv = toUV(e.clientX, e.clientY);
    if (lastX >= 0) {
      var dx = (e.clientX - lastX) / window.innerWidth;
      var dy = -(e.clientY - lastY) / window.innerHeight;
      if (Math.abs(dx) > 0.0002 || Math.abs(dy) > 0.0002) {
        var b = hoverBoost;
        splat(vel, uv[0], uv[1], [dx * 0.08 * b, dy * 0.08 * b, 0, 0], 0.012);
        splat(dye, uv[0], uv[1], [0.35 * b, 0.35 * b, 0.35 * b, 0.35 * b], 0.02);
      }
    }
    lastX = e.clientX; lastY = e.clientY;
  }, { passive: true });

  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var hot = !!t.closest('a, button, [role=button], .fchip, input, textarea, select');
    hoverBoost = hot ? 1.8 : 1.0;
    document.body.classList.toggle('cursor-text', !!t.closest('input, textarea, select'));
  }, { passive: true });

  /* 点按：爆开一团 */
  document.addEventListener('mousedown', function (e) {
    var uv = toUV(e.clientX, e.clientY);
    splat(dye, uv[0], uv[1], [0.9, 0.9, 0.9, 0.9], 0.05);
    splat(vel, uv[0], uv[1], [0.02, -0.02, 0, 0], 0.03);
  }, { passive: true });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  }, { passive: true });

  var rafId = null;
  function frame() {
    advect(vel, true, 0.86);
    advect(dye, false, 0.96);
    display();
    rafId = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (!rafId) {
      rafId = requestAnimationFrame(frame);
    }
  });
  rafId = requestAnimationFrame(frame);

  document.body.classList.add('fluid-cursor');
})();
