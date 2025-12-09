import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const data = req.body;
    console.log("Incoming Razorpay webhook:", JSON.stringify(data));

    const payment = data?.payload?.payment?.entity;
    if (!payment) {
      return res.status(400).json({ error: "Invalid webhook" });
    }

    const paymentId = payment.id;
    const email = payment.email || "";
    const phone = payment.contact || "";
    const amount = payment.amount ? payment.amount / 100 : 0;

    const cacheKey = `processed_${paymentId}`;
    global[cacheKey] = global[cacheKey] || false;
    if (global[cacheKey]) {
      return res.status(200).json({ status: "duplicate" });
    }
    global[cacheKey] = true;

    // 🔧 Replace these two lines only
    const pixelId = "854525376948070"; // <-- your pixel ID here
    const accessToken = "EAAMI5hH14R0BQB6ccaZAUDKJwdo6I3H1d5qVxXKLg2lTOxKP9p4Qf4wPd7ht3bdiJQhMsJ0sug4jjaxAImJvob35I3Aprs5Kme1U9TZBkU6grhi5Xav6u6vKbBjjzsX2C6hS5Cwl5yO5uPqZASDw7pZCmOpr1JqINyVHdfSaBJiSh2EuOZAGO9v5UEZCQdu80DXwZDZD"; // <-- your access token here

    const metaPayload = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_id: paymentId,
          user_data: {
            em: email ? [Buffer.from(email.trim().toLowerCase()).toString("base64")] : [],
            ph: phone ? [Buffer.from(phone.trim()).toString("base64")] : []
          },
          custom_data: {
            currency: "INR",
            value: amount
          }
        }
      ]
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metaPayload)
      }
    );

    const fbResult = await response.json();
    console.log("Meta response:", fbResult);

    res.status(200).json({ success: true, meta: fbResult });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
