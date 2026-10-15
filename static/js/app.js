/* ============================================================
   StealthGPT Humanizer - Frontend Controller & Diff Engine
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const rawTextInput = document.getElementById('raw-text-input');
  const humanizedTextOutput = document.getElementById('humanized-text-output');
  const diffViewer = document.getElementById('diff-viewer');
  const outputPlaceholder = document.getElementById('output-placeholder');
  
  // Progress Elements
  const outputProgress = document.getElementById('output-progress');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressTimer = document.getElementById('progress-timer');
  const progressStepTitle = document.getElementById('progress-step-title');
  const progressStepSub = document.getElementById('progress-step-sub');
  const stage1 = document.getElementById('stage-1');
  const stage2 = document.getElementById('stage-2');
  const stage3 = document.getElementById('stage-3');
  const stage4 = document.getElementById('stage-4');

  // Model Badge Elements
  const currentModelLabel = document.getElementById('current-model-label');
  const activeModelPill = document.getElementById('active-model-pill');
  
  const modelSelect = document.getElementById('model-select');
  const toneSelect = document.getElementById('tone-select');
  const writingModeSelect = document.getElementById('writing-mode-select');
  const sampleSelect = document.getElementById('sample-select');

  const btnHumanize = document.getElementById('btn-humanize');
  const btnCopy = document.getElementById('btn-copy');
  const btnDownloadTxt = document.getElementById('btn-download-txt');
  const btnDownloadMd = document.getElementById('btn-download-md');
  const btnClearInput = document.getElementById('btn-clear-input');
  const btnPasteInput = document.getElementById('btn-paste-input');
  
  const toggleResultView = document.getElementById('toggle-result-view');
  const toggleDiffView = document.getElementById('toggle-diff-view');

  // Stats Elements
  const origWordsCount = document.getElementById('orig-words-count');
  const origCharsCount = document.getElementById('orig-chars-count');
  const outWordsCount = document.getElementById('out-words-count');
  const outCharsCount = document.getElementById('out-chars-count');
  const diffPctBadge = document.getElementById('diff-pct-badge');

  // API Key & Status
  const keyStatusIndicator = document.getElementById('key-status-indicator');
  const keyStatusDot = document.getElementById('key-status-dot');
  const keyStatusText = document.getElementById('key-status-text');
  const apiKeyBanner = document.getElementById('api-key-banner');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnBannerSettings = document.getElementById('btn-banner-settings');

  // Settings Modal
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnSaveKey = document.getElementById('btn-save-key');
  const btnTestKey = document.getElementById('btn-test-key');
  const toggleKeyVisibility = document.getElementById('toggle-key-visibility');

  // History Drawer
  const btnOpenHistory = document.getElementById('btn-open-history');
  const historyDrawer = document.getElementById('history-drawer');
  const historyBackdrop = document.getElementById('history-backdrop');
  const btnCloseHistory = document.getElementById('btn-close-history');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const historyList = document.getElementById('history-list');

  // Toast Container
  const toastContainer = document.getElementById('toast-container');

  // State
  let currentRawText = '';
  let currentHumanizedText = '';
  let isKeyConfigured = false;
  let activeViewMode = 'result'; // 'result' or 'diff'

  // Samples
  const SAMPLE_TEXTS = {
    academic: "Furthermore, it is crucial to recognize that artificial intelligence plays a transformative role in contemporary higher education. Through the utilization of machine learning algorithms, educational institutions are capable of personalizing student curricula, thereby optimizing learning outcomes and enhancing student retention rates across diverse pedagogical frameworks.",
    business: "In today's fast-paced digital ecosystem, implementing automated customer support workflows is essential for maximizing operational efficiency and driving scalable revenue growth. By deploying predictive analytics models, enterprise organizations can effectively minimize customer churn while maintaining high retention metrics.",
    essay: "The fundamental premise of renewable energy integration hinges upon the technological viability of decentralized battery storage solutions. Traditional power grids frequently suffer from severe transmission bottlenecks during peak demand periods, whereas smart microgrid architecture offers resilience and carbon footprint reduction."
  };

  // ================= Notification Toast =================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // ================= Word / Char Counters =================
  function countWords(str) {
    if (!str || !str.trim()) return 0;
    const matches = str.trim().match(/\b\w+\b/g);
    return matches ? matches.length : 0;
  }

  function updateInputStats() {
    const val = rawTextInput.value;
    const words = countWords(val);
    const chars = val.length;
    origWordsCount.textContent = words.toLocaleString();
    origCharsCount.textContent = chars.toLocaleString();
  }

  rawTextInput.addEventListener('input', updateInputStats);

  // ================= Load Initial Config =================
  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      
      isKeyConfigured = data.has_key;
      updateKeyUI(data.has_key, data.masked_key);

      if (data.models && data.models.length > 0) {
        modelSelect.innerHTML = data.models.map(m => 
          `<option value="${m.id}" ${m.id === 'super' ? 'selected' : ''}>${m.name}</option>`
        ).join('');
      }

      if (data.tones && data.tones.length > 0) {
        toneSelect.innerHTML = data.tones.map(t => 
          `<option value="${t}" ${t === 'Standard' ? 'selected' : ''}>${t}</option>`
        ).join('');
      }

      updateModelBadge(modelSelect.value || 'super');
    } catch (err) {
      console.error('Failed to load initial configuration:', err);
    }
  }

  // ================= Model Badge Controller =================
  function updateModelBadge(modelId) {
    const modelNames = {
      super: 'Super',
      standard: 'Standard',
      lite: 'Lite'
    };
    const name = modelNames[modelId] || modelId;
    if (currentModelLabel) currentModelLabel.textContent = name;
    
    const tag = activeModelPill ? activeModelPill.querySelector('.model-tag') : null;
    if (tag) {
      if (modelId === 'super') {
        tag.textContent = 'Undetectable';
        tag.style.background = 'rgba(245, 158, 11, 0.25)';
        tag.style.color = '#fbbf24';
      } else if (modelId === 'standard') {
        tag.textContent = 'Balanced';
        tag.style.background = 'rgba(99, 102, 241, 0.25)';
        tag.style.color = '#818cf8';
      } else {
        tag.textContent = 'Fast';
        tag.style.background = 'rgba(16, 185, 129, 0.25)';
        tag.style.color = '#34d399';
      }
    }
  }

  modelSelect.addEventListener('change', () => {
    updateModelBadge(modelSelect.value);
  });

  function updateKeyUI(hasKey, maskedKey) {
    if (hasKey) {
      keyStatusDot.className = 'status-dot active';
      keyStatusText.textContent = maskedKey || 'API Key Connected';
      apiKeyBanner.classList.add('hidden');
    } else {
      keyStatusDot.className = 'status-dot missing';
      keyStatusText.textContent = 'Key Required';
      apiKeyBanner.classList.remove('hidden');
    }
  }

  // ================= Progress Engine =================
  let progressInterval = null;

  function startProgressAnimation(selectedModel, wordCount = 0) {
    const startTime = performance.now();
    outputPlaceholder.classList.add('hidden');
    humanizedTextOutput.classList.add('hidden');
    diffViewer.classList.add('hidden');
    outputProgress.classList.remove('hidden');

    progressBarFill.style.width = '6%';
    progressTimer.textContent = '0.0s';
    stage1.className = 'stage-step active';
    stage2.className = 'stage-step';
    stage3.className = 'stage-step';
    stage4.className = 'stage-step';

    const modelUpper = (selectedModel || 'Super').toUpperCase();
    const isLongText = wordCount > 350;
    const estChunks = Math.max(1, Math.ceil(wordCount / 350));

    if (isLongText) {
      progressStepTitle.textContent = `Humanizing Long Text (${wordCount} words) with ${modelUpper}...`;
      progressStepSub.textContent = `Optimizing into ${estChunks} seamless sections to maximize detection bypass`;
    } else {
      progressStepTitle.textContent = `Humanizing with ${modelUpper} model...`;
      progressStepSub.textContent = 'Analyzing AI sentence patterns & perplexity score';
    }

    // Expected duration base: short text ~12s, each extra chunk adds ~18s
    const targetDurationMs = isLongText ? (estChunks * 20000) : 14000;

    progressInterval = setInterval(() => {
      const elapsedMs = performance.now() - startTime;
      const elapsedSec = (elapsedMs / 1000).toFixed(1);
      progressTimer.textContent = `${elapsedSec}s`;

      const t1 = targetDurationMs * 0.2;
      const t2 = targetDurationMs * 0.55;
      const t3 = targetDurationMs * 0.85;

      if (elapsedMs < t1) {
        // Stage 1: AI Analysis
        const pct = 6 + (elapsedMs / t1) * 22;
        progressBarFill.style.width = `${pct}%`;
        stage1.className = 'stage-step active';
      } else if (elapsedMs < t2) {
        // Stage 2: Super Bypass
        stage1.className = 'stage-step completed';
        stage2.className = 'stage-step active';
        if (isLongText) {
          const currentChunkIdx = Math.min(estChunks, Math.floor((elapsedMs - t1) / (t2 - t1) * estChunks) + 1);
          progressStepSub.textContent = `Applying Super bypass heuristics to section ${currentChunkIdx} of ${estChunks}...`;
        } else {
          progressStepSub.textContent = 'Applying undetectable stealth bypass heuristics...';
        }
        const pct = 28 + ((elapsedMs - t1) / (t2 - t1)) * 34;
        progressBarFill.style.width = `${pct}%`;
      } else if (elapsedMs < t3) {
        // Stage 3: Human Cadence
        stage1.className = 'stage-step completed';
        stage2.className = 'stage-step completed';
        stage3.className = 'stage-step active';
        progressStepSub.textContent = 'Reconstructing natural cadence, human burstiness & flow...';
        const pct = 62 + ((elapsedMs - t2) / (t3 - t2)) * 26;
        progressBarFill.style.width = `${pct}%`;
      } else {
        // Stage 4: Polish & Tone
        stage1.className = 'stage-step completed';
        stage2.className = 'stage-step completed';
        stage3.className = 'stage-step completed';
        stage4.className = 'stage-step active';
        progressStepSub.textContent = 'Assembling output, checking readability and polishing tone...';
        const pct = Math.min(97, 88 + ((elapsedMs - t3) / (targetDurationMs * 1.5)) * 9);
        progressBarFill.style.width = `${pct}%`;
      }
    }, 60);
  }

  function completeProgressAnimation() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    progressBarFill.style.width = '100%';
    stage1.className = 'stage-step completed';
    stage2.className = 'stage-step completed';
    stage3.className = 'stage-step completed';
    stage4.className = 'stage-step completed';
    progressStepTitle.textContent = 'Humanization Complete!';
    progressStepSub.textContent = 'Output formatted and verified';
  }

  function stopProgressAnimation() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    outputProgress.classList.add('hidden');
  }

  // ================= Sample Selection =================
  sampleSelect.addEventListener('change', () => {
    const val = sampleSelect.value;
    if (SAMPLE_TEXTS[val]) {
      rawTextInput.value = SAMPLE_TEXTS[val];
      updateInputStats();
      showToast('Loaded sample AI text into editor');
    }
    sampleSelect.value = '';
  });

  // ================= Clear & Paste Actions =================
  btnClearInput.addEventListener('click', () => {
    rawTextInput.value = '';
    updateInputStats();
    rawTextInput.focus();
  });

  btnPasteInput.addEventListener('click', async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        rawTextInput.value = clipText;
        updateInputStats();
        showToast('Pasted text from clipboard', 'success');
      }
    } catch (err) {
      showToast('Clipboard access was denied. Please paste manually.', 'error');
    }
  });

  // ================= Diff Engine (Word-level) =================
  function computeWordDiff(orig, mod) {
    const origWords = orig.split(/(\s+)/);
    const modWords = mod.split(/(\s+)/);

    const n = origWords.length;
    const m = modWords.length;
    const dp = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        if (origWords[i] === modWords[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    let i = n, j = m;
    const chunks = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && origWords[i - 1] === modWords[j - 1]) {
        chunks.unshift({ type: 'same', text: origWords[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        chunks.unshift({ type: 'ins', text: modWords[j - 1] });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        chunks.unshift({ type: 'del', text: origWords[i - 1] });
        i--;
      }
    }

    let html = '';
    for (const chunk of chunks) {
      const escaped = chunk.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      if (chunk.type === 'del') {
        if (chunk.text.trim()) {
          html += `<span class="diff-del">${escaped}</span>`;
        } else {
          html += escaped;
        }
      } else if (chunk.type === 'ins') {
        if (chunk.text.trim()) {
          html += `<span class="diff-ins">${escaped}</span>`;
        } else {
          html += escaped;
        }
      } else {
        html += escaped;
      }
    }
    return html;
  }

  // ================= Switch Views =================
  function setViewMode(mode) {
    activeViewMode = mode;
    if (mode === 'result') {
      toggleResultView.classList.add('active');
      toggleDiffView.classList.remove('active');
      humanizedTextOutput.classList.remove('hidden');
      diffViewer.classList.add('hidden');
    } else {
      toggleDiffView.classList.add('active');
      toggleResultView.classList.remove('active');
      humanizedTextOutput.classList.add('hidden');
      diffViewer.classList.remove('hidden');
    }
  }

  toggleResultView.addEventListener('click', () => setViewMode('result'));
  toggleDiffView.addEventListener('click', () => setViewMode('diff'));

  // ================= Humanize Action =================
  async function performHumanize() {
    const rawText = rawTextInput.value.trim();
    if (!rawText) {
      showToast('Please enter or paste raw text to humanize.', 'error');
      rawTextInput.focus();
      return;
    }

    if (!isKeyConfigured) {
      openSettings();
      showToast('Please enter your StealthGPT API Key to continue.', 'error');
      return;
    }

    // Set UI loading state and start progress animation
    btnHumanize.disabled = true;
    const originalBtnHtml = btnHumanize.innerHTML;
    btnHumanize.innerHTML = `<div class="spinner"></div><span>Humanizing...</span>`;

    startProgressAnimation(modelSelect.value, countWords(rawText));

    try {
      const response = await fetch('/api/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          model: modelSelect.value,
          tone: toneSelect.value,
          writing_mode: writingModeSelect.value
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to humanize text');
      }

      completeProgressAnimation();

      currentRawText = rawText;
      currentHumanizedText = data.result;

      // Small pause to let the completed 100% state render smoothly
      setTimeout(() => {
        outputProgress.classList.add('hidden');
        outputPlaceholder.classList.add('hidden');
        humanizedTextOutput.textContent = currentHumanizedText;
        humanizedTextOutput.classList.remove('hidden');

        // Update diff
        diffViewer.innerHTML = computeWordDiff(currentRawText, currentHumanizedText);
        setViewMode('result');

        // Update statistics
        const stats = data.stats || {};
        outWordsCount.textContent = (stats.humanized_words || countWords(currentHumanizedText)).toLocaleString();
        outCharsCount.textContent = (stats.humanized_chars || currentHumanizedText.length).toLocaleString();
        
        const pct = stats.diff_pct !== undefined ? stats.diff_pct : 0;
        diffPctBadge.textContent = `${pct > 0 ? '+' : ''}${pct}% length`;

        showToast('Humanized successfully with StealthGPT!', 'success');
        loadHistory();
      }, 300);

    } catch (err) {
      console.error(err);
      stopProgressAnimation();
      if (currentHumanizedText) {
        humanizedTextOutput.classList.remove('hidden');
      } else {
        outputPlaceholder.classList.remove('hidden');
      }
      showToast(err.message || 'Error occurred while humanizing.', 'error');
    } finally {
      btnHumanize.disabled = false;
      btnHumanize.innerHTML = originalBtnHtml;
    }
  }

  btnHumanize.addEventListener('click', performHumanize);

  // Keyboard shortcut: Cmd + Enter / Ctrl + Enter
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      performHumanize();
    }
  });

  // ================= Copy & Export =================
  btnCopy.addEventListener('click', async () => {
    if (!currentHumanizedText) {
      showToast('No output to copy yet.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(currentHumanizedText);
      showToast('Humanized text copied to clipboard!', 'success');
    } catch (err) {
      showToast('Failed to copy to clipboard.', 'error');
    }
  });

  function downloadFile(filename, content, mimeType) {
    if (!content) {
      showToast('No content to download.', 'error');
      return;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, 'success');
  }

  btnDownloadTxt.addEventListener('click', () => {
    downloadFile('stealthgpt-humanized.txt', currentHumanizedText, 'text/plain');
  });

  btnDownloadMd.addEventListener('click', () => {
    downloadFile('stealthgpt-humanized.md', currentHumanizedText, 'text/markdown');
  });

  // ================= Settings Modal =================
  function openSettings() {
    settingsModal.classList.add('open');
    apiKeyInput.focus();
  }

  function closeSettings() {
    settingsModal.classList.remove('open');
  }

  btnOpenSettings.addEventListener('click', openSettings);
  btnBannerSettings.addEventListener('click', openSettings);
  btnCloseSettings.addEventListener('click', closeSettings);

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  toggleKeyVisibility.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  btnSaveKey.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showToast('Please enter an API key.', 'error');
      return;
    }

    try {
      btnSaveKey.disabled = true;
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save key');

      isKeyConfigured = true;
      updateKeyUI(true, data.masked_key);
      apiKeyInput.value = '';
      closeSettings();
      showToast('API Key saved and securely configured in .env', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btnSaveKey.disabled = false;
    }
  });

  btnTestKey.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showToast('Please enter a key to test.', 'error');
      return;
    }

    try {
      btnTestKey.disabled = true;
      btnTestKey.textContent = 'Testing...';
      const res = await fetch('/api/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key })
      });
      const data = await res.json();

      if (data.success) {
        showToast('API Key is valid and connected to StealthGPT!', 'success');
      } else {
        showToast(`Verification failed: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('Failed to reach server to test key.', 'error');
    } finally {
      btnTestKey.disabled = false;
      btnTestKey.textContent = 'Test Connection';
    }
  });

  // ================= History Drawer =================
  function openHistory() {
    loadHistory();
    historyDrawer.classList.add('open');
    historyBackdrop.classList.add('open');
  }

  function closeHistory() {
    historyDrawer.classList.remove('open');
    historyBackdrop.classList.remove('open');
  }

  btnOpenHistory.addEventListener('click', openHistory);
  btnCloseHistory.addEventListener('click', closeHistory);
  historyBackdrop.addEventListener('click', closeHistory);

  async function loadHistory() {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        historyList.innerHTML = `
          <div style="text-align: center; color: var(--text-dim); padding: 40px 0;">
            No history yet. Humanized texts will appear here.
          </div>
        `;
        return;
      }

      historyList.innerHTML = items.map(item => {
        const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString([], {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '';
        const words = item.stats?.humanized_words || countWords(item.humanized_text);

        return `
          <div class="history-card" data-id="${item.id}">
            <div class="history-meta">
              <span>${dateStr} • <strong>${item.model || 'super'}</strong></span>
              <span class="stat-pill" style="font-size: 0.7rem;">${words} words</span>
            </div>
            <div class="history-snippet">${escapeHtml(item.humanized_text)}</div>
          </div>
        `;
      }).join('');

      // Add click listeners to restore
      document.querySelectorAll('.history-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.id;
          const found = items.find(it => it.id === id);
          if (found) {
            rawTextInput.value = found.original_text;
            updateInputStats();
            currentRawText = found.original_text;
            currentHumanizedText = found.humanized_text;
            
            outputPlaceholder.classList.add('hidden');
            humanizedTextOutput.textContent = found.humanized_text;
            humanizedTextOutput.classList.remove('hidden');
            diffViewer.innerHTML = computeWordDiff(found.original_text, found.humanized_text);
            setViewMode('result');

            outWordsCount.textContent = (found.stats?.humanized_words || countWords(found.humanized_text)).toLocaleString();
            outCharsCount.textContent = (found.stats?.humanized_chars || found.humanized_text.length).toLocaleString();
            
            closeHistory();
            showToast('Loaded generation from history into editor', 'info');
          }
        });
      });

    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  btnClearHistory.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all history?')) return;
    try {
      await fetch('/api/history', { method: 'DELETE' });
      loadHistory();
      showToast('History cleared', 'info');
    } catch (err) {
      showToast('Failed to clear history', 'error');
    }
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================
  // MANUSCRIPT STUDIO CONTROLLER (Scientific Papers & Drag-to-Select)
  // ============================================================
  
  // Navigation Tabs
  const tabManuscriptMode = document.getElementById('tab-manuscript-mode');
  const tabDualMode = document.getElementById('tab-dual-mode');
  const manuscriptStudioView = document.getElementById('manuscript-studio-view');
  const dualStudioView = document.getElementById('dual-studio-view');

  // Manuscript Toolbar & Controls
  const manuscriptFileInput = document.getElementById('manuscript-file-input');
  const btnTriggerUpload = document.getElementById('btn-trigger-upload');
  const btnEmptyUpload = document.getElementById('btn-empty-upload');
  const btnLoadSamplePaper = document.getElementById('btn-load-sample-paper');
  const btnEmptySample = document.getElementById('btn-empty-sample');
  const manuscriptContent = document.getElementById('manuscript-content');
  const manuscriptToneSelect = document.getElementById('manuscript-tone-select');
  const docWordsCount = document.getElementById('doc-words-count');
  const docReplacedCount = document.getElementById('doc-replaced-count');
  const btnExportDocx = document.getElementById('btn-export-docx');
  const btnCopyManuscript = document.getElementById('btn-copy-manuscript');

  // Floating Selection Action Bar
  const floatingSelectionBar = document.getElementById('floating-selection-bar');
  const btnHumanizeSelection = document.getElementById('btn-humanize-selection');
  const floatingToneSelect = document.getElementById('floating-tone-select');
  const floatingWordCount = document.getElementById('floating-word-count');

  // Scientific Approval & Diff Modal
  const scientificApprovalModal = document.getElementById('scientific-approval-modal');
  const btnCloseApproval = document.getElementById('btn-close-approval');
  const btnRejectApproval = document.getElementById('btn-reject-approval');
  const btnAcceptApproval = document.getElementById('btn-accept-approval');
  const approvalOrigText = document.getElementById('approval-orig-text');
  const approvalHumanizedText = document.getElementById('approval-humanized-text');
  const approvalOrigStats = document.getElementById('approval-orig-stats');
  const approvalHumanizedStats = document.getElementById('approval-humanized-stats');
  const approvalRerollTone = document.getElementById('approval-reroll-tone');
  const btnApprovalReroll = document.getElementById('btn-approval-reroll');

  // Manuscript State
  let activeSelectionRange = null;
  let activeSelectedText = '';
  let pendingHumanizedText = '';
  let replacedPassagesCount = 0;

  // Realistic Scientific Manuscript Sample
  const SAMPLE_MANUSCRIPT_HTML = `
    <h1 class="doc-heading-1">Hierarchical Representation Learning for High-Throughput Genomic Variant Classification</h1>
    <p style="text-align: center; color: var(--text-muted); font-size: 0.95rem; margin-bottom: 2rem;">
      <strong>A. Vance, Ph.D.</strong><sup>1</sup>, <strong>K. Chen, M.D.</strong><sup>2</sup>, <strong>R. Sterling, Ph.D.</strong><sup>1*</sup><br>
      <em><sup>1</sup>Department of Computational Biology, Stanford University; <sup>2</sup>Division of Oncology, Harvard Medical School</em>
    </p>

    <h2 class="doc-heading-2">Abstract</h2>
    <p class="doc-paragraph">
      Accurate pathogenicity classification of non-coding single-nucleotide variants remains a pivotal challenge in precision genomics. Conventional in silico prediction algorithms frequently display elevated false discovery rates when applied to non-conserved regulatory loci. Here, we present a hierarchical multi-scale transformer architecture trained on 14.2 million chromatin accessibility profiles and deep single-cell RNA sequencing datasets. Across a benchmark of 1,284 clinically validated ClinVar variants, our framework achieved an area under the precision-recall curve (AUPRC) of 0.941, significantly outperforming benchmark ensembles (p &lt; 0.001, Wilcoxon signed-rank test). These findings illustrate that self-supervised contextual representations effectively disentangle benign sequence polymorphisms from deleterious regulatory disruptions.
    </p>

    <h2 class="doc-heading-2">1. Introduction</h2>
    <p class="doc-paragraph">
      Genome-wide association studies (GWAS) have successfully mapped tens of thousands of statistical loci associated with complex human diseases (Visscher et al., 2017). Nonetheless, over 93% of identified trait-associated variants reside in non-coding regions, encompassing distal transcriptional enhancers, canonical promoters, and CTCF-mediated boundary domains (Maurano et al., 2012). Mechanistic interpretation of these loci has historically been constrained by cell-type specificity and the non-linear cooperative kinetics governing transcription factor assembly (Splinter et al., 2018).
    </p>
    <p class="doc-paragraph">
      Recent advancements in neural sequence modeling, notably self-supervised bidirectional transformer encoders, offer a promising paradigm for extracting evolutionary priors directly from primary genomic sequences (Avsec et al., 2021; Dalla-Torre et al., 2023). However, conventional deep learning models frequently suffer from severe attribution collapse when evaluating distal interactions exceeding 100 kilobases, resulting in over-reliance on local nucleotide frequency metrics rather than functional biological motifs.
    </p>

    <h2 class="doc-heading-2">2. Materials and Methodology</h2>
    <p class="doc-paragraph">
      We compiled a benchmark dataset encompassing 14,250 curated genomic variations across 54 human tissue types cataloged in the GTEx Consortium (v8) and ENCODE Registry of cis-Regulatory Elements. For each genomic locus, a 32,768 base pair window centered on the target variant was extracted from the GRCh38 human reference genome. In addition to primary FASTA sequence tokens, we integrated experimental epigenetic tracks including DNase-seq hypersensitivity footprints and histone modification profiles (H3K27ac and H3K4me3) measured across matching cell types.
    </p>
    <p class="doc-paragraph">
      Model training was conducted across an array of eight NVIDIA A100 Tensor Core GPUs utilizing mixed-precision floating-point arithmetic (bfloat16). Optimization was governed by AdamW with a decoupled weight decay parameter of 0.01 and a cosine annealing learning rate scheduler initiated at 5e-5 with a linear warmup phase of 2,500 iterations.
    </p>

    <h2 class="doc-heading-2">3. Results & Discussion</h2>
    <p class="doc-paragraph">
      Quantitative validation on the held-out pathogenic test cohort revealed marked improvements in discriminative calibration. The multi-scale model attained an AUROC of 0.963 (95% CI: 0.954-0.972), representing a 14.8% relative error reduction compared to CADD (Rentzsch et al., 2019) and a 9.2% improvement over Eigen scores (Ionita-Laza et al., 2016). Crucially, the model sustained robust diagnostic sensitivity even in low-conservation genomic regions where phyloP scores were indistinguishable from neutral drift.
    </p>
    <p class="doc-paragraph">
      In summary, these results demonstrate that multi-modal contextual embedding bridges the longstanding divide between sequence-level conservation metrics and cell-type specific epigenetic activation states. Future investigations will evaluate prospective patient cohorts suffering from rare undiagnosed Mendelian disorders.
    </p>
  `;

  // Mode Switcher logic
  if (tabManuscriptMode && tabDualMode) {
    tabManuscriptMode.addEventListener('click', () => {
      tabManuscriptMode.classList.add('active');
      tabDualMode.classList.remove('active');
      manuscriptStudioView.classList.remove('hidden');
      dualStudioView.classList.add('hidden');
    });

    tabDualMode.addEventListener('click', () => {
      tabDualMode.classList.add('active');
      tabManuscriptMode.classList.remove('active');
      dualStudioView.classList.remove('hidden');
      manuscriptStudioView.classList.add('hidden');
      hideFloatingSelection();
    });
  }

  // Manuscript word count updater
  function updateManuscriptStats() {
    if (!manuscriptContent) return;
    const text = manuscriptContent.innerText || '';
    const words = countWords(text);
    if (docWordsCount) docWordsCount.textContent = words.toLocaleString();
  }

  // Load sample research paper
  function loadSampleResearchPaper() {
    if (!manuscriptContent) return;
    manuscriptContent.innerHTML = SAMPLE_MANUSCRIPT_HTML;
    replacedPassagesCount = 0;
    if (docReplacedCount) docReplacedCount.textContent = '0';
    updateManuscriptStats();
    hideFloatingSelection();
    showToast('Loaded sample scientific manuscript with citations & methodology', 'info');
  }

  if (btnLoadSamplePaper) btnLoadSamplePaper.addEventListener('click', loadSampleResearchPaper);
  if (btnEmptySample) btnEmptySample.addEventListener('click', loadSampleResearchPaper);

  // File Upload Handlers
  function triggerFileUpload() {
    if (manuscriptFileInput) manuscriptFileInput.click();
  }

  if (btnTriggerUpload) btnTriggerUpload.addEventListener('click', triggerFileUpload);
  if (btnEmptyUpload) btnEmptyUpload.addEventListener('click', triggerFileUpload);

  if (manuscriptFileInput) {
    manuscriptFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const fileName = file.name;
      const ext = fileName.toLowerCase().split('.').pop();
      showToast(`Uploading and parsing ${fileName}...`, 'info');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/document/parse', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to parse file');
        }

        manuscriptContent.innerHTML = data.html;
        replacedPassagesCount = 0;
        if (docReplacedCount) docReplacedCount.textContent = '0';
        updateManuscriptStats();
        hideFloatingSelection();
        showToast(`Loaded ${fileName} successfully! Drag cursor to select passages.`, 'success');

      } catch (err) {
        showToast(`Document error: ${err.message}`, 'error');
      } finally {
        manuscriptFileInput.value = '';
      }
    });
  }

  // Floating Selection Management
  function hideFloatingSelection() {
    if (floatingSelectionBar) {
      floatingSelectionBar.classList.add('hidden');
    }
  }

  function handleManuscriptSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      return;
    }

    const range = sel.getRangeAt(0);
    if (!manuscriptContent || !manuscriptContent.contains(range.commonAncestorContainer)) {
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 5) {
      hideFloatingSelection();
      return;
    }

    activeSelectionRange = range.cloneRange();
    activeSelectedText = text;

    const rect = range.getBoundingClientRect();
    const barWidth = 320;
    let top = rect.top + window.scrollY - 46;
    let left = rect.left + window.scrollX + (rect.width / 2) - (barWidth / 2);

    if (left < 16) left = 16;
    if (left + barWidth > window.innerWidth - 16) {
      left = window.innerWidth - barWidth - 16;
    }
    if (rect.top < 65) {
      top = rect.bottom + window.scrollY + 10;
    }

    floatingSelectionBar.style.top = `${top}px`;
    floatingSelectionBar.style.left = `${left}px`;
    floatingSelectionBar.classList.remove('hidden');

    const words = countWords(text);
    floatingWordCount.textContent = `${words} word${words === 1 ? '' : 's'}`;
  }

  if (manuscriptContent) {
    manuscriptContent.addEventListener('mouseup', () => {
      setTimeout(handleManuscriptSelection, 20);
    });
    manuscriptContent.addEventListener('keyup', () => {
      setTimeout(handleManuscriptSelection, 20);
    });
  }

  // Hide floating bar when clicking outside
  document.addEventListener('mousedown', (e) => {
    if (!floatingSelectionBar || floatingSelectionBar.classList.contains('hidden')) return;
    if (floatingSelectionBar.contains(e.target)) return;
    if (scientificApprovalModal && scientificApprovalModal.contains(e.target)) return;
    if (manuscriptContent && manuscriptContent.contains(e.target)) return;

    hideFloatingSelection();
  });

  // Humanize Selection Action
  async function performHumanizeSelection(toneOverride = null) {
    if (!activeSelectedText) {
      showToast('Please select text in the manuscript first.', 'info');
      return;
    }

    const tone = toneOverride || (floatingToneSelect ? floatingToneSelect.value : null) || (manuscriptToneSelect ? manuscriptToneSelect.value : 'PhD');

    if (btnHumanizeSelection) {
      btnHumanizeSelection.disabled = true;
      btnHumanizeSelection.innerHTML = `
        <span class="spinner" style="width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite; margin-right: 6px;"></span>
        <span>Humanizing...</span>
      `;
    }

    try {
      const res = await fetch('/api/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: activeSelectedText,
          model: 'super',
          tone: tone,
          writing_mode: 'essay'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.error || 'Humanization failed');
      }

      pendingHumanizedText = data.result;

      if (approvalOrigText) approvalOrigText.textContent = activeSelectedText;
      if (approvalHumanizedText) approvalHumanizedText.innerHTML = computeWordDiff(activeSelectedText, pendingHumanizedText);
      if (approvalOrigStats) approvalOrigStats.textContent = `${countWords(activeSelectedText)} words`;
      if (approvalHumanizedStats) approvalHumanizedStats.textContent = `${countWords(pendingHumanizedText)} words`;
      if (approvalRerollTone) approvalRerollTone.value = tone;

      if (scientificApprovalModal) scientificApprovalModal.classList.add('open');
      hideFloatingSelection();

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (btnHumanizeSelection) {
        btnHumanizeSelection.disabled = false;
        btnHumanizeSelection.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <span>Humanize Selection</span>
        `;
      }
    }
  }

  if (btnHumanizeSelection) {
    btnHumanizeSelection.addEventListener('click', () => performHumanizeSelection());
  }

  // Accept and Replace In Manuscript
  if (btnAcceptApproval) {
    btnAcceptApproval.addEventListener('click', () => {
      if (!activeSelectionRange || !pendingHumanizedText) {
        showToast('No active selection to replace.', 'error');
        return;
      }

      try {
        const toneUsed = approvalRerollTone ? approvalRerollTone.value : 'PhD';
        
        // Build mark node
        const markNode = document.createElement('mark');
        markNode.className = 'humanized-passage';
        markNode.title = `Humanized with StealthGPT (Super / ${toneUsed})`;
        markNode.textContent = pendingHumanizedText;

        // Perform in-place DOM replacement
        activeSelectionRange.deleteContents();
        activeSelectionRange.insertNode(markNode);

        replacedPassagesCount++;
        if (docReplacedCount) docReplacedCount.textContent = replacedPassagesCount.toString();
        updateManuscriptStats();

        scientificApprovalModal.classList.remove('open');
        hideFloatingSelection();
        window.getSelection()?.removeAllRanges();

        showToast(`Passage replaced with ${toneUsed} humanized phrasing!`, 'success');
      } catch (err) {
        showToast('Failed to replace text in document: ' + err.message, 'error');
      }
    });
  }

  // Discard & Close Approval Modal
  function closeApprovalModal() {
    if (scientificApprovalModal) scientificApprovalModal.classList.remove('open');
    hideFloatingSelection();
  }

  if (btnRejectApproval) btnRejectApproval.addEventListener('click', closeApprovalModal);
  if (btnCloseApproval) btnCloseApproval.addEventListener('click', closeApprovalModal);

  // Re-roll Tone in Approval Modal
  if (btnApprovalReroll) {
    btnApprovalReroll.addEventListener('click', async () => {
      const tone = approvalRerollTone ? approvalRerollTone.value : 'PhD';
      btnApprovalReroll.disabled = true;
      const origHtml = btnApprovalReroll.innerHTML;
      btnApprovalReroll.innerHTML = `<span>Re-rolling...</span>`;

      try {
        const res = await fetch('/api/humanize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: activeSelectedText,
            model: 'super',
            tone: tone,
            writing_mode: 'essay'
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.detail || data.error || 'Regeneration failed');
        }

        pendingHumanizedText = data.result;
        if (approvalHumanizedText) approvalHumanizedText.innerHTML = computeWordDiff(activeSelectedText, pendingHumanizedText);
        if (approvalHumanizedStats) approvalHumanizedStats.textContent = `${countWords(pendingHumanizedText)} words`;
        showToast(`Regenerated passage using ${tone} tone`, 'info');

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnApprovalReroll.disabled = false;
        btnApprovalReroll.innerHTML = origHtml;
      }
    });
  }

  // Export Manuscript as .docx
  if (btnExportDocx) {
    btnExportDocx.addEventListener('click', async () => {
      if (!manuscriptContent || manuscriptContent.querySelector('#manuscript-empty-state')) {
        showToast('Please load or upload a manuscript first.', 'info');
        return;
      }

      btnExportDocx.disabled = true;
      const origBtnText = btnExportDocx.innerHTML;
      btnExportDocx.innerHTML = `<span>Exporting...</span>`;

      try {
        const res = await fetch('/api/document/export-docx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: manuscriptContent.innerHTML,
            filename: 'Scientific_Manuscript_Humanized.docx'
          })
        });

        if (!res.ok) throw new Error('Export failed on server');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Scientific_Manuscript_Humanized.docx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        showToast('Downloaded formatted Word document (.docx)', 'success');
      } catch (err) {
        showToast('Export error: ' + err.message, 'error');
      } finally {
        btnExportDocx.disabled = false;
        btnExportDocx.innerHTML = origBtnText;
      }
    });
  }

  // Copy Entire Manuscript
  if (btnCopyManuscript) {
    btnCopyManuscript.addEventListener('click', async () => {
      if (!manuscriptContent || manuscriptContent.querySelector('#manuscript-empty-state')) {
        showToast('No manuscript loaded to copy.', 'info');
        return;
      }
      try {
        await navigator.clipboard.writeText(manuscriptContent.innerText);
        showToast('Copied full manuscript text to clipboard', 'success');
      } catch (err) {
        showToast('Failed to copy to clipboard', 'error');
      }
    });
  }

  // Initialize
  loadConfig();
  updateInputStats();
  updateManuscriptStats();
});
