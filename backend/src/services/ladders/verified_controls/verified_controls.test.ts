import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VerifiedControlsService } from '../../verified_controls';
import { Ladder, ControlState, PendingControl, VerifiedControl } from '../../../models';

let service: VerifiedControlsService;
let ladder: Ladder;

beforeEach(() => {
  ladder = new Ladder();
  service = new VerifiedControlsService(ladder);
});

afterEach(() => {
  // Reset the ladder after each test to ensure deterministic behavior
  ladder.controls.clear();
});

describe('VerifiedControlsService', () => {
  describe('publish', () => {
    it('should publish a pending control to verified state when all checks pass', () => {
      const pendingControl = new PendingControl('controlId', 'controlName');
      ladder.controls.add(pendingControl);

      service.publish(pendingControl.id);

      expect(ladder.controls.get(pendingControl.id)?.state).toEqual(ControlState.Verified);
    });

    it('should not publish a control if it is already verified', () => {
      const verifiedControl = new VerifiedControl('controlId', 'controlName');
      ladder.controls.add(verifiedControl);

      service.publish(verifiedControl.id);

      expect(ladder.controls.get(verifiedControl.id)?.state).toEqual(ControlState.Verified);
    });
  });

  describe('quarantine', () => {
    it('should quarantine a verified control when all checks fail', () => {
      const verifiedControl = new VerifiedControl('controlId', 'controlName');
      ladder.controls.add(verifiedControl);

      service.quarantine(verifiedControl.id);

      expect(ladder.controls.get(verifiedControl.id)?.state).toEqual(ControlState.Quarantined);
    });

    it('should not quarantine a control if it is already quarantined', () => {
      const quarantinedControl = new Control({ id: 'controlId', state: ControlState.Quarantined });
      ladder.controls.add(quarantinedControl);

      service.quarantine(quarantinedControl.id);

      expect(ladder.controls.get(quarantinedControl.id)?.state).toEqual(ControlState.Quarantined);
    });
  });
});
