/**
 * Nexdrop — Universal File CDN
 * app.js · Frontend Application
 */

/* ============================================================
   FILE TYPE UTILITIES
   ============================================================ */
const FILE_TYPES = {
  image:   ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff','avif'],
  video:   ['mp4','webm','mov','avi','mkv','m4v','ogv','flv','wmv'],
  audio:   ['mp3','wav','ogg','m4a','flac','aac','opus','wma'],
  doc:     ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','md','rtf','csv','epub','odt'],
  archive: ['zip','tar','gz','rar','7z','bz2','xz','tgz','zst'],
  code:    ['js','ts','jsx','tsx','html','css','json','xml','py','rb','php','go','rs','c','cpp','h','java','sh','yml','yaml','toml','sql','vue','svelte'],
};

const TYPE_META = {
  image:   { icon: 'fa-solid fa-image',       label: 'Image',   css: 'ftype-image',   badge: 'badge-image'   },
  video:   { icon: 'fa-solid fa-film',         label: 'Video',   css: 'ftype-video',   badge: 'badge-video'   },
  audio:   { icon: 'fa-solid fa-music',        label: 'Audio',   css: 'ftype-audio',   badge: 'badge-audio'   },
  doc:     { icon: 'fa-solid fa-file-lines',   label: 'Doc',     css: 'ftype-doc',     badge: 'badge-doc'     },
  archive: { icon: 'fa-solid fa-file-zipper',  label: 'Archive', css: 'ftype-archive', badge: 'badge-archive' },
  code:    { icon: 'fa-solid fa-code',         label: 'Code',    css: 'ftype-code',    badge: 'badge-code'    },
  other:   { icon: 'fa-solid fa-file',         label: 'File',    css: 'ftype-other',   badge: 'badge-other'   },
};

function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  for (const [type, exts] of Object.entries(FILE_TYPES)) {
    if (exts.includes(ext)) return type;
  }
  return 'other';
}

function getTypeMeta(type) {
  return TYPE_META[type] || TYPE_META.other;
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function getEmbedTag(type, cdnUrl, filename) {
  switch (type) {
    case 'image': return `<img src="${cdnUrl}" alt="${filename}" />`;
    case 'video': return `<video src="${cdnUrl}" controls></video>`;
    case 'audio': return `<audio src="${cdnUrl}" controls></audio>`;
    default:      return `<a href="${cdnUrl}" download="${filename}">${filename}</a>`;
  }
}

function getMarkdownLink(type, cdnUrl, filename) {
  if (type === 'image') return `![${filename}](${cdnUrl})`;
  return `[${filename}](${cdnUrl})`;
}

/* ============================================================
   STATE
   ============================================================ */
let WORKER_API_URL = localStorage.getItem('worker_api_url') || '';
let GITHUB_OWNER   = '';
let GITHUB_REPO    = '';
let selectedFile   = null;
let allFiles       = [];          // full library
let activeFilter   = 'all';
let searchQuery    = '';
let isListView     = false;
let _deletePending = null;
let _previewCdnUrl = '';
let _lightboxUrl   = '';

/* ============================================================
   DOM REFS
   ============================================================ */
const dropzone          = document.getElementById('dropzone');
const fileInput         = document.getElementById('fileInput');
const previewContainer  = document.getElementById('preview-container');
const filePreviewWrap   = document.getElementById('file-preview-wrap');
const fileNameEl        = document.getElementById('file-name');
const fileSizeEl        = document.getElementById('file-size');
const fileTypeBadgeEl   = document.getElementById('file-type-badge');
const uploadBtn         = document.getElementById('upload-btn');
const cancelPreviewBtn  = document.getElementById('cancel-preview');
const progressContainer = document.getElementById('progress-container');
const progressFill      = document.getElementById('progress-fill');
const progressPercent   = document.getElementById('progress-percent');
const configWarning     = document.getElementById('config-warning');
const placeholderResult = document.getElementById('placeholder-result');
const linksContainer    = document.getElementById('links-container');
const galleryGrid       = document.getElementById('gallery-grid');
const galleryLoading    = document.getElementById('gallery-loading');
const galleryEmpty      = document.getElementById('gallery-empty');
const galleryNoResults  = document.getElementById('gallery-no-results');
const galleryCountEl    = document.getElementById('gallery-count');

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  checkConfig();
  if (WORKER_API_URL) fetchGallery();
  bindAll();
});

/* ============================================================
   BIND ALL EVENTS (single place, no duplicates)
   ============================================================ */
function bindAll() {
  // Settings modal
  document.getElementById('btn-open-settings').addEventListener('click', openConfigModal);
  document.getElementById('btn-close-settings').addEventListener('click', closeConfigModal);
  document.getElementById('btn-save-settings').addEventListener('click', saveConfig);
  document.getElementById('config-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('config-modal')) closeConfigModal();
  });

  // Configure-now banner button
  document.getElementById('btn-configure-now').addEventListener('click', openConfigModal);

  // Delete modal
  document.getElementById('btn-cancel-delete').addEventListener('click', closeDeleteModal);
  document.getElementById('confirm-delete-btn').addEventListener('click', () => {
    if (_deletePending) {
      const { path, sha } = _deletePending;
      closeDeleteModal();
      deleteFile(path, sha);
    }
  });
  document.getElementById('delete-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
  });

  // Preview modal
  document.getElementById('btn-close-preview-modal').addEventListener('click', closePreviewModal);
  document.getElementById('btn-close-preview-modal-2').addEventListener('click', closePreviewModal);
  document.getElementById('preview-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('preview-modal')) closePreviewModal();
  });
  document.getElementById('btn-preview-copy-cdn').addEventListener('click', () => {
    navigator.clipboard.writeText(_previewCdnUrl)
      .then(() => showToast('CDN URL copied!'))
      .catch(() => showToast('Copy failed', 'error'));
  });

  // Lightbox
  document.getElementById('btn-lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === document.getElementById('lightbox')) closeLightbox();
  });
  document.getElementById('lightbox-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(_lightboxUrl)
      .then(() => showToast('CDN URL copied!'))
      .catch(() => showToast('Copy failed', 'error'));
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeLightbox(); closeConfigModal(); closeDeleteModal(); closePreviewModal(); }
  });

  // Upload area
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragenter', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', e => { e.preventDefault(); dropzone.classList.remove('dragover'); });
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
  });
  cancelPreviewBtn.addEventListener('click', resetUploadArea);
  uploadBtn.addEventListener('click', startUpload);

  // Copy buttons (delegated on links-container)
  document.querySelectorAll('.btn-copy[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input?.value) return;
      navigator.clipboard.writeText(input.value).then(() => {
        showToast('Copied!');
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        btn.classList.add('copied');
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 1800);
      }).catch(() => showToast('Copy failed', 'error'));
    });
  });

  // Gallery controls
  document.getElementById('refresh-gallery').addEventListener('click', fetchGallery);
  document.getElementById('btn-view-grid').addEventListener('click', () => setView(false));
  document.getElementById('btn-view-list').addEventListener('click', () => setView(true));

  // Search & filter
  document.getElementById('search-input').addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase();
    renderLibrary();
  });
  document.getElementById('filter-chips').addEventListener('click', e => {
    const chip = e.target.closest('.fchip');
    if (!chip) return;
    document.querySelectorAll('.fchip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.type;
    renderLibrary();
  });
}

/* ============================================================
   CONFIG
   ============================================================ */
function checkConfig() {
  if (!WORKER_API_URL) {
    configWarning.classList.remove('hidden');
    setStatusConnected(false);
  } else {
    configWarning.classList.add('hidden');
    setStatusConnected(true);
  }
}

function setStatusConnected(connected) {
  const pill  = document.getElementById('status-pill');
  const label = pill.querySelector('.status-label');
  pill.className = 'status-pill ' + (connected ? 'status-connected' : 'status-unconfigured');
  label.textContent = connected ? 'Connected' : 'Not configured';
}

function openConfigModal() {
  document.getElementById('worker-url-input').value = WORKER_API_URL;
  document.getElementById('config-modal').classList.add('open');
  setTimeout(() => document.getElementById('worker-url-input').focus(), 120);
}
function closeConfigModal() {
  document.getElementById('config-modal').classList.remove('open');
}
function saveConfig() {
  let url = document.getElementById('worker-url-input').value.trim();
  if (url.endsWith('/')) url = url.slice(0, -1);
  localStorage.setItem('worker_api_url', url);
  WORKER_API_URL = url;
  closeConfigModal();
  checkConfig();
  showToast('Worker URL saved!');
  if (WORKER_API_URL) fetchGallery();
}

/* ============================================================
   DELETE MODAL
   ============================================================ */
function openDeleteModal(path, sha) {
  _deletePending = { path, sha };
  document.getElementById('delete-modal').classList.add('open');
}
function closeDeleteModal() {
  _deletePending = null;
  document.getElementById('delete-modal').classList.remove('open');
}

/* ============================================================
   FILE SELECTION & PREVIEW
   ============================================================ */
function handleFileSelection(file) {
  selectedFile = file;
  const type = getFileType(file.name);
  const meta = getTypeMeta(type);

  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  fileTypeBadgeEl.textContent = meta.label;
  fileTypeBadgeEl.className = `preview-type-badge ${meta.badge}`;

  // Render preview content
  filePreviewWrap.innerHTML = '';
  if (type === 'image') {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img');
      img.src = e.target.result;
      filePreviewWrap.appendChild(img);
    };
    reader.readAsDataURL(file);
  } else {
    const iconDiv = document.createElement('div');
    iconDiv.className = 'file-icon-preview';
    iconDiv.innerHTML = `<i class="${meta.icon} ${meta.css}"></i><span>${file.name.split('.').pop().toUpperCase()}</span>`;
    filePreviewWrap.appendChild(iconDiv);
  }

  dropzone.classList.add('hidden');
  previewContainer.classList.remove('hidden');
}

function resetUploadArea() {
  selectedFile = null;
  fileInput.value = '';
  previewContainer.classList.add('hidden');
  dropzone.classList.remove('hidden');
  progressContainer.classList.add('hidden');
  if (progressFill)   progressFill.style.width = '0%';
  if (progressPercent) progressPercent.textContent = '0%';
}

/* ============================================================
   UPLOAD
   ============================================================ */
function startUpload() {
  if (!selectedFile) return;
  if (!WORKER_API_URL) {
    showToast('Set your Worker URL first.', 'warn');
    openConfigModal();
    return;
  }

  const uniqueName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
  const reader = new FileReader();
  reader.readAsDataURL(selectedFile);

  reader.onload = function() {
    const base64Content = reader.result.split(',')[1];

    uploadBtn.disabled = true;
    cancelPreviewBtn.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${WORKER_API_URL}/upload`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
      }
    };

    xhr.onload = () => {
      uploadBtn.disabled = false;
      cancelPreviewBtn.classList.remove('hidden');
      progressContainer.classList.add('hidden');

      if (xhr.status === 200 || xhr.status === 201) {
        let result;
        try { result = JSON.parse(xhr.responseText); } catch (_) { result = {}; }

        if (result.cdn_url) {
          displayGeneratedLinks(result.cdn_url, result.raw_url, selectedFile.name);
          showToast('Upload complete!');
          resetUploadArea();
          fetchGallery();
        } else {
          showToast(result.error || 'Upload failed.', 'error');
        }
      } else {
        let errMsg = 'Upload failed.';
        try { errMsg = JSON.parse(xhr.responseText).error || errMsg; } catch (_) {}
        showToast(errMsg, 'error');
      }
    };

    xhr.onerror = () => {
      uploadBtn.disabled = false;
      cancelPreviewBtn.classList.remove('hidden');
      progressContainer.classList.add('hidden');
      showToast('Network error — check your Worker URL.', 'error');
    };

    xhr.send(JSON.stringify({ filename: uniqueName, content: base64Content }));
  };
}

function displayGeneratedLinks(cdnUrl, rawUrl, filename) {
  const type = getFileType(filename);
  document.getElementById('link-cdn').value      = cdnUrl;
  document.getElementById('link-raw').value      = rawUrl;
  document.getElementById('link-html').value     = getEmbedTag(type, cdnUrl, filename);
  document.getElementById('link-markdown').value = getMarkdownLink(type, cdnUrl, filename);

  placeholderResult.classList.add('hidden');
  linksContainer.classList.remove('hidden');
  linksContainer.closest('.links-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ============================================================
   GALLERY / LIBRARY
   ============================================================ */
async function fetchGallery() {
  if (!WORKER_API_URL) return;

  galleryGrid.innerHTML = '';
  galleryEmpty.classList.add('hidden');
  galleryNoResults.classList.add('hidden');
  galleryLoading.classList.remove('hidden');
  galleryCountEl.classList.add('hidden');

  try {
    const res = await fetch(`${WORKER_API_URL}/files?_=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    GITHUB_OWNER = data.owner || '';
    GITHUB_REPO  = data.repo  || '';
    allFiles = data.files || [];

    galleryLoading.classList.add('hidden');
    renderLibrary();

  } catch (err) {
    galleryLoading.classList.add('hidden');
    galleryEmpty.classList.remove('hidden');
    showToast('Could not load library: ' + err.message, 'error');
  }
}

function renderLibrary() {
  galleryGrid.innerHTML = '';
  galleryEmpty.classList.add('hidden');
  galleryNoResults.classList.add('hidden');

  if (allFiles.length === 0) {
    galleryEmpty.classList.remove('hidden');
    galleryCountEl.classList.add('hidden');
    return;
  }

  // Filter
  let filtered = allFiles.filter(item => {
    const type = getFileType(item.name);
    const matchType   = activeFilter === 'all' || type === activeFilter;
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery);
    return matchType && matchSearch;
  });

  // Update count
  galleryCountEl.textContent = `${filtered.length} file${filtered.length !== 1 ? 's' : ''}`;
  galleryCountEl.classList.remove('hidden');

  if (filtered.length === 0) {
    galleryNoResults.classList.remove('hidden');
    return;
  }

  filtered.forEach((item, i) => {
    const card = isListView ? createListCard(item) : createGridCard(item);
    card.style.animationDelay = `${i * 25}ms`;
    galleryGrid.appendChild(card);
  });
}

function buildCdnUrl(path) {
  return `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main/${path}`;
}

function createGridCard(item) {
  const type   = getFileType(item.name);
  const meta   = getTypeMeta(type);
  const cdnUrl = buildCdnUrl(item.path);

  const card = document.createElement('div');
  card.className = 'gallery-card';

  // Thumb
  const thumb = document.createElement('div');
  thumb.className = 'gc-thumb';
  if (type === 'image') {
    const img = document.createElement('img');
    img.src = cdnUrl;
    img.alt = '';
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    const iconDiv = document.createElement('div');
    iconDiv.className = 'file-icon-thumb';
    const ext = item.name.split('.').pop().toUpperCase();
    iconDiv.innerHTML = `<i class="${meta.icon} ${meta.css}"></i><span>${ext}</span>`;
    thumb.appendChild(iconDiv);
  }
  const overlay = document.createElement('div');
  overlay.className = 'gc-overlay';
  overlay.innerHTML = `<span class="gc-view"><i class="fa-solid fa-expand"></i></span>`;
  thumb.appendChild(overlay);
  thumb.addEventListener('click', () => openFileViewer(item, cdnUrl, type));

  // Footer
  const footer = document.createElement('div');
  footer.className = 'gc-footer';

  const actions = document.createElement('div');
  actions.className = 'gc-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'gc-btn gc-btn-copy';
  copyBtn.title = 'Copy CDN URL';
  copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
  copyBtn.addEventListener('click', e => {
    e.stopPropagation();
    copyWithFeedback(copyBtn, cdnUrl);
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'gc-btn gc-btn-delete';
  delBtn.title = 'Delete file';
  delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
  delBtn.addEventListener('click', e => { e.stopPropagation(); openDeleteModal(item.path, item.sha); });

  actions.appendChild(copyBtn);
  actions.appendChild(delBtn);

  const gcMeta = document.createElement('div');
  gcMeta.className = 'gc-meta';
  const gcName = document.createElement('div');
  gcName.className = 'gc-name';
  gcName.textContent = item.name;
  const gcSize = document.createElement('div');
  gcSize.className = 'gc-size mono';
  gcSize.textContent = formatBytes(item.size);
  gcMeta.appendChild(gcName);
  gcMeta.appendChild(gcSize);

  footer.appendChild(gcMeta);
  footer.appendChild(actions);

  card.appendChild(thumb);
  card.appendChild(footer);
  return card;
}

function createListCard(item) {
  const type   = getFileType(item.name);
  const meta   = getTypeMeta(type);
  const cdnUrl = buildCdnUrl(item.path);

  const card = document.createElement('div');
  card.className = 'gallery-card';

  const row = document.createElement('div');
  row.className = 'list-row';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'list-icon';
  if (type === 'image') {
    const img = document.createElement('img');
    img.src = cdnUrl;
    img.alt = '';
    img.loading = 'lazy';
    iconWrap.appendChild(img);
  } else {
    iconWrap.innerHTML = `<i class="${meta.icon} ${meta.css}"></i>`;
  }

  const info = document.createElement('div');
  info.className = 'list-info';
  const nameEl = document.createElement('div');
  nameEl.className = 'list-name';
  nameEl.textContent = item.name;
  const metaEl = document.createElement('div');
  metaEl.className = 'list-meta';
  metaEl.textContent = formatBytes(item.size) + ' · ' + meta.label;
  info.appendChild(nameEl);
  info.appendChild(metaEl);

  const actions = document.createElement('div');
  actions.className = 'list-actions';

  const viewBtn = document.createElement('button');
  viewBtn.className = 'gc-btn';
  viewBtn.title = 'Preview';
  viewBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
  viewBtn.addEventListener('click', () => openFileViewer(item, cdnUrl, type));

  const copyBtn = document.createElement('button');
  copyBtn.className = 'gc-btn gc-btn-copy';
  copyBtn.title = 'Copy CDN URL';
  copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
  copyBtn.addEventListener('click', () => copyWithFeedback(copyBtn, cdnUrl));

  const delBtn = document.createElement('button');
  delBtn.className = 'gc-btn gc-btn-delete';
  delBtn.title = 'Delete file';
  delBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
  delBtn.addEventListener('click', () => openDeleteModal(item.path, item.sha));

  actions.appendChild(viewBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(delBtn);

  row.appendChild(iconWrap);
  row.appendChild(info);
  row.appendChild(actions);
  card.appendChild(row);
  return card;
}

function setView(listMode) {
  isListView = listMode;
  document.getElementById('btn-view-grid').classList.toggle('active', !listMode);
  document.getElementById('btn-view-list').classList.toggle('active',  listMode);
  galleryGrid.classList.toggle('list-view', listMode);
  renderLibrary();
}

/* ============================================================
   FILE VIEWER (lightbox for images, modal for others)
   ============================================================ */
function openFileViewer(item, cdnUrl, type) {
  if (type === 'image') {
    openLightbox(cdnUrl, item.name);
  } else {
    openPreviewModal(item, cdnUrl, type);
  }
}

function openLightbox(src, name) {
  _lightboxUrl = src;
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox-name').textContent = name;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function openPreviewModal(item, cdnUrl, type) {
  _previewCdnUrl = cdnUrl;

  const meta = getTypeMeta(type);
  document.getElementById('preview-modal-icon').innerHTML = `<i class="${meta.icon}"></i>`;
  document.getElementById('preview-modal-name').textContent = item.name;
  document.getElementById('preview-modal-meta').textContent = `${formatBytes(item.size)} · ${meta.label}`;

  const body = document.getElementById('preview-modal-body');
  body.innerHTML = '';

  if (type === 'image') {
    const img = document.createElement('img');
    img.src = cdnUrl;
    img.alt = item.name;
    body.appendChild(img);
  } else if (type === 'video') {
    const vid = document.createElement('video');
    vid.src = cdnUrl;
    vid.controls = true;
    vid.style.maxHeight = '55vh';
    body.appendChild(vid);
  } else if (type === 'audio') {
    const aud = document.createElement('audio');
    aud.src = cdnUrl;
    aud.controls = true;
    body.appendChild(aud);
  } else {
    const noPreview = document.createElement('div');
    noPreview.className = 'preview-no-preview';
    noPreview.innerHTML = `<i class="${meta.icon} ${meta.css}"></i><p>No preview available.</p><p style="font-size:0.7rem;color:var(--text-3)">Open or download to view this file.</p>`;
    body.appendChild(noPreview);
  }

  const dlBtn = document.getElementById('btn-preview-download');
  dlBtn.href = cdnUrl;
  dlBtn.download = item.name;

  document.getElementById('preview-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closePreviewModal() {
  document.getElementById('preview-modal').classList.remove('open');
  document.body.style.overflow = '';
  // pause any media
  document.querySelectorAll('#preview-modal-body video, #preview-modal-body audio').forEach(m => {
    try { m.pause(); } catch (_) {}
  });
}

/* ============================================================
   DELETE
   ============================================================ */
async function deleteFile(path, sha) {
  try {
    const res = await fetch(`${WORKER_API_URL}/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, sha }),
    });
    const result = await res.json();
    if (res.ok && result.success) {
      showToast('File deleted.');
      fetchGallery();
    } else {
      showToast('Delete failed: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

/* ============================================================
   COPY UTILITY
   ============================================================ */
function copyWithFeedback(btn, url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('CDN URL copied!');
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove('copied');
    }, 1800);
  }).catch(() => showToast('Copy failed.', 'error'));
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(message, type = 'success') {
  const toast  = document.getElementById('toast');
  const inner  = document.getElementById('toast-inner');
  const iconEl = document.getElementById('toast-icon');
  const msgEl  = document.getElementById('toast-message');

  msgEl.textContent = message;
  inner.className = 'toast-inner';

  if (type === 'error') {
    inner.classList.add('toast-error');
    iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
  } else if (type === 'warn') {
    inner.classList.add('toast-warn');
    iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
  } else {
    iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
  }

  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}
