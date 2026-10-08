/**
 * Shared Code-workspace helpers: BIOBUZZ (SDK v12.0) OpMode templates,
 * Java 8 language-level lint (toolchain is JDK 21, source level stays 1.8
 * per stock build.common.gradle), a tiny Java tokenizer for the editor,
 * TeamCode ZIP export, and OnBot path mapping.
 */

export type JavaProblem = {
  line: number;
  column: number;
  severity: "error" | "warning";
  message: string;
};

export type JavaToken = {
  text: string;
  kind:
    | "plain"
    | "keyword"
    | "string"
    | "comment"
    | "annotation"
    | "number"
    | "type"
    | "method";
};

const JAVA_KEYWORDS = new Set(
  "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while".split(
    " ",
  ),
);

const FTC_TYPES = new Set(
  "LinearOpMode OpMode DcMotor DcMotorEx DcMotorSimple Servo CRServo HardwareMap Telemetry Gamepad ElapsedTime AngleUnit DistanceUnit Pose2D".split(
    " ",
  ).concat(
    "AprilTagDetection AprilTagSingleDetection AprilTagClusterDetection AprilTagProcessor VisionPortal Gyroscope IMU ColorSensor DistanceSensor TouchSensor DigitalChannel AnalogInput".split(
      " ",
    ),
  ),
);

export const BIOBUZZ_SDK_VERSION = "v12.0";
export const TOOLCHAIN_NOTE = "JDK 21 toolchain · Java 8 source level (stock SDK v12.0 BIOBUZZ)";

const LICENSE_HEADER = `/* Copyright (c) 2026 FIRST. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided the teamClause below is satisfied. Java 8 source level:
 * no 'var', records, text blocks, or switch expressions (OnBotJava compatible).
 */`;

export const BIOBUZZ_TELEOP_TEMPLATE = `${LICENSE_HEADER}

package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DcMotorSimple;

/**
 * BIOBUZZ tank TeleOp starter. Rename the class AND the file together.
 * Hardware names ("left_drive", "right_drive") must match the robot config.
 */
@TeleOp(name = "BioBuzz Tank", group = "Starter")
public class BioBuzzTankTeleOp extends LinearOpMode {
    private DcMotor leftDrive = null;
    private DcMotor rightDrive = null;

    @Override
    public void runOpMode() {
        leftDrive = hardwareMap.get(DcMotor.class, "left_drive");
        rightDrive = hardwareMap.get(DcMotor.class, "right_drive");
        rightDrive.setDirection(DcMotorSimple.Direction.REVERSE);

        telemetry.addData("Status", "Initialized");
        telemetry.update();
        waitForStart();

        while (opModeIsActive()) {
            double drive = -gamepad1.left_stick_y;
            double turn = gamepad1.right_stick_x;
            leftDrive.setPower(drive + turn);
            rightDrive.setPower(drive - turn);
            telemetry.addData("Motors", "left=%.2f right=%.2f", drive + turn, drive - turn);
            telemetry.update();
        }
    }
}
`;

export const BIOBUZZ_AUTO_TEMPLATE = `${LICENSE_HEADER}

package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;
import org.firstinspires.ftc.robotcore.external.hardware.camera.WebcamName;
import org.firstinspires.ftc.vision.VisionPortal;
import org.firstinspires.ftc.vision.apriltag.AprilTagClusterDetection;
import org.firstinspires.ftc.vision.apriltag.AprilTagDetection;
import org.firstinspires.ftc.vision.apriltag.AprilTagProcessor;
import org.firstinspires.ftc.vision.apriltag.AprilTagSingleDetection;

import java.util.List;

/**
 * BIOBUZZ autonomous starter with SDK v12 AprilTag cluster handling.
 * Legacy single-tag loops no longer compile: always branch on the
 * detection subtype before reading pose fields.
 */
@Autonomous(name = "BioBuzz Auto", group = "Starter")
public class BioBuzzAuto extends LinearOpMode {
    private DcMotor leftDrive = null;
    private DcMotor rightDrive = null;

    @Override
    public void runOpMode() {
        leftDrive = hardwareMap.get(DcMotor.class, "left_drive");
        rightDrive = hardwareMap.get(DcMotor.class, "right_drive");

        AprilTagProcessor tags = new AprilTagProcessor.Builder().build();
        VisionPortal portal = new VisionPortal.Builder()
                .setCamera(hardwareMap.get(WebcamName.class, "Webcam 1"))
                .addProcessor(tags)
                .build();

        telemetry.addData("Status", "Initialized");
        telemetry.update();
        waitForStart();

        if (opModeIsActive()) {
            List<AprilTagDetection> current = tags.getDetections();
            for (AprilTagDetection detection : current) {
                if (detection instanceof AprilTagSingleDetection) {
                    AprilTagSingleDetection single = (AprilTagSingleDetection) detection;
                    telemetry.addData("Tag", "single id=%d", single.id);
                } else {
                    AprilTagClusterDetection cluster = (AprilTagClusterDetection) detection;
                    telemetry.addData("Tag", "cluster members=%d", cluster.members.size());
                }
            }
            telemetry.update();
            leftDrive.setPower(0.3);
            rightDrive.setPower(0.3);
            sleep(800);
            leftDrive.setPower(0);
            rightDrive.setPower(0);
        }
        portal.close();
    }
}
`;

export const PROJECT_README_TEMPLATE = (projectName: string): string =>
  `# ${projectName}

FTC BIOBUZZ (SDK v12.0) TeamCode project, edited in the team Code workspace.

- Toolchain: JDK 21 (Android Studio Narwhal 3 Feature Drop or later), Gradle 9.1, AGP 8.13.2
- Source level: Java 8 (stock build.common.gradle) — no var/records/text blocks if the
  file must also build in OnBotJava.
- SDK v12 breaking change: AprilTag detections must branch on
  AprilTagSingleDetection vs AprilTagClusterDetection.

## Deploy over USB
1. Download the TeamCode ZIP from the Deploy tab.
2. Open your FtcRobotController checkout in Android Studio and copy
   TeamCode/src/... over, or edit here and keep this workspace as source of truth.
3. Plug the Control Hub in over USB-C and run the app (./gradlew installDebug).
`;

export function templateForKind(kind: "teleop" | "auto" | "readme", projectName: string): string {
  if (kind === "auto") return BIOBUZZ_AUTO_TEMPLATE;
  if (kind === "readme") return PROJECT_README_TEMPLATE(projectName);
  return BIOBUZZ_TELEOP_TEMPLATE;
}

export function defaultSeedFiles(projectName: string): { path: string; content: string }[] {
  return [
    {
      path: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/BioBuzzTankTeleOp.java",
      content: BIOBUZZ_TELEOP_TEMPLATE,
    },
    {
      path: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/BioBuzzAuto.java",
      content: BIOBUZZ_AUTO_TEMPLATE,
    },
    { path: "README.md", content: PROJECT_README_TEMPLATE(projectName) },
  ];
}

/** Java 8 language-level lint plus FTC/BIOBUZZ sanity checks. */
export function lintJava(content: string, filePath: string): JavaProblem[] {
  const problems: JavaProblem[] = [];
  const lines = content.split("\n");
  const fileName = filePath.split("/").pop() ?? "";
  const push = (line: number, column: number, severity: JavaProblem["severity"], message: string) => {
    problems.push({ line, column, severity, message });
  };

  lines.forEach((raw, index) => {
    const line = index + 1;
    const code = raw.split("//")[0] ?? "";
    if (/\bvar\s+[A-Za-z_$][\w$]*\s*=/.test(code)) {
      push(line, raw.indexOf("var") + 1, "error", "'var' needs Java 10+; source level is Java 8. Declare the type explicitly.");
    }
    if (/^\s*record\s+\w/.test(code)) {
      push(line, 1, "error", "'record' needs Java 16+; source level is Java 8.");
    }
    if (code.includes('"""')) {
      push(line, raw.indexOf('"""') + 1, "error", "Text blocks need Java 15+; source level is Java 8. Use string concatenation.");
    }
    if (/\bList\.of\s*\(|\bSet\.of\s*\(|\bMap\.of\s*\(/.test(code)) {
      push(line, 1, "warning", "List.of/Set.of/Map.of are Java 9+ APIs and may not exist on the hub runtime. Prefer Arrays.asList / Collections.");
    }
    if (/\.isEmpty\(\)/.test(code) && /Optional/.test(content)) {
      push(line, 1, "warning", "Optional.isEmpty() is Java 11+. Use !isPresent() for a Java 8 runtime.");
    }
    if (/\bswitch\s*\(.*\)\s*\{/.test(code) && /->/.test(code)) {
      push(line, 1, "error", "Switch expressions ('->') need Java 14+; source level is Java 8. Use classic case statements.");
    }
  });

  if (fileName.endsWith(".java")) {
    const classMatch = content.match(/public\s+(?:class|interface|enum)\s+([A-Za-z_$][\w$]*)/);
    if (classMatch && `${classMatch[1]}.java` !== fileName) {
      push(1, 1, "error", `Public type ${classMatch[1]} must live in ${classMatch[1]}.java (found ${fileName}).`);
    }
    if (/extends\s+(LinearOpMode|OpMode)\b/.test(content)) {
      if (!/@TeleOp|@Autonomous|@Utility/.test(content)) {
        push(1, 1, "warning", "OpMode has no @TeleOp/@Autonomous/@Utility annotation, so it will not appear on the Driver Station.");
      }
    }
    // SDK v12 cluster check: legacy single-tag field access without a subtype branch.
    if (/AprilTagDetection\s+\w+\s*;/.test(content) && !/instanceof\s+AprilTag(Single|Cluster)Detection/.test(content)) {
      const at = content.indexOf("AprilTagDetection");
      const line = content.slice(0, at).split("\n").length;
      push(line, 1, "error", "SDK v12: branch on AprilTagSingleDetection vs AprilTagClusterDetection before reading pose fields.");
    }
  }
  return problems.slice(0, 100);
}

/** Minimal Java tokenizer for editor highlighting (comments/strings/keywords first). */
export function highlightJavaLine(line: string): JavaToken[] {
  const tokens: JavaToken[] = [];
  let i = 0;
  const push = (text: string, kind: JavaToken["kind"]) => {
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += text;
    else tokens.push({ text, kind });
  };
  while (i < line.length) {
    const rest = line.slice(i);
    const comment = rest.match(/^\/\/.*/);
    if (comment) {
      push(comment[0], "comment");
      break;
    }
    const str = rest.match(/^"(?:[^"\\]|\\.)*"?/);
    if (str) {
      push(str[0], "string");
      i += str[0].length;
      continue;
    }
    const ch = rest.match(/^'[^']*'?/);
    if (ch) {
      push(ch[0], "string");
      i += ch[0].length;
      continue;
    }
    const ann = rest.match(/^@[A-Za-z_]\w*/);
    if (ann) {
      push(ann[0], "annotation");
      i += ann[0].length;
      continue;
    }
    const num = rest.match(/^\b\d[\d_]*(?:\.\d+)?[fLdD]?/);
    if (num) {
      push(num[0], "number");
      i += num[0].length;
      continue;
    }
    const word = rest.match(/^[A-Za-z_$][\w$]*/);
    if (word) {
      const w = word[0];
      push(w, JAVA_KEYWORDS.has(w) ? "keyword" : FTC_TYPES.has(w) ? "type" : "plain");
      i += w.length;
      continue;
    }
    push(line[i], "plain");
    i += 1;
  }
  return tokens;
}

/** Map a TeamCode path to its OnBotJava location on the hub. */
export function onBotPathFor(repoPath: string): string {
  const marker = "org/firstinspires/ftc/teamcode/";
  const idx = repoPath.indexOf(marker);
  if (idx >= 0) return repoPath.slice(idx);
  return repoPath.split("/").pop() ?? repoPath;
}
