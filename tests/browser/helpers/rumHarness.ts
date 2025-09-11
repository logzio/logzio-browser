import { Page } from '@playwright/test';

export interface BrowserRUMConfig {
  tokens: {
    traces?: string;
    metrics?: string;
    logs?: string;
  };
  region?: string;
  customEndpoint?: {
    url: string;
    addSuffix?: boolean;
  };
  enable?: {
    userActions?: boolean;
    documentLoad?: boolean;
    resourceLoad?: boolean;
    consoleLogs?: boolean;
    errorTracking?: boolean;
    navigation?: boolean;
    webVitals?: boolean;
    viewEvents?: boolean;
    frustrationDetection?: boolean;
  };
  environmentData?: {
    collectOS?: boolean;
    collectBrowser?: boolean;
    collectDevice?: boolean;
    collectLanguage?: boolean;
  };
  frustrationThresholds?: {
    rageClickCount?: number;
    rageClickIntervalMs?: number;
    heavyLoadThresholdMs?: number;
  };
  samplingRate?: number;
}

/**
 * Initialize RUM library in browser page
 */
export async function initializeRUM(page: Page, config: BrowserRUMConfig): Promise<void> {
  // Inject RUM library source (in real scenario, this would be the built bundle)
  await page.addScriptTag({
    content: `
      // Mock RUM library for browser testing
      window.LogzioRUM = {
        init: function(config) {
          console.log('RUM initialized with config:', config);
          window.__rumConfig = config;
          window.__rumStarted = true;
          
          // Mock session and view management
          window.__rumSession = {
            sessionId: 'browser-test-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            viewId: 'browser-test-view-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
          };
          
          // Mock data collection arrays for testing
          window.__rumData = {
            traces: [],
            metrics: [],
            logs: []
          };
          
          // Mock metric collection
          if (config.enable?.webVitals) {
            this.startWebVitalsCollection();
          }
          
          if (config.enable?.frustrationDetection) {
            this.startFrustrationDetection();
          }
          
          if (config.enable?.navigation) {
            this.startNavigationTracking();
          }
          
          if (config.enable?.documentLoad) {
            this.startDocumentLoadTracking();
          }
          
          if (config.enable?.resourceLoad) {
            this.startNetworkTracking();
          }
          
          if (config.enable?.consoleLogs) {
            this.startConsoleTracking();
          }
          
          if (config.enable?.errorTracking) {
            this.startErrorTracking();
          }
          
          if (config.enable?.userActions) {
            this.startUserInteractionTracking();
          }
        },
        
        shutdown: function() {
          console.log('RUM shutdown');
          window.__rumStarted = false;
        },
        
        startWebVitalsCollection: function() {
          // Mock web vitals collection using real PerformanceObserver
          if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                window.__rumData.metrics.push({
                  name: entry.name,
                  value: entry.value || entry.duration,
                  timestamp: Date.now(),
                  type: 'web-vital'
                });
              }
            });
            
            // Observe various performance entry types
            try {
              observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
            } catch (e) {
              console.warn('Some performance entry types not supported');
            }
          }
        },
        
                  startFrustrationDetection: function() {
            let clickHistory = [];
            const rageThreshold = window.__rumConfig?.frustrationThresholds?.rageClickCount || 3;
            const rageInterval = window.__rumConfig?.frustrationThresholds?.rageClickIntervalMs || 1000;
            
            document.addEventListener('click', (event) => {
              const now = Date.now();
              clickHistory.push({ timestamp: now, target: event.target });
              
              // Remove old clicks outside the rage interval
              clickHistory = clickHistory.filter(click => now - click.timestamp <= rageInterval);
              
              // Detect rage clicks
              if (clickHistory.length >= rageThreshold) {
                window.__rumData.metrics.push({
                  name: 'frustration.rage_click',
                  value: 1,
                  timestamp: now,
                  type: 'frustration',
                  target: event.target.tagName
                });
                
                console.log('Rage click detected!');
              }
            });
            
            // For dead clicks, we need to detect mousedown on disabled elements
            // since disabled elements don't fire click events
            document.addEventListener('mousedown', (event) => {
              if (event.target && event.target.disabled) {
                const now = Date.now();
                window.__rumData.metrics.push({
                  name: 'frustration.dead_click',
                  value: 1,
                  timestamp: now,
                  type: 'frustration',
                  target: event.target.tagName
                });
                
                console.log('Dead click detected on disabled element!');
              }
            });
          },
          
          startNavigationTracking: function() {
            // Track initial page load
            window.__rumData.traces.push({
              name: 'Navigation',
              startTime: Date.now(),
              attributes: {
                'http.url': window.location.href,
                'view.id': window.__rumSession.viewId,
                'session.id': window.__rumSession.sessionId,
                'span.kind': 'navigation'
              }
            });
            
            // Store previous URL before navigation
            let previousUrl = window.location.href;
            
            // Track navigation events
            window.addEventListener('popstate', (event) => {
              // Create new view ID for navigation with random component to ensure uniqueness
              const newViewId = 'browser-test-view-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
              const oldViewId = window.__rumSession.viewId;
              window.__rumSession.viewId = newViewId;
              
              // Add view end log for previous view
              if (window.__rumConfig?.enable?.viewEvents) {
                window.__rumData.logs.push({
                  body: 'view_end',
                  timestamp: Date.now(),
                  attributes: {
                    'view.id': oldViewId,
                    'view.url': previousUrl,
                    'session.id': window.__rumSession.sessionId
                  }
                });
              }
              
              // Update previous URL for next navigation
              previousUrl = window.location.href;
              
              // Add new navigation trace
              window.__rumData.traces.push({
                name: 'Navigation',
                startTime: Date.now(),
                attributes: {
                  'http.url': window.location.href,
                  'view.id': newViewId,
                  'session.id': window.__rumSession.sessionId,
                  'span.kind': 'navigation'
                }
              });
            });
          },
          
          startDocumentLoadTracking: function() {
            // Only track document load if navigation tracking is not already tracking the initial load
            if (!window.__rumConfig?.enable?.navigation) {
              if (document.readyState === 'complete') {
                window.__rumData.traces.push({
                  name: 'Navigation',
                  startTime: Date.now(),
                  attributes: {
                    'http.url': window.location.href,
                    'view.id': window.__rumSession.viewId,
                    'session.id': window.__rumSession.sessionId,
                    'span.kind': 'document-load'
                  }
                });
              } else {
                window.addEventListener('load', () => {
                  window.__rumData.traces.push({
                    name: 'Navigation',
                    startTime: Date.now(),
                    attributes: {
                      'http.url': window.location.href,
                      'view.id': window.__rumSession.viewId,
                      'session.id': window.__rumSession.sessionId,
                      'span.kind': 'document-load'
                    }
                  });
                });
              }
            }
          },
          
          startNetworkTracking: function() {
            // Track fetch requests
            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
              const startTime = Date.now();
              const url = typeof args[0] === 'string' ? args[0] : args[0].url;
              const method = args[1]?.method || 'GET';
              
              // Create network trace
              window.__rumData.traces.push({
                name: 'fetch ' + method,
                startTime: startTime,
                attributes: {
                  'http.url': url,
                  'http.method': method,
                  'view.id': window.__rumSession.viewId,
                  'session.id': window.__rumSession.sessionId,
                  'span.kind': 'client'
                }
              });
              
              try {
                return await originalFetch.apply(this, args);
              } catch (error) {
                // Add error info to the trace if needed
                throw error;
              }
            };
            
            // Track XMLHttpRequest
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;
            
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
              this._rumMethod = method;
              this._rumUrl = url;
              this._rumStartTime = Date.now();
              return originalOpen.call(this, method, url, ...args);
            };
            
            XMLHttpRequest.prototype.send = function(...args) {
              if (this._rumMethod && this._rumUrl) {
                // Create XHR trace
                window.__rumData.traces.push({
                  name: 'xhr ' + this._rumMethod,
                  startTime: this._rumStartTime || Date.now(),
                  attributes: {
                    'http.url': this._rumUrl,
                    'http.method': this._rumMethod,
                    'view.id': window.__rumSession.viewId,
                    'session.id': window.__rumSession.sessionId,
                    'span.kind': 'client'
                  }
                });
              }
              return originalSend.apply(this, args);
            };
          },
          
          startConsoleTracking: function() {
            // Track console methods
            const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'];
            const originalMethods = {};
            
            consoleMethods.forEach(method => {
              originalMethods[method] = console[method];
              console[method] = function(...args) {
                // Create log entry
                window.__rumData.logs.push({
                  body: args.join(' '),
                  timestamp: Date.now(),
                  severity: method === 'log' ? 'info' : method,
                  attributes: {
                    'view.id': window.__rumSession.viewId,
                    'session.id': window.__rumSession.sessionId,
                    'log.source': 'console'
                  }
                });
                
                // Call original method
                return originalMethods[method].apply(this, args);
              };
            });
          },
          
          startErrorTracking: function() {
            // Track unhandled errors
            window.addEventListener('error', (event) => {
              window.__rumData.logs.push({
                body: event.message || 'Unknown error',
                timestamp: Date.now(),
                severity: 'error',
                attributes: {
                  'view.id': window.__rumSession.viewId,
                  'session.id': window.__rumSession.sessionId,
                  'error.message': event.message,
                  'error.filename': event.filename,
                  'error.lineno': event.lineno,
                  'error.colno': event.colno,
                  'log.source': 'error'
                }
              });
            });
            
            // Track unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
              window.__rumData.logs.push({
                body: 'Unhandled promise rejection: ' + event.reason,
                timestamp: Date.now(),
                severity: 'error',
                attributes: {
                  'view.id': window.__rumSession.viewId,
                  'session.id': window.__rumSession.sessionId,
                  'error.message': String(event.reason),
                  'log.source': 'unhandled-rejection'
                }
              });
            });
          },
          
          startUserInteractionTracking: function() {
            // Track click events
            document.addEventListener('click', (event) => {
              if (!event.target) return;
              
              const target = event.target;
              
              // Generate a simple XPath for the target (mock implementation)
              function generateXPath(element) {
                if (element.id) {
                  return '//*[@id="' + element.id + '"]';
                }
                var path = '';
                while (element && element.nodeType === 1) { // Node.ELEMENT_NODE = 1
                  var index = 0;
                  var sibling = element.previousSibling;
                  while (sibling) {
                    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                      index++;
                    }
                    sibling = sibling.previousSibling;
                  }
                  var tagName = element.tagName.toLowerCase();
                  var pathIndex = index > 0 ? '[' + (index + 1) + ']' : '';
                  path = '/' + tagName + pathIndex + path;
                  element = element.parentElement;
                }
                return '/html' + path;
              }
              
              var xpath = generateXPath(target);
              var ariaLabel = target.getAttribute('aria-label');
              
              // Create interaction trace with attributes matching our real implementation
              var attributes = {
                'event_type': 'click',
                'target_element': target.tagName,
                'target_xpath': xpath,
                'http.url': window.location.href,
                'view.id': window.__rumSession.viewId,
                'session.id': window.__rumSession.sessionId,
                'span.kind': 'user-interaction'
              };
              
              // Add aria-label if present - matching our real implementation
              if (ariaLabel) {
                attributes['target.aria_label'] = ariaLabel;
              }
              
              window.__rumData.traces.push({
                name: 'click',
                startTime: Date.now(),
                attributes: attributes
              });
            });
            
            // Track other interaction events if needed
            ['mousedown', 'mouseup', 'keydown', 'keyup'].forEach(eventType => {
              document.addEventListener(eventType, (event) => {
                if (!event.target) return;
                
                const target = event.target;
                const targetInfo = target.tagName + (target.id ? '#' + target.id : '');
                
                // Only create traces for significant interactions
                if (eventType === 'keydown' && (event.key === 'Enter' || event.key === ' ')) {
                  window.__rumData.traces.push({
                    name: eventType,
                    startTime: Date.now(),
                  attributes: {
                    'target_element': target.tagName,
                    'target_xpath': '//*[@id="' + target.id + '"]',
                    'event_type': eventType,
                    'key': event.key,
                    'view.id': window.__rumSession.viewId,
                    'session.id': window.__rumSession.sessionId,
                    'span.kind': 'user-interaction'
                  }
                  });
                }
              });
            });
          }
      };
    `,
  });

  // Initialize RUM with provided config
  await page.evaluate((config) => {
    (window as any).LogzioRUM.init(config);
  }, config);
}

/**
 * Get collected RUM data from browser
 */
export async function getRUMData(page: Page): Promise<{
  traces: any[];
  metrics: any[];
  logs: any[];
}> {
  return await page.evaluate(() => {
    return (window as any).__rumData || { traces: [], metrics: [], logs: [] };
  });
}

/**
 * Clear collected RUM data
 */
export async function clearRUMData(page: Page): Promise<void> {
  await page.evaluate(() => {
    if ((window as any).__rumData) {
      (window as any).__rumData.traces = [];
      (window as any).__rumData.metrics = [];
      (window as any).__rumData.logs = [];
    }
  });
}

/**
 * Check if RUM is initialized
 */
export async function isRUMInitialized(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return !!(window as any).__rumStarted;
  });
}

/**
 * Get RUM session info
 */
export async function getRUMSession(
  page: Page,
): Promise<{ sessionId: string; viewId: string } | null> {
  return await page.evaluate(() => {
    return (window as any).__rumSession || null;
  });
}

/**
 * Wait for specific metrics to be collected
 */
export async function waitForMetrics(
  page: Page,
  expectedCount: number,
  timeoutMs: number = 5000,
): Promise<any[]> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const data = await getRUMData(page);
    if (data.metrics.length >= expectedCount) {
      return data.metrics;
    }
    await page.waitForTimeout(100);
  }

  throw new Error(
    `Timeout waiting for ${expectedCount} metrics. Got ${(await getRUMData(page)).metrics.length} after ${timeoutMs}ms`,
  );
}
