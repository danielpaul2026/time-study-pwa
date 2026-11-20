import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  createStudyEventId,
  getStudySessions,
  getVisibleStudyEvents,
  getStudySubjects,
  getTemplates,
  mergeStudyEvents,
  mergeStudySessionEvents,
  saveStudySession,
  saveTemplate,
  updateStudySessionEvent,
  updateStudySessionScopeNote
} from "../data/studyStore";
import useAvailableGridRows from "../hooks/useAvailableGridRows";

function matchesEventTarget(first, second) {
  return first?.source === second?.source &&
    first?.index === second?.index &&
    first?.sessionId === second?.sessionId &&
    first?.eventId === second?.eventId;
}

function canMergeEntries(sourceEntry, destinationEntry) {
  if (!sourceEntry?.target || !destinationEntry?.target) return false;
  if (sourceEntry.target.source !== destinationEntry.target.source) return false;
  return sourceEntry.target.source !== "saved" ||
    sourceEntry.target.sessionId === destinationEntry.target.sessionId;
}

function getEventName(event) {
  return event.elementPrime
    ? `${event.elementPrime}${event.elementSub ? ` { ${event.elementSub}` : ""}`
    : event.name;
}

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
  const [ placeholderActionFields, setPlaceholderActionFields ] = useState({ count: null, note: "" });
  const [ placeholderTimestamp, setPlaceholderTimestamp ] = useState(null);
  const [ clockNow, setClockNow ] = useState(0);
  const [ studySessions, setStudySessions ] = useState(() => getStudySessions());
  const [ nestedParent, setNestedParent ] = useState(null);
  const [ noteEditor, setNoteEditor ] = useState(null);
  const [ selectedEventTarget, setSelectedEventTarget ] = useState(null);
  const [ pendingMergeTarget, setPendingMergeTarget ] = useState(null);
  const [ isAddingElement, setIsAddingElement ] = useState(false);
  const [ newElementName, setNewElementName ] = useState("");
  const [ addPosition, setAddPosition ] = useState(null);
  const [ observationLogHeight, setObservationLogHeight ] = useState(null);
  const [ isObservationLogExpanded, setIsObservationLogExpanded ] = useState(true);
  const studyPageRef = useRef(null);
  const studyAppbarRef = useRef(null);
  const studyLogSectionRef = useRef(null);
  const logResizeStart = useRef(null);
  const observationLogRef = useRef(null);

  useEffect(() => {
    if (timestamp === null) return undefined;

    const intervalId = window.setInterval(() => setClockNow(Date.now()), 10);
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
    setPlaceholderTimestamp(startTime);
    setPlaceholderActionFields({ count: null, note: "" });
    setActionEvents(hasPreviousData
      ? [{
          type: "gap",
          name: `Study ${previousSessions.length + 1}`,
          note: "",
          timestamp: startTime
        }]
      : []);
  }

  function recordAction(element, parentElement = null) {
    if (timestamp === null) return;

    const eventTimestamp = Date.now();
    const describedElement = describeElement(element, parentElement);
    const actionEvent = {
      id: createStudyEventId(),
      ...describedElement,
      count: placeholderActionFields.count ?? describedElement.count,
      note: placeholderActionFields.note,
      timestamp: eventTimestamp
    };
    setPlaceholderActionFields({ count: null, note: "" });
    setPlaceholderTimestamp(eventTimestamp);

    if (pendingMergeTarget) {
      const mergedEvents = mergeStudyEvents(
        [ ...actionEvents, actionEvent ],
        pendingMergeTarget.eventId,
        actionEvent.id
      );
      if (!mergedEvents) {
        throw new Error(`Unable to merge pending study event ${pendingMergeTarget.eventId} into ${actionEvent.id}.`);
      }

      setActionEvents(mergedEvents);
      setPendingMergeTarget(null);
      setSelectedEventTarget(null);
      return;
    }

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
    if (target.source === "saved-study") {
      if (!updateStudySessionScopeNote(target.sessionId, changes.note || "")) {
        throw new Error(`Unable to update scope note for study session ${target.sessionId}.`);
      }
      setStudySessions(getStudySessions());
      return;
    }
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
    if (pendingMergeTarget) {
      recordAction(element, parentElement);
      setNestedParent(null);
      return true;
    }
    if (!selectedEventTarget) return false;
    updateEventTarget(selectedEventTarget, describeElement(element, parentElement));
    setSelectedEventTarget(null);
    setPendingMergeTarget(null);
    setNestedParent(null);
    return true;
  }

  function mergeSelectedActionInto(destinationEntry) {
    if (!canMergeEntries(selectedLogEntry, destinationEntry)) return;

    const sourceTarget = selectedLogEntry.target;
    const destinationTarget = destinationEntry.target;

    if (sourceTarget.source === "current") {
      const mergedEvents = mergeStudyEvents(
        actionEvents,
        sourceTarget.eventId,
        destinationTarget.eventId
      );
      if (!mergedEvents) {
        throw new Error(`Unable to merge study events ${sourceTarget.eventId} and ${destinationTarget.eventId}.`);
      }
      setActionEvents(mergedEvents);
    } else if (!mergeStudySessionEvents(
      sourceTarget.sessionId,
      sourceTarget.eventId,
      destinationTarget.eventId
    )) {
      throw new Error(`Unable to merge study events ${sourceTarget.eventId} and ${destinationTarget.eventId}.`);
    } else {
      setStudySessions(getStudySessions());
    }

    setSelectedEventTarget(null);
    setPendingMergeTarget(null);
  }

  function addElement(event) {
    event.preventDefault();
    const name = newElementName.trim();
    if (!name) return;

    const visibleElements = nestedParent?.children || template.elements || [];
    const occupiedPositions = new Set(visibleElements.map((element, index) =>
      Number.isInteger(element.position) && element.position >= 0 ? element.position : index
    ));
    let position = addPosition;
    if (position === null || occupiedPositions.has(position)) {
      position = 0;
      while (occupiedPositions.has(position)) position += 1;
    }

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
    setAddPosition(null);
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
        index: selectedEventTarget.index,
        eventId: selectedEventTarget.eventId
      });
    }
    setPendingMergeTarget(null);
    setStudySessions(getStudySessions());
    setActionEvents([]);
    setPlaceholderActionFields({ count: null, note: "" });
    setPlaceholderTimestamp(null);
    setTimestamp(null);
  }

  function formatStudyTime(milliseconds) {
    const totalCentiseconds = Math.max(0, Math.floor(milliseconds / 10));
    const totalSeconds = Math.floor(totalCentiseconds / 100);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = totalCentiseconds % 100;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }

  function formatElapsedTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function getObservationLogHeightBounds() {
    const pageHeight = studyPageRef.current?.clientHeight || window.innerHeight;
    const appbarHeight = studyAppbarRef.current?.getBoundingClientRect().height || 48;
    const resizeHandleHeight = 14;
    const minimumGridHeight = 100;
    const minimumLogHeight = 100;

    return {
      minimum: minimumLogHeight,
      maximum: Math.max(
        minimumLogHeight,
        pageHeight - appbarHeight - resizeHandleHeight - minimumGridHeight
      )
    };
  }

  function clampObservationLogHeight(height) {
    const bounds = getObservationLogHeightBounds();
    return Math.max(bounds.minimum, Math.min(bounds.maximum, height));
  }

  function startObservationLogResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    logResizeStart.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: studyLogSectionRef.current?.getBoundingClientRect().height || 180
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveObservationLogResize(event) {
    const start = logResizeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setObservationLogHeight(clampObservationLogHeight(start.startHeight - (event.clientY - start.startY)));
  }

  function endObservationLogResize(event) {
    if (logResizeStart.current?.pointerId !== event.pointerId) return;
    logResizeStart.current = null;
  }

  function resizeObservationLogByKeyboard(event) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const currentHeight = studyLogSectionRef.current?.getBoundingClientRect().height || 180;
    const adjustment = event.key === "ArrowUp" ? 20 : -20;
    setObservationLogHeight(clampObservationLogHeight(currentHeight + adjustment));
  }

  const columns = Math.max(1, Math.min(12, Number(template?.columns) || 2));
  const rowHeightLines = Math.max(1, Math.min(8, Number(template?.rowHeightLines) || 5));
  const currentElements = nestedParent?.children || template?.elements || [];
  const configuredRows = nestedParent?.childrenRows ?? template?.rows;
  const elementPositions = currentElements.map((element, index) =>
    Number.isInteger(element.position) && element.position >= 0 ? element.position : index
  );
  const legacyMinimumRows = Math.max(
    3,
    Math.ceil(Math.max(currentElements.length, Math.max(-1, ...elementPositions) + 1) / columns)
  );
  const savedRows = Number(configuredRows);
  const minimumGridRows = Math.max(
    1,
    Math.min(50, Number.isInteger(savedRows) && savedRows > 0 ? savedRows : legacyMinimumRows),
    Math.ceil((Math.max(-1, ...elementPositions) + 1) / columns)
  );
  const rowHeight = Math.max(44, rowHeightLines * 16.1 + 16);
  const { gridRef, gridRows: availableGridRows } = useAvailableGridRows(minimumGridRows, rowHeight);
  const gridRows = Number(configuredRows) > 0 ? minimumGridRows : availableGridRows;
  const elementsByPosition = new Map(currentElements.map((element, index) => [
    Number.isInteger(element.position) && element.position >= 0 ? element.position : index,
    element
  ]));
  const hasEmptyGridCell = elementsByPosition.size < gridRows * columns;
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
    const sessionEvents = getVisibleStudyEvents(events).map(({ event, sourceEvent, index }) => ({
      event,
      sourceEvent,
      sessionStartTime: session.startTime,
      studyNumber: sessionIndex + 1,
      target: event.type === "gap"
        ? { source: "saved", sessionId: session.id, index, eventId: sourceEvent.id }
        : { source: "saved", sessionId: session.id, index, eventId: sourceEvent.id }
    }));
    if (sessionIndex === 0 || events.some(event => event.type === "gap")) return sessionEvents;

    return [
      {
        event: {
          type: "gap",
          name: `Study ${sessionIndex + 1}`,
          note: session.scopeNote || "",
          timestamp: session.startTime
        },
        sourceEvent: { id: `study-${session.id}`, count: 1, note: session.scopeNote || "" },
        studyNumber: sessionIndex + 1,
        target: { source: "saved-study", sessionId: session.id, studyNumber: sessionIndex + 1 }
      },
      ...sessionEvents
    ];
  });
  const currentEvents = getVisibleStudyEvents(actionEvents).map(({ event, sourceEvent, index }) => ({
    event,
    sourceEvent,
    sessionStartTime: timestamp,
    studyNumber: previousSessions.length + 1,
    target: { source: "current", index, eventId: sourceEvent.id }
  }));
  const placeholderEvent = timestamp !== null
    ? [{
        event: {
          type: "placeholder",
          name: "<Select Action>",
          count: placeholderActionFields.count,
          note: placeholderActionFields.note,
          timestamp
        },
        sourceEvent: {
          id: "placeholder",
          count: placeholderActionFields.count,
          note: placeholderActionFields.note
        },
        sessionStartTime: timestamp,
        target: { source: "placeholder" }
      }]
    : [];
  const allVisibleEvents = [ ...previousEvents, ...currentEvents, ...placeholderEvent ];
  const actionItems = allVisibleEvents.filter(item =>
    item.event.type !== "gap" && item.event.type !== "placeholder"
  );
  let visibleEvents;
  if (timestamp !== null && !isObservationLogExpanded) {
    visibleEvents = [
      ...(actionItems.length ? [ actionItems[actionItems.length - 1] ] : []),
      ...placeholderEvent
    ];
  } else if (timestamp === null && !isObservationLogExpanded) {
    visibleEvents = actionItems.length ? [ actionItems[actionItems.length - 1] ] : [];
  } else {
    visibleEvents = allVisibleEvents;
  }
  const selectedLogIndex = visibleEvents.findIndex(item =>
    matchesEventTarget(item.target, selectedEventTarget)
  );
  const selectedLogEntry = selectedLogIndex >= 0 ? visibleEvents[selectedLogIndex] : null;
  const previousLogEntry = selectedLogIndex > 0 && visibleEvents[selectedLogIndex - 1].event.type !== "gap"
    ? visibleEvents[selectedLogIndex - 1]
    : null;
  const nextLogEntry = selectedLogIndex >= 0 &&
    selectedLogIndex < visibleEvents.length - 1 &&
    visibleEvents[selectedLogIndex + 1].event.type !== "gap"
    ? visibleEvents[selectedLogIndex + 1]
    : null;
  const canMergePrevious = canMergeEntries(selectedLogEntry, previousLogEntry);
  const canMergeNext = canMergeEntries(selectedLogEntry, nextLogEntry);
  const canMergeWithNextAction = timestamp !== null &&
    selectedLogEntry?.target.source === "current" &&
    selectedLogIndex === visibleEvents.length - 1;
  const visibleActionCount = visibleEvents.filter(item =>
    item.event.type !== "gap" && item.event.type !== "placeholder"
  ).length;
  const observationLogHeightBounds = getObservationLogHeightBounds();
  const observationLogHeightValue = observationLogHeight ??
    (timestamp !== null ? 180 : 218);

  return (
    <main className="study-page" ref={studyPageRef}>
      {template ? (
        <>
          <header className="study-appbar" ref={studyAppbarRef}>
            <button
              className="study-menu-button"
              type="button"
              disabled={timestamp !== null}
              onClick={() => nestedParent ? setNestedParent(null) : navigate("/")}
            >
              {nestedParent ? "Back" : "Menu"}
            </button>
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
                  {element ? (
                    <button
                      className={`study-action-tile${!nestedParent && (element.isNested || element.children?.length > 0) ? " is-nested" : ""}`}
                      disabled={timestamp === null && !selectedEventTarget}
                      type="button"
                      style={{
                        backgroundColor: element.backgroundColor || "#dedede",
                        color: element.textColor || "#111111",
                        fontFamily: "Arial, sans-serif",
                        fontSize: `${Number.isFinite(Number(element.fontSize)) ? Number(element.fontSize) : 16}px`,
                        fontWeight: Number.isFinite(Number(element.fontWeight)) ? Number(element.fontWeight) : 400,
                        fontStyle: element.fontStyle === "italic" ? "italic" : "normal"
                      }}
                      onClick={() => {
                        if (!nestedParent && (element.isNested || element.children?.length > 0)) {
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
                  ) : (
                    <button
                      className="study-action-tile grid-add-cell"
                      type="button"
                      aria-label={`Add button in empty cell ${cellIndex + 1}`}
                      onClick={() => {
                        setAddPosition(cellIndex);
                        setNewElementName("");
                        setIsAddingElement(true);
                      }}
                    >
                      &lt;Add&gt;
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div
            className={`study-log-resize-handle${isObservationLogExpanded ? "" : " is-hidden"}`}
            role="separator"
            aria-label="Resize observation log"
            aria-orientation="horizontal"
            aria-controls="study-observation-log"
            aria-valuemin={observationLogHeightBounds.minimum}
            aria-valuemax={observationLogHeightBounds.maximum}
            aria-valuenow={Math.round(observationLogHeightValue)}
            tabIndex={0}
            onPointerDown={startObservationLogResize}
            onPointerMove={moveObservationLogResize}
            onPointerUp={endObservationLogResize}
            onPointerCancel={endObservationLogResize}
            onLostPointerCapture={endObservationLogResize}
            onKeyDown={resizeObservationLogByKeyboard}
          />
          <section
            ref={studyLogSectionRef}
            id="study-observation-log"
            className={`study-observation-log${timestamp !== null ? " is-recording" : ""}${isObservationLogExpanded ? "" : " is-minimized"}`}
            aria-label="Recorded observation log"
            style={!isObservationLogExpanded
              ? { flexBasis: `${timestamp !== null ? 122 : 84}px` }
              : observationLogHeight === null ? undefined : { flexBasis: `${observationLogHeight}px` }}
          >
            <div className={`observation-log-heading${timestamp !== null ? " is-running" : ""}`}>
              {timestamp === null && (
                <>
                  <div className="observation-log-actions">
                    <button
                      className="observation-results-button"
                      type="button"
                      onClick={() => navigate(`/Results?templateId=${encodeURIComponent(template.id)}&subjectNumber=${selectedSubjectNumber}`)}
                    >
                      Results
                    </button>
                    {!hasEmptyGridCell && (
                      <button
                        className="observation-log-add"
                        type="button"
                        onClick={() => {
                          setAddPosition(null);
                          setNewElementName("");
                          setIsAddingElement(true);
                        }}
                      >
                        &lt;Add&gt;
                      </button>
                    )}
                  </div>
                  <div className="observation-log-subject">
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
                </>
              )}
              <div className="observation-log-title">
                {selectedEventTarget && (
                  <span>
                    {pendingMergeTarget
                      ? "Tap the next study button to complete the merge"
                      : "Select a button to replace this action"}
                  </span>
                )}
                <button
                  className="observation-log-toggle"
                  type="button"
                  aria-expanded={isObservationLogExpanded}
                  aria-controls="study-observation-log"
                  onClick={() => setIsObservationLogExpanded(expanded => !expanded)}
                >
                  <span className="observation-log-heading-label">Observation log</span>
                  <span
                    className="observation-log-toggle-icon"
                    aria-hidden="true"
                  >
                    {isObservationLogExpanded ? "\\vvv/" : "/^^^\\"}
                  </span>
                </button>
                {timestamp !== null && (
                  <span className="study-observation-timer" role="timer">
                    <span>Study:</span>
                    <strong>{formatStudyTime(clockNow - timestamp)}</strong>
                  </span>
                )}
              </div>
            </div>
            {visibleEvents.length === 0 ? (
              <p className="observation-log-empty">Recorded actions appear here during capture.</p>
            ) : (
              <ol className="observation-log-list" ref={observationLogRef}>
                {visibleEvents.map(({ event, sourceEvent, sessionStartTime, target, studyNumber }, index) => {
                  const eventKey = `${event.timestamp}-${index}`;
                  const isPlaceholderAction = event.type === "placeholder";
                  const isStudyMarker = event.type === "gap";
                  const isSelectedForReplacement =
                    selectedEventTarget?.source === target?.source &&
                    selectedEventTarget?.sessionId === target?.sessionId &&
                    selectedEventTarget?.index === target?.index;
                  return (
                    <li
                      className={`observation-log-entry${isPlaceholderAction ? " is-placeholder" : ""}${isStudyMarker ? " is-study-marker" : ""}`}
                      key={eventKey}
                    >
                      {isStudyMarker ? (
                        <>
                          <span className="gap-in-data">Study {studyNumber ?? 1}</span>
                          <button
                            className={`study-note-button${event.note ? " has-note" : ""}`}
                            type="button"
                            aria-label="Edit study scope notes"
                            title="Edit study scope notes"
                            disabled={!target}
                            onClick={() => setNoteEditor({
                              target,
                              count: 1,
                              note: sourceEvent?.note || event.note || ""
                            })}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 16.5h-8l-5.5 3v-3H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5Z" />
                              <path d="M7.5 8h9M7.5 11h6" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className={`observation-action-name${isSelectedForReplacement ? " is-selected" : ""}`}
                            type="button"
                            aria-pressed={isSelectedForReplacement}
                            disabled={isPlaceholderAction}
                            onClick={() => {
                              setPendingMergeTarget(null);
                              setSelectedEventTarget(isSelectedForReplacement ? null : target);
                            }}
                          >
                            {getEventName(event)}
                          </button>
                          <button
                            className={`study-note-button${event.note ? " has-note" : ""}`}
                            type="button"
                            aria-label="Edit action count and note"
                            title="Edit action count and note"
                            disabled={!target && !isPlaceholderAction}
                            onClick={() => setNoteEditor({
                              target,
                              count: sourceEvent.count ?? 1,
                              note: sourceEvent.note || ""
                            })}
                          >
                            <svg viewBox="0 0 20 20" aria-hidden="true">
                              <path d="M4 3.5h12a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 16 14.5H9l-5 3v-3H4A1.5 1.5 0 0 1 2.5 13V5A1.5 1.5 0 0 1 4 3.5Z" />
                              <path d="M6 7h8M6 10h5" />
                            </svg>
                          </button>
                          <span className="observation-elapsed">
                            {isPlaceholderAction
                              ? formatElapsedTime(clockNow - Number(placeholderTimestamp ?? timestamp))
                              : formatElapsedTime(event.timestamp - Number(sessionStartTime ?? event.timestamp))}
                          </span>
                          <time dateTime={new Date(event.timestamp).toISOString()}>
                            {isPlaceholderAction
                              ? `${visibleActionCount} ${visibleActionCount === 1 ? "action" : "actions"}`
                              : new Date(event.timestamp).toLocaleTimeString()}
                          </time>
                          </>
                        )}
                      </li>
                  );
                  })}
              </ol>
            )}
            {selectedLogEntry && (
              <div
              className="study-merge-overlay"
              onClick={() => {
                setSelectedEventTarget(null);
                setPendingMergeTarget(null);
              }}
              >
              <section
                className="study-merge-dialog"
                role="dialog"
                aria-modal="false"
                aria-labelledby="study-merge-title"
                onClick={event => event.stopPropagation()}
              >
                <div className="study-merge-source">
                  <h2 id="study-merge-title">Editing action</h2>
                  <strong>{getEventName(selectedLogEntry.event)}</strong>
                  <span>Count: {selectedLogEntry.event.count ?? 1}</span>
                  <small>
                    {pendingMergeTarget
                      ? "Tap the next study button to complete the merge"
                      : "Select a button to replace this action"}
                  </small>
                </div>
                <div className="study-merge-options">
                  <h2>Merge to:</h2>
                  <button
                    type="button"
                    disabled={!canMergePrevious}
                    aria-label={previousLogEntry
                      ? `Merge to previous action: ${getEventName(previousLogEntry.event)}`
                      : "No previous action to merge to"}
                    onClick={() => mergeSelectedActionInto(previousLogEntry)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 19V5m-6 6 6-6 6 6" />
                    </svg>
                    <span>
                      <span>Previous:</span>
                      <strong>{previousLogEntry
                        ? getEventName(previousLogEntry.event)
                        : "<No Previous Action>"}</strong>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={pendingMergeTarget !== null || (!canMergeNext && !canMergeWithNextAction)}
                    aria-label={nextLogEntry
                      ? `Merge to next action: ${getEventName(nextLogEntry.event)}`
                      : canMergeWithNextAction
                        ? "Merge to the next action when it is recorded"
                        : "No next action to merge to"}
                    onClick={() => {
                      if (nextLogEntry) {
                        mergeSelectedActionInto(nextLogEntry);
                      } else if (canMergeWithNextAction) {
                        setPendingMergeTarget(selectedLogEntry.target);
                      }
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 5v14m6-6-6 6-6-6" />
                    </svg>
                    <span>
                      <span>Next:</span>
                      <strong>{nextLogEntry
                        ? getEventName(nextLogEntry.event)
                        : canMergeWithNextAction ? "<Next Action>" : "<No Next Action>"}</strong>
                      {pendingMergeTarget && <small>Waiting for next action</small>}
                    </span>
                  </button>
                </div>
                <button
                  className="study-merge-cancel"
                  type="button"
                  onClick={() => {
                    setSelectedEventTarget(null);
                    setPendingMergeTarget(null);
                  }}
                >
                  Cancel
                </button>
              </section>
              </div>
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
                    <div className="study-note-dialog-header">
                      <button type="button" onClick={() => setNoteEditor(null)}>
                        Cancel
                      </button>
                      <h2 id="study-note-title">Fields</h2>
                      <button
                        type="button"
                        onClick={() => {
                          if (noteEditor.target?.source === "placeholder") {
                            setPlaceholderActionFields({
                              count: noteEditor.count,
                              note: noteEditor.note
                            });
                            setNoteEditor(null);
                            return;
                          }
                          updateEventTarget(noteEditor.target, {
                            count: noteEditor.count,
                            note: noteEditor.note
                          });
                          setNoteEditor(null);
                        }}
                      >
                        OK
                      </button>
                    </div>
                    <div className="study-action-field">
                      <label htmlFor="study-action-count">Count:</label>
                      <input
                        id="study-action-count"
                        className="study-add-name"
                        type="number"
                        min="0"
                        step="any"
                        autoFocus
                        value={noteEditor.count}
                        onChange={event => setNoteEditor(current => ({
                          ...current,
                          count: event.target.value === "" ? "" : Number(event.target.value)
                        }))}
                      />
                    </div>
                    <div className="study-action-field study-action-note-field">
                      <label htmlFor="study-action-note">Note:</label>
                      <textarea
                        className="study-note-input"
                        id="study-action-note"
                        aria-label="Action note"
                        value={noteEditor.note}
                        onChange={event => setNoteEditor(current => ({
                          ...current,
                          note: event.target.value
                        }))}
                        placeholder="Add a note"
                      />
                    </div>
                  </section>
              </div>
            )}
            {isAddingElement && (
              <div
                className="study-note-backdrop"
                onClick={() => {
                  setIsAddingElement(false);
                  setAddPosition(null);
                }}
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
                    <button type="button" onClick={() => {
                      setIsAddingElement(false);
                      setAddPosition(null);
                    }}>
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