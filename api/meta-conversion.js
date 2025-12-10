import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    // Validate request method
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Invalid webhook method" });
    }

    const body = req.body;
    const event = body?.event;
    console.log("Incoming Razorpay event:", event);

    // 🔧 Replace with your real Pixel details
    const pixelId = "854525376948070";
    const accessToken = "EAAMI5hH14R0BQB6ccaZAUDKJwdo6I3H1d5qVxXKLg2lTOxKP9p4Qf4wPd7ht3bdiJQhMsJ0sug4jjaxAImJvob35I3Aprs5Kme1U9TZBkU6grhi5Xav6u6vKbBjjzsX2C6hS5Cwl5yO5uPqZASDw7pZCmOpr1JqINyVHdfSaBJiSh2EuOZAGO9v5UEZCQdu80DXwZDZD";

    // Only track successful payments
    if (!["payment.captured", "order.paid"].includes(event)) {
      console.log("Ignored non-purchase event:", event);
      return res.status(200).json({ ignored: event });
    }

    // Extract payment data from Razorpay payload
    const payment =
      body?.payload?.payment?.entity || body?.payload?.order?.entity || {};
    const amount = (payment.amount || 0) / 100;
    const email = payment.email || "";
    const contact = payment.contact || "";

    // ✅ Use Razorpay payment ID as the deduplication key
    const eventId = payment.id || body.id || `rzp_${Date.now()}`;

    // Build Meta Conversions API payload
    const metaPayload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId, // helps deduplicate with pixel events
          action_source: "website",
          user_data: {
            em: email ? [email.trim().toLowerCase()] : [],
            ph: contact ? [contact.trim()] : [],
          },
          custom_data: {
            currency: "INR",
            value: amount,
          },
        },
      ],
    };

    console.log("Sending Purchase event to Meta CAPI:", metaPayload);

    // Send event to Meta Conversions API
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

    // Confirm back to Razorpay
    return res.status(200).json({ success: true, metaResponse: result });

  } catch (error) {
    console.error("Error sending to Meta CAPI:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

