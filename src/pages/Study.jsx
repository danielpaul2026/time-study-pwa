import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getTemplates, saveStudySession } from "../data/studyStore";

export default function Study() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ searchParams ] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const [ template ] = useState(() =>
    getTemplates().find(item => item.id === templateId)
  );
  const [ timestamp, setTimestamp ] = useState(null);
  const [ duration, setDuration ] = useState(null);
  const [ actionEvents, setActionEvents ] = useState([]);
  const [ clockNow, setClockNow ] = useState(0);

  useEffect(() => {
    if (timestamp === null) return undefined;

    const intervalId = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [timestamp]);

  function startStudy() {
    const startTime = Date.now();
    setTimestamp(startTime);
    setClockNow(startTime);
    setDuration(null);
    setActionEvents([]);
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
    setDuration(sessionDuration);
    setClockNow(endTime);
    saveStudySession({
      id: String(endTime),
      templateId: template.id,
      templateName: template.name,
      startTime: timestamp,
      endTime,
      durationMs: sessionDuration,
      events: actionEvents
    });
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
          <div className="study-action-grid" aria-label="Study actions">
            {template.elements.map(element => (
              <button
                className="study-action-tile"
                disabled={timestamp === null}
                key={element.id}
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
            ))}
            <button
              className="study-action-tile study-add-tile"
              type="button"
              disabled={timestamp !== null}
              onClick={editTemplate}
            >
              &lt; Add &gt;
            </button>
          </div>
          {template.elements.length === 0 && <p>This template has no action buttons.</p>}
          <section className="study-observation-log" aria-label="Recorded observation log">
            <div className="study-readout" role="status">
              <span>{timestamp !== null ? "RECORDING" : duration !== null ? "SAVED" : "READY"}</span>
              <strong>{formatClock(timestamp !== null ? clockNow - timestamp : duration || 0)}</strong>
              <span>{actionEvents.length} actions</span>
            </div>
            <div className="observation-log-heading">
              <h2>Observation log</h2>
              <button
                type="button"
                onClick={() => navigate(`/Results?templateId=${encodeURIComponent(template.id)}`)}
              >
                Results
              </button>
            </div>
            {actionEvents.length === 0 ? (
              <p className="observation-log-empty">Recorded actions appear here during capture.</p>
            ) : (
              <ol className="observation-log-list">
                {[ ...actionEvents ].reverse().map((event, index) => (
                  <li key={`${event.timestamp}-${index}`}>
                    <span>{event.name}</span>
                    <time dateTime={new Date(event.timestamp).toISOString()}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </time>
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