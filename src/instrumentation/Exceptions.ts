import { Attributes } from '@opentelemetry/api';
import {
  ATTR_URL_PATH,
  ATTR_ERROR_TYPE,
  ATTR_CODE_COLUMN_NUMBER,
  ATTR_CODE_LINE_NUMBER,
  ATTR_CODE_FILE_PATH,
} from '@opentelemetry/semantic-conventions';

enum ErrorCategory {
  UNHANDLED_EXCEPTION = 'runtime',
  UNHANDLED_REJECTION = 'promise',
}

export class ExceptionHelper {
  /**
   * Parses an error into OTel semantic attributes.
   */
  public static getCustomAttributes(error: Error | string): Attributes {
    const attributes: Attributes = {
      [ATTR_URL_PATH]: window.location.href,
    };

    const isPromiseRejection =
      typeof PromiseRejectionEvent !== 'undefined' && error instanceof PromiseRejectionEvent;

    if (isPromiseRejection || (typeof error === 'object' && error !== null && 'reason' in error)) {
      attributes[ATTR_ERROR_TYPE] = ErrorCategory.UNHANDLED_REJECTION;
    } else {
      attributes[ATTR_ERROR_TYPE] = ErrorCategory.UNHANDLED_EXCEPTION;
    }

    if (error instanceof Error && error.stack) {
      const parsed = this.parseStack(error.stack);
      if (parsed) {
        attributes[ATTR_CODE_FILE_PATH] = parsed.fileName;
        attributes[ATTR_CODE_LINE_NUMBER] = parsed.lineNumber;
        attributes[ATTR_CODE_COLUMN_NUMBER] = parsed.columnNumber;
      }
    }

    return attributes;
  }

  private static parseStack(stack: string) {
    const lines = stack.split('\n');
    const stackLine = lines.find((line) => line.includes('http') || line.includes('://'));

    if (stackLine) {
      const stackRegex = /(https?:\/\/.*?):(\d+):(\d+)/;
      const match = stackLine.match(stackRegex);
      if (match) {
        return {
          fileName: match[1],
          lineNumber: parseInt(match[2], 10),
          columnNumber: parseInt(match[3], 10),
        };
      }
    }
    return null;
  }
}
