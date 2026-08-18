import { describe, expect, test } from "vitest";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const workflowsRoot = join(repoRoot, ".github", "workflows");
const workflowPathPattern = /^\.\/\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/u;
const commitPattern = /^[0-9a-f]{40}$/u;
const remoteSegmentPattern = /^[A-Za-z0-9_.-]+$/u;

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function parseWorkflow(source: string, label: string): JsonObject {
  const document = parseDocument(source, { prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new TypeError(`${label} is not valid unambiguous YAML: ${document.errors[0]?.message ?? "unknown error"}`);
  }
  return object(document.toJS(), label);
}

function assertPinnedRemoteAction(value: string, label: string): void {
  const separator = value.lastIndexOf("@");
  if (separator <= 0 || !commitPattern.test(value.slice(separator + 1))) {
    throw new TypeError(`${label} must use a full lowercase 40-character commit.`);
  }
  const segments = value.slice(0, separator).split("/");
  if (
    segments.length < 2
    || segments.some((segment) =>
      segment === "." || segment === ".." || !remoteSegmentPattern.test(segment))
  ) {
    throw new TypeError(`${label} has an invalid remote action path.`);
  }
}

function semanticActionReferences(
  workflows: ReadonlyMap<string, string>,
): readonly string[] {
  const references: string[] = [];
  for (const [path, source] of workflows) {
    const root = parseWorkflow(source, path);
    const jobs = object(root.jobs, `${path} jobs`);
    for (const [jobName, jobValue] of Object.entries(jobs)) {
      const job = object(jobValue, `${path} job ${jobName}`);
      const reusable = job.uses;
      if (reusable !== undefined) {
        if (typeof reusable !== "string") {
          throw new TypeError(`${path} job ${jobName} uses must be a string.`);
        }
        if (reusable.startsWith("./")) {
          if (!workflowPathPattern.test(reusable) || !workflows.has(reusable)) {
            throw new TypeError(`${path} job ${jobName} references an unknown local workflow.`);
          }
        } else {
          assertPinnedRemoteAction(reusable, `${path} job ${jobName}`);
          references.push(reusable);
        }
      }

      const steps = job.steps;
      if (steps === undefined) continue;
      if (!Array.isArray(steps)) {
        throw new TypeError(`${path} job ${jobName} steps must be an array.`);
      }
      for (const [stepIndex, stepValue] of steps.entries()) {
        const step = object(stepValue, `${path} job ${jobName} step ${String(stepIndex)}`);
        const action = step.uses;
        if (action === undefined) continue;
        if (typeof action !== "string") {
          throw new TypeError(`${path} job ${jobName} step ${String(stepIndex)} uses must be a string.`);
        }
        if (action.startsWith("./")) {
          throw new TypeError(`${path} job ${jobName} step ${String(stepIndex)} uses an unreviewed local action.`);
        }
        assertPinnedRemoteAction(action, `${path} job ${jobName} step ${String(stepIndex)}`);
        references.push(action);
      }
    }
  }
  if (references.length === 0) {
    throw new TypeError("At least one pinned remote action must be present.");
  }
  return references.toSorted();
}

function assertWorkflowCredentialBoundary(
  workflows: ReadonlyMap<string, string>,
): void {
  for (const [path, source] of workflows) {
    const root = parseWorkflow(source, path);
    const permissions = object(root.permissions, `${path} permissions`);
    if (
      Object.keys(permissions).length !== 1
      || permissions.contents !== "read"
    ) {
      throw new TypeError(`${path} must declare only contents: read permissions.`);
    }
    const jobs = object(root.jobs, `${path} jobs`);
    for (const [jobName, jobValue] of Object.entries(jobs)) {
      const job = object(jobValue, `${path} job ${jobName}`);
      if (job.permissions !== undefined) {
        throw new TypeError(`${path} job ${jobName} must not override workflow permissions.`);
      }
      if (!Array.isArray(job.steps)) continue;
      for (const [stepIndex, stepValue] of job.steps.entries()) {
        const step = object(stepValue, `${path} job ${jobName} step ${String(stepIndex)}`);
        if (
          typeof step.uses !== "string"
          || !step.uses.toLowerCase().startsWith("actions/checkout@")
        ) {
          continue;
        }
        const inputs = object(step.with, `${path} checkout inputs`);
        if (inputs["persist-credentials"] !== false) {
          throw new TypeError(`${path} checkout must disable persisted credentials.`);
        }
      }
    }
  }
}

function repositoryWorkflows(): ReadonlyMap<string, string> {
  const workflows = new Map<string, string>();
  for (const entry of readdirSync(workflowsRoot, { withFileTypes: true })) {
    if (!/\.ya?ml$/u.test(entry.name)) continue;
    const absolutePath = join(workflowsRoot, entry.name);
    const stats = lstatSync(absolutePath);
    if (
      !entry.isFile()
      || !stats.isFile()
      || stats.isSymbolicLink()
      || stats.size > 1_048_576
    ) {
      throw new TypeError(`${entry.name} must be a bounded regular workflow file.`);
    }
    workflows.set(`./.github/workflows/${entry.name}`, readFileSync(absolutePath, "utf8"));
  }
  return workflows;
}

describe("GitHub workflow action supply chain", () => {
  test("pins every semantic remote action reference to a full commit", () => {
    const workflows = repositoryWorkflows();
    expect(semanticActionReferences(workflows)).toEqual([
      "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
      "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
      "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
      "cachix/install-nix-action@13d8dd58da0234aa297dedd986986ccb8e7f3e24",
      "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
    ]);
    expect(() => assertWorkflowCredentialBoundary(workflows)).not.toThrow();
  });

  test("rejects mutable, dynamic, and non-string semantic action references", () => {
    for (const uses of ["actions/checkout@v4", "actions/checkout@${{ github.ref }}"] as const) {
      expect(() => semanticActionReferences(new Map([
        ["./.github/workflows/ci.yml", `jobs:\n  test:\n    steps:\n      - uses: ${uses}\n`],
      ]))).toThrow(/full lowercase 40-character commit/u);
    }
    expect(() => semanticActionReferences(new Map([
      ["./.github/workflows/ci.yml", "jobs:\n  test:\n    steps:\n      - uses: 42\n"],
    ]))).toThrow(/uses must be a string/u);
  });

  test("requires every case-equivalent checkout step to discard persisted credentials", () => {
    const commit = "1".repeat(40);
    const workflow = (uses: string, inputs: string) => new Map([
      [
        "./.github/workflows/ci.yml",
        `permissions:\n  contents: read\njobs:\n  test:\n    steps:\n      - uses: ${uses}\n${inputs}`,
      ],
    ]);

    for (const [uses, inputs] of [
      [`actions/checkout@${commit}`, ""],
      [`Actions/Checkout@${commit}`, "        with:\n          persist-credentials: \"false\"\n"],
      [`ACTIONS/CHECKOUT@${commit}`, "        with:\n          fetch-depth: 1\n"],
    ] as const) {
      expect(() => assertWorkflowCredentialBoundary(workflow(uses, inputs))).toThrow(
        /checkout inputs must be an object|disable persisted credentials/u,
      );
    }

    expect(() => assertWorkflowCredentialBoundary(workflow(
      `Actions/Checkout@${commit}`,
      "        with:\n          persist-credentials: false\n",
    ))).not.toThrow();
  });

  test("checks local reusable workflows but ignores unrelated uses data", () => {
    const commit = "1".repeat(40);
    const workflows = new Map([
      [
        "./.github/workflows/ci.yml",
        [
          "env:",
          "  uses: unrelated-data",
          "jobs:",
          "  nix:",
          "    uses: ./.github/workflows/nix.yml",
          "",
        ].join("\n"),
      ],
      [
        "./.github/workflows/nix.yml",
        `jobs:\n  build:\n    steps:\n      - uses: actions/checkout@${commit}\n`,
      ],
    ]);
    expect(semanticActionReferences(workflows)).toEqual([`actions/checkout@${commit}`]);

    workflows.delete("./.github/workflows/nix.yml");
    expect(() => semanticActionReferences(workflows)).toThrow(/unknown local workflow/u);
  });

  test("rejects a vacuous workflow set even when unrelated data contains uses", () => {
    expect(() => semanticActionReferences(new Map([
      ["./.github/workflows/ci.yml", "env:\n  uses: actions/checkout@v4\njobs:\n  test:\n    steps:\n      - run: true\n"],
    ]))).toThrow(/At least one pinned remote action/u);
  });
});
