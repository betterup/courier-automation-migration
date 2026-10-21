// Compares the given subscription topics in the source and target
// workspaces, and lists the topics that the target lacks. copy-to-eu.js
// prints this in a dry run and writes it with --apply. It makes no Courier
// calls, so the tests can run it on sample data. Sections are the
// `preferenceSections` nodes of the Studio API. Target topics are the
// `preferenceTemplates` nodes, which also hold topics that are in no section.

const topicsOf = (section) => section?.preferenceGroups?.nodes || [];

const findTopic = (sections, topicId) => {
  for (const section of sections) {
    const topic = topicsOf(section).find((t) => t.templateId === topicId);
    if (topic) return { section, topic };
  }
  return null;
};

export const compareTopics = (sourceSections, targetSections, targetTopics, topicIds) => {
  const targetSectionIds = new Set(targetSections.map((s) => s.sectionId));
  const topicsToCopy = [];

  const topics = [...new Set(topicIds)].map((topicId) => {
    const source = findTopic(sourceSections, topicId);
    if (!source) return { topicId, inSource: false };

    const { section, topic } = source;
    const inTarget = targetTopics.some((t) => t.templateId === topicId);
    const targetSection = findTopic(targetSections, topicId)?.section;
    const sameNameInTarget = targetTopics
      .filter((t) => t.templateName === topic.templateName && t.templateId !== topicId)
      .map((t) => t.templateId);

    if (!inTarget) {
      // Sections are not created: the topic goes into the target section with
      // the source section id, or into no section when the target lacks it.
      const sectionId = targetSectionIds.has(section.sectionId) ? section.sectionId : null;
      topicsToCopy.push({ topic, sectionId });
    }

    return {
      topicId,
      inSource: true,
      name: topic.templateName,
      sectionId: section.sectionId,
      sectionName: section.name,
      inTarget,
      targetSectionName: targetSection ? targetSection.name : null,
      sameNameInTarget,
    };
  });

  return {
    topics,
    missingInSource: topics.filter((t) => !t.inSource).map((t) => t.topicId),
    topicsToCopy,
  };
};
