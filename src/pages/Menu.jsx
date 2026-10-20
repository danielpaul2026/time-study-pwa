export default function Menu() {
    const templates = [
        { id: 1, name: "NPPC General"},
        { id: 2, name: "Orgill Mez"}
        ];

    const listTemplates = templates.map(templates =>
        <li
        key = {templates.id}
        >
            {templates.name}
            <TemplateActionBar></TemplateActionBar>
        </li>
    )

    function DirectButton({ page, children}) {
        return (
            <button onClick={() => alert(page)}>
                {children}
            </button>
        );
    }

    function TemplateActionBar() {
        return (
            <div>
            <DirectButton page="Study">Take Study</DirectButton>
            <DirectButton page="ConfigTemplate">Edit Template</DirectButton>
            <DirectButton page="Results">See Study</DirectButton>
            </div>
        );
    }

  return (
    <>
    <h1>Study Templates (Count: {listTemplates.length})</h1>
    <ul>{listTemplates}</ul>
    </>
  );
}