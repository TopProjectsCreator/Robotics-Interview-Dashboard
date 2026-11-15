import { BrandMark } from "@/components/BrandMark";

const updatedDate = "November 15, 2026";

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

        <article className="prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-8 prose-a:text-primary prose-li:marker:text-muted-foreground">
          <p className="not-prose mono text-xs uppercase tracking-[.15em] text-muted-foreground">Last updated {updatedDate} · Effective {updatedDate}</p>
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
        for robotics tryouts and team operations. The service is operated by an
        individual; no separate registered legal entity has been identified. In
        this policy, “we,” “our,” and “the operator” mean the individual
        operating the service, and “you” means anyone who creates, administers,
        or uses a team workspace, including team coordinators, workspace users,
        applicants, and their parents or guardians. This policy is effective as
        of {updatedDate} and is maintained as the operative privacy policy for
        the service. It applies in addition to the{" "}
        <a href="/terms">Terms of Use</a>.
      </p>

      <h2>1. Who is responsible for information</h2>
      <p>
        For information about your own account, the operator is the responsible
        party. For applicant and roster information that a team enters, the
        team and its coordinators act as the parties responsible to the people
        whose information they enter, and the operator processes that
        information on the team’s behalf as a hosting processor. If you have a
        question about information a team holds about you, contact that team’s
        coordinator first. You may also use the in-app Feedback / Suggestion
        feature; we will route it to the appropriate team or handle it
        ourselves as applicable.
      </p>

      <h2>2. Information we collect and handle</h2>
      <ul>
        <li><strong>Account and team information:</strong> team name, display name, role, account identifier, hashed password, passkey credentials, session and authentication records, and workspace access settings configured by your team.</li>
        <li><strong>Applicant and roster information</strong> (for teams that use tryout features): name, age (and grade), including records where age is missing or recorded as zero, gender, email, photographs, transcripts, application answers, attendance, interview assignments, notes, decisions, and AI-generated scores or summaries.</li>
        <li><strong>Workspace content:</strong> chat messages, polls, reactions, replies, scheduled messages, pinned items, uploaded files and attachments, spreadsheets, whiteboards, boards, documents, code, CAD files, assistant prompts and responses, saved custom MCP or model configuration, personal notepad entries, and other team-created material.</li>
        <li><strong>Team inbox email</strong> (only for teams that enable the team inbox): the sender address, subject, and content of approved-sender email forwarded into the team’s shared chat, and deduplication records (message identifier, sender, subject, and receipt time) used to avoid posting the same email twice.</li>
        <li><strong>Technical and usage information:</strong> IP address, browser and device information, pages visited, timestamps and approximate time on page, session and presence events, feature usage for adoption analytics visible to your team’s coordinators, and client error diagnostics (error message and context strings) used to keep the service running. Approximate city, region, and country are inferred server-side from your IP address by sending the address to <strong>ip-api.com</strong>, a third-party geolocation service; see “Storage, hosting, and international processing.”</li>
        <li><strong>AI interaction content:</strong> prompts, relevant context, and files needed to answer a request you make to an AI feature, as described in “AI features and model providers.”</li>
      </ul>

      <h2>3. Why we use information</h2>
      <p>We use information only to:</p>
      <ul>
        <li>provide, maintain, and secure team workspaces and their features;</li>
        <li>coordinate tryouts and interviews, including the interview queue, attendance handling, decision lanes, and the sanitized waiting-room display;</li>
        <li>save and retrieve workspace content for the people authorized to see it;</li>
        <li>route approved team-inbox email into a team’s chat when a team enables it;</li>
        <li>respond to feedback, support, and privacy requests;</li>
        <li>produce service diagnostics and aggregate, team-visible adoption analytics;</li>
        <li>prevent abuse, secure accounts, and enforce the Terms of Use; and</li>
        <li>carry out AI or connected-service actions that you explicitly request.</li>
      </ul>
      <p>
        Where a legal basis is required (for example, for individuals in the
        European Economic Area or United Kingdom), our bases are: performance of
        the contract with the team, the consent of the person entering or using
        information, our legitimate interests in providing and securing the
        service, and compliance with legal obligations.
      </p>

      <h2>4. AI features and model providers</h2>
      <p>
        When you invoke an AI feature, the prompt and any relevant context —
        which may include applicant information, workspace content, or uploaded
        files — are sent through the Kilo gateway and may be routed to the
        selected upstream model provider to produce a response. The available
        free models and their providers can change. Kilo’s published privacy
        policy describes prompts being sent to the selected AI provider, and the
        provider’s own terms and privacy practices also apply.
      </p>
      <p>
        Depending on the selected provider and its policies, prompts, files,
        and responses may be retained, reviewed by people, or used to train or
        improve models. Providers and their infrastructure may process this
        information in different countries, including countries outside the
        United States and Canada, potentially including China. We cannot
        promise that every upstream provider has the same retention, training,
        human review, or location practices. Do not submit information to an AI
        feature unless your team is authorized to do so and accepts the
        applicable provider’s terms. AI outputs can be inaccurate and require
        human review; teams must independently verify AI-assisted assessments
        and make their own decisions.
      </p>
      <p>
        Image generation may send the requested image prompt to Pollinations.
        User-configured integrations, including MCP servers and custom model
        providers that a team connects, receive the content needed to perform
        the action you request from them. Review each provider’s current
        terms before connecting or using it. The waiting-room display’s spoken
        announcements are AI-generated audio; we do not record vocal audio from
        users.
      </p>

      <h2>5. Storage, hosting, and international processing</h2>
      <p>
        The operator reports that database and file storage are located in the
        United States and Canada. Application servers may operate in other
        locations. AI and connected-service requests may be processed in the
        countries where those providers or their infrastructure operate. Data
        protection laws may differ between those locations. The following
        services process information for the service:
      </p>
      <ul>
        <li><strong>Supabase:</strong> database and file storage for team records and uploaded files.</li>
        <li><strong>Railway and Render:</strong> production application hosting and runtime infrastructure, and the isolated CAD worker service; server location may vary.</li>
        <li><strong>Replit and GitHub:</strong> development and build workflow and source-code hosting. They are not the production runtime hosts.</li>
        <li><strong>ip-api.com:</strong> receives your IP address to infer approximate city, region, and country for presence and seating-coordination features.</li>
        <li><strong>Maildrop (maildrop.cc):</strong> for teams that enable the team inbox, holds the temporary forwarding mailbox; we store only deduplication records and posted content.</li>
        <li><strong>Kilo and the selected upstream model provider:</strong> AI prompts, relevant context, and files needed to generate a response.</li>
        <li><strong>Pollinations:</strong> image-generation prompts when that feature is used.</li>
        <li><strong>User-connected services:</strong> a connected MCP server or other integration receives information needed for the action a user requests.</li>
      </ul>
      <p>Each provider has its own terms and data practices, which may change.</p>

      <h2>6. Children’s information</h2>
      <p>
        The service does not impose a minimum age, and teams may enter
        information about children of any age. Before entering information about
        a child under 13, the team and its coordinators must obtain any parent
        or guardian notice and consent required by applicable law (including, in
        the United States, the Children’s Online Privacy Protection Act). The
        operator relies on the consent obtained and notices provided by the
        team. We do not knowingly collect information directly from children,
        do not use children’s information for advertising or marketing, and do
        not sell or share children’s information. If you are a parent or
        guardian and want to review, correct, or delete your child’s
        information, ask your team coordinator or use the in-app Feedback /
        Suggestion feature; we will verify the request and the requester’s
        authority before changing team records.
      </p>

      <h2>7. Retention and deletion</h2>
      <p>
        Workspace information is available to users authorized for the relevant
        team or workspace. There is no fixed deletion schedule for all stored
        content. Information may remain in a workspace until a team or its users
        delete it. Operational records, logs, and backups may persist for a
        period of time after deletion; roster and data snapshots a team creates
        are retained until the team deletes them. Team inbox deduplication
        records persist for the life of the team inbox configuration. You can
        ask for information to be corrected or deleted at any time; see “Your
        rights and choices.”
      </p>

      <h2>8. Your rights and choices</h2>
      <p>Subject to applicable law, you may have the right to:</p>
      <ul>
        <li>access the information the service holds about you;</li>
        <li>correct inaccurate or incomplete information;</li>
        <li>delete information, subject to legal or operational retention needs;</li>
        <li>receive a portable copy of information you provided;</li>
        <li>object to or restrict certain processing, or withdraw consent where processing is based on consent; and</li>
        <li>complain to a data protection authority.</li>
      </ul>
      <p>
        To exercise any of these rights, use the in-app Feedback / Suggestion
        feature or ask your team coordinator. Applicants and parents or
        guardians without a workspace account should ask the coordinator who
        provided the workspace; the coordinator may need to verify your identity
        and authority before changing team records. We respond within a
        reasonable time and do not charge for reasonable requests. We will not
        discriminate against you for exercising your rights. Workspace users
        control most of their own workspace content directly in the app and can
        delete or edit it there at any time.
      </p>

      <h2>9. California residents</h2>
      <p>
        If you are a California resident, the California Consumer Privacy Act,
        as amended by the California Privacy Rights Act, gives you the rights
        described in “Your rights and choices,” including the right to know the
        categories of personal information collected, the purposes for
        collection, and to request deletion, correction, and portability. In the
        last 12 months we have collected: identifiers (such as name, display
        name, IP address, account and session identifiers); education and
        professional information (such as grade, role, and team membership);
        internet or other electronic network activity (pages visited and
        timestamps, feature usage, diagnostics); and inferences drawn from that
        activity (such as AI-generated scores or productivity assessments).
        <strong> We do not sell or share your personal information</strong> for
        cross-context behavioral advertising, and we do not knowingly sell or
        share the personal information of minors. We do not collect or process
        sensitive personal information for purposes beyond those reasonably
        necessary to provide the service or, where applicable, those you direct.
      </p>

      <h2>10. Cookies, local storage, and security</h2>
      <p>
        The service uses signed, HTTP-only session cookies to keep you signed
        in and browser storage (such as local storage) for preferences like
        theme, density, and assistant tool settings. We do not use advertising
        or cross-site tracking cookies. Presence information is recorded to
        coordinate shared workspaces and is visible to your team’s coordinators.
      </p>
      <p>
        We use reasonable access controls and security measures, including TLS
        encryption in transit, signed session cookies, hashed passwords,
        passkeys where supported, per-team data isolation, and row-level
        security on the database. No online service can guarantee absolute
        security. If you believe your account has been compromised, change your
        password immediately and notify your coordinator. To report a
        suspected vulnerability, use Feedback / Suggestion with the details.
      </p>

      <h2>11. Information in your workspace</h2>
      <p>
        Workspace content is visible to the people your team authorizes, which
        may include other users of your team. The waiting-room display and
        big-screen features show only names, grades, lanes, and announcement
        copy and are designed never to expose emails, transcripts, notes, or AI
        concerns. Do not put information in a workspace unless you are
        comfortable with those people seeing it, and do not enter information
        you lack permission to enter.
      </p>

      <h2>12. Third-party links and changes to this policy</h2>
      <p>
        The service links to third-party sites and services, which have their
        own policies. This policy may change as the service or its providers
        change; the “Last updated” date above will be revised when it does, and
        material changes will be announced in the app. Continued use after a
        change means you accept the revised policy to the extent permitted by
        law. Questions about this policy: use Feedback / Suggestion in the app,
        or ask your team coordinator.
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
        service, you agree to these terms and to the{" "}
        <a href="/privacy">Privacy Policy</a>, which is incorporated by
        reference. These terms are effective as of {updatedDate} and are
        maintained as the operative terms of use for the service. If you do not
        agree, do not use the service.
      </p>

      <h2>1. Eligibility, minors, and team responsibility</h2>
      <p>
        The service does not impose a minimum age. If you are a minor, use it
        only with any parent or guardian permission required by applicable law.
        Teams and coordinators are responsible for ensuring they have authority
        to submit applicant information, including information about children,
        and for obtaining any notices or permissions required by law (including
        verifiable parental consent for information about children under 13, as
        described in the Privacy Policy). If you are a parent or guardian and
        do not consent, tell your team and do not permit the entry of your
        child’s information.
      </p>

      <h2>2. Accounts and acceptable use</h2>
      <p>
        Keep access codes, passwords, and sessions secure; you are responsible
        for activity performed through your account. Give us accurate
        information about yourself and your team, and do not impersonate
        anyone. Do not use the service to violate laws or others’ rights;
        access another team’s data without authorization; interfere with the
        service, its infrastructure, or other users; upload malicious,
        infringing, or misleading content; harvest or scrape others’
        information; or use the service for employment, eligibility, or other
        decisions without independent human review.
      </p>

      <h2>3. Your content</h2>
      <p>
        You or your team retain rights to content you provide. You grant the
        operator a non-exclusive, worldwide, royalty-free license to host,
        store, reproduce, transmit, and process that content as reasonably
        needed to provide, secure, and maintain the service, including sending
        relevant content to AI model providers or external integrations when
        you use those features. You confirm that you have the rights and
        permissions needed to provide that content and to authorize those uses.
        Feedback and feature suggestions you submit may be used by the operator
        without restriction, to improve the service. The operator is a host of
        team-provided content, not its author, verifier, endorser, or guarantor;
        the accuracy, legality, and quality of content are the responsibility of
        the team that provided it.
      </p>

      <h2>4. AI features</h2>
      <p>
        AI responses, summaries, scores, recommendations, and generated content
        may be incomplete, inaccurate, biased, or unsuitable for a particular
        purpose. They are not legal, medical, educational, employment, or other
        professional advice and must not replace human judgment. Teams must
        independently review AI-assisted assessments and make decisions
        themselves. AI requests may be routed through Kilo to different
        upstream model providers, which may have different terms, data
        practices, retention periods, training uses, human review practices,
        and processing locations. Review the provider’s terms and avoid
        submitting data you are not authorized to share. External integrations,
        including MCP servers you connect, are provided by third parties and
        are subject to their own terms.
      </p>

      <h2>5. Team inbox</h2>
      <p>
        If your team enables the team inbox, email sent or forwarded to the
        team’s Maildrop address from approved-sender addresses will be posted
        into the team’s shared chat, and sender, subject, and message
        identifiers will be stored for deduplication. Your team is responsible
        for maintaining its approved-sender list, for telling senders how their
        email will be used, and for the content of what it approves. The
        operator is not responsible for the content of emails approved by a
        team or for how teams use them.
      </p>

      <h2>6. Fees, availability, and service changes</h2>
      <p>
        The service currently has no paid plans or in-app payments. Features,
        providers, or availability may change at any time, and the service may
        be discontinued. The service is provided without an uptime guarantee or
        support obligation. The operator retains rights in the service’s
        software, branding, and design; these terms do not transfer ownership
        of those materials to users.
      </p>

      <h2>7. Suspension and termination</h2>
      <p>
        Access may be suspended or ended if these terms are violated, the
        service is discontinued, or continued access creates a security or
        legal risk. Where practicable, the operator will give notice before or
        promptly after suspension. You should keep copies of important content.
        Deleting content from the workspace may not immediately remove
        operational logs or backup copies, and team inbox deduplication
        records persist as described in the Privacy Policy. You may stop using
        the service at any time. Ask your team coordinator to close your access
        or to handle team data you no longer need.
      </p>

      <h2>8. Disclaimer of warranties</h2>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED “AS
        IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT, AND WITHOUT ANY
        WARRANTY THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR
        SUITABLE FOR YOUR PURPOSE. AI AND OTHER GENERATED OUTPUTS ARE PROVIDED
        WITHOUT ANY WARRANTY OF ACCURACY OR RELIABILITY.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        THE SERVICE IS FREE OF CHARGE, IS PROVIDED “AS IS,” AND IS NOT INTENDED
        FOR BUSINESS-CRITICAL OR SAFETY-CRITICAL DATA. YOU USE IT AT YOUR OWN
        RISK AND MUST MAINTAIN YOUR OWN BACKUPS OF ANYTHING YOU CARE ABOUT.
      </p>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW: (A) THE OPERATOR WILL NOT BE
        LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
        PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST DATA, LOSS OF GOODWILL,
        OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO THE SERVICE,
        WHETHER BASED ON CONTRACT, TORT (INCLUDING NEGLIGENCE), STATUTE, OR
        ANY OTHER THEORY, EVEN IF THE OPERATOR HAS BEEN ADVISED OF THE
        POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p>
        (B) THE OPERATOR’S TOTAL CUMULATIVE LIABILITY FOR ALL CLAIMS ARISING
        OUT OF OR RELATED TO THE SERVICE WILL NOT EXCEED THE AMOUNTS YOU PAID
        TO THE OPERATOR FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE
        EVENT GIVING RISE TO THE CLAIM. THE SERVICE IS PROVIDED WITHOUT
        CHARGE, SO THAT AMOUNT IS $0.00. NO OTHER OR GREATER AMOUNT WILL BE
        OWED OR PAYABLE BY THE OPERATOR UNDER ANY THEORY, INCLUDING FOR ANY
        UNAUTHORIZED ACCESS TO, OR LOSS, DESTRUCTION, DISCLOSURE, OR THEFT OF,
        YOUR DATA OR ANY DATA STORED OR TRANSMITTED THROUGH THE SERVICE.
      </p>
      <p>
        (C) NOTHING IN THESE TERMS LIMITS OR EXCLUDES LIABILITY THAT CANNOT
        LAWFULLY BE LIMITED OR EXCLUDED, INCLUDING, WHERE APPLICABLE LAW SO
        REQUIRES, LIABILITY FOR GROSS NEGLIGENCE, WILLFUL MISCONDUCT, OR
        INTENTIONAL WRONGFUL ACTS. THOSE CLAIMS ARE LIMITED ONLY TO THE
        SMALLEST EXTENT THE LAW PERMITS. SOME JURISDICTIONS DO NOT ALLOW
        CERTAIN LIMITATIONS; IN THOSE JURISDICTIONS THIS SECTION APPLIES ONLY
        TO THE EXTENT PERMITTED.
      </p>
      <p>
        (D) THESE LIMITS OF LIABILITY REFLECT THE NO-FEE NATURE OF THE
        SERVICE AND ARE AN ESSENTIAL BASIS OF THE BARGAIN BETWEEN YOU AND THE
        OPERATOR. WITHOUT THESE LIMITS, THE OPERATOR WOULD NOT PROVIDE THE
        SERVICE.
      </p>

      <h2>10. Indemnification</h2>
      <p>
        To the extent permitted by law, you will indemnify and hold the
        operator harmless from claims, damages, and reasonable costs arising
        out of: your content, your use of the service, your violation of these
        terms or applicable law, your team’s failure to obtain required
        notices or consents (including parental consent for children under 13),
        or your infringement of anyone’s rights.
      </p>

      <h2>11. Governing law and venue</h2>
      <p>
        These terms and any dispute arising from them or from the service are
        governed by and construed under the laws of the jurisdiction in which
        the operator is located, without regard to conflict-of-law principles.
        You and the operator agree to the exclusive jurisdiction of the courts
        located in that same jurisdiction for any such dispute, unless a
        mandatory law at your place of residence provides otherwise. Nothing in
        these terms limits rights or responsibilities that cannot legally be
        limited.
      </p>

      <h2>12. General</h2>
      <p>
        These terms, together with the Privacy Policy, are the entire agreement
        between you and the operator about the service. If any provision is
        held unenforceable, the rest remains in effect. The operator’s failure
        to enforce a provision is not a waiver of it. Neither party may assign
        these terms without the other’s consent, except that the operator may
        assign them in connection with a reorganization or transfer of the
        service. Neither party is liable for delays caused by events beyond
        its reasonable control. These terms do not create a partnership, agency,
        or employment relationship.
      </p>

      <h2>13. Changes and questions</h2>
      <p>
        These terms may be updated as the service changes. Material changes
        will be announced in the app; the “Last updated” date above will be
        revised. Continued use after an update means you accept the revised
        terms to the extent permitted by law. Questions: use the in-app
        Feedback / Suggestion feature, or ask your team coordinator.
      </p>
    </LegalShell>
  );
}
