const STORAGE_KEY = "risk-fast-check-form";
const SUBMISSION_KEY = "risk-fast-check-submitted";
const STEP_CONFIG_PATH = "assets/steps.json";

function getState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function saveField(name, value) {
  const state = getState();
  state[name] = value;
  setState(state);
}

function readField(name) {
  return getState()[name];
}

function bindTextFields(form) {
  form.querySelectorAll("input[type='email'], input[type='tel'], input[type='text'], textarea").forEach((field) => {
    const stored = readField(field.name);
    if (typeof stored === "string") {
      field.value = stored;
    }
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
    const stored = readField(field.name);
    field.checked = Boolean(stored);

    field.addEventListener("change", () => {
      const groupName = field.dataset.group;
      const siblings = form.querySelectorAll(`input[data-group="${groupName}"]`);
      if (field.checked) {
        siblings.forEach((sibling) => {
          if (sibling !== field) {
            sibling.checked = false;
            saveField(sibling.name, false);
          }
        });
      }
      saveField(field.name, field.checked);
      const wrapper = field.closest("[data-required-group]");
      if (wrapper) {
        wrapper.dataset.invalid = "false";
      }
    });
  });
}

function validateRequiredGroups(form) {
  let valid = true;
  form.querySelectorAll("[data-required-group]").forEach((group) => {
    const choices = [...group.querySelectorAll("input[type='checkbox']")];
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
  if (field.validity.typeMismatch && field.type === "email") {
    return "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
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
    const choices = [...group.querySelectorAll("input[type='checkbox']")];
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
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
    const field = form.querySelector(`[data-utm="${key}"]`);
    if (!field) {
      return;
    }
    const incoming = params.get(key);
    if (incoming && !readField(field.name)) {
      field.value = incoming;
      saveField(field.name, incoming);
    } else if (typeof readField(field.name) === "string") {
      field.value = readField(field.name);
    }
  });
}

function downloadResults() {
  const state = getState();
  state.submittedAt = new Date().toISOString();
  setState(state);
  localStorage.setItem(SUBMISSION_KEY, JSON.stringify({ submittedAt: state.submittedAt }));
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "risk-fast-check-response.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function getSubmissionState() {
  try {
    return JSON.parse(localStorage.getItem(SUBMISSION_KEY) || "null");
  } catch {
    return null;
  }
}

function markAlreadySubmitted(form) {
  const submitted = getSubmissionState();
  if (!submitted) {
    return;
  }

  const submit = form.querySelector("button[type='submit']:not([data-next])");
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Bereits übermittelt";
  }

  let status = form.querySelector(".status");
  if (!status) {
    status = document.createElement("div");
    status.className = "status";
    form.append(status);
  }
  status.textContent = "Dieses lokale Demo-Formular wurde bereits übermittelt.";
  const reset = document.createElement("button");
  reset.className = "link-button status-action";
  reset.type = "button";
  reset.textContent = "Neue Sitzung starten";
  reset.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SUBMISSION_KEY);
    window.location.href = "step-1.html";
  });
  status.append(reset);
  status.classList.add("is-visible");
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateForm(form)) {
      return;
    }

    if (next) {
      window.location.href = next.dataset.next;
      return;
    }

    if (getSubmissionState()) {
      markAlreadySubmitted(form);
      return;
    }

    downloadResults();
    const status = form.querySelector(".status");
    if (status) {
      status.classList.add("is-visible");
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
  renderStepVideo(form);
  initAccessibility(form);
  bindTextFields(form);
  bindExclusiveChoices(form);
  hydrateHiddenUtmFields(form);
  bindNavigation(form);
  markAlreadySubmitted(form);
}

document.addEventListener("DOMContentLoaded", init);
