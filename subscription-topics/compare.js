// Compares the given subscription topics in the source and target
// workspaces, and lists the sections and topics that the target lacks.
// copy-to-eu.js prints this in a dry run and writes it with --apply. It makes no
// Courier calls, so the tests can run it on sample data. Sections and
// topics are the `preferenceSections` nodes of the Studio API.

const topicsOf = (section) => section?.preferenceGroups?.nodes || [];

const findTopic = (sections, topicId) => {
  for (const section of sections) {
    const topic = topicsOf(section).find((t) => t.templateId === topicId);
    if (topic) return { section, topic };
  }
  return null;
};

export const compareTopics = (sourceSections, targetSections, topicIds) => {
  const targetTopics = targetSections.flatMap(topicsOf);
  const targetSectionIds = new Set(targetSections.map((s) => s.sectionId));
  const sectionsToCreate = new Map();
  const topicsToCopy = [];

  const topics = [...new Set(topicIds)].map((topicId) => {
    const source = findTopic(sourceSections, topicId);
    if (!source) return { topicId, inSource: false };

    const { section, topic } = source;
    const inTarget = Boolean(findTopic(targetSections, topicId));
    const sameNameInTarget = targetTopics
      .filter((t) => t.templateName === topic.templateName && t.templateId !== topicId)
      .map((t) => t.templateId);

    if (!inTarget) {
      if (!targetSectionIds.has(section.sectionId)) {
        sectionsToCreate.set(section.sectionId, section);
      }
      topicsToCopy.push({ topic, sectionId: section.sectionId });
    }

    return {
      topicId,
      inSource: true,
      name: topic.templateName,
      sectionId: section.sectionId,
      sectionName: section.name,
      inTarget,
      sameNameInTarget,
    };
  });

  return {
    topics,
    missingInSource: topics.filter((t) => !t.inSource).map((t) => t.topicId),
    sectionsToCreate: [...sectionsToCreate.values()],
    topicsToCopy,
  };
};
