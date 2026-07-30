import chalk from "chalk";

const FRAMES = [
    "⠋",
    "⠙",
    "⠹",
    "⠸",
    "⠼",
    "⠴",
    "⠦",
    "⠧",
    "⠇",
    "⠏",
];

const THINKING_MESSAGES = [
    "Thinking...",
    "Planning...",
    "Analyzing code...",
    "Searching project...",
    "Reviewing context...",
    "Choosing next action...",
    "Preparing tool...",
];

export class ActivityRenderer {
    private timer?: Timer;
    private frame = 0;
    private msgIndex = 0;

    private current = "Thinking...";
    private recent: string[] = [];
    private started = false;

    start(message?: string) {
        if (this.started) return;

        this.started = true;

        if (message) {
            this.current = message;
        }

        // Hide cursor
        process.stdout.write("\x1B[?25l");

        this.render();

        this.timer = setInterval(() => {
            this.frame = (this.frame + 1) % FRAMES.length;

            if (this.frame % 20 === 0) {
                this.msgIndex = (this.msgIndex + 1) % THINKING_MESSAGES.length;

                if (
                    this.current === "Thinking..." ||
                    THINKING_MESSAGES.includes(this.current)
                ) {
                    this.current = THINKING_MESSAGES[this.msgIndex] ?? "Thinking...";
                }
            }

            this.render();
        }, 100);
    }

    update(message: string) {
        this.current = message;
        this.render();
    }

    success(message: string) {
        this.recent.unshift(
            chalk.green("✔ ") + message
        );

        this.recent = this.recent.slice(0, 6);

        this.current = "Thinking...";
        this.render();
    }

    fail(message: string) {
        this.recent.unshift(
            chalk.red("✖ ") + message
        );

        this.recent = this.recent.slice(0, 6);

        this.current = "Thinking...";
        this.render();
    }

    stop(finalMessage?: string) {
        if (this.timer) {
            clearInterval(this.timer);
        }

        this.timer = undefined;
        this.started = false;

        // Show cursor again
        process.stdout.write("\x1B[?25h");

        process.stdout.write("\x1B[2K\r");

        if (finalMessage) {
            console.log(chalk.green(`✔ ${finalMessage}`));
        }
    }

    private render() {
        process.stdout.write("\x1B[H");
        process.stdout.write("\x1B[J");

        console.log(chalk.bold.cyan("🤖 AdiClaw Working\n"));

        console.log(
            `${chalk.cyan(FRAMES[this.frame])} ${chalk.bold(this.current)}`
        );

        console.log();

        if (this.recent.length) {
            console.log(chalk.gray("Recent Activity"));
            console.log(chalk.gray("──────────────"));

            for (const item of this.recent) {
                console.log(item);
            }
        }
    }
}

export const activity = new ActivityRenderer();