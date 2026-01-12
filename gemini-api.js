/* ============================================
   Layer - Gemini AI API Integration
   ============================================ */

// Gemini API Configuration
const GEMINI_API_KEY = 'AIzaSyAEiofNhi5YeNlFcC7R3R-FHYgyLMtUERQ';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// AI Chat State
let aiChatHistory = [];
let isAiTyping = false;

// ============================================
// Gemini API Functions
// ============================================

async function callGeminiAPI(prompt, context = '') {
  try {
    const systemPrompt = `You are a helpful AI assistant integrated into Layer, a project management application. 
You help users with their projects, answer questions, provide suggestions, and assist with task management.
Be concise, helpful, and friendly. Keep responses under 150 words unless more detail is needed.
${context ? `Context: ${context}` : ''}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt + '\n\nUser: ' + prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API Error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to get AI response');
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('Invalid response format from Gemini API');
  } catch (error) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
}

// ============================================
// Code Validation with Gemini
// ============================================

async function validateCodeWithGemini(code, language) {
  const prompt = `Analyze this ${language} code and check for errors. 
If there are errors, explain them briefly. If the code is correct, say "Code looks correct!" and briefly describe what it does.
Keep your response under 100 words.

Code:
\`\`\`${language.toLowerCase()}
${code}
\`\`\``;

  try {
    const response = await callGeminiAPI(prompt, `Code validation for ${language}`);
    return {
      success: true,
      message: response
    };
  } catch (error) {
    return {
      success: false,
      message: `Error validating code: ${error.message}`
    };
  }
}

// ============================================
// Enhanced AI Chat Handler
// ============================================

async function handleAiChatMessage(message, projectContext = null) {
  if (!message || message.trim() === '') return null;
  
  isAiTyping = true;
  
  let context = '';
  if (projectContext) {
    context = `Current project: ${projectContext.name || 'Unnamed Project'}. 
Tasks: ${projectContext.taskCount || 0} total. 
Status: ${projectContext.status || 'In Progress'}.`;
  }
  
  try {
    const response = await callGeminiAPI(message, context);
    
    // Add to chat history
    aiChatHistory.push({ role: 'user', content: message });
    aiChatHistory.push({ role: 'assistant', content: response });
    
    // Keep only last 10 messages
    if (aiChatHistory.length > 20) {
      aiChatHistory = aiChatHistory.slice(-20);
    }
    
    isAiTyping = false;
    return response;
  } catch (error) {
    isAiTyping = false;
    return `Sorry, I encountered an error: ${error.message}. Please try again.`;
  }
}

// ============================================
// Updated Project AI Chat Handler
// ============================================

async function handleProjectAiSendWithGemini() {
  const input = document.getElementById('projectAiInput');
  const messagesContainer = document.getElementById('projectAiMessages');
  
  if (!input || !messagesContainer) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'grip-ai-message user';
  userMsg.textContent = message;
  messagesContainer.appendChild(userMsg);
  
  input.value = '';
  input.disabled = true;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Show typing indicator
  const typingMsg = document.createElement('div');
  typingMsg.className = 'grip-ai-message assistant typing';
  typingMsg.id = 'projectAiTyping';
  typingMsg.innerHTML = '<span></span><span></span><span></span>';
  messagesContainer.appendChild(typingMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  try {
    // Get project context if available
    let projectContext = null;
    if (typeof gripProjectIndex !== 'undefined' && gripProjectIndex !== null) {
      const projects = typeof loadProjects === 'function' ? loadProjects() : [];
      const project = projects[gripProjectIndex];
      if (project) {
        projectContext = {
          name: project.name,
          taskCount: project.columns?.reduce((acc, col) => acc + col.tasks.length, 0) || 0,
          status: project.status
        };
      }
    }
    
    const response = await handleAiChatMessage(message, projectContext);
    
    // Remove typing indicator
    const typing = document.getElementById('projectAiTyping');
    if (typing) typing.remove();
    
    // Add AI response
    const aiMsg = document.createElement('div');
    aiMsg.className = 'grip-ai-message assistant';
    aiMsg.textContent = response || 'Sorry, I could not generate a response.';
    messagesContainer.appendChild(aiMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (error) {
    // Remove typing indicator
    const typing = document.getElementById('projectAiTyping');
    if (typing) typing.remove();
    
    // Show error
    const errorMsg = document.createElement('div');
    errorMsg.className = 'grip-ai-message assistant error';
    errorMsg.textContent = `Error: ${error.message}`;
    messagesContainer.appendChild(errorMsg);
  }
  
  input.disabled = false;
  input.focus();
}

// ============================================
// Enhanced Code Runner with Validation
// ============================================

async function runCodeWithValidation(cellId) {
  const cell = typeof gripCells !== 'undefined' ? gripCells.find(c => c.id === cellId) : null;
  if (!cell || !cell.isCodeContainer) return;
  
  const code = cell.content || '';
  const lang = typeof detectCodeLanguage === 'function' ? detectCodeLanguage(code) : 'Plain';
  const outputEl = document.getElementById(`codeOutput-${cellId}`);
  const contentEl = document.getElementById(`codeOutputContent-${cellId}`);
  const runBtn = document.getElementById(`codeRunBtn-${cellId}`);
  
  if (!outputEl || !contentEl) return;
  
  outputEl.style.display = 'block';
  contentEl.innerHTML = '<span style="color: #f97316;">⏳ Running & validating...</span>';
  
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;animation:spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>`;
  }
  
  try {
    // First, run the code locally if it's JavaScript
    let localOutput = '';
    let hasError = false;
    
    if (lang === 'JavaScript') {
      try {
        const logs = [];
        const originalLog = console.log;
        const originalError = console.error;
        
        console.log = (...args) => {
          logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
        };
        console.error = (...args) => {
          logs.push('❌ ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
        };
        
        const result = eval(code);
        
        console.log = originalLog;
        console.error = originalError;
        
        if (logs.length > 0) {
          localOutput = logs.join('\n');
        }
        if (result !== undefined && !logs.length) {
          localOutput = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        }
        if (!localOutput) {
          localOutput = '✅ Code executed successfully (no output)';
        }
      } catch (e) {
        hasError = true;
        localOutput = `❌ Error: ${e.message}`;
      }
    }
    
    // Then validate with Gemini AI
    const validation = await validateCodeWithGemini(code, lang);
    
    // Format output
    let finalOutput = '';
    
    if (lang === 'JavaScript') {
      finalOutput = `📊 Execution Output:\n${localOutput}\n\n🤖 AI Analysis:\n${validation.message}`;
    } else {
      finalOutput = `🤖 AI Analysis (${lang}):\n${validation.message}`;
    }
    
    contentEl.innerHTML = `<pre style="white-space: pre-wrap; margin: 0; font-family: 'SF Mono', Monaco, monospace; font-size: 12px; line-height: 1.5;">${escapeHtml(finalOutput)}</pre>`;
    
    // Update styling based on result
    if (hasError || finalOutput.toLowerCase().includes('error')) {
      outputEl.style.borderColor = '#ef4444';
      outputEl.style.background = 'rgba(239, 68, 68, 0.1)';
    } else {
      outputEl.style.borderColor = '#22c55e';
      outputEl.style.background = 'rgba(34, 197, 94, 0.1)';
    }
    
  } catch (error) {
    contentEl.innerHTML = `<span style="color: #ef4444;">❌ Error: ${escapeHtml(error.message)}</span>`;
    outputEl.style.borderColor = '#ef4444';
    outputEl.style.background = 'rgba(239, 68, 68, 0.1)';
  }
  
  if (runBtn) {
    runBtn.disabled = false;
    runBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Whiteboard AI Chat Handler (with Gemini)
// ============================================

async function handleWhiteboardAiSendWithGemini() {
  const input = document.getElementById('gripAiInput');
  const messagesContainer = document.getElementById('gripAiMessages');
  
  if (!input || !messagesContainer) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'grip-ai-message user';
  userMsg.textContent = message;
  messagesContainer.appendChild(userMsg);
  
  input.value = '';
  input.disabled = true;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Show typing indicator
  const typingMsg = document.createElement('div');
  typingMsg.className = 'grip-ai-message assistant typing';
  typingMsg.id = 'aiTyping';
  typingMsg.innerHTML = '<span></span><span></span><span></span>';
  messagesContainer.appendChild(typingMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  try {
    // Get whiteboard/project context
    let context = 'Whiteboard view - helping with project planning and task management.';
    if (typeof gripProjectIndex !== 'undefined' && gripProjectIndex !== null) {
      const projects = typeof loadProjects === 'function' ? loadProjects() : [];
      const project = projects[gripProjectIndex];
      if (project) {
        context = `Project: ${project.name}. Whiteboard view with cells and connections for visual project planning.`;
      }
    }
    
    const response = await handleAiChatMessage(message, { name: 'Whiteboard', context });
    
    // Remove typing indicator
    const typing = document.getElementById('aiTyping');
    if (typing) typing.remove();
    
    // Add AI response
    const aiMsg = document.createElement('div');
    aiMsg.className = 'grip-ai-message assistant';
    aiMsg.textContent = response || 'Sorry, I could not generate a response.';
    messagesContainer.appendChild(aiMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (error) {
    // Remove typing indicator
    const typing = document.getElementById('aiTyping');
    if (typing) typing.remove();
    
    // Show error
    const errorMsg = document.createElement('div');
    errorMsg.className = 'grip-ai-message assistant error';
    errorMsg.textContent = `Error: ${error.message}`;
    messagesContainer.appendChild(errorMsg);
  }
  
  input.disabled = false;
  input.focus();
}

// ============================================
// Doc AI Chat Handler (with Gemini)
// ============================================

async function handleDocAiSendWithGemini() {
  const input = document.getElementById('docAiInput') || document.getElementById('projectAiInput');
  const messagesContainer = document.getElementById('docAiMessages') || document.getElementById('projectAiMessages');
  
  if (!input || !messagesContainer) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'grip-ai-message user';
  userMsg.textContent = message;
  messagesContainer.appendChild(userMsg);
  
  input.value = '';
  input.disabled = true;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Show typing indicator
  const typingMsg = document.createElement('div');
  typingMsg.className = 'grip-ai-message assistant typing';
  typingMsg.id = 'docAiTyping';
  typingMsg.innerHTML = '<span></span><span></span><span></span>';
  messagesContainer.appendChild(typingMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  try {
    // Get doc context if available
    let docContext = null;
    const docs = typeof loadDocuments === 'function' ? loadDocuments() : [];
    if (docs.length > 0) {
      docContext = {
        name: 'Document',
        context: `User is working with documents. Total docs: ${docs.length}.`
      };
    }
    
    const response = await handleAiChatMessage(message, docContext);
    
    // Remove typing indicator
    const typing = document.getElementById('docAiTyping');
    if (typing) typing.remove();
    
    // Add AI response
    const aiMsg = document.createElement('div');
    aiMsg.className = 'grip-ai-message assistant';
    aiMsg.textContent = response || 'Sorry, I could not generate a response.';
    messagesContainer.appendChild(aiMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (error) {
    // Remove typing indicator
    const typing = document.getElementById('docAiTyping');
    if (typing) typing.remove();
    
    // Show error
    const errorMsg = document.createElement('div');
    errorMsg.className = 'grip-ai-message assistant error';
    errorMsg.textContent = `Error: ${error.message}`;
    messagesContainer.appendChild(errorMsg);
  }
  
  input.disabled = false;
  input.focus();
}

// ============================================
// Override all AI chat handlers
// ============================================

// Override project AI send
window.handleProjectAiSend = handleProjectAiSendWithGemini;

// Override whiteboard AI send
window.handleAiSend = handleWhiteboardAiSendWithGemini;

// Override doc AI send
window.handleDocAiSend = handleDocAiSendWithGemini;

// Export other functions
window.runCodeWithValidation = runCodeWithValidation;
window.validateCodeWithGemini = validateCodeWithGemini;
window.callGeminiAPI = callGeminiAPI;
window.handleWhiteboardAiSendWithGemini = handleWhiteboardAiSendWithGemini;
window.handleDocAiSendWithGemini = handleDocAiSendWithGemini;
