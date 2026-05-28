// src/App.jsx
import { useState } from 'react';

function App() {
  const [ticker, setTicker] = useState('');
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) return;

    setLoading(true);
    setError('');
    
    try {
      // Connects directly to your Express API
      const response = await fetch(`http://localhost:5000/api/stock/${cleanTicker}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error occurred.');
      }
      
      const data = await response.json();
      setStock(data);
    } catch (err) {
      setError(err.message);
      setStock(null);
    } finally {
      setLoading(false);
    }
  };

  // Determine market direction formatting
  const isPositive = stock?.change && !stock.change.startsWith('-');

  return (
    <div style={{ maxWidth: '500px', margin: '60px auto', fontFamily: 'system-ui, sans-serif', padding: '0 20px' }}>
      <h2 style={{ letterSpacing: '-0.5px' }}>Market Data Dashboard</h2>
      <p style={{ color: '#666', fontSize: '14px' }}>Real-time parsing with automated MongoDB caching tiers.</p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        <input
          type="text"
          placeholder="Enter asset ticker (e.g., NVDA, MSFT)"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          style={{
            flexGrow: 1,
            padding: '12px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '6px'
          }}
        />
        <button 
          type="submit" 
          disabled={loading}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Fetching...' : 'Query'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#fff0f0', color: '#cc0000', borderRadius: '6px', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {stock && (
        <div style={{ marginTop: '30px', padding: '24px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '32px' }}>{stock.ticker}</h1>
            <span style={{
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '4px 10px',
              borderRadius: '12px',
              backgroundColor: stock.source === 'cache' ? '#e6f4ea' : '#e8f0fe',
              color: stock.source === 'cache' ? '#137333' : '#1a73e8'
            }}>
              {stock.source === 'cache' ? '⚡ MongoDB Cache' : '🌐 Live Scrape'}
            </span>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span style={{ fontSize: '42px', fontWeight: 'bold', tracking: '-1px' }}>${stock.price}</span>
            <span style={{ 
              fontSize: '18px', 
              fontWeight: '600',
              color: isPositive ? '#137333' : '#c5221f' 
            }}>
              {isPositive ? '+' : ''}{stock.change} ({stock.changePercent})
            </span>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #f0f0f0', color: '#888', fontSize: '11px' }}>
            Data timestamp: {new Date(stock.updatedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;