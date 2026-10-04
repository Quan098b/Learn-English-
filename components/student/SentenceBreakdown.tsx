import type { SentencePart } from "../../lib/lesson-schema";

/** "I = tôi = chủ ngữ · am = động từ to be · a student = một học sinh". */
export function SentenceBreakdown({ parts }: { parts: SentencePart[] }) {
  if (parts.length === 0) return null;
  return (
    <dl className="breakdown" aria-label="Phân tích câu">
      {parts.map((part, i) => (
        <div key={i} className="breakdown-part">
          <dt lang="en">{part.text}</dt>
          {part.meaning && <dd>= {part.meaning}</dd>}
          {part.role && <dd className="breakdown-role">{part.role}</dd>}
        </div>
      ))}
    </dl>
  );
}
