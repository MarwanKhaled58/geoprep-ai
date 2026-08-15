# GeoPrep AI

Professional GIS dataset preparation assistant for GeoAI workflows.

## What the MVP Does

GeoPrep AI helps users prepare and evaluate datasets before GeoAI modeling work. The current MVP supports:

- Uploading raster, vector, shapefile, ZIP shapefile, image, document, and supporting files.
- Inspecting GIS metadata where possible.
- Detecting incomplete shapefiles before dataset checks continue.
- Classifying files as raster, vector, supporting, or unsupported.
- Reviewing CRS consistency across spatial files.
- Reviewing bounds where applicable.
- Detecting raster-vector relationships.
- Recommending a GeoAI task.
- Generating a dataset preparation plan.
- Showing warning impact, warning actions, and recommended next actions.
- Exporting JSON and Markdown readiness reports.
- Copying a concise report summary.
- Reviewing export package readiness and package preview information.

## MVP Test Scenarios

Use this checklist to validate the main MVP workflow:

1. Open app and confirm workflow guidance appears.
2. Upload raster-only file and confirm raster-only readiness report.
3. Upload incomplete shapefile and confirm blocked-input report.
4. Upload raster + vector files and confirm CRS/bounds/raster-vector checks.
5. Use Warning Summary, Warning Impact, and View warning files.
6. Use Report Navigation and Search report.
7. Export JSON report.
8. Export Markdown report.
9. Copy Report Summary.
10. Review Export Package Readiness and Package Preview.

## Final Regression Test Log

Use this table during final MVP regression testing.

| Test | Expected Result | Status | Notes |
| --- | --- | --- | --- |
| App opens successfully. | Frontend loads and upload guidance appears. | Passed | Workflow, MVP scenarios, and checklist guidance appeared. |
| Backend health/API is reachable. | Backend responds from `http://127.0.0.1:8000`. | Passed on clean backend port; verify on 8000 after restart | `/health` and `/api/health` passed on clean port `8010`; port `8000` had a stale old process during testing. |
| Raster-only upload works. | Raster-only readiness report is generated. | Passed | Raster-only report appeared. |
| Incomplete shapefile upload shows blocked-input report. | Report explains missing shapefile sidecars and next action. | Passed | Blocked-input report appeared with shapefile sidecar guidance. |
| Raster + vector upload checks CRS/bounds/relationship. | Dataset report includes CRS, bounds, and raster-vector relationship sections. | Passed for blocked-input mixed raster + incomplete shapefile case | Mixed raster + incomplete shapefile flow produced the expected blocked-input report. |
| Warning Summary and Warning Impact display correctly. | Warning counts, impact, and warning actions are visible. | Passed | Warning Summary and Warning Impact displayed correctly. |
| Report Navigation works. | Navigation buttons scroll to the expected report sections. | Pending final manual click-through | Run one final navigation click-through after clearing port `8000`. |
| Search report works. | Search results find matching report sections. | Pending final manual search check | Run one final search check after clearing port `8000`. |
| JSON export works. | JSON readiness report downloads successfully. | Passed | JSON report export completed. |
| Markdown export works. | Markdown readiness report downloads successfully. | Passed | Markdown report export completed. |
| Copy Report Summary works. | Clipboard receives a concise report summary. | Passed | Copy summary completed. |
| Export Package Readiness and Package Preview display correctly. | Export readiness status, checklist, preview, and placeholder action are visible. | Passed | Export readiness and package preview displayed. |

## Important Shapefile Rule

Shapefiles are multi-file datasets. A `.shp` file alone is incomplete.

Minimum required shapefile files:

- `.shp`
- `.shx`
- `.dbf`

Strongly recommended:

- `.prj` for CRS metadata

Complete shapefile sets can be uploaded together by selecting the sidecar files in one upload. ZIP shapefile packages are also supported when the ZIP contains a complete shapefile group.

## Local Run Instructions

Run the backend and frontend in separate terminals.

### Backend

Run these commands from the project root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

Important backend notes:

- Run the backend from the `backend` folder.
- Use `uvicorn app.main:app --reload`.
- Do not use `uvicorn main:app --reload`.

### Frontend

Run these commands from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

If the frontend shows `NetworkError`, confirm the backend is running on `http://127.0.0.1:8000`.

### Port 8000 Troubleshooting

The backend should normally run at `http://127.0.0.1:8000`.

If `/health` returns old branding or `/api/health` returns `404`, an old backend process may still be running.

Check port `8000`:

```powershell
netstat -ano | findstr :8000
```

Kill the `LISTENING` PID:

```powershell
taskkill /PID <PID> /F
```

If Windows shows a stale listener with no matching process, restart Windows.

After restart, run the backend from the `backend` folder:

```powershell
python -m uvicorn app.main:app --reload
```

Expected health response:

```json
{"status":"ok","service":"GeoPrep AI Backend","version":"0.1.0"}
```

## Development Status

Current status: First Version / Strong MVP in progress.

Completed major capabilities include:

- Upload precheck.
- Shapefile and ZIP shapefile handling.
- CRS guidance.
- Warning impact and warning actions.
- JSON and Markdown report exports.
- Copyable report summary.
- Export package readiness and package preview.
- In-app MVP checklist.

## MVP Known Limitations

- Export package generation is currently preview/placeholder only.
- The MVP prepares and diagnoses datasets; it does not train models yet.
- The MVP does not run inference yet.
- The MVP does not auto-label data yet.
- CRS normalization should still be manually confirmed for production datasets.
- Shapefile inspection requires complete shapefile sidecars.
- Browser testing with complete shapefile groups and complete ZIP packages should be performed with real sample datasets.
- Large dataset performance should be tested later with production-scale data.

## Future Roadmap

- Real model-ready package generation.
- Dataset history / saved sessions.
- Advanced CRS repair workflows.
- Model training integration.
- Inference workflows.
- Auto-labeling support.
- Chat with dataset / assistant-based dataset QA.
