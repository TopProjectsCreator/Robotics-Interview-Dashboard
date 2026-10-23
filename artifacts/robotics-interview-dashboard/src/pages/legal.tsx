import { BrandMark } from "@/components/BrandMark";

const updatedDate = "October 22, 2026";

function LegalNotice() {
  return (
    <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      These are draft, informational policies and are not legal advice. Have a
      qualified lawyer review them for the operator’s location and the people
      whose information is handled before relying on them.
    </div>
  );
}

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <a href="/" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Robotics Interview Dashboard home">
            <BrandMark />
            <span>
              <span className="block text-sm font-bold tracking-[.16em]">ROBOTICS</span>
              <span className="mono block text-[10px] uppercase tracking-[.16em] text-muted-foreground">Team workspace</span>
            </span>
          </a>
          <a href="/auth" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">Open the workspace</a>
        </header>

        <LegalNotice />
        <article className="prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-8 prose-a:text-primary prose-li:marker:text-muted-foreground">
          <p className="not-prose mono text-xs uppercase tracking-[.15em] text-muted-foreground">Last updated {updatedDate}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
          {children}
        </article>

        <footer className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
          <a href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">Privacy Policy</a>
          <a href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">Terms of Use</a>
          <a href="/auth" className="underline-offset-4 hover:text-foreground hover:underline">Feedback / Suggestion</a>
          <a href="/" className="ml-auto underline-offset-4 hover:text-foreground hover:underline">Home</a>
        </footer>
      </div>
    </main>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This policy describes the Robotics Interview Dashboard, a team workspace
        for robotics tryouts and team operations. It is operated by an individual;
        no separate registered legal entity has been identified. In this policy,
        “we” means the individual operating the service, and “you” includes
        workspace users, teams, applicants, and their parents or guardians.
      </p>

      <h2>Information the service handles</h2>
      <p>Depending on the features a team uses, the service may handle:</p>
      <ul>
        <li>Team and account details, such as team name, display name, role, authentication records, and session data.</li>
        <li>Applicant information entered or imported by a team, including name, age (including age zero), grade, gender, email, photos, transcripts, application answers, attendance, interview assignments, notes, decisions, and AI-generated scores or summaries.</li>
        <li>Workspace content, such as chat messages, polls, reactions, uploaded documents, assistant prompts and responses, saved builder questions and results, spreadsheets, whiteboards, code, CAD files, and other team-created material.</li>
        <li>Technical and usage information, such as IP address, browser or device information, pages visited, timestamps, session and presence events, and approximate location inferred from network information.</li>
        <li>Information sent when a user connects an external service or MCP server, including the content needed to carry out that user's requested action.</li>
      </ul>

      <h2>Children’s information</h2>
      <p>
        The service does not currently impose a minimum age, and teams may enter
        applicant information about children of any age. Team organizers are
        responsible for providing required notices and obtaining any parent or
        guardian permissions required by applicable law before adding or
        processing a child’s information.
      </p>

      <h2>How information is used</h2>
      <p>
        Information is used to provide team workspaces, coordinate tryouts and
        interviews, display team information, save and retrieve workspace
        content, respond to support or feedback requests, secure the service,
        and operate requested AI or connected-service features.
      </p>

      <h2>AI features and model providers</h2>
      <p>
        When a user invokes an AI feature, the prompt and relevant context,
        which may include applicant information or uploaded files, is sent to
        the Kilo gateway and may be routed to the selected upstream model
        provider to produce a response. The available free models and their
        providers can change. Kilo’s published privacy policy describes prompts
        being sent to the selected AI provider; the provider’s own terms and
        privacy practices also apply.
      </p>
      <p>
        Depending on the selected model provider and its policies, prompts,
        files, and responses may be retained, reviewed by people, or used to
        train or improve models. Providers and infrastructure may process this
        information in different countries, including countries outside the
        United States and Canada, potentially including China. We cannot promise
        that every upstream provider has the same retention, training, human
        review, or location practices. Do not submit information to an AI
        feature unless your team is authorized to do so and accepts the
        applicable provider’s terms. AI outputs can be inaccurate and require
        human review.
      </p>
      <p>
        Image generation may send the requested image prompt to Pollinations.
        User-configured integrations, including MCP servers, may receive data
        needed to perform a requested action. Review each provider’s current
        privacy terms before connecting or using it.
      </p>

      <h2>Storage, hosting, and international processing</h2>
      <p>
        The operator reports that database and file storage are located in the
        United States and Canada. Application servers may operate in other
        locations. AI and connected-service requests may be processed in the
        countries where those providers or their infrastructure operate. Data
        protection laws may differ between those locations.
      </p>
      <ul>
        <li><strong>Supabase:</strong> database and file storage for team records and uploaded files.</li>
        <li><strong>Replit:</strong> application hosting and runtime infrastructure; server location may vary.</li>
        <li><strong>Kilo and the selected upstream model provider:</strong> AI prompts, relevant context, and files needed to generate a response.</li>
        <li><strong>Pollinations:</strong> image-generation prompts when that feature is used.</li>
        <li><strong>User-connected services:</strong> a connected MCP server or other integration receives information needed for the action a user requests.</li>
      </ul>
      <p>Each provider has its own terms and data practices, which may change.</p>

      <h2>Access, retention, and deletion</h2>
      <p>
        Workspace information is available to users authorized for the relevant
        team or workspace. The service has no fixed deletion schedule for all
        stored content. Information may remain in a workspace until a team or
        its users delete it, and operational records or backups may persist
        after deletion for a period of time.
      </p>
      <p>
        To ask a question or request access, correction, or deletion, use the
        in-app Feedback / Suggestion feature. Applicants and parents or
        guardians without a workspace account should ask the team coordinator
        who provided the workspace to submit the request. The coordinator may
        need to verify the request and their authority before changing team
        records.
      </p>

      <h2>Cookies, local storage, and security</h2>
      <p>
        The service uses session cookies and browser storage for sign-in,
        preferences, and workspace functionality. The server also records
        technical and presence information needed to operate and secure the
        service. We do not describe these necessary functions as advertising
        cookies. Reasonable access controls and security measures are used, but
        no online service can guarantee absolute security.
      </p>

      <h2>Changes and questions</h2>
      <p>
        This policy may change as the service or its providers change. The
        updated date above will be revised when this page is updated. Submit
        privacy questions through Feedback / Suggestion in the app, or ask your
        team coordinator if you do not have an account.
      </p>
      <p>
        Relevant provider information: <a href="https://kilo.ai/privacy" target="_blank" rel="noreferrer">Kilo Privacy Policy</a> and{" "}
        <a href="https://kilo.ai/terms" target="_blank" rel="noreferrer">Kilo Terms</a>.
      </p>
    </LegalShell>
  );
}

export function TermsOfUse() {
  return (
    <LegalShell title="Terms of Use">
      <p>
        These terms apply to use of the Robotics Interview Dashboard and its
        team workspaces. The service is operated by an individual; no separate
        registered legal entity has been identified. By accessing or using the
        service, you agree to these terms.
      </p>

      <h2>Eligibility and team responsibility</h2>
      <p>
        The service does not currently impose a minimum age. If you are a
        minor, use it only with any parent or guardian permission required by
        applicable law. Teams and coordinators are responsible for ensuring
        they have authority to submit applicant information, including
        information about children, and for providing notices or obtaining
        permissions required by law.
      </p>

      <h2>Accounts and acceptable use</h2>
      <p>
        Keep access codes, passwords, and sessions secure. You are responsible
        for activity performed through your account and for the information you
        add to a team workspace. Do not use the service to violate laws or
        others’ rights, access another team’s data without authorization,
        interfere with the service, or upload malicious or misleading content.
      </p>

      <h2>Your content and connected services</h2>
      <p>
        You or your team retain rights to content you provide. You grant the
        operator permission to host, store, reproduce, transmit, and process
        that content as reasonably needed to provide, secure, and maintain the
        service, including sending relevant content to AI model providers or
        external integrations when you use those features. You confirm that you
        have the rights and permissions needed to provide that content and
        authorize those uses.
      </p>

      <h2>AI features</h2>
      <p>
        AI responses, summaries, scores, recommendations, and generated content
        may be incomplete, inaccurate, biased, or unsuitable for a particular
        purpose. They are not legal, medical, educational, employment, or other
        professional advice and must not replace human judgment. Teams must
        independently review AI-assisted assessments and make decisions
        themselves.
      </p>
      <p>
        AI requests may be routed through Kilo to different upstream model
        providers. Those providers may have different terms, data practices,
        retention periods, training uses, human review practices, and processing
        locations. Review the provider’s terms and avoid submitting data you
        are not authorized to share. External integrations are provided by
        third parties and are subject to their own terms.
      </p>

      <h2>Service, fees, and ownership</h2>
      <p>
        The service currently has no paid plans or in-app payments. Features,
        providers, or availability may change. The service is provided without
        an uptime guarantee. The operator retains rights in the service’s
        software, branding, and design; these terms do not transfer ownership
        of those materials to users.
      </p>

      <h2>Suspension, termination, and stored content</h2>
      <p>
        Access may be suspended or ended if these terms are violated, the
        service is discontinued, or continued access creates a security or
        legal risk. Users should keep copies of important content. Deleting
        content from the workspace may not immediately remove operational logs
        or backup copies. You may stop using the service at any time. Ask your
        team coordinator to close your access or handle team data you no longer
        need.
      </p>

      <h2>Disclaimers and limits</h2>
      <p>
        To the extent permitted by law, the service is provided “as is” and
        “as available,” without warranties that it will be uninterrupted,
        error-free, or suitable for every purpose. To the extent permitted by
        law, the operator is not responsible for indirect, incidental, special,
        consequential, or punitive losses, or for decisions made based on
        unverified AI output. Nothing in these terms limits rights or
        responsibilities that cannot legally be limited.
      </p>

      <h2>Governing law</h2>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        The operator’s country and state/province were not provided. This
        governing-law and venue section must be completed before these terms
        are relied on as a final agreement.
      </p>

      <h2>Changes and questions</h2>
      <p>
        These terms may be updated as the service changes. Continued use after
        an update means you accept the revised terms to the extent permitted by
        law. Submit questions through the in-app Feedback / Suggestion feature.
        Applicants and parents or guardians without a workspace account should
        ask the team coordinator who provided the workspace.
      </p>
    </LegalShell>
  );
}
