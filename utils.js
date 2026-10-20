import { authorizations, domains } from "./variables.js";

export const getAutomationTemplateGraphQL = (template_id, version) => ({
  operationName: "GetAutomationsV2Template",
  variables: {
    templateId: template_id,
    version: version,
  },
  query:
    "query GetAutomationsV2Template($templateId: String!, $version: String) {\n  automationsV2 {\n    template(templateId: $templateId, version: $version)\n    __typename\n  }\n}\n",
});

export const getAutomationNodesGraphQL = (template_id, version) => ({
  operationName: "GetAutomationsV2Nodes",
  variables: {
    templateId: template_id,
    version: version,
  },
  query:
    "query GetAutomationsV2Nodes($templateId: String!, $version: String) {\n  automationsV2 {\n    nodes(templateId: $templateId, version: $version)\n    __typename\n  }\n}\n",
});

export const getHeaders = (locale) => {
  return {
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    authorization: authorizations[locale],
    connection: "keep-alive",
    host: domains[locale],
    origin: `https://${domains[locale]}`,
    referer: `https://${domains[locale]}/`,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    accept: "*/*",
    "content-type": "application/json",
    "sec-ch-ua":
      '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
  };
};

export const saveAutomationV2GraphQL = (nodes, template_with_graph) => ({
  operationName: "SaveAutomationV2Graph",
  variables: {
    nodes: nodes,
    template: template_with_graph,
  },
  query:
    "mutation SaveAutomationV2Graph($template: JSON!, $nodes: JSON!) {\n  automationsV2 {\n    publishTemplate(template: $template, nodes: $nodes)\n    __typename\n  }\n}\n",
});

export const saveAutomationV2TemplateQl = (nodes, template_with_graph) => ({
  operationName: "SaveAutomationV2Template",
  variables: {
    nodes: nodes,
    template: template_with_graph,
  },
  query:
    "mutation SaveAutomationV2Template($template: JSON!, $nodes: JSON!) {\n  automationsV2 {\n    saveTemplate(template: $template, nodes: $nodes)\n    __typename\n  }\n}\n",
});
