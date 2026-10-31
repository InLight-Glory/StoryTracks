import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Compass,
  HelpCircle,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { assertEditable, newNode, type Project, uid } from "./domain";
import {
  addGuide,
  type PlanningMode,
  projectTemplates,
  suggestQuestions,
  workbook,
  worldCategories,
} from "./planning";
type Props = {
  project: Project;
  mode: Exclude<PlanningMode, "outline">;
  selection: string;
  select: (id: string) => void;
  change: (fn: (p: Project) => void) => void;
};
export const planningTitles = {
  outline: "Story outline",
  guide: "Project guide",
  world: "World building",
  questions: "Questions",
};
export function PlanningNavigation({
  project,
  mode,
  selection,
  select,
}: Omit<Props, "change">) {
  const book = project.workbook;
  const groups =
    mode === "guide"
      ? [...new Set(book?.prompts.map((p) => p.category) || [])]
      : Object.keys(worldCategories);
  return (
    <div className="planning-nav">
      <p>
        {mode === "guide"
          ? "Answer one question at a time. Let the shape of your book emerge."
          : mode === "world"
            ? "A home for the places, cultures, and rules behind your book."
            : "Start with an answer. Discover the questions hiding beneath it."}
      </p>
      {mode === "questions" ? (
        <>
          <div className="eyebrow">STATEMENTS & QUOTES</div>
          {book?.questions.map((q) => (
            <button
              key={q.id}
              className={selection === q.id ? "active" : ""}
              onClick={() => select(q.id)}
            >
              <HelpCircle size={14} />
              <span>
                {q.statement.trim().slice(0, 70) || "Untitled question study"}
              </span>
            </button>
          ))}
          {!book?.questions.length && (
            <small>Your question studies will appear here.</small>
          )}
        </>
      ) : (
        <>
          <button
            className={!selection ? "active" : ""}
            onClick={() => select("")}
          >
            <BookOpen size={14} />
            <span>All {mode === "guide" ? "questions" : "world entries"}</span>
          </button>
          {groups.map((category) => (
            <button
              key={category}
              className={selection === category ? "active" : ""}
              onClick={() => select(category)}
            >
              <Compass size={14} />
              <span>{category}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
export default function PlanningWorkspace({
  project,
  mode,
  selection,
  select,
  change,
  chapterId,
  openOutline,
  openNavigation,
}: Props & {
  chapterId: string;
  openOutline: () => void;
  openNavigation: () => void;
}) {
  const [templateId, setTemplateId] = useState("hero");
  const [targetChapter, setTargetChapter] = useState("");
  const [message, setMessage] = useState("");
  const book = project.workbook;
  const addToOutline = (title: string, text: string) => {
    change((p) => {
      const chapter = p.chapters.find(
        (c) => c.id === (targetChapter || chapterId),
      );
      if (!chapter) throw new Error("Choose a chapter for this answer.");
      assertEditable(p, chapter);
      p.nodes.push(newNode(chapter.id, title, text));
    });
  };
  const addQuestion = () => {
    const id = uid();
    change((p) =>
      workbook(p).questions.push({
        id,
        statement: "",
        source: "",
        candidates: [],
        question: "",
        insight: "",
        alternatives: "",
        audience: "",
        hook: "",
        include: false,
      }),
    );
    select(id);
  };
  const q =
    book?.questions.find((q) => q.id === selection) || book?.questions[0];
  const updateQuestion = (
    key:
      | "statement"
      | "source"
      | "question"
      | "insight"
      | "alternatives"
      | "audience"
      | "hook",
    value: string,
  ) =>
    change((p) => {
      workbook(p).questions.find((x) => x.id === q!.id)![key] = value;
    });
  return (
    <div className="planning-workspace">
      <div className="planning-toolbar">
        <button className="text-button" onClick={openNavigation}>
          Browse workspace
        </button>
        <button className="text-button" onClick={openOutline}>
          Back to canvas <ArrowRight size={14} />
        </button>
      </div>
      <div className="planning-content">
        <div className="eyebrow">
          {mode === "guide"
            ? "A LITTLE DIRECTION"
            : mode === "world"
              ? "BEYOND THE PAGE"
              : "FOLLOW THE QUESTION"}
        </div>
        <h1>
          {mode === "questions"
            ? "What was the question?"
            : planningTitles[mode]}
        </h1>
        <p className="planning-intro">
          {mode === "guide"
            ? "Build your book by answering thoughtful prompts. Your answers stay editable, and you choose what becomes part of the outline."
            : mode === "world"
              ? "Build a consistent world, one detail at a time. Use the prompts as starting points and keep the details that serve your story."
              : "A statement is one possible answer. Work backward to the need behind it, explore other answers, and find a question your readers recognize."}
        </p>
        {mode !== "world" && (
          <label className="planning-target">
            Send answers to
            <select
              aria-label="Outline destination"
              value={targetChapter || chapterId}
              onChange={(e) => setTargetChapter(e.target.value)}
            >
              {project.chapters
                .filter((c) => !c.trashed)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
            </select>
          </label>
        )}
        {message && (
          <p className="planning-notice" role="status">
            {message}
          </p>
        )}
        {mode === "guide" && (
          <>
            <div className="planning-template-picker">
              <label>
                Choose a project guide
                <select
                  aria-label="Project guide"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  {projectTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                onClick={() => {
                  change((p) => addGuide(p, templateId));
                  select("");
                  setMessage(
                    "Guide prompts added. Existing answers and outline content are preserved.",
                  );
                }}
              >
                <Plus size={14} />
                Add guide prompts
              </button>
            </div>
            <div className="planning-progress">
              {book?.prompts.filter((q) => q.answer.trim()).length || 0} of{" "}
              {book?.prompts.length || 0} questions answered
            </div>
            {!book?.prompts.length && (
              <div className="planning-empty">
                <BookOpen size={30} />
                <h2>Choose a starting point.</h2>
                <p>
                  Hero’s journey, science fiction, mystery, self-help, fantasy,
                  or memoir. You can combine guides without replacing your work.
                </p>
              </div>
            )}
            {book?.prompts
              .filter((q) => !selection || q.category === selection)
              .map((prompt, i) => (
                <section className="planning-card" key={prompt.id}>
                  <div className="eyebrow">
                    {String(i + 1).padStart(2, "0")} / {prompt.category}
                  </div>
                  <h2>{prompt.question}</h2>
                  <textarea
                    aria-label={prompt.question}
                    placeholder="Your answer can begin with a single thought…"
                    value={prompt.answer}
                    onChange={(e) =>
                      change((p) => {
                        workbook(p).prompts.find(
                          (q) => q.id === prompt.id,
                        )!.answer = e.target.value;
                      })
                    }
                  />
                  <div className="planning-card-footer">
                    <label>
                      <input
                        type="checkbox"
                        checked={prompt.include}
                        onChange={(e) =>
                          change((p) => {
                            workbook(p).prompts.find(
                              (q) => q.id === prompt.id,
                            )!.include = e.target.checked;
                          })
                        }
                      />
                      Include in publication
                    </label>
                    <button
                      className="text-button"
                      disabled={!prompt.answer.trim()}
                      onClick={() =>
                        addToOutline(prompt.question, prompt.answer)
                      }
                    >
                      Add answer to outline <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
              ))}
          </>
        )}
        {mode === "world" && (
          <>
            <div className="planning-world-prompt">
              <span className="eyebrow">QUESTIONS TO EXPLORE</span>
              {(
                worldCategories[selection] || [
                  "What makes this world different, and how does that affect the people in it?",
                  "Which details create opportunities or constraints for your story?",
                ]
              ).map((prompt) => (
                <p key={prompt}>{prompt}</p>
              ))}
            </div>
            <button
              className="primary"
              onClick={() =>
                change((p) =>
                  workbook(p).world.push({
                    id: uid(),
                    category: selection || Object.keys(worldCategories)[0],
                    title: "",
                    description: "",
                    include: false,
                  }),
                )
              }
            >
              <Plus size={15} />
              Add world entry
            </button>
            {!book?.world.length && (
              <div className="planning-empty">
                <Compass size={30} />
                <h2>A world waiting to be discovered.</h2>
                <p>
                  Places, cultures, history, power, technology, everyday life,
                  and beliefs. Start wherever your story needs depth.
                </p>
              </div>
            )}
            {book?.world
              .filter((entry) => !selection || entry.category === selection)
              .map((entry, i) => (
                <section className="planning-card" key={entry.id}>
                  <div className="planning-row">
                    <select
                      aria-label={`World entry ${i + 1} category`}
                      value={entry.category}
                      onChange={(e) =>
                        change((p) => {
                          workbook(p).world.find(
                            (w) => w.id === entry.id,
                          )!.category = e.target.value;
                        })
                      }
                    >
                      {Object.keys(worldCategories).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      className="icon-button"
                      aria-label={`Remove world entry ${i + 1}`}
                      onClick={() =>
                        change((p) => {
                          workbook(p).world = workbook(p).world.filter(
                            (w) => w.id !== entry.id,
                          );
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <input
                    className="planning-title-input"
                    aria-label={`World entry ${i + 1} title`}
                    placeholder="Name this part of your world…"
                    value={entry.title}
                    onChange={(e) =>
                      change((p) => {
                        workbook(p).world.find(
                          (w) => w.id === entry.id,
                        )!.title = e.target.value;
                      })
                    }
                  />
                  <textarea
                    aria-label={`World entry ${i + 1} details`}
                    placeholder="Describe its rules, history, contradictions, and connections to the story…"
                    value={entry.description}
                    onChange={(e) =>
                      change((p) => {
                        workbook(p).world.find(
                          (w) => w.id === entry.id,
                        )!.description = e.target.value;
                      })
                    }
                  />
                  <div className="planning-card-footer">
                    <label>
                      <input
                        type="checkbox"
                        checked={entry.include}
                        onChange={(e) =>
                          change((p) => {
                            workbook(p).world.find(
                              (w) => w.id === entry.id,
                            )!.include = e.target.checked;
                          })
                        }
                      />
                      Include in publication
                    </label>
                    <small>Saved with this project</small>
                  </div>
                </section>
              ))}
          </>
        )}
        {mode === "questions" && (
          <>
            <button className="primary" onClick={addQuestion}>
              <Plus size={15} />
              New question study
            </button>
            {!q ? (
              <div className="planning-empty">
                <HelpCircle size={30} />
                <h2>“Consistency matters more than intensity.”</h2>
                <p>
                  What question might that answer? “Should I focus on
                  consistency or intensity?” Different questions can open
                  different paths.
                </p>
                <button className="text-button" onClick={addQuestion}>
                  Explore your own statement <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <section className="planning-card question-study" key={q.id}>
                <div className="planning-row">
                  <span className="eyebrow">01 / START WITH AN ANSWER</span>
                  <button
                    className="icon-button"
                    aria-label="Remove question study"
                    onClick={() => {
                      change((p) => {
                        workbook(p).questions = workbook(p).questions.filter(
                          (x) => x.id !== q.id,
                        );
                      });
                      select("");
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <label>
                  Statement or quote
                  <textarea
                    aria-label="Statement or quote"
                    placeholder="Paste the statement you want to understand…"
                    value={q.statement}
                    onChange={(e) =>
                      updateQuestion("statement", e.target.value)
                    }
                  />
                </label>
                <label>
                  Source / attribution
                  <input
                    aria-label="Source or attribution"
                    placeholder="Who said it? Where did it come from?"
                    value={q.source}
                    onChange={(e) => updateQuestion("source", e.target.value)}
                  />
                </label>
                <button
                  className="button"
                  disabled={!q.statement.trim()}
                  onClick={() =>
                    change((p) => {
                      const entry = workbook(p).questions.find(
                        (x) => x.id === q.id,
                      )!;
                      entry.candidates = suggestQuestions(entry.statement);
                    })
                  }
                >
                  <Sparkles size={14} />
                  Find possible questions
                </button>
                <p className="small-note">
                  Offline question starters, not a claim about the author’s
                  intent. Choose what fits, then rewrite it in your own words.
                </p>
                <div className="question-candidates">
                  {q.candidates.map((candidate, i) => (
                    <button
                      key={i}
                      className={candidate === q.question ? "selected" : ""}
                      onClick={() => updateQuestion("question", candidate)}
                    >
                      <HelpCircle size={15} />
                      <span>{candidate}</span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
                <span className="eyebrow">02 / EXPLORE THE NEED</span>
                <label>
                  The question beneath the statement
                  <textarea
                    aria-label="Underlying question"
                    placeholder="What is someone really trying to understand or solve?"
                    value={q.question}
                    onChange={(e) => updateQuestion("question", e.target.value)}
                  />
                </label>
                <label>
                  Insight & assumptions
                  <textarea
                    aria-label="Question insight"
                    placeholder="Why does this answer resonate? What does it assume? When might it not apply?"
                    value={q.insight}
                    onChange={(e) => updateQuestion("insight", e.target.value)}
                  />
                </label>
                <label>
                  Other possible answers
                  <textarea
                    aria-label="Alternative answers"
                    placeholder="List other explanations, approaches, counterexamples, or stories that answer the same question."
                    value={q.alternatives}
                    onChange={(e) =>
                      updateQuestion("alternatives", e.target.value)
                    }
                  />
                </label>
                <span className="eyebrow">03 / FIND YOUR READERS</span>
                <label>
                  Who shares this question?
                  <textarea
                    aria-label="Question audience"
                    placeholder="Describe the people, situation, or frustration behind the question."
                    value={q.audience}
                    onChange={(e) => updateQuestion("audience", e.target.value)}
                  />
                </label>
                <label>
                  Marketing hook
                  <textarea
                    aria-label="Marketing hook"
                    placeholder="Invite readers with a clear question they recognize. Keep the promise honest."
                    value={q.hook}
                    onChange={(e) => updateQuestion("hook", e.target.value)}
                  />
                </label>
                <button
                  className="text-button"
                  disabled={!q.question.trim()}
                  onClick={() => updateQuestion("hook", q.question)}
                >
                  Use question as hook
                </button>
                <div className="planning-card-footer">
                  <label>
                    <input
                      type="checkbox"
                      checked={q.include}
                      onChange={(e) =>
                        change((p) => {
                          workbook(p).questions.find(
                            (x) => x.id === q.id,
                          )!.include = e.target.checked;
                        })
                      }
                    />
                    Include study in publication
                  </label>
                  <button
                    className="text-button"
                    disabled={!q.question.trim()}
                    onClick={() =>
                      addToOutline(
                        q.question,
                        [
                          q.statement,
                          q.source ? `Source: ${q.source}` : "",
                          q.insight,
                          q.alternatives,
                        ]
                          .filter(Boolean)
                          .join("\n\n"),
                      )
                    }
                  >
                    Add question to outline <ArrowRight size={14} />
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
