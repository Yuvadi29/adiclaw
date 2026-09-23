import { cpus, totalmem } from "node:os";

export interface MacHardwareProfile {
  chipModel: string;
  isAppleSilicon: boolean;
  totalCores: number;
  performanceCores: number;
  efficiencyCores: number;
  totalMemoryGB: number;
  gpuCores: number;
  optimalSettings: {
    num_thread: number;
    num_gpu: number;
    num_batch: number;
    num_ubatch: number;
    num_ctx: number;
    keep_alive: string;
  };
}

class HardwareDetector {
  private profile: MacHardwareProfile | null = null;

  getProfile(): MacHardwareProfile {
    if (this.profile) return this.profile;

    const isDarwin = process.platform === "darwin";
    const isArm64 = process.arch === "arm64";
    const isAppleSilicon = isDarwin && isArm64;

    let chipModel = "Unknown Processor";
    let performanceCores = 8;
    let efficiencyCores = 4;
    let gpuCores = 16;

    if (isDarwin) {
      try {
        const brandProc = Bun.spawnSync(["sysctl", "-n", "machdep.cpu.brand_string"]);
        if (brandProc.success) {
          chipModel = brandProc.stdout.toString().trim() || chipModel;
        }

        // Performance cores (perflevel0)
        const pCoreProc = Bun.spawnSync(["sysctl", "-n", "hw.perflevel0.logicalcpu"]);
        if (pCoreProc.success) {
          const val = parseInt(pCoreProc.stdout.toString().trim(), 10);
          if (!isNaN(val) && val > 0) performanceCores = val;
        }

        // Efficiency cores (perflevel1)
        const eCoreProc = Bun.spawnSync(["sysctl", "-n", "hw.perflevel1.logicalcpu"]);
        if (eCoreProc.success) {
          const val = parseInt(eCoreProc.stdout.toString().trim(), 10);
          if (!isNaN(val) && val >= 0) efficiencyCores = val;
        }
      } catch {
        // Fallback to logical CPUs estimate
        const allCores = cpus().length;
        performanceCores = Math.max(4, Math.floor(allCores * 0.7));
        efficiencyCores = allCores - performanceCores;
      }

      if (chipModel.includes("M4 Pro")) {
        gpuCores = 20;
      } else if (chipModel.includes("M4 Max")) {
        gpuCores = 40;
      } else if (chipModel.includes("M4")) {
        gpuCores = 10;
      } else if (chipModel.includes("M3 Pro") || chipModel.includes("M2 Pro") || chipModel.includes("M1 Pro")) {
        gpuCores = 16;
      }
    }

    const totalCores = cpus().length || (performanceCores + efficiencyCores);
    const totalMemoryGB = Math.round(totalmem() / (1024 * 1024 * 1024));

    // Optimal settings targeting Apple Silicon Metal architecture
    this.profile = {
      chipModel,
      isAppleSilicon,
      totalCores,
      performanceCores,
      efficiencyCores,
      totalMemoryGB,
      gpuCores,
      optimalSettings: {
        // Pin threads strictly to Performance cores to avoid efficiency-core stalls
        num_thread: isAppleSilicon ? performanceCores : Math.max(4, totalCores - 2),
        // 100% offload to Metal GPU
        num_gpu: isAppleSilicon ? 99 : 0,
        // High-throughput prompt processing batching
        num_batch: isAppleSilicon ? 1024 : 512,
        num_ubatch: 512,
        // High-capacity context window for full tool schemas, code context, and history
        num_ctx: 16384,
        // Keep resident in unified memory (2 hours)
        keep_alive: "2h",
      },
    };

    return this.profile;
  }

  /**
   * Get options tuned for a specific mode
   */
  getOptionsForMode(mode?: "ask" | "plan" | "agent"): Record<string, any> {
    const base = this.getProfile().optimalSettings;
    switch (mode) {
      case "ask":
        return {
          ...base,
          num_ctx: 16384,
          temperature: 0.6,
        };
      case "plan":
        return {
          ...base,
          num_ctx: 16384,
          temperature: 0.7,
        };
      case "agent":
        return {
          ...base,
          num_ctx: 16384,
          temperature: 0.5,
        };
      default:
        return base;
    }
  }
}

export const macHardware = new HardwareDetector();
