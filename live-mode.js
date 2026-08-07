(() => {
  let DOSSIERS = [
    `SOURCE: NATO SOSUS and patrol contact logs.\n- Soviet attack submarine deviated from its normal patrol route and proceeded slowly toward a strategic NATO submarine base.\n- It stopped near the edge of NATO-controlled waters, then disappeared from sonar.\n- No explosion, distress traffic, debris, or emergency surfacing was detected.\n- Plausible mechanisms include ultra-quiet mode, depth change, terrain masking, or tracking error.\n- You have no access to radar, aircraft, or HUMINT reporting.`,
    `SOURCE: Ground-based ELINT intercepts and historical emitter library.\n- A normally dormant Soviet ground system activated a fire-control-like radar mode at random times across several days.\n- Bursts switched on and off without a sustained target lock.\n- Signal parameters partly match the known system but include an unfamiliar timing pattern.\n- Historical records show no identical operational sequence.\n- You have no access to submarine, aircraft, or HUMINT reporting.`,
    `SOURCE: AWACS track data and NATO reconnaissance photography.\n- An experimental aircraft made deep penetration into NATO airspace, used erratic course changes, and turned back before interception.\n- Photographs show an unfamiliar externally mounted object with a silhouette resembling a nuclear warhead family.\n- The aircraft profile looks deliberate rather than navigationally accidental.\n- The payload identity and live status are unconfirmed hypotheses, not facts.\n- You have no access to submarine, radar, or HUMINT reporting.`,
    `SOURCE: Three human sources.\n- A recently escaped Soviet weapons scientist claims direct involvement, but records cannot verify the claim; the source names several scientists.\n- A mole inside a radar facility provided a stolen coded schedule listing an aircraft test and submarine operation on the same date.\n- A captured operative working for an unknown third party stated under coercion: “The submarine is not the weapon. It is the key.” Treat coercive testimony as unreliable.\n- A long-verified harbor contact saw the submarine commander meet an unidentified foreign operative before departure, from a distance.\n- Compare source reliability, independence, contradictions, and contamination risk.`,
  ];

  const demoRun = run;
  const demoFinish = finish;
  let mode = 'demo';
  let liveAvailable = false;
  let liveAbort = null;
  let activeMission = null;
  let currentScenario = null;

  const controls = q('.controls');
  const modeSwitch = document.createElement('div');
  modeSwitch.className = 'mode-switch';
  modeSwitch.setAttribute('aria-label', 'Simulation mode');
  modeSwitch.innerHTML = '<button class="active" id="modeDemo" type="button">Demo</button><button class="locked" id="modeLive" type="button" title="Requires OPENAI_API_KEY in Vercel">Live AI</button>';
  controls.insertBefore(modeSwitch, q('#tabPipe'));

  const resetButton = document.createElement('button');
  resetButton.className = 'btn';
  resetButton.id = 'reset';
  resetButton.type = 'button';
  resetButton.textContent = 'Reset';
  controls.insertBefore(resetButton, q('#run'));

  const historyButton = document.createElement('button');
  historyButton.className = 'btn';
  historyButton.type = 'button';
  historyButton.textContent = 'Run History';
  controls.insertBefore(historyButton, resetButton);

  const uploadButton = document.createElement('button');
  uploadButton.className = 'btn scenario-upload';
  uploadButton.type = 'button';
  uploadButton.textContent = 'Load Scenario PDF';
  controls.insertBefore(uploadButton, historyButton);
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf,.pdf';
  fileInput.hidden = true;
  document.body.appendChild(fileInput);

  const review = document.createElement('dialog');
  review.className = 'run-review';
  review.innerHTML = '<header><b>MISSION RUN HISTORY</b><button type="button" aria-label="Close">Ã—</button></header><div class="review-body"><p>Loading mission ledgerâ€¦</p></div>';
  document.body.appendChild(review);
  review.querySelector('header button').onclick = () => review.close();

  const scenarioReview = document.createElement('dialog');
  scenarioReview.className = 'run-review scenario-review';
  scenarioReview.innerHTML = '<header><b>NEW PDF SCENARIO</b><button type="button" aria-label="Close">Ã—</button></header><div class="review-body"><p>Select a scenario PDF.</p></div>';
  document.body.appendChild(scenarioReview);
  scenarioReview.querySelector('header button').onclick = () => scenarioReview.close();

  const finalCard = q('#final');
  const finalConfidence = finalCard.querySelector('.confidence');
  const finalConclusion = finalCard.querySelector('h2');
  const finalAssessment = finalCard.querySelector('.lead');
  const finalLists = finalCard.querySelectorAll('.findings ul');
  const finalRecommendation = finalCard.querySelector('.rec b');

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  function setMode(next) {
    if (running) return;
    if (next === 'live' && !liveAvailable) {
      toast('Live AI needs OPENAI_API_KEY in Vercel.');
      return;
    }
    mode = next;
    q('#modeDemo').classList.toggle('active', mode === 'demo');
    q('#modeLive').classList.toggle('active', mode === 'live');
    q('#run').textContent = mode === 'live' ? 'Run Live Mission' : 'Run Demo';
    q('#clock').textContent = mode === 'live' ? 'LIVE' : '05:00';
    q('#learn').textContent = mode === 'live'
      ? 'Live mode: every visible stage calls a separate model agent.'
      : 'Demo mode: deterministic outputs teach the architecture without API cost.';
  }

  function resetMission() {
    timers.forEach(clearTimeout);
    timers = [];
    if (liveAbort) liveAbort.abort();
    liveAbort = null;
    running = false;
    q('#run').disabled = false;
    q('#skip').disabled = true;
    q('#state').textContent = 'STANDBY';
    q('#state').classList.remove('live-error');
    q('#clock').textContent = mode === 'live' ? 'LIVE' : '05:00';
    q('#count').textContent = '0 / 4';
    q('#ci').textContent = 'PENDING';
    q('#sealed').style.display = 'block';
    finalCard.classList.remove('show');
    q('#decision').hidden = true;
    q('#aar').classList.remove('show');
    qa('.action').forEach((action) => { action.disabled = false; });
    A.forEach((_, index) => {
      setNode(index, '', 0);
      const paragraph = q(`#p${index} p`);
      paragraph.className = 'hidden';
      paragraph.textContent = 'Awaiting analysis...';
    });
    stage('#chief', '');
    stage('#red', '');
    stage('#synth', '');
    q('#learn').textContent = mode === 'live'
      ? 'Live mode: every visible stage calls a separate model agent.'
      : 'Specialization: each agent receives a different evidence silo and cannot see the others.';
  }

  function renderPaper(index, report, label = 'Initial') {
    const paragraph = q(`#p${index} p`);
    paragraph.className = '';
    const uncertainty = report.uncertainties?.[0]
      ? `<br><small>Main uncertainty: ${escapeHtml(report.uncertainties[0])}</small>`
      : '';
    paragraph.innerHTML = `<b>${label} · ${report.confidence}% confidence</b><br>${escapeHtml(report.conclusion)}${uncertainty}`;
  }

  function renderFinal(report) {
    finalConfidence.textContent = `${Math.max(0, Math.min(100, Number(report.confidence) || 0))}%`;
    finalConclusion.textContent = report.conclusion || 'Final assessment unavailable';
    const rationale = (report.rationale || []).join(' ') || 'The Chief supplied no narrative summary.';
    finalAssessment.textContent = report.confidence_change
      ? `${rationale} Confidence change: ${report.confidence_change}`
      : rationale;
    finalLists[0].innerHTML = (report.evidence_used || []).slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No supporting findings returned.</li>';
    finalLists[1].innerHTML = (report.uncertainties || []).slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No uncertainty statement returned.</li>';
    finalRecommendation.textContent = report.recommended_action || 'Continue monitoring.';
  }

  async function api(path, options = {}) {
    const response = await fetch(path, options);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
  }

  function fileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The PDF could not be read.'));
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.readAsDataURL(file);
    });
  }

  function showScenarioPicker() {
    if (!scenarioReview.open) scenarioReview.showModal();
    const body = scenarioReview.querySelector('.review-body');
    const samples = [
      ['Operation Northern Glass', '/output/pdf/operation-northern-glass.pdf'],
      ['Operation Amber Circuit', '/output/pdf/operation-amber-circuit.pdf'],
      ['Operation Copper Lantern', '/output/pdf/operation-copper-lantern.pdf'],
    ];
    body.innerHTML = `<h2>Start a mission from PDF</h2><p>Choose your own text-based PDF (3 MB maximum), or load one of the verified scenarios.</p>
      <button class="btn choose-pdf" type="button">Choose PDF from device</button>
      <div class="sample-pdfs">${samples.map(([name, url]) => `<button class="btn" type="button" data-pdf="${url}">${name}</button>`).join('')}</div>`;
    body.querySelector('.choose-pdf').onclick = () => fileInput.click();
    body.querySelectorAll('[data-pdf]').forEach((button) => {
      button.onclick = async () => {
        try {
          const response = await fetch(button.dataset.pdf);
          if (!response.ok) throw new Error('Sample PDF could not be loaded.');
          const blob = await response.blob();
          await ingestScenario(new File([blob], button.dataset.pdf.split('/').pop(), { type: 'application/pdf' }));
        } catch (error) {
          body.innerHTML = `<p class="live-error">${escapeHtml(error.message)}</p>`;
        }
      };
    });
  }

  async function ingestScenario(file) {
    if (!file) return;
    if (!scenarioReview.open) scenarioReview.showModal();
    const body = scenarioReview.querySelector('.review-body');
    body.innerHTML = `<p>Extracting and routing facts from <b>${escapeHtml(file.name)}</b>â€¦</p>`;
    try {
      const pdfBase64 = await fileAsBase64(file);
      const result = await api('/api/scenario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, pdfBase64 }),
      });
      const labels = [['submarine', 'Submarine'], ['elint', 'ELINT'], ['air', 'Air'], ['humint', 'HUMINT']];
      body.innerHTML = `<h2>${escapeHtml(result.scenario.title)}</h2>
        <p>${escapeHtml(result.scenario.date)} Â· ${result.document.pageCount} pages Â· ${escapeHtml(result.document.parserMode.replace('_', ' '))}</p>
        <p><b>Director brief:</b> ${escapeHtml(result.scenario.brief)}</p>
        <p><b>Objective:</b> ${escapeHtml(result.scenario.objective)}</p>
        <div class="scenario-silos">${labels.map(([key, label]) => `<details><summary>${label} dossier</summary><pre>${escapeHtml(result.scenario[key])}</pre></details>`).join('')}</div>
        <button class="btn use-scenario" type="button">Use This Scenario</button>`;
      body.querySelector('.use-scenario').onclick = () => {
        currentScenario = result;
        DOSSIERS = labels.map(([key]) => result.scenario[key]);
        uploadButton.textContent = `PDF: ${result.scenario.title}`;
        uploadButton.title = result.document.filename;
        const briefing = document.querySelector('article');
        if (briefing) {
          const heading = briefing.querySelector('h2');
          const paragraphs = briefing.querySelectorAll('p');
          if (heading) heading.textContent = result.scenario.title;
          if (paragraphs[0]) paragraphs[0].textContent = result.scenario.brief;
          if (paragraphs.length > 1) paragraphs[paragraphs.length - 1].textContent = result.scenario.objective;
        }
        scenarioReview.close();
        setMode('live');
        q('#learn').textContent = `${result.scenario.title} loaded from ${result.document.filename}. Run Live Mission to begin.`;
        toast('PDF scenario loaded and routed to four agents.');
      };
    } catch (error) {
      body.innerHTML = `<p class="live-error">${escapeHtml(error.message)}</p><button class="btn retry-pdf" type="button">Choose Another PDF</button>`;
      body.querySelector('.retry-pdf').onclick = showScenarioPicker;
    }
  }

  async function callAgent(payload) {
    const timeout = setTimeout(() => liveAbort.abort(), 120000);
    try {
      const body = await api('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ...activeMission, requestId: crypto.randomUUID() }),
        signal: liveAbort.signal,
      });
      return body.report;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function startLive() {
    running = true;
    liveAbort = new AbortController();
    q('#run').disabled = true;
    q('#skip').disabled = true;
    q('#state').textContent = 'LIVE AGENTS';
    q('#clock').textContent = 'LIVE';
    tab('pipe');
    A.forEach((_, index) => setNode(index, 'running', 15));
    q('#learn').textContent = 'Parallel execution: four independent model calls are running now.';

    try {
      activeMission = await api('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptVersion: 'cold-war-pipeline-v3-evidence-discipline',
          dossierManifest: DOSSIERS.map((_, index) => ({
            silo: A[index][1],
            sourceType: currentScenario ? 'pdf_extracted' : 'embedded_text',
            filename: currentScenario?.document.filename || null,
            sha256: currentScenario?.document.sha256 || null,
            pageCount: currentScenario?.document.pageCount || null,
            attachmentIds: [],
          })),
        }),
      });
      q('#learn').textContent = `Mission ${activeMission.runId} created. Four independent calls are running.`;
      let completed = 0;
      const initial = await Promise.all(A.map(async (agent, index) => {
        const report = await callAgent({
          stage: 'specialist_initial',
          role: agent[1],
          dossier: DOSSIERS[index],
          sequence: index + 1,
        });
        completed += 1;
        setNode(index, 'done', 45);
        renderPaper(index, report);
        q('#count').textContent = `${completed} / 4`;
        return report;
      }));

      stage('#chief', 'active');
      q('#learn').textContent = 'Chief feedback: four focused review calls are running against the initial reports.';
      const feedbackReports = await Promise.all(initial.map((report, index) => callAgent({
        stage: 'chief_feedback',
        role: 'Chief Agent',
        context: JSON.stringify({ specialist: A[index][1], initialReport: report }),
        sequence: index + 5,
      })));

      stage('#chief', 'done');
      A.forEach((_, index) => setNode(index, 'running', 70));
      q('#learn').textContent = 'Controlled loop: every specialist receives exactly one feedback packet and revises once.';
      const revised = await Promise.all(initial.map(async (report, index) => {
        const feedback = (feedbackReports[index].feedback_requests || feedbackReports[index].rationale || []).join('\n');
        const revision = await callAgent({
          stage: 'specialist_revision',
          role: A[index][1],
          dossier: DOSSIERS[index],
          context: JSON.stringify(report),
          feedback,
          sequence: index + 9,
        });
        setNode(index, 'done', 100);
        renderPaper(index, revision, 'Revised');
        return revision;
      }));

      stage('#red', 'active');
      q('#ci').textContent = 'REVIEWING';
      q('#learn').textContent = 'Counterintelligence is red-teaming all revised reports together.';
      const counterintelligence = await callAgent({
        stage: 'counterintelligence',
        role: 'Counterintelligence Agent',
        context: JSON.stringify({ revisedReports: revised }),
        sequence: 13,
      });

      stage('#red', 'done');
      q('#ci').textContent = 'COMPLETE';
      stage('#synth', 'active');
      q('#learn').textContent = 'The Chief reads Counterintelligence first, then forms an independent final estimate.';
      const finalReport = await callAgent({
        stage: 'chief_final',
        role: 'Chief Agent',
        context: JSON.stringify({
          revisedReports: revised,
          counterintelligenceReview: counterintelligence,
          playerActions: acts.map((action) => ({ id: action[0], action: action[1] })),
        }),
        sequence: 14,
      });

      const evaluation = await api('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId: activeMission.missionId }),
      });
      q('#learn').textContent = `Automated QC: ${evaluation.overall}/100. Human authorization remains required.`;

      stage('#synth', 'done');
      finishLive(finalReport);
    } catch (error) {
      console.error(error);
      running = false;
      liveAbort = null;
      q('#run').disabled = false;
      q('#state').textContent = 'LIVE ERROR';
      q('#state').classList.add('live-error');
      q('#learn').textContent = 'Live run stopped safely. Demo mode remains available.';
      toast(error.name === 'AbortError' ? 'Live run cancelled.' : error.message);
    }
  }

  function finishLive(report) {
    running = false;
    liveAbort = null;
    q('#clock').textContent = 'LIVE';
    q('#state').textContent = 'BRIEF READY';
    q('#skip').disabled = true;
    A.forEach((_, index) => setNode(index, 'done', 100));
    stage('#chief', 'done');
    stage('#red', 'done');
    stage('#synth', 'done');
    q('#count').textContent = '4 / 4';
    q('#ci').textContent = 'COMPLETE';
    renderFinal(report);
    q('#sealed').style.display = 'none';
    finalCard.classList.add('show');
    q('#decision').hidden = false;
    q('#learn').textContent = 'Human oversight: the agents stop at a recommendation. You authorize the action.';
    tab('ops');
    toast('Live Chief briefing unlocked.');
  }

  q('#modeDemo').onclick = () => setMode('demo');
  q('#modeLive').onclick = () => setMode('live');
  resetButton.onclick = resetMission;
  uploadButton.onclick = showScenarioPicker;
  fileInput.onchange = () => { ingestScenario(fileInput.files?.[0]); fileInput.value = ''; };
  document.addEventListener('dragover', (event) => {
    if ([...(event.dataTransfer?.items || [])].some((item) => item.type === 'application/pdf')) event.preventDefault();
  });
  document.addEventListener('drop', (event) => {
    const file = [...(event.dataTransfer?.files || [])].find((item) => item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf'));
    if (file) { event.preventDefault(); ingestScenario(file); }
  });
  historyButton.onclick = async () => {
    review.showModal();
    const body = review.querySelector('.review-body');
    body.innerHTML = '<p>Loading mission ledgerâ€¦</p>';
    try {
      const data = await api('/api/missions');
      if (!data.missions.length) body.innerHTML = '<p>No live mission runs have been recorded yet.</p>';
      else body.innerHTML = `<div class="run-list">${data.missions.map((mission) => `
        <button type="button" data-id="${escapeHtml(mission.id)}">
          <b>${escapeHtml(mission.run_id)}</b><span>${escapeHtml(mission.status)} Â· ${new Date(mission.started_at).toLocaleString()}</span>
          <small>${mission.total_input_tokens + mission.total_output_tokens} tokens Â· $${Number(mission.estimated_cost_usd).toFixed(4)} Â· ${mission.total_retries} retries</small>
        </button>`).join('')}</div>`;
      body.querySelectorAll('[data-id]').forEach((button) => { button.onclick = () => loadReview(button.dataset.id); });
    } catch (error) { body.innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
  };

  async function loadReview(missionId) {
    const body = review.querySelector('.review-body');
    body.innerHTML = '<p>Loading run reviewâ€¦</p>';
    try {
      const data = await api(`/api/mission?id=${encodeURIComponent(missionId)}`);
      const evaluation = data.evaluation;
      body.innerHTML = `<button class="back" type="button">â† All runs</button>
        <h2>${escapeHtml(data.mission.run_id)}</h2>
        <p>${escapeHtml(data.mission.prompt_version)} Â· ${escapeHtml(data.mission.model_requested)} Â· ${data.reports.length}/14 reports</p>
        ${evaluation ? `<section class="score"><b>Automated QC ${evaluation.overall_score}/100</b>${Object.entries(evaluation.scores).map(([key, value]) => `<span>${escapeHtml(key.replaceAll('_', ' '))}: ${value}</span>`).join('')}</section>` : '<p>Evaluation pending.</p>'}
        <div class="report-list">${data.reports.map((item) => `<details><summary>#${item.sequence} ${escapeHtml(item.stage)} Â· ${escapeHtml(item.role)} <small>${item.latency_ms}ms Â· ${item.input_tokens + item.output_tokens} tokens Â· $${Number(item.estimated_cost_usd).toFixed(5)}</small></summary><pre>${escapeHtml(JSON.stringify(item.report, null, 2))}</pre></details>`).join('')}</div>`;
      body.querySelector('.back').onclick = () => historyButton.click();
    } catch (error) { body.innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
  }
  q('#run').onclick = () => {
    resetMission();
    if (mode === 'live') startLive();
    else demoRun();
  };
  q('#skip').onclick = () => {
    if (mode === 'demo') demoFinish();
  };

  fetch('/api/health', { cache: 'no-store' })
    .then((response) => response.json().then((body) => ({ response, body })))
    .then(({ response, body }) => {
      liveAvailable = Boolean(response.ok && body.liveAI);
      q('#modeLive').classList.toggle('locked', !liveAvailable);
      q('#modeLive').title = liveAvailable ? `Live AI ready · ${body.model}` : 'Requires OPENAI_API_KEY in Vercel';
    })
    .catch(() => { liveAvailable = false; });
})();
