import { type Task, decodeTask } from './Task';
import {
  isJSON,
  decodeString,
  _decodeString,
  decodeNumber,
  _decodeNumber,
  decodeArray,
  _decodeArray,
} from 'type-decoder';

/**
 * @type { WorkspaceIdentity }
 * @description Workspace identity derived from repo root and Git branch
 */
export type WorkspaceIdentity = {
  /**
   * @description Absolute path to the repository root
   * @type { string }
   * @memberof WorkspaceIdentity
   */
  repoRoot: string;
  /**
   * @description Current Git branch name
   * @type { string }
   * @memberof WorkspaceIdentity
   */
  branch: string;
  /**
   * @description Short SHA1 of repoRoot@branch used as the storage key
   * @type { string }
   * @memberof WorkspaceIdentity
   */
  key: string;
};

export function decodeWorkspaceIdentity(rawInput: unknown): WorkspaceIdentity | null {
  if (isJSON(rawInput)) {
    const decodedRepoRoot = decodeString(rawInput['repoRoot']);
    const decodedBranch = decodeString(rawInput['branch']);
    const decodedKey = decodeString(rawInput['key']);

    if (decodedRepoRoot === null || decodedBranch === null || decodedKey === null) {
      return null;
    }

    return {
      repoRoot: decodedRepoRoot,
      branch: decodedBranch,
      key: decodedKey,
    };
  }
  return null;
}

/**
 * @type { TaskFile }
 * @description Root shape of the tasks.json storage file
 */
export type TaskFile = {
  /**
   * @description Storage schema version
   * @type { number }
   * @memberof TaskFile
   */
  schemaVersion: number;
  /**
   * @description All tasks for this workspace and branch
   * @type { Task[] }
   * @memberof TaskFile
   */
  tasks: Task[];
};

export function decodeTaskFile(rawInput: unknown): TaskFile | null {
  if (isJSON(rawInput)) {
    const decodedSchemaVersion = decodeNumber(rawInput['schemaVersion']);
    const decodedTasks = decodeArray(rawInput['tasks'], decodeTask);

    if (decodedSchemaVersion === null || decodedTasks === null) {
      return null;
    }

    return {
      schemaVersion: decodedSchemaVersion,
      tasks: decodedTasks,
    };
  }
  return null;
}
