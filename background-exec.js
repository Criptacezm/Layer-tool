/* ============================================
   Background Execution Utility
   Keeps the website running when alt-tabbed away
   ============================================ */

(function() {
  'use strict';

  // Silent audio element to prevent browser throttling
  let silentAudio = null;
  let audioContext = null;
  let oscillator = null;

  // Web Worker for reliable background timers
  let backgroundWorker = null;
  const workerCallbacks = new Map();
  let callbackId = 0;

  // Create inline Web Worker for background timers
  const workerCode = `
    const timers = new Map();
    let timerId = 0;

    self.onmessage = function(e) {
      const { type, id, delay, interval } = e.data;

      switch (type) {
        case 'setTimeout':
          const timeoutId = setTimeout(() => {
            self.postMessage({ type: 'timeout', id });
            timers.delete(id);
          }, delay);
          timers.set(id, { type: 'timeout', timerId });
          break;

        case 'setInterval':
          const intervalId = setInterval(() => {
            self.postMessage({ type: 'interval', id });
          }, interval);
          timers.set(id, { type: 'interval', timerId: intervalId });
          break;

        case 'clearTimeout':
        case 'clearInterval':
          const timer = timers.get(id);
          if (timer) {
            if (timer.type === 'timeout') clearTimeout(timer.timerId);
            else clearInterval(timer.timerId);
            timers.delete(id);
          }
          break;
      }
    };
  `;

  // Initialize background execution
  function initBackgroundExecution() {
    // Create Web Worker
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      backgroundWorker = new Worker(workerUrl);

      backgroundWorker.onmessage = function(e) {
        const { type, id } = e.data;
        const callback = workerCallbacks.get(id);
        if (callback) {
          callback();
          if (type === 'timeout') {
            workerCallbacks.delete(id);
          }
        }
      };

      console.log('[BackgroundExec] Web Worker initialized');
    } catch (error) {
      console.warn('[BackgroundExec] Web Worker not available:', error);
    }

    // Create silent audio context (helps prevent throttling)
    initSilentAudio();

    // Handle visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial state
    if (document.visibilityState === 'hidden') {
      startBackgroundMode();
    }
  }

  // Initialize silent audio
  function initSilentAudio() {
    try {
      // Create AudioContext
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioContext = new AudioContext();
        
        // Create oscillator at very low frequency (essentially silent)
        oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Set to inaudible level
        gainNode.gain.value = 0.001;
        oscillator.frequency.value = 1; // 1Hz, inaudible
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        console.log('[BackgroundExec] Audio context initialized');
      }
    } catch (error) {
      console.warn('[BackgroundExec] Audio context not available:', error);
    }

    // Also create HTML audio element as fallback
    try {
      // Create a silent audio data URL
      const silentMp3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNBqHhAAAAAAD/+9DEAAAIAANIAAAAEw4A6IAAAAD8AAIA/AAAShJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGgAAf/LkEAAABAAAD7gAAAJGg=';
      
      silentAudio = new Audio(silentMp3);
      silentAudio.loop = true;
      silentAudio.volume = 0.001;
    } catch (error) {
      console.warn('[BackgroundExec] Silent audio element not available:', error);
    }
  }

  // Handle visibility change
  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      startBackgroundMode();
    } else {
      stopBackgroundMode();
    }
  }

  // Start background mode (when tab is hidden)
  function startBackgroundMode() {
    console.log('[BackgroundExec] Entering background mode');

    // Start silent audio to prevent throttling
    if (silentAudio && silentAudio.paused) {
      silentAudio.play().catch(() => {});
    }

    // Resume audio context if suspended
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    // Start oscillator if not running
    if (oscillator && !oscillator.started) {
      try {
        oscillator.start();
        oscillator.started = true;
      } catch (e) {}
    }
  }

  // Stop background mode (when tab is visible)
  function stopBackgroundMode() {
    console.log('[BackgroundExec] Exiting background mode');

    // We keep audio running to prevent throttling
    // but could pause here if needed for battery saving
  }

  // Background-aware setTimeout
  function bgSetTimeout(callback, delay) {
    if (!backgroundWorker) {
      return setTimeout(callback, delay);
    }

    const id = ++callbackId;
    workerCallbacks.set(id, callback);
    backgroundWorker.postMessage({ type: 'setTimeout', id, delay });
    return id;
  }

  // Background-aware setInterval
  function bgSetInterval(callback, interval) {
    if (!backgroundWorker) {
      return setInterval(callback, interval);
    }

    const id = ++callbackId;
    workerCallbacks.set(id, callback);
    backgroundWorker.postMessage({ type: 'setInterval', id, interval });
    return id;
  }

  // Clear background timeout
  function bgClearTimeout(id) {
    if (!backgroundWorker) {
      return clearTimeout(id);
    }
    backgroundWorker.postMessage({ type: 'clearTimeout', id });
    workerCallbacks.delete(id);
  }

  // Clear background interval
  function bgClearInterval(id) {
    if (!backgroundWorker) {
      return clearInterval(id);
    }
    backgroundWorker.postMessage({ type: 'clearInterval', id });
    workerCallbacks.delete(id);
  }

  // Request wake lock (prevents screen sleep on supported devices)
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        await navigator.wakeLock.request('screen');
        console.log('[BackgroundExec] Wake lock acquired');
      } catch (error) {
        console.warn('[BackgroundExec] Wake lock failed:', error);
      }
    }
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackgroundExecution);
  } else {
    initBackgroundExecution();
  }

  // Request wake lock when visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });

  // Export utilities
  window.BackgroundExec = {
    setTimeout: bgSetTimeout,
    setInterval: bgSetInterval,
    clearTimeout: bgClearTimeout,
    clearInterval: bgClearInterval,
    requestWakeLock,
    isBackground: () => document.visibilityState === 'hidden'
  };

})();
