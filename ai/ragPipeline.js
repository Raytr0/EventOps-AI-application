const fs = require('fs');
const path = require('path');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { Document } = require('langchain/document');

/**
 * RAG Pipeline Component
 * Requirement 1: Event Knowledge Base
 */
class RAGPipeline {
    constructor() {
        this.vectorStore = null;
        this.isInitialized = false;
        this.dataDir = path.join(__dirname, '../data');
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log("Initializing Knowledge Base...");
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
             console.warn(`Data directory not found at ${this.dataDir}. Creating it...`);
             fs.mkdirSync(this.dataDir, { recursive: true });
        }

        const files = fs.readdirSync(this.dataDir).filter(file => file.endsWith('.md'));
        
        if (files.length === 0) {
             console.warn("No documents found in the data directory. Knowledge base will be empty.");
             return;
        }

        const docs = files.map(filename => {
            const content = fs.readFileSync(path.join(this.dataDir, filename), 'utf-8');
            return new Document({ 
                pageContent: content, 
                metadata: { source: filename } 
            });
        });

        // Use OpenAI Embeddings to vectorize documents
        this.vectorStore = await MemoryVectorStore.fromDocuments(
            docs,
            new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })
        );
        
        console.log(`Knowledge Base Initialized with ${docs.length} documents.`);
        this.isInitialized = true;
    }

    async retrieve(query) {
        if (!this.isInitialized || !this.vectorStore) {
            console.warn("RAG Pipeline not initialized or no documents. Returning empty context.");
            return [];
        }
        
        console.log(`Retrieving documents for query: ${query}`);
        // Retrieve top 3 most relevant documents
        const results = await this.vectorStore.similaritySearch(query, 3);
        
        return results.map(doc => ({
            source: doc.metadata.source,
            content: doc.pageContent
        }));
    }
}

module.exports = RAGPipeline;
