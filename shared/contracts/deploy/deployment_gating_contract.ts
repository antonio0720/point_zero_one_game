/**
 * Deployment Gating Contract
 */

declare module "@pointzeroonedigital/contracts" {
  namespace deploy {
    interface FeatureGate {
      id: string;
      name: string;
      description: string;
      enabledByDefault: boolean;
    }

    interface RolloutStage {
      id: string;
      name: string;
      percentage: number;
      startTime: Date;
      endTime?: Date;
    }

    interface KillSwitch {
      id: string;
      featureGateId: string;
      enabled: boolean;
    }

    interface CanaryCohort {
      id: string;
      playerId: string;
      rolloutStageId: string;
      isCanary: boolean;
    }

    interface DeploymentReceipt {
      id: string;
      featureGateId: string;
      rolloutStageId?: string;
      killSwitchId?: string;
      canaryCohortIds?: string[];
      who: string; // Developer or team responsible for the deployment
      what: string; // Description of the change being deployed
      when: Date; // Timestamp of the deployment
      why: string; // Reason for the deployment
    }
  }
}
