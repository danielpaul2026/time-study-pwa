import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getStudySessions,
  getStudySubjects,
  getTemplates,
  saveStudySession,
  saveTemplate,
  updateStudySessionEvent
} from "../data/studyStore";
import useAvailableGridRows from "../hooks/useAvailableGridRows";

export default function Study() {
  const navigate = useNavigate();
  const [ searchParams ] = useSearchParams();
  const templateId = searchParams.get("templateId");
  const [ template, setTemplate ] = useState(() =>
    getTemplates().find(item => item.id === templateId)
  );
  const subjects = templateId ? getStudySubjects(templateId) : [];
  const [ selectedSubjectNumber, setSelectedSubjectNumber ] = useState(() =>
    String(Math.max(1, Math.min(10, Number(searchParams.get("subjectNumber")) || subjects[0]?.number || 1)))
  );
  const [ timestamp, setTimestamp ] = useState(null);
  const [ actionEvents, setActionEvents ] = useState([]);
  const [ clockNow, setClockNow ] = useState(0);
  const [ studySessions, setStudySessions ] = useState(() => getStudySessions());
  const [ nestedParent, setNestedParent ] = useState(null);
  const [ noteEditor, setNoteEditor ] = useState(null);
  const [ selectedEventTarget, setSelectedEventTarget ] = useState(null);
  const [ isAddingElement, setIsAddingElement ] = useState(false);
  const [ newElementName, setNewElementName ] = useState("");
  const observationLogRef = useRef(null);

  useEffect(() => {
    if (timestamp === null) return undefined;

    const intervalId = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [timestamp]);

  useEffect(() => {
    if (observationLogRef.current) {
      observationLogRef.current.scrollTop = observationLogRef.current.scrollHeight;
    }
  }, [actionEvents.length, studySessions.length, selectedSubjectNumber]);

  function startStudy() {
    const startTime = Date.now();
    const hasPreviousData = studySessions.some(session =>
      session.templateId === template.id &&
      (Number.isInteger(session.subjectNumber) ? session.subjectNumber : 1) === Number(selectedSubjectNumber)
    );
    setTimestamp(startTime);
    setClockNow(startTime);
    setActionEvents(hasPreviousData
      ? [{ type: "gap", name: "Gap in data", timestamp: startTime }]
      : []);
  }

  function recordAction(element, parentElement = null) {
    if (timestamp === null) return;

    const eventTimestamp = Date.now();
    const actionEvent = {
      ...describeElement(element, parentElement),
      note: "",
      timestamp: eventTimestamp
    };

    setActionEvents(currentEvents => [
      ...currentEvents,
      actionEvent
    ]);
  }

  function updateActionEvent(index, changes) {
    setActionEvents(currentEvents => currentEvents.map((event, eventIndex) =>
      eventIndex === index ? { ...event, ...changes } : event
    ));
  }

  function updateEventTarget(target, changes) {
    if (target.source === "current") {
      updateActionEvent(target.index, changes);
      return;
    }

    if (!updateStudySessionEvent(target.sessionId, target.index, changes)) {
      throw new Error(`Unable to update event ${target.index} in study session ${target.sessionId}.`);
    }
    setStudySessions(getStudySessions());
  }

  function describeElement(element, parentElement = null) {
    return {
      name: element.name,
      elementPrime: parentElement?.name || element.name,
      elementSub: parentElement ? element.name : "",
      elementId: element.externalId || parentElement?.externalId || "",
      count: Number.isFinite(Number(element.defaultCount)) ? Number(element.defaultCount) : 1
    };
  }

  function selectReplacementElement(element, parentElement = null) {
    if (!selectedEventTarget) return false;
    updateEventTarget(selectedEventTarget, describeElement(element, parentElement));
    setSelectedEventTarget(null);
    setNestedParent(null);
    return true;
  }

  function addElement(event) {
    event.preventDefault();
    const name = newElementName.trim();
    if (!name) return;

    const visibleElements = nestedParent?.children || template.elements || [];
    const occupiedPositions = new Set(visibleElements.map((element, index) =>
      Number.isInteger(element.position) && element.position >= 0 ? element.position : index
    ));
    let position = 0;
    while (occupiedPositions.has(position)) position += 1;

    const existingIds = (template.elements || []).flatMap(element => [
      Number(element.id),
      ...(element.children || []).map(child => Number(child.id))
    ]).filter(Number.isFinite);
    const newElement = {
      id: Math.max(0, ...existingIds) + 1,
      name,
      position,
      backgroundColor: "#dedede",
      textColor: "#111111",
      fontFamily: "Arial, sans-serif"
    };
    const updatedElements = nestedParent
      ? (template.elements || []).map(element => element.id === nestedParent.id
        ? { ...element, children: [ ...(element.children || []), newElement ] }
        : element)
      : [ ...(template.elements || []), newElement ];
    const updatedTemplate = { ...template, elements: updatedElements };

    saveTemplate(updatedTemplate);
    setTemplate(updatedTemplate);
    if (nestedParent) {
      setNestedParent(updatedElements.find(element => element.id === nestedParent.id));
    }
    setNewElementName("");
    setIsAddingElement(false);
    setSelectedEventTarget(null);
    if (timestamp !== null) {
      const parentElement = nestedParent
        ? updatedElements.find(element => element.id === nestedParent.id)
        : null;
      recordAction(newElement, parentElement);
      setNestedParent(null);
    }
  }

  function stopStudy() {
    if (timestamp === null) return;

    const endTime = Date.now();
    const sessionDuration = endTime - timestamp;
    const subjectNumber = Number(selectedSubjectNumber);
    const sessionId = String(endTime);

    setClockNow(endTime);
    saveStudySession({
      id: sessionId,
      templateId: template.id,
      templateName: template.name,
      subjectId: `${template.id}:${subjectNumber}`,
      subjectNumber,
      startTime: timestamp,
      endTime,
      durationMs: sessionDuration,
      events: actionEvents
    });
    if (selectedEventTarget?.source === "current") {
      setSelectedEventTarget({
        source: "saved",
        sessionId,
        index: selectedEventTarget.index
      });
    }
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

  const columns = Math.max(1, Math.min(12, Number(template?.columns) || 3));
  const rowHeightLines = Math.max(1, Math.min(8, Number(template?.rowHeightLines) || 2));
  const currentElements = nestedParent?.children || template?.elements || [];
  const elementPositions = currentElements.map((element, index) =>
    Number.isInteger(element.position) && element.position >= 0 ? element.position : index
  );
  const minimumGridRows = Math.max(
    1,
    Math.ceil((Math.max(-1, ...elementPositions) + 1) / columns)
  );
  const rowHeight = Math.max(44, rowHeightLines * 16.1 + 16);
  const { gridRef, gridRows } = useAvailableGridRows(minimumGridRows, rowHeight);
  const elementsByPosition = new Map(currentElements.map((element, index) => [
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
  const previousEvents = previousSessions.flatMap((session, sessionIndex) => {
    const events = Array.isArray(session.events) ? session.events : [];
    const sessionEvents = events.map((event, index) => ({
      event,
      target: { source: "saved", sessionId: session.id, index }
    }));
    if (sessionIndex === 0 || events.some(event => event.type === "gap")) return sessionEvents;

    return [
      { event: { type: "gap", name: "Gap in data", timestamp: session.startTime }, target: null },
      ...sessionEvents
    ];
  });
  const currentEvents = actionEvents.map((event, index) => ({
    event,
    target: { source: "current", index }
  }));
  const visibleEvents = [ ...previousEvents, ...currentEvents ];
  const visibleActionCount = visibleEvents.filter(item => item.event.type !== "gap").length;

  return (
    <main className="study-page">
      {template ? (
        <>
          <header className="study-appbar">
            <button
              className="study-menu-button"
              type="button"
              onClick={() => nestedParent ? setNestedParent(null) : navigate("/")}
            >
              {nestedParent ? "Back" : "Menu"}
            </button>
            <div className="study-appbar-subject">
              <select
                id="study-subject"
                aria-label="Subject"
                value={selectedSubjectNumber}
                disabled={timestamp !== null}
                onChange={event => {
                  setSelectedSubjectNumber(event.target.value);
                  setActionEvents([]);
                  setSelectedEventTarget(null);
                  setNestedParent(null);
                }}
              >
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.number}>Subject {subject.number}</option>
                ))}
              </select>
            </div>
            <h1>{nestedParent?.name || template.name}</h1>
            <button
              className={`record-button${timestamp !== null ? " is-recording" : ""}`}
              type="button"
              aria-label={timestamp !== null ? "Stop and save study" : "Start study"}
              title={timestamp !== null ? "Stop and save study" : "Start study"}
              onClick={timestamp !== null ? stopStudy : startStudy}
            >
              <span className="record-indicator" aria-hidden="true" />
              {timestamp !== null ? "Stop" : "Start"}
            </button>
          </header>
          <div
            ref={gridRef}
            className="study-action-grid"
            role="grid"
            aria-label={nestedParent ? `${nestedParent.name} subbuttons` : "Study actions"}
            style={gridStyle}
          >
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
                      className={`study-action-tile${!nestedParent && element.children?.length > 0 ? " is-nested" : ""}`}
                      disabled={timestamp === null && !selectedEventTarget}
                      type="button"
                      style={{
                        backgroundColor: element.backgroundColor || "#dedede",
                        color: element.textColor || "#111111",
                        fontFamily: element.fontFamily || "Arial, sans-serif"
                      }}
                      onClick={() => {
                        if (!nestedParent && element.children?.length > 0) {
                          setNestedParent(element);
                          return;
                        }

                        if (!selectReplacementElement(element, nestedParent)) {
                          recordAction(element, nestedParent);
                        }
                        setNestedParent(null);
                      }}
                    >
                      {element.name}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            className="template-add-button study-add-button"
            type="button"
            onClick={() => {
              setNewElementName("");
              setIsAddingElement(true);
            }}
          >
            + Add button
          </button>
          {currentElements.length === 0 && <p>This template has no action buttons.</p>}
          <section
            className={`study-observation-log${timestamp !== null ? " is-recording" : ""}`}
            aria-label="Recorded observation log"
          >
            {timestamp !== null && (
              <div className="study-readout" role="status">
                <span>RECORDING</span>
                <strong>{formatClock(clockNow - timestamp)}</strong>
                <span>{visibleActionCount} actions</span>
              </div>
            )}
            <div className="observation-log-heading">
              <div className="observation-log-title">
                <h2>Observation log</h2>
                {selectedEventTarget && <span>Select a button to replace this action</span>}
              </div>
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
              <ol className="observation-log-list" ref={observationLogRef}>
                {visibleEvents.map(({ event, target }, index) => {
                  const eventKey = `${event.timestamp}-${index}`;
                  const isSelectedForReplacement =
                    selectedEventTarget?.source === target?.source &&
                    selectedEventTarget?.sessionId === target?.sessionId &&
                    selectedEventTarget?.index === target?.index;
                  return (
                    <li className="observation-log-entry" key={eventKey}>
                      {event.type === "gap" ? (
                        <span className="gap-in-data">Gap in data</span>
                      ) : (
                        <>
                          <button
                            className={`observation-action-name${isSelectedForReplacement ? " is-selected" : ""}`}
                            type="button"
                            aria-pressed={isSelectedForReplacement}
                            onClick={() => setSelectedEventTarget(isSelectedForReplacement ? null : target)}
                          >
                            {event.elementPrime
                              ? `${event.elementPrime}${event.elementSub ? ` / ${event.elementSub}` : ""}`
                              : event.name}
                          </button>
                          <time dateTime={new Date(event.timestamp).toISOString()}>
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </time>
                          <label className="study-count-control">
                            Count:
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={event.count ?? 1}
                              onChange={changeEvent => updateEventTarget(target, {
                                count: changeEvent.target.value === "" ? "" : Number(changeEvent.target.value)
                              })}
                            />
                          </label>
                          <button
                            className={`study-note-button${event.note ? " has-note" : ""}`}
                            type="button"
                            aria-label={event.note ? "Edit note" : "Add note"}
                            title={event.note ? "Edit note" : "Add note"}
                            disabled={!target}
                            onClick={() => setNoteEditor({
                              target,
                              note: event.note || ""
                            })}
                          >
                            <svg viewBox="0 0 20 20" aria-hidden="true">
                              <path d="M4 2.5h12v15H4zM7 6h6M7 9h6M7 12h4" />
                            </svg>
                          </button>
                          </>
                        )}
                      </li>
                  );
                  })}
              </ol>
            )}
            {noteEditor && (
              <div
                  className="study-note-backdrop"
                  onClick={() => setNoteEditor(null)}
              >
                  <section
                    className="study-note-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="study-note-title"
                    onClick={event => event.stopPropagation()}
                  >
                    <h2 id="study-note-title">Action note</h2>
                    <textarea
                      className="study-note-input"
                      autoFocus
                      aria-label="Action note"
                      value={noteEditor.note}
                      onChange={event => setNoteEditor(current => ({
                        ...current,
                        note: event.target.value
                      }))}
                      placeholder="Add a note"
                    />
                    <div className="study-note-dialog-actions">
                      <button type="button" onClick={() => setNoteEditor(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateEventTarget(noteEditor.target, { note: noteEditor.note });
                          setNoteEditor(null);
                        }}
                      >
                        OK
                      </button>
                    </div>
                  </section>
              </div>
            )}
            {isAddingElement && (
              <div
                className="study-note-backdrop"
                onClick={() => setIsAddingElement(false)}
              >
                <form
                  className="study-note-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="study-add-title"
                  onSubmit={addElement}
                  onClick={event => event.stopPropagation()}
                >
                  <h2 id="study-add-title">Add study button</h2>
                  <label htmlFor="study-add-name">Button name</label>
                  <input
                    id="study-add-name"
                    className="study-add-name"
                    autoFocus
                    value={newElementName}
                    onChange={event => setNewElementName(event.target.value)}
                    placeholder="Enter an element name"
                  />
                  <div className="study-note-dialog-actions">
                    <button type="button" onClick={() => setIsAddingElement(false)}>
                      Cancel
                    </button>
                    <button type="submit" disabled={!newElementName.trim()}>
                      OK
                    </button>
                  </div>
                </form>
              </div>
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