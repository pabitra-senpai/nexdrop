/**
 * Nexdrop — Universal File CDN
 * Cloudflare Worker · GitHub Secure Proxy
 * Supports all file types: images, video, audio, docs, archives, code, etc.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Max file size guard: 95 MB (GitHub hard limit is 100 MB)
const MAX_BYTES = 95 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    // ── CORS preflight ──────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── Environment variables ───────────────────────────────────
    const owner      = env.GITHUB_OWNER;
    const repo       = env.GITHUB_REPO;
    const token      = env.GITHUB_TOKEN;
    const branch     = env.GITHUB_BRANCH || "main";
    const uploadPath = env.GITHUB_PATH   || "files";

    if (!owner || !repo || !token) {
      return json({ error: "Worker configuration missing. Check GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN env vars." }, 500);
    }

    const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

    // ════════════════════════════════════════════════════════════
    // POST /upload  —  Upload any file to GitHub
    // ════════════════════════════════════════════════════════════
    if (url.pathname === "/upload" && request.method === "POST") {
      try {
        const body = await request.json();
        const { filename, content, folder } = body;

        if (!filename || !content) {
          return json({ error: "Missing filename or content." }, 400);
        }

        // Validate base64 size (base64 inflates ~33%, so multiply by 0.75)
        const estimatedBytes = Math.round(content.length * 0.75);
        if (estimatedBytes > MAX_BYTES) {
          return json({ error: `File too large. Maximum size is 95 MB. Got ~${Math.round(estimatedBytes / 1024 / 1024)} MB.` }, 413);
        }

        // Sub-folder routing: caller may request a specific subfolder
        const targetFolder = folder
          ? `${uploadPath}/${folder.replace(/[^a-zA-Z0-9_\-]/g, "_")}`
          : uploadPath;

        const targetUrl = `${apiBase}/contents/${targetFolder}/${filename}`;

        const ghResponse = await fetch(targetUrl, {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            "User-Agent": "Nexdrop-Worker",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Upload: ${filename}`,
            content,
            branch,
          }),
        });

        const data = await ghResponse.json();

        if (!ghResponse.ok) {
          return json({ error: data.message || "GitHub upload failed." }, ghResponse.status);
        }

        const filePath = `${targetFolder}/${filename}`;

        return json({
          success:  true,
          filename,
          path:     filePath,
          sha:      data.content.sha,
          size:     data.content.size,
          cdn_url:  `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${filePath}`,
          raw_url:  `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
          gh_url:   `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`,
        });

      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    // ════════════════════════════════════════════════════════════
    // GET /files  —  List all uploaded files (recursive)
    // ════════════════════════════════════════════════════════════
    if (url.pathname === "/files" && request.method === "GET") {
      try {
        const targetUrl = `${apiBase}/contents/${uploadPath}?ref=${branch}`;

        const ghResponse = await fetch(targetUrl, {
          headers: {
            Authorization: `token ${token}`,
            "User-Agent": "Nexdrop-Worker",
          },
        });

        if (ghResponse.status === 404) {
          return json({ owner, repo, files: [] });
        }

        if (!ghResponse.ok) {
          const err = await ghResponse.json();
          return json({ error: err.message || "Failed to list files." }, ghResponse.status);
        }

        const data = await ghResponse.json();

        // Flatten: include files at root + recurse one level into subfolders
        const files = [];
        const dirs  = [];

        for (const item of (Array.isArray(data) ? data : [])) {
          if (item.type === "file")      files.push(item);
          else if (item.type === "dir")  dirs.push(item);
        }

        // Fetch subfolder contents in parallel
        if (dirs.length > 0) {
          const subFetches = await Promise.allSettled(
            dirs.map(d =>
              fetch(`${apiBase}/contents/${d.path}?ref=${branch}`, {
                headers: { Authorization: `token ${token}`, "User-Agent": "Nexdrop-Worker" },
              }).then(r => r.json())
            )
          );
          for (const result of subFetches) {
            if (result.status === "fulfilled" && Array.isArray(result.value)) {
              for (const item of result.value) {
                if (item.type === "file") files.push(item);
              }
            }
          }
        }

        return json({ owner, repo, files });

      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    // ════════════════════════════════════════════════════════════
    // DELETE /delete  —  Remove a file from GitHub
    // ════════════════════════════════════════════════════════════
    if (url.pathname === "/delete" && request.method === "DELETE") {
      try {
        const body = await request.json();
        const { path, sha } = body;

        if (!path || !sha) {
          return json({ error: "Missing file path or sha." }, 400);
        }

        const ghResponse = await fetch(`${apiBase}/contents/${path}`, {
          method: "DELETE",
          headers: {
            Authorization: `token ${token}`,
            "User-Agent": "Nexdrop-Worker",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Delete: ${path}`,
            sha,
            branch,
          }),
        });

        if (!ghResponse.ok) {
          const err = await ghResponse.json();
          return json({ error: err.message || "GitHub delete failed." }, ghResponse.status);
        }

        return json({ success: true });

      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    // ════════════════════════════════════════════════════════════
    // GET /health  —  Quick connectivity check
    // ════════════════════════════════════════════════════════════
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", owner, repo, branch, uploadPath });
    }

    return json({ error: "Not Found" }, 404);
  },
};
