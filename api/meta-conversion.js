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

    // 🔥 Your actual Meta Pixel credentials
    const pixelId = "854525376948070";
    const accessToken =
      "EAAMI5hH14R0BQJcdf4H5UCaeZC5gIEvYmZB38dVTxRDsPlaSPq210g83Dz6kI8pLS1vSYKihYZB2jfYz6CtVPzuZCLc6c5sMh4xEesDBEK8eeBZBEkxdZAyD4DqCsXlBBoSZBmlqM4RTFjVARp9ugyOv4eR1L7ldt1GzlIgvM3ZBvYreu6xmUQuU0hK29M51mIfXhgZDZD";

    // ✅ Only process successful payment events
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

    // ✅ Stable event_id for deduplication across both events
    const eventId =
      payment.order_id ||
      body.payload?.payment?.entity?.order_id ||
      body.payload?.order?.entity?.id ||
      `rzp_${Date.now()}`;

    // Helper: SHA256 hash (Meta requirement)
    const hash = (val) =>
      crypto.createHash("sha256").update(val.trim().toLowerCase()).digest("hex");

    // Build user_data per Meta spec
    const user_data = {};
    if (email) user_data.em = [hash(email)];
    if (contact) {
      const normalizedPhone = contact.replace(/\D/g, "");
      const withCountryCode = normalizedPhone.startsWith("91")
        ? normalizedPhone
        : `91${normalizedPhone}`;
      user_data.ph = [hash(withCountryCode)];
    }

    // Non-hashed identifiers (required)
    user_data.client_ip_address =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    user_data.client_user_agent = req.headers["user-agent"] || "";

    // 🆕 NEW: Optional identity match boosters
    try {
      // fbp (browser ID)
      const cookieHeader = req.headers.cookie || "";
      const fbpMatch = cookieHeader.match(/_fbp=([^;]+)/);
      if (fbpMatch) user_data.fbp = fbpMatch[1];

      // fbc (click ID)
      const referer = req.headers.referer || "";
      const fbclidMatch = referer.match(/[?&]fbclid=([^&]+)/);
      if (fbclidMatch)
        user_data.fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${fbclidMatch[1]}`;

      // external_id (extra dedupe anchor)
      user_data.external_id = [hash(eventId)];
    } catch (e) {
      console.log("Optional ID parsing failed:", e.message);
    }

    // ✅ Final Meta CAPI payload
    const metaPayload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: "website",
          event_source_url: "https://www.adspoc.in/",
          user_data,
          custom_data: {
            currency: "INR",
            value: amount,
          },
        },
      ],
    };

    console.log("Meta Payload Preview:", JSON.stringify(metaPayload, null, 2));

    // Send to Meta Conversions API
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

