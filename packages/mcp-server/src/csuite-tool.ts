// ─── C-Suite Analysis Tool ────────────────────────────────────────────────────
// Runs a business scenario through multiple executive perspectives simultaneously.
// Pure local computation - no API calls, no external deps.

export type CsuiteRole =
  | "CEO" | "COO" | "CTO" | "CFO" | "CMO" | "CIO"
  | "CHRO" | "CDO" | "CPO" | "CSO" | "CCO" | "CAIO";

export type AnalysisDepth = "quick" | "standard" | "deep";

export interface PerspectiveResult {
  role: CsuiteRole;
  title: string;
  assessment: string;
  risks: string[];
  opportunities: string[];
  recommendation: string;
  confidence: "low" | "medium" | "high";
  priority_flags: string[];
}

export interface ConsensusResult {
  overall_recommendation: string;
  confidence: "low" | "medium" | "high";
  agreement_points: string[];
  disagreement_points: string[];
  critical_path: string;
  watch_list: string[];
}

export interface CsuiteAnalysisResult {
  scenario: string;
  context?: string;
  depth: AnalysisDepth;
  perspectives_analyzed: number;
  perspectives: PerspectiveResult[];
  consensus: ConsensusResult;
}

// ─── Role metadata ─────────────────────────────────────────────────────────────

const ROLE_META: Record<CsuiteRole, { title: string; lens: string }> = {
  CEO:  { title: "Chief Executive Officer",       lens: "strategy, vision, competitive positioning, risk appetite" },
  COO:  { title: "Chief Operating Officer",       lens: "operational feasibility, resource allocation, process impact, scalability" },
  CTO:  { title: "Chief Technology Officer",      lens: "technical complexity, tech debt, architecture, build vs buy" },
  CFO:  { title: "Chief Financial Officer",       lens: "financial impact, ROI, cash flow, budget, runway" },
  CMO:  { title: "Chief Marketing Officer",       lens: "market positioning, brand impact, customer perception, growth" },
  CIO:  { title: "Chief Information Officer",     lens: "information systems, data strategy, digital transformation, integration" },
  CHRO: { title: "Chief Human Resources Officer", lens: "people impact, hiring, culture fit, organizational change" },
  CDO:  { title: "Chief Data Officer",            lens: "data governance, analytics opportunity, compliance, data ethics" },
  CPO:  { title: "Chief Product Officer",         lens: "product-market fit, UX, feature prioritization, roadmap impact" },
  CSO:  { title: "Chief Security Officer",        lens: "security implications, threat vectors, compliance, risk mitigation" },
  CCO:  { title: "Chief Customer Officer",        lens: "customer impact, support burden, satisfaction, retention" },
  CAIO: { title: "Chief AI Officer",              lens: "AI/automation opportunity, model feasibility, AI ethics, competitive AI landscape" },
};

// ─── Keyword signal extraction ──────────────────────────────────────────────────

function extractSignals(text: string): Set<string> {
  const t = text.toLowerCase();
  const signals = new Set<string>();

  // Cost/financial signals
  if (/\b(cost|price|budget|spend|invest|fund|revenue|profit|margin|burn|runway|roi|payback|expense|savings|capital)\b/.test(t))
    signals.add("financial");

  // Growth/scale signals
  if (/\b(scale|grow|expand|launch|enter|market|acquire|onboard|users?|customers?|revenue|sales)\b/.test(t))
    signals.add("growth");

  // Technical/build signals
  if (/\b(build|develop|engineer|code|system|platform|api|infrastructure|stack|migrate|legacy|refactor|deploy|architecture)\b/.test(t))
    signals.add("technical");

  // People/org signals
  if (/\b(hire|team|headcount|culture|layoff|restructure|remote|office|morale|talent|staff|employees?|org|department|manager)\b/.test(t))
    signals.add("people");

  // Security/compliance signals
  if (/\b(security|compliance|privacy|gdpr|hipaa|audit|breach|vulnerability|access|permissions?|regulation|legal|risk|liability)\b/.test(t))
    signals.add("security");

  // Data/AI signals
  if (/\b(data|analytics?|model|ai|machine learning|ml|llm|automat|predict|insight|dashboard|report|metric)\b/.test(t))
    signals.add("data_ai");

  // Customer signals
  if (/\b(customer|user|client|churn|nps|support|satisfaction|onboard|experience|retention|feedback|complaint)\b/.test(t))
    signals.add("customer");

  // Product signals
  if (/\b(feature|product|roadmap|release|launch|mvp|iteration|sprint|backlog|priorit|ux|design|interface)\b/.test(t))
    signals.add("product");

  // Speed/urgency signals
  if (/\b(urgent|deadline|asap|fast|quick|immediately|now|today|timeline|delay|behind|schedule)\b/.test(t))
    signals.add("urgency");

  // Third-party/vendor signals
  if (/\b(vendor|partner|outsource|contract|saas|tool|integrate|buy|procure|third.party)\b/.test(t))
    signals.add("vendor");

  // Risk signals
  if (/\b(risk|uncertain|unknown|complex|difficult|challenge|problem|issue|blocker|concern|danger)\b/.test(t))
    signals.add("risk");

  // Revenue impact signals
  if (/\b(revenue|monetize|pricing|subscription|tier|freemium|enterprise|deal|contract|upsell|conversion)\b/.test(t))
    signals.add("revenue");

  return signals;
}

// ─── Depth helpers ─────────────────────────────────────────────────────────────

function pick(depth: AnalysisDepth, quick: string[], standard: string[], deep: string[]): string[] {
  if (depth === "quick") return quick;
  if (depth === "standard") return standard;
  return deep;
}

// ─── Per-role analysis generators ─────────────────────────────────────────────

function analyzeCEO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasGrowth = signals.has("growth");
  const hasRisk = signals.has("risk");
  const hasFinancial = signals.has("financial");
  const hasTech = signals.has("technical");

  const risks = pick(depth,
    ["Strategic misalignment with core mission", "Competitor response or market preemption"],
    [
      "Potential drift from core strategic thesis",
      "Competitor response or first-mover counter",
      "Stakeholder confidence impact if execution stumbles",
      hasFinancial ? "Capital allocation trade-off vs other strategic priorities" : "Opportunity cost against existing roadmap commitments",
    ],
    [
      "Strategic coherence risk - does this reinforce or dilute our positioning?",
      "Competitor preemption or copycat erosion of any advantage",
      "Stakeholder confidence and board alignment",
      "Second-order effects on adjacent business lines",
      hasRisk ? "Downside scenario: what does failure cost strategically, not just financially?" : "Reversibility: can we unwind this if the thesis proves wrong?",
      hasTech ? "Platform dependency risk if this creates a technical moat owned by one vendor or team" : "Execution dependency risk on key people or single points of failure",
    ]
  );

  const opportunities = pick(depth,
    ["Competitive differentiation", "New market or revenue vector"],
    [
      hasGrowth ? "Accelerate market share capture in an underserved segment" : "Extend leadership position in current market",
      "Create a defensible moat or switching cost",
      hasTech ? "Technical lead that compounds over time" : "Operational efficiency that widens margin advantage",
      "Narrative and positioning lift for investors, talent, and press",
    ],
    [
      hasGrowth ? "Land-and-expand into adjacent markets with lower CAC" : "Deepen penetration in the core market with a new wedge",
      "Build compounding strategic advantage that is hard to copy",
      "Reframe the competitive conversation on our terms",
      "Create an ecosystem lock-in effect or network value",
      "Unlock a new partnership or M&A leverage point",
      hasFinancial ? "Demonstrate capital efficiency to improve valuation story" : "Attract top-tier talent through visible innovation leadership",
    ]
  );

  const confidence = (hasGrowth && !hasRisk) ? "high" : hasRisk ? "medium" : "high";

  return {
    role: "CEO",
    title: ROLE_META.CEO.title,
    assessment: `From a strategic standpoint, this decision needs to pass three tests: (1) does it strengthen competitive position, (2) does it align with the long-term vision, and (3) does the risk/reward ratio justify the resource commitment? ${hasTech ? "The technical dimension here is a strategic asset or liability depending on execution." : ""} ${hasFinancial ? "The financial profile of this move will shape stakeholder confidence either way." : ""} The CEO lens asks not just whether this is viable, but whether it is the *right* move at the *right* time given everything else in motion.${focus === "growth" ? " Growth framing should be validated against unit economics, not just topline." : focus === "risk" ? " Risk appetite for this should be benchmarked against what the company can absorb without destabilizing core operations." : ""}`,
    risks,
    opportunities,
    recommendation: hasRisk
      ? "Proceed with a staged commitment: validate key assumptions with a time-boxed pilot before full resource allocation."
      : "Move forward with clear ownership, a defined success metric, and a 90-day review checkpoint.",
    confidence,
    priority_flags: [
      ...(hasRisk ? ["Define the kill switch criteria before starting"] : []),
      ...(hasGrowth ? ["Validate ICP fit before scaling spend"] : []),
      "Align leadership team on the strategic rationale before any external announcement",
    ],
  };
}

function analyzeCOO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasUrgency = signals.has("urgency");
  const hasPeople = signals.has("people");
  const hasTech = signals.has("technical");
  const hasVendor = signals.has("vendor");

  const risks = pick(depth,
    ["Operational capacity strain", "Process gaps under increased load"],
    [
      "Team bandwidth overextension if this runs in parallel with existing commitments",
      "Process gaps exposed when volume or complexity increases",
      hasVendor ? "Vendor dependency introducing SLA risk into the critical path" : "Coordination overhead between teams slowing delivery",
      hasPeople ? "Change fatigue if the org has absorbed too many shifts recently" : "Undocumented processes that break under scrutiny",
    ],
    [
      "Capacity ceiling: do we have the operational bandwidth to absorb this without degrading core delivery?",
      "Handoff and coordination failures in cross-functional execution",
      hasVendor ? "Vendor SLA vs internal SLA mismatch creating accountability gaps" : "Process documentation debt that compounds as we scale",
      hasPeople ? "Attrition risk among key ops staff who bear the execution burden" : "Knowledge concentration in one team or individual",
      "Quality drift when teams are stretched across multiple priorities",
      hasUrgency ? "Rushed implementation creating technical or process debt paid later" : "Scope creep after kickoff if the brief is not locked",
    ]
  );

  const opportunities = pick(depth,
    ["Force process standardization and documentation", "Identify automation potential"],
    [
      "Force standardization and documentation of currently ad-hoc processes",
      "Identify bottlenecks that limit throughput - and fix them under this initiative",
      hasVendor ? "Evaluate whether vendor can absorb capacity spikes better than internal build" : "Build repeatable playbooks that scale without proportional headcount growth",
      "Improve cross-team coordination structures that benefit all future projects",
    ],
    [
      "Use this as a forcing function to clean up operational tech debt",
      "Build scalable process infrastructure: runbooks, SLAs, escalation paths",
      hasVendor ? "Negotiate favorable terms now while vendor needs our business" : "Create a center-of-excellence model that multiplies output without linear cost",
      "Establish metrics and dashboards that give leadership real-time operational visibility",
      "Cross-train teams to reduce single-person dependencies",
      "Identify and eliminate the top 3 friction points in the current operating model",
    ]
  );

  return {
    role: "COO",
    title: ROLE_META.COO.title,
    assessment: `The operational lens here focuses on execution realism. Before committing, three questions: (1) What gets de-prioritized to make room for this? (2) What breaks first if load doubles? (3) Who owns this end-to-end with no ambiguity? ${hasUrgency ? "The urgency signal in this scenario creates execution pressure - rushed implementation creates operational debt that is painful to unwind." : ""} ${hasPeople ? "People are the constraint here - plan for capacity before announcing timelines." : "Process is the constraint - the system needs to be ready before the traffic arrives."}${focus === "cost" ? " COO perspective: the true cost includes the operational drag on teams already running at capacity." : ""}`,
    risks,
    opportunities,
    recommendation: hasPeople
      ? "Assign a dedicated operational lead with clear authority before any work begins. Do not let this float across teams."
      : "Map the operational dependencies first, then work backwards from the required outcome to set a realistic timeline.",
    confidence: hasUrgency ? "medium" : "high",
    priority_flags: [
      "Assign a single DRI (directly responsible individual) before kickoff",
      ...(hasPeople ? ["Audit team capacity before committing to a timeline"] : []),
      ...(hasVendor ? ["Validate vendor SLA against your operational requirements"] : []),
    ],
  };
}

function analyzeCTO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasTech = signals.has("technical");
  const hasVendor = signals.has("vendor");
  const hasDataAI = signals.has("data_ai");
  const hasSecurity = signals.has("security");

  const risks = pick(depth,
    ["Technical debt accumulation", "Integration complexity underestimated"],
    [
      "Architectural coupling that limits future optionality",
      hasTech ? "Underestimating integration complexity - especially with legacy systems" : "Technology choice that becomes a liability as requirements evolve",
      "Engineering capacity cannibalization affecting existing roadmap",
      hasVendor ? "Vendor lock-in reducing negotiating power and increasing switching cost" : "Build path underestimating long-term maintenance burden",
    ],
    [
      "Architectural decisions made under time pressure that constrain future direction",
      hasTech ? "Hidden integration complexity: legacy system impedance, API contracts, data format mismatches" : "Technology selection driven by familiarity rather than fit-for-purpose analysis",
      "Engineering team context-switching cost - the real cost is invisible in velocity metrics",
      hasVendor ? "Vendor lock-in: once embedded, switching cost often exceeds original build cost" : "Internal build underestimating operational surface area (monitoring, alerting, scaling, on-call)",
      "Tech debt accrual during fast-build phases that blocks future features",
      hasSecurity ? "Security surface area expansion that security team hasn't scoped yet" : "Observability gaps that make production incidents hard to diagnose",
    ]
  );

  const opportunities = pick(depth,
    ["Modernize architecture on the back of this investment", "Build reusable infrastructure"],
    [
      "Use this initiative to pay down architectural debt in the affected surface",
      hasVendor ? "Evaluate buy vs build with a clear 3-year TCO model before defaulting to build" : "Build shared platform capabilities that benefit multiple future features",
      hasDataAI ? "Instrument the system for data capture that unlocks future AI/ML capability" : "Introduce abstraction layers that increase future flexibility",
      "Raise the engineering team's capability through exposure to new problem domains",
    ],
    [
      "Rebuild the affected system components on a cleaner architecture using this as justification",
      hasVendor ? "Negotiate a build-vs-buy inflection point: buy now, build later when the volume justifies it" : "Build internal platform capabilities that create compounding leverage across teams",
      hasDataAI ? "Design for data observability from day one - instrument everything, aggregate later" : "Establish clear API contracts and service boundaries that prevent future coupling",
      "Create internal tooling that improves developer experience and reduces toil",
      "Use this as a reference implementation for future architectural standards",
      "Invest in testing infrastructure so this can ship fast without quality regression",
    ]
  );

  return {
    role: "CTO",
    title: ROLE_META.CTO.title,
    assessment: `Technical assessment requires separating the build complexity from the integration complexity - they are different problems. ${hasVendor ? "The build-vs-buy question deserves a disciplined 3-year TCO analysis including migration cost, vendor risk, and the opportunity cost of not building in-house." : "The in-house build path needs honest capacity accounting - not just initial dev time but ongoing ops burden."} ${hasTech ? "The technical surface area here is non-trivial. Architecture decisions made now will constrain options 18-24 months out." : "The technology dimension is secondary to the data and integration challenges."} ${hasDataAI ? "AI/ML features require data infrastructure that is often more work than the model itself." : ""}${focus === "risk" ? " From a technical risk standpoint, the biggest danger is unknown unknowns in system integration - budget for discovery time." : ""}`,
    risks,
    opportunities,
    recommendation: hasVendor
      ? "Run a build-vs-buy evaluation with a strict 30-day timeframe. Include 3-year TCO, vendor stability, and data portability in the criteria."
      : "Prototype the highest-uncertainty component first. De-risk the architectural unknowns before committing the full team.",
    confidence: hasTech ? "medium" : "high",
    priority_flags: [
      ...(hasTech ? ["Schedule a technical spike to validate the highest-uncertainty assumption"] : []),
      ...(hasVendor ? ["Run buy-vs-build analysis before any engineering starts"] : []),
      ...(hasSecurity ? ["Loop in security team before architecture is finalized"] : []),
      "Define the performance and scale requirements before any implementation begins",
    ],
  };
}

function analyzeCFO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasFinancial = signals.has("financial");
  const hasGrowth = signals.has("growth");
  const hasRevenue = signals.has("revenue");

  const risks = pick(depth,
    ["ROI timeline longer than projected", "Budget overrun from scope creep"],
    [
      "ROI timeline extending beyond planning horizon, creating a funding gap",
      hasGrowth ? "Customer acquisition cost (CAC) rising as the channel scales" : "Costs front-loaded before revenue materializes",
      "Budget overrun from scope expansion during execution",
      "Cash flow impact if upfront investment is larger than projected",
    ],
    [
      "Payback period extending: initial ROI models are almost always optimistic, budget for a 30% overrun",
      hasGrowth ? "CAC inflation as early-channel efficiency doesn't hold at scale" : "Revenue recognition timing mismatch with cost outflow",
      "Hidden costs: integration, training, change management, and ongoing ops are routinely underestimated",
      "Opportunity cost: capital and people deployed here are unavailable for alternatives with potentially better returns",
      hasRevenue ? "Revenue leakage through pricing model weaknesses exposed at scale" : "Margin compression if this creates ongoing variable costs without matching revenue",
      "Foreign exchange or contractual risk if vendors or customers are in multiple currencies",
    ]
  );

  const opportunities = pick(depth,
    ["New revenue stream or cost reduction", "Improved unit economics at scale"],
    [
      hasRevenue ? "New revenue stream with incremental margins above current blended average" : "Cost reduction through process automation or vendor consolidation",
      "Improved unit economics as fixed costs amortize across larger volume",
      "Valuation multiple expansion if this moves the company into a higher-value category",
      "Financial data and instrumentation gaps closed, improving forecasting accuracy",
    ],
    [
      hasRevenue ? "Land a new revenue stream with expansion potential and favorable margin profile" : "Structural cost reduction that persists and compounds over time",
      "Unit economics improvement: lower CAC, higher LTV, or both",
      "Reduce revenue concentration risk by diversifying customer base or revenue streams",
      "Financial leverage: use this initiative to renegotiate terms with existing vendors",
      "Demonstrate capital efficiency that improves investor confidence and valuation story",
      "Create financial visibility into a previously opaque cost or revenue area",
    ]
  );

  const confidence = hasFinancial ? "high" : "medium";

  return {
    role: "CFO",
    title: ROLE_META.CFO.title,
    assessment: `The financial framing is straightforward: what is the IRR, what is the payback period, and how does it compare to alternative uses of capital? ${hasFinancial ? "The financial signals in this scenario suggest costs and revenues are both in play - the model needs to be stress-tested under pessimistic assumptions, not just base case." : "Financial impact needs to be modeled explicitly - vague revenue potential is not a financial case."} ${hasGrowth ? "Growth initiatives have a habit of consuming more capital than forecast once CAC at scale is properly modeled." : ""} The CFO view is not just about saying no - it is about making sure the financial case is honest and the downside is bounded.${focus === "cost" ? " Cost focus: map all cost components including hidden ops and integration overhead before approving any budget." : focus === "growth" ? " Growth investment should be tied to specific unit economics targets, not just topline." : ""}`,
    risks,
    opportunities,
    recommendation: "Build a financial model with three scenarios (optimistic, base, pessimistic) before approving budget. Tie any go-ahead to specific financial milestones that trigger continued investment.",
    confidence,
    priority_flags: [
      "Model the downside scenario, not just base case",
      ...(hasGrowth ? ["Validate unit economics (CAC, LTV, payback) before scaling spend"] : []),
      "Define financial success metrics and review cadence upfront",
      ...(hasRevenue ? ["Confirm revenue recognition timing with accounting before committing"] : []),
    ],
  };
}

function analyzeCMO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasGrowth = signals.has("growth");
  const hasCustomer = signals.has("customer");
  const hasRevenue = signals.has("revenue");

  const risks = pick(depth,
    ["Brand dilution or mixed message in market", "Misaligned customer expectations"],
    [
      "Brand message dilution if this creates mixed signals about who we are and who we serve",
      hasCustomer ? "Customer expectation mismatch leading to dissatisfaction at launch" : "Market confusion about the positioning of the new offering vs existing",
      "Competitive response copying the idea faster or cheaper",
      hasRevenue ? "Pricing strategy conflict between new and existing revenue streams" : "Demand generation gap - feature exists but no one knows about it",
    ],
    [
      "Brand coherence risk: each new initiative either reinforces or fragments the brand narrative",
      hasCustomer ? "Customer journey disruption if this changes how people discover, try, or buy" : "Market positioning ambiguity - is this for existing customers, new segments, or both?",
      "Channel conflict if this competes with or undercuts existing revenue paths",
      "Competitive response: incumbents with more resources can clone quickly if the differentiation is shallow",
      "Launch narrative problem: if we can't explain it simply, market adoption will be slow",
      hasRevenue ? "Revenue attribution confusion across marketing and sales as new streams complicate the funnel" : "Content and campaign strategy build time often underestimated in launch plans",
    ]
  );

  const opportunities = pick(depth,
    ["New growth channel or audience segment", "Brand positioning lift"],
    [
      hasGrowth ? "Reach a new audience segment currently outside the funnel" : "Deepen engagement and value perception with existing customers",
      "Sharpen the brand story with a concrete, demonstrable proof point",
      "Create content and PR moments that generate organic reach",
      hasRevenue ? "Expand revenue per customer through a new pricing tier or add-on" : "Increase conversion by addressing a specific objection or barrier to purchase",
    ],
    [
      hasGrowth ? "Open a new acquisition channel with better economics than existing ones" : "Create a flywheel: customers become advocates, reducing paid acquisition dependency",
      "Establish category leadership by defining the terms of the conversation",
      "Generate high-quality content marketing assets from the initiative itself",
      "Build community around the new capability, creating ongoing engagement and retention",
      hasRevenue ? "Launch a premium tier or upsell path that monetizes existing engaged users" : "Use launch as a re-engagement moment for lapsed or dormant customers",
      "Create a competitive moat through brand association with the problem being solved",
    ]
  );

  return {
    role: "CMO",
    title: ROLE_META.CMO.title,
    assessment: `Marketing perspective: positioning and timing are as important as the product decision itself. ${hasGrowth ? "Growth requires both reaching new people and converting them - both halves need a plan." : "Deepening existing customer value is often more capital-efficient than acquiring new ones."} ${hasCustomer ? "The customer experience around this needs to be mapped end-to-end - acquisition is only the first step." : ""} The CMO lens is not just about campaigns - it is about making sure the market story is coherent, the launch has a hook, and the narrative reinforces strategic positioning rather than muddying it.${focus === "growth" ? " Growth lens: every marketing dollar should be tied to a measurable acquisition or retention outcome." : ""}`,
    risks,
    opportunities,
    recommendation: hasGrowth
      ? "Run a positioning workshop before launch. Define the ICP, the one-line value prop, and the differentiation proof point before building any campaigns."
      : "Develop the customer narrative first, then work backwards to the feature messaging. Customers buy outcomes, not features.",
    confidence: hasCustomer ? "high" : "medium",
    priority_flags: [
      "Define the target audience and messaging hierarchy before building any assets",
      ...(hasGrowth ? ["Map the full funnel: awareness, consideration, conversion, and retention"] : []),
      "Align sales and marketing on qualification criteria and handoff process",
    ],
  };
}

function analyzeCIO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasTech = signals.has("technical");
  const hasDataAI = signals.has("data_ai");
  const hasVendor = signals.has("vendor");
  const hasSecurity = signals.has("security");

  const risks = pick(depth,
    ["Integration complexity with existing systems", "Data silos created"],
    [
      "Integration debt: new systems rarely integrate cleanly with existing ones on first attempt",
      hasDataAI ? "Data fragmentation creating inconsistent reporting and analytics" : "Shadow IT emerging if official systems don't serve user needs",
      hasVendor ? "Vendor interoperability gaps discovered post-contract" : "Legacy system compatibility constraints limiting what is actually buildable",
      "Digital transformation initiative fatigue if users have been through too many system changes",
    ],
    [
      "Systems integration complexity: every new system touches multiple existing ones in non-obvious ways",
      hasDataAI ? "Data governance breakdown if new data flows are not mapped and managed from day one" : "Information architecture inconsistency creating long-term analytical confusion",
      "User adoption failure: technically correct systems that no one uses create zombie infrastructure",
      hasVendor ? "Vendor ecosystem fragmentation increasing total maintenance burden" : "Internal build creating a long-lived system that becomes next year's legacy problem",
      "API contract brittleness: undocumented or informal integrations break silently",
      hasSecurity ? "Access control complexity when new systems add new permission surfaces" : "Disaster recovery and business continuity gaps in new system design",
    ]
  );

  const opportunities = pick(depth,
    ["Modernize information architecture", "Consolidate tools and reduce platform sprawl"],
    [
      "Consolidate fragmented tools into a more coherent information architecture",
      hasDataAI ? "Create a unified data layer that serves analytics, AI, and operations from one source" : "Standardize APIs and integration patterns that benefit all future system work",
      "Reduce IT support burden through better tooling and automation",
      hasVendor ? "Renegotiate the vendor landscape for better pricing and fewer contracts" : "Build internal capability that reduces external dependency over time",
    ],
    [
      "Use this as a catalyst to modernize the information architecture across the affected domain",
      hasDataAI ? "Implement a data mesh or data fabric approach that enables real-time analytics at scale" : "Establish an enterprise integration layer that standardizes how systems communicate",
      "Reduce platform sprawl by consolidating overlapping tools during the transition",
      "Build an internal developer platform that improves velocity for all future digital initiatives",
      "Create a knowledge management layer on top of systems so institutional knowledge survives turnover",
      "Establish clear data ownership and stewardship roles as a structural improvement",
    ]
  );

  return {
    role: "CIO",
    title: ROLE_META.CIO.title,
    assessment: `The information systems lens asks: how does this fit in the existing architecture, what integration work is needed, and what are the data governance implications? ${hasTech ? "Technical implementation here carries significant integration risk - the real complexity is almost always in the connections between systems, not the systems themselves." : ""} ${hasDataAI ? "Data strategy needs to be designed before implementation begins, not retrofitted after." : ""} ${hasVendor ? "New vendor additions increase the total ecosystem complexity - evaluate whether this adds net capability or just net maintenance cost." : ""} The CIO perspective is about long-term information coherence, not just whether the immediate system works.${focus === "risk" ? " Information risk: unmanaged data flows and undocumented integrations are the most common source of operational incidents." : ""}`,
    risks,
    opportunities,
    recommendation: hasTech
      ? "Conduct an integration mapping exercise before procurement or build begins. Identify every touchpoint with existing systems and quantify the integration cost."
      : "Define the information architecture requirements before selecting a solution. The solution must fit the architecture, not the other way around.",
    confidence: "medium",
    priority_flags: [
      "Map all integration touchpoints before committing to any solution",
      ...(hasDataAI ? ["Define data ownership and governance model on day one"] : []),
      ...(hasSecurity ? ["Include information security in the architecture review"] : []),
    ],
  };
}

function analyzeCHRO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasPeople = signals.has("people");
  const hasGrowth = signals.has("growth");
  const hasUrgency = signals.has("urgency");

  const risks = pick(depth,
    ["Key person dependency and talent gap", "Culture disruption"],
    [
      hasPeople ? "Key person dependency risk if this relies on one or two critical hires or existing staff" : "Skills gap: required capabilities may not exist internally",
      "Culture mismatch if this requires ways of working that conflict with current norms",
      hasGrowth ? "Hiring market competition driving up cost and time-to-fill for key roles" : "Change fatigue if the organization is already absorbing significant transformation",
      "Manager bandwidth: leaders who own delivery are often not equipped to manage the change simultaneously",
    ],
    [
      hasPeople ? "Single points of failure: if this depends on two or three people and one leaves, the initiative stalls" : "Capability gap requiring hiring that takes 3-6 months minimum to close",
      "Organizational change resistance - the social dynamics of this change need active management",
      hasGrowth ? "Hiring plan is almost always on the critical path but treated as an afterthought in planning" : "Span of control problems as managers are asked to absorb new scope",
      "Compensation equity issues if new hires come in at rates that create internal resentment",
      "Culture dilution risk if growth outpaces culture transmission",
      hasUrgency ? "Rushed hiring decisions create performance and culture problems that take years to resolve" : "Promotion and succession planning gaps exposed when initiative creates new leadership roles",
    ]
  );

  const opportunities = pick(depth,
    ["Talent development and capability building", "Culture reinforcement through shared initiative"],
    [
      "Use this initiative to develop internal talent and reduce external hiring dependency over time",
      "Strengthen culture by creating shared purpose and visible wins for the team",
      hasGrowth ? "Build a talent brand that attracts future hires aligned with the growth trajectory" : "Identify high-potential employees by seeing who thrives in the new context",
      "Create new career paths that improve retention of ambitious employees",
    ],
    [
      "Build internal capability that compounds: every person who grows through this becomes a force multiplier",
      "Use this as a culture-building moment: how we handle this shapes the org's identity",
      hasGrowth ? "Establish the hiring infrastructure (sourcing, screening, onboarding) that scales with the company" : "Design org structure proactively rather than reactively as scope expands",
      "Identify and invest in the high-performers who will own the next wave of growth",
      "Create psychological safety structures that allow honest escalation when things are not working",
      "Implement feedback loops so people issues surface early rather than becoming retention problems",
    ]
  );

  return {
    role: "CHRO",
    title: ROLE_META.CHRO.title,
    assessment: `The people dimension is often the longest-lead-time constraint in any initiative. ${hasPeople ? "This scenario has direct people implications - org design, hiring, and change management need to be planned at the same time as the business decision, not after." : "Even initiatives that don't seem people-intensive require someone to own them and teams to execute."} ${hasGrowth ? "Growth without a hiring and development plan is a trajectory toward burnout and churn." : ""} ${hasUrgency ? "Urgency pressure creates bad hiring decisions - the cost of a wrong hire is always higher than the cost of a delay." : ""} The CHRO lens is about ensuring the human system can support the business decision.${focus === "growth" ? " People are the rate-limiting factor in growth - hiring and development plans need to be on the critical path." : ""}`,
    risks,
    opportunities,
    recommendation: hasPeople
      ? "Build the org design and hiring plan before locking the delivery timeline. The people plan IS the timeline."
      : "Identify the people dependencies for this initiative and stress-test whether existing staff can absorb the new scope without impacting other commitments.",
    confidence: hasUrgency ? "low" : "medium",
    priority_flags: [
      ...(hasPeople ? ["Build hiring plan in parallel with the business case - not after"] : []),
      "Identify the DRI and their capacity before kickoff",
      "Plan the change management communications from the start",
    ],
  };
}

function analyzeCDO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasDataAI = signals.has("data_ai");
  const hasSecurity = signals.has("security");
  const hasTech = signals.has("technical");

  const risks = pick(depth,
    ["Data quality and governance gaps", "Compliance and privacy exposure"],
    [
      "Data quality degradation if new sources are added without governance controls",
      hasSecurity ? "Privacy and regulatory compliance exposure if personal data is involved" : "Data lineage gaps creating audit and debugging problems",
      "Analytical blind spots from inconsistent data definitions across teams",
      hasDataAI ? "Model training data bias or leakage if data pipelines are not properly isolated" : "Reporting inconsistency if multiple teams query the same data differently",
    ],
    [
      "Data governance breakdown: ungoverned data creates liability faster than it creates value",
      hasSecurity ? "GDPR/CCPA/HIPAA exposure if PII flows are not mapped and consented correctly" : "Data quality erosion from untested pipelines creating silent analytical errors",
      "Data silos forming as teams instrument independently without coordination",
      "Metadata and lineage gaps making it impossible to audit data origin for compliance",
      hasDataAI ? "AI training data contamination: using production data in models without proper anonymization" : "Analytical model drift as underlying data distributions change without detection",
      "Access control sprawl: every new data source expands the permission management surface",
    ]
  );

  const opportunities = pick(depth,
    ["New analytical insights from new data source", "Improve data infrastructure maturity"],
    [
      hasDataAI ? "Create a new training dataset or behavioral signal that improves model performance" : "Instrument a previously unobserved business process and surface new insights",
      "Improve data infrastructure maturity as a by-product of the initiative",
      "Establish data contracts and quality standards that benefit all downstream consumers",
      "Build a competitive advantage from proprietary data that compounds with scale",
    ],
    [
      hasDataAI ? "Create a proprietary data asset that provides a durable AI competitive advantage" : "Build a 360-degree view of a key business entity (customer, product, operation) currently fragmented",
      "Implement a modern data stack component (event streaming, feature store, semantic layer) that benefits all data use cases",
      "Establish data literacy and self-service analytics capabilities that reduce bottlenecks",
      "Create a data product that becomes a revenue or cost-saving asset in its own right",
      "Close the feedback loop between operational data and strategic decision-making",
      "Build ethical AI and data governance frameworks that become a trust differentiator",
    ]
  );

  return {
    role: "CDO",
    title: ROLE_META.CDO.title,
    assessment: `Data governance is not optional at any scale - it is either planned or it is chaos. ${hasDataAI ? "AI and analytics opportunities here are real, but they require clean, governed, and well-documented data to be reliable." : "The data implications of this decision need to be mapped before implementation begins, not discovered in production."} ${hasSecurity ? "Any initiative involving personal or sensitive data needs a privacy impact assessment as a prerequisite, not an afterthought." : ""} The CDO view is that data is an asset with both value and liability dimensions - both must be managed explicitly.${focus === "risk" ? " Data risk: ungoverned data is both a regulatory liability and a source of silent analytical errors that corrupt decisions." : ""}`,
    risks,
    opportunities,
    recommendation: hasSecurity
      ? "Conduct a data privacy impact assessment before any implementation. Map all PII flows, storage locations, and access controls."
      : "Define the data schema, ownership, and quality standards before building any data pipelines. Retrofitting governance is 5x the cost of building it in.",
    confidence: hasDataAI ? "high" : "medium",
    priority_flags: [
      ...(hasSecurity ? ["Conduct privacy impact assessment before implementation"] : []),
      "Define data ownership and stewardship before pipelines are built",
      ...(hasDataAI ? ["Document training data lineage and validation approach upfront"] : []),
    ],
  };
}

function analyzeCPO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasProduct = signals.has("product");
  const hasCustomer = signals.has("customer");
  const hasGrowth = signals.has("growth");

  const risks = pick(depth,
    ["Product-market fit uncertainty", "Roadmap disruption"],
    [
      "Product-market fit uncertainty: building without validated demand is the most common product failure mode",
      "Roadmap disruption: adding scope here has a cascade effect on committed deliverables",
      hasCustomer ? "User experience regression if this adds complexity without proportional value" : "Feature complexity that increases cognitive load and reduces product clarity",
      hasGrowth ? "Premature scaling before the core user loop is proven" : "Scope creep under the guise of completeness",
    ],
    [
      "Product-market fit risk: every unvalidated assumption is a potential wasted build",
      "Opportunity cost: this replaces something else on the roadmap - what is not getting built?",
      hasCustomer ? "User experience degradation: adding features without removing complexity is a slow product death" : "Product strategy dilution if this pulls the product in a direction that serves edge cases over core users",
      "Technical product debt: decisions made for speed create constraints that limit future product options",
      hasGrowth ? "Metrics gaming: optimizing for growth metrics that don't represent genuine user value" : "Retention impact: new features often degrade retention of existing users through disruption",
      "Competitive positioning confusion if this blurs what the product is for",
    ]
  );

  const opportunities = pick(depth,
    ["Deepen user value and engagement", "Expand addressable market"],
    [
      hasCustomer ? "Deepen the core user value loop in a way that measurably improves retention" : "Address a high-value user job-to-be-done that is currently unserved",
      hasGrowth ? "Expand addressable market by serving an adjacent user segment with similar needs" : "Create a compelling new product surface that increases engagement frequency",
      "Generate a product differentiator that is hard for competitors to copy quickly",
      "Create a platform foundation that unlocks multiple future product capabilities",
    ],
    [
      hasCustomer ? "Close a critical user pain point that is measurably reducing NPS or increasing churn" : "Build toward a product vision that makes the core use case dramatically better",
      hasGrowth ? "Design a growth loop native to the product rather than dependent on paid acquisition" : "Create a 'wow moment' that improves activation and reduces time-to-value for new users",
      "Establish a product moat through accumulated user data, behavior patterns, or network effects",
      "Use this as an opportunity to reduce product complexity while adding net capability",
      "Build the feedback infrastructure to make this iterative rather than a one-shot bet",
      "Create a testable hypothesis framework: define what success looks like before building",
    ]
  );

  return {
    role: "CPO",
    title: ROLE_META.CPO.title,
    assessment: `Product thinking starts with the user problem, not the solution. ${hasCustomer ? "Customer signals are present in this scenario - have those been translated into specific user stories with validated demand?" : "Before building, the product team needs to validate that users actually want this, not just that internal stakeholders think they will."} ${hasGrowth ? "Growth-oriented product work requires a clear theory of how user behavior changes, not just a feature shipping date." : ""} ${hasProduct ? "Roadmap impact needs to be assessed honestly - every addition displaces something else." : ""} The CPO lens is about ruthless prioritization and validated demand.${focus === "growth" ? " Product-led growth requires designing the growth loop into the product itself, not bolting acquisition on afterwards." : ""}`,
    risks,
    opportunities,
    recommendation: hasCustomer
      ? "Define the specific user problem and validation method before any design or engineering work begins. Talk to 5 users first."
      : "Write a one-page product brief: problem statement, target user, success metrics, and explicit non-goals. Align the team before building.",
    confidence: hasProduct ? "high" : "medium",
    priority_flags: [
      "Validate user demand with research before committing engineering time",
      "Define the success metric and measurement plan before kickoff",
      ...(hasGrowth ? ["Map the full user journey and identify where the growth lever actually sits"] : []),
    ],
  };
}

function analyzeCSO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasSecurity = signals.has("security");
  const hasTech = signals.has("technical");
  const hasDataAI = signals.has("data_ai");
  const hasVendor = signals.has("vendor");

  const risks = pick(depth,
    ["Expanded attack surface", "Compliance gap"],
    [
      "Attack surface expansion from new systems, integrations, or data flows",
      hasSecurity ? "Existing compliance obligations may extend to the new scope in non-obvious ways" : "Security review bypassed under time pressure creating latent vulnerabilities",
      hasVendor ? "Third-party vendor security posture not validated before integration" : "Internal development skipping security review to hit deadlines",
      "Incident response complexity increased if new systems are added without documentation",
    ],
    [
      "Attack surface expansion: every new system, integration point, and data store is a new entry vector",
      hasSecurity ? "Regulatory compliance extension: GDPR, SOC2, ISO27001, and sector-specific rules may apply to new scope" : "Security debt accumulation from features shipped without security review",
      hasVendor ? "Third-party risk: vendor breaches can expose your data and customers without your fault" : "Secrets management and credential rotation scope expanding without corresponding controls",
      "Identity and access management complexity: every new system adds new permission surfaces",
      "Supply chain risk if new dependencies (open source or commercial) have undisclosed vulnerabilities",
      hasDataAI ? "AI-specific risks: prompt injection, model poisoning, output manipulation" : "Social engineering surface expansion as more people are onboarded to new systems",
    ]
  );

  const opportunities = pick(depth,
    ["Security architecture modernization", "Compliance posture improvement"],
    [
      "Use this initiative to modernize security architecture in the affected domain",
      "Implement zero-trust principles that improve security posture across the board",
      hasSecurity ? "Achieve a compliance certification that unlocks enterprise sales opportunities" : "Build security tooling that reduces toil and improves detection speed",
      "Create a security-by-design culture that prevents vulnerabilities rather than finding them post-deployment",
    ],
    [
      "Security-by-design: building security controls into the architecture from the start costs 10x less than retrofitting",
      hasSecurity ? "Use this to achieve SOC2/ISO27001 certification that removes security as a sales blocker" : "Establish threat modeling as a standard practice for all future initiatives",
      "Implement automated security scanning in CI/CD that catches vulnerabilities before they ship",
      "Build a security observability layer that enables faster incident detection and response",
      "Create clear security policies and training that reduce the human factor risk",
      hasDataAI ? "Establish AI safety guardrails that protect against new threat vectors before they are exploited" : "Consolidate identity management to reduce the permission surface across the organization",
    ]
  );

  return {
    role: "CSO",
    title: ROLE_META.CSO.title,
    assessment: `Security is not a gate to pass at the end - it is a property to design in from the beginning. ${hasSecurity ? "The security signals in this scenario are significant. This needs a formal threat model and risk assessment before implementation." : "Even initiatives without obvious security implications need to be assessed - the ones that seem low-risk are often where the gaps are found."} ${hasVendor ? "Third-party vendor security posture needs validation before any integration - a breach in their system becomes your liability." : ""} ${hasDataAI ? "AI systems introduce novel threat vectors (prompt injection, data extraction, model manipulation) that require specific mitigations." : ""} The CSO lens is about making sure security enables the business rather than blocking it - but that requires honest risk assessment upfront.${focus === "risk" ? " Security risk: the most dangerous vulnerabilities are the ones introduced under time pressure and never reviewed." : ""}`,
    risks,
    opportunities,
    recommendation: hasSecurity
      ? "Require a formal threat model and security architecture review before development begins. Define security acceptance criteria alongside functional requirements."
      : "Include security in the design review process. Add a security checkpoint to the delivery workflow - it is much cheaper than a post-launch incident.",
    confidence: hasSecurity ? "high" : "medium",
    priority_flags: [
      "Include security in architecture design before implementation starts",
      ...(hasVendor ? ["Complete vendor security assessment before contract signing"] : []),
      ...(hasDataAI ? ["Define AI-specific security controls for this use case"] : []),
      ...(hasSecurity ? ["Identify applicable compliance frameworks and map requirements to deliverables"] : []),
    ],
  };
}

function analyzeCCO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasCustomer = signals.has("customer");
  const hasGrowth = signals.has("growth");
  const hasProduct = signals.has("product");

  const risks = pick(depth,
    ["Support burden spike", "Customer churn from experience disruption"],
    [
      hasCustomer ? "Customer churn if the change creates friction in an already-used workflow" : "Support ticket volume spike from customers who don't understand the change",
      "NPS and satisfaction score degradation during transition periods",
      hasGrowth ? "New customer onboarding complexity increasing time-to-value" : "Existing customer confusion if this changes the product they bought",
      "Customer success team capacity strain absorbing increased support demand",
    ],
    [
      "Churn risk: customers who have built their workflows around the current product will resist disruption",
      "Support surge: even positive changes generate support volume as customers adapt",
      hasCustomer ? "Trust erosion if customers feel this was done to them rather than for them" : "Onboarding complexity increase that raises the barrier for new customers",
      hasGrowth ? "Customer success capacity mismatch if growth outpaces support team scaling" : "Account health degradation as CSMs are distracted by reactive support instead of proactive engagement",
      "Contract renewal risk for enterprise accounts if the change affects their use case",
      "Community and forum sentiment risk if early adopters react negatively and amplify criticism",
    ]
  );

  const opportunities = pick(depth,
    ["Deepen customer relationships", "Reduce churn and expand retention"],
    [
      hasCustomer ? "Use the change as a proactive outreach moment to deepen customer relationships" : "Identify and solve a customer pain point that has been reducing retention",
      "Create customer advocacy moments among early adopters who benefit most",
      hasGrowth ? "Design an onboarding experience that accelerates time-to-value for new customers" : "Build customer feedback infrastructure that continuously surfaces issues before they become churn",
      "Strengthen customer success playbooks with new tools or workflows",
    ],
    [
      "Proactive customer communication can convert a potential disruption into a trust-building moment",
      "Use this as an opportunity to identify and invest in the customer segments with highest lifetime value",
      hasCustomer ? "Build a customer advisory board around this change to get early input and create advocates" : "Instrument customer health scoring to identify at-risk accounts before they churn",
      hasGrowth ? "Design onboarding for scale: self-serve flows that reduce CSM load per customer" : "Create a structured success planning process that ties customer goals to product usage",
      "Surface upsell and expansion opportunities uncovered by the change",
      "Build a community platform that lets customers help each other and reduces support cost",
    ]
  );

  return {
    role: "CCO",
    title: ROLE_META.CCO.title,
    assessment: `Customer experience is the leading indicator that financial metrics lag. ${hasCustomer ? "Customer signals here need to be taken seriously - they are telling you something about current satisfaction and risk tolerance for change." : "Even if customers are not directly mentioned, every business decision eventually reaches the customer."} ${hasGrowth ? "Growth means new customers - and new customers need a clear, fast path to value or they churn before they see the product's full capability." : ""} The CCO view is that every internal decision is also a customer decision - the question is whether it is made consciously.${focus === "growth" ? " CCO growth lens: retention is a growth lever. Reducing churn by 5% can have more impact than 20% more acquisition spend." : ""}`,
    risks,
    opportunities,
    recommendation: hasCustomer
      ? "Develop a customer communication plan before launch. Proactive communication about changes reduces support volume and churn risk by 40-60%."
      : "Map the customer touchpoints affected by this decision and define the experience for each. Assign customer impact as a first-class success criterion.",
    confidence: hasCustomer ? "high" : "medium",
    priority_flags: [
      "Define the customer communication plan before launch date",
      ...(hasCustomer ? ["Identify at-risk accounts and assign proactive outreach owners"] : []),
      "Set support team capacity to absorb expected inquiry spike",
    ],
  };
}

function analyzeCAIO(scenario: string, context: string, depth: AnalysisDepth, signals: Set<string>, focus?: string): PerspectiveResult {
  const hasDataAI = signals.has("data_ai");
  const hasTech = signals.has("technical");
  const hasSecurity = signals.has("security");
  const hasGrowth = signals.has("growth");

  const risks = pick(depth,
    ["AI ethics and bias concerns", "Model reliability and hallucination risk"],
    [
      hasDataAI ? "Model reliability issues (hallucination, inconsistency) in production creating trust erosion" : "AI automation displacing workflows without adequate human oversight",
      "AI ethics and bias concerns if the model reflects or amplifies inequities in training data",
      "Regulatory uncertainty: AI regulation is evolving rapidly and compliance requirements may change mid-implementation",
      hasSecurity ? "AI-specific security vectors: prompt injection, data extraction, model inversion" : "Over-reliance on AI output without sufficient human-in-the-loop controls",
    ],
    [
      hasDataAI ? "Model reliability in production: LLMs and ML models behave differently under edge cases than in test conditions" : "Automation fragility: AI systems that work well in demo conditions often degrade on real-world data distributions",
      "AI ethics surface: bias, fairness, transparency, and explainability requirements vary by use case and jurisdiction",
      "Regulatory exposure: EU AI Act, sector-specific AI rules, and evolving litigation risk create compliance uncertainty",
      "AI dependency risk: if AI capability is core to the product and the model is third-party, the supply chain is fragile",
      hasSecurity ? "Adversarial attack surface: prompt injection, jailbreaking, and data extraction are real and growing threats" : "Human oversight gap: automated systems without escalation paths create accountability voids",
      "Competitive displacement: AI capability is not a static moat - the landscape shifts every 6 months",
    ]
  );

  const opportunities = pick(depth,
    ["Automate high-volume manual processes", "Build AI-native competitive advantage"],
    [
      hasDataAI ? "Use AI to automate the high-volume, low-judgment parts of this workflow at 10-100x the throughput" : "Apply AI to a currently manual decision process to improve speed and consistency",
      "Build a proprietary AI capability that creates a competitive moat",
      hasGrowth ? "Use AI to reduce CAC through better targeting and personalization" : "Use AI to reduce operational cost while maintaining or improving quality",
      "Create an AI feedback loop that improves with use and compounds over time",
    ],
    [
      hasDataAI ? "Build a specialized AI capability on top of proprietary data that general models cannot replicate" : "Apply AI to a problem domain where the cost-quality tradeoff vs humans is clearly favorable",
      "Automate the high-volume, routine decisions in this domain to free human judgment for the cases that need it",
      "Create an AI-native product experience that redefines user expectations in the category",
      hasGrowth ? "Personalization and recommendation AI that improves conversion and retention metrics simultaneously" : "Operational AI that identifies inefficiencies and optimizations that humans miss in complex systems",
      "Build an AI evaluation and red-teaming practice that maintains quality as models evolve",
      "Develop AI governance frameworks that become a trust differentiator with enterprise customers",
    ]
  );

  return {
    role: "CAIO",
    title: ROLE_META.CAIO.title,
    assessment: `The AI lens asks two questions: where does AI create disproportionate value here, and where does it create disproportionate risk? ${hasDataAI ? "AI opportunity is real but requires clean data, clear evaluation criteria, and human oversight design - not just a model call." : "AI can likely play a role in this scenario even if it is not obviously an AI problem - the question is where automation creates leverage."} ${hasSecurity ? "AI security is a distinct discipline from traditional security - prompt injection and data extraction attacks require specific mitigations." : ""} The CAIO perspective is that AI capability is moving faster than most organizations can safely absorb - the competitive advantage goes to whoever gets the human-AI collaboration model right, not whoever deploys AI fastest.${focus === "growth" ? " AI growth lever: personalization and automation can compound growth in ways that human-only approaches cannot match at scale." : ""}`,
    risks,
    opportunities,
    recommendation: hasDataAI
      ? "Define the evaluation criteria and acceptable error rate before building. For AI features, you need to know what 'good enough' looks like before you can ship responsibly."
      : "Map the decision points in this scenario where AI could provide leverage, then prioritize by value vs risk vs implementation complexity. Start with the highest-confidence, lowest-risk application.",
    confidence: hasDataAI ? "high" : "medium",
    priority_flags: [
      ...(hasDataAI ? ["Define model evaluation criteria and acceptable error rates before building"] : []),
      "Design human-in-the-loop escalation paths for AI-driven decisions",
      ...(hasSecurity ? ["Conduct AI-specific threat model for prompt injection and data extraction"] : []),
      "Establish AI governance and monitoring from day one, not after launch",
    ],
  };
}

// ─── Consensus synthesis ──────────────────────────────────────────────────────

function synthesizeConsensus(perspectives: PerspectiveResult[], scenario: string, depth: AnalysisDepth): ConsensusResult {
  // Tally recommendations by action type
  const recommendations = perspectives.map((p) => p.recommendation.toLowerCase());
  const highConfidence = perspectives.filter((p) => p.confidence === "high").length;
  const lowConfidence = perspectives.filter((p) => p.confidence === "low").length;
  const totalConfidence = perspectives.length;

  const cautionSignals = recommendations.filter((r) =>
    /staged|validate|pilot|assess|review|evaluate|first|before|risk|model|test/i.test(r)
  ).length;

  const proceedSignals = recommendations.filter((r) =>
    /proceed|move|forward|build|launch|implement|execute/i.test(r)
  ).length;

  const overallConfidence: "low" | "medium" | "high" =
    lowConfidence >= 2 ? "low" :
    highConfidence >= Math.ceil(totalConfidence * 0.6) ? "high" :
    "medium";

  // Find common priority flags
  const allFlags = perspectives.flatMap((p) => p.priority_flags);
  const flagCounts: Record<string, number> = {};
  for (const f of allFlags) {
    const key = f.toLowerCase().replace(/[^a-z ]/g, "").trim().split(" ").slice(0, 4).join(" ");
    flagCounts[key] = (flagCounts[key] ?? 0) + 1;
  }

  // Common agreement points (themes appearing across multiple perspectives)
  const agreementPoints: string[] = [];
  const disagreementPoints: string[] = [];

  // Check for common risk themes
  const allRisks = perspectives.flatMap((p) => p.risks);
  if (perspectives.some((p) => p.priority_flags.some((f) => /single.*responsible|dri|owner/i.test(f)))) {
    agreementPoints.push("Ownership clarity is a prerequisite - multiple perspectives flag the absence of a clear DRI as a risk.");
  }
  if (cautionSignals >= Math.ceil(totalConfidence * 0.5)) {
    agreementPoints.push("Majority of perspectives recommend validation or staged commitment before full resource deployment.");
  }
  if (allRisks.some((r) => /integrat/i.test(r)) && allRisks.filter((r) => /integrat/i.test(r)).length >= 2) {
    agreementPoints.push("Integration complexity is flagged by multiple perspectives as an underestimated risk.");
  }
  if (perspectives.filter((p) => p.confidence === "high").length >= Math.ceil(totalConfidence * 0.5)) {
    agreementPoints.push("More than half of perspectives express high confidence, indicating broad alignment that this is a viable initiative.");
  }

  // Tension points
  if (proceedSignals > 0 && cautionSignals > 0) {
    const proceedRoles = perspectives
      .filter((p) => /proceed|move|forward|build|launch|implement|execute/i.test(p.recommendation))
      .map((p) => p.role)
      .join(", ");
    const cautionRoles = perspectives
      .filter((p) => /staged|validate|pilot|assess|review|evaluate|first|before|risk|model|test/i.test(p.recommendation))
      .map((p) => p.role)
      .join(", ");
    if (proceedRoles && cautionRoles) {
      disagreementPoints.push(`Speed vs rigor tension: ${proceedRoles} lean toward action while ${cautionRoles} recommend validation first.`);
    }
  }

  // Check build vs buy tension
  const buildSignals = perspectives.filter((p) => /internal|build|in.house/i.test(p.recommendation)).length;
  const buySignals = perspectives.filter((p) => /vendor|buy|procure|outsource/i.test(p.recommendation)).length;
  if (buildSignals > 0 && buySignals > 0) {
    disagreementPoints.push("Build vs buy tension present: some perspectives favor internal development while others recommend evaluating vendor solutions.");
  }

  // Overall recommendation
  let overallRec: string;
  if (cautionSignals >= Math.ceil(totalConfidence * 0.6)) {
    overallRec = "Run a time-boxed validation sprint (2-4 weeks) to de-risk the top 3 assumptions before committing full resources. Define explicit go/no-go criteria at the end of the sprint.";
  } else if (proceedSignals >= Math.ceil(totalConfidence * 0.6)) {
    overallRec = "Proceed with full commitment. Assign a DRI, set a 90-day milestone, define success metrics, and establish a regular review cadence to catch issues early.";
  } else {
    overallRec = "Proceed with a structured first phase: assign ownership, validate the two highest-uncertainty assumptions, and lock the business case before entering full execution mode.";
  }

  // Critical path
  const criticalPath = (() => {
    const hasPeopleFlag = perspectives.some((p) => p.priority_flags.some((f) => /hire|people|team|capacity/i.test(f)));
    const hasSecurityFlag = perspectives.some((p) => p.priority_flags.some((f) => /security|compliance|privacy/i.test(f)));
    const hasTechFlag = perspectives.some((p) => p.priority_flags.some((f) => /architect|spike|integrat|technical/i.test(f)));
    const hasFinancialFlag = perspectives.some((p) => p.priority_flags.some((f) => /financial|budget|model|cost|roi/i.test(f)));

    if (hasPeopleFlag) return "People and organizational readiness - team capacity and hiring timeline is the most commonly flagged rate-limiting factor.";
    if (hasSecurityFlag) return "Security and compliance review - flagged as a blocker that cannot be parallelized with implementation.";
    if (hasTechFlag) return "Technical architecture validation - resolve the highest-uncertainty technical assumptions before committing the full team.";
    if (hasFinancialFlag) return "Financial model validation - the business case needs to be stress-tested before resources are committed.";
    return "Decision alignment - ensure all stakeholders share the same understanding of the problem, success criteria, and constraints before execution begins.";
  })();

  // Watch list
  const watchList: string[] = [
    ...new Set(
      perspectives
        .flatMap((p) => p.priority_flags)
        .filter((f) => /before|first|validate|assess|define|map|require/i.test(f))
        .slice(0, depth === "quick" ? 3 : depth === "standard" ? 4 : 6)
    ),
  ].slice(0, depth === "quick" ? 3 : depth === "standard" ? 4 : 6);

  return {
    overall_recommendation: overallRec,
    confidence: overallConfidence,
    agreement_points: agreementPoints.length > 0 ? agreementPoints : ["No strong consensus signals detected - perspectives are divergent. Treat this as a decision requiring careful deliberation."],
    disagreement_points: disagreementPoints.length > 0 ? disagreementPoints : ["No significant tension points detected across perspectives."],
    critical_path: criticalPath,
    watch_list: watchList,
  };
}

// ─── Role analyzer dispatch ────────────────────────────────────────────────────

type RoleAnalyzer = (
  scenario: string,
  context: string,
  depth: AnalysisDepth,
  signals: Set<string>,
  focus?: string
) => PerspectiveResult;

const ROLE_ANALYZERS: Record<CsuiteRole, RoleAnalyzer> = {
  CEO:  analyzeCEO,
  COO:  analyzeCOO,
  CTO:  analyzeCTO,
  CFO:  analyzeCFO,
  CMO:  analyzeCMO,
  CIO:  analyzeCIO,
  CHRO: analyzeCHRO,
  CDO:  analyzeCDO,
  CPO:  analyzeCPO,
  CSO:  analyzeCSO,
  CCO:  analyzeCCO,
  CAIO: analyzeCAIO,
};

const ALL_ROLES: CsuiteRole[] = ["CEO","COO","CTO","CFO","CMO","CIO","CHRO","CDO","CPO","CSO","CCO","CAIO"];

const VALID_ROLES = new Set<string>(ALL_ROLES);

// ─── Main export ───────────────────────────────────────────────────────────────

export function csuitAnalyze(
  scenario: string,
  options: {
    context?: string;
    perspectives?: string[];
    depth?: AnalysisDepth;
    focus?: string;
  } = {}
): CsuiteAnalysisResult {
  const depth: AnalysisDepth = options.depth ?? "standard";
  const context = options.context ?? "";
  const focus = options.focus;

  // Resolve requested roles
  let roles: CsuiteRole[];
  if (!options.perspectives || options.perspectives.length === 0) {
    roles = ALL_ROLES;
  } else {
    const invalid = options.perspectives.filter((r) => !VALID_ROLES.has(r.toUpperCase()));
    if (invalid.length > 0) {
      throw new Error(
        `Invalid perspective(s): ${invalid.join(", ")}. Valid options: ${ALL_ROLES.join(", ")}`
      );
    }
    roles = options.perspectives.map((r) => r.toUpperCase() as CsuiteRole);
  }

  // Extract signals from scenario + context
  const signals = extractSignals(scenario + " " + context);

  // Run each role analyzer
  const perspectives = roles.map((role) =>
    ROLE_ANALYZERS[role](scenario, context, depth, signals, focus)
  );

  // Synthesize consensus
  const consensus = synthesizeConsensus(perspectives, scenario, depth);

  return {
    scenario,
    context: context || undefined,
    depth,
    perspectives_analyzed: perspectives.length,
    perspectives,
    consensus,
  };
}
