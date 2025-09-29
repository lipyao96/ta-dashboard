const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));
app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is running!', timestamp: new Date().toISOString() });
});

// Google Sheets API setup
let auth, sheets;

try {
  auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  sheets = google.sheets({ version: 'v4', auth });
  console.log('Google Sheets API initialized successfully');
} catch (error) {
  console.warn('Google Sheets API initialization failed:', error.message);
  console.log('Running in development mode with mock data');
}

// Mock data for development
const mockDashboardData = {
  roles: [
    {
      name: "Software Engineer",
      stages: [
        { stage_name: "Applied", candidate_count: 150, last_updated: "2024-08-03" },
        { stage_name: "Screening", candidate_count: 45, last_updated: "2024-08-03" },
        { stage_name: "Technical Interview", candidate_count: 20, last_updated: "2024-08-03" },
        { stage_name: "Final Interview", candidate_count: 8, last_updated: "2024-08-03" },
        { stage_name: "Offer", candidate_count: 3, last_updated: "2024-08-03" }
      ],
      remarks: "Strong pipeline, need more senior candidates",
      lastUpdated: "2024-08-03",
      isActive: true,
      funnelHealthScore: 2.0,
      conversionRates: [
        { fromStage: "Applied", toStage: "Screening", rate: 30.0, isLow: false },
        { fromStage: "Screening", toStage: "Technical Interview", rate: 44.4, isLow: false },
        { fromStage: "Technical Interview", toStage: "Final Interview", rate: 40.0, isLow: false },
        { fromStage: "Final Interview", toStage: "Offer", rate: 37.5, isLow: false }
      ]
    },
    {
      name: "Product Manager",
      stages: [
        { stage_name: "Applied", candidate_count: 80, last_updated: "2024-08-02" },
        { stage_name: "Screening", candidate_count: 25, last_updated: "2024-08-02" },
        { stage_name: "Case Study", candidate_count: 10, last_updated: "2024-08-02" },
        { stage_name: "Final Interview", candidate_count: 4, last_updated: "2024-08-02" },
        { stage_name: "Offer", candidate_count: 1, last_updated: "2024-08-02" }
      ],
      remarks: "Need more diverse candidates",
      lastUpdated: "2024-08-02",
      isActive: true,
      funnelHealthScore: 1.25,
      conversionRates: [
        { fromStage: "Applied", toStage: "Screening", rate: 31.3, isLow: false },
        { fromStage: "Screening", toStage: "Case Study", rate: 40.0, isLow: false },
        { fromStage: "Case Study", toStage: "Final Interview", rate: 40.0, isLow: false },
        { fromStage: "Final Interview", toStage: "Offer", rate: 25.0, isLow: true }
      ]
    }
  ]
};

// Dashboard data endpoint
app.get('/api/dashboard', async (req, res) => {
  try {
    // If Google Sheets API is not available, return mock data
    if (!sheets || !auth) {
      console.log('Returning mock dashboard data');
      return res.json(mockDashboardData);
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.log('No Google Sheet ID provided, returning mock data');
      return res.json(mockDashboardData);
    }

    console.log('Fetching data from Google Sheets...');
    console.log('Env FORM_DRIVEN_FUNNEL =', String(process.env.FORM_DRIVEN_FUNNEL || ''));
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: true,
    });

    // Optional: Switch to form-driven aggregation ONLY when explicitly forced via query
    const forceForm = String(req.query.forceForm || '').toLowerCase() === '1' || String(req.query.forceForm || '').toLowerCase() === 'true';
    if (forceForm) {
      console.log('Form-driven path ACTIVATED (explicit force)');
      try {
        const sheetsList = response.data.sheets || [];
        // Prefer a tab that contains variants of Form Responses (with or without underscore/number)
        const formSheet = sheetsList.find(s => {
            const t = (s.properties.title || '').toLowerCase();
            return t.includes('form responses') || t.includes('form_responses') || /form\s*responses\s*\d+/.test(t);
          })
          || sheetsList.find(s => (s.properties.title || '').toLowerCase().includes('form'));
        if (formSheet) {
          const rows = formSheet.data?.[0]?.rowData || [];
          if (rows.length > 0) {
            const headers = rows[0]?.values?.map(v => (v.formattedValue || '').trim()) || [];

            // Resolve indices (robust, ignore persona prefix like [TA] or [Hiring Lead])
            const findIdx = (predicates) => headers.findIndex(h => {
              const t = (h || '').toLowerCase();
              return predicates.some(p => t.includes(p));
            });
            const idxTimestamp = findIdx(['timestamp', 'date']);
            const idxDept = findIdx(['department']);
            const idxRole = findIdx(['role', 'position']);
            const idxNew = findIdx(['new applicants']);
            const idxQuizSent = findIdx(['quiz sent']);
            const idxQuizDone = findIdx(['quiz complet']);
            const idxScreened = findIdx(['screened by ta']);
            const idxTech = findIdx(['technical assessment']);
            const idxHm = findIdx(['interviewed by hm']);
            const idxOffer = findIdx(['offer made']);
            const idxHired = findIdx(['hired']);
            const idxRemarks = findIdx(['remarks']);

            // Group by Department + Role, take the latest row by timestamp
            const keyToRow = new Map();
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r?.values) continue;
              const dept = idxDept >= 0 ? (r.values[idxDept]?.formattedValue || '') : '';
              const role = idxRole >= 0 ? (r.values[idxRole]?.formattedValue || '') : '';
              if (!dept && !role) continue;
              const tsRaw = idxTimestamp >= 0 ? (r.values[idxTimestamp]?.formattedValue || '') : '';
              const ts = new Date(tsRaw && !isNaN(Date.parse(tsRaw)) ? tsRaw : tsRaw.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4}).*/, '$3-$1-$2'));
              const key = `${dept}|||${role}`;
              const prev = keyToRow.get(key);
              if (!prev || (ts instanceof Date && !isNaN(+ts) && +ts > prev.when)) {
                keyToRow.set(key, { row: r, when: +ts || 0, dept, role });
              }
            }

            const stageOrder = [
              { name: 'New Applicants', idx: idxNew },
              { name: 'Quiz Sent', idx: idxQuizSent },
              { name: 'Quiz Completed', idx: idxQuizDone },
              { name: 'Screened by TA', idx: idxScreened },
              { name: 'Technical Assessment', idx: idxTech },
              { name: 'Interviewed by HM', idx: idxHm },
              { name: 'Offer Made', idx: idxOffer },
              { name: 'Hired', idx: idxHired },
            ];

            const rolesFromForm = [];
            for (const { row, when, dept, role } of keyToRow.values()) {
              const stages = stageOrder
                .filter(s => s.idx >= 0)
                .map(s => ({
                  stage_name: s.name,
                  candidate_count: parseInt(row.values[s.idx]?.formattedValue || '0', 10) || 0,
                  last_updated: ''
                }));

              // Build conversion rates
              const conversionRates = [];
              for (let i = 1; i < stages.length; i++) {
                const a = stages[i - 1];
                const b = stages[i];
                const rate = a.candidate_count > 0 ? (b.candidate_count / a.candidate_count) * 100 : 0;
                conversionRates.push({ fromStage: a.stage_name, toStage: b.stage_name, rate, isLow: rate < 30 });
              }

              const totalApplicants = stages[0]?.candidate_count || 0;
              const totalHired = stages[stages.length - 1]?.candidate_count || 0;
              const funnelHealthScore = totalApplicants > 0 ? (totalHired / totalApplicants) * 100 : 0;

              // Date filter (based on latest timestamp)
              if (startDate && endDate && when) {
                if (!(when >= +startDate && when <= +endDate)) continue;
              }

              rolesFromForm.push({
                name: `${dept} - ${role}`,
                stages,
                remarks: idxRemarks >= 0 ? (row.values[idxRemarks]?.formattedValue || '') : '',
                lastUpdated: when ? new Date(when).toLocaleDateString('en-US') : '',
                isActive: true,
                funnelHealthScore,
                conversionRates,
              });
            }

            if (rolesFromForm.length > 0) {
              console.log(`Form-driven funnel: ${rolesFromForm.length} roles`);
              return res.json({ roles: rolesFromForm });
            }

            // Fallback: read a pre-aggregated tab named 'Funnel Analysis'
            const funnelSheet = sheetsList.find(s => (s.properties.title || '').toLowerCase() === 'funnel analysis');
            if (funnelSheet) {
              const fRows = funnelSheet.data?.[0]?.rowData || [];
              if (fRows.length > 0) {
                const h = fRows[0]?.values?.map(v => (v.formattedValue || '').trim()) || [];
                const idxTs = h.findIndex(x => (x || '').toLowerCase().includes('timestamp'));
                const idxDept = h.findIndex(x => (x || '').toLowerCase().startsWith('department'));
                const idxRole = h.findIndex(x => (x || '').toLowerCase().includes('role'));
                // Stage columns are everything except non-funnel fields
                const stageCols = h
                  .map((col, i) => ({ col, i }))
                  .filter(({ col }) => col && !/position|role|department|last_?updated|remarks/i.test(col));

                const rolesFromFunnel = [];
                for (let i = 1; i < fRows.length; i++) {
                  const r = fRows[i];
                  if (!r?.values) continue;
                  // Parse timestamp for date filtering
                  let when = 0;
                  if (idxTs >= 0) {
                    const raw = r.values[idxTs]?.formattedValue || '';
                    const d = raw && !isNaN(Date.parse(raw))
                      ? new Date(raw)
                      : new Date(raw.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4}).*/, '$3-$1-$2'));
                    if (d instanceof Date && !isNaN(+d)) when = +d;
                  }
                  if (startDate && endDate && when) {
                    if (!(when >= +startDate && when <= +endDate)) continue;
                  }
                  const dept = idxDept >= 0 ? (r.values[idxDept]?.formattedValue || '') : '';
                  const role = idxRole >= 0 ? (r.values[idxRole]?.formattedValue || '') : (r.values[0]?.formattedValue || '');
                  if (!role) continue;

                  const stages = stageCols.map(({ col, i: ci }) => ({
                    stage_name: col,
                    candidate_count: parseInt(r.values[ci]?.formattedValue || '0', 10) || 0,
                    last_updated: ''
                  }));

                  // conversion
                  const conversionRates = [];
                  for (let j = 1; j < stages.length; j++) {
                    const a = stages[j - 1];
                    const b = stages[j];
                    const rate = a.candidate_count > 0 ? (b.candidate_count / a.candidate_count) * 100 : 0;
                    conversionRates.push({ fromStage: a.stage_name, toStage: b.stage_name, rate, isLow: rate < 30 });
                  }

                  const totalApplicants = stages[0]?.candidate_count || 0;
                  const totalHired = stages[stages.length - 1]?.candidate_count || 0;
                  const funnelHealthScore = totalApplicants > 0 ? (totalHired / totalApplicants) * 100 : 0;

                  rolesFromFunnel.push({
                    name: `${dept ? dept + ' - ' : ''}${role}`,
                    stages,
                    remarks: '',
                    lastUpdated: when ? new Date(when).toLocaleDateString('en-US') : '',
                    isActive: true,
                    funnelHealthScore,
                    conversionRates,
                  });
                }

                if (rolesFromFunnel.length > 0) {
                  console.log(`Funnel Analysis fallback: ${rolesFromFunnel.length} roles`);
                  return res.json({ roles: rolesFromFunnel });
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Form-driven funnel failed, falling back to role tabs:', e.message);
      }
    }

    const allRoles = [];
    // optional date filtering via query params (YYYY-MM-DD)
    const { start, end } = req.query;
    let startDate = null;
    let endDate = null;
    if (start && end) {
      try {
        // Interpret requested window in GMT+8 (Asia/Kuala_Lumpur / Singapore)
        startDate = new Date(`${start}T00:00:00+08:00`);
        endDate = new Date(`${end}T23:59:59.999+08:00`);
      } catch (_) {
        startDate = null; endDate = null;
      }
    }
    const sheets_data = response.data.sheets;
    
    console.log('Available sheets:', sheets_data.map(sheet => sheet.properties.title));

    for (const sheet of sheets_data) {
      const sheetName = sheet.properties.title;
      
      // Debug: Log all sheet names
      console.log('Processing sheet:', sheetName);
      
      // Skip system sheets and form responses
      if (sheetName.toLowerCase() === 'history' || 
          sheetName.toLowerCase() === 'config' ||
          sheetName.toLowerCase().includes('form responses') ||
          sheetName.toLowerCase().includes('responses')) {
        console.log('Skipping sheet:', sheetName);
        continue;
      }

      const gridData = sheet.data[0];
      if (!gridData || !gridData.rowData) continue;

      // Get headers (funnel stages) from first row
      const headers = gridData.rowData[0]?.values?.map(val => val.formattedValue) || [];
      
      // Filter out non-funnel columns (Position, Last_Updated, Remarks)
      const funnelStages = headers.filter(header => 
        header && 
        !header.toLowerCase().includes('position') &&
        !header.toLowerCase().includes('last_updated') &&
        !header.toLowerCase().includes('remarks') &&
        !header.toLowerCase().includes('department') &&
        !header.toLowerCase().includes('role')
      );
      
      console.log(`Funnel stages for ${sheetName}:`, funnelStages);
      
      let departmentRemarks = '';

      // Process each role (row) starting from row 2
      for (let i = 1; i < gridData.rowData.length; i++) {
        const row = gridData.rowData[i];
        if (!row.values) continue;

        const roleName = row.values[0]?.formattedValue;
        if (!roleName || !roleName.trim()) continue;

        const stages = [];

        // Resolve column indexes for metadata explicitly (avoid relying on row length)
        const lastUpdatedHeaderIndex = headers.findIndex(h => (h || '').toLowerCase().includes('last_updated'));
        const remarksHeaderIndex = headers.findIndex(h => (h || '').toLowerCase().includes('remarks'));
        
        // Process each funnel stage for this role
        for (let j = 0; j < funnelStages.length; j++) {
          const stageName = funnelStages[j];
          // Find the column index for this stage
          const stageColIndex = headers.findIndex(header => header === stageName);
          if (stageColIndex === -1) continue;
          
          const candidateCount = parseInt(row.values[stageColIndex]?.formattedValue) || 0;
          
          if (stageName && stageName.trim()) {
            stages.push({
              stage_name: stageName.trim(),
              candidate_count: candidateCount,
              last_updated: (lastUpdatedHeaderIndex >= 0 ? (row.values[lastUpdatedHeaderIndex]?.formattedValue || '') : '')
            });
          }
        }

        // Get last updated and remarks using header indexes
        const roleRemarks = remarksHeaderIndex >= 0 ? (row.values[remarksHeaderIndex]?.formattedValue || '') : '';
        const lastUpdated = lastUpdatedHeaderIndex >= 0 ? (row.values[lastUpdatedHeaderIndex]?.formattedValue || '') : '';
        if (roleRemarks) departmentRemarks = roleRemarks;


        if (stages.length > 0) {
          console.log(`Processing role "${roleName}" with ${stages.length} stages:`, stages.map(s => ({ name: s.stage_name, count: s.candidate_count })));
          
          const conversionRates = [];
          for (let i = 1; i < stages.length; i++) {
            const currentStage = stages[i];
            const previousStage = stages[i - 1];
            const rate = previousStage.candidate_count > 0 
              ? (currentStage.candidate_count / previousStage.candidate_count) * 100 
              : 0;
            
            conversionRates.push({
              fromStage: previousStage.stage_name,
              toStage: currentStage.stage_name,
              rate: rate,
              isLow: rate < 30
            });
          }

          // Calculate total applicants and hired
          const totalApplicants = stages[0]?.candidate_count || 0;
          const totalHired = stages[stages.length - 1]?.candidate_count || 0;
          const funnelHealthScore = totalApplicants > 0 ? (totalHired / totalApplicants) * 100 : 0;

          // For now, mark all roles as active for development
          let isActive = true;

          // keep only roles within date range when provided
          const roleObj = {
            name: `${sheetName} - ${roleName}`,
            stages: stages,
            remarks: roleRemarks,
            lastUpdated: lastUpdated,
            isActive: isActive,
            funnelHealthScore: funnelHealthScore,
            conversionRates: conversionRates
          };

          if (startDate && endDate) {
            // parse lastUpdated (MM/DD/YYYY expected from sheet)
            const lu = lastUpdated;
            let luDate = null;
            if (lu && typeof lu === 'string') {
              const parts = lu.split('/');
              if (parts.length === 3) {
                luDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
              }
            }
            if (luDate && luDate >= startDate && luDate <= endDate) {
              allRoles.push(roleObj);
            }
          } else {
            allRoles.push(roleObj);
          }
        }
      }
    }

    console.log(`Successfully fetched data for ${allRoles.length} roles`);
    res.json({ roles: allRoles });
  } catch (error) {
    console.error('Error fetching dashboard data:', error.message);
    console.log('Falling back to mock data due to error');
    res.json(mockDashboardData);
  }
});

app.get('/api/export/csv', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ta-dashboard.csv');
    res.send('CSV data would be generated here');
  } catch (error) {
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

app.get('/api/export/pdf', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=ta-dashboard.pdf');
    res.send('PDF data would be generated here');
  } catch (error) {
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// Key Wins endpoint - reads the 'Key Wins' tab with 4 headers:
// Date | Department | Position | Progress/ Remarks
app.get('/api/key-wins', async (req, res) => {
  try {
    if (!sheets || !auth) {
      return res.json({ wins: [] });
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return res.json({ wins: [] });
    }

    const { start, end } = req.query;
    let startDate = null;
    let endDate = null;
    if (start && end) {
      try {
        startDate = new Date(`${start}T00:00:00`);
        endDate = new Date(`${end}T23:59:59`);
      } catch (_) {
        startDate = null; endDate = null;
      }
    }

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: true,
    });

    const targetSheet = response.data.sheets.find(s => (s.properties.title || '').toLowerCase() === 'key wins');
    if (!targetSheet) {
      return res.json({ wins: [] });
    }

    const gridData = targetSheet.data[0];
    const rows = gridData?.rowData || [];
    const headers = rows[0]?.values?.map(v => v.formattedValue?.trim() || '') || [];

    // Resolve column indices with resilient matching
    const idxDate = headers.findIndex(h => (h || '').toLowerCase().startsWith('date'));
    const idxDept = headers.findIndex(h => (h || '').toLowerCase() === 'department');
    const idxPos = headers.findIndex(h => (h || '').toLowerCase() === 'position');
    const idxNotes = headers.findIndex(h => (h || '').toLowerCase().includes('progress'));

    const wins = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r?.values) continue;
      const dateStr = idxDate >= 0 ? (r.values[idxDate]?.formattedValue || '') : '';
      const department = idxDept >= 0 ? (r.values[idxDept]?.formattedValue || '') : '';
      const position = idxPos >= 0 ? (r.values[idxPos]?.formattedValue || '') : '';
      const remarks = idxNotes >= 0 ? (r.values[idxNotes]?.formattedValue || '') : '';

      if (!dateStr && !department && !position && !remarks) continue;

      // Only include rows within date window if provided
      let include = true;
      if (startDate && endDate && dateStr) {
        let d = null;
        const raw = (dateStr || '').trim();
        // 1) yyyy-mm-dd
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          d = new Date(`${raw}T12:00:00`);
        }
        // 2) mm/dd/yyyy (common from Sheets formattedValue)
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
          const [m, dd, yyyy] = raw.split('/').map(v => parseInt(v, 10));
          d = new Date(yyyy, m - 1, dd, 12, 0, 0, 0);
        }
        // 3) numeric serial (in case we ever get numeric value instead of formattedValue)
        else if (!isNaN(Number(raw))) {
          const base = new Date(Date.UTC(1899, 11, 30));
          d = new Date(base.getTime() + Number(raw) * 24 * 60 * 60 * 1000);
        } else {
          // Fallback generic parsing
          d = new Date(raw);
        }
        include = d instanceof Date && !isNaN(d.getTime()) && d >= startDate && d <= endDate;
      }
      if (!include) continue;

      wins.push({
        date: dateStr,
        department,
        position,
        remarks,
      });
    }

    res.json({ wins });
  } catch (err) {
    console.error('Error fetching key wins:', err);
    res.status(500).json({ wins: [], error: 'Failed to fetch key wins' });
  }
});

// Daily Updates endpoint - reads a tab linked from Google Form
// Accepts either a tab named 'Daily Update'/'Daily Updates' OR a 'Form Responses*' tab
// Expected headers (case-insensitive startsWith/contains matching):
// Timestamp|Date, TA Name, Department, Country, Role/ Position, Number of Openings,
// Interviews Scheduled (today), Interviews Completed (today), Cancelled/ No Show (today),
// Offers Made (today), Pending Interview Feedback (count), Upcoming HM Interviews (next 7 days), Progress/ Remark
app.get('/api/daily-updates', async (req, res) => {
  try {
    if (!sheets || !auth) {
      return res.json({ updates: [] });
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return res.json({ updates: [] });
    }

    const { start, end, dept, ta, country } = req.query;
    let startDate = null;
    let endDate = null;
    if (start && end) {
      try {
        startDate = new Date(`${start}T00:00:00`);
        endDate = new Date(`${end}T23:59:59`);
      } catch (_) {
        startDate = null; endDate = null;
      }
    }

    const response = await sheets.spreadsheets.get({ spreadsheetId, includeGridData: true });

    // Pick target sheet: prefer 'Daily Update(s)', else first 'Form Responses' sheet
    const sheetsList = response.data.sheets || [];
    let target = sheetsList.find(s => {
      const t = (s.properties.title || '').toLowerCase();
      return t === 'daily update' || t === 'daily updates';
    });
    if (!target) {
      target = sheetsList.find(s => (s.properties.title || '').toLowerCase().includes('form responses')) || sheetsList[0];
    }
    if (!target) return res.json({ updates: [] });

    const rows = target.data?.[0]?.rowData || [];
    if (rows.length === 0) return res.json({ updates: [] });

    const headers = rows[0]?.values?.map(v => (v.formattedValue || '').trim()) || [];
    const idxTimestamp = headers.findIndex(h => h.toLowerCase().startsWith('timestamp') || h.toLowerCase().startsWith('date'));
    const idxTa = headers.findIndex(h => h.toLowerCase().startsWith('ta name'));
    const idxDept = headers.findIndex(h => h.toLowerCase().startsWith('department'));
    const idxCountry = headers.findIndex(h => h.toLowerCase().startsWith('country'));
    const idxRole = headers.findIndex(h => h.toLowerCase().startsWith('role'));
    const idxOpenings = headers.findIndex(h => h.toLowerCase().includes('number of opening'));
    const idxSched = headers.findIndex(h => h.toLowerCase().startsWith('interviews scheduled'));
    const idxDone = headers.findIndex(h => h.toLowerCase().startsWith('interviews completed'));
    const idxCancel = headers.findIndex(h => h.toLowerCase().includes('cancelled') || h.toLowerCase().includes('no show'));
    const idxOffers = headers.findIndex(h => h.toLowerCase().startsWith('offers made'));
    const idxPending = headers.findIndex(h => h.toLowerCase().includes('pending interview feedback'));
    const idxUpcoming = headers.findIndex(h => h.toLowerCase().startsWith('upcoming hm interviews'));
    const idxRemarks = headers.findIndex(h => h.toLowerCase().includes('progress'));

    const updates = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r?.values) continue;

      const ts = idxTimestamp >= 0 ? (r.values[idxTimestamp]?.formattedValue || '') : '';
      const taName = idxTa >= 0 ? (r.values[idxTa]?.formattedValue || '') : '';
      const department = idxDept >= 0 ? (r.values[idxDept]?.formattedValue || '') : '';
      const countryVal = idxCountry >= 0 ? (r.values[idxCountry]?.formattedValue || '') : '';
      const role = idxRole >= 0 ? (r.values[idxRole]?.formattedValue || '') : '';
      const numOpenings = idxOpenings >= 0 ? parseInt(r.values[idxOpenings]?.formattedValue || '0', 10) : 0;
      const interviewsScheduled = idxSched >= 0 ? parseInt(r.values[idxSched]?.formattedValue || '0', 10) : 0;
      const interviewsCompleted = idxDone >= 0 ? parseInt(r.values[idxDone]?.formattedValue || '0', 10) : 0;
      const cancelledNoShow = idxCancel >= 0 ? parseInt(r.values[idxCancel]?.formattedValue || '0', 10) : 0;
      const offersMade = idxOffers >= 0 ? parseInt(r.values[idxOffers]?.formattedValue || '0', 10) : 0;
      const pendingFeedback = idxPending >= 0 ? parseInt(r.values[idxPending]?.formattedValue || '0', 10) : 0;
      const upcomingHm = idxUpcoming >= 0 ? parseInt(r.values[idxUpcoming]?.formattedValue || '0', 10) : 0;
      const remarks = idxRemarks >= 0 ? (r.values[idxRemarks]?.formattedValue || '') : '';

      if (!ts && !taName && !department) continue;

      // Parse timestamp/date robustly
      let d = null;
      const raw = (ts || '').trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        d = new Date(raw);
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(raw)) {
        const [m, dd, yyyy] = raw.split('/').map(v => parseInt(v, 10));
        d = new Date(yyyy, m - 1, dd);
      } else if (!isNaN(Date.parse(raw))) {
        d = new Date(raw);
      }

      // Filters
      let include = true;
      if (startDate && endDate && d) include = d >= startDate && d <= endDate;
      if (include && dept) include = (department || '').toLowerCase() === String(dept).toLowerCase();
      if (include && ta) include = (taName || '').toLowerCase() === String(ta).toLowerCase();
      if (include && country) include = (countryVal || '').toLowerCase() === String(country).toLowerCase();
      if (!include) continue;

      updates.push({
        date: raw,
        taName,
        department,
        country: countryVal,
        role,
        numberOfOpenings: numOpenings,
        interviewsScheduled,
        interviewsCompleted,
        cancelledNoShow,
        offersMade,
        pendingInterviewFeedback: pendingFeedback,
        upcomingHmInterviews: upcomingHm,
        remarks,
      });
    }

    res.json({ updates });
  } catch (err) {
    console.error('Error fetching daily updates:', err);
    res.status(500).json({ updates: [], error: 'Failed to fetch daily updates' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
