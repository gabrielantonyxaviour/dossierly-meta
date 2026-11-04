/*
 * The labelled "test official" kit for Counter: Polish lines spoken by a synthetic ElevenLabs voice and fed through the
 * real pipeline (microphone path → Meta ASR → Spark), for judges without a Polish speaker at hand.
 */
export const TEST_OFFICIAL_LINES = [
  "Dzień dobry. Poproszę paszport i numer sprawy.",
  "Czy ma Pan ubezpieczenie zdrowotne na cały okres pobytu?",
  "Dziękuję. A teraz umowę najmu, proszę.",
  "Umowa najmu kończy się w grudniu. Potrzebny jest aneks przedłużający najem. Proszę go dostarczyć w ciągu czternastu dni.",
  "Dobrze. Odciski palców pobierzemy w czwartek, dwunastego listopada, o dziesiątej czterdzieści.",
] as const;
