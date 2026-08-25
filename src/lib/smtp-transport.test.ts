import { MailTransportError } from "@/lib/mail-transport";
import { createSmtpTransport, smtpTransportConfigurationSchema } from "@/lib/smtp-transport";
import { opaqueSecretReference } from "@/lib/w02-security-contracts";

const configuration = smtpTransportConfigurationSchema.parse({
  host: "smtp.example.invalid",
  port: 587,
  security: "STARTTLS",
  username: "sandbox-user",
  password: "test-only-password",
  sender: "sandbox@example.invalid",
  replyTo: "reply@example.invalid",
  environment: "SANDBOX",
  sandboxRecipientAllowList: ["recipient@example.invalid"],
  timeoutMs: 1_000,
  maxAttempts: 2,
});

describe("SMTP transport configuration boundary", () => {
  it("allows only explicit TLS modes and SANDBOX configuration", () => {
    expect(configuration.security).toBe("STARTTLS");
    expect(() => smtpTransportConfigurationSchema.parse({ ...configuration, security: "NONE" })).toThrow();
    expect(() => smtpTransportConfigurationSchema.parse({ ...configuration, environment: "PRODUCTION" })).toThrow();
  });

  it("denies recipients outside the root-only sandbox allow list before provider delivery", async () => {
    const transport = createSmtpTransport(configuration);
    await expect(transport.deliver({
      message: { organizationId: "org_123456789012", idempotencyKey: "smtp.sandbox.test:123456789", to: ["outside@example.invalid"], subject: "test", text: "test" },
      configuration: { sender: configuration.sender, secretReference: opaqueSecretReference("secretref:smtp-transport-test-1234"), environment: "SANDBOX", sandboxRecipientAllowList: configuration.sandboxRecipientAllowList },
    })).rejects.toMatchObject({ code: "SANDBOX_RECIPIENT_DENIED" } satisfies Partial<MailTransportError>);
  });
});
