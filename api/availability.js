import { sittersBookedOn } from "../lib/db.js";
import { candidates, isValidDate, todayInLondon } from "../lib/schedule.js";

// GET /api/availability?date=YYYY-MM-DD → { available } (is any sitter free for any booking that day?)
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const { date } = req.query;
  if (!isValidDate(date) || date < todayInLondon()) {
    return res.status(400).json({ error: "Please choose a valid date that hasn't passed." });
  }

  try {
    const booked = await sittersBookedOn(date);
    const available =
      candidates(date, "babysitting", booked).length > 0 || candidates(date, "dogs", booked).length > 0;
    return res.status(200).json({ available });
  } catch (error) {
    console.error("availability check failed", error);
    return res.status(500).json({ error: "We couldn't check that date. Please try again." });
  }
}
