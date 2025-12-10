// /api/meta-conversion.js
import fetch from "node-fetch";
import crypto from "crypto";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Invalid webhook method" });
    }

    const body = req.body;
    const event = body?.event;
    console.log("Incoming Razorpay event:", event);

    // Replace with your actual Pixel details
    const pixelId = "YOUR_PIXEL_ID";
    const accessToken = "YOUR_ACCESS_TOKEN";

    // Track only successful payments
    if (!["payment.captured", "order.paid"].includes(event)) {
      console.log("Ignored event:", event);
      return res.status(200).json({ ignored: event });
    }

    // Extract Razorpay payload
    const payment =
      body?.payload?.payment?.entity || body?.payload?.order?.entity || {};
    const amount = (payment.amount || 0) / 100;
    const email = payment.email || "";
    const contact = payment.contact || "";
    const eventId = payment.id || body.id || `rzp_${Date.now()}`;

    // Hash helper (Meta requires SHA256)
    const hash = (val) =>
      crypto.createHash("sha256").update(val.trim().toLowerCase()).digest("hex");

    // Build user_data per Meta spec
    const user_data = {};
    if (email) user_data.em = [hash(email)];
    if (contact) {
      // Normalize phone: remove symbols and add country code if missing
      const normalizedPhone = contact.replace(/\D/g, "");
      const withCountryCode = normalizedPhone.startsWith("91")
        ? normalizedPhone
        : `91${normalizedPhone}`;
      user_data.ph = [hash(withCountryCode)];
    }

    // Include non-hashed fields for matching accuracy
    user_data.client_ip_address =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    user_data.client_user_agent = req.headers["user-agent"] || "";

    // Optional extras you can keep or remove
    // user_data.country = [hash("in")];
    // user_data.external_id = [hash(eventId)];

    const metaPayload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "website",
          event_source_url: "https://yourdomain.com",
          user_data,
          custom_data: {
            currency: "INR",
            value: amount,
          },
        },
      ],
    };

    console.log("Meta Payload Preview:", JSON.stringify(metaPayload, null, 2));

    // Send to Meta CAPI
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaPayload),
      }
    );

    const result = await response.json();
    console.log("Meta response:", JSON.stringify(result, null, 2));

    res.status(200).json({ success: true, metaResponse: result });
  } catch (error) {
    console.error("Error sending to Meta:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

