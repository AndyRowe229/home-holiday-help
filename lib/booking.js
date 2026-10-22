import { isValidDate, todayInLondon } from "./schedule.js";

export const SERVICE_LABELS = {
  babysitting: "Babysitting",
  dogs: "Dog walking/sitting",
};

const MAX_TEXT = 1000;

function wholeNumber(value, min, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function hoursValue(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 24 && Number.isInteger(n * 2) ? n : null;
}

function text(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
}

// Checks the survey answers and returns either { error } or { booking } ready to save.
export function parseBooking(body) {
  const input = body || {};
  if (!isValidDate(input.date)) return { error: "Please choose a valid date." };
  if (input.date < todayInLondon()) return { error: "Please choose a date that hasn't passed." };
  if (!SERVICE_LABELS[input.service]) return { error: "Please choose a type of booking." };

  const hours = hoursValue(input.hours);
  if (hours === null) return { error: "Please enter how many hours (up to 24, in half hours)." };

  const booking = {
    booking_date: input.date,
    service: input.service,
    hours,
    extra_info: text(input.extraInfo),
    children: null,
    dogs: null,
    allergies: null,
  };

  if (input.service === "babysitting") {
    booking.children = wholeNumber(input.children, 1, 20);
    if (booking.children === null) return { error: "Please enter how many children (1 to 20)." };
    booking.allergies = text(input.allergies);
  } else {
    booking.dogs = wholeNumber(input.dogs, 1, 10);
    if (booking.dogs === null) return { error: "Please enter how many dogs (1 to 10)." };
  }

  return { booking };
}

export function formatDate(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Rows shown in the booking table, in order.
export function bookingRows(booking) {
  const rows = [
    ["Sitter", booking.sitter],
    ["Date", formatDate(booking.booking_date)],
    ["Booking", SERVICE_LABELS[booking.service]],
  ];
  if (booking.service === "babysitting") {
    rows.push(["Children", booking.children], ["Hours", booking.hours], ["Allergies", booking.allergies || "None"]);
  } else {
    rows.push(["Dogs", booking.dogs], ["How long (hours)", booking.hours]);
  }
  rows.push(["Extra information", booking.extra_info || "None"]);
  return rows;
}
