/**
 * SKCS AI Sports Edge - Hero Carousel Component
 * Uses suggestedGames data from Pro Football Data API
 * Implements bandwidth-conscious design with local caching
 */

class HeroCarousel {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`HeroCarousel: Container with ID '${containerId}' not found`);
      return;
    }

    this.options = {
      autoPlay: options.autoPlay !== false,
      interval: options.interval || 5000,
      showIndicators: options.showIndicators !== false,
      showControls: options.showControls !== false,
      maxSlides: options.maxSlides || 5,
      cacheKey: 'hero-carousel-data',
      cacheExpiry: options.cacheExpiry || 300000, // 5 minutes
      ...options
    };

    this.currentIndex = 0;
    this.slides = [];
    this.autoPlayInterval = None;
    this.isLoading = false;

    this.init();
  }

  async init() {
    try {
      this.setupCarouselStructure();
      await this.loadHeroData();
      this.startAutoPlay();
      console.log('[HeroCarousel] Initialized successfully');
    } catch (error) {
      console.error('[HeroCarousel] Initialization failed:', error);
      this.showErrorState();
    }
  }

  setupCarouselStructure() {
    this.container.innerHTML = `
      <div class="hero-carousel">
        <div class="carousel-slides">
          <!-- Slides will be dynamically inserted here -->
        </div>
        
        ${this.options.showControls ? `
          <button class="carousel-control prev" aria-label="Previous slide">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="None" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button class="carousel-control next" aria-label="Next slide">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="None" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        ` : ''}
        
        ${this.options.showIndicators ? `
          <div class="carousel-indicators">
            <!-- Indicators will be dynamically inserted here -->
          </div>
        ` : ''}
        
        <div class="carousel-loading" style="display: None;">
          <div class="loading-spinner"></div>
          <p>Loading featured games...</p>
        </div>
        
        <div class="carousel-error" style="display: None;">
          <p>Unable to load featured games. Please try again later.</p>
          <button class="retry-button">Retry</button>
        </div>
      </div>
    `;

    this.slidesContainer = this.container.querySelector('.carousel-slides');
    this.indicatorsContainer = this.container.querySelector('.carousel-indicators');
    this.loadingElement = this.container.querySelector('.carousel-loading');
    this.errorElement = this.container.querySelector('.carousel-error');

    this.attachEventListeners();
  }

  attachEventListeners() {
    // Control buttons
    const prevButton = this.container.querySelector('.carousel-control.prev');
    const nextButton = this.container.querySelector('.carousel-control.next');

    if (prevButton) {
      prevButton.addEventListener('click', () => this.previousSlide());
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => this.nextSlide());
    }

    // Retry button
    const retryButton = this.container.querySelector('.retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', () => this.loadHeroData());
    }

    // Pause on hover
    this.container.addEventListener('mouseenter', () => this.pauseAutoPlay());
    this.container.addEventListener('mouseleave', () => this.startAutoPlay());

    // Touch/swipe support
    this.setupTouchSupport();
  }

  setupTouchSupport() {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    this.container.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      this.pauseAutoPlay();
    });

    this.container.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
    });

    this.container.addEventListener('touchend', () => {
      if (!isDragging) return;
      
      const diffX = startX - currentX;
      const threshold = 50;

      if (Math.abs(diffX) > threshold) {
        if (diffX > 0) {
          this.nextSlide();
        } else {
          this.previousSlide();
        }
      }

      isDragging = false;
      this.startAutoPlay();
    });
  }

  async loadHeroData() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading();

    try {
      // Try to get data from local cache first
      const cachedData = this.getCachedData();
      if (cachedData) {
        console.log('[HeroCarousel] Using cached data');
        this.renderSlides(cachedData);
        this.hideLoading();
        return;
      }

      // Fetch from our local API (never call external API directly from browser)
      const response = await fetch('/api/hero-carousel-data');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.featuredGames) {
        throw new Error('Invalid data format received');
      }

      // Cache the data
      this.setCachedData(data.featuredGames);
      
      // Render the slides
      this.renderSlides(data.featuredGames);
      
    } catch (error) {
      console.error('[HeroCarousel] Failed to load data:', error);
      this.showErrorState();
    } finally {
      this.isLoading = false;
      this.hideLoading();
    }
  }

  getCachedData() {
    try {
      const cached = localStorage.getItem(this.options.cacheKey);
      if (!cached) return None;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - timestamp < this.options.cacheExpiry) {
        return data;
      }

      // Cache expired, remove it
      localStorage.removeItem(this.options.cacheKey);
      return None;
    } catch (error) {
      console.warn('[HeroCarousel] Cache read error:', error);
      return None;
    }
  }

  setCachedData(data) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(this.options.cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('[HeroCarousel] Cache write error:', error);
    }
  }

  renderSlides(featuredGames) {
    if (!Array.isArray(featuredGames) || featuredGames.length === 0) {
      this.showEmptyState();
      return;
    }

    // Limit to maxSlides
    this.slides = featuredGames.slice(0, this.options.maxSlides);

    // Clear existing slides
    this.slidesContainer.innerHTML = '';

    // Create slide elements
    this.slides.forEach((game, index) => {
      const slide = this.createSlideElement(game, index);
      this.slidesContainer.appendChild(slide);
    });

    // Create indicators
    if (this.options.showIndicators) {
      this.createIndicators();
    }

    // Show first slide
    this.showSlide(0);
  }

  createSlideElement(game, index) {
    const slide = document.createElement('div');
    slide.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
    slide.dataset.index = index;

    const isLive = game.status === 'LIVE' || game.status === 'IN_PROGRESS';
    const importance = game.importance || 1;

    slide.innerHTML = `
      <div class="slide-content" style="background-image: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(147, 51, 234, 0.9));">
        <div class="slide-header">
          ${isLive ? '<span class="live-indicator">🔴 LIVE</span>' : ''}
          ${importance > 3 ? '<span class="featured-indicator">⭐ FEATURED</span>' : ''}
        </div>
        
        <div class="slide-body">
          <div class="teams">
            <div class="team home">
              <div class="team-name">${this.escapeHtml(game.homeTeam || 'Home Team')}</div>
              <div class="team-score">${game.score?.home || '-'}</div>
            </div>
            
            <div class="vs-separator">VS</div>
            
            <div class="team away">
              <div class="team-name">${this.escapeHtml(game.awayTeam || 'Away Team')}</div>
              <div class="team-score">${game.score?.away || '-'}</div>
            </div>
          </div>
          
          <div class="game-info">
            <div class="competition">${this.escapeHtml(game.competition || 'Football')}</div>
            <div class="start-time">${this.formatTime(game.startTime)}</div>
            ${game.status && game.status !== 'SCHEDULED' ? 
              `<div class="status">${this.escapeHtml(game.status)}</div>` : ''}
          </div>
        </div>
        
        <div class="slide-footer">
          <button class="view-details-btn" data-game-id="${game.id}">
            View Analysis →
          </button>
        </div>
      </div>
    `;

    // Add click handler for details button
    const detailsBtn = slide.querySelector('.view-details-btn');
    if (detailsBtn) {
      detailsBtn.addEventListener('click', () => {
        this.onGameSelected(game);
      });
    }

    return slide;
  }

  createIndicators() {
    if (!this.indicatorsContainer) return;

    this.indicatorsContainer.innerHTML = '';

    this.slides.forEach((_, index) => {
      const indicator = document.createElement('button');
      indicator.className = `indicator ${index === 0 ? 'active' : ''}`;
      indicator.dataset.index = index;
      indicator.setAttribute('aria-label', `Go to slide ${index + 1}`);

      indicator.addEventListener('click', () => this.goToSlide(index));

      this.indicatorsContainer.appendChild(indicator);
    });
  }

  showSlide(index) {
    if (index < 0 || index >= this.slides.length) return;

    // Hide all slides
    const allSlides = this.slidesContainer.querySelectorAll('.carousel-slide');
    allSlides.forEach(slide => slide.classList.remove('active'));

    // Show current slide
    const currentSlide = this.slidesContainer.querySelector(`[data-index="${index}"]`);
    if (currentSlide) {
      currentSlide.classList.add('active');
    }

    // Update indicators
    if (this.options.showIndicators) {
      const allIndicators = this.indicatorsContainer.querySelectorAll('.indicator');
      allIndicators.forEach(indicator => indicator.classList.remove('active'));

      const currentIndicator = this.indicatorsContainer.querySelector(`[data-index="${index}"]`);
      if (currentIndicator) {
        currentIndicator.classList.add('active');
      }
    }

    this.currentIndex = index;
  }

  nextSlide() {
    const nextIndex = (this.currentIndex + 1) % this.slides.length;
    this.showSlide(nextIndex);
  }

  previousSlide() {
    const prevIndex = this.currentIndex === 0 ? this.slides.length - 1 : this.currentIndex - 1;
    this.showSlide(prevIndex);
  }

  goToSlide(index) {
    this.showSlide(index);
    this.restartAutoPlay();
  }

  startAutoPlay() {
    if (!this.options.autoPlay || this.slides.length <= 1) return;

    this.pauseAutoPlay(); // Clear any existing interval

    this.autoPlayInterval = setInterval(() => {
      this.nextSlide();
    }, this.options.interval);
  }

  pauseAutoPlay() {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = None;
    }
  }

  restartAutoPlay() {
    this.pauseAutoPlay();
    this.startAutoPlay();
  }

  showLoading() {
    if (this.loadingElement) {
      this.loadingElement.style.display = 'flex';
    }
    this.slidesContainer.style.display = 'None';
    if (this.errorElement) {
      this.errorElement.style.display = 'None';
    }
  }

  hideLoading() {
    if (this.loadingElement) {
      this.loadingElement.style.display = 'None';
    }
    this.slidesContainer.style.display = 'block';
    if (this.errorElement) {
      this.errorElement.style.display = 'None';
    }
  }

  showErrorState() {
    this.hideLoading();
    if (this.errorElement) {
      this.errorElement.style.display = 'flex';
    }
    this.slidesContainer.style.display = 'None';
  }

  showEmptyState() {
    this.slidesContainer.innerHTML = `
      <div class="empty-state">
        <p>No featured games available at the moment.</p>
      </div>
    `;
    this.hideLoading();
  }

  onGameSelected(game) {
    // Emit custom event for parent components to handle
    const event = new CustomEvent('gameSelected', {
      detail: { game }
    });
    this.container.dispatchEvent(event);
  }

  // Utility methods
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatTime(timeString) {
    if (!timeString) return 'Time TBD';
    
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Time TBD';
    }
  }

  // Public API methods
  destroy() {
    this.pauseAutoPlay();
    this.container.innerHTML = '';
  }

  refresh() {
    this.loadHeroData();
  }

  getCurrentSlide() {
    return this.slides[this.currentIndex];
  }
}

// Auto-initialize hero carousels with data-hero-carousel attribute
document.addEventListener('DOMContentLoaded', () => {
  const carousels = document.querySelectorAll('[data-hero-carousel]');
  
  carousels.forEach(container => {
    const carouselId = container.id || `hero-carousel-${Date.now()}`;
    container.id = carouselId;
    
    const options = {
      autoPlay: container.dataset.autoPlay !== 'false',
      interval: parseInt(container.dataset.interval) || 5000,
      showIndicators: container.dataset.showIndicators !== 'false',
      showControls: container.dataset.showControls !== 'false',
      maxSlides: parseInt(container.dataset.maxSlides) || 5
    };

    new HeroCarousel(carouselId, options);
  });
});

// Export for module usage
if (typeof module !== 'Unknown' && module.exports) {
  module.exports = HeroCarousel;
}
