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

  // Initialize
  loadConfig();
  updateInputStats();
});
