const STORAGE_KEY = "risk-fast-check-form";
const STEP_CONFIG_PATH = "assets/steps.json?v=20260713b";
const SUBMIT_WEBHOOK_URL = "https://n8n.megyk.com/webhook/fe28dcfc-b0d2-4c67-b447-c5225b82f8dd";
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
      }
      const wrapper = field.closest("[data-required-group]");
      if (wrapper) {
        wrapper.dataset.invalid = "false";
      }
    });
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

  return response;
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

    try {
      await submitResults(form);
      const status = form.querySelector(".status");
      if (status) {
        status.classList.add("is-visible");
      }
      clearState();
    } catch (error) {
      console.error(error);
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

    const source = `https://player.vimeo.com/video/${config.vimeoId}?title=0&byline=0&portrait=0`;

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
        </div>
      </section>
    `;
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
  hydrateHiddenUtmFields(form);
  bindNavigation(form);
}

document.addEventListener("DOMContentLoaded", init);
