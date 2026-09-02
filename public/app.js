let drug1 = null;
let drug2 = null;
let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  setupSearch(1);
  setupSearch(2);
});

function setupSearch(slot) {
  const input = document.getElementById(`input-drug${slot}`);
  const dropdown = document.getElementById(`dropdown-drug${slot}`);

  input.addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    if (q.length < 2) {
      dropdown.style.display = 'none';
      return;
    }

    try {
      const res = await fetch(`/api/drugs?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      const results = json.data || [];

      if (results.length === 0) {
        dropdown.innerHTML = '<div class="result-item"><span>No matching drugs found</span></div>';
      } else {
        dropdown.innerHTML = results.map(d => `
          <div class="result-item" onclick="selectDrug(${slot}, ${JSON.stringify(d).replace(/"/g, '&quot;')})">
            <strong>${d.generic_name}</strong>
            <span>${d.drug_class || 'Class unspecified'}</span>
          </div>
        `).join('');
      }
      dropdown.style.display = 'block';
    } catch (err) {
      console.error(err);
    }
  });
}

function selectDrug(slot, drug) {
  if (slot === 1) drug1 = drug;
  if (slot === 2) drug2 = drug;

  document.getElementById(`search-container-${slot}`).style.display = 'none';
  document.getElementById(`selected-container-${slot}`).style.display = 'block';
  document.getElementById(`selected-name-${slot}`).innerText = drug.generic_name;
  document.getElementById(`selected-class-${slot}`).innerText = drug.drug_class || '';
  document.getElementById(`dropdown-drug${slot}`).style.display = 'none';

  checkReady();
}

function clearDrug(slot) {
  if (slot === 1) drug1 = null;
  if (slot === 2) drug2 = null;

  document.getElementById(`search-container-${slot}`).style.display = 'block';
  document.getElementById(`selected-container-${slot}`).style.display = 'none';
  document.getElementById(`input-drug${slot}`).value = '';
  
  document.getElementById('report-wrapper').style.display = 'none';
  checkReady();
}

function checkReady() {
  const btn = document.getElementById('btn-analyze');
  if (drug1 && drug2) {
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
  }
}

async function runAnalysis() {
  if (!drug1 || !drug2) return;

  const btn = document.getElementById('btn-analyze');
  const stepper = document.getElementById('stepper-box');
  const report = document.getElementById('report-wrapper');
  const errorBox = document.getElementById('error-box');

  btn.style.display = 'none';
  stepper.style.display = 'block';
  report.style.display = 'none';
  errorBox.style.display = 'none';

  // Animate steps
  const steps = [
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3'),
    document.getElementById('step-4'),
    document.getElementById('step-5')
  ];

  steps.forEach(s => { s.className = 'step-item'; });
  
  let current = 0;
  steps[0].className = 'step-item active';

  const interval = setInterval(() => {
    if (current < steps.length - 1) {
      steps[current].className = 'step-item completed';
      current++;
      steps[current].className = 'step-item active';
    }
  }, 400);

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drug1Id: drug1.id, drug2Id: drug2.id })
    });

    const json = await res.json();
    clearInterval(interval);
    stepper.style.display = 'none';

    if (json.error) {
      errorBox.style.display = 'block';
      document.getElementById('error-text').innerText = json.error;
      btn.style.display = 'inline-flex';
      return;
    }

    renderReport(json.data.analysis);
  } catch (err) {
    clearInterval(interval);
    stepper.style.display = 'none';
    errorBox.style.display = 'block';
    document.getElementById('error-text').innerText = err.message;
    btn.style.display = 'inline-flex';
  }
}

function renderReport(rep) {
  const reportWrapper = document.getElementById('report-wrapper');

  // Executive Badge & Severity
  const badge = document.getElementById('badge-severity');
  const sev = (rep.severity || 'minor').toLowerCase();
  badge.className = `executive-badge badge-${sev}`;
  badge.innerText = rep.severity;

  document.getElementById('exec-title').innerText = rep.overallStatus === 'interaction_detected' ? 'Interaction Detected' : 'No Significant Interaction Identified';
  document.getElementById('confidence-value').innerText = rep.confidence || 'Moderate';
  document.getElementById('exec-summary').innerText = rep.executiveSummary;

  // Mechanisms
  const mechList = document.getElementById('mechanisms-list');
  mechList.innerHTML = (rep.interactionMechanisms || []).map(m => `
    <div class="mechanism-card">
      <strong style="color: var(--accent-blue); fontSize: 1.05rem; display: block; margin-bottom: 0.25rem;">${m.type}</strong>
      <p style="font-size: 0.95rem; color: var(--text-secondary);">${m.explanation}</p>
      <div style="font-size: 0.8rem; color: var(--accent-purple); margin-top: 0.5rem;">Evidence: ${m.evidence}</div>
    </div>
  `).join('');

  // Clinical Significance
  document.getElementById('clinical-significance').innerText = rep.clinicalSignificance;
  document.getElementById('consequences-list').innerHTML = (rep.potentialConsequences || []).map(c => `<li>${c}</li>`).join('');

  // ADME
  document.getElementById('adme-absorption').innerText = rep.admeAnalysis.absorption;
  document.getElementById('adme-distribution').innerText = rep.admeAnalysis.distribution;
  document.getElementById('adme-metabolism').innerText = rep.admeAnalysis.metabolism;
  document.getElementById('adme-excretion').innerText = rep.admeAnalysis.excretion;

  // Toxicity
  document.getElementById('toxicity-risk').innerText = rep.toxicityAnalysis.overallRisk;
  document.getElementById('toxicity-assessment').innerText = rep.toxicityAnalysis.combinedRiskAssessment;
  document.getElementById('toxicity-concerns').innerHTML = (rep.toxicityAnalysis.concerns || []).map(c => `<li>${c}</li>`).join('');

  // Dose Risk
  document.getElementById('dose-threshold').innerText = rep.doseRisk.dangerousDoseThreshold;
  document.getElementById('dose-guidance').innerText = rep.doseRisk.safeCoAdminGuidance;
  document.getElementById('dose-adjustment').innerText = rep.doseRisk.doseAdjustmentNeeded ? 'Required' : 'Not required';

  // Demographics
  document.getElementById('demo-pediatric').innerText = rep.demographicEffects.pediatric;
  document.getElementById('demo-geriatric').innerText = rep.demographicEffects.geriatric;
  document.getElementById('demo-hepatic').innerText = rep.demographicEffects.hepaticImpairment;
  document.getElementById('demo-renal').innerText = rep.demographicEffects.renalImpairment;
  document.getElementById('demo-pregnancy').innerText = rep.demographicEffects.pregnancyLactation;

  // Chart Rendering
  const ctx = document.getElementById('toxicityChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const getRiskScore = (riskStr) => {
    if(!riskStr) return 1;
    if(riskStr.toLowerCase().includes('high')) return 3;
    if(riskStr.toLowerCase().includes('moderate')) return 2;
    return 1;
  };

  chartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Hepatotoxicity', 'Nephrotoxicity', 'Cardiotoxicity', 'Neurotoxicity', 'Interaction Severity'],
      datasets: [{
        label: 'Combined Risk Profile',
        data: [
          Math.max(getRiskScore(drug1.hepatotoxicity_risk), getRiskScore(drug2.hepatotoxicity_risk)),
          Math.max(getRiskScore(drug1.nephrotoxicity_risk), getRiskScore(drug2.nephrotoxicity_risk)),
          Math.max(getRiskScore(drug1.cardiotoxicity_risk), getRiskScore(drug2.cardiotoxicity_risk)),
          Math.max(getRiskScore(drug1.neurotoxicity_risk), getRiskScore(drug2.neurotoxicity_risk)),
          getRiskScore(rep.severity)
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(99, 102, 241, 1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          pointLabels: { color: '#9ca3af', font: { size: 11 } },
          ticks: { display: false, min: 0, max: 3 }
        }
      },
      plugins: { legend: { labels: { color: '#f3f4f6' } } }
    }
  });

  document.getElementById('chat-history').innerHTML = '<div><em>Ask the AI oncology pharmacology assistant a question about this specific drug combination...</em></div>';
  document.getElementById('chat-input').value = '';

  reportWrapper.style.display = 'flex';
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  const history = document.getElementById('chat-history');
  history.innerHTML += `<div style="margin-top: 1rem;"><strong style="color: var(--accent-blue);">You:</strong> ${text}</div>`;
  input.value = '';
  history.scrollTop = history.scrollHeight;

  try {
    const res = await fetch('/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text, drug1Id: drug1.id, drug2Id: drug2.id })
    });
    const json = await res.json();
    history.innerHTML += `<div style="margin-top: 0.5rem;"><strong style="color: #10b981;">AI:</strong> ${json.data}</div>`;
    history.scrollTop = history.scrollHeight;
  } catch (err) {
    history.innerHTML += `<div style="margin-top: 0.5rem; color: #ef4444;"><strong>Error:</strong> Failed to get answer.</div>`;
  }
}
