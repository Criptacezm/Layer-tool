/**
 * RAG Context Helper Functions
 * Handles embedding generation, vector search, and context retrieval for AI chat
 */

// OpenAI Embedding API configuration (can be swapped for other providers)
const EMBEDDING_API_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions, cost-effective

/**
 * @typedef {Object} EmbeddingResult
 * @property {string} id - Embedding ID
 * @property {string} content - Original content
 * @property {string} contentType - Type of content (task, note, etc.)
 * @property {number} similarity - Similarity score (0-1)
 */

/**
 * Generate embedding for text content
 * Requires OpenAI API key - can be passed from server-side or user config
 * @param {string} text - Text to embed
 * @param {string} apiKey - OpenAI API key (optional, can use env var on server)
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text, apiKey = null) {
    // Prefer server-side embedding generation for security
    // This is a client-side fallback for development
    const key = apiKey || window.OPENAI_API_KEY;
    
    if (!key) {
        console.warn('No OpenAI API key available for embedding generation');
        return null;
    }

    try {
        const response = await fetch(EMBEDDING_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                input: text.substring(0, 8000) // Truncate to token limit
            })
        });

        if (!response.ok) {
            throw new Error(`Embedding API error: ${response.status}`);
        }

        const data = await response.json();
        return data.data[0].embedding;
    } catch (err) {
        console.error('Error generating embedding:', err);
        return null;
    }
}

/**
 * Store embedding in Supabase
 * @param {string} projectId - Project ID
 * @param {string} contentType - Type of content
 * @param {string} content - Original content
 * @param {number[]} embedding - Embedding vector
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Created embedding record
 */
async function storeEmbedding(projectId, contentType, content, embedding, metadata = {}) {
    if (!window.supabase) {
        throw new Error('Supabase client not available');
    }

    const { data, error } = await window.supabase
        .from('project_embeddings')
        .insert({
            project_id: projectId,
            content_type: contentType,
            content: content,
            embedding: embedding,
            metadata: metadata
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieve relevant embeddings using vector similarity search
 * @param {string} projectId - Project ID to search within
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum results to return
 * @param {number} options.threshold - Minimum similarity threshold (0-1)
 * @param {string[]} options.contentTypes - Filter by content types
 * @returns {Promise<EmbeddingResult[]>}
 */
async function retrieveRelevantEmbeddings(projectId, queryEmbedding, options = {}) {
    const { limit = 5, threshold = 0.7, contentTypes = null } = options;

    if (!window.supabase) {
        throw new Error('Supabase client not available');
    }

    // Use Supabase RPC function for vector similarity search
    // This requires a database function (created below)
    const { data, error } = await window.supabase.rpc('search_project_embeddings', {
        p_project_id: projectId,
        p_query_embedding: queryEmbedding,
        p_limit: limit,
        p_threshold: threshold,
        p_content_types: contentTypes
    });

    if (error) {
        console.error('Error retrieving embeddings:', error);
        return [];
    }

    return data || [];
}

/**
 * Build RAG context from retrieved embeddings
 * @param {EmbeddingResult[]} embeddings - Retrieved embeddings
 * @returns {string} Formatted context string
 */
function formatEmbeddingsForContext(embeddings) {
    if (!embeddings || embeddings.length === 0) {
        return '';
    }

    const parts = ['### Relevant Project Context (RAG)\n'];

    // Group by content type
    const grouped = {};
    embeddings.forEach(e => {
        const type = e.content_type || 'other';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(e);
    });

    // Format each group
    Object.entries(grouped).forEach(([type, items]) => {
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1) + 's';
        parts.push(`**${typeLabel}:**`);
        items.forEach(item => {
            const truncated = item.content.substring(0, 500);
            parts.push(`- ${truncated}${item.content.length > 500 ? '...' : ''}`);
        });
        parts.push('');
    });

    return parts.join('\n');
}

/**
 * Full RAG pipeline: embed query, search, and format context
 * @param {string} projectId - Project ID
 * @param {string} query - User query text
 * @param {Object} options - Options
 * @returns {Promise<string>} Formatted RAG context
 */
async function performRAGRetrieval(projectId, query, options = {}) {
    try {
        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query);
        
        if (!queryEmbedding) {
            console.warn('Could not generate query embedding, skipping RAG');
            return '';
        }

        // Retrieve relevant embeddings
        const embeddings = await retrieveRelevantEmbeddings(projectId, queryEmbedding, options);

        // Format for context
        return formatEmbeddingsForContext(embeddings);
    } catch (err) {
        console.error('RAG retrieval error:', err);
        return '';
    }
}

/**
 * Index project content for RAG
 * Call this when a project is selected or content is updated
 * @param {string} projectId - Project ID
 * @param {Object} projectData - Full project data from ProjectContext
 */
async function indexProjectContent(projectId, projectData) {
    if (!projectData) return;

    const embeddingPromises = [];

    // Index tasks
    if (projectData.tasks) {
        projectData.tasks.forEach(task => {
            const content = `${task.title}\n${task.description || ''}`;
            embeddingPromises.push(
                generateEmbedding(content).then(embedding => {
                    if (embedding) {
                        return storeEmbedding(projectId, 'task', content, embedding, {
                            task_id: task.id,
                            status: task.status,
                            assignee: task.assignee_name
                        });
                    }
                }).catch(err => console.error('Failed to index task:', err))
            );
        });
    }

    // Index milestones
    if (projectData.milestones) {
        projectData.milestones.forEach(milestone => {
            const content = `${milestone.title}\n${milestone.description || ''}`;
            embeddingPromises.push(
                generateEmbedding(content).then(embedding => {
                    if (embedding) {
                        return storeEmbedding(projectId, 'milestone', content, embedding, {
                            milestone_id: milestone.id,
                            completed: milestone.completed
                        });
                    }
                }).catch(err => console.error('Failed to index milestone:', err))
            );
        });
    }

    // Index docs (truncate content for embedding)
    if (projectData.docs) {
        projectData.docs.forEach(doc => {
            const content = `${doc.title}\n${(doc.content || '').substring(0, 2000)}`;
            embeddingPromises.push(
                generateEmbedding(content).then(embedding => {
                    if (embedding) {
                        return storeEmbedding(projectId, 'doc', content, embedding, {
                            doc_id: doc.id,
                            title: doc.title
                        });
                    }
                }).catch(err => console.error('Failed to index doc:', err))
            );
        });
    }

    // Index project description
    if (projectData.description) {
        embeddingPromises.push(
            generateEmbedding(projectData.description).then(embedding => {
                if (embedding) {
                    return storeEmbedding(projectId, 'description', projectData.description, embedding, {
                        project_name: projectData.name
                    });
                }
            }).catch(err => console.error('Failed to index project description:', err))
        );
    }

    // Wait for all indexing to complete (non-blocking in practice)
    await Promise.allSettled(embeddingPromises);
    console.log(`Indexed project ${projectId} content for RAG`);
}

/**
 * Clear all embeddings for a project
 * @param {string} projectId - Project ID
 */
async function clearProjectEmbeddings(projectId) {
    if (!window.supabase) return;

    const { error } = await window.supabase
        .from('project_embeddings')
        .delete()
        .eq('project_id', projectId);

    if (error) {
        console.error('Error clearing project embeddings:', error);
    }
}

/**
 * Check if embeddings exist for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>}
 */
async function hasProjectEmbeddings(projectId) {
    if (!window.supabase) return false;

    const { count, error } = await window.supabase
        .from('project_embeddings')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);

    if (error) {
        console.error('Error checking embeddings:', error);
        return false;
    }

    return count > 0;
}

// Export for use in other modules
window.RAGContext = {
    generateEmbedding,
    storeEmbedding,
    retrieveRelevantEmbeddings,
    formatEmbeddingsForContext,
    performRAGRetrieval,
    indexProjectContent,
    clearProjectEmbeddings,
    hasProjectEmbeddings
};
