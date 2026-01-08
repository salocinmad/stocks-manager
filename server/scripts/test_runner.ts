import { spawn } from "bun";

async function runTests() {
    console.log("🚀 Ejecutando Tests...");

    const proc = spawn(["bun", "test"], {
        stdout: "pipe",
        stderr: "pipe", // Capture stderr too just in case
        env: { ...process.env, FORCE_COLOR: "1" } // Try to force color if supported, though we might strip/override it
    });

    const text = await new Response(proc.stdout).text();
    const errText = await new Response(proc.stderr).text();

    const fullOutput = text + errText;
    const lines = fullOutput.split("\n");

    const passLines: string[] = [];
    const failLines: string[] = [];

    // Regex to detect test result lines
    // Bun outputs: "✓ Test Name [time]" or "✗ Test Name [time]"
    const passRegex = /✓/;
    const fileHeaderRegex = /^[\w\/\.-]+\.(test|spec)\.(ts|js|tsx):$/; // Heuristic for file headers

    for (const line of lines) {
        // Strip ANSI codes for regex matching
        const cleanLine = line.replace(/\u001b\[.*?m/g, "");

        if (passRegex.test(cleanLine)) {
            passLines.push(line); // Keep original formatting/color if any
        } else {
            failLines.push(line);
        }
    }

    // Formatting Output
    const GREEN = "\x1b[32m";
    const RED = "\x1b[31m";
    const YELLOW = "\x1b[33m";
    const ORANGE = "\x1b[38;5;214m"; // Approximation for Orange
    const RESET = "\x1b[0m";
    const BOLD = "\x1b[1m";

    // Write DEBUG LOG to file (strip ANSI codes for readability in standard editors)
    const cleanOutput = fullOutput.replace(/\u001b\[.*?m/g, "");
    const logPath = "server/tests/test_debug.log";

    try {
        await Bun.write(logPath, cleanOutput);
        console.log(YELLOW + `\n📄 Log de debug guardado en: ${logPath}` + RESET);
    } catch (err) {
        console.error(RED + "Error escribiendo log de debug:" + RESET, err);
    }

    console.log("\n" + BOLD + "===============================================================" + RESET);
    console.log(BOLD + "✅  TESTS PASADOS" + RESET);
    console.log(BOLD + "===============================================================" + RESET);

    if (passLines.length > 0) {
        passLines.forEach(l => console.log(GREEN + l.trim() + RESET));
    } else {
        console.log(YELLOW + "No passed tests found." + RESET);
    }

    console.log("\n" + BOLD + "===============================================================" + RESET);
    console.log(BOLD + "❌  FALLOS Y ERRORES" + RESET);
    console.log(BOLD + "===============================================================" + RESET);

    const cleanFailLines: string[] = [];
    let bufferHeader: string | null = null;
    let hasContentUnderHeader = false;

    for (const line of failLines) {
        const cleanLine = line.replace(/\u001b\[.*?m/g, "");

        // Logic for CONSOLE output:
        // User wants ONLY summary in terminal (no stack traces).
        // We only print lines that contain the failure mark '✗' or seem like a summary.

        if (cleanLine.includes("✗")) {
            cleanFailLines.push(line);
        } else if (cleanLine.includes("pass") && cleanLine.includes("fail")) {
            // Summary line: " 24 pass, 1 fail"
            cleanFailLines.push(line);
        } else if (cleanLine.startsWith("Ran ") && cleanLine.includes("tests")) {
            // Final summary: "Ran X tests..."
            cleanFailLines.push(line);
        }
        // Everything else (stack traces, diffs, debug logs) is ignored for CONSOLE,
        // but is ALREADY written to 'test_debug.log' via 'fullOutput'.
    }

    cleanFailLines.forEach(l => console.log(RED + l + RESET));

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
        console.log("\n" + ORANGE + "⚠️  DETALLES DEL FALLO GUARDADOS EN:" + RESET);
        console.log(BOLD + `👉 ${logPath}` + RESET);
        console.log("   (Abre este archivo para ver stack traces y diferencias)");
    }

    process.exit(exitCode);
}

runTests();
