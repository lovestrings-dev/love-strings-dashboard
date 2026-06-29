import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ListTodo,
  Music2,
  Radio,
  Sparkles,
  TrendingUp
} from "lucide-react";

const summaryCards = [
  {
    label: "Current Sprint",
    value: "Release Cycle 01",
    detail: "Production and launch checklist",
    icon: ListTodo
  },
  {
    label: "Next Release",
    value: "5 days",
    detail: "Countdown until planned launch",
    icon: CalendarDays
  },
  {
    label: "Budget Balance",
    value: "EUR 0",
    detail: "Import workbook data next",
    icon: CircleDollarSign
  },
  {
    label: "Platform Pulse",
    value: "Manual entry",
    detail: "Daily snapshots ready in Supabase",
    icon: TrendingUp
  }
];

const todayTasks = [
  "Confirm current song sprint",
  "Import production workbook data",
  "Add first platform metric snapshot",
  "Prepare release checklist template"
];

const sections = [
  "Production",
  "Marketing",
  "Budget",
  "Platforms",
  "Sprints",
  "Roadmap"
];

export default function Home() {
  return (
    <main className="dashboard-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-mark">
          <Music2 size={22} aria-hidden />
          <div>
            <strong>Love Strings</strong>
            <span>Sprint Dashboard</span>
          </div>
        </div>

        <nav className="nav-list">
          {sections.map((section) => (
            <a href="#" key={section}>
              {section}
            </a>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Daily command screen</p>
            <h1>Love Strings Dashboard</h1>
          </div>
          <button className="icon-button" type="button" aria-label="Open project setup">
            <ArrowUpRight size={18} aria-hidden />
          </button>
        </header>

        <section className="roadmap-band" aria-label="Strategic roadmap">
          <div>
            <p className="eyebrow">Strategic Roadmap</p>
            <h2>Phase 1: English Covers / Brand Formation</h2>
            <p>
              Current milestone: launch repeatable release cycles and build toward
              5 releases by October 2026.
            </p>
          </div>
          <div className="progress-block" aria-label="Roadmap progress">
            <span>0 / 5 releases</span>
            <div className="progress-track">
              <div className="progress-fill" />
            </div>
          </div>
        </section>

        <section className="summary-grid" aria-label="Dashboard summary">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="metric-card" key={card.label}>
                <Icon size={20} aria-hidden />
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="main-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Today</p>
                <h2>Focus Queue</h2>
              </div>
              <Clock3 size={18} aria-hidden />
            </div>
            <ul className="task-list">
              {todayTasks.map((task) => (
                <li key={task}>
                  <CheckCircle2 size={18} aria-hidden />
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel status-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Infrastructure</p>
                <h2>System Status</h2>
              </div>
              <Radio size={18} aria-hidden />
            </div>
            <div className="status-list">
              <span>
                <Sparkles size={17} aria-hidden />
                Supabase schema applied
              </span>
              <span>
                <CheckCircle2 size={17} aria-hidden />
                GitHub integration connected
              </span>
              <span>
                <AlertTriangle size={17} aria-hidden />
                Workbook import pending
              </span>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
