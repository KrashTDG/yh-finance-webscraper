import { useState, useEffect } from 'react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  
  const [ticker, setTicker] = useState('');
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [topStocks, setTopStocks] = useState([]);

  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' or 'admin'
  const [incidents, setIncidents] = useState([]);

  // --- Article Reader State ---
  const [activeArticle, setActiveArticle] = useState(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState('');

  useEffect(() => {
    if (token) {
      fetch('http://127.0.0.1:5000/api/top-stocks', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => { if(Array.isArray(data)) setTopStocks(data); })
      .catch(err => console.error(err));
    }
  }, [token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isLoginView ? '/api/auth/login' : '/api/auth/register';

    try {
      const response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      if (isLoginView) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
      } else {
        alert("Registration successful! Please login.");
        setIsLoginView(true);
      }
    } catch (err) { setError(err.message); }
  };

  const fetchIncidents = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/admin/incidents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setIncidents(data);
    } catch (err) {
      console.error("Failed to load incidents:", err);
    }
  };

  const updateIncidentStatus = async (id, action) => {
    try {
      await fetch(`http://127.0.0.1:5000/api/admin/incidents/${id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchIncidents(); // Refresh the list instantly after clicking
    } catch (err) {
      console.error(`Failed to ${action} incident:`, err);
    }
  };

  // When we switch to the admin view, automatically fetch the incidents
  useEffect(() => {
    if (activeView === 'admin' && token) fetchIncidents();
  }, [activeView, token]);

  const handleLogout = () => {
    setToken('');
    setStock(null);
    setTopStocks([]);
    setActiveView('dashboard');
    localStorage.removeItem('token');
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) return;

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/stock/${cleanTicker}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server error');
      setStock(data);
    } catch (err) {
      setError(err.message);
      if (err.message.includes("Invalid or expired")) handleLogout();
    } finally { setLoading(false); }
  };

  // --- Fetch and Read Article ---
  const readArticle = async (article) => {
    // UPDATED: Now securely tracking the URL fallback string inside state
    setActiveArticle({ title: article.title, publisher: article.publisher, url: article.link, content: null });
    setArticleLoading(true);
    setArticleError('');

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/read-article`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ url: article.link })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch article');
      
      setActiveArticle(prev => ({ ...prev, content: data.paragraphs }));
    } catch (err) {
      setArticleError(err.message);
    } finally {
      setArticleLoading(false);
    }
  };

  const isPositive = stock?.change && !stock.change.startsWith('-');

  if (!token) {
    return (
      <div style={{ maxWidth: '400px', margin: '60px auto', fontFamily: 'system-ui', padding: '20px' }}>
        <h2>{isLoginView ? 'Login to Dashboard' : 'Register Account'}</h2>
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '10px' }} />
          <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '10px' }} />
          <button type="submit" style={{ padding: '12px', background: '#111', color: 'white' }}>{isLoginView ? 'Login' : 'Register'}</button>
        </form>
        {error && <p style={{ color: 'red' }}>⚠️ {error}</p>}
        <p style={{ cursor: 'pointer', color: 'blue', marginTop: '15px' }} onClick={() => setIsLoginView(!isLoginView)}>
          {isLoginView ? "Don't have an account? Register" : "Already have an account? Login"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui' }}>
      
      {/* Ticker Tape */}
      <style>
        {`
          @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          .ticker-wrap { width: 100%; overflow: hidden; background-color: #000; color: #fff; padding: 12px 0; border-bottom: 2px solid #333; }
          .ticker-track { display: flex; width: max-content; animation: scroll 25s linear infinite; }
          .ticker-track:hover { animation-play-state: paused; }
          .ticker-item { padding: 0 40px; font-size: 15px; display: flex; gap: 10px; align-items: center; }
        `}
      </style>

      {topStocks.length > 0 && (
        <div className="ticker-wrap">
          <div className="ticker-track">
            {[...topStocks, ...topStocks].map((s, index) => {
              const isPos = !s.change.startsWith('-');
              return (
                <div key={index} className="ticker-item">
                  <span style={{ fontWeight: 'bold', color: '#ccc' }}>{s.ticker}</span>
                  <span>${s.price}</span>
                  <span style={{ color: isPos ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>{isPos ? '+' : ''}{s.changePercent}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
        
        {/* Navigation Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>
            {activeView === 'dashboard' ? 'Market Data Dashboard' : '🚨 Ops Center'}
          </h2>
          <div>
            <button 
              onClick={() => setActiveView(activeView === 'dashboard' ? 'admin' : 'dashboard')} 
              style={{ padding: '6px 12px', cursor: 'pointer', marginRight: '10px', backgroundColor: activeView === 'admin' ? '#dc3545' : '#e0e0e0', color: activeView === 'admin' ? '#fff' : '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
            >
              {activeView === 'dashboard' ? 'Ops Center' : 'Back to Dash'}
            </button>
            <button onClick={handleLogout} style={{ padding: '6px 12px', cursor: 'pointer' }}>Logout</button>
          </div>
        </div>

        {/* --- VIEW ROUTER --- */}
        {activeView === 'dashboard' ? (
          <>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <input type="text" placeholder="Enter asset ticker..." value={ticker} onChange={(e) => setTicker(e.target.value)} style={{ flexGrow: 1, padding: '12px', fontSize: '16px' }} />
              <button type="submit" disabled={loading} style={{ padding: '12px 24px', background: '#111', color: '#fff', cursor: 'pointer' }}>{loading ? '...' : 'Query'}</button>
            </form>

            {error && <p style={{ color: 'red', marginTop: '20px' }}>⚠️ {error}</p>}

            {stock && (
              <div style={{ marginTop: '30px' }}>
                <div style={{ padding: '24px', border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h1 style={{ margin: 0, fontSize: '32px' }}>{stock.ticker}</h1>
                    <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: stock.source === 'cache' ? '#e6f4ea' : '#e8f0fe', color: stock.source === 'cache' ? '#137333' : '#1a73e8' }}>
                      {stock.source === 'cache' ? '⚡ Cache' : '🌐 Live'}
                    </span>
                  </div>
                  <div style={{ marginTop: '16px', fontSize: '32px', fontWeight: 'bold' }}>
                    ${stock.price} 
                    <span style={{ fontSize: '18px', color: isPositive ? 'green' : 'red', marginLeft: '10px' }}>
                      {isPositive ? '+' : ''}{stock.change} ({stock.changePercent})
                    </span>
                  </div>
                </div>

                {/* News List */}
                {stock.news && stock.news.length > 0 && (
                  <div style={{ marginTop: '30px' }}>
                    <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>Latest News for {stock.ticker}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {stock.news.map((article, index) => (
                        <div 
                          key={index} 
                          onClick={() => readArticle(article)}
                          style={{ 
                            padding: '16px', border: '1px solid #eaeaea', borderRadius: '6px', 
                            cursor: 'pointer', transition: 'background-color 0.2s', backgroundColor: '#fafafa'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                        >
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px', fontWeight: 'bold' }}>{article.publisher}</div>
                          <div style={{ fontSize: '16px', color: '#111', lineHeight: '1.4' }}>{article.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* --- PAGERDUTY ADMIN UI --- */}
            <div style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Active System Alerts</h3>
                <button onClick={fetchIncidents} style={{ padding: '6px 12px', cursor: 'pointer' }}>🔄 Refresh</button>
              </div>

              {incidents.length === 0 ? (
                <p style={{ color: 'green', fontWeight: 'bold' }}>✅ All systems operational. No incidents found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {incidents.map(inc => (
                    <div key={inc._id} style={{ 
                      padding: '16px', borderRadius: '8px', borderLeft: `6px solid ${inc.severity === 'critical' ? '#dc3545' : '#ffc107'}`,
                      backgroundColor: inc.status === 'resolved' ? '#f8f9fa' : '#fff', border: '1px solid #eee', opacity: inc.status === 'resolved' ? 0.6 : 1
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong>{inc.title}</strong>
                        <span style={{ 
                          fontSize: '12px', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold',
                          backgroundColor: inc.status === 'triggered' ? '#ffeeba' : inc.status === 'acknowledged' ? '#cce5ff' : '#d4edda',
                          color: inc.status === 'triggered' ? '#856404' : inc.status === 'acknowledged' ? '#004085' : '#155724'
                        }}>
                          {inc.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#666' }}>{inc.description}</p>
                      
                      <div style={{ fontSize: '12px', color: '#999', marginBottom: '15px' }}>
                        Service: {inc.source} | Logged: {new Date(inc.createdAt).toLocaleString()}
                      </div>

                      {/* Action Buttons */}
                      {inc.status !== 'resolved' && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          {inc.status === 'triggered' && (
                            <button 
                              onClick={() => updateIncidentStatus(inc._id, 'acknowledge')}
                              style={{ padding: '6px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              👀 Acknowledge
                            </button>
                          )}
                          <button 
                            onClick={() => updateIncidentStatus(inc._id, 'resolve')}
                            style={{ padding: '6px 12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            ✅ Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* --- ARTICLE READER MODAL --- */}
      {activeArticle && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box'
        }}>
          <div style={{ 
            backgroundColor: '#fff', width: '100%', maxWidth: '800px', height: '90vh', 
            borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            
            {/* Modal Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>{activeArticle.publisher}</div>
                <h2 style={{ margin: 0, fontSize: '20px', lineHeight: '1.3' }}>{activeArticle.title}</h2>
              </div>
              <button 
                onClick={() => setActiveArticle(null)}
                style={{ padding: '8px 16px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '30px', overflowY: 'auto', flexGrow: 1 }}>
              {articleLoading && <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px', color: '#666' }}>Scraping article content...</div>}
              
              {/* UPDATED: Fallback UI offering a direct connection button if web scraper is blocked */}
              {articleError && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <div style={{ color: '#dc3545', backgroundColor: '#f8d7da', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
                    ⚠️ {articleError}
                  </div>
                  <a 
                    href={activeArticle.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ display: 'inline-block', padding: '12px 24px', background: '#111', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}
                  >
                    Read Original Article in New Tab
                  </a>
                </div>
              )}
              
              {!articleLoading && !articleError && activeArticle.content && (
                <div style={{ fontSize: '18px', lineHeight: '1.8', color: '#333' }}>
                  {activeArticle.content.map((paragraph, i) => (
                    <p key={i} style={{ marginBottom: '20px' }}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}

export default App;