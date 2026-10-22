(function () {
  "use strict";

  // Shown when none of our sitters are free on the chosen date.
  // TODO: replace with the other babysitter's phone number.
  const OTHER_SITTER_NUMBER = "PLACEHOLDER NUMBER";

  const SERVICE_LABELS = {
    babysitting: "Babysitting",
    dogs: "Dog walking/sitting",
  };

  const QUESTIONS = {
    date: { title: "What date would you like to book for?" },
    service: { title: "What booking?" },
    children: {
      title: "How many children?",
      kind: "count",
      field: "children",
      max: 20,
      corner: "£5 extra per additional child",
      error: "Please enter how many children (1 to 20).",
    },
    hours: { title: "How many hours?", kind: "hours", field: "hours" },
    allergies: {
      title: "Any allergies?",
      kind: "text",
      field: "allergies",
      placeholder: "e.g. nuts, dairy — leave blank if none",
    },
    extra: {
      title: "Any extra information? e.g. bed times",
      kind: "text",
      field: "extraInfo",
      placeholder: "Bed times, routines, anything we should know",
    },
    dogs: {
      title: "How many dogs?",
      kind: "count",
      field: "dogs",
      max: 10,
      error: "Please enter how many dogs (1 to 10).",
    },
    dogHours: { title: "How long?", kind: "hours", field: "hours" },
    dogExtra: {
      title: "Any extra information?",
      kind: "text",
      field: "extraInfo",
      placeholder: "Walk routes, feeding times, anything we should know",
    },
  };

  const FLOWS = {
    babysitting: ["date", "service", "children", "hours", "allergies", "extra"],
    dogs: ["date", "service", "dogs", "dogHours", "dogExtra"],
  };

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const app = document.getElementById("app");
  const signOutButton = document.getElementById("signout");

  let sb = null;
  let bookings = [];
  let view = "loading";
  let pendingEmail = "";
  let home = { selected: null, year: 0, month: 0 };
  let survey = null;
  let lastBooking = null;

  // ---------- helpers ----------

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dateKey(year, month, day) {
    return year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  }

  function todayKey() {
    const now = new Date();
    return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function parseKey(key) {
    const parts = key.split("-").map(Number);
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  }

  function formatDate(key) {
    const p = parseKey(key);
    return new Date(p.year, p.month, p.day).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function hoursText(hours) {
    const n = Number(hours);
    return n + (n === 1 ? " hour" : " hours");
  }

  function bookingRows(b) {
    const rows = [
      ["Sitter", b.sitter],
      ["Date", formatDate(b.booking_date)],
      ["Booking", SERVICE_LABELS[b.service]],
    ];
    if (b.service === "babysitting") {
      rows.push(["Children", b.children], ["Hours", hoursText(b.hours)], ["Allergies", b.allergies || "None"]);
    } else {
      rows.push(["Dogs", b.dogs], ["How long", hoursText(b.hours)]);
    }
    rows.push(["Extra information", b.extra_info || "None"]);
    return rows;
  }

  function bookingTable(b) {
    return (
      '<table class="booking-table"><tbody>' +
      bookingRows(b)
        .map(function (row) {
          return "<tr><th scope=\"row\">" + esc(row[0]) + "</th><td>" + esc(row[1]) + "</td></tr>";
        })
        .join("") +
      "</tbody></table>"
    );
  }

  function otherSitterNotice(date) {
    const hasDigits = /\d/.test(OTHER_SITTER_NUMBER);
    const number = hasDigits
      ? '<a href="tel:' + esc(OTHER_SITTER_NUMBER.replace(/\s/g, "")) + '">' + esc(OTHER_SITTER_NUMBER) + "</a>"
      : "<strong>" + esc(OTHER_SITTER_NUMBER) + "</strong>";
    return (
      '<div class="app-notice" role="alert">' +
      "<p>Sorry, none of our sitters are free on " + esc(formatDate(date)) + ".</p>" +
      "<p>Here is a number of another babysitter you can contact if you would like: " + number + "</p>" +
      "<p>Or pick a different date above.</p>" +
      "</div>"
    );
  }

  async function accessToken() {
    const result = await sb.auth.getSession();
    return result.data.session ? result.data.session.access_token : null;
  }

  async function api(path, options) {
    const opts = options || {};
    const headers = { "Content-Type": "application/json" };
    const token = await accessToken();
    // Our own header, because the site's password protection uses the Authorization header.
    if (token) headers["X-Supabase-Auth"] = token;
    const response = await fetch(path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    });
    let data = {};
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }
    return { status: response.status, data: data };
  }

  function showError(message) {
    const el = document.getElementById("form-error");
    if (el) {
      el.textContent = message || "";
      el.hidden = !message;
    }
  }

  function setBusy(button, busyText) {
    if (!button) return;
    button.dataset.label = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  }

  function clearBusy(button) {
    if (!button || !button.dataset.label) return;
    button.textContent = button.dataset.label;
    button.disabled = false;
  }

  // ---------- calendar ----------

  function calendar(opts) {
    const first = new Date(opts.year, opts.month, 1);
    const daysInMonth = new Date(opts.year, opts.month + 1, 0).getDate();
    const leadingBlanks = (first.getDay() + 6) % 7; // weeks start on Monday
    const today = todayKey();
    const min = opts.minDate ? parseKey(opts.minDate) : null;
    const atMinMonth = min && opts.year === min.year && opts.month === min.month;

    let cells = WEEKDAYS.map(function (d) {
      return '<span class="cal-weekday">' + d + "</span>";
    }).join("");
    for (let i = 0; i < leadingBlanks; i++) cells += '<span class="cal-blank"></span>';

    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(opts.year, opts.month, day);
      const classes = ["cal-day"];
      if (key === today) classes.push("is-today");
      if (key === opts.selected) classes.push("is-selected");
      if (opts.marked && opts.marked.has(key)) classes.push("is-marked");
      const disabled = opts.minDate && key < opts.minDate;
      cells +=
        '<button type="button" class="' + classes.join(" ") + '" data-cal="' + opts.id + '" data-date="' + key + '"' +
        (disabled ? " disabled" : "") +
        ' aria-label="' + esc(formatDate(key)) + '"' +
        (key === opts.selected ? ' aria-pressed="true"' : "") +
        ">" + day + "</button>";
    }

    return (
      '<div class="cal">' +
      '<div class="cal-head">' +
      '<button type="button" class="cal-nav" data-cal="' + opts.id + '" data-nav="-1" aria-label="Previous month"' +
      (atMinMonth ? " disabled" : "") + ">&#8249;</button>" +
      '<p class="cal-title">' + MONTHS[opts.month] + " " + opts.year + "</p>" +
      '<button type="button" class="cal-nav" data-cal="' + opts.id + '" data-nav="1" aria-label="Next month">&#8250;</button>' +
      "</div>" +
      '<div class="cal-grid">' + cells + "</div>" +
      "</div>"
    );
  }

  function shiftMonth(state, delta) {
    const d = new Date(state.year, state.month + delta, 1);
    state.year = d.getFullYear();
    state.month = d.getMonth();
  }

  // ---------- views ----------

  function render() {
    signOutButton.hidden = !(view === "home" || view === "survey" || view === "result");
    if (view === "loading") app.innerHTML = '<p class="app-loading">Loading…</p>';
    else if (view === "setup") renderSetup();
    else if (view === "signin") renderSignIn();
    else if (view === "code") renderCode();
    else if (view === "home") renderHome();
    else if (view === "survey") renderSurvey();
    else if (view === "result") renderResult();
  }

  function renderSetup() {
    app.innerHTML =
      '<section class="app-card">' +
      "<h1>Bookings opening soon</h1>" +
      "<p>Our booking app is nearly ready. In the meantime, please " +
      '<a href="mailto:home.holiday.help123@gmail.com">email us</a> to book.</p>' +
      "</section>";
  }

  function renderSignIn() {
    app.innerHTML =
      '<section class="app-card">' +
      "<h1>Sign in to book</h1>" +
      "<p>Enter your email address and we'll send you a code to sign in. Your bookings will be saved to your email, so you can see them on any device.</p>" +
      '<form id="signin-form" novalidate>' +
      '<label class="app-label" for="email">Email address</label>' +
      '<input class="app-input" id="email" type="email" autocomplete="email" inputmode="email" required value="' + esc(pendingEmail) + '">' +
      '<p class="form-error" id="form-error" hidden></p>' +
      '<button class="app-btn app-btn-primary" type="submit">Send me a code</button>' +
      "</form>" +
      "</section>";
    document.getElementById("email").focus();
  }

  function renderCode() {
    app.innerHTML =
      '<section class="app-card">' +
      "<h1>Check your email</h1>" +
      "<p>We've sent a sign-in code to <strong>" + esc(pendingEmail) + "</strong>. Type it in below.</p>" +
      '<form id="code-form" novalidate>' +
      '<label class="app-label" for="code">Sign-in code</label>' +
      '<input class="app-input app-input-code" id="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required>' +
      '<p class="form-error" id="form-error" hidden></p>' +
      '<button class="app-btn app-btn-primary" type="submit">Sign in</button>' +
      "</form>" +
      '<p class="app-small"><button type="button" class="app-link" data-action="resend">Send a new code</button> · ' +
      '<button type="button" class="app-link" data-action="change-email">Use a different email</button></p>' +
      "</section>";
    document.getElementById("code").focus();
  }

  function renderHome() {
    const marked = new Set(bookings.map(function (b) { return b.booking_date; }));
    const onDay = bookings.filter(function (b) { return b.booking_date === home.selected; });
    const today = todayKey();
    const upcoming = bookings.filter(function (b) { return b.booking_date >= today; });

    let dayDetail;
    if (onDay.length) {
      dayDetail = onDay.map(function (b) { return '<div class="app-card app-card-tight">' + bookingTable(b) + "</div>"; }).join("");
    } else {
      dayDetail = '<p class="app-muted">Nothing booked on ' + esc(formatDate(home.selected)) + ".</p>";
    }

    let upcomingList;
    if (upcoming.length) {
      upcomingList =
        '<ul class="upcoming">' +
        upcoming
          .map(function (b) {
            return (
              '<li><button type="button" data-action="show-day" data-date="' + b.booking_date + '">' +
              '<span class="upcoming-date">' + esc(formatDate(b.booking_date)) + "</span>" +
              '<span class="upcoming-what">' + esc(SERVICE_LABELS[b.service]) + " with " + esc(b.sitter) + "</span>" +
              "</button></li>"
            );
          })
          .join("") +
        "</ul>";
    } else {
      upcomingList = '<p class="app-muted">You have no upcoming bookings yet.</p>';
    }

    app.innerHTML =
      '<section class="home">' +
      '<div class="home-top"><h1>My bookings</h1>' +
      '<button type="button" class="app-btn app-btn-primary app-btn-big" data-action="start-booking">Book a session</button></div>' +
      '<div class="app-card">' +
      calendar({ id: "home", year: home.year, month: home.month, selected: home.selected, marked: marked }) +
      '<p class="cal-legend"><span class="cal-legend-dot"></span> Booked</p>' +
      "</div>" +
      "<h2>" + esc(formatDate(home.selected)) + "</h2>" +
      dayDetail +
      "<h2>Coming up</h2>" +
      upcomingList +
      "</section>";
  }

  function currentFlow() {
    return FLOWS[survey.answers.service || "babysitting"];
  }

  function renderSurvey() {
    const flow = currentFlow();
    const stepId = flow[survey.step];
    const question = QUESTIONS[stepId];
    const isLast = survey.step === flow.length - 1;
    const progress = survey.answers.service
      ? "Question " + (survey.step + 1) + " of " + flow.length
      : "Question " + (survey.step + 1);
    const a = survey.answers;
    let body = "";
    let showNext = true;

    if (stepId === "date") {
      body =
        calendar({ id: "survey", year: survey.year, month: survey.month, selected: a.date, minDate: todayKey() }) +
        '<p class="chosen-date">' + (a.date ? "You chose <strong>" + esc(formatDate(a.date)) + "</strong>" : "Tap a day to choose it.") + "</p>" +
        (survey.unavailable ? otherSitterNotice(survey.unavailable) : "");
    } else if (stepId === "service") {
      showNext = false;
      body =
        '<div class="service-choices">' +
        '<button type="button" class="service-choice' + (a.service === "babysitting" ? " is-chosen" : "") + '" data-action="choose-service" data-service="babysitting">Babysitting</button>' +
        '<button type="button" class="service-choice' + (a.service === "dogs" ? " is-chosen" : "") + '" data-action="choose-service" data-service="dogs">Dog walking/sitting</button>' +
        "</div>";
    } else if (question.kind === "count") {
      body =
        '<input class="app-input app-input-number" id="answer" type="number" inputmode="numeric" min="1" max="' + question.max + '" step="1" value="' + esc(a[question.field] || "") + '" aria-label="' + esc(question.title) + '">';
    } else if (question.kind === "hours") {
      body =
        '<div class="input-with-unit"><input class="app-input app-input-number" id="answer" type="number" inputmode="decimal" min="0.5" max="24" step="0.5" value="' + esc(a.hours || "") + '" aria-label="' + esc(question.title) + '"><span>hours</span></div>';
    } else if (question.kind === "text") {
      body =
        '<textarea class="app-input app-textarea" id="answer" rows="5" maxlength="1000" placeholder="' + esc(question.placeholder) + '" aria-label="' + esc(question.title) + '">' + esc(a[question.field] || "") + "</textarea>";
    }

    app.innerHTML =
      '<section class="app-card survey' + (question.corner ? " has-corner" : "") + '">' +
      (question.corner ? '<span class="corner-note">' + esc(question.corner) + "</span>" : "") +
      '<p class="survey-progress">' + progress + "</p>" +
      "<h1>" + esc(question.title) + "</h1>" +
      body +
      '<p class="form-error" id="form-error" hidden></p>' +
      '<div class="survey-actions">' +
      '<button type="button" class="app-btn app-btn-secondary" data-action="back">' + (survey.step === 0 ? "Cancel" : "Back") + "</button>" +
      (showNext
        ? '<button type="button" class="app-btn app-btn-primary" data-action="next" id="next-btn">' + (isLast ? "Book" : "Next") + "</button>"
        : "") +
      "</div>" +
      "</section>";

    const input = document.getElementById("answer");
    if (input) input.focus();
  }

  function renderResult() {
    const b = lastBooking;
    app.innerHTML =
      '<section class="app-card result">' +
      '<p class="result-eyebrow">Booking sent!</p>' +
      "<h1>Your sitter is <span class=\"result-sitter\">" + esc(b.sitter) + "</span></h1>" +
      "<p>Here are your booking details. We've sent them to the Home Holiday Help team, and " + esc(b.sitter) + " will be in touch.</p>" +
      bookingTable(b) +
      '<div class="survey-actions">' +
      '<button type="button" class="app-btn app-btn-primary" data-action="go-home">See my bookings</button>' +
      "</div>" +
      "</section>";
  }

  // ---------- actions ----------

  function goHome(selected) {
    const today = todayKey();
    const next = bookings.find(function (b) { return b.booking_date >= today; });
    home.selected = selected || (next ? next.booking_date : today);
    const p = parseKey(home.selected);
    home.year = p.year;
    home.month = p.month;
    view = "home";
    render();
  }

  function startBooking() {
    const now = new Date();
    survey = { step: 0, answers: {}, year: now.getFullYear(), month: now.getMonth(), unavailable: null };
    view = "survey";
    render();
  }

  async function loadBookings() {
    const result = await sb.from("bookings").select("*").order("booking_date", { ascending: true });
    if (result.error) throw result.error;
    bookings = result.data || [];
  }

  async function showSignedIn() {
    view = "loading";
    render();
    try {
      await loadBookings();
    } catch (e) {
      console.error(e);
      bookings = [];
    }
    goHome();
  }

  function saveCurrentAnswer() {
    const flow = currentFlow();
    const question = QUESTIONS[flow[survey.step]];
    const input = document.getElementById("answer");
    if (!input || !question.field) return true;
    const value = input.value.trim();

    if (question.kind === "count") {
      const n = Number(value);
      if (!value || !Number.isInteger(n) || n < 1 || n > question.max) {
        showError(question.error);
        return false;
      }
      survey.answers[question.field] = n;
    } else if (question.kind === "hours") {
      const n = Number(value);
      if (!value || !(n > 0) || n > 24 || !Number.isInteger(n * 2)) {
        showError("Please enter a number of hours, up to 24 (half hours are fine, e.g. 2.5).");
        return false;
      }
      survey.answers.hours = n;
    } else {
      survey.answers[question.field] = value;
    }
    return true;
  }

  async function nextStep(button) {
    const flow = currentFlow();
    const stepId = flow[survey.step];

    if (stepId === "date") {
      if (!survey.answers.date) {
        showError("Please tap a day on the calendar to choose your date.");
        return;
      }
      setBusy(button, "Checking…");
      try {
        const result = await api("/api/availability?date=" + encodeURIComponent(survey.answers.date));
        if (result.status !== 200) throw new Error(result.data.error || "Availability check failed");
        if (!result.data.available) {
          survey.unavailable = survey.answers.date;
          render();
          return;
        }
      } catch (e) {
        clearBusy(button);
        showError("We couldn't check that date just now. Please try again.");
        return;
      }
      survey.unavailable = null;
      survey.step++;
      render();
      return;
    }

    if (!saveCurrentAnswer()) return;

    if (survey.step === flow.length - 1) {
      await submitBooking(button);
      return;
    }
    survey.step++;
    render();
  }

  async function submitBooking(button) {
    const a = survey.answers;
    setBusy(button, "Booking…");
    let result;
    try {
      result = await api("/api/book", {
        method: "POST",
        body: {
          date: a.date,
          service: a.service,
          children: a.children,
          dogs: a.dogs,
          hours: a.hours,
          allergies: a.allergies,
          extraInfo: a.extraInfo,
        },
      });
    } catch (e) {
      clearBusy(button);
      showError("We couldn't send your booking. Please check your connection and try again.");
      return;
    }

    if (result.status === 200) {
      lastBooking = result.data.booking;
      bookings.push(lastBooking);
      bookings.sort(function (x, y) { return x.booking_date < y.booking_date ? -1 : 1; });
      survey = null;
      view = "result";
      render();
    } else if (result.status === 409) {
      // Someone else took the last free sitter: send them back to pick another date.
      survey.unavailable = a.date;
      survey.step = 0;
      render();
    } else if (result.status === 401) {
      await sb.auth.signOut();
    } else {
      clearBusy(button);
      showError(result.data.error || "Something went wrong. Please try again.");
    }
  }

  function previousStep() {
    if (survey.step === 0) {
      survey = null;
      goHome();
      return;
    }
    const flow = currentFlow();
    const input = document.getElementById("answer");
    const question = QUESTIONS[flow[survey.step]];
    if (input && question.kind === "text") survey.answers[question.field] = input.value.trim();
    survey.step--;
    render();
  }

  async function sendCode(email) {
    return sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
  }

  // ---------- events ----------

  app.addEventListener("click", function (event) {
    const target = event.target.closest("button");
    if (!target || target.disabled) return;

    if (target.dataset.nav) {
      const state = target.dataset.cal === "home" ? home : survey;
      shiftMonth(state, Number(target.dataset.nav));
      render();
      return;
    }

    if (target.dataset.date && target.dataset.cal) {
      if (target.dataset.cal === "home") {
        home.selected = target.dataset.date;
      } else {
        survey.answers.date = target.dataset.date;
        survey.unavailable = null;
      }
      render();
      return;
    }

    const action = target.dataset.action;
    if (action === "start-booking") startBooking();
    else if (action === "go-home") goHome(lastBooking && lastBooking.booking_date);
    else if (action === "show-day") goHome(target.dataset.date);
    else if (action === "back") previousStep();
    else if (action === "next") nextStep(target);
    else if (action === "choose-service") {
      survey.answers.service = target.dataset.service;
      survey.step++;
      render();
    } else if (action === "change-email") {
      view = "signin";
      render();
    } else if (action === "resend") {
      setBusy(target, "Sending…");
      sendCode(pendingEmail).then(function (result) {
        clearBusy(target);
        showError(result.error ? result.error.message : "");
        if (!result.error) target.textContent = "Code sent!";
      });
    }
  });

  app.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || view !== "survey" || event.target.tagName === "TEXTAREA") return;
    if (event.target.id === "answer") {
      event.preventDefault();
      const next = document.getElementById("next-btn");
      if (next) next.click();
    }
  });

  app.addEventListener("submit", async function (event) {
    event.preventDefault();
    const button = event.target.querySelector("button[type=submit]");

    if (event.target.id === "signin-form") {
      const email = document.getElementById("email").value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        showError("Please enter a valid email address.");
        return;
      }
      setBusy(button, "Sending…");
      const result = await sendCode(email);
      if (result.error) {
        clearBusy(button);
        showError(result.error.message);
        return;
      }
      pendingEmail = email;
      view = "code";
      render();
    }

    if (event.target.id === "code-form") {
      const code = document.getElementById("code").value.replace(/\s/g, "");
      if (!/^\d{6,10}$/.test(code)) {
        showError("Please enter the code from your email.");
        return;
      }
      setBusy(button, "Signing in…");
      const result = await sb.auth.verifyOtp({ email: pendingEmail, token: code, type: "email" });
      if (result.error) {
        clearBusy(button);
        showError("That code didn't work. Check it and try again, or send a new code.");
      }
      // On success, onAuthStateChange takes over.
    }
  });

  signOutButton.addEventListener("click", function () {
    sb.auth.signOut();
  });

  // ---------- start ----------

  async function start() {
    let config = {};
    try {
      const response = await fetch("/api/config", { credentials: "same-origin" });
      config = await response.json();
    } catch (e) {
      config = {};
    }
    if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
      view = "setup";
      render();
      return;
    }

    sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    let signedIn = false;

    sb.auth.onAuthStateChange(function (event, session) {
      if (session && !signedIn) {
        signedIn = true;
        // Supabase advises against calling it from inside this callback, so wait a tick.
        setTimeout(showSignedIn, 0);
      } else if (!session && signedIn) {
        signedIn = false;
        bookings = [];
        survey = null;
        view = "signin";
        render();
      } else if (!session && view === "loading") {
        view = "signin";
        render();
      }
    });
  }

  start();
})();
