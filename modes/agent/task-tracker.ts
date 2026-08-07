import chalk from "chalk";
import readline from "readline";

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
    private lastRenderedLines: number = 0;

    setTasks(tasks: Task[]) {
        this.tasks = tasks;
        this.render();
    }

    start(id: string) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.status = "running";
            this.render();
        }
    }

    complete(id: string) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.status = "completed";
            this.render();
        }
    }

    fail(id: string) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.status = "failed";
            this.render();
        }
    }

    clear() {
        if (this.lastRenderedLines > 0) {
            // Move cursor up by the number of lines we rendered
            readline.moveCursor(process.stdout, 0, -this.lastRenderedLines);
            readline.clearScreenDown(process.stdout);
            this.lastRenderedLines = 0;
        }
    }

    detach() {
        this.lastRenderedLines = 0;
    }

    render() {
        if (this.tasks.length === 0) return;
        
        this.clear();

        let output = chalk.bold.cyan("\n📋 Live Task List:\n");
        let lines = 2; // Account for the \n and title

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

            output += `  ${icon} ${color(task.title)}\n`;
            lines++;
        }
        
        process.stdout.write(output);
        this.lastRenderedLines = lines;
    }
}
