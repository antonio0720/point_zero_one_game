"""
Skill Rating Module - ML Behavioral Personalization
Tracks contestant decision-making skill progression using modified ELO system
adapted for financial roguelike mechanics (12-minute runs, 300+ decision points).
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import numpy as np
from scipy.stats import norm


@dataclass
class SkillRating:
    """Contestant skill rating across financial domains."""
    contestant_id: str
    overall_rating: float
    risk_assessment: float
    resource_allocation: float
    timing_optimization: float
    portfolio_construction: float
    crisis_response: float
    volatility: float
    games_played: int
    last_updated: datetime
    confidence_interval: float


class SkillRatingEngine:
    """
    Modified ELO system for financial decision-making.
    K-factor scales with game count (higher volatility for new players).
    Domain-specific ratings track specialized skills.
    """
    
    BASE_RATING = 1500.0
    K_FACTOR_BASE = 32.0
    K_FACTOR_MIN = 16.0
    VOLATILITY_DECAY = 0.95
    
    def __init__(self):
        self.rating_history: Dict[str, List[SkillRating]] = {}
    
    def initialize_rating(self, contestant_id: str) -> SkillRating:
        """Initialize new contestant with base ratings."""
        return SkillRating(
            contestant_id=contestant_id,
            overall_rating=self.BASE_RATING,
            risk_assessment=self.BASE_RATING,
            resource_allocation=self.BASE_RATING,
            timing_optimization=self.BASE_RATING,
            portfolio_construction=self.BASE_RATING,
            crisis_response=self.BASE_RATING,
            volatility=200.0,
            games_played=0,
            last_updated=datetime.utcnow(),
            confidence_interval=350.0
        )
    
    def calculate_k_factor(self, games_played: int, volatility: float) -> float:
        """
        Adaptive K-factor: higher for new/volatile players.
        Decreases as player establishes skill level.
        """
        games_factor = self.K_FACTOR_BASE * np.exp(-games_played / 30.0)
        volatility_factor = volatility / 200.0
        return max(self.K_FACTOR_MIN, games_factor * volatility_factor)
    
    def expected_score(self, rating_a: float, rating_b: float) -> float:
        """Expected score in ELO system."""
        return 1.0 / (1.0 + 10.0 ** ((rating_b - rating_a) / 400.0))
    
    def update_rating(
        self,
        current: SkillRating,
        actual_score: float,
        opponent_rating: float,
        domain_scores: Optional[Dict[str, float]] = None
    ) -> SkillRating:
        """
        Update rating after game completion.
        
        Args:
            current: Current skill rating
            actual_score: Normalized game performance [0.0, 1.0]
            opponent_rating: Difficulty rating of the run
            domain_scores: Optional domain-specific performance metrics
        
        Returns:
            Updated skill rating
        """
        expected = self.expected_score(current.overall_rating, opponent_rating)
        k_factor = self.calculate_k_factor(current.games_played, current.volatility)
        
        # Update overall rating
        rating_delta = k_factor * (actual_score - expected)
        new_overall = current.overall_rating + rating_delta
        
        # Update domain-specific ratings
        new_domains = {}
        if domain_scores:
            for domain, score in domain_scores.items():
                current_domain = getattr(current, domain, self.BASE_RATING)
                domain_expected = self.expected_score(current_domain, opponent_rating)
                domain_delta = k_factor * (score - domain_expected)
                new_domains[domain] = current_domain + domain_delta
        
        # Update volatility (decays over time, spikes on surprising results)
        surprise_factor = abs(actual_score - expected)
        new_volatility = current.volatility * self.VOLATILITY_DECAY
        new_volatility += surprise_factor * 50.0
        new_volatility = np.clip(new_volatility, 50.0, 300.0)
        
        # Confidence interval narrows with more games
        confidence = 350.0 / np.sqrt(current.games_played + 1)
        
        return SkillRating(
            contestant_id=current.contestant_id,
            overall_rating=new_overall,
            risk_assessment=new_domains.get('risk_assessment', current.risk_assessment),
            resource_allocation=new_domains.get('resource_allocation', current.resource_allocation),
            timing_optimization=new_domains.get('timing_optimization', current.timing_optimization),
            portfolio_construction=new_domains.get('portfolio_construction', current.portfolio_construction),
            crisis_response=new_domains.get('crisis_response', current.crisis_response),
            volatility=new_volatility,
            games_played=current.games_played + 1,
            last_updated=datetime.utcnow(),
            confidence_interval=confidence
        )
    
    def calculate_matchmaking_range(self, rating: SkillRating) -> Tuple[float, float]:
        """
        Calculate acceptable opponent rating range for balanced matchmaking.
        Wider range for new players, narrower for established players.
        """
        bandwidth = rating.volatility + rating.confidence_interval
        return (
            rating.overall_rating - bandwidth,
            rating.overall_rating + bandwidth
        )
    
    def estimate_win_probability(self, player: SkillRating, difficulty: float) -> float:
        """Estimate probability of successful run completion."""
        return self.expected_score(player.overall_rating, difficulty)
    
    def get_skill_percentile(self, rating: float, all_ratings: List[float]) -> float:
        """Calculate percentile rank among all players."""
        if not all_ratings:
            return 50.0
        return (sum(1 for r in all_ratings if r < rating) / len(all_ratings)) * 100.0
    
    def save_rating_history(self, rating: SkillRating) -> None:
        """Track rating progression over time."""
        if rating.contestant_id not in self.rating_history:
            self.rating_history[rating.contestant_id] = []
        self.rating_history[rating.contestant_id].append(rating)
    
    def get_rating_trend(self, contestant_id: str, games: int = 10) -> Optional[float]:
        """
        Calculate rating trend (positive = improving, negative = declining).
        Returns slope of linear regression over last N games.
        """
        if contestant_id not in self.rating_history:
            return None
        
        history = self.rating_history[contestant_id][-games:]
        if len(history) < 2:
            return None
        
        x = np.arange(len(history))
        y = np.array([r.overall_rating for r in history])
        slope = np.polyfit(x, y, 1)[0]
        return slope
