import type { AssistantActivity } from "@workspace/api-client-react";

type ToolStep = readonly [tool: string, detail: string, result: string];

export type DemoAssistantRun = {
  id: string;
  title: string;
  summary: string;
  prompt: string;
  answer: string;
  activities: AssistantActivity[];
};

function makeActivities(steps: readonly ToolStep[]): AssistantActivity[] {
  return steps.map(([tool, detail, result], index) => ({
    tool,
    detail,
    input: JSON.stringify({ sampleReplay: true, step: index + 1, request: detail }, null, 2),
    output: JSON.stringify({ sampleReplay: true, status: "completed", result }, null, 2),
  }));
}

export const DEMO_ASSISTANT_RUNS: DemoAssistantRun[] = [
  {
    id: "pollen-rule-review",
    title: "Falling pollen rule review",
    summary: "Game rules · completed sample",
    prompt: "Research the game in BioBuzz and write me a document of if I am allowed to catch falling pollen.",
    answer: `## Sample review complete

The demonstration evidence bundle does **not** establish permission to intentionally catch falling pollen. The sample memo recommends treating that action as unresolved until the current official game manual, published Q&A, and event referee confirm it.

The replay includes a draft decision memo, a rule-reference table, and a verification checklist. This is fictional sample output, not an official rules interpretation.`,
    activities: makeActivities([
      ["web_search", "Search the sample source index for the BioBuzz game manual.", "Found a fictional manual index fixture for this replay."],
      ["web_fetch", "Open the sample manual overview and record its revision label.", "Loaded the demonstration source card; no network request was made."],
      ["web_search", "Search sample manual headings for pollen and collection rules.", "Matched four fictional rule-section excerpts."],
      ["web_fetch", "Read the sample game-piece definition and scoring section.", "Captured the demonstration excerpt and its sample section labels."],
      ["python_exec", "Index the replay excerpts for pollen, possession, and scoring terms.", "Built a local term index from the sample text."],
      ["web_search", "Search the sample manual for falling-object and human-player language.", "Found two related fictional excerpts for comparison."],
      ["web_fetch", "Read the sample field-interaction rules.", "Recorded the relevant sample clauses with revision metadata."],
      ["web_search", "Search the sample Q&A archive for loose-pollen questions.", "Found one fictional Q&A fixture marked for referee confirmation."],
      ["web_fetch", "Read the sample Q&A response and its publication date.", "Added the sample response to the evidence set."],
      ["python_exec", "Normalize the sample section references into a citation table.", "Generated a local table with source, section, and date columns."],
      ["web_search", "Search for sample rule updates after the manual revision.", "No later update appears in the demonstration index."],
      ["web_fetch", "Read the sample update notice and compare its date.", "The fictional notice predates the replay's sample Q&A entry."],
      ["python_exec", "Compare the sample manual and Q&A timelines.", "Flagged the Q&A fixture as the newest sample item."],
      ["web_fetch", "Read the sample definition of possession and control.", "The excerpt does not expressly decide intentional catches."],
      ["python_exec", "Build a rule cross-reference for intentional versus incidental contact.", "Separated explicit permissions from unresolved interpretations."],
      ["create_document", "Draft the sample decision memo with a cautious conclusion.", "Created a fictional memo fixture with a summary and evidence section."],
      ["edit_document", "Add the sample citations and quoted passage labels.", "Added the reference table; labels are illustrative placeholders."],
      ["python_exec", "Audit every sample citation against the local excerpt list.", "All memo references resolve to a sample fixture."],
      ["web_search", "Check the sample source index for a conflicting interpretation.", "No additional conflicting sample entry was present."],
      ["web_fetch", "Read the sample referee-question guidance.", "Added a human-verification note to the evidence bundle."],
      ["edit_document", "Add the referee check and uncertainty note.", "The memo now distinguishes sample evidence from an official ruling."],
      ["create_snapshot", "Save the completed sample memo and citation table.", "Recorded a fictional completed-document event for this replay."],
    ]),
  },
  {
    id: "onshape-robot-concept",
    title: "Onshape robot concept",
    summary: "3D design · completed sample",
    prompt: "Use my connected Onshape account to make me a 3D CAD of an amazing-looking robot.",
    answer: `## Sample concept complete

The replay shows a fictional **BioBuzz Raptor** concept assembly with a low chassis, four-wheel drive, protected intake, sensor mast, and labeled subsystem components. The design summary and fit-check notes are included in the sample run.

Nothing was created in your Onshape account. The workspace, dimensions, assembly, and render shown here are illustrative demo records only.`,
    activities: makeActivities([
      ["onshape_list_workspaces", "List the fictional workspaces available in this replay.", "Returned the single sample workspace, BioBuzz Demo."],
      ["onshape_list_documents", "List sample documents in BioBuzz Demo.", "Found three fictional robot-design documents."],
      ["onshape_search_documents", "Search sample documents for the current robot and chassis.", "Matched the fictional Rover 2026 baseline."],
      ["onshape_read_document", "Read the sample robot requirements and build notes.", "Loaded the demo dimensions and preferred mechanisms."],
      ["onshape_list_elements", "List parts studios and assemblies in the baseline document.", "Found a chassis studio and a drivetrain assembly fixture."],
      ["onshape_read_element", "Inspect the sample chassis geometry and units.", "Recorded millimeter units and a 420 by 380 mm envelope."],
      ["onshape_read_element", "Inspect the sample wheel and motor configuration.", "Found four sample wheels and a geared drivetrain layout."],
      ["onshape_read_document", "Read sample field-clearance constraints.", "Captured the fictional perimeter and bumper limits."],
      ["python_exec", "Compare the sample envelope against field-clearance limits.", "The concept envelope passes the replay's illustrative clearance check."],
      ["onshape_create_document", "Prepare a fictional BioBuzz Raptor design document.", "Recorded a sample document-creation event; no account was contacted."],
      ["onshape_create_part_studio", "Create a sample chassis part studio.", "Added the chassis studio to the fictional replay tree."],
      ["onshape_create_part", "Create the sample chassis plate and cross-members.", "Generated three illustrative chassis components."],
      ["onshape_create_part", "Add sample drive modules and wheel hubs.", "Generated four wheel-module component records."],
      ["onshape_create_part", "Add the sample intake frame and roller guards.", "Generated the intake subsystem component records."],
      ["onshape_create_part", "Add a protected sample sensor mast.", "Added the mast and camera bracket to the demo assembly."],
      ["onshape_create_assembly", "Assemble the fictional drivebase and intake.", "The replay assembly contains 12 sample components."],
      ["onshape_add_mate", "Constrain wheel, chassis, and intake positions.", "Recorded 18 illustrative assembly constraints."],
      ["onshape_check_interference", "Check the sample assembly for part collisions.", "No collisions were found in the fictional geometry fixture."],
      ["python_exec", "Calculate the sample footprint and service-access zones.", "Generated an illustrative dimensions and access summary."],
      ["onshape_create_drawing", "Prepare a sample top, side, and isometric drawing sheet.", "Recorded a completed demo drawing event."],
      ["onshape_render_preview", "Render the fictional BioBuzz Raptor concept.", "Generated a sample render record for the replay."],
      ["onshape_create_document", "Bundle design notes and fit-check results.", "Recorded the final sample design package as complete."],
    ]),
  },
  {
    id: "starter-kit-integration",
    title: "Starter kit to robot plan",
    summary: "Parts + docs + CAD · completed sample",
    prompt: "We just bought a goBILDA starter kit. Add the parts to our library, write how to use them on our existing bot, and create a CAD model for it.",
    answer: `## Sample integration package complete

The replay matches a fictional starter-kit list to sample catalog entries, maps them to the Rover 2026 subsystems, and presents a draft parts-library update, usage guide, and CAD layout.

This is a read-only demonstration: no parts were added to a real library, no document was saved, and no CAD service was contacted.`,
    activities: makeActivities([
      ["parts_search_catalog", "Search the local sample catalog for the goBILDA starter kit.", "Matched the fictional kit fixture and its included-parts list."],
      ["parts_read_product", "Read the sample kit description and revision.", "Loaded the illustrative kit contents and sample SKU labels."],
      ["parts_parse_kit", "Parse the sample bill of materials into individual components.", "Expanded the kit into 16 fictional catalog line items."],
      ["parts_search_catalog", "Match motors, wheels, hubs, and brackets to sample catalog entries.", "Matched 14 items; two are marked for human SKU review."],
      ["parts_read_product", "Read sample motor and gearbox specifications.", "Recorded fictional torque and ratio data with sample units."],
      ["parts_read_product", "Read sample wheel and hub dimensions.", "Recorded illustrative wheel diameter and shaft-interface data."],
      ["parts_search_catalog", "Find compatible sample brackets and fasteners.", "Found compatible fictional mounting options."],
      ["parts_compare_inventory", "Compare the kit list with the sample Rover inventory.", "Identified 9 new items and 5 overlaps in demo data."],
      ["python_exec", "Normalize quantities and unit costs for the sample kit.", "Generated a local parts reconciliation table."],
      ["parts_add_to_library", "Stage the sample kit as a read-only library change.", "Recorded a simulated draft update; no live inventory was changed."],
      ["parts_map_subsystems", "Map each sample component to the Rover drivebase, intake, or lift.", "Mapped all sample kit lines to three fictional subsystems."],
      ["parts_check_compatibility", "Check shaft, voltage, and mounting compatibility in the fixture.", "The sample compatibility checklist has two review warnings."],
      ["python_exec", "Estimate the sample drivetrain ratio and wheel speed.", "Computed an illustrative range from the fixture values."],
      ["create_document", "Draft the sample guide for using the kit on Rover 2026.", "Created a fictional document event with subsystem sections."],
      ["edit_document", "Add assembly order, wiring notes, and compatibility warnings.", "Added the sample installation checklist and review flags."],
      ["cad_create_document", "Prepare a fictional CAD package for the kit integration.", "Recorded a simulated CAD document event."],
      ["cad_create_assembly", "Lay out the sample drivebase and kit mounting points.", "Created an illustrative assembly with labeled kit components."],
      ["cad_add_component", "Place sample motors, wheels, hubs, and brackets.", "Placed the matched components in the replay assembly."],
      ["cad_check_clearance", "Check sample mounting and wheel-clearance envelopes.", "The fixture passes with one note to verify the intake guard."],
      ["python_exec", "Summarize kit usage, overlaps, and review warnings.", "Generated a local handoff summary for the fictional guide."],
      ["edit_document", "Add the CAD preview and staged-library note.", "Updated the sample guide; no external file was written."],
      ["create_snapshot", "Mark the sample parts, guide, and CAD package complete.", "Recorded a completed illustrative integration bundle."],
    ]),
  },
  {
    id: "autonomous-drift-investigation",
    title: "Autonomous drift investigation",
    summary: "Test analysis · completed sample",
    prompt: "Review our sample autonomous runs, figure out why the robot drifts right after the first turn, and prepare a test plan we can use at the next scrimmage.",
    answer: `## Sample investigation complete

The fictional run set points to a right-side wheel-speed mismatch that grows after the first turn. The replay prepares a troubleshooting memo, a repeatable three-run test plan, and a measurement table.

The diagnosis is illustrative and based only on the sample logs shown in this demo; it is not a finding about a real robot.`,
    activities: makeActivities([
      ["list_field_test_logs", "List the fictional autonomous test runs.", "Found six sample runs with timestamps and route labels."],
      ["read_field_test_log", "Read the sample run with the strongest rightward drift.", "Loaded the fictional pose and encoder trace."],
      ["read_field_test_log", "Read a sample control run with no drift.", "Loaded the baseline trace for comparison."],
      ["read_field_test_log", "Read the sample run after the first turn.", "Found the largest heading error after waypoint two."],
      ["python_exec", "Normalize encoder and heading values across sample logs.", "Aligned the three sample traces to the same time base."],
      ["python_exec", "Calculate left-versus-right wheel-speed error.", "The fictional right side averages 7.8% faster after the turn."],
      ["search_test_notes", "Search sample notes for wheel changes and battery state.", "Found one fictional note about a recent right gearbox swap."],
      ["read_test_note", "Read the sample gearbox-swap note.", "The note records a ratio change that needs verification."],
      ["parts_search_catalog", "Check sample parts records for the right gearbox ratio.", "The sample inventory lists two possible ratio fixtures."],
      ["parts_read_product", "Read the matched sample gearbox specification.", "The fixture ratio differs from the left-side reference."],
      ["python_exec", "Model the route error using the sample speed mismatch.", "The simple model reproduces the rightward drift direction."],
      ["search_test_notes", "Search for sample calibration and trim settings.", "Found a fictional trim value last updated before the gearbox swap."],
      ["read_test_note", "Read the sample drivetrain calibration checklist.", "The sample procedure calls for paired-wheel calibration."],
      ["create_document", "Draft a sample root-cause memo with evidence links.", "Created a fictional investigation memo."],
      ["edit_document", "Add the ratio comparison and uncertainty caveat.", "The memo separates measured fixture data from hypotheses."],
      ["create_spreadsheet", "Prepare a sample three-run measurement table.", "Created a local demo worksheet fixture."],
      ["edit_spreadsheet", "Add encoder, heading, battery, and route columns.", "The sample table is ready for repeated scrimmage tests."],
      ["python_exec", "Check the proposed test sequence for confounding changes.", "The plan changes one drivetrain variable at a time."],
      ["create_document", "Draft the next-scrimmage test plan.", "Added paired calibration and repeat-run steps."],
      ["edit_document", "Add stop conditions and a human sign-off section.", "The test plan includes a safety and review checkpoint."],
      ["read_collaboration_artifact", "Cross-check the sample maintenance checklist.", "No conflicting maintenance interval appears in the fixture."],
      ["create_snapshot", "Save the sample investigation package.", "Recorded the completed memo, table, and test-plan replay."],
    ]),
  },
  {
    id: "camera-mount-clearance",
    title: "Camera mount clearance study",
    summary: "CAD + parts + build notes · completed sample",
    prompt: "Use the sample robot dimensions and parts list to design a camera mount that clears the intake, then write a build and inspection checklist.",
    answer: `## Sample mount study complete

The replay shows a fictional adjustable camera bracket with a protected cable route, intake-clearance notes, and a short build checklist. It also lists the sample fasteners and measurements needed for a real fit check.

The CAD geometry and parts references are mock data, not a manufactured or saved design.`,
    activities: makeActivities([
      ["parts_list_inventory", "List sample Rover parts and mounting hardware.", "Found the fictional camera, intake, and fastener records."],
      ["parts_search_catalog", "Search the sample catalog for low-profile camera brackets.", "Matched three illustrative bracket options."],
      ["parts_read_product", "Read sample bracket dimensions and adjustment range.", "Recorded a fictional slot length and screw pattern."],
      ["onshape_list_documents", "List sample robot CAD documents.", "Found the fictional Rover 2026 assembly."],
      ["onshape_read_element", "Read the sample intake and crossbar geometry.", "Loaded the illustrative clearance surfaces."],
      ["onshape_read_element", "Read the sample camera envelope and field of view.", "Recorded a mock camera footprint and viewing cone."],
      ["python_exec", "Calculate the sample intake sweep and camera keep-out zones.", "Generated an illustrative clearance envelope."],
      ["onshape_search_documents", "Search sample history for the current intake revision.", "Matched the latest fictional intake assembly revision."],
      ["onshape_read_element", "Inspect the sample crossbar mounting points.", "Found two usable fictional mounting locations."],
      ["python_exec", "Compare bracket options against the sample keep-out envelope.", "The mid-slot option passes the illustrative clearance check."],
      ["cad_create_document", "Prepare a fictional camera-mount design package.", "Recorded a simulated CAD document event."],
      ["cad_create_part", "Create the sample adjustable camera plate.", "Generated an illustrative plate component."],
      ["cad_create_part", "Add the sample crossbar clamp and cable guide.", "Generated the clamp and guide fixtures."],
      ["cad_add_component", "Place the sample camera and bracket in the assembly.", "Placed the mock parts at the selected mounting point."],
      ["cad_add_constraint", "Constrain the camera angle and slot adjustment.", "Recorded the sample angle and travel constraints."],
      ["cad_check_clearance", "Check the sample bracket against the intake sweep.", "No fixture collision appears across the simulated adjustment range."],
      ["python_exec", "Estimate sample fastener lengths and service access.", "Created a provisional fastener and tool-access list."],
      ["parts_search_catalog", "Verify the sample fastener sizes in the local catalog fixture.", "Matched two sample fastener sizes and one spacer."],
      ["create_document", "Draft the camera-mount build checklist.", "Created a fictional document event."],
      ["edit_document", "Add cable routing, inspection points, and adjustment steps.", "The sample checklist includes a pre-match recheck."],
      ["create_document", "Write a separate fit-check note with required measurements.", "Added a human-measurement step before any real fabrication."],
      ["create_snapshot", "Bundle the sample CAD, parts, and checklist.", "Recorded a completed illustrative mount-study package."],
    ]),
  },
];
