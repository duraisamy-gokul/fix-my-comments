import * as vscode from 'vscode';
import { decodeTaskFile } from '../generated';
import type { Task, TaskFile, WorkspaceIdentity } from '../generated';

const EMPTY_FILE: TaskFile = { schemaVersion: 1, tasks: [] };

export class TaskStore {
  constructor(
    private readonly globalStorageUri: vscode.Uri,
    private readonly identity: WorkspaceIdentity,
  ) {}

  async listTasks(): Promise<Task[]> {
    const data = await this.read();
    return data.tasks;
  }

  async saveTask(task: Task): Promise<void> {
    const data = await this.read();
    const index = data.tasks.findIndex((existing) => existing.id === task.id);
    if (index >= 0) {
      data.tasks[index] = task;
    } else {
      data.tasks.push(task);
    }
    await this.write(data);
  }

  private get directory(): vscode.Uri {
    return vscode.Uri.joinPath(this.globalStorageUri, this.identity.key);
  }

  private get tasksUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.directory, 'tasks.json');
  }

  private async read(): Promise<TaskFile> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.tasksUri);
      const parsed: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'));
      return decodeTaskFile(parsed) ?? EMPTY_FILE;
    } catch {
      return EMPTY_FILE;
    }
  }

  private async write(data: TaskFile): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.directory);
    await vscode.workspace.fs.writeFile(
      this.tasksUri,
      Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    );
  }
}
