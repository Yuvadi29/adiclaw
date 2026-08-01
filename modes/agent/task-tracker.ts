import chalk from "chalk";

export type TaskStatus =
    | "pending"
    | "running"
    | "completed"
    | "failed";

export interface Task {
    id: string;
    title: string;
    status: TaskStatus;
}

export class TaskTracker {
    private tasks: Task[] = [];

    setTasks(tasks: Task[]) {
        this.tasks = tasks;
        console.log(chalk.bold.cyan("\n📋 Agent Tasks Planned:"));
        this.list();
    }

    start(id: string) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.status = "running";
            console.log(chalk.yellow(`\n⏳ Started Task: `) + task.title);
        }
    }

    complete(id: string) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.status = "completed";
            console.log(chalk.green(`\n✅ Completed Task: `) + task.title);
        }
    }

    fail(id: string) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.status = "failed";
            console.log(chalk.red(`\n❌ Failed Task: `) + task.title);
        }
    }

    list() {
        for (const task of this.tasks) {
            let icon = "⏳";
            let color = chalk.dim;
            
            if (task.status === "completed") {
                icon = "✅";
                color = chalk.green;
            } else if (task.status === "failed") {
                icon = "❌";
                color = chalk.red;
            } else if (task.status === "running") {
                icon = "⚙️ ";
                color = chalk.yellow;
            }

            console.log(`  ${icon} ${color(task.title)}`);
        }
        console.log();
    }
}
