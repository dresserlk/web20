'use strict';

// === API CONFIGURATION ===
const urlParams = new URLSearchParams(window.location.search);
const API_URL = urlParams.get('api') || prompt('Please enter your Google Apps Script API URL:');

if (!API_URL) {
  alert('API URL is required!');
  throw new Error('No API URL provided');
}

// === STATE ===
let sheetId = '', headers = [], rows = [], imageFolderId = '';
let currentMode = '';
let editingRowIndex = -1;
let selectedDataUrl = null;
let selectedFilename = null;
let existingImageUrl = '';

// === API CALL WRAPPER ===
async function callAPI(action, params = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: action,
        ...params
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'API call failed');
    }
    
    return result.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// === INITIALIZE ===
async function refreshDataAndRender() {
  showLoading(true, 'Loading data...');
  try {
    const data = await callAPI('getStoreData');
    sheetId = data.sheetId;
    headers = data.headers || [];
    rows = data.rows || [];
    imageFolderId = data.imageFolderId;
    showList();
    showLoading(false);
  } catch (error) {
    showLoading(false);
    alert('Error: ' + error.message);
  }
}

refreshDataAndRender();

// === SHOW LIST ===
function showList() {
  const content = document.getElementById('content');
  
  if (rows.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-text">No items yet</div>
        <p class="empty-state-subtext">Tap "Add New Item" to create your first product</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  const grid = document.createElement('div');
  grid.className = 'items-grid';

  const imageIdx = headers.findIndex(h => h.toLowerCase() === 'image');

  rows.forEach((row, i) => {
    const card = document.createElement('div');
    card.className = 'item-card';

    if (imageIdx !== -1 && row[imageIdx]) {
      const img = document.createElement('img');
      img.src = row[imageIdx];
      img.className = 'item-image';
      img.alt = 'Product image';
      img.loading = 'lazy';
      card.appendChild(img);
    }

    const cardContent = document.createElement('div');
    cardContent.className = 'item-content';

    row.forEach((cell, idx) => {
      if (idx !== imageIdx && headers[idx]) {
        const field = document.createElement('div');
        field.className = 'item-field';
        field.innerHTML = `
          <span class="field-label">${escapeHtml(headers[idx])}</span>
          <span class="field-value">${escapeHtml(cell || '-')}</span>
        `;
        cardContent.appendChild(field);
      }
    });

    const actions = document.createElement('div');
    actions.className = 'action-buttons';
    actions.innerHTML = `
      <button onclick="openEdit(${i})" class="btn btn-edit">
        <span style="font-size: 18px;">✏️</span>
        <span>Edit</span>
      </button>
      <button onclick="delRow(${i})" class="btn btn-delete">
        <span style="font-size: 18px;">🗑️</span>
        <span>Delete</span>
      </button>
    `;
    cardContent.appendChild(actions);
    card.appendChild(cardContent);
    grid.appendChild(card);
  });

  fragment.appendChild(grid);
  content.innerHTML = '';
  content.appendChild(fragment);
}

// === FORMS ===
function showAddForm() {
  currentMode = 'add';
  editingRowIndex = -1;
  selectedDataUrl = null;
  selectedFilename = null;
  existingImageUrl = '';
  openForm('Add New Item');
}

function openEdit(i) {
  currentMode = 'edit';
  editingRowIndex = i;
  selectedDataUrl = null;
  selectedFilename = null;
  existingImageUrl = rows[i][headers.indexOf('Image')] || '';
  openForm('Edit Item', rows[i]);
}

function openForm(title, row = null) {
  document.getElementById('formTitle').textContent = title;
  
  const fields = document.getElementById('formFields');
  fields.innerHTML = '';

  headers.forEach((h, idx) => {
    const value = row ? row[idx] : '';
    const group = document.createElement('div');
    group.className = 'form-group';

    if (h.toLowerCase() === 'image') {
      group.innerHTML = `
        <label class="form-label">📷 ${escapeHtml(h)}</label>
        <div id="dropzone" class="dropzone" onclick="document.getElementById('imageInput').click()"
          ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="dropImage(event)">
          <div class="dropzone-icon">📤</div>
          <div>Tap to select or drag & drop image</div>
        </div>
        <input id="imageInput" type="file" accept="image/*" style="display: none;" onchange="fileSelected(event)">
        <img id="previewImg" class="preview-image ${value ? 'visible' : ''}" src="${escapeHtml(value || '')}">
      `;
    } else {
      const input = document.createElement('input');
      input.id = 'field-' + sanitizeId(h);
      input.value = value || '';
      input.className = 'form-input';
      input.type = 'text';
      input.autocomplete = 'off';
      input.autocorrect = 'off';
      input.autocapitalize = 'off';
      input.spellcheck = false;

      group.innerHTML = `<label class="form-label">${escapeHtml(h)}</label>`;
      group.appendChild(input);
    }

    fields.appendChild(group);
  });

  document.body.classList.add('modal-open');
  document.documentElement.style.overflow = 'hidden';
  
  requestAnimationFrame(() => {
    document.getElementById('formModal').classList.add('active');
  });
}

// === IMAGE HANDLING ===
function dragOver(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.add('dragover');
}

function dragLeave(e) {
  document.getElementById('dropzone').classList.remove('dragover');
}

function dropImage(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
}

function fileSelected(e) {
  const file = e.target.files[0];
  if (file) handleFile(file);
}

function handleFile(file) {
  selectedFilename = file.name;
  const preview = document.getElementById('previewImg');
  
  compressImageFileToDataUrl(file, 1200, 0.75).then(data => {
    selectedDataUrl = data;
    preview.src = data;
    preview.classList.add('visible');
  });
}

function compressImageFileToDataUrl(file, max, qual) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          if (w > h) {
            h = Math.round(h * (max / w));
            w = max;
          } else {
            w = Math.round(w * (max / h));
            h = max;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', qual));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// === SUBMIT ===
async function submitForm() {
  showLoading(true, 'Saving...');
  
  try {
    const rowData = [];
    const imgIndex = headers.indexOf('Image');

    headers.forEach((h, i) => {
      if (i === imgIndex) {
        rowData.push('');
      } else {
        const el = document.getElementById('field-' + sanitizeId(h));
        rowData.push(el ? el.value : '');
      }
    });

    let imageUrl = existingImageUrl;
    
    if (selectedDataUrl) {
      imageUrl = await callAPI('uploadImage', {
        folderId: imageFolderId,
        dataUrl: selectedDataUrl,
        fileName: selectedFilename
      });
    }

    if (imgIndex >= 0) rowData[imgIndex] = imageUrl;

    if (currentMode === 'add') {
      await callAPI('addRow', { sheetId, rowData });
    } else {
      await callAPI('updateRow', { sheetId, rowIndex: editingRowIndex, rowData });
    }

    showLoading(false);
    closeForm();
    refreshDataAndRender();
    
  } catch (error) {
    showLoading(false);
    alert('Error saving: ' + error.message);
  }
}

// === DELETE ===
async function delRow(i) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  
  showLoading(true, 'Deleting...');
  
  try {
    await callAPI('deleteRow', { sheetId, rowIndex: i });
    showLoading(false);
    refreshDataAndRender();
  } catch (error) {
    showLoading(false);
    alert('Error deleting: ' + error.message);
  }
}

// === HELPERS ===
function closeForm() {
  document.getElementById('formModal').classList.remove('active');
  document.body.classList.remove('modal-open');
  document.documentElement.style.overflow = '';
}

function showLoading(state, text) {
  const overlay = document.getElementById('loadingOverlay');
  if (text) document.getElementById('loadingText').textContent = text;
  
  if (state) {
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

function sanitizeId(s) {
  return (s || '').toString().replace(/[^a-zA-Z0-9_-]/g, '_');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

// === PWA SERVICE WORKER REGISTRATION ===
if ('serviceWorker' in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js")
      .then(reg => console.log('Service Worker registered'))
      .catch(err => console.error("SW registration failed:", err));
  });
}
