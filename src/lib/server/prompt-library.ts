import { readFile } from "fs/promises";
import path from "path";

export type PromptSuggestion = {
  title: string;
  prompt: string;
};

export async function loadImagePromptSuggestions(): Promise<PromptSuggestion[]> {
  try {
    const promptFile = await readFile(path.join(process.cwd(), "prompts"), "utf8");
    return parsePromptSuggestions(promptFile);
  } catch {
    return [];
  }
}

function parsePromptSuggestions(source: string): PromptSuggestion[] {
  const entries: PromptSuggestion[] = [];
  const entryPattern = /^\s*\d+\.\s+\*\*(.+?)\*\*\s*\r?\n([\s\S]*?)(?=^\s*\d+\.\s+\*\*|\s*$)/gm;

  for (const match of source.matchAll(entryPattern)) {
    const title = match[1]?.trim();
    const prompt = match[2]?.replace(/\s+/g, " ").trim();
    if (title && prompt) {
      entries.push({ title, prompt });
    }
  }

  return entries;
}
