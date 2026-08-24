"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type WorkflowStep = { id: string; stableKey: string; displayName: string; position: number; stepKind: "idea_anchor" | "production_step" | "release_anchor"; semanticKind: "standard" | "distribution"; isEnabled: boolean; leadTimeDays: number; standardCostAmount: number; };
type WorkflowTemplate = { id: string; name: string; templateVersion: number; steps: WorkflowStep[] };

const addOptions = ["Arrangement", "Backing Vocals", "Brass", "Editing", "Keyboard", "Metadata", "Percussion", "Programming", "Sound Design", "Strings", "Synths", "Blank Step"];
const ordered = (steps: WorkflowStep[]) => [...steps].sort((a, b) => a.position - b.position);
const normalizePositions = (steps: WorkflowStep[]) => {
  const idea = steps.find((step) => step.stepKind === "idea_anchor")!;
  const distributor = steps.find((step) => step.semanticKind === "distribution")!;
  const release = steps.find((step) => step.stepKind === "release_anchor")!;
  const middle = steps.filter((step) => step.stepKind === "production_step" && step.semanticKind !== "distribution");
  return [idea, ...middle, distributor, release].map((step, index) => ({ ...step, position: index * 100 }));
};

export function ProductionWorkflowSettings() {
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [status, setStatus] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [addSelection, setAddSelection] = useState(addOptions[0]);
  const [addTime, setAddTime] = useState("1");
  const [addCost, setAddCost] = useState("");
  const steps = useMemo(() => template?.steps ?? [], [template]);
  const windowDays = useMemo(() => steps.filter((step) => step.isEnabled && step.stepKind === "production_step").reduce((total, step) => total + step.leadTimeDays, 0), [steps]);

  async function persist(nextSteps: WorkflowStep[]) {
    if (!template) return;
    const normalized = normalizePositions(nextSteps);
    setTemplate((current) => current ? { ...current, steps: normalized } : current);
    setStatus("Saving…");
    try {
      const response = await fetch("/api/workspace/production-template", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steps: normalized }) });
      const body = await response.json() as { template?: WorkflowTemplate; error?: string };
      if (!response.ok || !body.template) throw new Error(body.error || "Production workflow save failed.");
      setTemplate({ ...body.template, steps: ordered(body.template.steps) });
      setStatus("Saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Production workflow save failed.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/workspace/production-template", { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { template?: WorkflowTemplate; error?: string };
      if (!response.ok || !body.template) throw new Error(body.error || "Production workflow unavailable.");
      const normalized = body.template.steps.map((step) => step.stepKind === "production_step" && step.semanticKind !== "distribution" ? { ...step, isEnabled: true } : step);
      if (!cancelled) {
        setTemplate({ ...body.template, steps: ordered(normalized) });
        if (normalized.some((step, index) => step.isEnabled !== body.template!.steps[index]?.isEnabled)) {
          setStatus("Saving reactivated workflow steps…");
          void fetch("/api/workspace/production-template", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steps: normalizePositions(normalized) }) })
            .then(async (saveResponse) => {
              const saved = await saveResponse.json() as { template?: WorkflowTemplate };
              if (!saveResponse.ok || !saved.template) throw new Error("Production workflow save failed.");
              if (!cancelled) { setTemplate({ ...saved.template, steps: ordered(saved.template.steps) }); setStatus("Saved"); }
            })
            .catch(() => { if (!cancelled) setStatus("Production workflow save failed."); });
        }
      }
    }).catch((error) => { if (!cancelled) setStatus(error instanceof Error ? error.message : "Production workflow unavailable."); });
    return () => { cancelled = true; };
  }, []);

  const updateDraft = (next: WorkflowStep[]) => setTemplate((current) => current ? { ...current, steps: normalizePositions(next) } : current);
  const normalSteps = steps.filter((step) => step.stepKind === "production_step" && step.semanticKind !== "distribution");
  const move = (id: string, direction: -1 | 1) => {
    const index = normalSteps.findIndex((step) => step.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= normalSteps.length) return;
    const reordered = [...normalSteps];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    void persist([...steps.filter((step) => step.stepKind !== "production_step" || step.semanticKind === "distribution"), ...reordered]);
  };
  const saveDraft = () => { if (template) void persist(template.steps); };
  const deleteStep = (id: string) => { setEditingStepId(null); void persist(steps.filter((step) => step.id !== id)); };
  const addStep = () => {
    const name = addSelection === "Blank Step" ? "New Step" : addSelection;
    const time = Math.max(0, Number(addTime) || 0);
    const cost = addCost ? -Math.abs(Number(addCost) || 0) : 0;
    void persist([...steps, { id: crypto.randomUUID(), stableKey: "custom-" + crypto.randomUUID(), displayName: name, position: 0, stepKind: "production_step", semanticKind: "standard", isEnabled: true, leadTimeDays: time, standardCostAmount: cost }]);
    setAddTime("1");
    setAddCost("");
  };

  if (!template) return <p className="settings-description">{status || "Loading Production workflow..."}</p>;

  return <div className="production-workflow-settings">
    <p className="settings-description production-workflow-summary">Applied only to future Production songs. Standard production window: <strong>{windowDays} days</strong>.</p>
    <div className="production-workflow-list">{ordered(steps).map((step) => {
      const isIdea = step.stepKind === "idea_anchor";
      const isNormal = step.stepKind === "production_step" && step.semanticKind !== "distribution";
      const isDistributor = step.semanticKind === "distribution";
      const isRelease = step.stepKind === "release_anchor";
      const editing = editingStepId === step.id;
      const index = normalSteps.findIndex((item) => item.id === step.id);
      const canMoveUp = isNormal && index > 0;
      const canMoveDown = isNormal && index < normalSteps.length - 1;
      const saveWhenLeavingRow = (event: React.FocusEvent<HTMLDivElement>) => {
        if (editing && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setEditingStepId(null);
          saveDraft();
        }
      };
      const rowClass = "production-workflow-row" + (isRelease ? " is-release" : "");
      return <div className={rowClass} key={step.id} onBlur={saveWhenLeavingRow}>
        <span className="production-workflow-move"><button aria-label={"Move " + step.displayName + " up"} disabled={!canMoveUp} onClick={() => move(step.id, -1)} type="button"><ArrowUp size={14} /></button><button aria-label={"Move " + step.displayName + " down"} disabled={!canMoveDown} onClick={() => move(step.id, 1)} type="button"><ArrowDown size={14} /></button></span>
        <input aria-label={step.displayName + " step name"} className="production-workflow-name" disabled={!isNormal || !editing} onChange={(event) => updateDraft(steps.map((item) => item.id === step.id ? { ...item, displayName: event.target.value } : item))} value={step.displayName} />
        {isIdea ? <span className="production-workflow-hint-label">Time</span> : isRelease ? <span className="production-workflow-release-hint">Distributor Step ON:<br />Production deadline follows Distributor.<br />Same as Release: OFF</span> : <input aria-label={step.displayName + " lead time"} className="production-workflow-number" disabled={isNormal && !editing} min="0" onBlur={isDistributor ? saveDraft : undefined} onChange={(event) => updateDraft(steps.map((item) => item.id === step.id ? { ...item, leadTimeDays: Math.max(0, Number(event.target.value) || 0) } : item))} type="number" value={step.leadTimeDays} />}
        {isIdea ? <span className="production-workflow-hint-label">Cost</span> : isRelease ? null : <input aria-label={step.displayName + " cost"} className="production-workflow-number" disabled={isNormal && !editing} min="0" onBlur={isDistributor ? saveDraft : undefined} onChange={(event) => updateDraft(steps.map((item) => item.id === step.id ? { ...item, standardCostAmount: -Math.abs(Number(event.target.value) || 0) } : item))} placeholder="—" type="number" value={step.standardCostAmount ? Math.abs(step.standardCostAmount) : ""} />}
        {isIdea ? <span className="production-workflow-hint-label">Edit</span> : isRelease ? null : isDistributor ? <button aria-label={"Distributor " + (step.isEnabled ? "ON" : "OFF")} className={"production-workflow-toggle" + (step.isEnabled ? " is-on" : "")} onClick={() => void persist(steps.map((item) => item.id === step.id ? { ...item, isEnabled: !item.isEnabled } : item))} type="button">{step.isEnabled ? "ON" : "OFF"}</button> : isNormal ? <button aria-label={editing ? "Delete " + step.displayName : "Edit " + step.displayName} className={"production-workflow-action" + (editing ? " is-delete" : "")} onMouseDown={(event) => { if (editing) event.preventDefault(); }} onClick={() => editing ? deleteStep(step.id) : setEditingStepId(step.id)} type="button">{editing ? <Trash2 size={16} /> : <Pencil size={16} />}</button> : null}
      </div>;
    })}</div>
    <div className="production-workflow-add"><span className="production-workflow-move"><button disabled type="button"><ArrowUp size={14} /></button><button disabled type="button"><ArrowDown size={14} /></button></span><select aria-label="Add Production step" onChange={(event) => setAddSelection(event.target.value)} value={addSelection}>{addOptions.map((option) => <option key={option}>{option}</option>)}</select><input aria-label="New step time" className="production-workflow-number" min="0" onChange={(event) => setAddTime(event.target.value)} type="number" value={addTime} /><input aria-label="New step cost" className="production-workflow-number" min="0" onChange={(event) => setAddCost(event.target.value)} placeholder="—" type="number" value={addCost} /><button aria-label="Add Production step" className="production-workflow-action production-workflow-add-action" onClick={addStep} type="button"><Plus size={20} strokeWidth={3} /></button></div>
    {status ? <p className="settings-status">{status}</p> : null}
  </div>;
}
