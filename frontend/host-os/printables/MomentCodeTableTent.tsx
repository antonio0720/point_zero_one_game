/**
 * MomentCodeTableTent.tsx
 * Foldable table tent — 2 panels (left: moment codes, right: pace lines + consent line), print-optimized, A5 landscape when folded
 */

type MomentCode = {
  id: number;
  code: string;
  name: string;
  description?: string;
}

type PaceLine = {
  id: number;
  momentId: number;
  line: string;
}

type ConsentLine = {
  id: number;
  text: string;
}

interface Props {
  moments: MomentCode[];
  paceLines: PaceLine[];
  consentLine: ConsentLine;
}

const MomentCodeTableTent: React.FC<Props> = ({ moments, paceLines, consentLine }) => {
  // Implement the component here
  // ...

  return (
    <div className="a5-landscape">
      {/* Left panel - moment codes */}
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {moments.map((moment) => (
            <tr key={moment.id}>
              <td>{moment.code}</td>
              <td>{moment.name}</td>
              <td>{moment.description || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Right panel - pace lines + consent line */}
      <div>
        {paceLines.map((line) => (
          <p key={line.id}>{line.line}</p>
        ))}
        <p>{consentLine.text}</p>
      </div>
    </div>
  );
};

export default MomentCodeTableTent;
