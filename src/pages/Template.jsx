import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getTemplates, saveTemplate } from "../data/studyStore";

const defaultColors = [
  "#b9c9f2",
  "#e9edb8",
  "#a2eee7",
  "#a5ed91",
  "#dedede",
  "#ebee68",
  "#e98781",
  "#9bdde5"
];

const fontOptions = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet MS", value: "Trebuchet MS, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "Courier New, monospace" }
];

export default function Template() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [ initialTemplate ] = useState(() =>
    getTemplates().find(template => template.id === templateId)
  );
  const [ name, setName ] = useState(initialTemplate?.name || "");
  const [ elements, setElements ] = useState(initialTemplate?.elements || []);
  const [ isAdding, setIsAdding ] = useState(false);
  const [ elementName, setElementName ] = useState("");
  const [ draggedElementId, setDraggedElementId ] = useState(null);
  const [ editingElementId, setEditingElementId ] = useState(null);
  const [ nextElementId, setNextElementId ] = useState(() =>
    Math.max(0, ...(initialTemplate?.elements || []).map(element => Number(element.id))) + 1
  );

  function addElement(event) {
    event.preventDefault();
    const nextName = elementName.trim();
    if (!nextName) return;

    setElements(currentElements => [
      ...currentElements,
      {
        id: nextElementId,
        name: nextName,
        backgroundColor: defaultColors[(nextElementId - 1) % defaultColors.length],
        textColor: "#111111",
        fontFamily: "Arial, sans-serif"
      }
    ]);
    setNextElementId(currentId => currentId + 1);
    setElementName("");
    setIsAdding(false);
  }

  function updateElement(elementId, changes) {
    setElements(currentElements => currentElements.map(element =>
      element.id === elementId ? { ...element, ...changes } : element
    ));
  }

  function moveElement(targetElementId) {
    if (draggedElementId === null || draggedElementId === targetElementId) return;

    setElements(currentElements => {
      const reorderedElements = [ ...currentElements ];
      const sourceIndex = reorderedElements.findIndex(
        element => element.id === draggedElementId
      );
      const targetIndex = reorderedElements.findIndex(
        element => element.id === targetElementId
      );
      if (sourceIndex < 0 || targetIndex < 0) return currentElements;

      const [ movedElement ] = reorderedElements.splice(sourceIndex, 1);
      reorderedElements.splice(targetIndex, 0, movedElement);
      return reorderedElements;
    });
    setDraggedElementId(null);
  }

  function handleSave(event) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || elements.length === 0) return;

    saveTemplate({
      id: templateId || String(Date.now()),
      name: cleanName,
      elements
    });
    navigate(location.state?.returnTo || "/");
  }

  const editingElement = elements.find(element => element.id === editingElementId);

  return (
    <main className="template-editor">
      <form className="template-form" onSubmit={handleSave}>
        <header className="template-appbar">
          <h1 className="visually-hidden">
            {templateId ? "Edit study template" : "Create study template"}
          </h1>
          <button className="template-menu-button" type="button" onClick={() => navigate("/")}>
            Menu
          </button>
          <input
            className="template-name-input"
            id="template-name"
            aria-label="Template name"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="New study template"
            required
          />
          <button className="template-save-button" type="submit" disabled={!name.trim() || elements.length === 0}>
            Save
          </button>
        </header>

        {isAdding && (
          <div className="element-form">
            <label htmlFor="element-name">Button name</label>
            <input
              autoFocus
              id="element-name"
              value={elementName}
              onChange={event => setElementName(event.target.value)}
              placeholder="For example, Pick item"
            />
            <button type="button" onClick={addElement} disabled={!elementName.trim()}>
              Add button
            </button>
            <button type="button" onClick={() => setIsAdding(false)}>
              Cancel
            </button>
          </div>
        )}

        <div className="template-action-grid" aria-label="Study template actions">
          {elements.map(element => (
            <div
              className={`template-tile-wrap${draggedElementId === element.id ? " is-dragging" : ""}`}
              draggable
              key={element.id}
              onDragStart={() => setDraggedElementId(element.id)}
              onDragOver={event => event.preventDefault()}
              onDrop={event => {
                event.preventDefault();
                moveElement(element.id);
              }}
              onDragEnd={() => setDraggedElementId(null)}
            >
              <button
                className="template-action-tile"
                type="button"
                style={{
                  backgroundColor: element.backgroundColor || "#dedede",
                  color: element.textColor || "#111111",
                  fontFamily: element.fontFamily || "Arial, sans-serif"
                }}
                aria-label={`Customize ${element.name}`}
                onClick={() => setEditingElementId(element.id)}
              >
                {element.name}
              </button>
              <span className="template-edit-marker" aria-hidden="true">Edit</span>
            </div>
          ))}
          <button
            className="template-action-tile add-tile"
            type="button"
            onClick={() => setIsAdding(true)}
          >
            <span aria-hidden="true">+</span>
            Add
          </button>
        </div>

        {editingElement && (
          <div className="element-editor-backdrop" onClick={() => setEditingElementId(null)}>
            <section
              className="element-editor"
              role="dialog"
              aria-modal="true"
              aria-labelledby="element-editor-title"
              onClick={event => event.stopPropagation()}
            >
              <h2 id="element-editor-title">Customize button</h2>
              <label htmlFor="editing-element-name">Button text</label>
              <input
                id="editing-element-name"
                value={editingElement.name}
                onChange={event => updateElement(editingElement.id, { name: event.target.value })}
              />
              <div className="color-settings">
                <label htmlFor="element-background">Button color</label>
                <input
                  id="element-background"
                  type="color"
                  value={editingElement.backgroundColor || "#dedede"}
                  onChange={event => updateElement(editingElement.id, { backgroundColor: event.target.value })}
                />
                <label htmlFor="element-text-color">Text color</label>
                <input
                  id="element-text-color"
                  type="color"
                  value={editingElement.textColor || "#111111"}
                  onChange={event => updateElement(editingElement.id, { textColor: event.target.value })}
                />
              </div>
              <label htmlFor="element-font">Font</label>
              <select
                id="element-font"
                value={editingElement.fontFamily || "Arial, sans-serif"}
                onChange={event => updateElement(editingElement.id, { fontFamily: event.target.value })}
              >
                {fontOptions.map(font => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
              <button type="button" onClick={() => setEditingElementId(null)}>
                Done
              </button>
            </section>
          </div>
        )}
      </form>
      <section className="template-preview" aria-label="Capture preview">
        The recorded observation log is shown in this space during capture.
      </section>
    </main>
  );
}