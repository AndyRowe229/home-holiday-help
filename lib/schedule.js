// Who is free when, and who gets offered each kind of booking.
// Keep this in step with the availability shown on public/booking.html.

export const SITTERS = ["Sienna", "Lyla", "Sophie"];

// Usual term-time availability. 0 = Sunday, 1 = Monday ... 6 = Saturday.
export const WEEKLY_AVAILABILITY = {
  Sienna: [1, 2, 5, 6],
  Lyla: [0, 1, 6],
  Sophie: [],
};

// School holidays (including the weekends either side), when all three sitters are free.
// Dates from Surrey County Council's 2026 to 2027 term dates.
export const SCHOOL_HOLIDAYS = [
  { name: "October half term", from: "2026-10-17", to: "2026-11-01" },
  { name: "Christmas", from: "2026-12-19", to: "2027-01-03" },
  { name: "February half term", from: "2027-02-13", to: "2027-02-21" },
  { name: "Easter", from: "2027-03-26", to: "2027-04-11" },
  { name: "May half term", from: "2027-05-29", to: "2027-06-06" },
  { name: "Summer", from: "2027-07-29", to: "2027-08-31" },
];

// Order sitters are offered each type of booking.
// Lyla mostly babysits and is only offered dog bookings when nobody else is free.
export const PREFERENCE = {
  babysitting: ["Lyla", "Sienna", "Sophie"],
  dogs: ["Sophie", "Sienna", "Lyla"],
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(date) {
  if (typeof date !== "string" || !DATE_PATTERN.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function todayInLondon() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

export function isSchoolHoliday(date) {
  return SCHOOL_HOLIDAYS.some((holiday) => date >= holiday.from && date <= holiday.to);
}

export function sittersFreeOn(date) {
  if (isSchoolHoliday(date)) return [...SITTERS];
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return SITTERS.filter((sitter) => WEEKLY_AVAILABILITY[sitter].includes(weekday));
}

// Sitters who could take this booking, best first. Each sitter takes one booking per day.
export function candidates(date, service, alreadyBooked = []) {
  const free = sittersFreeOn(date);
  return PREFERENCE[service].filter(
    (sitter) => free.includes(sitter) && !alreadyBooked.includes(sitter)
  );
}
