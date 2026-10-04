import type { QuestionOption } from "../../lib/lesson-schema";

type AnswerOptionProps = {
  option: QuestionOption;
  answered: boolean;
  isAnswer: boolean;
  isChosen: boolean;
  onSelect: (id: string) => void;
};

/** One answer button. Right/wrong is shown with an icon and text, not only colour. */
export function AnswerOption({ option, answered, isAnswer, isChosen, onSelect }: AnswerOptionProps) {
  let state = "";
  if (answered && isAnswer) state = "is-correct";
  else if (answered && isChosen) state = "is-wrong";
  return (
    <button
      type="button"
      className={`option ${state}`}
      onClick={() => onSelect(option.id)}
      disabled={answered}
      aria-pressed={isChosen}
    >
      <span className="option-letter" aria-hidden="true">{option.id}</span>
      <span className="option-text">{option.text}</span>
      {answered && isAnswer && (
        <span className="option-icon">
          <span aria-hidden="true">✓</span>
          <span className="sr-only">(đáp án đúng)</span>
        </span>
      )}
      {answered && isChosen && !isAnswer && (
        <span className="option-icon">
          <span aria-hidden="true">✗</span>
          <span className="sr-only">(bạn đã chọn)</span>
        </span>
      )}
    </button>
  );
}
