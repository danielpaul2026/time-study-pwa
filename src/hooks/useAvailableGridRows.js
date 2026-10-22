import { useEffect, useRef, useState } from "react";

export default function useAvailableGridRows(minimumRows, rowHeight) {
  const gridRef = useRef(null);
  const [ availableRows, setAvailableRows ] = useState(0);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const rowGap = Number.parseFloat(window.getComputedStyle(grid).rowGap) || 0;
      const rows = Math.floor(
        (entry.contentRect.height + rowGap) / (rowHeight + rowGap)
      );
      setAvailableRows(rows);
    });
    observer.observe(grid);

    return () => observer.disconnect();
  }, [rowHeight]);

  return {
    gridRef,
    gridRows: Math.max(minimumRows, availableRows)
  };
}
