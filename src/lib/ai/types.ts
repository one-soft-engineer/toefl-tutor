export interface EvaluateInput {
  word: string;
  meaning?: string;
  sentence: string;
}

export interface Feedback {
  ok: boolean; // target word used correctly and naturally
  rewrite: string; // a more natural version of the learner's sentence
  tip: string; // one key collocation / register / grammar note
}

export interface SentenceEvaluator {
  evaluate(input: EvaluateInput): Promise<Feedback>;
}
