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

    private isBusy = false;
    private resetTimer?: Timer;

    private current = "Thinking...";
    private recent: string[] = [];
    private started = false;

    private provider = "";
    private model = "";

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
            this.render();
        }, 100);
    }

    update(message: string) {
        if (this.resetTimer) clearTimeout(this.resetTimer);
        this.current = message;
        this.isBusy = true;
        this.render();
    }

    success(message: string) {
        this.recent.unshift(
            chalk.green("✔ ") + message
        );

        this.recent = this.recent.slice(0, 6);
        this.isBusy = false;

        if (this.resetTimer) clearTimeout(this.resetTimer);
        this.resetTimer = setTimeout(() => {
            this.current = "Thinking...";
            this.render();
        }, 800);

        this.render();
    }

    done(message?: string) {
        this.isBusy = false;

        if (this.resetTimer) clearTimeout(this.resetTimer);
        this.resetTimer = setTimeout(() => {
            this.current = "Thinking...";
            this.render();
        }, 800);

        this.render();
    }

    fail(message: string) {
        this.recent.unshift(
            chalk.red("✖ ") + message
        );

        this.recent = this.recent.slice(0, 6);
        this.isBusy = false;

        if (this.resetTimer) clearTimeout(this.resetTimer);
        this.resetTimer = setTimeout(() => {
            this.current = "Thinking...";
            this.render();
        }, 800);

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

        const width = process.stdout.columns ?? 80;

        const left = "🤖 AdiClaw";
        const right = `${this.provider} • ${this.model}`;

        const spaces = Math.max(
            1,
            width - left.length - right.length
        );

        console.log(chalk.bold.cyan(left) + " ".repeat(spaces) + chalk.dim(right));
        console.log();
        
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

    setSession(provider: string, model: string) {
        this.provider = provider;
        this.model = model;

        if (this.started) {
            this.render();
        }
    }
}

export const activity = new ActivityRenderer();