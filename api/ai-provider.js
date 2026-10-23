/* ============================================
   Layer - AI provider resolution + proxy logic
   Shared by the Express server and the Vercel function.

   Provider is picked from AI_PROVIDER, otherwise from whichever
   API key is present in the environment, otherwise it falls back to
   a keyless free endpoint so the AI works out of the box.
   ============================================ */

const PROVIDERS = {
  pollinations: {
    label: 'Pollinations',
    url: 'https://text.pollinations.ai/openai',
    model: 'openai',
    keyEnv: null
  },
  groq: {
    label: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    keyEnv: 'GROQ_API_KEY'
  },
  openrouter: {
    label: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    keyEnv: 'OPENROUTER_API_KEY'
  },
  gemini: {
    label: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
    keyEnv: 'GEMINI_API_KEY'
  },
  nvidia: {
    label: 'NVIDIA',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'meta/llama-3.1-8b-instruct',
    keyEnv: 'NVIDIA_API_KEY'
  }
};

// Providers that need a key, in the order they are auto-selected.
const KEYED_ORDER = ['groq', 'openrouter', 'gemini', 'nvidia'];

// Parameters the free OpenAI-compatible endpoints reject.
const UNSUPPORTED_PARAMS = ['top_k', 'repetition_penalty'];

function resolveProvider() {
  const requested = (process.env.AI_PROVIDER || '').toLowerCase();
  if (requested && PROVIDERS[requested]) {
    return { name: requested, ...PROVIDERS[requested] };
  }

  const withKey = KEYED_ORDER.find(name => process.env[PROVIDERS[name].keyEnv]);
  const name = withKey || 'pollinations';
  return { name, ...PROVIDERS[name] };
}

function providerInfo() {
  const provider = resolveProvider();
  return {
    provider: provider.name,
    label: provider.label,
    model: process.env.AI_MODEL || provider.model,
    keyless: !provider.keyEnv
  };
}

function buildPayload(body, provider) {
  const payload = { ...(body || {}) };
  UNSUPPORTED_PARAMS.forEach(param => { delete payload[param]; });
  payload.model = process.env.AI_MODEL || provider.model;
  payload.stream = false;
  return payload;
}

// Provider first, then any other configured provider, so one dead free
// endpoint does not take the assistant down.
function candidateProviders() {
  const primary = resolveProvider();
  const rest = [...KEYED_ORDER, 'pollinations']
    .filter(name => name !== primary.name)
    .filter(name => !PROVIDERS[name].keyEnv || process.env[PROVIDERS[name].keyEnv])
    .map(name => ({ name, ...PROVIDERS[name] }));
  return [primary, ...rest];
}

function normalizeError(provider, status, payload) {
  const raw = payload && payload.error;
  const message = (raw && (raw.message || (typeof raw === 'string' ? raw : null)))
    || (payload && payload.message)
    || `${provider.label} request failed (${status})`;
  return { error: { message: `${provider.label}: ${message}`, status } };
}

async function callProvider(body, provider) {
  const apiKey = provider.keyEnv ? process.env[provider.keyEnv] : null;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(provider.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildPayload(body, provider))
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (response.ok && payload) {
    return { status: 200, body: payload };
  }

  if (payload) {
    return { status: response.status >= 400 ? response.status : 502, body: normalizeError(provider, response.status, payload) };
  }

  const text = await response.text().catch(() => '');
  return {
    status: response.status >= 400 ? response.status : 502,
    body: {
      error: {
        message: `${provider.label} returned a non-JSON response`,
        details: text.slice(0, 500)
      }
    }
  };
}

async function proxyAIRequest(body) {
  let last = null;

  for (const provider of candidateProviders()) {
    try {
      const result = await callProvider(body, provider);
      if (result.status === 200) return result;
      last = result;
    } catch (error) {
      last = { status: 502, body: { error: { message: `${provider.label}: ${error.message}` } } };
    }
  }

  return last || { status: 502, body: { error: { message: 'No AI provider is configured' } } };
}

module.exports = { PROVIDERS, resolveProvider, providerInfo, buildPayload, candidateProviders, proxyAIRequest };
