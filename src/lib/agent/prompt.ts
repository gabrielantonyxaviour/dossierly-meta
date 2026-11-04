/** Prompt helpers for the in-Worker agent run. */
export const LANGUAGE_NAMES = { en: "English", uk: "Ukrainian", ru: "Russian", hi: "Hindi", ta: "Tamil", zh: "Chinese", ja: "Japanese", vi: "Vietnamese" } as const;

export function fillPrompt(template: string, language: keyof typeof LANGUAGE_NAMES): string {
  return template.replaceAll("{{LANGUAGE}}", LANGUAGE_NAMES[language] ?? "English");
}

/** The JSON-only tail appended whenever a model (not a tool-using agent) answers directly. */
export const DIRECT_ANSWER_NOTE =
  "The sections named above are given inline below under their labels. You cannot edit anything here: only produce the final JSON answer.";
