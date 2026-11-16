import assert from "node:assert/strict";
import test from "node:test";

const storage = new Map();
globalThis.localStorage = {
  getItem(key) {
    return storage.get(key) ?? null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  }
};

const {
  getMergedStudyEventSources,
  getStudySessions,
  getVisibleStudyEvents,
  mergeStudyEvents,
  mergeStudySessionEvents,
  unmergeStudySessionEvent
} = await import("../src/data/studyStore.js");

function seedEvents(events) {
  storage.set("time-study-sessions", JSON.stringify([{ id: "session", events }]));
}

test("nested merges preserve data and allow partial unmerge", () => {
  seedEvents([
    { id: "a", name: "A", timestamp: 10, count: 2, note: "A note" },
    { id: "b", name: "B", timestamp: 20, count: 7, note: "B note" },
    { id: "c", name: "C", timestamp: 30, count: 4, note: "C note" }
  ]);

  assert.equal(mergeStudySessionEvents("session", "a", "b"), true);
  assert.equal(mergeStudySessionEvents("session", "b", "c"), true);

  let events = getStudySessions()[0].events;
  let visible = getVisibleStudyEvents(events);
  assert.deepEqual(visible.map(item => item.event.name), ["C"]);
  assert.equal(visible[0].event.timestamp, 10);
  assert.equal(visible[0].event.count, 4);
  assert.equal(visible[0].event.note, "C note\nMerged: A note\nMerged: B note");
  assert.deepEqual(getMergedStudyEventSources(events, "c").map(item => item.event.id), ["a", "b"]);

  assert.equal(unmergeStudySessionEvent("session", "a"), true);
  events = getStudySessions()[0].events;
  visible = getVisibleStudyEvents(events);
  assert.deepEqual(visible.map(item => item.event.name), ["A", "C"]);
  assert.equal(visible[1].event.note, "C note\nMerged: B note");

  assert.equal(unmergeStudySessionEvent("session", "b"), true);
  events = getStudySessions()[0].events;
  visible = getVisibleStudyEvents(events);
  assert.deepEqual(visible.map(item => item.event.name), ["A", "B", "C"]);
  assert.deepEqual(visible.map(item => item.event.timestamp), [10, 20, 30]);
  assert.deepEqual(visible.map(item => item.event.note), ["A note", "B note", "C note"]);
});

test("actions separated by a gap cannot be merged", () => {
  seedEvents([
    { id: "before", name: "Before", timestamp: 10 },
    { id: "gap", type: "gap", timestamp: 20 },
    { id: "after", name: "After", timestamp: 30 }
  ]);

  assert.equal(mergeStudySessionEvents("session", "before", "after"), false);
  assert.deepEqual(
    getVisibleStudyEvents(getStudySessions()[0].events).map(item => item.event.name || item.event.type),
    ["Before", "gap", "After"]
  );
});

test("a pending next action remains visible as the merge destination", () => {
  const existingAction = {
    id: "existing",
    name: "Existing action",
    timestamp: 10,
    count: 8,
    note: "Existing note"
  };
  const nextAction = {
    id: "next",
    name: "Pressed next action",
    timestamp: 20,
    count: 3,
    note: ""
  };
  const mergedEvents = mergeStudyEvents([ existingAction, nextAction ], "existing", "next");

  assert.ok(mergedEvents);
  const visible = getVisibleStudyEvents(mergedEvents);
  assert.deepEqual(visible.map(item => item.event.name), ["Pressed next action"]);
  assert.equal(visible[0].event.timestamp, 10);
  assert.equal(visible[0].event.count, 3);
  assert.equal(visible[0].event.note, "Merged: Existing note");
  assert.equal(existingAction.mergedInto, undefined);
  assert.equal(mergedEvents[0].mergedInto, "next");
});
