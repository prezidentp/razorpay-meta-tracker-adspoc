import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Invalid webhook" });
    }

    const body = req.body;
    const event = body?.event;
    console.log("Incoming Razorpay event:", event);

    // 🔧 Replace with your actual Pixel info
    const pixelId = "YOUR_PIXEL_ID";
    const accessToken = "YOUR_ACCESS_TOKEN";

    // Process only completed payments
    if (!["payment.captured", "order.paid"].includes(event)) {
      console.log("Ignored event:", event);
      return res.status(200).json({ ignored: event });
    }

    const payment =
      body?.payload?.payment?.entity || body?.payload?.order?.entity || {};
    const amount = (payment.amount || 0) / 100;
    const email = payment.email || "";
    const contact = payment.contact || "";
    const eventId = payment.id || body.id || Date.now().toString();

    // Build payload for Meta CAPI
    const metaPayload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
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

    console.log("Sending event to Meta:", metaPayload);

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
