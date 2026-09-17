(() => {
// Variant B: forked from form.js rather than shared, because the branching
// (ownership question and detail question live on separate pages) breaks
// several assumptions form.js makes about combined ownership+detail pages
// (see DETAIL_FIELD_BY_OWNERSHIP_FIELD / syncOwnershipAndDetailChoice).
// Cloning avoids any risk of regressing the live Variant A flow.
const STORAGE_KEY = "risk-fast-check-form-b";
const RESULTS_CACHE_KEY = "risk-fast-check-results-cache-b";
const STEP_CONFIG_PATH = "../assets/steps.json?v=20260713b";
const SUBMIT_WEBHOOK_URL = "https://n8n.megyk.com/webhook/d9e002a0-a764-46be-b4ee-237200be38f9";
const VIDEO_AUDIO_PREFERENCE_KEY = "rsc-video-audio-enabled";
const CONSENT_STORAGE_KEY = "rsc-cookie-consent";
const SHARED_CONSENT_COOKIE = "md_consent";
const PRIVACY_POLICY_URL = "https://markusdan.com/datenschutzerklaerung/";
const VARIANT = "B";
const START_STEP = "1";
const STEP_ORDER = ["1", "1b", "2", "2a", "3", "3a", "4", "4a", "5", "5a", "6", "6a", "7", "7a"];
const AUTO_ADVANCE_DELAY_MS = 400;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const REQUIRED_FLOW_KEYS = [
  "wealth_building_years",
  "wealth_concern",
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
  "variant",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "wealth_building_years",
  "wealth_concern",
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
  const stepIndex = STEP_ORDER.indexOf(form.dataset.step || START_STEP);
  const startIndex = STEP_ORDER.indexOf(START_STEP);
  return stepIndex > startIndex && !readField("wealth_building_years");
}

function isReload() {
  const [navigation] = performance.getEntriesByType("navigation");
  return navigation ? navigation.type === "reload" : performance.navigation?.type === 1;
}

function enforceStepGuard(form) {
  const requiredField = form.dataset.requiresField;
  const requiredValue = form.dataset.requiresValue;
  const redirectTo = form.dataset.requiresRedirect;

  if (!requiredField || !redirectTo) {
    return false;
  }

  if (readField(requiredField) === requiredValue) {
    return false;
  }

  window.location.href = redirectTo;
  return true;
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

function hasCompleteRequiredGroups(form) {
  return [...form.querySelectorAll("[data-required-group]")]
    .every((group) => [...group.querySelectorAll("input[type='checkbox'], input[type='radio']")]
      .some((choice) => choice.checked));
}

function hasCompleteDetailRequirements(form) {
  return Object.entries(DETAIL_FIELD_BY_OWNERSHIP_FIELD).every(([ownershipFieldName, detailFieldName]) => {
    const ownershipChoice = form.querySelector(
      `input[data-group="${ownershipFieldName}"]:checked`
    );
    const detailGroup = getDetailChoiceGroup(form, detailFieldName);

    if (!ownershipChoice || !detailGroup || ownershipChoice.value !== "Ja") {
      return true;
    }

    return [...detailGroup.querySelectorAll("input[type='checkbox'], input[type='radio']")]
      .some((choice) => choice.checked);
  });
}

function hasCompleteNativeRequiredFields(form) {
  return [...form.querySelectorAll("input[required], textarea[required]")]
    .every((field) => field.checkValidity());
}

function isReadyForAutoAdvance(form) {
  return hasCompleteNativeRequiredFields(form)
    && hasCompleteRequiredGroups(form)
    && hasCompleteDetailRequirements(form);
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
  payload.variant = VARIANT;
  return payload;
}

async function submitResults() {
  const state = getState();
  state.submittedAt = new Date().toISOString();
  setState(state);
  const payload = buildResultsPayload(state);
  const eventId = crypto.randomUUID();
  payload.event_id = eventId;

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

  const html = await response.text();
  return { html, eventId };
}

function readCachedResults() {
  try {
    const raw = sessionStorage.getItem(RESULTS_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && parsed.html ? parsed : null;
  } catch {
    return null;
  }
}

function showResultsError(container) {
  let summary = container.querySelector("[data-validation-summary]");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "validation-summary";
    summary.setAttribute("data-validation-summary", "");
    summary.setAttribute("role", "alert");
    summary.setAttribute("tabindex", "-1");
    container.prepend(summary);
  }

  summary.innerHTML = 'Die Übermittlung ist fehlgeschlagen. <a href="schritt-7">Bitte versuchen Sie es erneut.</a>';
  summary.classList.add("is-visible");
  summary.focus();
}

async function initResultsPage(container) {
  const state = getState();
  if (getMissingRequiredFlowKeys(state).length) {
    window.location.href = "schritt-1";
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: "RFCstep_7_view", quiz_variant: VARIANT });

  try {
    const cached = readCachedResults();
    const { html, eventId } = cached || (await submitResults());
    window.dataLayer.push({ event: "generate_lead", event_id: eventId, quiz_variant: VARIANT });
    clearState();
    sessionStorage.removeItem(RESULTS_CACHE_KEY);
    document.open();
    document.write(html);
    document.close();
  } catch (error) {
    console.error(error);
    showResultsError(container);
  }
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
}

function resolveNextUrl(next) {
  if (!next) {
    return undefined;
  }

  if (next.dataset.next) {
    return next.dataset.next;
  }

  const branchField = next.dataset.branchField;
  if (!branchField) {
    return undefined;
  }

  const value = readField(branchField);
  if (value === "Ja") {
    return next.dataset.nextYes;
  }
  if (value === "Nein") {
    return next.dataset.nextNo;
  }
  return undefined;
}

function bindNavigation(form) {
  const prev = form.querySelector("[data-prev]");
  const next = form.querySelector("[data-next], [data-branch-field]");

  if (prev) {
    prev.addEventListener("click", () => {
      window.location.href = prev.dataset.prev;
    });
  }

  if (next) {
    bindAutoAdvance(form, next);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateForm(form)) {
      if (next) {
        setAutoAdvanceState(next, false);
      }
      return;
    }
    saveCurrentFormValues(form);

    const nextUrl = resolveNextUrl(next);
    if (nextUrl) {
      window.location.href = nextUrl;
      return;
    }

    const missingRequiredFlowKeys = getMissingRequiredFlowKeys(getState());
    if (missingRequiredFlowKeys.length) {
      showFlowSummary(form);
      return;
    }

    await prefetchResultsAndNavigate(form);
  });
}

function bindAutoAdvance(form, next) {
  let autoAdvanceTimer;

  form.addEventListener("change", (event) => {
    if (!event.target.matches("input[type='radio'][data-group]")) {
      return;
    }

    window.clearTimeout(autoAdvanceTimer);
    setAutoAdvanceState(next, false);

    if (!isReadyForAutoAdvance(form)) {
      return;
    }

    setAutoAdvanceState(next, true);
    autoAdvanceTimer = window.setTimeout(() => {
      form.requestSubmit();
    }, AUTO_ADVANCE_DELAY_MS);
  });
}

function setAutoAdvanceState(next, isAdvancing) {
  if (!next.dataset.defaultLabel) {
    next.dataset.defaultLabel = next.textContent.trim();
  }

  if (isAdvancing) {
    next.style.minWidth = `${next.getBoundingClientRect().width}px`;
    next.textContent = `${next.dataset.defaultLabel} ...`;
    next.classList.add("is-auto-advancing");
    next.setAttribute("aria-busy", "true");
    next.disabled = true;
    return;
  }

  next.textContent = next.dataset.defaultLabel;
  next.classList.remove("is-auto-advancing");
  next.removeAttribute("aria-busy");
  next.disabled = false;
  next.style.minWidth = "";
}

async function prefetchResultsAndNavigate(form) {
  const submitButton = form.querySelector('button[type="submit"]');
  const originalLabel = submitButton ? submitButton.textContent : "";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Wird geladen …";
  }

  try {
    const { html, eventId } = await submitResults();
    sessionStorage.setItem(RESULTS_CACHE_KEY, JSON.stringify({ html, eventId }));
    window.location.href = "auswertung";
  } catch (error) {
    console.error(error);
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
    showSubmitError(form);
  }
}

function showSubmitError(form) {
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

async function renderStepVideo(form) {
  const step = form.dataset.step;
  const slot = form.querySelector("[data-video-slot]");

  if (!slot || !step) {
    return;
  }

  // Videos disabled per client request, mirroring form.js. Revert to the
  // fetch/render logic below if that ever changes for Variant B too.
  return;
}

function getSharedConsentCookie() {
  try {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + SHARED_CONSENT_COOKIE + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function setSharedConsentCookie(value) {
  try {
    document.cookie =
      SHARED_CONSENT_COOKIE + "=" + encodeURIComponent(value) +
      "; Domain=.markusdan.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure";
  } catch {
    // Ignore cookie failures; the localStorage fallback still applies.
  }
}

function getStoredConsent() {
  const shared = getSharedConsentCookie();
  if (shared === "granted" || shared === "denied") {
    return shared;
  }

  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredConsent(value) {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures; the banner will just show again next visit.
  }
  setSharedConsentCookie(value);
}

function applyConsent(granted) {
  const state = granted ? "granted" : "denied";
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
    });
  }
}

function initConsentBanner() {
  if (getStoredConsent() !== null) {
    return;
  }

  const banner = document.createElement("div");
  banner.className = "consent-banner";
  banner.innerHTML = `
    <p class="consent-banner__text">
      Wir verwenden Cookies, um die Nutzung dieser Seite zu analysieren. Mehr dazu in unserer
      <a href="${PRIVACY_POLICY_URL}" target="_blank" rel="noopener">Datenschutzerklärung</a>.
    </p>
    <div class="consent-banner__actions">
      <button type="button" class="link-button" data-consent="reject">Ablehnen</button>
      <button type="button" class="button" data-consent="accept">Akzeptieren</button>
    </div>
  `;

  banner.addEventListener("click", (event) => {
    const action = event.target.closest("[data-consent]")?.dataset.consent;
    if (!action) {
      return;
    }

    const granted = action === "accept";
    setStoredConsent(granted ? "granted" : "denied");
    applyConsent(granted);
    banner.remove();
  });

  document.body.appendChild(banner);
}

function pushStepViewEvent(form) {
  const step = form.dataset.step;
  if (!step) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: `RFCstep_${step}_view`, quiz_variant: VARIANT });
}

function init() {
  initConsentBanner();

  const resultsContainer = document.querySelector("[data-results-page]");
  if (resultsContainer) {
    initResultsPage(resultsContainer);
    return;
  }

  const form = document.querySelector("form[data-step]");
  if (!form) {
    return;
  }
  form.setAttribute("autocomplete", "off");
  if (shouldClearState(form)) {
    clearState();
    sessionStorage.removeItem(RESULTS_CACHE_KEY);
  }
  if (shouldReturnToStart(form)) {
    window.location.href = "schritt-1";
    return;
  }
  if (enforceStepGuard(form)) {
    return;
  }
  pushStepViewEvent(form);
  hydrateHiddenUtmFields(form);
  renderStepVideo(form);
  initAccessibility(form);
  bindTextFields(form);
  bindExclusiveChoices(form);
  bindNavigation(form);
}

document.addEventListener("DOMContentLoaded", init);
})();
