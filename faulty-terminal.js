// Faulty Terminal Background Component - Vanilla JavaScript with OGL
// Animated terminal-style background for dark lime theme

class FaultyTerminal {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      scale: options.scale || 1,
      gridMul: options.gridMul || [2, 1],
      digitSize: options.digitSize || 1.5,
      timeScale: options.timeScale || 0.3,
      pause: options.pause || false,
      scanlineIntensity: options.scanlineIntensity || 0.3,
      glitchAmount: options.glitchAmount || 1,
      flickerAmount: options.flickerAmount || 1,
      noiseAmp: options.noiseAmp || 0,
      chromaticAberration: options.chromaticAberration || 0,
      dither: options.dither || 0,
      curvature: options.curvature || 0.2,
      tint: options.tint || '#00ff00',
      mouseReact: options.mouseReact || true,
      mouseStrength: options.mouseStrength || 0.2,
      dpr: options.dpr || Math.min(window.devicePixelRatio || 1, 2),
      pageLoadAnimation: options.pageLoadAnimation || true,
      brightness: options.brightness || 1,
      ...options
    };
    
    this.gl = null;
    this.program = null;
    this.animationId = null;
    this.isVisible = true;
    this.startTime = performance.now();
    this.resizeObserver = null;
    this.intersectionObserver = null;
    this.mouse = { x: 0.5, y: 0.5 };
    this.smoothMouse = { x: 0.5, y: 0.5 };
    this.frozenTime = 0;
    this.loadAnimationStart = 0;
    this.timeOffset = Math.random() * 100;
    
    this.init();
  }
  
  hexToRgb(hex) {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) {
      h = h.split('').map(c => c + c).join('');
    }
    const num = parseInt(h, 16);
    return [
      ((num >> 16) & 255) / 255,
      ((num >> 8) & 255) / 255,
      (num & 255) / 255
    ];
  }
  
  init() {
    if (!this.container) return;
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    
    // Add to container
    this.container.appendChild(this.canvas);
    
    // Initialize WebGL
    this.initWebGL();
    
    // Setup observers
    this.setupResizeObserver();
    this.setupIntersectionObserver();
    
    // Setup mouse tracking
    if (this.options.mouseReact) {
      this.setupMouseTracking();
    }
    
    // Start animation
    this.animate(performance.now());
  }
  
  initWebGL() {
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
    gl.clearColor(0, 0, 0, 1);
    
    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;
    
    // Fragment shader
    const fragmentShaderSource = `
      precision mediump float;
      
      varying vec2 vUv;
      
      uniform float iTime;
      uniform vec3  iResolution;
      uniform float uScale;
      
      uniform vec2  uGridMul;
      uniform float uDigitSize;
      uniform float uScanlineIntensity;
      uniform float uGlitchAmount;
      uniform float uFlickerAmount;
      uniform float uNoiseAmp;
      uniform float uChromaticAberration;
      uniform float uDither;
      uniform float uCurvature;
      uniform vec3  uTint;
      uniform vec2  uMouse;
      uniform float uMouseStrength;
      uniform float uUseMouse;
      uniform float uPageLoadProgress;
      uniform float uUsePageLoadAnimation;
      uniform float uBrightness;
      
      float time;
      
      float hash21(vec2 p){
        p = fract(p * 234.56);
        p += dot(p, p + 34.56);
        return fract(p.x * p.y);
      }
      
      float noise(vec2 p)
      {
        return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2; 
      }
      
      mat2 rotate(float angle)
      {
        float c = cos(angle);
        float s = sin(angle);
        return mat2(c, -s, s, c);
      }
      
      float fbm(vec2 p)
      {
        p *= 1.1;
        float f = 0.0;
        float amp = 0.5 * uNoiseAmp;
        
        mat2 modify0 = rotate(time * 0.02);
        f += amp * noise(p);
        p = modify0 * p * 2.0;
        amp *= 0.454545;
        
        mat2 modify1 = rotate(time * 0.02);
        f += amp * noise(p);
        p = modify1 * p * 2.0;
        amp *= 0.454545;
        
        mat2 modify2 = rotate(time * 0.08);
        f += amp * noise(p);
        
        return f;
      }
      
      float pattern(vec2 p, out vec2 q, out vec2 r) {
        vec2 offset1 = vec2(1.0);
        vec2 offset0 = vec2(0.0);
        mat2 rot01 = rotate(0.1 * time);
        mat2 rot1 = rotate(0.1);
        
        q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
        r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
        return fbm(p + r);
      }
      
      float digit(vec2 p){
          vec2 grid = uGridMul * 15.0;
          vec2 s = floor(p * grid) / grid;
          p = p * grid;
          vec2 q, r;
          float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;
          
          if(uUseMouse > 0.5){
              vec2 mouseWorld = uMouse * uScale;
              float distToMouse = distance(s, mouseWorld);
              float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
              intensity += mouseInfluence;
              
              float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
              intensity += ripple;
          }
          
          if(uUsePageLoadAnimation > 0.5){
              float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
              float cellDelay = cellRandom * 0.8;
              float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);
              
              float fadeAlpha = smoothstep(0.0, 1.0, cellProgress);
              intensity *= fadeAlpha;
          }
          
          p = fract(p);
          p *= uDigitSize;
          
          float px5 = p.x * 5.0;
          float py5 = (1.0 - p.y) * 5.0;
          float x = fract(px5);
          float y = fract(py5);
          
          float i = floor(py5) - 2.0;
          float j = floor(px5) - 2.0;
          float n = i * i + j * j;
          float f = n * 0.0625;
          
          float isOn = step(0.1, intensity - f);
          float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);
          
          return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
      }
      
      float onOff(float a, float b, float c)
      {
        return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
      }
      
      float displace(vec2 look)
      {
          float y = look.y - mod(iTime * 0.25, 1.0);
          float window = 1.0 / (1.0 + 50.0 * y * y);
          return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
      }
      
      vec3 getColor(vec2 p){
          
          float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
          bar *= uScanlineIntensity;
          
          float displacement = displace(p);
          p.x += displacement;
      
          if (uGlitchAmount != 1.0) {
            float extra = displacement * (uGlitchAmount - 1.0);
            p.x += extra;
          }
      
          float middle = digit(p);
          
          const float off = 0.002;
          float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
                      digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
                      digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));
          
          vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
          return baseColor;
      }
      
      vec2 barrel(vec2 uv){
        vec2 c = uv * 2.0 - 1.0;
        float r2 = dot(c, c);
        c *= 1.0 + uCurvature * r2;
        return c * 0.5 + 0.5;
      }
      
      void main() {
          time = iTime * 0.333333;
          vec2 uv = vUv;
      
          if(uCurvature != 0.0){
            uv = barrel(uv);
          }
          
          vec2 p = uv * uScale;
          vec3 col = getColor(p);
      
          if(uChromaticAberration != 0.0){
            vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
            col.r = getColor(p + ca).r;
            col.b = getColor(p - ca).b;
          }
      
          col *= uTint;
          col *= uBrightness;
      
          if(uDither > 0.0){
            float rnd = hash21(gl_FragCoord.xy);
            col += (rnd - 0.5) * (uDither * 0.003922);
          }
      
          gl_FragColor = vec4(col, 1.0);
      }
    `;
    
    // Create shaders
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
      console.error('Shader creation failed');
      return;
    }
    
    // Create program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
    
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program link failed:', gl.getProgramInfoLog(this.program));
      return;
    }
    
    // Create triangle geometry with UVs
    const positions = new Float32Array([
      -1, -1, 0, 0,
       3, -1, 2, 0,
      -1,  3, 0, 2
    ]);
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    const positionLocation = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    
    const uvLocation = gl.getAttribLocation(this.program, 'uv');
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);
    
    // Set uniforms
    this.setUniforms();
  }
  
  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile failed:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  setUniforms() {
    const gl = this.gl;
    gl.useProgram(this.program);
    
    const tintVec = this.hexToRgb(this.options.tint);
    const ditherValue = typeof this.options.dither === 'boolean' 
      ? (this.options.dither ? 1 : 0) 
      : this.options.dither;
    
    const uniforms = {
      iTime: 0,
      iResolution: [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height],
      uScale: this.options.scale,
      uGridMul: new Float32Array(this.options.gridMul),
      uDigitSize: this.options.digitSize,
      uScanlineIntensity: this.options.scanlineIntensity,
      uGlitchAmount: this.options.glitchAmount,
      uFlickerAmount: this.options.flickerAmount,
      uNoiseAmp: this.options.noiseAmp,
      uChromaticAberration: this.options.chromaticAberration,
      uDither: ditherValue,
      uCurvature: this.options.curvature,
      uTint: tintVec,
      uMouse: new Float32Array([this.smoothMouse.x, this.smoothMouse.y]),
      uMouseStrength: this.options.mouseStrength,
      uUseMouse: this.options.mouseReact ? 1 : 0,
      uPageLoadProgress: this.options.pageLoadAnimation ? 0 : 1,
      uUsePageLoadAnimation: this.options.pageLoadAnimation ? 1 : 0,
      uBrightness: this.options.brightness
    };
    
    for (const [name, value] of Object.entries(uniforms)) {
      const location = gl.getUniformLocation(this.program, name);
      if (location) {
        if (value instanceof Float32Array) {
          if (value.length === 2) {
            gl.uniform2fv(location, value);
          }
        } else if (Array.isArray(value)) {
          if (value.length === 2) {
            gl.uniform2fv(location, value);
          } else if (value.length === 3) {
            gl.uniform3fv(location, value);
          }
        } else {
          gl.uniform1f(location, value);
        }
      }
    }
  }
  
  setupMouseTracking() {
    this.handleMouseMove = (e) => {
      const rect = this.container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      this.mouse = { x, y };
    };
    
    this.container.addEventListener('mousemove', this.handleMouseMove);
  }
  
  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.container);
    this.resize();
  }
  
  setupIntersectionObserver() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        this.isVisible = entry.isIntersecting;
        if (this.isVisible) {
          this.animate(performance.now());
        }
      });
    }, { threshold: 0.1 });
    this.intersectionObserver.observe(this.container);
  }
  
  resize() {
    if (!this.gl || !this.container) return;
    
    const rect = this.container.getBoundingClientRect();
    const dpr = this.options.dpr;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
      
      // Update resolution uniform
      const gl = this.gl;
      gl.useProgram(this.program);
      const resolutionLocation = gl.getUniformLocation(this.program, 'iResolution');
      if (resolutionLocation) {
        gl.uniform3fv(resolutionLocation, [width, height, width / height]);
      }
    }
  }
  
  animate(timestamp) {
    if (!this.gl || !this.program || !this.isVisible) return;
    
    const gl = this.gl;
    gl.useProgram(this.program);
    
    // Page load animation
    if (this.options.pageLoadAnimation && this.loadAnimationStart === 0) {
      this.loadAnimationStart = timestamp;
    }
    
    // Update time
    if (!this.options.pause) {
      const elapsed = (timestamp * 0.001 + this.timeOffset) * this.options.timeScale;
      gl.uniform1f(gl.getUniformLocation(this.program, 'iTime'), elapsed);
      this.frozenTime = elapsed;
    } else {
      gl.uniform1f(gl.getUniformLocation(this.program, 'iTime'), this.frozenTime);
    }
    
    // Page load progress
    if (this.options.pageLoadAnimation && this.loadAnimationStart > 0) {
      const animationDuration = 2000;
      const animationElapsed = timestamp - this.loadAnimationStart;
      const progress = Math.min(animationElapsed / animationDuration, 1);
      gl.uniform1f(gl.getUniformLocation(this.program, 'uPageLoadProgress'), progress);
    }
    
    // Mouse tracking with smoothing
    if (this.options.mouseReact) {
      const dampingFactor = 0.08;
      this.smoothMouse.x += (this.mouse.x - this.smoothMouse.x) * dampingFactor;
      this.smoothMouse.y += (this.mouse.y - this.smoothMouse.y) * dampingFactor;
      
      gl.uniform2fv(gl.getUniformLocation(this.program, 'uMouse'), 
        new Float32Array([this.smoothMouse.x, this.smoothMouse.y]));
    }
    
    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    
    // Continue animation
    this.animationId = requestAnimationFrame((t) => this.animate(t));
  }
  
  updateOptions(newOptions) {
    Object.assign(this.options, newOptions);
    this.setUniforms();
  }
  
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    if (this.handleMouseMove && this.container) {
      this.container.removeEventListener('mousemove', this.handleMouseMove);
    }
    
    if (this.canvas && this.container) {
      this.container.removeChild(this.canvas);
    }
    
    if (this.gl) {
      const gl = this.gl;
      if (this.program) {
        gl.deleteProgram(this.program);
      }
    }
  }
}

// Export for use in other modules
window.FaultyTerminal = FaultyTerminal;
