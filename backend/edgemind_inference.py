"""
SKCS AI Sports Edge - EdgeMind Inference Bridge
Bridge between Supabase and local EdgeMind server (localhost:8080)
"""

import os
import json
import asyncio
import aiohttp
import psycopg2
from psycopg2.extras import Json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
EDGEMIND_URL = os.getenv('DOLPHIN_URL', 'http://127.0.0.1:8080')
EDGEMIND_TIMEOUT = int(os.getenv('DOLPHIN_TIMEOUT', 120000)) / 1000  # Convert to seconds

# CPU Queue: Semaphore to ensure only one inference at a time
INFERENCE_SEMAPHORE = asyncio.Semaphore(1)

# Ultra-Slim System Prompt for EdgeMind
CKP_SYSTEM_PROMPT = "You are an SKCS Quant. Output exactly in this format: [Score] | [Analysis]. Example: 82 | Home momentum surge outweighs minor injury risk."


class EdgeMindInferenceBridge:
    """Bridge between Supabase and EdgeMind inference server."""

    def __init__(self, db_url: Optional[str] = None, edgemind_url: Optional[str] = None):
        """
        Initialize the EdgeMind inference bridge.

        Args:
            db_url: PostgreSQL connection string (defaults to DATABASE_URL env var)
            edgemind_url: EdgeMind server URL (defaults to http://127.0.0.1:8080)
        """
        self.db_url = db_url or DATABASE_URL
        self.edgemind_url = edgemind_url or EDGEMIND_URL
        self.timeout = EDGEMIND_TIMEOUT

        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable must be set")
        
        if not SUPABASE_SERVICE_ROLE_KEY:
            logger.warning("SUPABASE_SERVICE_ROLE_KEY not set. Write operations may fail due to insufficient permissions.")

    def get_db_connection(self):
        """Create a PostgreSQL database connection."""
        return psycopg2.connect(self.db_url)

    async def fetch_match_snapshot(self, event_id: str) -> Dict[str, Any]:
        """
        Fetch match snapshot from Supabase including edge_data, live_momentum, and public_intelligence.

        Args:
            event_id: The event/match ID to fetch

        Returns:
            Dictionary containing match data with edge_data, live_momentum, and public_intelligence
        """
        snapshot = {
            'event_id': event_id,
            'edge_data': None,
            'live_momentum': None,
            'public_intelligence': None,
            'base_match_info': None
        }

        try:
            with self.get_db_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Fetch base match info from events table
                    cur.execute(
                        """
                        SELECT id, espn_id, sport, home_team, away_team, 
                               kickoff_time, status, created_at
                        FROM events
                        WHERE id = %s OR espn_id = %s
                        LIMIT 1
                        """,
                        (event_id, event_id)
                    )
                    base_match = cur.fetchone()
                    if base_match:
                        snapshot['base_match_info'] = dict(base_match)
                        # Use the actual event_id from the database
                        snapshot['event_id'] = base_match['id']

                    # Fetch edge_data
                    cur.execute(
                        """
                        SELECT weather_conditions, injury_report, 
                               news_sentiment_score, raw_edge_payload
                        FROM edge_data
                        WHERE event_id = %s
                        ORDER BY created_at DESC
                        LIMIT 1
                        """,
                        (snapshot['event_id'],)
                    )
                    edge_data = cur.fetchone()
                    if edge_data:
                        snapshot['edge_data'] = dict(edge_data)

                    # Fetch live_momentum
                    cur.execute(
                        """
                        SELECT odds_velocity, win_probability, market_movement,
                               timestamp, raw_momentum_payload
                        FROM live_momentum
                        WHERE event_id = %s
                        ORDER BY timestamp DESC
                        LIMIT 1
                        """,
                        (snapshot['event_id'],)
                    )
                    live_momentum = cur.fetchone()
                    if live_momentum:
                        snapshot['live_momentum'] = dict(live_momentum)

                    # Fetch public_intelligence
                    cur.execute(
                        """
                        SELECT headline, description, volatility_score,
                               news_timestamp, athlete_id, team_id
                        FROM public_intelligence
                        WHERE event_id = %s
                        ORDER BY news_timestamp DESC
                        LIMIT 5
                        """,
                        (snapshot['event_id'],)
                    )
                    public_intelligence = cur.fetchall()
                    if public_intelligence:
                        snapshot['public_intelligence'] = [dict(row) for row in public_intelligence]

            logger.info(f"Fetched match snapshot for event_id: {snapshot['event_id']}")
            return snapshot

        except Exception as e:
            logger.error(f"Error fetching match snapshot: {e}")
            raise

    def construct_condensed_payload(self, snapshot: Dict[str, Any]) -> str:
        """
        Construct a condensed payload for EdgeMind BOT using context-slimming strategy.
        Keeps input under 500 tokens to leave room for internal reasoning.

        Args:
            snapshot: Match snapshot dictionary

        Returns:
            Condensed prompt string for EdgeMind inference
        """
        base_info = snapshot.get('base_match_info', {})
        edge_data = snapshot.get('edge_data', {})
        live_momentum = snapshot.get('live_momentum', {})
        public_intelligence = snapshot.get('public_intelligence', [])

        # Extract injury summary (condensed)
        injury_report = edge_data.get('injury_report', {})
        if isinstance(injury_report, dict):
            injury_count = len(injury_report.get('injuries', []))
            injury_summary = f"{injury_count} injuries" if injury_count > 0 else "No injuries"
        else:
            injury_summary = "Unknown"

        # Extract momentum surge (condensed)
        odds_velocity = live_momentum.get('odds_velocity', 0)
        if odds_velocity:
            if abs(odds_velocity) > 0.05:
                momentum = "SURGE" if odds_velocity > 0 else "DROP"
            else:
                momentum = "Neutral"
        else:
            momentum = "Neutral"

        # Extract market movement (condensed)
        market_movement = live_momentum.get('market_movement', 0)
        market_status = "Sharp" if abs(market_movement) > 0.03 else "Stable"

        # Extract news volatility (condensed)
        if public_intelligence:
            avg_volatility = sum(item.get('volatility_score', 0) for item in public_intelligence) / len(public_intelligence)
            news_status = "High" if avg_volatility > 0.7 else "Low"
        else:
            news_status = "None"

        # Build ultra-slim payload (target: < 100 tokens)
        condensed = (
            f"{CKP_SYSTEM_PROMPT}\n"
            f"Predict: {base_info.get('home_team', 'Unknown')} vs {base_info.get('away_team', 'Unknown')}. "
            f"Odds: {odds_velocity}. Inj: {injury_count if isinstance(injury_report, dict) else 0}. Mom: {momentum}. Result:"
        )

        return condensed

    async def call_edgemind(self, prompt: str) -> Dict[str, Any]:
        """
        Send prompt to EdgeMind server and parse response.

        Args:
            prompt: Formatted prompt string

        Returns:
            Dictionary with confidence_score, edge_detected, and reasoning
        """
        url = f"{self.edgemind_url}/completion"
        
        payload = {
            "prompt": prompt,
            "n_predict": 40,
            "temperature": 0.2,
            "top_p": 0.9,
            "stop": ["\n", "User:"]
        }

        import time
        start_time = time.time()
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.post(url, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"EdgeMind server returned status {response.status}: {error_text}")
                        raise Exception(f"EdgeMind server error: {response.status}")

                    result = await response.json()
                    raw_response = result.get('content', '')

                    inference_time = time.time() - start_time
                    logger.info(f"Inference Time: {inference_time:.2f}s")
                    logger.info(f"EdgeMind raw response: {raw_response[:200]}...")

                    # Parse the response
                    parsed = self.parse_edgemind_response(raw_response)
                    parsed['inference_time_seconds'] = inference_time
                    return parsed

        except asyncio.TimeoutError:
            logger.error("EdgeMind request timed out")
            raise Exception("EdgeMind inference timed out")
        except aiohttp.ClientError as e:
            logger.error(f"EdgeMind client error: {e}")
            raise Exception(f"EdgeMind connection error: {e}")
        except Exception as e:
            logger.error(f"EdgeMind inference error: {e}")
            raise

    def parse_edgemind_response(self, response: str) -> Dict[str, Any]:
        """
        Parse EdgeMind response to extract confidence_score, edge_detected, and reasoning.

        Args:
            response: Raw response string from EdgeMind

        Returns:
            Dictionary with parsed confidence_score, edge_detected, and reasoning
        """
        result = {
            'confidence_score': None,
            'edge_detected': None,
            'reasoning': response.strip(),
            'raw_response': response
        }

        lines = response.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            
            # Extract CONFIDENCE_SCORE
            if 'CONFIDENCE_SCORE' in line.upper():
                try:
                    # Look for number after colon
                    parts = line.split(':')
                    if len(parts) > 1:
                        score_str = parts[1].strip().strip('[]')
                        result['confidence_score'] = float(score_str)
                except (ValueError, IndexError):
                    pass

            # Extract EDGE_DETECTED
            if 'EDGE_DETECTED' in line.upper():
                if 'TRUE' in line.upper():
                    result['edge_detected'] = True
                elif 'FALSE' in line.upper():
                    result['edge_detected'] = False

            # Extract REASONING
            if 'REASONING' in line.upper():
                try:
                    parts = line.split(':', 1)
                    if len(parts) > 1:
                        result['reasoning'] = parts[1].strip()
                except IndexError:
                    pass

        # If confidence_score not found, try to extract from reasoning
        if result['confidence_score'] is None:
            import re
            score_match = re.search(r'(\d{1,3})\s*%', response)
            if score_match:
                result['confidence_score'] = float(score_match.group(1))

        logger.info(f"Parsed EdgeMind response: confidence={result['confidence_score']}, edge={result['edge_detected']}")
        return result

    async def sync_results_to_supabase(self, event_id: str, inference_result: Dict[str, Any]) -> bool:
        """
        Write inference results back to Supabase events table.

        Args:
            event_id: Event ID to update
            inference_result: Dictionary with confidence_score, edge_detected, reasoning

        Returns:
            True if successful, False otherwise
        """
        try:
            with self.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE events
                        SET 
                            confidence_score = %s,
                            edgemind_analysis = %s,
                            edge_detected = %s,
                            edgemind_updated_at = %s
                        WHERE id = %s
                        """,
                        (
                            inference_result.get('confidence_score'),
                            Json(inference_result),
                            inference_result.get('edge_detected'),
                            datetime.now(timezone.utc),
                            event_id
                        )
                    )
                    conn.commit()
                    
            logger.info(f"Successfully synced results to Supabase for event_id: {event_id}")
            return True

        except Exception as e:
            logger.error(f"Error syncing results to Supabase: {e}")
            return False

    async def run_inference(self, event_id: str) -> Dict[str, Any]:
        """
        Run complete inference pipeline for a single event with CPU queue management.

        Args:
            event_id: Event ID to analyze

        Returns:
            Dictionary with inference results
        """
        logger.info(f"Starting inference pipeline for event_id: {event_id}")

        # CPU Queue: Use semaphore to ensure only one inference at a time
        async with INFERENCE_SEMAPHORE:
            try:
                # Step 1: Fetch match snapshot
                snapshot = await self.fetch_match_snapshot(event_id)
                
                if not snapshot.get('base_match_info'):
                    logger.warning(f"No base match info found for event_id: {event_id}")
                    return {'error': 'Event not found', 'event_id': event_id}

                # Step 2: Construct condensed payload (context-slimming)
                prompt = self.construct_condensed_payload(snapshot)
                logger.info(f"Constructed condensed payload (length: {len(prompt)} chars)")

                # Step 3: Call EdgeMind
                inference_result = await self.call_edgemind(prompt)
                inference_result['event_id'] = event_id
                inference_result['inference_timestamp'] = datetime.now(timezone.utc).isoformat()

                # Step 4: Sync results to Supabase
                sync_success = await self.sync_results_to_supabase(event_id, inference_result)
                inference_result['sync_success'] = sync_success

                logger.info(f"Inference pipeline complete for event_id: {event_id}")
                return inference_result

            except Exception as e:
                logger.error(f"Inference pipeline failed for event_id: {event_id}: {e}")
                return {
                    'error': str(e),
                    'event_id': event_id,
                    'inference_timestamp': datetime.now(timezone.utc).isoformat()
                }


async def main():
    """Main entry point for testing the inference bridge."""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python edgemind_inference.py <event_id>")
        print("Example: python edgemind_inference.py 12345")
        sys.exit(1)

    event_id = sys.argv[1]
    
    bridge = EdgeMindInferenceBridge()
    result = await bridge.run_inference(event_id)
    
    print("\n" + "="*50)
    print("INFERENCE RESULT")
    print("="*50)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
