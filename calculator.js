/**
 * Professional Scientific Calculator - Casio Style Layout
 * Integrated into Layer Whiteboard
 */

class Calculator {
    constructor() {
        this.displayValue = '0';
        this.expression = '';
        this.memory = 0;
        this.isRadians = true; // Default to Radians
        this.history = [];
        this.isResult = false;
        this.shiftMode = false;
        this.alphaMode = false;

        this.init();
    }

    init() {
        if (document.getElementById('layerCalculator')) return;

        const markup = `
            <div id="layerCalculator" class="calculator-overlay casio-style">
                <div class="calculator-header" id="calcHeader">
                    <div class="brand-section">
                        <span class="brand-name">Scientific</span>
                    </div>
                    <button class="calculator-close" onclick="window.layerCalculator.toggle()">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <div class="calc-screen-bezel">
                    <div class="calc-screen">
                        <div class="calc-indicators">
                            <span id="ind-shift" class="ind">S</span>
                            <span id="ind-alpha" class="ind">A</span>
                            <span id="ind-rad" class="ind active">R</span>
                            <span id="ind-deg" class="ind">D</span>
                        </div>
                        <div class="calc-expression" id="calcExpression"></div>
                        <div class="calc-result" id="calcResult">0</div>
                    </div>
                </div>

                <div class="calc-body">
                    <!-- Top Control Row -->
                    <div class="calc-row-control">
                        <button class="btn-control btn-shift" onclick="window.layerCalculator.toggleShift()">SHIFT</button>
                        <button class="btn-control btn-alpha" onclick="window.layerCalculator.toggleAlpha()">ALPHA</button>
                        <div class="d-pad-placeholder"></div>
                        <button class="btn-control btn-mode" onclick="window.layerCalculator.toggleMode()">MODE</button>
                        <button class="btn-control btn-on" onclick="window.layerCalculator.clearAll()">ON</button>
                    </div>

                    <!-- Scientific Functions Grid -->
                    <div class="calc-grid-sci">
                        <button class="btn-sci" onclick="window.layerCalculator.func('abs')">Abs</button>
                        <button class="btn-sci" onclick="window.layerCalculator.func('pow3')">x³</button>
                        <button class="btn-sci" onclick="window.layerCalculator.func('pow2')">x²</button>
                        <button class="btn-sci" onclick="window.layerCalculator.input('^')">xʸ</button>
                        <button class="btn-sci" onclick="window.layerCalculator.func('log')">log</button>
                        <button class="btn-sci" onclick="window.layerCalculator.func('ln')">ln</button>

                        <button class="btn-sci" onclick="window.layerCalculator.input('(')">(</button>
                        <button class="btn-sci" onclick="window.layerCalculator.input(')')">)</button>
                        <button class="btn-sci" onclick="window.layerCalculator.func('sin')">sin</button>
                        <button class="btn-sci" onclick="window.layerCalculator.func('cos')">cos</button>
                        <button class="btn-sci" onclick="window.layerCalculator.func('tan')">tan</button>
                        <button class="btn-sci" onclick="window.layerCalculator.input(',')">,</button>

                        <button class="btn-sci" onclick="window.layerCalculator.constant('E')">e</button>
                        <button class="btn-sci" onclick="window.layerCalculator.func('sqrt')">√</button>
                        <button class="btn-sci" onclick="window.layerCalculator.func('inv')">x⁻¹</button>
                        <button class="btn-sci" onclick="window.layerCalculator.func('fact')">x!</button>
                        <button class="btn-sci" onclick="window.layerCalculator.constant('PI')">π</button>
                        <button class="btn-sci" onclick="window.layerCalculator.input('%')">%</button>
                    </div>

                    <!-- Main Keypad -->
                    <div class="calc-grid-main">
                        <button class="btn-num" onclick="window.layerCalculator.input('7')">7</button>
                        <button class="btn-num" onclick="window.layerCalculator.input('8')">8</button>
                        <button class="btn-num" onclick="window.layerCalculator.input('9')">9</button>
                        <button class="btn-op del" onclick="window.layerCalculator.backspace()">DEL</button>
                        <button class="btn-op ac" onclick="window.layerCalculator.clearAll()">AC</button>

                        <button class="btn-num" onclick="window.layerCalculator.input('4')">4</button>
                        <button class="btn-num" onclick="window.layerCalculator.input('5')">5</button>
                        <button class="btn-num" onclick="window.layerCalculator.input('6')">6</button>
                        <button class="btn-op" onclick="window.layerCalculator.input('*')">×</button>
                        <button class="btn-op" onclick="window.layerCalculator.input('/')">÷</button>

                        <button class="btn-num" onclick="window.layerCalculator.input('1')">1</button>
                        <button class="btn-num" onclick="window.layerCalculator.input('2')">2</button>
                        <button class="btn-num" onclick="window.layerCalculator.input('3')">3</button>
                        <button class="btn-op" onclick="window.layerCalculator.input('+')">+</button>
                        <button class="btn-op" onclick="window.layerCalculator.input('-')">−</button>

                        <button class="btn-num" onclick="window.layerCalculator.input('0')">0</button>
                        <button class="btn-num" onclick="window.layerCalculator.input('.')">.</button>
                        <button class="btn-num" onclick="window.layerCalculator.constant('exp')">EXP</button>
                        <button class="btn-op ans" onclick="window.layerCalculator.useAns()">Ans</button>
                        <button class="btn-op exe" onclick="window.layerCalculator.calculate()">EXE</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', markup);
        this.setupDraggable();
        this.updateDisplay();
    }

    toggle() {
        const el = document.getElementById('layerCalculator');
        el.classList.toggle('visible');
    }

    toggleShift() {
        this.shiftMode = !this.shiftMode;
        document.getElementById('ind-shift').classList.toggle('active', this.shiftMode);
        // In a full implementation, this would update key labels
    }

    toggleAlpha() {
        this.alphaMode = !this.alphaMode;
        document.getElementById('ind-alpha').classList.toggle('active', this.alphaMode);
    }

    toggleMode() {
        this.isRadians = !this.isRadians;
        document.getElementById('ind-rad').classList.toggle('active', this.isRadians);
        document.getElementById('ind-deg').classList.toggle('active', !this.isRadians);
    }

    input(char) {
        if (this.isResult) {
            this.displayValue = '';
            this.isResult = false;
        }

        if (this.displayValue === '0' && char !== '.') {
            this.displayValue = char;
        } else {
            this.displayValue += char;
        }
        this.updateDisplay();
    }

    constant(name) {
        if (this.isResult) {
            this.displayValue = '';
            this.isResult = false;
        }

        let val = '';
        if (name === 'PI') val = 'π';
        else if (name === 'E') val = 'e';
        else if (name === 'exp') val = 'E'; // Scientific notation

        if (this.displayValue === '0') {
            this.displayValue = val;
        } else {
            // Check if we need a multiplication operator (implicit mult)
            const lastChar = this.displayValue.slice(-1);
            if (!isNaN(lastChar) || lastChar === ')') {
                // Don't add * for 'E' (exponential notation 5E3)
                if (name !== 'exp') this.displayValue += '*';
            }
            this.displayValue += val;
        }
        this.updateDisplay();
    }

    func(name) {
        if (this.isResult) {
            this.displayValue = ''; // Clear if starting new with function
            this.isResult = false;
        }

        let prefix = '';
        const lastChar = this.displayValue.slice(-1);
        if (this.displayValue !== '0' && (!isNaN(lastChar) || lastChar === ')' || lastChar === 'π' || lastChar === 'e')) {
            prefix = '*';
        }

        if (this.displayValue === '0') this.displayValue = '';

        if (name === 'inv') {
            this.displayValue = `(${this.displayValue || 'Ans'})^-1`;
            return this.updateDisplay();
        }
        if (name === 'pow2') {
            this.displayValue = `(${this.displayValue || 'Ans'})^2`;
            return this.updateDisplay();
        }
        if (name === 'pow3') {
            this.displayValue = `(${this.displayValue || 'Ans'})^3`;
            return this.updateDisplay();
        }
        if (name === 'fact') {
            this.displayValue = `(${this.displayValue || 'Ans'})!`;
            return this.updateDisplay();
        }

        this.displayValue += `${prefix}${name}(`;
        this.updateDisplay();
    }

    backspace() {
        if (this.displayValue.length > 1) {
            this.displayValue = this.displayValue.slice(0, -1);
        } else {
            this.displayValue = '0';
        }
        this.updateDisplay();
    }

    clearAll() {
        this.displayValue = '0';
        this.expression = '';
        this.isResult = false;
        this.updateDisplay();
    }

    useAns() {
        if (this.isResult) {
            this.displayValue = 'Ans';
            this.isResult = false;
        } else {
            const lastChar = this.displayValue.slice(-1);
            if (!isNaN(lastChar) || lastChar === ')') {
                this.displayValue += '*Ans';
            } else {
                this.displayValue += 'Ans';
            }
        }
        this.updateDisplay();
    }

    calculate() {
        try {
            this.expression = this.displayValue;
            let evalString = this.displayValue;

            // Replace Ans with last result
            evalString = evalString.replace(/Ans/g, this.memory);
            evalString = evalString.replace(/π/g, 'Math.PI');
            evalString = evalString.replace(/e/g, 'Math.E');

            // Handle Math functions
            evalString = evalString.replace(/sin\(/g, this.isRadians ? 'Math.sin(' : `Math.sin(Math.PI/180*`);
            evalString = evalString.replace(/cos\(/g, this.isRadians ? 'Math.cos(' : `Math.cos(Math.PI/180*`);
            evalString = evalString.replace(/tan\(/g, this.isRadians ? 'Math.tan(' : `Math.tan(Math.PI/180*`);

            evalString = evalString.replace(/ln\(/g, 'Math.log(');
            evalString = evalString.replace(/log\(/g, 'Math.log10(');
            evalString = evalString.replace(/sqrt\(/g, 'Math.sqrt(');
            evalString = evalString.replace(/abs\(/g, 'Math.abs(');

            // Handle Power (^)
            evalString = evalString.replace(/\^/g, '**');

            // Handle Factorial (!) - simplified regex replacement
            // This is complex in regex, better to use a math parser library, but for basic usage:
            // Let's just handle simple numbers: 5! -> factorial(5)
            // Or leave it unimplemented for complex cases in this simple eval version

            // Handle E notation (5E3 -> 5*10^3)
            evalString = evalString.replace(/E/g, 'e'); // JS uses 'e' for scientific notation

            // Safe evaluation
            const result = new Function('return ' + evalString)();

            // Format result
            let formattedResult = parseFloat(result.toPrecision(12)); // Avoid floating point errors
            if (Math.abs(formattedResult) < 1e-10) formattedResult = 0;

            this.memory = formattedResult;
            this.displayValue = formattedResult.toString();
            this.isResult = true;
        } catch (e) {
            this.displayValue = 'Syntax Error';
            this.isResult = true;
        }
        this.updateDisplay();
    }

    formatMathExpression(expression) {
        if (!expression || expression === '0') return expression;
        
        // Convert calculator expression to LaTeX format for KaTeX rendering
        let latex = this.convertToLaTeX(expression);
        
        try {
            // Use KaTeX to render the LaTeX
            return katex.renderToString(latex, {
                throwOnError: false,
                displayMode: false,
                output: 'html'
            });
        } catch (e) {
            // Fallback to basic formatting if KaTeX fails
            return this.basicFormatting(expression);
        }
    }

    convertToLaTeX(expression) {
        let latex = expression;
        
        // Handle mathematical constants
        latex = latex.replace(/π/g, '\\pi');
        latex = latex.replace(/e(?![a-z])/g, 'e'); // Keep e as is for scientific notation
        
        // Handle square roots - convert to LaTeX \sqrt{} with proper nesting
        latex = latex.replace(/sqrt\(/g, '\\sqrt{');
        latex = latex.replace(/√\(/g, '\\sqrt{');
        latex = latex.replace(/√(\d)/g, '\\sqrt{$1}');
        
        // Handle complex fractions - convert to LaTeX \frac{}{}
        // Handle (numerator)/(denominator) format with nested expressions
        latex = latex.replace(/\(([^()]+)\)\/\(([^()]+)\)/g, (match, num, den) => {
            // Convert numerator and denominator to LaTeX
            const numLatex = this.convertToLaTeX(num);
            const denLatex = this.convertToLaTeX(den);
            return `\\frac{${numLatex}}{${denLatex}}`;
        });
        
        // Handle simple fractions like a/b but avoid complex ones
        latex = latex.replace(/(\d+√?\d*)\/(\d+√?\d*)/g, (match, num, den) => {
            // Skip if this looks like part of a larger expression
            if (match.includes(' ') || match.includes('+') || match.includes('-') || match.includes('*')) {
                return match;
            }
            return `\\frac{${num}}{${den}}`;
        });
        
        // Handle powers - convert to LaTeX superscript
        latex = latex.replace(/\^2/g, '^2');
        latex = latex.replace(/\^3/g, '^3');
        latex = latex.replace(/\^(-?\d+)/g, '^{$1}');
        
        // Handle trigonometric functions
        latex = latex.replace(/sin\(/g, '\\sin(');
        latex = latex.replace(/cos\(/g, '\\cos(');
        latex = latex.replace(/tan\(/g, '\\tan(');
        latex = latex.replace(/asin\(/g, '\\arcsin(');
        latex = latex.replace(/acos\(/g, '\\arccos(');
        latex = latex.replace(/atan\(/g, '\\arctan(');
        latex = latex.replace(/sinh\(/g, '\\sinh(');
        latex = latex.replace(/cosh\(/g, '\\cosh(');
        latex = latex.replace(/tanh\(/g, '\\tanh(');
        
        // Handle logarithms
        latex = latex.replace(/ln\(/g, '\\ln(');
        latex = latex.replace(/log\(/g, '\\log(');
        latex = latex.replace(/log_(\d+)\(/g, '\\log_{$1}(');
        
        // Handle absolute value
        latex = latex.replace(/abs\(/g, '|');
        
        // Handle factorial
        latex = latex.replace(/(\d+)!/g, '$1!');
        
        // Handle operators
        latex = latex.replace(/\*/g, '\\times');
        latex = latex.replace(/\//g, '\\div');
        latex = latex.replace(/-/g, '-');
        latex = latex.replace(/\+/g, '+');
        
        // Handle scientific notation
        latex = latex.replace(/([0-9.]+)e([+-]?\d+)/g, '$1 \\times 10^{$2}');
        
        // Handle infinity
        latex = latex.replace(/Infinity/g, '\\infty');
        latex = latex.replace(/-Infinity/g, '-\\infty');
        
        // Convert remaining parentheses to braces for LaTeX
        latex = latex.replace(/\(/g, '{');
        latex = latex.replace(/\)/g, '}');
        
        // Close remaining parentheses properly
        latex = this.balanceParentheses(latex);
        
        return latex;
    }

    balanceParentheses(latex) {
        // Basic parentheses balancing for LaTeX
        let openCount = (latex.match(/\{/g) || []).length;
        let closeCount = (latex.match(/\}/g) || []).length;
        
        // Add missing closing braces
        for (let i = 0; i < openCount - closeCount; i++) {
            latex += '}';
        }
        
        return latex;
    }

    basicFormatting(expression) {
        // Fallback basic formatting if KaTeX fails
        let formatted = expression;
        
        formatted = formatted.replace(/sqrt\(/g, '√(');
        formatted = formatted.replace(/\*/g, '×');
        formatted = formatted.replace(/\//g, '÷');
        formatted = formatted.replace(/-/g, '−');
        formatted = formatted.replace(/\^2/g, '²');
        formatted = formatted.replace(/\^3/g, '³');
        formatted = formatted.replace(/π/g, 'π');
        
        return formatted;
    }

    updateDisplay() {
        const resultEl = document.getElementById('calcResult');
        const exprEl = document.getElementById('calcExpression');

        if (resultEl) {
            if (this.isResult && this.displayValue !== 'Syntax Error') {
                // Format the result for better mathematical display
                resultEl.innerHTML = this.formatMathExpression(this.displayValue);
            } else {
                resultEl.innerHTML = this.formatMathExpression(this.displayValue);
            }
        }
        if (exprEl) exprEl.innerHTML = this.formatMathExpression(this.expression);
    }

    setupDraggable() {
        const el = document.getElementById('layerCalculator');
        const header = document.getElementById('calcHeader');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            // Switch to absolute positioning if not already
            const rect = el.getBoundingClientRect();

            // If it was centered with transform, we need to fix it in place
            const style = window.getComputedStyle(el);
            const matrix = new WebKitCSSMatrix(style.transform);

            el.style.transform = 'none';
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.top}px`;

            initialLeft = rect.left;
            initialTop = rect.top;

            header.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            el.style.left = `${initialLeft + dx}px`;
            el.style.top = `${initialTop + dy}px`;
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'grab';
        });
    }
}

// Initialize on load
window.layerCalculator = new Calculator();
