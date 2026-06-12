import { Injectable, Logger } from '@nestjs/common'

// Minimal Resend integration via the HTTP API. Adding the @resend/node SDK was
// avoided so the api Dockerfile doesn't need a fresh npm ci. If RESEND_API_KEY
// is missing the service logs and no-ops — keeps local-dev (or stale env)
// usable without breaking the approve flow.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly resendKey = process.env['RESEND_API_KEY']
  // `onboarding@resend.dev` is Resend's pre-verified sandbox sender. Override
  // via EMAIL_FROM once you've added a verified domain.
  private readonly fromAddress =
    process.env['EMAIL_FROM'] ?? 'AiTek Portal <onboarding@resend.dev>'

  async sendApprovalEmail(to: string, firstName: string, portalUrl: string): Promise<void> {
    const subject = 'Your AiTek Portal is ready'
    const html = this.renderApprovalHtml(firstName, portalUrl)
    await this.send(to, subject, html)
  }

  async sendChangesRequestedEmail(
    to: string,
    firstName: string,
    phaseLabel: string,
    onboardingUrl: string,
  ): Promise<void> {
    const subject = 'Action needed on your AiTek onboarding'
    const safeName = (firstName || 'there').replace(/</g, '&lt;')
    const safePhase = String(phaseLabel).replace(/</g, '&lt;')
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a;">
        <h2 style="margin:0 0 16px;">We need a quick update</h2>
        <p>Hi ${safeName},</p>
        <p>Our team reviewed your submission and asked for changes to the
           <strong>${safePhase}</strong> section. Please sign in and update it, then resubmit.</p>
        <p style="margin:24px 0;">
          <a href="${onboardingUrl}"
             style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500;">
            Update my onboarding
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">&mdash; The AiTek team</p>
      </div>
    `
    await this.send(to, subject, html)
  }

  private renderApprovalHtml(firstName: string, portalUrl: string): string {
    const safeName = (firstName || 'there').replace(/</g, '&lt;')
    return `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a;">
        <h2 style="margin:0 0 16px;">Welcome to AiTek Portal</h2>
        <p>Hi ${safeName},</p>
        <p>Good news &mdash; your onboarding has been approved. Your client portal is now open.</p>
        <p style="margin:24px 0;">
          <a href="${portalUrl}"
             style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500;">
            Open the portal
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">
          If the button doesn't work, paste this link into your browser:<br>
          <span>${portalUrl}</span>
        </p>
        <p style="color:#64748b;font-size:13px;">&mdash; The AiTek team</p>
      </div>
    `
  }

  // Generic notification email — mirrors an in-app notification (title + body +
  // a link back into the portal).
  async sendNotificationEmail(
    to: string,
    n: { title: string; body: string; link: string },
  ): Promise<void> {
    const safeTitle = n.title.replace(/</g, '&lt;')
    const safeBody = n.body.replace(/</g, '&lt;')
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a;">
        <h2 style="margin:0 0 12px;">${safeTitle}</h2>
        <p style="color:#334155;">${safeBody}</p>
        <p style="margin:24px 0;">
          <a href="${n.link}"
             style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500;">
            View in AiTek Portal
          </a>
        </p>
        <p style="color:#94a3b8;font-size:12px;">
          You’re receiving this because of your notification settings.
        </p>
        <p style="color:#64748b;font-size:13px;">&mdash; The AiTek team</p>
      </div>
    `
    await this.send(to, safeTitle, html)
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resendKey) {
      this.logger.warn(
        `RESEND_API_KEY not set — skipping send to ${to} (subject: "${subject}")`,
      )
      return
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to,
          subject,
          html,
        }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '<no body>')
        this.logger.error(`Resend send to ${to} failed: ${res.status} ${body}`)
        return
      }

      this.logger.log(`Email sent to ${to} (subject: "${subject}")`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Resend exception sending to ${to}: ${msg}`)
    }
  }
}
