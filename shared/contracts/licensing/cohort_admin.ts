/**
 * CohortAdmin Contracts
 */

/**
 * Represents a Cohort in the game.
 */
export interface Cohort {
  id: number;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a Roster for a specific Cohort.
 */
export interface Roster {
  cohortId: number;
  playerIds: number[];
}

/**
 * Represents an Assignment for a specific Cohort.
 */
export interface Assignment {
  cohortId: number;
  packId?: number;
  benchmarkId?: number;
}

/**
 * Represents a Schedule Window for a specific Cohort.
 */
export interface ScheduleWindow {
  cohortId: number;
  startTime: Date;
  endTime: Date;
}

/**
 * Represents Role Permissions for a specific User in the system.
 */
export interface RolePermissions {
  userId: number;
  canCreateCohorts: boolean;
  canUpdateCohorts: boolean;
  canImportRosters: boolean;
  canAssignPacks: boolean;
  canAssignBenchmarks: boolean;
  canManageScheduleWindows: boolean;
}

/**
 * Represents a User with their associated Role Permissions.
 */
export interface User {
  id: number;
  username: string;
  passwordHash: string; // Securely hashed password
  rolePermissions: RolePermissions;
}
