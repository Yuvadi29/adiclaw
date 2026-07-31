import chalk from "chalk";
import { sessionTracker, type SessionStatus } from "./session-tracker";
import { printSessionSummary } from "./summary";
import { activity } from "../../tui/activity";

export function shutdown(status: SessionStatus = "completed", exitCode = 0) {
    // If activity spinner is running, stop it first so it doesn't mess up the summary print
    activity.stop();
    
    sessionTracker.finish(status);
    printSessionSummary();
    process.exit(exitCode);
}

// Global hook to setup signals. Run this once on startup.
export function setupShutdownHandlers() {
    process.on("SIGINT", () => {
        console.log(chalk.dim("\n Goodbye.... \n"));
        shutdown("cancelled", 0);
    });

    process.on("uncaughtException", (err) => {
        console.error(chalk.red("\n[Uncaught Exception]"), err);
        shutdown("crashed", 1);
    });

    process.on("unhandledRejection", (reason) => {
        console.error(chalk.red("\n[Unhandled Rejection]"), reason);
        shutdown("crashed", 1);
    });
}
