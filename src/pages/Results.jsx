import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  clearStudyData,
  clearStudySubjectData,
  getMergedStudyEventSources,
  getVisibleStudyEvents,
  getStudySessions,
  getStudySubjects,
  getTemplates,
  mergeStudySessionEvents,
  unmergeStudySessionEvent
} from "../data/studyStore";

function getEventName(event) {
  return event.elementPrime
    ? `${event.elementPrime}${event.elementSub ? ` / ${event.elementSub}` : ""}`
    : event.name;
}

export default function Results() {
  const navigate = useNavigate();
  const [ searchParams ] = useSearchParams();
  const requestedTemplateId = searchParams.get("templateId");
  const requestedSubjectNumber = Number(searchParams.get("subjectNumber"));
  const [ sessions, setSessions ] = useState(() => getStudySessions());
  const templates = getTemplates();
  const templatesById = new Map(templates.map(template => [ template.id, template ]));
  sessions.forEach(session => {
    if (!templatesById.has(session.templateId)) {
      templatesById.set(session.templateId, {
        id: session.templateId,
        name: session.templateName
      });
    }
  });
  const availableTemplates = [ ...templatesById.values() ];
  const [ selectedTemplateId, setSelectedTemplateId ] = useState(() =>
    requestedTemplateId || availableTemplates[0]?.id || ""
  );
  const [ selectedSubjectNumber, setSelectedSubjectNumber ] = useState(() =>
    String(Number.isInteger(requestedSubjectNumber) && requestedSubjectNumber >= 1 && requestedSubjectNumber <= 10
      ? requestedSubjectNumber
      : 1)
  );
  const [ selectedResultAction, setSelectedResultAction ] = useState(null);
  const [ isMergeDialogOpen, setIsMergeDialogOpen ] = useState(false);
  const subjects = selectedTemplateId ? getStudySubjects(selectedTemplateId) : [];
  const selectedTemplate = templatesById.get(selectedTemplateId);
  const selectedSessions = sessions
    .filter(session =>
      session.templateId === selectedTemplateId &&
      (Number.isInteger(session.subjectNumber) ? session.subjectNumber : 1) === Number(selectedSubjectNumber)
    )
    .sort((first, second) => first.startTime - second.startTime);
  const selectedTemplateSessions = sessions.filter(session => session.templateId === selectedTemplateId);
  const totalDuration = selectedSessions.reduce((total, session) =>
    total + (Number.isFinite(session.durationMs) ? session.durationMs : 0), 0
  );
  const totalActions = selectedSessions.reduce((total, session) =>
    total + (Array.isArray(session.events)
      ? getVisibleStudyEvents(session.events).filter(({ event }) => event.type !== "gap").length
      : 0), 0
  );
  let nextRowId = 1;
  const resultRows = selectedSessions.flatMap((session, sessionIndex) => {
    const rows = [];
    const events = Array.isArray(session.events) ? session.events : [];
    let previousTimestamp = session.startTime;

    if (sessionIndex > 0 && !events.some(event => event.type === "gap")) {
      rows.push({ type: "gap", id: `gap-${session.id}`, studyNumber: sessionIndex + 1 });
    }

    getVisibleStudyEvents(events).forEach(({ event, sourceEvent, index: eventIndex }) => {
      if (event.type === "gap") {
        previousTimestamp = event.timestamp;
        if (sessionIndex > 0 || eventIndex > 0) {
          rows.push({ type: "gap", id: `gap-${session.id}-${eventIndex}`, studyNumber: sessionIndex + 1 });
        }
        return;
      }

      const timestamp = Number(event.timestamp);
      if (!Number.isFinite(timestamp) || !Number.isFinite(previousTimestamp)) return;
      rows.push({
        id: nextRowId,
        event,
        sourceEvent,
        sessionId: session.id,
        mergeSources: getMergedStudyEventSources(events, sourceEvent.id),
        startTimestamp: previousTimestamp,
        elapsedSeconds: Math.max(0, (timestamp - previousTimestamp) / 1000),
        studyNumber: sessionIndex + 1
      });
      nextRowId += 1;
      previousTimestamp = timestamp;
    });

    return rows;
  });
  const selectedResultRow = selectedResultAction
    ? resultRows.find(row =>
      row.sessionId === selectedResultAction.sessionId &&
      row.sourceEvent.id === selectedResultAction.eventId
    )
    : null;
  const selectedMergeSession = selectedResultAction
    ? selectedSessions.find(session => session.id === selectedResultAction.sessionId)
    : null;
  const selectedMergeEvents = Array.isArray(selectedMergeSession?.events)
    ? selectedMergeSession.events
    : [];
  const selectedMergeEntries = getVisibleStudyEvents(selectedMergeEvents);
  const selectedMergeEntryPosition = selectedMergeEntries.findIndex(entry =>
    entry.sourceEvent.id === selectedResultAction?.eventId
  );
  const selectedMergeEntry = selectedMergeEntryPosition >= 0
    ? selectedMergeEntries[selectedMergeEntryPosition]
    : null;
  const previousMergeEntry = selectedMergeEntryPosition > 0 &&
    selectedMergeEntries[selectedMergeEntryPosition - 1].event.type !== "gap"
    ? selectedMergeEntries[selectedMergeEntryPosition - 1]
    : null;
  const nextMergeEntry = selectedMergeEntryPosition >= 0 &&
    selectedMergeEntryPosition < selectedMergeEntries.length - 1 &&
    selectedMergeEntries[selectedMergeEntryPosition + 1].event.type !== "gap"
    ? selectedMergeEntries[selectedMergeEntryPosition + 1]
    : null;
  const mergeSources = selectedMergeEntry
    ? getMergedStudyEventSources(selectedMergeEvents, selectedMergeEntry.sourceEvent.id)
    : [];

  function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return hours > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : `${minutes}m ${seconds}s`;
  }

  function mergeSelectedResultAction(destinationEntry) {
    if (!selectedMergeSession || !selectedMergeEntry || !destinationEntry) return;
    if (!mergeStudySessionEvents(
      selectedMergeSession.id,
      selectedMergeEntry.sourceEvent.id,
      destinationEntry.sourceEvent.id
    )) {
      throw new Error(`Unable to merge study events ${selectedMergeEntry.sourceEvent.id} and ${destinationEntry.sourceEvent.id}.`);
    }

    setSessions(getStudySessions());
    setSelectedResultAction(null);
    setIsMergeDialogOpen(false);
  }

  function unmergeResultAction(sourceEventId) {
    if (!selectedMergeSession) return;
    if (!unmergeStudySessionEvent(selectedMergeSession.id, sourceEventId)) {
      throw new Error(`Unable to unmerge study event ${sourceEventId}.`);
    }

    setSessions(getStudySessions());
  }

  function clearSubjectData() {
    const subjectNumber = Number(selectedSubjectNumber);
    if (!selectedTemplateId || !selectedSessions.length) return;
    if (!window.confirm(`Warning: This will permanently delete all study data for ${selectedTemplate?.name || "this template"}, Subject ${subjectNumber}. This cannot be undone. Continue?`)) return;

    clearStudySubjectData(selectedTemplateId, subjectNumber);
    setSessions(getStudySessions());
    setSelectedResultAction(null);
    setIsMergeDialogOpen(false);
  }

  function clearTemplateData() {
    if (!selectedTemplateId || !selectedTemplateSessions.length) return;
    if (!window.confirm(`Warning: This will permanently delete all study data for ${selectedTemplate?.name || "this template"}, across every subject. This cannot be undone. Continue?`)) return;

    clearStudyData(selectedTemplateId);
    setSessions(getStudySessions());
    setSelectedResultAction(null);
    setIsMergeDialogOpen(false);
  }

  return (
    <main className="results-page">
      <header className="menu-header results-header">
        <nav className="menu-actions results-menu-action" aria-label="Results navigation">
          <button type="button" onClick={() => navigate("/")}>Menu</button>
        </nav>
        <div className="menu-brand">
          <h1>Study Results</h1>
        </div>
        <button
          className="results-take-study"
          type="button"
          disabled={!selectedTemplateId}
          onClick={() => navigate(`/Study?templateId=${encodeURIComponent(selectedTemplateId)}&subjectNumber=${selectedSubjectNumber}`)}
        >
          Take Study
        </button>
      </header>
      {availableTemplates.length > 0 && (
        <section className="results-filter-section" aria-label="Choose results">
          <div className="results-filter-group results-template-filter">
            <select
              id="results-template"
              aria-label="Template"
              value={selectedTemplateId}
              onChange={event => {
                setSelectedTemplateId(event.target.value);
                setSelectedResultAction(null);
                setIsMergeDialogOpen(false);
              }}
            >
              {availableTemplates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <button type="button" disabled={!selectedTemplateSessions.length} onClick={clearTemplateData}>
              Clear template data
            </button>
          </div>
          <div className="results-filter-group results-subject-filter">
            <select
              id="results-subject"
              aria-label="Subject"
              value={selectedSubjectNumber}
              onChange={event => {
                setSelectedSubjectNumber(event.target.value);
                setSelectedResultAction(null);
                setIsMergeDialogOpen(false);
              }}
            >
              {subjects.map(subject => (
                <option key={subject.id} value={subject.number}>Subject {subject.number}</option>
              ))}
            </select>
            <button type="button" disabled={!selectedSessions.length} onClick={clearSubjectData}>
              Clear subject data
            </button>
          </div>
        </section>
      )}
      <section className="results-summary-section" aria-label="Selected results summary">
        {!selectedTemplateId ? (
          <p className="results-empty-state">No completed studies yet.</p>
        ) : selectedSessions.length === 0 ? (
          <p className="results-empty-state">
            No completed studies for {selectedTemplate?.name}, Subject {selectedSubjectNumber} yet.
          </p>
        ) : (
          <>
            <h2>{selectedTemplate?.name} · Subject {selectedSubjectNumber}</h2>
            <div className="menu-summary-metrics results-summary-metrics">
              <p className="menu-metric">Studies: {selectedSessions.length}</p>
              <p className="menu-metric">Total time: {formatDuration(totalDuration)}</p>
              <p className="menu-metric">Total actions: {totalActions}</p>
            </div>
          </>
        )}
      </section>
      <section className="results-session-section" aria-label="Study data table">
        {selectedSessions.length > 0 ? (
          <div className="results-table-scroll">
            <table className="results-data-table">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Element Prime</th>
                  <th scope="col">Element Sub</th>
                  <th scope="col">Element ID</th>
                  <th scope="col">Note</th>
                  <th scope="col">Count</th>
                  <th scope="col">Start Date</th>
                  <th scope="col">Start Time</th>
                  <th scope="col">Seconds Elapsed</th>
                  <th scope="col">Minutes Elapsed</th>
                  <th scope="col">Study</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map(row => {
                  if (row.type === "gap") {
                    return (
                      <tr className="results-gap-row" key={row.id}>
                        <td colSpan="11">Gap in data · Study {row.studyNumber}</td>
                      </tr>
                    );
                  }

                  const startDate = new Date(row.startTimestamp);
                  const element = row.event;
                  return (
                    <tr
                      className={selectedResultAction?.sessionId === row.sessionId &&
                        selectedResultAction?.eventId === row.sourceEvent.id ? "is-selected" : ""}
                      key={`${row.studyNumber}-${row.id}`}
                      tabIndex={0}
                      aria-selected={selectedResultAction?.sessionId === row.sessionId &&
                        selectedResultAction?.eventId === row.sourceEvent.id}
                      onClick={() => setSelectedResultAction({
                        sessionId: row.sessionId,
                        eventId: row.sourceEvent.id
                      })}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget ||
                          (event.key !== "Enter" && event.key !== " ")
                        ) return;
                        event.preventDefault();
                        setSelectedResultAction({
                          sessionId: row.sessionId,
                          eventId: row.sourceEvent.id
                        });
                      }}
                    >
                      <td className="results-id-cell">
                        {row.id}
                        {row.mergeSources.length > 0 && (
                          <span className="results-merged-indicator">Merged</span>
                        )}
                      </td>
                      <td>{element.elementPrime || element.name || ""}</td>
                      <td>{element.elementSub || ""}</td>
                      <td>{element.elementId || ""}</td>
                      <td>{element.note || ""}</td>
                      <td>{Number.isFinite(Number(element.count)) ? Number(element.count) : 1}</td>
                      <td>{startDate.toLocaleDateString()}</td>
                      <td>{startDate.toLocaleTimeString()}</td>
                      <td>{row.elapsedSeconds.toFixed(3)}</td>
                      <td>{(row.elapsedSeconds / 60).toFixed(3)}</td>
                      <td>{row.studyNumber}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="results-empty-state">Study data will appear here when actions are recorded.</p>
        )}
        {selectedResultRow && (
          <div className="results-table-actions">
            <span>Selected: {getEventName(selectedResultRow.event)}</span>
            <button type="button" onClick={() => setIsMergeDialogOpen(true)}>
              {selectedResultRow.mergeSources.length > 0 ? "Un/Merge" : "Merge"}
            </button>
          </div>
        )}
      </section>
      {isMergeDialogOpen && selectedMergeEntry && selectedMergeSession && (
        <div
          className="results-merge-backdrop"
          onClick={() => setIsMergeDialogOpen(false)}
        >
          <section
            className="results-merge-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-merge-title"
            onClick={event => event.stopPropagation()}
          >
            <header>
              <div>
                <h2 id="results-merge-title">Edit action merges</h2>
                <strong>{getEventName(selectedMergeEntry.event)}</strong>
              </div>
              <button type="button" onClick={() => setIsMergeDialogOpen(false)}>Done</button>
            </header>
            <section className="results-merge-options" aria-label="Merge to">
              <h3>Merge to:</h3>
              <button
                type="button"
                disabled={!previousMergeEntry}
                onClick={() => mergeSelectedResultAction(previousMergeEntry)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 19V5m-6 6 6-6 6 6" />
                </svg>
                <span>
                  <span>Previous:</span>
                  <strong>{previousMergeEntry
                    ? getEventName(previousMergeEntry.event)
                    : "<No Previous Action>"}</strong>
                </span>
              </button>
              <button
                type="button"
                disabled={!nextMergeEntry}
                onClick={() => mergeSelectedResultAction(nextMergeEntry)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5v14m6-6-6 6-6-6" />
                </svg>
                <span>
                  <span>Next:</span>
                  <strong>{nextMergeEntry
                    ? getEventName(nextMergeEntry.event)
                    : "<No Next Action>"}</strong>
                </span>
              </button>
            </section>
            {mergeSources.length > 0 && (
              <section className="results-unmerge-options" aria-label="Undo existing merges">
                <h3>Undo merges:</h3>
                {mergeSources.map(({ event: sourceEvent, destination }) => (
                  <div key={sourceEvent.id}>
                    <span>
                      {getEventName(sourceEvent)} merged into {getEventName(destination)}
                    </span>
                    <button type="button" onClick={() => unmergeResultAction(sourceEvent.id)}>
                      Unmerge
                    </button>
                  </div>
                ))}
              </section>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
