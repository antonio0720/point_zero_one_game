/**
 * RunOfShowPrint.tsx
 * A TypeScript React component for a printable 1-page run-of-show, adhering to the specified rules.
 */

declare namespace JSX {
  interface IntrinsicElements {
    'div': any;
    'h1': any;
    'h2': any;
    'p': any;
    'span': any;
  }
}

type RunOfShowBlock = {
  title: string;
  time: string;
  content: JSX.Element[];
};

type DebriefPrompt = JSX.Element;

type RunOfShowPrintProps = {
  runOfShowBlocks: RunOfShowBlock[];
  debriefPrompts: DebriefPrompt[];
};

/**
 * RunOfShowPrint component
 */
const RunOfShowPrint: React.FC<RunOfShowPrintProps> = ({ runOfShowBlocks, debriefPrompts }) => {
  return (
    <div>
      {/* Title */}
      <h1>Point Zero One Digital - 90min Run-of-Show</h1>

      {/* Run-of-show blocks */}
      {runOfShowBlocks.map((block, index) => (
        <div key={index}>
          <h2 style={{ color: 'yellow' }}>{block.title}</h2>
          <p>{block.time}</p>
          <div>{block.content}</div>
        </div>
      ))}

      {/* Debrief prompts */}
      <div>
        <h2>Debrief Prompts</h2>
        {debriefPrompts.map((prompt, index) => (
          <span key={index}>{prompt}</span>
        ))}
      </div>

      {/* Close script */}
      <p>Thank you for participating! Please find the close script at the bottom of this page.</p>
    </div>
  );
};

export default RunOfShowPrint;
