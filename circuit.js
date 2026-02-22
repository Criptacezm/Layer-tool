/* ============================================
   Layer - Professional Circuit Designer
   Electronic Schematic Component Library
   ============================================ */

/**
 * Circuit Component Definitions
 * Each component has: id, name, category, width, height, pins[], svgRenderer
 */

const CircuitComponents = {
  // ============================================
  // PASSIVE COMPONENTS
  // ============================================
  resistor: {
    id: 'resistor', name: 'Resistor', category: 'passive',
    width: 100, height: 40,
    pins: [
      { id: 'left', x: 0, y: 20, label: '1' },
      { id: 'right', x: 100, y: 20, label: '2' }
    ],
    svg: (w, h, state) => {
      const resistance = (state && state.resistance) || 1000;
      const label = resistance >= 1000000 ? (resistance/1000000).toFixed(1) + 'MΩ' : resistance >= 1000 ? (resistance/1000).toFixed(1) + 'kΩ' : resistance + 'Ω';
      // Professional zigzag (US/ANSI) style resistor
      const startX = w * 0.2;
      const endX = w * 0.8;
      const midY = h / 2;
      const amp = h * 0.28;
      const segments = 6;
      const segW = (endX - startX) / segments;
      let zigzag = `M${startX},${midY}`;
      for (let i = 0; i < segments; i++) {
        const x1 = startX + i * segW + segW * 0.25;
        const x2 = startX + i * segW + segW * 0.75;
        const y1 = i % 2 === 0 ? midY - amp : midY + amp;
        const y2 = i % 2 === 0 ? midY + amp : midY - amp;
        zigzag += ` L${x1},${y1} L${x2},${y2}`;
      }
      zigzag += ` L${endX},${midY}`;
      return `
        <line x1="0" y1="${midY}" x2="${startX}" y2="${midY}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
        <path d="${zigzag}" fill="none" stroke="var(--circuit-component)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="${endX}" y1="${midY}" x2="${w}" y2="${midY}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
        <text x="${w/2}" y="${h-1}" fill="var(--circuit-accent)" font-size="9" text-anchor="middle" font-weight="600">${label}</text>
      `;
    }
  },

  capacitor: {
    id: 'capacitor', name: 'Capacitor', category: 'passive',
    width: 80, height: 50,
    pins: [
      { id: 'left', x: 0, y: 25, label: '+' },
      { id: 'right', x: 80, y: 25, label: '-' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h/2}" x2="${w*0.38}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
      <line x1="${w*0.38}" y1="${h*0.12}" x2="${w*0.38}" y2="${h*0.88}" stroke="var(--circuit-component)" stroke-width="3"/>
      <path d="M${w*0.62},${h*0.12} Q${w*0.56},${h/2} ${w*0.62},${h*0.88}" fill="none" stroke="var(--circuit-component)" stroke-width="3"/>
      <line x1="${w*0.62}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
      <text x="${w*0.28}" y="${h*0.12}" fill="var(--circuit-label)" font-size="10" text-anchor="middle" font-weight="bold">+</text>
    `
  },

  inductor: {
    id: 'inductor', name: 'Inductor', category: 'passive',
    width: 100, height: 40,
    pins: [
      { id: 'left', x: 0, y: 20, label: '1' },
      { id: 'right', x: 100, y: 20, label: '2' }
    ],
    svg: (w, h) => {
      const bumps = 4;
      const startX = w * 0.2;
      const endX = w * 0.8;
      const bumpW = (endX - startX) / bumps;
      let arcs = '';
      for (let i = 0; i < bumps; i++) {
        const sx = startX + i * bumpW;
        arcs += `<path d="M${sx},${h/2} A${bumpW/2},${h*0.3} 0 0,1 ${sx + bumpW},${h/2}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>`;
      }
      return `
        <line x1="0" y1="${h/2}" x2="${startX}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
        ${arcs}
        <line x1="${endX}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
      `;
    }
  },

  potentiometer: {
    id: 'potentiometer', name: 'Potentiometer', category: 'passive',
    width: 100, height: 60,
    pins: [
      { id: 'left', x: 0, y: 30, label: '1' },
      { id: 'right', x: 100, y: 30, label: '3' },
      { id: 'wiper', x: 50, y: 0, label: '2' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h*0.55}" x2="${w*0.2}" y2="${h*0.55}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <rect x="${w*0.2}" y="${h*0.35}" width="${w*0.6}" height="${h*0.4}" fill="none" stroke="var(--circuit-component)" stroke-width="2" rx="2"/>
      <line x1="${w*0.8}" y1="${h*0.55}" x2="${w}" y2="${h*0.55}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="${w*0.5}" y1="0" x2="${w*0.5}" y2="${h*0.35}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <polygon points="${w*0.5-5},${h*0.38} ${w*0.5+5},${h*0.38} ${w*0.5},${h*0.45}" fill="var(--circuit-component)"/>
    `
  },

  transformer: {
    id: 'transformer', name: 'Transformer', category: 'passive',
    width: 80, height: 80,
    pins: [
      { id: 'p1', x: 0, y: 20, label: 'P1' },
      { id: 'p2', x: 0, y: 60, label: 'P2' },
      { id: 's1', x: 80, y: 20, label: 'S1' },
      { id: 's2', x: 80, y: 60, label: 'S2' }
    ],
    svg: (w, h) => {
      let primary = '', secondary = '';
      for (let i = 0; i < 4; i++) {
        const y = h * 0.2 + i * (h * 0.15);
        primary += `<path d="M${w*0.15},${y} A${w*0.1},${h*0.075} 0 0,1 ${w*0.15},${y + h*0.15}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>`;
        secondary += `<path d="M${w*0.85},${y} A${w*0.1},${h*0.075} 0 0,0 ${w*0.85},${y + h*0.15}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>`;
      }
      return `
        <line x1="0" y1="${h*0.25}" x2="${w*0.15}" y2="${h*0.25}" stroke="var(--circuit-wire)" stroke-width="2"/>
        <line x1="0" y1="${h*0.75}" x2="${w*0.15}" y2="${h*0.75}" stroke="var(--circuit-wire)" stroke-width="2"/>
        ${primary}
        <line x1="${w*0.45}" y1="${h*0.15}" x2="${w*0.45}" y2="${h*0.85}" stroke="var(--circuit-component)" stroke-width="2"/>
        <line x1="${w*0.55}" y1="${h*0.15}" x2="${w*0.55}" y2="${h*0.85}" stroke="var(--circuit-component)" stroke-width="2"/>
        ${secondary}
        <line x1="${w*0.85}" y1="${h*0.25}" x2="${w}" y2="${h*0.25}" stroke="var(--circuit-wire)" stroke-width="2"/>
        <line x1="${w*0.85}" y1="${h*0.75}" x2="${w}" y2="${h*0.75}" stroke="var(--circuit-wire)" stroke-width="2"/>
      `;
    }
  },

  // ============================================
  // ACTIVE COMPONENTS
  // ============================================
  diode: {
    id: 'diode', name: 'Diode', category: 'active',
    width: 80, height: 40,
    pins: [
      { id: 'anode', x: 0, y: 20, label: 'A' },
      { id: 'cathode', x: 80, y: 20, label: 'K' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h/2}" x2="${w*0.3}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <polygon points="${w*0.3},${h*0.15} ${w*0.7},${h/2} ${w*0.3},${h*0.85}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.7}" y1="${h*0.15}" x2="${w*0.7}" y2="${h*0.85}" stroke="var(--circuit-component)" stroke-width="2.5"/>
      <line x1="${w*0.7}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  led: {
    id: 'led', name: 'LED', category: 'active',
    width: 80, height: 50,
    pins: [
      { id: 'anode', x: 0, y: 25, label: 'A' },
      { id: 'cathode', x: 80, y: 25, label: 'K' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h*0.5}" x2="${w*0.3}" y2="${h*0.5}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
      <polygon points="${w*0.3},${h*0.15} ${w*0.65},${h*0.5} ${w*0.3},${h*0.85}" fill="rgba(85,239,196,0.08)" stroke="var(--circuit-component)" stroke-width="2.5"/>
      <line x1="${w*0.65}" y1="${h*0.15}" x2="${w*0.65}" y2="${h*0.85}" stroke="var(--circuit-component)" stroke-width="3"/>
      <line x1="${w*0.65}" y1="${h*0.5}" x2="${w}" y2="${h*0.5}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
      <line x1="${w*0.52}" y1="${h*0.1}" x2="${w*0.72}" y2="${h*-0.02}" stroke="var(--circuit-accent)" stroke-width="1.8" marker-end="url(#circuitArrow)"/>
      <line x1="${w*0.60}" y1="${h*0.16}" x2="${w*0.80}" y2="${h*0.04}" stroke="var(--circuit-accent)" stroke-width="1.8" marker-end="url(#circuitArrow)"/>
      <circle cx="${w*0.72}" cy="${h*-0.02}" r="2" fill="var(--circuit-accent)" opacity="0.6"/>
      <circle cx="${w*0.80}" cy="${h*0.04}" r="2" fill="var(--circuit-accent)" opacity="0.6"/>
    `
  },

  zener: {
    id: 'zener', name: 'Zener Diode', category: 'active',
    width: 80, height: 40,
    pins: [
      { id: 'anode', x: 0, y: 20, label: 'A' },
      { id: 'cathode', x: 80, y: 20, label: 'K' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h/2}" x2="${w*0.3}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <polygon points="${w*0.3},${h*0.15} ${w*0.7},${h/2} ${w*0.3},${h*0.85}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>
      <path d="M${w*0.65},${h*0.1} L${w*0.7},${h*0.15} L${w*0.7},${h*0.85} L${w*0.75},${h*0.9}" fill="none" stroke="var(--circuit-component)" stroke-width="2.5"/>
      <line x1="${w*0.7}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  npn: {
    id: 'npn', name: 'NPN Transistor', category: 'active',
    width: 70, height: 80,
    pins: [
      { id: 'base', x: 0, y: 40, label: 'B' },
      { id: 'collector', x: 70, y: 10, label: 'C' },
      { id: 'emitter', x: 70, y: 70, label: 'E' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h/2}" x2="${w*0.35}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <circle cx="${w*0.45}" cy="${h/2}" r="${h*0.38}" fill="none" stroke="var(--circuit-component)" stroke-width="1.5"/>
      <line x1="${w*0.35}" y1="${h*0.25}" x2="${w*0.35}" y2="${h*0.75}" stroke="var(--circuit-component)" stroke-width="3"/>
      <line x1="${w*0.35}" y1="${h*0.32}" x2="${w*0.7}" y2="${h*0.1}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.35}" y1="${h*0.68}" x2="${w*0.7}" y2="${h*0.9}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.7}" y1="${h*0.1}" x2="${w}" y2="${h*0.1}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="${w*0.7}" y1="${h*0.9}" x2="${w}" y2="${h*0.9}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <polygon points="${w*0.58},${h*0.78} ${w*0.7},${h*0.9} ${w*0.52},${h*0.9}" fill="var(--circuit-component)"/>
    `
  },

  pnp: {
    id: 'pnp', name: 'PNP Transistor', category: 'active',
    width: 70, height: 80,
    pins: [
      { id: 'base', x: 0, y: 40, label: 'B' },
      { id: 'collector', x: 70, y: 70, label: 'C' },
      { id: 'emitter', x: 70, y: 10, label: 'E' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h/2}" x2="${w*0.35}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <circle cx="${w*0.45}" cy="${h/2}" r="${h*0.38}" fill="none" stroke="var(--circuit-component)" stroke-width="1.5"/>
      <line x1="${w*0.35}" y1="${h*0.25}" x2="${w*0.35}" y2="${h*0.75}" stroke="var(--circuit-component)" stroke-width="3"/>
      <line x1="${w*0.35}" y1="${h*0.32}" x2="${w*0.7}" y2="${h*0.1}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.35}" y1="${h*0.68}" x2="${w*0.7}" y2="${h*0.9}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.7}" y1="${h*0.1}" x2="${w}" y2="${h*0.1}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="${w*0.7}" y1="${h*0.9}" x2="${w}" y2="${h*0.9}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <polygon points="${w*0.48},${h*0.22} ${w*0.35},${h*0.32} ${w*0.42},${h*0.4}" fill="var(--circuit-component)"/>
    `
  },

  nmosfet: {
    id: 'nmosfet', name: 'N-MOSFET', category: 'active',
    width: 70, height: 80,
    pins: [
      { id: 'gate', x: 0, y: 40, label: 'G' },
      { id: 'drain', x: 70, y: 10, label: 'D' },
      { id: 'source', x: 70, y: 70, label: 'S' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h/2}" x2="${w*0.25}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <circle cx="${w*0.48}" cy="${h/2}" r="${h*0.38}" fill="none" stroke="var(--circuit-component)" stroke-width="1.5"/>
      <line x1="${w*0.25}" y1="${h*0.2}" x2="${w*0.25}" y2="${h*0.8}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.35}" y1="${h*0.2}" x2="${w*0.35}" y2="${h*0.35}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.35}" y1="${h*0.42}" x2="${w*0.35}" y2="${h*0.58}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.35}" y1="${h*0.65}" x2="${w*0.35}" y2="${h*0.8}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.35}" y1="${h*0.28}" x2="${w*0.65}" y2="${h*0.28}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.65}" y1="${h*0.12}" x2="${w*0.65}" y2="${h*0.88}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.35}" y1="${h*0.72}" x2="${w*0.65}" y2="${h*0.72}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.35}" y1="${h/2}" x2="${w*0.65}" y2="${h/2}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.65}" y1="${h*0.12}" x2="${w}" y2="${h*0.12}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="${w*0.65}" y1="${h*0.88}" x2="${w}" y2="${h*0.88}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <polygon points="${w*0.35},${h/2} ${w*0.45},${h*0.45} ${w*0.45},${h*0.55}" fill="var(--circuit-component)"/>
    `
  },

  opamp: {
    id: 'opamp', name: 'Op-Amp', category: 'active',
    width: 100, height: 80,
    pins: [
      { id: 'inv', x: 0, y: 25, label: '−' },
      { id: 'noninv', x: 0, y: 55, label: '+' },
      { id: 'out', x: 100, y: 40, label: 'Out' },
      { id: 'vplus', x: 50, y: 0, label: 'V+' },
      { id: 'vminus', x: 50, y: 80, label: 'V−' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h*0.3}" x2="${w*0.2}" y2="${h*0.3}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="0" y1="${h*0.7}" x2="${w*0.2}" y2="${h*0.7}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <polygon points="${w*0.2},${h*0.05} ${w*0.8},${h/2} ${w*0.2},${h*0.95}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.8}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <text x="${w*0.27}" y="${h*0.37}" fill="var(--circuit-component)" font-size="14" font-weight="bold">−</text>
      <text x="${w*0.27}" y="${h*0.77}" fill="var(--circuit-component)" font-size="14" font-weight="bold">+</text>
      <line x1="${w*0.5}" y1="0" x2="${w*0.5}" y2="${h*0.25}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="${w*0.5}" y1="${h*0.75}" x2="${w*0.5}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  // ============================================
  // SOURCES
  // ============================================
  battery: {
    id: 'battery', name: 'Battery', category: 'sources',
    width: 70, height: 50,
    pins: [
      { id: 'positive', x: 0, y: 25, label: '+' },
      { id: 'negative', x: 70, y: 25, label: '−' }
    ],
    svg: (w, h, state) => {
      const voltage = (state && state.voltage) || 5;
      const midY = h / 2;
      // Professional multi-cell battery symbol
      return `
        <line x1="0" y1="${midY}" x2="${w*0.22}" y2="${midY}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
        <line x1="${w*0.22}" y1="${h*0.1}" x2="${w*0.22}" y2="${h*0.9}" stroke="var(--circuit-component)" stroke-width="3.5"/>
        <line x1="${w*0.32}" y1="${h*0.28}" x2="${w*0.32}" y2="${h*0.72}" stroke="var(--circuit-component)" stroke-width="1.8"/>
        <line x1="${w*0.42}" y1="${h*0.1}" x2="${w*0.42}" y2="${h*0.9}" stroke="var(--circuit-component)" stroke-width="3.5"/>
        <line x1="${w*0.52}" y1="${h*0.28}" x2="${w*0.52}" y2="${h*0.72}" stroke="var(--circuit-component)" stroke-width="1.8"/>
        <line x1="${w*0.62}" y1="${h*0.1}" x2="${w*0.62}" y2="${h*0.9}" stroke="var(--circuit-component)" stroke-width="3.5"/>
        <line x1="${w*0.72}" y1="${h*0.28}" x2="${w*0.72}" y2="${h*0.72}" stroke="var(--circuit-component)" stroke-width="1.8"/>
        <line x1="${w*0.72}" y1="${midY}" x2="${w}" y2="${midY}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
        <text x="${w*0.12}" y="${h*0.08}" fill="var(--circuit-accent)" font-size="12" text-anchor="middle" font-weight="bold">+</text>
        <text x="${w*0.82}" y="${h*0.08}" fill="var(--circuit-label)" font-size="12" text-anchor="middle" font-weight="bold">−</text>
        <text x="${w/2}" y="${h-1}" fill="var(--circuit-accent)" font-size="9" text-anchor="middle" font-weight="600">${voltage}V</text>
      `;
    }
  },

  dc_source: {
    id: 'dc_source', name: 'DC Source', category: 'sources',
    width: 60, height: 60,
    pins: [
      { id: 'positive', x: 30, y: 0, label: '+' },
      { id: 'negative', x: 30, y: 60, label: '−' }
    ],
    svg: (w, h) => `
      <circle cx="${w/2}" cy="${h/2}" r="${h*0.38}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>
      <text x="${w/2}" y="${h*0.42}" fill="var(--circuit-component)" font-size="10" text-anchor="middle">+</text>
      <line x1="${w*0.35}" y1="${h*0.6}" x2="${w*0.65}" y2="${h*0.6}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w/2}" y1="0" x2="${w/2}" y2="${h*0.12}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="${w/2}" y1="${h*0.88}" x2="${w/2}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  ac_source: {
    id: 'ac_source', name: 'AC Source', category: 'sources',
    width: 60, height: 60,
    pins: [
      { id: 'positive', x: 30, y: 0, label: '~1' },
      { id: 'negative', x: 30, y: 60, label: '~2' }
    ],
    svg: (w, h) => `
      <circle cx="${w/2}" cy="${h/2}" r="${h*0.38}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>
      <path d="M${w*0.3},${h/2} Q${w*0.4},${h*0.3} ${w/2},${h/2} Q${w*0.6},${h*0.7} ${w*0.7},${h/2}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w/2}" y1="0" x2="${w/2}" y2="${h*0.12}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="${w/2}" y1="${h*0.88}" x2="${w/2}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  ground: {
    id: 'ground', name: 'Ground', category: 'sources',
    width: 40, height: 40,
    pins: [
      { id: 'top', x: 20, y: 0, label: 'GND' }
    ],
    svg: (w, h) => `
      <line x1="${w/2}" y1="0" x2="${w/2}" y2="${h*0.4}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="${w*0.15}" y1="${h*0.4}" x2="${w*0.85}" y2="${h*0.4}" stroke="var(--circuit-component)" stroke-width="2.5"/>
      <line x1="${w*0.25}" y1="${h*0.58}" x2="${w*0.75}" y2="${h*0.58}" stroke="var(--circuit-component)" stroke-width="2"/>
      <line x1="${w*0.35}" y1="${h*0.76}" x2="${w*0.65}" y2="${h*0.76}" stroke="var(--circuit-component)" stroke-width="1.5"/>
    `
  },

  vcc: {
    id: 'vcc', name: 'VCC / Power', category: 'sources',
    width: 40, height: 40,
    pins: [
      { id: 'bottom', x: 20, y: 40, label: 'VCC' }
    ],
    svg: (w, h) => `
      <line x1="${w/2}" y1="${h*0.4}" x2="${w/2}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <polygon points="${w*0.2},${h*0.4} ${w/2},${h*0.1} ${w*0.8},${h*0.4}" fill="none" stroke="var(--circuit-accent)" stroke-width="2"/>
      <text x="${w/2}" y="${h*0.08}" fill="var(--circuit-label)" font-size="9" text-anchor="middle" font-weight="bold">VCC</text>
    `
  },

  // ============================================
  // LOGIC GATES
  // ============================================
  and_gate: {
    id: 'and_gate', name: 'AND Gate', category: 'logic',
    width: 100, height: 60,
    pins: [
      { id: 'a', x: 0, y: 18, label: 'A' },
      { id: 'b', x: 0, y: 42, label: 'B' },
      { id: 'out', x: 100, y: 30, label: 'Y' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h*0.3}" x2="${w*0.22}" y2="${h*0.3}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
      <line x1="0" y1="${h*0.7}" x2="${w*0.22}" y2="${h*0.7}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
      <path d="M${w*0.22},${h*0.08} L${w*0.48},${h*0.08} A${w*0.27},${h*0.42} 0 0,1 ${w*0.48},${h*0.92} L${w*0.22},${h*0.92} Z" fill="rgba(162,155,254,0.06)" stroke="var(--circuit-gate)" stroke-width="2.5" stroke-linejoin="round"/>
      <line x1="${w*0.75}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
    `
  },

  or_gate: {
    id: 'or_gate', name: 'OR Gate', category: 'logic',
    width: 100, height: 60,
    pins: [
      { id: 'a', x: 0, y: 18, label: 'A' },
      { id: 'b', x: 0, y: 42, label: 'B' },
      { id: 'out', x: 100, y: 30, label: 'Y' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h*0.3}" x2="${w*0.3}" y2="${h*0.3}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="0" y1="${h*0.7}" x2="${w*0.3}" y2="${h*0.7}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <path d="M${w*0.2},${h*0.1} Q${w*0.35},${h/2} ${w*0.2},${h*0.9} Q${w*0.55},${h*0.9} ${w*0.75},${h/2} Q${w*0.55},${h*0.1} ${w*0.2},${h*0.1} Z" fill="none" stroke="var(--circuit-gate)" stroke-width="2.5"/>
      <line x1="${w*0.75}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  not_gate: {
    id: 'not_gate', name: 'NOT Gate', category: 'logic',
    width: 80, height: 50,
    pins: [
      { id: 'in', x: 0, y: 25, label: 'A' },
      { id: 'out', x: 80, y: 25, label: 'Y' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h/2}" x2="${w*0.2}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <polygon points="${w*0.2},${h*0.1} ${w*0.7},${h/2} ${w*0.2},${h*0.9}" fill="none" stroke="var(--circuit-gate)" stroke-width="2.5"/>
      <circle cx="${w*0.76}" cy="${h/2}" r="${w*0.05}" fill="none" stroke="var(--circuit-gate)" stroke-width="2"/>
      <line x1="${w*0.82}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  nand_gate: {
    id: 'nand_gate', name: 'NAND Gate', category: 'logic',
    width: 100, height: 60,
    pins: [
      { id: 'a', x: 0, y: 18, label: 'A' },
      { id: 'b', x: 0, y: 42, label: 'B' },
      { id: 'out', x: 100, y: 30, label: 'Y' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h*0.3}" x2="${w*0.25}" y2="${h*0.3}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="0" y1="${h*0.7}" x2="${w*0.25}" y2="${h*0.7}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <path d="M${w*0.25},${h*0.1} L${w*0.5},${h*0.1} A${w*0.25},${h*0.4} 0 0,1 ${w*0.5},${h*0.9} L${w*0.25},${h*0.9} Z" fill="none" stroke="var(--circuit-gate)" stroke-width="2.5"/>
      <circle cx="${w*0.8}" cy="${h/2}" r="${w*0.04}" fill="none" stroke="var(--circuit-gate)" stroke-width="2"/>
      <line x1="${w*0.84}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  nor_gate: {
    id: 'nor_gate', name: 'NOR Gate', category: 'logic',
    width: 100, height: 60,
    pins: [
      { id: 'a', x: 0, y: 18, label: 'A' },
      { id: 'b', x: 0, y: 42, label: 'B' },
      { id: 'out', x: 100, y: 30, label: 'Y' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h*0.3}" x2="${w*0.3}" y2="${h*0.3}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="0" y1="${h*0.7}" x2="${w*0.3}" y2="${h*0.7}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <path d="M${w*0.2},${h*0.1} Q${w*0.35},${h/2} ${w*0.2},${h*0.9} Q${w*0.55},${h*0.9} ${w*0.7},${h/2} Q${w*0.55},${h*0.1} ${w*0.2},${h*0.1} Z" fill="none" stroke="var(--circuit-gate)" stroke-width="2.5"/>
      <circle cx="${w*0.76}" cy="${h/2}" r="${w*0.04}" fill="none" stroke="var(--circuit-gate)" stroke-width="2"/>
      <line x1="${w*0.8}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  xor_gate: {
    id: 'xor_gate', name: 'XOR Gate', category: 'logic',
    width: 100, height: 60,
    pins: [
      { id: 'a', x: 0, y: 18, label: 'A' },
      { id: 'b', x: 0, y: 42, label: 'B' },
      { id: 'out', x: 100, y: 30, label: 'Y' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h*0.3}" x2="${w*0.3}" y2="${h*0.3}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="0" y1="${h*0.7}" x2="${w*0.3}" y2="${h*0.7}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <path d="M${w*0.15},${h*0.1} Q${w*0.3},${h/2} ${w*0.15},${h*0.9}" fill="none" stroke="var(--circuit-gate)" stroke-width="2"/>
      <path d="M${w*0.2},${h*0.1} Q${w*0.35},${h/2} ${w*0.2},${h*0.9} Q${w*0.55},${h*0.9} ${w*0.75},${h/2} Q${w*0.55},${h*0.1} ${w*0.2},${h*0.1} Z" fill="none" stroke="var(--circuit-gate)" stroke-width="2.5"/>
      <line x1="${w*0.75}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  xnor_gate: {
    id: 'xnor_gate', name: 'XNOR Gate', category: 'logic',
    width: 100, height: 60,
    pins: [
      { id: 'a', x: 0, y: 18, label: 'A' },
      { id: 'b', x: 0, y: 42, label: 'B' },
      { id: 'out', x: 100, y: 30, label: 'Y' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h*0.3}" x2="${w*0.3}" y2="${h*0.3}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="0" y1="${h*0.7}" x2="${w*0.3}" y2="${h*0.7}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <path d="M${w*0.15},${h*0.1} Q${w*0.3},${h/2} ${w*0.15},${h*0.9}" fill="none" stroke="var(--circuit-gate)" stroke-width="2"/>
      <path d="M${w*0.2},${h*0.1} Q${w*0.35},${h/2} ${w*0.2},${h*0.9} Q${w*0.55},${h*0.9} ${w*0.7},${h/2} Q${w*0.55},${h*0.1} ${w*0.2},${h*0.1} Z" fill="none" stroke="var(--circuit-gate)" stroke-width="2.5"/>
      <circle cx="${w*0.76}" cy="${h/2}" r="${w*0.04}" fill="none" stroke="var(--circuit-gate)" stroke-width="2"/>
      <line x1="${w*0.8}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  buffer: {
    id: 'buffer', name: 'Buffer', category: 'logic',
    width: 80, height: 50,
    pins: [
      { id: 'in', x: 0, y: 25, label: 'A' },
      { id: 'out', x: 80, y: 25, label: 'Y' }
    ],
    svg: (w, h) => `
      <line x1="0" y1="${h/2}" x2="${w*0.2}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <polygon points="${w*0.2},${h*0.1} ${w*0.75},${h/2} ${w*0.2},${h*0.9}" fill="none" stroke="var(--circuit-gate)" stroke-width="2.5"/>
      <line x1="${w*0.75}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  // ============================================
  // MEASUREMENT
  // ============================================
  voltmeter: {
    id: 'voltmeter', name: 'Voltmeter', category: 'measurement',
    width: 60, height: 60,
    pins: [
      { id: 'positive', x: 30, y: 0, label: '+' },
      { id: 'negative', x: 30, y: 60, label: '−' }
    ],
    svg: (w, h) => `
      <circle cx="${w/2}" cy="${h/2}" r="${h*0.38}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>
      <text x="${w/2}" y="${h*0.58}" fill="var(--circuit-accent)" font-size="18" text-anchor="middle" font-weight="bold">V</text>
      <line x1="${w/2}" y1="0" x2="${w/2}" y2="${h*0.12}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="${w/2}" y1="${h*0.88}" x2="${w/2}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  ammeter: {
    id: 'ammeter', name: 'Ammeter', category: 'measurement',
    width: 60, height: 60,
    pins: [
      { id: 'positive', x: 30, y: 0, label: '+' },
      { id: 'negative', x: 30, y: 60, label: '−' }
    ],
    svg: (w, h) => `
      <circle cx="${w/2}" cy="${h/2}" r="${h*0.38}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>
      <text x="${w/2}" y="${h*0.58}" fill="var(--circuit-accent)" font-size="18" text-anchor="middle" font-weight="bold">A</text>
      <line x1="${w/2}" y1="0" x2="${w/2}" y2="${h*0.12}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="${w/2}" y1="${h*0.88}" x2="${w/2}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  // ============================================
  // SWITCHES
  // ============================================
  switch_spst: {
    id: 'switch_spst', name: 'Switch (SPST)', category: 'switches',
    width: 80, height: 40,
    pins: [
      { id: 'left', x: 0, y: 20, label: '1' },
      { id: 'right', x: 80, y: 20, label: '2' }
    ],
    svg: (w, h, state) => {
      const closed = state && state.switchClosed;
      const armEndX = w * 0.68;
      const armEndY = closed ? h / 2 : h * 0.15;
      const stateColor = closed ? 'var(--circuit-accent)' : 'var(--circuit-component)';
      return `
        <line x1="0" y1="${h/2}" x2="${w*0.25}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
        <circle cx="${w*0.28}" cy="${h/2}" r="5" fill="none" stroke="${stateColor}" stroke-width="2.5"/>
        <circle cx="${w*0.28}" cy="${h/2}" r="2" fill="${stateColor}"/>
        <line x1="${w*0.32}" y1="${h/2}" x2="${armEndX}" y2="${armEndY}" stroke="${stateColor}" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${w*0.72}" cy="${h/2}" r="5" fill="none" stroke="${stateColor}" stroke-width="2.5"/>
        <circle cx="${w*0.72}" cy="${h/2}" r="2" fill="${stateColor}"/>
        <line x1="${w*0.75}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
        <text x="${w/2}" y="${h-1}" fill="${stateColor}" font-size="8" text-anchor="middle" font-weight="600">${closed ? 'ON' : 'OFF'}</text>
      `;
    }
  },

  switch_spdt: {
    id: 'switch_spdt', name: 'Switch (SPDT)', category: 'switches',
    width: 80, height: 60,
    pins: [
      { id: 'common', x: 0, y: 30, label: 'C' },
      { id: 'no', x: 80, y: 15, label: 'NO' },
      { id: 'nc', x: 80, y: 45, label: 'NC' }
    ],
    svg: (w, h, state) => {
      const pos = (state && state.switchPosition) || 'no'; // 'no' or 'nc'
      const targetY = pos === 'nc' ? h*0.75 : h*0.25;
      const activeColor = 'var(--circuit-accent)';
      return `
        <line x1="0" y1="${h/2}" x2="${w*0.25}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
        <circle cx="${w*0.28}" cy="${h/2}" r="4" fill="${activeColor}" stroke="${activeColor}" stroke-width="1"/>
        <line x1="${w*0.3}" y1="${h/2}" x2="${w*0.68}" y2="${targetY}" stroke="${activeColor}" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${w*0.72}" cy="${h*0.25}" r="4" fill="${pos === 'no' ? activeColor : 'var(--circuit-component)'}" stroke="var(--circuit-component)" stroke-width="1"/>
        <circle cx="${w*0.72}" cy="${h*0.75}" r="4" fill="${pos === 'nc' ? activeColor : 'var(--circuit-component)'}" stroke="var(--circuit-component)" stroke-width="1"/>
        <line x1="${w*0.75}" y1="${h*0.25}" x2="${w}" y2="${h*0.25}" stroke="var(--circuit-wire)" stroke-width="2"/>
        <line x1="${w*0.75}" y1="${h*0.75}" x2="${w}" y2="${h*0.75}" stroke="var(--circuit-wire)" stroke-width="2"/>
        <text x="${w/2}" y="${h-2}" fill="var(--circuit-label)" font-size="8" text-anchor="middle" opacity="0.6">${pos === 'nc' ? 'NC' : 'NO'}</text>
      `;
    }
  },

  pushbutton: {
    id: 'pushbutton', name: 'Push Button', category: 'switches',
    width: 80, height: 40,
    pins: [
      { id: 'left', x: 0, y: 20, label: '1' },
      { id: 'right', x: 80, y: 20, label: '2' }
    ],
    svg: (w, h, state) => {
      const pressed = state && state.switchClosed;
      const barY = pressed ? h*0.55 : h*0.35;
      const stateColor = pressed ? 'var(--circuit-accent)' : 'var(--circuit-component)';
      return `
        <line x1="0" y1="${h*0.7}" x2="${w*0.25}" y2="${h*0.7}" stroke="var(--circuit-wire)" stroke-width="2"/>
        <circle cx="${w*0.28}" cy="${h*0.7}" r="3" fill="${stateColor}"/>
        <circle cx="${w*0.72}" cy="${h*0.7}" r="3" fill="${stateColor}"/>
        <line x1="${w*0.75}" y1="${h*0.7}" x2="${w}" y2="${h*0.7}" stroke="var(--circuit-wire)" stroke-width="2"/>
        <line x1="${w*0.28}" y1="${h*0.7}" x2="${w*0.28}" y2="${barY}" stroke="${stateColor}" stroke-width="1.5"/>
        <line x1="${w*0.72}" y1="${h*0.7}" x2="${w*0.72}" y2="${barY}" stroke="${stateColor}" stroke-width="1.5"/>
        <line x1="${w*0.2}" y1="${barY}" x2="${w*0.8}" y2="${barY}" stroke="${stateColor}" stroke-width="2.5"/>
        ${!pressed ? `<line x1="${w/2}" y1="${barY}" x2="${w/2}" y2="${h*0.1}" stroke="var(--circuit-component)" stroke-width="1.5"/>
        <polygon points="${w*0.45},${h*0.15} ${w*0.55},${h*0.15} ${w/2},${h*0.25}" fill="var(--circuit-component)"/>` : ''}
        <text x="${w/2}" y="${h-1}" fill="var(--circuit-label)" font-size="7" text-anchor="middle" opacity="0.5">${pressed ? 'PRESSED' : 'BTN'}</text>
      `;
    }
  },

  // ============================================
  // IC / DIGITAL
  // ============================================
  ic_chip: {
    id: 'ic_chip', name: 'IC Chip (8-pin)', category: 'digital',
    width: 120, height: 100,
    pins: [
      { id: 'p1', x: 0, y: 20, label: '1' },
      { id: 'p2', x: 0, y: 40, label: '2' },
      { id: 'p3', x: 0, y: 60, label: '3' },
      { id: 'p4', x: 0, y: 80, label: '4' },
      { id: 'p5', x: 120, y: 80, label: '5' },
      { id: 'p6', x: 120, y: 60, label: '6' },
      { id: 'p7', x: 120, y: 40, label: '7' },
      { id: 'p8', x: 120, y: 20, label: '8' }
    ],
    svg: (w, h) => {
      let pinLines = '';
      // Left pins
      for (let i = 0; i < 4; i++) {
        const y = h * (0.2 + i * 0.2);
        pinLines += `<line x1="0" y1="${y}" x2="${w*0.15}" y2="${y}" stroke="var(--circuit-wire)" stroke-width="2"/>`;
        pinLines += `<text x="${w*0.2}" y="${y+4}" fill="var(--circuit-label)" font-size="9">${i+1}</text>`;
      }
      // Right pins
      for (let i = 0; i < 4; i++) {
        const y = h * (0.8 - i * 0.2);
        pinLines += `<line x1="${w*0.85}" y1="${y}" x2="${w}" y2="${y}" stroke="var(--circuit-wire)" stroke-width="2"/>`;
        pinLines += `<text x="${w*0.74}" y="${y+4}" fill="var(--circuit-label)" font-size="9">${i+5}</text>`;
      }
      return `
        <rect x="${w*0.15}" y="${h*0.08}" width="${w*0.7}" height="${h*0.84}" fill="none" stroke="var(--circuit-component)" stroke-width="2" rx="4"/>
        <path d="M${w*0.45},${h*0.08} A${w*0.05},${h*0.05} 0 0,1 ${w*0.55},${h*0.08}" fill="none" stroke="var(--circuit-component)" stroke-width="1.5"/>
        <text x="${w/2}" y="${h*0.55}" fill="var(--circuit-accent)" font-size="11" text-anchor="middle" font-weight="600">IC</text>
        ${pinLines}
      `;
    }
  },

  clock: {
    id: 'clock', name: 'Clock Source', category: 'digital',
    width: 60, height: 50,
    pins: [
      { id: 'out', x: 60, y: 25, label: 'CLK' }
    ],
    svg: (w, h) => `
      <rect x="${w*0.08}" y="${h*0.12}" width="${w*0.7}" height="${h*0.76}" fill="none" stroke="var(--circuit-component)" stroke-width="2" rx="6"/>
      <path d="M${w*0.2},${h*0.6} L${w*0.3},${h*0.6} L${w*0.3},${h*0.35} L${w*0.45},${h*0.35} L${w*0.45},${h*0.6} L${w*0.55},${h*0.6} L${w*0.55},${h*0.35} L${w*0.65},${h*0.35}" fill="none" stroke="var(--circuit-accent)" stroke-width="1.5"/>
      <line x1="${w*0.78}" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  // ============================================
  // CONNECTORS
  // ============================================
  junction: {
    id: 'junction', name: 'Wire Junction', category: 'connectors',
    width: 20, height: 20,
    pins: [
      { id: 'top', x: 10, y: 0, label: '' },
      { id: 'right', x: 20, y: 10, label: '' },
      { id: 'bottom', x: 10, y: 20, label: '' },
      { id: 'left', x: 0, y: 10, label: '' }
    ],
    svg: (w, h) => `
      <circle cx="${w/2}" cy="${h/2}" r="${w*0.25}" fill="var(--circuit-component)"/>
      <line x1="${w/2}" y1="0" x2="${w/2}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2"/>
      <line x1="0" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  terminal: {
    id: 'terminal', name: 'Terminal', category: 'connectors',
    width: 30, height: 30,
    pins: [
      { id: 'pin', x: 15, y: 30, label: '' }
    ],
    svg: (w, h) => `
      <circle cx="${w/2}" cy="${h*0.4}" r="${w*0.3}" fill="none" stroke="var(--circuit-component)" stroke-width="2"/>
      <circle cx="${w/2}" cy="${h*0.4}" r="${w*0.12}" fill="var(--circuit-accent)"/>
      <line x1="${w/2}" y1="${h*0.7}" x2="${w/2}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2"/>
    `
  },

  // ============================================
  // INDICATORS / OUTPUT
  // ============================================
  bulb: {
    id: 'bulb', name: 'Light Bulb', category: 'indicators',
    width: 60, height: 70,
    pins: [
      { id: 'anode', x: 20, y: 70, label: '+' },
      { id: 'cathode', x: 40, y: 70, label: '−' }
    ],
    svg: (w, h, state) => {
      const isOn = state && state.powered;
      const glowColor = isOn ? '#ffdd32' : 'none';
      const filamentColor = isOn ? '#ffdd32' : 'var(--circuit-component)';
      const bulbFill = isOn ? 'rgba(255, 221, 50, 0.12)' : 'none';
      const cx = w / 2;
      const cy = h * 0.38;
      const r = w * 0.34;
      // IEC standard bulb: circle with X cross
      return `
        ${isOn ? `<circle cx="${cx}" cy="${cy}" r="${r * 1.4}" fill="rgba(255,221,50,0.06)"/>` : ''}
        ${isOn ? `<circle cx="${cx}" cy="${cy}" r="${r * 1.2}" fill="rgba(255,221,50,0.1)"/>` : ''}
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bulbFill}" stroke="var(--circuit-component)" stroke-width="2.5"/>
        <line x1="${cx - r * 0.65}" y1="${cy - r * 0.65}" x2="${cx + r * 0.65}" y2="${cy + r * 0.65}" stroke="${filamentColor}" stroke-width="2" stroke-linecap="round"/>
        <line x1="${cx + r * 0.65}" y1="${cy - r * 0.65}" x2="${cx - r * 0.65}" y2="${cy + r * 0.65}" stroke="${filamentColor}" stroke-width="2" stroke-linecap="round"/>
        <line x1="${w * 0.33}" y1="${h * 0.7}" x2="${w * 0.33}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
        <line x1="${w * 0.67}" y1="${h * 0.7}" x2="${w * 0.67}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
        ${isOn ? `<text x="${cx}" y="${h * 0.06}" fill="#ffdd32" font-size="9" text-anchor="middle" font-weight="bold">ON</text>` : ''}
      `;
    }
  },

  led_indicator: {
    id: 'led_indicator', name: 'LED Indicator', category: 'indicators',
    width: 40, height: 50,
    pins: [
      { id: 'anode', x: 20, y: 50, label: '+' },
    ],
    svg: (w, h, state) => {
      const isOn = state && state.powered;
      const color = isOn ? '#55efc4' : 'var(--circuit-component)';
      return `
        ${isOn ? `<circle cx="${w/2}" cy="${h*0.35}" r="${w*0.45}" fill="rgba(85,239,196,0.1)"/>` : ''}
        <circle cx="${w/2}" cy="${h*0.35}" r="${w*0.3}" fill="${isOn ? 'rgba(85,239,196,0.3)' : 'none'}" stroke="${color}" stroke-width="2"/>
        <circle cx="${w/2}" cy="${h*0.35}" r="${w*0.15}" fill="${color}"/>
        <line x1="${w/2}" y1="${h*0.65}" x2="${w/2}" y2="${h}" stroke="var(--circuit-wire)" stroke-width="2"/>
        ${isOn ? `<text x="${w/2}" y="${h*0.1}" fill="${color}" font-size="8" text-anchor="middle" font-weight="bold">●</text>` : ''}
      `;
    }
  },

  // ============================================
  // LOGIC INPUT
  // ============================================
  logic_input: {
    id: 'logic_input', name: 'Logic Input', category: 'logic',
    width: 55, height: 44,
    pins: [
      { id: 'out', x: 55, y: 22, label: 'Q' }
    ],
    svg: (w, h, state) => {
      const val = state && state.logicValue ? 1 : 0;
      const color = val ? 'var(--circuit-accent)' : 'var(--circuit-component)';
      const bgFill = val ? 'rgba(85,239,196,0.12)' : 'rgba(255,255,255,0.03)';
      return `
        <rect x="2" y="2" width="${w - 16}" height="${h - 4}" rx="8" fill="${bgFill}" stroke="${color}" stroke-width="2.5"/>
        <text x="${(w - 12) / 2}" y="${h / 2 + 7}" fill="${color}" font-size="22" text-anchor="middle" font-weight="800" font-family="monospace">${val}</text>
        <line x1="${w - 12}" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="var(--circuit-wire)" stroke-width="2.5"/>
        <circle cx="${w - 12}" cy="${h / 2}" r="3" fill="${color}"/>
      `;
    }
  }
};
// ============================================
// Category Definitions
// ============================================
const CircuitCategories = {
  passive: { name: 'Passive', icon: '⚡', color: '#4ecdc4' },
  active: { name: 'Active', icon: '🔌', color: '#ff6b6b' },
  sources: { name: 'Sources', icon: '🔋', color: '#ffd93d' },
  logic: { name: 'Logic Gates', icon: '🔲', color: '#6c5ce7' },
  indicators: { name: 'Indicators', icon: '💡', color: '#ffdd32' },
  measurement: { name: 'Measurement', icon: '📊', color: '#00b894' },
  switches: { name: 'Switches', icon: '🔀', color: '#fdcb6e' },
  digital: { name: 'Digital / IC', icon: '💻', color: '#0984e3' },
  connectors: { name: 'Connectors', icon: '🔗', color: '#636e72' }
};

// ============================================
// Circuit Panel State
// ============================================
let circuitPanelOpen = false;
let circuitPanelSearch = '';
let circuitActiveCategory = 'all';

// ============================================
// Circuit Panel UI
// ============================================
function toggleCircuitPanel() {
  circuitPanelOpen = !circuitPanelOpen;
  const panel = document.getElementById('circuitComponentPanel');
  if (panel) {
    panel.classList.toggle('open', circuitPanelOpen);
  } else if (circuitPanelOpen) {
    createCircuitPanel();
  }
  
  // Update toolbar button state
  const btn = document.querySelector('[data-tool="circuit"]');
  if (btn) btn.classList.toggle('active', circuitPanelOpen);
}

function createCircuitPanel() {
  const overlay = document.getElementById('gripDiagramOverlay');
  if (!overlay) return;

  const panel = document.createElement('div');
  panel.id = 'circuitComponentPanel';
  panel.className = 'circuit-panel open';
  panel.innerHTML = getCircuitPanelHTML();
  overlay.appendChild(panel);

  // Prevent whiteboard interactions when clicking panel
  panel.addEventListener('mousedown', e => e.stopPropagation());
  panel.addEventListener('wheel', e => e.stopPropagation());
}

function getCircuitPanelHTML() {
  const categories = Object.entries(CircuitCategories);
  const components = Object.values(CircuitComponents);

  // Filter by search
  let filtered = components;
  if (circuitPanelSearch) {
    const q = circuitPanelSearch.toLowerCase();
    filtered = components.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.category.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  }

  // Filter by category
  if (circuitActiveCategory !== 'all') {
    filtered = filtered.filter(c => c.category === circuitActiveCategory);
  }

  // Group by category
  const grouped = {};
  filtered.forEach(c => {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  });

  return `
    <div class="circuit-panel-header">
      <div class="circuit-panel-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
        <span>Circuit Components</span>
      </div>
      <button class="circuit-panel-close" onclick="toggleCircuitPanel()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    
    <div class="circuit-panel-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <input type="text" placeholder="Search components..." value="${circuitPanelSearch}" 
             oninput="circuitPanelSearch = this.value; refreshCircuitPanel();" />
    </div>
    
    <div class="circuit-category-tabs">
      <button class="circuit-cat-tab ${circuitActiveCategory === 'all' ? 'active' : ''}" 
              onclick="circuitActiveCategory = 'all'; refreshCircuitPanel();">All</button>
      ${categories.map(([id, cat]) => `
        <button class="circuit-cat-tab ${circuitActiveCategory === id ? 'active' : ''}" 
                onclick="circuitActiveCategory = '${id}'; refreshCircuitPanel();"
                style="--cat-color: ${cat.color}">
          <span class="circuit-cat-icon">${cat.icon}</span>
          ${cat.name}
        </button>
      `).join('')}
    </div>
    
    <div class="circuit-panel-body">
      ${Object.entries(grouped).map(([catId, comps]) => {
        const cat = CircuitCategories[catId];
        return `
          <div class="circuit-category-section">
            <div class="circuit-category-header" style="--cat-color: ${cat.color}">
              <span class="circuit-cat-dot" style="background: ${cat.color}"></span>
              ${cat.name}
              <span class="circuit-cat-count">${comps.length}</span>
            </div>
            <div class="circuit-component-grid">
              ${comps.map(comp => `
                <div class="circuit-component-card" 
                     onclick="placeCircuitComponent('${comp.id}')"
                     title="${comp.name}"
                     draggable="true"
                     ondragstart="event.dataTransfer.setData('text/plain', '${comp.id}')">
                  <div class="circuit-component-preview">
                    <svg width="${Math.min(comp.width, 80)}" height="${Math.min(comp.height, 60)}" viewBox="0 0 ${comp.width} ${comp.height}">
                      <defs>
                        <marker id="circuitArrowSmall" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <path d="M0,0 L6,3 L0,6" fill="var(--circuit-accent)"/>
                        </marker>
                      </defs>
                      ${typeof comp.svg === 'function' ? comp.svg(comp.width, comp.height) : comp.svg}
                    </svg>
                  </div>
                  <span class="circuit-component-name">${comp.name}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
      ${Object.keys(grouped).length === 0 ? '<div class="circuit-empty">No components found</div>' : ''}
    </div>
  `;
}

function refreshCircuitPanel() {
  const panel = document.getElementById('circuitComponentPanel');
  if (panel) {
    panel.innerHTML = getCircuitPanelHTML();
  }
}

// ============================================
// Place Circuit Component on Canvas
// ============================================
function placeCircuitComponent(componentId) {
  const comp = CircuitComponents[componentId];
  if (!comp) return;

  // Calculate center of viewport in world coords
  const centerX = (window.innerWidth / 2 - GripState.offsetX) / GripState.scale;
  const centerY = (window.innerHeight / 2 - GripState.offsetY) / GripState.scale;

  const node = {
    id: generateUUID(),
    type: 'circuit',
    circuitType: componentId,
    x: snapToGrid(centerX - comp.width / 2),
    y: snapToGrid(centerY - comp.height / 2),
    width: comp.width,
    height: comp.height,
    text: comp.name,
    style: {},
    pins: comp.pins.map(p => ({ ...p })),
    labelText: '',
    circuitState: {}
  };

  GripState.nodes.push(node);
  GripState.selectedNodeIds.clear();
  GripState.selectedNodeIds.add(node.id);
  pushToHistory();
  saveGripDataInstant();
  renderCanvas();

  // Broadcast
  broadcastNodeOperation('add', node.id, node);

  // Close panel if in mobile
  if (window.innerWidth < 768) {
    toggleCircuitPanel();
  }
}

// ============================================
// Render Circuit Node HTML
// ============================================
function renderCircuitNodeHTML(node, isSelected) {
  const comp = CircuitComponents[node.circuitType];
  if (!comp) return renderNodeHTML(node, isSelected); // Fallback

  const style = node.style || {};
  const opacity = style.opacity !== undefined ? style.opacity : 1;
  const selectedClass = isSelected ? 'selected' : '';
  const w = node.width;
  const h = node.height;

  const rotation = node.rotation || 0;
  // Render connection pins
  const pinsHTML = (node.pins || comp.pins).map((pin, idx) => {
    const isConnected = GripState.edges.some(e => {
      const matchFrom = e.from === node.id && e.fromHandle === pin.id;
      const matchTo = e.to === node.id && e.toHandle === pin.id;
      return matchFrom || matchTo;
    });

    const connectionSummary = getCircuitPinConnectionSummary(node.id, pin.id);
    const pinTitle = connectionSummary || (pin.label || pin.id);

    // Evaluate signal state for this pin
    let signalState = false;
    let isOutputPin = false;
    
    // Check if this is an output pin
    if (pin.id === 'out' || pin.id === 'y' || pin.id === 'Q') {
      isOutputPin = true;
      signalState = evaluateCircuitSignal(node.id, new Set());
    } else {
      // For input pins, check connected nodes
      const connectedEdges = GripState.edges.filter(e => 
        (e.to === node.id && e.toHandle === pin.id) ||
        (e.from === node.id && e.fromHandle === pin.id)
      );
      
      for (const edge of connectedEdges) {
        const otherNodeId = edge.from === node.id ? edge.to : edge.from;
        if (evaluateCircuitSignal(otherNodeId, new Set())) {
          signalState = true;
          break;
        }
      }
    }

    const signalClass = signalState ? 'signal-high' : 'signal-low';
    const pinStateClass = isConnected ? `connected ${signalClass}` : signalClass;

    // Calculate rotated pin position
    let rotatedPinX = pin.x;
    let rotatedPinY = pin.y;
    
    if (rotation !== 0) {
      const cx = w / 2; // Center of rotation
      const cy = h / 2;
      const rad = (rotation * Math.PI) / 180;
      const dx = pin.x - cx;
      const dy = pin.y - cy;
      
      rotatedPinX = cx + (dx * Math.cos(rad) - dy * Math.sin(rad));
      rotatedPinY = cy + (dx * Math.sin(rad) + dy * Math.cos(rad));
    }

    return `
      <div class="circuit-pin ${pinStateClass}" 
           style="left: ${rotatedPinX}px; top: ${rotatedPinY}px;"
           data-node-id="${node.id}"
           data-pin-id="${pin.id}"
           data-position="${pin.id}"
           data-signal="${signalState ? '1' : '0'}"
           title="${pinTitle}">
        <div class="circuit-pin-dot"></div>
        ${pin.label ? `<span class="circuit-pin-label">${pin.label}</span>` : ''}
      </div>
    `;
  }).join('');

  // Label
  const labelHTML = node.labelText ? `<div class="circuit-node-label">${node.labelText}</div>` : '';

  // Toolbar for selected
  // Extra toolbar buttons for switches and logic inputs
  const isSwitch = ['switch_spst', 'switch_spdt', 'pushbutton'].includes(node.circuitType);
  const isLogicInput = node.circuitType === 'logic_input';
  const switchState = node.circuitState || {};
  let extraButtons = '';
  if (isSwitch) {
    const isOn = node.circuitType === 'switch_spdt' ? switchState.switchPosition === 'nc' : !!switchState.switchClosed;
    extraButtons = `
      <div class="grip-action-btn circuit-toggle-btn ${isOn ? 'active' : ''}" title="Toggle ${isOn ? 'OFF' : 'ON'}" onclick="toggleCircuitSwitch('${node.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v6M4.22 4.22l4.24 4.24M1 12h6M4.22 19.78l4.24-4.24"/></svg>
        <span class="circuit-toggle-label">${isOn ? 'ON' : 'OFF'}</span>
      </div>`;
  }
  if (isLogicInput) {
    const val = switchState.logicValue ? 1 : 0;
    extraButtons = `
      <div class="grip-action-btn circuit-toggle-btn ${val ? 'active' : ''}" title="Toggle ${val ? '0' : '1'}" onclick="toggleCircuitSwitch('${node.id}')">
        <span class="circuit-toggle-label" style="font-weight:800;font-family:monospace;font-size:14px;">${val}</span>
      </div>`;
  }

  const toolbar = isSelected ? `
    <div class="grip-node-toolbar circuit-toolbar">
      <div class="grip-action-btn drag-handle" title="Move" data-node-id="${node.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M19 9l3 3-3 3M9 19l3 3 3-3M2 12h20M12 2v20"/></svg>
      </div>
      ${extraButtons}
      <div class="grip-action-btn" title="Rotate 90°" onclick="rotateCircuitNode('${node.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/></svg>
      </div>
      <div class="grip-action-btn" title="Edit Label" onclick="editCircuitLabel('${node.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </div>
      <div class="grip-action-btn delete" title="Delete" onclick="deleteNode('${node.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </div>
    </div>
  ` : '';

  // Generate SVG content (with state for indicators)
  const nodeState = getCircuitNodeState(node);
  const svgContent = typeof comp.svg === 'function' 
    ? (comp.svg.length >= 3 ? comp.svg(w, h, nodeState) : comp.svg(w, h))
    : comp.svg;

  return `
    <div class="grip-node circuit-node ${selectedClass}" 
         style="transform: translate(${node.x}px, ${node.y}px); width: ${w}px; height: ${h}px; opacity: ${opacity};"
         data-id="${node.id}" data-element-id="node-${node.id}" data-circuit-type="${node.circuitType}">
      <div class="circuit-node-inner" style="transform: rotate(${rotation}deg);">
        <svg class="circuit-svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <marker id="circuitArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="var(--circuit-accent)"/>
            </marker>
          </defs>
          ${svgContent}
          <!-- Counter-rotate text elements to keep them upright -->
          ${rotation !== 0 ? `
            <style>
              .circuit-node[data-id="${node.id}"] .circuit-svg text {
                transform: rotate(${-rotation}deg);
                transform-origin: center;
              }
            </style>
          ` : ''}
        </svg>
        ${pinsHTML}
      </div>
      ${labelHTML}
      ${toolbar}
      ${isSelected ? renderResizeHandles(node.id) : ''}
    </div>
  `;
}

// ============================================
// Circuit Interactions
// ============================================
function toggleCircuitSwitch(nodeId) {
  const node = GripState.nodes.find(n => n.id === nodeId);
  if (!node || node.type !== 'circuit') return;
  if (!node.circuitState) node.circuitState = {};
  const ct = node.circuitType;
  
  if (ct === 'switch_spst' || ct === 'pushbutton') {
    node.circuitState.switchClosed = !node.circuitState.switchClosed;
  } else if (ct === 'switch_spdt') {
    node.circuitState.switchPosition = (node.circuitState.switchPosition === 'nc') ? 'no' : 'nc';
  } else if (ct === 'logic_input') {
    node.circuitState.logicValue = !node.circuitState.logicValue;
  }
  
  pushToHistory();
  saveGripDataInstant();
  updateAllPinSignals();
  renderCanvas();
}
function rotateCircuitNode(nodeId) {
  const node = GripState.nodes.find(n => n.id === nodeId);
  if (!node || node.type !== 'circuit') return;

  node.rotation = ((node.rotation || 0) + 90) % 360;

  // Rotate pin positions
  const comp = CircuitComponents[node.circuitType];
  if (comp && node.pins) {
    const cx = node.width / 2;
    const cy = node.height / 2;

    node.pins = node.pins.map((pin, i) => {
      const origPin = comp.pins[i];
      const rad = (node.rotation * Math.PI) / 180;
      const dx = origPin.x - cx;
      const dy = origPin.y - cy;
      return {
        ...pin,
        x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
      };
    });
  }

  pushToHistory();
  saveGripDataInstant();
  renderCanvas();
}

function editCircuitLabel(nodeId) {
  const node = GripState.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const label = prompt('Component Label:', node.labelText || node.text || '');
  if (label !== null) {
    node.labelText = label;
    saveGripDataInstant();
    renderCanvas();
  }
}

// ============================================
// Pin Connection Handling
// ============================================
function handleCircuitPinClick(nodeId, pinId, event) {
  event.stopPropagation();
  event.preventDefault();
  
  const node = GripState.nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  const comp = CircuitComponents[node.circuitType];
  const pins = node.pins || (comp ? comp.pins : []);
  const pin = pins.find(p => p.id === pinId);
  if (!pin) return;
  
  // Use exact pin position (node position + pin offset)
  const exactPos = { x: node.x + pin.x, y: node.y + pin.y };
  
  if (GripState.isConnecting) {
    // Complete connection
    if (nodeId !== GripState.connectionStartNodeId) {
      createEdge(GripState.connectionStartNodeId, GripState.connectionStartHandle, nodeId, pinId);
    }
    GripState.isConnecting = false;
    document.getElementById('gripTempConnection').innerHTML = '';
  } else {
    // Start connection from this exact pin
    startConnection(nodeId, pinId, exactPos);
  }
}

// Override getNodeHandlePos for circuit nodes
const originalGetNodeHandlePos = typeof getNodeHandlePos === 'function' ? getNodeHandlePos : null;

function getCircuitPinPos(node, handleId) {
  if (node.type === 'circuit') {
    const comp = CircuitComponents[node.circuitType];
    const pins = node.pins || (comp ? comp.pins : []);
    const pin = pins.find(p => p.id === handleId);
    if (pin) {
      return { x: node.x + pin.x, y: node.y + pin.y };
    }
  }
  // Fallback to standard handle positions
  return null;
}

function getCircuitNodeDisplayName(node) {
  if (!node) return 'Unknown';
  if (node.type === 'circuit') {
    const comp = CircuitComponents[node.circuitType];
    return comp?.name || node.text || node.circuitType || 'Circuit';
  }
  return node.text || node.type || 'Node';
}

function getCircuitPinDisplayName(node, pinId) {
  if (!node) return pinId;

  if (node.type === 'circuit') {
    const comp = CircuitComponents[node.circuitType];
    const pins = node.pins || comp?.pins || [];
    const pin = pins.find(p => p.id === pinId);
    return pin?.label || pin?.id || pinId;
  }

  return pinId;
}

function getCircuitPinConnectionSummary(nodeId, pinId) {
  if (!GripState?.edges || GripState.edges.length === 0) return '';

  const edges = GripState.edges.filter(e =>
    (e.from === nodeId && e.fromHandle === pinId) ||
    (e.to === nodeId && e.toHandle === pinId)
  );

  if (edges.length === 0) return '';

  const selfNode = GripState.nodes.find(n => n.id === nodeId);
  const selfName = getCircuitNodeDisplayName(selfNode);
  const selfPin = getCircuitPinDisplayName(selfNode, pinId);

  const targets = edges.map(e => {
    const otherId = e.from === nodeId ? e.to : e.from;
    const otherHandle = e.from === nodeId ? e.toHandle : e.fromHandle;
    const otherNode = GripState.nodes.find(n => n.id === otherId);
    const otherName = getCircuitNodeDisplayName(otherNode);
    const otherPin = getCircuitPinDisplayName(otherNode, otherHandle);
    return `${otherName}(${otherPin})`;
  });

  return `${selfName}(${selfPin}) ↔ ${targets.join(', ')}`;
}

function disconnectCircuitPin(nodeId, pinId) {
  const edgesToRemove = (GripState.edges || []).filter(e =>
    (e.from === nodeId && e.fromHandle === pinId) ||
    (e.to === nodeId && e.toHandle === pinId)
  );

  if (edgesToRemove.length === 0) return;

  GripState.edges = (GripState.edges || []).filter(e => !edgesToRemove.includes(e));

  edgesToRemove.forEach(e => {
    if (typeof broadcastEdgeOperation === 'function') {
      broadcastEdgeOperation('delete', e.id);
    }
  });

  if (typeof pushToHistory === 'function') pushToHistory();
  if (typeof saveGripDataInstant === 'function') saveGripDataInstant();
  if (typeof renderCanvas === 'function') renderCanvas();
}

// ============================================
// Circuit Simulation Engine
// Evaluates logic gates and determines bulb/indicator state
// ============================================
function getCircuitNodeState(node) {
  if (!node || node.type !== 'circuit') return {};
  const ct = node.circuitType;
  const cs = node.circuitState || {};
  
  // Switches return their toggle state
  if (ct === 'switch_spst' || ct === 'pushbutton') {
    return { switchClosed: !!cs.switchClosed };
  }
  if (ct === 'switch_spdt') {
    return { switchPosition: cs.switchPosition || 'no' };
  }
  
  // Battery returns voltage
  if (ct === 'battery' || ct === 'dc_source') {
    return { voltage: cs.voltage || 5 };
  }
  
  // Resistor returns resistance
  if (ct === 'resistor') {
    return { resistance: cs.resistance || 1000 };
  }
  
  // Potentiometer
  if (ct === 'potentiometer') {
    return { resistance: cs.resistance || 10000 };
  }
  
  // Indicators need powered evaluation - require power on both sides for bulb to light up
  if (ct === 'bulb' || ct === 'led_indicator') {
    const comp = CircuitComponents[ct];
    if (!comp) return { powered: false };
    
    const pins = node.pins || comp.pins;
    const anodePin = pins.find(p => p.id === 'anode');
    const cathodePin = pins.find(p => p.id === 'cathode');
    
    if (!anodePin || !cathodePin) return { powered: false };
    
    // Check if anode (+) has power
    const anodeEdges = (GripState.edges || []).filter(e =>
      (e.to === node.id && e.toHandle === 'anode') ||
      (e.from === node.id && e.fromHandle === 'anode')
    );
    
    // Check if cathode (-) has connection to ground/power sink
    const cathodeEdges = (GripState.edges || []).filter(e =>
      (e.to === node.id && e.toHandle === 'cathode') ||
      (e.from === node.id && e.fromHandle === 'cathode')
    );
    
    let anodePowered = false;
    let cathodeConnected = false;
    
    // Check anode for power
    for (const edge of anodeEdges) {
      const otherId = edge.from === node.id ? edge.to : edge.from;
      if (evaluateCircuitSignal(otherId, new Set())) {
        anodePowered = true;
        break;
      }
    }
    
    // Check cathode for connection (could be ground or power sink)
    for (const edge of cathodeEdges) {
      const otherId = edge.from === node.id ? edge.to : edge.from;
      const otherNode = GripState.nodes.find(n => n.id === otherId);
      
      // Cathode is connected if it's ground, or if it completes a circuit
      if (otherNode && otherNode.type === 'circuit') {
        const otherCt = otherNode.circuitType;
        // Ground, VCC, or power sinks provide a path
        if (otherCt === 'ground' || otherCt === 'vcc') {
          cathodeConnected = true;
          break;
        }
        // Or if the other node can sink current (has power on its other side)
        if (otherCt === 'battery' || otherCt === 'dc_source' || otherCt === 'ac_source') {
          cathodeConnected = true;
          break;
        }
      }
    }
    
    // Bulb lights up only if both anode has power AND cathode is connected to complete circuit
    return { powered: anodePowered && cathodeConnected };
  }
  
  // Logic Input returns its value
  if (ct === 'logic_input') {
    return { logicValue: !!cs.logicValue };
  }
  
  return {};
}

function evaluateCircuitSignal(nodeId, visited) {
  if (visited.has(nodeId)) return false;
  visited.add(nodeId);
  
  const node = GripState.nodes.find(n => n.id === nodeId);
  if (!node || node.type !== 'circuit') return false;
  
  const ct = node.circuitType;
  const cs = node.circuitState || {};
  
  // Power sources always output 1
  if (ct === 'battery' || ct === 'dc_source' || ct === 'vcc' || ct === 'ac_source') return true;
  if (ct === 'clock') return true;
  
  // Logic Input outputs its stored value
  if (ct === 'logic_input') {
    return !!cs.logicValue;
  }
  
  // Switch pass-through - only conducts when closed
  if (ct === 'switch_spst' || ct === 'pushbutton') {
    if (!cs.switchClosed) return false;
    const inputSignals = getInputSignals(nodeId, visited);
    return inputSignals.some(s => s === true);
  }
  
  // SPDT switch - conducts through the selected position
  if (ct === 'switch_spdt') {
    const pos = cs.switchPosition || 'no'; // 'no' or 'nc'
    const comp = CircuitComponents[ct];
    if (!comp) return false;
    
    // Check if there's signal at the common pin
    const commonPin = comp.pins.find(p => p.id === 'common');
    if (!commonPin) return false;
    
    const commonEdges = (GripState.edges || []).filter(e =>
      (e.to === node.id && e.toHandle === 'common') ||
      (e.from === node.id && e.fromHandle === 'common')
    );
    
    // If no input at common pin, no output
    if (commonEdges.length === 0) return false;
    
    // Check if common pin has signal
    for (const edge of commonEdges) {
      const otherId = edge.from === node.id ? edge.to : edge.from;
      if (evaluateCircuitSignal(otherId, new Set(visited))) {
        // Common pin has signal, check if switch position allows it through
        return true; // Signal passes through to the selected output
      }
    }
    return false;
  }
  
  // Logic gate evaluation
  if (ct === 'and_gate' || ct === 'nand_gate' || ct === 'or_gate' || ct === 'nor_gate' || 
      ct === 'xor_gate' || ct === 'xnor_gate' || ct === 'not_gate' || ct === 'buffer') {
    return evaluateLogicGate(node, visited);
  }
  
  // Bulbs and indicators don't pass signal through - they just indicate power
  if (ct === 'bulb' || ct === 'led_indicator') {
    return false; // Don't pass signal through bulbs
  }
  
  // Pass-through components - check inputs
  const inputSignals = getInputSignals(nodeId, visited);
  return inputSignals.some(s => s === true);
}

function evaluateLogicGate(node, visited) {
  const ct = node.circuitType;
  const comp = CircuitComponents[ct];
  if (!comp) return false;
  
  const pins = node.pins || comp.pins;
  const inputPins = pins.filter(p => p.id !== 'out' && p.id !== 'y');
  
  // Get input values
  const inputs = inputPins.map(pin => {
    const connectedEdges = (GripState.edges || []).filter(e =>
      (e.to === node.id && e.toHandle === pin.id) ||
      (e.from === node.id && e.fromHandle === pin.id)
    );
    
    for (const edge of connectedEdges) {
      const otherId = edge.from === node.id ? edge.to : edge.from;
      if (evaluateCircuitSignal(otherId, new Set(visited))) return true;
    }
    return false;
  });
  
  const a = inputs[0] || false;
  const b = inputs.length > 1 ? inputs[1] : false;
  
  switch (ct) {
    case 'and_gate': return a && b;
    case 'nand_gate': return !(a && b);
    case 'or_gate': return a || b;
    case 'nor_gate': return !(a || b);
    case 'xor_gate': return a !== b;
    case 'xnor_gate': return a === b;
    case 'not_gate': return !a;
    case 'buffer': return a;
    default: return false;
  }
}

function getInputSignals(nodeId, visited) {
  const connectedEdges = (GripState.edges || []).filter(e =>
    e.to === nodeId || e.from === nodeId
  );
  
  return connectedEdges.map(edge => {
    const otherId = edge.from === nodeId ? edge.to : edge.from;
    return evaluateCircuitSignal(otherId, new Set(visited));
  });
}

// ============================================
// Double-Click Interaction Handler
// ============================================
function handleCircuitDoubleClick(node, event) {
  if (!node || node.type !== 'circuit') return;
  const ct = node.circuitType;
  if (!node.circuitState) node.circuitState = {};
  
  // Toggle switches and logic inputs
  if (ct === 'switch_spst' || ct === 'pushbutton' || ct === 'logic_input') {
    toggleCircuitSwitch(node.id);
    return;
  }
  
  if (ct === 'switch_spdt') {
    toggleCircuitSwitch(node.id);
    return;
  }
  
  // Adjust battery voltage
  if (ct === 'battery' || ct === 'dc_source') {
    const current = node.circuitState.voltage || 5;
    showCircuitValueEditor(node, 'voltage', current, 'V', 0.1, 240, 0.1);
    return;
  }
  
  // Adjust resistor resistance
  if (ct === 'resistor' || ct === 'potentiometer') {
    const current = node.circuitState.resistance || 1000;
    showCircuitValueEditor(node, 'resistance', current, 'Ω', 1, 10000000, 1);
    return;
  }
}

// ============================================
// Value Editor Popup
// ============================================
function showCircuitValueEditor(node, property, currentValue, unit, min, max, step) {
  // Remove any existing editor
  const existing = document.getElementById('circuitValueEditor');
  if (existing) existing.remove();
  
  const screenPos = worldToScreen(node.x + node.width / 2, node.y - 10);
  
  const editor = document.createElement('div');
  editor.id = 'circuitValueEditor';
  editor.className = 'circuit-value-editor';
  editor.style.cssText = `
    position: fixed;
    left: ${screenPos.x}px;
    top: ${screenPos.y}px;
    transform: translate(-50%, -100%);
    z-index: 3000;
    background: var(--circuit-panel-bg);
    border: 1px solid var(--circuit-panel-border);
    border-radius: 12px;
    padding: 12px 16px;
    backdrop-filter: blur(20px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 200px;
  `;
  
  const formatValue = (val) => {
    if (unit === 'Ω') {
      if (val >= 1000000) return (val/1000000).toFixed(1) + ' MΩ';
      if (val >= 1000) return (val/1000).toFixed(1) + ' kΩ';
      return val + ' Ω';
    }
    return val + ' ' + unit;
  };
  
  const presets = unit === 'V' 
    ? [1.5, 3.3, 5, 9, 12, 24, 48, 120, 240]
    : [100, 220, 470, 1000, 2200, 4700, 10000, 47000, 100000, 1000000];
  
  editor.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="color: var(--circuit-accent); font-size: 12px; font-weight: 600;">
        ${property === 'voltage' ? '⚡ Voltage' : '🔧 Resistance'}
      </span>
      <button onclick="document.getElementById('circuitValueEditor').remove()" 
              style="background:none; border:none; color:var(--circuit-label); cursor:pointer; font-size:14px; opacity:0.6;">✕</button>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <input type="number" id="circuitValueInput" value="${currentValue}" min="${min}" max="${max}" step="${step}"
             style="flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:6px 10px; color:var(--circuit-accent); font-size:14px; font-weight:600; outline:none; font-family:inherit; width:80px;"
             onchange="updateCircuitValue('${node.id}', '${property}', this.value)"/>
      <span style="color:var(--circuit-label); font-size:12px; opacity:0.7;">${unit}</span>
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:4px;">
      ${presets.map(p => `
        <button onclick="document.getElementById('circuitValueInput').value=${p}; updateCircuitValue('${node.id}', '${property}', ${p});"
                style="background:${p === currentValue ? 'var(--circuit-accent)' : 'rgba(255,255,255,0.06)'}; 
                       color:${p === currentValue ? '#000' : 'var(--circuit-label)'}; 
                       border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:3px 8px; 
                       font-size:10px; cursor:pointer; font-family:inherit;">${formatValue(p)}</button>
      `).join('')}
    </div>
  `;
  
  editor.addEventListener('mousedown', e => e.stopPropagation());
  editor.addEventListener('wheel', e => e.stopPropagation());
  
  document.getElementById('gripDiagramOverlay').appendChild(editor);
  
  // Auto-close on outside click
  setTimeout(() => {
    const close = (e) => {
      if (!editor.contains(e.target)) {
        editor.remove();
        document.removeEventListener('mousedown', close);
      }
    };
    document.addEventListener('mousedown', close);
  }, 100);
}

function updateCircuitValue(nodeId, property, value) {
  const node = GripState.nodes.find(n => n.id === nodeId);
  if (!node) return;
  if (!node.circuitState) node.circuitState = {};
  node.circuitState[property] = parseFloat(value);
  pushToHistory();
  saveGripDataInstant();
  updateAllPinSignals();
  renderCanvas();
}

// ============================================
// Update Pin Signals
// Refreshes all pin signal states in the DOM
// ============================================
function updateAllPinSignals() {
  const circuitNodes = GripState.nodes.filter(n => n.type === 'circuit');
  
  circuitNodes.forEach(node => {
    const comp = CircuitComponents[node.circuitType];
    const pins = node.pins || (comp ? comp.pins : []);
    
    pins.forEach(pin => {
      // Evaluate signal state for this pin
      let signalState = false;
      
      // Check if this is an output pin
      if (pin.id === 'out' || pin.id === 'y' || pin.id === 'Q') {
        signalState = evaluateCircuitSignal(node.id, new Set());
      } else {
        // For input pins, check connected nodes
        const connectedEdges = GripState.edges.filter(e => 
          (e.to === node.id && e.toHandle === pin.id) ||
          (e.from === node.id && e.fromHandle === pin.id)
        );
        
        for (const edge of connectedEdges) {
          const otherNodeId = edge.from === node.id ? edge.to : edge.from;
          if (evaluateCircuitSignal(otherNodeId, new Set())) {
            signalState = true;
            break;
          }
        }
      }
      
      // Update DOM element
      const pinElement = document.querySelector(`.circuit-pin[data-node-id="${node.id}"][data-pin-id="${pin.id}"]`);
      if (pinElement) {
        // Remove existing signal classes
        pinElement.classList.remove('signal-high', 'signal-low');
        // Add appropriate signal class
        pinElement.classList.add(signalState ? 'signal-high' : 'signal-low');
        // Update data attribute
        pinElement.setAttribute('data-signal', signalState ? '1' : '0');
      }
    });
  });
}

// Export functions
window.toggleCircuitPanel = toggleCircuitPanel;
window.placeCircuitComponent = placeCircuitComponent;
window.rotateCircuitNode = rotateCircuitNode;
window.editCircuitLabel = editCircuitLabel;
window.handleCircuitPinClick = handleCircuitPinClick;
window.renderCircuitNodeHTML = renderCircuitNodeHTML;
window.getCircuitPinPos = getCircuitPinPos;
window.CircuitComponents = CircuitComponents;
window.refreshCircuitPanel = refreshCircuitPanel;
window.disconnectCircuitPin = disconnectCircuitPin;
window.getCircuitPinConnectionSummary = getCircuitPinConnectionSummary;
window.getCircuitNodeState = getCircuitNodeState;
window.evaluateCircuitSignal = evaluateCircuitSignal;
window.handleCircuitDoubleClick = handleCircuitDoubleClick;
window.updateCircuitValue = updateCircuitValue;
window.toggleCircuitSwitch = toggleCircuitSwitch;
window.updateAllPinSignals = updateAllPinSignals;
