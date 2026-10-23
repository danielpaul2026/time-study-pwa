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

function normalizePositions(elements, cellCount) {
  const positions = new Set();
  let nextFreePosition = 0;
  return elements.map((element, index) => {
    const currentPosition = Number.isInteger(element.position) && element.position >= 0
      ? element.position
      : index;
    let position = currentPosition;
    if (position >= cellCount || positions.has(position)) {
      while (nextFreePosition < cellCount && positions.has(nextFreePosition)) {
        nextFreePosition += 1;
      }
      position = nextFreePosition < cellCount ? nextFreePosition : undefined;
    }
    if (position !== undefined) positions.add(position);
    return position === undefined || position === currentPosition
      ? element
      : { ...element, position };
  });
}

function createTemplateId() {
  return String(Date.now());
}

export default function Template() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [ initialTemplate ] = useState(() =>
    getTemplates().find(template => template.id === templateId)
  );
  const [ name, setName ] = useState(initialTemplate?.name || "");
  const [ elements, setElements ] = useState(initialTemplate?.elements || []);
  const [ columns, setColumns ] = useState(String(Math.min(8, Math.max(2, Number(initialTemplate?.columns) || 3))));
  const [ rowHeightLines, setRowHeightLines ] = useState(String(Math.min(5, Math.max(1, Number(initialTemplate?.rowHeightLines) || 2))));
  const [ isAdding, setIsAdding ] = useState(false);
  const [ elementName, setElementName ] = useState("");
  const [ draggedElementIndex, setDraggedElementIndex ] = useState(null);
  const [ editingElementId, setEditingElementId ] = useState(null);
  const [ editingSubbuttonIndex, setEditingSubbuttonIndex ] = useState(null);
  const [ showElementProperties, setShowElementProperties ] = useState(false);
  const [ nestedParentId, setNestedParentId ] = useState(null);
  const [ activeElementIndex, setActiveElementIndex ] = useState(null);
  const didPointerDrag = useRef(false);
  const [ nextElementId, setNextElementId ] = useState(() =>
    Math.max(0, ...(initialTemplate?.elements || []).map(element => Number(element.id))) + 1
  );

  function addElement(event) {
    event.preventDefault();
    const nextName = elementName.trim();
    if (!nextName) return;

    setElements(currentElements => {
      const currentParent = currentElements.find(element => element.id === nestedParentId);
      const visibleElements = currentParent
        ? currentParent.children || []
        : currentElements;
      const occupiedCells = new Set(visibleElements.map((element, index) =>
        Number.isInteger(element.position) && element.position >= 0
          ? element.position
          : index
      ));
      let position = 0;
      while (occupiedCells.has(position)) position += 1;

      const newElement = {
        id: nextElementId,
        name: nextName,
        position,
        backgroundColor: defaultColors[(nextElementId - 1) % defaultColors.length],
        textColor: "#111111",
        fontFamily: "Arial, sans-serif"
      };

      if (nestedParentId === null) return [ ...currentElements, newElement ];
      return currentElements.map(element => element.id === nestedParentId
        ? { ...element, children: [ ...(element.children || []), newElement ] }
        : element
      );
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

  function updateSubbutton(elementId, subbuttonIndex, changes) {
    setElements(currentElements => currentElements.map(element =>
      element.id === elementId
        ? {
            ...element,
            children: (element.children || []).map((child, index) =>
              index === subbuttonIndex ? { ...child, ...changes } : child
            )
          }
        : element
    ));
  }

  function addSubbutton(elementId) {
    setElements(currentElements => currentElements.map(element =>
      element.id === elementId
        ? {
            ...element,
            children: [
              ...(element.children || []),
              {
                name: "Subbutton",
                backgroundColor: "#dedede",
                textColor: "#111111",
                fontFamily: "Arial, sans-serif"
              }
            ]
          }
        : element
    ));
  }

  function removeSubbutton(elementId, subbuttonIndex) {
    setElements(currentElements => currentElements.map(element =>
      element.id === elementId
        ? {
            ...element,
            children: (element.children || []).filter((_, index) => index !== subbuttonIndex)
          }
        : element
    ));
    if (nestedParentId === elementId) setActiveElementIndex(null);
  }

  function deleteActiveElement() {
    if (activeElementIndex === null) return;
    if (nestedParent) {
      removeSubbutton(nestedParent.id, activeElementIndex);
      return;
    }

    const selectedElement = currentElements[activeElementIndex];
    if (!selectedElement) return;
    setElements(currentElements => currentElements.filter(element => element.id !== selectedElement.id));
    setActiveElementIndex(null);
  }

  function closeElementEditor() {
    setEditingSubbuttonIndex(null);
    setEditingElementId(null);
    setShowElementProperties(false);
  }

  function closeSubbuttonEditor() {
    setEditingSubbuttonIndex(null);
    if (!showElementProperties) setEditingElementId(null);
  }

  function moveElementToCell(targetCell) {
    if (draggedElementIndex === null) return;

    setElements(currentElements => {
      function moveInList(list) {
        const normalizedList = normalizePositions(list, gridRows * columnCount);
        const sourceIndex = draggedElementIndex;
        const sourceElement = normalizedList[sourceIndex];
        if (!sourceElement) return normalizedList;
        const sourceCell = Number.isInteger(sourceElement.position) && sourceElement.position >= 0
          ? sourceElement.position
          : sourceIndex;
        if (sourceCell === targetCell) return normalizedList;

        const targetIndex = normalizedList.findIndex((element, index) => {
          const position = Number.isInteger(element.position) && element.position >= 0
            ? element.position
            : index;
          return position === targetCell;
        });

        return normalizedList.map((element, index) => {
          if (index === sourceIndex) return { ...element, position: targetCell };
          if (index === targetIndex) return { ...element, position: sourceCell };
          return element;
        });
      }

      if (nestedParentId === null) return moveInList(currentElements);
      return currentElements.map(element => element.id === nestedParentId
        ? { ...element, children: moveInList(element.children || []) }
        : element
      );
    });
    setActiveElementIndex(draggedElementIndex);
    setDraggedElementIndex(null);
  }

  function handleSave(event) {
    event.preventDefault();
    const cleanName = name.trim();
    const columnCount = Number(viewColumnSetting);
    const lineCount = Number(viewLineSetting);
    const rootColumnCount = Number(columns);
    const rootLineCount = Number(rowHeightLines);
    if (
      !cleanName ||
      elements.length === 0 ||
      !Number.isInteger(rootColumnCount) ||
      rootColumnCount < 2 ||
      rootColumnCount > 8 ||
      !Number.isInteger(rootLineCount) ||
      rootLineCount < 1 ||
      rootLineCount > 5 ||
      !Number.isInteger(columnCount) ||
      columnCount < 2 ||
      columnCount > 8 ||
      !Number.isInteger(lineCount) ||
      lineCount < 1 ||
      lineCount > 5 ||
      elements.some(element => element.children?.some(child => !child.name.trim()))
    ) return;

    const normalizedPositionsById = new Map(
      normalizePositions(currentElements, gridRows * columnCountForSave)
        .map(element => [ element.id, element.position ])
    );
    saveTemplate({
      id: templateId || createTemplateId(),
      name: cleanName,
      columns: rootColumnCount,
      rowHeightLines: rootLineCount,
      elements: (nestedParent ? elements : normalizePositions(elements, gridRows * columnCountForSave)).map(element => ({
        ...element,
        ...(nestedParent?.id === element.id
          ? { childrenColumns: columnCount, childrenRowHeightLines: lineCount }
          : {}),
        children: element.children?.map(child => ({
          ...child,
          name: child.name.trim(),
          ...(nestedParent?.id === element.id && normalizedPositionsById.has(child.id)
            ? { position: normalizedPositionsById.get(child.id) }
            : {})
        }))
      }))
    });
    navigate(location.state?.returnTo || "/");
  }

  const editingParentElement = elements.find(element => element.id === editingElementId);
  const editingElement = showElementProperties ? editingParentElement : null;
  const editingSubbutton = editingParentElement?.children?.[editingSubbuttonIndex];
  const nestedParent = elements.find(element => element.id === nestedParentId);
  const currentElements = nestedParent
    ? nestedParent.children || []
    : elements;
  const preferredLineCount = Math.min(5, Math.max(1, Number(nestedParent?.childrenRowHeightLines ?? rowHeightLines) || 2));
  const preferredRowHeight = Math.max(28, preferredLineCount * 16.1 + 8);
  const { gridRef, availableRows, availableHeight } = useAvailableGridRows(1, preferredRowHeight);
  const preferredColumns = Math.min(8, Math.max(2, Number(nestedParent?.childrenColumns ?? columns) || 3));
  const baseRows = Math.max(1, availableRows || 1);
  const gridRows = Math.max(baseRows, Math.ceil(currentElements.length / 8));
  const columnCount = Math.min(8, Math.max(2, preferredColumns, Math.ceil(currentElements.length / gridRows)));
  const availableHeightForRows = Math.max(1, availableHeight - Math.max(0, gridRows - 1) * 4);
  const rowHeight = Math.max(
    1,
    Math.min(preferredRowHeight, gridRows > baseRows ? availableHeightForRows / gridRows : preferredRowHeight)
  );
  const columnCountForSave = columnCount;
  const viewColumnSetting = preferredColumns;
  const viewLineSetting = Math.min(5, preferredLineCount);
  const visibleElements = normalizePositions(currentElements, gridRows * columnCount);
  const elementsByPosition = new Map(visibleElements.map((element, index) => [
    Number.isInteger(element.position) && element.position >= 0 ? element.position : index,
    element
  ]));
  const gridStyle = {
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridRows}, minmax(${rowHeight}px, 1fr))`
  };
  const settingsAreValid =
    Number.isInteger(Number(columns)) &&
    Number(columns) >= 2 &&
    Number(columns) <= 8 &&
    Number.isInteger(Number(rowHeightLines)) &&
    Number(rowHeightLines) >= 1 &&
    Number(rowHeightLines) <= 5 &&
    Number.isInteger(Number(viewColumnSetting)) &&
    Number(viewColumnSetting) >= 2 &&
    Number(viewColumnSetting) <= 8 &&
    columnCount <= 8 &&
    Number.isInteger(Number(viewLineSetting)) &&
    Number(viewLineSetting) >= 1 &&
    Number(viewLineSetting) <= 5;

  return (
    <main className="template-editor">
      <form className="template-form" onSubmit={handleSave}>
        <header className="template-appbar">
          <h1 className="visually-hidden">
            {templateId ? "Edit study template" : "Create study template"}
          </h1>
          <button
            className="template-menu-button"
            type="button"
            onClick={() => {
              if (nestedParent) {
                setNestedParentId(null);
                setActiveElementIndex(null);
                setIsAdding(false);
              } else {
                navigate("/");
              }
            }}
          >
            {nestedParent ? "Back" : "Menu"}
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
            disabled={
              !name.trim() ||
              elements.length === 0 ||
              !settingsAreValid ||
              elements.some(element => element.children?.some(child => !child.name.trim()))
            }
          >
            Save
          </button>
        </header>

        <div className="template-grid-settings">
          <label>
            Columns
            <select
              value={viewColumnSetting}
              onChange={event => {
                if (nestedParent) {
                  updateElement(nestedParent.id, { childrenColumns: Number(event.target.value) });
                } else {
                  setColumns(event.target.value);
                }
              }}>
              {Array.from({ length: 7 }, (_, index) => index + 2).map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Row height (text lines)
            <select
              value={viewLineSetting}
              onChange={event => {
                if (nestedParent) {
                  updateElement(nestedParent.id, { childrenRowHeightLines: Number(event.target.value) });
                } else {
                  setRowHeightLines(event.target.value);
                }
              }}>
              {Array.from({ length: 5 }, (_, index) => index + 1).map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
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

        <p className="template-grid-hint">
          {nestedParent
            ? `Subbuttons for ${nestedParent.name}. Add a subbutton to make this a nested button. Select a button, then use Properties to edit it.`
            : "Select a button to activate Properties. Select it again to manage its subbuttons. Drag buttons to arrange them."}
        </p>
        <div
          className="template-grid-area">
        <div
          ref={gridRef}
          className="template-action-grid"
          role="grid"
          aria-label={nestedParent ? `${nestedParent.name} subbuttons` : "Study template actions"}
          style={gridStyle}
        >
          {Array.from({ length: gridRows * columnCount }, (_, cellIndex) => {
            const element = elementsByPosition.get(cellIndex);
            const elementIndex = visibleElements.findIndex(item => item.id === element?.id);
            return (
              <div
                className={`template-grid-cell${element ? "" : " is-empty"}${draggedElementIndex === elementIndex ? " is-dragging" : ""}`}
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
                      setActiveElementIndex(elementIndex);
                      setDraggedElementIndex(elementIndex);
                    }}
                    onDragEnd={() => setDraggedElementIndex(null)}
                    onPointerDown={event => {
                      if (event.pointerType === "mouse") return;
                      didPointerDrag.current = false;
                      setActiveElementIndex(elementIndex);
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDraggedElementIndex(elementIndex);
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
                        setDraggedElementIndex(null);
                      }
                    }}
                    onPointerCancel={() => setDraggedElementIndex(null)}
                  >
                    <button
                      className={`template-action-tile${activeElementIndex === elementIndex ? " is-active" : ""}`}
                      type="button"
                      style={{
                        backgroundColor: element.backgroundColor || "#dedede",
                        color: element.textColor || "#111111",
                        fontFamily: element.fontFamily || "Arial, sans-serif"
                      }}
                      aria-pressed={activeElementIndex === elementIndex}
                      aria-label={nestedParent ? element.name : `${element.name}${element.children?.length ? ", has subbuttons" : ""}`}
                      onClick={() => {
                        if (didPointerDrag.current) {
                          didPointerDrag.current = false;
                          return;
                        }
                        if (
                          !nestedParent &&
                          activeElementIndex === elementIndex
                        ) {
                          setElements(currentElementsState => currentElementsState.map(currentElement =>
                            currentElement.id === element.id
                              ? {
                                  ...currentElement,
                                  children: currentElement.children || [],
                                  childrenColumns: currentElement.childrenColumns ?? Number(columns),
                                  childrenRowHeightLines: currentElement.childrenRowHeightLines ?? Number(rowHeightLines)
                                }
                              : currentElement
                          ));
                          setNestedParentId(element.id);
                          setActiveElementIndex(null);
                          setIsAdding(false);
                          return;
                        }
                        setActiveElementIndex(elementIndex);
                      }}
                    >
                      {element.name}
                    </button>
                    {element.children?.length > 0 && (
                      <span className="template-nested-marker" aria-hidden="true" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
        <div className="template-button-actions">
          <button
            className="template-add-button"
            type="button"
            onClick={() => {
              setIsAdding(true);
              setElementName("");
            }}
          >
            + Add button
          </button>
          <button
            className="template-properties-button"
            type="button"
            disabled={activeElementIndex === null}
            onClick={() => {
              const activeElement = currentElements[activeElementIndex];
              if (!activeElement) return;
              if (nestedParent) {
                setEditingElementId(nestedParent.id);
                setEditingSubbuttonIndex(activeElementIndex);
                setShowElementProperties(false);
              } else {
                setEditingElementId(activeElement.id);
                setEditingSubbuttonIndex(null);
                setShowElementProperties(true);
              }
            }}
          >
            Properties
          </button>
          <button
            className="template-delete-button"
            type="button"
            disabled={activeElementIndex === null}
            onClick={deleteActiveElement}
          >
            Delete
          </button>
        </div>

        {editingElement && (
          <div className="element-editor-backdrop" onClick={closeElementEditor}>
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
              <section className="nested-button-editor" aria-label="Subbuttons">
                <h3>Subbuttons</h3>
                <p>Adding subbuttons marks this as a nested button. Subbuttons are the final level.</p>
                {(editingElement.children || []).map((child, index) => (
                  <div className="nested-button-row" key={`${index}-${child.name}`}>
                    <span
                      className="nested-button-preview"
                      style={{
                        backgroundColor: child.backgroundColor || "#dedede",
                        color: child.textColor || "#111111",
                        fontFamily: child.fontFamily || "Arial, sans-serif"
                      }}
                    >
                      {child.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Edit subbutton ${index + 1}`}
                      onClick={() => setEditingSubbuttonIndex(index)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove subbutton ${index + 1}`}
                      onClick={() => removeSubbutton(editingElement.id, index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addSubbutton(editingElement.id)}>
                  + Add subbutton
                </button>
              </section>
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
              <button type="button" onClick={closeElementEditor}>
                Done
              </button>
            </section>
          </div>
        )}
        {editingSubbutton && editingParentElement && (
          <div
            className="element-editor-backdrop subbutton-editor-backdrop"
            onClick={closeSubbuttonEditor}
          >
            <section
              className="element-editor"
              role="dialog"
              aria-modal="true"
              aria-labelledby="subbutton-editor-title"
              onClick={event => event.stopPropagation()}
            >
              <h2 id="subbutton-editor-title">Customize subbutton</h2>
              <label htmlFor="editing-subbutton-name">Button text</label>
              <input
                id="editing-subbutton-name"
                value={editingSubbutton.name}
                onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                  name: event.target.value
                })}
              />
              <div className="color-settings">
                <label htmlFor="subbutton-background">Button color</label>
                <input
                  id="subbutton-background"
                  type="color"
                  value={editingSubbutton.backgroundColor || "#dedede"}
                  onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                    backgroundColor: event.target.value
                  })}
                />
                <label htmlFor="subbutton-text-color">Text color</label>
                <input
                  id="subbutton-text-color"
                  type="color"
                  value={editingSubbutton.textColor || "#111111"}
                  onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                    textColor: event.target.value
                  })}
                />
              </div>
              <label htmlFor="subbutton-font">Font</label>
              <select
                id="subbutton-font"
                value={editingSubbutton.fontFamily || "Arial, sans-serif"}
                onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                  fontFamily: event.target.value
                })}
              >
                {fontOptions.map(font => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
              <button type="button" onClick={closeSubbuttonEditor}>
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