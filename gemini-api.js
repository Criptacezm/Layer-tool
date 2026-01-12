import { GoogleGenAI } from "@google/genai";

// Initialize the API key directly to avoid SyntaxErrors with process.env in browser
const API_KEY = "AIzaSyDj-SWFRGDFEzw10ueBUOCgn3UE8qLrYaM";
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Core API Call to Gemini
 */
async function callGeminiAPI(userPrompt, context = '') {
    try {
        const fullPrompt = `Context: ${context}\n\nUser Question: ${userPrompt}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-latest',
            contents: fullPrompt
        });
        
        const text = response.text;
        if (text) return text;
        throw new Error('AI returned an empty response.');
    } catch (error) {
        console.error('Gemini SDK Error:', error);
        return `Error: ${error.message}`;
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
    msgDiv.style.whiteSpace = "pre-wrap";
    msgDiv.textContent = text;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

/**
 * Handles AI Chat for all contexts
 */
async function processGenericAiChat(inputId, messagesId, typingId, contextData = '') {
    const input = document.getElementById(inputId);
    const container = document.getElementById(messagesId);
    if (!input || !container) return;

    const message = input.value.trim();
    if (!message) return;

    appendAiMessage(messagesId, 'user', message);
    input.value = '';
    input.disabled = true;

    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'grip-ai-message assistant typing';
    typingIndicator.id = typingId;
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(typingIndicator);
    container.scrollTop = container.scrollHeight;

    try {
        const response = await callGeminiAPI(message, contextData);
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
// ATTACH TO WINDOW
// ============================================

window.handleProjectAiSend = function() {
    let ctx = "Global dashboard view.";
    // Ensure accessing global variable safely
    if (typeof window.loadProjects === 'function' && typeof window.gripProjectIndex !== 'undefined' && window.gripProjectIndex !== null) {
        const projects = window.loadProjects();
        const p = projects[window.gripProjectIndex];
        if (p) ctx = `Working on Project: ${p.name}.`;
    }
    processGenericAiChat('projectAiInput', 'projectAiMessages', 'projectAiTyping', ctx);
};

window.handleWhiteboardAiSendWithGemini = function() {
    processGenericAiChat('gripAiInput', 'gripAiMessages', 'aiTyping', 'User is using a flowchart whiteboard. Help with cells, connections, and layout.');
};

window.handleDocContentAiSend = function() {
    const editor = document.getElementById('docEditorContent');
    const docText = editor ? editor.innerText.substring(0, 500) : '';
    const ctx = `Editing a document. Existing content: ${docText}`;
    processGenericAiChat('docContentAiInput', 'docContentAiMessages', 'docContentAiTyping', ctx);
};
