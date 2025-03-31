"use server";

import { render } from "@react-email/components";
import { Resend } from "resend";

export async function sendEmail({ to, subject, react }) {
  const resend = new Resend(process.env.RESEND_API_KEY || "");
  
  try {
    // Check if react is already HTML string
    const html = typeof react === 'string' ? react : render(react);
    const reactComponent = typeof react === 'string' ? undefined : react;
    
    const data = await resend.emails.send({
      from: "Welth <onboarding@resend.dev>",
      to,
      subject,
      react: reactComponent,
      html: html,
    });
    
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error: error.message };
  }
}
