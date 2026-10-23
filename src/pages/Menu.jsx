import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import enVistaLogo from "../assets/enVista_Logo_Color.png";
import { getStudySessions, getTemplates, saveTemplate } from "../data/studyStore";

function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h ${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatTimestamp(timestamp) {
    if (!Number.isFinite(timestamp)) return "No studies yet";

    const date = new Date(timestamp);
    const datePart = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
    }).format(date);
    const timePart = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
    }).format(date);

    return `${datePart} ${timePart}`;
}

function isTemplateFile(value) {
    return value !== null &&
        typeof value === "object" &&
        typeof value.name === "string" &&
        Array.isArray(value.elements) &&
        value.elements.every(element =>
            element !== null &&
            typeof element === "object" &&
            typeof element.name === "string" &&
            (element.children === undefined ||
                (Array.isArray(element.children) &&
                    element.children.every(child =>
                        child !== null &&
                        typeof child === "object" &&
                        typeof child.name === "string" &&
                        (child.children === undefined ||
                            (Array.isArray(child.children) && child.children.length === 0))
                    )))
        );
}

export default function Menu() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [ templates, setTemplates ] = useState(() => getTemplates());
    const [ sessions ] = useState(() => getStudySessions());
    const [ selectedTemplateId, setSelectedTemplateId ] = useState("");
    const selectedTemplate = templates.find(template => template.id === selectedTemplateId);
    const selectedSessions = sessions.filter(session => session.templateId === selectedTemplateId);
    const populatedSubjects = new Set(selectedSessions.map(session =>
        Number.isInteger(session.subjectNumber) ? session.subjectNumber : 1
    ));
    const totalDuration = selectedSessions.reduce((total, session) =>
        total + (Number.isFinite(session.durationMs) ? session.durationMs : 0), 0
    );
    const totalEntries = selectedSessions.reduce((total, session) =>
        total + (Array.isArray(session.events)
            ? session.events.filter(event => event.type !== "gap").length
            : 0), 0
    );
    async function importTemplate(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        try {
            const importedTemplate = JSON.parse(await file.text());
            if (!isTemplateFile(importedTemplate)) {
                throw new Error("The selected file is not a valid study template.");
            }

            let id = String(Date.now());
            let suffix = 1;
            while (templates.some(template => String(template.id) === id)) {
                id = `${Date.now()}-${suffix}`;
                suffix += 1;
            }

            const template = { ...importedTemplate, id };
            saveTemplate(template);
            setTemplates(currentTemplates => [ ...currentTemplates, template ]);
            setSelectedTemplateId(id);
        } catch (error) {
            window.alert(error instanceof Error
                ? `Unable to import template: ${error.message}`
                : "Unable to import template.");
        }
    }

    async function shareTemplate() {
        if (!selectedTemplate) return;

        const file = new File(
            [ JSON.stringify(selectedTemplate, null, 2) ],
            `${selectedTemplate.name.replace(/[^a-z0-9-_]+/gi, "-") || "study-template"}.json`,
            { type: "application/json" }
        );

        try {
            if (navigator.share && navigator.canShare?.({ files: [ file ] })) {
                await navigator.share({ title: selectedTemplate.name, files: [ file ] });
                return;
            }

            const url = URL.createObjectURL(file);
            const link = document.createElement("a");
            link.href = url;
            link.download = file.name;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            window.alert(error instanceof Error
                ? `Unable to share template: ${error.message}`
                : "Unable to share template.");
        }
    }

    return (
        <main className="menu-page">
            <header className="menu-header">
                <div className="menu-brand">
                    <img src={enVistaLogo} alt="enVista" />
                    <h1>Time Study</h1>
                </div>
                <button
                    className="menu-stopwatch-button"
                    type="button"
                    disabled
                    aria-label="Stopwatch, coming soon"
                    title="Coming soon"
                >
                    Stopwatch
                </button>
                <nav className="menu-actions" aria-label="Menu actions">
                    <button type="button" onClick={() => navigate("/Template")}>New</button>
                    <button
                        type="button"
                        onClick={() => navigate(selectedTemplate
                            ? `/Results?templateId=${encodeURIComponent(selectedTemplate.id)}`
                            : "/Results")}
                    >
                        Results
                    </button>
                    <button
                        type="button"
                        disabled={!selectedTemplate}
                        onClick={() => navigate(`/Template/${encodeURIComponent(selectedTemplate.id)}`)}
                    >
                        Edit
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()}>Import</button>
                    <button type="button" disabled={!selectedTemplate} onClick={shareTemplate}>Share</button>
                    <input
                        ref={fileInputRef}
                        className="menu-import-input"
                        type="file"
                        accept="application/json,.json"
                        aria-label="Import study template"
                        onChange={importTemplate}
                    />
                </nav>
            </header>

            <section className="menu-template-section" aria-label="Study templates">
                {templates.length === 0 ? (
                    <p className="menu-empty-state">No templates yet. Create a new template to get started.</p>
                ) : (
                    <ul className="menu-template-list">
                        {templates.map(template => {
                            const templateSessions = sessions.filter(session => session.templateId === template.id);
                            const latestStudy = templateSessions.reduce((latest, session) => {
                                const timestamp = Number.isFinite(session.endTime) ? session.endTime : session.startTime;
                                return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest;
                            }, -Infinity);

                            return (
                                <li
                                    className={`menu-template-row${selectedTemplateId === template.id ? " is-selected" : ""}`}
                                    key={template.id}
                                >
                                    <button
                                        className={`menu-template-item${selectedTemplateId === template.id ? " is-selected" : ""}`}
                                        type="button"
                                        aria-pressed={selectedTemplateId === template.id}
                                        onClick={() => setSelectedTemplateId(template.id)}
                                    >
                                        <span className="menu-template-name">{template.name}</span>
                                        <span className="menu-template-timestamp">{formatTimestamp(latestStudy)}</span>
                                    </button>
                                    {selectedTemplateId === template.id && (
                                        <button
                                            className="menu-take-study"
                                            type="button"
                                            onClick={() => navigate(`/Study?templateId=${encodeURIComponent(template.id)}`)}
                                        >
                                            Take Study
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {selectedTemplate && (
                <section className="menu-summary-section" aria-label={`${selectedTemplate.name} summary`}>
                    <div className="menu-summary-metrics">
                        <p className="menu-metric">Studies: {populatedSubjects.size}</p>
                        <p className="menu-metric">Total time: {formatDuration(totalDuration)}</p>
                        <p className="menu-metric">Total entries: {totalEntries}</p>
                    </div>
                </section>
            )}
        </main>
    );
}
