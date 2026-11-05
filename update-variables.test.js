import assert from "node:assert/strict";
import { test } from "node:test";

import { updateVariables } from "./update-variables.js";

const body = (nodes) => JSON.stringify({ variables: { nodes } });

test("rewrites every app link in the automation, not only the first one", () => {
  const content = body([
    { data: { url: "https://app.betterup.co/manage/plan" } },
    { data: { url: "https://app.betterup.co/appointments/new" } },
  ]);

  assert.equal(
    updateVariables(content),
    body([
      { data: { url: "https://app.betterup.eu/manage/plan" } },
      { data: { url: "https://app.betterup.eu/appointments/new" } },
    ]),
  );
});

test("rewrites every Courier API and staging link", () => {
  const content = body([
    { webhook: "https://api.courier.com/a" },
    { webhook: "https://api.courier.com/b" },
    { url: "https://app.staging.betterup.io/a" },
    { url: "https://app.staging.betterup.io/b" },
  ]);

  assert.equal(
    updateVariables(content),
    body([
      { webhook: "https://api.eu.courier.com/a" },
      { webhook: "https://api.eu.courier.com/b" },
      { url: "https://app.staging.eu.betterup.io/a" },
      { url: "https://app.staging.eu.betterup.io/b" },
    ]),
  );
});

test("does not change app.betterup.com links", () => {
  const content = body([{ url: "https://app.betterup.com/a" }]);

  assert.equal(updateVariables(content), content);
});

test("does not change links that are already on EU hosts", () => {
  const content = body([
    { webhook: "https://api.eu.courier.com/a" },
    { url: "https://app.betterup.eu/a" },
    { url: "https://app.staging.eu.betterup.io/a" },
  ]);

  assert.equal(updateVariables(content), content);
});
