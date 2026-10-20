import { useNavigate } from "react-router-dom";

export default function Menu() {
    const navigate = useNavigate();

    const templates = [
        { id: 1, name: "NPPC General" },
        { id: 2, name: "Orgill Mez" }
    ];

    function DirectButton({ page, children }) {
        return (
            <button onClick={() => navigate(`/${page}`)}>
                {children}
            </button>
        );
    }

    function TemplateActionBar() {
        return (
            <div>
                <DirectButton page="Study">Take Study</DirectButton>
                <DirectButton page="Results">See Study</DirectButton>
            </div>
        );
    }

    const listTemplates = templates.map(template => (
        <li key={template.id}>
            {template.name}
            <TemplateActionBar />
        </li>
    ));

    return (
        <>
            <h1>Study Templates (Count: {listTemplates.length})</h1>
            <ul>{listTemplates}</ul>
        </>
    );
}