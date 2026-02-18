"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import AuthorSignature from "./AuthorSignature";

export default function AboutStoryEN() {
  return (
    <div className="space-y-8 text-sm leading-relaxed" style={{ color: appColors.textMuted }}>
      
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: appColors.textPrimary }}>The SelfRace Story: By an Athlete, For Athletes</h2>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>Why did it all start?</h3>
        <p>
          I'll be honest – SelfRace wasn't born in a marketing agency boardroom. It was born outside during long runs and countless hours spent looking for a tool that actually suited me. Something was always missing. Sometimes it was too complicated, other times too superficial, and most things didn't react to my real state.
        </p>
        <p>
          So I started programming at night. At first, just for myself. I wanted an app I'd enjoy opening every morning. And that's exactly what I do – I use SelfRace fully every day.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>More than just running</h3>
        <p>
          My passion is running, although I might not have the best athletic predispositions. Maybe that's why I enjoy it so much – I see huge room for improvement. But I know an athlete isn't just about legs. SelfRace is built on balance. I integrated a strength section and support for other sports, which are the right pieces of the puzzle on your journey.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>Sport is not a punishment, but a privilege</h3>
        <p>
          Today everyone is chasing something. In SelfRace, we don't just chase numbers. My goal is for us to look forward to every workout. To view movement not as an item on a to-do list, but as a privilege and joy. Because I realize not everyone has the luck and health to put on sneakers and run outside.
        </p>
      </section>

      <section className="space-y-4 p-6 rounded-xl border" style={{ backgroundColor: "rgba(255,255,255,0.03)", borderColor: appColors.divider }}>
        <h3 className="text-xl font-bold" style={{ color: appColors.textPrimary }}>Your coach, your data, your path</h3>
        <p>
          I wanted to bring you technology that gets closer to you than any static plan from the internet. Thanks to the analysis of a wide range of data, SelfRace offers training plans closest to a real coach.
        </p>
        <p className="font-medium text-base" style={{ color: appColors.textPrimary }}>
          But there is one important rule: We do not compare ourselves with others.
        </p>
        <p className="italic text-base font-semibold" style={{ color: appColors.textPrimary }}>
          In SelfRace, there is only one opponent worth beating – your yesterday's self.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold" style={{ color: appColors.textPrimary }}>We are in this together</h3>
        <p>
          Behind this application isn't an anonymous team of developers. It's me standing here, and you – a community of people who love movement. SelfRace is also you. I'll be happy if you write to me anytime about what's missing in the app or what we could do better. Every observation moves SelfRace forward.
        </p>
        <p className="font-medium text-base pt-2" style={{ color: appColors.textPrimary }}>
          Let's improve. Together, but each at our own pace.
          <br />
          Welcome to SelfRace.
        </p>
      </section>

      <AuthorSignature />
    </div>
  );
}