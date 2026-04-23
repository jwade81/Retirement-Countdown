/*
  Wade 37417 Retirement Dashboard
  --------------------------------
  This file handles:
  - localStorage-backed settings
  - countdown and pension calculations
  - settings slide-over behavior
  - month-by-month timeline matrix rendering
  - service worker registration
*/

const STORAGE_KEY = "wade37417-retirement-dashboard";

const DEFAULT_SETTINGS = {
  title: "Wade 37417",
  hireDate: "2010-08-01",
  dropDate: "2030-08-01",
  retirementDate: "2035-08-01",
  theme: "matrix"
};

const PENSION_TABLE = {
  20: 50,
  21: 53,
  22: 56,
  23: 59,
  24: 62,
  25: 65,
  26: 68,
  27: 71,
  28: 74,
  29: 77,
  30: 81,
  31: 84,
  32: 87,
  33: 90
};

const elements = {
  appShell: document.querySelector(".app-shell"),
  appTitle: document.getElementById("appTitle"),
  titleInput: document.getElementById("titleInput"),
  hireDateInput: document.getElementById("hireDateInput"),
  dropDateInput: document.getElementById("dropDateInput"),
  retirementDateInput: document.getElementById("retirementDateInput"),
  themeInput: document.getElementById("themeInput"),
  setFiveYearsButton: document.getElementById("setFiveYearsButton"),
  resetButton: document.getElementById("resetButton"),
  dashboardTabButton: document.getElementById("dashboardTabButton"),
  settingsTabButton: document.getElementById("settingsTabButton"),
  closeSettingsButton: document.getElementById("closeSettingsButton"),
  settingsBackdrop: document.getElementById("settingsBackdrop"),
  settingsPanel: document.getElementById("settingsPanel"),
  statusValue: document.getElementById("statusValue"),
  heroBadge: document.getElementById("heroBadge"),
  mainCountdownNumber: document.getElementById("mainCountdownNumber"),
  countdownDetailed: document.getElementById("countdownDetailed"),
  countdownWeeks: document.getElementById("countdownWeeks"),
  countdownMonths: document.getElementById("countdownMonths"),
  dropCountdown: document.getElementById("dropCountdown"),
  todayDate: document.getElementById("todayDate"),
  dropDateDisplay: document.getElementById("dropDateDisplay"),
  retirementDateDisplay: document.getElementById("retirementDateDisplay"),
  dropProgressLabel: document.getElementById("dropProgressLabel"),
  retirementProgressLabel: document.getElementById("retirementProgressLabel"),
  dropProgressFill: document.getElementById("dropProgressFill"),
  retirementProgressFill: document.getElementById("retirementProgressFill"),
  pensionTitle: document.getElementById("pensionTitle"),
  pensionPercent: document.getElementById("pensionPercent"),
  pensionContext: document.getElementById("pensionContext"),
  pensionFormulaNote: document.getElementById("pensionFormulaNote"),
  serviceToday: document.getElementById("serviceToday"),
  serviceAtDrop: document.getElementById("serviceAtDrop"),
  milestoneGrid: document.getElementById("milestoneGrid"),
  retirementMessage: document.getElementById("retirementMessage"),
  timelineMatrix: document.getElementById("timelineMatrix"),
  timelineSummary: document.getElementById("timelineSummary"),
  timelineSubtitle: document.getElementById("timelineSubtitle"),
  legendComplete: document.getElementById("legendComplete"),
  legendDropComplete: document.getElementById("legendDropComplete"),
  legendActive: document.getElementById("legendActive"),
  legendDropFuture: document.getElementById("legendDropFuture")
};

let appState = loadSettings();
let countdownTicker = null;
let settingsOpen = false;

init();

function init() {
  bindEvents();
  applySettingsToForm(appState);
  applyTheme(appState.theme);
  renderApp();
  startTicker();
  registerServiceWorker();
}

function bindEvents() {
  elements.titleInput.addEventListener("input", handleSettingsChange);
  elements.hireDateInput.addEventListener("input", handleSettingsChange);
  elements.dropDateInput.addEventListener("input", handleSettingsChange);
  elements.retirementDateInput.addEventListener("input", handleSettingsChange);
  elements.themeInput.addEventListener("change", handleSettingsChange);

  elements.setFiveYearsButton.addEventListener("click", () => {
    const dropDate = parseDateString(elements.dropDateInput.value);
    if (!dropDate) {
      window.alert("Add a DROP date first.");
      return;
    }

    const fiveYearsLater = addYears(dropDate, 5);
    elements.retirementDateInput.value = formatDateForInput(fiveYearsLater);
    handleSettingsChange();
  });

  elements.resetButton.addEventListener("click", () => {
    appState = { ...DEFAULT_SETTINGS };
    applySettingsToForm(appState);
    persistSettings(appState);
    applyTheme(appState.theme);
    renderApp();
  });

  elements.dashboardTabButton.addEventListener("click", () => closeSettingsPanel());
  elements.settingsTabButton.addEventListener("click", () => toggleSettingsPanel(true));
  elements.closeSettingsButton.addEventListener("click", () => closeSettingsPanel());
  elements.settingsBackdrop.addEventListener("click", () => closeSettingsPanel());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && settingsOpen) {
      closeSettingsPanel();
    }
  });
}

function handleSettingsChange() {
  appState = {
    title: elements.titleInput.value.trim() || DEFAULT_SETTINGS.title,
    hireDate: elements.hireDateInput.value,
    dropDate: elements.dropDateInput.value,
    retirementDate: elements.retirementDateInput.value,
    theme: elements.themeInput.value
  };

  persistSettings(appState);
  applyTheme(appState.theme);
  renderApp();
}

function renderApp() {
  const hireDate = parseDateString(appState.hireDate);
  const dropDate = parseDateString(appState.dropDate);
  const retirementDate = parseDateString(appState.retirementDate);
  const now = new Date();
  const today = startOfDay(now);

  elements.appTitle.textContent = appState.title || DEFAULT_SETTINGS.title;
  document.title = appState.title || DEFAULT_SETTINGS.title;

  elements.todayDate.textContent = formatFullDate(today);
  elements.dropDateDisplay.textContent = dropDate ? formatFullDate(dropDate) : "Not set";
  elements.retirementDateDisplay.textContent = retirementDate ? formatFullDate(retirementDate) : "Not set";

  if (!hireDate || !dropDate || !retirementDate) {
    renderIncompleteState();
    return;
  }

  const validationMessages = validateDateOrder(hireDate, dropDate, retirementDate);
  if (validationMessages.length > 0) {
    renderValidationState(validationMessages);
    return;
  }

  const overallStatus = getStatus(today, dropDate, retirementDate);
  const retirementCountdown = getCountdownParts(now, retirementDate);
  const dropCountdown = getCountdownParts(now, dropDate);
  const totalRetirementDays = getDayDifference(today, retirementDate);
  const totalDropDays = getDayDifference(today, dropDate);
  const yearsToday = getElapsedYearsDecimal(hireDate, today);
  const yearsAtDrop = getElapsedYearsDecimal(hireDate, dropDate);

  elements.statusValue.textContent = overallStatus;
  elements.heroBadge.textContent = overallStatus === "RETIRED" ? "Mission Complete" : "Final Retirement";

  elements.mainCountdownNumber.textContent = overallStatus === "RETIRED"
    ? "DONE"
    : Math.max(totalRetirementDays, 0).toLocaleString();
  elements.countdownDetailed.textContent = overallStatus === "RETIRED"
    ? "Retirement date has passed."
    : formatCountdownParts(retirementCountdown);
  elements.countdownWeeks.textContent = overallStatus === "RETIRED"
    ? "--"
    : formatWeeks(totalRetirementDays);
  elements.countdownMonths.textContent = overallStatus === "RETIRED"
    ? "--"
    : formatMonths(now, retirementDate);
  elements.dropCountdown.textContent = dropCountdown.expired
    ? "DROP reached"
    : `${Math.max(totalDropDays, 0).toLocaleString()} days`;
  elements.retirementMessage.hidden = overallStatus !== "RETIRED";

  elements.serviceToday.textContent = `${yearsToday.toFixed(2)} years`;
  elements.serviceAtDrop.textContent = `${yearsAtDrop.toFixed(2)} years`;

  const pensionData = getPensionData({ hireDate, dropDate, today });
  elements.pensionTitle.textContent = pensionData.title;
  elements.pensionPercent.textContent = `${pensionData.percent}%`;
  elements.pensionContext.textContent = pensionData.context;
  elements.pensionFormulaNote.textContent = pensionData.note;

  updateProgress(elements.dropProgressFill, elements.dropProgressLabel, getProgressPercent(hireDate, dropDate, today));
  updateProgress(elements.retirementProgressFill, elements.retirementProgressLabel, getProgressPercent(hireDate, retirementDate, today));

  renderTimelineMatrix({ hireDate, dropDate, retirementDate, today, status: overallStatus });
  renderMilestones({
    today,
    dropDate,
    retirementDate,
    totalRetirementDays,
    status: overallStatus,
    yearsToday,
    yearsAtDrop
  });
}

function renderIncompleteState() {
  elements.statusValue.textContent = "SETUP";
  elements.heroBadge.textContent = "Awaiting Dates";
  elements.mainCountdownNumber.textContent = "--";
  elements.countdownDetailed.textContent = "Add your dates in Settings.";
  elements.countdownWeeks.textContent = "--";
  elements.countdownMonths.textContent = "--";
  elements.dropCountdown.textContent = "--";
  elements.pensionTitle.textContent = "Current Pension %";
  elements.pensionPercent.textContent = "--";
  elements.pensionContext.textContent = "Add hire, DROP, and retirement dates to calculate your timeline.";
  elements.pensionFormulaNote.textContent = "Service pension formula begins at 20 years of service.";
  elements.serviceToday.textContent = "--";
  elements.serviceAtDrop.textContent = "--";
  elements.retirementMessage.hidden = true;
  updateProgress(elements.dropProgressFill, elements.dropProgressLabel, 0);
  updateProgress(elements.retirementProgressFill, elements.retirementProgressLabel, 0);
  renderEmptyTimeline("Each square = 1 month", "Add your dates in Settings to build the service grid.");
  elements.milestoneGrid.innerHTML = `
    <article class="milestone-chip">
      <span class="metric-label">Next step</span>
      <strong>Open Settings</strong>
      <span class="support-copy">Add your three dates to activate the dashboard.</span>
    </article>
  `;
}

function renderValidationState(messages) {
  elements.statusValue.textContent = "CHECK";
  elements.heroBadge.textContent = "Date Order";
  elements.mainCountdownNumber.textContent = "--";
  elements.countdownDetailed.textContent = "Please review your dates in Settings.";
  elements.countdownWeeks.textContent = "--";
  elements.countdownMonths.textContent = "--";
  elements.dropCountdown.textContent = "--";
  elements.pensionTitle.textContent = "Current Pension %";
  elements.pensionPercent.textContent = "--";
  elements.pensionContext.textContent = "The current date sequence is preventing calculations.";
  elements.pensionFormulaNote.textContent = "Recommended order: hire date, then DROP date, then final retirement date.";
  elements.serviceToday.textContent = "--";
  elements.serviceAtDrop.textContent = "--";
  elements.retirementMessage.hidden = true;
  updateProgress(elements.dropProgressFill, elements.dropProgressLabel, 0);
  updateProgress(elements.retirementProgressFill, elements.retirementProgressLabel, 0);
  renderEmptyTimeline("Each square = 1 month", "Correct the date order to render the service grid.");
  elements.milestoneGrid.innerHTML = messages
    .map((message) => createMilestoneCard("Date Warning", "Review Needed", message, "warning"))
    .join("");
}

function renderTimelineMatrix({ hireDate, dropDate, retirementDate, today, status }) {
  const months = buildMonthTimeline(hireDate, retirementDate);
  const dropMonth = startOfMonth(dropDate);
  const currentMonth = startOfMonth(today);
  const markerMonth = getTimelineMarkerMonth(status, currentMonth, retirementDate);

  elements.timelineSummary.textContent = `${months.length.toLocaleString()} months total`;
  updateTimelineLegend(status);
  elements.timelineSubtitle.textContent = getTimelineSubtitle(status);

  const fragment = document.createDocumentFragment();

  months.forEach((monthDate) => {
    const cell = document.createElement("div");
    const isCurrentMarker = monthDate.getTime() === markerMonth.getTime();
    cell.className = `timeline-cell ${getTimelineCellClass(monthDate, currentMonth, dropMonth, status)}${isCurrentMarker ? " current-marker" : ""}`;
    cell.title = formatMonthLabel(monthDate);
    fragment.appendChild(cell);
  });

  elements.timelineMatrix.replaceChildren(fragment);
}

function renderEmptyTimeline(summary, subtitle) {
  elements.timelineSummary.textContent = summary;
  elements.timelineSubtitle.textContent = subtitle;
  updateTimelineLegend("ACTIVE");

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 48; index += 1) {
    const cell = document.createElement("div");
    cell.className = "timeline-cell empty";
    fragment.appendChild(cell);
  }
  elements.timelineMatrix.replaceChildren(fragment);
}

function buildMonthTimeline(startDate, endDate) {
  const months = [];
  let cursor = startOfMonth(startDate);
  const endMonth = startOfMonth(endDate);

  while (cursor <= endMonth) {
    months.push(new Date(cursor.getTime()));
    cursor = addMonths(cursor, 1);
  }

  return months;
}

function getTimelineCellClass(monthDate, currentMonth, dropMonth, status) {
  if (status === "RETIRED") {
    return "future-complete";
  }

  if (monthDate < dropMonth) {
    return monthDate < currentMonth ? "complete" : "active";
  }

  if (status === "ACTIVE") {
    return "drop-future";
  }

  return monthDate < currentMonth ? "drop-complete" : "active";
}

function getTimelineMarkerMonth(status, currentMonth, retirementDate) {
  if (status === "RETIRED") {
    return startOfMonth(retirementDate);
  }

  return currentMonth;
}

function updateTimelineLegend(status) {
  if (status === "DROP") {
    elements.legendComplete.textContent = "Pre-DROP Service";
    elements.legendDropComplete.textContent = "Completed DROP";
    elements.legendActive.textContent = "Remaining DROP";
    elements.legendDropFuture.textContent = "DROP Window";
    return;
  }

  if (status === "RETIRED") {
    elements.legendComplete.textContent = "Career Complete";
    elements.legendDropComplete.textContent = "DROP Complete";
    elements.legendActive.textContent = "Finalized";
    elements.legendDropFuture.textContent = "Timeline Locked";
    return;
  }

  elements.legendComplete.textContent = "Completed Service";
  elements.legendDropComplete.textContent = "Completed DROP";
  elements.legendActive.textContent = "Remaining Until DROP";
  elements.legendDropFuture.textContent = "Future DROP Months";
}

function getTimelineSubtitle(status) {
  if (status === "DROP") {
    return "Each square represents one month. Dim squares show pre-DROP service, mid-tone squares show completed DROP, and bright squares show remaining DROP months.";
  }

  if (status === "RETIRED") {
    return "Each square represents one month from hire date through final retirement. The full career grid is complete.";
  }

  return "Each square represents one month from hire date through final retirement. Bright squares mark the path to DROP, with the later DROP block staged separately.";
}

function renderMilestones({ today, dropDate, retirementDate, totalRetirementDays, status, yearsToday, yearsAtDrop }) {
  const milestoneCards = [];

  milestoneCards.push(createMilestoneCard("Years Today", `${yearsToday.toFixed(2)} years`, "Current completed service."));
  milestoneCards.push(createMilestoneCard("Years at DROP", `${yearsAtDrop.toFixed(2)} years`, "Estimated service when DROP begins."));
  milestoneCards.push(createMilestoneCard("Status", status === "RETIRED" ? "Retired" : status, status === "DROP" ? "Current date is inside the DROP window." : "Live status based on today's date.", status === "RETIRED" ? "celebrate" : status === "DROP" ? "alert" : ""));

  [1000, 500, 100].forEach((targetDays) => {
    const label = `${targetDays} Day Signal`;

    if (status === "RETIRED") {
      milestoneCards.push(createMilestoneCard(label, "Passed", "This milestone is already behind you."));
      return;
    }

    if (totalRetirementDays > targetDays) {
      milestoneCards.push(createMilestoneCard(label, "Ahead", `${(totalRetirementDays - targetDays).toLocaleString()} days until this marker.`));
    } else if (totalRetirementDays === targetDays) {
      milestoneCards.push(createMilestoneCard(label, "Today", "Exactly on this milestone today.", "alert"));
    } else {
      milestoneCards.push(createMilestoneCard(label, "Reached", `${Math.abs(totalRetirementDays - targetDays).toLocaleString()} days ago.`));
    }
  });

  if (status !== "RETIRED") {
    const daysToDrop = getDayDifference(today, dropDate);
    if (daysToDrop >= 0) {
      milestoneCards.push(createMilestoneCard("DROP Marker", `${daysToDrop.toLocaleString()} days`, "Days remaining until DROP entry."));
    } else {
      milestoneCards.push(createMilestoneCard("DROP Marker", "In DROP", "DROP date has already been reached.", "alert"));
    }
  }

  elements.milestoneGrid.innerHTML = milestoneCards.join("");
}

function createMilestoneCard(label, value, description, extraClass = "") {
  return `
    <article class="milestone-chip ${extraClass}">
      <span class="metric-label">${label}</span>
      <strong>${value}</strong>
      <span class="support-copy">${description}</span>
    </article>
  `;
}

function getPensionData({ hireDate, dropDate, today }) {
  const alreadyInDrop = today >= dropDate;
  const serviceDateForCurrent = alreadyInDrop ? dropDate : today;
  const serviceYearsWhole = Math.floor(getElapsedYearsDecimal(hireDate, serviceDateForCurrent));
  const dropEntryWholeYears = Math.floor(getElapsedYearsDecimal(hireDate, dropDate));
  const serviceYearsDecimal = getElapsedYearsDecimal(hireDate, serviceDateForCurrent);
  const currentPercent = getPensionPercentForYears(serviceYearsWhole);
  const dropPercent = getPensionPercentForYears(dropEntryWholeYears);

  if (alreadyInDrop) {
    return {
      title: "Locked DROP Pension %",
      percent: dropPercent,
      context: `DROP reached. Pension percentage is locked using ${dropEntryWholeYears} years of service at DROP entry.`,
      note: dropEntryWholeYears < 20
        ? "DROP entry occurred before 20 years, so service pension has not reached the published stage table."
        : "Once DROP starts, this display remains fixed at the DROP-entry percentage."
    };
  }

  if (serviceYearsWhole < 20) {
    const eligibilityProgress = clamp((serviceYearsDecimal / 20) * 100, 0, 100);
    return {
      title: "Current Pension %",
      percent: currentPercent,
      context: `You currently have ${serviceYearsWhole} full years of service. Progress toward 20-year eligibility is ${eligibilityProgress.toFixed(1)}%. Projected DROP pension is ${dropPercent}% at ${dropEntryWholeYears} full years.`,
      note: "Service pension formula begins at 20 years of service. Until then, use this as a planning indicator only."
    };
  }

  return {
    title: "Current Pension %",
    percent: currentPercent,
    context: `Current calculation uses ${serviceYearsWhole} full years of service. Projected DROP pension is ${dropPercent}% at ${dropEntryWholeYears} full years.`,
    note: "Pension percentage is capped at 90% based on the provided Tier 5 schedule."
  };
}

function getPensionPercentForYears(years) {
  if (years < 20) {
    return 0;
  }

  if (years >= 33) {
    return 90;
  }

  return PENSION_TABLE[years] || 0;
}

function getStatus(today, dropDate, retirementDate) {
  if (today >= retirementDate) {
    return "RETIRED";
  }

  if (today >= dropDate) {
    return "DROP";
  }

  return "ACTIVE";
}

function validateDateOrder(hireDate, dropDate, retirementDate) {
  const messages = [];

  if (dropDate < hireDate) {
    messages.push("DROP date is earlier than the hire date.");
  }

  if (retirementDate < dropDate) {
    messages.push("Final retirement date is earlier than the DROP date.");
  }

  if (retirementDate < hireDate) {
    messages.push("Final retirement date is earlier than the hire date.");
  }

  return messages;
}

function getProgressPercent(startDate, endDate, currentDate) {
  const total = endDate.getTime() - startDate.getTime();
  const completed = currentDate.getTime() - startDate.getTime();

  if (total <= 0) {
    return 100;
  }

  return clamp((completed / total) * 100, 0, 100);
}

function updateProgress(fillElement, labelElement, percent) {
  fillElement.style.width = `${percent.toFixed(2)}%`;
  labelElement.textContent = `${percent.toFixed(1)}%`;
}

function getCountdownParts(fromDateTime, toDate) {
  const target = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 0, 0, 0, 0);
  const diffMs = target.getTime() - fromDateTime.getTime();

  if (diffMs <= 0) {
    return {
      expired: true,
      years: 0,
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0
    };
  }

  let cursor = new Date(fromDateTime.getTime());
  let years = 0;
  let months = 0;

  while (true) {
    const next = new Date(cursor.getTime());
    next.setFullYear(next.getFullYear() + 1);
    if (next <= target) {
      years += 1;
      cursor = next;
    } else {
      break;
    }
  }

  while (true) {
    const next = new Date(cursor.getTime());
    next.setMonth(next.getMonth() + 1);
    if (next <= target) {
      months += 1;
      cursor = next;
    } else {
      break;
    }
  }

  let remainingMs = target.getTime() - cursor.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const secondMs = 1000;

  const days = Math.floor(remainingMs / dayMs);
  remainingMs -= days * dayMs;
  const hours = Math.floor(remainingMs / hourMs);
  remainingMs -= hours * hourMs;
  const minutes = Math.floor(remainingMs / minuteMs);
  remainingMs -= minutes * minuteMs;
  const seconds = Math.floor(remainingMs / secondMs);

  return { expired: false, years, months, days, hours, minutes, seconds };
}

function formatCountdownParts(parts) {
  if (parts.expired) {
    return "Reached";
  }

  return `${parts.years}y ${parts.months}m ${parts.days}d ${parts.hours}h ${parts.minutes}m ${parts.seconds}s`;
}

function getElapsedYearsDecimal(startDate, endDate) {
  const msPerYear = 365.2425 * 24 * 60 * 60 * 1000;
  return Math.max((endDate.getTime() - startDate.getTime()) / msPerYear, 0);
}

function getDayDifference(fromDate, toDate) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.ceil((startOfDay(toDate).getTime() - startOfDay(fromDate).getTime()) / dayMs);
}

function formatWeeks(days) {
  if (days < 0) {
    return "--";
  }

  return `${(days / 7).toFixed(1)} weeks`;
}

function formatMonths(fromDateTime, toDate) {
  const target = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 0, 0, 0, 0);
  const diffMs = target.getTime() - fromDateTime.getTime();
  if (diffMs <= 0) {
    return "--";
  }

  const averageMonthMs = 30.4375 * 24 * 60 * 60 * 1000;
  return `${(diffMs / averageMonthMs).toFixed(1)} months`;
}

function formatFullDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short"
  }).format(date);
}

function parseDateString(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addYears(date, yearsToAdd) {
  const newDate = new Date(date.getTime());
  newDate.setFullYear(newDate.getFullYear() + yearsToAdd);
  return newDate;
}

function addMonths(date, monthsToAdd) {
  const nextDate = new Date(date.getTime());
  nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
  return nextDate;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toggleSettingsPanel(forceOpen) {
  settingsOpen = typeof forceOpen === "boolean" ? forceOpen : !settingsOpen;
  updateSettingsPanelState();
}

function closeSettingsPanel() {
  settingsOpen = false;
  updateSettingsPanelState();
}

function updateSettingsPanelState() {
  elements.settingsBackdrop.hidden = !settingsOpen;
  elements.settingsPanel.hidden = !settingsOpen;
  elements.settingsPanel.setAttribute("aria-hidden", String(!settingsOpen));
  elements.settingsTabButton.setAttribute("aria-expanded", String(settingsOpen));
  elements.dashboardTabButton.classList.toggle("is-active", !settingsOpen);
  elements.settingsTabButton.classList.toggle("is-active", settingsOpen);
  elements.dashboardTabButton.setAttribute("aria-pressed", String(!settingsOpen));
  elements.appShell.classList.toggle("panel-open", settingsOpen);

  if (settingsOpen) {
    window.setTimeout(() => elements.titleInput.focus(), 50);
  }
}

function applyTheme(themeName) {
  document.body.classList.toggle("theme-minimal", themeName === "minimal");
  const themeColor = themeName === "minimal" ? "#091018" : "#041109";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", themeColor);
}

function applySettingsToForm(settings) {
  elements.titleInput.value = settings.title;
  elements.hireDateInput.value = settings.hireDate;
  elements.dropDateInput.value = settings.dropDate;
  elements.retirementDateInput.value = settings.retirementDate;
  elements.themeInput.value = settings.theme;
}

function persistSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

function startTicker() {
  clearInterval(countdownTicker);
  countdownTicker = window.setInterval(renderApp, 1000);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    });
  }
}
