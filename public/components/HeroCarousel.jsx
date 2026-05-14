/**
 * SKCS AI Sports Edge - React Hero Carousel Component
 * Consumes local backend endpoints, isolates RapidAPI from client
 */

import React, { useState, useEffect, useRef } from 'react';

const HeroCarousel = ({ autoPlay = true, interval = 5000, maxSlides = 5 }) => {
  const [featuredGames, setFeaturedGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  // Fetch featured games from our local backend
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/featured-games');
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to load featured games');
        }
        
        // Use suggestedGames array from the response
        const games = result.data?.suggestedGames || [];
        setFeaturedGames(games.slice(0, maxSlides));
        
        console.log(`[HeroCarousel] Loaded ${games.length} featured games (cached: ${result.cached})`);
        
      } catch (error) {
        console.error("Failed to load hero carousel:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFeatured();
    
    // Refresh every 5 minutes to keep data fresh
    const refreshInterval = setInterval(fetchFeatured, 300000);
    return () => clearInterval(refreshInterval);
    
  }, [maxSlides]);

  // Auto-play functionality
  useEffect(() => {
    if (autoPlay && !isPaused && featuredGames.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % featuredGames.length);
      }, interval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoPlay, isPaused, interval, featuredGames.length]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + featuredGames.length) % featuredGames.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % featuredGames.length);
  };

  const handleDotClick = (index) => {
    setCurrentIndex(index);
  };

  const handleGameClick = (game) => {
    // Emit custom event or navigate to game details
    window.dispatchEvent(new CustomEvent('gameSelected', { 
      detail: { game } 
    }));
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'TBD';
    
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'TBD';
    }
  };

  if (loading) {
    return (
      <div className="hero-carousel-container">
        <div className="carousel-skeleton">
          <div className="skeleton-header">
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
          </div>
          <div className="skeleton-content">
            <div className="skeleton-game"></div>
            <div className="skeleton-game"></div>
            <div className="skeleton-game"></div>
          </div>
        </div>
        <p className="loading-text">Loading Featured Matchups...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hero-carousel-container">
        <div className="carousel-error">
          <p>Unable to load featured games: {error}</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (featuredGames.length === 0) {
    return (
      <div className="hero-carousel-container">
        <div className="carousel-empty">
          <p>No featured games available at the moment.</p>
        </div>
      </div>
    );
  }

  const currentGame = featuredGames[currentIndex];

  return (
    <div 
      className="hero-carousel-container"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="hero-carousel">
        <div className="carousel-header">
          <h2>Top Featured Matches</h2>
          <div className="carousel-controls">
            <button 
              onClick={handlePrevious}
              className="control-btn prev"
              aria-label="Previous game"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button 
              onClick={handleNext}
              className="control-btn next"
              aria-label="Next game"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="carousel-track">
          <div 
            className="carousel-slide active"
            style={{ 
              borderTop: `4px solid ${currentGame.tournamentColor || '#121417'}` 
            }}
          >
            <div className="game-content">
              {currentGame.isLive && (
                <div className="live-indicator">
                  <span className="live-dot"></span>
                  LIVE
                </div>
              )}
              
              {currentGame.importance > 3 && (
                <div className="featured-badge">
                  ⭐ FEATURED
                </div>
              )}

              <div className="matchup">
                <div className="team home">
                  <span className="team-name">{currentGame.homeTeamName}</span>
                  {currentGame.homeScore !== undefined && (
                    <span className="score">{currentGame.homeScore}</span>
                  )}
                </div>
                
                <div className="vs-separator">VS</div>
                
                <div className="team away">
                  <span className="team-name">{currentGame.awayTeamName}</span>
                  {currentGame.awayScore !== undefined && (
                    <span className="score">{currentGame.awayScore}</span>
                  )}
                </div>
              </div>

              <div className="game-meta">
                <div className="tournament">{currentGame.tournamentName}</div>
                <div className="time">{formatTime(currentGame.startTime)}</div>
                {currentGame.status && currentGame.status !== 'SCHEDULED' && (
                  <div className="status">{currentGame.status}</div>
                )}
              </div>

              <button 
                className="view-details-btn"
                onClick={() => handleGameClick(currentGame)}
              >
                View Analysis →
              </button>
            </div>
          </div>
        </div>

        {featuredGames.length > 1 && (
          <div className="carousel-indicators">
            {featuredGames.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`indicator ${index === currentIndex ? 'active' : ''}`}
                aria-label={`Go to game ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HeroCarousel;
