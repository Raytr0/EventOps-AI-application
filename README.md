# ItineraAI – EventOps AI Application

## Team Members
- Stepan Hartanovich
- Ryan Huang
- Jennifer Shi
- Tiffany Trinh

## Project Description
ItineraAI is an EventOps AI application designed to assist users in planning multi-city travel itineraries.

The system focuses on helping users coordinate complex travel logistics such as destinations, scheduling, transportation, and budget constraints. It leverages AI techniques like retrieval-augmented generation (RAG), multi-step workflows, and context tracking to generate structured travel plans.

## Deliverable 2 Foundation Prototype

This deliverable implements the **four core system requirements**:
1. **RAG Pipeline (Event Knowledge Base):** The `data/` directory contains 9 Markdown files acting as our knowledge base. We use LangChain's `MemoryVectorStore` with OpenAI Embeddings to retrieve documents dynamically.
2. **Multi-Step Workflow:** Powered by `@langchain/google-genai`, the agent reasons over constraints and explicitly asks clarification questions if conflicts are found between user input and venue policies.
3. **Event Context and State Tracking:** Handled in memory. The system records the initial form submission and stores the conversation history to allow multiple turns of clarifications before generating a final itinerary.
4. **Structured Artifact Output:** Outputs are dynamically generated structured JSON objects based on the retrieved context and resolved constraints.

## Setup Instructions for TA

### 1. Environment Variables
You will need an OpenAI API Key. In the `/backend` folder, create a `.env` file and add your key:
```
GOOGLE_API_KEY=sk-your-api-key-here
PORT=3001
```

### 2. Backend Setup
1. Open a terminal and navigate to the `backend` folder.
2. Run `npm install`
3. Run `npm run start` (or `npm run dev` for nodemon).
4. You should see "Knowledge Base Initialized with 9 documents" and "Backend server listening at http://localhost:3001"

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend` folder.
2. Run `npm install`
3. Run `npm start`
4. The application will launch in your browser at `http://localhost:3000`.

### 4. Running the Demo Walkthrough
1. Go to the frontend application at `http://localhost:3000`.
2. Fill out the "Event Constraints" form. 
   - **Scenario A (Conflict Example):** Enter Budget: 5000, Guests: 300, Theme: Beach. Submit the form. The system will detect a conflict and ask a clarification question. Reply in the UI to resolve it (e.g., "I will increase the budget to 30000").
   - **Scenario B (Direct Success):** Enter Budget: 30000, Guests: 50, Theme: Historic, Dietary: Dutch. Submit the form. The system will immediately generate a JSON artifact citing the `06_amsterdam_venue_guide.md`.
