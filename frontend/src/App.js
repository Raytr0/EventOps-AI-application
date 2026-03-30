import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    budget: '',
    guests: '',
    dietary: '',
    theme: ''
  });

  const [sessionId, setSessionId] = useState('session_' + Math.random().toString(36).substr(2, 9));
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userReply, setUserReply] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await axios.post('http://localhost:3001/api/plan', { 
         sessionId,
         formData 
      });
      setResponse(result.data.data);
    } catch (error) {
      console.error('Submission failed', error);
      setResponse({ type: 'error', message: 'Failed to connect to backend. Did you run npm start?' });
    }
    setLoading(false);
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await axios.post('http://localhost:3001/api/plan', { 
         sessionId,
         userReply // Sending ONLY the reply to simulate multi-turn memory
      });
      setResponse(result.data.data);
      setUserReply('');
    } catch (error) {
      console.error('Reply failed', error);
      setResponse({ type: 'error', message: 'Failed to connect to backend.' });
    }
    setLoading(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>ItineraAI - EventOps Planner</h1>
        
        {/* Form Submission (Step 1) */}
        <div className="form-container">
          <h3>Step 1: Event Constraints</h3>
          <form onSubmit={handleSubmit}>
            <input 
              type="number" 
              placeholder="Total Budget (€ or $)" 
              value={formData.budget} 
              onChange={(e) => setFormData({...formData, budget: e.target.value})} 
            />
            <input 
              type="number" 
              placeholder="Guest Count" 
              value={formData.guests} 
              onChange={(e) => setFormData({...formData, guests: e.target.value})} 
            />
            <input 
              type="text" 
              placeholder="Dietary Needs (e.g., Vegan, Nut-free)" 
              value={formData.dietary} 
              onChange={(e) => setFormData({...formData, dietary: e.target.value})} 
            />
             <input 
              type="text" 
              placeholder="Theme/Vibe (e.g., Historic, Industrial)" 
              value={formData.theme} 
              onChange={(e) => setFormData({...formData, theme: e.target.value})} 
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Analyzing...' : 'Submit Event Details'}
            </button>
          </form>
        </div>

        {/* Workflow Response (Step 2 - 5) */}
        {response && (
          <div className="response-box">
            <h3>Workflow Output</h3>
            
            {response.type === 'clarification' && (
              <div className="clarification-container">
                 <p className="warning"><strong>Conflict Detected:</strong> {response.message}</p>
                 <form onSubmit={handleReplySubmit} className="reply-form">
                    <input 
                       type="text" 
                       placeholder="Type your reply here to resolve the conflict..."
                       value={userReply}
                       onChange={(e) => setUserReply(e.target.value)}
                       required
                    />
                    <button type="submit" disabled={loading}>
                        {loading ? 'Thinking...' : 'Reply'}
                    </button>
                 </form>
              </div>
            )}

            {response.type === 'artifact' && (
               <div className="artifact-container">
                 <p className="success"><strong>Success! Itinerary Generated</strong></p>
                 <pre>{JSON.stringify(response.data, null, 2)}</pre>
               </div>
            )}

            {response.type === 'error' && (
               <div className="error-container">
                 <p>{response.message}</p>
               </div>
            )}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;