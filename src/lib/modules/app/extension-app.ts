import * as vscode from 'vscode';
import { AnchorEngine, AnchorTracker } from '../anchoring';
import { FixMyCommentsController } from '../comments';
import { GutterDecorator } from '../decorations';
import { TasksViewProvider } from '../tasks';
import { CommandRegistry } from './command-registry';
import { StorageWatcher } from './storage-watcher';

export class ExtensionApp implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  start(): void {
    const tasksProvider = new TasksViewProvider(this.context);
    const tasksView = vscode.window.registerTreeDataProvider('fixMyComments.tasks', tasksProvider);
    const tracker = new AnchorTracker();
    const engine = new AnchorEngine(this.context, tracker, tasksProvider);
    const gutterDecorator = new GutterDecorator(this.context, tracker);
    const gutterSync = tasksProvider.onDidChangeTreeData(() => gutterDecorator.refresh());
    const controller = new FixMyCommentsController(this.context, tasksProvider);
    const commands = new CommandRegistry(controller);
    commands.register();
    const storageWatcher = new StorageWatcher(controller, tasksProvider);

    this.disposables.push(
      tasksView,
      tasksProvider,
      tracker,
      engine,
      gutterDecorator,
      gutterSync,
      controller,
      commands,
      storageWatcher,
    );

    this.context.subscriptions.push(this);
  }

  dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }
}
