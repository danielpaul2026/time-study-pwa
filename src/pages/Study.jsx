import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  getStudySessions,
  getStudySubjects,
  getTemplates,
  saveStudySession
} from "../data/studyStore";
import useAvailableGridRows from "../hooks/useAvailableGridRows";

export default function Study() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ searchParams ] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const [ template ] = useState(() =>
    getTemplates().find(item => item.id === templateId)
  );
  const subjects = templateId ? getStudySubjects(templateId) : [];
  const [ selectedSubjectNumber, setSelectedSubjectNumber ] = useState(() =>
    String(Math.max(1, Math.min(10, Number(searchParams.get("subjectNumber")) || subjects[0]?.number || 1)))
  );
  const [ timestamp, setTimestamp ] = useState(null);
  const [ duration, setDuration ] = useState(null);
  const [ actionEvents, setActionEvents ] = useState([]);
  const [ clockNow, setClockNow ] = useState(0);
  const [ studySessions, setStudySessions ] = useState(() => getStudySessions());

  useEffect(() => {
    if (timestamp === null) return undefined;

    const intervalId = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [timestamp]);

  function startStudy() {
    const startTime = Date.now();
    const hasPreviousData = studySessions.some(session =>
      session.templateId === template.id &&
      (Number.isInteger(session.subjectNumber) ? session.subjectNumber : 1) === Number(selectedSubjectNumber)
    );
    setTimestamp(startTime);
    setClockNow(startTime);
    setDuration(null);
    setActionEvents(hasPreviousData
      ? [{ type: "gap", name: "Gap in data", timestamp: startTime }]
      : []);
  }

  function recordAction(element) {
    if (timestamp === null) return;

    setActionEvents(currentEvents => [
      ...currentEvents,
      { name: element.name, timestamp: Date.now() }
    ]);
  }

  function stopStudy() {
    if (timestamp === null) return;

    const endTime = Date.now();
    const sessionDuration = endTime - timestamp;
    const subjectNumber = Number(selectedSubjectNumber);

    setDuration(sessionDuration);
    setClockNow(endTime);
    saveStudySession({
      id: String(endTime),
      templateId: template.id,
      templateName: template.name,
      subjectId: `${template.id}:${subjectNumber}`,
      subjectNumber,
      startTime: timestamp,
      endTime,
      durationMs: sessionDuration,
      events: actionEvents
    });
    setStudySessions(getStudySessions());
    setActionEvents([]);
    setTimestamp(null);
  }

  function formatClock(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [ hours, minutes, seconds ]
      .map(value => String(value).padStart(2, "0"))
      .join(":");
  }

  function editTemplate() {
    navigate(`/Template/${encodeURIComponent(template.id)}`, {
      state: { returnTo: `${location.pathname}${location.search}` }
    });
  }

  const columns = Math.max(1, Math.min(12, Number(template?.columns) || 3));
  const rowHeightLines = Math.max(1, Math.min(8, Number(template?.rowHeightLines) || 2));
  const elementPositions = (template?.elements || []).map((element, index) =>
    Number.isInteger(element.position) && element.position >= 0 ? element.position : index
  );
  const minimumGridRows = Math.max(
    1,
    Math.ceil((Math.max(-1, ...elementPositions) + 1) / columns)
  );
  const rowHeight = Math.max(44, rowHeightLines * 16.1 + 16);
  const { gridRef, gridRows } = useAvailableGridRows(minimumGridRows, rowHeight);
  const elementsByPosition = new Map((template?.elements || []).map((element, index) => [
    Number.isInteger(element.position) && element.position >= 0 ? element.position : index,
    element
  ]));
  const gridStyle = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridRows}, ${rowHeight}px)`
  };
  const previousSessions = studySessions
    .filter(session =>
      session.templateId === template?.id &&
      (Number.isInteger(session.subjectNumber) ? session.subjectNumber : 1) === Number(selectedSubjectNumber)
    )
    .sort((first, second) => first.startTime - second.startTime);
  const previousEvents = previousSessions.flatMap((session, index) => {
    const events = Array.isArray(session.events) ? session.events : [];
    if (index === 0 || events.some(event => event.type === "gap")) return events;

    return [
      { type: "gap", name: "Gap in data", timestamp: session.startTime },
      ...events
    ];
  });
  const visibleEvents = [ ...previousEvents, ...actionEvents ];
  const visibleActionCount = visibleEvents.filter(event => event.type !== "gap").length;

  return (
    <main className="study-page">
      {template ? (
        <>
          <header className="study-appbar">
            <button className="study-menu-button" type="button" onClick={() => navigate("/")}>
              Menu
            </button>
            <h1>{template.name}</h1>
            <button
              className={`record-button${timestamp !== null ? " is-recording" : ""}`}
              type="button"
              aria-label={timestamp !== null ? "Stop and save study" : "Start study"}
              title={timestamp !== null ? "Stop and save study" : "Start study"}
              onClick={timestamp !== null ? stopStudy : startStudy}
            >
              <span className="record-indicator" aria-hidden="true" />
            </button>
          </header>
          <section className="study-subject-controls" aria-label="Study subject">
            <label htmlFor="study-subject">Subject</label>
            <select
              id="study-subject"
              value={selectedSubjectNumber}
              disabled={timestamp !== null}
              onChange={event => {
                setSelectedSubjectNumber(event.target.value);
                setDuration(null);
                setActionEvents([]);
              }}
            >
              {subjects.map(subject => (
                <option key={subject.id} value={subject.number}>Subject {subject.number}</option>
              ))}
            </select>
          </section>
          <div ref={gridRef} className="study-action-grid" role="grid" aria-label="Study actions" style={gridStyle}>
            {Array.from({ length: gridRows * columns }, (_, cellIndex) => {
              const element = elementsByPosition.get(cellIndex);
              return (
                <div
                  className={`study-grid-cell${element ? "" : " is-empty"}`}
                  key={cellIndex}
                  role="gridcell"
                  aria-label={element ? element.name : `Empty cell ${cellIndex + 1}`}
                >
                  {element && (
                    <button
                      className="study-action-tile"
                      disabled={timestamp === null}
                      type="button"
                      style={{
                        backgroundColor: element.backgroundColor || "#dedede",
                        color: element.textColor || "#111111",
                        fontFamily: element.fontFamily || "Arial, sans-serif"
                      }}
                      onClick={() => recordAction(element)}
                    >
                      {element.name}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            className="study-action-tile study-add-tile"
            type="button"
            disabled={timestamp !== null}
            onClick={editTemplate}
          >
            &lt; Add &gt;
          </button>
          {template.elements.length === 0 && <p>This template has no action buttons.</p>}
          <section className="study-observation-log" aria-label="Recorded observation log">
            <div className="study-readout" role="status">
              <span>{timestamp !== null ? "RECORDING" : duration !== null ? "SAVED" : "READY"}</span>
              <strong>{formatClock(timestamp !== null ? clockNow - timestamp : duration || 0)}</strong>
              <span>{visibleActionCount} actions</span>
            </div>
            <div className="observation-log-heading">
              <h2>Observation log</h2>
              <button
                type="button"
                onClick={() => navigate(`/Results?templateId=${encodeURIComponent(template.id)}&subjectNumber=${selectedSubjectNumber}`)}
              >
                Results
              </button>
            </div>
            {visibleEvents.length === 0 ? (
              <p className="observation-log-empty">Recorded actions appear here during capture.</p>
            ) : (
              <ol className="observation-log-list">
                {[ ...visibleEvents ].reverse().map((event, index) => (
                  <li key={`${event.timestamp}-${index}`}>
                    {event.type === "gap" ? (
                      <span className="gap-in-data">Gap in data</span>
                    ) : (
                      <>
                        <span>{event.name}</span>
                        <time dateTime={new Date(event.timestamp).toISOString()}>
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </time>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : (
        <>
          <h1>Choose a study template</h1>
          <p>Start a study from one of your saved templates.</p>
          <button type="button" onClick={() => navigate("/")}>Go to templates</button>
        </>
      )}
    </main>
  );
}