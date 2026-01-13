/* ============================================
   Layer - Gemini AI API Integration
   Enhanced with word-by-word streaming, code detection,
   and universal knowledge capabilities
   ============================================ */

import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// API KEY
const GEMINI_API_KEY = "AIzaSyA0Cljrwf52dNu3pqL_1eCqsw8PhjWUgUk";

// Initialize the API
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Universal AI Model with broad knowledge
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `You are a highly intelligent, professional AI assistant with comprehensive knowledge across all domains. You help users with:
- General questions on any topic (science, history, technology, coding, etc.)
- Project management and productivity
- Writing, editing, and improving documents
- Code analysis, debugging, and suggestions
- Problem solving and brainstorming

Format your responses professionally:
- Use bullet points (•) for lists
- Use numbered lists (1. 2. 3.) for steps
- Wrap code in triple backticks with language (e.g., \`\`\`javascript)
- Use **bold** for emphasis and headings
- Keep responses clear, helpful, and well-structured
- Be concise but thorough`
});

// Code-specific model for error analysis
const codeModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `You are a code analysis expert. When given code, analyze it for:
1. Syntax errors
2. Logic errors
3. Best practice violations
4. Potential runtime issues

For each error found, respond in this exact JSON format:
{
  "errors": [
    {
      "line": <line_number>,
      "type": "syntax|logic|runtime|bestpractice",
      "message": "<short error description>",
      "fix": "<suggested fix>"
    }
  ]
}

If no errors, return: {"errors": []}
Only return valid JSON, no other text.`
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
        if (error.message.includes('quota')) {
            return "Rate limit reached. Please wait 60 seconds.";
        }
        return `Error: ${error.message}`;
    }
}

/**
 * Analyze code for errors
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
            return JSON.parse(jsonMatch[0]);
        }
        return { errors: [] };
    } catch (error) {
        console.error('Code analysis error:', error);
        return { errors: [] };
    }
}

/**
 * Format AI response with HTML for professional display
 */
function formatAIResponse(text) {
    let html = text;
    
    // Code blocks with syntax highlighting container
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        return `<div class="ai-code-block">
            <div class="ai-code-header">
                <span class="ai-code-lang">${language}</span>
                <button class="ai-code-copy" onclick="copyAICode(this)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    Copy
                </button>
            </div>
            <pre class="ai-code-content"><code>${escapeHtml(code.trim())}</code></pre>
        </div>`;
    });
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
    
    // Bold text
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="ai-bold">$1</strong>');
    
    // Bullet points
    html = html.replace(/^[•\-\*]\s+(.+)$/gm, '<li class="ai-bullet">$1</li>');
    html = html.replace(/(<li class="ai-bullet">.*<\/li>\n?)+/g, '<ul class="ai-bullet-list">$&</ul>');
    
    // Numbered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ai-numbered">$1</li>');
    html = html.replace(/(<li class="ai-numbered">.*<\/li>\n?)+/g, '<ol class="ai-numbered-list">$&</ol>');
    
    // Paragraphs
    html = html.split('\n\n').map(p => {
        if (p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<div')) return p;
        return `<p class="ai-paragraph">${p}</p>`;
    }).join('');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Word-by-word reveal animation
 */
async function revealWordsAnimated(container, formattedHtml, speed = 15) {
    return new Promise((resolve) => {
        container.innerHTML = '';
        
        // Create a temporary container to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = formattedHtml;
        
        // Get text content for word-by-word reveal
        const textContent = temp.textContent || temp.innerText;
        const words = textContent.split(/(\s+)/);
        
        let wordIndex = 0;
        const revealInterval = setInterval(() => {
            if (wordIndex >= words.length) {
                clearInterval(revealInterval);
                // Show full formatted HTML at the end
                container.innerHTML = formattedHtml;
                container.scrollTop = container.scrollHeight;
                resolve();
                return;
            }
            
            // Show words progressively
            container.textContent = words.slice(0, wordIndex + 1).join('');
            container.scrollTop = container.scrollHeight;
            wordIndex++;
        }, speed);
    });
}

/**
 * Append AI message with formatting and animation
 */
async function appendAiMessageEnhanced(containerId, role, text, animate = true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-sidebar-message ${role}`;
    
    if (role === 'user') {
        msgDiv.innerHTML = `<div class="ai-message-content">${escapeHtml(text)}</div>`;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    } else {
        const formattedHtml = formatAIResponse(text);
        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-message-content';
        msgDiv.appendChild(contentDiv);
        container.appendChild(msgDiv);
        
        if (animate) {
            await revealWordsAnimated(contentDiv, formattedHtml, 12);
        } else {
            contentDiv.innerHTML = formattedHtml;
        }
        container.scrollTop = container.scrollHeight;
    }
}

/**
 * Create unique loading animation
 */
function createLoadingIndicator(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'ai-sidebar-message assistant ai-loading';
    loadingDiv.id = 'aiLoadingIndicator';
    loadingDiv.innerHTML = `
        <div class="ai-loading-animation">
            <div class="ai-loading-dot"></div>
            <div class="ai-loading-dot"></div>
            <div class="ai-loading-dot"></div>
            <span class="ai-loading-text">Thinking</span>
        </div>
    `;
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;
    return loadingDiv;
}

function removeLoadingIndicator() {
    const loading = document.getElementById('aiLoadingIndicator');
    if (loading) loading.remove();
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
        await appendAiMessageEnhanced(messagesId, 'assistant error', `Error: ${error.message}`, false);
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
// ATTACH TO WINDOW
// ============================================

window.callGeminiAPI = callGeminiAPI;
window.analyzeCodeErrors = analyzeCodeErrors;
window.formatAIResponse = formatAIResponse;
window.appendAiMessageEnhanced = appendAiMessageEnhanced;
window.processAISidebarChat = processAISidebarChat;

window.copyAICode = function(btn) {
    const codeBlock = btn.closest('.ai-code-block');
    const code = codeBlock.querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg> Copied!`;
        setTimeout(() => {
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
        }, 2000);
    });
};

window.handleProjectAiSend = function() {
    let ctx = "Global dashboard view.";
    if (typeof gripProjectIndex !== 'undefined' && gripProjectIndex !== null) {
        const projects = loadProjects();
        const p = projects[gripProjectIndex];
        if (p) ctx = `Working on Project: ${p.name}.`;
    }
    processAISidebarChat('projectAiInput', 'projectAiMessages', ctx);
};

window.handleAiSend = function() {
    processAISidebarChat('gripAiInput', 'gripAiMessages', 'User is using a flowchart whiteboard for visual planning.');
};

window.handleDocContentAiSend = function() {
    const editor = document.getElementById('docEditorContent');
    const docText = editor ? editor.innerText.substring(0, 1000) : '';
    const ctx = `User is editing a document. Current content preview: ${docText}`;
    processAISidebarChat('docContentAiInput', 'docContentAiMessages', ctx);
};

window.handleDocAiSend = function() {
    processAISidebarChat('docAiInput', 'docAiMessages', 'User is working in the document editor.');
};

// Whiteboard AI handler
window.handleWhiteboardAiSend = function() {
    let ctx = 'User is on the whiteboard canvas for visual planning and flowcharts.';
    if (typeof gripProjectIndex !== 'undefined' && gripProjectIndex !== null) {
        const projects = loadProjects();
        const p = projects[gripProjectIndex];
        if (p) ctx = `Working on whiteboard for project: ${p.name}. The whiteboard has ${gripCells?.length || 0} cells and ${gripConnections?.length || 0} connections.`;
    }
    processAISidebarChat('whiteboardAiInput', 'whiteboardAiMessages', ctx);
};
