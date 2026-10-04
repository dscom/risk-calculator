const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const src = html.split("/* calc:start */")[1].split("/* calc:end */")[0];
const { calculatePosition } = new Function(src + "; return { calculatePosition };")();

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
let fail = 0;
function check(name, got, exp) {
  const ok = Object.keys(exp).every((k) => close(got[k], exp[k], 0.01));
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + name, JSON.stringify(Object.fromEntries(Object.keys(exp).map(k => [k, +got[k].toFixed(4)]))));
}

// EUR account, EUR/USD at 1.08, 1% of 10,000 = 100 EUR, 20 pips.
// Units = 100*1.08/(20*0.0001) = 54,000 -> 0.54 lots; pip value 9.2593 EUR/lot; risk 100 EUR.
check("EURUSD standard", calculatePosition({ balance: 10000, riskPct: 1, stopPips: 20, pipSize: 0.0001, rate: 1.08, contractSize: 100000 }),
  { lots: 0.54, units: 54000, pipValuePerLotEur: 9.2593, actualRiskEur: 100 });

// JPY quote, EUR/JPY-style: 2% of 5,000 = 100 EUR, 30 pips, rate 160.
// Units = 100*160/(30*0.01) = 53,333 -> 0.53 lots (rounded down) -> 53,000 units; actual risk 99.375 EUR.
check("JPY quote rounds down", calculatePosition({ balance: 5000, riskPct: 2, stopPips: 30, pipSize: 0.01, rate: 160, contractSize: 100000 }),
  { lots: 0.53, units: 53000, actualRiskEur: 99.375 });

// EUR quote (EUR/GBP), 1% of 10,000, 25 pips, rate 1 -> 40,000 units = 0.40 lots, pip value 10 EUR.
check("EUR quote", calculatePosition({ balance: 10000, riskPct: 1, stopPips: 25, pipSize: 0.0001, rate: 1, contractSize: 100000 }),
  { lots: 0.40, units: 40000, pipValuePerLotEur: 10 });

// Micro lots: same EURUSD trade, micro contract 1,000 units -> 54,000 units = 54 micro lots.
check("micro lots", calculatePosition({ balance: 10000, riskPct: 1, stopPips: 20, pipSize: 0.0001, rate: 1.08, contractSize: 1000 }),
  { lots: 54, units: 54000, actualRiskEur: 100 });

// Too small for the minimum lot: 1% of 100 EUR, 100 pips -> 0.00108 lots -> 0.
check("below minimum lot", calculatePosition({ balance: 100, riskPct: 1, stopPips: 100, pipSize: 0.0001, rate: 1.08, contractSize: 100000 }),
  { lots: 0, units: 0 });

// Actual risk must never exceed planned risk.
for (const [b, r, s, rate] of [[7310, 1.5, 13, 1.0912], [12345.67, 0.7, 37.4, 0.8531], [50000, 2, 8, 163.2]]) {
  const ps = rate > 10 ? 0.01 : 0.0001;
  const res = calculatePosition({ balance: b, riskPct: r, stopPips: s, pipSize: ps, rate, contractSize: 100000 });
  const ok = res.actualRiskEur <= res.riskEur + 1e-9;
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + `never over-risk ${b}/${r}%/${s}p -> actual ${res.actualRiskEur.toFixed(2)} <= ${res.riskEur.toFixed(2)}`);
}
console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
