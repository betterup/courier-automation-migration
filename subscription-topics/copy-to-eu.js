import fetch from "node-fetch";

import get from "lodash/get.js";
import omit from "lodash/omit.js";

import { compareTopics } from "./compare.js";
import { getHeaders } from "../utils.js";
import { authorizations, graphqlEndpoint } from "../variables.js";

const USAGE =
  "Usage: node subscription-topics/copy-to-eu.js <test|production> <topic_id> [<topic_id> ...] [--apply]";

// check JWT expiration
const checkJWTExpiration = (locale) => {
  const payload = JSON.parse(
    Buffer.from(authorizations[locale].split(".")[1], "base64").toString(
      "utf-8",
    ),
  );
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw Error("JWT expired: " + locale);
  }
};

const request = async (environment, locale, body) => {
  const name = body.operationName || "preferenceSections";
  const response = await fetch(graphqlEndpoint(environment)[locale], {
    method: "POST",
    headers: getHeaders(locale),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw Error(`${locale} ${name}: HTTP ${response.status}`);
  }
  const data = await response.json();
  if (data.errors) {
    throw Error(`${locale} ${name}: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
};

const getSections = async (environment, locale) => {
  const data = await request(environment, locale, {
    variables: {},
    query: `{
              preferenceSections {
                nodes {
                  name
                  sectionId
                  sectionIndex
                  routingOptions
                  hasCustomRouting
                  preferenceGroups {
                    nodes {
                      defaultStatus
                      linkedNotifications
                      allowedPreferences
                      routingOptions
                      isArchived
                      topicIndex
                      notificationTemplates {
                        nodes {
                          name
                          templateId
                          id
                          __typename
                    }
                    __typename
              }
                  templateId
                  templateName
                  __typename
            }
                __typename
          }
              __typename
        }
            __typename
      }
    }`,
  });
  return get(data, "preferenceSections.nodes", []);
};

const saveSection = async (environment, locale, section) => {
  const data = await request(environment, locale, {
    operationName: "SavePreferenceSection",
    variables: {
      section: omit(section, ["__typename", "preferenceGroups"]),
    },
    query:
      "mutation SavePreferenceSection($section: PreferenceSectionDataInput!) {\n  savePreferenceSection(section: $section) {\n    name\n    sectionId\n    sectionIndex\n    preferenceGroups {\n      nodes {\n        defaultStatus\n        linkedNotifications\n        templateId\n        templateName\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
  });
  const savedId = get(data, "savePreferenceSection.sectionId");
  if (savedId !== section.sectionId) {
    throw Error(
      `${locale} section "${section.name}" saved with id ${savedId}, not ${section.sectionId}. Stopping.`,
    );
  }
};

const saveTopic = async (environment, locale, topic, sectionId) => {
  const data = await request(environment, locale, {
    operationName: "savePreferenceTemplate",
    variables: {
      template: omit(topic, [
        "__typename",
        "linkedNotifications",
        "notificationTemplates",
      ]),
    },
    query:
      "mutation savePreferenceTemplate($template: PreferenceTemplateDataInput!, $isCopying: Boolean) {\n  savePreferenceTemplate(template: $template, isCopying: $isCopying) {\n    allowedPreferences\n    created\n    defaultStatus\n    id\n    isArchived\n    routingOptions\n    templateId\n    templateName\n    topicIndex\n    __typename\n  }\n}\n",
  });
  const savedId = get(data, "savePreferenceTemplate.templateId");
  if (savedId !== topic.templateId) {
    throw Error(
      `${locale} topic "${topic.templateName}" saved with id ${savedId}, not ${topic.templateId}. Stopping.`,
    );
  }

  await request(environment, locale, {
    operationName: "addPreferenceGroup",
    variables: { sectionId, preferenceGroupId: topic.templateId },
    query: `mutation addPreferenceGroup($sectionId: String!, $preferenceGroupId: String!) {
              addPreferenceGroup(sectionId: $sectionId, preferenceGroupId: $preferenceGroupId) {
                sectionId
                __typename
              }
            }`,
  });
};

const printComparison = (comparison) => {
  for (const t of comparison.topics) {
    if (!t.inSource) {
      console.log(`${t.topicId}  US: not found`);
      continue;
    }
    const eu = t.inTarget ? "same id" : "missing";
    console.log(
      `${t.topicId}  "${t.name}"  section "${t.sectionName}" (${t.sectionId})  US: found  EU: ${eu}`,
    );
    for (const otherId of t.sameNameInTarget) {
      console.log(`  EU has a topic with the same name and another id: ${otherId}`);
    }
  }
  const sections = comparison.sectionsToCreate.map((s) => `"${s.name}" (${s.sectionId})`);
  console.log(`Sections to create in EU: ${sections.join(", ") || "none"}`);
  console.log(`Topics to copy to EU: ${comparison.topicsToCopy.length}`);
};

const copyTopics = async (environment, topicIds, apply) => {
  console.log(`Environment: ${environment} (US => EU)`);
  const usSections = await getSections(environment, "us");
  const comparison = compareTopics(usSections, await getSections(environment, "eu"), topicIds);
  printComparison(comparison);

  if (comparison.missingInSource.length > 0) {
    throw Error(`Not in US: ${comparison.missingInSource.join(", ")}. Nothing written.`);
  }
  if (!apply) {
    console.log("Dry run: nothing written. Add --apply to write.");
    return;
  }

  for (const section of comparison.sectionsToCreate) {
    await saveSection(environment, "eu", section);
    console.log(`Created section "${section.name}" (${section.sectionId})`);
  }
  for (const { topic, sectionId } of comparison.topicsToCopy) {
    await saveTopic(environment, "eu", topic, sectionId);
    console.log(`Copied topic "${topic.templateName}" (${topic.templateId})`);
  }

  console.log("\nRead back from EU:");
  const after = compareTopics(usSections, await getSections(environment, "eu"), topicIds);
  printComparison(after);
  if (after.topicsToCopy.length > 0) {
    throw Error("Some topics are still missing in EU.");
  }
};

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const [environment, ...topicIds] = args.filter((arg) => arg !== "--apply");

if (!["test", "production"].includes(environment) || topicIds.length === 0) {
  console.error(USAGE);
  process.exit(1);
}

checkJWTExpiration("us");
checkJWTExpiration("eu");

copyTopics(environment, topicIds, apply).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
