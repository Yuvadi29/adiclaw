import { select, isCancel } from "@clack/prompts";

async function run() {
    console.log("Line 1");
    console.log("Line 2");
    process.stdout.write("Prompt > \x1b[s"); // save cursor position
    
    // add a newline because clack needs it? 
    console.log();

    const choice = await select({
        message: "Choose:",
        options: [{label: "A", value: "a"}, {label: "B", value: "b"}]
    });

    process.stdout.write("\x1b[u\x1b[J"); // restore cursor and erase down
    console.log(`You chose: ${choice}`);
}
run();
