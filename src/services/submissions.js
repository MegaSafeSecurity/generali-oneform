const { sendHqEmail } = require("./gmail.js");

/**
 * This module deliberately accepts attachment Buffers supplied by a trusted
 * private-storage adapter. Never accept arbitrary file URLs or paths from a browser.
 * The caller must verify agent ownership/admin role and application readiness first.
 */
async function deliverSubmission({ application, recipient, attachments, storageChecksum }) {
  if (!application?.id || !application?.reference_no) throw new Error("Invalid application record.");
  if (!["PI", "PL", "GPA"].includes(application.insurance_type)) throw new Error("Unsupported insurance type.");
  if (application.status !== "approved_by_agent") throw new Error("Application must be approved by an agent before HQ submission.");
  if (!Array.isArray(attachments) || attachments.length === 0) throw new Error("No approved documents attached.");

  const subject = `Generali Insurance Submission - ${application.insurance_type} - ${application.reference_no}`;
  const body = [
    "Dear Generali Team,",
    "",
    "Please find attached the completed proposal form and supporting documents for your review.",
    "",
    `Application Reference: ${application.reference_no}`,
    `Insurance Type: ${application.insurance_type}`,
    "",
    "Thank you."
  ].join("\n");

  const result = await sendHqEmail({
    to: recipient,
    subject,
    text: body,
    attachments,
    reference: application.reference_no
  });

  return {
    ...result,
    applicationId: application.id,
    referenceNo: application.reference_no,
    storageChecksum: storageChecksum || null,
    sentAt: new Date().toISOString(),
    status: "sent"
  };
}

module.exports = { deliverSubmission };
