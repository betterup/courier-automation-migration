import fetch from "node-fetch";

import get from "lodash/get.js";

import {
  getAutomationNodesGraphQL,
  getAutomationTemplateGraphQL,
  getHeaders,
  saveAutomationV2GraphQL,
  saveAutomationV2TemplateQl,
} from "./utils.js";
import { authorizations, graphqlEndpoint } from "./variables.js";

const AUTOMATION_ID_SAFELIST = [
  '5a4f9964-7cfc-4ebc-8bc0-89e54b0a5d5a', // Spark Kindle Drip Campaign
  '436c453f-ef7c-42b4-bba8-15cf3a5ed3ed', // Spark Kindle Drip Campaign Exit
  '9ef909e9-def8-4c74-afd6-2cfc465bb7b5', // Care Spark Kindle Drip Campaign
  '9c628c07-cd0e-429e-97b7-b271829e39b0',  // Care Spark Kindle Drip Campaign Exit
  '01ce8c81-3a67-4316-9d79-d94c2526ebd7', // Scheduling > Nylas V3 Migration
]

const DISABLED_EVENT_PREFIX = 'NOT_AVAILABLE ';

const getAutomation = async (environment, locale, template_id, version) => {
  const headers = getHeaders(locale);
  const body_template = getAutomationTemplateGraphQL(template_id, version);
  const body_nodes = getAutomationNodesGraphQL(template_id, version);

  const response_graph = await fetch(graphqlEndpoint(environment)[locale], {
    method: "POST",
    headers,
    body: JSON.stringify(body_template),
  });

  const template = await response_graph.json();
  const response_nodes = await fetch(graphqlEndpoint(environment)[locale], {
    method: "POST",
    headers,
    body: JSON.stringify(body_nodes),
  });
  const nodes = await response_nodes.json();
  return {
    template: get(template, "data.automationsV2.template", {}),
    nodes: get(nodes, "data.automationsV2.nodes", []),
  };
};

const updateVariables = (content) => {
  return content.replace(/api\.courier\.com/, "api.eu.courier.com")
                .replace(/app\.betterup\.co/, "app.betterup.eu")
                .replace(/app\.staging\.betterup\.io/, "app.staging.eu.betterup.io")
                .replace(/topic-rex-lb-1225292210\.us-west-2\.elb\.amazonaws\.com/, "topic-rex-lb-1225292210.us-west-2.elb.amazonaws.com");
};

const updateAutomation = async (environment, locale, nodes, template, disable=false) => {
  const headers = getHeaders(locale);
  const body_nodes = saveAutomationV2GraphQL(nodes, template);
  const body_template = saveAutomationV2TemplateQl(nodes, template);

  if (disable) {
    body_nodes.variables.nodes.forEach(node => {
      if (node.type == 'trigger' && node.trigger_type == 'segment') {
        const event_id = node.event_id?.replace(DISABLED_EVENT_PREFIX, '') || '';
        node.event_id = [DISABLED_EVENT_PREFIX, event_id].join('');
      }
    });
    body_template.variables.nodes.forEach(node => {
      if (node.type == 'trigger' && node.trigger_type == 'segment') {
        const event_id = node.event_id.replace(DISABLED_EVENT_PREFIX, '');
        node.event_id = [DISABLED_EVENT_PREFIX, event_id].join('');
      }
    });
  }

  // console.log("body_nodes", body_nodes.variables);
  // console.log("body_template", body_template.variables);

  const response_nodes = await fetch(graphqlEndpoint(environment)[locale], {
    method: "POST",
    headers,
    body: updateVariables(JSON.stringify(body_nodes)),
  });
  const response_template = await fetch(graphqlEndpoint(environment)[locale], {
    method: "POST",
    headers,
    body: updateVariables(JSON.stringify(body_template)),
  });
  return {
    nodes: await response_nodes.json(),
    template: await response_template.json(),
  };
};

const syncAutomations = async (environment) => {
  const automations = await fetch(graphqlEndpoint(environment)["us"], {
    headers: getHeaders("us"),
    method: "POST",
    body: JSON.stringify({
      variables: {},
      query: `{
                  automationTemplates {
                    nodes {
                      name
                      id
                      template
                      templateId
                      createdAt
                      updatedAt
                      publishedAt
                      __typename
                }
                __typename
          }
              automationsV2 {
                    templates {
                      templates
                      __typename
                }
                __typename
          }
        }
            `,
    }),
  });
  const automation_data = await automations.json();
  const automation_ids = get(
    automation_data,
    ["data", "automationsV2", "templates", "templates"],
    [],
  );

  for (let i = 0; i < automation_ids.length; i++) {
    const automation = automation_ids[i];

    const { template, nodes } = await getAutomation(
      environment,
      "us",
      automation.id,
      'v0'
    );
    
    const disable = !AUTOMATION_ID_SAFELIST.includes(automation.id);
    const saved = await updateAutomation(environment, "eu", nodes, template, disable);
    const name = get(saved, [
        "template",
        "data",
        "automationsV2",
        "saveTemplate",
        "name",
      ]);
    const version = get(saved, [
        "template",
        "data",
        "automationsV2",
        "saveTemplate",
        "version",
      ]);

    console.log(''); // Add a newline for readability
    
    if (name) {
      console.log(`Saved - ${name} - ${version} - (${automation.id})`);
    } else {
      const nodeErrors = get(saved, ["nodes", "errors"]);
      const templateErrors = get(saved, ["template", "errors"]);
      console.log(`Failed - ${automation.id} - ${automation.name}`);
      console.log(JSON.stringify(nodeErrors));
      console.log(JSON.stringify(templateErrors));
    }
  }
};

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

checkJWTExpiration("us");
checkJWTExpiration("eu");

const environment = process.argv.slice(2)[0] || "test";
console.log('Syncing automations for environment:', environment);

syncAutomations(environment);


// getAutomation(environment, 'us', '5a4f9964-7cfc-4ebc-8bc0-89e54b0a5d5a', 'v0');
