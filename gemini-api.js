/* ============================================
   Layer - Gemini AI API Integration
   Using Official Google SDK (Stable v1)
   ============================================ */

// 1. Import the SDK from the CDN
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// 2. YOUR API KEY
const GEMINI_API_KEY = "AIzaSyDj-SWFRGDFEzw10ueBUOCgn3UE8qLrYaM";

// 3. Initialize the API
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "You are the AI assistant for 'Layer', a project management app. Help the user manage tasks, write docs, and fix code. Be professional and concise."
});

/**
 * Core API Call to Gemini
 */
async function callGeminiAPI(userPrompt, context = '') {
    try {
        // We include context in the prompt for 1.5-flash
        const fullPrompt = `Context about the user's current work: ${context}\n\nUser Question: ${userPrompt}`;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();
        
        if (text) return text;
        throw new Error('AI returned an empty response.');
    } catch (error) {
        console.error('Gemini SDK Error:', error);
        if (error.message.includes('quota')) {
            throw new Error("Rate limit reached. Please wait 60 seconds.");
        }
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
    msgDiv.style.whiteSpace = "pre-wrap";
    msgDiv.textContent = text;
    
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return msgDiv;
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
// UI Specific Overrides
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
