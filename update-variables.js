// Rewrites the US hosts in an automation to their EU hosts. The input is the
// JSON body of one save request, which holds every node of the automation, so
// each pattern must replace every match, not only the first one.
export const updateVariables = (content) => {
  return content.replace(/api\.courier\.com/g, "api.eu.courier.com")
                .replace(/app\.betterup\.co\b/g, "app.betterup.eu")
                .replace(/app\.staging\.betterup\.io/g, "app.staging.eu.betterup.io")
                .replace(/topic-rex-lb-1225292210\.us-west-2\.elb\.amazonaws\.com/g, "topic-rex-lb-1225292210.us-west-2.elb.amazonaws.com");
};
