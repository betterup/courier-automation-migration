import assert from "node:assert/strict";
import { test } from "node:test";

import { compareTopics } from "./compare.js";

const topic = (templateId, templateName = templateId) => ({ templateId, templateName });
const section = (sectionId, topics) => ({
  sectionId,
  name: `Section ${sectionId}`,
  preferenceGroups: { nodes: topics },
});
const topicsIn = (sections) => sections.flatMap((s) => s.preferenceGroups.nodes);

const us = [
  section("ps_a", [topic("old_1", "Old"), topic("pt_1", "One"), topic("pt_2", "Two")]),
  section("ps_b", [topic("pt_3", "Three")]),
];

test("copies only the named topics that the target does not have", () => {
  const eu = [section("ps_a", [topic("old_1", "Old"), topic("pt_1", "One")])];

  const comparison = compareTopics(us, eu, topicsIn(eu), ["pt_1", "pt_2"]);

  assert.deepEqual(comparison.topicsToCopy, [{ topic: topic("pt_2", "Two"), sectionId: "ps_a" }]);
  assert.deepEqual(
    comparison.topics.map((t) => [t.topicId, t.inTarget]),
    [["pt_1", true], ["pt_2", false]],
  );
});

test("finds a target topic that is in no section", () => {
  const comparison = compareTopics(us, [], [topic("pt_1", "One")], ["pt_1"]);

  assert.equal(comparison.topics[0].inTarget, true);
  assert.equal(comparison.topics[0].targetSectionName, null);
  assert.deepEqual(comparison.topicsToCopy, []);
});

test("names the target section of a topic that the target has", () => {
  const eu = [section("ps_a", [topic("pt_1", "One")])];

  const comparison = compareTopics(us, eu, topicsIn(eu), ["pt_1"]);

  assert.equal(comparison.topics[0].targetSectionName, "Section ps_a");
});

test("copies a topic into no section when the target lacks its section", () => {
  const eu = [section("ps_a", [])];

  const comparison = compareTopics(us, eu, [], ["pt_1", "pt_3"]);

  assert.deepEqual(
    comparison.topicsToCopy.map((t) => [t.topic.templateId, t.sectionId]),
    [["pt_1", "ps_a"], ["pt_3", null]],
  );
});

test("reports ids that the source does not have", () => {
  const comparison = compareTopics(us, [], [], ["pt_1", "pt_missing"]);

  assert.deepEqual(comparison.missingInSource, ["pt_missing"]);
  assert.deepEqual(comparison.topicsToCopy.map((t) => t.topic.templateId), ["pt_1"]);
});

test("reports a target topic with the same name and another id", () => {
  const comparison = compareTopics(us, [], [topic("pt_other", "One")], ["pt_1"]);

  assert.deepEqual(comparison.topics[0].sameNameInTarget, ["pt_other"]);
  assert.equal(comparison.topics[0].inTarget, false);
});

test("does not report the topic itself as a same-name topic", () => {
  const comparison = compareTopics(us, [], [topic("pt_1", "One")], ["pt_1"]);

  assert.deepEqual(comparison.topics[0].sameNameInTarget, []);
});

test("handles a topic id given twice once", () => {
  const comparison = compareTopics(us, [], [], ["pt_1", "pt_1"]);

  assert.equal(comparison.topics.length, 1);
  assert.equal(comparison.topicsToCopy.length, 1);
});
