import * as vscode from 'vscode';

export type ComposeResult =
  | { type: 'comment'; content: string }
  | { type: 'suggestion'; content: string; suggestionCode: string };

/**
 * GitHub/Bitbucket-style compose panel — a webview panel that lets the user
 * write a comment or a diff-style code suggestion before submitting.
 *
 * Usage: call `ComposePanel.show(context, originalCode)` and await the
 * returned promise. Resolves with the user's submission or null if cancelled.
 */
export class ComposePanel {
  static async show(
    context: vscode.ExtensionContext,
    originalCode: string,
    filePath: string,
    line: number,
  ): Promise<ComposeResult | null> {
    return new Promise<ComposeResult | null>((resolve) => {
      const panel = vscode.window.createWebviewPanel(
        'fmcCompose',
        `Comment · ${filePath.split('/').pop() ?? filePath}:${line + 1}`,
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
        {
          enableScripts: true,
          localResourceRoots: [context.extensionUri],
          retainContextWhenHidden: true,
        },
      );

      panel.webview.html = buildHtml(originalCode);

      let settled = false;
      const settle = (result: ComposeResult | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        panel.dispose();
        resolve(result);
      };

      panel.webview.onDidReceiveMessage(
        (msg: unknown) => {
          if (
            typeof msg !== 'object' ||
            msg === null ||
            !('command' in msg) ||
            typeof msg.command !== 'string'
          ) {
            return;
          }
          if (msg.command === 'submit') {
            const type = 'type' in msg ? msg.type : null;
            const content =
              'content' in msg && typeof msg.content === 'string' ? msg.content.trim() : '';
            if (content.length === 0) {
              settle(null);
              return;
            }
            if (type === 'suggestion') {
              const suggestionCode =
                'suggestionCode' in msg && typeof msg.suggestionCode === 'string'
                  ? msg.suggestionCode
                  : '';
              settle({ type: 'suggestion', content, suggestionCode });
            } else {
              settle({ type: 'comment', content });
            }
          } else if (msg.command === 'cancel') {
            settle(null);
          }
        },
        null,
        context.subscriptions,
      );

      panel.onDidDispose(() => settle(null), null, context.subscriptions);
    });
  }
}

function buildHtml(originalCode: string): string {
  const escaped = originalCode
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Leave a comment</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100vh;
    }

    /* Tab switcher */
    .tabs {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 0;
    }
    .tab {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--vscode-foreground);
      opacity: 0.6;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: opacity 0.15s, border-color 0.15s;
    }
    .tab:hover { opacity: 0.9; }
    .tab.active {
      opacity: 1;
      border-bottom-color: var(--vscode-focusBorder, #007acc);
    }

    /* Panels */
    .panel { display: none; flex-direction: column; gap: 10px; flex: 1; }
    .panel.visible { display: flex; }

    /* Textarea */
    textarea {
      width: 100%;
      min-height: 100px;
      resize: vertical;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      padding: 8px 10px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      outline: none;
    }
    textarea:focus {
      border-color: var(--vscode-focusBorder, #007acc);
    }

    /* Suggestion diff */
    .diff-block {
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      overflow: hidden;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
    }
    .diff-label {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      color: var(--vscode-foreground);
      opacity: 0.6;
      background: var(--vscode-editor-inactiveSelectionBackground);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .diff-original {
      background: var(--vscode-diffEditor-removedLineBackground, rgba(255,0,0,0.08));
      border-left: 3px solid var(--vscode-gitDecoration-deletedResourceForeground, #f44747);
      padding: 8px 10px;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--vscode-foreground);
      opacity: 0.8;
    }
    .diff-arrow {
      text-align: center;
      padding: 4px;
      font-size: 16px;
      opacity: 0.5;
    }
    .diff-new {
      background: var(--vscode-diffEditor-insertedLineBackground, rgba(0,200,0,0.08));
      border-left: 3px solid var(--vscode-gitDecoration-addedResourceForeground, #73c991);
    }
    .diff-new textarea {
      border: none;
      border-radius: 0;
      background: transparent;
      resize: vertical;
      min-height: 80px;
      width: 100%;
    }
    .diff-new textarea:focus { border-color: transparent; }

    /* Label */
    label {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.6;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    /* Hint */
    .hint {
      font-size: 11px;
      opacity: 0.5;
    }

    /* Buttons */
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: auto;
      padding-top: 8px;
    }
    button {
      padding: 5px 14px;
      border-radius: 3px;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      font-family: var(--vscode-font-family);
      transition: opacity 0.15s;
    }
    button:hover { opacity: 0.85; }
    .btn-cancel {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ccc);
    }
    .btn-submit {
      background: var(--vscode-button-background, #007acc);
      color: var(--vscode-button-foreground, #fff);
    }
  </style>
</head>
<body>
  <div class="tabs">
    <button class="tab active" data-tab="comment">💬 Comment</button>
    <button class="tab" data-tab="suggestion">📝 Suggestion</button>
  </div>

  <!-- Comment panel -->
  <div id="panel-comment" class="panel visible">
    <label for="comment-input">Leave a comment</label>
    <textarea id="comment-input" placeholder="What needs attention here? Supports Markdown." rows="6" autofocus></textarea>
    <span class="hint">Tip: Enter to submit · Shift+Enter for new line</span>
    <div class="actions">
      <button class="btn-cancel" id="cancel-comment">Cancel</button>
      <button class="btn-submit" id="submit-comment">Add Comment</button>
    </div>
  </div>

  <!-- Suggestion panel -->
  <div id="panel-suggestion" class="panel">
    <label>Suggest a change</label>
    <div class="diff-block">
      <div class="diff-label">Original</div>
      <div class="diff-original" id="original-code">${escaped || '(no code selected)'}</div>
      <div class="diff-arrow">↓</div>
      <div class="diff-new">
        <textarea id="suggestion-input" placeholder="Paste or type the suggested replacement code here…">${escaped}</textarea>
      </div>
    </div>
    <label for="suggestion-comment">Comment (optional)</label>
    <textarea id="suggestion-comment" placeholder="Explain why this change is needed…" rows="3"></textarea>
    <div class="actions">
      <button class="btn-cancel" id="cancel-suggestion">Cancel</button>
      <button class="btn-submit" id="submit-suggestion">Add Suggestion</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Tab switching
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach((p) => p.classList.remove('visible'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('visible');
      });
    });

    // Submit comment
    document.getElementById('submit-comment').addEventListener('click', () => {
      const content = document.getElementById('comment-input').value;
      vscode.postMessage({ command: 'submit', type: 'comment', content });
    });

    // Submit suggestion
    document.getElementById('submit-suggestion').addEventListener('click', () => {
      const suggestionCode = document.getElementById('suggestion-input').value;
      const content = document.getElementById('suggestion-comment').value || 'Code suggestion';
      vscode.postMessage({ command: 'submit', type: 'suggestion', content, suggestionCode });
    });

    // Cancel buttons
    document.getElementById('cancel-comment').addEventListener('click', () => {
      vscode.postMessage({ command: 'cancel' });
    });
    document.getElementById('cancel-suggestion').addEventListener('click', () => {
      vscode.postMessage({ command: 'cancel' });
    });

    // Keyboard shortcut: Ctrl/Cmd+Enter submits
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const active = document.querySelector('.tab.active');
        if (active?.dataset.tab === 'suggestion') {
          document.getElementById('submit-suggestion').click();
        } else {
          document.getElementById('submit-comment').click();
        }
      }
      if (e.key === 'Escape') {
        vscode.postMessage({ command: 'cancel' });
      }
    });

    // Focus on load
    document.getElementById('comment-input').focus();
  </script>
</body>
</html>`;
}
