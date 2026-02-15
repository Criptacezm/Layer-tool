/* ============================================
   Layer - Gemini AI API Integration
   Enhanced with concise responses, professional code blocks,
   and theme-aware styling
   ============================================ */

import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// API KEY
const GEMINI_API_KEY = "AIzaSyBRhlJuyVjlX9gb-gN475JmyDi-kkU6BTM";

// Initialize the API
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Universal AI Model with broad knowledge - CONCISE responses
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: `You are a highly intelligent, concise AI assistant. You provide SHORT, direct answers.

RESPONSE RULES:
- Keep responses under 150 words unless specifically asked for detail
- Get straight to the point - no filler phrases like "Great question!" or "I'd be happy to help"
- Use bullet points (•) for lists - max 5 items
- For code: wrap in triple backticks with language name
- Use **bold** sparingly for key terms only
- One paragraph max for explanations unless complex
- Never apologize or use filler language

You have comprehensive knowledge across ALL domains including:
- Programming, Science, Mathematics, History, Business, Technology, Art, Health, and more

Format code blocks like:
\`\`\`javascript
// code here
\`\`\`

Be helpful, precise, and brief.`
});

// Code-specific model for error analysis
const codeModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: `You are an expert code analyzer. When given code, analyze it thoroughly for:
1. Syntax errors - missing brackets, semicolons, typos
2. Logic errors - incorrect conditions, infinite loops, off-by-one errors
3. Runtime errors - null references, type errors, division by zero
4. Best practice violations - naming conventions, code organization, security issues

For each error found, respond in this exact JSON format:
{
  "errors": [
    {
      "line": <line_number>,
      "type": "syntax|logic|runtime|bestpractice",
      "message": "<short error description>",
      "fix": "<suggested fix with code example if applicable>"
    }
  ]
}

If no errors are found, return: {"errors": []}
Only return valid JSON, no other text or explanation.`
});

/**
 * Core API Call to Gemini with enhanced context
 */
async function callGeminiAPI(userPrompt, context = '') {
    try {
        const fullPrompt = context ? `Context: ${context}\n\nUser: ${userPrompt}` : userPrompt;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();
        
        if (text) return text;
        throw new Error('AI returned an empty response.');
    } catch (error) {
        console.error('Gemini SDK Error:', error);
        const errorMsg = error.message || String(error);
        
        // Check for various rate limit / quota errors
        if (errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
            return "⚠️ Rate limit reached. Please wait 60 seconds and try again.";
        }
        
        // Check for API key issues
        if (errorMsg.includes('API_KEY') || errorMsg.includes('401') || errorMsg.includes('403')) {
            return "⚠️ API key issue. Please check your Gemini API key is valid.";
        }
        
        // Check for model not found
        if (errorMsg.includes('404') || errorMsg.includes('not found')) {
            return "⚠️ Model not available. Please try again later.";
        }
        
        return `❌ Error: ${errorMsg}`;
    }
}

/**
 * Analyze code for errors - Returns structured error data
 */
async function analyzeCodeErrors(code, language = 'javascript') {
    try {
        const prompt = `Analyze this ${language} code for errors:\n\`\`\`${language}\n${code}\n\`\`\``;
        
        const result = await codeModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Parse JSON response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return parsed;
        }
        return { errors: [] };
    } catch (error) {
        console.error('Code analysis error:', error);
        return { errors: [] };
    }
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format AI response with HTML for professional display
 * Theme-aware code blocks with copy functionality
 */
function formatAIResponse(text) {
    let html = text;
    
    // Code blocks with enhanced styling and copy button
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        const codeId = 'code-' + Math.random().toString(36).substr(2, 9);
        return `<div class="ai-code-container" data-lang="${language}">
            <div class="ai-code-toolbar">
                <span class="ai-code-language">${language}</span>
                <button class="ai-code-copy-btn" onclick="copyAICode('${codeId}', this)" data-code-id="${codeId}">
                    <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    <span class="copy-text">Copy</span>
                </button>
            </div>
            <pre class="ai-code-pre" id="${codeId}"><code class="ai-code">${escapeHtml(code.trim())}</code></pre>
        </div>`;
    });
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
    
    // Bold text - handle **text** format
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4 class="ai-heading">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="ai-heading">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="ai-heading">$1</h2>');
    
    // Bullet points - multiple formats
    html = html.replace(/^[•\-\*]\s+(.+)$/gm, '<li class="ai-list-item">$1</li>');
    html = html.replace(/(<li class="ai-list-item">.*<\/li>\n?)+/g, '<ul class="ai-list">$&</ul>');
    
    // Numbered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ai-numbered-item">$1</li>');
    html = html.replace(/(<li class="ai-numbered-item">.*<\/li>\n?)+/g, '<ol class="ai-numbered-list">$&</ol>');
    
    // Paragraphs - split by double newlines
    html = html.split('\n\n').map(p => {
        p = p.trim();
        if (!p) return '';
        if (p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<div') || 
            p.startsWith('<h2') || p.startsWith('<h3') || p.startsWith('<h4')) {
            return p;
        }
        return `<p class="ai-text">${p}</p>`;
    }).join('');
    
    // Clean up line breaks
    html = html.replace(/\n/g, '<br>');
    // Remove excessive breaks
    html = html.replace(/(<br>){3,}/g, '<br><br>');
    
    return html;
}

/**
 * Word-by-word reveal animation - Smooth and fast
 */
async function revealWordsAnimated(container, formattedHtml, speed = 10) {
    return new Promise((resolve) => {
        container.innerHTML = '';
        
        // Create a temporary container to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = formattedHtml;
        
        // Get text content for word-by-word reveal
        const textContent = temp.textContent || temp.innerText;
        const words = textContent.split(/(\s+)/);
        
        let wordIndex = 0;
        let displayText = '';
        
        const revealInterval = setInterval(() => {
            if (wordIndex >= words.length) {
                clearInterval(revealInterval);
                // Show full formatted HTML at the end with smooth transition
                container.style.opacity = '0';
                setTimeout(() => {
                    container.innerHTML = formattedHtml;
                    container.style.opacity = '1';
                    container.style.transition = 'opacity 0.15s ease';
                    container.scrollTop = container.scrollHeight;
                    resolve();
                }, 50);
                return;
            }
            
            // Add words progressively
            displayText += words[wordIndex];
            container.textContent = displayText;
            container.scrollTop = container.scrollHeight;
            wordIndex++;
        }, speed);
    });
}

/**
 * Create loading indicator - Modern pulse animation
 */
function createLoadingIndicator(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'ai-response-card ai-loading-state';
    loadingDiv.id = 'aiLoadingIndicator';
    loadingDiv.innerHTML = `
        <div class="ai-loading-content">
            <div class="ai-loading-orb"></div>
            <span class="ai-loading-label">Processing</span>
        </div>
    `;
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;
    return loadingDiv;
}

/**
 * Remove loading indicator
 */
function removeLoadingIndicator() {
    const loading = document.getElementById('aiLoadingIndicator');
    if (loading) {
        loading.style.opacity = '0';
        loading.style.transform = 'translateY(-10px)';
        loading.style.transition = 'all 0.2s ease';
        setTimeout(() => loading.remove(), 200);
    }
}

/**
 * Append AI message with professional formatting and word-by-word animation
 */
async function appendAiMessageEnhanced(containerId, role, text, animate = true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-response-card ${role}-card`;
    
    if (role === 'user') {
        msgDiv.innerHTML = `
            <div class="ai-user-message">
                <div class="ai-user-avatar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </div>
                <div class="ai-user-content">${escapeHtml(text)}</div>
            </div>
        `;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    } else {
        const formattedHtml = formatAIResponse(text);
        msgDiv.innerHTML = `
            <div class="ai-assistant-message">
                <div class="ai-assistant-avatar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                    </svg>
                </div>
                <div class="ai-assistant-content"></div>
            </div>
        `;
        container.appendChild(msgDiv);
        
        const contentDiv = msgDiv.querySelector('.ai-assistant-content');
        
        if (animate) {
            await revealWordsAnimated(contentDiv, formattedHtml, 8);
        } else {
            contentDiv.innerHTML = formattedHtml;
        }
        container.scrollTop = container.scrollHeight;
    }
}

/**
 * Universal AI chat handler for sidebars
 */
async function processAISidebarChat(inputId, messagesId, contextData = '') {
    const input = document.getElementById(inputId);
    const container = document.getElementById(messagesId);
    if (!input || !container) return;

    const message = input.value.trim();
    if (!message) return;

    // Add user message
    await appendAiMessageEnhanced(messagesId, 'user', message, false);
    input.value = '';
    input.disabled = true;

    // Show loading
    createLoadingIndicator(messagesId);

    try {
        const response = await callGeminiAPI(message, contextData);
        removeLoadingIndicator();
        await appendAiMessageEnhanced(messagesId, 'assistant', response, true);
    } catch (error) {
        removeLoadingIndicator();
        await appendAiMessageEnhanced(messagesId, 'assistant error', `❌ Error: ${error.message}`, false);
    } finally {
        input.disabled = false;
        input.focus();
    }
}

// ============================================
// Legacy support functions
// ============================================
function appendAiMessage(containerId, role, text) {
    appendAiMessageEnhanced(containerId, role, text, false);
}

async function processGenericAiChat(inputId, messagesId, typingId, contextData = '') {
    await processAISidebarChat(inputId, messagesId, contextData);
}

// ============================================
// ATTACH TO WINDOW - Global access
// ============================================

window.callGeminiAPI = callGeminiAPI;
window.analyzeCodeErrors = analyzeCodeErrors;
window.formatAIResponse = formatAIResponse;
window.appendAiMessageEnhanced = appendAiMessageEnhanced;
window.processAISidebarChat = processAISidebarChat;
window.createLoadingIndicator = createLoadingIndicator;
window.removeLoadingIndicator = removeLoadingIndicator;
window.escapeHtml = escapeHtml;

// Copy code button handler - Enhanced with visual feedback
window.copyAICode = function(codeId, btn) {
    const codeEl = document.getElementById(codeId);
    if (!codeEl) return;
    
    const code = codeEl.querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const copyIcon = btn.querySelector('.copy-icon');
        const checkIcon = btn.querySelector('.check-icon');
        const copyText = btn.querySelector('.copy-text');
        
        copyIcon.style.display = 'none';
        checkIcon.style.display = 'block';
        copyText.textContent = 'Copied!';
        btn.classList.add('copied');
        
        setTimeout(() => {
            copyIcon.style.display = 'block';
            checkIcon.style.display = 'none';
            copyText.textContent = 'Copy';
            btn.classList.remove('copied');
        }, 2000);
    });
};

// Project AI handler
window.handleProjectAiSend = function() {
    let ctx = "You are helping with project management. Be concise.";
    if (typeof gripProjectIndex !== 'undefined' && gripProjectIndex !== null) {
        const projects = loadProjects();
        const p = projects[gripProjectIndex];
        if (p) ctx = `Working on Project: "${p.name}". Be concise and helpful.`;
    }
    processAISidebarChat('projectAiInput', 'projectAiMessages', ctx);
};

// Whiteboard AI handler  
window.handleAiSend = function() {
    processAISidebarChat('gripAiInput', 'gripAiMessages', 'User is on a whiteboard. Keep answers short and actionable.');
};

// Doc content AI handler
window.handleDocContentAiSend = function() {
    const editor = document.getElementById('docEditorContent');
    const docText = editor ? editor.innerText.substring(0, 1000) : '';
    const ctx = `Editing document. Content: "${docText}"\n\nBe concise. Focus on writing help.`;
    processAISidebarChat('docContentAiInput', 'docContentAiMessages', ctx);
};

// Doc sidebar AI handler
window.handleDocAiSend = function() {
    processAISidebarChat('docAiInput', 'docAiMessages', 'Help with document editing. Be brief and helpful.');
};

// Whiteboard AI handler
window.handleWhiteboardAiSend = function() {
    let ctx = 'On whiteboard canvas. Keep answers concise.';
    if (typeof gripProjectIndex !== 'undefined' && gripProjectIndex !== null) {
        const projects = typeof loadProjects === 'function' ? loadProjects() : [];
        const p = projects[gripProjectIndex];
        if (p) ctx = `Whiteboard for: "${p.name}". Be concise.`;
    }
    processAISidebarChat('whiteboardAiInput', 'whiteboardAiMessages', ctx);
};

// ============================================
// Code Error Detection for Whiteboard
// ============================================

/**
 * Analyze code in whiteboard cell and highlight errors
 */
window.analyzeWhiteboardCode = async function(cellId, code, language) {
    try {
        const analysis = await analyzeCodeErrors(code, language);
        if (analysis.errors && analysis.errors.length > 0) {
            highlightCodeCellErrors(cellId, analysis.errors);
            return analysis.errors;
        }
        return [];
    } catch (e) {
        console.error('Code analysis failed:', e);
        return [];
    }
};

/**
 * Highlight errors in code cell with hover tooltips
 */
function highlightCodeCellErrors(cellId, errors) {
    const codeEl = document.querySelector(`[data-cell-id="${cellId}"].grip-cell-code-content`);
    if (!codeEl || !errors.length) return;
    
    const lines = (codeEl.textContent || '').split('\n');
    let html = '';
    
    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const error = errors.find(e => e.line === lineNum);
        
        if (error) {
            const escapedLine = escapeHtml(line);
            const errorType = error.type.charAt(0).toUpperCase() + error.type.slice(1);
            html += `<span class="code-error-highlight" data-line="${lineNum}">${escapedLine}
                <div class="code-error-tooltip">
                    <div class="code-error-tooltip-header">
                        <div class="code-error-tooltip-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                        </div>
                        <span class="code-error-tooltip-type">${errorType} Error</span>
                    </div>
                    <div class="code-error-tooltip-message">${escapeHtml(error.message)}</div>
                    ${error.fix ? `<div class="code-error-tooltip-fix"><strong>Fix:</strong> ${escapeHtml(error.fix)}</div>` : ''}
                </div>
            </span>\n`;
        } else {
            html += escapeHtml(line) + '\n';
        }
    });
    
    codeEl.innerHTML = html;
}
