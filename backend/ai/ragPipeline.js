const fs = require('fs');
const path = require('path');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { Document } = require('langchain/document');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { TaskType } = require('@google/generative-ai');

/**
 * RAG Pipeline Component
 * Updated for March 2026 Gemini API Specs
 */
class RAGPipeline {
    constructor() {
        this.vectorStore = null;
        this.isInitialized = false;
        this.dataDir = path.join(__dirname, '../../data');
    }

    async initialize() {
        if (this.isInitialized) return;

        console.log("🚀 Initializing Knowledge Base...");

        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            console.warn(`Data directory not found. Creating at ${this.dataDir}`);
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        const files = fs.readdirSync(this.dataDir).filter(file => file.endsWith('.md'));

        if (files.length === 0) {
            console.warn("⚠️ No .md documents found. Knowledge base will be empty.");
            return;
        }

        const rawDocs = files.map(filename => {
            const content = fs.readFileSync(path.join(this.dataDir, filename), 'utf-8');
            return new Document({
                pageContent: content,
                metadata: { source: filename }
            });
        });

        // STEP 1: Split documents into chunks (Essential for accuracy)
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const docs = await textSplitter.splitDocuments(rawDocs);

        // STEP 2: Initialize Embeddings with 2026 standards
        try {
            this.vectorStore = await MemoryVectorStore.fromDocuments(
                docs,
                new GoogleGenerativeAIEmbeddings({
                    apiKey: process.env.GOOGLE_API_KEY,
                    // 'gemini-embedding-001' is the 2026 stable text model.
                    // For multimodal (images/audio), use 'gemini-embedding-2-preview'.
                    modelName: "gemini-embedding-001",
                    // CRITICAL: Point to v1beta for 2026 model compatibility
                    apiVersion: "v1beta",
                    taskType: TaskType.RETRIEVAL_DOCUMENT
                })
            );

            console.log(`✅ Knowledge Base Initialized with ${docs.length} chunks.`);
            this.isInitialized = true;
        } catch (error) {
            console.error("❌ Failed to initialize embeddings:", error.message);
            throw error;
        }
    }

    async retrieve(query) {
        if (!this.isInitialized || !this.vectorStore) {
            return [];
        }

        // Retrieve top 3 relevant chunks
        const results = await this.vectorStore.similaritySearch(query, 3);
        console.log(results);
        return results.map(doc => ({
            source: doc.metadata.source,
            content: doc.pageContent
        }));
    }
}

module.exports = RAGPipeline;