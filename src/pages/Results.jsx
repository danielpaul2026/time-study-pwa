import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getStudySessions } from "../data/studyStore";

export default function Results() {
  const navigate = useNavigate();
  const [ searchParams ] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const [ sessions ] = useState(() => getStudySessions());
  const visibleSessions = templateId
    ? sessions.filter(session => session.templateId === templateId)
    : sessions;

  function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return hours > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : `${minutes}m ${seconds}s`;
  }

  return (
    <main className="results-page">
      <nav className="page-nav" aria-label="Main navigation">
        <button type="button" onClick={() => navigate("/")}>Menu</button>
        <button type="button" onClick={() => navigate("/Template")}>Create template</button>
      </nav>
      <h1>Study results</h1>
      {visibleSessions.length === 0 ? (
        <p>No completed studies yet.</p>
      ) : (
        <ol className="session-list">
          {visibleSessions.map(session => (
            <li className="session-entry" key={session.id}>
              <h2>{session.templateName}</h2>
              <p>
                {new Date(session.startTime).toLocaleString()}
                {" · "}
                {formatDuration(session.durationMs)}
              </p>
              <p>{session.events.length} actions recorded</p>
              {session.events.length > 0 && (
                <ol className="event-list">
                  {session.events.map((event, index) => (
                    <li key={`${session.id}-${index}`}>
                      {event.name} at {new Date(event.timestamp).toLocaleTimeString()}
                    </li>
                  ))}
                </ol>
              )}
              <button
                type="button"
                onClick={() => navigate(`/Study?templateId=${encodeURIComponent(session.templateId)}`)}
              >
                Repeat study
              </button>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}