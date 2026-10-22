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
    if (!window.confirm(`Clear all data for ${selectedTemplate?.name || "this template"}, Subject ${subjectNumber}? This cannot be undone.`)) return;

    clearStudySubjectData(selectedTemplateId, subjectNumber);
    setSessions(getStudySessions());
  }

  function clearTemplateData() {
    if (!selectedTemplateId || !selectedTemplateSessions.length) return;
    if (!window.confirm(`Clear all study data for ${selectedTemplate?.name || "this template"}? This cannot be undone.`)) return;

    clearStudyData(selectedTemplateId);
    setSessions(getStudySessions());
  }

  return (
    <main className="results-page">
      <nav className="page-nav" aria-label="Main navigation">
        <button type="button" onClick={() => navigate("/")}>Menu</button>
        <button type="button" onClick={() => navigate("/Template")}>Create template</button>
      </nav>
      <h1>Study results</h1>
      {availableTemplates.length > 0 && (
        <section className="results-filters" aria-label="Choose results">
          <label htmlFor="results-template">Template</label>
          <select
            id="results-template"
            value={selectedTemplateId}
            onChange={event => setSelectedTemplateId(event.target.value)}
          >
            {availableTemplates.map(template => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          <label htmlFor="results-subject">Subject</label>
          <select
            id="results-subject"
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
          <button type="button" disabled={!selectedTemplateSessions.length} onClick={clearTemplateData}>
            Clear template data
          </button>
        </section>
      )}
      {!selectedTemplateId ? (
        <p>No completed studies yet.</p>
      ) : selectedSessions.length === 0 ? (
        <p>No completed studies for Subject {selectedSubjectNumber} yet.</p>
      ) : (
        <section className="subject-results">
          <h2>{selectedTemplate?.name} · Subject {selectedSubjectNumber}</h2>
          <ol className="session-list">
            {selectedSessions.map((session, sessionIndex) => {
              const events = Array.isArray(session.events) ? session.events : [];
              const hasGapMarker = events.some(event => event.type === "gap");
              const actions = events.filter(event => event.type !== "gap");

              return (
                <li className="session-entry" key={session.id}>
                  <p>
                    {new Date(session.startTime).toLocaleString()}
                    {" · "}
                    {formatDuration(session.durationMs)}
                  </p>
                  <p>{actions.length} actions recorded</p>
                  {(sessionIndex > 0 || events.length > 0) && (
                    <ol className="event-list">
                      {sessionIndex > 0 && !hasGapMarker && (
                        <li className="gap-in-data">Gap in data</li>
                      )}
                      {events.map((event, index) => (
                        <li className={event.type === "gap" ? "gap-in-data" : ""} key={`${session.id}-${index}`}>
                          {event.type === "gap"
                            ? "Gap in data"
                            : `${event.name} at ${new Date(event.timestamp).toLocaleTimeString()}`}
                        </li>
                      ))}
                    </ol>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/Study?templateId=${encodeURIComponent(session.templateId)}&subjectNumber=${session.subjectNumber || 1}`)}
                  >
                    Repeat study
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </main>
  );
}
