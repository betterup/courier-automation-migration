import fetch from "node-fetch";

import get from "lodash/get.js";

import {
  getAutomationNodesGraphQL,
  getAutomationTemplateGraphQL,
  getAutomationV3TemplateGraphQL,
  getHeaders,
  saveAutomationV2GraphQL,
  saveAutomationV2TemplateQl,
  saveAutomationV3TemplateGraphQL,
  publishAutomationV3TemplateGraphQL
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

const getAutomationV2 = async (environment, locale, template_id, version) => {
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

const getAutomationV3 = async (environment, locale, template_id) => {
  const headers = getHeaders(locale);
  const body = getAutomationV3TemplateGraphQL(template_id);

  const response = await fetch(graphqlEndpoint(environment)[locale], {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return get(data, "data.automationTemplate", {});
};

const updateVariables = (content) => {
  return content.replace(/api\.courier\.com/, "api.eu.courier.com")
                .replace(/app\.betterup\.co/, "app.betterup.eu")
                .replace(/app\.staging\.betterup\.io/, "app.staging.eu.betterup.io")
                .replace(/topic-rex-lb-1225292210\.us-west-2\.elb\.amazonaws\.com/, "topic-rex-lb-1225292210.us-west-2.elb.amazonaws.com");
};

const updateAutomationV2 = async (environment, locale, nodes, template, disable=false) => {
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

const updateAutomationV3 = async (environment, locale, template) => {
  const headers = getHeaders(locale);
  const body = saveAutomationV3TemplateGraphQL(template);
  const publishBody = publishAutomationV3TemplateGraphQL(template.id);

  const response = await fetch(graphqlEndpoint(environment)[locale], {
    method: "POST",
    headers,
    body: updateVariables(JSON.stringify(body)),
  });

  const saved = await response.json();
  
  // Publish the template
  const publishResponse = await fetch(graphqlEndpoint(environment)[locale], {
    method: "POST",
    headers,
    body: updateVariables(JSON.stringify(publishBody)),
  });

  const published = await publishResponse.json();
  return { saved, published };
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
      }`
    }),
  });
  const automation_data = await automations.json();
  
  // Handle V3 automations
  const v3_automations = get(automation_data, ["data", "automationTemplates", "nodes"], []);
  for (const automation of v3_automations) {
    try {
      const template = await getAutomationV3(environment, "us", automation.id);
      const saved = await updateAutomationV3(environment, "eu", template);
      
      console.log(''); // Add a newline for readability
      if (get(saved, ["saved", "data", "saveAutomationTemplate", "name"])) {
        console.log(`Saved V3 - ${automation.name} - (${automation.id})`);
      } else {
        const errors = get(saved, ["saved", "errors"]);
        console.log(`Failed V3 - ${automation.id} - ${automation.name}`);
        console.log(JSON.stringify(errors));
      }
    } catch (error) {
      console.error(`Error processing V3 automation ${automation.id}:`, error);
    }
  }

  // Handle V2 automations
  const v2_automations = get(automation_data, ["data", "automationsV2", "templates", "templates"], []);
  for (const automation of v2_automations) {
    try {
      const { template, nodes } = await getAutomationV2(environment, "us", automation.id, 'v0');
      const disable = !AUTOMATION_ID_SAFELIST.includes(automation.id);
      const saved = await updateAutomationV2(environment, "eu", nodes, template, disable);
      
      console.log(''); // Add a newline for readability
      if (get(saved, ["template", "data", "automationsV2", "saveTemplate", "name"])) {
        const version = get(saved, ["template", "data", "automationsV2", "saveTemplate", "version"]);
        console.log(`Saved V2 - ${automation.name} - ${version} - (${automation.id})`);
      } else {
        const nodeErrors = get(saved, ["nodes", "errors"]);
        const templateErrors = get(saved, ["template", "errors"]);
        console.log(`Failed V2 - ${automation.id} - ${automation.name}`);
        console.log(JSON.stringify(nodeErrors));
        console.log(JSON.stringify(templateErrors));
      }
    } catch (error) {
      console.error(`Error processing V2 automation ${automation.id}:`, error);
    }
  }
};

// check JWT expiration
const checkJWTExpiration = (locale) => {
  const payload = JSON.parse(
    Buffer.from(authorizations[locale].split(".")[1], "base64").toString("utf-8")
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
