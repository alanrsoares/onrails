import { combine, err, ok, type Result, ResultAsync } from "@onrails/result";
import * as compat from "@onrails/result/compat/neverthrow";
import { bench, group } from "mitata";
import * as nt from "neverthrow";
import { blackbox } from "../harness.js";

const DEPTHS = [1, 5, 20] as const;
const COMBINE_SIZES = [4, 16] as const;

const registerConstruct = (): void => {
  group("result-construct", () => {
    bench("core.ok", () => blackbox(ok(1)));
    bench("nt.ok", () => blackbox(nt.ok(1)));
    bench("compat.ok", () => blackbox(compat.ok(1)));
    bench("core.err", () => blackbox(err("e")));
    bench("nt.err", () => blackbox(nt.err("e")));
    bench("compat.err", () => blackbox(compat.err("e")));
  });
};

const registerMapChains = (): void => {
  group("result-map-chain", () => {
    for (const n of DEPTHS) {
      bench(`core.map×${n}`, () => {
        let r: Result<number, never> = ok(1);
        for (let i = 0; i < n; i++) r = r.map((x) => x + 1);
        blackbox(r);
      });
      bench(`nt.map×${n}`, () => {
        let r: nt.Result<number, never> = nt.ok(1);
        for (let i = 0; i < n; i++) r = r.map((x) => x + 1);
        blackbox(r);
      });
      bench(`compat.map×${n}`, () => {
        let r: compat.Result<number, never> = compat.ok(1);
        for (let i = 0; i < n; i++) r = r.map((x) => x + 1);
        blackbox(r);
      });
    }
  });
};

const registerFlatMapChains = (): void => {
  group("result-flatMap-chain", () => {
    for (const n of DEPTHS) {
      bench(`core.flatMap×${n}`, () => {
        let r: Result<number, never> = ok(1);
        for (let i = 0; i < n; i++) r = r.flatMap((x) => ok(x + 1));
        blackbox(r);
      });
      bench(`nt.andThen×${n}`, () => {
        let r: nt.Result<number, never> = nt.ok(1);
        for (let i = 0; i < n; i++) r = r.andThen((x) => nt.ok(x + 1));
        blackbox(r);
      });
      bench(`compat.andThen×${n}`, () => {
        let r: compat.Result<number, never> = compat.ok(1);
        for (let i = 0; i < n; i++) r = r.andThen((x) => compat.ok(x + 1));
        blackbox(r);
      });
    }
  });
};

const registerMatch = (): void => {
  const coreOk = ok(1);
  const coreErr = err("e");
  const ntOk = nt.ok(1);
  const ntErr = nt.err("e");
  const compatOk = compat.ok(1);
  const compatErr = compat.err("e");
  const onOk = (x: number) => x + 1;
  const onErr = (_: string) => -1;

  group("result-match", () => {
    bench("core.match.ok", () => blackbox(coreOk.match(onOk, onErr)));
    bench("nt.match.ok", () => blackbox(ntOk.match(onOk, onErr)));
    bench("compat.match.ok", () => blackbox(compatOk.match(onOk, onErr)));
    bench("core.match.err", () => blackbox(coreErr.match(onOk, onErr)));
    bench("nt.match.err", () => blackbox(ntErr.match(onOk, onErr)));
    bench("compat.match.err", () => blackbox(compatErr.match(onOk, onErr)));
  });
};

const registerCombine = (): void => {
  group("result-combine", () => {
    for (const n of COMBINE_SIZES) {
      const core = Array.from({ length: n }, (_, i) => ok(i));
      const ntArr = Array.from({ length: n }, (_, i) => nt.ok(i));
      const compatArr = Array.from({ length: n }, (_, i) => compat.ok(i));
      bench(`core.combine×${n}`, () => blackbox(combine(core)));
      bench(`nt.combine×${n}`, () => blackbox(nt.Result.combine(ntArr)));
      bench(`compat.combine×${n}`, () => blackbox(compat.Result.combine(compatArr)));
    }
  });
};

const registerAsync = (): void => {
  group("result-async", () => {
    bench("core.async.chain", async () => {
      const r = ResultAsync.ok(1)
        .map((x) => x + 1)
        .andThen((x) => ResultAsync.ok(x + 1));
      blackbox(await r);
    });
    bench("nt.async.chain", async () => {
      const r = nt
        .okAsync(1)
        .map((x) => x + 1)
        .andThen((x) => nt.okAsync(x + 1));
      blackbox(await r);
    });
    bench("compat.async.chain", async () => {
      const r = compat
        .okAsync(1)
        .map((x) => x + 1)
        .andThen((x) => compat.okAsync(x + 1));
      blackbox(await r);
    });
  });
};

/** Register Result runtime benches (core vs neverthrow; compat is a side lane). */
export const registerResultBenches = (): void => {
  registerConstruct();
  registerMapChains();
  registerFlatMapChains();
  registerMatch();
  registerCombine();
  registerAsync();
};
