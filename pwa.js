(() => {
  'use strict';
  const installBtn = document.getElementById('installAppBtn');
  const installHint = document.getElementById('installHint');
  let deferredInstallPrompt = null;
  let registrationPromise = null;
  // Local developer preview: never register a service worker. Earlier versions
  // cached obsolete HTML/CSS at localhost:8890, breaking ?season previews.
  // Remove ONLY this site's own Cache Storage entries and preview registrations.
  // Firebase authentication / localStorage are intentionally NOT touched.
  const isLocalPreview = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
  if (isLocalPreview) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs =>
        Promise.all(regs.filter(reg => reg.scope.startsWith(location.origin + '/'))
          .map(reg => reg.unregister()))
      ).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys
        .filter(key => key.startsWith('legacy-sensor-'))
        .map(key => caches.delete(key)))).catch(() => {});
    }
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const getRegistration = () => {
    if (!('serviceWorker' in navigator)) {
      return Promise.reject(new Error('This browser does not support service workers.'));
    }
    if (!registrationPromise) {
      registrationPromise = navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(() => navigator.serviceWorker.ready);
    }
    return registrationPromise;
  };

  // Retire any saved reminder schedule from older website previews.
  // If an old version subscribed to push reminders, unsubscribe locally.
  try {
    const hadOldReminders = localStorage.getItem('ls_dance_reminder_settings') !== null ||
      localStorage.getItem('ls_dance_reminder_settings_v2') !== null;
    localStorage.removeItem('ls_dance_reminder_settings');
    localStorage.removeItem('ls_dance_reminder_settings_v2');
    if (hadOldReminders && !isLocalPreview && 'serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost')) {
      getRegistration().then(async (registration) => {
        const subscription = registration.pushManager
          ? await registration.pushManager.getSubscription() : null;
        if (subscription) await subscription.unsubscribe();
      }).catch(() => {});
    }
  } catch (_) { /* local cleanup is best-effort */ }

  if (!isLocalPreview && 'serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost')) {
    getRegistration().catch((error) => console.warn('Legacy Sensor service worker:', error));
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installBtn && !isStandalone()) {
      installBtn.hidden = false;
      if (installHint) installHint.textContent = 'Your browser can install Legacy Sensor as an app.';
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (installHint) installHint.textContent = 'Legacy Sensor is installed. Find it on your Home Screen or in your apps.';
    if (installBtn) installBtn.hidden = true;
  });

  if (!installBtn) return;
  installBtn.addEventListener('click', async () => {
    if (isStandalone()) {
      if (installHint) installHint.textContent = 'You are already using the installed Legacy Sensor app. ✨';
      return;
    }
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch (_) {}
      deferredInstallPrompt = null;
    } else if (isIOS) {
      document.querySelector('.ios-install-help')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (installHint) installHint.textContent = 'On iPhone: tap Share in Safari → Add to Home Screen → Add. Then open the new icon.';
    } else if (installHint) {
      installHint.textContent = 'Use your browser menu and choose “Install app” or “Add to Home Screen” when available.';
    }
  });

  if (isStandalone()) {
    installBtn.hidden = true;
    if (installHint) installHint.textContent = 'You are using the installed Legacy Sensor app.';
  } else if (isIOS) {
    installBtn.textContent = 'Show install steps';
    if (installHint) installHint.textContent = 'On iPhone, add Legacy Sensor to your Home Screen to launch it like an app.';
  } else {
    installBtn.hidden = true;
  }
})();
