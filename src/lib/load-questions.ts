import { promises as fs } from "fs";
import path from "path";
import { parseQuestionFile } from "./question-schema";
import type { Question } from "./types";

export interface LoadedQuestion {
  file: string; // filename without .json, used as route slug
  question: Question;
}

export interface LoadError {
  file: string;
  error: string;
}

const DEFAULT_DIR = path.join(process.cwd(), "questions");

export async function loadAllQuestions(
  dir: string = DEFAULT_DIR
): Promise<{ questions: LoadedQuestion[]; errors: LoadError[] }> {
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return { questions: [], errors: [] };
  }

  const questions: LoadedQuestion[] = [];
  const errors: LoadError[] = [];

  for (const f of files) {
    const slug = f.replace(/\.json$/, "");
    try {
      const raw = await fs.readFile(path.join(dir, f), "utf8");
      const parsed = parseQuestionFile(JSON.parse(raw));
      questions.push({ file: slug, question: parsed });
    } catch (e) {
      errors.push({
        file: slug,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { questions, errors };
}

export async function loadQuestion(
  slug: string,
  dir: string = DEFAULT_DIR
): Promise<Question | null> {
  const { questions } = await loadAllQuestions(dir);
  return questions.find((q) => q.file === slug)?.question ?? null;
}
