import type { VocabularyItem } from "../../lib/lesson-schema";
import { SpeechButton } from "./SpeechButton";

type VocabularyCardProps = {
  item: VocabularyItem;
  supported: boolean;
  enabled: boolean;
  speak: (text: string) => Promise<boolean>;
};

export function VocabularyCard({ item, supported, enabled, speak }: VocabularyCardProps) {
  return (
    <li className="vocab-card">
      <p className="vocab-word" lang="en">{item.word}</p>
      {item.ipa && <p className="vocab-ipa">{item.ipa}</p>}
      <p className="vocab-meaning">{item.meaning}</p>
      {item.example && <p className="vocab-example" lang="en">{item.example}</p>}
      <SpeechButton text={item.speak ?? item.word} supported={supported} enabled={enabled} speak={speak} />
    </li>
  );
}
