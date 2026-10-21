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
  '2c04d6da-cc01-4483-8eeb-6447349aaa99', // Manage FTUX Campaign
  'c9bc27ca-34f9-4751-9491-0bb260d36d23', // Manage Plan Is Ready Campaign
  '06c89ffe-baf7-4404-82e7-fe4140478035', // Manage Plan Is Ready Campaign Cont.
  'cf09c790-b98b-4b67-bdac-b278a8e66350', // Manage Plan Is Ready Cancel
  'f95c7545-e451-4c2c-9e17-9f3b7b92d9e1', // [Manage][Dynamic Personas] Job Level Transition Campaign
  '588cb546-5217-4861-a887-10881727389a', // [Manage][Dynamic Personas] Job Level Transition Campaign Cancel
  'da18ec12-ec77-4740-89c1-514942ee809f', // Manage Complete Daily Practice Campaign
  'd0b76807-804b-48a1-892c-b7575ea2e093', // Manage Complete Daily Practice Campaign Cancel
  '2a232ba2-d88a-4939-9494-2fa41c7f73b1', // Manage In The Flow Campaign
  '77c7dcd0-5425-42dd-860e-0b30c592c0d2', // Manage Schedule Next Session (Engaged) Campaign
  '5d5b2e9d-4922-4a1f-bfab-f4359aafe165', // Manage Schedule Next Session (Disengaged) Campaign
  'ba1f87a5-b28b-4c37-a5aa-20cd675f59e4', // Manage Schedule Next Session (Disengaged) Cancel
  '598d402f-c1a3-447a-b841-5c99295fe864', // Manage Upcoming Session Campaign
  '80f486c0-abb6-40fe-911d-8bed28a83e95', // Manage 2.1 Post Session Continue Same Plan Campaign
  '7fc0c4d0-ba4b-4216-9373-ec2d1e6a706e', // Manage 2.2 Plan Completed
  'c7e7fa46-c0df-4200-9197-31b7af5e645f', // Manage 2.2 Share Plan Completion with others
  'bfa5c698-815f-4a96-97f7-d8c1f3bae69b', // Manage PSA Ending Campaign
  '9556ae63-370b-457b-8540-8b52bc814d2b', // Manage Access/PSA End Confirmation
  '6e67ba1a-bfbc-48e0-a1de-a65fbffbbdb1', // Manage Session Cap Refresh Campaign
  '927f7df0-209e-4ecc-92d1-01890777393a', // Manage Schedule Second Appointment
  '855c97de-670d-4d44-808c-0bb9f3c55b75', // Manage Schedule Second Appointment Cancellation
  '0ddec930-1444-4de8-a6f8-3591c69f04d3', // Manage Post Session Flexible Activity Created Campaign
  'cd95a849-9d4c-4c4b-898b-551fd0a85de7', // Complete Team DNA Assessment
  'f7613477-6265-46ea-a739-6ea60d96f0f7', // Complete Team DNA Assessment Cancellation
  'fc694e51-b7a5-4d2a-a596-c2412ca756c8', // Team Pulse Discovery Campaign
  '4f99115f-4f25-498e-94d7-8343de30d9e1', // Team Pulse Discovery Campaign Cancel
  '6a341b5d-2c15-4ca3-8eea-8367a74daf35', // Standalone AI Continue Coaching Challenge Identified V2
  'df411a35-f309-4af5-a154-2c49c595547d', // Standalone AI Continue Coaching No Challenge V2
  'efd48eab-83f6-44d1-8502-82ee41f94de7', // Standalone AI Continue Coaching Next Steps Identified V2
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
