/* ============================================
   Layer - Gemini AI API Integration
   Enhanced with Retry Logic & Error Handling
   ============================================ */

import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// -----------------------------------------------------------------------
// API Configuration
// -----------------------------------------------------------------------
const GEMINI_API_KEY = "AIzaSyAHQ3lI9as0lPG7CK8DALQ3Odgh93HkYDc";

// Check if key is missing to prevent vague errors
if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_OWN_API_KEY_HERE" || GEMINI_API_KEY === "") {
    console.error("❌ GEMINI API KEY IS MISSING. Please edit gemini-api.js and add your key.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-001",
    systemInstruction: `You are a highly intelligent, concise AI assistant. You provide SHORT, direct answers.
    RESPONSE RULES:
    - Keep responses under 150 words unless specifically asked for detail.
    - Use bullet points (•) for lists.
    - Wrap code in triple backticks.
    - Be helpful, precise, and brief.`
});

const codeModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-001",
    systemInstruction: `You are an expert code analyzer. Respond ONLY in valid JSON format: { "errors": [] }`
});

/**
 * Wait helper for rate limit backoff
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Core API Call with Retry Logic (Exponential Backoff)
 */
async function callGeminiAPI(userPrompt, context = '') {
    // Immediate check for valid key
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR_OWN")) {
        return "⚠️ Error: You haven't added your API Key yet. Please check gemini-api.js";
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const fullPrompt = context ? `Context: ${context}\n\nUser: ${userPrompt}` : userPrompt;
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            return response.text();

        } catch (error) {
            // Check for 429 (Too Many Requests) or 503 (Server Overload)
            if (error.message.includes('429') || error.message.includes('503') || error.message.includes('Quota')) {
                attempt++;
                if (attempt >= maxRetries) {
                    return "⚠️ API Limit Reached. Please wait a moment or check your API key quota.";
                }
                // Wait longer for each retry (2s, 4s, 8s)
                const waitTime = 2000 * Math.pow(2, attempt);
                console.warn(`Gemini API 429 Error. Retrying in ${waitTime}ms...`);
                await delay(waitTime);
            } else {
                console.error('Gemini SDK Error:', error);
                return `Error: ${error.message}`;
            }
        }
    }
}

/**
 * Analyze code for errors with Retry Logic
 */
async function analyzeCodeErrors(code, language = 'javascript') {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR_OWN")) return { errors: [] };

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const prompt = `Analyze this ${language} code for errors. Return JSON only:\n\`\`\`${language}\n${code}\n\`\`\``;
            const result = await codeModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return { errors: [] };

        } catch (error) {
            if (error.message.includes('429') || error.message.includes('Quota')) {
                attempt++;
                if (attempt >= maxRetries) return { errors: [] };
                await delay(2000 * Math.pow(2, attempt));
            } else {
                console.error('Code analysis error:', error);
                return { errors: [] };
            }
        }
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
 */
function formatAIResponse(text) {
    let html = text;
    
    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        const codeId = 'code-' + Math.random().toString(36).substr(2, 9);
        return `<div class="ai-code-container" data-lang="${language}">
            <div class="ai-code-toolbar">
                <span class="ai-code-language">${language}</span>
                <button class="ai-code-copy-btn" onclick="copyAICode('${codeId}', this)" data-code-id="${codeId}">
                    <span class="copy-text">Copy</span>
                </button>
            </div>
            <pre class="ai-code-pre" id="${codeId}"><code class="ai-code">${escapeHtml(code.trim())}</code></pre>
        </div>`;
    });
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
    
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4 class="ai-heading">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="ai-heading">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="ai-heading">$1</h2>');
    
    // Lists
    html = html.replace(/^[•\-\*]\s+(.+)$/gm, '<li class="ai-list-item">$1</li>');
    html = html.replace(/(<li class="ai-list-item">.*<\/li>\n?)+/g, '<ul class="ai-list">$&</ul>');
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ai-numbered-item">$1</li>');
    html = html.replace(/(<li class="ai-numbered-item">.*<\/li>\n?)+/g, '<ol class="ai-numbered-list">$&</ol>');
    
    // Paragraphs
    html = html.split('\n\n').map(p => {
        p = p.trim();
        if (!p) return '';
        if (p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<div') || p.startsWith('<h') ) return p;
        return `<p class="ai-text">${p}</p>`;
    }).join('');
    
    return html;
}

async function revealWordsAnimated(container, formattedHtml, speed = 10) {
    return new Promise((resolve) => {
        container.innerHTML = formattedHtml;
        container.style.opacity = '1';
        container.scrollTop = container.scrollHeight;
        resolve();
    });
}

function createLoadingIndicator(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'ai-response-card ai-loading-state';
    loadingDiv.id = 'aiLoadingIndicator';
    loadingDiv.innerHTML = `<div class="ai-loading-content"><div class="ai-loading-orb"></div><span class="ai-loading-label">Thinking...</span></div>`;
    container.appendChild(loadingDiv);
    container.scrollTop = container.scrollHeight;
    return loadingDiv;
}

function removeLoadingIndicator() {
    const loading = document.getElementById('aiLoadingIndicator');
    if (loading) loading.remove();
}

async function appendAiMessageEnhanced(containerId, role, text, animate = true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-response-card ${role}-card`;
    
    if (role === 'user') {
        msgDiv.innerHTML = `<div class="ai-user-message"><div class="ai-user-content">${escapeHtml(text)}</div></div>`;
    } else {
        const formattedHtml = formatAIResponse(text);
        msgDiv.innerHTML = `<div class="ai-assistant-message"><div class="ai-assistant-content">${formattedHtml}</div></div>`;
    }
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

async function processAISidebarChat(inputId, messagesId, contextData = '') {
    const input = document.getElementById(inputId);
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;

    await appendAiMessageEnhanced(messagesId, 'user', message, false);
    input.value = '';
    input.disabled = true;
    createLoadingIndicator(messagesId);

    const response = await callGeminiAPI(message, contextData);
    
    removeLoadingIndicator();
    await appendAiMessageEnhanced(messagesId, 'assistant', response, true);
    
    input.disabled = false;
    input.focus();
}

// Global Exports
window.callGeminiAPI = callGeminiAPI;
window.analyzeCodeErrors = analyzeCodeErrors;
window.formatAIResponse = formatAIResponse;
window.processAISidebarChat = processAISidebarChat;
