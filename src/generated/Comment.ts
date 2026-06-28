import { isJSON, decodeString, _decodeString } from 'type-decoder';

/**
 * @type { DraftModeType }
 */
export type DraftModeType = 'task' | 'suggestion';

export function decodeDraftModeType(rawInput: unknown): DraftModeType | null {
  switch (rawInput) {
    case 'task':
    case 'suggestion':
      return rawInput;
  }
  return null;
}

export function _decodeDraftModeType(rawInput: unknown): DraftModeType | undefined {
  switch (rawInput) {
    case 'task':
    case 'suggestion':
      return rawInput;
  }
  return;
}

/**
 * @type { DraftMode }
 */
export type DraftMode = {
  /**
   * @type { DraftModeType }
   * @memberof DraftMode
   */
  type: DraftModeType;
  /**
   * @type { string }
   * @memberof DraftMode
   */
  originalCode: string | null;
};

export function decodeDraftMode(rawInput: unknown): DraftMode | null {
  if (isJSON(rawInput)) {
    const decodedType = decodeDraftModeType(rawInput['type']);
    const decodedOriginalCode = decodeString(rawInput['originalCode']);

    if (decodedType === null) {
      return null;
    }

    return {
      type: decodedType,
      originalCode: decodedOriginalCode,
    };
  }
  return null;
}
