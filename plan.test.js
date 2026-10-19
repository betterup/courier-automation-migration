import assert from "node:assert/strict";
import { test } from "node:test";

import { planTopicCopy } from "./plan.js";

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

  const plan = planTopicCopy(us, eu, ["pt_1", "pt_2"]);

  assert.deepEqual(plan.topicsToCopy, [{ topic: topic("pt_2", "Two"), sectionId: "ps_a" }]);
  assert.deepEqual(plan.sectionsToCreate, []);
  assert.deepEqual(
    plan.topics.map((t) => [t.topicId, t.inTarget]),
    [["pt_1", true], ["pt_2", false]],
  );
});

test("creates a missing section once for all its topics", () => {
  const usWithTwo = [section("ps_b", [topic("pt_3"), topic("pt_4")])];

  const plan = planTopicCopy(usWithTwo, [], ["pt_3", "pt_4"]);

  assert.deepEqual(plan.sectionsToCreate, [usWithTwo[0]]);
  assert.deepEqual(plan.topicsToCopy.map((t) => t.sectionId), ["ps_b", "ps_b"]);
});

test("does not create a section that the target already has", () => {
  const eu = [section("ps_b", [])];

  const plan = planTopicCopy(us, eu, ["pt_3"]);

  assert.deepEqual(plan.sectionsToCreate, []);
  assert.deepEqual(plan.topicsToCopy.map((t) => t.topic.templateId), ["pt_3"]);
});

test("reports ids that the source does not have", () => {
  const plan = planTopicCopy(us, [], ["pt_1", "pt_missing"]);

  assert.deepEqual(plan.missingInSource, ["pt_missing"]);
  assert.deepEqual(plan.topicsToCopy.map((t) => t.topic.templateId), ["pt_1"]);
});

test("reports a target topic with the same name and another id", () => {
  const eu = [section("ps_a", [topic("pt_other", "One")])];

  const plan = planTopicCopy(us, eu, ["pt_1"]);

  assert.deepEqual(plan.topics[0].sameNameInTarget, ["pt_other"]);
  assert.equal(plan.topics[0].inTarget, false);
});

test("does not report the topic itself as a same-name topic", () => {
  const eu = [section("ps_a", [topic("pt_1", "One")])];

  const plan = planTopicCopy(us, eu, ["pt_1"]);

  assert.deepEqual(plan.topics[0].sameNameInTarget, []);
});

test("handles a topic id given twice once", () => {
  const plan = planTopicCopy(us, [], ["pt_1", "pt_1"]);

  assert.equal(plan.topics.length, 1);
  assert.equal(plan.topicsToCopy.length, 1);
});
