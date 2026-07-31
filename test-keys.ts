import * as readline from "readline";

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

console.log("Type something (press Ctrl+C to exit):");

process.stdin.on("keypress", (str, key) => {
    if (key.ctrl && key.name === "c") {
        process.exit();
    }
    console.log(`You pressed: ${str} (key: ${JSON.stringify(key)})`);
});
