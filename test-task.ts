import { TaskTracker } from "./modes/agent/task-tracker";

const tracker = new TaskTracker();
tracker.setTasks([{ id: "1", title: "Test task", status: "pending" }]);
tracker.start("1");
tracker.complete("1");
