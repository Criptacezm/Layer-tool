// ============================================
// Performance Optimization Utilities
// For low-end devices and smooth performance
// ============================================

(function() {
  'use strict';

  // Detect low-end device
  const isLowEndDevice = () => {
    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
    
    // Check hardware concurrency (CPU cores)
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
      return true;
    }
    
    // Check device memory (if available)
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) {
      return true;
    }
    
    // Check if mobile
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return true;
    }
    
    return false;
  };

  // Performance mode flag
  let performanceMode = isLowEndDevice();
  
  // Store original intervals for cleanup
  const managedIntervals = new Set();
  const managedTimeouts = new Set();

  // Throttled interval - runs less frequently in performance mode
  window.createThrottledInterval = (callback, normalInterval, performanceInterval = normalInterval * 2) => {
    const interval = performanceMode ? performanceInterval : normalInterval;
    const id = setInterval(callback, interval);
    managedIntervals.add({ id, callback, normalInterval, performanceInterval });
    return id;
  };

  // Throttled requestAnimationFrame - skips frames in performance mode
  let lastFrameTime = 0;
  window.throttledRAF = (callback, targetFPS = performanceMode ? 30 : 60) => {
    const frameInterval = 1000 / targetFPS;
    const now = performance.now();
    const elapsed = now - lastFrameTime;
    
    if (elapsed >= frameInterval) {
      lastFrameTime = now;
      return requestAnimationFrame(callback);
    }
    return requestAnimationFrame(() => window.throttledRAF(callback, targetFPS));
  };

  // Debounce utility
  window.debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Throttle utility
  window.throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  // Disable heavy CSS effects
  window.enablePerformanceMode = () => {
    performanceMode = true;
    document.documentElement.classList.add('performance-mode');
    
    // Update all managed intervals to slower rate
    managedIntervals.forEach(({ id, callback, performanceInterval }) => {
      clearInterval(id);
      const newId = setInterval(callback, performanceInterval);
      managedIntervals.delete(id);
      managedIntervals.add({ id: newId, callback, performanceInterval });
    });
    
    console.log('🚀 Performance mode enabled');
  };

  window.disablePerformanceMode = () => {
    performanceMode = false;
    document.documentElement.classList.remove('performance-mode');
    
    // Restore normal intervals
    managedIntervals.forEach(({ id, callback, normalInterval }) => {
      clearInterval(id);
      const newId = setInterval(callback, normalInterval);
      managedIntervals.delete(id);
      managedIntervals.add({ id: newId, callback, normalInterval });
    });
    
    console.log('✨ Performance mode disabled');
  };

  // Toggle performance mode
  window.togglePerformanceMode = () => {
    if (performanceMode) {
      window.disablePerformanceMode();
    } else {
      window.enablePerformanceMode();
    }
    return performanceMode;
  };

  // Get current status
  window.isPerformanceMode = () => performanceMode;

  // Auto-enable for low-end devices
  if (performanceMode) {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.classList.add('performance-mode');
      console.log('🚀 Auto-enabled performance mode for low-end device');
    });
  }

  // Reduce animations when tab is not visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.documentElement.classList.add('tab-hidden');
    } else {
      document.documentElement.classList.remove('tab-hidden');
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    managedIntervals.forEach(({ id }) => clearInterval(id));
    managedTimeouts.forEach(id => clearTimeout(id));
  });

})();
