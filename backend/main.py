from fastapi import FastAPI

app = FastAPI(title="GeoPrep AI API")

@app.get("/")
def root():
    return {"message": "GeoPrep AI backend is running"}
    