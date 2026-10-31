import {
  type Project,
  newProject,
  newSection,
  newChapter,
  uid,
} from "./domain";
export type PlanningMode = "outline" | "guide" | "world" | "questions";
export type Workbook = NonNullable<Project["workbook"]>;
type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  stages: [string, string, string][];
};
export const projectTemplates: ProjectTemplate[] = [
  {
    id: "hero",
    name: "Hero’s journey",
    description:
      "A character leaves the familiar, faces a cost, and returns changed.",
    stages: [
      [
        "The familiar world",
        "What does your hero want, and what are they afraid to lose?",
        "What belief keeps them from changing?",
      ],
      [
        "The invitation",
        "What event makes staying the same impossible?",
        "Why does your hero hesitate to answer the call?",
      ],
      [
        "Help and departure",
        "Who offers guidance, and what can they not do for the hero?",
        "What choice takes the hero beyond the familiar world?",
      ],
      [
        "Tests and allies",
        "Which tests expose the hero’s blind spots?",
        "Who earns trust, and who exploits it?",
      ],
      [
        "The approach",
        "What must the hero risk before facing their greatest fear?",
        "What is the plan, and what is missing from it?",
      ],
      [
        "The ordeal",
        "What loss or confrontation breaks the hero’s old approach?",
        "What new understanding becomes possible afterward?",
      ],
      [
        "The return",
        "What makes bringing the reward home difficult?",
        "How does a final choice prove the hero has changed?",
      ],
      [
        "A changed world",
        "What does the hero bring back that others need?",
        "What familiar image will now mean something different?",
      ],
    ],
  },
  {
    id: "scifi",
    name: "Science fiction",
    description: "Explore a speculative change through its human consequences.",
    stages: [
      [
        "The speculative premise",
        "What scientific or technological change makes this world different?",
        "What can this change never do, and what does using it cost?",
      ],
      [
        "Life in the future",
        "How has this change affected an ordinary day?",
        "Who benefits from the system, and who is excluded?",
      ],
      [
        "The disruption",
        "What discovery or failure threatens the current order?",
        "Why is your protagonist personally involved?",
      ],
      [
        "The investigation",
        "What does the protagonist initially misunderstand?",
        "Which experiment, encounter, or journey challenges that belief?",
      ],
      [
        "The consequences",
        "What unintended effect makes the original solution dangerous?",
        "Which relationship turns the abstract stakes into a personal cost?",
      ],
      [
        "The choice",
        "What trade-off cannot be solved by better technology?",
        "What future does the protagonist choose to make possible?",
      ],
    ],
  },
  {
    id: "mystery",
    name: "Mystery",
    description: "Build a fair trail of evidence, suspicion, and revelation.",
    stages: [
      [
        "The central puzzle",
        "What happened, and what explanation initially seems obvious?",
        "What is the truth that the investigator does not yet know?",
      ],
      [
        "The investigator",
        "Why must this person solve the mystery?",
        "Which personal assumption will lead them astray?",
      ],
      [
        "The suspects",
        "Who had motive, means, and opportunity?",
        "What secret does each suspect protect besides the central crime?",
      ],
      [
        "The evidence",
        "Which real clue will readers see before understanding it?",
        "Which misleading clue has a truthful explanation?",
      ],
      [
        "The reversal",
        "What new fact overturns the leading theory?",
        "What does pursuing the truth now cost the investigator?",
      ],
      [
        "The reveal",
        "How do the established clues support the final explanation?",
        "What consequence remains after the puzzle is solved?",
      ],
    ],
  },
  {
    id: "selfhelp",
    name: "Self-help",
    description: "Move from a reader’s problem to practical, testable change.",
    stages: [
      [
        "The reader’s question",
        "Who is struggling, and how would they describe their problem?",
        "What realistic change can this book help them make?",
      ],
      [
        "The current pattern",
        "What keeps the reader stuck despite their effort?",
        "What evidence or experience supports your explanation?",
      ],
      [
        "A useful reframe",
        "What assumption would the reader benefit from questioning?",
        "Where does your advice apply, and where might it fail?",
      ],
      [
        "The first action",
        "What small action can a reader try today?",
        "How will they notice whether it helps?",
      ],
      [
        "Obstacles and alternatives",
        "What predictable obstacle might stop progress?",
        "What alternative fits a reader with different circumstances?",
      ],
      [
        "Sustaining change",
        "How can readers adapt the practice over time?",
        "What reflection will help them choose their next step?",
      ],
    ],
  },
  {
    id: "fantasy",
    name: "Fantasy",
    description:
      "Connect the rules of an imagined world to character and conflict.",
    stages: [
      [
        "The world’s promise",
        "What wonder makes this world worth entering?",
        "What limits or costs keep its power from solving every problem?",
      ],
      [
        "Power and belonging",
        "Who controls power, and how is that control justified?",
        "Where does the protagonist belong, and where are they an outsider?",
      ],
      [
        "The fracture",
        "What event exposes a weakness in the world’s order?",
        "What personal need pulls the protagonist into it?",
      ],
      [
        "The journey",
        "Which unfamiliar place changes the protagonist’s understanding?",
        "What does an ally want that conflicts with the protagonist’s goal?",
      ],
      [
        "The price",
        "What must be sacrificed to use power responsibly?",
        "What tempting shortcut would repeat the original injustice?",
      ],
      [
        "The new order",
        "How does the final choice follow the world’s established rules?",
        "What changes for ordinary people afterward?",
      ],
    ],
  },
  {
    id: "memoir",
    name: "Memoir",
    description: "Shape lived experience around a meaningful question.",
    stages: [
      [
        "The thread",
        "What question about your life draws these memories together?",
        "Why does this story matter to you now?",
      ],
      [
        "Before the change",
        "What did you believe before the central experience?",
        "Which concrete scene shows that belief in action?",
      ],
      [
        "The turning point",
        "What event disrupted the story you told yourself?",
        "What did you understand then, and what do you understand now?",
      ],
      [
        "Living through it",
        "Which choices reveal the tension you were living with?",
        "Where is your memory uncertain or another perspective important?",
      ],
      [
        "Making meaning",
        "What changed in your relationships or sense of self?",
        "What remains unresolved?",
      ],
      [
        "An open ending",
        "Which final scene carries the meaning without explaining everything?",
        "What question might the reader take into their own life?",
      ],
    ],
  },
];
export const worldCategories: Record<string, string[]> = {
  "Places & geography": [
    "What does this place make possible or difficult?",
    "How do climate, distance, and resources shape everyday life?",
  ],
  "People & cultures": [
    "What do people value, celebrate, or consider taboo?",
    "How do different people within this culture disagree?",
  ],
  "History & conflict": [
    "Which past event still shapes present choices?",
    "Whose version of history is missing from the official account?",
  ],
  "Power & institutions": [
    "Who makes the rules, and who can challenge them?",
    "What does authority promise, and what does it demand?",
  ],
  "Technology & magic": [
    "What are the rules, limits, and costs?",
    "Who can access this power, and how does it change society?",
  ],
  "Daily life & economy": [
    "How do people earn a living, travel, eat, and care for each other?",
    "What scarce resource creates a meaningful choice?",
  ],
  "Language & beliefs": [
    "What stories or beliefs help people explain their world?",
    "Which words, names, or rituals reveal what matters to them?",
  ],
};
export function workbook(p: Project): Workbook {
  return (p.workbook ||= {
    templateId: "",
    prompts: [],
    world: [],
    questions: [],
  });
}
export function addGuide(p: Project, templateId: string) {
  const template = projectTemplates.find((t) => t.id === templateId);
  if (!template) return;
  const book = workbook(p);
  book.templateId = template.id;
  for (const [category, ...questions] of template.stages)
    for (const question of questions) {
      if (!book.prompts.some((q) => q.question === question))
        book.prompts.push({
          id: uid(),
          category,
          question,
          answer: "",
          include: false,
        });
    }
}
export function projectFromTemplate(
  name: string,
  description: string,
  templateId: string,
) {
  const p = newProject(name, description);
  const template = projectTemplates.find((t) => t.id === templateId);
  if (!template) return p;
  const section = newSection(template.name);
  p.sections = [section];
  p.chapters = template.stages.map(([title]) => newChapter(section.id, title));
  addGuide(p, templateId);
  return p;
}

// Local linguistic patterns generate hypotheses, not claims about author intent.
export function suggestQuestions(input: string): string[] {
  const text = input
    .trim()
    .replace(/^[“"‘']+|[”"’']+$/g, "")
    .replace(/[.!]+$/, "");
  if (!text) return [];
  const clause = text.split(/[.!]\s+/)[0].replace(/[.!]+$/, "");
  const lower = (s: string) =>
    /^[A-Z][a-z]+\s/.test(s) || /^[A-Z][a-z]+$/.test(s)
      ? s[0].toLowerCase() + s.slice(1)
      : s;
  const results: string[] = [];
  let m: RegExpMatchArray | null;
  if (
    (m = text.match(/^you (?:do not|don't) need (.+?)[.!]\s*you need (.+)$/i))
  ) {
    results.push(
      `What do I need instead of ${lower(m[1])}?`,
      `How could ${lower(m[2])} help me more than ${lower(m[1])}?`,
    );
  }
  if ((m = clause.match(/^(.+?) matters? more than (.+)$/i))) {
    results.push(
      `Why does ${lower(m[1])} matter more than ${lower(m[2])}?`,
      `Should I focus on ${lower(m[1])} or ${lower(m[2])}?`,
    );
  }
  if ((m = clause.match(/^the best way to (.+?) is (.+)$/i)))
    results.push(
      `How can I ${m[1]}?`,
      `Why might ${lower(m[2])} be a useful approach?`,
    );
  if (
    (m = clause.match(
      /^(.+?) (builds|reduces|creates|improves|changes|reveals|protects|prevents) (.+)$/i,
    ))
  )
    results.push(
      `How can ${lower(m[1])} ${m[2].toLowerCase().replace(/s$/, "")} ${m[3]}?`,
      `What else could ${m[2].toLowerCase().replace(/s$/, "")} ${m[3]}?`,
    );
  if (
    (m = clause.match(
      /^(.+?) (is|are|can|will|should) (.+?)(?: because (.+))?$/i,
    ))
  ) {
    results.push(
      `${m[4] ? "Why" : "How"} ${m[2].toLowerCase()} ${lower(m[1])} ${m[3]}?`,
    );
    if (m[2].toLowerCase() === "is")
      results.push(`What does ${lower(m[1])} mean in practice?`);
  }
  if (text.endsWith("?")) results.unshift(text);
  const excerpt = clause.length > 160 ? clause.slice(0, 157) + "…" : clause;
  results.push(
    `What problem could “${excerpt}” help someone understand?`,
    `When might “${excerpt}” be true, and when might it fail?`,
    `What other answers could address the same underlying need?`,
  );
  return [...new Set(results)].slice(0, 8);
}
