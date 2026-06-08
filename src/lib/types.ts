export interface Blank {
  index: number;
  shown: string; // leading letters shown to the user
  answer: string; // full correct word, American spelling
  hint?: string;
}

export interface Question {
  topic: string;
  source: string;
  passage: string;
  blanks: Blank[];
}

// One user-typed answer per blank, plus correctness after grading.
export interface BlankAnswer {
  index: number;
  typed: string; // letters the user typed (the missing part)
  correct: boolean;
}
