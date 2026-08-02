const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// NOTE: Before deploying, set config using:
// firebase functions:config:set mail.user="YOUR_EMAIL@gmail.com" mail.pass="YOUR_APP_PASSWORD"
// This uses Gmail, but any SMTP server works.
const mailTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: functions.config().mail?.user || "adm.exam.hss.shangus@gmail.com",
    pass: functions.config().mail?.pass || "REPLACE_WITH_APP_PASSWORD",
  },
});

exports.sendPracticalsEmail = functions.https.onCall(async (data, context) => {
  // 1. Verify Authentication & Authorization
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in to send emails."
    );
  }

  // 2. Extract email details
  const { to, subject, htmlBody, plainTextBody } = data;

  if (!to || !subject || !htmlBody) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required email fields (to, subject, htmlBody)."
    );
  }

  const mailOptions = {
    from: `"HSS Shangus Awards System" <${functions.config().mail?.user || "adm.exam.hss.shangus@gmail.com"}>`,
    to: to,
    replyTo: "adm.exam.hss.shangus@gmail.com",
    subject: subject,
    text: plainTextBody || "Please view this email in an HTML-compatible client.",
    html: htmlBody,
  };

  try {
    // 3. Send email
    await mailTransport.sendMail(mailOptions);

    // 4. Optionally log in Firestore
    await admin.firestore().collection("emailLogs").add({
      to,
      subject,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      sentBy: context.auth.token.email,
    });

    return { success: true, message: `Email sent successfully to ${to}` };
  } catch (error) {
    console.error("Error sending email:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to send email. Check SMTP configuration."
    );
  }
});
