"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function PrivacyPolicyEN() {
  return (
    <div className="space-y-6 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      <div>
        <p className="font-bold mb-1" style={{ color: appColors.textPrimary }}>Privacy Policy – SelfRace</p>
        <p>Last updated: October 6, 2026</p>
      </div>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>1. Overview</h3>
        <p>
          SelfRace is a personal training analytics application designed to help endurance athletes analyze their own training data and long-term performance trends. We respect user privacy and process personal data only to deliver analytics and coaching features requested by the user.
        </p>
        <p className="mt-2 font-medium">
          SelfRace is a private, self-comparison tool. There are no social features, leaderboards, or comparisons with other athletes.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>2. Data We Collect & Legal Basis</h3>
        <p className="mb-2">
          By connecting your Strava account, you provide explicit consent for SelfRace to access and process the following data solely for training analytics purposes:
        </p>
        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Data accessed from Strava:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Activity Metrics:</strong> Distance, duration, sport type, pace, elevation gain, cadence, power, effort metrics, and timestamps.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Physiological Performance Metrics:</strong> Heart rate and derived workload indicators used exclusively for performance and recovery analysis.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Account Identifiers:</strong> Strava Athlete ID and email address (used only for authentication and account management via Supabase).</li>
        </ul>
        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Data we do NOT use:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>We do not store or display precise GPS routes or location maps.</li>
          <li>We do not process social data (followers, clubs, comments).</li>
          <li>We do not access private messages or non-training-related content.</li>
        </ul>

        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Data from connected platforms and watches (optional):</p>
        <p className="mb-2">These services are connected only at your explicit request and can be disconnected at any time.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>intervals.icu:</strong> Daily recovery data – HRV (overnight average), resting heart rate and sleep duration. Access via an API key you provide.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Garmin Connect (once the integration is available):</strong> Activities, sleep, HRV and resting heart rate, based on your consent via Garmin (OAuth). If you enable it, we can send planned workouts to your watch.</li>
        </ul>

        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Data you enter yourself:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Recovery:</strong> HRV, resting heart rate, sleep, factors (alcohol, caffeine, late meals) and notes.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Health records:</strong> Injury, illness, fatigue and menstruation – so training can adapt to your condition.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Body composition:</strong> Body scan data (e.g. InBody) that you upload or enter.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Profile and preferences:</strong> Goals, races, available time and equipment, training settings.</li>
        </ul>

        <p className="font-semibold mt-4 mb-1" style={{ color: appColors.textSecondary }}>Health data (special category under Art. 9 GDPR):</p>
        <p>
          HRV, heart rate, sleep, health records and body composition are health data. We process them only based on your explicit consent, given by entering them or connecting a service, and only to personalise your training and feedback. You can withdraw consent at any time by disconnecting the service or deleting the data or your account.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>3. How We Use Your Data</h3>
        <p className="mb-2">Your data is used exclusively to:</p>
        <ul className="list-disc pl-5 space-y-1 mb-4">
          <li>Calculate personal training metrics (e.g. training load, intensity distribution, weekly trends).</li>
          <li>Correlate activity data with recovery and health data – entered manually or imported from connected platforms (HRV, sleep, resting heart rate, notes).</li>
          <li>Adapt the training plan and recommendations to your current condition.</li>
          <li>Generate private performance summaries and long-term insights.</li>
        </ul>
        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Data Protection Principles:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Private by Design:</strong> Your data is visible only to you.</li>
          <li><strong style={{ color: appColors.textPrimary }}>No Sharing:</strong> Data is never shared with other users.</li>
          <li><strong style={{ color: appColors.textPrimary }}>No Selling:</strong> We do not sell, rent, or monetize personal data.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Read-Only Access:</strong> SelfRace never modifies or writes data back to Strava or connected platforms. The only exception is sending a planned workout to your watch, if you explicitly enable it.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>4. AI & Automated Processing</h3>
        <p className="mb-2">SelfRace uses automated analysis (AI-assisted logic via private APIs) to generate training insights.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>User-Centric Processing:</strong> AI is used only to interpret the user’s own statistics for their private dashboard.</li>
          <li><strong style={{ color: appColors.textPrimary }}>No Model Training:</strong> User data is not used to train global machine learning models. We exclusively use enterprise-grade API tiers.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Minimal Retention:</strong> Data sent for AI analysis is processed for real-time inference only and is not stored by the AI provider beyond the processing window.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>5. Data Storage & Retention</h3>
        <p className="mb-2">We apply a data-minimization strategy to ensure compliance with Strava’s platform policies.</p>
        
        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Granular Activity Data (Streams, Laps, Splits):</p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>Detailed activity data is cached temporarily to support deep-dive analysis.</li>
          <li>Retention period: Automatically deleted after seven (7) days.</li>
        </ul>

        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Activity Summaries & Trends:</p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>High-level activity metadata (summaries – date, sport, duration, distance, heart rate) is stored while your Strava account is connected and your SelfRace account is active. It is used for long-term trends (e.g. CTL/ATL, training streaks, monthly reviews). On first connection we import at most the last 12 months.</li>
          <li>Aggregated insights (e.g., weekly totals) are stored in a form that cannot be reverse-engineered into individual granular activities.</li>
        </ul>

        <p className="font-semibold mt-3 mb-1" style={{ color: appColors.textSecondary }}>Account Disconnection & Deletion:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Recovery and health data:</strong> Kept while you have an account, to track long-term trends (e.g. HRV baseline). We delete it earlier on request.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Disconnecting intervals.icu / Garmin:</strong> Further imports stop immediately and the stored access (API key or token) is deleted. Recovery values already imported remain part of your log unless you request their deletion.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Disconnecting Strava:</strong> If you disconnect your Strava account, all Strava-derived activity data and calculated metrics are immediately and permanently deleted from our servers. To protect API resources, a 24-hour cooldown period applies before reconnection is allowed.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Account Deletion:</strong> Upon request to delete your SelfRace account, all data is purged immediately, with a 7-day grace period for account recovery before permanent removal of settings and preferences.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>6. Your Rights (GDPR)</h3>
        <p className="mb-2">If you are located in the EU, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the data we store about you.</li>
          <li>Request correction or deletion of your data.</li>
          <li>Withdraw consent at any time by disconnecting Strava or any other connected service.</li>
          <li>Data portability – receive your data in a structured format.</li>
          <li>Request full account removal (“right to be forgotten”).</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>7. Third-Party Services</h3>
        <p className="mb-2">SelfRace relies on a limited set of trusted service providers:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong style={{ color: appColors.textPrimary }}>Strava API</strong> – activity data access based on user consent.</li>
          <li><strong style={{ color: appColors.textPrimary }}>intervals.icu</strong> – importing recovery data from your watch, based on your consent.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Garmin Connect</strong> (once the integration is available) – activities and recovery data, based on your consent.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Supabase</strong> – authentication and secure data storage (database with row-level access control).</li>
          <li><strong style={{ color: appColors.textPrimary }}>AI Providers (Enterprise APIs – Anthropic, Google, OpenAI)</strong> – used only for private inference, with no training on user data.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Stripe</strong> – subscription payment processing. We do not store payment card data.</li>
          <li><strong style={{ color: appColors.textPrimary }}>Vercel, Railway</strong> – hosting of the web application and server.</li>
        </ul>
        <p className="mt-2">
          These providers process data only on our behalf and for the stated purpose. We do not sell data or provide it to third parties for their own purposes.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2" style={{ color: appColors.textPrimary }}>8. Contact</h3>
        <p>If you have any questions about this Privacy Policy or your data, contact: <a href="mailto:support@selfrace.com" className="hover:underline" style={{ color: appColors.textPrimary }}>support@selfrace.com</a></p>
      </section>
    </div>
  );
}