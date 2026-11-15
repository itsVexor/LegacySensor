> ARCHIVED: The Dance Reminders feature described here was removed in the v1.7.0 local website test.
> The rest of this document refers to the older 1.8.2 site build.

# Legacy Sensor — GitHub Pages deployment and reminders

## Official project links

- Website: https://itsvexor.github.io/LegacySensor/
- Source repository: https://github.com/itsVexor/LegacySensor

This project is a GitHub Pages project site. Its base path is `/LegacySensor/`, not the domain root. Keep asset, manifest, service-worker, and internal navigation paths relative (for example `./assets/...` and `./sw.js`). Do not change them to `/assets/...`, because that would point outside this repository's site path.

## Publish the website

1. Open the source repository: https://github.com/itsVexor/LegacySensor
2. Replace the repository's website files with the contents of this project folder, preserving the `assets/` folder and the existing root-level HTML/CSS/JS files.
3. Commit and push to the branch used by GitHub Pages (the repository currently uses `main`; verify **Settings → Pages** before changing the branch or folder).
4. Keep the Pages source configured for the repository's published root unless you intentionally use a different deployment workflow.
5. After GitHub Pages finishes publishing, open https://itsvexor.github.io/LegacySensor/ and verify the home page, `webapp.html`, `troubleshooting.html`, the icons and the service worker.

Typical Git commands, when working from a clone of the repository:

```bash
git add .
git commit -m "Update Legacy Sensor website and PWA"
git push origin main
```

## How reminders work in this GitHub Pages build

GitHub Pages serves static files. It does not run API routes, private server functions, or scheduled background jobs. This build therefore uses **device-local reminders**:

- The user explicitly grants notification permission.
- The selected frequency and hour are saved only in that browser's local storage.
- The page checks the schedule while Legacy Sensor is open and can show a notification at the chosen time.
- If the browser or operating system suspends or closes the app, a reminder may be delayed until the app is opened again.
- No push subscription or private key is sent to GitHub Pages.

On iPhone/iPad, install the site from Safari using **Share → Add to Home Screen**, then open the installed icon before requesting notification permission. Web Push on iOS/iPadOS requires a supported OS version and a Home Screen web app, but **true scheduled delivery while the app is closed still needs a separate push backend**.

## What is needed for reliable reminders while the app is closed?

A separate trusted backend must receive and store each browser's Push API subscription and send signed Web Push messages on a schedule. This could be Firebase Cloud Functions, Supabase Edge Functions, or another server-side service. The VAPID private key must stay on that backend and must never be placed in this public GitHub repository or browser JavaScript. GitHub Pages remains the website host; the separate backend only handles push subscriptions and delivery.

Until that backend is intentionally configured, the website must not claim that closed-app reminders are guaranteed. The current UI explains this limitation.
