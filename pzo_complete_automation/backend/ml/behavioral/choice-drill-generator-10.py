"""
Choice Drill Generator - ML Behavioral Personalization
Generates personalized financial decision-making drills targeting player weaknesses.
Adaptive difficulty scaling based on skill rating and performance history.
"""

from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timedelta
import random
import numpy as np


class DrillType(Enum):
    """Categories of financial decision drills."""
    RISK_ASSESSMENT = "risk_assessment"
    PORTFOLIO_ALLOCATION = "portfolio_allocation"
    TIMING_OPTIMIZATION = "timing_optimization"
    CRISIS_RESPONSE = "crisis_response"
    OPPORTUNITY_RECOGNITION = "opportunity_recognition"
    RESOURCE_MANAGEMENT = "resource_management"


class DifficultyLevel(Enum):
    """Drill difficulty tiers."""
    NOVICE = 1
    INTERMEDIATE = 2
    ADVANCED = 3
    EXPERT = 4
    MASTER = 5


@dataclass
class DrillParameters:
    """Configuration for generated drill."""
    drill_type: DrillType
    difficulty: DifficultyLevel
    time_limit_seconds: int
    decision_points: int
    success_threshold: float
    reward_multiplier: float
    skill_focus: List[str]


@dataclass
class DrillScenario:
    """Generated financial scenario for practice."""
    scenario_id: str
    drill_type: DrillType
    difficulty: DifficultyLevel
    
    # Scenario setup
    starting_capital: float
    available_assets: List[Dict]
    market_conditions: Dict
    time_horizon: int
    
    # Decision points
    choices: List[Dict]
    optimal_path: List[int]
    suboptimal_paths: List[List[int]]
    
    # Learning objectives
    target_skills: List[str]
    common_mistakes: List[str]
    teaching_hints: List[str]
    
    # Evaluation
    success_criteria: Dict
    partial_credit_rules: List[Dict]
    
    created_at: datetime


@dataclass
class DrillPerformance:
    """Results from completed drill."""
    contestant_id: str
    scenario_id: str
    completed_at: datetime
    
    decisions_made: List[int]
    time_elapsed: float
    
    score: float
    skill_scores: Dict[str, float]
    mistakes_made: List[str]
    optimal_decisions: int
    suboptimal_decisions: int
    
    improvement_areas: List[str]
    mastery_level: float


class ChoiceDrillGenerator:
    """
    Generates personalized financial decision drills.
    Adapts difficulty based on player skill profile and targets weaknesses.
    """
    
    def __init__(self, seed: Optional[int] = None):
        self.rng = random.Random(seed)
        self.scenario_templates: Dict[DrillType, List[Dict]] = {}
        self.difficulty_curves: Dict[str, Dict] = {}
    
    def generate_drill(
        self,
        contestant_id: str,
        skill_profile: Dict[str, float],
        target_duration: int = 180,
        focus_weakness: bool = True
    ) -> DrillScenario:
        """
        Generate personalized drill scenario.
        
        Args:
            contestant_id: Player identifier
            skill_profile: Current skill ratings by domain
            target_duration: Desired drill length in seconds
            focus_weakness: Whether to target weakest skills
        
        Returns:
            Generated drill scenario
        """
        # Identify target skill
        if focus_weakness:
            target_skill = min(skill_profile.items(), key=lambda x: x[1])[0]
        else:
            target_skill = self.rng.choice(list(skill_profile.keys()))
        
        # Map skill to drill type
        drill_type = self._map_skill_to_drill_type(target_skill)
        
        # Calculate appropriate difficulty
        difficulty = self._calculate_difficulty(skill_profile[target_skill])
        
        # Generate scenario parameters
        params = self._create_drill_parameters(
            drill_type,
            difficulty,
            target_duration
        )
        
        # Generate scenario
        return self._generate_scenario(
            drill_type,
            params,
            target_skill,
            skill_profile
        )
    
    def _map_skill_to_drill_type(self, skill_name: str) -> DrillType:
        """Map skill domain to appropriate drill type."""
        mapping = {
            'risk_assessment': DrillType.RISK_ASSESSMENT,
            'resource_allocation': DrillType.PORTFOLIO_ALLOCATION,
            'timing_optimization': DrillType.TIMING_OPTIMIZATION,
            'portfolio_construction': DrillType.PORTFOLIO_ALLOCATION,
            'crisis_response': DrillType.CRISIS_RESPONSE
        }
        return mapping.get(skill_name, DrillType.OPPORTUNITY_RECOGNITION)
    
    def _calculate_difficulty(self, skill_rating: float) -> DifficultyLevel:
        """Convert skill rating to difficulty level."""
        if skill_rating < 1200:
            return DifficultyLevel.NOVICE
        elif skill_rating < 1400:
            return DifficultyLevel.INTERMEDIATE
        elif skill_rating < 1600:
            return DifficultyLevel.ADVANCED
        elif skill_rating < 1800:
            return DifficultyLevel.EXPERT
        else:
            return DifficultyLevel.MASTER
    
    def _create_drill_parameters(
        self,
        drill_type: DrillType,
        difficulty: DifficultyLevel,
        target_duration: int
    ) -> DrillParameters:
        """Create drill configuration."""
        base_decisions = {
            DifficultyLevel.NOVICE: 3,
            DifficultyLevel.INTERMEDIATE: 5,
            DifficultyLevel.ADVANCED: 7,
            DifficultyLevel.EXPERT: 9,
            DifficultyLevel.MASTER: 12
        }
        
        return DrillParameters(
            drill_type=drill_type,
            difficulty=difficulty,
            time_limit_seconds=target_duration,
            decision_points=base_decisions[difficulty],
            success_threshold=0.7,
            reward_multiplier=difficulty.value * 0.5,
            skill_focus=[drill_type.value]
        )
    
    def _generate_scenario(
        self,
        drill_type: DrillType,
        params: DrillParameters,
        target_skill: str,
        skill_profile: Dict[str, float]
    ) -> DrillScenario:
        """Generate actual drill scenario."""
        scenario_id = f"drill_{drill_type.value}_{int(datetime.utcnow().timestamp())}"
        
        # Generate market conditions based on difficulty
        volatility = 0.1 + (params.difficulty.value * 0.05)
        market_conditions = {
            'volatility': volatility,
            'trend': self.rng.choice(['bullish', 'bearish', 'sideways']),
            'liquidity': 'normal',
            'sentiment': self.rng.uniform(-0.5, 0.5)
        }
        
        # Generate asset pool
        num_assets = 5 + params.difficulty.value
        assets = self._generate_asset_pool(num_assets, market_conditions)
        
        # Create decision tree
        choices, optimal_path, suboptimal = self._generate_decision_tree(
            drill_type,
            params,
            assets,
            market_conditions
        )
        
        return DrillScenario(
            scenario_id=scenario_id,
            drill_type=drill_type,
            difficulty=params.difficulty,
            starting_capital=10000.0 * params.difficulty.value,
            available_assets=assets,
            market_conditions=market_conditions,
            time_horizon=params.time_limit_seconds,
            choices=choices,
            optimal_path=optimal_path,
            suboptimal_paths=suboptimal,
            target_skills=[target_skill],
            common_mistakes=self._get_common_mistakes(drill_type, params.difficulty),
            teaching_hints=self._get_teaching_hints(drill_type, params.difficulty),
            success_criteria={
                'min_score': params.success_threshold,
                'max_time': params.time_limit_seconds,
                'min_optimal_decisions': int(params.decision_points * 0.7)
            },
            partial_credit_rules=[
                {'condition': 'time_bonus', 'multiplier': 1.2},
                {'condition': 'risk_management', 'multiplier': 1.1},
                {'condition': 'diversification', 'multiplier': 1.15}
            ],
            created_at=datetime.utcnow()
        )
    
    def _generate_asset_pool(
        self,
        num_assets: int,
        market_conditions: Dict
    ) -> List[Dict]:
        """Generate pool of available financial assets."""
        assets = []
        asset_types = ['equity', 'bond', 'commodity', 'currency', 'derivative']
        
        for i in range(num_assets):
            asset_type = self.rng.choice(asset_types)
            volatility_mult = 1.0 + market_conditions['volatility']
            
            asset = {
                'id': f"asset_{i}",
                'type': asset_type,
                'price': self.rng.uniform(10, 1000),
                'expected_return': self.rng.uniform(-0.2, 0.3),
                'volatility': self.rng.uniform(0.05, 0.4) * volatility_mult,
                'liquidity': self.rng.choice(['high', 'medium', 'low']),
                'sector': self.rng.choice(['tech', 'finance', 'energy', 'healthcare']),
                'correlation_group': i % 3
            }
            assets.append(asset)
        
        return assets
    
    def _generate_decision_tree(
        self,
        drill_type: DrillType,
        params: DrillParameters,
        assets: List[Dict],
        market_conditions: Dict
    ) -> Tuple[List[Dict], List[int], List[List[int]]]:
        """Generate decision tree with optimal and suboptimal paths."""
        choices = []
        optimal_path = []
        suboptimal_paths = []
        
        for step in range(params.decision_points):
            # Generate 3-5 choices per decision point
            num_options = self.rng.randint(3, 5)
            options = []
            
            for opt_idx in range(num_options):
                option = {
                    'id': opt_idx,
                    'description': f"Option {opt_idx + 1}",
                    'allocations': self._generate_allocation(assets),
                    'expected_outcome': self._simulate_outcome(
                        self._generate_allocation(assets),
                        assets,
                        market_conditions
                    ),
                    'risk_level': self.rng.choice(['low', 'medium', 'high'])
                }
                options.append(option)
            
            # Identify optimal choice
            optimal_idx = max(range(num_options), 
                            key=lambda i: options[i]['expected_outcome']['score'])
            optimal_path.append(optimal_idx)
            
            choices.append({
                'step': step,
                'options': options,
                'context': self._generate_context(drill_type, step, market_conditions)
            })
        
        # Generate some suboptimal but valid paths
        for _ in range(2):
            suboptimal = [self.rng.randint(0, len(c['options'])-1) 
                         for c in choices]
            suboptimal_paths.append(suboptimal)
        
        return choices, optimal_path, suboptimal_paths
    
    def _generate_allocation(self, assets: List[Dict]) -> Dict[str, float]:
        """Generate random asset allocation."""
        allocation = {}
        remaining = 1.0
        
        for asset in assets[:-1]:
            if remaining <= 0:
                break
            weight = self.rng.uniform(0, remaining)
            allocation[asset['id']] = weight
            remaining -= weight
        
        if assets and remaining > 0:
            allocation[assets[-1]['id']] = remaining
        
        return allocation
    
    def _simulate_outcome(
        self,
        allocation: Dict[str, float],
        assets: List[Dict],
        market_conditions: Dict
    ) -> Dict:
        """Simulate outcome of allocation decision."""
        portfolio_return = 0.0
        portfolio_risk = 0.0
        
        for asset_id, weight in allocation.items():
            asset = next(a for a in assets if a['id'] == asset_id)
            portfolio_return += weight * asset['expected_return']
            portfolio_risk += weight * asset['volatility']
        
        sharpe = portfolio_return / max(portfolio_risk, 0.01)
        
        return {
            'score': sharpe * 100,
            'return': portfolio_return,
            'risk': portfolio_risk,
            'sharpe': sharpe
        }
    
    def _generate_context(
        self,
        drill_type: DrillType,
        step: int,
        market_conditions: Dict
    ) -> str:
        """Generate contextual flavor text for decision."""
        contexts = [
            f"Market volatility: {market_conditions['volatility']:.1%}",
            f"Current trend: {market_conditions['trend']}",
            f"Decision point {step + 1}: Choose allocation strategy"
        ]
        return " | ".join(contexts)
    
    def _get_common_mistakes(
        self,
        drill_type: DrillType,
        difficulty: DifficultyLevel
    ) -> List[str]:
        """Get common mistakes for this drill type."""
        mistakes = {
            DrillType.RISK_ASSESSMENT: [
                "Overestimating risk tolerance",
                "Ignoring correlation risk",
                "Underestimating tail risk"
            ],
            DrillType.PORTFOLIO_ALLOCATION: [
                "Over-concentration in single sector",
                "Poor diversification",
                "Ignoring rebalancing needs"
            ],
            DrillType.TIMING_OPTIMIZATION: [
                "Timing the market",
                "Holding losers too long",
                "Selling winners too early"
            ]
        }
        return mistakes.get(drill_type, ["Common strategic error"])
    
    def _get_teaching_hints(
        self,
        drill_type: DrillType,
        difficulty: DifficultyLevel
    ) -> List[str]:
        """Get teaching hints for this drill."""
        hints = {
            DrillType.RISK_ASSESSMENT: [
                "Consider worst-case scenarios",
                "Evaluate risk-adjusted returns",
                "Check correlation between assets"
            ],
            DrillType.PORTFOLIO_ALLOCATION: [
                "Aim for diversification",
                "Balance risk and return",
                "Consider time horizon"
            ]
        }
        return hints.get(drill_type, ["Think strategically"])
    
    def evaluate_performance(
        self,
        scenario: DrillScenario,
        decisions: List[int],
        time_elapsed: float
    ) -> DrillPerformance:
        """Evaluate drill performance and generate feedback."""
        optimal_count = sum(1 for d, opt in zip(decisions, scenario.optimal_path) 
                          if d == opt)
        
        base_score = optimal_count / len(scenario.optimal_path)
        
        # Time bonus
        if time_elapsed < scenario.time_horizon * 0.8:
            base_score *= 1.1
        
        # Identify mistakes
        mistakes = []
        for i, (d, opt) in enumerate(zip(decisions, scenario.optimal_path)):
            if d != opt:
                mistakes.append(f"Step {i+1}: Suboptimal choice")
        
        return DrillPerformance(
            contestant_id="",
            scenario_id=scenario.scenario_id,
            completed_at=datetime.utcnow(),
            decisions_made=decisions,
            time_elapsed=time_elapsed,
            score=min(base_score, 1.0),
            skill_scores={skill: base_score for skill in scenario.target_skills},
            mistakes_made=mistakes,
            optimal_decisions=optimal_count,
            suboptimal_decisions=len(decisions) - optimal_count,
            improvement_areas=scenario.target_skills if base_score < 0.7 else [],
            mastery_level=base_score
        )
