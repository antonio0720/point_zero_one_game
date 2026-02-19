"""
Playstyle Clustering Contract - ML Behavioral Personalization
Defines clustering interface for identifying distinct financial decision-making archetypes.
Uses DBSCAN + hierarchical clustering to discover player personas.
"""

from typing import List, Dict, Optional, Protocol
from dataclasses import dataclass
from enum import Enum
import numpy as np


class RiskProfile(Enum):
    """Risk tolerance archetypes."""
    ULTRA_CONSERVATIVE = "ultra_conservative"
    CONSERVATIVE = "conservative"
    BALANCED = "balanced"
    AGGRESSIVE = "aggressive"
    ULTRA_AGGRESSIVE = "ultra_aggressive"


class DecisionTempo(Enum):
    """Decision-making speed patterns."""
    DELIBERATE = "deliberate"  # Slow, analytical
    MEASURED = "measured"      # Normal pace
    RAPID = "rapid"            # Fast decisions
    IMPULSIVE = "impulsive"    # Very fast, minimal analysis


class StrategyPreference(Enum):
    """Core financial strategy archetypes."""
    VALUE_INVESTOR = "value_investor"
    GROWTH_SEEKER = "growth_seeker"
    MOMENTUM_TRADER = "momentum_trader"
    CONTRARIAN = "contrarian"
    DIVERSIFIER = "diversifier"
    SPECIALIST = "specialist"


@dataclass
class PlaystyleVector:
    """Behavioral feature vector for clustering."""
    contestant_id: str
    
    # Risk dimensions
    avg_position_size: float
    volatility_tolerance: float
    leverage_usage: float
    stop_loss_discipline: float
    
    # Decision patterns
    decisions_per_minute: float
    analysis_depth_score: float
    information_consumption: float
    
    # Strategic patterns
    portfolio_concentration: float
    sector_specialization: float
    rebalancing_frequency: float
    
    # Behavioral tendencies
    loss_aversion: float
    gain_chasing: float
    herding_tendency: float
    contrarian_tendency: float
    
    # Temporal patterns
    consistency_score: float
    adaptability_score: float
    learning_rate: float


@dataclass
class PlaystyleCluster:
    """Identified player archetype cluster."""
    cluster_id: int
    label: str
    centroid: PlaystyleVector
    member_count: int
    risk_profile: RiskProfile
    decision_tempo: DecisionTempo
    strategy_preference: StrategyPreference
    avg_performance: float
    cohesion_score: float


class PlaystyleClusteringProtocol(Protocol):
    """
    Contract for playstyle clustering implementations.
    Defines interface for behavioral segmentation algorithms.
    """
    
    def extract_features(
        self,
        contestant_id: str,
        game_history: List[Dict],
        window_size: int = 10
    ) -> PlaystyleVector:
        """
        Extract behavioral features from game history.
        
        Args:
            contestant_id: Player identifier
            game_history: List of completed runs with decision data
            window_size: Number of recent games to analyze
        
        Returns:
            Feature vector representing playstyle
        """
        ...
    
    def fit_clusters(
        self,
        feature_vectors: List[PlaystyleVector],
        min_cluster_size: int = 50,
        eps: float = 0.3
    ) -> List[PlaystyleCluster]:
        """
        Discover clusters in playstyle feature space.
        
        Args:
            feature_vectors: Player behavioral vectors
            min_cluster_size: Minimum cluster size (DBSCAN)
            eps: Maximum distance between cluster members
        
        Returns:
            Identified playstyle clusters
        """
        ...
    
    def assign_cluster(
        self,
        vector: PlaystyleVector,
        clusters: List[PlaystyleCluster]
    ) -> Optional[PlaystyleCluster]:
        """
        Assign player to nearest cluster.
        
        Args:
            vector: Player's behavioral vector
            clusters: Available clusters
        
        Returns:
            Best-matching cluster or None if outlier
        """
        ...
    
    def get_cluster_recommendations(
        self,
        cluster: PlaystyleCluster,
        content_catalog: Dict[str, any]
    ) -> List[str]:
        """
        Generate personalized content recommendations for cluster.
        
        Args:
            cluster: Target playstyle cluster
            content_catalog: Available opportunities/challenges
        
        Returns:
            Recommended content IDs prioritized for this archetype
        """
        ...
    
    def calculate_cluster_similarity(
        self,
        cluster_a: PlaystyleCluster,
        cluster_b: PlaystyleCluster
    ) -> float:
        """
        Measure similarity between two clusters.
        
        Args:
            cluster_a: First cluster
            cluster_b: Second cluster
        
        Returns:
            Similarity score [0.0, 1.0]
        """
        ...
    
    def evolve_clusters(
        self,
        current_clusters: List[PlaystyleCluster],
        new_vectors: List[PlaystyleVector],
        drift_threshold: float = 0.15
    ) -> List[PlaystyleCluster]:
        """
        Update clusters as player behavior evolves.
        Handles concept drift and cluster merging/splitting.
        
        Args:
            current_clusters: Existing cluster definitions
            new_vectors: Recent player behavioral data
            drift_threshold: Maximum centroid movement before re-clustering
        
        Returns:
            Updated cluster definitions
        """
        ...
    
    def get_outliers(
        self,
        vectors: List[PlaystyleVector],
        clusters: List[PlaystyleCluster],
        threshold: float = 0.5
    ) -> List[PlaystyleVector]:
        """
        Identify players with unique playstyles (outliers).
        
        Args:
            vectors: All player vectors
            clusters: Current cluster definitions
            threshold: Minimum distance to be considered outlier
        
        Returns:
            Player vectors that don't fit existing clusters
        """
        ...
    
    def get_cluster_metrics(
        self,
        cluster: PlaystyleCluster,
        vectors: List[PlaystyleVector]
    ) -> Dict[str, float]:
        """
        Calculate cluster quality metrics.
        
        Args:
            cluster: Target cluster
            vectors: Member vectors
        
        Returns:
            Metrics: cohesion, separation, silhouette_score, etc.
        """
        ...
    
    def predict_cluster_migration(
        self,
        contestant_id: str,
        current_cluster: PlaystyleCluster,
        trend_vector: PlaystyleVector,
        all_clusters: List[PlaystyleCluster]
    ) -> Optional[PlaystyleCluster]:
        """
        Predict if player is migrating to different archetype.
        
        Args:
            contestant_id: Player ID
            current_cluster: Current cluster assignment
            trend_vector: Direction of behavioral change
            all_clusters: All available clusters
        
        Returns:
            Likely destination cluster if migrating, None otherwise
        """
        ...
    
    def generate_cluster_report(
        self,
        clusters: List[PlaystyleCluster]
    ) -> Dict[str, any]:
        """
        Generate human-readable cluster analysis report.
        
        Args:
            clusters: All identified clusters
        
        Returns:
            Report with cluster characteristics, distributions, insights
        """
        ...


class ClusteringConstraints:
    """Validation constraints for clustering operations."""
    
    MIN_GAMES_FOR_CLUSTERING = 5
    MAX_CLUSTERS = 50
    MIN_CLUSTER_COHESION = 0.6
    MAX_OUTLIER_RATIO = 0.15
    RECLUSTERING_INTERVAL_DAYS = 7
    
    @staticmethod
    def validate_feature_vector(vector: PlaystyleVector) -> bool:
        """Ensure all features are within valid ranges."""
        return all([
            0.0 <= vector.avg_position_size <= 1.0,
            0.0 <= vector.volatility_tolerance <= 1.0,
            0.0 <= vector.leverage_usage <= 5.0,
            0.0 <= vector.stop_loss_discipline <= 1.0,
            0.0 <= vector.decisions_per_minute <= 10.0,
            0.0 <= vector.loss_aversion <= 1.0,
            0.0 <= vector.consistency_score <= 1.0
        ])
    
    @staticmethod
    def validate_cluster_quality(cluster: PlaystyleCluster) -> bool:
        """Ensure cluster meets quality thresholds."""
        return (
            cluster.member_count >= 10 and
            cluster.cohesion_score >= ClusteringConstraints.MIN_CLUSTER_COHESION
        )
