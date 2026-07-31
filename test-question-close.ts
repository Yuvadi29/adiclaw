import * as readline from "readline/promises";

async function run() {
    console.log("Starting");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    
    setTimeout(() => {
        console.log("Calling rl.write(\\n)");
        rl.write('\n');
    }, 1000);

    const answer = await rl.question("Prompt > ");
    console.log("Resolved with: " + JSON.stringify(answer));
    rl.close();
    console.log("Done");
}
run();
