import {
  ATTR_CODE_COLUMN_NUMBER,
  ATTR_CODE_FILE_PATH,
  ATTR_CODE_LINE_NUMBER,
  ATTR_ERROR_TYPE,
  ATTR_URL_PATH,
} from '@opentelemetry/semantic-conventions';
import { ExceptionHelper } from '@src/instrumentation';

describe('ExceptionHelper', () => {
  it('should map runtime errors to OTel attributes', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n at https://app.example.com/index.js:10:20';

    const attributes = ExceptionHelper.getCustomAttributes(error);

    expect(attributes[ATTR_URL_PATH]).toBe(window.location.href);
    expect(attributes[ATTR_ERROR_TYPE]).toBe('runtime');
    expect(attributes[ATTR_CODE_FILE_PATH]).toBe('https://app.example.com/index.js');
    expect(attributes[ATTR_CODE_LINE_NUMBER]).toBe(10);
    expect(attributes[ATTR_CODE_COLUMN_NUMBER]).toBe(20);
  });

  it('should tolerate missing stack trace fields', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n at <anonymous>';

    const attributes = ExceptionHelper.getCustomAttributes(error);

    expect(attributes[ATTR_URL_PATH]).toBe(window.location.href);
    expect(attributes[ATTR_ERROR_TYPE]).toBe('runtime');
    expect(attributes[ATTR_CODE_FILE_PATH]).toBeUndefined();
    expect(attributes[ATTR_CODE_LINE_NUMBER]).toBeUndefined();
    expect(attributes[ATTR_CODE_COLUMN_NUMBER]).toBeUndefined();
  });
});
