/**
 * WhenSomethingLooksWrong section for Point Zero One Digital's financial roguelike game.
 * This component handles verification states, quarantine, appeals/report link.
 */

type VerificationState = 'verified' | 'quarantined' | 'appeal';

interface Appeal {
  reason: string;
  timestamp: Date;
}

interface Report {
  id: number;
  verificationState: VerificationState;
  quarantineTimestamp?: Date;
  appeal?: Appeal;
}

type Props = {
  report: Report;
};

const WhenSomethingLooksWrong: React.FC<Props> = ({ report }) => {
  // Component implementation here
};

export { VerificationState, Appeal, Report, WhenSomethingLooksWrong };
