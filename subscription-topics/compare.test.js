import assert from "node:assert/strict";
import { test } from "node:test";

import { compareTopics } from "./compare.js";

const topic = (templateId, templateName = templateId) => ({ templateId, templateName });
const section = (sectionId, topics) => ({
  sectionId,
  name: `Section ${sectionId}`,
  preferenceGroups: { nodes: topics },
});

const us = [
  section("ps_a", [topic("old_1", "Old"), topic("pt_1", "One"), topic("pt_2", "Two")]),
  section("ps_b", [topic("pt_3", "Three")]),
];

test("copies only the named topics that the target does not have", () => {
  const eu = [section("ps_a", [topic("old_1", "Old"), topic("pt_1", "One")])];

  const comparison = compareTopics(us, eu, ["pt_1", "pt_2"]);

  assert.deepEqual(comparison.topicsToCopy, [{ topic: topic("pt_2", "Two"), sectionId: "ps_a" }]);
  assert.deepEqual(comparison.sectionsToCreate, []);
  assert.deepEqual(
    comparison.topics.map((t) => [t.topicId, t.inTarget]),
    [["pt_1", true], ["pt_2", false]],
  );
});

test("creates a missing section once for all its topics", () => {
  const usWithTwo = [section("ps_b", [topic("pt_3"), topic("pt_4")])];

  const comparison = compareTopics(usWithTwo, [], ["pt_3", "pt_4"]);

  assert.deepEqual(comparison.sectionsToCreate, [usWithTwo[0]]);
  assert.deepEqual(comparison.topicsToCopy.map((t) => t.sectionId), ["ps_b", "ps_b"]);
});

test("does not create a section that the target already has", () => {
  const eu = [section("ps_b", [])];

  const comparison = compareTopics(us, eu, ["pt_3"]);

  assert.deepEqual(comparison.sectionsToCreate, []);
  assert.deepEqual(comparison.topicsToCopy.map((t) => t.topic.templateId), ["pt_3"]);
});

test("reports ids that the source does not have", () => {
  const comparison = compareTopics(us, [], ["pt_1", "pt_missing"]);

  assert.deepEqual(comparison.missingInSource, ["pt_missing"]);
  assert.deepEqual(comparison.topicsToCopy.map((t) => t.topic.templateId), ["pt_1"]);
});

test("reports a target topic with the same name and another id", () => {
  const eu = [section("ps_a", [topic("pt_other", "One")])];

  const comparison = compareTopics(us, eu, ["pt_1"]);

  assert.deepEqual(comparison.topics[0].sameNameInTarget, ["pt_other"]);
  assert.equal(comparison.topics[0].inTarget, false);
});

test("does not report the topic itself as a same-name topic", () => {
  const eu = [section("ps_a", [topic("pt_1", "One")])];

  const comparison = compareTopics(us, eu, ["pt_1"]);

  assert.deepEqual(comparison.topics[0].sameNameInTarget, []);
});

test("handles a topic id given twice once", () => {
  const comparison = compareTopics(us, [], ["pt_1", "pt_1"]);

  assert.equal(comparison.topics.length, 1);
  assert.equal(comparison.topicsToCopy.length, 1);
});
