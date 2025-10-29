/**
 * OS parsing tests for EnvironmentCollector
 */
import {
  EnvironmentCollector,
  EnvironmentCollectionOptions,
} from '@src/utils/EnvironmentCollector';
import {
  restoreGlobals,
  mockNavigator,
  mockWindowAndScreen,
} from '../../__utils__/environmentMocks';

// Mock shared dependencies using centralized helper
jest.mock('@src/shared', () => {
  const { createSharedMock } = require('../../__utils__/loggerMocks');
  return createSharedMock();
});

describe('EnvironmentCollector OS Parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreGlobals();
  });

  describe('operating system detection', () => {
    const osTestCases = [
      {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        expectedName: 'Windows',
        expectedVersion: '10',
      },
      {
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        expectedName: 'macOS',
        expectedVersion: undefined,
      },
      {
        ua: 'Mozilla/5.0 (X11; Linux x86_64)',
        expectedName: 'Linux',
        expectedVersion: undefined,
      },
      {
        ua: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
        expectedName: 'Linux', // Linux pattern matches first
        expectedVersion: undefined,
      },
      {
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
        expectedName: 'iOS',
        expectedVersion: undefined,
      },
      {
        ua: 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X)',
        expectedName: 'iOS',
        expectedVersion: undefined,
      },
      {
        ua: 'Mozilla/5.0 (Android 11; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36',
        expectedName: 'Android',
        expectedVersion: undefined,
      },
    ];

    osTestCases.forEach(({ ua, expectedName, expectedVersion }) => {
      it(`should parse ${expectedName} from user agent`, () => {
        mockNavigator({ userAgent: ua });
        mockWindowAndScreen({});

        const options: EnvironmentCollectionOptions = { collectOS: true };
        const result = EnvironmentCollector.collect(options);

        expect(result['os.name']).toBe(expectedName);
        if (expectedVersion) {
          expect(result['os.version']).toBe(expectedVersion);
        }
      });
    });
  });
});
