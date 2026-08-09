const STORAGE_KEY = "risk-fast-check-form";
const STEP_CONFIG_PATH = "assets/steps.json?v=20260713b";
const SUBMIT_WEBHOOK_URL = "https://n8n.megyk.com/webhook/fe28dcfc-b0d2-4c67-b447-c5225b82f8dd";
const VIDEO_AUDIO_PREFERENCE_KEY = "rsc-video-audio-enabled";
const START_STEP = "1";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const REQUIRED_FLOW_KEYS = [
  "real_estate_ownership",
  "securities_ownership",
  "precious_metals_ownership",
  "life_insurance_ownership",
  "bank_savings_ownership",
  "alternative_assets_ownership",
];
const DETAIL_FIELD_BY_OWNERSHIP_FIELD = {
  real_estate_ownership: "real_estate_investment_amount",
  securities_ownership: "securities_investment_amount",
  precious_metals_ownership: "precious_metals_investment_amount",
  life_insurance_ownership: "life_insurance_monthly_payment",
  bank_savings_ownership: "bank_savings_amount",
  alternative_assets_ownership: "alternative_assets_investment_amount",
};
const OUTPUT_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "real_estate_ownership",
  "real_estate_investment_amount",
  "securities_ownership",
  "securities_investment_amount",
  "precious_metals_ownership",
  "precious_metals_investment_amount",
  "life_insurance_ownership",
  "life_insurance_monthly_payment",
  "bank_savings_ownership",
  "bank_savings_amount",
  "alternative_assets_ownership",
  "alternative_assets_investment_amount",
  "feedback",
  "submittedAt",
];

function getState() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setState(nextState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function saveField(name, value) {
  const state = getState();
  state[name] = value;
  setState(state);
}

function readField(name) {
  return getState()[name];
}

function clearState() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function shouldPlayStepVideoWithAudio() {
  try {
    return sessionStorage.getItem(VIDEO_AUDIO_PREFERENCE_KEY) === "true";
  } catch {
    return false;
  }
}

function setStepVideoAudioPreference(enabled) {
  try {
    sessionStorage.setItem(VIDEO_AUDIO_PREFERENCE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage failures and fall back to default muted behavior.
  }
}

function shouldClearState(form) {
  if (isReload()) {
    return true;
  }
  if (form.dataset.step !== START_STEP) {
    return false;
  }
  return true;
}

function shouldReturnToStart(form) {
  return Number(form.dataset.step || START_STEP) > Number(START_STEP) && !readField("real_estate_ownership");
}

function isReload() {
  const [navigation] = performance.getEntriesByType("navigation");
  return navigation ? navigation.type === "reload" : performance.navigation?.type === 1;
}

let vimeoPlayerApiPromise;

function loadVimeoPlayerApi() {
  if (window.Vimeo?.Player) {
    return Promise.resolve(window.Vimeo);
  }

  if (vimeoPlayerApiPromise) {
    return vimeoPlayerApiPromise;
  }

  vimeoPlayerApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector("script[data-vimeo-player-api]");

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.Vimeo), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://player.vimeo.com/api/player.js";
    script.async = true;
    script.dataset.vimeoPlayerApi = "true";
    script.addEventListener("load", () => resolve(window.Vimeo), { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });

  return vimeoPlayerApiPromise;
}

function bindTextFields(form) {
  form.querySelectorAll("input[type='email'], input[type='tel'], input[type='text'], textarea").forEach((field) => {
    const stored = readField(field.name);
    if (typeof stored === "string") {
      field.value = stored;
    } else {
      field.value = "";
    }
    field.setAttribute("autocomplete", "off");
    field.addEventListener("input", () => {
      saveField(field.name, field.value);
      clearFieldError(field);
    });
    field.addEventListener("change", () => {
      saveField(field.name, field.value);
      clearFieldError(field);
    });
  });
}

function bindExclusiveChoices(form) {
  form.querySelectorAll("input[data-group]").forEach((field) => {
    field.type = "radio";
    field.name = field.dataset.group;
    const stored = readField(field.name);
    field.checked = stored === field.value;

    field.addEventListener("change", () => {
      if (field.checked) {
        saveField(field.name, field.value);
        syncOwnershipAndDetailChoice(form, field);
      }
      const wrapper = field.closest("[data-required-group]");
      if (wrapper) {
        wrapper.dataset.invalid = "false";
      }
    });
  });
}

function clearDetailChoice(form, detailFieldName) {
  form.querySelectorAll(`input[data-group="${detailFieldName}"]`).forEach((field) => {
    field.checked = false;
  });
  saveField(detailFieldName, "");
}

function syncOwnershipAndDetailChoice(form, field) {
  const detailFieldName = DETAIL_FIELD_BY_OWNERSHIP_FIELD[field.name];

  if (detailFieldName) {
    if (field.value === "Nein") {
      clearDetailChoice(form, detailFieldName);
    }
    return;
  }

  const ownershipFieldName = Object.keys(DETAIL_FIELD_BY_OWNERSHIP_FIELD)
    .find((name) => DETAIL_FIELD_BY_OWNERSHIP_FIELD[name] === field.name);

  if (ownershipFieldName) {
    const ownershipField = form.querySelector(
      `input[data-group="${ownershipFieldName}"][value="Ja"]`
    );

    if (ownershipField) {
      ownershipField.checked = true;
    }
    saveField(ownershipFieldName, "Ja");
  }
}

function normalizeOwnershipAndDetailChoice(form) {
  Object.entries(DETAIL_FIELD_BY_OWNERSHIP_FIELD).forEach(([ownershipFieldName, detailFieldName]) => {
    const ownershipValue = readField(ownershipFieldName);
    const detailValue = readField(detailFieldName);

    if (ownershipValue === "Nein") {
      clearDetailChoice(form, detailFieldName);
      return;
    }

    if (detailValue) {
      const ownershipField = form.querySelector(
        `input[data-group="${ownershipFieldName}"][value="Ja"]`
      );

      if (ownershipField) {
        ownershipField.checked = true;
      }
      saveField(ownershipFieldName, "Ja");
    }
  });
}

function saveCurrentFormValues(form) {
  form.querySelectorAll("input[type='email'], input[type='tel'], input[type='text'], textarea").forEach((field) => {
    saveField(field.name, field.value);
  });

  form.querySelectorAll("input[type='radio'][data-group]:checked").forEach((field) => {
    saveField(field.name, field.value);
  });
}

function validateRequiredGroups(form) {
  let valid = true;
  form.querySelectorAll("[data-required-group]").forEach((group) => {
    const choices = [...group.querySelectorAll("input[type='checkbox'], input[type='radio']")];
    const anyChecked = choices.some((choice) => choice.checked);
    setGroupValidity(group, anyChecked);
    valid = valid && anyChecked;
  });
  return valid;
}

function setGroupValidity(group, isValid) {
  const error = group.querySelector(".error");
  group.dataset.invalid = isValid ? "false" : "true";
  group.setAttribute("aria-invalid", String(!isValid));
  if (error) {
    if (!error.id) {
      error.id = `${group.dataset.requiredGroup || "choice"}-error`;
    }
    if (isValid) {
      group.removeAttribute("aria-describedby");
    } else {
      group.setAttribute("aria-describedby", error.id);
    }
  }
}

function getDetailChoiceGroup(form, detailFieldName) {
  const choice = form.querySelector(`input[data-group="${detailFieldName}"]`);
  return choice ? choice.closest("fieldset") : null;
}

function setDetailGroupValidity(group, isValid, detailFieldName) {
  if (!group) {
    return;
  }

  let error = group.querySelector(".error");
  if (!error) {
    error = document.createElement("div");
    error.className = "error";
    error.textContent = "Bitte wählen Sie eine Option.";
    group.append(error);
  }
  if (!error.id) {
    error.id = `${detailFieldName}-error`;
  }

  setGroupValidity(group, isValid);
}

function getFieldErrorMessage(field) {
  if (field.validity.valueMissing) {
    return "Bitte füllen Sie dieses Pflichtfeld aus.";
  }
  if (field.validity.typeMismatch) {
    return "Bitte prüfen Sie dieses Feld.";
  }
  return "Bitte prüfen Sie dieses Feld.";
}

function getOrCreateFieldError(field) {
  const wrapper = field.closest(".field");
  if (!wrapper) {
    return null;
  }

  let error = wrapper.querySelector(".error");
  if (!error) {
    error = document.createElement("div");
    error.className = "error";
    wrapper.append(error);
  }
  if (!error.id) {
    error.id = `${field.id || field.name}-error`;
  }
  return error;
}

function clearFieldError(field) {
  const wrapper = field.closest(".field");
  const error = wrapper ? wrapper.querySelector(".error") : null;

  if (field.checkValidity()) {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
    if (wrapper) {
      wrapper.dataset.invalid = "false";
    }
    if (error) {
      error.textContent = "";
    }
  }
}

function validateNativeFields(form) {
  let firstInvalid = null;

  form.querySelectorAll("input[required], textarea[required]").forEach((field) => {
    const isValid = field.checkValidity();
    const wrapper = field.closest(".field");
    const error = getOrCreateFieldError(field);

    if (wrapper) {
      wrapper.dataset.invalid = isValid ? "false" : "true";
    }
    field.setAttribute("aria-invalid", String(!isValid));

    if (error) {
      error.textContent = isValid ? "" : getFieldErrorMessage(field);
      if (!isValid) {
        field.setAttribute("aria-describedby", error.id);
      } else {
        field.removeAttribute("aria-describedby");
      }
    }

    if (!isValid && !firstInvalid) {
      firstInvalid = field;
    }
  });

  return firstInvalid;
}

function validateRequiredGroupFields(form) {
  let firstInvalid = null;

  form.querySelectorAll("[data-required-group]").forEach((group) => {
    const choices = [...group.querySelectorAll("input[type='checkbox'], input[type='radio']")];
    const anyChecked = choices.some((choice) => choice.checked);
    setGroupValidity(group, anyChecked);

    if (!anyChecked && !firstInvalid) {
      firstInvalid = choices[0] || group;
    }
  });

  Object.entries(DETAIL_FIELD_BY_OWNERSHIP_FIELD).forEach(([ownershipFieldName, detailFieldName]) => {
    const ownershipChoice = form.querySelector(
      `input[data-group="${ownershipFieldName}"]:checked`
    );
    const detailGroup = getDetailChoiceGroup(form, detailFieldName);

    if (!ownershipChoice || !detailGroup) {
      return;
    }

    const detailChoices = [...detailGroup.querySelectorAll("input[type='checkbox'], input[type='radio']")];
    const detailIsValid = ownershipChoice.value !== "Ja" || detailChoices.some((choice) => choice.checked);
    setDetailGroupValidity(detailGroup, detailIsValid, detailFieldName);

    if (!detailIsValid && !firstInvalid) {
      firstInvalid = detailChoices[0] || detailGroup;
    }
  });

  return firstInvalid;
}

function showValidationSummary(form, firstInvalid) {
  let summary = form.querySelector("[data-validation-summary]");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "validation-summary";
    summary.setAttribute("data-validation-summary", "");
    summary.setAttribute("role", "alert");
    summary.setAttribute("tabindex", "-1");
    form.prepend(summary);
  }

  summary.textContent = "Bitte füllen Sie alle Pflichtfelder auf dieser Seite aus.";
  summary.classList.add("is-visible");

  if (firstInvalid) {
    firstInvalid.focus({ preventScroll: true });
    firstInvalid.scrollIntoView({ block: "center", behavior: "smooth" });
  } else {
    summary.focus();
  }
}

function showFlowSummary(form) {
  let summary = form.querySelector("[data-validation-summary]");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "validation-summary";
    summary.setAttribute("data-validation-summary", "");
    summary.setAttribute("role", "alert");
    summary.setAttribute("tabindex", "-1");
    form.prepend(summary);
  }

  summary.textContent = "Bitte starten Sie den Risk-Fast-Check erneut auf Seite 1.";
  summary.classList.add("is-visible");
  summary.focus();
}

function clearValidationSummary(form) {
  const summary = form.querySelector("[data-validation-summary]");
  if (summary) {
    summary.classList.remove("is-visible");
    summary.textContent = "";
  }
}

function validateForm(form) {
  const firstInvalidField = validateNativeFields(form);
  const firstInvalidGroup = validateRequiredGroupFields(form);
  const firstInvalid = firstInvalidField || firstInvalidGroup;

  if (firstInvalid) {
    showValidationSummary(form, firstInvalid);
    return false;
  }

  clearValidationSummary(form);
  return true;
}

function hydrateHiddenUtmFields(form) {
  const params = new URLSearchParams(window.location.search);
  UTM_KEYS.forEach((key) => {
    const incoming = params.get(key);
    const field = form.querySelector(`[data-utm="${key}"]`);
    if (!field && incoming && !readField(key)) {
      saveField(key, incoming);
      return;
    }
    if (!field) {
      return;
    }
    if (incoming && !readField(field.name)) {
      field.value = incoming;
      saveField(field.name, incoming);
    } else if (typeof readField(field.name) === "string") {
      field.value = readField(field.name);
    }
  });
}

function getMissingRequiredFlowKeys(state) {
  return REQUIRED_FLOW_KEYS.filter((key) => !state[key]);
}

function buildResultsPayload(state) {
  const payload = {};
  OUTPUT_KEYS.forEach((key) => {
    payload[key] = Object.prototype.hasOwnProperty.call(state, key) ? state[key] : null;
  });
  return payload;
}

async function submitResults(form) {
  saveCurrentFormValues(form);
  const state = getState();
  state.submittedAt = new Date().toISOString();
  setState(state);
  const payload = buildResultsPayload(state);

  const response = await fetch(SUBMIT_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json, text/html, text/plain, */*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook submission failed with status ${response.status}`);
  }

  return response.text();
}

function showSubmissionError(form) {
  let summary = form.querySelector("[data-validation-summary]");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "validation-summary";
    summary.setAttribute("data-validation-summary", "");
    summary.setAttribute("role", "alert");
    summary.setAttribute("tabindex", "-1");
    form.prepend(summary);
  }

  summary.textContent = "Die Übermittlung ist fehlgeschlagen. Bitte versuchen Sie es erneut.";
  summary.classList.add("is-visible");
  summary.focus();
}

function setSubmissionLoading(form, isLoading) {
  const overlay = form.querySelector("[data-submission-overlay]");

  if (!overlay) {
    return;
  }

  overlay.hidden = !isLoading;
  overlay.setAttribute("aria-hidden", String(!isLoading));
  form.setAttribute("aria-busy", String(isLoading));
}

function initAccessibility(form) {
  form.querySelectorAll("input[required], textarea[required]").forEach((field) => {
    field.setAttribute("aria-required", "true");
  });

  form.querySelectorAll("[data-required-group]").forEach((group) => {
    group.setAttribute("aria-required", "true");
    setGroupValidity(group, group.dataset.invalid !== "true");
  });

  form.querySelectorAll(".error").forEach((error) => {
    error.setAttribute("role", "alert");
  });

  const progressBar = document.querySelector(".progress-bar");
  const progressFill = document.querySelector(".progress-fill");
  const progressLabel = document.querySelector(".progress-meta strong");

  if (progressBar && progressFill) {
    const width = Number.parseFloat(progressFill.style.width || "0");
    progressBar.setAttribute("role", "progressbar");
    progressBar.setAttribute("aria-valuemin", "0");
    progressBar.setAttribute("aria-valuemax", "100");
    progressBar.setAttribute("aria-valuenow", String(Number.isFinite(width) ? width : 0));
    if (progressLabel) {
      progressBar.setAttribute("aria-label", `Fortschritt: ${progressLabel.textContent.trim()}`);
    }
  }
}

function bindNavigation(form) {
  const prev = form.querySelector("[data-prev]");
  const next = form.querySelector("[data-next]");

  if (prev) {
    prev.addEventListener("click", () => {
      window.location.href = prev.dataset.prev;
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateForm(form)) {
      return;
    }
    saveCurrentFormValues(form);

    if (next) {
      window.location.href = next.dataset.next;
      return;
    }

    const missingRequiredFlowKeys = getMissingRequiredFlowKeys(getState());
    if (missingRequiredFlowKeys.length) {
      showFlowSummary(form);
      return;
    }

    const submitButton = form.querySelector("button[type='submit']");
    const originalButtonText = submitButton ? submitButton.textContent : "";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Wird übermittelt...";
    }
    setSubmissionLoading(form, true);

    try {
      const html = await submitResults(form);
      clearState();
      document.open();
      document.write(html);
      document.close();
    } catch (error) {
      console.error(error);
      setSubmissionLoading(form, false);
      showSubmissionError(form);
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}

async function renderStepVideo(form) {
  const step = Number(form.dataset.step || 0);
  const slot = form.querySelector("[data-video-slot]");

  if (!slot || !step) {
    return;
  }

  try {
    const response = await fetch(STEP_CONFIG_PATH);
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const config = (payload.steps || []).find((item) => item.step === step);
    if (!config || !config.vimeoId) {
      return;
    }

    const shouldPlayWithAudio = shouldPlayStepVideoWithAudio();
    const requiresFirstPlay = step === 1 && !shouldPlayWithAudio;
    const source = `https://player.vimeo.com/video/${config.vimeoId}?autoplay=${requiresFirstPlay ? 0 : 1}&muted=${shouldPlayWithAudio ? 0 : 1}&title=0&byline=0&portrait=0`;

    slot.innerHTML = `
      <section class="video-card">
        <!--    
        <div class="video-copy">
          <p class="video-kicker">Video</p>
          <p class="video-title">${config.videoTitle || ""}</p>
        </div>
        -->
        <div class="video-frame">
          <iframe
            src="${source}"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen
            title="${config.videoTitle || "Vimeo video"}"></iframe>
          ${requiresFirstPlay ? '<button class="video-start-overlay" type="button">Video mit Ton starten</button>' : ""}
        </div>
      </section>
    `;

    try {
      await loadVimeoPlayerApi();
      const iframe = slot.querySelector("iframe");

      if (!iframe || !window.Vimeo?.Player) {
        return;
      }

      const player = new window.Vimeo.Player(iframe);

      const startOverlay = slot.querySelector(".video-start-overlay");

      if (startOverlay) {
        startOverlay.addEventListener("click", async () => {
          startOverlay.disabled = true;

          try {
            await player.setMuted(false);
            await player.setVolume(1);
            setStepVideoAudioPreference(true);
            await player.play();
            startOverlay.remove();
          } catch {
            startOverlay.disabled = false;
            startOverlay.textContent = "Erneut versuchen";
          }
        });
      }

      player.on("volumechange", (event) => {
        if (event && event.muted === false && Number(event.volume || 0) > 0) {
          setStepVideoAudioPreference(true);
        }
      });

      if (shouldPlayWithAudio) {
        player.play().catch(() => {
          setStepVideoAudioPreference(false);
        });
      }
    } catch {
      // Leave the iframe in place even if the Player API fails to load.
    }
  } catch {
    // Leave the slot empty if the JSON cannot be loaded.
  }
}

function init() {
  const form = document.querySelector("form[data-step]");
  if (!form) {
    return;
  }
  form.setAttribute("autocomplete", "off");
  if (shouldClearState(form)) {
    clearState();
  }
  if (shouldReturnToStart(form)) {
    window.location.href = "step-1.html";
    return;
  }
  renderStepVideo(form);
  initAccessibility(form);
  bindTextFields(form);
  bindExclusiveChoices(form);
  normalizeOwnershipAndDetailChoice(form);
  hydrateHiddenUtmFields(form);
  bindNavigation(form);
}

document.addEventListener("DOMContentLoaded", init);
