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

       
        {response && (
          <div className="response-box" style={{ width: '200%', maxWidth: '1400px', margin: '0 auto' }}>
            <h3>Workflow Output</h3>
            
         
            {response.type === 'conflict_report' && (
              <div className="clarification-container">
                 <div className="warning" style={{ backgroundColor: '#ffcccc', color: '#900', padding: '15px', borderRadius: '5px', marginBottom: '15px', textAlign: 'left'}}>
                     <p><strong>⚠️ Conflict Detected:</strong> {response.data.identified_conflict}</p>
                     <p><strong>Violated Constraint:</strong> {response.data.violated_constraint}</p>
                     
                     {/* Map out the AI's proposed resolutions nicely */}
                     {response.data.proposed_resolutions && response.data.proposed_resolutions.length > 0 && (
                         <ul>
                             {response.data.proposed_resolutions.map((res, index) => (
                                 <li key={index}>{res}</li>
                             ))}
                         </ul>
                     )}
                 </div>

               
                 <form onSubmit={handleReplySubmit} className="reply-form">
                    <input 
                       type="text" 
                       placeholder="Type your reply to resolve the conflict (e.g., 'Increase budget to $20000')..."
                       value={userReply}
                       onChange={(e) => setUserReply(e.target.value)}
                       required
                       style={{ width: '80%', padding: '10px', marginRight: '10px' }}
                    />
                    <button type="submit" disabled={loading} style={{ padding: '10px' }}>
                        {loading ? 'Thinking...' : 'Submit Resolution'}
                    </button>
                 </form>
              </div>
            )}

            
            
            {response.type === 'artifact' && (
               <div className="artifact-container" style={{ textAlign: 'left', backgroundColor: '#ffffff', borderRadius: '8px', padding: '25px', color: '#333', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginTop: '20px' }}>
                 
                 {/* Header & Budget Summary */}
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #3498db', paddingBottom: '15px', marginBottom: '20px' }}>
                    <h2 style={{ color: '#2c3e50', margin: 0 }}>✅ Your Event Itinerary</h2>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.9em', color: '#7f8c8d' }}>Trip ID: {response.data.trip_id}</span>
                        <strong style={{ fontSize: '1.2em', color: '#27ae60' }}>
                            Budget Utilized: ${response.data.total_budget_utilized.toLocaleString()}
                        </strong>
                    </div>
                 </div>

                 {/* Daily Schedule Loop */}
                 <h3 style={{ color: '#34495e' }}>📅 Daily Schedule</h3>
                 {response.data.itinerary.map((day, index) => (
                    <div key={index} style={{ marginBottom: '20px', padding: '15px', borderLeft: '4px solid #3498db', backgroundColor: '#f8f9fa', borderRadius: '0 5px 5px 0' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#2980b9' }}>
                          Day {day.day} - {day.date} 📍 {day.city}
                      </h4>
                      
                      <ul style={{ listStyleType: 'none', paddingLeft: 0, margin: 0 }}>
                        {day.activities.map((activity, actIdx) => (
                          <li key={actIdx} style={{ marginBottom: '10px', padding: '12px', backgroundColor: activity.type === 'transit' ? '#e8ecef' : '#ffffff', borderRadius: '4px', border: '1px solid #dee2e6' }}>
                            <div style={{ marginBottom: '5px' }}>
                                <strong style={{ color: activity.type === 'transit' ? '#e67e22' : '#8e44ad', textTransform: 'uppercase', fontSize: '0.85em', marginRight: '8px' }}>
                                    [{activity.type}]
                                </strong> 
                                {activity.description}
                            </div>
                            
                            <div style={{ fontSize: '0.85em', color: '#7f8c8d' }}>
                                ⏱️ {activity.duration_mins} mins | 🔗 Source: {activity.sourceCitation || 'AI Generated'}
                            </div>

                            {/* Conditionally render warnings if they exist */}
                            {activity.warnings && activity.warnings.length > 0 && (
                              <div style={{ color: '#c0392b', marginTop: '8px', fontSize: '0.9em', backgroundColor: '#fadbd8', padding: '8px', borderRadius: '4px' }}>
                                ⚠️ <strong>Important:</strong> {activity.warnings.join(' ')}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                 ))}

                 {/* Checklists Section */}
                 <div style={{ display: 'flex', gap: '20px', marginTop: '30px', flexWrap: 'wrap' }}>
                    
                    <div style={{ flex: '1 1 300px', backgroundColor: '#fdfefe', padding: '15px', borderRadius: '5px', border: '1px solid #ebedef' }}>
                      <h4 style={{ color: '#16a085', marginTop: 0 }}>📋 Planning Checklist</h4>
                      <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.95em' }}>
                        {response.data.planning_checklist.map((item, idx) => (
                            <li key={idx} style={{ marginBottom: '5px' }}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ flex: '1 1 300px', backgroundColor: '#fdfefe', padding: '15px', borderRadius: '5px', border: '1px solid #ebedef' }}>
                      <h4 style={{ color: '#d35400', marginTop: 0 }}>🧳 Packing List</h4>
                      <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '0.95em' }}>
                        {response.data.packing_list.map((item, idx) => (
                            <li key={idx} style={{ marginBottom: '5px' }}>{item}</li>
                        ))}
                      </ul>
                    </div>

                 </div>
                 
               </div>
            )}

            {response.type === 'error' && (
               <div className="error-container" style={{ color: 'red' }}>
                 <p><strong>❌ Error:</strong> {response.message}</p>
               </div>
            )}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;