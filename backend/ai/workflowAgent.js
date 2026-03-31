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
            model: "gemini-2.0-flash", // We know this model actually resolved for your key!
            temperature: 0.2
        });

        const systemPrompt = `
You are ItineraAI, an advanced EventOps AI Assistant orchestrating a multi-step, multi-city travel planning workflow.

CURRENT EVENT CONTEXT (STATE MEMORY):
${JSON.stringify(state, null, 2)}

RETRIEVED KNOWLEDGE BASE DOCUMENTS (Ground your answers in these to prevent hallucinations):
---
${contextStr}
---

YOUR TASK (AGENTIC LOGIC):
1. Analyze the user's current Event Context against the Retrieved Knowledge Base documents.
2. Run programmatic validation: Are there any temporal, geographical, or budgetary CONFLICTS? (e.g., trying to schedule 4 cities in 3 days, budget is too low for the requested cities, or a transit route doesn't exist).
3. IF there are unresolved conflicts, you must output a "Conflict Detection Report" (Format 1).
4. IF there are no conflicts, you must output a "Multi-City Travel Itinerary" and Secondary Artifacts (Format 2).

PREVIOUS CONVERSATION:
${JSON.stringify(conversation)}

You MUST respond ONLY with valid JSON matching one of the exact schemas below.

--- FORMAT 1: CONFLICT DETECTION REPORT ---
Use this format if constraints are logically impossible or missing critical data.
{
  "type": "conflict_report",
  "data": {
    "identified_conflict": "Describe the temporal, geographical, or budget conflict.",
    "violated_constraint": "e.g., Budget exceeded by $300, or Transit time exceeds daylight.",
    "proposed_resolutions": [
      "Option A: ...",
      "Option B: ..."
    ]
  }
}

--- FORMAT 2: STRUCTURED TRAVEL ITINERARY ARTIFACT ---
Use this format if the plan is feasible. You MUST cite your sources (e.g., 01_paris_venue_guide.md) in the 'sourceCitation' fields.
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
            "description": "CDG Airport Express",
            "duration_mins": 60,
            "source_tool": "Knowledge Base",
            "warnings": ["Ensure luggage meets specs."],
            "sourceCitation": "filename.md"
          },
          {
            "type": "activity",
            "description": "Louvre Museum",
            "duration_mins": 180,
            "source_tool": "Knowledge Base",
            "warnings": [],
            "sourceCitation": "filename.md"
          }
        ]
      }
    ],
    "budget_planning_sheet": {
      "transit": 200,
      "lodging": 1000,
      "food": 650
    },
    "planning_checklist": [
      "Book train tickets 30 days prior",
      "Verify Schengen visa limits"
    ],
    "packing_list": [
      "Item 1 (based on seasonal/climatic context)"
    ]
  }
}
`;

        // To avoid BaseMessage prototype compatibility issues between different Langchain package versions,
        // we use raw message tuples instead of instantiating SystemMessage / HumanMessage classes.
        const messages = [
            ["system", systemPrompt]
        ];
        
        if (conversation && conversation.length > 0) {
            for (const msg of conversation) {
                messages.push([msg.role === 'user' ? 'human' : 'ai', msg.content]);
            }
        } else {
            messages.push(["human", "Evaluate the current state memory against the Knowledge Base and proceed with the next planning step."]);
        }

        let response;
        try {
            response = await chat.invoke(messages);
        } catch(error) {
            console.error("LLM Generation Error:", error);
            throw new Error("Failed to generate agent response.");
        }

        let parsedOutput;
        try {
             const cleanedStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
             parsedOutput = JSON.parse(cleanedStr);
        } catch(e) {
             console.error("Failed to parse LLM output", response.content);
             parsedOutput = { type: 'error', message: 'Failed to generate structured JSON' };
        }
        
        session.conversation.push({ role: 'assistant', content: JSON.stringify(parsedOutput) });

        return parsedOutput;
    }
}

module.exports = WorkflowAgent;