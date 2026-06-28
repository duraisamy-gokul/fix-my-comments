import { isJSON, decodeNumber, _decodeNumber, decodeString, _decodeString } from 'type-decoder';

/**
 * @type { AnchorState }
 */
export type AnchorState = 'valid' | 'outdated' | 'orphaned';

export function decodeAnchorState(rawInput: unknown): AnchorState | null {
  switch (rawInput) {
    case 'valid':
    case 'outdated':
    case 'orphaned':
      return rawInput;
  }
  return null;
}

export function _decodeAnchorState(rawInput: unknown): AnchorState | undefined {
  switch (rawInput) {
    case 'valid':
    case 'outdated':
    case 'orphaned':
      return rawInput;
  }
  return;
}

/**
 * @type { RecoveryResult }
 */
export type RecoveryResult = {
  /**
   * @type { AnchorState }
   * @memberof RecoveryResult
   */
  state: AnchorState;
  /**
   * @type { number }
   * @memberof RecoveryResult
   */
  line: number | null;
};

export function decodeRecoveryResult(rawInput: unknown): RecoveryResult | null {
  if (isJSON(rawInput)) {
    const decodedState = decodeAnchorState(rawInput['state']);
    const decodedLine = decodeNumber(rawInput['line']);

    if (decodedState === null) {
      return null;
    }

    return {
      state: decodedState,
      line: decodedLine,
    };
  }
  return null;
}

/**
 * @type { LineContentChange }
 */
export type LineContentChange = {
  /**
   * @type { string }
   * @memberof LineContentChange
   */
  filePath: string;
  /**
   * @type { string }
   * @memberof LineContentChange
   */
  threadId: string;
  /**
   * @type { number }
   * @memberof LineContentChange
   */
  line: number;
};

export function decodeLineContentChange(rawInput: unknown): LineContentChange | null {
  if (isJSON(rawInput)) {
    const decodedFilePath = decodeString(rawInput['filePath']);
    const decodedThreadId = decodeString(rawInput['threadId']);
    const decodedLine = decodeNumber(rawInput['line']);

    if (decodedFilePath === null || decodedThreadId === null || decodedLine === null) {
      return null;
    }

    return {
      filePath: decodedFilePath,
      threadId: decodedThreadId,
      line: decodedLine,
    };
  }
  return null;
}
