/* ============================================
   Layer - Gemini AI API Integration
   Model: Gemini 1.5 Flash (Stable Free Tier)
   ============================================ */

// 1. YOUR API KEY
const GEMINI_API_KEY = "AIzaSyDj-SWFRGDFEzw10ueBUOCgn3UE8qLrYaM";

// 2. STABLE MODEL URL
// Switched from 2.0-flash to 1.5-flash to avoid the "Limit: 0" quota error.
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

/**
 * Core API Call to Gemini
 */
async function callGeminiAPI(userPrompt, context = '') {
    try {
        // Professional system prompt to keep AI on track
        const systemInstruction = `You are the AI assistant for "Layer", a project management app. 
        Context: ${context}. Help the user manage tasks, write documents, and fix code. 
        Keep responses helpful, professional, and under 150 words.`;

        const requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [{ text: `SYSTEM INSTRUCTION: ${systemInstruction}\n\nUSER PROMPT: ${userPrompt}` }]
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

        const data = await response.json();

        if (!response.ok) {
            // Handle specific quota errors with a friendly message
            if (data.error?.message.includes('quota')) {
                throw new Error("The AI is busy (Rate Limit). Please wait 60 seconds and try again.");
            }
            throw new Error(data.error?.message || 'Gemini API Error');
        }
        
        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        }
        
        throw new Error('AI returned an empty response. Try rephrasing.');
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
    
    // Simple formatting for line breaks
    msgDiv.style.whiteSpace = "pre-wrap";
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
// UI Specific Overrides (Mapped to your HTML)
// ============================================

window.handleProjectAiSend = function() {
    let ctx = "Global dashboard view.";
    if (typeof gripProjectIndex !== 'undefined' && gripProjectIndex !== null) {
        const projects = loadProjects();
        const p = projects[gripProjectIndex];
        if (p) ctx = `Working on Project: ${p.name}.`;
    }
    processGenericAiChat('projectAiInput', 'projectAiMessages', 'projectAiTyping', ctx);
};

window.handleAiSend = function() {
    processGenericAiChat('gripAiInput', 'gripAiMessages', 'aiTyping', 'User is using a flowchart whiteboard.');
};

window.handleDocContentAiSend = function() {
    const editor = document.getElementById('docEditorContent');
    const docText = editor ? editor.innerText.substring(0, 500) : '';
    const ctx = `Editing a document. Existing content: ${docText}`;
    processGenericAiChat('docContentAiInput', 'docContentAiMessages', 'docContentAiTyping', ctx);
};

window.handleDocAiSend = window.handleProjectAiSend;
