const STORAGE_KEY = "ai-csv-translator-settings-v1";

const PROVIDERS = {
  openai: {
    label: "OpenAI Compatible",
    defaultBaseUrl: "https://api.openai.com",
    models: [
      { label: "GPT-4o Mini", value: "gpt-4o-mini" },
      { label: "GPT-4o", value: "gpt-4o" },
      { label: "GPT-4.1 Mini", value: "gpt-4.1-mini" },
      { label: "自定义", value: "__custom__" },
    ],
  },
  anthropic: {
    label: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    models: [
      { label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-20241022" },
      { label: "Claude 3.7 Sonnet", value: "claude-3-7-sonnet-latest" },
      { label: "自定义", value: "__custom__" },
    ],
  },
  gemini: {
    label: "Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    models: [
      { label: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
      { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
      { label: "自定义", value: "__custom__" },
    ],
  },
};

const LANGUAGE_MAP = [
  { canonical: "英语", code: "EN", aliases: ["英语", "英文", "英译", "english", "en"] },
  { canonical: "日语", code: "JA", aliases: ["日语", "日文", "日译", "japanese", "ja"] },
  { canonical: "韩语", code: "KO", aliases: ["韩语", "韩文", "朝鲜语", "korean", "ko"] },
  { canonical: "法语", code: "FR", aliases: ["法语", "法文", "french", "fr"] },
  { canonical: "德语", code: "DE", aliases: ["德语", "德文", "german", "de"] },
  { canonical: "西班牙语", code: "ES", aliases: ["西班牙语", "西语", "spanish", "es"] },
  { canonical: "俄语", code: "RU", aliases: ["俄语", "俄文", "russian", "ru"] },
  { canonical: "葡萄牙语", code: "PT", aliases: ["葡萄牙语", "葡语", "portuguese", "pt"] },
  { canonical: "意大利语", code: "IT", aliases: ["意大利语", "意语", "italian", "it"] },
  { canonical: "阿拉伯语", code: "AR", aliases: ["阿拉伯语", "arabic", "ar"] },
  { canonical: "泰语", code: "TH", aliases: ["泰语", "thai", "th"] },
  { canonical: "越南语", code: "VI", aliases: ["越南语", "vietnamese", "vi"] },
];

const INTENT_SYSTEM_PROMPT = `你是一个参数提取助手。用户的输入是一段请求翻译的自然语言指令。
你的任务是准确提取出用户希望翻译成的“目标语言”列表。
输出要求：
请务必只输出一个合法的 JSON 数组，包含所有目标语言的标准化中文名称。不要输出任何其他解释性文本。
示例 1：
用户输入："帮我把这个文件翻译一下，需要英文和法文版"
你的输出：["英语", "法语"]
示例 2：
用户输入："翻译成日韩语"
你的输出：["日语", "韩语"]`;

const TRANSLATION_SYSTEM_PROMPT = `你是一个专业的数据处理与多语种翻译专家。
你将接收到一段 JSON 格式的数据（代表 CSV 文件的一部分）以及需要翻译的目标语言列表。
你的核心任务：
1. 自动分析传入的 JSON 数据，识别出包含“中文”字符的字段（可能有一个或多个）。
2. 将识别出的中文字段内容，分别翻译成指定的目标语言。
3. 保持原有数据结构不变，并在每一条数据对象中，新增翻译后的字段。
4. 新增字段的命名规则为：原字段名_目标语言代码。

处理规则与约束（非常重要）：
- 绝对保真：不要删除或修改原始数据的任何字段和内容。
- 一致性：保持专业、准确、地道的翻译风格。对于相同实体的翻译需保持一致。
- 纯粹输出：你必须且只能输出一个合法的 JSON 数组，该数组包含处理后的所有数据对象。绝不要输出额外解释。
- 目标语言代码请使用以下映射：英语=EN，日语=JA，韩语=KO，法语=FR，德语=DE，西班牙语=ES，俄语=RU，葡萄牙语=PT，意大利语=IT，阿拉伯语=AR，泰语=TH，越南语=VI。`;

const CSV_ENCODING_CANDIDATES = ["utf-8", "gb18030", "gbk", "gb2312", "big5", "utf-16le", "utf-16be"];

const elements = {
  providerSelect: document.querySelector("#providerSelect"),
  modelPresetSelect: document.querySelector("#modelPresetSelect"),
  modelInput: document.querySelector("#modelInput"),
  baseUrlInput: document.querySelector("#baseUrlInput"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  toggleKeyButton: document.querySelector("#toggleKeyButton"),
  batchSizeInput: document.querySelector("#batchSizeInput"),
  concurrencyInput: document.querySelector("#concurrencyInput"),
  retryInput: document.querySelector("#retryInput"),
  clearChatButton: document.querySelector("#clearChatButton"),
  dropzone: document.querySelector("#dropzone"),
  fileInput: document.querySelector("#fileInput"),
  selectedFileCard: document.querySelector("#selectedFileCard"),
  pickFileButton: document.querySelector("#pickFileButton"),
  removeFileButton: document.querySelector("#removeFileButton"),
  messages: document.querySelector("#messages"),
  composer: document.querySelector("#composer"),
  promptInput: document.querySelector("#promptInput"),
  sendButton: document.querySelector("#sendButton"),
  messageTemplate: document.querySelector("#messageTemplate"),
};

const state = {
  settings: loadSettings(),
  selectedFile: null,
  busy: false,
};

initialize();

function initialize() {
  hydrateProviderOptions();
  bindEvents();
  renderSelectedFile();
  renderEmptyState();
}

function bindEvents() {
  elements.providerSelect.addEventListener("change", handleProviderChange);
  elements.modelPresetSelect.addEventListener("change", handleModelPresetChange);

  for (const field of [
    elements.modelInput,
    elements.baseUrlInput,
    elements.apiKeyInput,
    elements.batchSizeInput,
    elements.concurrencyInput,
    elements.retryInput,
  ]) {
    field.addEventListener("input", persistCurrentSettings);
  }

  elements.toggleKeyButton.addEventListener("click", () => {
    const nextType = elements.apiKeyInput.type === "password" ? "text" : "password";
    elements.apiKeyInput.type = nextType;
    elements.toggleKeyButton.textContent = nextType === "password" ? "显示" : "隐藏";
  });

  elements.pickFileButton.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (file) {
      selectFile(file);
    }
  });
  elements.removeFileButton.addEventListener("click", clearSelectedFile);

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.remove("dragover");
    });
  });

  elements.dropzone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (file) {
      selectFile(file);
    }
  });

  elements.composer.addEventListener("submit", handleSubmit);
  elements.promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.composer.requestSubmit();
    }
  });

  elements.clearChatButton.addEventListener("click", () => {
    elements.messages.innerHTML = "";
    renderEmptyState();
  });
}

function hydrateProviderOptions() {
  elements.providerSelect.innerHTML = "";

  Object.entries(PROVIDERS).forEach(([value, provider]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = provider.label;
    if (value === state.settings.provider) {
      option.selected = true;
    }
    elements.providerSelect.append(option);
  });

  hydrateModelOptions(state.settings.provider);
  elements.baseUrlInput.value = state.settings.baseUrl;
  elements.apiKeyInput.value = state.settings.apiKey;
  elements.batchSizeInput.value = state.settings.batchSize;
  elements.concurrencyInput.value = state.settings.concurrency;
  elements.retryInput.value = state.settings.retryLimit;
}

function hydrateModelOptions(providerKey) {
  const provider = PROVIDERS[providerKey];
  elements.modelPresetSelect.innerHTML = "";

  let matchedPreset = provider.models.find((model) => model.value === state.settings.model);
  if (!matchedPreset) {
    matchedPreset = provider.models.at(-1);
  }

  provider.models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.value;
    option.textContent = model.label;
    option.selected = model.value === matchedPreset.value;
    elements.modelPresetSelect.append(option);
  });

  elements.modelInput.value = matchedPreset.value === "__custom__" ? state.settings.model : matchedPreset.value;
  elements.baseUrlInput.value = state.settings.baseUrl || provider.defaultBaseUrl;
}

function handleProviderChange() {
  const provider = elements.providerSelect.value;
  const firstModel = PROVIDERS[provider].models[0]?.value || "";
  state.settings = {
    ...state.settings,
    provider,
    model: firstModel === "__custom__" ? "" : firstModel,
    baseUrl: PROVIDERS[provider].defaultBaseUrl,
  };

  hydrateModelOptions(provider);
  persistSettings(state.settings);
}

function handleModelPresetChange() {
  const preset = elements.modelPresetSelect.value;
  const provider = PROVIDERS[elements.providerSelect.value];
  const chosen = provider.models.find((item) => item.value === preset);
  elements.modelInput.value = chosen?.value === "__custom__" ? state.settings.model || "" : chosen?.value || "";
  persistCurrentSettings();
}

function persistCurrentSettings() {
  const presetValue = elements.modelPresetSelect.value;
  state.settings = {
    provider: elements.providerSelect.value,
    model: presetValue === "__custom__" ? elements.modelInput.value.trim() : presetValue,
    baseUrl: elements.baseUrlInput.value.trim() || PROVIDERS[elements.providerSelect.value].defaultBaseUrl,
    apiKey: elements.apiKeyInput.value.trim(),
    batchSize: clampNumber(elements.batchSizeInput.value, 5, 50, 20),
    concurrency: clampNumber(elements.concurrencyInput.value, 1, 4, 2),
    retryLimit: clampNumber(elements.retryInput.value, 0, 5, 3),
  };

  elements.batchSizeInput.value = state.settings.batchSize;
  elements.concurrencyInput.value = state.settings.concurrency;
  elements.retryInput.value = state.settings.retryLimit;

  persistSettings(state.settings);
}

function selectFile(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    addMessage({
      role: "error",
      text: "仅支持上传 .csv 文件，请重新选择标准的纯文本 CSV。",
    });
    return;
  }

  state.selectedFile = file;
  renderSelectedFile();
}

function clearSelectedFile() {
  state.selectedFile = null;
  elements.fileInput.value = "";
  renderSelectedFile();
}

function renderSelectedFile() {
  if (!state.selectedFile) {
    elements.selectedFileCard.classList.add("hidden");
    elements.removeFileButton.classList.add("hidden");
    elements.selectedFileCard.innerHTML = "";
    return;
  }

  elements.selectedFileCard.classList.remove("hidden");
  elements.removeFileButton.classList.remove("hidden");
  elements.selectedFileCard.innerHTML = `
    <div class="selected-file-main">
      <div class="selected-file-icon">
        <span class="material-symbols-outlined">description</span>
      </div>
      <div>
        <div class="selected-file-name">${escapeHtml(state.selectedFile.name)}</div>
        <div class="selected-file-size">${formatBytes(state.selectedFile.size)}</div>
      </div>
    </div>
    <div class="selected-file-state">
      <span class="state-pill">已就绪</span>
    </div>
  `;
}

function renderEmptyState() {
  if (elements.messages.children.length > 0) {
    return;
  }

  const panel = document.createElement("section");
  panel.className = "empty-state";
  panel.innerHTML = `
    <div class="empty-state-head">
      <h3>准备开始</h3>
      <span class="state-pill">3 Steps</span>
    </div>
    <div class="empty-state-grid">
      <article class="empty-state-cell">
        <span class="material-symbols-outlined">tune</span>
        <strong>配置模型</strong>
        <p>在左侧填写模型、Base URL 和 API Key。</p>
      </article>
      <article class="empty-state-cell">
        <span class="material-symbols-outlined">upload_file</span>
        <strong>上传 CSV</strong>
        <p>支持拖拽或选择文件，适合标准纯文本 CSV。</p>
      </article>
      <article class="empty-state-cell">
        <span class="material-symbols-outlined">translate</span>
        <strong>发送指令</strong>
        <p>直接输入“翻译成英语和日语”即可启动任务。</p>
      </article>
    </div>
  `;
  elements.messages.append(panel);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.busy) {
    return;
  }

  persistCurrentSettings();

  const userPrompt = elements.promptInput.value.trim();
  if (!state.settings.apiKey) {
    addMessage({
      role: "system",
      text: "⚠ 请先在设置区填写对应模型的 API Key。",
    });
    return;
  }

  if (!state.settings.model) {
    addMessage({
      role: "system",
      text: "⚠ 请先填写可用的模型 ID。",
    });
    return;
  }

  if (!userPrompt) {
    addMessage({
      role: "system",
      text: "请输入翻译指令，例如：把这份表格翻译成英语和日语。",
    });
    return;
  }

  if (!state.selectedFile) {
    addMessage({
      role: "system",
      text: "⚠ 请先上传一个 CSV 文件，再发起翻译任务。",
    });
    return;
  }

  removeEmptyState();
  addMessage({
    role: "user",
    text: userPrompt,
    file: {
      name: state.selectedFile.name,
      size: state.selectedFile.size,
    },
  });

  elements.promptInput.value = "";
  state.busy = true;
  updateBusyState();

  const statusMessage = addMessage({
    role: "ai",
    text: "已收到文件，正在解析指令与表格内容，请稍候...",
    streaming: true,
  });

  try {
    const csvText = await readCsvText(state.selectedFile);
    const { rows, headers } = parseCsv(csvText);
    if (!rows.length) {
      throw new AppError("上传的 CSV 没有可处理的数据行。");
    }

    const chineseColumns = detectChineseColumns(rows);
    if (!chineseColumns.length) {
      throw new AppError("在您上传的文件中未检测到中文内容，无需进行翻译。请检查文件是否正确。");
    }

    const targetLanguages = await extractTargetLanguages(userPrompt);
    if (!targetLanguages.length) {
      throw new AppError("我没能从指令中识别出目标语言，请换一种更明确的说法，例如“翻译成英语和日语”。");
    }

    updateMessage(statusMessage, {
      text: `已识别目标语言：${targetLanguages.join("、")}。正在按批次翻译，共 ${rows.length} 行数据。`,
      streaming: true,
    });

    const totalBatches = Math.ceil(rows.length / state.settings.batchSize);
    const progressMessage = addMessage({
      role: "ai",
      text: "翻译任务已启动。",
      progress: {
        current: 0,
        total: totalBatches,
        detail: "正在准备第 1 个批次...",
      },
    });

    const { rows: translatedRows, partialFailure } = await translateInBatches({
      rows,
      targetLanguages,
      chineseColumns,
      progressMessage,
    });

    const resultHeaders = mergeHeaders(headers, translatedRows, chineseColumns, targetLanguages);
    const resultCsv = toCsv(resultHeaders, translatedRows);
    const downloadName = buildDownloadName(state.selectedFile.name);
    const blob = new Blob([resultCsv], { type: "text/csv;charset=utf-8;" });
    const objectUrl = URL.createObjectURL(blob);

    updateMessage(progressMessage, {
      text: "全部批次处理完成，结果文件已经生成。",
      progress: {
        current: totalBatches,
        total: totalBatches,
        detail: `已完成 ${translatedRows.length} 行翻译。`,
      },
      download: {
        url: objectUrl,
        filename: downloadName,
      },
    });

    updateMessage(statusMessage, {
      text: partialFailure
        ? `翻译过程中有部分批次失败，系统已保留原始数据并生成当前结果文件。你可以先下载结果，再稍后重试以补齐遗漏批次。`
        : `翻译完成。新文件已包含原始列与 ${targetLanguages.join("、")} 对应的翻译列，可直接下载。`,
      streaming: true,
    });
  } catch (error) {
    const message = normalizeError(error);
    updateMessage(statusMessage, {
      role: "error",
      text: message,
      streaming: false,
    });
  } finally {
    state.busy = false;
    updateBusyState();
  }
}

async function extractTargetLanguages(userPrompt) {
  try {
    const response = await callProvider({
      systemPrompt: INTENT_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0,
      maxOutputTokens: 300,
    });

    return normalizeLanguages(parseJsonArray(response));
  } catch (error) {
    const fallback = extractLanguagesLocally(userPrompt);
    if (fallback.length) {
      return fallback;
    }
    throw error;
  }
}

async function translateInBatches({ rows, targetLanguages, chineseColumns, progressMessage }) {
  const batches = chunk(rows, state.settings.batchSize);
  const results = new Array(batches.length);
  let completed = 0;
  let partialFailure = false;

  await runWithConcurrency(
    batches.map((batch, index) => async () => {
      const startRow = index * state.settings.batchSize + 1;
      const endRow = startRow + batch.length - 1;

      updateMessage(progressMessage, {
        progress: {
          current: completed,
          total: batches.length,
          detail: `正在翻译第 ${startRow}-${endRow} 行...`,
        },
      });

      try {
        const translated = await retry(async () => {
          const prompt = `目标语言：${JSON.stringify(targetLanguages, null, 2)}\n数据：\n${JSON.stringify(batch, null, 2)}`;
          const response = await callProvider({
            systemPrompt: TRANSLATION_SYSTEM_PROMPT,
            userPrompt: prompt,
            temperature: 0.2,
            maxOutputTokens: Math.max(2000, batch.length * 600),
          });
          const parsed = parseJsonArray(response);
          if (!Array.isArray(parsed) || parsed.length !== batch.length) {
            throw new AppError("模型返回的批次数据结构异常。");
          }
          return reconcileTranslatedBatch(batch, parsed, chineseColumns, targetLanguages);
        }, state.settings.retryLimit);

        results[index] = translated;
      } catch (error) {
        partialFailure = true;
        results[index] = batch.map((row) => ({ ...row }));
      } finally {
        completed += 1;
        updateMessage(progressMessage, {
          progress: {
            current: completed,
            total: batches.length,
            detail:
              completed === batches.length
                ? partialFailure
                  ? "部分批次失败，已保留原始数据并生成可下载结果。"
                  : "所有批次已成功完成。"
                : `已完成 ${completed}/${batches.length} 个批次。`,
          },
        });
      }
    }),
    state.settings.concurrency,
  );

  return {
    rows: results.flat(),
    partialFailure,
  };
}

async function callProvider({ systemPrompt, userPrompt, temperature = 0, maxOutputTokens = 2000 }) {
  const { provider, model, baseUrl, apiKey } = state.settings;
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  if (provider === "openai") {
    const response = await fetch(`${cleanBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxOutputTokens,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              systemPrompt === INTENT_SYSTEM_PROMPT
                ? `${userPrompt}\n\n请返回 JSON 数组，并用 {"languages":[...]} 这种对象格式包裹。`
                : `${userPrompt}\n\n请只返回 {"rows":[...]} 这种 JSON 对象。`,
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError(extractApiError(payload) || "OpenAI 接口调用失败。");
    }

    return payload.choices?.[0]?.message?.content || "";
  }

  if (provider === "anthropic") {
    const response = await fetch(`${cleanBaseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        temperature,
        max_tokens: Math.min(maxOutputTokens, 8192),
        messages: [
          {
            role: "user",
            content:
              systemPrompt === INTENT_SYSTEM_PROMPT
                ? `${userPrompt}\n\n请只输出 {"languages":[...]}。`
                : `${userPrompt}\n\n请只输出 {"rows":[...]}。`,
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError(extractApiError(payload) || "Anthropic 接口调用失败。");
    }

    return payload.content?.map((item) => item.text || "").join("") || "";
  }

  if (provider === "gemini") {
    const url = `${cleanBaseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature,
          maxOutputTokens: Math.min(maxOutputTokens, 8192),
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  systemPrompt === INTENT_SYSTEM_PROMPT
                    ? `${userPrompt}\n\n请只输出 {"languages":[...]}。`
                    : `${userPrompt}\n\n请只输出 {"rows":[...]}。`,
              },
            ],
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError(extractApiError(payload) || "Gemini 接口调用失败。");
    }

    return payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  }

  throw new AppError("未支持的模型服务商。");
}

function parseJsonArray(rawText) {
  const parsed = safeParseJson(rawText);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && Array.isArray(parsed.languages)) {
    return parsed.languages;
  }
  if (parsed && Array.isArray(parsed.rows)) {
    return parsed.rows;
  }
  throw new AppError("模型返回内容不是预期的 JSON 数组。");
}

function safeParseJson(rawText) {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      return JSON.parse(fenced.trim());
    }

    const objectMatch = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new AppError("模型返回内容无法解析为 JSON。");
  }
}

function normalizeLanguages(values) {
  const normalized = [];
  values.forEach((value) => {
    const text = String(value).trim();
    const match = LANGUAGE_MAP.find((language) =>
      language.aliases.some((alias) => alias.toLowerCase() === text.toLowerCase()),
    );
    if (match && !normalized.includes(match.canonical)) {
      normalized.push(match.canonical);
    }
  });
  return normalized;
}

function getLanguageDefinition(value) {
  const text = String(value).trim();
  return LANGUAGE_MAP.find(
    (language) =>
      language.canonical === text ||
      language.code === text.toUpperCase() ||
      language.aliases.some((alias) => alias.toLowerCase() === text.toLowerCase()),
  );
}

function extractLanguagesLocally(prompt) {
  const text = prompt.toLowerCase();
  const normalized = [];
  LANGUAGE_MAP.forEach((language) => {
    if (language.aliases.some((alias) => text.includes(alias.toLowerCase()))) {
      normalized.push(language.canonical);
    }
  });
  return normalized;
}

function detectChineseColumns(rows) {
  const columns = new Set();
  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (containsChinese(value)) {
        columns.add(key);
      }
    });
  });
  return [...columns];
}

function containsChinese(value) {
  return /[\u3400-\u9fff]/.test(String(value ?? ""));
}

async function readCsvText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const bomEncoding = detectBomEncoding(bytes);

  if (bomEncoding) {
    const text = decodeBytes(bytes, bomEncoding, true);
    if (looksLikeCsvText(text)) {
      return text;
    }
  }

  let bestResult = null;
  for (const encoding of CSV_ENCODING_CANDIDATES) {
    const text = decodeBytes(bytes, encoding, false);
    if (!text) {
      continue;
    }

    const score = scoreDecodedCsv(text, encoding);
    if (!bestResult || score > bestResult.score) {
      bestResult = { encoding, text, score };
    }
  }

  if (bestResult?.text && looksLikeCsvText(bestResult.text)) {
    return bestResult.text;
  }

  throw new AppError("抱歉，文件解析失败，请确保您上传的是标准 CSV，并尽量使用 UTF-8、GB18030、GBK、GB2312、Big5 或 UTF-16 编码。");
}

function detectBomEncoding(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return "utf-8";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return "utf-16le";
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return "utf-16be";
  }
  return null;
}

function decodeBytes(bytes, encoding, fatal) {
  try {
    const decoder = new TextDecoder(encoding, { fatal });
    return decoder.decode(bytes);
  } catch (error) {
    return "";
  }
}

function looksLikeCsvText(text) {
  const normalized = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    return false;
  }

  const lineCount = normalized.split(/\r\n|\n|\r/).filter(Boolean).length;
  const delimiterHits = (normalized.match(/[,;\t]/g) || []).length;
  return lineCount >= 1 && normalized.length >= 2 && (delimiterHits > 0 || lineCount > 1);
}

function scoreDecodedCsv(text, encoding) {
  const normalized = String(text || "").replace(/^\uFEFF/, "");
  if (!normalized) {
    return Number.NEGATIVE_INFINITY;
  }

  const lineCount = normalized.split(/\r\n|\n|\r/).filter(Boolean).length;
  const commaCount = (normalized.match(/,/g) || []).length;
  const tabCount = (normalized.match(/\t/g) || []).length;
  const chineseCount = (normalized.match(/[\u3400-\u9fff]/g) || []).length;
  const replacementCount = (normalized.match(/\uFFFD/g) || []).length;
  const controlCount = (normalized.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g) || []).length;
  const mojibakeCount = (normalized.match(/[锟�鈥�闂�銆�]/g) || []).length;
  const suspiciousSeqCount = (normalized.match(/Ã.|Â.|Ð.|¤|�/g) || []).length;
  const printableCount = (normalized.match(/[^\s]/g) || []).length;

  let score = 0;
  score += Math.min(lineCount, 30) * 6;
  score += Math.min(commaCount, 200) * 2.2;
  score += Math.min(tabCount, 120) * 2;
  score += Math.min(chineseCount, 120) * 1.4;
  score += Math.min(printableCount, 500) * 0.05;
  score -= replacementCount * 25;
  score -= controlCount * 12;
  score -= mojibakeCount * 10;
  score -= suspiciousSeqCount * 6;

  if (encoding === "utf-8") {
    score += 3;
  }
  if ((encoding === "gb18030" || encoding === "gbk" || encoding === "gb2312") && chineseCount > 0) {
    score += 4;
  }

  return score;
}

function parseCsv(text) {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const rawRows = [];
  let current = "";
  let record = [];
  let insideQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];
    const nextChar = normalizedText[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      record.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      record.push(current);
      current = "";
      if (record.some((value) => value !== "")) {
        rawRows.push(record);
      }
      record = [];
      continue;
    }

    current += char;
  }

  if (current !== "" || record.length) {
    record.push(current);
    rawRows.push(record);
  }

  if (!rawRows.length) {
    throw new AppError("抱歉，文件解析失败，请确保您上传的是标准的纯文本 CSV 格式文件。");
  }

  const hasHeader = hasLikelyHeader(rawRows);
  const columnCount = rawRows[0].length;
  const headers = hasHeader
    ? rawRows[0].map((header, index) => normalizeHeader(header, index))
    : Array.from({ length: columnCount }, (_, index) => inferFallbackHeader(columnCount, index));
  const bodyRows = hasHeader ? rawRows.slice(1) : rawRows;
  const dataRows = bodyRows.map((row) =>
    headers.reduce((entry, header, index) => {
      entry[header] = row[index] ?? "";
      return entry;
    }, {}),
  );

  return { headers, rows: dataRows };
}

function hasLikelyHeader(rows) {
  if (rows.length < 2) {
    return true;
  }

  const [firstRow, ...restRows] = rows;
  const sampleRows = restRows.slice(0, 5).filter((row) => row.length === firstRow.length);
  if (!sampleRows.length) {
    return true;
  }

  if (
    firstRow.length === 1 &&
    isSentenceLikeCell(firstRow[0]) &&
    sampleRows.every((row) => isSentenceLikeCell(row[0]))
  ) {
    return false;
  }

  let headerVotes = 0;
  let dataVotes = 0;

  firstRow.forEach((cell, columnIndex) => {
    const current = String(cell ?? "").trim();
    const sampleValues = sampleRows.map((row) => String(row[columnIndex] ?? "").trim()).filter(Boolean);
    if (!current || !sampleValues.length) {
      return;
    }

    if (isHeaderLikeCell(current) && sampleValues.some((value) => !isHeaderLikeCell(value))) {
      headerVotes += 1;
      return;
    }

    if (isSentenceLikeCell(current) && sampleValues.every((value) => isSentenceLikeCell(value))) {
      dataVotes += 2;
      return;
    }

    const currentType = classifyCell(current);
    const sampleTypes = sampleValues.map(classifyCell);
    const sameTypeCount = sampleTypes.filter((type) => type === currentType).length;

    if (sameTypeCount >= Math.ceil(sampleTypes.length * 0.6)) {
      dataVotes += 1;
    } else {
      headerVotes += 1;
    }
  });

  if (dataVotes > headerVotes) {
    return false;
  }

  return true;
}

function normalizeHeader(value, index) {
  const text = String(value ?? "").trim();
  return text || inferFallbackHeader(0, index);
}

function inferFallbackHeader(columnCount, index) {
  if (columnCount === 1) {
    return "原文";
  }
  return `column_${index + 1}`;
}

function isHeaderLikeCell(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return false;
  }

  if (/^[A-Za-z_][A-Za-z0-9_\-\s]{0,30}$/.test(text)) {
    return true;
  }

  return /^[\u3400-\u9fffA-Za-z0-9_（）()\-]{1,20}$/.test(text) && !/[。？！；，、：“”"']/.test(text);
}

function isSentenceLikeCell(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return false;
  }

  if (/[。？！；，、]/.test(text)) {
    return true;
  }

  return containsChinese(text) && text.length >= 6;
}

function classifyCell(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "empty";
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    return "number";
  }
  if (isSentenceLikeCell(text)) {
    return "sentence";
  }
  if (isHeaderLikeCell(text)) {
    return "identifier";
  }
  if (containsChinese(text)) {
    return "chinese";
  }
  if (/[A-Za-z]/.test(text)) {
    return "latin";
  }
  return "other";
}

function toCsv(headers, rows) {
  const lines = [headers.map(escapeCsvValue).join(",")];
  rows.forEach((row) => {
    const values = headers.map((header) => escapeCsvValue(row[header] ?? ""));
    lines.push(values.join(","));
  });
  return `\uFEFF${lines.join("\r\n")}`;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function mergeHeaders(originalHeaders, rows, chineseColumns = [], targetLanguages = []) {
  const seen = new Set(originalHeaders);
  const merged = [...originalHeaders];

  for (const column of chineseColumns) {
    for (const language of targetLanguages) {
      const definition = getLanguageDefinition(language);
      if (!definition) {
        continue;
      }
      const translationKey = `${column}_${definition.code}`;
      if (!seen.has(translationKey)) {
        seen.add(translationKey);
        merged.push(translationKey);
      }
    }
  }

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(key);
      }
    });
  });
  return merged;
}

function buildDownloadName(filename) {
  const dotIndex = filename.lastIndexOf(".");
  const basename = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  return `${basename}_translated.csv`;
}

function reconcileTranslatedBatch(sourceBatch, translatedBatch, chineseColumns, targetLanguages) {
  const expectedFields = buildExpectedTranslationFields(chineseColumns, targetLanguages);

  const mergedRows = sourceBatch.map((sourceRow, index) => {
    const translatedRow = isPlainObject(translatedBatch[index]) ? translatedBatch[index] : {};
    const outputRow = { ...sourceRow };

    for (const field of expectedFields) {
      const translatedValue = pickTranslatedValue(translatedRow, field);
      if (translatedValue !== undefined) {
        outputRow[field.outputKey] = translatedValue;
      }
    }

    return outputRow;
  });

  const translatedCellCount = mergedRows.reduce((count, row) => {
    return count + expectedFields.filter((field) => field.outputKey in row).length;
  }, 0);

  if (expectedFields.length > 0 && translatedCellCount === 0) {
    throw new AppError("模型返回成功，但没有产出任何可识别的翻译列。");
  }

  return mergedRows;
}

function buildExpectedTranslationFields(chineseColumns, targetLanguages) {
  const fields = [];

  for (const column of chineseColumns) {
    for (const language of targetLanguages) {
      const definition = getLanguageDefinition(language);
      if (!definition) {
        continue;
      }

      const candidateKeys = new Set([
        `${column}_${definition.code}`,
        `${column}_${definition.code.toLowerCase()}`,
        `${column}_${definition.canonical}`,
      ]);

      definition.aliases.forEach((alias) => {
        candidateKeys.add(`${column}_${alias}`);
        candidateKeys.add(`${column}_${alias.toUpperCase()}`);
      });

      fields.push({
        column,
        language: definition.canonical,
        code: definition.code,
        outputKey: `${column}_${definition.code}`,
        candidateKeys: [...candidateKeys],
      });
    }
  }

  return fields;
}

function pickTranslatedValue(translatedRow, field) {
  for (const key of field.candidateKeys) {
    const value = translatedRow[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return undefined;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function runWithConcurrency(tasks, concurrency) {
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (queue.length) {
      const task = queue.shift();
      if (task) {
        await task();
      }
    }
  });
  await Promise.all(workers);
}

async function retry(task, retryLimit) {
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= retryLimit) {
        throw error;
      }
      attempt += 1;
      await delay(800 * attempt);
    }
  }
}

function addMessage({ role, text, file, progress, download, streaming = false }) {
  const node = elements.messageTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add(role);
  node.querySelector(".message-meta").textContent = formatRole(role);
  node._messageData = { role, text, file, progress, download, streaming };
  elements.messages.append(node);
  applyMessageContent(node, node._messageData);
  scrollMessagesToBottom();
  return node;
}

function updateMessage(node, patch) {
  node._messageData = {
    ...(node._messageData || {}),
    ...patch,
  };
  const role =
    node._messageData.role ||
    [...node.classList].find((className) => ["user", "ai", "system", "error"].includes(className)) ||
    "ai";
  node.classList.remove("user", "ai", "system", "error");
  node.classList.add(role);
  node.querySelector(".message-meta").textContent = formatRole(role);
  applyMessageContent(node, node._messageData);
  scrollMessagesToBottom();
}

function applyMessageContent(node, { text, file, progress, download, streaming }) {
  const bubble = node.querySelector(".message-bubble");
  const blocks = [];

  if (text) {
    blocks.push(`<div class="message-text">${escapeHtml(text)}</div>`);
  }

  if (file) {
    blocks.push(`
      <section class="file-chip">
        <div class="card-head">
          <div class="card-icon">
            <span class="material-symbols-outlined">draft</span>
          </div>
          <div>
            <strong>${escapeHtml(file.name)}</strong>
            <span class="message-subtle">${formatBytes(file.size)}</span>
          </div>
        </div>
      </section>
    `);
  }

  if (progress) {
    const percent = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
    blocks.push(`
      <section class="progress-card">
        <div class="progress-head">
          <div>
            <strong>${progress.detail || "处理中..."}</strong>
            <span class="message-subtle">${progress.current}/${progress.total} 批次</span>
          </div>
          <span class="state-pill">${percent}%</span>
        </div>
        <div class="progress-line"><span style="width: ${percent}%"></span></div>
        <div class="progress-stats">
          <div class="progress-stat">
            <span>已完成</span>
            <b>${progress.current}</b>
          </div>
          <div class="progress-stat">
            <span>总批次</span>
            <b>${progress.total}</b>
          </div>
          <div class="progress-stat">
            <span>状态</span>
            <b>${percent === 100 ? "Done" : "Running"}</b>
          </div>
        </div>
      </section>
    `);
  }

  if (download) {
    blocks.push(`
      <section class="download-card">
        <div class="card-head">
          <div class="card-icon">
            <span class="material-symbols-outlined">download_done</span>
          </div>
          <div>
            <strong>${escapeHtml(download.filename)}</strong>
            <span class="message-subtle">翻译结果已就绪，点击即可下载。</span>
          </div>
        </div>
        <div style="margin-top: 12px;">
          <a class="download-button" href="${download.url}" download="${escapeHtml(download.filename)}">下载结果 CSV</a>
        </div>
      </section>
    `);
  }

  bubble.innerHTML = blocks.join("");

  if (streaming && text) {
    const textNode = bubble.querySelector(".message-text");
    animateText(textNode, text);
  }
}

function animateText(node, text) {
  if (!node) {
    return;
  }

  if (node._typingTimer) {
    window.clearInterval(node._typingTimer);
  }

  const source = text;
  const step = Math.max(2, Math.round(source.length / 36));
  let index = 0;
  node.textContent = "";

  node._typingTimer = window.setInterval(() => {
    index = Math.min(source.length, index + step);
    node.textContent = source.slice(0, index);
    if (index >= source.length) {
      window.clearInterval(node._typingTimer);
      node._typingTimer = null;
    }
  }, 18);
}

function scrollMessagesToBottom() {
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function updateBusyState() {
  elements.sendButton.disabled = state.busy;
  elements.pickFileButton.disabled = state.busy;
  elements.removeFileButton.disabled = state.busy;
  elements.promptInput.disabled = state.busy;
}

function removeEmptyState() {
  const empty = elements.messages.querySelector(".empty-state");
  if (empty) {
    empty.remove();
  }
}

function formatRole(role) {
  if (role === "user") {
    return "你";
  }
  if (role === "system") {
    return "系统";
  }
  if (role === "error") {
    return "错误";
  }
  return "AI 助手";
}

function extractApiError(payload) {
  return payload?.error?.message || payload?.message || payload?.error?.details?.[0]?.message || "";
}

function normalizeError(error) {
  if (error instanceof AppError) {
    return error.message;
  }

  const message = String(error?.message || error || "");
  if (message.includes("Failed to fetch")) {
    return "接口请求失败，可能是 API Key、Base URL 或浏览器跨域限制导致。请检查模型配置后重试。";
  }
  return message || "翻译过程中出现未知错误，请稍后重试。";
}

function loadSettings() {
  const defaults = {
    provider: "openai",
    model: "gpt-4o-mini",
    baseUrl: PROVIDERS.openai.defaultBaseUrl,
    apiKey: "",
    batchSize: 10,
    concurrency: 1,
    retryLimit: 3,
  };

  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaults,
      ...cached,
    };
  } catch (error) {
    return defaults;
  }
}

function persistSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

class AppError extends Error {}
