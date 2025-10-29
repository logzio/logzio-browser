export function fireDocumentLoad(): void {
  // Simulate document load completion
  if (document.readyState !== 'complete') {
    Object.defineProperty(document, 'readyState', {
      writable: true,
      value: 'complete',
    });
  }

  window.dispatchEvent(new Event('load'));
  document.dispatchEvent(new Event('readystatechange'));
}

export function click(element?: HTMLElement): HTMLElement {
  let targetElement = element;

  if (!targetElement) {
    targetElement = document.createElement('button');
    targetElement.textContent = 'Test Button';
    targetElement.id = 'test-button';
    document.body.appendChild(targetElement);
  }

  targetElement.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: 100,
      clientY: 100,
    }),
  );

  return targetElement;
}

export function rageClick(element?: HTMLElement, clickCount: number = 4): HTMLElement {
  const targetElement = element || click(); // Create element if not provided

  // Perform rapid clicks
  for (let i = 1; i < clickCount; i++) {
    setTimeout(() => {
      targetElement.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: 100,
          clientY: 100,
        }),
      );
    }, i * 50); // 50ms intervals for rapid clicking
  }

  return targetElement;
}

export function deadClick(): HTMLElement {
  // Create an element that won't respond to clicks (disabled)
  const deadElement = document.createElement('button');
  deadElement.textContent = 'Dead Button';
  deadElement.disabled = true;
  deadElement.id = 'dead-button';
  document.body.appendChild(deadElement);

  deadElement.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: 200,
      clientY: 200,
    }),
  );

  return deadElement;
}

export function navigate(path: string): void {
  history.pushState({}, '', path);
  window.dispatchEvent(new Event('popstate'));
}

export function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', {
    writable: true,
    configurable: true,
    value: hidden,
  });

  document.dispatchEvent(new Event('visibilitychange'));
}

export function fireBeforeUnload(): void {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
}

export function emitConsole(message: string = 'Integration test console log'): void {
  console.log(message);
}

export function emitError(message: string = 'Integration test error'): void {
  const errorEvent = new ErrorEvent('error', {
    message,
    filename: 'test.js',
    lineno: 1,
    colno: 1,
    error: new Error(message),
  });

  window.dispatchEvent(errorEvent);
}

export async function triggerFetch(url: string): Promise<Response> {
  return fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function triggerXHR(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('GET', url);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = () => resolve();
    xhr.onerror = () => reject(new Error('XHR failed'));
    xhr.ontimeout = () => reject(new Error('XHR timeout'));

    xhr.send();
  });
}

export function slowNavigation(delayMs: number = 2000): Promise<void> {
  return new Promise((resolve) => {
    // Simulate a slow navigation by delaying the completion
    navigate('/slow-page');
    setTimeout(resolve, delayMs);
  });
}
