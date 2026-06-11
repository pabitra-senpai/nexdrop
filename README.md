# ⚡ Nexdrop — Universal File CDN

Host **any file** on GitHub and get instant CDN-accelerated links via jsDelivr. Images, videos, audio, PDFs, archives, code — everything.

🌐 **Live Demo:** [pabitra-senpai.github.io/nexdrop](https://pabitra-senpai.github.io/nexdrop/)

```
GitHub Repository ← Cloudflare Worker ← Nexdrop UI
                            ↓
                    jsDelivr CDN links
```

---

## ✨ Features

- 📁 **Universal file support** — Images, Video, Audio, Docs, Archives, Code, and more
- ⚡ **jsDelivr CDN** — Global edge delivery, faster than raw GitHub
- 🔒 **Secure** — Your GitHub token stays inside Cloudflare Worker env variables, never exposed to the browser
- 🔗 **Auto-generated links** — CDN URL, Raw GitHub, HTML embed, Markdown
- 🖼️ **Smart preview** — Lightbox for images, player for video/audio, icon for others
- 🗂️ **Library** — Grid & list view, search, filter by type
- 🗑️ **Delete from UI** — Remove files directly from GitHub via the interface
- 📊 **Progress bar** — Real upload progress indicator
- 📱 **Responsive** — Works on mobile and desktop

---

## 🗂️ Project Structure

```
nexdrop/
├── backend/
│   └── worker.js        ← Cloudflare Worker (deploy this)
├── index.html           ← Main UI
├── style.css            ← Styles
├── app.js               ← Frontend logic
└── README.md
```

---

## 🚀 Setup Guide (A to Z)

### Step 1 — Create a GitHub Repository

1. Go to [github.com](https://github.com) → **New repository**
2. Name it anything, e.g. `my-cdn` or `file-storage`
3. Set it to **Public** (required for jsDelivr CDN)
4. Check **Add a README file** (so the repo isn't empty)
5. Click **Create repository**

---

### Step 2 — Generate a GitHub Personal Access Token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
   - Direct link: https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Give it a name: `nexdrop-token`
4. Set expiration as needed (or "No expiration" for permanent use)
5. Under **Scopes**, check only `repo` (full control of private repositories — also covers public ones)
6. Click **Generate token**
7. **Copy the token immediately** — it won't be shown again

> ⚠️ Keep this token secret. It will only be stored in Cloudflare's environment variables.

---

### Step 3 — Set Up Cloudflare Worker

#### 3a. Create a Cloudflare Account

If you don't have one:
- Go to [cloudflare.com](https://cloudflare.com) → **Sign up** (free)

#### 3b. Create a New Worker

1. In the Cloudflare dashboard, go to **Workers & Pages** in the left sidebar
2. Click **Create** → **Create Worker**
3. Give it a name: `nexdrop` (or anything you like)
4. Click **Deploy** (ignore the default code for now)

#### 3c. Deploy the Worker Code

1. After creating, click **Edit code** (or go to your worker → **Edit**)
2. Delete all existing code in the editor
3. Paste the entire contents of `backend/worker.js`
4. Click **Deploy** (top right)

#### 3d. Set Environment Variables

This is the most important step — your GitHub credentials go here.

1. Go to your Worker → **Settings** → **Variables**
2. Under **Environment Variables**, add the following:

| Variable Name   | Value                          | Required |
|-----------------|--------------------------------|----------|
| `GITHUB_OWNER`  | Your GitHub username           | ✅ Yes   |
| `GITHUB_REPO`   | Your repository name           | ✅ Yes   |
| `GITHUB_TOKEN`  | The token from Step 2          | ✅ Yes   |
| `GITHUB_BRANCH` | Branch name (default: `main`)  | ❌ No    |
| `GITHUB_PATH`   | Folder path (default: `files`) | ❌ No    |

> 🔒 **Important**: For `GITHUB_TOKEN`, click **Encrypt** to store it as a secret. This prevents it from being visible in the dashboard.

3. Click **Save and Deploy**

#### 3e. Get Your Worker URL

After deploying, your Worker URL looks like:
```
https://nexdrop.<your-subdomain>.workers.dev
```

Copy this URL — you'll need it in the next step.

---

### Step 4 — Host the Frontend

You have several options:

#### Option A: GitHub Pages (Recommended — Free)

1. Create another GitHub repository (or use the same cdn repo with a different folder)
2. Upload `index.html`, `style.css`, and `app.js`
3. Go to **Settings → Pages**
4. Under **Source**, select `Deploy from a branch` → `main` → `/ (root)`
5. Click **Save**
6. Your site will be live at `https://<username>.github.io/<repo-name>`

#### Option B: Cloudflare Pages (Free)

1. In Cloudflare dashboard → **Workers & Pages → Create → Pages**
2. Connect your GitHub account and select the repo with the frontend files
3. Leave build settings empty (it's a static site)
4. Deploy

#### Option C: Local / Any Static Host

Just open `index.html` in a browser, or host on Netlify, Vercel, or any static hosting service.

---

### Step 5 — Connect the UI to Your Worker

1. Open Nexdrop in your browser
2. Click the **Settings** button (top right)
3. Paste your Worker URL from Step 3e:
   ```
   https://nexdrop.<your-subdomain>.workers.dev
   ```
4. Click **Save**
5. The status pill in the top bar should turn **green** and show "Connected"

---

### Step 6 — Upload Your First File

1. Drag a file onto the upload area, or click to browse
2. Click **Upload to GitHub**
3. After upload:
   - **jsDelivr CDN URL** — Use this for embedding anywhere (fast, cached globally)
   - **Raw GitHub URL** — Direct GitHub link
   - **HTML embed** — Ready-to-paste `<img>`, `<video>`, `<audio>`, or `<a>` tag
   - **Markdown link** — For README files or docs

---

## 🔧 Configuration Reference

### Worker Environment Variables

| Variable        | Default  | Description |
|-----------------|----------|-------------|
| `GITHUB_OWNER`  | —        | Your GitHub username or organization |
| `GITHUB_REPO`   | —        | Repository name where files are stored |
| `GITHUB_TOKEN`  | —        | GitHub personal access token (repo scope) |
| `GITHUB_BRANCH` | `main`   | Branch to upload files to |
| `GITHUB_PATH`   | `files`  | Root folder inside the repo for uploads |

### Worker API Endpoints

| Method   | Endpoint   | Description |
|----------|------------|-------------|
| `POST`   | `/upload`  | Upload a file (base64 encoded) |
| `GET`    | `/files`   | List all uploaded files |
| `DELETE` | `/delete`  | Delete a file by path and sha |
| `GET`    | `/health`  | Check Worker connectivity |

---

## 📦 Supported File Types

| Category | Extensions |
|----------|-----------|
| 🖼️ Images   | jpg, jpeg, png, gif, webp, svg, bmp, ico, tiff, avif |
| 🎬 Video    | mp4, webm, mov, avi, mkv, m4v, ogv, flv, wmv |
| 🎵 Audio    | mp3, wav, ogg, m4a, flac, aac, opus, wma |
| 📄 Docs     | pdf, doc, docx, xls, xlsx, ppt, pptx, txt, md, csv, epub |
| 📦 Archives | zip, tar, gz, rar, 7z, bz2, xz, tgz |
| 💻 Code     | js, ts, html, css, json, py, go, rs, java, sh, yml, and more |
| 📁 Other    | Any file not in the above categories |

> **Size limit**: 95 MB per file (GitHub's hard limit is 100 MB)

---

## 🌐 CDN URL Format

After upload, your files are accessible at:

```
https://cdn.jsdelivr.net/gh/<owner>/<repo>@<branch>/<path>/<filename>
```

**Example:**
```
https://cdn.jsdelivr.net/gh/johndoe/my-cdn@main/files/logo.png
```

jsDelivr caches files globally on its CDN edge network for fast delivery worldwide.

> ⚠️ **Note**: jsDelivr caches files for up to 24 hours. If you delete and re-upload a file with the same name, the old version may still be served for a while. Use unique filenames (Nexdrop adds a timestamp automatically) to avoid this.

---

## ❓ Troubleshooting

### "Worker URL not configured"
→ Click Settings and paste your Cloudflare Worker URL.

### "Worker configuration missing" (500 error from Worker)
→ Check that `GITHUB_OWNER`, `GITHUB_REPO`, and `GITHUB_TOKEN` are all set in Worker → Settings → Variables.

### Upload fails with 401 or 403
→ Your GitHub token may be expired or lack `repo` scope. Generate a new one (Step 2).

### Files not showing in Library after upload
→ Click **Refresh** in the Library section. There may also be a brief delay for GitHub API to reflect the new file.

### CDN URL loads old/cached version
→ jsDelivr caches by filename. Use the **Raw GitHub URL** for freshly uploaded files, or wait for the CDN cache to clear (up to 24h).

### "File too large" error
→ GitHub enforces a 100 MB limit per file. Nexdrop enforces 95 MB to stay safely under it. Compress or split large files.

---

## 🔐 Security Notes

- **Your GitHub token is never sent to the browser.** It lives only in Cloudflare Worker environment variables.
- The frontend stores only your Worker URL in `localStorage`.
- The Worker validates file size before sending to GitHub.
- CORS is open (`*`) by default. If you want to restrict to your own domain, update `Access-Control-Allow-Origin` in `worker.js`.

---

## 📄 License

MIT — free to use, modify, and distribute.
