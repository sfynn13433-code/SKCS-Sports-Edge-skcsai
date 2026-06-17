"""
SKCS AI Sports Edge - EdgeMind Inference Bridge
Bridge between Supabase and local EdgeMind server (localhost:8080)
"""

import os
import json
import asyncio
import re
import psycopg2
from psycopg2.extras import Json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import logging
from google.antigravity import Agent, LocalAgentConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Antigravity Configuration
ANTIGRAVITY_API_KEY = os.getenv('ANTIGRAVITY_API_KEY')
AG_MODEL = os.getenv('AG_MODEL', 'antigravity-1.0-pro')

# CPU Queue: Semaphore to ensure only one inference at a time
INFERENCE_SEMAPHORE = asyncio.Semaphore(1)

# Ultra-Slim System Prompt for EdgeMind
CKP_SYSTEM_PROMPT = "You are an SKCS Quant. Output exactly in this format: [Score] | [Analysis]. Example: 82 | Home momentum surge outweighs minor injury risk."


class EdgeMindInferenceBridge:
    """Bridge between Supabase and Antigravity inference engine."""

    def __init__(self, db_url: Optional[str] = None):
        """
        Initialize the inference bridge.

        Args:
            db_url: PostgreSQL connection string (defaults to DATABASE_URL env var)
        """
        self.db_url = db_url or DATABASE_URL

        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable must be set")
        
        if not SUPABASE_SERVICE_ROLE_KEY:
            logger.warning("SUPABASE_SERVICE_ROLE_KEY not set. Write operations may fail due to insufficient permissions.")

        if not ANTIGRAVITY_API_KEY:
            logger.error("ANTIGRAVITY_API_KEY not set. Inference will fail.")

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
        Construct a condensed payload for inference BOT using context-slimming strategy.
        Keeps input under 500 tokens to leave room for internal reasoning.

        Args:
            snapshot: Match snapshot dictionary

        Returns:
            Condensed prompt string for inference
        """
        base_info = snapshot.get('base_match_info', {})
        edge_data = snapshot.get('edge_data', {})
        live_momentum = snapshot.get('live_momentum', {})
        public_intelligence = snapshot.get('public_intelligence', [])

        # Extract injury summary (condensed)
        injury_report = edge_data.get('injury_report', {})
        injury_count = 0
        if isinstance(injury_report, dict):
            injury_count = len(injury_report.get('injuries', []))

        # Extract momentum surge (condensed)
        odds_velocity = live_momentum.get('odds_velocity', 0)
        if odds_velocity:
            if abs(odds_velocity) > 0.05:
                momentum = "SURGE" if odds_velocity > 0 else "DROP"
            else:
                momentum = "Neutral"
        else:
            momentum = "Neutral"

        # Build ultra-slim payload
        condensed = (
            f"Predict: {base_info.get('home_team', 'Unknown')} vs {base_info.get('away_team', 'Unknown')}. "
            f"Odds: {odds_velocity}. Inj: {injury_count}. Mom: {momentum}. Result:"
        )

        return condensed

    async def call_edgemind(self, prompt: str) -> Dict[str, Any]:
        """
        Send prompt to Antigravity and parse response.

        Args:
            prompt: Formatted prompt string

        Returns:
            Dictionary with confidence_score, edge_detected, and reasoning
        """
        import time
        start_time = time.time()
        
        try:
            config = LocalAgentConfig(
                api_key=ANTIGRAVITY_API_KEY,
                model=AG_MODEL,
                system_instructions=CKP_SYSTEM_PROMPT
            )

            async with Agent(config) as agent:
                response = await agent.chat(prompt)
                raw_response = response.text.strip()

            inference_time = time.time() - start_time
            logger.info(f"Inference Time: {inference_time:.2f}s")
            logger.info(f"Antigravity raw response: {raw_response}")

            # Parse the response
            parsed = self.parse_edgemind_response(raw_response)
            parsed['inference_time_seconds'] = inference_time
            return parsed

        except Exception as e:
            logger.error(f"Antigravity inference error: {e}")
            raise

    def parse_edgemind_response(self, response: str) -> Dict[str, Any]:
        """
        Parse Antigravity response to extract confidence_score, edge_detected, and reasoning.
        Expects format: [Score] | [Analysis]

        Args:
            response: Raw response string from Antigravity

        Returns:
            Dictionary with parsed confidence_score, edge_detected, and reasoning
        """
        result = {
            'confidence_score': None,
            'edge_detected': False,
            'reasoning': response.strip(),
            'raw_response': response
        }

        # Try strict format parsing: [Score] | [Analysis]
        match = re.match(r"(\d+)\s*\|\s*(.*)", response.strip())
        if match:
            try:
                score = int(match.group(1))
                result['confidence_score'] = float(score)
                result['reasoning'] = match.group(2).strip()
                result['edge_detected'] = score >= 70
                return result
            except ValueError:
                pass

        # Fallback parsing
        parts = response.split('|')
        if len(parts) >= 2:
            try:
                score_str = re.search(r'\d+', parts[0])
                if score_str:
                    score = int(score_str.group())
                    result['confidence_score'] = float(score)
                    result['edge_detected'] = score >= 70
                result['reasoning'] = parts[1].strip()
            except (ValueError, IndexError):
                pass
        
        # Last ditch effort for score
        if result['confidence_score'] is None:
            score_match = re.search(r'(\d+)', response)
            if score_match:
                score = int(score_match.group(1))
                result['confidence_score'] = float(score)
                result['edge_detected'] = score >= 70

        logger.info(f"Parsed response: confidence={result['confidence_score']}, edge={result['edge_detected']}")
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
