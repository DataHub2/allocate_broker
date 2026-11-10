import { memo } from "react";
import type { Zone } from "@/lib/detect-job";

/** A cross-section of a house, with its pipes and cables drawn as circuit traces. Decorative: the page says the same in words. */

const range = (start: number, end: number, step: number) => Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => start + i * step);
const wiggle = (i: number, amount: number) => Math.round(Math.sin(i * 2.399) * amount);

const panel = { x: 1490, y: 700 };

const cables = range(0, 15, 1).map((i) => {
  const y = panel.y - 44 + i * 6;
  const goesUp = i < 9;
  const run = 90 + i * 34 + wiggle(i, 18);
  const x = panel.x - run;
  const floorY = goesUp ? 598 - i * 7 : 770 + (i - 9) * 7;
  const endX = x - 60 - wiggle(i * 3, 46) - i * 8;
  return { d: `M${panel.x} ${y}H${x}V${floorY}H${endX}`, node: [endX, floorY] as const, delay: i * 70 };
});

const upperCables = range(0, 10, 1).map((i) => {
  const x = 1360 - i * 30;
  const y = 548 - i * 9;
  const end = x - 120 - wiggle(i, 40);
  return { d: `M${x} 598V${y}H${end}V${y - 30 - wiggle(i + 2, 16)}`, node: [end, y - 30 - wiggle(i + 2, 16)] as const, delay: 900 + i * 70 };
});

const groundCables = range(0, 8, 1).map((i) => {
  const y = 864 + i * 8;
  return { d: `M0 ${y}H${430 + i * 22}V${830 + (i % 3) * 8}H${640 + i * 14}`, node: [640 + i * 14, 830 + (i % 3) * 8] as const, delay: i * 60 };
});

const pipeRisers = [0, 1, 2].map((i) => ({
  d: `M${820 + i * 12} 884V${588 + i * 8}H${1290 - i * 12}V${470 + i * 12}H${1400 - i * 10}`,
  delay: 300 + i * 120,
}));

const pipes = [
  ...pipeRisers,
  { d: "M0 900H560V884H812", delay: 0 },
  { d: "M0 916H576V896H812", delay: 100 },
  { d: "M0 932H592V908H812", delay: 200 },
  { d: "M832 700H720V770H700", delay: 700 },
  { d: "M844 712H740V786H700", delay: 760 },
  { d: "M1020 588V690H1130", delay: 820 },
  { d: "M1032 596V706H1130", delay: 880 },
  { d: "M1290 470V400H1230V520", delay: 980 },
  { d: "M1278 482V412H1244V520", delay: 1040 },
];

const rafterSteps = range(0, 1, 0.05);
const ridge = { x: 1098, y: 118 };
const eaveLeft = { x: 600, y: 372 };
const eaveRight = { x: 1596, y: 372 };

const ZONES: { zone: Zone; shape: string }[] = [
  { zone: "bad", shape: "M1192 372H1520V560H1192Z" },
  { zone: "kok", shape: "M676 580H1010V806H676Z" },
  { zone: "el", shape: "M1252 580H1520V806H1252Z" },
  { zone: "vvs", shape: "M676 830H1520V934H676Z" },
  { zone: "tak", shape: `M${eaveLeft.x} ${eaveLeft.y}L${ridge.x} ${ridge.y}L${eaveRight.x} ${eaveRight.y}Z` },
  { zone: "golv", shape: "M676 790H1520V820H676ZM676 544H1520V560H676Z" },
  { zone: "mal", shape: "M1022 580H1240V806H1022Z" },
  { zone: "fasad", shape: "M648 372H688V820H648ZM1508 372H1548V820H1508Z" },
  { zone: "mark", shape: "M0 820H1600V862H0Z" },
];

/** What a site manager would scribble on the drawing. */
const NOTES: { zone: Zone; x: number; y: number; rotate: number; text: string }[] = [
  { zone: "bad", x: 1232, y: 436, rotate: -3, text: "golvbrunnen från -74?" },
  { zone: "kok", x: 700, y: 625, rotate: -2, text: "bärande vägg?" },
  { zone: "el", x: 1268, y: 640, rotate: 2, text: "proppar, på riktigt?" },
  { zone: "vvs", x: 960, y: 905, rotate: -2, text: "dags för stambyte?" },
  { zone: "tak", x: 1150, y: 262, rotate: -4, text: "läcker vid skorstenen" },
  { zone: "golv", x: 1040, y: 770, rotate: 2, text: "sluttar lite här" },
  { zone: "mal", x: 1034, y: 650, rotate: -3, text: "två strykningar" },
  { zone: "fasad", x: 1290, y: 340, rotate: 3, text: "rötskada i knuten?" },
  { zone: "mark", x: 240, y: 800, rotate: -2, text: "kolla ledningarna först" },
];

const PULSES = [pipeRisers[0], pipeRisers[2], pipes[3], pipes[5]];

export const HouseSection = memo(function HouseSection({ zones }: { zones: Zone[] }) {
  const on = (zone: Zone) => zones.includes(zone);
  return (
    <svg className="house" viewBox="0 0 1600 1000" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
      <g className="house-grid">
        {range(0, 1600, 40).map((x) => <line key={`v${x}`} x1={x} y1={0} x2={x} y2={1000} />)}
        {range(0, 1000, 40).map((y) => <line key={`h${y}`} x1={0} y1={y} x2={1600} y2={y} />)}
      </g>

      <g className="house-structure">
        {/* Ground and soil */}
        <line x1={0} y1={820} x2={1600} y2={820} strokeWidth={2} />
        {range(0, 1590, 14).map((x, i) => <line key={x} x1={x} y1={826 + (i % 4) * 3} x2={x + 7} y2={836 + (i % 4) * 3} />)}
        {/* Foundation and basement */}
        <path d="M660 820V950H1536V820" strokeWidth={2} />
        <path d="M676 830V934H1520V830" />
        {range(664, 1532, 16).map((x) => <line key={x} x1={x} y1={940} x2={x + 8} y2={950} />)}
        {/* Outer walls with studs */}
        <path d="M660 820V372M676 820V372M1520 820V372M1536 820V372" strokeWidth={1.6} />
        {range(380, 816, 13).map((y) => <g key={y}><line x1={660} y1={y} x2={676} y2={y + 8} /><line x1={1520} y1={y} x2={1536} y2={y + 8} /></g>)}
        {/* Floors with joists */}
        <path d="M676 560H1520M676 580H1520M676 806H1520M676 820H1520" strokeWidth={1.4} />
        {range(684, 1516, 12).map((x) => <line key={x} x1={x} y1={560} x2={x} y2={580} />)}
        {range(680, 1516, 9).map((x) => <line key={x} x1={x} y1={806} x2={x + 4} y2={820} />)}
        {/* Inner walls */}
        <path d="M1010 806V580M1022 806V580M1240 806V580M1252 806V580M1180 560V360M1192 560V360" />
        {/* Roof */}
        <path d={`M${eaveLeft.x} ${eaveLeft.y}L${ridge.x} ${ridge.y}L${eaveRight.x} ${eaveRight.y}`} strokeWidth={2} />
        <path d={`M${eaveLeft.x + 18} ${eaveLeft.y + 12}L${ridge.x} ${ridge.y + 26}L${eaveRight.x - 18} ${eaveRight.y + 12}`} strokeWidth={1.4} />
        {rafterSteps.map((t, i) => {
          const lx = eaveLeft.x + (ridge.x - eaveLeft.x) * t;
          const ly = eaveLeft.y + (ridge.y - eaveLeft.y) * t;
          const rx = eaveRight.x + (ridge.x - eaveRight.x) * t;
          const ry = eaveRight.y + (ridge.y - eaveRight.y) * t;
          const down = i % 2 === 0 ? 372 : 356;
          return (
            <g key={t}>
              <line x1={lx} y1={ly + 14} x2={lx + 44} y2={down} />
              <line x1={rx} y1={ry + 14} x2={rx - 44} y2={down} />
              <line x1={lx} y1={ly} x2={lx + 3} y2={ly + 24} />
              <line x1={rx} y1={ry} x2={rx - 3} y2={ry + 24} />
            </g>
          );
        })}
        <path d="M660 372H1536M660 356H1536" strokeWidth={1.4} />
        {/* Fixtures */}
        <rect x={1300} y={500} width={170} height={52} rx={18} />
        <rect x={1312} y={510} width={146} height={32} rx={12} />
        <path d="M1216 552V520H1252V552M1206 520H1262" />
        <rect x={710} y={738} width={250} height={68} />
        {range(730, 950, 44).map((x) => <rect key={x} x={x} y={748} width={34} height={48} />)}
        <rect x={700} y={650} width={270} height={40} />
        {range(708, 960, 44).map((x) => <rect key={x} x={x} y={656} width={36} height={28} />)}
        <rect x={780} y={850} width={96} height={80} rx={4} />
        <rect x={1130} y={676} width={92} height={40} />
        {range(1136, 1220, 7).map((x) => <line key={x} x1={x} y1={680} x2={x} y2={712} />)}
        <rect x={1478} y={650} width={38} height={100} />
      </g>

      <g className="house-zones">
        {ZONES.map((z) => <path key={z.zone} d={z.shape} className={on(z.zone) ? "zone on" : "zone"} />)}
      </g>

      <g className={on("vvs") || on("bad") || on("kok") ? "house-copper hot" : "house-copper"}>
        {pipes.map((p) => <path key={p.d} className="trace" d={p.d} pathLength={1} style={{ animationDelay: `${p.delay}ms` }} />)}
      </g>
      <g className="house-pulse pulse-copper">
        {PULSES.map((p, i) => <path key={p.d} d={p.d} pathLength={1} style={{ animationDelay: `${2600 + i * 900}ms` }} />)}
      </g>
      <g className={on("el") ? "house-cable hot" : "house-cable"}>
        {[...cables, ...upperCables, ...groundCables].map((c) => (
          <g key={c.d}>
            <path className="trace" d={c.d} pathLength={1} style={{ animationDelay: `${c.delay}ms` }} />
            <circle cx={c.node[0]} cy={c.node[1]} r={3.2} />
          </g>
        ))}
      </g>

      <g className="house-pulse pulse-cable">
        {[cables[1], cables[6], cables[11], upperCables[2], upperCables[7], groundCables[3]].map((c, i) => <path key={c.d} d={c.d} pathLength={1} style={{ animationDelay: `${3000 + i * 650}ms` }} />)}
      </g>

      <g className="house-measure">
        <path d="M660 72H1536M660 60V84M1536 60V84" />
        <path d="M1572 372V820M1560 372H1584M1560 820H1584M1560 570H1584" />
        <text x={1098} y={60} textAnchor="middle">9 200</text>
        <text x={1560} y={470} textAnchor="end" transform="rotate(-90 1560 470)">2 400</text>
        <text x={1560} y={700} textAnchor="end" transform="rotate(-90 1560 700)">2 600</text>
      </g>
      <g className="house-notes">
        {NOTES.map((n) => <text key={n.zone} x={n.x} y={n.y} transform={`rotate(${n.rotate} ${n.x} ${n.y})`} className={on(n.zone) ? "on" : undefined}>{n.text}</text>)}
      </g>
    </svg>
  );
});
