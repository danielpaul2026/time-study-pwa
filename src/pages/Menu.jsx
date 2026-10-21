import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { getTemplates } from "../data/studyStore";

export default function Menu() {
    const navigate = useNavigate();
    const [ templates ] = useState(() => getTemplates());

    return (
        <>
            <nav className="page-nav" aria-label="Main navigation">
                <button type="button" onClick={() => navigate("/Results")}>Results</button>
            </nav>
            <h1>Study Templates ({templates.length})</h1>
            <button type="button" onClick={() => navigate("/Template")}>Create template</button>
            {templates.length === 0 ? (
                <p>No templates yet. Create a template to get started.</p>
            ) : (
                <ul className="template-list">
                    {templates.map(template => (
                        <li className="template-list-item" key={template.id}>
                            <h2>{template.name}</h2>
                            <div className="template-actions">
                                <button
                                    type="button"
                                    onClick={() => navigate(`/Study?templateId=${encodeURIComponent(template.id)}`)}
                                >
                                    Take study
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/Template/${encodeURIComponent(template.id)}`)}
                                >
                                    Edit template
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/Results?templateId=${encodeURIComponent(template.id)}`)}
                                >
                                    View results
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}