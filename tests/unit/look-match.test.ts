import { describe, expect, it } from "vitest";
import { matchLines, unionBox, type GroundedLine } from "@/lib/look/match";

const L = (n: number, text: string, y: number): GroundedLine => ({ n, text, box: [50, y, 800, y + 20] });
const letter: GroundedLine[] = [
  L(1, "Warszawa, dnia 22.10.2026 r.", 50),
  L(2, "MAZOWIECKI URZĄD WOJEWÓDZKI W WARSZAWIE", 80),
  L(3, "Znak sprawy: WSC-II-S.6151.48213.2026", 160),
  L(4, "1. przedłożenie aktualnego zaświadczenia z uczelni o kontynuacji studiów,", 440),
  L(5, "2. przedłożenie dokumentu potwierdzającego posiadanie ubezpieczenia zdrowotnego,", 465),
  L(6, "3. przedłożenie dowodu uiszczenia opłaty skarbowej w wysokości 340 zł.", 490),
  L(7, "w terminie 14 dni od dnia doręczenia niniejszego wezwania, pod rygorem", 530),
  L(8, "pozostawienia wniosku bez rozpoznania.", 555),
];

describe("matchLines", () => {
  it("matches a single line by its verbatim text", () => {
    expect(matchLines("Znak sprawy: WSC-II-S.6151.48213.2026", letter)?.map((l) => l.n)).toEqual([3]);
  });

  it("matches a sentence that wraps over two lines", () => {
    const run = matchLines("w terminie 14 dni od dnia doręczenia niniejszego wezwania, pod rygorem pozostawienia wniosku bez rozpoznania.", letter)!;
    expect(run.map((l) => l.n)).toEqual([7, 8]);
  });

  it("does not pull in the neighbouring list item", () => {
    expect(matchLines("2. przedłożenie dokumentu potwierdzającego posiadanie ubezpieczenia zdrowotnego", letter)?.map((l) => l.n)).toEqual([5]);
  });

  it("tolerates one misread character between the two transcriptions", () => {
    expect(matchLines("Warszawa, dnia 22.10.2026 r.", [L(1, "Warszawa, dnia 22.10.2O26 r.", 10), ...letter.slice(1)])?.map((l) => l.n)).toEqual([1]);
    expect(matchLines("przedłozenie aktualnego zaświadczenia", letter)?.map((l) => l.n)).toEqual([4]);
  });

  it("returns null when nothing resembles the text or there are no lines", () => {
    expect(matchLines("Opłata skarbowa została uiszczona w kasie", letter)).toBeNull();
    expect(matchLines("anything", [])).toBeNull();
    expect(matchLines("   ", letter)).toBeNull();
  });
});

describe("unionBox", () => {
  it("spans every box", () => {
    expect(unionBox([[10, 20, 30, 40], [5, 25, 50, 35]])).toEqual([5, 20, 50, 40]);
  });
});

describe("matchLines on a grid layout", () => {
  // Kiosk: spark transcribes row by row (A B C, then titles, then captions); a button is three lines far apart in the list.
  const box = (x1: number, y1: number, x2: number, y2: number): [number, number, number, number] => [x1, y1, x2, y2];
  const kiosk: GroundedLine[] = [
    { n: 1, text: "A", box: box(175, 160, 215, 200) },
    { n: 2, text: "B", box: box(480, 160, 520, 200) },
    { n: 3, text: "C", box: box(790, 160, 830, 200) },
    { n: 4, text: "Złożenie wniosku", box: box(106, 211, 277, 229) },
    { n: 5, text: "Odciski palców", box: box(425, 211, 577, 229) },
    { n: 6, text: "Odbiór karty pobytu", box: box(708, 211, 907, 229) },
    { n: 7, text: "Application filing", box: box(143, 233, 243, 246) },
    { n: 8, text: "Fingerprints", box: box(463, 233, 537, 246) },
  ];

  it("gathers the letter, title and caption of one button and nothing from its neighbours", () => {
    expect(matchLines("A Złożenie wniosku Application filing", kiosk)?.map((l) => l.n)).toEqual([1, 4, 7]);
    expect(matchLines("B Odciski palców Fingerprints", kiosk)?.map((l) => l.n)).toEqual([2, 5, 8]);
  });
});
