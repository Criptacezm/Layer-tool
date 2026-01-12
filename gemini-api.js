/* ============================================
   Layer - Gemini AI API Integration
   Fixed & Optimized
   ============================================ */

// Gemini API Configuration
const GEMINI_API_KEY = "AIzaSyDj-SWFRGDFEzw10ueBUOCgn3UE8qLrYaM";
// FIX: Key is only appended once during the fetch call
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// AI Chat State
let aiChatHistory = [];

/**
 * Core API Call to Gemini
 */
async function callGeminiAPI(userPrompt, context = '') {
    try {
        const systemInstruction = `You are a helpful AI assistant for "Layer", a project management app. 
        Context: ${context}. Help with tasks, docs, and code. Be concise (under 150 words).`;

        // FIX: Construct request body to include official system_instruction for v1beta
        const requestBody = {
            system_instruction: {
                parts: [{ text: systemInstruction }]
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: userPrompt }]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
            }
        };

        const response = await fetch(`${GEMINI_API_BASE_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Gemini API Error');
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        }
        
        throw new Error('Empty response from AI');
    } catch (error) {
        console.error('AI Error:', error);
        throw error;
    }
}

/**
 * Universal UI Message Appender
 */
function appendAiMessage(containerId, role, text) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `grip-ai-message ${role}`;
    msgDiv.textContent = text;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return msgDiv;
}

/**
 * Handles AI Chat for all contexts (Project, Whiteboard, Docs)
 */
async function processGenericAiChat(inputId, messagesId, typingId, contextData = '') {
    const input = document.getElementById(inputId);
    const container = document.getElementById(messagesId);
    if (!input || !container) return;

    const message = input.value.trim();
    if (!message) return;

    // 1. Add User Message
    appendAiMessage(messagesId, 'user', message);
    input.value = '';
    input.disabled = true;

    // 2. Show Typing Indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'grip-ai-message assistant typing';
    typingIndicator.id = typingId;
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(typingIndicator);
    container.scrollTop = container.scrollHeight;

    try {
        const response = await callGeminiAPI(message, contextData);
        
        // 3. Remove Typing & Add AI Response
        if (document.getElementById(typingId)) document.getElementById(typingId).remove();
        appendAiMessage(messagesId, 'assistant', response);
    } catch (error) {
        if (document.getElementById(typingId)) document.getElementById(typingId).remove();
        appendAiMessage(messagesId, 'assistant error', `Error: ${error.message}`);
    } finally {
        input.disabled = false;
        input.focus();
    }
}

// ============================================
// UI Specific Overrides
// ============================================

// 1. Project Assistant (Main Dashboard/Project View)
window.handleProjectAiSend = function() {
    let ctx = "Global project view.";
    if (typeof gripProjectIndex !== 'undefined' && gripProjectIndex !== null) {
        const projects = loadProjects();
        const p = projects[gripProjectIndex];
        if (p) ctx = `Project: ${p.name}. Description: ${p.description}`;
    }
    processGenericAiChat('projectAiInput', 'projectAiMessages', 'projectAiTyping', ctx);
};

// 2. Whiteboard Assistant (Grip Diagram)
window.handleAiSend = function() {
    processGenericAiChat('gripAiInput', 'gripAiMessages', 'aiTyping', 'User is on a visual whiteboard creating flowcharts.');
};

// 3. Document Editor Assistant (Notion-style)
window.handleDocContentAiSend = function() {
    const editor = document.getElementById('docEditorContent');
    const docText = editor ? editor.innerText.substring(0, 1000) : '';
    const ctx = `User is editing a document. Content: ${docText}`;
    processGenericAiChat('docContentAiInput', 'docContentAiMessages', 'docContentAiTyping', ctx);
};

/**
 * Code Validation with Gemini
 */
async function validateCodeWithGemini(code, language) {
    const prompt = `Review this ${language} code for bugs. If clean, explain it briefly. Code:\n${code}`;
    try {
        const res = await callGeminiAPI(prompt, "Code Reviewer Mode");
        return { success: true, message: res };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Enhanced Code Runner (Called from Grip Cells)
 */
async function runCodeWithValidation(cellId) {
    const cell = typeof gripCells !== 'undefined' ? gripCells.find(c => c.id === cellId) : null;
    if (!cell) return;

    const outputEl = document.getElementById(`codeOutput-${cellId}`);
    const contentEl = document.getElementById(`codeOutputContent-${cellId}`);
    if (!outputEl || !contentEl) return;

    outputEl.style.display = 'block';
    contentEl.textContent = '⏳ AI is reviewing and executing...';

    const code = cell.content || '';
    const lang = typeof detectCodeLanguage === 'function' ? detectCodeLanguage(code) : 'JavaScript';

    try {
        const validation = await validateCodeWithGemini(code, lang);
        contentEl.textContent = validation.message;
        outputEl.style.borderColor = validation.success ? '#22c55e' : '#ef4444';
    } catch (e) {
        contentEl.textContent = "Error connecting to AI.";
    }
}

// Export for global access
window.runCodeWithValidation = runCodeWithValidation;
