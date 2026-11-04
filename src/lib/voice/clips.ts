/*
 * The labelled test kit for Counter: the window-7 scene (lease, address mismatch, KPA art. 41) spoken by synthetic
 * ElevenLabs voices and fed through the real pipeline (microphone path → Meta ASR → Spark), for judges without a
 * Polish speaker at hand. Official lines are attributed to the official; the reply goes through as the user's speech.
 */
export interface TestLine {
  who: "official" | "user";
  text: string;
}

/** Bump when the lines change: clip responses are cached by URL in the browser for a day. */
export const TEST_LINES_VERSION = 2;

export const TEST_LINES: readonly TestLine[] = [
  { who: "official", text: "Umowa najmu?" },
  { who: "official", text: "Moment... Tu jest inny adres niż we wniosku. Dlaczego?" },
  { who: "user", text: "I moved out of the dorm on the first of October. I'd like to update my address today." },
  { who: "official", text: "Dobrze. Mało kto o tym pamięta. Proszę to złożyć na piśmie. Najlepiej dziś." },
  { who: "official", text: "Dobrze. Teraz odciski." },
];
