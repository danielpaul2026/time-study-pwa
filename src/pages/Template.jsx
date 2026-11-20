import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const MAX_GRID_COLUMNS = 12;
const MAX_GRID_ROWS = 50;
const GRID_PICKER_CELL_SIZE = 32;
const GRID_PICKER_GAP = 4;
const GRID_PICKER_PADDING = 22;
const GRID_PICKER_MARGIN = 8;

function getInitialGridRows(configuredRows, elements, columns) {
  const parsedRows = Number(configuredRows);
  if (Number.isInteger(parsedRows) && parsedRows > 0) {
    return Math.min(MAX_GRID_ROWS, parsedRows);
  }
  const lastPosition = (elements || []).reduce((maximum, element, index) => {
    const position = Number.isInteger(element.position) && element.position >= 0
      ? element.position
      : index;
    return Math.max(maximum, position);
  }, -1);
  return Math.min(
    MAX_GRID_ROWS,
    Math.max(3, Math.ceil(Math.max(elements?.length || 0, lastPosition + 1) / columns))
  );
}

function getGridPickerLayout(anchor, rows, columns) {
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = window.innerHeight;
  const top = Math.max(GRID_PICKER_MARGIN, anchor.bottom + 6);
  const availableWidth = Math.max(1, viewportWidth - GRID_PICKER_MARGIN * 2 - 1);
  const availableHeight = Math.max(1, viewportHeight - top - GRID_PICKER_MARGIN - 1);
  const cellSize = Math.max(0.1, Math.min(
    GRID_PICKER_CELL_SIZE,
    (availableWidth - GRID_PICKER_PADDING - GRID_PICKER_GAP * (columns - 1)) / columns,
    (availableHeight - GRID_PICKER_PADDING - GRID_PICKER_GAP * (rows - 1)) / rows
  ));
  const maxColumns = Math.max(
    columns,
    Math.min(
      MAX_GRID_COLUMNS,
      Math.floor((availableWidth - GRID_PICKER_PADDING + GRID_PICKER_GAP) / (cellSize + GRID_PICKER_GAP))
    )
  );
  const maxRows = Math.max(
    rows,
    Math.min(
      MAX_GRID_ROWS,
      Math.floor((availableHeight - GRID_PICKER_PADDING + GRID_PICKER_GAP) / (cellSize + GRID_PICKER_GAP))
    )
  );
  const maxWidth = maxColumns * cellSize +
    Math.max(0, maxColumns - 1) * GRID_PICKER_GAP +
    GRID_PICKER_PADDING;
  const left = Math.max(
    GRID_PICKER_MARGIN,
    Math.min(anchor.left, viewportWidth - GRID_PICKER_MARGIN - maxWidth)
  );

  return { left, top, cellSize, maxRows, maxColumns };
}

function getGridPickerDimension(index, previousIndex, currentSize, baseSize, maxSize) {
  if (previousIndex !== null && index < previousIndex) {
    return Math.max(baseSize, index + 1);
  }
  if (index >= currentSize - 1 && index !== previousIndex) {
    return Math.min(maxSize, Math.max(currentSize, index + 2));
  }
  return currentSize;
}

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

function isNestedElement(element) {
  return element.isNested === true || element.children?.length > 0;
}

function getTextStyle(element = {}) {
  const fontSize = Number.isFinite(Number(element.fontSize)) ? Number(element.fontSize) : 16;
  const fontWeight = Number.isFinite(Number(element.fontWeight)) ? Number(element.fontWeight) : 400;
  const fontStyle = element.fontStyle === "italic" ? "italic" : "normal";

  return {
    fontFamily: "Arial, sans-serif",
    fontSize: `${fontSize}px`,
    fontWeight,
    fontStyle
  };
}

function getEditableFontSize(element) {
  const fontSize = Number(element.fontSize);
  return Math.min(26, Math.max(6, Number.isFinite(fontSize) ? fontSize : 16));
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
  const [ columns, setColumns ] = useState(String(Math.min(MAX_GRID_COLUMNS, Math.max(1, Number(initialTemplate?.columns) || 2))));
  const [ rows, setRows ] = useState(() => getInitialGridRows(
    initialTemplate?.rows,
    initialTemplate?.elements,
    Math.min(MAX_GRID_COLUMNS, Math.max(1, Number(initialTemplate?.columns) || 2))
  ));
  const [ rowHeightLines ] = useState(String(Math.min(8, Math.max(1, Number(initialTemplate?.rowHeightLines) || 5))));
  const [ isDirty, setIsDirty ] = useState(!initialTemplate);
  const [ isAdding, setIsAdding ] = useState(false);
  const [ elementName, setElementName ] = useState("");
  const [ addPosition, setAddPosition ] = useState(null);
  const [ draggedElementIndex, setDraggedElementIndex ] = useState(null);
  const [ editingElementId, setEditingElementId ] = useState(null);
  const [ editingSubbuttonIndex, setEditingSubbuttonIndex ] = useState(null);
  const [ showElementProperties, setShowElementProperties ] = useState(false);
  const [ nestedParentId, setNestedParentId ] = useState(null);
  const [ activeElementIndex, setActiveElementIndex ] = useState(null);
  const [ isGridPickerOpen, setIsGridPickerOpen ] = useState(false);
  const [ gridPickerSize, setGridPickerSize ] = useState({ rows: 3, columns: 3 });
  const [ gridPickerSelection, setGridPickerSelection ] = useState({ rows: 3, columns: 3 });
  const [ gridPickerLayout, setGridPickerLayout ] = useState({
    left: GRID_PICKER_MARGIN,
    top: 54,
    cellSize: GRID_PICKER_CELL_SIZE,
    maxRows: 3,
    maxColumns: 3
  });
  const gridPickerRef = useRef(null);
  const gridPickerGridRef = useRef(null);
  const gridPickerPointerId = useRef(null);
  const gridPickerSizeRef = useRef({ rows: 3, columns: 3 });
  const gridPickerBaseSize = useRef({ rows: 3, columns: 3 });
  const gridPickerLimits = useRef({ rows: 3, columns: 3 });
  const gridPickerSelectionRef = useRef({ rows: 3, columns: 3 });
  const gridPickerLastCell = useRef(null);
  const elementPointerDrag = useRef(null);
  const didPointerDrag = useRef(false);
  const lastElementClick = useRef({ id: null, time: 0 });
  const [ nextElementId, setNextElementId ] = useState(() =>
    Math.max(0, ...(initialTemplate?.elements || []).map(element => Number(element.id))) + 1
  );

  function markUnsaved() {
    setIsDirty(true);
  }

  function addElement(event) {
    event.preventDefault();
    const nextName = elementName.trim();
    if (!nextName) return;

    setElements(currentElements => {
      const currentParent = currentElements.find(element => element.id === nestedParentId);
      const visibleElements = currentParent
        ? currentParent.children || []
        : currentElements;
      const occupiedCells = new Set(normalizePositions(
        visibleElements,
        gridRows * columnCount
      ).map((element, index) =>
        Number.isInteger(element.position) && element.position >= 0 ? element.position : index
      ));
      let position = addPosition;
      if (position === null || occupiedCells.has(position)) {
        position = 0;
        while (occupiedCells.has(position)) position += 1;
      }

      const newElement = {
        id: nextElementId,
        name: nextName,
        position,
        backgroundColor: defaultColors[(nextElementId - 1) % defaultColors.length],
        textColor: "#111111",
        fontFamily: "Arial, sans-serif",
        fontSize: 16,
        fontWeight: 400,
        fontStyle: "normal"
      };

      if (nestedParentId === null) return [ ...currentElements, newElement ];
      return currentElements.map(element => element.id === nestedParentId
        ? { ...element, children: [ ...(element.children || []), newElement ] }
        : element
      );
    });
    markUnsaved();
    setNextElementId(currentId => currentId + 1);
    setElementName("");
    setAddPosition(null);
    setIsAdding(false);
  }

  function updateElement(elementId, changes) {
    markUnsaved();
    setElements(currentElements => currentElements.map(element =>
      element.id === elementId ? { ...element, ...changes } : element
    ));
  }

  function updateSubbutton(elementId, subbuttonIndex, changes) {
    markUnsaved();
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

  function removeSubbutton(elementId, subbuttonIndex) {
    markUnsaved();
    setElements(currentElements => currentElements.map(element =>
      element.id === elementId
        ? (() => {
            const children = (element.children || []).filter((_, index) => index !== subbuttonIndex);
            return {
              ...element,
              children,
              isNested: children.length > 0
            };
          })()
        : element
    ));
    if (nestedParentId === elementId) setActiveElementIndex(null);
  }

  function unnestElement(elementId) {
    markUnsaved();
    setElements(currentElements => currentElements.map(element => {
      if (element.id !== elementId) return element;
      return {
        ...element,
        children: undefined,
        childrenColumns: undefined,
        childrenRowHeightLines: undefined,
        isNested: false
      };
    }));
  }

  function deleteActiveElement() {
    if (activeElementIndex === null) return;
    if (nestedParent) {
      removeSubbutton(nestedParent.id, activeElementIndex);
      return;
    }

    const selectedElement = currentElements[activeElementIndex];
    if (!selectedElement) return;
    markUnsaved();
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

  function moveElementToCell(targetCell, sourceIndex = draggedElementIndex) {
    if (sourceIndex === null) return;

    markUnsaved();
    setElements(currentElements => {
      function moveInList(list) {
        const normalizedList = normalizePositions(list, gridRows * columnCount);
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
    setActiveElementIndex(sourceIndex);
    setDraggedElementIndex(null);
  }

  function startElementPointerDrag(event, elementIndex, sourceCell) {
    if (event.button !== 0) return;

    didPointerDrag.current = false;
    elementPointerDrag.current = {
      pointerId: event.pointerId,
      elementIndex,
      sourceCell,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false
    };
    setActiveElementIndex(elementIndex);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveElementPointerDrag(event) {
    const pointerDrag = elementPointerDrag.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    if (!pointerDrag.isDragging &&
      Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) >= 6
    ) {
      pointerDrag.isDragging = true;
      setDraggedElementIndex(pointerDrag.elementIndex);
    }
  }

  function endElementPointerDrag(event) {
    const pointerDrag = elementPointerDrag.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    elementPointerDrag.current = null;
    if (!pointerDrag.isDragging) return;

    didPointerDrag.current = true;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetCell = target?.closest("[data-cell-index]");
    if (targetCell && Number(targetCell.dataset.cellIndex) !== pointerDrag.sourceCell) {
      moveElementToCell(Number(targetCell.dataset.cellIndex), pointerDrag.elementIndex);
      return;
    }

    setDraggedElementIndex(null);
  }

  function cancelElementPointerDrag(event) {
    if (elementPointerDrag.current?.pointerId !== event.pointerId) return;
    elementPointerDrag.current = null;
    setDraggedElementIndex(null);
  }

  function handleSave(event) {
    event.preventDefault();
    const cleanName = name.trim();
    const columnCount = Number(viewColumnSetting);
    const rowCount = Number(viewRowSetting);
    const lineCount = Number(viewLineSetting);
    const rootColumnCount = Number(columns);
    const rootRowCount = Number(rows);
    const rootLineCount = Number(rowHeightLines);
    if (
      !cleanName ||
      elements.length === 0 ||
      !Number.isInteger(rootColumnCount) ||
      rootColumnCount < 1 ||
      rootColumnCount > MAX_GRID_COLUMNS ||
      !Number.isInteger(rootRowCount) ||
      rootRowCount < 1 ||
      rootRowCount > MAX_GRID_ROWS ||
      !Number.isInteger(rootLineCount) ||
      rootLineCount < 1 ||
      rootLineCount > 8 ||
      !Number.isInteger(columnCount) ||
      columnCount < 1 ||
      columnCount > MAX_GRID_COLUMNS ||
      !Number.isInteger(rowCount) ||
      rowCount < 1 ||
      rowCount > MAX_GRID_ROWS ||
      !Number.isInteger(lineCount) ||
      lineCount < 1 ||
      lineCount > 8 ||
      elements.some(element => element.children?.some(child => !child.name.trim()))
    ) return;

    const normalizedPositionsById = new Map(
      normalizePositions(currentElements, gridRows * columnCountForSave)
        .map(element => [ element.id, element.position ])
    );
    saveTemplate({
      id: templateId || createTemplateId(),
      name: cleanName,
      columns: nestedParent ? rootColumnCount : columnCount,
      rows: nestedParent ? rootRowCount : rowCount,
      rowHeightLines: rootLineCount,
      elements: (nestedParent ? elements : normalizePositions(elements, gridRows * columnCountForSave)).map(element => ({
        ...element,
        ...(nestedParent?.id === element.id
          ? { childrenColumns: columnCount, childrenRows: rowCount, childrenRowHeightLines: lineCount }
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
  const preferredLineCount = Math.min(8, Math.max(1, Number(nestedParent?.childrenRowHeightLines ?? rowHeightLines) || 5));
  const preferredRowHeight = Math.max(28, preferredLineCount * 16.1 + 8);
  const { gridRef, availableRows, availableHeight } = useAvailableGridRows(1, preferredRowHeight);
  const preferredColumns = Math.min(MAX_GRID_COLUMNS, Math.max(1, Number(nestedParent?.childrenColumns ?? columns) || 2));
  const preferredRows = getInitialGridRows(
    nestedParent?.childrenRows ?? (nestedParent ? undefined : rows),
    currentElements,
    preferredColumns
  );
  const baseRows = Math.max(1, availableRows || 1);
  const lastElementPosition = currentElements.reduce((maximum, element, index) => {
    const position = Number.isInteger(element.position) && element.position >= 0
      ? element.position
      : index;
    return Math.max(maximum, position);
  }, -1);
  const gridRows = Math.max(
    preferredRows,
    Math.ceil(Math.max(currentElements.length, lastElementPosition + 1) / preferredColumns)
  );
  const columnCount = preferredColumns;
  const availableHeightForRows = Math.max(1, availableHeight - Math.max(0, gridRows - 1) * 4);
  const rowHeight = Math.max(
    1,
    Math.min(preferredRowHeight, gridRows > baseRows ? availableHeightForRows / gridRows : preferredRowHeight)
  );
  const columnCountForSave = columnCount;
  const viewColumnSetting = columnCount;
  const viewRowSetting = gridRows;
  const viewLineSetting = preferredLineCount;
  const visibleElements = normalizePositions(currentElements, gridRows * columnCount);
  const elementsByPosition = new Map(visibleElements.map((element, index) => [
    Number.isInteger(element.position) && element.position >= 0 ? element.position : index,
    element
  ]));
  const hasEmptyGridCell = elementsByPosition.size < gridRows * columnCount;
  const gridStyle = {
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridRows}, minmax(${rowHeight}px, 1fr))`
  };
  const settingsAreValid =
    Number.isInteger(Number(columns)) &&
    Number(columns) >= 1 &&
    Number(columns) <= MAX_GRID_COLUMNS &&
    Number.isInteger(Number(rows)) &&
    Number(rows) >= 1 &&
    Number(rows) <= MAX_GRID_ROWS &&
    Number.isInteger(Number(rowHeightLines)) &&
    Number(rowHeightLines) >= 1 &&
    Number(rowHeightLines) <= 8 &&
    Number.isInteger(Number(viewColumnSetting)) &&
    Number(viewColumnSetting) >= 1 &&
    Number(viewColumnSetting) <= MAX_GRID_COLUMNS &&
    Number.isInteger(Number(viewRowSetting)) &&
    Number(viewRowSetting) >= 1 &&
    Number(viewRowSetting) <= MAX_GRID_ROWS &&
    columnCount <= MAX_GRID_COLUMNS &&
    Number.isInteger(Number(viewLineSetting)) &&
    Number(viewLineSetting) >= 1 &&
    Number(viewLineSetting) <= 8;

  function updateGridPickerCell(row, column) {
    const selection = { rows: row + 1, columns: column + 1 };
    gridPickerSelectionRef.current = selection;
    setGridPickerSelection(selection);

    const previousCell = gridPickerLastCell.current;
    const currentSize = gridPickerSizeRef.current;
    const baseSize = gridPickerBaseSize.current;
    const nextSize = {
      rows: getGridPickerDimension(
        row,
        previousCell?.row ?? null,
        currentSize.rows,
        baseSize.rows,
        gridPickerLimits.current.rows
      ),
      columns: getGridPickerDimension(
        column,
        previousCell?.column ?? null,
        currentSize.columns,
        baseSize.columns,
        gridPickerLimits.current.columns
      )
    };
    gridPickerLastCell.current = { row, column };
    gridPickerSizeRef.current = nextSize;
    if (nextSize.rows !== currentSize.rows || nextSize.columns !== currentSize.columns) {
      setGridPickerSize(nextSize);
    }
  }

  function selectGridPickerSize() {
    const { rows: rowCount, columns: columnCount } = gridPickerSelectionRef.current;
    markUnsaved();
    if (nestedParent) {
      updateElement(nestedParent.id, {
        childrenRows: rowCount,
        childrenColumns: columnCount
      });
    } else {
      setRows(rowCount);
      setColumns(String(columnCount));
    }
    setIsGridPickerOpen(false);
  }

  function handleGridPickerPointerDown(event) {
    const cell = event.target.closest("[data-picker-row]");
    if (!cell) return;
    event.preventDefault();
    gridPickerPointerId.current = event.pointerId;
    gridPickerLastCell.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateGridPickerCell(Number(cell.dataset.pickerRow), Number(cell.dataset.pickerColumn));
  }

  function handleGridPickerPointerMove(event) {
    if (gridPickerPointerId.current !== event.pointerId) return;
    const grid = gridPickerGridRef.current;
    if (!grid) return;
    const bounds = grid.getBoundingClientRect();
    const column = Math.floor((event.clientX - bounds.left) /
      (gridPickerLayout.cellSize + GRID_PICKER_GAP));
    const row = Math.floor((event.clientY - bounds.top) /
      (gridPickerLayout.cellSize + GRID_PICKER_GAP));
    if (
      row < 0 ||
      column < 0 ||
      row >= gridPickerLimits.current.rows ||
      column >= gridPickerLimits.current.columns
    ) return;
    updateGridPickerCell(row, column);
  }

  function handleGridPickerPointerUp(event) {
    if (gridPickerPointerId.current !== event.pointerId) return;
    handleGridPickerPointerMove(event);
    gridPickerPointerId.current = null;
    gridPickerLastCell.current = null;
    selectGridPickerSize();
  }

  useEffect(() => {
    if (!isGridPickerOpen) return undefined;
    function resizePicker() {
      const currentSize = gridPickerSizeRef.current;
      const layout = getGridPickerLayout(
        gridPickerRef.current.getBoundingClientRect(),
        currentSize.rows,
        currentSize.columns
      );
      gridPickerLimits.current = {
        rows: layout.maxRows,
        columns: layout.maxColumns
      };
      setGridPickerLayout(layout);
    }
    function closePickerOnEscape(event) {
      if (event.key === "Escape") setIsGridPickerOpen(false);
    }
    document.addEventListener("keydown", closePickerOnEscape);
    window.addEventListener("resize", resizePicker);
    return () => {
      document.removeEventListener("keydown", closePickerOnEscape);
      window.removeEventListener("resize", resizePicker);
    };
  }, [ isGridPickerOpen ]);

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
          <div className="grid-size-picker-container" ref={gridPickerRef}>
            <button
              className="grid-size-picker-trigger"
              type="button"
              aria-label={`Choose grid size, currently ${viewRowSetting} rows by ${viewColumnSetting} columns`}
              aria-expanded={isGridPickerOpen}
              aria-controls="template-grid-size-picker"
              onClick={() => {
                const pickerSize = {
                  rows: Math.max(3, viewRowSetting),
                  columns: Math.max(3, viewColumnSetting)
                };
                const pickerLayout = getGridPickerLayout(
                  gridPickerRef.current.getBoundingClientRect(),
                  pickerSize.rows,
                  pickerSize.columns
                );
                const selection = {
                  rows: viewRowSetting,
                  columns: viewColumnSetting
                };
                gridPickerLimits.current = {
                  rows: pickerLayout.maxRows,
                  columns: pickerLayout.maxColumns
                };
                gridPickerBaseSize.current = pickerSize;
                gridPickerSizeRef.current = pickerSize;
                gridPickerSelectionRef.current = selection;
                gridPickerLastCell.current = null;
                setGridPickerLayout(pickerLayout);
                setGridPickerSize(pickerSize);
                setGridPickerSelection(selection);
                setIsGridPickerOpen(open => !open);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="5" height="5" rx="1" />
                <rect x="9.5" y="3" width="5" height="5" rx="1" />
                <rect x="16" y="3" width="5" height="5" rx="1" />
                <rect x="3" y="9.5" width="5" height="5" rx="1" />
                <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
                <rect x="16" y="9.5" width="5" height="5" rx="1" />
                <rect x="3" y="16" width="5" height="5" rx="1" />
                <rect x="9.5" y="16" width="5" height="5" rx="1" />
                <rect x="16" y="16" width="5" height="5" rx="1" />
              </svg>
              <span>{viewRowSetting}x{viewColumnSetting}</span>
            </button>
          </div>
          <input
            className="template-name-input"
            id="template-name"
            aria-label="Template name"
            value={name}
            onChange={event => {
              setName(event.target.value);
              markUnsaved();
            }}
            placeholder="New study template"
            required
          />
          <button
            className={`template-save-button${isDirty ? " is-dirty" : ""}`}
            type="submit"
            aria-label={isDirty ? "Save unsaved template changes" : "Template saved"}
            disabled={
              !name.trim() ||
              elements.length === 0 ||
              !settingsAreValid ||
              elements.some(element => element.children?.some(child => !child.name.trim()))
            }
          >
            {isDirty ? "Save*" : "Saved"}
          </button>
        </header>

        {isGridPickerOpen && createPortal(
          <>
            <div
              className="grid-size-picker-backdrop"
              aria-hidden="true"
              onClick={() => setIsGridPickerOpen(false)}
            />
            <div
              className="grid-size-picker"
              id="template-grid-size-picker"
              role="group"
              aria-label="Choose button grid size"
              style={{
                left: `${gridPickerLayout.left}px`,
                top: `${gridPickerLayout.top}px`,
                width: `${gridPickerSize.columns * gridPickerLayout.cellSize +
                  (gridPickerSize.columns - 1) * GRID_PICKER_GAP + GRID_PICKER_PADDING}px`,
                height: `${gridPickerSize.rows * gridPickerLayout.cellSize +
                  (gridPickerSize.rows - 1) * GRID_PICKER_GAP + GRID_PICKER_PADDING}px`
              }}
            >
              <div
                ref={gridPickerGridRef}
                className="grid-size-picker-grid"
                style={{
                  gridTemplateColumns: `repeat(${gridPickerSize.columns}, ${gridPickerLayout.cellSize}px)`,
                  gridTemplateRows: `repeat(${gridPickerSize.rows}, ${gridPickerLayout.cellSize}px)`
                }}
                onPointerDown={handleGridPickerPointerDown}
                onPointerMove={handleGridPickerPointerMove}
                onPointerUp={handleGridPickerPointerUp}
                onPointerCancel={() => {
                  gridPickerPointerId.current = null;
                  gridPickerLastCell.current = null;
                }}
                onLostPointerCapture={() => {
                  gridPickerPointerId.current = null;
                  gridPickerLastCell.current = null;
                }}
              >
                {Array.from(
                  { length: gridPickerSize.rows * gridPickerSize.columns },
                  (_, index) => {
                    const row = Math.floor(index / gridPickerSize.columns);
                    const column = index % gridPickerSize.columns;
                    const isSelected = row < gridPickerSelection.rows &&
                      column < gridPickerSelection.columns;
                    const isSelectionEnd = row + 1 === gridPickerSelection.rows &&
                      column + 1 === gridPickerSelection.columns;
                    return (
                      <button
                        className={`grid-size-picker-cell${isSelected ? " is-selected" : ""}${isSelectionEnd ? " is-selection-end" : ""}`}
                        key={`${row}-${column}`}
                        type="button"
                        data-picker-row={row}
                        data-picker-column={column}
                        aria-label={`${row + 1} rows by ${column + 1} columns`}
                        aria-pressed={isSelectionEnd}
                        onClick={event => {
                          if (event.detail !== 0) return;
                          gridPickerLastCell.current = null;
                          updateGridPickerCell(row, column);
                          selectGridPickerSize();
                        }}
                      />
                    );
                  }
                )}
              </div>
            </div>
          </>,
          document.body
        )}

        {isAdding && (
          <div className="element-editor-backdrop" onClick={() => {
            setIsAdding(false);
            setAddPosition(null);
          }}>
            <section
              className="element-editor"
              role="dialog"
              aria-modal="true"
              aria-label="Add button"
              onClick={event => event.stopPropagation()}
            >
              <div className="template-add-dialog-actions">
                <button type="button" onClick={() => {
                  setIsAdding(false);
                  setAddPosition(null);
                }}>Cancel</button>
                <label htmlFor="element-name">Button Text</label>
                <button type="button" onClick={addElement} disabled={!elementName.trim()}>
                  Add
                </button>
              </div>
              <input
                autoFocus
                id="element-name"
                value={elementName}
                onChange={event => setElementName(event.target.value)}
                placeholder="For example, Pick item"
              />
            </section>
          </div>
        )}

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
              >
                {element ? (
                  <div
                    className="template-tile-wrap"
                    onPointerDown={event => {
                      startElementPointerDrag(event, elementIndex, cellIndex);
                    }}
                    onPointerMove={moveElementPointerDrag}
                    onPointerUp={endElementPointerDrag}
                    onPointerCancel={cancelElementPointerDrag}
                    onLostPointerCapture={cancelElementPointerDrag}
                    onClick={() => {
                      if (didPointerDrag.current) {
                        didPointerDrag.current = false;
                        lastElementClick.current = { id: null, time: 0 };
                        return;
                      }
                      setActiveElementIndex(elementIndex);
                      const now = Date.now();
                      const isDoubleClick =
                        lastElementClick.current.id === element.id &&
                        now - lastElementClick.current.time < 500;
                      lastElementClick.current = { id: element.id, time: now };

                      if (isDoubleClick && !nestedParent && isNestedElement(element)) {
                        lastElementClick.current = { id: null, time: 0 };
                        setNestedParentId(element.id);
                        setActiveElementIndex(null);
                        setIsAdding(false);
                      }
                    }}
                  >
                    <button
                      className={`template-action-tile${activeElementIndex === elementIndex ? " is-active" : ""}`}
                      type="button"
                      style={{
                        backgroundColor: element.backgroundColor || "#dedede",
                        color: element.textColor || "#111111",
                        ...getTextStyle(element)
                      }}
                      aria-pressed={activeElementIndex === elementIndex}
                      aria-label={nestedParent ? element.name : `${element.name}${isNestedElement(element) ? ", has subbuttons" : ""}`}
                    >
                      {element.name}
                    </button>
                    {isNestedElement(element) && (
                      <span className="template-nested-marker" aria-hidden="true" />
                    )}
                  </div>
                ) : (
                  <button
                    className="template-action-tile grid-add-cell"
                    type="button"
                    aria-label={`Add button in empty cell ${cellIndex + 1}`}
                    onClick={() => {
                      setAddPosition(cellIndex);
                      setElementName("");
                      setIsAdding(true);
                    }}
                  >
                    &lt;Add&gt;
                  </button>
                )}
              </div>
            );
          })}
        </div>
        </div>
        <div className="template-button-actions">
          <button
            className="template-delete-button"
            type="button"
            disabled={activeElementIndex === null}
            onClick={deleteActiveElement}
          >
            Delete
          </button>
          {!hasEmptyGridCell && (
            <button
              className="template-add-button"
              type="button"
              onClick={() => {
                setAddPosition(null);
                setElementName("");
                setIsAdding(true);
              }}
            >
              &lt;Add&gt;
            </button>
          )}
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
              <header className="element-editor-header">
                <h2 id="element-editor-title">Properties</h2>
                {isNestedElement(editingElement) ? (
                  <button type="button" onClick={() => unnestElement(editingElement.id)}>
                    Unnest
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateElement(editingElement.id, {
                      isNested: true,
                      children: [],
                      childrenColumns: Number(columns),
                      childrenRows: Number(rows),
                      childrenRowHeightLines: Number(rowHeightLines)
                    })}
                  >
                    Nest
                  </button>
                )}
                <button type="button" onClick={closeElementEditor}>
                  Apply
                </button>
              </header>
              <div className="element-editor-field">
                <label htmlFor="editing-element-name">Button text</label>
                <input
                  id="editing-element-name"
                  value={editingElement.name}
                  onChange={event => updateElement(editingElement.id, { name: event.target.value })}
                />
              </div>
              <div className="element-editor-field">
                <label htmlFor="editing-element-id">Element ID</label>
                <input
                  id="editing-element-id"
                  value={editingElement.externalId || ""}
                  onChange={event => updateElement(editingElement.id, { externalId: event.target.value })}
                />
              </div>
              <div className="element-editor-field">
                <label htmlFor="editing-element-count">Default count</label>
                <input
                  id="editing-element-count"
                  type="number"
                  min="0"
                  step="any"
                  value={editingElement.defaultCount ?? 1}
                  onChange={event => updateElement(editingElement.id, {
                    defaultCount: event.target.value === "" ? "" : Number(event.target.value)
                  })}
                />
              </div>
              <div className="color-settings">
                <div className="element-color-setting">
                  <label htmlFor="element-background">Button color</label>
                  <input
                    id="element-background"
                    type="color"
                    value={editingElement.backgroundColor || "#dedede"}
                    onChange={event => updateElement(editingElement.id, { backgroundColor: event.target.value })}
                  />
                </div>
                <div className="element-color-setting">
                  <label htmlFor="element-text-color">Text color</label>
                  <input
                    id="element-text-color"
                    type="color"
                    value={editingElement.textColor || "#111111"}
                    onChange={event => updateElement(editingElement.id, { textColor: event.target.value })}
                  />
                </div>
              </div>
              <div className="text-style-controls">
                <div className="element-editor-field">
                  <label htmlFor="element-text-size">Text Size</label>
                  <input
                    className="text-size-slider"
                    id="element-text-size"
                    type="range"
                    min="6"
                    max="26"
                    step="1"
                    value={getEditableFontSize(editingElement)}
                    onChange={event => updateElement(editingElement.id, {
                      fontFamily: "Arial, sans-serif",
                      fontSize: event.target.valueAsNumber,
                      fontWeight: editingElement.fontWeight && Number(editingElement.fontWeight) > 400 ? Number(editingElement.fontWeight) : 400,
                      fontStyle: editingElement.fontStyle === "italic" ? "italic" : "normal"
                    })}
                  />
                </div>
                <div className="text-style-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={Number(editingElement.fontWeight || 400) >= 600}
                      onChange={event => updateElement(editingElement.id, {
                        fontFamily: "Arial, sans-serif",
                        fontSize: Number.isFinite(Number(editingElement.fontSize)) ? Number(editingElement.fontSize) : 16,
                        fontWeight: event.target.checked ? 700 : 400,
                        fontStyle: editingElement.fontStyle === "italic" ? "italic" : "normal"
                      })}
                    />
                    Bold
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={editingElement.fontStyle === "italic"}
                      onChange={event => updateElement(editingElement.id, {
                        fontFamily: "Arial, sans-serif",
                        fontSize: Number.isFinite(Number(editingElement.fontSize)) ? Number(editingElement.fontSize) : 16,
                        fontWeight: Number(editingElement.fontWeight || 400),
                        fontStyle: event.target.checked ? "italic" : "normal"
                      })}
                    />
                    Italic
                  </label>
                </div>
              </div>
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
              <header className="element-editor-header element-editor-header-simple">
                <h2 id="subbutton-editor-title">Properties</h2>
                <button type="button" onClick={closeSubbuttonEditor}>
                  Apply
                </button>
              </header>
              <div className="element-editor-field">
                <label htmlFor="editing-subbutton-name">Button text</label>
                <input
                  id="editing-subbutton-name"
                  value={editingSubbutton.name}
                  onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                    name: event.target.value
                  })}
                />
              </div>
              <div className="element-editor-field">
                <label htmlFor="editing-subbutton-id">Element ID</label>
                <input
                  id="editing-subbutton-id"
                  value={editingSubbutton.externalId || ""}
                  onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                    externalId: event.target.value
                  })}
                />
              </div>
              <div className="element-editor-field">
                <label htmlFor="editing-subbutton-count">Default count</label>
                <input
                  id="editing-subbutton-count"
                  type="number"
                  min="0"
                  step="any"
                  value={editingSubbutton.defaultCount ?? 1}
                  onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                    defaultCount: event.target.value === "" ? "" : Number(event.target.value)
                  })}
                />
              </div>
              <div className="color-settings">
                <div className="element-color-setting">
                  <label htmlFor="subbutton-background">Button color</label>
                  <input
                    id="subbutton-background"
                    type="color"
                    value={editingSubbutton.backgroundColor || "#dedede"}
                    onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                      backgroundColor: event.target.value
                    })}
                  />
                </div>
                <div className="element-color-setting">
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
              </div>
              <div className="text-style-controls">
                <div className="element-editor-field">
                  <label htmlFor="subbutton-text-size">Text Size</label>
                  <input
                    className="text-size-slider"
                    id="subbutton-text-size"
                    type="range"
                    min="6"
                    max="26"
                    step="1"
                    value={getEditableFontSize(editingSubbutton)}
                    onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                      fontFamily: "Arial, sans-serif",
                      fontSize: event.target.valueAsNumber,
                      fontWeight: editingSubbutton.fontWeight && Number(editingSubbutton.fontWeight) > 400 ? Number(editingSubbutton.fontWeight) : 400,
                      fontStyle: editingSubbutton.fontStyle === "italic" ? "italic" : "normal"
                    })}
                  />
                </div>
                <div className="text-style-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={Number(editingSubbutton.fontWeight || 400) >= 600}
                      onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                        fontFamily: "Arial, sans-serif",
                        fontSize: Number.isFinite(Number(editingSubbutton.fontSize)) ? Number(editingSubbutton.fontSize) : 16,
                        fontWeight: event.target.checked ? 700 : 400,
                        fontStyle: editingSubbutton.fontStyle === "italic" ? "italic" : "normal"
                      })}
                    />
                    Bold
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={editingSubbutton.fontStyle === "italic"}
                      onChange={event => updateSubbutton(editingParentElement.id, editingSubbuttonIndex, {
                        fontFamily: "Arial, sans-serif",
                        fontSize: Number.isFinite(Number(editingSubbutton.fontSize)) ? Number(editingSubbutton.fontSize) : 16,
                        fontWeight: Number(editingSubbutton.fontWeight || 400),
                        fontStyle: event.target.checked ? "italic" : "normal"
                      })}
                    />
                    Italic
                  </label>
                </div>
              </div>
            </section>
          </div>
        )}
      </form>
    </main>
  );
}