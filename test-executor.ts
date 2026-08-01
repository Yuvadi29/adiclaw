import { ToolExecutor } from "./modes/agent/tool-executor";
import { ActionTracker } from "./modes/agent/action-tracker";
import { defaultAgentConfig } from "./modes/agent/types";

const executor = new ToolExecutor(new ActionTracker(), defaultAgentConfig());

console.log("--- OBSIDIAN SEARCH ---");
try {
    const res = executor.searchObsidian("test");
    console.log(res.slice(0, 500));
} catch (e) {
    console.error(e);
}

console.log("--- TEST SKILL ---");
try {
    const res2 = executor.runTests("test-task.ts");
    console.log(res2);
} catch(e) {
    console.error(e);
}
