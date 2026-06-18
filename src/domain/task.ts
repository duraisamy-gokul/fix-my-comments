export type TaskStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'blocked'
  | 'requires_review'
  | 'orphaned'
  | 'closed';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type AuthorType = 'user' | 'ai' | 'system';

export interface CodeAnchor {
  filePath: string;
  startLine: number;
  endLine: number;
  startCharacter: number;
  endCharacter: number;
  selectedText: string;
  selectedTextHash: string;
  beforeContext: string[];
  afterContext: string[];
}

export interface TaskMessage {
  id: string;
  authorType: AuthorType;
  author: string;
  content: string;
  timestamp: string;
  attachments: string[];
  changes: AiChange[];
}

export interface AiChange {
  executionId: string;
  agentName: string;
  timestamp: string;
  filesModified: string[];
  rangesModified: ChangedRange[];
  summary: string;
  reason: string;
}

export interface ChangedRange {
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface TaskHistoryEvent {
  id: string;
  type: string;
  actor: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface TaskAssignment {
  assignee: string;
  assigneeType: 'user' | 'ai';
  assignedAt: string;
  assignedBy: string;
}

export interface FixMyCommentTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  anchor: CodeAnchor;
  thread: TaskMessage[];
  history: TaskHistoryEvent[];
  assignments: TaskAssignment[];
  labels: string[];
}

export interface TaskCollection {
  schemaVersion: 1;
  tasks: FixMyCommentTask[];
}

export interface HistoryCollection {
  schemaVersion: 1;
  events: TaskHistoryEvent[];
}

export interface RepositoryMetadata {
  schemaVersion: 1;
  repositoryId: string;
  createdAt: string;
  updatedAt: string;
}
