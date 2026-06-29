"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function TermsOfServiceEN() {
  return (
    <div className="space-y-6 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      <div>
        <p className="font-bold mb-1" style={{ color: appColors.textPrimary }}>Terms of Service – SelfRace</p>
        <p>Last updated: June 29, 2026</p>
      </div>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>1. Acceptance of Terms</h3>
        <p>
          By creating an account and using the SelfRace application, you agree to be bound by these Terms of Service. If you do not agree, do not use the application.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>2. No Medical or Professional Advice (Disclaimer)</h3>
        <p className="mb-2">SelfRace is NOT a medical device, a licensed medical provider, or a professional coach.</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Informational Purposes Only:</strong> All analytics, insights, and training load indicators provided by SelfRace are for informational and educational purposes only.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Consult a Professional:</strong> You should consult with a physician or a qualified healthcare professional before starting any new exercise program, especially if you have any pre-existing medical conditions.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Listen to Your Body:</strong> Automated insights cannot replace your personal judgment or the advice of a medical professional. Never disregard professional medical advice or delay seeking it because of something you have seen in this application.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>3. Assumption of Risk & Liability</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>User Responsibility:</strong> You acknowledge that endurance training and high-intensity exercise involve inherent risks of injury or death. You voluntarily assume all known and unknown risks associated with your training.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Limitation of Liability:</strong> To the maximum extent permitted by law, SelfRace and its developers shall not be liable for any injuries, health problems, damages, or losses (including but not limited to physical injury, cardiac arrest, or overtraining syndrome) resulting from your use of the application or reliance on its data.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Accuracy of Data:</strong> While we strive for accuracy, SelfRace depends on data from third parties (Strava) and user inputs. We do not guarantee that the analytics or AI-generated insights are 100% accurate or error-free.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>4. Data Management & Disconnection</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Disconnection Policy:</strong> If you choose to disconnect your Strava account, SelfRace will immediately and permanently delete all historical activity data and analytical insights derived from Strava from our active database. This action is irreversible.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>API Cooldown Period:</strong> To ensure service stability and prevent API abuse, users who disconnect their Strava account are subject to a 24-hour cooldown period before they can reconnect.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Re-connection Limitations:</strong> Upon reconnection, the application will perform a fresh synchronization of recent history (typically the last 7 days) to rebuild the training dashboard.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>5. Use of AI Insights</h3>
        <p>
          SelfRace uses automated analysis to provide training feedback. These insights are generated based on historical metadata and do not account for real-time environmental factors, hidden illnesses, or psychological stress. You are solely responsible for how you interpret and act upon these insights.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>6. Termination of Service</h3>
        <p>
          We reserve the right to modify or terminate the service at any time. You may delete your account or disconnect from Strava at your discretion. Account deletion includes a 7-day grace period for profile settings, though Strava-derived data is purged immediately upon the request.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>7. Governing Law</h3>
        <p>
          These terms are governed by the laws of the Slovak Republic. Any disputes shall be resolved in the competent courts of the Slovak Republic.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>8. Subscriptions, Payments & Refunds</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong style={{ color: appColors.textPrimary }}>Free Trial:</strong> New users receive a 14-day free trial of the Pro plan. After the trial period, the account automatically reverts to the Free plan unless the user purchases a paid subscription.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Paid Plans:</strong> The Classic plan is available at €5/month and the Pro plan at €10/month. Subscriptions renew automatically each month until cancelled.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Cancellation:</strong> You may cancel your subscription at any time in your account settings. Cancellation takes effect at the end of the current billing period. Access to paid features remains active until the end of the paid period.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Refunds:</strong> In accordance with EU Directive 2011/83/EU, you have the right to withdraw from the contract within 14 days of your first billing cycle without giving any reason. After this period, payments are non-refundable. Refund requests should be sent to support@selfrace.app.
          </li>
          <li>
            <strong style={{ color: appColors.textPrimary }}>Price Changes:</strong> We reserve the right to modify subscription pricing. You will be notified of any changes at least 30 days in advance by email.
          </li>
        </ul>
      </section>
    </div>
  );
}
