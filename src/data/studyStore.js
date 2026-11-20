const TEMPLATE_STORAGE_KEY = "time-study-templates";
const SESSION_STORAGE_KEY = "time-study-sessions";

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function getTemplates() {
  return readList(TEMPLATE_STORAGE_KEY);
}

export function saveTemplate(template) {
  const templates = getTemplates();
  const existingIndex = templates.findIndex(item => item.id === template.id);

  if (existingIndex < 0) {
    templates.push(template);
  } else {
    templates[existingIndex] = template;
  }

  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

export function deleteTemplate(templateId) {
  const templates = getTemplates().filter(template => template.id !== templateId);
  const sessions = getStudySessions().filter(session => session.templateId !== templateId);
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

export function getStudySessions() {
  return readList(SESSION_STORAGE_KEY).map(normalizeStudySession);
}

function normalizeStudySession(session) {
  if (!Array.isArray(session.events)) return session;

  return {
    ...session,
    events: session.events.map((event, index) => (
      typeof event.id === "string" && event.id
        ? event
        : { ...event, id: `${session.id}:event:${index}` }
    ))
  };
}

export function createStudyEventId() {
  return globalThis.crypto?.randomUUID?.() ||
    `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createMergeGraph(events) {
  const eventById = new Map(events.map(event => [ event.id, event ]));
  const eventIndexById = new Map(events.map((event, index) => [ event.id, index ]));
  const sourcesByDestination = new Map();
  events.forEach(event => {
    if (!event.mergedInto || !eventById.has(event.mergedInto)) return;
    const sources = sourcesByDestination.get(event.mergedInto) || [];
    sources.push(event);
    sourcesByDestination.set(event.mergedInto, sources);
  });

  return { eventById, eventIndexById, sourcesByDestination };
}

function getMergedSources(graph, destinationId) {
  const mergedSources = [];
  const visited = new Set([ destinationId ]);
  const destinations = [ destinationId ];
  while (destinations.length) {
    const currentDestinationId = destinations.shift();
    const destination = graph.eventById.get(currentDestinationId);
    (graph.sourcesByDestination.get(currentDestinationId) || []).forEach(event => {
      if (visited.has(event.id)) return;
      visited.add(event.id);
      mergedSources.push({ event, destination });
      destinations.push(event.id);
    });
  }

  return mergedSources.sort((first, second) =>
    graph.eventIndexById.get(first.event.id) - graph.eventIndexById.get(second.event.id)
  );
}

export function getMergedStudyEventSources(events, destinationId) {
  return getMergedSources(createMergeGraph(events), destinationId);
}

function getMergedEventFromGraph(graph, destination) {
  const mergedSources = getMergedSources(graph, destination.id);
  const groupedEvents = [ destination, ...mergedSources.map(source => source.event) ];
  const timestamps = groupedEvents
    .map(event => Number(event.timestamp))
    .filter(Number.isFinite);
  const notes = [
    destination.note,
    ...mergedSources.map(source => source.event.note ? `Merged: ${source.event.note}` : "")
  ].filter(Boolean);

  return {
    ...destination,
    timestamp: timestamps.length ? Math.min(...timestamps) : destination.timestamp,
    note: notes.join("\n")
  };
}

export function getMergedStudyEvent(events, destination) {
  return getMergedEventFromGraph(createMergeGraph(events), destination);
}

export function getVisibleStudyEvents(events) {
  const graph = createMergeGraph(events);
  return events.flatMap((sourceEvent, index) => {
    if (sourceEvent.mergedInto && graph.eventById.has(sourceEvent.mergedInto)) return [];
    return [{
      event: getMergedEventFromGraph(graph, sourceEvent),
      sourceEvent,
      index
    }];
  });
}

export function mergeStudyEvents(events, sourceEventId, destinationEventId) {
  if (!Array.isArray(events) || sourceEventId === destinationEventId) return null;

  const sourceEvent = events.find(event => event.id === sourceEventId);
  const destinationEvent = events.find(event => event.id === destinationEventId);
  const visibleEvents = getVisibleStudyEvents(events);
  const sourcePosition = visibleEvents.findIndex(item => item.sourceEvent.id === sourceEventId);
  const destinationPosition = visibleEvents.findIndex(item => item.sourceEvent.id === destinationEventId);
  if (
    !sourceEvent ||
    !destinationEvent ||
    Math.abs(sourcePosition - destinationPosition) !== 1 ||
    sourceEvent.type === "gap" ||
    destinationEvent.type === "gap" ||
    sourceEvent.mergedInto ||
    destinationEvent.mergedInto
  ) {
    return null;
  }

  return events.map(event => event.id === sourceEventId
    ? { ...event, mergedInto: destinationEventId }
    : event
  );
}

export function getStudySubjects(templateId) {
  return Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    return {
      id: `${templateId}:${number}`,
      templateId,
      number
    };
  });
}

export function saveStudySession(session) {
  const sessions = getStudySessions();
  sessions.unshift(normalizeStudySession(session));
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

export function updateStudySessionEvent(sessionId, eventIndex, changes) {
  const sessions = getStudySessions();
  const session = sessions.find(item => item.id === sessionId);
  if (!session || !Array.isArray(session.events) || !session.events[eventIndex]) {
    return false;
  }
  session.events[eventIndex] = { ...session.events[eventIndex], ...changes };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  return true;
}

export function updateStudySessionScopeNote(sessionId, note) {
  const sessions = getStudySessions();
  const session = sessions.find(item => item.id === sessionId);
  if (!session) return false;
  session.scopeNote = note;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  return true;
}

export function mergeStudySessionEvents(sessionId, sourceEventId, destinationEventId) {
  const sessions = getStudySessions();
  const session = sessions.find(item => item.id === sessionId);
  if (!session || !Array.isArray(session.events) || sourceEventId === destinationEventId) return false;

  const mergedEvents = mergeStudyEvents(session.events, sourceEventId, destinationEventId);
  if (!mergedEvents) return false;
  session.events = mergedEvents;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  return true;
}

export function unmergeStudySessionEvent(sessionId, sourceEventId) {
  const sessions = getStudySessions();
  const session = sessions.find(item => item.id === sessionId);
  if (!session || !Array.isArray(session.events)) return false;

  const sourceEvent = session.events.find(event => event.id === sourceEventId);
  if (!sourceEvent?.mergedInto) return false;

  delete sourceEvent.mergedInto;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  return true;
}

export function clearStudyData(templateId) {
  const sessions = getStudySessions().filter(session => session.templateId !== templateId);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

export function clearStudySubjectData(templateId, subjectNumber) {
  const sessions = getStudySessions().filter(session =>
    session.templateId !== templateId ||
    (Number.isInteger(session.subjectNumber) ? session.subjectNumber : 1) !== subjectNumber
  );
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}