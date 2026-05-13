"""
SKCS AI Sports Edge - Sport Parser Module
Abstract base class and concrete implementations for ESPN API data normalization.
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import json

logger = logging.getLogger(__name__)


class BaseSportParser(ABC):
    """
    Abstract base class for sport-specific ESPN API parsers.
    
    Provides common functionality for handling raw ESPN API responses
    and enforces a consistent interface for data normalization.
    """
    
    def __init__(self, api_version: str = None):
        """
        Initialize parser with specific API version expectations.
        
        Args:
            api_version: Expected ESPN API version (e.g., 'v2', 'v3')
        """
        self.api_version = api_version
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    def parse_raw_response(self, raw_json: str) -> Optional[Dict[str, Any]]:
        """
        Parse raw JSON response from ESPN API.
        
        Args:
            raw_json: Raw JSON string from ESPN API response
            
        Returns:
            Parsed JSON dictionary or None if parsing fails
        """
        try:
            if not raw_json or not isinstance(raw_json, str):
                self.logger.warning("Empty or invalid raw JSON input")
                return None
                
            parsed_data = json.loads(raw_json)
            
            # Basic validation
            if not isinstance(parsed_data, dict):
                self.logger.warning("Parsed JSON is not a dictionary")
                return None
                
            self.logger.debug(f"Successfully parsed ESPN API response (keys: {list(parsed_data.keys())})")
            return parsed_data
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse ESPN API JSON: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Unexpected error parsing ESPN API response: {e}")
            return None
    
    def extract_stats(self, raw_json: str) -> Optional[Dict[str, Any]]:
        """
        Extract and normalize statistics from raw ESPN API response.
        
        Args:
            raw_json: Raw JSON string from ESPN API
            
        Returns:
            Normalized statistics dictionary or None if extraction fails
        """
        parsed_data = self.parse_raw_response(raw_json)
        if parsed_data is None:
            return None
            
        try:
            return self.normalize_stats(parsed_data)
        except Exception as e:
            self.logger.error(f"Failed to normalize stats: {e}")
            return None
    
    @abstractmethod
    def normalize_stats(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Abstract method to normalize sport-specific statistics.
        
        Must be implemented by subclasses to return a flattened dictionary
        with consistent structure across different sports.
        
        Args:
            raw_data: Parsed ESPN API response data
            
        Returns:
            Flattened dictionary with normalized statistics
        """
        pass


class FootballParser(BaseSportParser):
    """
    ESPN Football (American Football) parser for Core API v3.
    
    Extracts QBR (Quarterback Rating) and advanced statistics,
    normalizing them to a consistent dictionary structure.
    """
    
    def __init__(self):
        super().__init__(api_version="v3")
    
    def normalize_stats(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize ESPN Football API v3 statistics.
        
        Args:
            raw_data: Parsed ESPN Football API response
            
        Returns:
            Flattened dictionary with normalized football statistics
        """
        normalized = {
            'sport': 'football',
            'source_api': 'espn_core_v3',
            'qbr_rating': None,
            'passing_yards': None,
            'rushing_yards': None,
            'completion_percentage': None,
            'touchdowns': None,
            'interceptions': None,
            'advanced_stats': {}
        }
        
        try:
            # Extract team/player statistics from ESPN v3 structure
            if 'athletes' in raw_data:
                for athlete in raw_data.get('athletes', []):
                    stats = athlete.get('stats', [])
                    for stat_group in stats:
                        if 'stats' in stat_group:
                            stat_values = stat_group['stats']
                            
                            # QBR Rating
                            if 'qbrTotal' in stat_values:
                                normalized['qbr_rating'] = stat_values['qbrTotal']
                            
                            # Passing stats
                            if 'passingYards' in stat_values:
                                normalized['passing_yards'] = stat_values['passingYards']
                            
                            # Rushing stats
                            if 'rushingYards' in stat_values:
                                normalized['rushing_yards'] = stat_values['rushingYards']
                            
                            # Completion percentage
                            if 'completionPercentage' in stat_values:
                                normalized['completion_percentage'] = stat_values['completionPercentage']
                            
                            # Touchdowns
                            if 'passingTouchdowns' in stat_values:
                                normalized['touchdowns'] = stat_values['passingTouchdowns']
                            
                            # Interceptions
                            if 'interceptions' in stat_values:
                                normalized['interceptions'] = stat_values['interceptions']
                            
                            # Advanced stats
                            advanced_keys = ['yardsPerAttempt', 'yardsPerCompletion', 'sacks', 'fumbles']
                            for key in advanced_keys:
                                if key in stat_values:
                                    normalized['advanced_stats'][key] = stat_values[key]
            
            # Extract game-level statistics if available
            if 'boxscore' in raw_data:
                boxscore = raw_data['boxscore']
                if 'players' in boxscore:
                    for player in boxscore['players']:
                        player_stats = player.get('stats', [])
                        for stat in player_stats:
                            if 'stats' in stat:
                                stat_values = stat['stats']
                                # Additional stat extraction from boxscore
                                if 'totalYards' in stat_values:
                                    normalized['advanced_stats']['total_yards'] = stat_values['totalYards']
            
            self.logger.info(f"Normalized football stats: QBR={normalized['qbr_rating']}, "
                           f"Pass Yards={normalized['passing_yards']}, "
                           f"Rush Yards={normalized['rushing_yards']}")
            
        except Exception as e:
            self.logger.error(f"Error normalizing football stats: {e}")
            # Return partial data instead of failing completely
            pass
        
        return normalized


class SoccerParser(BaseSportParser):
    """
    ESPN Soccer parser for Site API v2.
    
    Extracts standard v2 summary statistics (possession, shots, fouls)
    and maps them to the same normalized dictionary structure as Football.
    """
    
    def __init__(self):
        super().__init__(api_version="v2")
    
    def normalize_stats(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize ESPN Soccer API v2 statistics.
        
        Args:
            raw_data: Parsed ESPN Soccer API response
            
        Returns:
            Flattened dictionary with normalized soccer statistics
        """
        normalized = {
            'sport': 'soccer',
            'source_api': 'espn_site_v2',
            'possession_percentage': None,
            'total_shots': None,
            'shots_on_target': None,
            'fouls': None,
            'corners': None,
            'offsides': None,
            'yellow_cards': None,
            'red_cards': None,
            'advanced_stats': {}
        }
        
        try:
            # Extract team statistics from ESPN v2 structure
            if 'teams' in raw_data:
                for team in raw_data.get('teams', []):
                    team_stats = team.get('statistics', [])
                    
                    for stat in team_stats:
                        stat_name = stat.get('name', '').lower()
                        stat_value = stat.get('value')
                        
                        # Map ESPN v2 stat names to normalized fields
                        if 'possession' in stat_name and stat_value is not None:
                            # ESPN v2 returns possession as percentage (e.g., "55%")
                            if isinstance(stat_value, str) and '%' in stat_value:
                                normalized['possession_percentage'] = float(stat_value.replace('%', ''))
                            else:
                                normalized['possession_percentage'] = float(stat_value)
                        
                        elif 'shots' in stat_name and 'total' in stat_name:
                            normalized['total_shots'] = int(stat_value) if stat_value else None
                        
                        elif 'shots' in stat_name and 'ontarget' in stat_name:
                            normalized['shots_on_target'] = int(stat_value) if stat_value else None
                        
                        elif 'fouls' in stat_name:
                            normalized['fouls'] = int(stat_value) if stat_value else None
                        
                        elif 'corners' in stat_name:
                            normalized['corners'] = int(stat_value) if stat_value else None
                        
                        elif 'offsides' in stat_name:
                            normalized['offsides'] = int(stat_value) if stat_value else None
                        
                        elif 'yellow' in stat_name and 'card' in stat_name:
                            normalized['yellow_cards'] = int(stat_value) if stat_value else None
                        
                        elif 'red' in stat_name and 'card' in stat_name:
                            normalized['red_cards'] = int(stat_value) if stat_value else None
            
            # Extract match-level statistics if available
            if 'match' in raw_data:
                match_data = raw_data['match']
                if 'statistics' in match_data:
                    match_stats = match_data['statistics']
                    for stat in match_stats:
                        stat_name = stat.get('name', '').lower()
                        stat_value = stat.get('value')
                        
                        # Additional match-level stats for advanced metrics
                        if 'passes' in stat_name:
                            normalized['advanced_stats']['total_passes'] = int(stat_value) if stat_value else None
                        elif 'pass_accuracy' in stat_name:
                            normalized['advanced_stats']['pass_accuracy'] = float(stat_value) if stat_value else None
                        elif 'tackles' in stat_name:
                            normalized['advanced_stats']['total_tackles'] = int(stat_value) if stat_value else None
            
            self.logger.info(f"Normalized soccer stats: Possession={normalized['possession_percentage']}%, "
                           f"Shots={normalized['total_shots']}, "
                           f"Fouls={normalized['fouls']}")
            
        except Exception as e:
            self.logger.error(f"Error normalizing soccer stats: {e}")
            # Return partial data instead of failing completely
            pass
        
        return normalized


# Example usage and testing
if __name__ == "__main__":
    # Configure logging for testing
    logging.basicConfig(level=logging.INFO)
    
    # Example ESPN Football API v3 response (mock data)
    football_json = '''
    {
        "athletes": [
            {
                "stats": [
                    {
                        "stats": {
                            "qbrTotal": 75.2,
                            "passingYards": 245,
                            "rushingYards": 89,
                            "completionPercentage": 68.5,
                            "passingTouchdowns": 2,
                            "interceptions": 1,
                            "yardsPerAttempt": 7.8,
                            "sacks": 3
                        }
                    }
                ]
            }
        ]
    }
    '''
    
    # Example ESPN Soccer API v2 response (mock data)
    soccer_json = '''
    {
        "teams": [
            {
                "statistics": [
                    {"name": "possession", "value": "55%"},
                    {"name": "shots_total", "value": 12},
                    {"name": "shots_ontarget", "value": 5},
                    {"name": "fouls", "value": 8},
                    {"name": "corners", "value": 4},
                    {"name": "yellow_cards", "value": 2},
                    {"name": "red_cards", "value": 0}
                ]
            }
        ],
        "match": {
            "statistics": [
                {"name": "total_passes", "value": 450},
                {"name": "pass_accuracy", "value": 82.5},
                {"name": "total_tackles", "value": 18}
            ]
        }
    }
    '''
    
    # Test Football Parser
    football_parser = FootballParser()
    football_result = football_parser.extract_stats(football_json)
    print("Football Parser Result:")
    print(json.dumps(football_result, indent=2))
    
    # Test Soccer Parser
    soccer_parser = SoccerParser()
    soccer_result = soccer_parser.extract_stats(soccer_json)
    print("\nSoccer Parser Result:")
    print(json.dumps(soccer_result, indent=2))
