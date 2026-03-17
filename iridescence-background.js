// Iridescence Background - Vanilla JavaScript (WebGL)
// Uses a full-screen triangle with a fragment shader and reacts to theme CSS variables.

(function () {
  const vertexShaderSource = `
attribute vec2 position;
attribute vec2 uv;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const fragmentShaderSource = `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;

varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
  gl_FragColor = vec4(col, 1.0);
}
`;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(err || 'Shader compile failed');
    }
    return shader;
  }

  function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const err = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(err || 'Program link failed');
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return program;
  }

  function cssColorToRgb01(colorStr) {
    // Use canvas normalization to support hsl(), rgb(), hex, etc.
    const canvas = cssColorToRgb01._canvas || (cssColorToRgb01._canvas = document.createElement('canvas'));
    const ctx = canvas.getContext('2d');
    if (!ctx) return [1, 1, 1];

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillStyle = colorStr;
    const normalized = ctx.fillStyle;

    // normalized is usually like "rgb(r, g, b)" or "#rrggbb"
    if (normalized.startsWith('#')) {
      const hex = normalized.slice(1);
      const full = hex.length === 3
        ? hex.split('').map((c) => c + c).join('')
        : hex.padEnd(6, '0').slice(0, 6);
      const r = parseInt(full.slice(0, 2), 16) / 255;
      const g = parseInt(full.slice(2, 4), 16) / 255;
      const b = parseInt(full.slice(4, 6), 16) / 255;
      return [r, g, b];
    }

    const m = normalized.match(/rgba?\(([^)]+)\)/i);
    if (!m) return [1, 1, 1];
    const parts = m[1].split(',').map((p) => p.trim());
    const r = Math.max(0, Math.min(255, Number(parts[0]))) / 255;
    const g = Math.max(0, Math.min(255, Number(parts[1]))) / 255;
    const b = Math.max(0, Math.min(255, Number(parts[2]))) / 255;
    return [r, g, b];
  }

  function getThemeColor() {
    const root = document.documentElement;
    const styles = getComputedStyle(root);

    // Use primary color as the base. Fallback to foreground.
    const primary = styles.getPropertyValue('--primary')?.trim();
    const fg = styles.getPropertyValue('--foreground')?.trim();

    const colorStr = primary || fg || '#ffffff';
    return cssColorToRgb01(colorStr);
  }

  class IridescenceBackground {
    constructor(container, options = {}) {
      this.container = container;
      this.options = {
        speed: typeof options.speed === 'number' ? options.speed : 1.0,
        amplitude: typeof options.amplitude === 'number' ? options.amplitude : 0.1,
        mouseReact: options.mouseReact !== false,
        ...options
      };

      this.canvas = null;
      this.gl = null;
      this.program = null;
      this.attribs = null;
      this.uniforms = null;
      this.rafId = null;
      this.resizeObserver = null;
      this.mutationObserver = null;
      this.startTime = performance.now();
      this.mouse = { x: 0.5, y: 0.5 };

      this.init();
    }

    init() {
      if (!this.container) return;

      this.canvas = document.createElement('canvas');
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.display = 'block';

      this.container.appendChild(this.canvas);

      const gl = this.canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false
      });

      if (!gl) {
        console.error('WebGL not supported');
        return;
      }

      this.gl = gl;
      gl.clearColor(1, 1, 1, 1);

      this.program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
      gl.useProgram(this.program);

      // Fullscreen triangle positions + uvs
      const positions = new Float32Array([
        -1, -1,
        3, -1,
        -1, 3
      ]);

      const uvs = new Float32Array([
        0, 0,
        2, 0,
        0, 2
      ]);

      const posLoc = gl.getAttribLocation(this.program, 'position');
      const uvLoc = gl.getAttribLocation(this.program, 'uv');

      const posBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      const uvBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(uvLoc);
      gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

      this.uniforms = {
        uTime: gl.getUniformLocation(this.program, 'uTime'),
        uColor: gl.getUniformLocation(this.program, 'uColor'),
        uResolution: gl.getUniformLocation(this.program, 'uResolution'),
        uMouse: gl.getUniformLocation(this.program, 'uMouse'),
        uAmplitude: gl.getUniformLocation(this.program, 'uAmplitude'),
        uSpeed: gl.getUniformLocation(this.program, 'uSpeed')
      };

      this.lastFrameTime = 0;
      this.fpsLimit = 30;
      this.maxPixelRatio = 1.5;

      this.setStaticUniforms();
      this.updateThemeColor();
      this.setupResizeObserver();
      this.setupThemeObserver();

      if (this.options.mouseReact) {
        this.container.addEventListener('mousemove', this.handleMouseMove, { passive: true });
      }

      this.animate();
    }

    setStaticUniforms() {
      const gl = this.gl;
      if (!gl) return;
      gl.useProgram(this.program);

      if (this.uniforms.uAmplitude) gl.uniform1f(this.uniforms.uAmplitude, this.options.amplitude);
      if (this.uniforms.uSpeed) gl.uniform1f(this.uniforms.uSpeed, this.options.speed);
      if (this.uniforms.uMouse) gl.uniform2f(this.uniforms.uMouse, this.mouse.x, this.mouse.y);
    }

    updateThemeColor() {
      const gl = this.gl;
      if (!gl) return;
      gl.useProgram(this.program);

      const [r, g, b] = getThemeColor();
      if (this.uniforms.uColor) gl.uniform3f(this.uniforms.uColor, r, g, b);
    }

    setupThemeObserver() {
      // Observe changes that indicate theme update.
      this.mutationObserver = new MutationObserver(() => {
        this.updateThemeColor();
      });

      this.mutationObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'data-mode', 'class', 'style']
      });

      this.mutationObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }

    setupResizeObserver() {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this.resizeObserver.observe(this.container);
      this.resize();
    }

    resize() {
      const gl = this.gl;
      if (!gl || !this.canvas || !this.container) return;

      const rect = this.container.getBoundingClientRect();
      const dpr = Math.min(this.maxPixelRatio, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (this.canvas.width === width && this.canvas.height === height) return;

      this.canvas.width = width;
      this.canvas.height = height;

      gl.viewport(0, 0, width, height);

      if (this.uniforms.uResolution) {
        gl.useProgram(this.program);
        gl.uniform3f(this.uniforms.uResolution, width, height, width / height);
      }
    }

    handleMouseMove = (e) => {
      if (!this.container) return;
      const rect = this.container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      this.mouse.x = x;
      this.mouse.y = y;

      const gl = this.gl;
      if (!gl) return;
      if (this.uniforms.uMouse) {
        gl.useProgram(this.program);
        gl.uniform2f(this.uniforms.uMouse, x, y);
      }
    };

    animate = (timestamp) => {
      const gl = this.gl;
      if (!gl) return;

      // FPS limit
      const frameInterval = 1000 / this.fpsLimit;
      const elapsed = timestamp - this.lastFrameTime;
      
      if (elapsed < frameInterval) {
        this.rafId = requestAnimationFrame(this.animate);
        return;
      }
      
      this.lastFrameTime = timestamp - (elapsed % frameInterval);

      const t = (performance.now() - this.startTime) * 0.001;
      gl.useProgram(this.program);
      if (this.uniforms.uTime) gl.uniform1f(this.uniforms.uTime, t);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.rafId = requestAnimationFrame(this.animate);
    };

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;

      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.resizeObserver = null;

      if (this.mutationObserver) this.mutationObserver.disconnect();
      this.mutationObserver = null;

      if (this.options.mouseReact && this.container) {
        this.container.removeEventListener('mousemove', this.handleMouseMove);
      }

      if (this.gl && this.program) {
        this.gl.deleteProgram(this.program);
      }

      if (this.canvas && this.container && this.canvas.parentNode === this.container) {
        this.container.removeChild(this.canvas);
      }

      this.canvas = null;
      this.program = null;
      this.gl = null;
    }
  }

  window.IridescenceBackground = IridescenceBackground;
  window.initIridescenceViewsBackground = initIridescenceViewsBackground;
  
  // Function to reinitialize background when theme changes
  window.reinitViewsBackground = function() {
    initIridescenceViewsBackground();
  };

  let instance = null;
  let faultyTerminalInstance = null;
  
  function initIridescenceViewsBackground() {
    // Check if animated backgrounds are disabled in settings
    if (localStorage.getItem('layerAnimatedBg') === 'false') {
      return;
    }

    // Skip in performance mode - animated backgrounds are GPU intensive
    if (window.isPerformanceMode && window.isPerformanceMode()) {
      console.log('🚀 Skipping iridescence background in performance mode');
      return;
    }

    const bg = document.getElementById('viewsBackground');
    if (!bg) return;

    // Get current theme
    const currentTheme = localStorage.getItem('layerTheme') || 'dark';
    
    // Check if darklime theme is active - use FaultyTerminal instead
    if (currentTheme === 'darklime' && typeof window.FaultyTerminal !== 'undefined') {
      // Clean up iridescence instance if exists
      if (instance) {
        instance.destroy();
        instance = null;
      }
      
      // Clean up existing faulty terminal instance
      if (faultyTerminalInstance) {
        faultyTerminalInstance.destroy();
        faultyTerminalInstance = null;
      }
      
      // Ensure the background layer is empty
      while (bg.firstChild) bg.removeChild(bg.firstChild);
      
      // Create FaultyTerminal background with lime green tint
      faultyTerminalInstance = new window.FaultyTerminal(bg, {
        scale: 1,
        gridMul: [2, 1],
        digitSize: 1.5,
        timeScale: 0.3,
        scanlineIntensity: 0.3,
        glitchAmount: 1,
        flickerAmount: 1,
        noiseAmp: 0,
        chromaticAberration: 0,
        dither: 0,
        curvature: 0.2,
        tint: '#00ff00', // Lime green
        mouseReact: true,
        mouseStrength: 0.2,
        pageLoadAnimation: true,
        brightness: 1
      });
      
      return;
    }

    // For non-darklime themes, use IridescenceBackground
    
    // Clean up faulty terminal instance if exists
    if (faultyTerminalInstance) {
      faultyTerminalInstance.destroy();
      faultyTerminalInstance = null;
    }

    if (instance) {
      instance.destroy();
      instance = null;
    }

    // Ensure the background layer is empty (no duplicate canvases)
    while (bg.firstChild) bg.removeChild(bg.firstChild);
    instance = new IridescenceBackground(bg, {
      speed: 1.0,
      amplitude: 0.1,
      mouseReact: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIridescenceViewsBackground);
  } else {
    initIridescenceViewsBackground();
  }
})();
