const express = require('express');
const cors = require('cors');
require('dotenv').config();
const RAGPipeline = require('../ai/ragPipeline');
const WorkflowAgent = require('../ai/workflowAgent');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const ragPipeline = new RAGPipeline();
const agent = new WorkflowAgent(ragPipeline);

// Initialize the Vector Store when server starts
ragPipeline.initialize().catch(err => console.error("Failed to initialize RAG:", err));

// Main planning endpoint demonstrating multi-step workflow
app.post('/api/plan', async (req, res) => {
    try {
        const { sessionId, formData, userReply } = req.body;
        
        // Let the agent update memory
        agent.updateContext(sessionId || 'default_session_1', { formData, userReply });
        
        // Trigger the workflow orchestrator LLM to decide the next step
        const result = await agent.generateNextAction(sessionId || 'default_session_1');
        
        res.json({ 
            status: 'success', 
            data: result
        });
    } catch (error) {
        console.error('Error in /api/plan:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
