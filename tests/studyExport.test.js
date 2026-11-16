import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import {
  createStudyExportFilename,
  createStudyWorkbook
} from "../src/data/studyExport.js";

test("study export filename includes sanitized template, export date, and latest study timestamp", () => {
  const exportedAt = new Date(2026, 10, 16, 23, 50, 2);
  const sessions = [
    { startTime: new Date(2026, 10, 14, 8, 0, 0).getTime(), endTime: new Date(2026, 10, 14, 8, 30, 0).getTime() },
    { startTime: new Date(2026, 10, 15, 9, 0, 0).getTime(), events: [
      { timestamp: new Date(2026, 10, 15, 9, 45, 7).getTime() }
    ] }
  ];

  assert.equal(
    createStudyExportFilename('Daily / "Pick & Pack"?', sessions, exportedAt),
    "Daily00Pick&Pack00-data-11.16.2026-20261115.09.45.07.xlsx"
  );
});

test("study workbook contains only populated subjects with results-style action rows", () => {
  const workbook = createStudyWorkbook([
    {
      id: "first",
      subjectNumber: 1,
      startTime: 1000,
      events: [{
        id: "first-action",
        name: "Pick",
        elementPrime: "Pick",
        timestamp: 3000,
        count: 2,
        note: "First"
      }]
    },
    {
      id: "second",
      subjectNumber: 1,
      startTime: 5000,
      events: [{
        id: "second-action",
        name: "Pack",
        elementPrime: "Pack",
        timestamp: 8000,
        count: 1,
        note: ""
      }]
    },
    {
      id: "third",
      subjectNumber: 3,
      startTime: 10000,
      events: [{
        id: "third-action",
        name: "Ship",
        elementPrime: "Ship",
        timestamp: 12000,
        count: 1,
        note: ""
      }]
    }
  ]);

  const files = unzipSync(workbook);
  const workbookXml = strFromU8(files["xl/workbook.xml"]);
  const subjectOneXml = strFromU8(files["xl/worksheets/sheet1.xml"]);
  const subjectThreeXml = strFromU8(files["xl/worksheets/sheet2.xml"]);

  assert.match(workbookXml, /name="Subject 1"/);
  assert.match(workbookXml, /name="Subject 3"/);
  assert.doesNotMatch(workbookXml, /name="Subject 2"/);
  assert.match(subjectOneXml, /<t>ID<\/t>/);
  assert.match(subjectOneXml, /<v>1<\/v><\/c><c r="B2"[^>]*><is><t>Pick<\/t>/);
  assert.match(subjectOneXml, /<t>First<\/t>/);
  assert.match(subjectOneXml, /<c r="F2"><v>2<\/v><\/c>/);
  assert.match(subjectOneXml, /<c r="I2"><v>2<\/v><\/c>/);
  assert.match(subjectOneXml, /Gap in data/);
  assert.match(subjectOneXml, /<t>Pack<\/t>/);
  assert.match(subjectThreeXml, /<t>Ship<\/t>/);
});

test("study workbook escapes user-provided text in worksheet XML", () => {
  const workbook = createStudyWorkbook([{
    id: "session",
    subjectNumber: 2,
    startTime: 1000,
    events: [{ id: "action", name: "Pick & <pack>", timestamp: 2000 }]
  }]);
  const files = unzipSync(workbook);
  const subjectXml = strFromU8(files["xl/worksheets/sheet1.xml"]);

  assert.match(subjectXml, /Pick &amp; &lt;pack&gt;/);
});
