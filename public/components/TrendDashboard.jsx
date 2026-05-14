/**
 * SKCS AI Sports Edge - React AI Trend Dashboard Component
 * Consumes local backend endpoints, isolates RapidAPI from client
 */

import React, { useState, useEffect, useMemo } from 'react';

const TrendDashboard = ({ maxTrends = 10, refreshInterval = 300000 }) => {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isCached, setIsCached] = useState(false);
  const [filter, setFilter] = useState('all'); // all, top, high-confidence

  // Fetch AI trends from our local backend
  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/trends');
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to load betting trends');
        }
        
        setTrends(result.data?.trends || []);
        setLastUpdated(result.data?.lastUpdated);
        setIsCached(result.cached);
        
        console.log(`[TrendDashboard] Loaded ${result.data?.trends?.length || 0} trends (cached: ${result.cached})`);
        
      } catch (error) {
        console.error("Failed to load betting trends:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTrends();
    
    // Refresh periodically
    const refreshTimer = setInterval(fetchTrends, refreshInterval);
    return () => clearInterval(refreshTimer);
    
  }, [refreshInterval]);

  // Filter trends based on selected filter
  const filteredTrends = useMemo(() => {
    let filtered = trends.slice(0, maxTrends);
    
    switch (filter) {
      case 'top':
        filtered = filtered.filter(trend => trend.isTop);
        break;
      case 'high-confidence':
        filtered = filtered.filter(trend => trend.confidence > 0.85);
        break;
      default:
        // Show all
        break;
    }
    
    return filtered;
  }, [trends, maxTrends, filter]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const formatPercentage = (value) => {
    return typeof value === 'number' ? `${value.toFixed(1)}%` : `${value}%`;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.85) return '#10b981'; // green
    if (confidence >= 0.70) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const getHitRateColor = (hitRate) => {
    if (hitRate >= 75) return '#10b981'; // green
    if (hitRate >= 60) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  if (loading) {
    return (
      <div className="trend-dashboard">
        <div className="trends-header">
          <h2>🔥 SKCS AI Betting Edge</h2>
          <div className="trends-skeleton">
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
          </div>
        </div>
        <div className="trend-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="trend-card skeleton">
              <div className="skeleton-header">
                <div className="skeleton-line"></div>
                <div className="skeleton-line short"></div>
              </div>
              <div className="skeleton-content">
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line short"></div>
              </div>
            </div>
          ))}
        </div>
        <p className="loading-text">Analyzing AI Edge...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trend-dashboard">
        <div className="trends-header">
          <h2>🔥 SKCS AI Betting Edge</h2>
        </div>
        <div className="trend-error">
          <p>Unable to load betting trends: {error}</p>
          <button onClick={handleRefresh} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (filteredTrends.length === 0) {
    return (
      <div className="trend-dashboard">
        <div className="trends-header">
          <h2>🔥 SKCS AI Betting Edge</h2>
        </div>
        <div className="trend-empty">
          <p>No betting trends available at the moment.</p>
          {lastUpdated && (
            <p className="last-updated">Last updated: {new Date(lastUpdated).toLocaleString()}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="trend-dashboard">
      <div className="trends-header">
        <h2>🔥 SKCS AI Betting Edge</h2>
        <div className="trends-controls">
          <div className="filter-buttons">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({trends.length})
            </button>
            <button 
              className={`filter-btn ${filter === 'top' ? 'active' : ''}`}
              onClick={() => setFilter('top')}
            >
              Top Picks
            </button>
            <button 
              className={`filter-btn ${filter === 'high-confidence' ? 'active' : ''}`}
              onClick={() => setFilter('high-confidence')}
            >
              High Confidence
            </button>
          </div>
          <div className="trend-info">
            {isCached && <span className="cached-badge">📊 Cached</span>}
            {lastUpdated && (
              <span className="last-updated">
                Updated: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="trend-grid">
        {filteredTrends.map((trend, index) => (
          <div key={trend.id || index} className="trend-card">
            <div className="trend-header">
              <span 
                className="hit-rate"
                style={{ color: getHitRateColor(trend.hitRate) }}
              >
                {formatPercentage(trend.hitRate)} Hit Rate
              </span>
              {trend.steaming && (
                <span className="steaming-alert">🚨 Line Moving!</span>
              )}
              {trend.isTop && (
                <span className="top-pick-badge">⭐ TOP PICK</span>
              )}
            </div>
            
            <p className="trend-description">{trend.description}</p>
            
            {(trend.oldRate || trend.rate) && (
              <div className="odds-movement">
                {trend.oldRate && (
                  <span className="old-rate">Old: {trend.oldRate}</span>
                )}
                {trend.rate && (
                  <span className="current-rate">
                    Now: <strong>{trend.rate}</strong>
                  </span>
                )}
              </div>
            )}
            
            <div className="sentiment-bar">
              <div className="sentiment-item">
                <span className="label">AI:</span>
                <div className="sentiment-bar-fill">
                  <div 
                    className="sentiment-fill ai"
                    style={{ 
                      width: `${Math.min(trend.aiProbability || 0, 100)}%`,
                      backgroundColor: getConfidenceColor(trend.aiProbability / 100)
                    }}
                  ></div>
                </div>
                <span className="value">{formatPercentage(trend.aiProbability)}</span>
              </div>
              
              <div className="sentiment-item">
                <span className="label">Public:</span>
                <div className="sentiment-bar-fill">
                  <div 
                    className="sentiment-fill public"
                    style={{ width: `${Math.min(trend.publicVote || 0, 100)}%` }}
                  ></div>
                </div>
                <span className="value">{formatPercentage(trend.publicVote)}</span>
              </div>
            </div>

            {trend.confidence && (
              <div className="confidence-meter">
                <span className="confidence-label">Confidence:</span>
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill"
                    style={{ 
                      width: `${trend.confidence * 100}%`,
                      backgroundColor: getConfidenceColor(trend.confidence)
                    }}
                  ></div>
                </div>
                <span className="confidence-value">
                  {formatPercentage(trend.confidence * 100)}
                </span>
              </div>
            )}

            <div className="trend-footer">
              <span className="sport-tag">{trend.sport || 'football'}</span>
              {trend.id && (
                <button 
                  className="details-btn"
                  onClick={() => console.log('View trend details:', trend)}
                >
                  Details →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {trends.length > maxTrends && (
        <div className="trend-footer-info">
          <p>Showing {filteredTrends.length} of {trends.length} trends</p>
        </div>
      )}
    </div>
  );
};

export default TrendDashboard;
