import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Dropdown,
  Field,
  staticClasses,
} from "@decky/ui";
import { definePlugin, callable, toaster } from "@decky/api";
import { useEffect, useMemo, useRef, useState } from "react";

type Status = {
  ok: boolean;
  error?: string;
  profile?: string;
  cpu_rpm?: number | null;
  gpu_rpm?: number | null;
  cpu_temp_c?: number | null;
  gpu_temp_c?: number | null;
  pwm1_enable?: number;
  pwm2_enable?: number;
};

const getStatus = callable<[], Status>("get_status");
const setProfile = callable<[profile: string], { ok: boolean; error?: string }>("set_profile");

function pushFixed(buf: number[], v: number, maxLen: number) {
  const next = buf.length >= maxLen ? buf.slice(1) : buf.slice();
  next.push(v);
  return next;
}

function Sparkline({ data, height = 40 }: { data: number[]; height?: number }) {
  const width = 260;
  const pad = 4;

  const { d } = useMemo(() => {
    if (!data.length) return { d: "" };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = Math.max(1e-9, max - min);

    const step = (width - pad * 2) / Math.max(1, data.length - 1);
    const pts = data.map((v, i) => {
      const x = pad + i * step;
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return [x, y] as const;
    });

    const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
    return { d: path };
  }, [data, height]);

  return (
    <svg width={width} height={height} className={staticClasses.PanelSectionRow}>
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Content() {
  const [status, setStatusState] = useState<Status>({ ok: false });
  const [profile, setProfileState] = useState<string>("aggressive");

  const [cpuTemps, setCpuTemps] = useState<number[]>([]);
  const [gpuTemps, setGpuTemps] = useState<number[]>([]);
  const [cpuRpms, setCpuRpms] = useState<number[]>([]);
  const [gpuRpms, setGpuRpms] = useState<number[]>([]);

  const timerRef = useRef<number | null>(null);

  async function refresh() {
    try {
      const s = await getStatus();
      setStatusState(s);
      if (s.ok && s.profile) setProfileState(s.profile);

      if (s.ok) {
        if (typeof s.cpu_temp_c === "number") setCpuTemps((b) => pushFixed(b, s.cpu_temp_c!, 120));
        if (typeof s.gpu_temp_c === "number") setGpuTemps((b) => pushFixed(b, s.gpu_temp_c!, 120));
        if (typeof s.cpu_rpm === "number") setCpuRpms((b) => pushFixed(b, s.cpu_rpm!, 120));
        if (typeof s.gpu_rpm === "number") setGpuRpms((b) => pushFixed(b, s.gpu_rpm!, 120));
      }
    } catch (e: any) {
      setStatusState({ ok: false, error: String(e?.message ?? e) });
    }
  }

  useEffect(() => {
    refresh();
    timerRef.current = window.setInterval(refresh, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  const apply = async (p: string) => {
    const res = await setProfile(p);
    if (!res.ok) {
      toaster.toast({ title: "Apply failed", body: res.error ?? "Unknown error" });
      return;
    }
    toaster.toast({ title: "Fan profile applied", body: p.toUpperCase() });
    await refresh();
  };

  return (
    <PanelSection title="ROG Ally Fan Control">
    <PanelSectionRow>
    <Dropdown
    rgOptions={[
      { data: "balanced", label: "Balanced (stock)" },
          { data: "aggressive", label: "Aggressive" },
    ]}
    selectedOption={profile}
    onChange={(o) => setProfileState(o.data)}
    />
    </PanelSectionRow>

    <PanelSectionRow>
    <ButtonItem layout="below" onClick={() => apply(profile)}>
    Apply Profile
    </ButtonItem>
    </PanelSectionRow>

    {!status.ok ? (
      <PanelSectionRow>
      <Field label="Status">{status.error ?? "Not ready"}</Field>
      </PanelSectionRow>
    ) : (
      <>
      <PanelSectionRow>
      <Field label="CPU Temp (°C)">{status.cpu_temp_c?.toFixed?.(1) ?? "n/a"}</Field>
      </PanelSectionRow>
      <PanelSectionRow><Sparkline data={cpuTemps} /></PanelSectionRow>

      <PanelSectionRow>
      <Field label="GPU Temp (°C)">{status.gpu_temp_c?.toFixed?.(1) ?? "n/a"}</Field>
      </PanelSectionRow>
      <PanelSectionRow><Sparkline data={gpuTemps} /></PanelSectionRow>

      <PanelSectionRow>
      <Field label="CPU Fan (RPM)">{status.cpu_rpm ?? "n/a"}</Field>
      </PanelSectionRow>
      <PanelSectionRow><Sparkline data={cpuRpms} /></PanelSectionRow>

      <PanelSectionRow>
      <Field label="GPU Fan (RPM)">{status.gpu_rpm ?? "n/a"}</Field>
      </PanelSectionRow>
      <PanelSectionRow><Sparkline data={gpuRpms} /></PanelSectionRow>

      <PanelSectionRow>
      <Field label="Curve Mode">
      pwm1_enable={status.pwm1_enable} / pwm2_enable={status.pwm2_enable}
      </Field>
      </PanelSectionRow>
      </>
    )}
    </PanelSection>
  );
}

export default definePlugin(() => {
  return {
    name: "Ally Fan Control",
    titleView: <div className={staticClasses.Title}>Ally Fan</div>,
    content: <Content />,
    icon: <span style={{ fontWeight: 700 }}>F</span>,
    onDismount() {},
  };
});
