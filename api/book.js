import { adminClient, sittersBookedOn, userFromRequest } from "../lib/db.js";
import { parseBooking } from "../lib/booking.js";
import { candidates } from "../lib/schedule.js";
import { sendBookingEmail } from "../lib/email.js";

const UNIQUE_VIOLATION = "23505";

// POST /api/book → { booking } with the chosen sitter, or 409 { noSitter: true } if nobody is free.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Please sign in again." });

  const { booking, error } = parseBooking(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const booked = await sittersBookedOn(booking.booking_date);
    let saved = null;

    // Try sitters in order of preference. A unique index stops two bookings
    // landing on the same sitter and day at once, so move on if one is taken.
    for (const sitter of candidates(booking.booking_date, booking.service, booked)) {
      const { data, error: insertError } = await adminClient()
        .from("bookings")
        .insert({ ...booking, sitter, user_id: user.id, customer_email: user.email })
        .select()
        .single();
      if (!insertError) {
        saved = data;
        break;
      }
      if (insertError.code !== UNIQUE_VIOLATION) throw insertError;
    }

    if (!saved) return res.status(409).json({ noSitter: true });

    try {
      await sendBookingEmail(saved, user.email);
    } catch (emailError) {
      console.error("booking saved but email failed", saved.id, emailError);
    }

    return res.status(200).json({ booking: saved });
  } catch (err) {
    console.error("booking failed", err);
    return res.status(500).json({ error: "Something went wrong saving your booking. Please try again." });
  }
}
