# Deploy DotKonvert Live Preview to GitHub Pages

The **live preview is 100% static** (HTML, CSS, JavaScript). It runs entirely in the browser — no Python or server needed on GitHub. You only need to push your repo and turn on GitHub Pages.

## 1. Push the repo to GitHub

If the project isn’t a git repo yet:

```bash
cd /Users/oskarsh/Documents/GitHub/Sinuslabs-Tools/DotKonvert
git init
git add .
git commit -m "Add DotKonvert live preview and docs for GitHub Pages"
```

If you haven’t added the GitHub remote:

1. Create a new repository on GitHub (e.g. `Sinuslabs-Tools/DotKonvert` or `DotKonvert`).
2. Add it as `origin` and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

(Use your real GitHub username and repo name.)

## 2. Enable GitHub Pages

1. Open your repo on GitHub.
2. Go to **Settings** → **Pages** (left sidebar).
3. Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or `master`)
   - **Folder:** `/docs`
4. Click **Save**.

After a minute or two, the site will be at:

- **`https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`**

That URL loads the live preview (the app is in `docs/index.html`).

## 3. How it works (no Python)

- **On GitHub Pages:** Only the contents of the `/docs` folder are published. That’s `index.html`, `live_preview.css`, `live_preview.js`, and `favicon.svg`. The browser loads these and runs everything client-side.
- **Python** is only for the optional local CLI (`video_to_dots/convert.py`) and is **not** used by the hosted live preview. You don’t need to install or run anything on the server.

## 4. Updating the live site

After you change the app (e.g. in `video_to_dots/`), copy the built files into `docs/` and push:

```bash
cp video_to_dots/live_preview.html docs/index.html
cp video_to_dots/live_preview.css docs/
cp video_to_dots/live_preview.js docs/
cp video_to_dots/favicon.svg docs/
git add docs/
git commit -m "Update live preview"
git push
```

GitHub will redeploy the site automatically.
