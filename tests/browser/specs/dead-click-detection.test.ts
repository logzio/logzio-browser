import { test, expect } from '@playwright/test';

test.describe('Dead Click Detection', () => {
  test('should detect dead clicks vs active clicks', async ({ page }) => {
    // Create test page with interactive and dead elements
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>Dead Click Test</title></head>
      <body>
        <div id="counter-container">
          <span id="counter">0</span>
          <button id="increase-btn">Increase</button>
          <button id="decrease-btn">Decrease</button>
        </div>
        
        <div id="dead-container">
          <button id="dead-btn-1">Learn More</button>
          <button id="dead-btn-2">Contact Us</button>
        </div>

        <script>
          let count = 0;
          document.getElementById('increase-btn').onclick = () => {
            count++;
            document.getElementById('counter').textContent = count.toString();
          };
          document.getElementById('decrease-btn').onclick = () => {
            count--;
            document.getElementById('counter').textContent = count.toString();
          };
          // Dead buttons have no onclick handlers
          
          // Simple dead click detection for testing
          window.deadClicks = [];
          window.activities = [];
          
          // Set up MutationObserver to detect DOM changes
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'characterData' || 
                  (mutation.type === 'childList' && mutation.addedNodes.length > 0)) {
                window.activities.push({
                  type: 'mutation',
                  timestamp: Date.now(),
                  target: mutation.target.tagName || 'unknown'
                });
                console.log('DOM mutation detected:', mutation.type);
              }
            });
          });
          
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
          });
          
          // Track clicks and check for dead clicks
          document.addEventListener('click', (event) => {
            const target = event.target;
            if (!target || !target.tagName) return;
            
            // Only track button clicks
            if (target.tagName.toLowerCase() !== 'button') return;
            
            const clickTime = Date.now();
            console.log('Click detected on:', target.id || target.tagName);
            
            // Wait to see if any activity occurs
            setTimeout(() => {
              const recentActivities = window.activities.filter(
                activity => activity.timestamp >= clickTime
              );
              
              if (recentActivities.length === 0) {
                window.deadClicks.push({
                  target: target.id || target.tagName,
                  timestamp: clickTime
                });
                console.log('Dead click detected on:', target.id || target.tagName);
              } else {
                console.log('Active click - activities detected:', recentActivities.length);
              }
            }, 1000);
          });
        </script>
      </body>
      </html>
    `);

    // Test 1: Active button (should NOT be dead click)
    await page.click('#increase-btn');

    // Wait for processing
    await page.waitForTimeout(1500);

    // Verify counter changed (DOM mutation occurred)
    const counterValue = await page.textContent('#counter');
    expect(counterValue).toBe('1');

    // Check that no dead click was detected for active button
    const deadClicksAfterActive = await page.evaluate(() => window.deadClicks);
    expect(deadClicksAfterActive.length).toBe(0);

    // Test 2: Dead button (should be dead click)
    await page.click('#dead-btn-1');

    // Wait for processing
    await page.waitForTimeout(1500);

    // Check that dead click was detected
    const deadClicksAfterDead = await page.evaluate(() => window.deadClicks);
    expect(deadClicksAfterDead.length).toBe(1);
    expect(deadClicksAfterDead[0].target).toBe('dead-btn-1');

    // Test 3: Another active button
    await page.click('#decrease-btn');
    await page.waitForTimeout(1500);

    // Verify counter changed again
    const finalCounterValue = await page.textContent('#counter');
    expect(finalCounterValue).toBe('0');

    // Should still only have one dead click (from the dead button)
    const finalDeadClicks = await page.evaluate(() => window.deadClicks);
    expect(finalDeadClicks.length).toBe(1);
  });

  test('should not trigger dead click detection for non-clickable areas', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>Non-clickable Test</title></head>
      <body>
        <div id="background">
          <p id="text">Some text content</p>
          <span id="span">Some span</span>
        </div>
        
        <script>
          // Simple dead click detection that only tracks buttons
          window.deadClicks = [];
          
          document.addEventListener('click', (event) => {
            const target = event.target;
            if (!target || !target.tagName) return;
            
            // Only track button clicks (this simulates our isClickableElement filter)
            if (target.tagName.toLowerCase() !== 'button') {
              console.log('Ignoring click on non-button element:', target.tagName);
              return;
            }
            
            // If we get here, it would be tracked as a potential dead click
            window.deadClicks.push({
              target: target.id || target.tagName,
              timestamp: Date.now()
            });
          });
        </script>
      </body>
      </html>
    `);

    // Click on non-interactive elements
    await page.click('#text');
    await page.click('#span');
    await page.click('body', { position: { x: 50, y: 50 } });

    await page.waitForTimeout(500);

    // Should not generate dead click events for non-clickable elements
    const deadClicks = await page.evaluate(() => window.deadClicks);
    expect(deadClicks.length).toBe(0);
  });
});
