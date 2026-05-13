"""
SKCS AI Sports Edge - ESPN Now API Surveillance Module
High-frequency background worker for real-time sports intelligence gathering.
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Volatility keywords that indicate high-impact events
VOLATILITY_KEYWORDS = [
    'injury', 'injured', 'injuries',
    'out', 'ruled out', 'will not play', 'inactive',
    'suspended', 'suspension', 'suspended for',
    'questionable', 'doubtful', 'game-time decision',
    'trade', 'traded', 'trade talks', 'trade rumors',
    'personal reasons', 'personal matter', 'family matter',
    'illness', 'sick', 'health issues',
    'arrested', 'legal issues', 'court',
    'contract', 'extension', 'holdout', 'negotiations',
    'bench', 'demoted', 'benched',
    'coach', 'fired', 'dismissed', 'relieved'
]

@dataclass
class NewsItem:
    """Data class for structured news item processing."""
    headline: str
    description: str
    published_at: str
    athlete_id: Optional[str] = None
    team_id: Optional[str] = None
    league_id: Optional[str] = None
    raw_payload: Optional[Dict[str, Any]] = None


class ESPNNowPulseWorker:
    """
    High-frequency background worker for ESPN Now API surveillance.
    
    Polls the ESPN Now API for breaking news and filters for high-volatility
    events that could impact betting lines and prediction accuracy.
    """
    
    def __init__(self, poll_interval: int = 30, timeout: int = 10):
        """
        Initialize the ESPN Now API pulse worker.
        
        Args:
            poll_interval: Seconds between API polls (default: 30)
            timeout: Request timeout in seconds (default: 10)
        """
        self.poll_interval = poll_interval
        self.timeout = timeout
        self.api_base_url = "https://now.core.api.espn.com/v1/sports/news"
        self.session = None
        self.volatility_pattern = self._compile_volatility_pattern()
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        
    def _compile_volatility_pattern(self) -> re.Pattern:
        """
        Compile regex pattern for volatility keyword detection.
        
        Returns:
            Compiled regex pattern for case-insensitive keyword matching
        """
        pattern = r'\b(?:' + '|'.join(map(re.escape, VOLATILITY_KEYWORDS)) + r')\b'
        return re.compile(pattern, re.IGNORECASE)
    
    async def __aenter__(self):
        """Async context manager entry - create HTTP session."""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout),
            headers={'User-Agent': 'SKCS-Edge-Pulse/1.0'}
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close HTTP session."""
        if self.session:
            await self.session.close()
    
    async def fetch_espn_now_news(self) -> Optional[Dict[str, Any]]:
        """
        Fetch latest news from ESPN Now API.
        
        Returns:
            Parsed JSON response or None if request fails
        """
        try:
            if not self.session:
                raise RuntimeError("Session not initialized. Use async context manager.")
            
            self.logger.debug(f"Polling ESPN Now API: {self.api_base_url}")
            
            async with self.session.get(self.api_base_url) as response:
                if response.status == 200:
                    data = await response.json()
                    self.logger.debug(f"Successfully fetched {len(data.get('news', []))} news items")
                    return data
                else:
                    self.logger.warning(f"ESPN Now API returned status {response.status}")
                    return None
                    
        except aiohttp.ClientTimeout:
            self.logger.error("ESPN Now API request timed out")
            return None
        except aiohttp.ClientError as e:
            self.logger.error(f"ESPN Now API client error: {e}")
            return None
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to decode ESPN Now API JSON: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Unexpected error fetching ESPN Now API: {e}")
            return None
    
    def extract_news_items(self, api_response: Dict[str, Any]) -> List[NewsItem]:
        """
        Extract structured news items from ESPN Now API response.
        
        Args:
            api_response: Parsed JSON response from ESPN Now API
            
        Returns:
            List of structured NewsItem objects
        """
        news_items = []
        
        try:
            news_data = api_response.get('news', [])
            
            for item in news_data:
                # Extract basic news information
                headline = item.get('headline', '')
                description = item.get('description', '')
                published_at = item.get('published', '')
                
                # Extract entity IDs if available
                athlete_id = None
                team_id = None
                league_id = None
                
                # Look for athlete references
                if 'athletes' in item:
                    athletes = item['athletes']
                    if athletes and len(athletes) > 0:
                        athlete_id = athletes[0].get('id')
                
                # Look for team references
                if 'teams' in item:
                    teams = item['teams']
                    if teams and len(teams) > 0:
                        team_id = teams[0].get('id')
                
                # Look for league references
                if 'leagues' in item:
                    leagues = item['leagues']
                    if leagues and len(leagues) > 0:
                        league_id = leagues[0].get('id')
                
                news_item = NewsItem(
                    headline=headline,
                    description=description,
                    published_at=published_at,
                    athlete_id=athlete_id,
                    team_id=team_id,
                    league_id=league_id,
                    raw_payload=item
                )
                
                news_items.append(news_item)
            
            self.logger.info(f"Extracted {len(news_items)} news items from API response")
            return news_items
            
        except Exception as e:
            self.logger.error(f"Error extracting news items: {e}")
            return []
    
    def is_high_volatility(self, news_item: NewsItem) -> bool:
        """
        Check if news item contains volatility keywords.
        
        Args:
            news_item: NewsItem to analyze
            
        Returns:
            True if item contains high-volatility keywords
        """
        # Combine headline and description for analysis
        text_to_analyze = f"{news_item.headline} {news_item.description}"
        
        # Check for volatility keywords
        matches = self.volatility_pattern.findall(text_to_analyze)
        
        if matches:
            self.logger.info(f"High volatility detected: {matches[0]} in '{news_item.headline[:50]}...'")
            return True
        
        return False
    
    def create_intelligence_payload(self, news_item: NewsItem) -> Dict[str, Any]:
        """
        Create payload for public_intelligence table insertion.
        
        Args:
            news_item: NewsItem containing filtered high-volatility news
            
        Returns:
            Dictionary ready for Supabase insertion
        """
        try:
            # Determine the primary ESPN entity ID (prefer athlete over team)
            espn_entity_id = news_item.athlete_id or news_item.team_id
            
            # Parse publication timestamp
            news_timestamp = None
            if news_item.published_at:
                try:
                    # ESPN Now API typically uses ISO format
                    news_timestamp = datetime.fromisoformat(
                        news_item.published_at.replace('Z', '+00:00')
                    ).astimezone(timezone.utc).isoformat()
                except (ValueError, AttributeError) as e:
                    self.logger.warning(f"Could not parse timestamp '{news_item.published_at}': {e}")
                    news_timestamp = datetime.now(timezone.utc).isoformat()
            else:
                news_timestamp = datetime.now(timezone.utc).isoformat()
            
            # Create the intelligence payload
            payload = {
                'espn_entity_id': espn_entity_id,
                'news_timestamp': news_timestamp,
                'headline': news_item.headline,
                'description': news_item.description,
                'athlete_id': news_item.athlete_id,
                'team_id': news_item.team_id,
                'league_id': news_item.league_id,
                'volatility_score': self._calculate_volatility_score(news_item),
                'raw_news_payload': news_item.raw_payload,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            
            return payload
            
        except Exception as e:
            self.logger.error(f"Error creating intelligence payload: {e}")
            return {}
    
    def _calculate_volatility_score(self, news_item: NewsItem) -> float:
        """
        Calculate volatility score based on keyword importance.
        
        Args:
            news_item: NewsItem to score
            
        Returns:
            Volatility score between 0.0 and 1.0
        """
        text = f"{news_item.headline} {news_item.description}".lower()
        
        # High-impact keywords (score: 0.8-1.0)
        high_impact = ['injury', 'suspended', 'arrested', 'fired', 'trade']
        
        # Medium-impact keywords (score: 0.5-0.7)
        medium_impact = ['out', 'questionable', 'illness', 'contract', 'bench']
        
        # Low-impact keywords (score: 0.2-0.4)
        low_impact = ['doubtful', 'personal reasons', 'negotiations']
        
        score = 0.0
        
        for keyword in high_impact:
            if keyword in text:
                score = max(score, 0.9)
        
        for keyword in medium_impact:
            if keyword in text:
                score = max(score, 0.6)
        
        for keyword in low_impact:
            if keyword in text:
                score = max(score, 0.3)
        
        # Bonus for multiple keywords
        keyword_count = len(self.volatility_pattern.findall(text))
        if keyword_count > 1:
            score = min(score + 0.1, 1.0)
        
        return score
    
    async def process_news_cycle(self) -> int:
        """
        Process one complete news cycle: fetch, filter, and store.
        
        Returns:
            Number of high-volatility items processed
        """
        # Fetch news from ESPN Now API
        api_response = await self.fetch_espn_now_news()
        if not api_response:
            return 0
        
        # Extract structured news items
        news_items = self.extract_news_items(api_response)
        if not news_items:
            return 0
        
        # Filter for high-volatility items
        high_volatility_items = [
            item for item in news_items 
            if self.is_high_volatility(item)
        ]
        
        if not high_volatility_items:
            self.logger.info("No high-volatility news items found in this cycle")
            return 0
        
        # Link high-volatility news to specific events
        await self.link_news_to_events()
        
        return len(high_volatility_items)
    
    async def insert_public_intelligence(self, data_dict: Dict[str, Any]) -> bool:
        """
        Insert intelligence data into Supabase public_intelligence table.
        
        This is a placeholder for the actual database insertion logic.
        The actual implementation would use the Supabase client.
        
        Args:
            data_dict: Dictionary containing intelligence data
            
        Returns:
            True if insertion successful, False otherwise
        """
        try:
            # Placeholder for actual Supabase insertion
            # In production, this would be:
            # result = supabase.table('public_intelligence').insert(data_dict).execute()
            # return result.data is not None
            
            self.logger.debug(f"Would insert intelligence: {data_dict.get('headline', 'Unknown')}")
            
            # Simulate successful insertion for demonstration
            return True
            
        except Exception as e:
            self.logger.error(f"Database insertion error: {e}")
            return False
    
    def _extract_event_ids(self, news_item: NewsItem) -> List[str]:
        """
        Extract ESPN event IDs from news item for linking.
        
        Args:
            news_item: NewsItem containing potential event references
            
        Returns:
            List of ESPN event IDs found in news item
        """
        event_ids = []
        
        try:
            # Check headline and description for ESPN event patterns
            text_to_search = f"{news_item.headline} {news_item.description}".lower()
            
            # Common ESPN event ID patterns (game IDs, team references)
            event_patterns = [
                r'game[:\s]*id[:\s]*\s*(\d{6,8})',  # Game ID patterns
                r'(\d{6,8})',  # Standalone 6-8 digit IDs
                r'team[:\s]*id[:\s]*\s*(\d{6,8})',  # Team ID patterns
            ]
            
            for pattern in event_patterns:
                matches = re.findall(pattern, text_to_search)
                event_ids.extend(matches)
            
            # Remove duplicates while preserving order
            seen = set()
            unique_event_ids = []
            for event_id in event_ids:
                if event_id not in seen:
                    seen.add(event_id)
                    unique_event_ids.append(event_id)
            
            return unique_event_ids
            
        except Exception as e:
            self.logger.error(f"Error extracting event IDs from news item: {e}")
            return []
    
    async def query_events_by_ids(self, event_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Query events table by ESPN event IDs.
        
        Args:
            event_ids: List of ESPN event IDs to search for
            
        Returns:
            List of matching events from database
        """
        # Placeholder for actual database query
        # In production, this would query the events table
        try:
            # Simulate finding matching events
            mock_events = []
            for event_id in event_ids[:5]:  # Limit for testing
                mock_events.append({
                    'id': event_id,
                    'espn_id': event_id,
                    'sport': 'football',  # Default sport for demo
                    'status': 'in-progress'
                })
            
            self.logger.debug(f"Found {len(mock_events)} matching events for IDs: {event_ids[:5]}")
            return mock_events
            
        except Exception as e:
            self.logger.error(f"Error querying events by IDs: {e}")
            return []
    
    async def update_event_with_intelligence(self, event_id: str, news_item: NewsItem) -> bool:
        """
        Update specific event with intelligence data from news item.
        
        Args:
            event_id: ESPN event ID to update
            news_item: NewsItem containing intelligence data
            
        Returns:
            True if update successful, False otherwise
        """
        try:
            # Create intelligence payload for linking
            intelligence_payload = {
                'event_id': event_id,
                'news_source': 'espn_now_api',
                'news_timestamp': news_item.published_at,
                'headline': news_item.headline,
                'description': news_item.description,
                'volatility_score': self._calculate_volatility_score(news_item),
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            
            # Placeholder for actual database update
            # In production, this would update the events table
            self.logger.info(f"Would update event {event_id} with intelligence from: {news_item.headline[:50]}...")
            
            # Simulate successful update
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating event with intelligence: {e}")
            return False
    
    async def link_news_to_events(self):
        """Link high-volatility news items to specific upcoming events."""
        try:
            # Extract event IDs from high-volatility news items
            all_event_ids = []
            for item in self.high_volatility_items:
                event_ids = self._extract_event_ids(item)
                all_event_ids.extend(event_ids)
            
            if not all_event_ids:
                self.logger.info("No event IDs found in high-volatility news items")
                return
            
            # Query events table for matching events
            matching_events = await self.query_events_by_ids(all_event_ids)
            
            if not matching_events:
                self.logger.warning(f"No matching events found for event IDs: {all_event_ids[:5]}")
                return
            
            # Update events with intelligence links
            linked_count = 0
            for event in matching_events:
                # Find corresponding news items
                for item in self.high_volatility_items:
                    event_ids = self._extract_event_ids(item)
                    if event['espn_id'] in event_ids:
                        success = await self.update_event_with_intelligence(event['id'], item)
                        if success:
                            linked_count += 1
                            self.logger.info(f"Linked intelligence to event {event['espn_id']}: {item.headline[:50]}...")
                        break
            
            self.logger.info(f"Successfully linked intelligence to {linked_count} events")
            
        except Exception as e:
            self.logger.error(f"Error linking news to events: {e}")
    
    async def run_continuous_pulse(self):
        """
        Run the ESPN Now API pulse worker continuously.
        
        This method runs indefinitely, polling the API at the specified interval.
        """
        self.logger.info(f"Starting ESPN Now API pulse worker (interval: {self.poll_interval}s)")
        
        while True:
            try:
                processed_count = await self.process_news_cycle()
                
                if processed_count > 0:
                    self.logger.info(f"Cycle complete: {processed_count} high-volatility items processed")
                else:
                    self.logger.debug("Cycle complete: no high-volatility items found")
                
                # Wait for next poll
                await asyncio.sleep(self.poll_interval)
                
            except asyncio.CancelledError:
                self.logger.info("ESPN Now pulse worker cancelled")
                break
            except Exception as e:
                self.logger.error(f"Unexpected error in pulse cycle: {e}")
                # Wait before retrying to avoid rapid error loops
                await asyncio.sleep(min(self.poll_interval, 60))


# Example usage and testing
async def main():
    """Example usage of the ESPN Now API pulse worker."""
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create and run the pulse worker
    async with ESPNNowPulseWorker(poll_interval=60, timeout=15) as worker:
        # Run for a limited time for testing (remove time limit for production)
        try:
            await asyncio.wait_for(worker.run_continuous_pulse(), timeout=300)  # 5 minutes for testing
        except asyncio.TimeoutError:
            logger.info("Test run completed")


if __name__ == "__main__":
    # Run the example
    asyncio.run(main())
