import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { ToolLoopAgent, stepCountIs } from "ai";
import { getAgentModel } from "../../ai/ai.config.ts";
import { ActionTracker } from "../agent/action-tracker.ts";
import { ToolExecutor } from "../agent/tool-executor.ts";
import { createAgentTools } from "../agent/agent-tools.ts";
import { defaultAgentConfig } from "../agent/types.ts";
import { runApprovalFlow } from "../agent/approval.ts";
import { renderTerminalMarkdown } from "../../tui/terminal-md.ts";
import { generatePlan } from "./planner.ts";
import type { PlanStep } from "./types.ts";
import { createWebTools } from "./web-tools.ts";
import { printPlan, selectSteps } from "./selection.ts";
import { activity } from "../../tui/activity.ts";
import { activityEvents } from "../agent/activity-events.ts";


function stepPrompt(goal: string, step: PlanStep): string {
  return [`Goal: ${goal}`, `Step: ${step.title}`, step.description].join('\n');
}


export async function runPlanMode(): Promise<void> {
  console.log(chalk.bold("\n🧭 Plan Mode\n"));
  activityEvents.onStart(msg => activity.update(msg));
  activityEvents.onFinish(msg => activity.success(msg));
  activityEvents.onSilentFinish(msg => activity.done(msg));
  activityEvents.onFail(msg => activity.fail(msg));

  const goal = await text({ message: "What is your goal?" });
  if (isCancel(goal) || !goal.trim()) return;

  const plan = await generatePlan(goal);

  printPlan(plan);

  const selected = await selectSteps(plan);
  if (selected.length === 0) return;

  const proceed = await confirm({
    message: `Execute ${selected.length} step(s)`,
    initialValue: true,
  });

  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);


  const hasWeb = !!process.env.FIRECRAWL_API_KEY;
  const tools = {
    ...createAgentTools(executor),
    ...(hasWeb ? createWebTools(tracker) : {})
  };

  for (const step of selected) {
    console.log(chalk.bold(`\n🔧 ${step.title}\n`));

    const agent = new ToolLoopAgent({
      model:getAgentModel(),
      stopWhen:stepCountIs(30),
      tools
    });

    activity.start(`Executing Step: ${step.title}...`);
    const allToolCalls: { toolName: string, input: any }[] = [];

    const r = await agent.generate({
      prompt: stepPrompt(plan.goal, step),
      onStepFinish: ({ toolCalls }) => {
        for (const tc of toolCalls) {
          if (!tc) continue;
          allToolCalls.push(tc);
        }
      }
    });

    activity.stop(`Step Finished: ${step.title}`);

    if (allToolCalls.length > 0) {
      console.log(chalk.bold.cyan("\n🛠️  Tools Executed:"));
      for (const tc of allToolCalls) {
        const preview = JSON.stringify(tc.input).slice(0, 80);
        console.log(
          chalk.green(' ✔️'),
          chalk.bold(String(tc.toolName)),
          chalk.dim(preview + (preview.length >= 80 ? "..." : ""))
        );
      }
      console.log();
    }

    if (r.text) console.log(renderTerminalMarkdown(r.text));

  }

  const ok = await runApprovalFlow(tracker);

  if(!ok) return executor.clearStaging();

   const { errors } = executor.applyApprovedFromTracker();
  if (errors.length) {
    console.log(chalk.red('\nSome operations reported errors:\n'));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  } else {
    console.log(chalk.green('\n✓ Applied.\n'));
  }
  executor.clearStaging();
}