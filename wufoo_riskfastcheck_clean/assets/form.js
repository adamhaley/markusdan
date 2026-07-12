const STORAGE_KEY = "risk-fast-check-form";
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
    field.addEventListener("input", () => saveField(field.name, field.value));
    field.addEventListener("change", () => saveField(field.name, field.value));
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
    group.dataset.invalid = anyChecked ? "false" : "true";
    valid = valid && anyChecked;
  });
  return valid;
}

function validateNativeFields(form) {
  let valid = true;
  form.querySelectorAll("input[required], textarea[required]").forEach((field) => {
    if (!field.reportValidity()) {
      valid = false;
    }
  });
  return valid;
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
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "risk-fast-check-response.json";
  anchor.click();
  URL.revokeObjectURL(url);
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
    const valid = validateNativeFields(form) && validateRequiredGroups(form);
    if (!valid) {
      return;
    }

    if (next) {
      window.location.href = next.dataset.next;
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
  bindTextFields(form);
  bindExclusiveChoices(form);
  hydrateHiddenUtmFields(form);
  bindNavigation(form);
}

document.addEventListener("DOMContentLoaded", init);
