import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Map,
  PenLine,
  Settings2,
  Sparkles,
  StickyNote,
} from "lucide-react";
import "./tutorial.css";

export const tutorialStorageKey = "storytracks-tutorial-v1";
export function needsTutorial() {
  try {
    return !["skipped", "completed"].includes(
      localStorage.getItem(tutorialStorageKey) || "",
    );
  } catch {
    return true;
  }
}
export function rememberTutorial(outcome: "skipped" | "completed") {
  try {
    localStorage.setItem(tutorialStorageKey, outcome);
    return true;
  } catch {
    return false;
  }
}

const lessons = [
  {
    title: "A place for every part of your story",
    label: "Welcome",
    intro:
      "Learn the basics in seven short steps. Skip any time and come back through Settings → First-time tutorial.",
    points: [
      [
        "Start with a project",
        "My projects takes you to your library. Choose New project for your own book, or explore the sample story first.",
      ],
      [
        "Get your bearings",
        "The outline is on the left, your story is in the center, and The details inspector is on the right. Thoughts and commentary sit beside the story.",
      ],
    ],
    tip: "Try the panel controls in step 3 using a practice layout.",
  },
  {
    title: "Find your way through the book",
    label: "Navigation",
    intro:
      "Build a story from parts, chapters, and nodes. A node is one scene, beat, note, or other piece of your outline.",
    points: [
      [
        "Use the outline",
        "Select a chapter to work on it. Select a node to see its details, or use its eye button to bring it into view. The small arrows fold parts and chapters.",
      ],
      [
        "Change your perspective",
        "Switch between Chapter and Whole book in the canvas toolbar. Scroll to move, use the zoom controls, or hold Space and drag to pan.",
      ],
      [
        "Plan beyond the outline",
        "Use Project guide, World building, and Questions in the left panel to develop your ideas.",
      ],
    ],
    tip: "Use My projects at the top whenever you want to switch books.",
  },
  {
    title: "Make room to focus",
    label: "Collapsing areas",
    intro:
      "Keep the areas you need and tuck the rest away. Try the arrows in this practice view.",
    points: [
      [
        "Hide and reopen side panels",
        "Collapse outline and Collapse inspector hide the outer panels. Open outline and Open inspector in the canvas toolbar bring them back.",
      ],
      [
        "Fold the note areas",
        "The arrows on Sub-context and Highlight collapse each area into a narrow strip. Click that strip to expand it again.",
      ],
    ],
    tip: "Collapsing only changes your view. Your text and notes stay in the project. On smaller screens, the outer panels start closed.",
  },
  {
    title: "Give the book its direction",
    label: "Project metadata",
    intro:
      "Metadata is your writing guidance: who the book is for, how it sounds, and what you want it to achieve.",
    points: [
      [
        "Set the project defaults",
        "Open the right-hand inspector and choose Project. Enter your author name, genre, intended audience, style, tone, or writing instructions.",
      ],
      [
        "Adjust a chapter when needed",
        "Choose Chapter to override a field for that chapter. Fields marked Inherited use the project’s values.",
      ],
    ],
    tip: "Start with audience, tone, and writing instructions. You can fill in the rest as the book takes shape.",
  },
  {
    title: "Turn ideas into story nodes",
    label: "Writing",
    intro: "Nodes let you shape the book one manageable piece at a time.",
    points: [
      [
        "Add and edit",
        "Use Create your first node or Add the next moment below a chapter. Click a node’s title to rename it. Double-click its story text to edit, then choose Done.",
      ],
      [
        "Give each moment intention",
        "Select a node and use the Node tab in The details to set its importance, writing liberty, and transitions. Select text to reveal formatting options.",
      ],
      [
        "Keep or set aside",
        "Lock protects a node from editing. Suspend keeps it in the project but leaves it out of publication by default.",
      ],
    ],
    tip: "Changes autosave. Watch the status at the top, and use Undo if you want to reverse an edit.",
  },
  {
    title: "Keep the thinking beside the story",
    label: "Thoughts & commentary",
    intro: "Select a node to see the notes connected to that moment.",
    points: [
      [
        "Sub-context holds thoughts and feelings",
        "Use the left note area for motivation, emotion, or the meaning beneath a scene.",
      ],
      [
        "Highlight holds commentary",
        "Use the right note area for observations and writing reminders. The Connected node field shows which node a note belongs to.",
      ],
      [
        "Choose what readers receive",
        "Turn on Include in publication for notes you want to export. Included thoughts and commentary appear directly beneath their node in the published Markdown.",
      ],
    ],
    tip: "Notes without Include in publication stay in your editable project and its backups.",
  },
  {
    title: "Save your work. Share your direction.",
    label: "Save & publish",
    intro:
      "Your editable project and your published document serve different purposes.",
    points: [
      [
        "Check that changes are saved",
        "Look for All changes saved at the top. If a save fails, follow the Retry save or Download recovery options before leaving.",
      ],
      [
        "Back up the whole project",
        "Open the project menu beside its name and choose Project backup. The .storytracks file preserves editable content, notes, attachments, and material set aside.",
      ],
      [
        "Publish a writing document",
        "Publish → Preview the storytrack shows your Markdown before you export it. Publishing saves a local copy with any required attachments.",
      ],
    ],
    tip: "You’re ready to explore. Settings also lets you change the theme and fonts, and replay this tutorial anytime.",
  },
];

function DeskMap({
  practice,
  navigation,
}: {
  practice: boolean;
  navigation: boolean;
}) {
  const [closed, setClosed] = useState<string[]>([]);
  const toggle = (name: string) =>
    setClosed((items) =>
      items.includes(name) ? items.filter((x) => x !== name) : [...items, name],
    );
  const panel = (name: string, detail: string, side: "left" | "right") => {
    const hidden = closed.includes(name);
    return (
      <div className={`tutorial-map-panel ${hidden ? "folded" : ""}`}>
        {practice ? (
          <button
            type="button"
            aria-label={`${hidden ? "Expand" : "Collapse"} practice ${name}`}
            aria-expanded={!hidden}
            onClick={() => toggle(name)}
          >
            {(side === "left") !== hidden ? (
              <ChevronLeft size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
            <span>{name}</span>
          </button>
        ) : (
          <strong>{name}</strong>
        )}
        {!hidden && <small>{detail}</small>}
      </div>
    );
  };
  return (
    <div
      className="tutorial-map"
      role="group"
      aria-label={practice ? "Practice writing desk" : "Writing desk overview"}
    >
      <div className="tutorial-map-bar">
        <Map size={15} aria-hidden="true" /> My projects{" "}
        <span>Chapter · Whole book</span>
      </div>
      <div className="tutorial-map-body">
        {panel(
          "Outline",
          navigation ? "Part → Chapter → Node" : "Find your place",
          "left",
        )}
        <div className="tutorial-map-center">
          {panel("Sub-context", "Thoughts & feelings", "left")}
          <div className="tutorial-map-story">
            <PenLine size={19} aria-hidden="true" />
            <strong>Your story</strong>
            <span>Scenes, beats, and notes</span>
          </div>
          {panel("Highlight", "Commentary", "right")}
        </div>
        {panel("Inspector", "Node · Chapter · Project", "right")}
      </div>
      {practice && (
        <p className="tutorial-map-caption">
          Practice view · Your actual panels stay as they are.
        </p>
      )}
    </div>
  );
}

function LessonVisual({ step }: { step: number }) {
  if (step < 3)
    return <DeskMap key={step} practice={step === 2} navigation={step === 1} />;
  if (step === 3)
    return (
      <div className="tutorial-example">
        <span className="eyebrow">
          <Settings2 size={16} aria-hidden="true" /> THE DETAILS → PROJECT
        </span>
        <dl>
          <div>
            <dt>Intended audience</dt>
            <dd>Readers who love a quiet mystery</dd>
          </div>
          <div>
            <dt>Tone</dt>
            <dd>Warm, curious, a little uneasy</dd>
          </div>
          <div>
            <dt>Writing instructions</dt>
            <dd>Let small details reveal the secrets.</dd>
          </div>
        </dl>
        <small>Example guidance · Make it your own in the Project tab.</small>
      </div>
    );
  if (step === 4)
    return (
      <div className="tutorial-example">
        <span className="eyebrow">
          <PenLine size={16} aria-hidden="true" /> A STORY NODE
        </span>
        <h3>The arrival</h3>
        <p>She stepped off the train into a town she barely remembered.</p>
        <div className="tutorial-example-tags">
          <span>Importance: 4</span>
          <span>Liberty: 2</span>
        </div>
        <small>
          Double-click story text to edit. Choose Done when you’re ready.
        </small>
      </div>
    );
  if (step === 5)
    return (
      <div className="tutorial-note-examples">
        <div>
          <StickyNote size={21} aria-hidden="true" />
          <h3>Sub-context</h3>
          <p>She wants to feel at home, but something has changed.</p>
        </div>
        <div>
          <Sparkles size={21} aria-hidden="true" />
          <h3>Highlight</h3>
          <p>Echo the station’s silence when she leaves again.</p>
        </div>
        <small>Both notes belong to the same node: The arrival.</small>
      </div>
    );
  return (
    <div className="tutorial-export-examples">
      <div>
        <FolderOpen size={24} aria-hidden="true" />
        <h3>Project backup</h3>
        <p>Your editable book</p>
        <code>.storytracks</code>
      </div>
      <div>
        <Download size={24} aria-hidden="true" />
        <h3>Publish</h3>
        <p>Your writing document</p>
        <code>.md + attachments</code>
      </div>
    </div>
  );
}

export default function Tutorial({
  onClose,
}: {
  onClose: (outcome: "skipped" | "completed") => void;
}) {
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const lesson = lessons[step];
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      if (previous?.isConnected && previous !== document.body) previous.focus();
      else
        document.querySelector<HTMLButtonElement>(".settings-button")?.focus();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
    content.current?.scrollTo(0, 0);
  }, [step]);
  return (
    <dialog
      ref={dialog}
      className="modal tutorial"
      aria-label="First-time tutorial"
      aria-describedby="tutorial-intro"
      onCancel={(event) => {
        event.preventDefault();
        onClose("skipped");
      }}
    >
      <header className="tutorial-header">
        <span>
          <BookOpen size={18} aria-hidden="true" /> FIRST-TIME TUTORIAL
        </span>
        <button type="button" onClick={() => onClose("skipped")}>
          Skip tutorial
        </button>
      </header>
      <div className="tutorial-progress" aria-hidden="true">
        {lessons.map((item, index) => (
          <span key={item.label} className={index <= step ? "reached" : ""} />
        ))}
      </div>
      <div className="tutorial-content" ref={content}>
        <p className="tutorial-step" aria-live="polite">
          Step {step + 1} of {lessons.length} · {lesson.label}
        </p>
        <h2 ref={heading} tabIndex={-1}>
          {lesson.title}
        </h2>
        <p id="tutorial-intro" className="tutorial-intro">
          {lesson.intro}
        </p>
        <LessonVisual step={step} />
        <ul className="tutorial-points">
          {lesson.points.map(([title, description]) => (
            <li key={title}>
              <strong>{title}</strong>
              <p>{description}</p>
            </li>
          ))}
        </ul>
        <p className="tutorial-tip">{lesson.tip}</p>
      </div>
      <footer className="tutorial-footer">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>
        <button
          type="button"
          className="primary"
          onClick={() =>
            step === lessons.length - 1
              ? onClose("completed")
              : setStep(step + 1)
          }
        >
          {step === lessons.length - 1 ? (
            <>
              Start writing <Check size={16} aria-hidden="true" />
            </>
          ) : (
            <>
              Next <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </footer>
    </dialog>
  );
}
