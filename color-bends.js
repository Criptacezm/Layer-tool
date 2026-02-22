// ColorBends Background - Vanilla JS Version (adapted from react-bits)
// Uses Three.js for WebGL rendering

class ColorBendsBackground {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      rotation: options.rotation || 0,
      speed: options.speed || 0.2,
      colors: options.colors || ['#d54444', '#ff9500', '#742afe'],
      transparent: options.transparent !== false,
      autoRotate: options.autoRotate || 0,
      scale: options.scale || 1,
      frequency: options.frequency || 1,
      warpStrength: options.warpStrength || 1,
      mouseInfluence: options.mouseInfluence || 1,
      parallax: options.parallax || 0.5,
      noise: options.noise || 0.1,
      ...options
    };

    this.MAX_COLORS = 8;
    this.renderer = null;
    this.material = null;
    this.rafId = null;
    this.resizeObserver = null;
    this.pointerTarget = { x: 0, y: 0 };
    this.pointerCurrent = { x: 0, y: 0 };
    this.clock = { start: performance.now(), elapsed: 0 };

    this.init();
  }

  init() {
    if (!window.THREE) {
      console.error('Three.js is required for ColorBends background');
      return;
    }

    const THREE = window.THREE;
    const container = this.container;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Geometry
    const geometry = new THREE.PlaneGeometry(2, 2);

    // Shader uniforms
    const uColorsArray = Array.from({ length: this.MAX_COLORS }, () => new THREE.Vector3(0, 0, 0));

    const fragShader = this.getFragmentShader();
    const vertShader = this.getVertexShader();

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      uniforms: {
        uCanvas: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uSpeed: { value: this.options.speed },
        uRot: { value: new THREE.Vector2(1, 0) },
        uColorCount: { value: 0 },
        uColors: { value: uColorsArray },
        uTransparent: { value: this.options.transparent ? 1 : 0 },
        uScale: { value: this.options.scale },
        uFrequency: { value: this.options.frequency },
        uWarpStrength: { value: this.options.warpStrength },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uMouseInfluence: { value: this.options.mouseInfluence },
        uParallax: { value: this.options.parallax },
        uNoise: { value: this.options.noise }
      },
      premultipliedAlpha: true,
      transparent: true
    });

    const mesh = new THREE.Mesh(geometry, this.material);
    scene.add(mesh);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: true
    });

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, this.options.transparent ? 0 : 1);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.zIndex = '0';

    container.appendChild(this.renderer.domElement);

    // Handle resize
    const handleResize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      this.renderer.setSize(w, h, false);
      this.material.uniforms.uCanvas.value.set(w, h);
    };

    handleResize();

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(handleResize);
      this.resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', handleResize);
    }

    // Pointer move handler
    this.handlePointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / (rect.width || 1)) * 2 - 1;
      const y = -(((e.clientY - rect.top) / (rect.height || 1)) * 2 - 1);
      this.pointerTarget = { x, y };
    };

    container.addEventListener('pointermove', this.handlePointerMove);

    // Animation loop
    const loop = () => {
      const now = performance.now();
      const dt = (now - this.clock.start) / 1000;
      this.clock.elapsed = dt;

      this.material.uniforms.uTime.value = dt;

      // Rotation
      const deg = (this.options.rotation % 360) + this.options.autoRotate * dt;
      const rad = (deg * Math.PI) / 180;
      this.material.uniforms.uRot.value.set(Math.cos(rad), Math.sin(rad));

      // Smooth pointer
      const amt = Math.min(1, dt * 8);
      this.pointerCurrent.x += (this.pointerTarget.x - this.pointerCurrent.x) * amt;
      this.pointerCurrent.y += (this.pointerTarget.y - this.pointerCurrent.y) * amt;
      this.material.uniforms.uPointer.value.set(this.pointerCurrent.x, this.pointerCurrent.y);

      this.renderer.render(scene, camera);
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);

    // Update colors
    this.updateColors();
  }

  getFragmentShader() {
    return `
      #define MAX_COLORS 8
      uniform vec2 uCanvas;
      uniform float uTime;
      uniform float uSpeed;
      uniform vec2 uRot;
      uniform int uColorCount;
      uniform vec3 uColors[MAX_COLORS];
      uniform int uTransparent;
      uniform float uScale;
      uniform float uFrequency;
      uniform float uWarpStrength;
      uniform vec2 uPointer;
      uniform float uMouseInfluence;
      uniform float uParallax;
      uniform float uNoise;
      varying vec2 vUv;

      void main() {
        float t = uTime * uSpeed;
        vec2 p = vUv * 2.0 - 1.0;
        p += uPointer * uParallax * 0.1;
        vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
        vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
        q /= max(uScale, 0.0001);
        q /= 0.5 + 0.2 * dot(q, q);
        q += 0.2 * cos(t) - 7.56;
        vec2 toward = (uPointer - rp);
        q += toward * uMouseInfluence * 0.2;

        vec3 col = vec3(0.0);
        float a = 1.0;

        if (uColorCount > 0) {
          vec2 s = q;
          vec3 sumCol = vec3(0.0);
          float cover = 0.0;
          for (int i = 0; i < MAX_COLORS; ++i) {
            if (i >= uColorCount) break;
            s -= 0.01;
            vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
            float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
            float kBelow = clamp(uWarpStrength, 0.0, 1.0);
            float kMix = pow(kBelow, 0.3);
            float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
            vec2 disp = (r - s) * kBelow;
            vec2 warped = s + disp * gain;
            float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
            float m = mix(m0, m1, kMix);
            float w = 1.0 - exp(-6.0 / exp(6.0 * m));
            sumCol += uColors[i] * w;
            cover = max(cover, w);
          }
          col = clamp(sumCol, 0.0, 1.0);
          a = uTransparent > 0 ? cover : 1.0;
        } else {
          vec2 s = q;
          for (int k = 0; k < 3; ++k) {
            s -= 0.01;
            vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
            float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
            float kBelow = clamp(uWarpStrength, 0.0, 1.0);
            float kMix = pow(kBelow, 0.3);
            float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
            vec2 disp = (r - s) * kBelow;
            vec2 warped = s + disp * gain;
            float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
            float m = mix(m0, m1, kMix);
            col[k] = 1.0 - exp(-6.0 / exp(6.0 * m));
          }
          a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
        }

        if (uNoise > 0.0001) {
          float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
          col += (n - 0.5) * uNoise;
          col = clamp(col, 0.0, 1.0);
        }

        vec3 rgb = (uTransparent > 0) ? col * a : col;
        gl_FragColor = vec4(rgb, a);
      }
    `;
  }

  getVertexShader() {
    return `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;
  }

  hexToRgb(hex) {
    const h = hex.replace('#', '').trim();
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16) / 255,
        parseInt(h[1] + h[1], 16) / 255,
        parseInt(h[2] + h[2], 16) / 255
      ];
    }
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255
    ];
  }

  updateColors() {
    if (!this.material) return;

    const colors = this.options.colors.filter(Boolean).slice(0, this.MAX_COLORS);
    const arr = colors.map(hex => {
      const [r, g, b] = this.hexToRgb(hex);
      return new window.THREE.Vector3(r, g, b);
    });

    for (let i = 0; i < this.MAX_COLORS; i++) {
      const vec = this.material.uniforms.uColors.value[i];
      if (i < arr.length) {
        vec.copy(arr[i]);
      } else {
        vec.set(0, 0, 0);
      }
    }

    this.material.uniforms.uColorCount.value = arr.length;
  }

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.container && this.handlePointerMove) {
      this.container.removeEventListener('pointermove', this.handlePointerMove);
    }

    if (this.material) {
      this.material.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentElement === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
  }
}

// Expose to global scope
window.ColorBendsBackground = ColorBendsBackground;
