/**
 * Share page component for proof pages in Point Zero One Digital's financial roguelike game.
 * Displays either VERIFIED stamp or PENDING watermark based on the verification status of the provided proof hash.
 */

type ProofStatus = 'VERIFIED' | 'PENDING';

interface Props {
  proofHash: string;
  proofStatus: ProofStatus;
}

const Page: React.FC<Props> = ({ proofHash, proofStatus }) => {
  return (
    <div>
      {proofStatus === 'VERIFIED' ? (
        <div className="verified-stamp">VERIFIED</div>
      ) : (
        <div className="pending-watermark">PENDING</div>
      )}
      <a href={`/explorer/${proofHash}`}>View on Explorer</a>
    </div>
  );
};

export default Page;
