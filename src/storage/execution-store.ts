import * as vscode from 'vscode';
import { decodeExecutionFile } from '../generated';
import type { AgentExecution, ExecutionFile, WorkspaceIdentity } from '../generated';

const EMPTY: ExecutionFile = { schemaVersion: 1, executions: [] };

export class ExecutionStore {
  constructor(private readonly identity: WorkspaceIdentity) {}

  async listExecutions(taskId: string): Promise<AgentExecution[]> {
    const data = await this.read();
    return data.executions.filter((e) => e.taskId === taskId);
  }

  async appendExecution(execution: AgentExecution): Promise<void> {
    const data = await this.read();
    data.executions.push(execution);
    await this.write(data);
  }

  private get directory(): vscode.Uri {
    return vscode.Uri.file(this.identity.storagePath);
  }

  private get uri(): vscode.Uri {
    return vscode.Uri.joinPath(this.directory, 'executions.json');
  }

  private async read(): Promise<ExecutionFile> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.uri);
      const parsed: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'));
      return decodeExecutionFile(parsed) ?? EMPTY;
    } catch {
      return EMPTY;
    }
  }

  private async write(data: ExecutionFile): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.directory);
    await vscode.workspace.fs.writeFile(
      this.uri,
      Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    );
  }
}
