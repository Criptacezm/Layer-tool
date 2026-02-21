// Animated Background Component - Vanilla JavaScript
// Converts the React Grainient component to vanilla JS with WebGL

class AnimatedBackground {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      timeSpeed: options.timeSpeed || 0.25,
      colorBalance: options.colorBalance || 0.0,
      warpStrength: options.warpStrength || 1.0,
      warpFrequency: options.warpFrequency || 5.0,
      warpSpeed: options.warpSpeed || 2.0,
      warpAmplitude: options.warpAmplitude || 50.0,
      blendAngle: options.blendAngle || 0.0,
      blendSoftness: options.blendSoftness || 0.05,
      rotationAmount: options.rotationAmount || 500.0,
      noiseScale: options.noiseScale || 2.0,
      grainAmount: options.grainAmount || 0.1,
      grainScale: options.grainScale || 2.0,
      grainAnimated: options.grainAnimated || false,
      contrast: options.contrast || 1.5,
      gamma: options.gamma || 1.0,
      saturation: options.saturation || 1.0,
      centerX: options.centerX || 0.0,
      centerY: options.centerY || 0.0,
      zoom: options.zoom || 0.9,
      color1: options.color1 || '#FF9FFC',
      color2: options.color2 || '#5227FF',
      color3: options.color3 || '#B19EEF',
      ...options
    };
    
    this.gl = null;
    this.program = null;
    this.animationId = null;
    this.startTime = performance.now();
    this.resizeObserver = null;
    
    this.init();
  }
  
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [1, 1, 1];
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
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
    
    // Setup resize observer
    this.setupResizeObserver();
    
    // Start animation
    this.animate();
  }
  
  initWebGL() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false
    });
    
    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }
    
    this.gl = gl;
    
    // Vertex shader
    const vertexShaderSource = `#version 300 es
      in vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;
    
    // Fragment shader
    const fragmentShaderSource = `#version 300 es
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float uTimeSpeed;
      uniform float uColorBalance;
      uniform float uWarpStrength;
      uniform float uWarpFrequency;
      uniform float uWarpSpeed;
      uniform float uWarpAmplitude;
      uniform float uBlendAngle;
      uniform float uBlendSoftness;
      uniform float uRotationAmount;
      uniform float uNoiseScale;
      uniform float uGrainAmount;
      uniform float uGrainScale;
      uniform float uGrainAnimated;
      uniform float uContrast;
      uniform float uGamma;
      uniform float uSaturation;
      uniform vec2 uCenterOffset;
      uniform float uZoom;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      out vec4 fragColor;
      
      #define S(a,b,t) smoothstep(a,b,t)
      
      mat2 Rot(float a){
        float s=sin(a),c=cos(a);
        return mat2(c,-s,s,c); 
      }
      
      vec2 hash(vec2 p){
        p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));
        return fract(sin(p)*43758.5453);
      }
      
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
        float n=mix(
          mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),
              dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),
          mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),
              dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);
        return 0.5+0.5*n;
      }
      
      void mainImage(out vec4 o, vec2 C){
        float t=iTime*uTimeSpeed;
        vec2 uv=C/iResolution.xy;
        float ratio=iResolution.x/iResolution.y;
        vec2 tuv=uv-0.5+uCenterOffset;
        tuv/=max(uZoom,0.001);

        float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
        tuv.y*=1.0/ratio;
        tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
        tuv.y*=ratio;

        float frequency=uWarpFrequency;
        float ws=max(uWarpStrength,0.001);
        float amplitude=uWarpAmplitude/ws;
        float warpTime=t*uWarpSpeed;
        tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
        tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

        vec3 colLav=uColor1;
        vec3 colOrg=uColor2;
        vec3 colDark=uColor3;
        float b=uColorBalance;
        float s=max(uBlendSoftness,0.0);
        mat2 blendRot=Rot(radians(uBlendAngle));
        float blendX=(tuv*blendRot).x;
        float edge0=-0.3-b-s;
        float edge1=0.2-b+s;
        float v0=0.5-b+s;
        float v1=-0.3-b-s;
        vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
        vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
        vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

        vec2 grainUv=uv*max(uGrainScale,0.001);
        if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);} 
        float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
        col+=(grain-0.5)*uGrainAmount;

        col=(col-0.5)*uContrast+0.5;
        float luma=dot(col,vec3(0.2126,0.7152,0.0722));
        col=mix(vec3(luma),col,uSaturation);
        col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
        col=clamp(col,0.0,1.0);

        o=vec4(col,1.0);
      }
      
      void main(){
        vec4 o=vec4(0.0);
        mainImage(o,gl_FragCoord.xy);
        fragColor=o;
      }
    `;
    
    // Create shaders
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    // Create program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
    
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program link failed:', gl.getProgramInfoLog(this.program));
      return;
    }
    
    // Create triangle geometry
    const positions = new Float32Array([
      -1, -1,
       3, -1,
      -1,  3
    ]);
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    const positionLocation = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
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
    
    // Set uniform values
    const uniforms = {
      iTime: 0,
      iResolution: [1, 1],
      uTimeSpeed: this.options.timeSpeed,
      uColorBalance: this.options.colorBalance,
      uWarpStrength: this.options.warpStrength,
      uWarpFrequency: this.options.warpFrequency,
      uWarpSpeed: this.options.warpSpeed,
      uWarpAmplitude: this.options.warpAmplitude,
      uBlendAngle: this.options.blendAngle,
      uBlendSoftness: this.options.blendSoftness,
      uRotationAmount: this.options.rotationAmount,
      uNoiseScale: this.options.noiseScale,
      uGrainAmount: this.options.grainAmount,
      uGrainScale: this.options.grainScale,
      uGrainAnimated: this.options.grainAnimated ? 1.0 : 0.0,
      uContrast: this.options.contrast,
      uGamma: this.options.gamma,
      uSaturation: this.options.saturation,
      uCenterOffset: [this.options.centerX, this.options.centerY],
      uZoom: this.options.zoom,
      uColor1: this.hexToRgb(this.options.color1),
      uColor2: this.hexToRgb(this.options.color2),
      uColor3: this.hexToRgb(this.options.color3)
    };
    
    for (const [name, value] of Object.entries(uniforms)) {
      const location = gl.getUniformLocation(this.program, name);
      if (location) {
        if (Array.isArray(value)) {
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
  
  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.container);
    this.resize();
  }
  
  resize() {
    if (!this.gl || !this.container) return;
    
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    this.gl.viewport(0, 0, width, height);
    
    // Update resolution uniform
    const gl = this.gl;
    gl.useProgram(this.program);
    const resolutionLocation = gl.getUniformLocation(this.program, 'iResolution');
    if (resolutionLocation) {
      gl.uniform2fv(resolutionLocation, [width, height]);
    }
  }
  
  animate() {
    if (!this.gl || !this.program) return;
    
    const currentTime = (performance.now() - this.startTime) * 0.001;
    
    // Update time uniform
    const gl = this.gl;
    gl.useProgram(this.program);
    const timeLocation = gl.getUniformLocation(this.program, 'iTime');
    if (timeLocation) {
      gl.uniform1f(timeLocation, currentTime);
    }
    
    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    
    // Continue animation
    this.animationId = requestAnimationFrame(() => this.animate());
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
window.AnimatedBackground = AnimatedBackground;
