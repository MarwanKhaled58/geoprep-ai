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
