import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  clearStudyData,
  clearStudySubjectData,
  getStudySessions,
  getStudySubjects,
  getTemplates
} from "../data/studyStore";

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
      ? session.events.filter(event => event.type !== "gap").length
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

    events.forEach((event, eventIndex) => {
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
        startTimestamp: previousTimestamp,
        elapsedSeconds: Math.max(0, (timestamp - previousTimestamp) / 1000),
        studyNumber: sessionIndex + 1
      });
      nextRowId += 1;
      previousTimestamp = timestamp;
    });

    return rows;
  });

  function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return hours > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : `${minutes}m ${seconds}s`;
  }

  function clearSubjectData() {
    const subjectNumber = Number(selectedSubjectNumber);
    if (!selectedTemplateId || !selectedSessions.length) return;
    if (!window.confirm(`Warning: This will permanently delete all study data for ${selectedTemplate?.name || "this template"}, Subject ${subjectNumber}. This cannot be undone. Continue?`)) return;

    clearStudySubjectData(selectedTemplateId, subjectNumber);
    setSessions(getStudySessions());
  }

  function clearTemplateData() {
    if (!selectedTemplateId || !selectedTemplateSessions.length) return;
    if (!window.confirm(`Warning: This will permanently delete all study data for ${selectedTemplate?.name || "this template"}, across every subject. This cannot be undone. Continue?`)) return;

    clearStudyData(selectedTemplateId);
    setSessions(getStudySessions());
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
              onChange={event => setSelectedTemplateId(event.target.value)}
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
              onChange={event => setSelectedSubjectNumber(event.target.value)}
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
                    <tr key={`${row.studyNumber}-${row.id}`}>
                      <td>{row.id}</td>
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
      </section>
    </main>
  );
}
