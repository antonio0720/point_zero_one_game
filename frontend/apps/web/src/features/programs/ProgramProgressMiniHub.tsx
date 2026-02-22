/**
 * ProgramProgressMiniHub component for displaying weekly plan, next assignment, and streak in Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type WeeklyPlan = {
  id: number;
  weekNumber: number;
  assignments: Assignment[];
};

type Assignment = {
  id: number;
  title: string;
  description: string;
  reward: number;
};

type Streak = {
  currentStreak: number;
  bestStreak: number;
};

interface ProgramProgressMiniHubProps {
  weeklyPlan: WeeklyPlan | null;
  nextAssignment: Assignment | null;
  streak: Streak;
}

const ProgramProgressMiniHub: React.FC<ProgramProgressMiniHubProps> = ({
  weeklyPlan,
  nextAssignment,
  streak,
}) => {
  // Component implementation goes here
};

export default ProgramProgressMiniHub;
