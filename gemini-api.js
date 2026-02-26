/* ============================================
   Layer - Qwen AI API Integration (NVIDIA)
   Enhanced with concise responses, professional code blocks,
   and theme-aware styling
   ============================================ */

// API CONFIGURATION
const NVIDIA_API_KEY = "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";
const INVOKE_URL = "/api/ai";
const MODEL_NAME = "qwen/qwen3.5-397b-a17b";

// System instructions
const GENERAL_SYSTEM_PROMPT = `You are a highly intelligent, concise AI assistant. You provide SHORT, direct answers.

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

Be helpful, precise, and brief.`;

const CODE_ANALYSIS_SYSTEM_PROMPT = `You are an expert code analyzer. When given code, analyze it thoroughly for:
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
Only return valid JSON, no other text or explanation.`;

/**
 * Core API Call to NVIDIA Qwen API
 */
async function callQwenAPI(userPrompt, systemPrompt, context = '') {
    try {
        const fullPrompt = context ? `Context: ${context}\n\nUser: ${userPrompt}` : userPrompt;

        // Always use absolute URL for the proxy to support Live Server (port 5500)
        const response = await fetch("http://localhost:3001/api/ai", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "model": MODEL_NAME,
                "messages": [
                    { "role": "system", "content": systemPrompt },
                    { "role": "user", "content": fullPrompt }
                ],
                "max_tokens": 4096,
                "temperature": 0.60,
                "top_p": 0.95,
                "top_k": 20,
                "presence_penalty": 0,
                "repetition_penalty": 1,
                "stream": false
            })
        });

        console.log('Proxy response status:', response.status);
        const contentType = response.headers.get('content-type');
        console.log('Proxy response content-type:', contentType);

        if (!contentType || !contentType.includes('application/json')) {
            const errorText = await response.text();
            console.error('Server returned non-JSON:', errorText);
            throw new Error(`Server returned non-JSON response. Check console for details.`);
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.choices[0]?.message?.content;

        if (text) return text;
        throw new Error('AI returned an empty response.');
    } catch (error) {
        console.error('NVIDIA API Error:', error);
        const errorMsg = error.message || String(error);

        if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
            return "⚠️ Rate limit reached. Please wait 60 seconds and try again.";
        }

        if (errorMsg.includes('401') || errorMsg.includes('403')) {
            return "⚠️ API key issue. Please check your NVIDIA API key is valid.";
        }

        return `❌ Error: ${errorMsg}`;
    }
}

/**
 * Compatibility wrapper for the original callGeminiAPI
 */
async function callGeminiAPI(userPrompt, context = '') {
    return await callQwenAPI(userPrompt, GENERAL_SYSTEM_PROMPT, context);
}

/**
 * Analyze code for errors - Returns structured error data
 */
async function analyzeCodeErrors(code, language = 'javascript') {
    try {
        const prompt = `Analyze this ${language} code for errors:\n\`\`\`${language}\n${code}\n\`\`\``;
        const text = await callQwenAPI(prompt, CODE_ANALYSIS_SYSTEM_PROMPT);

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
 * Save a message to chat history
 */
function saveMessageToHistory(containerId, role, text) {
    try {
        const historyKey = `ai_history_${containerId}`;
        const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        history.push({ role, text, timestamp: new Date().toISOString() });
        // Keep only last 50 messages to prevent storage bloat
        if (history.length > 50) history.shift();
        localStorage.setItem(historyKey, JSON.stringify(history));
    } catch (e) {
        console.error('Failed to save chat history:', e);
    }
}

/**
 * Load chat history for a specific container
 */
async function loadChatHistory(containerId) {
    try {
        const historyKey = `ai_history_${containerId}`;
        const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        if (history.length > 0) {
            for (const msg of history) {
                await appendAiMessageEnhanced(containerId, msg.role, msg.text, false);
            }
        }
    } catch (e) {
        console.error('Failed to load chat history:', e);
    }
}

/**
 * Clear chat history for a specific container
 */
window.clearAiChatHistory = function (containerId) {
    localStorage.removeItem(`ai_history_${containerId}`);
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
};

/**
 * Append AI message with professional formatting and word-by-word animation
 */
async function appendAiMessageEnhanced(containerId, role, text, animate = true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Save to history if it's a real message (not an error or during loading)
    if (role === 'user' || role === 'assistant') {
        const historyKey = `ai_history_${containerId}`;
        const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        const isDuplicate = history.some(m => m.text === text && m.role === role);
        if (!isDuplicate && animate) { // Only save if it's new and being animated (fresh message)
            saveMessageToHistory(containerId, role, text);
        }
    }

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

window.callQwenAPI = callQwenAPI;
window.callGeminiAPI = callGeminiAPI;
window.analyzeCodeErrors = analyzeCodeErrors;
window.loadChatHistory = loadChatHistory;
window.saveMessageToHistory = saveMessageToHistory;
window.clearAiChatHistory = clearAiChatHistory;

// Initialize histories for all known AI containers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const containers = [
        'projectAiMessages',
        'gripAiMessages',
        'docContentAiMessages',
        'docAiMessages',
        'whiteboardAiMessages'
    ];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) loadChatHistory(id);
    });
});
/**
 * Toggle the Chat History sidebar for the main AI view
 */
window.toggleChatHistorySidebar = function () {
    let sidebar = document.getElementById('aiHistorySidebar');
    if (!sidebar) {
        // Create sidebar if it doesn't exist
        sidebar = document.createElement('div');
        sidebar.id = 'aiHistorySidebar';
        sidebar.className = 'ai-history-sidebar';
        sidebar.innerHTML = `
            <div class="ai-history-sidebar-header">
                <h3>Chat History</h3>
                <div class="ai-history-sidebar-actions">
                    <button class="ai-history-clear-btn" onclick="clearAiChatHistory('aiAgentMessages')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Clear
                    </button>
                    <button class="ai-history-close-btn" onclick="toggleChatHistorySidebar()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <path d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="ai-history-sidebar-content" id="aiHistorySidebarContent">
                <!-- History items will be injected here -->
            </div>
        `;
        document.body.appendChild(sidebar);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.id = 'aiHistoryOverlay';
        overlay.className = 'ai-history-overlay';
        overlay.onclick = toggleChatHistorySidebar;
        document.body.appendChild(overlay);
    }

    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
        sidebar.classList.remove('open');
        document.getElementById('aiHistoryOverlay').classList.remove('open');
    } else {
        renderHistoryList();
        sidebar.classList.add('open');
        document.getElementById('aiHistoryOverlay').classList.add('open');
    }
};

function renderHistoryList() {
    const content = document.getElementById('aiHistorySidebarContent');
    if (!content) return;

    const historyKey = `ai_history_aiAgentMessages`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');

    if (history.length === 0) {
        content.innerHTML = '<div class="ai-history-empty">No recent history</div>';
        return;
    }

    // Group history by sessions (approximate by time gaps or just list all)
    content.innerHTML = history.slice().reverse().map((msg, idx) => `
        <div class="ai-history-item ${msg.role}">
            <div class="ai-history-item-role">${msg.role === 'user' ? 'You' : 'AI'}</div>
            <div class="ai-history-item-text">${escapeHtml(msg.text).substring(0, 100)}${msg.text.length > 100 ? '...' : ''}</div>
            <div class="ai-history-item-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `).join('');
}
window.formatAIResponse = formatAIResponse;
window.appendAiMessageEnhanced = appendAiMessageEnhanced;
window.processAISidebarChat = processAISidebarChat;
window.createLoadingIndicator = createLoadingIndicator;
window.removeLoadingIndicator = removeLoadingIndicator;
window.escapeHtml = escapeHtml;

// Copy code button handler - Enhanced with visual feedback
window.copyAICode = function (codeId, btn) {
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
window.handleProjectAiSend = function () {
    let ctx = "You are helping with project management. Be concise.";
    if (typeof gripProjectIndex !== 'undefined' && gripProjectIndex !== null) {
        const projects = loadProjects();
        const p = projects[gripProjectIndex];
        if (p) ctx = `Working on Project: "${p.name}". Be concise and helpful.`;
    }
    processAISidebarChat('projectAiInput', 'projectAiMessages', ctx);
};

// Whiteboard AI handler  
window.handleAiSend = function () {
    processAISidebarChat('gripAiInput', 'gripAiMessages', 'User is on a whiteboard. Keep answers short and actionable.');
};

// Doc content AI handler
window.handleDocContentAiSend = function () {
    const editor = document.getElementById('docEditorContent');
    const docText = editor ? editor.innerText.substring(0, 1000) : '';
    const ctx = `Editing document. Content: "${docText}"\n\nBe concise. Focus on writing help.`;
    processAISidebarChat('docContentAiInput', 'docContentAiMessages', ctx);
};

// Doc sidebar AI handler
window.handleDocAiSend = function () {
    processAISidebarChat('docAiInput', 'docAiMessages', 'Help with document editing. Be brief and helpful.');
};

// Whiteboard AI handler
window.handleWhiteboardAiSend = function () {
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
window.analyzeWhiteboardCode = async function (cellId, code, language) {
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
