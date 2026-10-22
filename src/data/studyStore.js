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

export function getStudySessions() {
  return readList(SESSION_STORAGE_KEY);
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
  sessions.unshift(session);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
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