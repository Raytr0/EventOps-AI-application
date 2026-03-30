const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('langchain/schema');

/**
 * Multi-Step Workflow Agent
 * Requirement 2: Agentic Logic
 * Requirement 3: Event Context and State Tracking
 * Requirement 4: Structured Artifact Output
 */
class WorkflowAgent {
    constructor(ragPipeline) {
        this.rag = ragPipeline;
        // The memory store per session. Currently mapped by a generic id or just a singleton object for demo.
        this.sessions = {}; 
    }

    // Step 1: Ingest Form Data or Replies
    updateContext(sessionId, newData) {
        if (!this.sessions[sessionId]) {
            this.sessions[sessionId] = { turnCount: 0, formData: {}, conversation: [] };
        }
        
        // Merge structured form data into state
        if (newData.formData) {
           this.sessions[sessionId].formData = { 
               ...this.sessions[sessionId].formData, 
               ...newData.formData 
           };
        }
        
        // Save user replies to clarify constraints
        if (newData.userReply) {
           this.sessions[sessionId].conversation.push({ role: 'user', content: newData.userReply });
        }
        
        this.sessions[sessionId].turnCount++;
        console.log(`Updated Session State for [${sessionId}]:`, this.sessions[sessionId]);
    }

    async generateNextAction(sessionId) {
        const session = this.sessions[sessionId];
        if (!session) throw new Error("Session not found");

        const { formData, conversation, turnCount } = session;

        // Requirement 1: Build a targeted query based on context
        const query = `Find venues matching budget ${formData.budget || 'any'}, capacity for ${formData.guests || 'any'} guests, dietary needs ${formData.dietary || 'none'}, theme ${formData.theme || 'none'}`;
        
        // Requirement 1: Retrieve documents
        const docs = await this.rag.retrieve(query);
        const contextStr = docs.map(d => `[Source: ${d.source}]\n${d.content}`).join("\n\n");

        // Requirement 2: Multi-step Orchestration using an LLM
        const chat = new ChatOpenAI({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: "gpt-3.5-turbo", // Or gpt-4
            temperature: 0.2
        });

        // Prompt that forces the agent to decide between clarifying conflicts OR generating an itinerary
        const systemPrompt = `
You are an EventOps AI Assistant orchestrating a multi-step travel and event planning workflow.

You have access to the following user constraints:
Budget: ${formData.budget || 'Not specified'}
Guests: ${formData.guests || 'Not specified'}
Dietary: ${formData.dietary || 'Not specified'}
Theme: ${formData.theme || 'Not specified'}

You also have access to the following retrieved Knowledge Base documents:
---
${contextStr}
---

Your task:
1. Analyze the user constraints against the retrieved documents.
2. Are there any CONFLICTS? (e.g., budget is lower than venue minimum, or dietary needs cannot be met).
3. IF there are unresolved conflicts, output JSON to ask a CLARIFICATION question. Be specific about the source of the conflict.
4. IF there are no conflicts OR the user has resolved them in conversation, output JSON containing a structured ITINERARY artifact.
5. You MUST cite your sources (e.g., [Source: 01_paris_venue_guide.md]) when generating the artifact.

Previous conversation history:
${JSON.stringify(conversation)}

Respond ONLY with valid JSON in one of the following two formats:

Format 1 (Clarification needed):
{
  "type": "clarification",
  "message": "We found a conflict regarding your budget for the venues in our database. [Source: venue.md] requires X, but your budget is Y. Would you like to increase the budget or look at other options?"
}

Format 2 (No conflicts, ready to plan):
{
  "type": "artifact",
  "data": {
    "title": "Structured Itinerary for Event",
    "recommendations": [
       { "venue": "Name", "justification": "Why it fits", "sourceCitation": "filename.md" }
    ],
    "notes": "Any other details"
  }
}
`;

        const response = await chat.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage("Proceed with the next step.")
        ]);

        let parsedOutput;
        try {
             // Sometimes the LLM wraps JSON in markdown block ticks
             const cleanedStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
             parsedOutput = JSON.parse(cleanedStr);
        } catch(e) {
             console.error("Failed to parse LLM output", response.content);
             parsedOutput = { type: 'error', message: 'Failed to generate structured JSON' };
        }
        
        // Save assistant's reply to context
        session.conversation.push({ role: 'assistant', content: JSON.stringify(parsedOutput) });

        return parsedOutput;
    }
}

module.exports = WorkflowAgent;