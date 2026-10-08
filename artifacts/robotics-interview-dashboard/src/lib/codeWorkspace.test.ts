import { describe, expect, it } from "vitest";

import {
  BIOBUZZ_SDK_VERSION,
  defaultSeedFiles,
  highlightJavaLine,
  lintJava,
  onBotPathFor,
  templateForKind,
} from "./codeWorkspace";

describe("code workspace templates", () => {
  it("targets the BIOBUZZ SDK with JDK 21 / Java 8 notes", () => {
    expect(BIOBUZZ_SDK_VERSION).toBe("v12.0");
    expect(templateForKind("teleop", "Bot")).toContain("@TeleOp");
    expect(templateForKind("auto", "Bot")).toContain("AprilTagClusterDetection");
    expect(templateForKind("readme", "Bot")).toContain("JDK 21");
  });

  it("seeds a TeleOp, an Auto, and a README", () => {
    const seeds = defaultSeedFiles("Bot");
    expect(seeds.map((seed) => seed.path)).toEqual([
      "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/BioBuzzTankTeleOp.java",
      "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/BioBuzzAuto.java",
      "README.md",
    ]);
  });
});

describe("java lint", () => {
  it("rejects newer-than-8 language features", () => {
    const problems = lintJava("var speed = 1.0;\nrecord Point(int x) {}\n", "A.java");
    expect(problems.some((problem) => problem.message.includes("'var'"))).toBe(true);
    expect(problems.some((problem) => problem.message.includes("'record'"))).toBe(true);
  });

  it("flags legacy AprilTag loops under SDK v12", () => {
    const problems = lintJava(
      "AprilTagDetection detection;\nfor (AprilTagDetection d : current) {\n  telemetry.addData(\"x\", d.ftcPose.x);\n}\n",
      "Auto.java",
    );
    expect(problems.some((problem) => problem.message.includes("AprilTagSingleDetection"))).toBe(true);
  });

  it("requires the public type to match the file name", () => {
    const problems = lintJava("public class RightName extends LinearOpMode {}", "WrongName.java");
    expect(problems.some((problem) => problem.message.includes("RightName.java"))).toBe(true);
  });

  it("warns when an OpMode has no Driver Station annotation", () => {
    const problems = lintJava("public class A extends LinearOpMode {\n public void runOpMode() {}\n}", "A.java");
    expect(problems.some((problem) => problem.message.includes("@TeleOp"))).toBe(true);
  });
});

describe("java highlighting", () => {
  it("classifies keywords, strings, comments, and annotations", () => {
    const kinds = Object.fromEntries(
      highlightJavaLine('@TeleOp public class A { String s = "hi"; // done').map((token) => [token.text.trim(), token.kind]),
    );
    expect(kinds["@TeleOp"]).toBe("annotation");
    expect(kinds["public"]).toBe("keyword");
    expect(kinds['"hi"']).toBe("string");
  });
});

describe("onbot paths", () => {
  it("flattens TeamCode paths to hub locations", () => {
    expect(onBotPathFor("TeamCode/src/main/java/org/firstinspires/ftc/teamcode/A.java")).toBe(
      "org/firstinspires/ftc/teamcode/A.java",
    );
  });
});
