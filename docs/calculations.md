# Mathematical Formulas & Calculation Standards

All backend domain services and frontend UI calculation utilities must implement these exact formulas. The golden vectors in `contracts/calculation-vectors.json` are generated from these specifications.

---

## 1. Weight Conversion & Storage
- **Internal Storage:** All weights are converted to and stored as integer **grams** ($1\text{ kg} = 1000\text{ grams}$).
- **Conversion Factor:**
  $$1\text{ lb} = 0.45359237\text{ kg}$$
  $$1\text{ kg} = 2.20462262185\text{ lb}$$
- Rounding: UI displays weights rounded to 1 decimal place ($0.1\text{ kg}$ or $0.1\text{ lb}$).

---

## 2. Estimated 1-Rep Max (1RM)
Calculated using the **Epley Formula**:

$$\text{e1RM} = w \times \left(1 + \frac{r}{30}\right)$$

Where:
- $w$ is the weight lifted in kg.
- $r$ is the number of repetitions completed.

### Rules & Boundary Conditions:
1. If $r = 1$, then $\text{e1RM} = w$ (exact weight lifted).
2. If $r > 12$, calculation is considered unreliable; $\text{e1RM} = \text{nil} / \text{null}$.
3. Result is rounded to 1 decimal place ($0.1\text{ kg}$).

---

## 3. Workout Volume
$$\text{Total Volume} = \sum_{s \in S_{\text{valid}}} (w_s \times r_s)$$

Where $S_{\text{valid}}$ is the set of all sets in the workout satisfying:
1. $s.\text{completed} == \text{true}$
2. $s.\text{set\_type} \ne \text{SetTypeWarmup}$
3. For bodyweight exercises, $w_s$ is only the additional added weight (defaulting to 0 kg if bodyweight only).

---

## 4. Body Mass Index (BMI)
$$\text{BMI} = \frac{\text{weight in kg}}{(\text{height in meters})^2}$$

- Height is provided in centimeters and converted to meters ($h_{\text{m}} = h_{\text{cm}} / 100$).
- Result is rounded to 1 decimal place ($0.1$).

---

## 5. 7-Day Simple Moving Average (SMA) Trend
$$\text{SMA}_t = \frac{1}{\min(N, 7)} \sum_{i=0}^{\min(N, 7)-1} W_{t-i}$$

- $W$ is the series of logged body weights sorted chronologically up to date $t$.
- $N$ is the number of available prior logs within the 7-day window.
- Result is rounded to 1 decimal place ($0.1\text{ kg}$).

---

## 6. Personal Record (PR) Detection Dimensions
A set achieves a Personal Record for an exercise if its value is **strictly greater** ($>$) than the historical maximum:
1. `heaviest_weight`: $\max(w)$ across all completed sets.
2. `best_e1rm`: $\max(\text{e1RM})$ across all completed sets.
3. `max_volume_set`: $\max(w \times r)$ for any single completed set.
4. `max_reps`: $\max(r)$ for a single set with equivalent or greater weight.
