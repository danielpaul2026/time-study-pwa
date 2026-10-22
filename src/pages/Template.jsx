import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getTemplates, saveTemplate } from "../data/studyStore";
import useAvailableGridRows from "../hooks/useAvailableGridRows";

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
  const [ columns, setColumns ] = useState(String(initialTemplate?.columns || 3));
  const [ rowHeightLines, setRowHeightLines ] = useState(String(initialTemplate?.rowHeightLines || 2));
  const [ isAdding, setIsAdding ] = useState(false);
  const [ elementName, setElementName ] = useState("");
  const [ draggedElementId, setDraggedElementId ] = useState(null);
  const [ editingElementId, setEditingElementId ] = useState(null);
  const didPointerDrag = useRef(false);
  const [ nextElementId, setNextElementId ] = useState(() =>
    Math.max(0, ...(initialTemplate?.elements || []).map(element => Number(element.id))) + 1
  );

  function addElement(event) {
    event.preventDefault();
    const nextName = elementName.trim();
    if (!nextName) return;

    setElements(currentElements => {
      const occupiedCells = new Set(currentElements.map((element, index) =>
        Number.isInteger(element.position) && element.position >= 0
          ? element.position
          : index
      ));
      let position = 0;
      while (occupiedCells.has(position)) position += 1;

      return [ ...currentElements, {
        id: nextElementId,
        name: nextName,
        position,
        backgroundColor: defaultColors[(nextElementId - 1) % defaultColors.length],
        textColor: "#111111",
        fontFamily: "Arial, sans-serif"
      } ];
    });
    setNextElementId(currentId => currentId + 1);
    setElementName("");
    setIsAdding(false);
  }

  function updateElement(elementId, changes) {
    setElements(currentElements => currentElements.map(element =>
      element.id === elementId ? { ...element, ...changes } : element
    ));
  }

  function moveElementToCell(targetCell) {
    if (draggedElementId === null) return;

    setElements(currentElements => {
      const sourceIndex = currentElements.findIndex(element => element.id === draggedElementId);
      if (sourceIndex < 0) return currentElements;

      const sourceElement = currentElements[sourceIndex];
      const sourceCell = Number.isInteger(sourceElement.position) && sourceElement.position >= 0
        ? sourceElement.position
        : sourceIndex;
      if (sourceCell === targetCell) return currentElements;

      const targetIndex = currentElements.findIndex((element, index) => {
        const position = Number.isInteger(element.position) && element.position >= 0
          ? element.position
          : index;
        return position === targetCell;
      });

      return currentElements.map((element, index) => {
        if (index === sourceIndex) return { ...element, position: targetCell };
        if (index === targetIndex) return { ...element, position: sourceCell };
        return element;
      });
    });
    setDraggedElementId(null);
  }

  function handleSave(event) {
    event.preventDefault();
    const cleanName = name.trim();
    const columnCount = Number(columns);
    const lineCount = Number(rowHeightLines);
    if (
      !cleanName ||
      elements.length === 0 ||
      !Number.isInteger(columnCount) ||
      columnCount < 1 ||
      columnCount > 12 ||
      !Number.isInteger(lineCount) ||
      lineCount < 1 ||
      lineCount > 8
    ) return;

    saveTemplate({
      id: templateId || String(Date.now()),
      name: cleanName,
      columns: columnCount,
      rowHeightLines: lineCount,
      elements
    });
    navigate(location.state?.returnTo || "/");
  }

  const editingElement = elements.find(element => element.id === editingElementId);
  const columnCount = Number(columns) || 3;
  const lineCount = Number(rowHeightLines) || 2;
  const elementPositions = elements.map((element, index) =>
    Number.isInteger(element.position) && element.position >= 0 ? element.position : index
  );
  const minimumGridRows = Math.max(
    1,
    Math.ceil((Math.max(-1, ...elementPositions) + 1) / columnCount) + 1
  );
  const rowHeight = Math.max(44, lineCount * 16.1 + 16);
  const { gridRef, gridRows } = useAvailableGridRows(minimumGridRows, rowHeight);
  const elementsByPosition = new Map(elements.map((element, index) => [
    Number.isInteger(element.position) && element.position >= 0 ? element.position : index,
    element
  ]));
  const gridStyle = {
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridRows}, ${rowHeight}px)`
  };
  const settingsAreValid =
    Number.isInteger(Number(columns)) &&
    Number(columns) >= 1 &&
    Number(columns) <= 12 &&
    Number.isInteger(Number(rowHeightLines)) &&
    Number(rowHeightLines) >= 1 &&
    Number(rowHeightLines) <= 8;

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
          <button
            className="template-save-button"
            type="submit"
            disabled={!name.trim() || elements.length === 0 || !settingsAreValid}
          >
            Save
          </button>
        </header>

        <div className="template-grid-settings">
          <label>
            Columns
            <input
              type="number"
              min="1"
              max="12"
              value={columns}
              onChange={event => setColumns(event.target.value)}
            />
          </label>
          <label>
            Row height (text lines)
            <input
              type="number"
              min="1"
              max="8"
              value={rowHeightLines}
              onChange={event => setRowHeightLines(event.target.value)}
            />
          </label>
        </div>

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

        <p className="template-grid-hint">Drag buttons to arrange them. Empty cells are allowed.</p>
        <div ref={gridRef} className="template-action-grid" role="grid" aria-label="Study template actions" style={gridStyle}>
          {Array.from({ length: gridRows * columnCount }, (_, cellIndex) => {
            const element = elementsByPosition.get(cellIndex);
            return (
              <div
                className={`template-grid-cell${element ? "" : " is-empty"}${draggedElementId === element?.id ? " is-dragging" : ""}`}
                key={cellIndex}
                data-cell-index={cellIndex}
                role="gridcell"
                aria-label={element ? element.name : `Empty cell ${cellIndex + 1}`}
                onDragOver={event => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={event => {
                  event.preventDefault();
                  moveElementToCell(cellIndex);
                }}
              >
                {element && (
                  <div
                    className="template-tile-wrap"
                    draggable
                    onDragStart={event => {
                      event.dataTransfer.setData("text/plain", String(element.id));
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedElementId(element.id);
                    }}
                    onDragEnd={() => setDraggedElementId(null)}
                    onPointerDown={event => {
                      if (event.pointerType === "mouse") return;
                      didPointerDrag.current = false;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDraggedElementId(element.id);
                    }}
                    onPointerUp={event => {
                      if (event.pointerType === "mouse") return;
                      const target = document.elementFromPoint(event.clientX, event.clientY);
                      const targetCell = target?.closest("[data-cell-index]");
                      if (targetCell) {
                        const sourceCell = event.currentTarget.parentElement?.dataset.cellIndex;
                        didPointerDrag.current = Number(targetCell.dataset.cellIndex) !== Number(sourceCell);
                        moveElementToCell(Number(targetCell.dataset.cellIndex));
                      } else {
                        setDraggedElementId(null);
                      }
                    }}
                    onPointerCancel={() => setDraggedElementId(null)}
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
                      onClick={() => {
                        if (didPointerDrag.current) {
                          didPointerDrag.current = false;
                          return;
                        }
                        setEditingElementId(element.id);
                      }}
                    >
                      {element.name}
                    </button>
                    <span className="template-edit-marker" aria-hidden="true">Edit</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button
          className="template-add-button"
          type="button"
          onClick={() => setIsAdding(true)}
        >
          + Add button
        </button>

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