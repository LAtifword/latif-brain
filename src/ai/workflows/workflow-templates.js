/**
 * Workflow Templates - Pre-built workflows for common automation tasks
 * Phase 6: Reusable workflow patterns and automation library
 */

import { WorkflowBuilder } from './workflow-dsl.js';

/**
 * Template: Daily Research Summary
 * Researches a topic, analyzes findings, and generates summary
 */
export function createDailyResearchWorkflow(topic) {
  return new WorkflowBuilder(`research_${Date.now()}`, 'Daily Research Summary')
    .description(`Automated daily research and analysis on: ${topic}`)
    .addTask('search', 'research-agent', {
      query: topic,
      sources: '${sources}',
      depth: 'comprehensive'
    })
    .addTask('analyze', 'analyzer-agent', {
      data: '$.search.results',
      focus: '${analysisType}',
      format: 'structured'
    })
    .addTask('summarize', 'writer-agent', {
      analysis: '$.analyze.findings',
      maxLength: 1000,
      style: 'professional'
    })
    .addTask('notify', 'notifier-agent', {
      message: '$.summarize.output',
      recipient: '${notifyEmail}',
      subject: `Daily Research: ${topic}`
    })
    .connect('search', 'analyze')
    .connect('analyze', 'summarize')
    .connect('summarize', 'notify')
    .start('search')
    .end('notify')
    .tags('research', 'daily', 'automation')
    .build();
}

/**
 * Template: Document Processing Pipeline
 * Processes uploaded documents: extract, analyze, archive
 */
export function createDocumentProcessingWorkflow() {
  return new WorkflowBuilder(`docproc_${Date.now()}`, 'Document Processing Pipeline')
    .description('Automated document processing: extraction, analysis, storage')
    .addTask('extract', 'document-processor', {
      document: '${documentPath}',
      format: 'auto-detect',
      includeMetadata: true
    })
    .addCondition('isText', 'ctx.format === "text" || ctx.format === "markdown"')
    .addCondition('isImage', 'ctx.format === "image" || ctx.format === "pdf-scanned"')
    .addTask('ocr', 'vision-agent', {
      image: '$.extract.content',
      language: '${language}',
      confidence: 0.8
    })
    .addTask('analyze', 'analyzer-agent', {
      content: 'ctx.isText ? $.extract.content : $.ocr.text',
      extractEntities: true,
      extractTopics: true
    })
    .addTask('archive', 'storage-agent', {
      content: '$.analyze.processed',
      metadata: '$.extract.metadata',
      index: true
    })
    .connect('extract', 'isText')
    .connect('extract', 'isImage')
    .connect('isText', 'analyze', 'ctx.isText')
    .connect('isImage', 'ocr', '!ctx.isText')
    .connect('ocr', 'analyze')
    .connect('analyze', 'archive')
    .start('extract')
    .end('archive')
    .tags('document', 'processing', 'pipeline')
    .build();
}

/**
 * Template: Data Backup and Sync
 * Backs up data locally, syncs to cloud if available
 */
export function createBackupSyncWorkflow() {
  return new WorkflowBuilder(`backup_${Date.now()}`, 'Data Backup and Sync')
    .description('Automated data backup with optional cloud sync')
    .addTask('backup', 'storage-agent', {
      source: '${dataPath}',
      destination: '${backupPath}',
      compression: true,
      timestamp: true
    })
    .addCondition('hasCloudConfig', '${cloudEnabled} === true')
    .addTask('sync', 'cloud-agent', {
      backupFile: '$.backup.path',
      destination: '${cloudBucket}',
      encryption: true
    })
    .addTask('cleanup', 'storage-agent', {
      keep: '${keepVersions}',
      path: '${backupPath}',
      deleteOlderThan: '${retentionDays}'
    })
    .connect('backup', 'hasCloudConfig')
    .connect('hasCloudConfig', 'sync', 'ctx.hasCloudConfig')
    .connect('backup', 'cleanup', '!ctx.hasCloudConfig')
    .connect('sync', 'cleanup')
    .start('backup')
    .end('cleanup')
    .tags('backup', 'storage', 'maintenance')
    .build();
}

/**
 * Template: Content Generation Pipeline
 * Generates content from prompts: outline, draft, review, polish
 */
export function createContentGenerationWorkflow() {
  return new WorkflowBuilder(`content_${Date.now()}`, 'Content Generation Pipeline')
    .description('Automated content generation with review cycles')
    .addTask('outline', 'writer-agent', {
      topic: '${topic}',
      format: 'outline',
      sections: '${numSections}'
    })
    .addTask('draft', 'writer-agent', {
      outline: '$.outline.output',
      style: '${style}',
      length: '${wordCount}'
    })
    .addTask('review', 'critic-agent', {
      content: '$.draft.output',
      criteria: ['clarity', 'accuracy', 'engagement'],
      suggestions: true
    })
    .addCondition('needsRevision', '${suggestions.length} > 0')
    .addTask('revise', 'writer-agent', {
      content: '$.draft.output',
      feedback: '$.review.suggestions',
      style: '${style}'
    })
    .addTask('polish', 'writer-agent', {
      content: 'ctx.needsRevision ? $.revise.output : $.draft.output',
      checkStyle: true,
      checkTone: true
    })
    .addTask('export', 'storage-agent', {
      content: '$.polish.output',
      format: '${exportFormat}',
      filename: '${filename}'
    })
    .connect('outline', 'draft')
    .connect('draft', 'review')
    .connect('review', 'needsRevision')
    .connect('needsRevision', 'revise', 'ctx.needsRevision')
    .connect('needsRevision', 'polish', '!ctx.needsRevision')
    .connect('revise', 'polish')
    .connect('polish', 'export')
    .start('outline')
    .end('export')
    .tags('content', 'generation', 'writing')
    .build();
}

/**
 * Template: Email Notification Workflow
 * Processes events and sends notifications
 */
export function createNotificationWorkflow() {
  return new WorkflowBuilder(`notify_${Date.now()}`, 'Event Notification')
    .description('Process events and send notifications')
    .addTask('filter', 'analyzer-agent', {
      event: '${event}',
      severity: '${minSeverity}',
      matchCriteria: '${criteria}'
    })
    .addCondition('shouldNotify', 'ctx.matched === true')
    .addTask('format', 'formatter-agent', {
      event: '$.filter.output',
      template: '${templateId}',
      includeDetails: true
    })
    .addTask('send', 'email-agent', {
      message: '$.format.output',
      recipients: '${recipients}',
      subject: '${subject}'
    })
    .addTask('log', 'logger-agent', {
      event: '${event}',
      notification: '$.send.messageId',
      status: 'sent'
    })
    .connect('filter', 'shouldNotify')
    .connect('shouldNotify', 'format', 'ctx.shouldNotify')
    .connect('format', 'send')
    .connect('send', 'log')
    .connect('shouldNotify', 'log', '!ctx.shouldNotify')
    .start('filter')
    .end('log')
    .tags('notification', 'event', 'communication')
    .build();
}

/**
 * Template: Periodic Maintenance
 * Cleans up, optimizes, and maintains system health
 */
export function createMaintenanceWorkflow() {
  return new WorkflowBuilder(`maintenance_${Date.now()}`, 'Periodic Maintenance')
    .description('System maintenance: cleanup, optimization, health check')
    .addTask('cleanup', 'storage-agent', {
      targets: ['cache', 'temp', 'logs'],
      olderThan: '${retentionDays}',
      dryRun: false
    })
    .addTask('optimize', 'storage-agent', {
      database: true,
      indexes: true,
      vacuum: true
    })
    .addTask('health-check', 'monitor-agent', {
      diskSpace: true,
      memory: true,
      processes: true
    })
    .addTask('report', 'reporter-agent', {
      cleanup: '$.cleanup.result',
      optimization: '$.optimize.result',
      health: '$.health-check.result',
      format: 'summary'
    })
    .connect('cleanup', 'optimize')
    .connect('optimize', 'health-check')
    .connect('health-check', 'report')
    .start('cleanup')
    .end('report')
    .tags('maintenance', 'system', 'operations')
    .build();
}

/**
 * Get workflow template by name
 */
export function getWorkflowTemplate(templateName, params = {}) {
  const templates = {
    'daily-research': () => createDailyResearchWorkflow(params.topic || 'General News'),
    'document-processing': () => createDocumentProcessingWorkflow(),
    'backup-sync': () => createBackupSyncWorkflow(),
    'content-generation': () => createContentGenerationWorkflow(),
    'notification': () => createNotificationWorkflow(),
    'maintenance': () => createMaintenanceWorkflow()
  };

  const templateFn = templates[templateName];
  if (!templateFn) {
    throw new Error(`Unknown workflow template: ${templateName}`);
  }

  return templateFn();
}

/**
 * List available templates
 */
export function listAvailableTemplates() {
  return [
    {
      name: 'daily-research',
      description: 'Automated daily research and analysis',
      parameters: ['topic', 'sources', 'analysisType', 'notifyEmail']
    },
    {
      name: 'document-processing',
      description: 'Process documents: extract, analyze, archive',
      parameters: ['documentPath', 'language']
    },
    {
      name: 'backup-sync',
      description: 'Backup data with optional cloud sync',
      parameters: ['dataPath', 'backupPath', 'cloudEnabled', 'cloudBucket', 'retentionDays']
    },
    {
      name: 'content-generation',
      description: 'Generate content with review cycle',
      parameters: ['topic', 'style', 'wordCount', 'numSections', 'exportFormat']
    },
    {
      name: 'notification',
      description: 'Process events and send notifications',
      parameters: ['event', 'minSeverity', 'criteria', 'templateId', 'recipients']
    },
    {
      name: 'maintenance',
      description: 'System maintenance and health checks',
      parameters: ['retentionDays']
    }
  ];
}
