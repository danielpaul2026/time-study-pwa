import { strToU8, zipSync } from "fflate";
import { getVisibleStudyEvents } from "./studyStore.js";

const HEADERS = [
  "ID",
  "Element Prime",
  "Element Sub",
  "Element ID",
  "Note",
  "Count",
  "Start Date",
  "Start Time",
  "Seconds Elapsed",
  "Minutes Elapsed",
  "Study"
];

const COLUMN_WIDTHS = [ 8, 22, 22, 18, 36, 9, 14, 14, 18, 18, 10 ];

function formatDateParts(date) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return {
    exportDate: `${month}.${day}.${year}`,
    timestamp: `${year}${month}${day}.${hours}.${minutes}.${seconds}`
  };
}

function getMostRecentStudyTimestamp(sessions) {
  const timestamps = sessions.flatMap(session => [
    session.startTime,
    session.endTime,
    ...(Array.isArray(session.events) ? session.events.map(event => event.timestamp) : [])
  ]).map(Number).filter(Number.isFinite);

  if (!timestamps.length) {
    throw new Error("Study data does not contain a valid timestamp.");
  }

  return Math.max(...timestamps);
}

export function createStudyExportFilename(templateName, sessions, exportedAt = new Date()) {
  const safeTemplateName = Array.from(templateName, character => {
    const code = character.codePointAt(0);
    return /[<>:"/\\|?*]/.test(character) || code < 0x20 ? "0" : character;
  }).join("").replace(/\s/g, "") || "0";
  const { exportDate } = formatDateParts(exportedAt);
  const { timestamp } = formatDateParts(new Date(getMostRecentStudyTimestamp(sessions)));

  return `${safeTemplateName}-data-${exportDate}-${timestamp}.xlsx`;
}

function createSubjectRows(sessions) {
  const rows = [ HEADERS ];
  let nextRowId = 1;

  sessions.forEach((session, sessionIndex) => {
    const events = Array.isArray(session.events) ? session.events : [];
    let previousTimestamp = Number(session.startTime);

    if (sessionIndex > 0 && !events.some(event => event.type === "gap")) {
      rows.push([
        "", "", "", "", session.scopeNote || "",
        "", "", "", "", "", sessionIndex + 1
      ]);
      rows[rows.length - 1][0] = `Study ${sessionIndex + 1}`;
    }

    getVisibleStudyEvents(events).forEach(({ event, index: eventIndex }) => {
      if (event.type === "gap") {
        previousTimestamp = Number(event.timestamp);
        if (sessionIndex > 0 || eventIndex > 0) {
          rows.push([
            `Study ${sessionIndex + 1}`, "", "", "",
            event.note || "", "", "", "", "", "", sessionIndex + 1
          ]);
        }
        return;
      }

      const timestamp = Number(event.timestamp);
      if (!Number.isFinite(timestamp) || !Number.isFinite(previousTimestamp)) return;

      const elapsedSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
      const startDate = new Date(previousTimestamp);
      const startDateSerial = Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      ) / 86400000 + 25569;
      const startTimeSerial = (
        startDate.getHours() * 3600 +
        startDate.getMinutes() * 60 +
        startDate.getSeconds() +
        startDate.getMilliseconds() / 1000
      ) / 86400;
      rows.push([
        nextRowId,
        event.elementPrime || event.name || "",
        event.elementSub || "",
        event.elementId || "",
        event.note || "",
        Number.isFinite(Number(event.count)) ? Number(event.count) : 1,
        startDateSerial,
        startTimeSerial,
        elapsedSeconds,
        elapsedSeconds / 60,
        sessionIndex + 1
      ]);
      nextRowId += 1;
      previousTimestamp = timestamp;
    });
  });

  return rows;
}

function columnName(columnIndex) {
  let remainder = columnIndex + 1;
  let name = "";
  while (remainder > 0) {
    const digit = (remainder - 1) % 26;
    name = String.fromCharCode(65 + digit) + name;
    remainder = Math.floor((remainder - 1) / 26);
  }
  return name;
}

function escapeXml(value) {
  const validXmlCharacters = Array.from(String(value)).filter(character => {
    const code = character.codePointAt(0);
    return code === 0x9 || code === 0xa || code === 0xd ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff);
  }).join("");

  return validXmlCharacters
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createCell(value, reference, rowIndex, columnIndex) {
  const style = rowIndex === 0
    ? ' s="1"'
    : columnIndex === 6
      ? ' s="2"'
      : columnIndex === 7
        ? ' s="3"'
        : "";

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${style}><v>${value}</v></c>`;
  }

  const text = escapeXml(value ?? "");
  const preserveSpace = /^\s|\s$/.test(String(value ?? "")) ? ' xml:space="preserve"' : "";
  return `<c r="${reference}" t="inlineStr"${style}><is><t${preserveSpace}>${text}</t></is></c>`;
}

function createWorksheetXml(rows) {
  const worksheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) =>
      createCell(value, `${columnName(columnIndex)}${rowIndex + 1}`, rowIndex, columnIndex)
    ).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const columns = COLUMN_WIDTHS.map((width, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>${columns}</cols>
<sheetData>${worksheetRows}</sheetData>
</worksheet>`;
}

function createWorkbookXml(subjectNumbers) {
  const sheets = subjectNumbers.map((subjectNumber, index) =>
    `<sheet name="Subject ${subjectNumber}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets}</sheets>
</workbook>`;
}

function createWorkbookRelationships(subjectNumbers) {
  const sheets = subjectNumbers.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets}
<Relationship Id="rId${subjectNumbers.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function createContentTypesXml(subjectCount) {
  const sheets = Array.from({ length: subjectCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets}
</Types>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2">
<numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>
<numFmt numFmtId="165" formatCode="hh:mm:ss"/>
</numFmts>
<fonts count="2">
<font><sz val="11"/><name val="Arial"/></font>
<font><b/><sz val="11"/><name val="Arial"/></font>
</fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export function createStudyWorkbook(sessions) {
  const subjectNumbers = [ ...new Set(sessions.map(session =>
    Number.isInteger(session.subjectNumber) ? session.subjectNumber : 1
  )) ].sort((first, second) => first - second);
  const zipFiles = {
    "[Content_Types].xml": strToU8(createContentTypesXml(subjectNumbers.length)),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(createWorkbookXml(subjectNumbers)),
    "xl/_rels/workbook.xml.rels": strToU8(createWorkbookRelationships(subjectNumbers)),
    "xl/styles.xml": strToU8(STYLES_XML)
  };

  subjectNumbers.forEach((subjectNumber, index) => {
    const subjectSessions = sessions
      .filter(session =>
        (Number.isInteger(session.subjectNumber) ? session.subjectNumber : 1) === subjectNumber
      )
      .sort((first, second) => first.startTime - second.startTime);
    zipFiles[`xl/worksheets/sheet${index + 1}.xml`] =
      strToU8(createWorksheetXml(createSubjectRows(subjectSessions)));
  });

  return zipSync(zipFiles, { level: 6 });
}
