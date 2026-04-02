const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

/**
 * ItineraAI: Multi-Step Workflow Agent
 * Satisfies Design Specification:
 * - 4. Multi-Step Workflow Design (Agentic Logic)
 * - 5. Event Context and Memory Design
 * - 6. Structured Output Artifact Design
 */
class WorkflowAgent {
    constructor(ragPipeline) {
        this.rag = ragPipeline;
        // Centralized state management store (Event Context Memory)
        this.sessions = {}; 
    }

    updateContext(sessionId, newData) {
        if (!this.sessions[sessionId]) {
            this.sessions[sessionId] = { 
                turnCount: 0, 
                state: {
                    budget: { limit: null, allocated: 0 },
                    guests: { count: null, demographics: null },
                    requirements: { dietary: null, accessibility: null },
                    routing: { destinations: [], dates: null, confirmedHotels: [] },
                    transportation: []
                }, 
                conversation: [] 
            };
        }
        
        const session = this.sessions[sessionId];

        if (newData.formData) {
           const fd = newData.formData;
           if (fd.budget) session.state.budget.limit = fd.budget;
           if (fd.guests) session.state.guests.count = fd.guests;
           if (fd.demographics) session.state.guests.demographics = fd.demographics;
           if (fd.dietary) session.state.requirements.dietary = fd.dietary;
           if (fd.accessibility) session.state.requirements.accessibility = fd.accessibility;
           
           if (fd.destinations && Array.isArray(fd.destinations) && fd.destinations.length > 0) {
               session.state.routing.destinations = fd.destinations;
           } else if (fd.destinations && typeof fd.destinations === 'string') {
               session.state.routing.destinations = [fd.destinations];
           } else if (fd.theme && session.state.routing.destinations.length === 0) {
               session.state.routing.destinations = [fd.theme];
           }

           if (fd.dates) session.state.routing.dates = fd.dates;
        }
        
        if (newData.userReply) {
           session.conversation.push({ role: 'user', content: newData.userReply });
        }
        
        session.turnCount++;
        console.log(`Updated ItineraAI Session State [${sessionId}]:`, JSON.stringify(session.state, null, 2));
    }

    async generateNextAction(sessionId) {
        const session = this.sessions[sessionId];
        if (!session) throw new Error("Session not found");

        const { state, conversation } = session;

        const destStr = state.routing.destinations.join(', ') || 'unspecified regions';
        const query = `Travel planning for ${destStr}. Budget: ${state.budget.limit || 'any'}. Guests: ${state.guests.count || 'any'}. Dietary: ${state.requirements.dietary || 'none'}, Accessibility: ${state.requirements.accessibility || 'none'}. Find venues, transit rules, and seasonal advisories.`;
        
        const docs = await this.rag.retrieve(query);
        const contextStr = docs.map(d => `[Source: ${d.source}]\n${d.content}`).join("\n\n");

        const chat = new ChatGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_API_KEY,
            model: "gemini-2.5-flash",
            temperature: 0.2
        });

        const validationPrompt = `
            You are ItineraAI's Validation Agent. 

            CURRENT EVENT CONTEXT (STATE MEMORY):
            ${JSON.stringify(state, null, 2)}

            RETRIEVED KNOWLEDGE BASE DOCUMENTS:
            ---
            ${contextStr}
            ---

            TASK:
            Analyze the Context against the Documents. Are there any temporal, geographical, or budgetary CONFLICTS? 
            Respond ONLY with valid JSON in this exact format:
            {
              "hasConflict": true,
              "report": {
                "identified_conflict": "string or null",
                "violated_constraint": "string or null",
                "proposed_resolutions": ["option A", "option B"]
              }
            }
        `;

        try {
            console.log(`[Session ${sessionId}] Phase 1: Running Conflict Validation...`);
            const validationResponse = await chat.invoke([
                ["system", validationPrompt], 
                ...conversation.map(msg => [msg.role === 'user' ? 'human' : 'ai', msg.content]),
                ["human", "Check the current state memory AND our recent conversation against the Knowledge Base for conflicts. Did I resolve the previous issue?"]
            ]);
            
            const cleanedValidationStr = validationResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const validationResult = JSON.parse(cleanedValidationStr);

            if (validationResult.hasConflict === true) {
                console.log(`[Session ${sessionId}] ⚠️ Conflict detected! Halting workflow.`);
                
                const conflictOutput = {
                    type: "conflict_report",
                    data: validationResult.report
                };
                
                session.conversation.push({ role: 'assistant', content: JSON.stringify(conflictOutput) });
                return conflictOutput; 
            }

            console.log(`[Session ${sessionId}] ✅ No conflicts detected. Proceeding to Phase 2: Generation...`);

        } catch (error) {
            console.error("Phase 1 Validation Error:", error);
            throw new Error("Failed during the validation step.");
        }

        const generationPrompt = `
          You are ItineraAI's Planning Agent. The user's constraints have been validated and no conflicts exist.

          CURRENT EVENT CONTEXT (STATE MEMORY):
          ${JSON.stringify(state, null, 2)}

          RETRIEVED KNOWLEDGE BASE DOCUMENTS:
          ---
          ${contextStr}
          ---

          TASK:
          Generate a Structured Travel Itinerary based on the context and documents. 
          You MUST cite your sources (e.g., 01_paris_venue_guide.md) in the 'sourceCitation' fields.

          Respond ONLY with valid JSON matching this exact format:
          {
            "type": "artifact",
            "data": {
              "trip_id": "mc_trip_001",
              "total_budget_utilized": 1850,
              "itinerary": [
                {
                  "day": 1,
                  "date": "YYYY-MM-DD",
                  "city": "City Name",
                  "activities": [
                    {
                      "type": "transit", 
                      "description": "String",
                      "duration_mins": 60,
                      "source_tool": "Knowledge Base",
                      "warnings": ["String"],
                      "sourceCitation": "filename.md"
                    }
                  ]
                }
              ],
              "budget_planning_sheet": { "transit": 0, "lodging": 0, "food": 0 },
              "planning_checklist": ["String"],
              "packing_list": ["String"]
            }
          }
        `;

        try {
            const generationResponse = await chat.invoke([
                ["system", generationPrompt], 
                ...conversation.map(msg => [msg.role === 'user' ? 'human' : 'ai', msg.content]),
                ["human", "Generate the finalized structured travel itinerary JSON."]
            ]);
            
            const cleanedGenStr = generationResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const finalItinerary = JSON.parse(cleanedGenStr);

            session.conversation.push({ role: 'assistant', content: JSON.stringify(finalItinerary) });
            return finalItinerary;

        } catch (error) {
            console.error("Phase 2 Generation Error:", error);
            throw new Error("Failed during the generation step.");
        }
    }
}

module.exports = WorkflowAgent;