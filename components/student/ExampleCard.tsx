import type { LessonExample } from "../../lib/lesson-schema";
import { SentenceBreakdown } from "./SentenceBreakdown";
import { SpeechButton } from "./SpeechButton";

type ExampleCardProps = {
  example: LessonExample;
  index: number;
  speech: { supported: boolean; enabled: boolean; speak: (text: string) => Promise<boolean> };
};

/** "VÍ DỤ 1 — Lan is a girl. She is my friend. — Lan → người nữ → She". */
export function ExampleCard({ example, index, speech }: ExampleCardProps) {
  const spoken = example.speak ?? [example.context, example.sentence].filter(Boolean).join(" ");
  return (
    <li className="example-card">
      <p className="lesson-kicker">Ví dụ {index + 1}</p>
      <div lang="en" className="example-text">
        {example.context && <p className="example-context">{example.context}</p>}
        <p className="example-sentence">{example.sentence}</p>
      </div>
      {example.meaning && <p className="example-meaning">{example.meaning}</p>}
      <SpeechButton text={spoken} label="Nghe câu" {...speech} />
      {example.steps && example.steps.length > 0 && (
        <div className="example-why">
          <p className="explain-label">Giải thích</p>
          <ol className="arrow-steps">
            {example.steps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>
      )}
      {example.breakdown && <SentenceBreakdown parts={example.breakdown} />}
    </li>
  );
}
