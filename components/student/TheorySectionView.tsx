import type { TheorySection } from "../../lib/lesson-schema";
import { SpeechButton } from "./SpeechButton";

type TheorySectionViewProps = {
  section: TheorySection;
  speech: { supported: boolean; enabled: boolean; speak: (text: string) => Promise<boolean> };
};

/** One "Kiến thức cần biết" screen: paragraphs, word cards, a table, a tip. */
export function TheorySectionView({ section, speech }: TheorySectionViewProps) {
  return (
    <article className="theory" aria-labelledby={`theory-${section.id}`}>
      <h2 id={`theory-${section.id}`} className="theory-title">{section.title}</h2>
      {section.body?.map((paragraph, i) => (
        <p key={i} className="theory-p">{paragraph}</p>
      ))}

      {section.items && section.items.length > 0 && (
        <ul className="term-grid">
          {section.items.map((item, i) => (
            <li key={`${item.term}-${i}`} className="term-card">
              <p className="term" lang="en">{item.term}</p>
              {item.meaning && <p><span className="term-label">Nghĩa:</span> {item.meaning}</p>}
              {item.usage && <p><span className="term-label">Dùng khi:</span> {item.usage}</p>}
              {item.example && (
                <div className="term-example">
                  <p lang="en" className="example-en">{item.example}</p>
                  {item.exampleMeaning && <p className="muted">{item.exampleMeaning}</p>}
                  <SpeechButton text={item.example} label="Nghe ví dụ" {...speech} />
                </div>
              )}
              {item.note && <p className="term-note">{item.note}</p>}
            </li>
          ))}
        </ul>
      )}

      {section.table && (
        <div className="table-wrap theory-table" role="region" aria-label={section.title}>
          <table className="table">
            <thead>
              <tr>{section.table.headers.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) =>
                    c === 0 ? <th key={c} scope="row" lang="en">{cell}</th> : <td key={c}>{cell}</td>,
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.tip && (
        <div className="tip">
          <p className="tip-label"><span aria-hidden="true">💡</span> Mẹo nhớ</p>
          <p className="tip-text">{section.tip}</p>
        </div>
      )}
    </article>
  );
}
