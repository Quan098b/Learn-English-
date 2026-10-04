import type { VocabularyItem } from "../../lib/lesson-schema";
import { SpeechButton } from "./SpeechButton";

type VocabularyCardProps = {
  item: VocabularyItem;
  supported: boolean;
  enabled: boolean;
  speak: (text: string) => Promise<boolean>;
};

/** Word, IPA, meaning, when to use it, an example — each with 🔊. */
export function VocabularyCard({ item, supported, enabled, speak }: VocabularyCardProps) {
  return (
    <li className="vocab-card">
      <p className="vocab-word" lang="en">{item.word}</p>
      {item.ipa && <p className="vocab-ipa">{item.ipa}</p>}
      <p className="vocab-meaning">
        <span className="term-label">Nghĩa:</span> {item.meaning}
      </p>
      {item.usage && (
        <p className="vocab-usage">
          <span className="term-label">Dùng cho:</span> {item.usage}
        </p>
      )}
      <SpeechButton text={item.speak ?? item.word} label="Nghe từ" supported={supported} enabled={enabled} speak={speak} />
      {item.example && (
        <div className="vocab-example-box">
          <p className="vocab-example" lang="en">{item.example}</p>
          {item.exampleMeaning && <p className="muted small">{item.exampleMeaning}</p>}
          <SpeechButton text={item.example} label="Nghe ví dụ" supported={supported} enabled={enabled} speak={speak} />
        </div>
      )}
    </li>
  );
}
